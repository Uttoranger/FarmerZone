/**
 * „Bar gesperrt“ (Register N38, Ergänzung 5.11.2026; Rückfragen Lauf 30, Punkt 5).
 *
 * Ursache: Sperrte eine offene Monatsabrechnung die Barzahlung, hieß die Marke auf
 * /settings/payments „Pausiert“ und die Karte auf Heute „Barzahlung ist pausiert“.
 * „Pausiert“ ist aber der Zustand des ganzen Hofs (Urlaub und Pause) — der Hof
 * hielt eine Abrechnungssperre für seine eigene Pause.
 *
 * Beweist:
 *  - Die Marke der Karte „Bar bei Abholung“ heißt bei der Sperre „Bar gesperrt“.
 *  - Jede Stelle dieses Zustands (Marke, Satz der Karte, Bar-Spalte des
 *    Rechenbeispiels, Karte auf Heute samt Rückbuchung) sagt „gesperrt“, nie „pausiert“.
 *  - Gegenprobe: Der Hofzustand „Pausiert“ (Schild und Zustandszeile) bleibt unberührt,
 *    und die Suche nach „pausiert“ schlägt am alten Wortlaut an.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/server/actions/lastschrift', () => ({ starteLastschrift: vi.fn(), oeffneRechnung: vi.fn() }))

import { BAR_KARTE_TEXT, barKarte, konditionenRechenbeispiel, type KonditionenHof } from '@/lib/hof-einstellungen'
import { LASTSCHRIFT_TEXT } from '@/lib/konditionen'
import { ZUSTANDSZEILE_TEXT, hofZustand } from '@/lib/mein-hof'
import { LastschriftSperreKarte } from '@/components/heute/lastschrift-karte'
import type { GebuehrLage } from '@/lib/plattformgebuehr'

const STICHTAG = new Date('2027-02-01T00:00:00+01:00')
const NACH = new Date('2027-03-03T10:00:00+01:00')

/** Hofpreis-Modell, Einzug fällig, Lastschrift da — nur die Monatsabrechnung sperrt. */
const GESPERRT: GebuehrLage = {
  modell: 'hofpreis',
  hundertstel: 600,
  einzugAb: STICHTAG,
  barMandatPflicht: true,
  sepaMandatAm: STICHTAG,
  barGesperrt: true,
}

const HOF: KonditionenHof = {
  tarif: null,
  serviceFeePercent: '5',
  serviceFeeMinCents: 50,
  serviceFeeActiveFrom: new Date('2026-01-01T00:00:00Z'),
  platformFeePercent: '0',
  gruendungBis: null,
  produkteImShop: 9,
  abholzeitenJeWoche: 3,
}

const PAUSIERT = /pausiert/i

describe('Bar gesperrt: ein Wort für die Sperre durch eine Monatsabrechnung', () => {
  it('die Marke auf /settings/payments heißt „Bar gesperrt“, mit dem Weg zu „Deine Konditionen“', () => {
    const karte = barKarte(GESPERRT, NACH, { einzugAb: null })
    expect(karte.marke).toBe('Bar gesperrt')
    expect(karte).toMatchObject({ ton: 'offen', satz: BAR_KARTE_TEXT.gesperrtSatz, zuKonditionen: true, lastschrift: false })
    // Gegenprobe: ohne Sperre ist es „Aktiv“ — die Marke hängt allein an der Sperre.
    expect(barKarte({ ...GESPERRT, barGesperrt: false }, NACH, { einzugAb: null }).marke).toBe('Aktiv')
  })

  it('jede Stelle dieses Zustands sagt „gesperrt“, nie „pausiert“', () => {
    const rechenbeispiel = konditionenRechenbeispiel(HOF, NACH, GESPERRT).bar.satz ?? ''
    const stellen = {
      marke: barKarte(GESPERRT, NACH, { einzugAb: null }).marke,
      satz: BAR_KARTE_TEXT.gesperrtSatz,
      rechenbeispiel,
      heuteTitel: LASTSCHRIFT_TEXT.heuteTitel,
      zurueckgebucht: LASTSCHRIFT_TEXT.zurueckgebuchtSatz('März 2028'),
    }
    expect(rechenbeispiel).toBe(BAR_KARTE_TEXT.gesperrtSatz)
    for (const [stelle, text] of Object.entries(stellen)) {
      expect(text, stelle).toMatch(/gesperrt/)
      expect(text, stelle).not.toMatch(PAUSIERT)
    }
    // Gegenprobe: die Suche schlägt am alten Wortlaut an.
    expect('Barzahlung ist pausiert, solange eine Monatsabrechnung offen ist.').toMatch(PAUSIERT)
    expect('Pausiert').toMatch(PAUSIERT)
  })

  it('die Karte auf Heute zeigt den Titel „Barzahlung ist gesperrt“ — offen und zurückgebucht', () => {
    for (const stand of ['offen', 'zurueckgebucht'] as const) {
      const h = renderToStaticMarkup(createElement(LastschriftSperreKarte, { abrechnungId: 'a1', monatText: 'März 2028', stand }))
      expect(h).toContain('Barzahlung ist gesperrt')
      expect(h).not.toMatch(PAUSIERT)
    }
  })

  it('Gegenprobe: der Hofzustand „Pausiert“ bleibt (Schild und Zustandszeile)', () => {
    const zustand = hofZustand({ isActive: true, isPaused: true, approvedAt: new Date('2026-10-01T00:00:00Z'), archivedAt: null })
    expect(zustand.schild?.text).toBe('Pausiert')
    expect(ZUSTANDSZEILE_TEXT.pausiert.titel).toBe('Pausiert')
  })
})
