'use client'

import { useEffect } from 'react'

const CART_KEY = 'bauernshop_cart'

export function ClearCartOnMount() {
  useEffect(() => {
    localStorage.removeItem(CART_KEY)
  }, [])
  return null
}
