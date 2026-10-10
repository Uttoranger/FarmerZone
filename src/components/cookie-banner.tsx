'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import {
  COOKIE_HINWEIS_LUFT_PX,
  COOKIE_HINWEIS_RAND_PX,
  UNTEN_FEST_ATTRIBUT,
  cookieHinweisUnten,
  leistenMass,
  type LeistenMass,
} from '@/lib/cookie-hinweis'

const COOKIE_KEY = 'fz_cookie_ok'

/**
 * Die festen Leisten unten (Merkmal an der Leiste), wie sie gerade im Fenster
 * liegen — samt allem, was aus ihnen herausragt (der erhobene Mittelknopf).
 */
function festeLeisten(): LeistenMass[] {
  return Array.from(document.querySelectorAll<HTMLElement>(`[${UNTEN_FEST_ATTRIBUT}]`))
    // Nur, was gerade wirklich fest steht: Die Kasse stellt ihre Leiste ab 768 px in den Fluss.
    .filter((el) => getComputedStyle(el).position === 'fixed')
    .map((el) => leistenMass(el.getBoundingClientRect(), Array.from(el.querySelectorAll('*'), (teil) => teil.getBoundingClientRect())))
}

export function CookieBanner(): React.JSX.Element | null {
  const [visible, setVisible] = useState(false)
  // Seit Nr. 46 über der höchsten festen Leiste (Unterleiste, Kaufknopf) statt
  // darauf — die Regel steht in src/lib/cookie-hinweis.ts.
  const [unten, setUnten] = useState(COOKIE_HINWEIS_RAND_PX)
  const [hoehe, setHoehe] = useState(0)
  const hinweis = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_KEY)) setVisible(true)
  }, [])

  useEffect(() => {
    if (!visible) return
    // Leisten kommen und gehen (Korb-Leiste nach dem ersten Artikel, Kaufknopf
    // nach dem Laden des Korbs), und ihre Höhe ändert sich mit dem Text. Darum
    // wird nachgemessen, solange der Hinweis steht — einmal je Bildaufbau.
    let rahmen = 0
    const messen = () => {
      cancelAnimationFrame(rahmen)
      rahmen = requestAnimationFrame(() => {
        setUnten(cookieHinweisUnten(festeLeisten(), window.innerHeight))
        setHoehe(hinweis.current?.offsetHeight ?? 0)
      })
    }
    messen()
    const beobachter = new MutationObserver(messen)
    beobachter.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] })
    window.addEventListener('resize', messen)
    return () => {
      cancelAnimationFrame(rahmen)
      beobachter.disconnect()
      window.removeEventListener('resize', messen)
    }
  }, [visible])

  function accept() {
    localStorage.setItem(COOKIE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <>
      {/* Platz am Seitenende, solange der Hinweis steht: Sonst läge das Letzte
          der Seite (über der Unterleiste) dauerhaft unter ihm. */}
      <div aria-hidden="true" style={{ height: hoehe > 0 ? hoehe + COOKIE_HINWEIS_LUFT_PX : 0 }} />
      {/* Eine eigene Landmarke: Ohne sie stünde der Hinweis außerhalb jeder
          Region (Axe „region"), weil er im Root-Layout neben dem Seiteninhalt hängt. */}
      {/* Am Handy eine flache Zeile (Text neben „Verstanden"), ab 640 px die Karte
          unten rechts: So nimmt der Hinweis über der Unterleiste wenig Platz weg. */}
      <section
        ref={hinweis}
        aria-label="Hinweis zu Cookies"
        className="fixed right-4 z-50 w-[calc(100vw-2rem)] sm:w-80"
        style={{ bottom: unten }}
      >
        <div className="flex items-center gap-3 rounded-2xl bg-card p-3 text-[13px] shadow-lg dark:ring-1 dark:ring-border sm:block sm:p-4 sm:text-sm">
          <p className="min-w-0 flex-1 leading-snug text-muted-foreground sm:mb-3 sm:leading-relaxed">
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
            className={cn(
              'min-h-11 shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90 sm:w-full',
              FOKUS_RAHMEN
            )}
          >
            Verstanden
          </button>
        </div>
      </section>
    </>
  )
}
