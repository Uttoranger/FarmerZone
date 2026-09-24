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
 * Wochenlauf und die Frage, ob der Betreiber eine Zusammenfassung braucht.
 */

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

/** Farbwelt wie die übrigen Marken (Referenz 19): Orange = wartet, Grün = läuft, Grau = fertig. */
export const STATUS_MARKE_FARBE: Record<MeldungStatus, string> = {
  NEU: 'bg-[#FBEEE3] text-[#E8854A]',
  GEPRUEFT: 'bg-[#E8F0E2] text-[#2D5F3F]',
  // Wartet auf die Entscheidung des Menschen — deshalb Orange wie NEU.
  VERMUTLICH_WUNSCH: 'bg-[#FBEEE3] text-[#E8854A]',
  GEPLANT: 'bg-[#E8F0E2] text-[#2D5F3F]',
  ERLEDIGT: 'bg-[#F0EDE5] text-[#9AA08F]',
  KEIN_FEHLER: 'bg-[#F0EDE5] text-[#9AA08F]',
  DUPLIKAT: 'bg-[#F0EDE5] text-[#9AA08F]',
}

/** Öffentlicher Statustext — ein unbekannter Wert fällt auf „Eingegangen" zurück. */
export function oeffentlicherStatus(status: string, art: string): string {
  if (status === 'ERLEDIGT' && istMeldungArt(art)) return ERLEDIGT_OEFFENTLICH[art]
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
/** Die Triage-Notiz — das Admin-Formular und die Schreibroute halten dieselbe Grenze. */
export const TRIAGE_NOTIZ_MAX = 2000
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

/** Genau das, was ein Hof unter „Meine Meldungen" sieht. */
export type MeldungFuerHof = {
  id: string
  kurznummer: string
  art: MeldungArt
  text: string
  createdAt: Date
  /** Der übersetzte Status — nie der interne Wert. */
  status: string
  /** Farbklassen für die Marke. */
  statusFarbe: string
  antwortAnMelder: string | null
}

/**
 * DIE Sichtbarkeitsregel: aus einer vollständigen Meldung wird die Hof-Sicht.
 * Bewusst als Aufzählung der erlaubten Felder geschrieben (Allowlist), nicht
 * als Streichen der verbotenen — ein später ergänztes Triage-Feld fällt so von
 * selbst heraus, statt versehentlich durchzurutschen.
 */
export function fuerHof(m: MeldungVollstaendig): MeldungFuerHof {
  return {
    id: m.id,
    kurznummer: kurznummer(m.id),
    art: m.art,
    text: m.text,
    createdAt: m.createdAt,
    status: oeffentlicherStatus(m.status, m.art),
    statusFarbe: STATUS_MARKE_FARBE[m.status] ?? STATUS_MARKE_FARBE.NEU,
    antwortAnMelder: m.antwortAnMelder ?? null,
  }
}

// ─── Wochenlauf ─────────────────────────────────────────────────────────────

export const AUFBEWAHRUNG_TAGE = 90
export const LIEGEDAUER_TAGE = 14

const TAG_MS = 24 * 60 * 60 * 1000

/**
 * Welche Meldungen der Wochenlauf löscht: abgeschlossen (ERLEDIGT, KEIN_FEHLER,
 * DUPLIKAT) und der Abschluss liegt mindestens 90 Tage zurück. Maßgeblich ist
 * triagedAt (der Moment des Abschlusses); fehlt es — Altbestand, per Connector
 * gesetzt —, zählt createdAt. Reine Auswahl über eine Liste, damit die Regel
 * ohne Datenbank prüfbar ist; die Route wendet sie auf die Kandidaten an.
 */
export function waehleZuLoeschende<
  T extends { status: MeldungStatus; triagedAt: Date | null; createdAt: Date },
>(meldungen: readonly T[], jetzt: Date): T[] {
  const grenze = jetzt.getTime() - AUFBEWAHRUNG_TAGE * TAG_MS
  return meldungen.filter((m) => {
    if (!STATUS_ABGESCHLOSSEN.includes(m.status)) return false
    const abschluss = m.triagedAt ?? m.createdAt
    return abschluss.getTime() <= grenze
  })
}

/**
 * Braucht der Betreiber diese Woche eine Zusammenfassung? Nur wenn es NEUE
 * Meldungen gibt oder Meldungen länger als 14 Tage in NEU/GEPRUEFT stehen —
 * sonst keine Mail. Eine leere Wochenmail wäre die erste, die keiner mehr liest.
 */
export function brauchtZusammenfassung(
  zaehler: { neu: number; liegenGeblieben: number }
): boolean {
  return zaehler.neu > 0 || zaehler.liegenGeblieben > 0
}

/** Der Stichtag, ab dem eine offene Meldung als liegen geblieben gilt. */
export function liegedauerGrenze(jetzt: Date): Date {
  return new Date(jetzt.getTime() - LIEGEDAUER_TAGE * TAG_MS)
}

/** Screenshot-Adressen, die mit den Meldungen aus dem Blob-Speicher verschwinden. */
export function screenshotsVon(meldungen: readonly { screenshotUrl: string | null }[]): string[] {
  return meldungen.map((m) => m.screenshotUrl).filter((u): u is string => typeof u === 'string' && u.length > 0)
}
