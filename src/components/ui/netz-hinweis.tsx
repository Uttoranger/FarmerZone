'use client'

import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'
import { NETZ_ZEILE } from '@/lib/netz'

/*
 * Die Netz-Zeile unter dem Kopf der Shells (Register N29; Board
 * system-sterne-kein-netz, Punkt 1): Geht dem Browser das Netz verloren,
 * steht hier „Keine Verbindung – du siehst den letzten Stand.", bis es
 * zurück ist. Gehört nicht zum Kopf selbst: KundeShell, KundeFokusShell und
 * HofShell binden sie nur ein.
 *
 * Gelesen wird `navigator.onLine` über die Ereignisse `online`/`offline` —
 * auf dem Server und bei der Hydration gilt „online" (keine Zeile), sonst
 * wichen Server und Browser voneinander ab. Die Zeile ist ein Hinweis, kein
 * Beweis: Ob ein Aufruf wirklich scheitert, sagt erst mitNetzSchutz
 * (src/lib/netz.ts).
 */

function abonniere(melde: () => void): () => void {
  window.addEventListener('online', melde)
  window.addEventListener('offline', melde)
  return () => {
    window.removeEventListener('online', melde)
    window.removeEventListener('offline', melde)
  }
}

function imBrowserOnline(): boolean {
  return navigator.onLine
}

function aufDemServerOnline(): boolean {
  return true
}

/**
 * Die Zeile selbst — ohne Ereignisse, damit sie sich ohne DOM prüfen lässt.
 * Der Rahmen mit `role="status"` steht immer da, leer solange online: Ein
 * Vorleseprogramm sagt nur an, was sich in einer schon vorhandenen
 * Live-Region ändert.
 */
export function NetzZeile({ online }: { online: boolean }): React.JSX.Element {
  return (
    <div role="status" data-netz-hinweis="" className="print:hidden">
      {!online && (
        <p className="flex min-h-10 items-center gap-2.5 bg-zustand-tun-grund px-4 py-2 text-[13px] font-medium text-zustand-tun">
          <WifiOff className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span>{NETZ_ZEILE}</span>
        </p>
      )}
    </div>
  )
}

export function NetzHinweis(): React.JSX.Element {
  const online = useSyncExternalStore(abonniere, imBrowserOnline, aufDemServerOnline)
  return <NetzZeile online={online} />
}
