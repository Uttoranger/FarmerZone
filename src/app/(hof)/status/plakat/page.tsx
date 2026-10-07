import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Printer } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getPlakatDaten } from '@/server/queries/teilen-bild'
import { ZurueckLink } from '@/components/hofbereich/zurueck-link'
import { QrPlakat } from '@/components/teilen/qr-plakat'
import { DruckenKnopf } from '@/components/teilen/drucken-knopf'
import { EmptyState } from '@/components/ui/empty-state'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'QR-Plakat — FarmerZone' }

export const dynamic = 'force-dynamic'

const KNOPF_ORANGE = cn(
  'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-primary-foreground/25 bg-primary px-5 text-[13.5px] font-semibold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90',
  FOKUS_RAHMEN
)

/*
 * QR-Plakat zum Drucken (Gate 7 Aufgabe 3, Nachtlauf Nr. 21; Mockup
 * web-h4-qr-plakat-zum-drucken) — in der HofShell, die beim Drucken
 * Seitenleiste, Unterleiste und Balken ausblendet (print:hidden). Auf dem
 * Papier steht nur das Blatt: A4 ohne Rand (@page), der Kopf dieser Seite
 * ist print:hidden.
 *
 * Nur für einen öffentlichen Hof: Ein Plakat mit Code auf eine Seite, die
 * niemand sehen kann, wäre ein Aushang ins Leere. Der Code trägt die feste
 * Adresse der Hofseite mit ?k=qr — das gedruckte Blatt bleibt gültig.
 */
export default async function PlakatPage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/onboarding')

  const daten = await getPlakatDaten(farm.id)

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-5 pb-12 md:px-8 md:pt-8 print:m-0 print:max-w-none print:p-0">
      {/* A4 ohne Druckrand: Das Blatt bringt seinen eigenen Rand mit. */}
      <style>{'@page { size: A4; margin: 0; }'}</style>
      <div className="print:hidden">
        <ZurueckLink href="/dashboard">Heute</ZurueckLink>
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-[26px] font-semibold md:text-[30px]">QR-Plakat</h1>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Zum Aushängen im Hofladen, am Hoftor oder beim Bäcker. Der Code führt direkt zu deiner Hofseite.
            </p>
          </div>
          {daten && <DruckenKnopf className={KNOPF_ORANGE} />}
        </div>
      </div>

      {daten ? (
        <QrPlakat daten={daten} />
      ) : (
        <EmptyState
          symbol={Printer}
          titel="Das Plakat gibt es, sobald dein Hof online ist"
          satz="Solange Kunden deine Hofseite nicht sehen können, würde der Code ins Leere führen."
          aktion={
            <Link href="/farm-page" className={KNOPF_ORANGE}>
              Zu Mein Hof
            </Link>
          }
        />
      )}
    </div>
  )
}
