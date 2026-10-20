/**
 * Fehlerbriefkasten — die reinen Regeln (Sprint fehlerbriefkasten).
 *
 * GRUNDSATZ (auch im Schema): Der Briefkasten ist ein Eingangskanal, kein
 * Befehlskanal. Aus Meldungen entstehen Vorschläge; entscheiden und mergen tut
 * ausschließlich der Betreiber. Wünsche werden gebündelt und gezählt, nie
 * automatisch zu Aufgaben.
 *
 * Hier liegen die Dinge, die ohne Datenbank und ohne Browser prüfbar sein
 * müssen: die SICHTBARKEITSREGEL (welche Felder ein Hof sehen darf und wie
 * interne Status für ihn heißen), die Kurznummer, die Auswahl für den
 * Wochenlauf und — seit Nr. 101 (Register N14, Ergänzung) — der Ablauf im
 * Reiter „Meldungen" des Admin-Postfachs: welcher Teil, welche Karte, welche
 * Zahl im Stand-Band.
 */
import type { MarkeArt } from '@/lib/marke-art'

export const MELDUNG_ARTEN = ['FEHLER', 'WUNSCH', 'FRAGE'] as const
export type MeldungArt = (typeof MELDUNG_ARTEN)[number]

export const MELDUNG_STATUS = [
  'NEU',
  'GEPRUEFT',
  'VERMUTLICH_WUNSCH',
  'GEPLANT',
  'ERLEDIGT',
  'KEIN_FEHLER',
  'DUPLIKAT',
] as const
export type MeldungStatus = (typeof MELDUNG_STATUS)[number]

/**
 * Die Status, die die Schreibroute POST /api/triage/status setzen darf. Hier
 * statt in lib/triage-status.ts, weil das Zod-Schema sie braucht und Schemas
 * im Browser laufen können — triage-status.ts zieht über geheimnis.ts `crypto`.
 */
export const ZIEL_STATUS = ['VERMUTLICH_WUNSCH', 'GEPLANT', 'ERLEDIGT', 'GEPRUEFT'] as const satisfies readonly MeldungStatus[]
export type ZielStatus = (typeof ZIEL_STATUS)[number]

/** Was noch Arbeit ist — Voreinstellung von Export und CLI, Zähler des Wochenlaufs. */
export const STATUS_OFFEN: readonly MeldungStatus[] = ['NEU', 'GEPRUEFT', 'VERMUTLICH_WUNSCH']

/**
 * Startansicht der Admin-Liste und Zähler am Menüpunkt: was auf eine
 * Entscheidung des Menschen wartet — Neues und die Wunsch-Vorschläge der KI.
 */
export const STATUS_ZU_ENTSCHEIDEN: readonly MeldungStatus[] = ['NEU', 'VERMUTLICH_WUNSCH']

/** Abgeschlossen im Sinn der Aufbewahrung — 90 Tage danach löscht der Wochenlauf. */
export const STATUS_ABGESCHLOSSEN: readonly MeldungStatus[] = ['ERLEDIGT', 'KEIN_FEHLER', 'DUPLIKAT']

export const MELDUNG_ART_LABEL: Record<MeldungArt, string> = {
  FEHLER: 'Fehler',
  WUNSCH: 'Wunsch',
  FRAGE: 'Frage',
}

/**
 * Die Art im Meldeformular als Satz aus Sicht des Melders — „Fehler, Wunsch
 * oder Frage" ist schon Triage-Sprache; einen Satz wählt man ohne nachzudenken.
 */
export const MELDUNG_ART_SATZ: Record<MeldungArt, string> = {
  FEHLER: 'Etwas funktioniert nicht',
  WUNSCH: 'Ich hätte gern, dass …',
  FRAGE: 'Ich habe eine Frage',
}

/** Die Art als Marke im Admin-Postfach (Register G5): ein Fehler will getan werden, Wunsch und Frage laufen — wie im Eingang. */
export const MELDUNG_ART_MARKE: Record<MeldungArt, MarkeArt> = { FEHLER: 'tun', WUNSCH: 'laeuft', FRAGE: 'laeuft' }

/**
 * Die Übersetzung interner Status in das, was der Melder liest. Ruhig und ohne
 * Versprechen — „In Arbeit" heißt, jemand baut daran, nicht „kommt nächste
 * Woche". VERMUTLICH_WUNSCH ist ein Vorschlag der KI, keine Entscheidung: der
 * Melder liest dasselbe wie bei GEPRUEFT und erfährt nie davon.
 * ERLEDIGT hängt von der Art ab (ERLEDIGT_OEFFENTLICH); der Wert hier gilt
 * für Fehler und als Rückfall.
 */
export const STATUS_OEFFENTLICH: Record<MeldungStatus, string> = {
  NEU: 'Eingegangen',
  GEPRUEFT: 'Angesehen',
  VERMUTLICH_WUNSCH: 'Angesehen',
  GEPLANT: 'In Arbeit',
  ERLEDIGT: 'Behoben',
  KEIN_FEHLER: 'Kein Fehler — Antwort lesen',
  DUPLIKAT: 'Bereits bekannt',
}

/** „Behoben" passt nur zu einem Fehler — ein Wunsch wird umgesetzt, eine Frage beantwortet. */
export const ERLEDIGT_OEFFENTLICH: Record<MeldungArt, string> = {
  FEHLER: 'Behoben',
  WUNSCH: 'Umgesetzt',
  FRAGE: 'Beantwortet',
}

/** Interne Beschriftung für den Admin-Bereich und das CLI. */
export const STATUS_INTERN: Record<MeldungStatus, string> = {
  NEU: 'Neu',
  GEPRUEFT: 'Geprüft',
  VERMUTLICH_WUNSCH: 'Vermutlich Wunsch',
  GEPLANT: 'Geplant',
  ERLEDIGT: 'Erledigt',
  KEIN_FEHLER: 'Kein Fehler',
  DUPLIKAT: 'Duplikat',
}

/** Der Ton einer Marke im neuen Design — dieselben Werte wie StatusBadge (components/ui/status-badge.tsx). */
export type MeldungTon = 'offen' | 'fertig' | 'neutral'

/**
 * Der Ton des öffentlichen Status auf „Meine Meldungen" (Nachtlauf Nr. 22e,
 * Mockup web-h6-meine-meldungen): Grün, wenn sich etwas tut oder getan ist
 * (In Arbeit, Behoben/Umgesetzt/Beantwortet), sonst neutral. Nie Orange —
 * Orange heißt im Hofbereich „wartet auf dich", und keine Meldung wartet auf
 * den Hof. Die Admin-Marken (ADMIN_STATUS_TON in admin-briefkasten.ts) bleiben, wie sie sind.
 */
