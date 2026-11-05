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
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
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
      {/* Am Handy die feste Leiste zurück (Nr. 44); ab 768 px führt „Abbrechen" dorthin, deshalb dort keine Zeile. */}
      <UnterseitenKopf zeileImBrowser={false} />
      <div className="lg:flex lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-3.5 lg:w-[640px] lg:shrink-0">
          {/* Am Handy trägt die feste Leiste den Namen schon („← Problem melden", Elternseite = derselbe
              Punkt). Die h1 gleichen Wortlauts steht dort nur für den Screenreader, ab 768 px sichtbar wie im
              Web-Mockup (Nr. 56, Bericht 44). */}
          <h1 className="sr-only font-heading text-2xl font-semibold text-foreground md:not-sr-only md:text-[26px]">
            {PROBLEM_MELDEN}
          </h1>
          <p className="text-sm leading-normal text-muted-foreground">{PROBLEM_MELDEN_SATZ_HOF}</p>
          {/* Der gemeinsame Baustein in Orange (V51, Board s2/w2-meldungen); „Abbrechen" führt ab 768 px zur Übersicht der eigenen Meldungen. */}
          <MeldungForm formToken={generateFormToken('meldung')} alsHof welt="hof" abbrechenHref={MEINE_MELDUNGEN_HREF} kennungVorbelegt={kennung} />
        </div>
        <div className="hidden min-w-0 flex-1 lg:block">
          <HilfeSeitenspalte stand={stand} mailto={mailto} />
        </div>
      </div>
    </div>
  )
}
