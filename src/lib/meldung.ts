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
  'GEPLANT',
  'ERLEDIGT',
  'KEIN_FEHLER',
  'DUPLIKAT',
] as const
export type MeldungStatus = (typeof MELDUNG_STATUS)[number]

/** Voreinstellung der Admin-Liste: was noch Arbeit ist. */
export const STATUS_OFFEN: readonly MeldungStatus[] = ['NEU', 'GEPRUEFT']

/** Abgeschlossen im Sinn der Aufbewahrung — 90 Tage danach löscht der Wochenlauf. */
export const STATUS_ABGESCHLOSSEN: readonly MeldungStatus[] = ['ERLEDIGT', 'KEIN_FEHLER', 'DUPLIKAT']

export const MELDUNG_ART_LABEL: Record<MeldungArt, string> = {
  FEHLER: 'Fehler',
  WUNSCH: 'Wunsch',
  FRAGE: 'Frage',
}

/**
 * Die Übersetzung interner Status in das, was der Hof liest. Ruhig und ohne
 * Versprechen — „Geplant" heißt geplant, nicht „kommt nächste Woche".
 */
export const STATUS_OEFFENTLICH: Record<MeldungStatus, string> = {
  NEU: 'Eingegangen',
  GEPRUEFT: 'In Prüfung',
  GEPLANT: 'Geplant',
  ERLEDIGT: 'Erledigt',
  KEIN_FEHLER: 'Geprüft — funktioniert wie vorgesehen',
  DUPLIKAT: 'Bereits bekannt',
}

/** Interne Beschriftung für den Admin-Bereich und das CLI. */
export const STATUS_INTERN: Record<MeldungStatus, string> = {
  NEU: 'Neu',
  GEPRUEFT: 'Geprüft',
  GEPLANT: 'Geplant',
  ERLEDIGT: 'Erledigt',
  KEIN_FEHLER: 'Kein Fehler',
  DUPLIKAT: 'Duplikat',
}

/** Farbwelt wie die übrigen Marken (Referenz 19): Orange = wartet, Grün = läuft, Grau = fertig. */
export const STATUS_MARKE_FARBE: Record<MeldungStatus, string> = {
  NEU: 'bg-[#FBEEE3] text-[#E8854A]',
  GEPRUEFT: 'bg-[#E8F0E2] text-[#2D5F3F]',
  GEPLANT: 'bg-[#E8F0E2] text-[#2D5F3F]',
  ERLEDIGT: 'bg-[#F0EDE5] text-[#9AA08F]',
  KEIN_FEHLER: 'bg-[#F0EDE5] text-[#9AA08F]',
  DUPLIKAT: 'bg-[#F0EDE5] text-[#9AA08F]',
}

/** Öffentlicher Statustext — ein unbekannter Wert fällt auf „Eingegangen" zurück. */
export function oeffentlicherStatus(status: string): string {
  return (STATUS_OEFFENTLICH as Record<string, string>)[status] ?? STATUS_OEFFENTLICH.NEU
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
export const MELDUNGEN_PRO_STUNDE = 5

/** Die sichtbare Ablehnung des Stundenzählers — hier, weil actions/meldung.ts ("use server") keine Konstanten exportieren darf. */
export const ZU_VIELE_MELDUNGEN =
  'Zu viele Meldungen in kurzer Zeit — bitte versuche es in einer Stunde noch einmal.'

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
    status: oeffentlicherStatus(m.status),
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
