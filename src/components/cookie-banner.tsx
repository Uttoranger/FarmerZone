'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const COOKIE_KEY = 'fz_cookie_ok'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_KEY)) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(COOKIE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    // Eine eigene Landmarke: Ohne sie stünde der Hinweis außerhalb jeder
    // Region (Axe „region"), weil er im Root-Layout neben dem Seiteninhalt hängt.
    <section aria-label="Hinweis zu Cookies" className="fixed bottom-4 right-4 z-50 max-w-xs w-[calc(100vw-2rem)] sm:w-80">
      <div
        className="bg-card rounded-2xl p-4 text-sm dark:ring-1 dark:ring-border"
        style={{ boxShadow: '0 8px 24px oklch(0.18 0.03 150 / 0.12), 0 2px 6px oklch(0.18 0.03 150 / 0.06)' }}
      >
        <p className="text-muted-foreground leading-relaxed mb-3">
          Wir verwenden nur technisch notwendige Cookies für Warenkorb und Session.{' '}
          {/* Markengrün als Text (brand-text), nicht die Knopffläche: Im neuen
              Design ist --primary Orange und hätte als Schrift zu wenig Kontrast;
              im Bestand ist brand-text am Tag derselbe Ton wie primary. */}
          <Link href="/datenschutz" className="text-brand-text underline underline-offset-2">
            Mehr erfahren
          </Link>
        </p>
        <button
          onClick={accept}
          className="w-full rounded-xl bg-primary text-primary-foreground font-medium py-2 text-sm transition-opacity duration-[250ms] hover:opacity-90"
        >
          Verstanden
        </button>
      </div>
    </section>
  )
}
