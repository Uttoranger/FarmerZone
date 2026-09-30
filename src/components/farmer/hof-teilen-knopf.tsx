'use client'

import { Share2 } from 'lucide-react'
import { teileHof } from '@/components/shared/hof-teilen'

/**
 * „Hof teilen" im Kopf von Mein Hof — derselbe Weg wie auf der Hofseite der
 * Kunden (components/shared/hof-teilen.ts): Teilen-Menü des Geräts, sonst
 * kopieren; wer das Menü schließt, bekommt nichts kopiert.
 */
export function HofTeilenKnopf({
  name,
  slug,
  className,
  label = 'Hof teilen',
}: {
  name: string
  slug: string
  className?: string
  /** Die kompakte Zeile ab lg sagt nur „Teilen" — der Hof steht daneben. */
  label?: string
}): React.JSX.Element {
  return (
    <button type="button" onClick={() => void teileHof({ name, slug })} className={className}>
      <Share2 className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
      {label}
    </button>
  )
}
