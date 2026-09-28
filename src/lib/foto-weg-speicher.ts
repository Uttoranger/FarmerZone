/**
 * Der gemerkte Foto-Weg — EINE Stelle für Schlüssel, Lesen, Schreiben und
 * Löschen.
 *
 * Gemerkt wird nur der umgekehrte Fall: Ein Gerät, auf dem der erste Weg
 * (foto-wege.ts, ersterWeg) scheiterte und der Ausweg klappte, öffnet künftig
 * direkt den Ausweg. Scheitert der gemerkte Weg, wird er gelöscht. Wann was
 * geschieht, entscheidet merkerNachErgebnis; hier wird nur gespeichert.
 *
 * Gelesen wird mit Zod, und nichts hier wirft: Ein privates Fenster, ein
 * voller Speicher oder ein Browser, der schon beim Zugriff eine SecurityError
 * wirft, darf die Fotoauswahl nie aufhalten — dann gilt eben der Standard.
 * Den Speicher bekommen die Funktionen hereingereicht (tests/foto-android.test.ts).
 */
import { fotoWegSchema } from '@/schemas/foto-weg'
import type { AuswahlWeg } from '@/lib/foto-wege'

export const FOTO_WEG_SCHLUESSEL = 'farmerzone_foto_weg'

type Speicher = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Der localStorage des Browsers — oder null, wo es keinen gibt oder schon der Zugriff wirft. */
export function browserSpeicher(): Speicher | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    // Gesperrte Website-Daten: Zugriff auf localStorage wirft. Dann ohne Merker.
    return null
  }
}

/** Der gemerkte Weg, oder null — auch bei allem, was nicht genau ein Auswahlweg ist. */
export function leseFotoWeg(speicher: Speicher | null): AuswahlWeg | null {
  if (!speicher) return null
  try {
    const gelesen = fotoWegSchema.safeParse(speicher.getItem(FOTO_WEG_SCHLUESSEL))
    return gelesen.success ? gelesen.data : null
  } catch {
    // Kein Lesezugriff: Dann ist nichts gemerkt, und der Standard gilt.
    return null
  }
}

export function schreibeFotoWeg(speicher: Speicher | null, weg: AuswahlWeg): void {
  try {
    speicher?.setItem(FOTO_WEG_SCHLUESSEL, weg)
  } catch {
    // Kein Schreibzugriff (privates Fenster, voller Speicher): Das nächste Mal
    // öffnet der Standard, und die Karte bietet den Ausweg wieder an.
  }
}

export function loescheFotoWeg(speicher: Speicher | null): void {
  try {
    speicher?.removeItem(FOTO_WEG_SCHLUESSEL)
  } catch {
    // Kein Zugriff auf den Speicher: Dann kann dort auch nichts Gemerktes stören.
  }
}
