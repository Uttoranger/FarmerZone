'use client'

import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { nanoid } from 'nanoid'
import type { WarenkorbPosition } from '@/schemas/warenkorb-speicher'
import {
  SITZUNG_SCHLUESSEL,
  WARENKORB_SCHLUESSEL,
  leereWarenkorb,
  leseWarenkorb,
  positionenFuer,
  schreibeWarenkorb,
  warenkorbAnzahl,
} from '@/lib/warenkorb-speicher'
import { centsAlsEuro } from '@/lib/format'
import { korbBetraege } from '@/lib/hofseite-kunde'
import { NETZ_SATZ, mitNetzSchutz } from '@/lib/netz'

export type CartItem = WarenkorbPosition

/**
 * Wie ein Griff in den Korb ausging. `nochmal`: Er scheiterte am Netz (Register
 * N29) — `error` ist dann `NETZ_SATZ`, und die Anzeige bietet „Nochmal" an.
 */
export type KorbErgebnis = { ok: boolean; error?: string; nochmal?: true }

/**
 * Der leere Korb im Korb-Blatt (Nr. 175, Register N9): Symbol, ein Satz, ein
 * Weg weiter — zurück zum Angebot des Hofs oder zu den Höfen. Eine Quelle für
 * Hofseite und Produktseite, die beide das Blatt zeigen.
 */
export const KORB_LEER = {
  titel: 'Dein Warenkorb ist leer.',
  satz: 'Leg etwas aus dem Angebot des Hofs hinein.',
  zumHof: 'Zum Angebot',
} as const

/** Der Satz, wenn der Aufruf aus einem anderen Grund als dem Netz warf — wie bisher bei einer Ablehnung ohne Grund. */
const NICHT_VERFUEGBAR = 'Produkt nicht mehr verfügbar'

export type Warenkorb = {
  items: CartItem[]
  count: number
  total: number
  isHydrated: boolean
  addItem: (product: Omit<CartItem, 'quantity'>, qty?: number) => Promise<KorbErgebnis>
  updateQuantity: (productId: string, qty: number) => Promise<KorbErgebnis>
  removeItem: (productId: string) => void
  clearCart: () => void
  /** Den ganzen Korb auf einmal neu setzen (Abgleich der Hofseite, Register N28) — gibt die gleiche Liste zurück, wird nichts geschrieben. */
  ersetzeKorb: (aendern: (vorher: CartItem[]) => CartItem[]) => void
}

const KEIN_KORB: CartItem[] = []

type KorbStand = { farmId: string; farmSlug: string; items: CartItem[] }

// Korb und Sitzung liegen im localStorage, den es erst im Browser gibt. Server
// und Hydration lesen „kein Speicher" (undefined) und rendern den leeren Korb,
// danach liest React den Speicher — wie früher der Effekt, ohne setState
// darin. Abonniert wird nichts: Der Hook lädt einmal je Hof und führt den Korb
// dann selbst, Schreiben aus anderen Tabs übernimmt er nicht (wie bisher).
function nichtsAbonnieren(): () => void {
  return () => {}
}
function korbImBrowser(): string | null {
  return localStorage.getItem(WARENKORB_SCHLUESSEL)
}
function keinSpeicher(): undefined {
  return undefined
}

// Der Satz nach dem Abgleich der Hofseite (Register N28), je Hof. Er steht im
// Korb-Blatt (Produktraster) UND im Mini-Warenkorb der rechten Spalte, die
// keinen gemeinsamen Zustand haben — darum hier, neben dem Korb, der ihn
// löscht: Er gilt, bis sich der Korb ändert. Nicht im Speicher: Nach dem
// Neuladen gleicht die Seite neu ab, ein alter Satz wäre dann falsch.
const korbHinweise = new Map<string, string>()
const hinweisHoerer = new Set<() => void>()

function setzeKorbHinweis(farmId: string, text: string | null): void {
  if ((korbHinweise.get(farmId) ?? null) === text) return
  if (text === null) korbHinweise.delete(farmId)
  else korbHinweise.set(farmId, text)
  for (const melde of hinweisHoerer) melde()
}

function abonniereHinweis(melde: () => void): () => void {
  hinweisHoerer.add(melde)
  return () => {
    hinweisHoerer.delete(melde)
  }
}

function keinHinweis(): null {
  return null
}

/** Zeigt den Satz zum Korb dieses Hofs, bis sich der Korb ändert (Abgleich der Hofseite, Register N28). */
export function zeigeKorbHinweis(farmId: string, text: string): void {
  setzeKorbHinweis(farmId, text)
}

