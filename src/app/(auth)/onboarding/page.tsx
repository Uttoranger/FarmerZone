import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { einrichtenStand, vorname } from '@/lib/einrichten'
import { ladeEinrichtenHof } from '@/server/queries/einrichten'
import { getOpenOrdersCount } from '@/server/queries/orders'
import { isAdminUser } from '@/server/queries/admin'
import { zaehleZuEntscheiden } from '@/server/queries/meldung'
import { HofShell } from '@/components/shells/hof-shell'
import { KundeFokusShell } from '@/components/shells/kunde-shell'
import { EinrichtenSeite } from '@/components/einrichten/einrichten-seite'

export const metadata: Metadata = {
  title: 'Hof einrichten — FarmerZone',
}

export const dynamic = 'force-dynamic'

/**
 * „Hof einrichten" (Gate 5, Nr. 15; Mockups web-h1-einrichten und
 * mobil-h1-einrichten): sechs Schritte, ihr Stand aus src/lib/einrichten.ts.
 *
 * Bisher führte die Seite einen Hof mit Hof nach /dashboard und war sonst ein
 * Assistent (Hofdaten, Produkte, Abholzeiten). Jetzt:
 *  - ohne Hof: Fokus-Shell (es gibt noch keinen Hof für die Seitenleiste),
 *    Schritt 2 trägt das Formular „Hof anlegen" (createFarm, unverändert);
 *  - mit Hof: HofShell wie im Mockup, die Schritte verlinken in die
 *    bestehenden Seiten (Mein Hof, Produkte, Zahlung). Produkte und
 *    Abholzeiten legt der Hof dort an, nicht mehr im Assistenten — dort gelten
 *    alle Regeln (Kategorie-Pflicht, Abholzeiten-Prüfung).
 *
 * Nur Höfe: Andere Rollen schickt die Seite wie das Bauern-Layout zur
 * Anmeldung — sonst legte ein Kundenkonto hier einen Hof an, den es danach
 * nie erreicht.
 */
export default async function OnboardingPage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')
  const rolle = (session.user as typeof session.user & { role?: string }).role
  if (rolle !== 'FARMER') redirect('/login')

  const hof = await ladeEinrichtenHof(session.user.id)
  const person = { name: session.user.name ?? '', email: session.user.email ?? '' }
  const stand = einrichtenStand({ personName: person.name, email: person.email, hof })
  const inhalt = (
    <EinrichtenSeite
      stand={stand}
      vorname={vorname(person.name)}
      person={person}
      tarif={hof?.tarif ?? null}
      freigeschaltet={hof?.freigeschaltet ?? false}
    />
  )

  if (!hof) {
    return (
      <KundeFokusShell titel="Hof einrichten" zurueck={{ href: '/', label: 'Zur Startseite' }}>
        {inhalt}
      </KundeFokusShell>
    )
  }

  // Zahlen und Admin-Recht wie im Bauern-Layout — frisch aus der Datenbank.
  const [offeneBestellungen, isAdmin] = await Promise.all([getOpenOrdersCount(hof.id), isAdminUser(session.user.id)])
  const zuEntscheiden = isAdmin ? await zaehleZuEntscheiden() : 0
  return (
    <HofShell
      hofName={hof.name}
      hofSlug={hof.slug}
      personName={person.name}
      isAdmin={isAdmin}
      zahlen={{ bestellungen: offeneBestellungen, admin: zuEntscheiden }}
    >
      {inhalt}
    </HofShell>
  )
}
