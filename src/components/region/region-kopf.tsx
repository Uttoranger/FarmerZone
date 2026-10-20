import Link from 'next/link'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { LadePunkt } from '@/components/ui/lade-punkt'
import type { UmfeldKm } from '@/lib/umfeld'
import { regionReiterLink, type RegionReiter } from '@/schemas/region'

/*
 * Kopf von /region (Nachtlauf Nr. 22c, Mockups web-h5-region-preise und
 * web-h5-region-futter-kaufen): h1 „Region", ein Satz, darunter die Reiter
 * „Preise vergleichen" | „Futter kaufen". Die Reiter sind Links mit eigener
 * Adresse (?reiter=futter), damit Zurück, Neuladen und Teilen im richtigen
 * landen — wie die Reiter von Mein Hof. Der Umkreis geht beim Wechsel mit.
 * Solange der neue Reiter lädt, zeigt er den Ladepunkt (Nr. 122, Register
 * N14): Die alte Ansicht bleibt stehen, statt als Skelett aufzublitzen.
 */

export const REGION_RAHMEN = 'mx-auto w-full max-w-4xl px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10'

const REITER: readonly { id: RegionReiter; label: string }[] = [
  { id: 'preise', label: 'Preise vergleichen' },
  { id: 'futter', label: 'Futter kaufen' },
]

export function RegionKopf({
  reiter,
  km,
  ladePunkt = false,
}: {
  reiter: RegionReiter | null
  km: UmfeldKm
  /** Der Ladepunkt am gewählten Reiter, solange er lädt — braucht einen `LadeRahmen` drumherum (wie `Unterreiter`). */
  ladePunkt?: boolean
}): React.JSX.Element {
  return (
    <header className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[26px]">Region</h1>
        <p className="mt-1 text-[13.5px] leading-normal text-muted-foreground">Rund um deinen Hof – Preise vergleichen und Futter kaufen</p>
      </div>
      <nav aria-label="Region" className="flex gap-6 border-b border-border">
        {REITER.map((r) => {
          const gewaehlt = r.id === reiter
          return (
            <Link
              key={r.id}
              href={regionReiterLink(r.id, km)}
              aria-current={gewaehlt ? 'page' : undefined}
              className={cn(
                'relative -mb-px inline-flex min-h-11 items-center border-b-2 px-0.5 text-[15px] transition-colors duration-[250ms]',
                gewaehlt ? 'border-foreground font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
                FOKUS_RAHMEN
              )}
            >
              {r.label}
              {/* Rechts neben dem Wort, im Abstand zum nächsten Reiter — der Reiter hat kein Polster. */}
              {ladePunkt && <LadePunkt className="-right-3" />}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
