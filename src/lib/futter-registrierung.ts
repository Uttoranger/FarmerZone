/**
 * Futtermittel-Registrierung je Gebinde (Gate 6, Nachtlauf Nr. 20; Register
 * E9, E10; Sicherheitsanforderung S7).
 *
 * Rein und ohne Datenbank — Formular, Server Actions, Warenkorb-Prüfung und
 * Hof-Einstellungen fragen dieselbe Regel (tests/futter-registrierung.test.ts).
 *
 * DIE REGEL (E10, fachliche Klärung des Menschen):
 *   Eigene Ernte, lose oder in Ballen, braucht nur die LFBIS-Nummer.
 *   Abgepacktes Heimtierfutter mit eigenem Etikett, Zukauf und Mischen
 *   brauchen eine aktive Meldung beim BAES.
 *
 * Was das Modell davon kennt: die Verpackung des Gebindes (Product.verpackung,
 * setzt das Futter-Formular aus der Größen-Vorlage) und die Kategorie. Mischfutter
 * und Ergänzungsfutter sind Mischungen — wer sie verkauft, mischt oder kauft
 * zu; beides braucht die BAES-Meldung. Auf der Seite des Hofs steht EINE Nummer
 * mit Status (Farm.betriebsnummer, Farm.betriebsstatus): Primärproduktion =
 * LFBIS, Registriert oder Zugelassen = beim BAES gemeldet. Die Plattform prüft
 * die Nummer nicht (E9) — der Hof trägt sie selbst ein.
 *
 * Produkte OHNE Verpackung (alle Bestandsprodukte vor Nr. 20) sperrt die Regel
 * nicht: Für sie hat nie jemand angegeben, wie sie verpackt sind, und eine
 * Vermutung würde verkaufte Ware ohne Zutun des Hofs aus dem Shop nehmen.
 * Neue Futtermittel entstehen nur noch über das Futter-Formular, das die
 * Verpackung je Größe setzt.
 */
import {
  istFuttermittel,
  type AbgabeValue,
  type BetriebsstatusValue,
  type ProductCategoryValue,
} from '@/lib/taxonomie'

/** Dieselben Werte wie das Prisma-Enum `Verpackung`. */
export const VERPACKUNG_VALUES = ['LOSE_BALLEN', 'ABGEPACKT_ETIKETT'] as const

export type VerpackungValue = (typeof VERPACKUNG_VALUES)[number]

/** Was ein Gebinde braucht: die LFBIS-Nummer oder die BAES-Meldung. */
export type Registrierung = 'LFBIS' | 'BAES'

/** Kategorien, die Mischen oder Zukauf bedeuten — dafür genügt LFBIS nie (E10). */
export const BAES_KATEGORIEN = ['MISCHFUTTER', 'ERGAENZUNGSFUTTER'] as const satisfies readonly ProductCategoryValue[]

/** Was der Hof eingetragen hat (Hofprofil, /settings/profile). */
export type HofRegistrierung = {
  betriebsnummer: string | null
  betriebsstatus: BetriebsstatusValue | null
}

export type Gebinde = {
  category: ProductCategoryValue | null
  verpackung: VerpackungValue | null
}

/** Status, bei denen der Hof beim BAES gemeldet ist (BETRIEBSSTATUS in taxonomie.ts). */
const BAES_STATUS: readonly BetriebsstatusValue[] = ['REGISTRIERT', 'ZUGELASSEN']

/**
 * Welche Registrierung ein Gebinde braucht — null, wenn keine: kein Futter,
 * oder ein Bestandsprodukt ohne Angabe zur Verpackung (siehe Kopf).
 */
export function noetigeRegistrierung(g: Gebinde): Registrierung | null {
  if (g.verpackung == null || !istFuttermittel(g.category)) return null
  if (g.category !== null && (BAES_KATEGORIEN as readonly string[]).includes(g.category)) return 'BAES'
  return g.verpackung === 'ABGEPACKT_ETIKETT' ? 'BAES' : 'LFBIS'
}

