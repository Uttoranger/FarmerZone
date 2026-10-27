/**
 * Die Reiter der AdminShell (components/shells/admin-shell.tsx, Register N32,
 * Nr. 193): Heute · Höfe · Bestellungen · Postfach · Startseite · Geld ·
 * Betrieb · Einstellungen; am Handy Heute · Höfe · Bestellungen · Postfach als
 * Leiste unten und „Mehr“ als Blatt mit dem Rest (Mockup mobil-admin-mehr).
 * Dazu der Weg zurück zum eigenen Hof und das Ziel der Konto-Plakette. Keine
 * Hof-Seitenleiste im Admin (docs/ai/DESIGN_SYSTEM.md, „Shells und
 * Navigation"). Rein, getestet in tests/admin-navigation.test.ts.
 *
 * Ein Reiter ohne Recht wird nicht gezeigt (N35, `sichtbareReiter`). Ob
 * jemand den Bereich sehen darf, entscheidet trotzdem jede Admin-Seite selbst
 * über verlangeAdminSeite (src/server/admin-wache.ts) — die Navigation ist nie
 * die Sperre, sie zeigt nur keinen Weg, der in „Heute“ zurückführte.
 */
import type { UserRole } from '@prisma/client'
import { ADMIN_POSTFACH_HREF } from '@/lib/postfach'
import { BRIEFKASTEN_HREF } from '@/lib/admin-briefkasten'
import { ADMIN_BETRIEB_HREF } from '@/lib/betrieb'
import { ABMELDEN_LABEL } from '@/lib/bauern-navigation'
import { ADMIN_PFAD } from '@/lib/admin-anmeldung'
import { ADMIN_HOEFE_HREF } from '@/lib/admin-hof-akte'
import { ADMIN_BESTELLUNGEN_HREF } from '@/lib/admin-bestellung'
import { PR_BASIS_URL } from '@/lib/meldung'
import { darf, type AdminPerson, type AdminRecht } from '@/lib/admin-rechte'

export type AdminReiterId = 'heute' | 'hoefe' | 'bestellungen' | 'postfach' | 'startseite' | 'geld' | 'betrieb' | 'einstellungen'

export type AdminReiter = {
  id: AdminReiterId
  label: string
  href: string
  /** Was die Seite des Reiters verlangt (N35) — dieselbe Angabe wie ihr verlangeAdminSeite. */
  recht: AdminRecht
  /**
   * Welche Zahl am Reiter steht (N32): Heute die offenen Aufgaben aus „Braucht
   * dich“, Höfe die wartenden, Postfach die ungelesenen Gespräche (Antworten
   * und Meldungen — Aufgaben stehen seit Nr. 193 nur noch in Heute).
   */
  zahl?: 'heute' | 'hoefe' | 'postfach'
  /** Ein Punkt statt einer Zahl, solange eine Warnung offen ist (Betrieb, Register N15/N18). */
  warnpunkt?: true
  /** Weitere Pfade, auf denen der Reiter aktiv ist — das Postfach auch auf der Detailseite einer Meldung. */
  auchAktivAuf?: readonly string[]
  /** Nur auf genau dieser Adresse aktiv — Heute liegt auf /admin, darunter liegt alles andere. */
  nurGenau?: true
  /** Am Handy (N32): in der Leiste unten oder im Blatt „Mehr“. */
  amHandy: 'leiste' | 'mehr'
}

/** Geld liegt unter /admin/geld (Nr. 191, src/app/admin/geld/texte.ts — lib liest nicht aus app). */
const ADMIN_GELD_PFAD = '/admin/geld'

export const ADMIN_REITER: readonly AdminReiter[] = [
  { id: 'heute', label: 'Heute', href: ADMIN_PFAD.bereich, recht: 'ansehen', zahl: 'heute', nurGenau: true, amHandy: 'leiste' },
  { id: 'hoefe', label: 'Höfe', href: ADMIN_HOEFE_HREF, recht: 'ansehen', zahl: 'hoefe', amHandy: 'leiste' },
  { id: 'bestellungen', label: 'Bestellungen', href: ADMIN_BESTELLUNGEN_HREF, recht: 'ansehen', amHandy: 'leiste' },
  // Seit Nr. 87 (Register N12) unter /admin/postfach; /admin/meldungen leitet um, die Detailseite einer Meldung bleibt.
  { id: 'postfach', label: 'Postfach', href: ADMIN_POSTFACH_HREF, recht: 'ansehen', zahl: 'postfach', auchAktivAuf: [BRIEFKASTEN_HREF], amHandy: 'leiste' },
  { id: 'startseite', label: 'Startseite', href: '/admin/startseite', recht: 'ansehen', amHandy: 'mehr' },
  // „Finanzen“ heißt seit Nr. 191 „Geld“ (N32); die alte Adresse leitet mit 308 um.
  { id: 'geld', label: 'Geld', href: ADMIN_GELD_PFAD, recht: 'geld', auchAktivAuf: ['/admin/finanzen'], amHandy: 'mehr' },
  // Seit Nr. 103 (Register N15/N18): Speicher, Grenzen, Abläufe; der Punkt nur in der Produktion.
  { id: 'betrieb', label: 'Betrieb', href: ADMIN_BETRIEB_HREF, recht: 'ansehen', warnpunkt: true, amHandy: 'mehr' },
  { id: 'einstellungen', label: 'Einstellungen', href: '/admin/einstellungen', recht: 'ansehen', amHandy: 'mehr' },
]

