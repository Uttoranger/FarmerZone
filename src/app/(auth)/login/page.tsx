import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { STANDARD_ZIEL_NACH_CODE } from '@/lib/anmeldecode'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { AnmeldenSeite } from '@/components/anmelden/anmelden-seite'

export const metadata: Metadata = {
  title: 'Anmelden',
}

/**
 * Hof-Anmeldung mit E-Mail und Passwort (Gate 4 Nr. 08) — dieselbe Seite wie
 * /account/login (Mockup web-k0-anmelden-kunde-code-hof-passwort), am Handy
 * mit der Hofkarte vorn. Die Anmeldelogik ist unverändert
 * (components/anmelden/hof-anmeldung.tsx).
 *
 * Wer schon angemeldet ist, hat auf dem Anmeldeformular nichts verloren.
 * Nur FARMER wird umgeleitet: Für andere Rollen führt /dashboard ins Leere
 * (das Farmer-Layout schickt sie zurück), das wäre eine Schleife. Sie sehen
 * das Formular und können sich mit einem anderen Konto anmelden. Muster aus
 * src/app/(farmer)/layout.tsx — Sitzung holen, Rolle ansehen, umleiten.
 *
 * Die Kundenkarte daneben führt nach der Anmeldung immer auf „Mein Konto" —
 * ein `?ziel=` liest nur /account/login.
 */
export default async function LoginPage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })

  if (session?.user) {
    const role = (session.user as typeof session.user & { role: string }).role
    if (role === 'FARMER') redirect('/dashboard')
  }

  return (
    <KundeShellMitSitzung>
      <AnmeldenSeite aktiv="hof" ziel={STANDARD_ZIEL_NACH_CODE} />
    </KundeShellMitSitzung>
  )
}
