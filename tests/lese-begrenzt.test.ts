/**
 * Den Körper einer Anfrage begrenzt lesen (src/lib/lese-begrenzt.ts, Nr. 170) —
 * die eine Hilfe für /api/csp-bericht und /api/webhooks/resend.
 *
 * Beweist: bis zur Grenze kommt der Text an (auch genau an der Grenze, UTF-8
 * über Stückgrenzen); ein Byte mehr gibt null und bricht den Datenstrom ab,
 * statt ihn zu Ende zu lesen; ohne Körper ''.
 */
import { describe, it, expect, vi } from 'vitest'
import { leseBegrenzt } from '@/lib/lese-begrenzt'

/** Eine Anfrage, deren Körper in Stücken kommt — `abgebrochen` zeigt, ob der Leser aufgab. */
function anfrage(stuecke: Uint8Array[]): { request: Request; abgebrochen: () => boolean; gelesen: () => number } {
  let i = 0
  let abbruch = false
  const strom = new ReadableStream<Uint8Array>({
    pull(steuerung) {
      if (i < stuecke.length) steuerung.enqueue(stuecke[i++])
      else steuerung.close()
    },
    cancel() {
      abbruch = true
    },
  })
  const request = new Request('http://localhost/x', { method: 'POST', body: strom, duplex: 'half' } as RequestInit)
  return { request, abgebrochen: () => abbruch, gelesen: () => i }
}

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text)

describe('leseBegrenzt', () => {
  it('bis zur Grenze: der ganze Text, auch ein Umlaut über zwei Stücke', async () => {
    const ue = bytes('ü')
    const { request, abgebrochen } = anfrage([bytes('Gr'), ue.slice(0, 1), ue.slice(1), bytes('n')])
    expect(await leseBegrenzt(request, 5)).toBe('Grün')
    expect(abgebrochen()).toBe(false)
  })

  it('genau an der Grenze geht es noch — Gegenprobe: ein Byte mehr gibt null und bricht ab', async () => {
    expect(await leseBegrenzt(anfrage([bytes('abc'), bytes('de')]).request, 5)).toBe('abcde')
    const zuViel = anfrage([bytes('abc'), bytes('def'), bytes('ghi'), bytes('jkl')])
    expect(await leseBegrenzt(zuViel.request, 5)).toBeNull()
    expect(zuViel.abgebrochen()).toBe(true)
    // Nach dem zweiten Stück ist Schluss — der Rest wird nicht mehr gelesen.
    expect(zuViel.gelesen()).toBeLessThan(4)
  })

  it('ohne Körper: leerer Text', async () => {
    expect(await leseBegrenzt(new Request('http://localhost/x', { method: 'POST' }), 5)).toBe('')
  })

  it('bricht der Absender ab, wirft das Lesen — die Route fängt es', async () => {
    const strom = new ReadableStream<Uint8Array>({ pull: (s) => s.error(new Error('abgebrochen')) })
    const request = new Request('http://localhost/x', { method: 'POST', body: strom, duplex: 'half' } as RequestInit)
    await expect(leseBegrenzt(request, 5)).rejects.toThrow()
    vi.restoreAllMocks()
  })
})
