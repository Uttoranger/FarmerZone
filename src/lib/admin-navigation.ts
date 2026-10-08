/**
 * Die Reiter der AdminShell (components/shells/admin-shell.tsx): Höfe ·
 * Briefkasten · Finanzen, dazu der Weg zurück zum eigenen Hof und das Ziel der
 * Konto-Plakette. Keine Hof-Seitenleiste im Admin (docs/ai/DESIGN_SYSTEM.md,
 * „Shells und Navigation"). Rein, getestet in tests/admin-navigation.test.ts.
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

/** „← Zu meinem Hof" ab 1024 px, darunter „← Mein Hof" — nur, wenn das Konto einen Hof hat (kontoHatHof). */
export const ADMIN_ZURUECK = { label: 'Zu meinem Hof', kurz: 'Mein Hof', href: '/dashboard' } as const

/** Die Initialen-Plakette rechts im Kopf führt zu „Konto und Sicherheit" (Passwort, Darstellung, Hof stilllegen). */
export const ADMIN_KONTO = { label: 'Konto und Sicherheit', href: '/settings/account' } as const

/**
 * Ob der Kopf des Admins Wege in den Hofbereich zeigt: „← Mein Hof" und die
 * Plakette als Link auf „Konto und Sicherheit" (Register N1, Nr. 41). Beide
 * Ziele liegen im Hofbereich, und den öffnet ladeHofbereich
 * (src/server/hofbereich.ts) nur mit der Rolle FARMER und eigenem Hof. Ein
 * Betreiber ohne Hof (Rolle CUSTOMER) landete sonst auf /login, eine Rolle
 * FARMER ohne Hof erst beim Einrichten.
 */
export function kontoHatHof(konto: { rolle: string | null | undefined; hofVorhanden: boolean }): boolean {
  return konto.rolle === 'FARMER' && konto.hofVorhanden
}

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
