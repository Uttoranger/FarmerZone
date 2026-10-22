import { redirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { getUmfeld } from '@/server/queries/umfeld'
import { baueUmfeld, baueUmfeldKarte, standardBereich } from '@/lib/umfeld'
import { leseUmfeldFilter, umfeldLink } from '@/schemas/umfeld-filter'
import { REGION_RAHMEN, RegionKopf } from '@/components/region/region-kopf'
import { RegionFehler } from '@/components/region/region-zustaende'
import { UmfeldAnzeige } from '@/components/analytics/umfeld-anzeige'
import { LadeInhalt } from '@/components/ui/lade-punkt'
import { OhneStandort } from './ohne-standort'

type Suche = Record<string, string | string[] | undefined>

/**
 * Region › Preise vergleichen (das Umfeld, Nachtlauf Nr. 22c; seit Nr. 122 ein
 * eigener Teil der Seite, N23): Bereich und Umkreis aus der Adresse, Liste und
 * Karte aus derselben Eingabe. Ohne eigenen Standort der Zustand beider Reiter.
 */
export async function PreiseReiter({ farm, suche }: { farm: { id: string; name: string }; suche: Suche }): Promise<React.JSX.Element> {
  const filter = leseUmfeldFilter(suche)
  let daten: Awaited<ReturnType<typeof getUmfeld>> | undefined
  try {
    // Immer bis 50 km — Umkreis und Zahl je Stufe rechnet src/lib/umfeld.ts (N23).
    daten = await getUmfeld(farm.id)
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'region', seite: 'preise' }, extra: { farmId: farm.id } })
  }
  if (daten === null) redirect('/login')

  let inhalt: React.JSX.Element
  if (daten === undefined) {
    inhalt = <RegionFehler nochmal={umfeldLink({ km: filter.km, bereich: filter.bereich ?? 'LEBENSMITTEL' })} />
  } else if (!daten.eigenerStandort) {
    inhalt = <OhneStandort farmId={farm.id} />
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
        <RegionKopf reiter="preise" km={filter.km} ansicht={filter.ansicht} ladePunkt />
        <LadeInhalt>{inhalt}</LadeInhalt>
      </div>
    </div>
  )
}
