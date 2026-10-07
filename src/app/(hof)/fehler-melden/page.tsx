import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getMeldungenFuerHof } from '@/server/queries/meldung'
import { generateFormToken } from '@/lib/form-token'
import { KENNUNG_PARAMETER, bereinigeKennung } from '@/lib/fehlerseite'
import { MEINE_MELDUNGEN_HREF, meldungenStand } from '@/lib/hof-hilfe'
import { supportMailto } from '@/lib/support'
import { ZurueckLink } from '@/components/hofbereich/zurueck-link'
import { MeldungAbgeben } from '@/components/hof-hilfe/meldung-abgeben'
import { HilfeSeitenspalte } from '@/components/hof-hilfe/hilfe-seitenspalte'
import { MELDEN_RAHMEN } from '@/components/hof-hilfe/hilfe-laden'

export const metadata: Metadata = { title: 'Hilfe und Rückmeldung — FarmerZone' }

export const dynamic = 'force-dynamic'

/*
 * „Hilfe und Rückmeldung" — Meldung abgeben in der HofShell (Nachtlauf
 * Nr. 22e; Mockups web-h6-meldung-abgeben, mobil-h6-meldung-abgeben). Nur für
 * Höfe: Kundinnen melden auf /problem-melden, das unverändert beim
 * Bestandsformular bleibt.
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
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')
  const farm = await getFarmForUser(session.user.id)
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
    subject: 'Frage zu FarmerZone',
    anliegen: 'Meine Frage:',
    farmSlug: farm.slug,
  })

  return (
    <div className={MELDEN_RAHMEN}>
      <div className="lg:flex lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-3.5 lg:w-[640px] lg:shrink-0">
          {/* Am Handy der Weg zurück (Mockup mobil); ab 768 px führt „Abbrechen" dorthin. */}
          <ZurueckLink href={MEINE_MELDUNGEN_HREF} className="mb-0 md:hidden">
            Meine Meldungen
          </ZurueckLink>
          <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[26px]">Hilfe und Rückmeldung</h1>
          <p className="text-sm leading-normal text-muted-foreground">
            Etwas klemmt, du wünschst dir etwas oder hast eine Frage? Schreib uns – wir lesen alles.
          </p>
          <MeldungAbgeben formToken={generateFormToken('meldung')} hofName={farm.name} kennungVorbelegt={kennung} />
        </div>
        <div className="hidden min-w-0 flex-1 lg:block">
          <HilfeSeitenspalte stand={stand} mailto={mailto} />
        </div>
      </div>
    </div>
  )
}
