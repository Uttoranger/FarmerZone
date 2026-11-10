'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname, useSearchParams } from 'next/navigation'
import { EmptyState } from '@/components/ui/empty-state'
import { AnsichtChips } from '@/components/region/ansicht-chips'
import { REGION_KARTE_HOEHE, REGION_KARTE_MARKE, REGION_KARTEN_SPALTE, REGION_SPALTEN } from '@/components/region/region-spalten'
import { useRegionAnsicht } from '@/components/region/use-region-ansicht'
import { cn } from '@/lib/utils'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { UmfeldKopf } from '@/components/analytics/umfeld-kopf'
import { UmfeldListe } from '@/components/analytics/umfeld-liste'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import type { UmfeldAnsicht, UmfeldKarte, UmfeldKm } from '@/lib/umfeld'
import { leseUmfeldAnsicht, umfeldLink, type UmfeldAnsichtWahl } from '@/schemas/umfeld-filter'

// Erst beim Umschalten auf „Karte" geladen — mit ihr kommt Leaflet. Wer nur
// die Liste liest, lädt weder die Bibliothek noch eine Kachel.
const UmfeldKarteAnsicht = dynamic(() => import('@/components/analytics/umfeld-karte'), {
  ssr: false,
  loading: () => <div className={cn(REGION_KARTE_HOEHE, 'animate-pulse rounded-[12px] bg-muted')} aria-hidden="true" />,
})

/**
 * Der Inhalt des Reiters „Preise vergleichen" auf /region (bis Nr. 22c „In
 * der Nähe" unter /analytics/umfeld; intern: Umfeld): Kopf (Bereich, Umkreis), Umschalter
 * „Liste | Karte" wie auf /hoefe, Hinweise und die gewählte Ansicht.
 *
 * Die Ansicht steht als ?ansicht= in der URL der Umfeld-Seite. Gewechselt wird
 * mit history.replaceState (wie auf /hoefe): kein Server-Rundweg, beide
 * Ansichten haben ihre Daten schon, und „Zurück" von der Hofseite landet in
 * der Ansicht, in der man war. Bereich und Umkreis tragen sie mit.
 *
 * Seit Nr. 272 (Board w1-region Bild 1): ab 1024 px Liste und Karte
 * nebeneinander ohne „Liste / Karte“; am Handy in der Kartenansicht nur
 * Umkreis und „Liste / Karte“ über der Karte (region-spalten.ts).
 */
export function UmfeldAnzeige({
  bereich,
  km,
  eigenerName,
  ansicht,
  karte,
}: {
  bereich: AnzeigeBereich
  km: UmfeldKm
  eigenerName: string
  ansicht: UmfeldAnsicht
  karte: UmfeldKarte
}) {
  const pfad = usePathname()
  const wahl = leseUmfeldAnsicht(useSearchParams().get('ansicht'))
  const { zeigeKarte, zeigeListe, nurUmkreis } = useRegionAnsicht(wahl)

  function waehle(neu: UmfeldAnsichtWahl) {
    const link = umfeldLink({ km, bereich, ansicht: neu })
    window.history.replaceState(null, '', `${pfad}${link.slice(link.indexOf('?'))}`)
  }

  return (
    <div className="flex flex-col gap-4" {...(nurUmkreis ? REGION_KARTE_MARKE : {})}>
      <UmfeldKopf bereich={bereich} km={km} ansicht={wahl} nurUmkreis={nurUmkreis} />
      {/* „Liste / Karte“ in eigener Zeile unter dem Umkreis (Liste Lauf 32 region); ab 1024 px stehen beide da. */}
      <AnsichtChips wert={wahl} onWahl={waehle} className="lg:hidden" />
      <div className={REGION_SPALTEN}>
        {zeigeListe && (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[13px] leading-normal text-muted-foreground">
                Luftlinie ab deinem Hof · nur Höfe, die gerade verkaufen · je Hof zählt sein günstigstes Angebot.
              </p>
              {ansicht.hinweise.map((hinweis) => (
                <p key={hinweis} className="text-[13px] leading-normal text-muted-foreground">
                  {hinweis}
                </p>
              ))}
            </div>
            {ansicht.leer ? (
              <EmptyState
                titel="Noch keine Höfe zum Vergleichen"
                satz={ansicht.leer}
                ausweg={
                  ansicht.weiterUmkreis ? (
                    <Link href={umfeldLink({ km: ansicht.weiterUmkreis, bereich, ansicht: wahl })} className={KNOPF_RAHMEN}>
                      Umkreis auf {ansicht.weiterUmkreis} km
                    </Link>
                  ) : (
                    { ohne: 'Den Knopf „Umkreis auf … km“ gibt es nur, solange ein größerer Umkreis bleibt; beim größten bleibt kein Ausweg' }
                  )
                }
              />
            ) : (
              <UmfeldListe zeilen={ansicht.zeilen} />
            )}
          </div>
        )}
        {zeigeKarte && (
          <div className={REGION_KARTEN_SPALTE}>
            <UmfeldKarteAnsicht karte={karte} eigenerName={eigenerName} />
          </div>
        )}
      </div>
    </div>
  )
}
