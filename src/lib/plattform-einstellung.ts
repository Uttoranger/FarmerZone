/**
 * Die Einstellungen der Plattform als Ganzes (Admin › Einstellungen; Register
 * K2-Ergänzung „Gründungshöfe sichtbar" und N15, Nr. 93) — rein und ohne
 * Datenbank prüfbar (tests/plattform-einstellung.test.ts).
 *
 * In der Datenbank steht genau EINE Zeile (`PlattformEinstellung`, Kennung
 * "plattform"), angelegt von der Migration. Gelesen wird nur; fehlt die Zeile
 * (frische Datenbank ohne Migration, Ladefehler), gelten die Standardwerte
 * hier — und die sind die Konstanten aus gruendungshof.ts. Geschrieben wird
 * nur aus der Admin-Action (src/server/actions/plattform-einstellung.ts).
 *
 * Die Prüfungen (Plätze ≥ vergeben, Ende ≥ heute) sind reine Funktionen mit
 * festen Sätzen: dieselben im Formular (sofort) und in der Action (Schutz).
 * Bis zur Nacharbeit sind Plätze und Standard-Ende gesperrt
 * (`pruefeGruendungSperre`); schaltbar ist nur die Anzeige.
 */
import {
  GRUENDUNG_BIS_STANDARD_TAG,
  MAX_GRUENDUNGSHOEFE,
  bildeGruendungBis,
  gruendungTagKurz,
  type GruendungEinstellung,
} from '@/lib/gruendungshof'
import { kalendertagInWien, wienerMitternacht } from '@/lib/wiener-tag'
import { MARKE } from '@/lib/marke'
import { PRODUKTION_HOST } from '@/lib/umgebung'

/** Die Kennung der einen Zeile. */
export const PLATTFORM_EINSTELLUNG_ID = 'plattform'

/** Das Etikett des Caches — die Admin-Action leert es nach dem Speichern. */
export const PLATTFORM_EINSTELLUNG_TAG = 'plattform-einstellung'

/**
 * Die Zeile, wie die Seiten sie brauchen — nur Zahlen und Text, damit sie
 * durch `unstable_cache` (JSON) und an Client-Komponenten gehen darf.
 * `gruendungBisTag` ist der Wiener Kalendertag JJJJ-MM-TT der DATE-Spalte.
 */
export type PlattformEinstellung = {
  gruendungPlaetze: number
  gruendungBisTag: string
  gruendungAnzeige: boolean
  /** Wer zuletzt gespeichert hat; null = noch nie (Seed-Zeile der Migration). */
  geaendertVonUserId: string | null
  /** Zeitpunkt der letzten Änderung als ISO-Text; null ohne Zeile. */
  geaendertAm: string | null
}

/** Ohne Zeile: die Standardwerte der Spalten — dieselben Zahlen wie die Konstanten. */
export const PLATTFORM_EINSTELLUNG_STANDARD: PlattformEinstellung = {
  gruendungPlaetze: MAX_GRUENDUNGSHOEFE,
  gruendungBisTag: GRUENDUNG_BIS_STANDARD_TAG,
  gruendungAnzeige: true,
  geaendertVonUserId: null,
  geaendertAm: null,
}

/** Die Zeile aus der Datenbank → die Form der Seiten (Datum als Wiener Kalendertag). */
export function plattformEinstellungAus(zeile: {
  gruendungPlaetze: number
  gruendungBisStandard: Date
  gruendungAnzeige: boolean
  geaendertVonUserId: string | null
  updatedAt: Date
}): PlattformEinstellung {
  return {
    gruendungPlaetze: zeile.gruendungPlaetze,
    gruendungBisTag: kalendertagInWien(zeile.gruendungBisStandard),
    gruendungAnzeige: zeile.gruendungAnzeige,
    geaendertVonUserId: zeile.geaendertVonUserId,
    geaendertAm: zeile.updatedAt.toISOString(),
  }
}

/** Was die Fachregeln in gruendungshof.ts brauchen. */
export function gruendungEinstellungAus(einstellung: PlattformEinstellung): GruendungEinstellung {
  return {
    plaetze: einstellung.gruendungPlaetze,
    bis: bildeGruendungBis(einstellung.gruendungBisTag),
    anzeige: einstellung.gruendungAnzeige,
  }
}

// ─── Prüfen ──────────────────────────────────────────────────────────────────

/** Obergrenze des Felds „Plätze gesamt" — nur gegen Tippfehler, keine Fachregel. */
export const GRUENDUNG_PLAETZE_MAX = 999

