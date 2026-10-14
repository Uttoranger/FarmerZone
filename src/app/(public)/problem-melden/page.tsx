import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { MeldungForm } from '@/components/shared/meldung-form'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { generateFormToken } from '@/lib/form-token'
import { KENNUNG_PARAMETER, PROBLEM_MELDEN, bereinigeKennung } from '@/lib/fehlerseite'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = {
  title: `${PROBLEM_MELDEN} — ${MARKE}`,
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
 *
 * Seit Nr. 54 in der KundeShell, das Formular als Karte nach dem Mockup
 * fehler-500-problem-melden-kunde (dort ein Dialog über der Fehlerseite).
 * Die Sitzung für den Kopf liest wie überall der Browser; diese Seite liest
 * sie zusätzlich auf dem Server, aber nur, um einen Hof zu erkennen.
 */
export default async function ProblemMeldenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  const rolle = session?.user ? (session.user as typeof session.user & { role?: string }).role : undefined
  const farm = session?.user && rolle === 'FARMER' ? await getFarmForUser(session.user.id) : null
  // Die Adresse ist eine Systemgrenze (CODING_STANDARDS §3): Die Fehlernummer
  // von der Fehlerseite geht durch bereinigeKennung, und was nicht passt,
  // wird verworfen — nie ein Fehler, nur ein leeres Feld.
  const kennung = bereinigeKennung((await searchParams)[KENNUNG_PARAMETER])

  return (
    <KundeShellMitSitzung>
      <div className="mx-auto w-full max-w-[560px] px-4 pt-8 pb-12 md:pt-[60px]">
        <div className="flex flex-col gap-3.5 rounded-[22px] border border-border bg-card p-5 md:p-6">
          <div>
            <h1 className="font-heading text-[22px] font-semibold text-foreground">{PROBLEM_MELDEN}</h1>
            <p className="mt-1 text-[13.5px] leading-normal text-muted-foreground">
              Danke, dass du Bescheid gibst. Wir schauen uns das an.
            </p>
          </div>
          <MeldungForm formToken={generateFormToken('meldung')} alsHof={farm !== null} kennungVorbelegt={kennung} />
        </div>
      </div>
    </KundeShellMitSitzung>
  )
}
