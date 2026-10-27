/**
 * Kein Netz als Zustand (Register N29, Nr. 175): Erkennen, Wortlaut und der
 * Schutz um einen Aufruf aus src/lib/netz.ts — rein, ohne DOM und ohne Netz.
 *
 * Gegenprobe je Fall: Ein Programmierfehler (auch ein TypeError) ist kein
 * Funkloch, eine gelungene Antwort kommt unverändert durch.
 */
import { describe, expect, it } from 'vitest'
import { NETZ_KNOPF, NETZ_SATZ, NETZ_SATZ_UNSICHER, istNetzFehler, mitNetzSchutz } from '@/lib/netz'
import { istNetzfehler } from '@/lib/upload-diagnose'

describe('istNetzFehler', () => {
  it.each(['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.', 'fetch failed'])(
    'erkennt „%s" als abgerissene Verbindung',
    (text) => {
      expect(istNetzFehler(new TypeError(text))).toBe(true)
    }
  )

  it('Gegenprobe: ein Programmierfehler, ein anderer Fehler und kein Fehler sind kein Funkloch', () => {
    expect(istNetzFehler(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false)
    expect(istNetzFehler(new Error('Failed to fetch'))).toBe(false)
    expect(istNetzFehler('Failed to fetch')).toBe(false)
    expect(istNetzFehler(null)).toBe(false)
  })

  it('eine Quelle: upload-diagnose reicht dieselbe Funktion weiter', () => {
    expect(istNetzfehler).toBe(istNetzFehler)
  })
})

describe('Wortlaut (N29)', () => {
  it('Satz und Knopf stehen wie im Register', () => {
    expect(NETZ_SATZ).toBe('Keine Verbindung – nichts gespeichert. Versuch es gleich noch einmal.')
    expect(NETZ_KNOPF).toBe('Nochmal')
  })

  it('der unsichere Satz steht wie im Register und verspricht keinen zweiten Versuch', () => {
    expect(NETZ_SATZ_UNSICHER).toBe('Wir wissen nicht, ob es geklappt hat – lade die Seite neu, bevor du es nochmal tust.')
    expect(NETZ_SATZ_UNSICHER).not.toBe(NETZ_SATZ)
  })
})

describe('mitNetzSchutz', () => {
  it('liefert die Daten eines gelungenen Aufrufs', async () => {
    await expect(mitNetzSchutz(async () => 42)).resolves.toEqual({ ok: true, daten: 42 })
  })

  it('gibt dem Aufruf ein Signal mit', async () => {
    const ergebnis = await mitNetzSchutz(async (signal) => signal instanceof AbortSignal)
    expect(ergebnis).toEqual({ ok: true, daten: true })
  })

  it('wirft nie: abgerissene Verbindung ergibt „netz"', async () => {
    const ergebnis = await mitNetzSchutz(() => Promise.reject(new TypeError('Failed to fetch')))
    expect(ergebnis).toMatchObject({ ok: false, art: 'netz' })
  })

  it('nach dem Zeitlimit ergibt „zeit"', async () => {
    const ergebnis = await mitNetzSchutz(
      (signal) =>
        new Promise((_, ablehnen) => {
          signal.addEventListener('abort', () => ablehnen(signal.reason))
        }),
      { zeitlimitMs: 5 }
    )
    expect(ergebnis).toMatchObject({ ok: false, art: 'zeit' })
  })

  it('Gegenprobe: ein anderer Wurf ergibt „server", nicht „netz"', async () => {
    const programmfehler = new TypeError("Cannot read properties of undefined (reading 'x')")
    const ergebnis = await mitNetzSchutz(() => Promise.reject(programmfehler))
    expect(ergebnis).toEqual({ ok: false, art: 'server', fehler: programmfehler })
  })
})
