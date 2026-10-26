'use client'

import type { MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { tippAufRueckweg, type KundenSeite } from '@/lib/kunden-kopf'
import { eigenerVorgaengerJetzt, merkeHinauf } from '@/components/shared/rueckweg-merker'

/*
 * Der alte Kopf der Kundenseiten (KundenKopf) und sein Menü-Blatt sind seit
 * Nr. 181 entfernt: Als letzte Seite zog /datenschutz in die KundeShell
 * (src/components/shells/kunde-shell.tsx). Geblieben ist der Klick eines
 * Rückwegs, den die Hofseite und die Produktseite für ihre eigene
 * Zurück-Zeile benutzen.
 */

/**
 * Der Klick eines Rückwegs (Entscheidung: tippAufRueckweg): ein Schritt im
 * Verlauf zurück — mit Scrollposition und Filtern —, oder der Link folgt und
 * steigt damit hinauf; das merkt sich der RueckwegMerker, damit „Zurück" dort
 * nicht wieder hinunterführt. Neuer Tab und neues Fenster tut der Link selbst.
 */
export function useRueckwegKlick(seite: KundenSeite, form: 'knopf' | 'zeile'): (e: MouseEvent<HTMLAnchorElement>) => void {
  const router = useRouter()
  return function beimTipp(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const tipp = tippAufRueckweg(seite, eigenerVorgaengerJetzt(), form)
    if (tipp.aktion === 'verlauf') {
      e.preventDefault()
      router.back()
      return
    }
    merkeHinauf(tipp.ziel)
  }
}
