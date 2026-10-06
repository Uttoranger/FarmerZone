import { ladeHofbereich } from '@/server/hofbereich'
import { HofShell } from '@/components/shells/hof-shell'
import { HofBalken } from '@/components/hofbereich/hof-balken'
import { ServiceWorkerAnmeldung } from '@/components/shared/service-worker-anmeldung'
import { SentryNutzer } from '@/components/farmer/sentry-nutzer'

/*
 * Die Routen des Hofbereichs, die ihr Gate schon in die HofShell umgestellt
 * hat (Redesign, kein Big Bang) — seit Nachtlauf Nr. 16: /farm-page, seit
 * Nr. 17: /dashboard (Heute).
 *
 * Warum eine eigene Routengruppe und keine Weiche im Bestandslayout: Ein
 * Layout kennt seinen Pfad nicht (nur über einen Header-Umweg aus der
 * Middleware), und eine Seite unter (farmer) bekäme die FarmerNav immer
 * mit — die HofShell darin ergäbe zwei Navigationen. Eine Routengruppe
 * ändert keine Adresse (Proxy, Lesezeichen, Links bleiben), und eine Route
 * zieht um, indem ihr Ordner von (farmer) nach (hof) wandert. Ist der letzte
 * umgezogen, fällt (farmer) samt farmer-nav.tsx weg.
 *
 * Zugang, Zahlen und Balken aus demselben Lader wie das Bestandslayout
 * (src/server/hofbereich.ts); die Shell lädt nichts selbst.
 */
export default async function HofLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const { hof, personName, offeneBestellungen, balken, isAdmin, zuEntscheiden } = await ladeHofbereich()

  return (
    <HofShell
      hofName={hof.name}
      hofSlug={hof.slug}
      personName={personName}
      isAdmin={isAdmin}
      zahlen={{ bestellungen: offeneBestellungen, admin: zuEntscheiden }}
    >
      {/* Teilen-Service-Worker und Sentry-Kennung (nur die Farm-ID) wie im
          Bestandslayout — jeder Bauer kommt über eines der beiden. */}
      <ServiceWorkerAnmeldung />
      <SentryNutzer farmId={hof.id} />
      <HofBalken balken={balken} />
      {children}
    </HofShell>
  )
}
