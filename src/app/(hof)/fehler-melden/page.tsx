import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getMeldungenFuerHof } from '@/server/queries/meldung'
import { generateFormToken } from '@/lib/form-token'
import { KENNUNG_PARAMETER, PROBLEM_MELDEN, bereinigeKennung } from '@/lib/fehlerseite'
import { MEINE_MELDUNGEN_HREF, PROBLEM_MELDEN_SATZ_HOF, meldungenStand } from '@/lib/hof-hilfe'
import { supportMailto } from '@/lib/support'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { HofUnterzeile } from '@/components/mein-hof/hof-unterzeile'
import { MeldungForm } from '@/components/shared/meldung-form'
import { HilfeSeitenspalte } from '@/components/hof-hilfe/hilfe-seitenspalte'
import { MELDEN_RAHMEN } from '@/components/hof-hilfe/hilfe-laden'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `${PROBLEM_MELDEN} — ${MARKE}` }

export const dynamic = 'force-dynamic'

/*
 * „Problem melden" — Meldung abgeben in der HofShell (Nachtlauf
 * Nr. 22e; seit Nr. 225 nach Board s2/w2-meldungen mit dem gemeinsamen Baustein
 * in Orange). Nur für Höfe: Kundinnen melden auf /problem-melden (grün).
 *
 * Die Fehlernummer aus der Adresse geht nur geprüft ins Formular
 * (bereinigeKennung, wie /problem-melden). Die Seitenspalte zählt die eigenen
 * Meldungen (farmId der Sitzung); lässt sich das nicht laden, bleibt das
 * Formular nutzbar und die Spalte zeigt nur den Weg zu den Meldungen.
 */
export default async function FehlerMeldenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.JSX.Element> {
  const { userId } = await verlangeHofDerSitzung()
  const farm = await getFarmForUser(userId)
  if (!farm) redirect('/onboarding')

  const kennung = bereinigeKennung((await searchParams)[KENNUNG_PARAMETER])

  let stand: { offen: number; beantwortet: number } | null = null
  try {
    stand = meldungenStand(await getMeldungenFuerHof(farm.id))
  } catch (err) {
    // Nur Bereich und Hof — kein Meldungstext (Fremdtext) nach Sentry.
    Sentry.captureException(err, { tags: { bereich: 'hilfe', seite: 'melden' }, extra: { farmId: farm.id } })
  }

  const mailto = supportMailto({
    subject: `Frage zu ${MARKE}`,
    anliegen: 'Meine Frage:',
    farmSlug: farm.slug,
  })

  return (
    <div className={MELDEN_RAHMEN}>
      {/* Werkzeug-Kopf (G1): Titel in der Leiste, damit entfällt die doppelte h1-Regel aus Nr. 56. */}
      <WerkzeugKopf titel={PROBLEM_MELDEN} unterzeile={<HofUnterzeile hofName={farm.name} jetzt={new Date()} />} />
      <div className="lg:flex lg:items-start lg:gap-8">
        {/* Formular 560 px, die Seitenspalte nimmt den Rest (Liste Lauf 32 meldungen: „Seitenspalte schmal“). */}
        <div className="flex min-w-0 flex-col gap-3.5 lg:w-[560px] lg:shrink-0">
          {/* Der gemeinsame Baustein in Orange (V51, Board s2/w2-meldungen); „Abbrechen" führt ab 768 px zur Übersicht der eigenen Meldungen. */}
          <MeldungForm
            formToken={generateFormToken('meldung')}
            alsHof
            welt="hof"
            abbrechenHref={MEINE_MELDUNGEN_HREF}
            einleitung={PROBLEM_MELDEN_SATZ_HOF}
            kennungVorbelegt={kennung}
            hofName={farm.name}
          />
        </div>
        <div className="hidden min-w-0 flex-1 lg:block">
          <HilfeSeitenspalte stand={stand} mailto={mailto} />
        </div>
      </div>
    </div>
  )
}