/** Hat der Hof eine Nummer eingetragen? Nur Leerzeichen zählen nicht. */
function hatNummer(hof: HofRegistrierung): boolean {
  return (hof.betriebsnummer ?? '').trim() !== ''
}

/**
 * Hat der Hof, was die Registrierung verlangt? LFBIS: irgendeine eingetragene
 * Nummer — wer beim BAES gemeldet ist, ist auch als Futtermittelbetrieb
 * erfasst. BAES: Nummer UND Status Registriert oder Zugelassen.
 */
export function hatRegistrierung(registrierung: Registrierung, hof: HofRegistrierung): boolean {
  if (!hatNummer(hof)) return false
  if (registrierung === 'LFBIS') return true
  return hof.betriebsstatus !== null && BAES_STATUS.includes(hof.betriebsstatus)
}

export type Sperre = { registrierung: Registrierung; grund: string }

/**
 * Der Satz am Schloss einer Größe (Formular, Produktliste, Fehlermeldung des
 * Schalters). Heimtierfutter wörtlich aus dem Mockup mobil-h2-neues-futter-
 * meldung-fehlt; die beiden anderen Fälle zeigt kein Mockup — vor dem
 * Livegang mit den übrigen Texten gegenlesen lassen (E10).
 */
export const SPERR_GRUND = {
  heimtierfutter: 'Wird erst sichtbar mit BAES-Meldung für Heimtierfutter',
  mischenZukauf: 'Wird erst sichtbar mit BAES-Meldung für Mischen oder Zukauf',
  lfbis: 'Wird erst sichtbar mit deiner LFBIS-Nummer',
} as const

/**
 * Darf dieses Gebinde in den Shop? null = ja; sonst die fehlende Registrierung
 * und der Satz dazu. Dieselbe Antwort beim Anlegen, beim Schalter „Sichtbar",
 * beim Bearbeiten, im Warenkorb und im Checkout (S7).
 */
export function gebindeSperre(g: Gebinde, hof: HofRegistrierung): Sperre | null {
  const registrierung = noetigeRegistrierung(g)
  if (registrierung === null || hatRegistrierung(registrierung, hof)) return null
  if (registrierung === 'LFBIS') return { registrierung, grund: SPERR_GRUND.lfbis }
  return {
    registrierung,
    grund: g.verpackung === 'ABGEPACKT_ETIKETT' ? SPERR_GRUND.heimtierfutter : SPERR_GRUND.mischenZukauf,
  }
}

/**
 * Neue Futtermittel entstehen nur über das Futter-Formular (Nr. 20): Nur dort
 * wird je Größe die Verpackung gesetzt, an der die Sperre hängt. Ein neues
 * Futtermittel ohne Verpackung wäre an der Sperre vorbei — createProduct lehnt
 * es mit diesem Satz ab.
 */
export const FUTTER_NUR_UEBER_FORMULAR =
  'Futtermittel legst du über „Neues Futtermittel" an – dort mit Verkaufsgrößen und deiner Registrierung.'

/** Ist das Gebinde gesperrt? Kurzform für Filter. */
export function istGebindeGesperrt(g: Gebinde, hof: HofRegistrierung): boolean {
  return gebindeSperre(g, hof) !== null
}

// ─── „Deine Futtermittel-Registrierungen" ──────────────────────────────────

export type FallStand = 'erfuellt' | 'fehlt' | 'info'

export type RegistrierungsFall = {
  id: string
  titel: string
  beispiele: string
  nachweis: string
}

/**
 * Die sieben Fälle aus dem Mockup web-h2-neues-futter (E10). Vor dem
 * Livegang von Landwirtschaftskammer bzw. BAES gegenlesen lassen
 * (Umsetzungsprompt Abschnitt 10).
 *
 * Abweichend vom Mockup (Nr. 36): Lesart der Freigabe Lauf 7 (freigabe.md
 * §11) zu § 8 Abs. 7 Futtermittelverordnung 2010 — abgepacktes Heimtierfutter
 * und fertige Packungen brauchen eine Meldung beim BAES statt einer
 * Registrierung. Gegenlesen offen (Bericht 36): Ob ein Hof, der eigene Ernte
 * selbst abpackt, darunter fällt oder als Hersteller registriert sein muss,
 * ist nicht geklärt. Die Paragrafen-Angabe steht nur hier, nicht im
 * Nutzertext. Das Kürzel USP fiel mit Nr. 36 weg (Fachbegriff); seit Nr. 45
 * steht es ausgeschrieben im orangen Satz (USP_AUSGESCHRIEBEN).
 */
