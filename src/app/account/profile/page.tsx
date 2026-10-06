import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bestaetigteAdresse } from '@/server/kunden-adresse'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { ProfileClient } from './profile-client'

export const dynamic = 'force-dynamic'

// Seit Nr. 14 im neuen Design (KundeShell); Inhalt und Zugang unverändert (E8).

export default async function AccountProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/account/login')

  // Abos nur zur bestätigten, angemeldeten Adresse (E8, Nr. 17a): Ein
  // Passwort-Konto beweist die Adresse nicht, und seit der Checkout kein
  // Konto mehr anlegt, gehören Abos oft zu einer Adresse ohne Konto. Frisch
  // aus der Datenbank, nicht aus der Sitzung (bestaetigteAdresse).
  const customerEmail = await bestaetigteAdresse(session.user.id)
  const subscriptions = customerEmail
    ? await prisma.customerFarmSubscription.findMany({
        where: { customerEmail },
        include: { farm: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: 'asc' },
      })
    : []

  return (
    <KundeShellMitSitzung>
      <ProfileClient
        // Ohne Namen: Er kann aus einer Registrierung mit Passwort stammen, die
        // die Adresse nie bewiesen hat (Better Auth behält ihn beim ersten Code).
        user={{
          id: session.user.id,
          email: session.user.email,
        }}
        subscriptions={subscriptions.map((s) => ({
          farmId: s.farmId,
          farmName: s.farm.name,
          farmSlug: s.farm.slug,
          optInEmail: s.optInEmail,
          optInWhatsApp: s.optInWhatsApp,
          customerPhone: s.customerPhone ?? null,
        }))}
      />
    </KundeShellMitSitzung>
  )
}
