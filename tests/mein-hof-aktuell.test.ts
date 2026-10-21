/**
 * Mein Hof › Hofseite: die erste Zeile „Aktuell vom Hof“ (Register E12,
 * Ergänzung Nr. 129, Runde 1; Board system-k2-beitraege-v2, Abschnitt 5).
 *
 * Beweist (die Seite wird als Funktion aufgerufen, gerendert wird nichts —
 * TESTING_GUIDELINES §2, findeElement):
 *  - Die Seite lädt den laufenden Beitrag des EIGENEN Hofs (farmId aus der
 *    Sitzung) und reicht die Zeile an BEIDE Fassungen weiter: die Liste unter
 *    lg (AbschnitteListe) und den Editor ab lg (HofseiteEditor).
 *  - Sie lädt NUR den laufenden Beitrag (ladeLaufendenBeitrag, Runde 2) — nicht
 *    die Abfragen für den Anstoß in Heute (ladeDeinenBeitrag).
 *  - Ohne laufenden Beitrag „Kein Beitrag“ mit „Neuer Beitrag ›“.
 *  - Gegenprobe Ladefehler: Die Seite steht trotzdem, die Zeile fehlt (statt
 *    falsch „Kein Beitrag“ zu sagen), der Fehler geht an Sentry.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Abfragen = typeof import('@/server/queries/dashboard')

const { ladeLaufendenBeitrag, ladeDeinenBeitrag, captureException } = vi.hoisted(() => ({
  ladeLaufendenBeitrag: vi.fn<Abfragen['ladeLaufendenBeitrag']>(),
  ladeDeinenBeitrag: vi.fn<Abfragen['ladeDeinenBeitrag']>(),
  captureException: vi.fn(),
}))

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({
  redirect: (ziel: string) => {
    throw new Error(`redirect ${ziel}`)
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: async () => ({ user: { id: 'nutzerin-a' } }) } } }))
vi.mock('@/server/queries/farm', () => ({
  getOwnerFarm: async () => ({ id: 'hof-a', slug: 'testhof-a', name: 'Testhof A', isPaused: false }),
  getMeinHofKopf: async () => ({ adresse: { anzeige: '' } }),
  getFarmSettings: async () => ({}),
}))
vi.mock('@/server/queries/appearance', () => ({ getAppearanceData: async () => ({}) }))
vi.mock('@/server/queries/status-posts', () => ({ getStatusPostsForFarm: vi.fn(), zaehleWhatsAppAbonnentinnen: vi.fn() }))
vi.mock('@/server/queries/mein-hof-zahl', () => ({ zaehleBeitraege: async () => 1 }))
vi.mock('@/server/queries/dashboard', () => ({ ladeLaufendenBeitrag, ladeDeinenBeitrag }))
vi.mock('@/lib/hofseite-fortschritt', () => ({ hofseiteStand: () => ({}), hofseiteFortschritt: () => ({ gruppen: [] }) }))
// Die Bausteine selbst prüfen eigene Tests; hier zählen nur ihre Props.
vi.mock('@/components/farmer/hofseite-editor', () => ({ HofseiteEditor: () => null }))
vi.mock('@/components/mein-hof/abschnitte-liste', () => ({ AbschnitteListe: () => null }))
vi.mock('@/components/mein-hof/seitenkopf', () => ({ MeinHofSeitenkopf: () => null }))
vi.mock('@/components/mein-hof/beitraege-reiter', () => ({ BeitraegeReiter: () => null }))
vi.mock('@/components/mein-hof/mein-hof-ansicht', () => ({ MeinHofAnsicht: ({ children }: { children: unknown }) => children }))

import FarmPageOwnerRoute from '@/app/(hof)/farm-page/page'
import { HofseiteEditor } from '@/components/farmer/hofseite-editor'
import { AbschnitteListe } from '@/components/mein-hof/abschnitte-liste'
import { BEITRAEGE_HREF } from '@/lib/bauern-navigation'
import { NEUER_BEITRAG_HREF, type DeinBeitrag } from '@/lib/heute'
import { BEITRAG_ANLAESSE } from '@/lib/beitrag-anlass'
import { findeElement } from './element-suche'

const JETZT = new Date('2026-10-20T10:00:00.000Z')
const TAG = 24 * 60 * 60_000

const AKTIV: DeinBeitrag = {
  id: 'beitrag-a',
  titel: 'Die ersten Kürbisse sind da',
  anlass: BEITRAG_ANLAESSE[0],
  foto: null,
  fotoAusschnitt: null,
  veroeffentlicht: new Date(JETZT.getTime() - 2 * 60 * 60_000).toISOString(),
  endet: new Date(JETZT.getTime() + 6 * TAG + 60_000).toISOString(),
  emailAnzahl: 0,
  whatsappAnzahl: 0,
}

async function zeilen(): Promise<{ liste: unknown; editor: unknown }> {
  const baum = await FarmPageOwnerRoute({ searchParams: Promise.resolve({}) })
  return { liste: findeElement(baum, AbschnitteListe)?.props.aktuell, editor: findeElement(baum, HofseiteEditor)?.props.aktuell }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(JETZT)
  ladeLaufendenBeitrag.mockReset()
  ladeDeinenBeitrag.mockReset()
  captureException.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Mein Hof › Hofseite — „Aktuell vom Hof“', () => {
  it('mit laufendem Beitrag: Titel und „läuft noch …“ in der Liste UND im Editor, geladen für den eigenen Hof', async () => {
    ladeLaufendenBeitrag.mockResolvedValue(AKTIV)
    const { liste, editor } = await zeilen()
    const erwartet = {
      titel: 'Aktuell vom Hof',
      wert: 'Die ersten Kürbisse sind da · läuft noch 6 Tage',
      link: { text: 'Beiträge', href: BEITRAEGE_HREF },
    }
    expect(liste).toEqual(erwartet)
    expect(editor).toEqual(erwartet)
    expect(ladeLaufendenBeitrag).toHaveBeenCalledWith('hof-a', JETZT)
    // Gegenprobe: Die Abfragen für den Anstoß (14 Tage, Produkte im Shop) braucht Mein Hof nicht.
    expect(ladeDeinenBeitrag).not.toHaveBeenCalled()
  })

  it('ohne laufenden Beitrag: „Kein Beitrag“ mit „Neuer Beitrag ›“', async () => {
    ladeLaufendenBeitrag.mockResolvedValue(null)
    const { liste, editor } = await zeilen()
    const erwartet = { titel: 'Aktuell vom Hof', wert: 'Kein Beitrag', link: { text: 'Neuer Beitrag', href: NEUER_BEITRAG_HREF } }
    expect(liste).toEqual(erwartet)
    expect(editor).toEqual(erwartet)
  })

  it('Gegenprobe Ladefehler: die Seite steht, die Zeile fehlt, Sentry bekommt den Fehler', async () => {
    ladeLaufendenBeitrag.mockRejectedValue(new Error('Verbindung weg'))
    const { liste, editor } = await zeilen()
    expect(liste).toBeUndefined()
    expect(editor).toBeUndefined()
    expect(captureException).toHaveBeenCalledTimes(1)
  })
})
