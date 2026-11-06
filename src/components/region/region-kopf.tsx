import Link from 'next/link'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { LadePunkt } from '@/components/ui/lade-punkt'
import type { UmfeldKm } from '@/lib/umfeld'
import { HofUnterzeile } from '@/components/mein-hof/hof-unterzeile'
import type { AbholungWahl } from '@/schemas/hoefe-filter'
import { regionReiterLink, type FutterAnsichtWahl, type RegionReiter } from '@/schemas/region'

/*
 * Kopf von /region (Nachtlauf Nr. 22c, Mockups web-h5-region-preise und
 * web-h5-region-futter-kaufen): h1 „Region", ein Satz, darunter die Reiter
 * „Preise vergleichen" | „Futter kaufen". Die Reiter sind Links mit eigener
 * Adresse (?reiter=futter), damit Zurück, Neuladen und Teilen im richtigen
 * landen — wie die Reiter von Mein Hof. Beim Wechsel gehen der Umkreis, die
 * Ansicht (Liste | Karte) und für „Futter kaufen" die Abholung mit (Nr. 133,
 * Rest aus 123): Wer in der Karte steht, bleibt in der Karte.
 * Solange der neue Reiter lädt, zeigt er den Ladepunkt (Nr. 122, Register
 * N14): Die alte Ansicht bleibt stehen, statt als Skelett aufzublitzen.
 */

/** Der Satz unter der Überschrift, wörtlich wie im Board s1-/w1-region (mit Punkt). */
export const REGION_SATZ = 'Rund um deinen Hof – Preise vergleichen und Futter kaufen.'

export const REGION_RAHMEN = 'w-full max-w-4xl px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10'

const REITER: readonly { id: RegionReiter; label: string }[] = [
  { id: 'preise', label: 'Preise vergleichen' },
  { id: 'futter', label: 'Futter kaufen' },
]

export function RegionKopf({
  reiter,
  km,
  ansicht = 'liste',
  abholung = null,
  ladePunkt = false,
  hofName,
  jetzt,
}: {
  reiter: RegionReiter | null
  km: UmfeldKm
  /** Die Ansicht der gerade offenen Seite — sie geht mit zum anderen Reiter. */
  ansicht?: FutterAnsichtWahl
  /** Der Abholungs-Filter von „Futter kaufen"; „Preise vergleichen" kennt ihn nicht (der Link lässt ihn weg). */
  abholung?: AbholungWahl | null
  /** Der Ladepunkt am gewählten Reiter, solange er lädt — braucht einen `LadeRahmen` drumherum (wie `Unterreiter`). */
  ladePunkt?: boolean
  /** Für die Zeile „<Hof> · Stand …“ unter der Überschrift (Board s1-/w1-region). */
  hofName: string
  jetzt: Date
}): React.JSX.Element {
  return (
    <header className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[26px]">Region</h1>
        <HofUnterzeile hofName={hofName} jetzt={jetzt} />
        <p className="mt-2.5 text-[13.5px] leading-normal text-muted-foreground md:text-sm">{REGION_SATZ}</p>
      </div>
      {/* Zwei gleich breite Reiter über die volle Breite, der gewählte grün unterstrichen (Board s1-/w1-region). */}
      <nav aria-label="Region" className="flex border-b border-border">
        {REITER.map((r) => {
          const gewaehlt = r.id === reiter
          return (
            <Link
              key={r.id}
              href={regionReiterLink(r.id, km, { ansicht, abholung })}
              aria-current={gewaehlt ? 'page' : undefined}
              className={cn(
                'relative -mb-px inline-flex min-h-12 flex-1 items-center justify-center border-b-2 px-0.5 text-[15px] transition-colors duration-[250ms]',
                gewaehlt ? 'border-status-fertig font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
                FOKUS_RAHMEN
              )}
            >
              {/* Der Ladepunkt rechts neben dem Wort, nicht am Rand des breiten Reiters. */}
              <span className="relative">
                {r.label}
                {ladePunkt && <LadePunkt className="-right-3" />}
              </span>
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
