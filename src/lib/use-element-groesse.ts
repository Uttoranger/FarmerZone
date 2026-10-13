'use client'

import { useEffect, useState } from 'react'

/**
 * Breite und Höhe eines Elements, live per ResizeObserver — 0, solange nichts
 * gemessen ist. Das Element kommt über die Callback-Ref: Im Overlay hängt es
 * erst nach dem Portal des Dialogs im Dokument, eine Objekt-Ref wäre beim
 * ersten Effekt noch leer und die Fläche bliebe für immer 0 × 0. Der Editor
 * misst damit auch seine Gesamtbreite (hofseite-editor.tsx, `editorSpalten`).
 * Liegt seit Nr. 75 hier statt in hofseite-vorschau-rahmen.tsx (Hooks in
 * `src/lib/use-*.ts`, CODING_STANDARDS §1).
 */
export function useElementGroesse(): { ref: (el: HTMLElement | null) => void; breite: number; hoehe: number } {
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [groesse, setGroesse] = useState({ breite: 0, hoehe: 0 })
  useEffect(() => {
    if (!el) return
    const beobachter = new ResizeObserver(([eintrag]) => {
      setGroesse({ breite: Math.round(eintrag.contentRect.width), hoehe: Math.round(eintrag.contentRect.height) })
    })
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [el])
  return { ref: setEl, breite: groesse.breite, hoehe: groesse.hoehe }
}
