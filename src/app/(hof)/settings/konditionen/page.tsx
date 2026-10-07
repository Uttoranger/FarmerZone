import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import type { KonditionenHof } from '@/lib/hof-einstellungen'
import { ladeKonditionenHof } from '@/server/queries/einstellungen'
import { KonditionenAnsicht } from '@/components/hof-einstellungen/konditionen-ansicht'
import { EinstellungenFehler } from '@/components/hof-einstellungen/einstellungen-fehler'
import { EINSTELLUNGEN_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'

export const metadata: Metadata = { title: 'Konditionen — FarmerZone' }

export const dynamic = 'force-dynamic'

/*
 * „Deine Konditionen" in der HofShell (Gate 8, Nachtlauf Nr. 22d, Register K1
 * und B1) — Mockup web-h1-einstellungen-konditionen. Texte aus
 * src/lib/konditionen.ts, das Rechenbeispiel mit den gespeicherten Sätzen
 * dieses Hofs. Die Admin-Freischaltung (Gründungsplatz) bleibt unberührt.
 */
export default async function KonditionenEinstellungenPage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  let hof: KonditionenHof | null = null
  let gefunden = true
  try {
    hof = await ladeKonditionenHof(session.user.id)
    gefunden = hof !== null
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'einstellungen', seite: 'konditionen' } })
  }
  if (!gefunden) redirect('/onboarding')

  return (
    <div className={EINSTELLUNGEN_RAHMEN}>
      {hof ? <KonditionenAnsicht hof={hof} jetzt={new Date()} /> : <EinstellungenFehler titel="Deine Konditionen" href="/settings/konditionen" />}
    </div>
  )
}
