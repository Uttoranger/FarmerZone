import { ladeHofbereich } from '@/server/hofbereich'
import { FarmerNav } from '@/components/farmer/farmer-nav'
import { ServiceWorkerAnmeldung } from '@/components/shared/service-worker-anmeldung'
import { SentryNutzer } from '@/components/farmer/sentry-nutzer'
import { ArchivedFarmBanner } from '@/components/farmer/archived-farm-banner'
import { PendingApprovalBanner } from '@/components/farmer/pending-approval-banner'
import { alsLand } from '@/lib/laender'

/*
 * Das Bestandslayout des Hofbereichs (FarmerNav). Routen, die ihr Gate in die
 * HofShell umgestellt hat, liegen in der Routengruppe (hof) mit eigenem
 * Layout (seit Nachtlauf Nr. 16: /farm-page) — hier springt nichts um, bis
 * die jeweilige Route umzieht. Zugang, Zahlen und Balken lädt für beide
 * Layouts derselbe Lader (src/server/hofbereich.ts).
 */
export default async function FarmerLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const { hof, personName, offeneBestellungen, balken, isAdmin, zuEntscheiden } = await ladeHofbereich()

  return (
    <div className="min-h-screen bg-background">
      {/* Teilen-Service-Worker: hier angemeldet, weil jeder Bauer über das
          Layout kommt — die Installation als App (und damit das Teilen-Ziel)
          setzt genau diesen Worker voraus. */}
      <ServiceWorkerAnmeldung />
      {/* Sentry-Nutzerkennung: ausschließlich die Farm-ID (nie E-Mail, nie
          Name) — hier gesetzt, weil jeder Bauer über dieses Layout kommt. */}
      <SentryNutzer farmId={hof.id} />
      <div className="flex min-h-screen">
        <FarmerNav
          farmName={hof.name}
          userName={personName}
          ordersBadge={offeneBestellungen > 0 ? offeneBestellungen : undefined}
          farmLogoUrl={hof.logoUrl}
          // Derselbe Zustand, der den Freigabe-Balken auslöst — die Karte zeigt
          // ihn nur zusätzlich als ruhigen Punkt an der Hof-Identität an.
          farmPending={balken?.art === 'wartet'}
          isAdmin={isAdmin}
          adminBadge={zuEntscheiden > 0 ? zuEntscheiden : undefined}
        />

        {/* min-w-0: als Flex-Item darf main nicht mit breitem Inhalt über den
            Viewport wachsen — sonst greift kein overflow-x-auto der Kinder */}
        <main className="flex-1 min-w-0 pb-24 md:pb-0 md:ml-56 print:ml-0 print:pb-0">
          {/* Stillgelegt sticht „wartet auf Freigabe" (entschieden im Lader).
              Einen Balken mit dem Shop-Link gibt es nicht mehr: Adresse,
              Kopieren und Teilen stehen im Kopf von Mein Hof — über jeder
              Seite nahm er nur Platz weg. */}
          {balken?.art === 'stillgelegt' ? (
            <ArchivedFarmBanner />
          ) : balken?.art === 'wartet' ? (
            <PendingApprovalBanner farmId={balken.farmId} farmName={balken.farmName} land={alsLand(balken.country)} />
          ) : null}
          {children}
        </main>
      </div>
    </div>
  )
}