export const REGISTRIERUNGS_FAELLE = [
  {
    id: 'eigene-ernte-lose',
    titel: 'Eigene Ernte, lose oder in Ballen',
    beispiele: 'Heu, Grummet, Stroh, Silage, Futtergetreide, Körnermais',
    nachweis: 'LFBIS-Nummer genügt – über die AMA automatisch als Futtermittelbetrieb erfasst',
  },
  {
    id: 'heimtierfutter-abgepackt',
    titel: 'Eigene Ernte als Heimtierfutter abgepackt',
    beispiele: 'Sackerl und Säcke mit eigenem Etikett, z. B. Nagerheu 1 kg',
    nachweis: 'Meldung beim BAES – eine Registrierung brauchst du dafür nicht',
  },
  {
    id: 'zukauf',
    titel: 'Zugekauftes Futter weiterverkaufen',
    beispiele: 'Heu oder Getreide von anderen Höfen',
    nachweis: 'Meldung beim BAES als Futtermittelhändler',
  },
  {
    id: 'mischfutter',
    titel: 'Mischfutter oder Verarbeitung',
    beispiele: 'Mischungen für Dritte, Trocknung von Fremdgut',
    nachweis: 'erweiterte BAES-Registrierung · HACCP-Konzept',
  },
  {
    id: 'zusatzstoffe',
    titel: 'Futter mit Zusatzstoffen',
    beispiele: 'Futterharnstoff, Kokzidiostatika, Reinsubstanzen',
    nachweis: 'α-Zulassung (α AT …) · BAES, mit Vor-Ort-Prüfung',
  },
  {
    id: 'tierisches-heimtierfutter',
    titel: 'Tierisches Heimtierfutter',
    beispiele: 'BARF, Pansen, Ohren, Knochen, Kauartikel',
    nachweis: 'TNP-Zulassung · Bezirkshauptmannschaft (Amtstierarzt)',
  },
  {
    id: 'fertige-packungen',
    titel: 'Fertige Packungen anderer Hersteller',
    beispiele: 'nur weiterverkaufen, nicht selbst abpacken',
    nachweis: 'keine Registrierung – nur Meldung beim BAES',
  },
] as const satisfies readonly RegistrierungsFall[]

export type RegistrierungsFallId = (typeof REGISTRIERUNGS_FAELLE)[number]['id']

/** Der Satz unter den Fällen (Mockup web-h2-neues-futter). */
export const DEUTSCHLAND_HINWEIS =
  'Höfe in Deutschland: statt LFBIS die 12-stellige VVVO-Betriebsnummer, Registrierung bei der zuständigen Landesbehörde.'

/** Die beiden Fälle, die das Futter-Formular entscheidet; die übrigen stehen unter „Alle Futterarten". */
export const HAUPT_FAELLE: readonly RegistrierungsFallId[] = ['eigene-ernte-lose', 'heimtierfutter-abgepackt']

/**
 * Wie ein Fall für diesen Hof steht. Nur, was das Modell wirklich weiß:
 * LFBIS aus der Nummer, BAES-Meldung (Heimtierfutter, Handel) aus dem Status
 * Registriert/Zugelassen, die α-Zulassung aus Zugelassen. Für Mischfutter
 * (HACCP), tierisches Heimtierfutter (TNP) und fertige Packungen gibt es keine
 * Angabe — dort steht nur, was es braucht ('info'), nie ein Haken.
 */
