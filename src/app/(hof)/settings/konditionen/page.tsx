import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import type { KonditionenHof } from '@/lib/hof-einstellungen'
import { ladeKonditionenHof } from '@/server/queries/einstellungen'
import { ladeAbzeichenSchalter } from '@/server/queries/farm'
import { AbzeichenSchalter } from './abzeichen-schalter'
import { KonditionenAnsicht } from '@/components/hof-einstellungen/konditionen-ansicht'
import { EinstellungenFehler } from '@/components/hof-einstellungen/einstellungen-fehler'
import { EINSTELLUNGEN_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `Konditionen — ${MARKE}` }

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
  let abzeichen: { zeigen: boolean } | null = null
  let gefunden = true
  try {
    const [geladen, schalter] = await Promise.all([ladeKonditionenHof(session.user.id), ladeAbzeichenSchalter(session.user.id)])
    hof = geladen
    abzeichen = schalter
    gefunden = hof !== null
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'einstellungen', seite: 'konditionen' } })
  }
  if (!gefunden) redirect('/onboarding')

  return (
    <div className={EINSTELLUNGEN_RAHMEN}>
      {hof ? (
        <KonditionenAnsicht
          hof={hof}
          jetzt={new Date()}
          // Nur für Gründungshöfe (Register K2, Nr. 116): der Schalter im Block „Dein Stand“.
          abzeichen={abzeichen ? <AbzeichenSchalter anfangsAn={abzeichen.zeigen} /> : null}
        />
      ) : (
        <EinstellungenFehler titel="Deine Konditionen" href="/settings/konditionen" />
      )}
    </div>
  )
}
