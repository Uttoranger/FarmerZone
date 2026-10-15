import Image from 'next/image'
import Link from 'next/link'
import type { StartseitenBlockDaten } from '@/lib/startseite-gestalten'
import { hoefeAdresse } from '@/lib/startseite'
import { KATEGORIE_LABEL } from '@/lib/taxonomie'
import { cn } from '@/lib/utils'
import { Kicker } from '@/components/startseite/kicker'
import { BLOCK_ABSTAND, BLOCK_CONTAINER, BLOCK_KNOPF_GRUEN, blockTitelId } from './stil'

/**
 * Vorlage „Kategorie-Hinweis": eine Kategorie mit ihrer Illustration und dem
 * Weg auf Entdecken (/hoefe mit der Kategorie), im Aufbau des
 * Brennmaterial-Bands. Die Illustration hat einen hellen Crème-Grund und ist
 * kein Foto — nachts gedämpft und gerahmt (CODING_STANDARDS §7). `bild` gibt
 * die Seite mit (categoryImagePath am Server, illustrationPfad im Admin).
 */
export function KategorieHinweis({
  block,
  bild,
}: {
  block: StartseitenBlockDaten
  bild: string | null
}): React.JSX.Element | null {
  if (!block.kategorie) return null
  const titelId = blockTitelId(block.id)
  const label = KATEGORIE_LABEL[block.kategorie]
  return (
    <section aria-labelledby={titelId} className={BLOCK_ABSTAND}>
      <div className={BLOCK_CONTAINER}>
        <div className="flex flex-col gap-4 rounded-[22px] border border-border bg-card p-4 md:flex-row md:items-center md:gap-7 md:px-[26px] md:py-[22px]">
          <div className="flex items-center gap-3 md:contents">
            <span className="relative block size-[70px] shrink-0 overflow-hidden rounded-[14px] bg-muted dark:ring-1 dark:ring-border md:size-[110px]">
              {bild && <Image src={bild} alt="" fill sizes="110px" className="object-cover dark:brightness-[0.78] dark:saturate-[0.9]" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Kicker>{block.ueberzeile ?? label}</Kicker>
              <h2 id={titelId} className="font-heading text-lg font-semibold text-balance break-words md:text-2xl">
                {block.titel}
              </h2>
              {block.text && <p className="text-sm leading-normal text-muted-foreground">{block.text}</p>}
            </div>
          </div>
          <Link
            href={block.linkUrl ?? hoefeAdresse({ kategorien: [block.kategorie] })}
            className={cn(BLOCK_KNOPF_GRUEN, 'w-full shrink-0 rounded-[14px] md:w-auto md:rounded-full')}
          >
            {block.linkText ?? `${label} entdecken`}
          </Link>
        </div>
      </div>
    </section>
  )
}
