/**
 * useFrischBestaetigt (Register N20; Nr. 115, src/components/admin/
 * frisch-bestaetigen.tsx) — der Hook ändert nach einem await Zustand (Dialog
 * auf), also der Prüfstand „zwei Aufrufe aus demselben Render"
 * (TESTING_GUIDELINES §2, Vorbild tests/use-cart.test.ts): Zustand je
 * Aufrufstelle, neues Rendern nach einer Änderung von außen. Die Anmeldung mit
 * Passkey ist gemockt (auth-client-passkey), die Aktion eine Attrappe.
 *
 * Beweist:
 *  - Ein normales Ergebnis geht durch, ohne Dialog.
 *  - `{ error: 'frisch' }` öffnet den Dialog; nach der Bestätigung läuft die
 *    Aktion genau EINMAL erneut — auch bei zwei Aufrufen aus demselben
 *    Render (ein Dialog, jeder Aufruf einmal wiederholt).
 *  - Abbrechen: nichts wiederholt, der Satz „Nicht bestätigt …".
 *  - Ein Fehler des Passkeys (fremdes Konto) lässt den Dialog offen und
 *    wiederholt nichts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pruefstand = vi.hoisted(() => {
  let zellen: unknown[] = []
  let zeiger = 0
  let geplant = false
  let komponente: () => void = () => undefined

  function rendere(): void {
    zeiger = 0
    komponente()
  }

  return {
    starte(neu: () => void): void {
      zellen = []
      komponente = neu
      rendere()
    },
    async zuRuhe(): Promise<void> {
      for (let i = 0; i < 5; i++) await new Promise((weiter) => setTimeout(weiter, 0))
    },
    useState<T>(anfang: T): [T, (wert: T | ((vorher: T) => T)) => void] {
      const i = zeiger++
      if (!(i in zellen)) {
        const zelle = {
          wert: anfang,
          setze: (wert: T | ((vorher: T) => T)) => {
            zelle.wert = typeof wert === 'function' ? (wert as (vorher: T) => T)(zelle.wert) : wert
            if (geplant) return
            // Wie React: Eine Änderung von außen rendert danach, nicht mitten im Aufruf.
            geplant = true
            setTimeout(() => {
              geplant = false
              rendere()
            }, 0)
          },
        }
        zellen[i] = zelle
      }
      const zelle = zellen[i] as { wert: T; setze: (wert: T | ((vorher: T) => T)) => void }
      return [zelle.wert, zelle.setze]
    },
    useRef<T>(anfang: T): { current: T } {
      const i = zeiger++
      if (!(i in zellen)) zellen[i] = { current: anfang }
      return zellen[i] as { current: T }
    },
    useCallback<T>(fn: T): T {
      zeiger++
      return fn
    },
  }
})

vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  return { ...echt, useState: pruefstand.useState, useRef: pruefstand.useRef, useCallback: pruefstand.useCallback }
})

const passkey = vi.hoisted(() => ({ signIn: vi.fn() }))
vi.mock('@/lib/auth-client-passkey', () => ({ passkeySignIn: { passkey: passkey.signIn } }))

import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'
import { ADMIN_ANMELDEN_FEHLER, FRISCH_TEXT } from '@/lib/admin-anmeldung'

type DialogProps = { offen: boolean; fehler: string | null; onBestaetigen: () => void; onOffenChange: (offen: boolean) => void }
type Aktion = (id: string) => Promise<{ ok: true; id: string } | { error: string }>

let zuletzt: ReturnType<typeof useFrischBestaetigt<[string], Awaited<ReturnType<Aktion>>>>

function starte(aktion: Aktion): void {
  pruefstand.starte(() => {
    zuletzt = useFrischBestaetigt(aktion)
  })
}

const dialog = (): DialogProps => zuletzt.dialog.props as DialogProps

/** Erst „frisch", danach ok — je Kennung. */
function aktionErstFrisch(): ReturnType<typeof vi.fn<Aktion>> {
  const gesehen = new Set<string>()
  return vi.fn<Aktion>(async (id) => {
    if (gesehen.has(id)) return { ok: true, id }
    gesehen.add(id)
    return { error: 'frisch' }
  })
}

