'use client'

import { Analytics } from '@vercel/analytics/next'
import { filtereAnalyticsEreignis } from '@/lib/analytics-filter'

/**
 * Vercel Web Analytics mit Filter. Eigene Client-Komponente, weil `beforeSend`
 * eine Funktion ist und das Root-Layout (Server) keine Funktion an eine
 * Client-Komponente übergeben darf.
 */
export function AnalyticsGefiltert(): React.JSX.Element {
  return <Analytics beforeSend={filtereAnalyticsEreignis} />
}
