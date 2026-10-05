'use client'

import Link from 'next/link'
import { ChevronDown, Plus } from 'lucide-react'
import type { PublicProduct } from '@/server/queries/farm'
import { formatGrundpreis } from '@/lib/format'
import { zeigeKaufknopf } from '@/lib/bereiche-anzeige'
import { bestaetigtAmText, type Angabe } from '@/lib/produktdetail'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/*
 * Teile der Produktseite (Nachtlauf Nr. 11): das Akkordeon „Kennzeichnung"
 * und „Gleich mit abholen". Sie zeigen nur an — was drinsteht, entscheiden
 * produktAngaben und gleichMitAbholen in src/lib/produktdetail.ts.
 */

/**
 * „Kennzeichnung", zugeklappt (Konzept Bereiche §6.3): Die Angaben müssen vor
 * dem Kauf einsehbar sein, nicht im Weg. <details> statt des Base-UI-Akkordeons
 * wie die Fragen der Startseite (Nr. 07): ohne Skript, die Angaben stehen auch
 * zugeklappt im HTML, Tastatur und Bildschirmleser bedienen <summary> wie
 * einen Knopf.
 */
export function Kennzeichnung({ zeilen, bestaetigtAm }: { zeilen: readonly Angabe[]; bestaetigtAm: string | null }): React.JSX.Element {
  return (
    <details className="group rounded-2xl border border-border bg-card px-4 md:px-5">
      <summary
        className={cn(
          // list-none + Marker weg: Der Pfeil rechts ersetzt das Dreieck des Browsers.
          'flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-md py-3 text-[15px] font-semibold text-foreground transition-colors hover:text-brand-text [&::-webkit-details-marker]:hidden',
          FOKUS_RAHMEN
        )}
      >
        Kennzeichnung
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          strokeWidth={1.7}
          aria-hidden="true"
        />
      </summary>
      <dl className="flex flex-col gap-2.5 pb-4 text-sm">
        {zeilen.map((z) => (
          <div key={z.titel}>
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{z.titel}</dt>
            <dd className="break-words whitespace-pre-line text-foreground">{z.wert}</dd>
          </div>
        ))}
      </dl>
      {bestaetigtAm && (
        <p className="pb-4 text-xs text-muted-foreground">
          Vom Hof bestätigt am {bestaetigtAmText(bestaetigtAm)}. Charge und Mindesthaltbarkeit stehen auf dem Sackanhänger.
        </p>
      )}
    </details>
  )
}

/**
 * „Gleich mit abholen – eine Bestellung, eine Gebühr" (Mockup
 * web-k2-futter-groesse-waehlen): andere Produkte desselben Hofs. Der Name
 * führt zur jeweiligen Produktseite; „+ In den Korb" legt eins über den
 * bestehenden Korb dazu. Gehört ein Produkt zu einer Familie, heißt der Knopf
 * „Größe wählen ›" und führt zur Seite (DESIGN_SYSTEM, „Verkaufsgrößen").
 */
export function GleichMitAbholen({
  produkte,
  link,
  mitFamilie,
  imKorb,
  wirdHinzugefuegt,
  onInDenKorb,
}: {
  produkte: readonly PublicProduct[]
  link: (id: string) => string
  /** Ob das Produkt zu einer Familie mit mehreren Größen gehört (produktFamilie). */
  mitFamilie: (p: PublicProduct) => boolean
  imKorb: (id: string) => number
  wirdHinzugefuegt: string | null
  onInDenKorb: (p: PublicProduct) => void
}): React.JSX.Element | null {
  if (produkte.length === 0) return null
  return (
    <section aria-labelledby="gleich-mit-abholen" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <h2 id="gleich-mit-abholen" className="font-heading text-[19px] font-semibold text-foreground">
          Gleich mit abholen
        </h2>
        <p className="text-[12.5px] text-muted-foreground">Eine Bestellung, eine Gebühr</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {produkte.map((p) => {
          const kaufbar = zeigeKaufknopf(p, false)
          const alles = imKorb(p.id) >= p.stock
          return (
            <li key={p.id}>
              <article className="flex h-full flex-col gap-2 rounded-[14px] border border-border bg-card p-3.5">
                <Link
                  href={link(p.id)}
                  title={p.name}
                  className={cn('line-clamp-2 rounded-md text-[13.5px] font-semibold break-words text-foreground underline-offset-4 hover:underline', FOKUS_RAHMEN)}
                >
                  {p.name}
                </Link>
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{formatGrundpreis(p.price, p.unit, p.unitSize)}</span>
                  <span className="flex-1" />
                  {mitFamilie(p) ? (
                    <Link
                      href={link(p.id)}
                      className={cn('inline-flex min-h-11 items-center rounded-full px-1 text-[12.5px] font-semibold text-brand-text underline-offset-4 hover:underline', FOKUS_RAHMEN)}
                    >
                      Größe wählen <span aria-hidden="true">&nbsp;›</span>
                    </Link>
                  ) : kaufbar ? (
                    <button
                      type="button"
                      onClick={() => onInDenKorb(p)}
                      disabled={wirdHinzugefuegt === p.id || alles}
                      aria-label={`${p.name} in den Korb legen`}
                      className={cn(
                        "relative inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-[12.5px] font-semibold text-accent-foreground transition-opacity duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:opacity-90 disabled:opacity-60",
                        FOKUS_RAHMEN
                      )}
                    >
                      <Plus className="size-4" strokeWidth={1.7} aria-hidden="true" />
                      {alles ? 'Im Korb' : 'In den Korb'}
                    </button>
                  ) : (
                    <span className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">Ausverkauft</span>
                  )}
                </div>
              </article>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
