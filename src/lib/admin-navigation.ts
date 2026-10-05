/**
 * Die Reiter der AdminShell (components/shells/admin-shell.tsx): Höfe ·
 * Briefkasten · Finanzen, dazu der Weg zurück zum eigenen Hof. Keine
 * Hof-Seitenleiste im Admin (docs/ai/DESIGN_SYSTEM.md, „Shells und
 * Navigation"). Rein, getestet in tests/admin-navigation.test.ts.
 *
 * Die Reiter sagen nur, wohin es geht. Ob jemand den Bereich sehen darf,
 * entscheidet jede Admin-Seite selbst über verlangeAdminSeite
 * (src/server/admin-wache.ts) — die Navigation ist nie die Sperre.
 */

export type AdminReiterId = 'hoefe' | 'briefkasten' | 'finanzen'

export type AdminReiter = {
  id: AdminReiterId
  label: string
  href: string
  /** Welche Zahl am Reiter steht: Höfe, die auf Freischaltung warten, bzw. Meldungen zu entscheiden. */
  zahl?: 'hoefe' | 'briefkasten'
}

export const ADMIN_REITER: readonly AdminReiter[] = [
  { id: 'hoefe', label: 'Höfe', href: '/admin', zahl: 'hoefe' },
  { id: 'briefkasten', label: 'Briefkasten', href: '/admin/meldungen', zahl: 'briefkasten' },
  { id: 'finanzen', label: 'Finanzen', href: '/admin/finanzen' },
]

/** „← Zu meinem Hof" im Browser, „← Mein Hof" am Handy. */
export const ADMIN_ZURUECK = { label: 'Zu meinem Hof', kurz: 'Mein Hof', href: '/dashboard' } as const

/** Der aktive Reiter — der längste passende, damit /admin/meldungen nicht auch „Höfe" ist. */
export function adminAktiverReiter(pfad: string): AdminReiterId | null {
  let bester: AdminReiter | null = null
  for (const reiter of ADMIN_REITER) {
    if (pfad === reiter.href || pfad.startsWith(reiter.href + '/')) {
      if (!bester || reiter.href.length > bester.href.length) bester = reiter
    }
  }
  return bester?.id ?? null
}
