import { redirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { getFutterKaufen } from '@/server/queries/futter-kaufen'
import { baueFutterKaufen } from '@/lib/futter-kaufen'
import { futterKaufenLink, leseFutterAnsicht, leseFutterKaufenFilter } from '@/schemas/region'
import { REGION_RAHMEN, RegionKopf } from '@/components/region/region-kopf'
import { RegionFehler } from '@/components/region/region-zustaende'
import { FutterKaufenAnsicht } from '@/components/region/futter-kaufen-ansicht'
import { LadeInhalt } from '@/components/ui/lade-punkt'
import { OhneStandort } from './ohne-standort'

type Suche = Record<string, string | string[] | undefined>

/**
 * Region › Futter kaufen (Nachtlauf Nr. 22c; seit Nr. 122 ein eigener Teil der
 * Seite, seit Nr. 123 nach N23): Filter und Ansicht aus der Adresse, Daten um
 * den eigenen Hof (einmal 50 km), angeordnet von FutterKaufenAnsicht. Den
 * Zeitpunkt bestimmt der Server einmal und reicht ihn als ISO-Text weiter
 * (Abholzeile, Filter „Abholung"). Ohne eigenen Standort der Zustand beider Reiter.
 */
export async function FutterReiter({ farm, suche }: { farm: { id: string }; suche: Suche }): Promise<React.JSX.Element> {
  const filter = leseFutterKaufenFilter(suche)
  const ansicht = leseFutterAnsicht(suche.ansicht)
  const jetzt = new Date()
  let daten: Awaited<ReturnType<typeof getFutterKaufen>> | undefined
  try {
    daten = await getFutterKaufen(farm.id, jetzt)
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'region', seite: 'futter' }, extra: { farmId: farm.id } })
  }
  if (daten === null) redirect('/login')
  return (
    <div className={REGION_RAHMEN}>
      <div className="flex flex-col gap-4 md:gap-[18px]">
        <RegionKopf reiter="futter" km={filter.km} ladePunkt />
        <LadeInhalt>
          {daten === undefined ? (
            <RegionFehler nochmal={futterKaufenLink(filter, ansicht)} />
          ) : daten.eigenerStandort ? (
            <FutterKaufenAnsicht
              filter={filter}
              ansichtBeimLaden={ansicht}
              jetzt={jetzt.toISOString()}
              ansicht={baueFutterKaufen({ ...daten, filter, jetzt })}
            />
          ) : (
            <OhneStandort farmId={farm.id} />
          )}
        </LadeInhalt>
      </div>
    </div>
  )
}
