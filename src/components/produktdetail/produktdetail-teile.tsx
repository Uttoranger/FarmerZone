'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePreisAnzeige } from '@/components/shared/preis-anzeige'
import { endpreisEuro } from '@/lib/plattformgebuehr'
import { PREISE_INKL_PLATTFORMGEBUEHR } from '@/lib/konditionen'
import { Plus } from 'lucide-react'
import type { PublicProduct } from '@/server/queries/farm'
import { formatGrundpreis } from '@/lib/format'
import { zeigeKaufknopf } from '@/lib/bereiche-anzeige'
import { bestaetigtAmText, type Angabe } from '@/lib/produktdetail'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { AusverkauftMarke } from '@/components/ui/marke'
import { GrundpreisZeile } from '@/components/shared/grundpreis-zeile'
import { FOTO_HUELLE, ILLUSTRATION_BILD, ILLUSTRATION_HUELLE } from '@/components/hofseite/produkt-karte'

/*
 * Teile der Produktseite (Nachtlauf Nr. 11, Aufbau seit Nr. 235): „Kennzeichnung"
 * und „Gleich mit abholen". Sie zeigen nur an — was drinsteht, entscheiden
 * produktAngaben und gleichMitAbholen in src/lib/produktdetail.ts.
 */

/**
 * „Kennzeichnung" als offene Karte mit zwei Spalten (Board w1-/s1-produkt Bild 2, seit Nr. 235;
 * vorher zugeklappt): Die Angaben müssen vor dem Kauf einsehbar sein — das Board zeigt sie
 * ohne Klick. Links die Bezeichnung leise, rechts der Wert.
 */
export function Kennzeichnung({ zeilen, bestaetigtAm }: { zeilen: readonly Angabe[]; bestaetigtAm: string | null }): React.JSX.Element | null {
  if (zeilen.length === 0) return null
  return (
    <section aria-labelledby="kennzeichnung-titel" className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-3.5 py-3">
      <h2 id="kennzeichnung-titel" className="text-[16px] font-bold text-foreground">
        Kennzeichnung
      </h2>
      {/* Zwei Spalten in jeder Breite (Board s1-produkt Bild 2): am Handy höchstens 8,5 rem für die Bezeichnung,
          ein langes Wort bricht dort um, statt den Wert zu verdrängen. */}
      <dl className="grid grid-cols-[fit-content(8.5rem)_minmax(0,1fr)] gap-x-3 gap-y-1 text-[14px] sm:grid-cols-[auto_minmax(0,1fr)]">
        {zeilen.map((z) => (
          <div key={z.titel} className="contents">
            <dt className="break-words hyphens-auto text-muted-foreground">{z.titel}</dt>
            <dd className="break-words whitespace-pre-line text-foreground">{z.wert}</dd>
          </div>
        ))}
      </dl>
      {bestaetigtAm && (
        <p className="text-[13px] text-muted-foreground">
          Vom Hof bestätigt am {bestaetigtAmText(bestaetigtAm)}. Charge und Mindesthaltbarkeit stehen auf dem Sackanhänger.
        </p>
      )}
    </section>
  )
}

/**
 * „Gleich mit abholen" (Board w1-/s1-produkt Bild 2): andere Produkte desselben Hofs als
 * Zeilen in einer Karte — Bild, Name, Preis, Grundpreis und rundes „+“ mit grünem Rand —,
 * darunter leise der Satz zur Gebühr. Der Name führt zur jeweiligen Produktseite; „+“ legt
 * eins über den bestehenden Korb dazu. Gehört ein Produkt zu einer Familie, steht statt
 * „+“ „Größe wählen ›" und führt zur Seite (DESIGN_SYSTEM, „Verkaufsgrößen").
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
  const anzeige = usePreisAnzeige()
  if (produkte.length === 0) return null
  return (
    <section aria-labelledby="gleich-mit-abholen" className="flex flex-col gap-2">
      <h2 id="gleich-mit-abholen" className="mt-1 text-[13px] font-bold tracking-[0.04em] text-muted-foreground uppercase">
        Gleich mit abholen
      </h2>
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {produkte.map((p) => {
          // Ohne Sperre: Mit Kaufsperre ist die Liste leer (gleichMitAbholen, N24), hier zählt nur der Vorrat.
          const kaufbar = zeigeKaufknopf(p, null)
          const alles = imKorb(p.id) >= p.stock
          const preis = endpreisEuro(p.price, anzeige)
          const bild = p.imageUrl ?? p.categoryImageUrl
          return (
            <li key={p.id} className="flex items-center gap-3 px-2.5 py-2">
              <Link href={link(p.id)} title={p.name} className={cn('flex min-w-0 flex-1 items-center gap-3 rounded-xl', FOKUS_RAHMEN)}>
                <span className={cn('relative size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted', bild && !p.imageUrl ? ILLUSTRATION_HUELLE : FOTO_HUELLE)}>
                  {bild && (
                    <Image
                      src={bild}
                      alt=""
                      fill
                      sizes="56px"
                      className={p.imageUrl ? 'object-cover' : cn('object-contain p-1', ILLUSTRATION_BILD)}
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="line-clamp-2 text-[15px] font-bold break-words text-foreground">{p.name}</span>
                  <span className="text-[15px] text-foreground tabular-nums">{formatGrundpreis(preis, p.unit, p.unitSize)}</span>
                  <GrundpreisZeile price={preis} unit={p.unit} unitSize={p.unitSize} className="text-[13px] text-muted-foreground tabular-nums" />
                </span>
              </Link>
              {mitFamilie(p) ? (
                <Link
                  href={link(p.id)}
                  className={cn('inline-flex min-h-11 shrink-0 items-center rounded-xl border border-input bg-card px-3 text-[14px] font-bold text-foreground hover:bg-muted', FOKUS_RAHMEN)}
                >
                  Größe wählen <span aria-hidden="true">&nbsp;›</span>
                </Link>
              ) : kaufbar ? (
                <button
                  type="button"
                  onClick={() => onInDenKorb(p)}
                  disabled={wirdHinzugefuegt === p.id || alles}
                  aria-label={alles ? `${p.name}: alles liegt im Warenkorb` : `${p.name} in den Korb legen`}
                  className={cn(
                    'inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-accent bg-card text-brand-text transition-colors duration-[250ms] hover:bg-accent/12 disabled:cursor-not-allowed disabled:opacity-60',
                    FOKUS_RAHMEN
                  )}
                >
                  <Plus className="size-5" strokeWidth={1.7} aria-hidden="true" />
                </button>
              ) : (
                <AusverkauftMarke className="shrink-0" />
              )}
            </li>
          )
        })}
      </ul>
      {/* Im Hofpreis-Modell (N38) steckt die Gebühr je Stück im Preis — „eine Gebühr“ stimmte dann nicht. */}
      <p className="text-[13px] text-muted-foreground">{anzeige ? PREISE_INKL_PLATTFORMGEBUEHR : 'Eine Bestellung, eine Gebühr'}</p>
    </section>
  )
}
