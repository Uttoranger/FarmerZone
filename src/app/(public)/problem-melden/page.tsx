import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { MeldungForm } from '@/components/shared/meldung-form'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { generateFormToken } from '@/lib/form-token'
import { KENNUNG_PARAMETER, PROBLEM_MELDEN, bereinigeKennung } from '@/lib/fehlerseite'
import { PROBLEM_MELDEN_SATZ_KUNDE } from '@/lib/hof-hilfe'
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
 * Seit Nr. 54 in der KundeShell; seit Nr. 225 (Lauf 30) zeichnet der gemeinsame
 * Baustein „Problem melden“ die Karte (Board s3/w3-problem-melden, grün).
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
      {/* Board s3/w3-problem-melden: die Karte (höchstens 560 px) zeichnet der gemeinsame Baustein, grün in der KundeShell (V52).
          Seit Nr. 254 links in der 1000-px-Spalte der Shell, an der Kante des Seitenfußes, 16 px unter dem Kopf
          (Liste Lauf 32, problem-melden „Karten mittig statt in der Inhaltsspalte“). */}
      <div className="mx-auto flex w-full max-w-[1032px] px-4 pt-4 pb-12">
        <MeldungForm
          formToken={generateFormToken('meldung')}
          alsHof={farm !== null}
          welt="kunde"
          abbrechenHref="/"
          titel={PROBLEM_MELDEN}
          satz={PROBLEM_MELDEN_SATZ_KUNDE}
          kennungVorbelegt={kennung}
          hofName={farm?.name}
        />
      </div>
    </KundeShellMitSitzung>
  )
}
