/**
 * Die Reiter der AdminShell (components/shells/admin-shell.tsx): Höfe ·
 * Postfach · Startseite · Finanzen · Einstellungen (Register N15), dazu der
 * Weg zurück zum eigenen Hof und das Ziel der Konto-Plakette. Keine
 * Hof-Seitenleiste im Admin (docs/ai/DESIGN_SYSTEM.md, „Shells und
 * Navigation"). Rein, getestet in tests/admin-navigation.test.ts.
 *
 * Die Reiter sagen nur, wohin es geht. Ob jemand den Bereich sehen darf,
 * entscheidet jede Admin-Seite selbst über verlangeAdminSeite
 * (src/server/admin-wache.ts) — die Navigation ist nie die Sperre.
 */
import type { UserRole } from '@prisma/client'
import { ADMIN_POSTFACH_HREF } from '@/lib/postfach'
import { BRIEFKASTEN_HREF } from '@/lib/admin-briefkasten'

export type AdminReiterId = 'hoefe' | 'postfach' | 'startseite' | 'finanzen' | 'einstellungen'

export type AdminReiter = {
  id: AdminReiterId
  label: string
  href: string
  /**
   * Welche Zahl am Reiter steht: Höfe, die auf Freischaltung warten, bzw. am
   * Postfach ungelesene Antworten der Höfe plus Meldungen zu entscheiden (der
   * Schlüssel heißt weiter 'briefkasten', Nr. 86/87).
   */
  zahl?: 'hoefe' | 'briefkasten'
  /** Weitere Pfade, auf denen der Reiter aktiv ist — das Postfach auch auf der Detailseite einer Meldung. */
  auchAktivAuf?: readonly string[]
}

export const ADMIN_REITER: readonly AdminReiter[] = [
  { id: 'hoefe', label: 'Höfe', href: '/admin', zahl: 'hoefe' },
  // Seit Nr. 87 (Register N12) mit drei Reitern unter /admin/postfach; /admin/meldungen leitet um, die Detailseite einer Meldung bleibt.
  { id: 'postfach', label: 'Postfach', href: ADMIN_POSTFACH_HREF, zahl: 'briefkasten', auchAktivAuf: [BRIEFKASTEN_HREF] },
  // Bis Nr. 96 ein Platzhalter mit dem Kopf des Musters (src/app/admin/startseite/page.tsx).
  { id: 'startseite', label: 'Startseite', href: '/admin/startseite' },
  { id: 'finanzen', label: 'Finanzen', href: '/admin/finanzen' },
  { id: 'einstellungen', label: 'Einstellungen', href: '/admin/einstellungen' },
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
export function kontoHatHof(konto: { rolle: UserRole | null | undefined; hofVorhanden: boolean }): boolean {
  return konto.rolle === 'FARMER' && konto.hofVorhanden
}

/** Der aktive Reiter — der längste passende Pfad, damit /admin/postfach nicht auch „Höfe" ist. */
export function adminAktiverReiter(pfad: string): AdminReiterId | null {
  let bester: { id: AdminReiterId; laenge: number } | null = null
  for (const reiter of ADMIN_REITER) {
    for (const ziel of [reiter.href, ...(reiter.auchAktivAuf ?? [])]) {
      if ((pfad === ziel || pfad.startsWith(ziel + '/')) && (!bester || ziel.length > bester.laenge)) bester = { id: reiter.id, laenge: ziel.length }
    }
  }
  return bester?.id ?? null
}