export const STATUS_TON: Record<MeldungStatus, MeldungTon> = {
  NEU: 'neutral',
  GEPRUEFT: 'neutral',
  VERMUTLICH_WUNSCH: 'neutral',
  GEPLANT: 'fertig',
  ERLEDIGT: 'fertig',
  KEIN_FEHLER: 'neutral',
  DUPLIKAT: 'neutral',
}

/**
 * „Kein Fehler" passt nur zu einem Fehler (Nr. 101): Ein abgelegter Wunsch
 * ist „nicht geplant", eine abgelegte Frage ist beantwortet.
 */
export const KEIN_FEHLER_OEFFENTLICH: Record<MeldungArt, string> = {
  FEHLER: 'Kein Fehler — Antwort lesen',
  WUNSCH: 'Nicht geplant — Antwort lesen',
  FRAGE: 'Beantwortet',
}

/** Was die Hof-Sicht von der Hauptmeldung eines Duplikats braucht — nie mehr. */
export type MeldungStand = { status: MeldungStatus; art: MeldungArt }

/**
 * Öffentlicher Statustext — ein unbekannter Wert fällt auf „Eingegangen" zurück.
 * Ein Duplikat bekommt den Stand seiner Hauptmeldung zu sehen, sobald sie
 * erledigt ist (Register N14, Ergänzung; Nr. 101): „Bereits bekannt · Behoben"
 * nach der Art der Hauptmeldung. Abgeleitet beim Lesen, nichts gespeichert.
 */
export function oeffentlicherStatus(status: string, art: string, hauptmeldung?: MeldungStand | null): string {
  if (status === 'DUPLIKAT' && hauptmeldung?.status === 'ERLEDIGT') {
    return `${STATUS_OEFFENTLICH.DUPLIKAT} · ${ERLEDIGT_OEFFENTLICH[hauptmeldung.art]}`
  }
  if (status === 'ERLEDIGT' && istMeldungArt(art)) return ERLEDIGT_OEFFENTLICH[art]
  if (status === 'KEIN_FEHLER' && istMeldungArt(art)) return KEIN_FEHLER_OEFFENTLICH[art]
  return (STATUS_OEFFENTLICH as Record<string, string>)[status] ?? STATUS_OEFFENTLICH.NEU
}

/**
 * Der Vorschlag der KI steht als eigene Zeile mit diesem Präfix in der
 * Triage-Notiz (Schreibroute, VERMUTLICH_WUNSCH). Daran erkennt ihn der
 * Knopf „Nein, ein Fehler" wieder.
 */
export const KI_NOTIZ_PRAEFIX = '[KI] '

/**
 * Die Triage-Notiz ohne die Zeile(n) der KI. Die Notizen des Menschen und die
 * Audit-Zeilen bleiben stehen. Leer → null, wie im Formular.
 */
export function ohneKiNotiz(notiz: string | null): string | null {
  if (notiz === null) return null
  const rest = notiz
    .split('\n')
    .filter((zeile) => !zeile.startsWith(KI_NOTIZ_PRAEFIX))
    .join('\n')
    .trim()
  return rest === '' ? null : rest
}

export function istMeldungArt(wert: unknown): wert is MeldungArt {
  return typeof wert === 'string' && (MELDUNG_ARTEN as readonly string[]).includes(wert)
}

export function istMeldungStatus(wert: unknown): wert is MeldungStatus {
  return typeof wert === 'string' && (MELDUNG_STATUS as readonly string[]).includes(wert)
}

/** Grenzen des Formulars — EINE Quelle für Zod, Oberfläche und Tests. */
export const MELDUNG_TEXT_MIN = 10
export const MELDUNG_TEXT_MAX = 2000
export const MELDUNG_KENNUNG_MAX = 20

/** Die Antwort einer Triage-Aktion, wenn die Meldung inzwischen eine andere ist (bedingter Schreibzugriff trifft keine Zeile). */
export const MELDUNG_GEAENDERT = 'Die Meldung hat sich inzwischen geändert — lade die Seite neu und entscheide noch einmal.'
/** Dasselbe, wenn die Hauptmeldung eines Duplikats die andere ist. */
export const MELDUNG_VERWEIS_GEAENDERT = 'Die Meldung oder ihre Hauptmeldung hat sich inzwischen geändert — lade die Seite neu und entscheide noch einmal.'
/** Die Triage-Notiz — das Admin-Formular und die Schreibroute halten dieselbe Grenze. */
export const TRIAGE_NOTIZ_MAX = 2000
/** Die Antwort an den Hof, der gemeldet hat – das einzige Triage-Feld, das der Hof sieht. Schema und Formular nehmen dieselbe Zahl. */
export const ANTWORT_AN_MELDER_MAX = 500
export const MELDUNGEN_PRO_STUNDE = 5

/** Die sichtbare Ablehnung des Stundenzählers — hier, weil actions/meldung.ts ("use server") keine Konstanten exportieren darf. */
export const ZU_VIELE_MELDUNGEN =
  'Zu viele Meldungen in kurzer Zeit — bitte versuche es in einer Stunde noch einmal.'

/** Wohin „PR #<nr>" in sprintName zeigt — das Repository ist öffentlich. */
export const PR_BASIS_URL = 'https://github.com/Uttoranger/FarmerZone/pull/'

/**
 * Der Link zu einem PR, wenn sprintName genau „PR #<nr>" ist (so schreibt ihn
 * die Schreibroute). Ein frei getippter Sprintname bleibt Text.
 */
export function prLink(sprintName: string | null): string | null {
  const treffer = sprintName ? /^PR #(\d{1,7})$/.exec(sprintName.trim()) : null
  return treffer ? `${PR_BASIS_URL}${treffer[1]}` : null
}

/** Die Begründung der KI aus der Triage-Notiz — ohne Präfix, eine je Zeile. */
export function kiBegruendung(notiz: string | null): string | null {
  const zeilen = (notiz ?? '')
    .split('\n')
    .filter((z) => z.startsWith(KI_NOTIZ_PRAEFIX))
    .map((z) => z.slice(KI_NOTIZ_PRAEFIX.length).trim())
    .filter((z) => z !== '')
  return zeilen.length > 0 ? zeilen.join(' ') : null
}

/** Die Kurznummer: die ersten acht Zeichen der ID — für Bestätigung, Listen und CLI. */
export function kurznummer(id: string): string {
  return id.slice(0, 8)
}

/** Die erste Textzeile, gekürzt — für Listen. */
export function ersteZeile(text: string, maxZeichen = 90): string {
  const zeile = text.split(/\r?\n/).map((z) => z.trim()).find((z) => z.length > 0) ?? ''
  return zeile.length > maxZeichen ? `${zeile.slice(0, maxZeichen - 1)}…` : zeile
}

