import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getUmfeld } from '@/server/queries/umfeld'
import { getFutterKaufen } from '@/server/queries/futter-kaufen'
import { baueUmfeld, baueUmfeldKarte, standardBereich } from '@/lib/umfeld'
import { baueFutterKaufen } from '@/lib/futter-kaufen'
import { wienJetzt } from '@/lib/hofuebersicht'
import { leseUmfeldFilter, umfeldLink } from '@/schemas/umfeld-filter'
import { futterKaufenLink, leseFutterKaufenFilter, leseRegionReiter } from '@/schemas/region'
import { REGION_RAHMEN, RegionKopf } from '@/components/region/region-kopf'
import { RegionFehler, StandortFehlt } from '@/components/region/region-zustaende'
import { FutterKaufenAnsicht } from '@/components/region/futter-kaufen-ansicht'
import { UmfeldAnzeige } from '@/components/analytics/umfeld-anzeige'

export const metadata: Metadata = { title: 'Region — FarmerZone' }

export const dynamic = 'force-dynamic'

type Suche = Record<string, string | string[] | undefined>

/*
 * Region (Nachtlauf Nr. 22c, Gate 8): eigener Menüpunkt in der HofShell mit
 * den Reitern „Preise vergleichen" (das bisherige Umfeld, /analytics/umfeld
 * leitet hierher um) und „Futter kaufen". Beide lesen fremde Höfe nur mit
 * der öffentlichen Sichtbarkeitsregel und rechnen um den EIGENEN Hof — die
 * farmId kommt aus der Sitzung, Umkreis und Filter aus der Adresse (Zod).
 * Entschieden wird in src/lib/umfeld.ts bzw. src/lib/futter-kaufen.ts.
 */
export default async function RegionPage({ searchParams }: { searchParams: Promise<Suche> }): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/onboarding')

  const suche = await searchParams
  const reiter = leseRegionReiter(suche.reiter)

  if (reiter === 'futter') {
    const filter = leseFutterKaufenFilter(suche)
    let daten: Awaited<ReturnType<typeof getFutterKaufen>> | undefined
    try {
      daten = await getFutterKaufen(farm.id, filter.km)
    } catch (err) {
      Sentry.captureException(err, { tags: { bereich: 'region', seite: 'futter' }, extra: { farmId: farm.id } })
    }
    if (daten === null) redirect('/login')
    return (
      <div className={REGION_RAHMEN}>
        <div className="flex flex-col gap-4 md:gap-[18px]">
          <RegionKopf reiter="futter" km={filter.km} />
          {daten === undefined ? (
            <RegionFehler nochmal={futterKaufenLink(filter)} />
          ) : daten.eigenerStandort ? (
            <FutterKaufenAnsicht filter={filter} ansicht={baueFutterKaufen({ ...daten, filter, jetzt: wienJetzt(new Date()) })} />
          ) : (
            <StandortFehlt />
          )}
        </div>
      </div>
    )
  }

  const filter = leseUmfeldFilter(suche)
  let daten: Awaited<ReturnType<typeof getUmfeld>> | undefined
  try {
    daten = await getUmfeld(farm.id, filter.km)
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'region', seite: 'preise' }, extra: { farmId: farm.id } })
  }
  if (daten === null) redirect('/login')

  let inhalt: React.JSX.Element
  if (daten === undefined) {
    inhalt = <RegionFehler nochmal={umfeldLink({ km: filter.km, bereich: filter.bereich ?? 'LEBENSMITTEL' })} />
  } else if (!daten.eigenerStandort) {
    inhalt = <StandortFehlt />
  } else {
    const bereich = filter.bereich ?? standardBereich(daten.eigeneProdukte)
    const eingabe = { ...daten, bereich, km: filter.km }
    // Liste und Karte aus DERSELBEN Eingabe — die Pins sind genau die Höfe,
    // die die Zeilen zählen (gezaehlteHoefe in src/lib/umfeld.ts).
    inhalt = (
      <UmfeldAnzeige
        bereich={bereich}
        km={filter.km}
        eigenerName={farm.name}
        ansicht={baueUmfeld(eingabe)}
        karte={baueUmfeldKarte({ ...eingabe, eigenerStandort: daten.standort })}
      />
    )
  }

  return (
    <div className={REGION_RAHMEN}>
      <div className="flex flex-col gap-4 md:gap-[18px]">
        <RegionKopf reiter="preise" km={filter.km} />
        {inhalt}
      </div>
    </div>
  )
}
