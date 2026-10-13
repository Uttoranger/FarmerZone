'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { markiereGelesen } from '@/server/actions/postfach'
import { NACHLADEN_MS } from '@/lib/postfach'

/**
 * Was ein offener Faden im Hintergrund tut (Register N12): Öffnen setzt den
 * Lesestand bis zur neuesten Nachricht vom Team — erst nach dem Rendern, über
 * die Action (farmId in ihrer WHERE-Klausel), damit die Zähler in Leiste und
 * Heute mitgehen. Und er lädt alle 60 s nach (router.refresh, kein
 * Polling-Endpunkt), nur bei sichtbarer Seite; Neues vom Team liest er dann
 * genauso. Die Zeitschaltung speichert nichts und behauptet nichts — sie holt
 * nur die Seite neu (Ausnahme in der Quelltext-Wache, tests/whatsapp-versand.test.ts).
 */
export function FadenNachladen({
  unterhaltungId,
  nachrichtId,
  ungelesen,
}: {
  unterhaltungId: string
  /** Die neueste Nachricht vom Team; null, wenn es keine gibt. */
  nachrichtId: string | null
  ungelesen: boolean
}): null {
  const router = useRouter()

  useEffect(() => {
    if (!ungelesen || nachrichtId === null) return
    // Ein Fehler lässt die Nachricht ungelesen stehen — der nächste Aufruf versucht es wieder.
    void markiereGelesen({ unterhaltungId, nachrichtId })
  }, [unterhaltungId, nachrichtId, ungelesen])

  useEffect(() => {
    const takt = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, NACHLADEN_MS)
    return () => clearInterval(takt)
  }, [router])

  return null
}
