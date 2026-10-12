import Link from 'next/link'
import { MEIN_HOF_HINWEIS, MEIN_HOF_REITER_HOFBEREICH, type MeinHofReiterAlleId } from '@/lib/bauern-navigation'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/*
 * Die Reiter von „Mein Hof" als Links — EIN Baustein für den Kopf von Mein
 * Hof (Hofseite, Beiträge; components/mein-hof/seitenkopf.tsx) und, unter md,
 * für /products (Nachtlauf Nr. 49, Register N3): Produkte · Hofseite ·
 * Beiträge. Die Liste kommt aus MEIN_HOF_REITER_HOFBEREICH; „Produkte" gibt es
 * nur unter md (`nurUnterMd`), ab md steht an seiner Stelle rechts der
 * Hinweis, wo Produkte liegt (Seitenleiste).
 *
 * Reiter links gruppiert wie im Mockup; „Beiträge · N" mit der Zahl aller
 * eigenen Beiträge (zaehleBeitraege), keine Produktzahl.
 */
export function MeinHofReiterLeiste({
  aktiv,
  beitraegeZahl,
  nurUnterMd = false,
  className,
}: {
  aktiv: MeinHofReiterAlleId
  beitraegeZahl: number
  /** Auf /products: die ganze Leiste nur unter md — ab md ist Produkte ein eigener Punkt der Seitenleiste (N3). */
  nurUnterMd?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <nav aria-label="Mein Hof" className={cn('flex items-center gap-7 border-b border-border', nurUnterMd && 'md:hidden', className)}>
      {MEIN_HOF_REITER_HOFBEREICH.map((reiter) => {
        const istAktiv = reiter.id === aktiv
        return (
          <Link
            key={reiter.id}
            href={reiter.href}
            scroll={false}
            aria-current={istAktiv ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex min-h-12 items-center border-b-2 px-0.5 text-[15px] whitespace-nowrap transition-colors duration-[250ms]',
              istAktiv ? 'border-foreground font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
              reiter.nurUnterMd && 'md:hidden',
              FOKUS_RAHMEN,
              'focus-visible:-outline-offset-2'
            )}
          >
            {reiter.label}
            {reiter.id === 'beitraege' && ` · ${beitraegeZahl}`}
          </Link>
        )
      })}
      {!nurUnterMd && <p className="ml-auto hidden text-[13px] text-muted-foreground md:block">{MEIN_HOF_HINWEIS}</p>}
    </nav>
  )
}
