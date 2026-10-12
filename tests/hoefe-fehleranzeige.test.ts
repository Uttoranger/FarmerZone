/**
 * /hoefe meldet an Sentry, wenn die Seite ihre Fehleranzeige wirklich
 * ausliefert (Nr. 56, Lauf 8 §6) — eine Warnung mit Tag sichtbar=ja,
 * höchstens einmal je Instanz und zehn Minuten. Beim Abbruch
 * JAVASCRIPT-NEXTJS-9 war bisher nicht zu erkennen, ob eine Kundin die
 * Fehleranzeige sah oder nur der Neubau im Hintergrund scheiterte. Regel und
 * Zustand der Meldung prüft tests/oeffentlich-lesen.test.ts.
 *
 * Die Seite läuft echt (Server-Komponente, ohne Netz und Datenbank). Hofliste,
 * Shell und Teile sind Attrappen mit Merkmal — so beweist das Merkmal im HTML,
 * dass die Meldung genau dann kommt, wenn die Fehleranzeige im Ergebnis steht.
 * Je Fall ein frisch geladenes Modul: „schon gemeldet" lebt auf Modulebene.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const hofliste = vi.hoisted(() => ({ laden: vi.fn() }))

vi.mock('@/server/queries/oeffentliche-hoefe', () => ({ ladeOeffentlicheHoefe: hofliste.laden }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children: ReactNode }) => createElement('main', null, children),
}))
vi.mock('@/components/hoefe/hoefe-client', () => ({ HoefeClient: () => createElement('p', null, 'LISTE') }))
vi.mock('@/components/hoefe/entdecken-teile', () => ({
  HoefeFehler: () => createElement('p', null, 'FEHLERANZEIGE'),
  KeineHoefe: () => createElement('p', null, 'KEINE-HOEFE'),
}))

let seite: typeof import('@/app/(public)/hoefe/page')
let sentry: typeof import('@sentry/nextjs')
let meldung: string

beforeEach(async () => {
  // resetModules lädt die Seite und ihren Modul-Zustand frisch; die Attrappen
  // bleiben dieselben (Register der Mocks) — ihre Aufrufe also leeren.
  vi.clearAllMocks()
  vi.resetModules()
  hofliste.laden.mockReset()
  seite = await import('@/app/(public)/hoefe/page')
  sentry = await import('@sentry/nextjs')
  meldung = (await import('@/server/oeffentlich-lesen')).FEHLERANZEIGE_MELDUNG
})

async function rendern(): Promise<string> {
  return renderToStaticMarkup(await seite.default())
}

function fehleranzeigeMeldungen(): unknown[][] {
  return vi.mocked(sentry.captureMessage).mock.calls.filter(([satz]) => satz === meldung)
}

describe('/hoefe — die Fehleranzeige geht an Sentry, wenn sie ausgeliefert wird (Nr. 56)', () => {
  it('scheitert die Hofliste: Fehleranzeige im HTML und eine Meldung — auch nach dem zweiten Aufruf gleich danach nur eine', async () => {
    hofliste.laden.mockRejectedValue(new Error('Datenbank nicht erreichbar'))

    expect(await rendern()).toContain('FEHLERANZEIGE')
    expect(fehleranzeigeMeldungen()).toHaveLength(1)
    expect(await rendern()).toContain('FEHLERANZEIGE')
    expect(fehleranzeigeMeldungen()).toHaveLength(1)
    // Der Fehler selbst geht wie bisher je Aufruf getrennt hinaus.
    expect(sentry.captureException).toHaveBeenCalledTimes(2)
  })

  it('Gegenprobe: ohne Höfe und mit Höfen keine Meldung — dort gibt es keine Fehleranzeige', async () => {
    hofliste.laden.mockResolvedValueOnce([]).mockResolvedValueOnce([{ slug: 'hof-test' }])

    expect(await rendern()).toContain('KEINE-HOEFE')
    expect(await rendern()).toContain('LISTE')
    expect(sentry.captureMessage).not.toHaveBeenCalled()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })
})
