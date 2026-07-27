import Link from 'next/link'
import { PowerOff } from 'lucide-react'
import { FARM_ARCHIVED_OWNER_BANNER } from '@/lib/farm-archive'

/**
 * Balken über jeder Farmer-Seite, solange der Hof stillgelegt ist. Bewusst
 * nicht schließbar — anders als der Shop-Link-Banner ist das kein Tipp,
 * sondern der Zustand des Hofs. Der Bauer sieht weiterhin alle seine Daten.
 */
export function ArchivedFarmBanner() {
  return (
    <div className="mx-4 mt-3 print:hidden">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <PowerOff className="size-4 shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
          <p className="text-sm font-medium text-amber-900">{FARM_ARCHIVED_OWNER_BANNER}</p>
        </div>
        <Link
          href="/settings/account"
          className="shrink-0 self-start sm:self-auto rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-900 transition-colors"
        >
          Hof reaktivieren
        </Link>
      </div>
    </div>
  )
}
