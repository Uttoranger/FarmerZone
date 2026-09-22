import type { CSSProperties } from 'react'
import { formatGrundpreisZeile } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Die zweite Preiszeile „€ 25,00 / kg" — überall, wo Kundinnen oder der Hof
 * einen Produktpreis sehen. Rendert nichts, wenn es keinen Grundpreis gibt
 * (ohne Gebinde, oder bei Stück und Paket). Keine Hooks, damit sie in Server-
 * wie Client-Komponenten liegt. `style` nur für die Hofseite, die ihre Farben
 * als Inline-Variablen der --app-Palette setzt.
 */
export function GrundpreisZeile({
  price,
  unit,
  unitSize,
  className,
  style,
}: {
  price: number
  unit: string
  unitSize?: number | null
  className?: string
  style?: CSSProperties
}) {
  const text = formatGrundpreisZeile(price, unit, unitSize)
  if (!text) return null
  return (
    <p className={cn('text-xs text-muted-foreground', className)} style={style}>
      {text}
    </p>
  )
}
