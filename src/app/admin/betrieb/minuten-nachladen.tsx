'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Jede Minute — so oft läuft auch der Worker der Warteschlange (vercel.json). */
export const NACHLADEN_MS = 60_000

/**
 * „Stand 09:42 · jede Minute neu“ (Admin › Betrieb › E-Mails, Nr. 161): holt
 * die Seite jede Minute neu (router.refresh, nur bei sichtbarer Seite) —
 * dieselbe Regel wie der offene Faden im Postfach (FadenGelesenTeam). Die
 * Suche bleibt in der Adresse und damit stehen.
 */
export function MinutenNachladen(): null {
  const router = useRouter()
  useEffect(() => {
    const takt = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, NACHLADEN_MS)
    return () => clearInterval(takt)
  }, [router])
  return null
}
