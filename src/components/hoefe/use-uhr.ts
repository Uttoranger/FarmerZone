import { useMemo, useSyncExternalStore } from 'react'

/**
 * Die Uhr der Abholzeile (Register N22): /hoefe ist statisch und bis zu zehn
 * Minuten alt (Seite plus Datencache, N19). Hätte nur der Server gerechnet,
 * zeigte die Seite nach Mitternacht „heute" für gestern — und ein Fenster, das
 * schon begonnen hat, als bestellbar.
 *
 * Darum rechnet der Browser nach dem Laden mit SEINER Uhr neu, über
 * useSyncExternalStore: Beim Hydrieren liefert `getServerSnapshot` den
 * Zeitpunkt des Servers (dieselbe Ausgabe wie im Server-HTML, kein
 * Hydrationsfehler), danach `getSnapshot` die eigene Zeit, auf die Minute
 * gerundet — so rendert die Seite höchstens einmal je Minute neu, nie bei
 * jedem Takt. Ein Takt für alle Zeilen der Seite, nicht einer je Zeile.
 */

const MINUTE_MS = 60_000
/** Alle 20 Sekunden fragen: Der Minutenwechsel ist so spätestens nach 20 Sekunden zu sehen. */
const TAKT_MS = 20_000

/** Der Zeitpunkt, auf die volle Minute abgerundet. */
export function aufMinute(ms: number): number {
  return ms - (ms % MINUTE_MS)
}

const hoerer = new Set<() => void>()
let takt: ReturnType<typeof setInterval> | null = null

function allenMelden() {
  for (const melden of hoerer) melden()
}

/** Abonnieren: Der erste Hörer startet den Takt, der letzte hält ihn an. Kehrt ein Tab aus dem Schlaf zurück, zählt das sofort. */
export function abonniereUhr(melden: () => void): () => void {
  hoerer.add(melden)
  if (takt === null) {
    takt = setInterval(allenMelden, TAKT_MS)
    document.addEventListener('visibilitychange', allenMelden)
  }
  return () => {
    hoerer.delete(melden)
    if (hoerer.size === 0 && takt !== null) {
      clearInterval(takt)
      takt = null
      document.removeEventListener('visibilitychange', allenMelden)
    }
  }
}

/** Die Uhr des Browsers, auf die Minute gerundet — dieselbe Zahl, solange die Minute läuft. */
export function leseUhr(): number {
  return aufMinute(Date.now())
}

/** „Jetzt" für die Abholzeile: beim Hydrieren der Zeitpunkt des Servers (ISO-Text), danach die Uhr des Browsers. */
export function useUhr(serverJetzt: string): Date {
  const ms = useSyncExternalStore(abonniereUhr, leseUhr, () => Date.parse(serverJetzt))
  return useMemo(() => new Date(ms), [ms])
}