/** Der Satz zum Korb dieses Hofs nach dem Abgleich — null ohne. Liest nur; schreiben tut useCart. */
export function useKorbHinweis(farmId: string): string | null {
  return useSyncExternalStore(abonniereHinweis, () => korbHinweise.get(farmId) ?? null, keinHinweis)
}

/**
 * Reserviert die Menge über /api/reserve — mit Zeitlimit, ohne Wurf (Register
 * N29). Ohne Netz kam früher keine Antwort, und der Knopf blieb im
 * Ladezustand; jetzt gibt es `nochmal` mit dem Netzsatz. Was der Server
 * prüft und hält, bleibt, wie es war: Hier ändert sich nur, wie ein
 * gescheiterter Aufruf zurückkommt.
 */
async function reserviere(
  productId: string,
  quantity: number,
  sessionId: string
): Promise<{ antwort: Response } | { gescheitert: KorbErgebnis }> {
  const antwort = await mitNetzSchutz((signal) =>
    fetch('/api/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity, sessionId }),
      signal,
    })
  )
  if (antwort.ok) return { antwort: antwort.daten }
  if (antwort.art === 'server') return { gescheitert: { ok: false, error: NICHT_VERFUEGBAR } }
  return { gescheitert: { ok: false, error: NETZ_SATZ, nochmal: true } }
}

/** Die Kennung, an der die Reservierungen hängen — beim ersten Mal angelegt, bleibt über Seitenaufrufe. */
function sitzungsKennung(): string {
  let sid = localStorage.getItem(SITZUNG_SCHLUESSEL)
  if (!sid) {
    sid = nanoid()
    localStorage.setItem(SITZUNG_SCHLUESSEL, sid)
  }
  return sid
}

/**
 * Der Warenkorb eines Hofs. `farmSlug` wird mitgespeichert, damit das
 * Warenkorb-Symbol der Kopfzeile auf anderen Seiten zu diesem Hof führt.
 */