// ─── Sichtbarkeitsregel ─────────────────────────────────────────────────────

/** Eine Meldung, wie sie aus der Datenbank kommt — alle Felder. */
export type MeldungVollstaendig = {
  id: string
  art: MeldungArt
  text: string
  createdAt: Date
  status: MeldungStatus
  antwortAnMelder: string | null
  // Triage — darf NIE zum Hof
  clusterKey?: string | null
  triageNotiz?: string | null
  duplikatVonId?: string | null
  sprintName?: string | null
  triagedAt?: Date | null
  // Kontext — der Hof hat ihn selbst geliefert, braucht ihn aber nicht wiederzusehen
  seiteUrl?: string
  userAgent?: string
  viewport?: string
  farmId?: string | null
  customerEmail?: string | null
  screenshotUrl?: string | null
  diagKennung?: string | null
}

/** Genau das, was ein Hof unter „Meine Meldungen" (/meldungen) sieht. */
export type MeldungFuerHof = {
  id: string
  kurznummer: string
  art: MeldungArt
  text: string
  createdAt: Date
  /** Der übersetzte Status — nie der interne Wert. */
  status: string
  /** Der Ton der Marke (STATUS_TON) — abgeleitet, verrät den internen Wert nicht. */
  statusTon: MeldungTon
  /** Noch nicht abgeschlossen (Zähler „Offen") — abgeleitet aus STATUS_ABGESCHLOSSEN. */
  offen: boolean
  antwortAnMelder: string | null
}

/**
 * DIE Sichtbarkeitsregel: aus einer vollständigen Meldung wird die Hof-Sicht.
 * Bewusst als Aufzählung der erlaubten Felder geschrieben (Allowlist), nicht
 * als Streichen der verbotenen — ein später ergänztes Triage-Feld fällt so von
 * selbst heraus, statt versehentlich durchzurutschen.
 */
export function fuerHof(m: MeldungVollstaendig, hauptmeldung: MeldungStand | null = null): MeldungFuerHof {
  // Ein Duplikat, dessen Hauptmeldung erledigt ist, trägt den grünen Ton wie sie.
  const ton = m.status === 'DUPLIKAT' && hauptmeldung?.status === 'ERLEDIGT' ? STATUS_TON.ERLEDIGT : STATUS_TON[m.status]
  return {
    id: m.id,
    kurznummer: kurznummer(m.id),
    art: m.art,
    text: m.text,
    createdAt: m.createdAt,
    status: oeffentlicherStatus(m.status, m.art, hauptmeldung),
    statusTon: ton ?? STATUS_TON.NEU,
    offen: !STATUS_ABGESCHLOSSEN.includes(m.status),
    antwortAnMelder: m.antwortAnMelder ?? null,
  }
}

// ─── Wochenlauf ─────────────────────────────────────────────────────────────

export const AUFBEWAHRUNG_TAGE = 90
export const LIEGEDAUER_TAGE = 14

const TAG_MS = 24 * 60 * 60 * 1000

/** Was die Aufbewahrung von einer Hauptmeldung braucht (zweite Abfrage der Route). */
export type HauptmeldungAbschluss = { status: MeldungStatus; triagedAt: Date | null; createdAt: Date }

/**
 * Welche Meldungen der Wochenlauf löscht: abgeschlossen (ERLEDIGT, KEIN_FEHLER,
 * DUPLIKAT) und der Abschluss liegt mindestens 90 Tage zurück. Maßgeblich ist
 * triagedAt (der Moment des Abschlusses); fehlt es — Altbestand, per Connector
 * gesetzt —, zählt createdAt. Reine Auswahl über eine Liste, damit die Regel
 * ohne Datenbank prüfbar ist; die Route wendet sie auf die Kandidaten an.
 *
 * Ein DUPLIKAT ist eine Stimme seiner Hauptmeldung (Register N14, Ergänzung;
 * Nr. 101): Es geht erst mit ihr — wenn sie abgeschlossen ist und ihr
 * Abschluss 90 Tage zurückliegt —, sonst ginge die Stimme verloren, während
 * die Sache noch offen ist. Dann zählt nur ihr Abschluss, nicht der des
 * Duplikats: „Gelöscht wird sie erst mit der Hauptmeldung" (Mockup
 * admin-postfach-zusammenfassen). Fehlt die Hauptmeldung (schon gelöscht oder
 * nie gefunden), gilt die Regel oben allein.
 */
export function waehleZuLoeschende<
  T extends { status: MeldungStatus; triagedAt: Date | null; createdAt: Date; duplikatVonId?: string | null },
>(meldungen: readonly T[], jetzt: Date, hauptmeldungen: ReadonlyMap<string, HauptmeldungAbschluss> = new Map()): T[] {
  const grenze = jetzt.getTime() - AUFBEWAHRUNG_TAGE * TAG_MS
  const abgeschlossenUndAlt = (m: { status: MeldungStatus; triagedAt: Date | null; createdAt: Date }): boolean =>
    STATUS_ABGESCHLOSSEN.includes(m.status) && (m.triagedAt ?? m.createdAt).getTime() <= grenze
  return meldungen.filter((m) => {
    const haupt = m.status === 'DUPLIKAT' && m.duplikatVonId ? hauptmeldungen.get(m.duplikatVonId) : undefined
    if (!haupt) return abgeschlossenUndAlt(m)
    // Eine Kette (Hauptmeldung selbst Duplikat) bleibt, bis das mittlere Glied weg ist — lieber eine Woche länger als eine Stimme zu früh.
    return haupt.status !== 'DUPLIKAT' && abgeschlossenUndAlt(haupt)
  })
}

/** Der Stichtag, ab dem eine offene Meldung als liegen geblieben gilt. */
export function liegedauerGrenze(jetzt: Date): Date {
  return new Date(jetzt.getTime() - LIEGEDAUER_TAGE * TAG_MS)
}

/** Screenshot-Adressen, die mit den Meldungen aus dem Blob-Speicher verschwinden. */
export function screenshotsVon(meldungen: readonly { screenshotUrl: string | null }[]): string[] {
  return meldungen.map((m) => m.screenshotUrl).filter((u): u is string => typeof u === 'string' && u.length > 0)
}

// ─── Reiter „Meldungen" im Admin-Postfach (Register N14, Ergänzung; Nr. 101) ─

/**
 * Die sechs Teile des Ablaufs (Mockup admin-postfach-meldungen-ablauf). Jede
 * Meldung steht in genau einem — EINE Regel (meldungTeil) für Stand-Band,
 * Spalten und die Chips am Handy, damit alle drei dasselbe zählen.
 */
