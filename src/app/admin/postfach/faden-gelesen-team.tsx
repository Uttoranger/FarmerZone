'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { markiereGelesenTeam } from '@/server/actions/postfach'
import { NACHLADEN_MS } from '@/lib/postfach'

/**
 * Der offene Faden im Admin (Register N12): Öffnen setzt den Lesestand des
 * Teams bis zur neuesten Antwort des Hofs (nach dem Rendern, über die Action
 * mit Admin-Prüfung), und der Faden lädt alle 60 s nach (router.refresh, nur
 * bei sichtbarer Seite) — dieselbe Regel wie beim Hof (FadenNachladen).
 */
export function FadenGelesenTeam({
  unterhaltungId,
  nachrichtId,
  ungelesen,
}: {
  unterhaltungId: string
  nachrichtId: string | null
  ungelesen: boolean
}): null {
  const router = useRouter()

  useEffect(() => {
    if (!ungelesen || nachrichtId === null) return
    // Ein Fehler lässt die Antwort ungelesen stehen — der nächste Aufruf versucht es wieder.
    void markiereGelesenTeam({ unterhaltungId, nachrichtId })
  }, [unterhaltungId, nachrichtId, ungelesen])

  useEffect(() => {
    const takt = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, NACHLADEN_MS)
    return () => clearInterval(takt)
  }, [router])

  return null
}