export function fallStand(id: RegistrierungsFallId, hof: HofRegistrierung): FallStand {
  switch (id) {
    case 'eigene-ernte-lose':
      return hatRegistrierung('LFBIS', hof) ? 'erfuellt' : 'fehlt'
    case 'heimtierfutter-abgepackt':
      return hatRegistrierung('BAES', hof) ? 'erfuellt' : 'fehlt'
    case 'zukauf':
      return hatRegistrierung('BAES', hof) ? 'erfuellt' : 'info'
    case 'zusatzstoffe':
      return hatNummer(hof) && hof.betriebsstatus === 'ZUGELASSEN' ? 'erfuellt' : 'info'
    case 'mischfutter':
    case 'tierisches-heimtierfutter':
    case 'fertige-packungen':
      return 'info'
  }
}

/** Die Nummer ohne vorangestelltes Kürzel — Höfe tippen oft „LFBIS 1234567". */
export function nummerOhneKuerzel(nummer: string | null): string | null {
  const ohne = (nummer ?? '').trim().replace(/^(LFBIS|BAES)[\s:.-]*/i, '')
  return ohne === '' ? null : ohne
}

/** Die Zeile unter einem Hauptfall: Nummer bzw. „eingetragen" oder „fehlt" (Mockups). */
export function fallZeile(id: RegistrierungsFallId, hof: HofRegistrierung): string | null {
  const stand = fallStand(id, hof)
  if (id === 'eigene-ernte-lose') {
    const nummer = nummerOhneKuerzel(hof.betriebsnummer)
    return stand === 'erfuellt' && nummer ? `LFBIS ${nummer} · automatisch erfasst` : 'LFBIS-Nummer · fehlt'
  }
  if (id === 'heimtierfutter-abgepackt') return stand === 'erfuellt' ? 'BAES-Meldung · eingetragen' : 'BAES-Meldung · fehlt'
  return null
}

export type RegistrierungsSatz = { ton: 'gruen' | 'orange'; text: string }

/**
 * Das Portal, über das die Meldung beim BAES läuft — nie als nacktes Kürzel
 * (freigabe.md §12 Nr. 45: „USP ausschreiben"; tests/fachwort-wache.test.ts).
 */
export const USP_AUSGESCHRIEBEN = 'Unternehmensserviceportal (USP)'

/**
 * Die Sätze über den Fällen — was der Hof mit seinem Stand anbieten kann
 * (Mockups web-h2-neues-futter und mobil-h2-neues-futter-meldung-fehlt; der
 * orange Satz seit Nr. 36 mit „keine Registrierung", seit Nr. 45 wieder mit
 * dem Weg zur Meldung, das USP ausgeschrieben — siehe REGISTRIERUNGS_FAELLE).
 */
export function registrierungsSaetze(hof: HofRegistrierung): RegistrierungsSatz[] {
  const saetze: RegistrierungsSatz[] = []
  if (hatRegistrierung('LFBIS', hof)) {
    saetze.push({ ton: 'gruen', text: 'Ballen und lose Ware: deine LFBIS-Nummer genügt.' })
  } else {
    saetze.push({
      ton: 'orange',
      text: 'Ballen und lose Ware noch nicht möglich. Dafür brauchst du deine LFBIS-Nummer – trag sie in den Einstellungen ein.',
    })
  }
  if (hatRegistrierung('BAES', hof)) {
    saetze.push({
      ton: 'gruen',
      text: 'Sackerl und Sack: das ist abgepacktes Heimtierfutter – deine BAES-Meldung dafür ist eingetragen.',
    })
  } else {
    saetze.push({
      ton: 'orange',
      text: `Sackerl und Sack noch nicht möglich. Abgepacktes Heu mit eigenem Etikett gilt als Heimtierfutter – dafür brauchst du eine Meldung beim BAES über das ${USP_AUSGESCHRIEBEN}, keine Registrierung.`,
    })
  }
  return saetze
}

/**
 * Der Satz über dem Speichern-Knopf: Was geht sofort online, was wartet?
 * (Mockup: „Ballen sind sofort sichtbar. Sackerl und Sack folgen nach der
 * Meldung.") Allgemein formuliert, weil die Größen frei benannt sind.
 */