export const MELDUNG_TEILE = ['neu', 'ki', 'geplant', 'erledigt', 'gesammelt', 'abgelegt'] as const
export type MeldungTeil = (typeof MELDUNG_TEILE)[number]

export type MeldungTeilErgebnis = {
  teil: MeldungTeil
  /** GEPRUEFT bei Fehler oder Frage: steht unter „Neu", mit Marke „angesehen". */
  angesehen: boolean
  /** false = ein Duplikat: keine eigene Karte, es zählt im Teil seiner Hauptmeldung. */
  eigeneKarte: boolean
}

function teilVon(m: MeldungStand): { teil: MeldungTeil; angesehen: boolean } {
  switch (m.status) {
    case 'NEU':
      return { teil: 'neu', angesehen: false }
    case 'VERMUTLICH_WUNSCH':
      return { teil: 'ki', angesehen: false }
    case 'GEPRUEFT':
      // Ein angesehener Wunsch sammelt Stimmen; ein angesehener Fehler wartet noch auf dich.
      return m.art === 'WUNSCH' ? { teil: 'gesammelt', angesehen: false } : { teil: 'neu', angesehen: true }
    case 'GEPLANT':
      return { teil: 'geplant', angesehen: false }
    case 'KEIN_FEHLER':
      return { teil: 'abgelegt', angesehen: false }
    case 'ERLEDIGT':
    case 'DUPLIKAT':
      return { teil: 'erledigt', angesehen: false }
  }
}

/**
 * Der Teil einer Meldung. Ein Duplikat bekommt keine eigene Karte und zählt im
 * Teil seiner Hauptmeldung. Fehlt sie (schon gelöscht) oder ist sie selbst ein
 * Duplikat, zählt es unter Erledigt: „Bereits bekannt" ist abgeschlossen.
 */
export function meldungTeil(m: MeldungStand, hauptmeldung: MeldungStand | null = null): MeldungTeilErgebnis {
  if (m.status !== 'DUPLIKAT') return { ...teilVon(m), eigeneKarte: true }
  return { ...(hauptmeldung ? teilVon(hauptmeldung) : { teil: 'erledigt', angesehen: false }), eigeneKarte: false }
}

/** Die fünf Teile des Stand-Bands (Register N14): „Braucht dich" fasst Neu und KI-Vorschlag zusammen. */
export const STAND_TEILE = ['brauchtDich', 'inArbeit', 'erledigt', 'gesammelt', 'abgelegt'] as const
export type StandTeil = (typeof STAND_TEILE)[number]

export const STAND_TEIL_VON: Record<MeldungTeil, StandTeil> = {
  neu: 'brauchtDich',
  ki: 'brauchtDich',
  geplant: 'inArbeit',
  erledigt: 'erledigt',
  gesammelt: 'gesammelt',
  abgelegt: 'abgelegt',
}

export const STAND_TEIL_TEXT: Record<StandTeil, { titel: string; satz: string; sr: (anzahl: number) => string }> = {
  brauchtDich: { titel: 'Braucht dich', satz: 'Neu und KI-Vorschläge', sr: (n) => `${n} ${n === 1 ? 'braucht' : 'brauchen'} dich` },
  inArbeit: { titel: 'In Arbeit', satz: 'geplant, mit Nummer', sr: (n) => `${n} in Arbeit` },
  erledigt: { titel: 'Erledigt', satz: 'letzte 90 Tage, dann gelöscht', sr: (n) => `${n} erledigt` },
  gesammelt: { titel: 'Gesammelt', satz: 'Wünsche, noch nicht geplant', sr: (n) => `${n} gesammelt` },
  abgelegt: { titel: 'Abgelegt', satz: 'kein Fehler · nicht geplant', sr: (n) => `${n} abgelegt` },
}

/** Das Stand-Band: Meldungen je Teil — gezählt werden Meldungen, nicht Karten. Die Summe ist die Zahl der Meldungen. */
export function zaehleStandBand(teile: readonly MeldungTeil[]): Record<StandTeil, number> {
  const zahlen: Record<StandTeil, number> = { brauchtDich: 0, inArbeit: 0, erledigt: 0, gesammelt: 0, abgelegt: 0 }
  for (const t of teile) zahlen[STAND_TEIL_VON[t]] += 1
  return zahlen
}

/** Das aria-label des Balkens („5 brauchen dich, 7 in Arbeit, …"). */
export function standBandBeschriftung(zahlen: Record<StandTeil, number>): string {
  return STAND_TEILE.map((t) => STAND_TEIL_TEXT[t].sr(zahlen[t])).join(', ')
}

/** Eine Meldung, wie der Ablauf sie braucht — der Kurztitel schon gekürzt, nie der volle Text. */
export type AblaufMeldung = {
  id: string
  art: MeldungArt
  status: MeldungStatus
  createdAt: Date
  triagedAt: Date | null
  ersteZeile: string
  /** Name des Hofs; null = eine Kundin. */
  hofName: string | null
  farmId: string | null
  /** Nur, um Kundinnen als Stimme zu unterscheiden — geht nie an eine Client-Komponente. */
  customerEmail: string | null
  clusterKey: string | null
  sprintName: string | null
  duplikatVonId: string | null
  screenshot: boolean
  diagKennung: string | null
  triageNotiz: string | null
  antwortAnMelder: string | null
}

/** Eine Karte: eine Meldung oder ein Bündel (gleiches Stichwort im gleichen Teil), Duplikate hängen an ihrer Hauptmeldung. */
export type AblaufKarte = {
  schluessel: string
  teil: MeldungTeil
  /** Für Öffnen, Zusammenfassen und Ablegen — bei einem Bündel die jüngste Meldung. */
  haupt: AblaufMeldung
  /** Das Stichwort, wenn mehr als eine Meldung (ohne Duplikate) dahintersteht. */
  buendel: string | null
  /** Meldungen samt Duplikaten. */
  meldungen: number
  duplikate: number
  hoefe: number
  angesehen: boolean
  /** Eingang bei Neu und KI-Vorschlag, sonst der Moment der Entscheidung. */
  zeit: Date
}

export const MELDUNGEN_VON = ['alle', 'hoefe', 'kundschaft'] as const
export type MeldungenVon = (typeof MELDUNGEN_VON)[number]
export type AblaufFilter = { art: MeldungArt | null; von: MeldungenVon }

function passtVon(m: AblaufMeldung, von: MeldungenVon): boolean {
  return von === 'alle' || (von === 'hoefe') === (m.farmId !== null)
}

