import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/** Der Rückweg allein — für „Mein Auftritt", dessen Formular seine h1 selbst trägt. */
export function ZurueckZuEinstellungen(): React.JSX.Element {
  return (
    <Link
      href="/settings"
      className={cn(
        '-ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors duration-[250ms] hover:text-foreground',
        FOKUS_RAHMEN
      )}
    >
      <ChevronLeft className="size-4" strokeWidth={1.7} aria-hidden="true" />
      Einstellungen
    </Link>
  )
}

/**
 * Kopf einer Einstellungs-Unterseite (Nachtlauf Nr. 22d): Rückweg
 * „‹ Einstellungen" (44 px), Titel als h1 in Fraunces, ein Satz darunter,
 * rechts optional eine Nebenaktion. Eine Quelle für alle sieben Unterseiten,
 * damit keine ihren Kopf nachbaut.
 */
export function EinstellungenKopf({
  titel,
  satz,
  aktion,
}: {
  titel: string
  satz?: ReactNode
  aktion?: ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-5 md:mb-6">
      <ZurueckZuEinstellungen />
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[26px]">{titel}</h1>
          {satz && <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{satz}</p>}
        </div>
        {aktion}
      </div>
    </div>
  )
}
