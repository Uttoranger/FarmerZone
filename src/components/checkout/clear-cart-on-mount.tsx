'use client'

import { useEffect } from 'react'
import { leereWarenkorb } from '@/lib/warenkorb-speicher'

export function ClearCartOnMount() {
  useEffect(() => {
    leereWarenkorb()
  }, [])
  return null
}
