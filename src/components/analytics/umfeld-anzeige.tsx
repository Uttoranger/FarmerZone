'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Segment } from '@/components/ui/segment'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { ErklaerKnopf } from '@/components/region/erklaer-knopf'
import { UmfeldKopf } from '@/components/analytics/umfeld-kopf'
import { UmfeldListe } from '@/components/analytics/umfeld-liste'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import { UMFELD_TEXT, type UmfeldAnsicht, type UmfeldKarte, type UmfeldKm } from '@/lib/umfeld'
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
 * der Nähe" unter /analytics/umfeld; intern: Umfeld): Kopf (Bereich, Umkreis
 * mit Zahl je Stufe), ein Satz mit „So rechnen wir" hinter dem (i) (Board v3
 * §4, N23), Umschalter „Liste | Karte" wie auf /hoefe, Hinweise und die
 * gewählte Ansicht. Solange ein neuer Bereich lädt, trägt der Inhalt
 * `aria-busy` (der Ladepunkt steht im Kopf).
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
  const router = useRouter()
  const wahl = leseUmfeldAnsicht(useSearchParams().get('ansicht'))
  const [laedt, starte] = useTransition()
  const [zielBereich, setZielBereich] = useState<AnzeigeBereich | null>(null)

  function wechsleBereich(link: string, neu: AnzeigeBereich) {
    setZielBereich(neu)
    // In einer Transition bleibt die alte Ansicht stehen, bis die neue da ist — wie bei den Links (Register N14).
    starte(() => router.push(link))
  }

  function waehle(neu: UmfeldAnsichtWahl) {
    const link = umfeldLink({ km, bereich, ansicht: neu })
    window.history.replaceState(null, '', `${pfad}${link.slice(link.indexOf('?'))}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <UmfeldKopf
        bereich={bereich}
        km={km}
        ansicht={wahl}
        zahlen={ansicht.zahlen}
        bereichLaedt={laedt ? zielBereich : null}
        onBereich={wechsleBereich}
      />
      {/* Liste | Karte ist Zustand der Seite (replaceState), kein Filter — deshalb
          der Baustein Segment, nicht FilterChips. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* div statt p: Der Dialog hinter dem (i) darf keine Blockelemente in einen Absatz stellen. */}
          <div className="flex items-center gap-1.5 text-[13px] leading-normal text-muted-foreground">
            <p>{UMFELD_TEXT.hinweis}</p>
            <ErklaerKnopf titel={UMFELD_TEXT.soRechnenWirTitel} punkte={UMFELD_TEXT.soRechnenWir} />
          </div>
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
      )}
      <div aria-busy={laedt ? 'true' : undefined}>
        {wahl === 'karte' ? (
          <UmfeldKarteAnsicht karte={karte} eigenerName={eigenerName} />
        ) : (
          !ansicht.leer && <UmfeldListe zeilen={ansicht.zeilen} />
        )}
      </div>
    </div>
  )
}
