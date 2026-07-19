// Duplikatsperre für Abholzeiten (Mini-Fix nachlese-3): Nur EXAKTE Dubletten
// (gleicher Wochentag + Von + Bis) sind gesperrt — zwei verschiedene Fenster
// am selben Tag (z. B. Sa 9–12 und Sa 15–17) bleiben ausdrücklich erlaubt.

export type SlotKey = { dayOfWeek: number; startTime: string; endTime: string }

export const DUPLICATE_SLOT_MESSAGE = 'Diese Abholzeit existiert bereits.'

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
