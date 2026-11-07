'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Die Breite, in der das Plakat gesetzt wird — so groß wie ein A4-Blatt bei 96 dpi. */
const PLAKAT_BREITE = 794

/**
 * Die Vorschau des QR-Plakats als verkleinertes Bild (Liste Lauf 32, whatsapp-plakat „Schrift im Plakat
 * bis 6,5 px“, Nr. 250): Das Blatt wird in voller A4-Breite gesetzt und als Ganzes verkleinert — die Schrift
 * selbst bleibt so groß wie gedruckt, nie unter 12 px. Im Web höchstens 420 px breit wie im Board. Gedruckt
 * wird ohne Verkleinerung (print:…).
 *
 * Der Faktor kommt aus der Breite der Hülle (ResizeObserver); vor dem ersten Messen steht 1 da — die Hülle
 * schneidet ab, gemessen wird vor dem ersten Bild (useLayoutEffect).
 */
export function PlakatVorschau({ children }: { children: ReactNode }): React.JSX.Element {
  const huelle = useRef<HTMLDivElement>(null)
  const [faktor, setFaktor] = useState(1)

  useLayoutEffect(() => {
    const element = huelle.current
    if (!element) return
    const messe = () => setFaktor(Math.min(1, element.clientWidth / PLAKAT_BREITE))
    messe()
    const beobachter = new ResizeObserver(messe)
    beobachter.observe(element)
    return () => beobachter.disconnect()
  }, [])

  return (
    <div
      ref={huelle}
      className="mx-auto w-full max-w-[420px] overflow-hidden md:mx-0 print:h-auto! print:max-w-none print:overflow-visible"
      // Die Höhe folgt dem verkleinerten Blatt (A4 hochkant), sonst bliebe die volle Höhe als Lücke stehen.
      style={{ height: `${Math.round(PLAKAT_BREITE * (297 / 210) * faktor)}px` }}
    >
      <div
        className="origin-top-left print:w-auto! print:transform-none!"
        style={{ width: `${PLAKAT_BREITE}px`, transform: `scale(${faktor})` }}
      >
        {children}
      </div>
    </div>
  )
}
