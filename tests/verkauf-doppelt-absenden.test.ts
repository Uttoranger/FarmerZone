// @vitest-environment jsdom
/**
 * „Eintragen“ ist nie deaktiviert (G6, Nr. 272). Ein zweites Absenden, solange das erste läuft, darf deshalb
 * nicht noch einmal buchen — sonst zwei Verkäufe und zwei Vorratsabzüge (Register D1). Die Sperre greift
 * synchron beim ersten Absenden (useRef), nicht erst nach der asynchronen Prüfung. Und solange gespeichert
 * wird, meldet das Formular das dem Rahmen, damit „Abbrechen“ und Schließen nicht greifen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

const speichern = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }))
vi.mock('@/server/actions/manual-sales', () => ({ createManualSale: speichern.create, updateManualSale: speichern.update }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn() } }))

import { VerkaufFormular } from '@/components/hof-verkaeufe/verkauf-dialog'
import { wienKalendertag } from '@/lib/kalender'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const vorlage = {
  id: 'v1',
  productId: null,
  productName: 'Wochenmarkt',
  quantity: 1,
  unit: null,
  totalAmount: 24.8,
  channel: 'MARKT',
  saleTag: wienKalendertag(new Date()),
  note: null,
}

async function zeichne(onSpeichern = vi.fn()) {
  const ziel = document.createElement('div')
  document.body.appendChild(ziel)
  const wurzel = createRoot(ziel)
  await act(async () => {
    wurzel.render(
      createElement(VerkaufFormular, { verkauf: null, vorlage, produkte: [], topProduktIds: [], onFertig: vi.fn(), onSpeichern, breit: true })
    )
  })
  return { form: ziel.querySelector('form')!, onSpeichern, wurzel }
}

describe('Verkauf eintragen: kein zweites Buchen während des Speicherns (D1, G6)', () => {
  beforeEach(() => {
    speichern.create.mockReset()
    document.body.innerHTML = ''
  })

  it('zwei schnelle Absendungen rufen createManualSale nur einmal', async () => {
    let fertig!: (wert: unknown) => void
    speichern.create.mockReturnValue(new Promise((r) => (fertig = r)))
    const { form, onSpeichern, wurzel } = await zeichne()
    const knopf = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(knopf.disabled).toBe(false)
    await act(async () => {
      form.requestSubmit(knopf)
      form.requestSubmit(knopf)
      await Promise.resolve()
    })
    await act(async () => {
      form.requestSubmit(knopf)
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(speichern.create).toHaveBeenCalledTimes(1)
    // Der Knopf bleibt bedienbar sichtbar (G6), trägt aber aria-busy; der Rahmen weiß, dass gespeichert wird.
    expect(knopf.disabled).toBe(false)
    expect(knopf.getAttribute('aria-busy')).toBe('true')
    expect(onSpeichern).toHaveBeenLastCalledWith(true)
    await act(async () => {
      fertig({ ok: true })
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(onSpeichern).toHaveBeenLastCalledWith(false)
    act(() => wurzel.unmount())
  })

  it('nach einem fertigen Speichern geht das nächste Absenden wieder durch', async () => {
    speichern.create.mockResolvedValue({ error: 'Gerade nicht.' })
    const { form, wurzel } = await zeichne()
    const knopf = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
    await act(async () => {
      form.requestSubmit(knopf)
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      form.requestSubmit(knopf)
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(speichern.create).toHaveBeenCalledTimes(2)
    act(() => wurzel.unmount())
  })

  it('der Rahmen schließt nicht, solange gespeichert wird (Abbrechen, Escape, Tipp daneben)', () => {
    const text = readFileSync(join(__dirname, '..', 'src/components/hof-verkaeufe/verkauf-dialog.tsx'), 'utf8')
    expect(text).toContain('onSpeichern={setSpeichert}')
    expect(text).toMatch(/if \(!speichert\) onSchliessen\(\)/)
    expect(text).toContain('onOpenChange={(o) => !o && schliessen()}')
    expect(text).toContain('onAbbrechen: schliessen')
    expect(text).not.toMatch(/onOpenChange=\{\(o\) => !o && onSchliessen\(\)\}/)
  })
})
