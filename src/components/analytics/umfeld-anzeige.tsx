'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname, useSearchParams } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Segment } from '@/components/ui/segment'
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
  loading: () => <div className="h-[60vh] min-h-[320px] animate-pulse rounded-2xl bg-muted" aria-hidden="true" />,
})

const ANSICHTEN = [
  { wert: 'liste', label: 'Liste' },
  { wert: 'karte', label: 'Karte' },
] as const

/**
 * Der Inhalt des Reiters „Preise vergleichen" auf /region (bis Nr. 22c „In
 * der Nähe" unter /analytics/umfeld; intern: Umfeld): Kopf (Bereich, Umkreis), Umschalter
 * „Liste | Karte" wie auf /hoefe, Hinweise und die gewählte Ansicht.
 *
 * Die Ansicht steht als ?ansicht= in der URL der Umfeld-Seite. Gewechselt wird
 * mit history.replaceState (wie auf /hoefe): kein Server-Rundweg, beide
 * Ansichten haben ihre Daten schon, und „Zurück" von der Hofseite landet in
 * der Ansicht, in der man war. Bereich und Umkreis tragen sie mit.
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

  function waehle(neu: UmfeldAnsichtWahl) {
    const link = umfeldLink({ km, bereich, ansicht: neu })
    window.history.replaceState(null, '', `${pfad}${link.slice(link.indexOf('?'))}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <UmfeldKopf bereich={bereich} km={km} ansicht={wahl} />
      {/* Liste | Karte ist Zustand der Seite (replaceState), kein Filter — deshalb
          der Baustein Segment, nicht FilterChips. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[12.5px] leading-normal text-muted-foreground">
            Luftlinie ab deinem Hof · nur Höfe, die gerade verkaufen · je Hof zählt sein günstigstes Angebot
          </p>
          {ansicht.hinweise.map((hinweis) => (
            <p key={hinweis} className="text-[12.5px] leading-normal text-muted-foreground">
              {hinweis}
            </p>
          ))}
        </div>
        <Segment
          beschriftung="Ansicht wählen"
          optionen={ANSICHTEN}
          wert={wahl}
          onWertChange={(neu) => waehle(neu === 'karte' ? 'karte' : 'liste')}
        />
      </div>
      {ansicht.leer && (
        <EmptyState
          symbol={MapPin}
          titel="Noch keine Höfe zum Vergleichen"
          satz={ansicht.leer}
          aktion={
            ansicht.weiterUmkreis ? (
              <Link href={umfeldLink({ km: ansicht.weiterUmkreis, bereich, ansicht: wahl })} className={KNOPF_RAHMEN}>
                Umkreis auf {ansicht.weiterUmkreis} km
              </Link>
            ) : undefined
          }
        />
      )}
      {wahl === 'karte' ? (
        <UmfeldKarteAnsicht karte={karte} eigenerName={eigenerName} />
      ) : (
        !ansicht.leer && <UmfeldListe zeilen={ansicht.zeilen} />
      )}
    </div>
  )
}
