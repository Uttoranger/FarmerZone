'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/**
 * Setzt die Sentry-Nutzerkennung — AUSSCHLIESSLICH die Farm-ID, niemals
 * E-Mail oder Name: Bauern sind identifizierbare Personen; Sentry sieht,
 * WAS kaputt ging, nicht WER es war (src/lib/sentry-hygiene.ts dampft
 * `user` zusätzlich auf die ID ein, falls je mehr hineingerät).
 *
 * Ohne initialisiertes Sentry (fehlender DSN) ist setUser ein No-op.
 * Beim Verlassen des Bauern-Bereichs wird die Kennung wieder gelöscht,
 * damit öffentliche Seiten nicht weiter zugeordnet werden.
 */
export function SentryNutzer({ farmId }: { farmId: string }) {
  useEffect(() => {
    Sentry.setUser({ id: farmId })
    return () => {
      Sentry.setUser(null)
    }
  }, [farmId])

  return null
}