export function speichernHinweis(sofort: number, wartend: number): string | null {
  if (wartend === 0) return null
  if (sofort === 0) return 'Noch keine Größe kann online gehen. Sie bleiben nicht im Shop, bis deine LFBIS-Nummer bzw. BAES-Meldung eingetragen ist.'
  const vorne = sofort === 1 ? '1 Größe ist sofort sichtbar.' : `${sofort} Größen sind sofort sichtbar.`
  const hinten = wartend === 1 ? '1 Größe folgt nach der Meldung.' : `${wartend} Größen folgen nach der Meldung.`
  return `${vorne} ${hinten}`
}

// ─── Bestätigung des Hofs und Hinweise (E10a, Nachtlauf Nr. 23) ────────────
//
// Futter geht live, ohne dass die Erklärtexte gegengelesen sind (E10a). Den
// Ausgleich tragen die Sätze hier — EINE Quelle für Futter-Formular,
// Produktdialog, Server Actions, Produktseite und Warenkorb. Die Wortlaute
// stehen so im Register; tests/futter-bestaetigung.test.ts hält sie fest.

/** Der Pflicht-Haken im Futter-Formular und im Produktdialog (E10a, wörtlich). */
export const FUTTER_BESTAETIGUNG_TEXT =
  'Ich bestätige, dass meine Angaben zu Registrierung, Kennzeichnung und Verpackung richtig und vollständig sind. Für die Richtigkeit bin ich verantwortlich. Falsche Angaben können nach dem Futtermittelgesetz bestraft werden.'

/** Fehler am Haken, wenn er beim Anlegen fehlt. */
export const FUTTER_BESTAETIGUNG_FEHLT =
  'Bitte bestätige deine Angaben mit dem Haken – ohne Bestätigung können wir das Futter nicht speichern.'

/** Antwort des Servers, wenn beim Bearbeiten Angaben geändert, aber nicht neu bestätigt wurden. */
export const FUTTER_BESTAETIGUNG_NEU =
  'Du hast Angaben zum Futter geändert. Bitte bestätige sie neu mit dem Haken unter der Kennzeichnung, dann speichern wir.'

/** Der Satz unter dem Haken beim Bearbeiten — wann er nicht nötig ist (OHNE_NEUE_BESTAETIGUNG). */
export const FUTTER_BESTAETIGUNG_AUSNAHME = 'Änderst du nur Preis, Vorrat, Foto oder Sichtbarkeit, brauchst du den Haken nicht.'

/**
 * Der erste Satz des Abschnitts „Kennzeichnung" im Futter-Formular und im
 * Produktdialog: was das Fachwort heißt (freigabe.md §12 Nr. 45). Der
 * Pflicht-Haken aus E10a nennt „Kennzeichnung" wörtlich und steht im selben
 * Abschnitt — der Satz erklärt ihn mit, ohne ihn umzuformulieren.
 */
export const KENNZEICHNUNG_ERKLAERUNG =
  'Kennzeichnung heißt: die Angaben, die zu jedem Futter gehören – was es ist, woraus es besteht und für welche Tiere.'

/** Wo der Hof die Angaben findet — in beiden Formularen gleich. */
export const KENNZEICHNUNG_FUNDORT = 'Alle Angaben findest du auf dem Sackanhänger oder Lieferschein deines Futters.'

/** Kopfhinweis über den sieben Fällen (E10a, wörtlich). */
export const ORIENTIERUNG_HINWEIS =
  'Zur Orientierung, keine Rechtsberatung. Im Zweifel bei der Bezirkshauptmannschaft, beim BAES oder bei der Landwirtschaftskammer nachfragen.'

/**
 * Die BAES-Seite zu Futtermitteln (häufige Fragen) — die einzige Stelle mit
 * der Adresse. Vom Menschen in der Freigabe vorgegeben (Nr. 36, freigabe.md
 * §11); bis dahin stand hier die Startseite des BAES (Nr. 23).
 */
export const BAES_FUTTERMITTEL_URL = 'https://baes.gv.at/en/admission/feed/faq-feed'

/** Linktext zur BAES-Seite — die Seite aus der Freigabe ist die englische Fassung, das sagt der Text vorher. */
export const BAES_LINK_TEXT = 'Häufige Fragen des BAES zu Futtermitteln (englisch)'