beforeEach(() => {
  passkey.signIn.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useFrischBestaetigt', () => {
  it('ein normales Ergebnis geht durch — kein Dialog', async () => {
    const aktion = vi.fn<Aktion>(async (id) => ({ ok: true, id }))
    starte(aktion)

    expect(await zuletzt.ausfuehren('a')).toEqual({ ok: true, id: 'a' })
    await pruefstand.zuRuhe()

    expect(dialog().offen).toBe(false)
    expect(aktion).toHaveBeenCalledTimes(1)
  })

  it('ein Aufruf (Nr. 154, z. B. Freischalten): nach „frisch" der Dialog, nach der Bestätigung genau ein zweiter Aufruf mit denselben Argumenten', async () => {
    const aktion = aktionErstFrisch()
    passkey.signIn.mockResolvedValue({ data: {}, error: null })
    starte(aktion)

    const ergebnis = zuletzt.ausfuehren('hof_1')
    await pruefstand.zuRuhe()
    expect(dialog().offen).toBe(true)
    expect(aktion).toHaveBeenCalledTimes(1)

    dialog().onBestaetigen()
    expect(await ergebnis).toEqual({ ok: true, id: 'hof_1' })
    await pruefstand.zuRuhe()

    expect(aktion).toHaveBeenCalledTimes(2)
    expect(aktion.mock.calls.map(([id]) => id)).toEqual(['hof_1', 'hof_1'])
    expect(dialog().offen).toBe(false)
  })

  it('zwei Aufrufe aus demselben Render: EIN Dialog, nach der Bestätigung jeder genau einmal wiederholt', async () => {
    const aktion = aktionErstFrisch()
    passkey.signIn.mockResolvedValue({ data: {}, error: null })
    starte(aktion)
    const { ausfuehren } = zuletzt

    const erst = ausfuehren('a')
    const zweit = ausfuehren('b')
    await pruefstand.zuRuhe()
    expect(dialog().offen).toBe(true)
    expect(aktion).toHaveBeenCalledTimes(2)

    dialog().onBestaetigen()
    expect(await erst).toEqual({ ok: true, id: 'a' })
    expect(await zweit).toEqual({ ok: true, id: 'b' })
    await pruefstand.zuRuhe()

    expect(passkey.signIn).toHaveBeenCalledTimes(1)
    expect(aktion).toHaveBeenCalledTimes(4)
    expect(dialog().offen).toBe(false)
  })

  it('verlangt die Aktion nach der Bestätigung wieder „frisch", kommt der Satz — kein drittes Mal', async () => {
    const aktion = vi.fn<Aktion>(async () => ({ error: 'frisch' }))
    passkey.signIn.mockResolvedValue({ data: {}, error: null })
    starte(aktion)

    const ergebnis = zuletzt.ausfuehren('a')
    await pruefstand.zuRuhe()
    dialog().onBestaetigen()

    expect(await ergebnis).toEqual({ error: FRISCH_TEXT.nichtBestaetigt })
    expect(aktion).toHaveBeenCalledTimes(2)
  })

  it('Abbrechen: nichts wiederholt, der Satz „Nicht bestätigt"', async () => {
    const aktion = aktionErstFrisch()
    starte(aktion)

    const ergebnis = zuletzt.ausfuehren('a')
    await pruefstand.zuRuhe()
    dialog().onOffenChange(false)

    expect(await ergebnis).toEqual({ error: FRISCH_TEXT.nichtBestaetigt })
    expect(aktion).toHaveBeenCalledTimes(1)
    expect(passkey.signIn).not.toHaveBeenCalled()
  })

  it('Passkey eines anderen Kontos: der Satz im Dialog, der Dialog bleibt offen, nichts wiederholt', async () => {
    const aktion = aktionErstFrisch()
    passkey.signIn.mockResolvedValue({ data: null, error: { code: 'PASSKEY_FREMDES_KONTO', status: 401, statusText: 'UNAUTHORIZED' } })
    starte(aktion)

    void zuletzt.ausfuehren('a')
    await pruefstand.zuRuhe()
    dialog().onBestaetigen()
    await pruefstand.zuRuhe()

    expect(dialog().offen).toBe(true)
    expect(dialog().fehler).toBe(ADMIN_ANMELDEN_FEHLER.fremdesKonto)
    expect(aktion).toHaveBeenCalledTimes(1)
  })
})
