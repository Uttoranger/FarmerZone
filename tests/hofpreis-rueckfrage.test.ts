/**
 * Rückfrage vor dem Stichtag „Hofpreis-Modell ab“ (Lauf 34, Nr. 303 B1;
 * src/app/admin/einstellungen/hofpreis-stichtag.tsx).
 *
 * Prüfstand ohne DOM (TESTING_GUIDELINES §1, Vorbild tests/frisch-bestaetigen.test.ts):
 * `useState`, `useTransition` und `useId` sind ersetzt, die Komponente läuft als
 * Funktion, ihr Baum wird gelesen (Kinder rendert er nicht); Absenden und Knöpfe
 * werden über ihre Griffe im Baum ausgelöst. Die Action steckt hinter
 * `useFrischBestaetigt` — eine Attrappe, deren `ausfuehren` gezählt wird.
 *
 * Beweist:
 *  - „Stichtag speichern“ ruft die Action nicht mehr sofort, sondern öffnet die
 *    Rückfrage (BestellDialog) mit Titel, drei Punkten und Satz.
 *  - „Abbrechen“ schließt sie ohne Aufruf.
 *  - Erst „Mit Passkey speichern“ ruft `ausfuehren({ tag })` — genau einmal.
 *  - Verletzt der Tag die Regel (Vergangenheit), öffnet keine Rückfrage, der Satz
 *    der Regel steht da.
 * Gegenprobe: Auf dem alten Weg (Absenden ruft sofort) schlägt der erste Fall an —
 * belegt im Bericht 303 mit dem roten Lauf vor dem Umbau.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const pruefstand = vi.hoisted(() => {
  let zellen: unknown[] = []
  let zeiger = 0
  let komponente: () => unknown = () => null
  let baum: unknown = null

  function rendere(): void {
    zeiger = 0
    baum = komponente()
  }

  return {
    starte(neu: () => unknown): void {
      zellen = []
      komponente = neu
      rendere()
    },
    rendere,
    baum: (): unknown => baum,
    async zuRuhe(): Promise<void> {
      for (let i = 0; i < 5; i++) await new Promise((weiter) => setTimeout(weiter, 0))
      rendere()
    },
    useState<T>(anfang: T): [T, (wert: T | ((vorher: T) => T)) => void] {
      const i = zeiger++
      if (!(i in zellen)) {
        const zelle = {
          wert: anfang,
          setze: (wert: T | ((vorher: T) => T)) => {
            zelle.wert = typeof wert === 'function' ? (wert as (vorher: T) => T)(zelle.wert) : wert
          },
        }
        zellen[i] = zelle
      }
      const zelle = zellen[i] as { wert: T; setze: (wert: T | ((vorher: T) => T)) => void }
      return [zelle.wert, zelle.setze]
    },
    useTransition(): [boolean, (fn: () => Promise<void> | void) => void] {
      zeiger++
      return [false, (fn) => void fn()]
    },
    useId(): string {
      return `id-${zeiger++}`
    },
  }
})

vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  return { ...echt, useState: pruefstand.useState, useTransition: pruefstand.useTransition, useId: pruefstand.useId }
})

const frisch = vi.hoisted(() => ({ ausfuehren: vi.fn() }))
vi.mock('@/components/admin/frisch-bestaetigen', () => ({ useFrischBestaetigt: () => ({ ausfuehren: frisch.ausfuehren, dialog: null }) }))
vi.mock('@/server/actions/plattform-einstellung', () => ({ speichereHofpreisStichtag: vi.fn() }))
const router = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

import { HofpreisStichtag } from '@/app/admin/einstellungen/hofpreis-stichtag'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { HOFPREIS_RUECKFRAGE_TEXT, HOFPREIS_STICHTAG_FEHLER } from '@/lib/plattform-einstellung'
import { findeElement } from './element-suche'

const DATEN = { tag: '2027-02-01', stichtagIso: null, erreicht: false, jetzt: '2026-11-11T09:00:00.000Z' }

type Dialog = { offen: boolean; titel: string; onOffenChange: (offen: boolean) => void; hauptaktion: { text: string; onClick: () => void; ton: string }; children: unknown }

function dialog(): Dialog {
  const fund = findeElement(pruefstand.baum(), BestellDialog)
  if (!fund) throw new Error('Keine Rückfrage (BestellDialog) im Baum')
  return fund.props as unknown as Dialog
}

/** Den Tag ins Feld tippen und das Formular absenden — wie „Stichtag speichern“. */
function tippeUndSpeichere(tag: string): void {
  const feld = findeElement(pruefstand.baum(), 'input')
  ;(feld?.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: tag } })
  pruefstand.rendere()
  const formular = findeElement(pruefstand.baum(), 'form')
  ;(formular?.props.onSubmit as (e: { preventDefault: () => void }) => void)({ preventDefault: () => undefined })
  pruefstand.rendere()
}

