'use client'

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, X } from 'lucide-react'
import type { AbholFenster, VorschauProdukt } from '@/lib/hofuebersicht'
import { hofseitenLink, istBestellbar } from '@/lib/bereiche-anzeige'
import { hofIllustrationen } from '@/lib/hoefe-anzeige'
import type { AnzeigeBereich, ProductCategoryValue } from '@/lib/taxonomie'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Abholzeile } from '@/components/hoefe/abholzeile'
import { HofBildflaeche } from '@/components/hoefe/hof-bildflaeche'
import { HofKopf } from '@/components/hoefe/hof-kopf'
import { HoefeProduktzeilen } from '@/components/hoefe/hoefe-produktzeilen'

/*
 * Die kurze Hofkarte am Pin (Register N22, N23): auf /hoefe die Vorschau am
 * Computer (`art: 'tooltip'`), in Region die Karte, die beim Antippen bzw.
 * mit Enter am Pin als Bereich mit „Schließen" aufgeht (`art: 'region'`).
 */

/** Was die kurze Hofkarte vom Hof braucht — ein Ausschnitt aus HofUebersichtEintrag samt Entfernung. */
export type KurzkartenHof = {
  slug: string
  name: string
  postalCode: string
  city: string
  isPaused: boolean
  kategorien: ProductCategoryValue[]
  abholfenster?: readonly AbholFenster[]
  angebot: readonly unknown[]
  fotos: string[]
  entfernungKm: number | null
}

/** Breite der Vorschau in Pixeln — die Karte rechnet damit ihre Lage am Pin. */
export const KURZKARTE_BREITE = 288

type Gemeinsam = {
  hof: KurzkartenHof
  bereich: AnzeigeBereich
  id: string
}

/** Der Inhalt unter dem Kopf: frei als `children` — oder die Kurzform von /hoefe (Abholzeile, zwei Produktzeilen). */
type TooltipInhalt =
  | { children: ReactNode }
  | {
      /** Die Schaufenster-Auswahl (waehleVorschauImBereich, zwei Zeilen). */
      schaufenster: { produkte: VorschauProdukt[] }
      /** Der Zeitpunkt des Servers beim Bauen der Seite (ISO-Text) — für die Abholzeile. */
      jetzt: string
    }

export type HofKurzkarteProps =
  | (Gemeinsam & { art?: 'tooltip' } & TooltipInhalt)
  | (Gemeinsam & {
      art: 'region'
      /** Der Inhalt unter dem Kopf (in Region: Produktzeilen bzw. Angebote, 123 und 124). */
      children: ReactNode
      /** „Schließen" und Escape — der Aufrufer nimmt die Karte weg. */
      onSchliessen: () => void
      /**
       * Der Pin, auf den der Fokus beim Schließen zurückgeht. Als Funktion, weil die
       * Karte von /hoefe ihre Pins nach einer Auswahl neu zeichnet; ohne sie das
       * Element, das beim Öffnen den Fokus hatte.
       */
      findePin?: () => HTMLElement | null
    })

/** Was /hoefe unter den Kopf stellt: die Abholzeile und zwei Produktzeilen mit 40er-Bildern. */
export function KurzkartenInhalt({
  hof,
  schaufenster,
  jetzt,
}: {
  hof: KurzkartenHof
  schaufenster: { produkte: VorschauProdukt[] }
  jetzt: string
}): React.JSX.Element {
  return (
    <>
      <Abholzeile fenster={hof.abholfenster} isPaused={hof.isPaused} bestellbar={istBestellbar(hof)} jetzt={jetzt} />
      <HoefeProduktzeilen produkte={schaufenster.produkte} weitere={0} bildKante={40} />
    </>
  )
}

/** „Zum Hof ›" — in beiden Arten derselbe Link; nur in der Vorschau nicht im Tab-Weg. */
function ZumHof({ hof, bereich, imTabWeg }: { hof: KurzkartenHof; bereich: AnzeigeBereich; imTabWeg: boolean }): React.JSX.Element {
  return (
    <Link
      href={hofseitenLink(hof.slug, bereich)}
      tabIndex={imTabWeg ? undefined : -1}
      className={cn(
        'mt-1 inline-flex min-h-11 items-center gap-0.5 self-start rounded-lg text-[13.5px] font-semibold text-status-fertig hover:underline',
        FOKUS_RAHMEN
      )}
    >
      Zum Hof
      <ChevronRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
    </Link>
  )
}

