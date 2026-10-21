import Link from 'next/link'
import { MEIN_HOF_REITER_HOFBEREICH, type MeinHofReiterAlleId } from '@/lib/bauern-navigation'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { LadePunkt } from '@/components/ui/lade-punkt'
import { cn } from '@/lib/utils'

/*
 * Die Reiter von „Mein Hof" als Links — EIN Baustein für den Kopf von Mein
 * Hof (Hofseite, Beiträge; components/mein-hof/seitenkopf.tsx) und, unter md,
 * für /products (Nachtlauf Nr. 49, Register N3): Produkte · Hofseite ·
 * Beiträge. Die Liste kommt aus MEIN_HOF_REITER_HOFBEREICH; „Produkte" gibt es
 * nur unter md (`nurUnterMd`), ab md ist es ein eigener Punkt der Seitenleiste.
 * Den Hinweis, wo Produkte liegen, trägt seit Nr. 73 (Register N7) der Editor
 * am Ende seiner Liste (components/farmer/hofseite-editor.tsx), nicht die Leiste.
 *
 * Reiter links gruppiert wie im Mockup; „Beiträge · N" mit der Zahl aller
 * eigenen Beiträge (zaehleBeitraege), keine Produktzahl.
 *
 * Ladepunkt statt Skelett (Nr. 127): Ein Wechsel des Reiters lässt den Inhalt
 * stehen; der gewählte Reiter zeigt einen kleinen Punkt, und der Inhalt trägt
 * `aria-busy` (MeinHofAnsicht → LadeRahmen/LadeInhalt).
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
              'relative -mb-px inline-flex min-h-12 items-center border-b-2 px-0.5 text-[15px] whitespace-nowrap transition-colors duration-[250ms]',
              istAktiv ? 'border-foreground font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
              reiter.nurUnterMd && 'md:hidden',
              FOKUS_RAHMEN,
              'focus-visible:-outline-offset-2'
            )}
          >
            {reiter.label}
            {reiter.id === 'beitraege' && ` · ${beitraegeZahl}`}
            {/* Der Punkt sitzt neben dem Wort, nicht darauf: zwischen den Reitern ist Platz (gap-7). */}
            <LadePunkt className="-right-2.5" />
          </Link>
        )
      })}
    </nav>
  )
}