/** Die festen Sätze der Gruppe Gründungshöfe (Freigabe §18, Nr. 93). */
export const GRUENDUNG_EINSTELLUNG_FEHLER = {
  weniger: (vergeben: number): string =>
    `Weniger Plätze als vergeben geht nicht – ${vergeben} ${vergeben === 1 ? 'ist' : 'sind'} schon vergeben. Trag mindestens ${vergeben} ein.`,
  plaetze: `Trag bei „Plätze gesamt“ eine ganze Zahl von 0 bis ${GRUENDUNG_PLAETZE_MAX} ein.`,
  datum: 'Wähle den letzten Tag, bis zu dem neue Gründungshöfe kostenlos sind.',
  vergangen: 'Dieser Tag ist schon vorbei. Wähle heute oder einen späteren Tag.',
  gesperrt: `„Plätze gesamt“ und „Kostenlos bis“ bleiben vorerst bei ${MAX_GRUENDUNGSHOEFE} und ${gruendungTagKurz(GRUENDUNG_BIS_STANDARD_TAG)} – sonst nennen die Konditionen der Höfe andere Zahlen als die Seiten. Umschalten kannst du nur „Auf den Seiten zeigen“.`,
  ungueltig: 'Wir konnten die Eingabe nicht lesen. Lade die Seite neu und versuch es noch einmal.',
} as const

/** Eine Eingabe der Gruppe Gründungshöfe, wie Formular und Action sie prüfen. */
export type GruendungEingabe = { plaetze: number; bisTag: string; anzeige: boolean }

/**
 * Die Regeln der Gruppe Gründungshöfe: Plätze gesamt nicht unter den
 * vergebenen (wer einen Platz hat, behält ihn — Register K1/K2) und das
 * Standard-Ende nicht vor dem heutigen WIENER Tag. Zurück kommt der erste
 * verletzte Satz oder null.
 */
export function pruefeGruendungEingabe(eingabe: GruendungEingabe, vergeben: number, jetzt: Date): string | null {
  if (!Number.isInteger(eingabe.plaetze) || eingabe.plaetze < 0 || eingabe.plaetze > GRUENDUNG_PLAETZE_MAX) {
    return GRUENDUNG_EINSTELLUNG_FEHLER.plaetze
  }
  if (eingabe.plaetze < vergeben) return GRUENDUNG_EINSTELLUNG_FEHLER.weniger(vergeben)
  // Die Form allein ließe den 30. Februar durch.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eingabe.bisTag) || wienerMitternacht(eingabe.bisTag) === null) {
    return GRUENDUNG_EINSTELLUNG_FEHLER.datum
  }
  // JJJJ-MM-TT vergleicht sich als Text wie als Datum.
  if (eingabe.bisTag < kalendertagInWien(jetzt)) return GRUENDUNG_EINSTELLUNG_FEHLER.vergangen
  return null
}

/**
 * Die Sperre bis zur Nacharbeit (Nr. 93, Runde 1): Plätze gesamt und das
 * Standard-Ende bleiben bei den Konstanten aus gruendungshof.ts. Tarif-Zeile
 * und „Dein Stand“ (`ladeGruendungBis`), `setzeGruendungBisAction`, der
 * Freischalt-Dialog und Admin › Höfe rechnen noch fest damit — eine andere
 * Zahl gäbe einer Zusage mit Geldwert zwei Quellen (Gründungs-Nachricht und
 * Seiten nennten andere Nummern und Daten als die Konditionen). Fällt erst,
 * wenn diese Stellen die Einstellung lesen und die bestehenden Zusagen je
 * Hof festgeschrieben sind (Register K2). Geprüft NACH
 * `pruefeGruendungEingabe`, damit deren Sätze die genaueren bleiben.
 */
export function pruefeGruendungSperre(eingabe: Pick<GruendungEingabe, 'plaetze' | 'bisTag'>): string | null {
  return eingabe.plaetze === MAX_GRUENDUNGSHOEFE && eingabe.bisTag === GRUENDUNG_BIS_STANDARD_TAG ? null : GRUENDUNG_EINSTELLUNG_FEHLER.gesperrt
}

// ─── Texte der Seite ─────────────────────────────────────────────────────────

/** Die drei Gruppen (Register N15: Gründungshöfe · Betrieb · Plattform). */
export const EINSTELLUNGEN_GRUPPEN = ['gruendung', 'betrieb', 'plattform'] as const
export type EinstellungenGruppe = (typeof EINSTELLUNGEN_GRUPPEN)[number]

export const ADMIN_EINSTELLUNGEN_HREF = '/admin/einstellungen'

/** Der Weg zu einer Gruppe — die erste ohne Abfrage. */
export function einstellungenGruppeHref(gruppe: EinstellungenGruppe): string {
  return gruppe === 'gruendung' ? ADMIN_EINSTELLUNGEN_HREF : `${ADMIN_EINSTELLUNGEN_HREF}?gruppe=${gruppe}`
}

