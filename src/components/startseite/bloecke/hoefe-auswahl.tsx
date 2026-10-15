import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { LINK_TEXT_STANDARD, type StartseitenBlockDaten } from '@/lib/startseite-gestalten'
import type { StartseitenHof } from '@/lib/startseite'
import { Kicker } from '@/components/startseite/kicker'
import { HofKarten } from '@/components/startseite/hoefe-in-der-naehe'
import { BLOCK_ABSTAND, BLOCK_CONTAINER, BLOCK_KNOPF_UMRISS, blockTitelId } from './stil'

/**
 * Vorlage „Höfe-Auswahl": bis zu drei Höfe mit der Hofkarte der Startseite
 * (HofKarten aus „Höfe in deiner Nähe" — dieselbe Karte, kein Nachbau).
 * `hoefe` sind die gewählten Höfe, die noch öffentlich sichtbar sind; ist
 * keiner mehr übrig (gesperrt, archiviert), zeigt der Block nichts — eine
 * Überschrift über einer leeren Reihe hilft niemandem.
 */
export function HoefeAuswahl({
  block,
  hoefe,
}: {
  block: StartseitenBlockDaten
  hoefe: readonly StartseitenHof[]
}): React.JSX.Element | null {
  if (hoefe.length === 0) return null
  const titelId = blockTitelId(block.id)
  return (
    <section aria-labelledby={titelId} className={BLOCK_ABSTAND}>
      <div className={`${BLOCK_CONTAINER} flex flex-col gap-[18px] md:gap-[22px]`}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0">
            {block.ueberzeile && <Kicker>{block.ueberzeile}</Kicker>}
            <h2 id={titelId} className="font-heading text-[22px] font-semibold text-balance break-words md:text-[28px]">
              {block.titel}
            </h2>
            {block.text && <p className="mt-1 text-[13.5px] leading-normal text-muted-foreground md:text-[15px]">{block.text}</p>}
          </div>
          {block.linkUrl && (
            <>
              <span className="flex-1" />
              <Link href={block.linkUrl} className={BLOCK_KNOPF_UMRISS}>
                {block.linkText ?? LINK_TEXT_STANDARD}
                <ChevronRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
              </Link>
            </>
          )}
        </div>
        <HofKarten hoefe={hoefe} />
      </div>
    </section>
  )
}
