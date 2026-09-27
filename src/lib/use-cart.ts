'use client'

import { useState, useEffect } from 'react'
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

/**
 * Der Warenkorb eines Hofs. `farmSlug` wird mitgespeichert, damit das
 * Warenkorb-Symbol der Kopfzeile auf anderen Seiten zu diesem Hof führt.
 */
export function useCart(farmId: string, farmSlug: string) {
  const [items, setItems] = useState<CartItem[]>([])
  const [sessionId, setSessionId] = useState('')
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    // Session ID (persists across page loads for reservation tracking)
    let sid = localStorage.getItem(SITZUNG_SCHLUESSEL)
    if (!sid) {
      sid = nanoid()
      localStorage.setItem(SITZUNG_SCHLUESSEL, sid)
    }
    setSessionId(sid)

    // Beschädigter oder fremder Korb ergibt einen leeren — kein Fehler, den
    // die Kundin sehen müsste (leseWarenkorb prüft mit Zod).
    setItems(positionenFuer(leseWarenkorb(localStorage.getItem(WARENKORB_SCHLUESSEL)), farmId))

    setIsHydrated(true)
  }, [farmId])

  function persist(next: CartItem[]) {
    setItems(next)
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
      body: JSON.stringify({ productId: product.productId, quantity: totalQty, sessionId }),
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

  async function updateQuantity(productId: string, qty: number) {
    if (qty <= 0) {
      persist(items.filter((i) => i.productId !== productId))
      return
    }

    const res = await fetch('/api/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity: qty, sessionId }),
    })

    if (res.ok) {
      persist(items.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)))
    }
    // On failure keep existing quantity — reservation will ensure correctness
  }

  function removeItem(productId: string) {
    persist(items.filter((i) => i.productId !== productId))
    // Reservation expires naturally after 15 min
  }

  function clearCart() {
    setItems([])
    leereWarenkorb()
  }

  const count = warenkorbAnzahl(items)
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)

  return { items, count, total, sessionId, isHydrated, addItem, updateQuantity, removeItem, clearCart }
}
