'use client'

import { useState, useEffect } from 'react'
import { nanoid } from 'nanoid'

export type CartItem = {
  productId: string
  name: string
  price: number
  unit: string
  unitSize: number | null
  quantity: number
  imageUrl: string | null
}

const CART_KEY = 'bauernshop_cart'
const SESSION_KEY = 'bauernshop_sid'

export function useCart(farmId: string) {
  const [items, setItems] = useState<CartItem[]>([])
  const [sessionId, setSessionId] = useState('')
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    // Session ID (persists across page loads for reservation tracking)
    let sid = localStorage.getItem(SESSION_KEY)
    if (!sid) {
      sid = nanoid()
      localStorage.setItem(SESSION_KEY, sid)
    }
    setSessionId(sid)

    // Cart (farm-specific)
    try {
      const raw = localStorage.getItem(CART_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.farmId === farmId) setItems(data.items ?? [])
      }
    } catch {}

    setIsHydrated(true)
  }, [farmId])

  function persist(next: CartItem[]) {
    setItems(next)
    localStorage.setItem(CART_KEY, JSON.stringify({ farmId, items: next }))
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
    localStorage.removeItem(CART_KEY)
  }

  const count = items.reduce((s, i) => s + i.quantity, 0)
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)

  return { items, count, total, sessionId, isHydrated, addItem, updateQuantity, removeItem, clearCart }
}
