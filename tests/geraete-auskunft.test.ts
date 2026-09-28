/**
 * Die Geräteauskunft für Sentry (src/lib/upload-meldung.ts): Welches Android
 * ist es wirklich? Der User-Agent nennt seit Chrome 110 für jedes Android
 * „10; K" — die echte Version kommt nur aus den Client Hints, asynchron.
 *
 * Beweist:
 *  - Ohne Browser gibt es keine Auskunft; aus dem User-Agent allein bleibt die
 *    Einheitsangabe unbekannt.
 *  - Die Client Hints überschreiben die Auskunft, sobald sie da sind, und die
 *    Meldung trägt die Version.
 *  - Verweigerte oder werfende Hints bleiben folgenlos; gefragt wird einmal.
 *
 * Jeder Test lädt das Modul frisch: Die Auskunft ist ein Modul-Zustand.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

const EINHEITS_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/153.0.0.0 Mobile Safari/537.36'

async function frisch() {
  vi.resetModules()
  return await import('@/lib/upload-meldung')
}

/** Lässt die Antwort der Client Hints durch die Mikrotask-Schleife. */
async function abwarten() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('geraeteAuskunft', () => {
  it('ohne Browser keine Auskunft', async () => {
    vi.stubGlobal('navigator', undefined)
    const { geraeteAuskunft, bereiteGeraeteAuskunftVor } = await frisch()

    expect(() => bereiteGeraeteAuskunftVor()).not.toThrow()
    expect(geraeteAuskunft()).toBeNull()
  })

  it('aus dem User-Agent allein: Android ja, Version unbekannt', async () => {
    vi.stubGlobal('navigator', { userAgent: EINHEITS_UA })
    const { geraeteAuskunft, bereiteGeraeteAuskunftVor } = await frisch()

    bereiteGeraeteAuskunftVor()
    await abwarten()
    expect(geraeteAuskunft()).toEqual({ android: true, version: null })
  })

  it('die Client Hints bringen die echte Version — und die Meldung trägt sie', async () => {
    const getHighEntropyValues = vi.fn(async () => ({ platformVersion: '14.0.0' }))
    vi.stubGlobal('navigator', { userAgent: EINHEITS_UA, userAgentData: { platform: 'Android', getHighEntropyValues } })
    const { geraeteAuskunft, bereiteGeraeteAuskunftVor, meldeUploadFehler } = await frisch()
    const Sentry = await import('@sentry/nextjs')

    bereiteGeraeteAuskunftVor()
    expect(getHighEntropyValues).toHaveBeenCalledWith(['platformVersion'])
    await abwarten()
    expect(geraeteAuskunft()).toEqual({ android: true, version: 14 })

    meldeUploadFehler(new Error('x'), { datei: { size: 1, type: 'image/jpeg' }, weg: 'standard', versuche: 0 })
    expect(Sentry.captureException).toHaveBeenLastCalledWith(
      expect.any(Error),
      expect.objectContaining({ contexts: expect.objectContaining({ upload: expect.objectContaining({ androidVersion: 14 }) }) })
    )
  })

  it('fragt die Hints nur einmal je Seitenlast', async () => {
    const getHighEntropyValues = vi.fn(async () => ({ platformVersion: '13.0.0' }))
    vi.stubGlobal('navigator', { userAgent: EINHEITS_UA, userAgentData: { platform: 'Android', getHighEntropyValues } })
    const { bereiteGeraeteAuskunftVor } = await frisch()

    bereiteGeraeteAuskunftVor()
    bereiteGeraeteAuskunftVor()
    expect(getHighEntropyValues).toHaveBeenCalledTimes(1)
  })

  it('verweigerte Hints bleiben folgenlos: der User-Agent bleibt die Auskunft', async () => {
    const getHighEntropyValues = vi.fn(async () => {
      throw new DOMException('verweigert', 'NotAllowedError')
    })
    vi.stubGlobal('navigator', { userAgent: EINHEITS_UA, userAgentData: { platform: 'Android', getHighEntropyValues } })
    const { geraeteAuskunft, bereiteGeraeteAuskunftVor } = await frisch()

    bereiteGeraeteAuskunftVor()
    await abwarten()
    expect(geraeteAuskunft()).toEqual({ android: true, version: null })
  })

  it('wirft nie — auch wenn der Browser schon beim Zugriff wirft', async () => {
    vi.stubGlobal('navigator', {
      userAgent: EINHEITS_UA,
      get userAgentData(): never {
        throw new Error('kaputt')
      },
    })
    const { bereiteGeraeteAuskunftVor, geraeteAuskunft } = await frisch()

    expect(() => bereiteGeraeteAuskunftVor()).not.toThrow()
    expect(geraeteAuskunft()).toEqual({ android: true, version: null })
  })

  it('ein iPhone ist kein Android, auch mit Hints', async () => {
    const getHighEntropyValues = vi.fn(async () => ({ platformVersion: '17.5.0' }))
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
      userAgentData: { platform: 'iOS', getHighEntropyValues },
    })
    const { geraeteAuskunft, bereiteGeraeteAuskunftVor } = await frisch()

    bereiteGeraeteAuskunftVor()
    await abwarten()
    expect(geraeteAuskunft()).toEqual({ android: false, version: null })
  })
})
