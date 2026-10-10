import { HOFNAME_MAX } from '@/lib/eingabegrenzen'

// Jeder feste Routenordner auf oberster Ebene unter src/app (auch in den
// Routengruppen). Ein Hof mit einem dieser Slugs wäre nie erreichbar: Die
// feste Route gewinnt dauerhaft gegen /[farmSlug]. Dieselbe Menge steht als
// KEINE_HOFSEITE in next.config.ts — tests/reservierte-slugs.test.ts gleicht
// beide mit den echten Ordnern ab; ein neuer Ordner fällt dort auf.
// Bestehende Höfe bleiben unberührt: Die Liste wirkt nur beim Anlegen.
export const RESERVED_SLUGS = new Set([
  'account', 'admin', 'analytics', 'api', 'bestellungen', 'customers', 'dashboard', 'datenschutz',
  'farm-page', 'fehler-melden', 'forgot-password', 'fuer-hoefe', 'hoefe', 'impressum', 'intern', 'konditionen',
  'login', 'meldungen', 'onboarding', 'orders', 'problem-melden', 'products', 'region', 'register',
  'reset-password', 'sales', 'settings', 'status', 'teilen', 'verify',
])

export function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'hof'
}

/**
 * So sieht jeder Slug aus, den generateSlug erzeugt: Kleinbuchstaben und
 * Ziffern, durch einzelne Bindestriche getrennt, keiner am Rand. Dasselbe
 * Zeichenset erlaubt die Hofseiten-Regel in next.config.ts.
 */
export const SLUG_MUSTER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Längster Slug aus einem erlaubten Hofnamen: Ein Umlaut oder ß wird zu zwei
 * Buchstaben (ä → ae), alles andere höchstens zu einem — 80 Zeichen ergeben
 * also höchstens 160. Eine kleinere Grenze lehnte Namen ab, die createFarm
 * anlegt.
 */
export const SLUG_MAX = 2 * HOFNAME_MAX
