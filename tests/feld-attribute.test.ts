/**
 * Eine Quelle für die Eingabe-Attribute der Hof-Felder (Nr. 174): Mein Hof
 * (abschnitt-formulare.tsx) und das Hofprofil zeigen dieselben Felder mit
 * denselben Tastaturen. Dazu `weiterMitEnter`: Die „Weiter"-Taste springt zum
 * nächsten Feld, am letzten schickt Enter ab.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { FELD_ATTRIBUTE, enterTaste, weiterMitEnter } from '@/lib/feld-attribute'

describe('FELD_ATTRIBUTE', () => {
  it('Telefon, E-Mail und PLZ wählen die passende Tastatur', () => {
    expect(FELD_ATTRIBUTE.phone).toEqual({ type: 'tel', autoComplete: 'tel' })
    expect(FELD_ATTRIBUTE.email).toEqual({ type: 'email', autoComplete: 'email' })
    expect(FELD_ATTRIBUTE.postalCode).toEqual({ inputMode: 'numeric', autoComplete: 'postal-code' })
  })

  it('Mein Hof schreibt dieselben Werte (Gegenprobe gegen Auseinanderlaufen)', () => {
    const quelle = readFileSync('src/components/mein-hof/abschnitt-formulare.tsx', 'utf8')
    for (const w of [FELD_ATTRIBUTE.phone.autoComplete, FELD_ATTRIBUTE.email.autoComplete, FELD_ATTRIBUTE.postalCode.autoComplete, FELD_ATTRIBUTE.address.autoComplete, FELD_ATTRIBUTE.city.autoComplete]) {
      expect(quelle).toContain(`autoComplete="${w}"`)
    }
    expect(quelle).toContain('type="tel"')
    expect(quelle).toContain('type="email"')
    expect(quelle).toContain('inputMode="numeric"')
  })
})

describe('enterTaste', () => {
  it('Weiter, am letzten Fertig oder Senden', () => {
    expect(enterTaste(false)).toBe('next')
    expect(enterTaste(true)).toBe('done')
    expect(enterTaste(true, 'send')).toBe('send')
  })
})

describe('weiterMitEnter', () => {
  const feld = (extra: Record<string, unknown> = {}) => ({ tagName: 'INPUT', enterKeyHint: 'next', type: 'text', focus: vi.fn(), ...extra })
  const ereignis = (target: unknown, form: unknown, extra: Record<string, unknown> = {}) => ({
    key: 'Enter', defaultPrevented: false, preventDefault: vi.fn(), target, currentTarget: form, ...extra,
  })

  it('springt zum nächsten Feld und schickt nicht ab', () => {
    const a = feld(), b = feld({ disabled: true }), c = feld()
    const e = ereignis(a, { elements: [a, b, c] })
    weiterMitEnter(e)
    expect(e.preventDefault).toHaveBeenCalledOnce()
    expect(b.focus).not.toHaveBeenCalled()
    expect(c.focus).toHaveBeenCalledOnce()
  })

  it('Gegenprobe: am letzten Feld ("done"), in der textarea, bei anderer Taste und beim Tippen mit Eingabemethode bleibt alles beim Browser', () => {
    const a = feld({ enterKeyHint: 'done' }), b = feld()
    const faelle = [
      ereignis(a, { elements: [a, b] }),
      ereignis(feld({ tagName: 'TEXTAREA' }), { elements: [b] }),
      ereignis(b, { elements: [b] }),
      ereignis(b, { elements: [b, feld()] }, { key: 'Tab' }),
      ereignis(b, { elements: [b, feld()] }, { nativeEvent: { isComposing: true } }),
    ]
    for (const e of faelle) {
      weiterMitEnter(e)
      expect(e.preventDefault).not.toHaveBeenCalled()
    }
  })
})