/**
 * Die kurze Hofkarte am Pin als Rahmen: Bild bzw. Bildfläche, `HofKopf`, der
 * Inhalt des Aufrufers und „Zum Hof ›" (Board system-k1-entdecken-v2 „Pins
 * und Vorschau", Board system-h5-region-v2 „Karte am Pin").
 *
 *  - `tooltip` (/hoefe, am Computer): Bildfläche oder erstes Foto oben (104 px),
 *    288 px breit. Sie erscheint beim Darüberfahren und bei Tab-Fokus am Pin
 *    (hoefe-karte.tsx steuert Öffnen und Schließen), der Pin verweist mit
 *    aria-describedby auf sie. „Zum Hof" ist für den Zeiger da und nicht im
 *    Tab-Weg — mit der Tastatur wählt Enter am Pin den Hof.
 *  - `region` (Region, Freigabe §1 Abweichung 7): ein Bereich „Hof <Name>" mit
 *    „Schließen" (44 px) und Escape; „Zum Hof" liegt im Tab-Weg. Beim Öffnen
 *    geht der Fokus auf die Karte, beim Schließen zurück auf den Pin. Das Bild
 *    steht klein im Kopf (40 px, wie im Board), die Breite gibt der Aufrufer vor.
 */
export function HofKurzkarte(props: HofKurzkarteProps): React.JSX.Element {
  if (props.art === 'region') return <KurzkarteBereich {...props} />
  const { hof, bereich, id } = props
  const foto = hof.fotos[0] ?? null
  return (
    <div
      id={id}
      role="tooltip"
      style={{ width: KURZKARTE_BREITE }}
      className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-lg"
    >
      {foto ? (
        <span className={cn('relative block h-[104px] w-full', hof.isPaused && 'opacity-60 grayscale')}>
          <Image src={foto} alt="" fill sizes={`${KURZKARTE_BREITE}px`} className="object-cover" />
        </span>
      ) : (
        <HofBildflaeche bilder={hofIllustrationen(hof.kategorien)} sizes="104px" gedaempft={hof.isPaused} className="h-[104px] w-full" />
      )}
      <div className="flex flex-col gap-1 p-3.5">
        <HofKopf hof={hof} als="p" />
        {'children' in props ? props.children : <KurzkartenInhalt hof={hof} schaufenster={props.schaufenster} jetzt={props.jetzt} />}
        <ZumHof hof={hof} bereich={bereich} imTabWeg={false} />
      </div>
    </div>
  )
}

function KurzkarteBereich({
  hof,
  bereich,
  id,
  children,
  onSchliessen,
  findePin,
}: Extract<HofKurzkarteProps, { art: 'region' }>): React.JSX.Element {
  const karte = useRef<HTMLDivElement>(null)
  const geoeffnetVon = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // Wer die Karte geöffnet hat (Enter bzw. Antippen am Pin), hatte gerade den Fokus.
    const aktiv = document.activeElement
    geoeffnetVon.current = aktiv instanceof HTMLElement ? aktiv : null
    karte.current?.focus({ preventScroll: true })
  }, [])

  function schliessen(): void {
    const pin = findePin?.() ?? geoeffnetVon.current
    onSchliessen()
    // Nur ein Pin, der noch im Dokument steht — ein neu gezeichneter liefert findePin.
    if (pin?.isConnected) pin.focus({ preventScroll: true })
  }

  function beiTaste(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key !== 'Escape') return
    // Die Karte von /hoefe hört auf Escape am Dokument — hier schließt nur die Karte am Pin.
    e.preventDefault()
    e.stopPropagation()
    schliessen()
  }

  return (
    <div
      ref={karte}
      id={id}
      role="region"
      aria-label={`Hof ${hof.name}`}
      tabIndex={-1}
      onKeyDown={beiTaste}
      className={cn('w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-lg dark:ring-1 dark:ring-border', FOKUS_RAHMEN)}
    >
      <div className="flex flex-col gap-1 p-3.5">
        <div className="flex items-start gap-1">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <HofKopf
              hof={hof}
              als="p"
              gedaempft={hof.isPaused}
              bild={{ foto: hof.fotos[0] ?? null, illustration: hofIllustrationen(hof.kategorien)[0], kante: 40 }}
            />
          </div>
          <button
            type="button"
            onClick={schliessen}
            className={cn(
              '-mt-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-[250ms] hover:text-foreground',
              FOKUS_RAHMEN
            )}
          >
            <X className="size-4" strokeWidth={1.8} aria-hidden="true" />
            <span className="sr-only">Schließen</span>
          </button>
        </div>
        {children}
        <ZumHof hof={hof} bereich={bereich} imTabWeg />
      </div>
    </div>
  )
}
