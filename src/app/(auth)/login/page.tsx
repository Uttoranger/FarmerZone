import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { LoginClient } from './login-client'

/**
 * Wer schon angemeldet ist, hat auf dem Anmeldeformular nichts verloren.
 *
 * Vorher war /login eine reine Client-Komponente ohne Sitzungsprüfung: Ein
 * Bauer mit laufender Sitzung sah das Formular und musste sich fragen, ob er
 * eigentlich noch eingeloggt ist. Die Prüfung folgt dem Muster aus
 * src/app/(farmer)/layout.tsx — Sitzung holen, Rolle ansehen, umleiten.
 *
 * Nur FARMER wird umgeleitet: Für andere Rollen führt /dashboard ins Leere
 * (das Farmer-Layout schickt sie zurück), das wäre eine Schleife. Sie sehen
 * das Formular und können sich mit einem anderen Konto anmelden.
 *
 * Das Formular selbst ist unverändert und liegt jetzt in login-client.tsx.
 */
export default async function LoginPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (session?.user) {
    const role = (session.user as typeof session.user & { role: string }).role
    if (role === 'FARMER') redirect('/dashboard')
  }

  return <LoginClient />
}