function stichwort(clusterKey: string | null): string | null {
  const k = clusterKey?.trim() ?? ''
  return k === '' ? null : k
}

export type AblaufStand = {
  /** Über alle Meldungen, ohne Filter (Register N14: „ein Stand-Band über alle Meldungen"). */
  band: Record<StandTeil, number>
  gesamt: number
  /** Meldungen je Art (Chips „Alle · Fehler · Wunsch · Frage"), mit dem Filter „Von". */
  jeArt: Record<MeldungArt | 'alle', number>
  /** Die Karten je Teil mit beiden Filtern, neueste zuerst. */
  karten: Record<MeldungTeil, AblaufKarte[]>
  /** Meldungen ohne eigene Karte: in einem Bündel bzw. als Duplikat. */
  inBuendeln: number
  alsDuplikat: number
}

/**
 * Der ganze Ablauf aus einer Liste: Stand-Band, Zahlen je Art und die Karten
 * je Teil. Ein Bündel ist eine Karte für Meldungen mit gleichem Stichwort im
 * gleichen Teil — außer bei KI-Vorschlägen: Jeder hat seinen eigenen Grund
 * und seine eigenen Knöpfe. Ein Duplikat folgt seiner Hauptmeldung, auch in
 * den Filtern; eines ohne Hauptmeldung hat keine Karte, zählt aber im Band.
 */
export function ablaufStand(meldungen: readonly AblaufMeldung[], filter: AblaufFilter): AblaufStand {
  const nachId = new Map(meldungen.map((m) => [m.id, m]))
  const hauptVon = (m: AblaufMeldung): AblaufMeldung | null => (m.status === 'DUPLIKAT' && m.duplikatVonId ? (nachId.get(m.duplikatVonId) ?? null) : null)

  const band = zaehleStandBand(meldungen.map((m) => meldungTeil(m, hauptVon(m)).teil))
  const jeArt: Record<MeldungArt | 'alle', number> = { alle: 0, FEHLER: 0, WUNSCH: 0, FRAGE: 0 }
  for (const m of meldungen) {
    if (!passtVon(m, filter.von)) continue
    jeArt.alle += 1
    jeArt[m.art] += 1
  }

  const gruppen = new Map<string, { teil: MeldungTeil; eigene: AblaufMeldung[]; duplikate: AblaufMeldung[] }>()
  const gruppeVon = new Map<string, string>()
  for (const m of meldungen) {
    if (m.status === 'DUPLIKAT' || !passtVon(m, filter.von) || (filter.art !== null && m.art !== filter.art)) continue
    const { teil } = meldungTeil(m)
    const k = teil === 'ki' ? null : stichwort(m.clusterKey)
    const schluessel = k ? `buendel-${teil}-${k}` : `meldung-${m.id}`
    const gruppe = gruppen.get(schluessel) ?? { teil, eigene: [], duplikate: [] }
    gruppe.eigene.push(m)
    gruppen.set(schluessel, gruppe)
    gruppeVon.set(m.id, schluessel)
  }
  let alsDuplikat = 0
  for (const m of meldungen) {
    if (m.status !== 'DUPLIKAT') continue
    const schluessel = m.duplikatVonId ? gruppeVon.get(m.duplikatVonId) : undefined
    if (!schluessel) continue
    gruppen.get(schluessel)?.duplikate.push(m)
    alsDuplikat += 1
  }

  const karten: Record<MeldungTeil, AblaufKarte[]> = { neu: [], ki: [], geplant: [], erledigt: [], gesammelt: [], abgelegt: [] }
  let inBuendeln = 0
  for (const [schluessel, g] of gruppen) {
    const eigene = [...g.eigene].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const haupt = eigene[0]
    const alle = [...eigene, ...g.duplikate]
    const offen = g.teil === 'neu' || g.teil === 'ki'
    const zeit = new Date(Math.max(...eigene.map((m) => (offen ? m.createdAt : (m.triagedAt ?? m.createdAt)).getTime())))
    inBuendeln += eigene.length - 1
    karten[g.teil].push({
      schluessel,
      teil: g.teil,
      haupt,
      buendel: eigene.length > 1 ? stichwort(haupt.clusterKey) : null,
      meldungen: alle.length,
      duplikate: g.duplikate.length,
      hoefe: new Set(alle.map((m) => m.farmId).filter((f): f is string => f !== null)).size,
      angesehen: eigene.every((m) => meldungTeil(m).angesehen),
      zeit,
    })
  }
  for (const liste of Object.values(karten)) liste.sort((a, b) => b.zeit.getTime() - a.zeit.getTime() || a.schluessel.localeCompare(b.schluessel))
  return { band, gesamt: meldungen.length, jeArt, karten, inBuendeln, alsDuplikat }
}

/** Erledigtes zeigt der Ablauf 30 Tage; Älteres (bis zur Löschung nach 90 Tagen) steht hinter „+ n ältere". */
export const ERLEDIGT_SICHTBAR_TAGE = 30

export function teileErledigt(karten: readonly AblaufKarte[], jetzt: Date): { sichtbar: AblaufKarte[]; aeltere: AblaufKarte[] } {
  const grenze = jetzt.getTime() - ERLEDIGT_SICHTBAR_TAGE * TAG_MS
  return { sichtbar: karten.filter((k) => k.zeit.getTime() >= grenze), aeltere: karten.filter((k) => k.zeit.getTime() < grenze) }
}

/** Die Zahl der Meldungen auf den Karten eines Teils. */
export function meldungenAuf(karten: readonly AblaufKarte[]): number {
  return karten.reduce((summe, k) => summe + k.meldungen, 0)
}

// ─── Triage-Aufrufe aus dem Ablauf: KI-Vorschlag mit Rückgängig ─────────────

/** Der gespeicherte Stand einer Meldung — alles, was triageMeldungAction schreibt. Leer = null. */
export type TriageStand = {
  status: MeldungStatus
  art: MeldungArt
  clusterKey: string | null
  triageNotiz: string | null
  duplikatVonId: string | null
  sprintName: string | null
  antwortAnMelder: string | null
}

/** Die Eingabe für triageMeldungAction: alle Felder plus der Ausgangsstand (vorherStatus/vorherNotiz). */
export type TriageAufruf = Omit<TriageStand, 'art'> & { art: MeldungArt; vorherStatus: MeldungStatus; vorherNotiz: string | null }

/**
 * Ein Aufruf von triageMeldungAction auf einem gespeicherten Stand: Alle Felder
 * gehen mit (die Action schreibt jedes), der Ausgangsstand ebenso — hat
 * inzwischen jemand anderes Status oder Notiz geändert, lehnt sie ab, statt
 * es zurückzudrehen.
 */
