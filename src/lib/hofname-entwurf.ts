/**
 * Der Hofname vom Registrieren bis Einrichten (Nr. 15) — EINE Stelle für
 * Schlüssel, Lesen, Schreiben und Löschen.
 *
 * Registrieren fragt nach dem Namen des Hofs (Mockup web-h0-hof-registrieren),
 * legt aber wie bisher nur das Konto an (registerFarmer unverändert). Den Hof
 * legt Einrichten an (createFarm); das Feld dort ist mit diesem Namen
 * vorbelegt. Weitergereicht über den sessionStorage statt über die Adresse:
 * Ein Hofname kann ein Familienname sein und gehört nicht in Server-Logs.
 * Nur eine Bequemlichkeit — fehlt der Eintrag, tippt man den Namen eben noch
 * einmal. Deshalb wirft hier nichts (privates Fenster, gesperrte Daten), und
 * gelesen wird mit Zod wie jeder Browser-Speicher (CODING_STANDARDS §3).
 */
import { z } from 'zod'
import { HOFNAME_MAX } from '@/lib/eingabegrenzen'

export const HOFNAME_ENTWURF_SCHLUESSEL = 'farmerzone_hofname_entwurf'

const entwurfSchema = z.string().trim().min(1).max(HOFNAME_MAX)

type Speicher = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Der sessionStorage des Browsers — oder null, wo es keinen gibt oder schon der Zugriff wirft. */
export function sitzungsSpeicher(): Speicher | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    // Gesperrte Website-Daten: Dann ohne Vorbelegung.
    return null
  }
}

/** Der gemerkte Hofname, oder null — auch bei allem, was kein brauchbarer Name ist. */
export function leseHofnameEntwurf(speicher: Speicher | null): string | null {
  if (!speicher) return null
  try {
    const gelesen = entwurfSchema.safeParse(speicher.getItem(HOFNAME_ENTWURF_SCHLUESSEL))
    return gelesen.success ? gelesen.data : null
  } catch {
    // Kein Lesezugriff: Dann ist nichts vorbelegt.
    return null
  }
}

export function schreibeHofnameEntwurf(speicher: Speicher | null, hofname: string): void {
  const geprueft = entwurfSchema.safeParse(hofname)
  if (!geprueft.success) return
  try {
    speicher?.setItem(HOFNAME_ENTWURF_SCHLUESSEL, geprueft.data)
  } catch {
    // Kein Schreibzugriff: Einrichten fragt den Namen dann ohne Vorbelegung.
  }
}

export function loescheHofnameEntwurf(speicher: Speicher | null): void {
  try {
    speicher?.removeItem(HOFNAME_ENTWURF_SCHLUESSEL)
  } catch {
    // Kein Zugriff: Dann kann dort auch nichts stehen bleiben, das stört.
  }
}
