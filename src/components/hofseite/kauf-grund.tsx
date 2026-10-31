'use client'

import type { ComponentProps } from 'react'
import { KaufSperreHinweis } from '@/components/hofseite/kauf-sperre-hinweis'
import { BestellstoppHinweis } from '@/components/notbremse-band'
import type { Bestellstopp } from '@/lib/notbremse'

/**
 * Der Grund an der Stelle von „Zur Kasse“ — EINE Quelle für das Korb-Blatt
 * (farm/cart-sheet.tsx) und den Mini-Warenkorb der Seitenspalte (Nr. 205,
 * Morgenbericht 26). Eine Sperre des Hofs geht vor (sie bleibt nach dem
 * Freigeben der Notbremse bestehen), dann die Notbremse; sonst `null` — dort
 * steht „Zur Kasse“. `kurz` nur für den Mini-Warenkorb, der neben der vollen
 * Karte der Sperre steht; die Notbremse hat nur eine Fassung.
 */
export function KaufGrund({
  stopp,
  ...sperre
}: ComponentProps<typeof KaufSperreHinweis> & { stopp: Bestellstopp | null }): React.JSX.Element | null {
  if (sperre.sperre !== null) return <KaufSperreHinweis {...sperre} />
  if (stopp !== null) return <BestellstoppHinweis stopp={stopp} />
  return null
}