/** Alle Sätze von Admin › Einstellungen — EINE Quelle (Mockups admin-einstellungen, admin-mobil-einstellungen). */
export const EINSTELLUNGEN_TEXT = {
  titel: 'Einstellungen',
  satz: 'Was die Plattform als Ganzes betrifft – in Gruppen, jede mit eigenem Speichern. Änderungen gelten sofort.',
  satzKurz: 'Gruppen, jede mit eigenem Speichern.',
  navigation: 'Gruppen der Einstellungen',
  ladefehler: 'Wir konnten die Einstellungen gerade nicht laden.',
  gruppe: {
    gruendung: { titel: 'Gründungshöfe', zeile: 'Plätze, Standard-Ende, Anzeige' },
    betrieb: { titel: 'Betrieb', zeile: 'Stripe-Modus' },
    plattform: { titel: 'Plattform', zeile: 'Name und Adresse' },
  },
  gruendung: {
    register: 'Register K2',
    satz: 'Wie viele Höfe ohne Grundgebühr starten dürfen und bis wann.',
    kachelPlaetze: 'Plätze gesamt',
    kachelVergeben: 'Vergeben',
    kachelVergebenZeile: 'nach Reihenfolge der Freischaltung',
    kachelFrei: 'Frei',
    kachelFreiZeile: 'steht im Satz auf den Seiten',
    feldPlaetze: 'Plätze gesamt',
    feldBis: 'Kostenlos bis (Standard)',
    feldGesperrt: 'vorerst fest',
    gesperrtHinweis:
      'Plätze und Standard-Ende sind vorerst fest: Die Konditionen der Höfe und Admin › Höfe rechnen noch mit diesen Werten. Umschalten kannst du die Anzeige.',
    schalter: 'Auf den Seiten zeigen',
    schalterSatz:
      'Startseite (Satz im Für-Höfe-Band), /fuer-hoefe (Pill, Knopf, Preiszeile) und Registrieren (Satz). Verschwindet von selbst, wenn alle Plätze vergeben sind oder das Datum vorbei ist.',
    aufDenSeiten: 'So steht es auf den Seiten',
    aufDenSeitenLeer: 'Auf den Seiten steht gerade nichts – die Anzeige ist aus, alle Plätze sind vergeben oder das Datum ist vorbei.',
    regel:
      'Weniger Plätze als vergeben geht nicht – wer einen Platz hat, behält ihn. Ein anderes Ende für einen einzelnen Hof: Höfe › „Gründungshof bis“ (dort steht dann „abweichend“).',
    verwerfen: 'Verwerfen',
    speichern: 'Speichern',
    speichert: 'Wird gespeichert …',
    gespeichert: 'Gespeichert. Die Seiten zeigen die neuen Zahlen.',
  },
  betrieb: {
    satz: 'Nur zum Nachsehen: Den Stripe-Modus bestimmt der Schlüssel der Umgebung, nicht diese Seite.',
    stripe: 'Stripe-Modus',
    ohneStripe: 'kein Schlüssel eingerichtet',
  },
  plattform: {
    satz: 'Nur zum Nachsehen: Name und Adresse stehen an einer Stelle im Code (Register M1).',
    name: 'Name',
    adresse: 'Adresse',
  },
  /** Die Protokollzeile je Gruppe (N15): die letzte Änderung, kein Verlauf (S12 kommt nicht in diesem Lauf). */
  protokoll: (person: string, am: string): string => `Zuletzt geändert von ${person} am ${am}`,
  protokollUnbekannt: 'einem gelöschten Konto',
  protokollNie: 'Noch nie geändert – es gelten die Standardwerte.',
} as const

/** Name und Adresse der Gruppe Plattform — aus den EINEN Stellen (Register M1). */
export const PLATTFORM_ANGABEN = { name: MARKE, adresse: PRODUKTION_HOST } as const

// Datum und Uhrzeit in Wien, wie die Protokollzeile sie schreibt („12.10.2026, 21:14").
const PROTOKOLL_FORMAT = new Intl.DateTimeFormat('de-AT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Vienna',
})

/** Die Protokollzeile der Gruppe Gründungshöfe — fertig als Text. */
export function protokollZeile(einstellung: PlattformEinstellung, personName: string | null): string {
  if (einstellung.geaendertVonUserId === null || einstellung.geaendertAm === null) return EINSTELLUNGEN_TEXT.protokollNie
  return EINSTELLUNGEN_TEXT.protokoll(personName ?? EINSTELLUNGEN_TEXT.protokollUnbekannt, PROTOKOLL_FORMAT.format(new Date(einstellung.geaendertAm)))
}

/** „12 Plätze · 5 frei · bis 31.12.2027" — die Zeile der zugeklappten Gruppe am Handy. */
export function gruendungZeileKurz(gesamt: number, frei: number, bisTag: string): string {
  return `${gesamt} Plätze · ${frei} frei · bis ${gruendungTagKurz(bisTag)}`
}
