import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { ZurueckLink } from '@/components/shared/zurueck-link'
import { MeldungForm } from '@/components/shared/meldung-form'
import { generateFormToken } from '@/lib/form-token'

export const metadata: Metadata = {
  title: 'Problem melden — FarmerZone',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Öffentlicher Einstieg in den Fehlerbriefkasten (Fußzeile „Problem melden").
 * Kundinnen melden ohne Konto; eine E-Mail ist freiwillig und nur für
 * Rückfragen. Ein eingeloggter Hof wird hier genauso als Hof erkannt wie im
 * Bauernbereich (Sitzung, nie Formular) — dann ohne E-Mail-Feld (die Adresse
 * ist über den Hof bekannt, die Action würde sie ohnehin verwerfen) und mit
 * Screenshot-Weg.
 */
export default async function ProblemMeldenPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const rolle = session?.user ? (session.user as typeof session.user & { role?: string }).role : undefined
  const farm = session?.user && rolle === 'FARMER' ? await getFarmForUser(session.user.id) : null

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ZurueckLink className="mb-6 inline-block text-sm text-primary hover:underline" />
        <h1 className="font-heading text-2xl font-semibold text-foreground">Problem melden</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          Etwas funktioniert nicht, fehlt dir oder ist unklar? Schreib es uns — kurz und in deinen
          Worten.
        </p>
        <MeldungForm formToken={generateFormToken('meldung')} alsHof={farm !== null} hofName={farm?.name} />
      </div>
    </div>
  )
}
