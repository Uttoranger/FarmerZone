import { useSyncExternalStore } from 'react'
import { abgesendeterSuchtext } from '@/schemas/hoefe-filter'

/*
 * Die Adresse von /hoefe als Speicher für die Filter (Register N19).
 *
 * Die Seite ist statisch (Neubau alle fünf Minuten): Im Server-HTML steht die
 * ganze Hofliste, ungefiltert — die Filter liest erst der Browser aus der
 * Adresse. useSearchParams darf es im Baum nicht geben: In einer statischen
 * Seite zeichnete es alles bis zur nächsten Suspense-Grenze nur im Browser,
 * und die Liste fehlte im Server-HTML (Crawler, erste Anzeige).
 *
 * useSyncExternalStore liest window.location.search. Der Server-Wert ist
 * `null` — der leere Filter, wie im Server-HTML; nach der Hydration zeichnet
 * React mit der echten Adresse neu, ohne Hydrationsfehler. Geändert wird die
 * Adresse nur über `ersetze` (replaceState, kein Server-Aufruf), und das meldet
 * jede Änderung; Zurück/Vor meldet popstate. Bleibt der Seitenwechsel auf
 * /hoefe („Entdecken" auf /hoefe?kat=…), schreibt Next die Adresse selbst,
 * ohne popstate, und zeichnet die unveränderte statische Seite nicht neu —
 * das meldet die Navigation API (currententrychange), wo der Browser sie hat.
 * BEKANNTE GRENZE: Ohne sie bleibt der Filter dort stehen, bis neu geladen wird.
 */

/** So viel vom Fenster, wie der Speicher braucht — Tests geben ein eigenes mit. */
export type AdressFenster = {
  location: { readonly pathname: string; readonly search: string }
  history: { replaceState(zustand: null, titel: string, url: string): void }
  addEventListener(typ: 'popstate', hoerer: () => void): void
  removeEventListener(typ: 'popstate', hoerer: () => void): void
  /** Die Navigation API, wo der Browser sie hat — sie meldet auch Nexts eigenes pushState. */
  navigation?: {
    addEventListener(typ: 'currententrychange', hoerer: () => void): void
    removeEventListener(typ: 'currententrychange', hoerer: () => void): void
  }
}

export type AdressSpeicher = {
  /** Für useSyncExternalStore: meldet jede Änderung über `ersetze` und Zurück/Vor. */
  abonnieren: (melden: () => void) => () => void
  /** Die Suchparameter samt „?" — oder null, solange die Adresse einer anderen Seite gehört. */
  lesen: () => string | null
  /** Schreibt den Query-String (ohne „?") in die Adresse der Seite und meldet es. */
  ersetze: (query: string) => void
}

export function erstelleAdressSpeicher(pfad: string, fenster: () => AdressFenster): AdressSpeicher {
  const hoerer = new Set<() => void>()
  return {
    abonnieren(melden) {
      const f = fenster()
      // Next schreibt die Adresse in einem useInsertionEffect — darin darf React
      // nichts neu planen. Darum erst nach der laufenden Aufgabe.
      const danach = () => queueMicrotask(melden)
      hoerer.add(melden)
      f.addEventListener('popstate', melden)
      f.navigation?.addEventListener('currententrychange', danach)
      return () => {
        hoerer.delete(melden)
        f.removeEventListener('popstate', melden)
        f.navigation?.removeEventListener('currententrychange', danach)
      }
    },
    lesen() {
      // Beim Seitenwechsel im Browser zeichnet Next /hoefe, BEVOR es die neue
      // Adresse schreibt — bis dahin gehört sie der alten Seite. Ihre Parameter
      // (?bereich=futter der Hofseite) wären hier ein falscher Filter, und der
      // Ankunftstext würde zu früh gelesen. Nach dem Schreiben prüft React den
      // Speicher von selbst noch einmal.
      const { pathname, search } = fenster().location
      return pathname === pfad ? search : null
    },
    ersetze(query) {
      // Mit null als Zustand: Nur dann gleicht Next seinen Router ab (ARCHITECTURE §4, „Filter/Suche in URL").
      fenster().history.replaceState(null, '', query ? `${pfad}?${query}` : pfad)
      for (const melden of hoerer) melden()
    },
  }
}

/** Der Speicher von /hoefe — einer für die Seite; `window` erst beim Gebrauch, nie auf dem Server. */
export const HOEFE_ADRESSE = erstelleAdressSpeicher('/hoefe', () => window)

const AUF_DEM_SERVER = () => null

/** Die Suchparameter von /hoefe; auf dem Server und beim Hydrieren null (der leere Filter). */
export function useHoefeAdresse(): string | null {
  return useSyncExternalStore(HOEFE_ADRESSE.abonnieren, HOEFE_ADRESSE.lesen, AUF_DEM_SERVER)
}

/**
 * Der Ankunftstext (Nr. 84): der Suchtext, mit dem die Kundin abgesendet
 * ankam — gelesen, sobald die Adresse feststeht, und dann nie wieder.
 * `bisher` null heißt „noch nicht gelesen"; `adresse` null heißt „steht
 * noch nicht fest" (Server, Hydration, Seitenwechsel).
 */
export function ankunftAusAdresse(bisher: string | null, adresse: string | null): string | null {
  if (bisher !== null || adresse === null) return bisher
  return abgesendeterSuchtext(new URLSearchParams(adresse))
}