export function triageAufruf(stand: TriageStand, aenderung: Partial<TriageStand> = {}): TriageAufruf {
  return { ...stand, ...aenderung, vorherStatus: stand.status, vorherNotiz: stand.triageNotiz }
}

/**
 * „Ja, ein Wunsch" / „Nein, ein Fehler" samt Rückgängig. Rückgängig ist ein
 * zweiter Aufruf auf dem Stand DANACH, der Status, Art und Notiz von vorher
 * wiederherstellt — er scheitert sauber, wenn inzwischen jemand anderes
 * geschrieben hat (dieselbe Bedingung wie jeder Aufruf).
 */
export function kiEntscheidung(stand: TriageStand, wunsch: boolean): { aufruf: TriageAufruf; nachher: TriageStand; rueckgaengig: TriageAufruf } {
  const nachher: TriageStand = wunsch
    ? { ...stand, status: 'GEPRUEFT', art: 'WUNSCH' }
    : { ...stand, status: 'GEPRUEFT', triageNotiz: ohneKiNotiz(stand.triageNotiz) }
  return {
    aufruf: triageAufruf(stand, nachher),
    nachher,
    rueckgaengig: triageAufruf(nachher, { status: stand.status, art: stand.art, triageNotiz: stand.triageNotiz }),
  }
}

// ─── Wünsche gebündelt: Stand für alle ──────────────────────────────────────

/** Die Wahl „Stand für alle" (Mockup admin-postfach-wuensche) und der Status, den sie schreibt. */
export const BUENDEL_STAND_WAHL = ['gesammelt', 'geplant', 'umgesetzt', 'nichtGeplant'] as const
export type BuendelStandWahl = (typeof BUENDEL_STAND_WAHL)[number]

export const BUENDEL_STAND_STATUS: Record<BuendelStandWahl, MeldungStatus> = {
  gesammelt: 'GEPRUEFT',
  geplant: 'GEPLANT',
  umgesetzt: 'ERLEDIGT',
  nichtGeplant: 'KEIN_FEHLER',
}

/** Der gemeinsame Stand eines Bündels — „neu", solange keiner entschieden ist, „gemischt", wenn die Meldungen verschieden stehen. */
export type BuendelStand = BuendelStandWahl | 'neu' | 'gemischt'

export const BUENDEL_STAND_LABEL: Record<BuendelStand, string> = {
  gesammelt: 'Gesammelt',
  geplant: 'Geplant',
  umgesetzt: 'Umgesetzt',
  nichtGeplant: 'Nicht geplant',
  neu: 'Neu',
  gemischt: 'gemischt',
}

function standVonStatus(status: MeldungStatus): BuendelStand {
  const wahl = BUENDEL_STAND_WAHL.find((w) => BUENDEL_STAND_STATUS[w] === status)
  return wahl ?? (status === 'NEU' || status === 'VERMUTLICH_WUNSCH' ? 'neu' : 'gemischt')
}

/** Der gemeinsame Stand der Meldungen eines Bündels (ohne Duplikate), sonst „gemischt". */
export function buendelStandVon(status: readonly MeldungStatus[]): BuendelStand {
  const staende = new Set(status.map(standVonStatus))
  const [einziger] = [...staende]
  return staende.size === 1 && einziger !== undefined ? einziger : 'gemischt'
}

/** Was der Hof eines Wunschs nach „Stand für alle" in „Meine Meldungen" liest. */
export function buendelVorschau(wahl: BuendelStandWahl): string {
  return oeffentlicherStatus(BUENDEL_STAND_STATUS[wahl], 'WUNSCH')
}

// ─── Texte des Reiters (EINE Quelle; Wörter aus der Wortliste N8/N12/N14) ───

export const MELDUNGEN_TEXT = {
  standBeschriftung: 'Stand aller Meldungen',
  summe: (anzahl: number) => `${anzahl} ${anzahl === 1 ? 'Meldung' : 'Meldungen'}`,
  summeSatz: 'gezählt werden Meldungen, nicht Karten – ein Bündel mit 4 Meldungen zählt 4',
  ansichtBeschriftung: 'Ansicht der Meldungen',
  ablauf: 'Ablauf',
  wuensche: 'Wünsche gebündelt',
  artBeschriftung: 'Nach Art filtern',
  alle: 'Alle',
  vonBeschriftung: 'Von wem',
  von: 'Von:',
  vonLabel: { alle: 'Alle', hoefe: 'Höfe', kundschaft: 'Kundschaft' } satisfies Record<MeldungenVon, string>,
  spalte: {
    neu: { titel: 'Neu', satz: 'Noch nicht entschieden.' },
    ki: { titel: 'KI-Vorschlag', satz: 'Vorschläge, kein Automatismus.' },
    geplant: { titel: 'Geplant', satz: 'Höfe sehen „In Arbeit“.' },
    erledigt: { titel: 'Erledigt', satz: 'Live, letzte 30 Tage.' },
    gesammelt: { titel: 'Gesammelt', satz: 'Wünsche, noch nicht geplant.' },
    abgelegt: { titel: 'Abgelegt', satz: 'kein Fehler · nicht geplant' },
  } satisfies Record<MeldungTeil, { titel: string; satz: string }>,
  spaltenZahl: (karten: number, meldungen: number) => (karten === meldungen ? String(karten) : `${karten} · ${meldungen} Meldungen`),
  gesammeltZu: (buendel: number) => `Wünsche · ${buendel} Bündel`,
  aeltere: (anzahl: number) => `+ ${anzahl} ältere (bis 90 Tage)`,
  aeltereZu: 'Ältere wieder ausblenden',
  leer: 'Nichts hier.',
  kundin: 'Kundin',
  buendelWer: (hoefe: number) => `Bündel · ${hoefe} ${hoefe === 1 ? 'Hof' : 'Höfe'}`,
  seit: (datum: string) => `seit ${datum}`,
  live: (datum: string) => `live ${datum}`,
  kennung: (k: string) => `Kennung ${k}`,
  screenshot: 'Screenshot',
  angesehen: 'angesehen',
  meldungenChip: (meldungen: number, duplikate: number) =>
    `${meldungen} ${meldungen === 1 ? 'Meldung' : 'Meldungen'}${duplikate > 0 ? ` · ${duplikate} ${duplikate === 1 ? 'Duplikat' : 'Duplikate'}` : ''}`,
  hofSieht: (status: string, mitAntwort: boolean) => `Hof sieht „${status}“${mitAntwort ? ' und deine Antwort' : ''}`,
  ansehen: 'Ansehen',
  mehr: (titel: string) => `Mehr zu „${titel}“`,
  oeffnen: 'Öffnen',
  zusammenfassenMenu: 'Zusammenfassen …',
  ablegenMenu: 'Ablegen …',
  buendelAnsehen: 'Bündel ansehen',
  kiGrund: (grund: string) => `KI: ${grund}`,
  kiOhneGrund: 'KI: eher ein Wunsch.',
  zusammengefasst: (gesamt: number, buendel: number, duplikate: number) =>
    `${gesamt} ${gesamt === 1 ? 'Meldung steckt' : 'Meldungen stecken'} in anderen Karten: ${buendel} in Bündeln, ${duplikate} als Duplikat. Sie haben keine eigene Karte, zählen aber als Stimme.`,
  zusammengefasstKopf: 'Zusammengefasst:',
  regel:
    'Wohin eine Meldung geht: Neu → (KI-Vorschlag) → Geplant → Erledigt. Ein Wunsch, den du noch nicht planst, liegt unter Gesammelt und sammelt Stimmen. Abgelegt heißt: kein Fehler oder nicht geplant – mit Antwort an den Hof. Erledigt setzt das Deployment, nie die KI.',
  kiKopf: 'Was die KI hier tut',
  kiSatz: 'Sie sortiert vor. Entscheiden, antworten, Status setzen und bauen tust du – Meldungen sind Fremdtext.',
  kiZeilen: [
    { was: 'Wunsch statt Fehler erkennen', wann: 'heute', wie: 'Vorschlag mit Grund' },
    { was: 'Etwas selbst übernehmen', wann: 'nie', wie: 'auch nicht „automatisch“' },
  ],
  chipsBeschriftung: 'Teil wählen',
  handyKiKopf: 'KI-Vorschlag',
  handyNeuKopf: 'Neu',
} as const