/** Alle Texte im Baum (ohne zu rendern), für Titel, Punkte und Satz der Rückfrage. */
function texte(knoten: unknown): string[] {
  if (knoten == null || typeof knoten === 'boolean') return []
  if (typeof knoten === 'string' || typeof knoten === 'number') return [String(knoten)]
  if (Array.isArray(knoten)) return knoten.flatMap(texte)
  const props = (knoten as { props?: { children?: unknown } }).props
  return props ? texte(props.children) : []
}

beforeEach(() => {
  vi.clearAllMocks()
  frisch.ausfuehren.mockResolvedValue({ ok: true })
  pruefstand.starte(() => HofpreisStichtag({ daten: DATEN }))
})

describe('„Stichtag speichern“ fragt zuerst nach', () => {
  it('öffnet die Rückfrage mit Titel, Punkten und Satz — die Action läuft noch nicht', () => {
    expect(dialog().offen).toBe(false)
    tippeUndSpeichere('2027-01-15')
    const d = dialog()
    expect(d.offen).toBe(true)
    expect(frisch.ausfuehren).not.toHaveBeenCalled()
    expect(d.titel).toBe(HOFPREIS_RUECKFRAGE_TEXT.titel('2027-01-15'))
    expect(d.hauptaktion).toMatchObject({ text: HOFPREIS_RUECKFRAGE_TEXT.knopf, ton: 'gruen' })
    const inhalt = texte(d.children).join('')
    for (const satz of [...HOFPREIS_RUECKFRAGE_TEXT.punkte, HOFPREIS_RUECKFRAGE_TEXT.satz]) expect(inhalt).toContain(satz)
  })

  it('„Abbrechen“ schließt ohne Aufruf', async () => {
    tippeUndSpeichere('2027-01-15')
    dialog().onOffenChange(false)
    await pruefstand.zuRuhe()
    expect(dialog().offen).toBe(false)
    expect(frisch.ausfuehren).not.toHaveBeenCalled()
  })

  it('erst „Mit Passkey speichern“ ruft ausfuehren({ tag }) — genau einmal; danach zu und neu geladen', async () => {
    tippeUndSpeichere('2027-01-15')
    dialog().hauptaktion.onClick()
    await pruefstand.zuRuhe()
    expect(frisch.ausfuehren).toHaveBeenCalledTimes(1)
    expect(frisch.ausfuehren).toHaveBeenCalledWith({ tag: '2027-01-15' })
    expect(dialog().offen).toBe(false)
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })

  it('ein Fehler der Action bleibt in der Rückfrage stehen, nichts neu geladen', async () => {
    frisch.ausfuehren.mockResolvedValue({ error: 'Nicht bestätigt.' })
    tippeUndSpeichere('2027-01-15')
    dialog().hauptaktion.onClick()
    await pruefstand.zuRuhe()
    expect(dialog().offen).toBe(true)
    expect(findeElement(dialog().children, DialogFehler)?.props.text).toBe('Nicht bestätigt.')
    expect(router.refresh).not.toHaveBeenCalled()
  })

  it('Regel verletzt (Tag in der Vergangenheit): keine Rückfrage, der Satz der Regel', () => {
    tippeUndSpeichere('2026-11-01')
    expect(dialog().offen).toBe(false)
    expect(frisch.ausfuehren).not.toHaveBeenCalled()
    // Der erste DialogFehler im Baum ist der der Karte (vor der Rückfrage).
    expect(findeElement(pruefstand.baum(), DialogFehler)?.props.text).toBe(HOFPREIS_STICHTAG_FEHLER.zukunft)
  })
})
