'use client'

import { useMemo, useSyncExternalStore } from 'react'
import {
  WARENKORB_EREIGNIS,
  WARENKORB_SCHLUESSEL,
  leseWarenkorb,
  warenkorbImKopf,
} from '@/lib/warenkorb-speicher'

function abonniere(melde: () => void): () => void {
  // Andere Tabs melden sich über das storage-Ereignis, der eigene Tab über
  // WARENKORB_EREIGNIS (storage feuert nie im Tab, der geschrieben hat).
  const beiSpeicher = (e: StorageEvent) => {
    if (e.key === null || e.key === WARENKORB_SCHLUESSEL) melde()
  }
  window.addEventListener('storage', beiSpeicher)
  window.addEventListener(WARENKORB_EREIGNIS, melde)
  return () => {
    window.removeEventListener('storage', beiSpeicher)
    window.removeEventListener(WARENKORB_EREIGNIS, melde)
  }
}

function stand(): string | null {
  try {
    return localStorage.getItem(WARENKORB_SCHLUESSEL)
  } catch {
    // Kein Zugriff auf den Speicher (gesperrte Website-Daten): kein Korb.
    return null
  }
}

/**
 * Das Warenkorb-Symbol der Kopfzeile: Anzahl und Weg zum Hof, oder null.
 * Der Rohtext aus dem Speicher ist der Stand — eine Zeichenkette bleibt
 * zwischen zwei Abfragen gleich, solange sich nichts ändert. Beim
 * Server-Rendern gibt es keinen Korb.
 */
export function useWarenkorbKopf(): { anzahl: number; href: string } | null {
  const roh = useSyncExternalStore(abonniere, stand, () => null)
  return useMemo(() => warenkorbImKopf(leseWarenkorb(roh)), [roh])
}