/** Knöpfe und Sätze für die Klicks im Ablauf — Toast, Rückgängig, Dialoge. */
export const MELDUNG_KLICK_TEXT = {
  jaWunsch: 'Ja, ein Wunsch',
  neinFehler: 'Nein, ein Fehler',
  alsWunsch: 'Als Wunsch eingeordnet.',
  bleibtFehler: 'Bleibt ein Fehler.',
  rueckgaengig: 'Rückgängig',
  rueckgaengigGemacht: 'Rückgängig gemacht.',
  insBuendel: 'Ins Bündel …',
  /** Wie lange Rückgängig im Toast steht (Mockup: „Nach jedem Klick, 8 Sekunden lang"). */
  toastMs: 8000,
  buendelTitel: 'Ins Bündel',
  buendelSatz: 'Wähl ein vorhandenes Stichwort oder gib ein neues ein.',
  buendelFeld: 'Bündel-Stichwort',
  buendelVorhanden: 'Vorhandene Stichwörter',
  buendelKnopf: 'Ins Bündel legen',
  buendelLeer: 'Gib ein Stichwort ein.',
  buendelGespeichert: 'Ins Bündel gelegt.',
  ablegenTitel: 'Ablegen',
  ablegenSatz: 'Kein Fehler oder nicht geplant – mit Antwort an den Hof.',
  ablegenFeld: 'Antwort an den Hof',
  ablegenHinweis: 'sieht der Hof unter „Meine Meldungen“',
  ablegenPflicht: 'Schreib kurz, warum – die Antwort ist Pflicht.',
  ablegenKnopf: 'Ablegen',
  abgelegt: 'Abgelegt.',
  zusammenTitel: 'Zusammenfassen',
  zusammenSatz: 'Zwei Meldungen, eine Sache. Die Hauptmeldung bleibt, die andere hängt sich an.',
  bleibt: 'Bleibt · Hauptmeldung',
  haengtSichAn: 'hängt sich an',
  tauschen: 'Tauschen',
  wirdDuplikat: 'Wird Duplikat',
  hauptmeldungFehlt: 'Wähl unten die Hauptmeldung – Nummer oder Wort.',
  suche: 'Andere Hauptmeldung suchen – Nummer oder Wort',
  sucheKeinTreffer: 'Keine offene oder erledigte Meldung passt.',
  wasPassiert: 'Was passiert',
  passiert: (d: { duplikat: string; haupt: string; teil: string; wer: string; behoben: string }) => [
    `${d.duplikat} bekommt den Stand „Duplikat“ und verschwindet aus „${d.teil}“.`,
    `${d.wer} sieht „Bereits bekannt“ – und sobald ${d.haupt} live ist, „${d.behoben}“.`,
    `Sie zählt als Stimme bei ${d.haupt}; ihr Wortlaut bleibt dort unter „Woraus“.`,
    'Gelöscht wird sie erst mit der Hauptmeldung, 90 Tage nach deren Abschluss.',
    `Rückgängig jederzeit: in ${d.haupt} bei „Woraus“ auf „Trennen“.`,
  ],
  zusammenKnopf: 'Zusammenfassen',
  keinMail: 'Kein Mail an den Hof.',
  zusammengefasst: 'Zusammengefasst.',
  getrennt: 'Getrennt.',
  stimme: (n: number) => `${n} ${n === 1 ? 'Stimme' : 'Stimmen'}`,
} as const

/** Leerzustände der Ansicht „Wünsche gebündelt" (Register N9) — der Ausweg steht im Aufruf. */
export const WUENSCHE_LEER = {
  titel: 'Noch kein Bündel',
  satz: 'Gibst du einem Wunsch beim Entscheiden ein Stichwort, steht das Bündel hier – mit seinen Stimmen.',
} as const
export const WUENSCHE_LEER_FILTER = { titel: 'Kein Bündel mit diesem Stand' } as const