/**
 * Kontakt des BAES für Futtermittel im Kopfhinweis (Nr. 36). Bewusste Ausnahme
 * zur Regel „keine echten E-Mails und Telefonnummern im Code" (CLAUDE.md):
 * Das ist der öffentliche Kontakt einer Behörde, keine Angabe über eine
 * Person, und der Mensch hat ihn in der Freigabe ausdrücklich verlangt. Er
 * steht NUR hier — tests/futter-bestaetigung.test.ts sucht nach Kopien.
 */
export const BAES_KONTAKT = {
  /** Der Satz vor E-Mail und Telefon. */
  satz: 'Du erreichst das BAES auch direkt:',
  email: 'futtermittel@baes.gv.at',
  /** So, wie die Behörde sie schreibt; der Link wählt sie ohne Leerzeichen. */
  telefon: '+43 5 0555 33216',
} as const

/** Was der Screenreader vor Adresse und Nummer ansagt — die Links zeigen sonst nur die Werte. */
export const BAES_KONTAKT_VORLESEN = {
  email: 'E-Mail an das BAES: ',
  telefon: 'BAES anrufen: ',
} as const

/** Link zum Schreiben an das BAES. */
export const BAES_KONTAKT_MAILTO = `mailto:${BAES_KONTAKT.email}`

/** Link zum Anrufen — tel: verlangt die Nummer ohne Leerzeichen, darum aus `telefon` gebaut statt ein zweites Mal geschrieben. */
export const BAES_KONTAKT_TEL = `tel:${BAES_KONTAKT.telefon.replace(/\s/g, '')}`

/** Hinweis für Kundinnen bei jedem Futter (E10a, wörtlich). */
export const KUNDEN_VERANTWORTUNG =
  'Die Angaben zu Registrierung und Kennzeichnung stammen vom Hof. Der Hof ist für ihre Richtigkeit verantwortlich; FarmerZone vermittelt nur und prüft die Angaben nicht.'

/** Zusatz bei Abgabe „nur an Betriebe" (E10a, wörtlich). */
export const BETRIEB_VERANTWORTUNG = 'Als Betrieb bist du für den bestimmungsgemäßen Einsatz verantwortlich.'

export type FutterAbgabe = { category: ProductCategoryValue | null; abgabe: AbgabeValue }

/**
 * Die Sätze für Kundinnen zu diesen Produkten: der Verantwortungs-Hinweis,
 * sobald eines davon Futter ist, und der Zusatz, sobald ein Futter nur an
 * Betriebe geht. Leer ohne Futter. Reine Anzeige — ob verkauft wird,
 * entscheiden Warenkorb-Prüfung und Checkout, nicht diese Funktion.
 */
export function futterVerantwortung(produkte: readonly FutterAbgabe[]): string[] {
  const futter = produkte.filter((p) => istFuttermittel(p.category))
  if (futter.length === 0) return []
  return futter.some((p) => p.abgabe === 'NUR_BETRIEBE') ? [KUNDEN_VERANTWORTUNG, BETRIEB_VERANTWORTUNG] : [KUNDEN_VERANTWORTUNG]
}

/** Dasselbe für einen Warenkorb: Positionen mit den Produkten des Hofs abgleichen, Unbekanntes zählt nicht. */
export function futterVerantwortungImKorb(
  positionen: readonly { productId: string }[],
  produkte: readonly (FutterAbgabe & { id: string })[]
): string[] {
  const imKorb = new Set(positionen.map((p) => p.productId))
  return futterVerantwortung(produkte.filter((p) => imKorb.has(p.id)))
}

/**
 * Was der Hof ändern darf, ohne neu zu bestätigen. Keines davon ist eine
 * Angabe zu Registrierung, Kennzeichnung oder Verpackung, und für jedes gibt
 * es einen eigenen Weg ohne Futter-Formular (Vorrat-Stepper, Schalter
 * „Sichtbar", Foto im Hofseiten-Editor) — der Haken nur im Dialog schützte
 * dort nichts. ALLES andere verlangt eine neue Bestätigung, auch Name,
 * Beschreibung, Siegel, Sorte, Abgabe, Einheit und MwSt: lieber einmal zu oft
 * (konservativ, Bericht 20 „Nachtrag Lauf 6").
 */
