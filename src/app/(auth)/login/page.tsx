import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { isAdminUser } from '@/server/queries/admin'
import { ADMIN_PFAD } from '@/lib/admin-anmeldung'
import { STANDARD_ZIEL_NACH_CODE, zielNachHofAnmeldung } from '@/lib/anmeldecode'
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
 *
 * Ein Konto mit Admin-Recht ohne Hof (Rolle nicht FARMER; Register N20,
 * Nr. 115) geht nach /admin — das Recht frisch aus der Datenbank. Vorher
 * schickte /dashboard es hierher zurück, und es kam nie in den Admin-Bereich.
 * Dort greift die Pflicht (erst Passkey).
 *
 * Ein schon angemeldeter Hof geht seit Nr. 156 dorthin, wohin ihn `?von=`
 * schickt (Rücksprung aus dem Hofbereich) — nur geprüft über
 * zielNachHofAnmeldung, sonst /dashboard.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ von?: string | string[] }>
}): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })

  if (session?.user) {
    const role = (session.user as typeof session.user & { role: string }).role
    if (role === 'FARMER') {
      const { von } = await searchParams
      redirect(zielNachHofAnmeldung(typeof von === 'string' ? von : null))
    }
    if (await isAdminUser(session.user.id)) redirect(ADMIN_PFAD.bereich)
  }

  return (
    <KundeShellMitSitzung>
      <AnmeldenSeite aktiv="hof" ziel={STANDARD_ZIEL_NACH_CODE} />
    </KundeShellMitSitzung>
  )
}
