import type { Metadata } from 'next'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { BausteineVorschau } from './bausteine-vorschau'

export const metadata: Metadata = {
  title: 'Bausteine',
  robots: { index: false, follow: false },
}

/** Die Filter-Chips der Vorschau sind echte Links — diese Werte kennt die Seite. */
const KATEGORIEN = ['alle', 'eier', 'gemuese', 'futter'] as const
type Kategorie = (typeof KATEGORIEN)[number]

function alsKategorie(wert: string | string[] | undefined): Kategorie {
  return KATEGORIEN.find((k) => k === wert) ?? 'alle'
}

/**
 * Vorschau aller Bausteine aus Gate 2 (docs/umsetzungsprompt.md): jeder
 * Baustein mit seinen Zuständen, im Geltungsbereich data-design="neu". Das
 * Theme schaltet der Knopf oben; abgenommen wird bei 390, 1024 und 1440 px
 * in beiden Themes. Nur für den Betreiber, nie indexiert.
 */
export default async function BausteinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.JSX.Element> {
  await verlangeAdminSeite()
  const { kategorie } = await searchParams
  return <BausteineVorschau kategorie={alsKategorie(kategorie)} />
}
