// Regeln für Abholzeiten (nachlese-3 + nachlese-4), client- UND serverseitig
// identisch genutzt:
// 1. Exakte Dubletten (gleicher Wochentag + Von + Bis) sind gesperrt — eigener
//    Wortlaut, obwohl fachlich ein Spezialfall der Überschneidung.
// 2. Bis muss nach Von liegen (String-Vergleich reicht bei HH:MM im 24h-Format).
// 3. Ein neues Fenster [von, bis) darf kein bestehendes AKTIVES Fenster
//    desselben Wochentags schneiden. Angrenzen (bis == von des nächsten) ist
//    ausdrücklich erlaubt — daher halboffenes Intervall.

export type SlotKey = { dayOfWeek: number; startTime: string; endTime: string }

export const DAY_NAMES = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
]

export const DUPLICATE_SLOT_MESSAGE = 'Diese Abholzeit existiert bereits.'
export const INVERTED_SLOT_MESSAGE = 'Das Ende muss nach dem Beginn liegen.'

function keyOf(s: SlotKey): string {
  return `${s.dayOfWeek}|${s.startTime}|${s.endTime}`
}

export function isDuplicateSlot(existing: SlotKey[], candidate: SlotKey): boolean {
  const key = keyOf(candidate)
  return existing.some((s) => keyOf(s) === key)
}

// Für Batch-Anlage (Onboarding): prüft Kandidaten gegen den Bestand UND
// untereinander (zweimal dieselbe Zeit im selben Aufruf zählt auch als Dublette)
export function hasDuplicateSlots(existing: SlotKey[], candidates: SlotKey[]): boolean {
  const seen = new Set(existing.map(keyOf))
  for (const c of candidates) {
    const key = keyOf(c)
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

// Bis <= Von: bei 24h-HH:MM-Werten genügt der lexikografische Vergleich
export function isInvertedSlot(slot: Pick<SlotKey, 'startTime' | 'endTime'>): boolean {
  return slot.endTime <= slot.startTime
}

// Halboffenes Intervall [von, bis): schneidet, wenn beide Fenster am selben Tag
// liegen und sich die Zeiträume echt überlappen. Angrenzen ist erlaubt, weil
// bei candidate.start == existing.end (bzw. umgekehrt) keine Bedingung greift.
export function findOverlappingSlot(activeExisting: SlotKey[], candidate: SlotKey): SlotKey | null {
  return (
    activeExisting.find(
      (e) =>
        e.dayOfWeek === candidate.dayOfWeek &&
        candidate.startTime < e.endTime &&
        e.startTime < candidate.endTime
    ) ?? null
  )
}

// Benennt das betroffene Fenster, damit Franz weiß, WO es klemmt
export function overlapMessage(conflicting: SlotKey): string {
  return `Überschneidet sich mit ${DAY_NAMES[conflicting.dayOfWeek]} ${conflicting.startTime}–${conflicting.endTime}.`
}

export type SlotContext = {
  // ALLE bestehenden Fenster (auch inaktive) — Basis der Dublettensperre
  all: SlotKey[]
  // Nur AKTIVE Fenster — Basis des Überschneidungs-Checks
  active: SlotKey[]
}

// Einzel-Anlage (Einstellungen). Reihenfolge: erst Zeitlogik, dann Dublette
// (behält ihren eigenen Wortlaut), dann Überschneidung.
export function findSlotError(candidate: SlotKey, ctx: SlotContext): string | null {
  if (isInvertedSlot(candidate)) return INVERTED_SLOT_MESSAGE
  if (isDuplicateSlot(ctx.all, candidate)) return DUPLICATE_SLOT_MESSAGE
  const conflicting = findOverlappingSlot(ctx.active, candidate)
  if (conflicting) return overlapMessage(conflicting)
  return null
}

// Batch-Anlage (Onboarding): jeder Kandidat wird gegen Bestand UND die vorher
// im selben Aufruf angelegten Kandidaten geprüft (die entstehen alle aktiv).
export function findBatchSlotError(candidates: SlotKey[], ctx: SlotContext): string | null {
  const all = [...ctx.all]
  const active = [...ctx.active]
  for (const candidate of candidates) {
    const error = findSlotError(candidate, { all, active })
    if (error) return error
    all.push(candidate)
    active.push(candidate)
  }
  return null
}

/**
 * Es ist keine Abholzeit eingetragen (Register N9: ein Zustand, eine Fassung); ohne Abholzeit
 * kann niemand bestellen. Die Einstellungen zeigen Titel, Satz und Knopf; die Packliste auf Heute
 * Satz und Knopf (ihr Titel bleibt „Heute holt niemand etwas ab.“, mit Bestellungen für heute
 * stehen Satz und Knopf unter der Liste); die Karte „Nächste Abholung“ nur den Titel als Zeile;
 * „Zu tun“ den Satz am Schritt „Abholzeiten festlegen“. `aktion.href` ist der Weg dorthin, wo man
 * sie einträgt.
 */
export const ABHOLZEITEN_FEHLEN = {
  titel: 'Noch keine Abholzeiten',
  satz: 'Trag deine Abholzeiten ein, damit deine Kundinnen bei dir bestellen können.',
  aktion: { text: 'Abholzeiten eintragen', href: '/settings/pickup-slots' },
} as const

/** Die Kurzform für eine Zeile in einer Liste (Mein Hof, Einstellungen) — beide zeigen denselben Wortlaut. */
export const ABHOLZEITEN_FEHLEN_ZEILE = 'Noch keine — erst dann können Kundinnen bestellen'

/** Die Kennung des ersten Felds im Formular „Neue Abholzeit“ (Wochentag): Der Knopf des Leerzustands springt dorthin, das Feld trägt sie. */
export const ABHOLZEITEN_FORMULAR_ID = 'dayOfWeek'