/** Die Reiter, die diese Person sieht — ohne Recht kein Reiter (N35). */
export function sichtbareReiter(person: AdminPerson): AdminReiterId[] {
  return ADMIN_REITER.filter((r) => darf(person, r.recht)).map((r) => r.id)
}

/**
 * Das Betriebshandbuch (docs/betrieb/handbuch.md, Nr. 192) im Blatt „Mehr“:
 * Es liegt im öffentlichen Repository, eine eigene Seite im Admin gibt es
 * nicht — darum ein Link in einem neuen Tab.
 */
export const ADMIN_HANDBUCH = {
  label: 'Handbuch',
  zeile: 'Routinen und Notfälle',
  href: `${PR_BASIS_URL.replace(/\/pull\/$/, '')}/blob/main/docs/betrieb/handbuch.md`,
} as const

/** Die Zeile unter jedem Eintrag im Blatt „Mehr“ (Mockup mobil-admin-mehr) — feste Sätze, keine Zahlen. */
export const ADMIN_MEHR_ZEILE: Partial<Record<AdminReiterId, string>> = {
  startseite: 'Entwurf, Vorschau, Zeitplan',
  geld: 'Abgleich, Monatsabschluss, Kosten',
  betrieb: 'Abläufe, E-Mails, Protokoll',
  einstellungen: 'Team, Benachrichtigungen, Notfallzugang',
}

/** Für Screenreader an der Zahl des Reiters „Heute“ (Zaehler, `sr-only`). */
export const ADMIN_HEUTE_ZAEHLER = 'Aufgaben offen in Heute'

/** Die Wörter des Blatts „Mehr“ (Mockup mobil-admin-mehr). */
export const ADMIN_MEHR_TEXT = {
  titel: 'Mehr',
  schliessen: 'Schließen',
  bereiche: 'Weitere Bereiche',
  konto: 'Konto',
  neuerTab: '(öffnet in neuem Tab)',
} as const

/** „← Zu meinem Hof" ab 1024 px, darunter „← Mein Hof" — nur, wenn das Konto einen Hof hat (kontoHatHof). */
export const ADMIN_ZURUECK = { label: 'Zu meinem Hof', kurz: 'Mein Hof', href: '/dashboard' } as const

/** Die Initialen-Plakette rechts im Kopf führt zu „Konto und Sicherheit" (Passwort, Darstellung, Hof stilllegen). */
export const ADMIN_KONTO = { label: 'Konto und Sicherheit', href: '/settings/account' } as const

/**
 * „Abmelden" im Kopf der AdminShell (Register N20, Nr. 126): dasselbe Wort wie
 * in der HofShell, aber das Ziel danach ist die Anmeldung der Admins — mit
 * Passkey —, nicht /login (dort gibt es für dieses Konto kein Passwort mehr).
 */
export const ADMIN_ABMELDEN = { label: ABMELDEN_LABEL, ziel: ADMIN_PFAD.anmelden } as const

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

/** Der aktive Reiter — der längste passende Pfad, damit /admin/postfach nicht auch „Heute“ ist; Heute nur auf /admin selbst. */
export function adminAktiverReiter(pfad: string): AdminReiterId | null {
  let bester: { id: AdminReiterId; laenge: number } | null = null
  for (const reiter of ADMIN_REITER) {
    for (const ziel of [reiter.href, ...(reiter.auchAktivAuf ?? [])]) {
      const passt = pfad === ziel || (!reiter.nurGenau && pfad.startsWith(ziel + '/'))
      if (passt && (!bester || ziel.length > bester.laenge)) bester = { id: reiter.id, laenge: ziel.length }
    }
  }
  return bester?.id ?? null
}