export function useCart(farmId: string, farmSlug: string): Warenkorb {
  const roh = useSyncExternalStore<string | null | undefined>(nichtsAbonnieren, korbImBrowser, keinSpeicher)
  const isHydrated = roh !== undefined
  // Der Korb gehört zu genau einem Hof. Wechselt der Hof, wird beim Rendern
  // neu geladen (Zustand bei neuen Props anpassen), nicht in einem Effekt.
  // Danach ist dieser Zustand die Anzeige, der Speicher nur die Ablage:
  // Scheitert das Schreiben (privates Fenster), stimmt die Anzeige trotzdem.
  const [korb, setKorb] = useState<KorbStand | null>(null)
  if (isHydrated && (korb?.farmId !== farmId || korb.farmSlug !== farmSlug)) {
    // Beschädigter oder fremder Korb ergibt einen leeren — kein Fehler, den
    // die Kundin sehen müsste (leseWarenkorb prüft mit Zod).
    setKorb({ farmId, farmSlug, items: positionenFuer(leseWarenkorb(roh), farmId) })
  }
  const items = korb?.farmId === farmId && korb.farmSlug === farmSlug ? korb.items : KEIN_KORB

  useEffect(() => {
    // Die Sitzung entsteht wie bisher beim ersten Besuch eines Hofs.
    sitzungsKennung()
    // Ein Korb von vor der Kopfzeile kennt den Slug nicht — nachtragen, damit
    // das Warenkorb-Symbol auf anderen Seiten zu diesem Hof führt.
    const gespeichert = leseWarenkorb(localStorage.getItem(WARENKORB_SCHLUESSEL))
    const geladen = positionenFuer(gespeichert, farmId)
    if (gespeichert && !gespeichert.farmSlug && geladen.length > 0) {
      schreibeWarenkorb({ farmId, farmSlug, items: geladen })
    }
  }, [farmId, farmSlug])

  // Jede Änderung setzt auf der vorigen auf, nie auf `items`: Das gehört zu dem
  // Render, aus dem die Funktion stammt. Der Nachbestell-Link ruft addItem in
  // einer Schleife aus EINEM Render — mit `items` setzte jeder Aufruf auf
  // denselben leeren Korb auf, nur das letzte Produkt blieb, und die übrigen
  // lagen 15 Minuten reserviert, ohne im Korb zu sein (Nr. 71). Ein Updater
  // im Zustand reicht nicht: Er darf nichts schreiben, der Speicher braucht
  // denselben Stand aber sofort (und das Signal an die Kopfzeile käme sonst
  // mitten im Rendern).
  const zuletzt = useRef<KorbStand | null>(null)

  /** Der Korb nach der letzten Änderung — auch wenn seitdem noch nicht neu gerendert wurde. */
  function aktuellePositionen(): CartItem[] {
    const stand = zuletzt.current
    return stand?.farmId === farmId && stand.farmSlug === farmSlug ? stand.items : items
  }

  function persist(aendern: (vorher: CartItem[]) => CartItem[]) {
    const vorher = aktuellePositionen()
    const nachher = aendern(vorher)
    // Dieselbe Liste heißt: nichts geändert — nichts schreiben (ersetzeKorb ohne Abweichung).
    if (nachher === vorher) return
    const stand = { farmId, farmSlug, items: nachher }
    zuletzt.current = stand
    setKorb(stand)
    schreibeWarenkorb(stand)
    // Der Satz zum Abgleich gilt nur für den Korb, zu dem er gehört.
    setzeKorbHinweis(farmId, null)
  }

  /**
   * Gibt den Halt dieser Sitzung für ein Produkt frei, das den Korb verlassen
   * hat (Register N28) — ohne zu warten. Scheitert es, läuft der Halt wie
   * früher nach 15 Minuten ab; die Kundin muss davon nichts wissen.
   */
  function gibHaltFrei(productId: string) {
    const sessionId = sitzungsKennung()
    // mitNetzSchutz wirft nie; ohne Netz bleibt nur der Ablauf nach 15 Minuten.
    void mitNetzSchutz((signal) =>
      fetch('/api/reserve', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, sessionId }),
        signal,
      })
    )
  }

  async function addItem(
    product: Omit<CartItem, 'quantity'>,
    qty = 1
  ): Promise<KorbErgebnis> {
    const existingQty = aktuellePositionen().find((i) => i.productId === product.productId)?.quantity ?? 0
    const totalQty = existingQty + qty

    const reserviert = await reserviere(product.productId, totalQty, sitzungsKennung())
    // Ohne Antwort des Servers gescheitert (Netz, Zeitlimit): Der Korb bleibt, wie er war.
    if ('gescheitert' in reserviert) return reserviert.gescheitert
    const res = reserviert.antwort

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, error: err.error ?? NICHT_VERFUEGBAR }
    }

    // /api/reserve setzt die Menge auf totalQty, es zählt nicht dazu — genau
    // die trägt der Korb, auch wenn die Position inzwischen schon drinsteht.
    persist((vorher) =>
      vorher.some((i) => i.productId === product.productId)
        ? vorher.map((i) => (i.productId === product.productId ? { ...i, quantity: totalQty } : i))
        : [...vorher, { ...product, quantity: totalQty }]
    )

    return { ok: true }
  }

  async function updateQuantity(productId: string, qty: number): Promise<KorbErgebnis> {
    if (qty <= 0) {
      removeItem(productId)
      return { ok: true }
    }

    const reserviert = await reserviere(productId, qty, sitzungsKennung())
    if ('gescheitert' in reserviert) return reserviert.gescheitert
    const res = reserviert.antwort

    if (res.ok) {
      persist((vorher) => vorher.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)))
      return { ok: true }
    }
    // Bei Ablehnung bleibt die alte Menge; den Grund gibt es zurück, damit die
    // Hofseite ihn zeigen kann (Nr. 10) — wer ihn nicht braucht, ignoriert ihn.
    const err = await res.json().catch(() => ({}))
    return { ok: false, error: err.error }
  }

  function removeItem(productId: string) {
    persist((vorher) => vorher.filter((i) => i.productId !== productId))
    gibHaltFrei(productId)
  }

  function clearCart() {
    const leer: KorbStand = { farmId, farmSlug, items: [] }
    zuletzt.current = leer
    setKorb(leer)
    leereWarenkorb()
    setzeKorbHinweis(farmId, null)
  }

  const count = warenkorbAnzahl(items)
  // In ganzen Cent auf dem Weg des Checkouts (korbBetraege), nie price × Menge in Fließkomma —
  // nur Anzeige, verbindlich rechnet der Checkout mit den Preisen aus der Datenbank.
  const total = centsAlsEuro(korbBetraege(items).summeCents)

  return { items, count, total, isHydrated, addItem, updateQuantity, removeItem, clearCart, ersetzeKorb: persist }
}
