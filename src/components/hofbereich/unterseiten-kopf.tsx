'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, ChevronLeft } from 'lucide-react'
import { RUECKWEG_PRAEFIX, elternseite, type Elternseite } from '@/lib/bauern-navigation'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { LEISTE_HANDY, ZEILE_BROWSER } from '@/components/hofbereich/unterseiten-kopf-stil'
import { cn } from '@/lib/utils'

/** Das Ziel samt Filter der Elternseite (z. B. /orders?filter=heute). */
function zielMitSuche(eltern: Elternseite, suche: string | undefined): string {
  if (!suche) return eltern.href
  const teil = suche.replace(/^\?/, '')
  return eltern.href + (eltern.href.includes('?') ? '&' : '?') + teil
}

/**
 * Kopf einer Unterseite im Hofbereich (Nachtlauf Nr. 44, Register N1).
 *
 * Am Handy eine feste Leiste oben (56 px) mit Pfeil und dem Namen der
 * Elternseite — die ganze Fläche ein Link (≥ 44 px), für den Screenreader
 * „Zurück zu …". Vorher stand der Rückweg klein über dem Titel und war nach
 * dem Scrollen weg. Im Browser bleibt die bisherige Zeile „‹ …". Darunter
 * der Titel als h1 — fehlt `titel`, trägt die Seite ihre h1 selbst (etwa der
 * Assistent „Neuer Beitrag" je Schritt).
 *
 * Wohin es zurückgeht und wie die Elternseite heißt, entscheidet
 * `elternseite` (lib/bauern-navigation.ts) aus dem Pfad — dieselbe Quelle wie
 * Leiste und Mehr-Blatt. Auf einer Seite ohne Rückweg (Seiten der Leiste)
 * bleibt nur der Titel. Ersetzt EinstellungenKopf, ZurueckZuEinstellungen
 * und ZurueckLink.
 */
export function UnterseitenKopf({
  titel,
  satz,
  aktion,
  suche,
  zeileImBrowser = true,
  listeDaneben = false,
  pfad,
}: {
  /** Der Seitentitel (h1). */
  titel?: ReactNode
  /** Ein Satz unter dem Titel. */
  satz?: ReactNode
  /** Rechts neben dem Titel, z. B. „Plakat drucken" oder Anrufen. */
  aktion?: ReactNode
  /** Filter der Elternseite, der erhalten bleibt (z. B. `?filter=heute`). */
  suche?: string
  /** false: im Browser keine Zeile, weil dort ein anderer Weg zurück sichtbar ist (Meldung abgeben: „Abbrechen"). */
  zeileImBrowser?: boolean
  /** Ab 1024 px steht die Elternseite als Liste daneben (Bestellungen) — dort entfallen Rückweg und Titel. */
  listeDaneben?: boolean
  /** Nur für die Vorschau unter /intern: der Pfad, dessen Elternseite gezeigt wird. Echte Seiten lassen ihn weg. */
  pfad?: string
}): React.JSX.Element {
  const aktuellerPfad = usePathname()
  const eltern = elternseite(pfad ?? aktuellerPfad)
  const ziel = eltern ? zielMitSuche(eltern, suche) : null

  return (
    <>
      {eltern && ziel && (
        <div className={LEISTE_HANDY}>
          <Link
            href={ziel}
            className={cn(
              'flex min-h-11 max-w-full min-w-0 items-center gap-2 rounded-xl pr-3 pl-2 text-[15px] font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted',
              FOKUS_RAHMEN
            )}
          >
            <ArrowLeft className="size-5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <span className="sr-only">{`${RUECKWEG_PRAEFIX} `}</span>
            <span className="truncate">{eltern.name}</span>
          </Link>
        </div>
      )}

      {eltern && ziel && zeileImBrowser && (
        <div className={cn(ZEILE_BROWSER, titel ? 'md:mb-1' : 'md:mb-2', listeDaneben && 'lg:hidden')}>
          <Link
            href={ziel}
            className={cn(
              '-ml-1.5 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-3 pl-1 text-sm font-medium text-muted-foreground transition-colors duration-[250ms] hover:text-foreground',
              FOKUS_RAHMEN
            )}
          >
            <ChevronLeft className="size-5" strokeWidth={1.7} aria-hidden="true" />
            <span className="sr-only">{`${RUECKWEG_PRAEFIX} `}</span>
            {eltern.name}
          </Link>
        </div>
      )}

      {titel && (
        <div className={cn('mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-6', listeDaneben && 'lg:hidden')}>
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold break-words text-foreground md:text-[26px]">{titel}</h1>
            {satz && <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{satz}</p>}
          </div>
          {aktion}
        </div>
      )}
    </>
  )
}
