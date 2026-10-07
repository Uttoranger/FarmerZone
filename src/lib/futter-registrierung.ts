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
 * Die sieben Fälle aus dem Mockup web-h2-neues-futter, wörtlich (E10). Vor dem
 * Livegang von Landwirtschaftskammer bzw. BAES gegenlesen lassen
 * (Umsetzungsprompt Abschnitt 10).
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
    nachweis: 'aktive Meldung beim BAES (USP) als Hersteller von Heimtierfutter',
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
    nachweis: 'keine Registrierung – nur Meldung',
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
 * Die Sätze über den Fällen — was der Hof mit seinem Stand anbieten kann
 * (Mockups web-h2-neues-futter und mobil-h2-neues-futter-meldung-fehlt).
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
      text: 'Sackerl und Sack noch nicht möglich. Abgepacktes Heu mit eigenem Etikett gilt als Heimtierfutter – dafür brauchst du eine Meldung beim BAES über das USP.',
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
  if (sofort === 0) return 'Noch keine Größe kann online gehen. Sie warten als Entwurf, bis deine Registrierung eingetragen ist.'
  const vorne = sofort === 1 ? '1 Größe ist sofort sichtbar.' : `${sofort} Größen sind sofort sichtbar.`
  const hinten = wartend === 1 ? '1 Größe folgt nach der Meldung.' : `${wartend} Größen folgen nach der Meldung.`
  return `${vorne} ${hinten}`
}