export const OHNE_NEUE_BESTAETIGUNG = ['price', 'stock', 'isAvailable', 'imageUrl'] as const

/** Der Haken selbst und sein Zeitpunkt sind keine Angabe. */
const KEINE_ANGABE_IN_KENNZEICHNUNG = ['bestaetigt', 'bestaetigtAm'] as const

/**
 * Produkt- und Kennzeichnungsangaben eines Futters, einmal so, wie sie
 * gespeichert sind, einmal so, wie sie gespeichert werden sollen. Die Werte
 * dürfen roh sein (Decimal, Date, leer statt null) — verglichen wird
 * normalisiert.
 */
export type FutterStand = {
  produkt: Record<string, unknown>
  kennzeichnung: Record<string, unknown> | null
}

/** Formularwerte (Produktdialog) als Stand: `futter` ist die Kennzeichnung. */
export function futterStandAusFormular(werte: Record<string, unknown> & { futter?: unknown }): FutterStand {
  const { futter, ...produkt } = werte
  return {
    produkt,
    kennzeichnung: futter !== null && typeof futter === 'object' ? (futter as Record<string, unknown>) : null,
  }
}

/** Hat der Wert eine Decimal-Methode? (Prisma.Decimal, ohne Prisma zu importieren.) */
function istDezimal(v: object): v is { toNumber: () => number } {
  return typeof (v as { toNumber?: unknown }).toNumber === 'function'
}

/**
 * Ein Wert in Vergleichsform: leer, null und undefined sind gleich (null),
 * Text ohne Ränder, Decimal als Zahl, Datum als ISO-Text, Listen ohne
 * Reihenfolge, Objekte ohne leere Felder. Was hier gleich wird, war für den
 * Kunden schon vorher dasselbe.
 */
function vergleichsForm(v: unknown): unknown {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') {
    const t = v.trim()
    return t === '' ? null : t
  }
  if (typeof v === 'number') return Number.isNaN(v) ? null : v
  if (typeof v !== 'object') return v
  if (v instanceof Date) return v.toISOString()
  if (istDezimal(v)) return v.toNumber()
  if (Array.isArray(v)) {
    return v
      .map(vergleichsForm)
      .map((w) => JSON.stringify(w))
      .sort()
  }
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>)
      .map(([k, w]) => [k, vergleichsForm(w)] as const)
      .filter(([, w]) => w !== null)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  )
}

function ohne(werte: Record<string, unknown>, schluessel: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(werte).filter(([k]) => !schluessel.includes(k)))
}

/**
 * Verlangt diese Änderung eine neue Bestätigung (E10a)? Ja, sobald sich eine
 * Angabe außerhalb von OHNE_NEUE_BESTAETIGUNG ändert — in der Kennzeichnung
 * jede. Ohne bisherigen Stand oder ohne gespeicherte Kennzeichnung immer: Dann
 * hat der Hof diese Angaben nie bestätigt. Felder, die nur eine Seite kennt,
 * zählen als Änderung (ein neues Feld ist nie stillschweigend ausgenommen).
 */
export function brauchtNeueBestaetigung(alt: FutterStand | null, neu: FutterStand): boolean {
  if (alt === null || alt.kennzeichnung === null || neu.kennzeichnung === null) return true
  const form = (s: FutterStand & { kennzeichnung: Record<string, unknown> }) =>
    JSON.stringify(
      vergleichsForm({
        produkt: ohne(s.produkt, OHNE_NEUE_BESTAETIGUNG),
        kennzeichnung: ohne(s.kennzeichnung, KEINE_ANGABE_IN_KENNZEICHNUNG),
      })
    )
  return form({ ...alt, kennzeichnung: alt.kennzeichnung }) !== form({ ...neu, kennzeichnung: neu.kennzeichnung })
}
