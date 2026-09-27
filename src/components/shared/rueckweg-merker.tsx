'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { eigenerVorgaenger, merkeVorgaenger, ordneWechsel } from '@/lib/kunden-kopf'
import { hinaufEintraegeSchema } from '@/schemas/rueckweg'

/**
 * Merkt sich je Dokument, welche eigene Seite vor der aktuellen steht — für
 * den Zurück-Knopf der Kundenseiten (kunden-kopf.tsx). Die Regeln stehen rein
 * in src/lib/kunden-kopf.ts (ordneWechsel, merkeVorgaenger, eigenerVorgaenger);
 * hier wird nur beobachtet.
 *
 * Warum nicht einfacher: `document.referrer` bleibt nach Seitenwechseln in
 * der App auf dem Stand des ersten Ladens stehen, `history.length` zählt auch
 * fremde Seiten (so führte der alte ZurueckLink zurück zu Google), und eigene
 * Werte in `history.state` überschreibt Next. Bleibt: die Navigation API, wo
 * es sie gibt, und sonst selbst mitzählen. Der Merker lebt im Modul, also
 * genau so lange wie das Dokument — ein geteilter Link, ein neuer Tab und
 * Neuladen fangen bei „keine eigene Seite davor" an.
 *
 * Sitzt im Root-Layout, damit auch der Weg von der Startseite zählt.
 */
let vorgaengerMerker: string | null = null
/** Wohin ein Tipp gerade über den Ersatz-Link hinaufsteigt — bis der Wechsel da ist. */
let hinaufZiel: string | null = null

type NavigationStand = { schluessel: string | null; vorherigerPfad: string | null }

/** Die Navigation API, soweit wir sie brauchen — oder undefined, wo der Browser sie nicht hat. */
function navigationStand(): NavigationStand | undefined {
  const navigation = (
    window as Window & {
      navigation?: {
        currentEntry?: { key?: unknown; index?: unknown } | null
        entries?: () => Array<{ url?: unknown }>
      }
    }
  ).navigation
  if (!navigation?.currentEntry || typeof navigation.entries !== 'function') return undefined
  const { key, index } = navigation.currentEntry
  const vorher = typeof index === 'number' && index > 0 ? navigation.entries()[index - 1]?.url : null
  let vorherigerPfad: string | null = null
  if (typeof vorher === 'string') {
    try {
      vorherigerPfad = new URL(vorher).pathname
    } catch {
      // Keine lesbare Adresse — dann eben kein bekannter Vorgänger.
      vorherigerPfad = null
    }
  }
  return { schluessel: typeof key === 'string' ? key : null, vorherigerPfad }
}

// Hinauf erreichte Einträge (Navigation API) — im sessionStorage, damit das
// Hinaufsteigen auch nach Neuladen nicht als „zurück" gilt.
const HINAUF_SPEICHER = 'farmerzone:hinauf'

function hinaufEintraege(): string[] {
  try {
    const roh = sessionStorage.getItem(HINAUF_SPEICHER)
    return roh ? hinaufEintraegeSchema.parse(JSON.parse(roh)) : []
  } catch {
    // Kein Zugriff oder kein JSON: keine bekannten Einträge — dann gilt die
    // Navigation API allein, im schlimmsten Fall ein Schritt zurück hinunter.
    return []
  }
}

function merkeHinaufEintrag(schluessel: string): void {
  try {
    const neu = [...hinaufEintraege().filter((s) => s !== schluessel), schluessel].slice(-50)
    sessionStorage.setItem(HINAUF_SPEICHER, JSON.stringify(neu))
  } catch {
    // Kein Speicher (privates Fenster): gilt dann nur, solange das Dokument lebt.
    return
  }
}

/** Der Pfad der eigenen Seite davor, zum Zeitpunkt des Tipps gelesen — oder null. */
export function eigenerVorgaengerJetzt(): string | null {
  const stand = navigationStand()
  const hinauf = stand?.schluessel ? hinaufEintraege().includes(stand.schluessel) : false
  return eigenerVorgaenger(stand, vorgaengerMerker, hinauf)
}

/**
 * Der Tipp steigt über den Ersatz-Link des Rückwegs zu `ziel` hinauf — dort
 * soll „Zurück" weiter hinauf führen, nicht wieder hinunter.
 */
export function merkeHinauf(ziel: string): void {
  hinaufZiel = ziel
}

export function RueckwegMerker() {
  const pfad = usePathname()
  const letzterPfad = useRef<string | null>(null)
  const durchVerlauf = useRef(false)

  useEffect(() => {
    // Zurück oder Vorwärts im Browser — auch der Zurück-Knopf der Kopfzeile
    // selbst (router.back). Nur wenn sich dabei die Seite ändert: Ein Schritt
    // innerhalb derselben Seite (Anker) bliebe sonst als Marke stehen.
    const beiVerlauf = () => {
      if (window.location.pathname !== letzterPfad.current) durchVerlauf.current = true
    }
    window.addEventListener('popstate', beiVerlauf)
    return () => window.removeEventListener('popstate', beiVerlauf)
  }, [])

  useEffect(() => {
    const wechsel = ordneWechsel({
      von: letzterPfad.current,
      pfad,
      durchVerlauf: durchVerlauf.current,
      hinaufZiel,
    })
    if (wechsel.art === 'hinauf') {
      const schluessel = navigationStand()?.schluessel
      if (schluessel) merkeHinaufEintrag(schluessel)
    }
    if (wechsel.art !== 'nurQuery') {
      durchVerlauf.current = false
      hinaufZiel = null
    }
    letzterPfad.current = pfad
    vorgaengerMerker = merkeVorgaenger(vorgaengerMerker, wechsel)
  }, [pfad])

  return null
}
