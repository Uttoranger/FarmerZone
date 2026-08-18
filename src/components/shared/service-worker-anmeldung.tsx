'use client'

import { useEffect } from 'react'

/**
 * Meldet den Teilen-Service-Worker an (public/sw.js) — einmal je Seitenlast,
 * still bei Fehlern: Wo es keinen Service Worker gibt (ältere Browser,
 * private Fenster mancher Anbieter), funktioniert die App unverändert, nur
 * das Teilen-Ziel fehlt dann.
 *
 * Der Worker selbst behandelt AUSSCHLIESSLICH den Teilen-POST — kein
 * Caching, kein Offline (Kopfkommentar in public/sw.js).
 */
export function ServiceWorkerAnmeldung() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return null
}