/** Sätze der Ansicht „Wünsche gebündelt" (Mockup admin-postfach-wuensche). */
export const WUENSCHE_TEXT = {
  chipsBeschriftung: 'Bündel nach Stand filtern',
  chip: { alle: 'Alle', gesammelt: 'Gesammelt', geplant: 'Geplant', umgesetzt: 'Umgesetzt', nichtGeplant: 'Nicht geplant' } satisfies Record<'alle' | BuendelStandWahl, string>,
  listeBeschriftung: 'Bündel',
  stimmen: 'Stimmen',
  erklaerung:
    'Stimmen = verschiedene Höfe und Kundinnen; ein Duplikat zählt mit, derselbe Hof zweimal zählt einmal. Bündel = Wünsche mit demselben Stichwort – du vergibst es beim Entscheiden. Offene (gesammelt, geplant) zuerst, dann nach Stimmen.',
  ohneStichwort: (n: number) => `${n} ${n === 1 ? 'Wunsch' : 'Wünsche'} ohne Stichwort – im Ablauf unter Neu bzw. Gesammelt.`,
  waehlen: 'Wähl links ein Bündel.',
  wer: (hoefe: number, kundinnen: number) =>
    [hoefe > 0 ? `${hoefe} ${hoefe === 1 ? 'Hof' : 'Höfe'}` : null, kundinnen > 0 ? `${kundinnen} ${kundinnen === 1 ? 'Kundin' : 'Kundinnen'}` : null].filter((t) => t !== null).join(', ') || 'Team',
  zuletzt: (datum: string) => `zuletzt ${datum}`,
  kopf: (d: { stimmen: number; hoefe: number; kundinnen: number; duplikate: number; erste: string; letzte: string }) =>
    `${d.stimmen} ${d.stimmen === 1 ? 'Stimme' : 'Stimmen'} · ${d.hoefe} ${d.hoefe === 1 ? 'Hof' : 'Höfe'} · ${d.kundinnen} ${d.kundinnen === 1 ? 'Kundin' : 'Kundinnen'}${d.duplikate > 0 ? ` · ${d.duplikate} ${d.duplikate === 1 ? 'Duplikat zählt' : 'Duplikate zählen'} mit` : ''} · erste ${d.erste}, letzte ${d.letzte}`,
  woraus: 'Woraus',
  duplikat: 'Duplikat',
  trennen: 'Trennen',
  dazunehmen: '+ Andere Meldung dazunehmen …',
  dazunehmenTitel: 'Meldung dazunehmen',
  dazunehmenSatz: 'Such einen Wunsch – er bekommt das Stichwort dieses Bündels.',
  dazunehmenSuche: 'Nummer oder Wort',
  dazunehmenKnopf: 'Dazunehmen',
  dazugenommen: 'Ins Bündel genommen.',
  standFuerAlle: (n: number) => `Stand für alle ${n}`,
  geplantIn: 'Geplant in',
  geplantInBeispiel: 'z. B. Nr. 97',
  umgesetztHinweis: '„Umgesetzt“ setzt normal das Deployment.',
  antwort: 'Antwort an die Höfe',
  antwortPflicht: 'Bei „Nicht geplant“ braucht es eine Antwort.',
  soSiehtEsDerHof: 'So sieht es der Hof in „Meine Meldungen“',
  bescheid: 'Beim Speichern Bescheid geben an',
  bescheidHoefe: (hoefe: number, kundinnen: number) =>
    `Die ${hoefe} ${hoefe === 1 ? 'Hof' : 'Höfe'}${kundinnen > 0 ? ` und ${kundinnen} ${kundinnen === 1 ? 'Kundin' : 'Kundinnen'}` : ''} aus diesem Bündel`,
  bescheidHoefeSatz: (kundinnen: number) =>
    `Eine Nachricht je Hof im Postfach, kein Massenmail. Die Antwort steht auch bei ihrer Meldung.${kundinnen > 0 ? ' Kundinnen mit Adresse für Rückfragen bekommen sie als E-Mail (Betriebsmitteilung).' : ''}`,
  bescheidNiemand: 'Niemanden',
  bescheidNiemandSatz: 'Sie sehen den neuen Stand still in „Meine Meldungen“.',
  bescheidBrauchtAntwort: 'Schreib den Höfen eine Antwort – oder wähl „Niemanden“.',
  speichern: (hoefe: number) => (hoefe > 0 ? `Speichern und ${hoefe} ${hoefe === 1 ? 'Hof' : 'Höfen'} schreiben` : 'Speichern'),
  abbrechen: 'Abbrechen',
  speichert: 'Speichert …',
  gespeichert: (n: number) => `Stand für ${n} ${n === 1 ? 'Meldung' : 'Meldungen'} gespeichert.`,
  /** Titel der Nachricht im Postfach der Höfe und Betreff der Mail an Kundinnen. */
  bescheidTitel: 'Neuer Stand zu deinem Wunsch',
  bescheidNichtGesendet: 'Der Stand ist gespeichert, die Nachricht an die Höfe aber nicht – schick sie über „Rundschreiben schreiben“.',
} as const

const HTML_ZEICHEN: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/**
 * Der Körper der Betriebsmail an Kundinnen eines Bündels (über sendRaw, Post-Sperre Z3):
 * die Antwort des Teams als maskierter Text — nie als Markup —, Zeilen bleiben Zeilen.
 */
export function bescheidMailHtml(antwort: string, team: string): string {
  const text = (s: string): string => s.replace(/[&<>"']/g, (z) => HTML_ZEICHEN[z] ?? z)
  return `<p>${text(antwort).replace(/\r?\n/g, '<br>')}</p><p>${text(team)}</p>`
}

// ─── Suche in Zusammenfassen und Dazunehmen ─────────────────────────────────

/** Eine Meldung, wie die Dialoge sie kennen: Kurztitel, Wer, Teil und der gespeicherte Stand für den Triage-Aufruf. */
export type SuchMeldung = {
  id: string
  kurznummer: string
  art: MeldungArt
  status: MeldungStatus
  ersteZeile: string
  wer: string
  teil: MeldungTeil
  clusterKey: string | null
  stand: TriageStand
}

export function suchMeldungVon(m: AblaufMeldung, kundin: string): SuchMeldung {
  return {
    id: m.id,
    kurznummer: kurznummer(m.id),
    art: m.art,
    status: m.status,
    ersteZeile: m.ersteZeile,
    wer: m.hofName ?? kundin,
    teil: meldungTeil(m).teil,
    clusterKey: stichwort(m.clusterKey),
    stand: {
      status: m.status,
      art: m.art,
      clusterKey: m.clusterKey,
      triageNotiz: m.triageNotiz,
      duplikatVonId: m.duplikatVonId,
      sprintName: m.sprintName,
      antwortAnMelder: m.antwortAnMelder,
    },
  }
}

/** Hauptmeldung kann nur eine offene oder erledigte Meldung sein — kein Duplikat (keine Kette), nichts Abgelegtes. */
export function kannHauptmeldungSein(status: MeldungStatus): boolean {
  return status !== 'DUPLIKAT' && status !== 'KEIN_FEHLER'
}

/** Treffer nach Kurznummer (Anfang) oder Wort im Kurztitel — höchstens `max`, ohne die ausgeschlossenen. */
export function sucheMeldungen(liste: readonly SuchMeldung[], wort: string, erlaubt: (m: SuchMeldung) => boolean, max = 8): SuchMeldung[] {
  const w = wort.trim().toLowerCase()
  if (w === '') return []
  return liste.filter((m) => erlaubt(m) && (m.id.startsWith(w) || m.ersteZeile.toLowerCase().includes(w))).slice(0, max)
}
