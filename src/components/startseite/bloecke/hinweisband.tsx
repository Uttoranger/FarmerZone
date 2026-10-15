import Link from 'next/link'
import { Info } from 'lucide-react'
import { LINK_TEXT_STANDARD, type StartseitenBlockDaten } from '@/lib/startseite-gestalten'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { BLOCK_ABSTAND, BLOCK_CONTAINER, BLOCK_KNOPF_UMRISS } from './stil'

/**
 * Vorlage „Hinweisband": ein Satz über die ganze Breite (z. B. Winterpause) —
 * die Hinweiskarte des Design-Systems in Grün, der Link als Umriss-Knopf.
 * Ein Satz, keine Überschrift: Er gliedert die Seite nicht.
 */
export function Hinweisband({ block }: { block: StartseitenBlockDaten }): React.JSX.Element {
  return (
    <section aria-label="Hinweis" className={BLOCK_ABSTAND}>
      <div className={BLOCK_CONTAINER}>
        <Hinweiskarte
          ton="gruen"
          symbol={Info}
          titel={block.titel}
          className="text-[14px] md:px-6 md:py-4 md:text-[15px]"
          aktion={
            block.linkUrl ? (
              <Link href={block.linkUrl} className={BLOCK_KNOPF_UMRISS}>
                {block.linkText ?? LINK_TEXT_STANDARD}
              </Link>
            ) : undefined
          }
        />
      </div>
    </section>
  )
}
