import { z } from 'zod'
import { BETRIEBSSTATUS_VALUES } from '@/lib/taxonomie'
import { BETRIEBSNUMMER_MIN_ZEICHEN } from '@/lib/betriebsnachweis'

/**
 * Betriebsnummer und Betriebsstatus des Hofs (Sprint Bereiche 1, Rückfrage F6).
 * Teil des Hofprofils (updateProfile in src/server/actions/farm.ts).
 */

export const BETRIEBSNUMMER_ZU_KURZ = 'Eine Betriebsnummer hat mindestens 5 Zeichen.'

/**
 * Leer bleibt erlaubt (→ null). Sonst mindestens 5 Zeichen — dieselbe Grenze
 * wie im Checkout, sonst belegt der Checkout eine Nummer vor, die er im
 * nächsten Schritt ablehnt. Die Plattform prüft die Nummer nicht weiter.
 */
export const hofBetriebsnummerSchema = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return null
    if (typeof v !== 'string') return v
    const getrimmt = v.trim()
    return getrimmt === '' ? null : getrimmt
  },
  z.string().min(BETRIEBSNUMMER_MIN_ZEICHEN, BETRIEBSNUMMER_ZU_KURZ).max(100).nullable()
)

export const betriebsstatusSchema = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.enum(BETRIEBSSTATUS_VALUES).nullable()
)
