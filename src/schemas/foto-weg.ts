/**
 * Der gemerkte Foto-Weg im localStorage (src/lib/foto-weg-speicher.ts). Er ist
 * Fremddaten (CODING_STANDARDS §3): Jeder kann ihn im Browser ändern, und ein
 * alter oder kaputter Stand darf die Fotoauswahl nie blockieren. Gemerkt
 * werden nur die zwei Auswahlwege — die Kamera ist keine Wahl zwischen Wegen.
 *
 * Ohne Zod (Nr. 196): Die Fotoauswahl hängt an der Hofseite, die im Browser
 * läuft (tests/leistung-196.test.ts).
 */
export const AUSWAHL_WEGE = ['galerie', 'dateien'] as const

/** Der gemerkte Weg, oder null bei allem, was nicht genau ein Auswahlweg ist. */
export function leseAuswahlWeg(roh: unknown): (typeof AUSWAHL_WEGE)[number] | null {
  return AUSWAHL_WEGE.find((weg) => weg === roh) ?? null
}
