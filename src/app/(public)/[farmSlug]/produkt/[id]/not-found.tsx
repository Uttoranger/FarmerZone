import Link from 'next/link'
import type { Metadata } from 'next'
import { PackageSearch } from 'lucide-react'
import {
  HOEFE_ENTDECKEN,
  PRODUKT_NICHT_GEFUNDEN_TEXT,
  PRODUKT_NICHT_GEFUNDEN_TITEL,
  ZUR_STARTSEITE,
} from '@/lib/fehlerseite'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { EmptyState } from '@/components/ui/empty-state'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'

export const metadata: Metadata = {
  title: 'Produkt nicht gefunden — FarmerZone',
  robots: { index: false, follow: false },
}

/**
 * Die 404 unter /[hof]/produkt/[id] (Nr. 11). Hier landen ein falscher Slug,
 * ein Hof, der nicht öffentlich ist, ein fremdes, ausgeblendetes oder
 * unbekanntes Produkt — die Seite unterscheidet sie nicht, und dieser Text
 * nennt deshalb keinen Grund. Ohne den Slug (eine not-found-Datei bekommt
 * keine Parameter) führt der Ausweg zu den Höfen, nicht zu einem Hof, den es
 * vielleicht nicht gibt. Neues Design wie die Produktseite.
 */
export default function ProduktNichtGefunden() {
  return (
    <KundeShellMitSitzung>
      <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 pt-10 pb-16 md:pt-16">
        <h1 className="sr-only">{PRODUKT_NICHT_GEFUNDEN_TITEL}</h1>
        <EmptyState
          symbol={PackageSearch}
          titel={PRODUKT_NICHT_GEFUNDEN_TITEL}
          satz={PRODUKT_NICHT_GEFUNDEN_TEXT}
          aktion={
            <>
              <Link
                href="/hoefe"
                className={cn('inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground hover:opacity-90', FOKUS_RAHMEN)}
              >
                {HOEFE_ENTDECKEN}
              </Link>
              <Link
                href="/"
                className={cn('inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium text-foreground hover:bg-muted', FOKUS_RAHMEN)}
              >
                {ZUR_STARTSEITE}
              </Link>
            </>
          }
        />
      </div>
    </KundeShellMitSitzung>
  )
}
