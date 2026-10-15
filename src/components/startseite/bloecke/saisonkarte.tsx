import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { LINK_TEXT_STANDARD, type StartseitenBlockDaten } from '@/lib/startseite-gestalten'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Kicker } from '@/components/startseite/kicker'
import { BLOCK_ABSTAND, BLOCK_CONTAINER, blockTitelId } from './stil'

/**
 * Vorlage „Saisonkarte mit Bild" (Mockup mobil-k0-startseite-saisonblock):
 * Karte mit grüner Tönung, rechts oben „Saison", links das Bild (quadratisch,
 * Zweck 'startseite'), daneben Überzeile, Titel und Text, unten der Link über
 * die ganze Breite. Das Bild ist ein Foto — es folgt dem Modus nicht
 * (CODING_STANDARDS §7).
 */
export function Saisonkarte({ block }: { block: StartseitenBlockDaten }): React.JSX.Element {
  const titelId = blockTitelId(block.id)
  return (
    <section aria-labelledby={titelId} className={BLOCK_ABSTAND}>
      <div className={BLOCK_CONTAINER}>
        <div className="relative overflow-hidden rounded-[18px] border border-accent/45 bg-linear-135 from-accent/14 to-card to-70% md:rounded-3xl">
          <span aria-hidden="true" className="absolute top-3 right-3 text-[11px] font-semibold tracking-[1px] text-status-fertig uppercase md:top-4 md:right-5">
            Saison
          </span>
          <div className="flex items-center gap-3.5 p-4 pr-16 md:gap-6 md:p-6 md:pr-24">
            {block.bildUrl && (
              <span className="relative size-[84px] shrink-0 overflow-hidden rounded-2xl bg-muted md:size-[120px]">
                <Image src={block.bildUrl} alt="" fill sizes="(min-width: 768px) 120px, 84px" className="object-cover" />
              </span>
            )}
            <div className="min-w-0">
              {block.ueberzeile && <Kicker className="text-[11px] tracking-[1px] md:text-[12.5px]">{block.ueberzeile}</Kicker>}
              <h2 id={titelId} className="mt-0.5 font-heading text-xl leading-tight font-semibold text-balance break-words md:text-[26px]">
                {block.titel}
              </h2>
              {block.text && <p className="mt-1.5 text-[13px] leading-normal text-muted-foreground md:text-[15px]">{block.text}</p>}
            </div>
          </div>
          {block.linkUrl && (
            <Link
              href={block.linkUrl}
              className={cn(
                'flex min-h-11 items-center justify-between gap-3 border-t border-accent/30 px-4 py-3 text-sm font-semibold text-status-fertig transition-colors duration-[250ms] hover:bg-accent/10 md:px-6',
                FOKUS_RAHMEN
              )}
            >
              <span className="min-w-0 break-words">{block.linkText ?? LINK_TEXT_STANDARD}</span>
              <ArrowRight className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
