'use client'

import { useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { NEUIGKEITEN_TEXT, sichtbareNeuigkeiten, type Neuigkeit } from '@/lib/startseite-gestalten'
import { BEITRAG_ANLASS } from '@/lib/beitrag-anlass'
import { vorWieLange } from '@/lib/hofseite-kunde'
import { beitragLink } from '@/lib/teilen-fenster'
import { bildStil } from '@/lib/bild-ausschnitt'
import { hofIllustrationen } from '@/lib/hoefe-anzeige'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { StatusBadge } from '@/components/ui/status-badge'
import { HofBildflaeche } from '@/components/hoefe/hof-bildflaeche'
import { useUhr } from '@/components/hoefe/use-uhr'

/*
 * „Neu bei den Höfen“ (Register N16, Ergänzung Nr. 129; Board
 * system-k2-beitraege-v2, Abschnitt 4) — ein zusätzlicher Abschnitt der
 * Startseite, den Admin in Admin › Startseite hinzufügt. Eine Reihe Karten:
 * Foto bzw. Illustration, Anlass, Titel (zwei Zeilen), „Hofname · vor 2
 * Stunden“, je ein Link auf den Beitrag der Hofseite (`?beitrag=`). Am Handy
 * waagrecht wischbar, ab md zusätzlich „Zurück“/„Weiter“ (44 px). Kein Lauf von
 * selbst, keine Rangliste: die Reihenfolge der Zeit.
 *
 * Die Liste ist bis zu fünf Minuten alt (Datencache und ISR): „vor …“ und das
 * Ausblenden abgelaufener Beiträge rechnet der Browser mit seiner Uhr
 * (useUhr, wie die Abholzeile). Leer rendert der Abschnitt nichts.
 */

const KARTE_BREITE = 290
const ABSTAND = 24

export function NeuBeiDenHoefen({ neuigkeiten, jetzt }: { neuigkeiten: readonly Neuigkeit[]; jetzt: string }): React.JSX.Element | null {
  const reihe = useRef<HTMLUListElement>(null)
  const uhr = useUhr(jetzt)
  const sichtbar = sichtbareNeuigkeiten(neuigkeiten, uhr)
  if (sichtbar.length === 0) return null
  const jetztIso = uhr.toISOString()

  function blaettere(richtung: -1 | 1) {
    const leiste = reihe.current
    if (!leiste) return
    const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    leiste.scrollBy({ left: richtung * (KARTE_BREITE + ABSTAND), behavior: ruhig ? 'auto' : 'smooth' })
  }

  const knopf = cn(
    'inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-[250ms] hover:bg-muted',
    FOKUS_RAHMEN
  )

  return (
    <section aria-labelledby="neu-bei-den-hoefen-titel" className="pb-[52px] md:pb-[72px]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 md:px-6">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h2 id="neu-bei-den-hoefen-titel" className="font-heading text-[22px] font-semibold md:text-[24px]">
            {NEUIGKEITEN_TEXT.titel}
          </h2>
          <p className="text-[13.5px] text-muted-foreground">{NEUIGKEITEN_TEXT.satz}</p>
          <span className="hidden flex-1 md:block" />
          <span className="hidden gap-2 md:flex">
            <button type="button" aria-label={NEUIGKEITEN_TEXT.zurueck} className={knopf} onClick={() => blaettere(-1)}>
              <ChevronLeft className="size-5" strokeWidth={1.8} aria-hidden="true" />
            </button>
            <button type="button" aria-label={NEUIGKEITEN_TEXT.weiter} className={knopf} onClick={() => blaettere(1)}>
              <ChevronRight className="size-5" strokeWidth={1.8} aria-hidden="true" />
            </button>
          </span>
        </div>
        <ul ref={reihe} className="-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:gap-6 md:px-0">
          {sichtbar.map((n) => {
            const anlass = BEITRAG_ANLASS[n.anlass]
            return (
              <li key={n.id} className="w-[260px] shrink-0 snap-start md:w-[290px]">
                <Link href={beitragLink(`/${n.hof.slug}`, n.id)} className={cn('group flex flex-col gap-2 rounded-[14px]', FOKUS_RAHMEN)}>
                  {n.foto ? (
                    <span className="relative block h-[150px] overflow-hidden rounded-[14px] bg-muted md:h-[170px]">
                      <Image src={n.foto} alt="" fill sizes="290px" className="object-cover" style={bildStil(n.fotoAusschnitt)} />
                    </span>
                  ) : (
                    <HofBildflaeche bilder={hofIllustrationen(n.hof.kategorien)} sizes="150px" className="h-[150px] rounded-[14px] md:h-[170px]" />
                  )}
                  <span className="flex">
                    <StatusBadge status="fertig" symbol={anlass.symbol}>
                      {anlass.wort}
                    </StatusBadge>
                  </span>
                  <span className="line-clamp-2 font-heading text-[17px] leading-tight font-semibold break-words text-foreground group-hover:underline">
                    {n.titel}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {n.hof.name} · {vorWieLange(n.veroeffentlicht, jetztIso)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
