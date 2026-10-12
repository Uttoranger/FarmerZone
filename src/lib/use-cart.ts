'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
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

export type CartItem = WarenkorbPosition

export type Warenkorb = {
  items: CartItem[]
  count: number
  total: number
  isHydrated: boolean
  addItem: (product: Omit<CartItem, 'quantity'>, qty?: number) => Promise<{ ok: boolean; error?: string }>
  updateQuantity: (productId: string, qty: number) => Promise<{ ok: boolean; error?: string }>
  removeItem: (productId: string) => void
  clearCart: () => void
}

const KEIN_KORB: CartItem[] = []

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
  const [korb, setKorb] = useState<{ farmId: string; farmSlug: string; items: CartItem[] } | null>(null)
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

  function persist(next: CartItem[]) {
    setKorb({ farmId, farmSlug, items: next })
    schreibeWarenkorb({ farmId, farmSlug, items: next })
  }

  async function addItem(
    product: Omit<CartItem, 'quantity'>,
    qty = 1
  ): Promise<{ ok: boolean; error?: string }> {
    const existingQty = items.find((i) => i.productId === product.productId)?.quantity ?? 0
    const totalQty = existingQty + qty

    const res = await fetch('/api/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.productId, quantity: totalQty, sessionId: sitzungsKennung() }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, error: err.error ?? 'Produkt nicht mehr verfügbar' }
    }

    if (existingQty > 0) {
      persist(items.map((i) => (i.productId === product.productId ? { ...i, quantity: totalQty } : i)))
    } else {
      persist([...items, { ...product, quantity: qty }])
    }

    return { ok: true }
  }

  async function updateQuantity(productId: string, qty: number): Promise<{ ok: boolean; error?: string }> {
    if (qty <= 0) {
      persist(items.filter((i) => i.productId !== productId))
      return { ok: true }
    }

    const res = await fetch('/api/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity: qty, sessionId: sitzungsKennung() }),
    })

    if (res.ok) {
      persist(items.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)))
      return { ok: true }
    }
    // Bei Ablehnung bleibt die alte Menge; den Grund gibt es zurück, damit die
    // Hofseite ihn zeigen kann (Nr. 10) — wer ihn nicht braucht, ignoriert ihn.
    const err = await res.json().catch(() => ({}))
    return { ok: false, error: err.error }
  }

  function removeItem(productId: string) {
    persist(items.filter((i) => i.productId !== productId))
    // Reservation expires naturally after 15 min
  }

  function clearCart() {
    setKorb({ farmId, farmSlug, items: [] })
    leereWarenkorb()
  }

  const count = warenkorbAnzahl(items)
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)

  return { items, count, total, isHydrated, addItem, updateQuantity, removeItem, clearCart }
}
