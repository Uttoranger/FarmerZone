'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname, useSearchParams } from 'next/navigation'
import { List, Map as MapIcon } from 'lucide-react'
import { UmfeldKopf } from '@/components/analytics/umfeld-kopf'
import { UmfeldListe } from '@/components/analytics/umfeld-liste'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import type { UmfeldAnsicht, UmfeldKarte, UmfeldKm } from '@/lib/umfeld'
import { cn } from '@/lib/utils'
import { leseUmfeldAnsicht, umfeldLink, type UmfeldAnsichtWahl } from '@/schemas/umfeld-filter'

// Erst beim Umschalten auf „Karte" geladen — mit ihr kommt Leaflet. Wer nur
// die Liste liest, lädt weder die Bibliothek noch eine Kachel.
const UmfeldKarteAnsicht = dynamic(() => import('@/components/analytics/umfeld-karte'), {
  ssr: false,
  loading: () => <div className="h-[60vh] min-h-[320px] animate-pulse rounded-2xl bg-muted" aria-hidden="true" />,
})

/**
 * Der Inhalt des Reiters „Umfeld": Kopf (Bereich, Umkreis), Umschalter
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

  const knopf = (wert: UmfeldAnsichtWahl, beschriftung: string, Icon: typeof List) => (
    <button
      type="button"
      onClick={() => waehle(wert)}
      aria-pressed={wahl === wert}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        wahl === wert ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {beschriftung}
    </button>
  )

  return (
    <>
      <UmfeldKopf bereich={bereich} km={km} ansicht={wahl} />
      <div className="mb-3 flex items-end justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Luftlinie ab deinem Hof. Nur Höfe, die gerade verkaufen — je Hof zählt sein günstigstes Angebot.
        </p>
        <div className="inline-flex shrink-0 rounded-xl bg-muted p-1" role="group" aria-label="Ansicht wählen">
          {knopf('liste', 'Liste', List)}
          {knopf('karte', 'Karte', MapIcon)}
        </div>
      </div>
      {ansicht.hinweise.map((hinweis) => (
        <p key={hinweis} className="mb-3 text-xs text-muted-foreground">
          {hinweis}
        </p>
      ))}
      {ansicht.leer && (
        <div className="mb-4 rounded-xl border border-border bg-card p-5 dark:ring-1 dark:ring-border">
          <p className="text-sm text-foreground">{ansicht.leer}</p>
          {ansicht.weiterUmkreis && (
            <Link
              href={umfeldLink({ km: ansicht.weiterUmkreis, bereich, ansicht: wahl })}
              className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-text underline-offset-4 hover:underline"
            >
              Umkreis auf {ansicht.weiterUmkreis} km
            </Link>
          )}
        </div>
      )}
      {wahl === 'karte' ? (
        <UmfeldKarteAnsicht karte={karte} eigenerName={eigenerName} />
      ) : (
        !ansicht.leer && <UmfeldListe zeilen={ansicht.zeilen} />
      )}
    </>
  )
}
