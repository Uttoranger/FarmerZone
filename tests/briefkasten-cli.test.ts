/**
 * Tests für das Triage-CLI (scripts/briefkasten.ts, Sprint fehlerbriefkasten
 * Teil E) — ohne Datenbank, über den Leser-Ersatz.
 *
 * Beweist: ohne TRIAGE_DATABASE_URL bricht das Skript ab und rührt KEINE
 * Verbindung an — auch wenn DATABASE_URL gesetzt ist (kein Fallback); mit URL
 * wird genau diese an den Leser gegeben; der Export enthält Kurznummer,
 * Kontext und Text; show sucht per Kurznummer; der Leser wird immer
 * geschlossen; die Argumente werden robust gelesen.
 */
import { describe, it, expect, vi } from 'vitest'
import { starte, parseArgs, FEHLT_TRIAGE_URL, HILFE, type Leser } from '../scripts/briefkasten'
import type { ExportMeldung } from '@/lib/briefkasten-export'

const MELDUNG: ExportMeldung = {
  id: 'cmfmeldung0000000001abc',
  art: 'FEHLER',
  status: 'NEU',
  text: 'Abholzeiten speichern geht nicht.\nEs kommt keine Meldung.',
  createdAt: new Date('2026-09-01T10:00:00Z'),
  seiteUrl: 'https://farmerzone.at/settings',
  userAgent: 'Mozilla/5.0 (iPhone)',
  viewport: '375x667',
  diagKennung: 'S71',
  screenshotUrl: null,
  customerEmail: null,
  clusterKey: null,
  triageNotiz: null,
  duplikatVonId: null,
  sprintName: null,
  triagedAt: null,
  antwortAnMelder: null,
  farm: { name: 'Biohof Sonnleitner', slug: 'sonnleitner' },
}

function leserErsatz(meldungen: ExportMeldung[] = [MELDUNG]) {
  const leser: Leser = {
    lade: vi.fn(async () => meldungen),
    finde: vi.fn(async (ziel: string) => meldungen.find((m) => m.id.startsWith(ziel)) ?? null),
    schliessen: vi.fn(async () => {}),
  }
  const fabrik = vi.fn(() => leser)
  return { leser, fabrik }
}

const JETZT = new Date('2026-09-14T05:00:00Z')

describe('briefkasten — Nur-Lese-Verbindung', () => {
  it('bricht ohne TRIAGE_DATABASE_URL ab und ruft keinen Leser — auch mit DATABASE_URL', async () => {
    const { fabrik } = leserErsatz()
    const result = await starte(['export'], { DATABASE_URL: 'postgresql://schreib@host/db' }, fabrik, JETZT)
    expect(result.code).toBe(2)
    expect(result.ausgabe).toBe(FEHLT_TRIAGE_URL)
    expect(result.ausgabe).toMatch(/TRIAGE_DATABASE_URL/)
    expect(fabrik).not.toHaveBeenCalled()
  })

  it('wertet eine leere TRIAGE_DATABASE_URL wie eine fehlende', async () => {
    const { fabrik } = leserErsatz()
    const result = await starte(['list'], { TRIAGE_DATABASE_URL: '   ', DATABASE_URL: 'postgresql://x' }, fabrik, JETZT)
    expect(result.code).toBe(2)
    expect(fabrik).not.toHaveBeenCalled()
  })

  it('gibt genau die Triage-URL an den Leser, nie DATABASE_URL', async () => {
    const { fabrik } = leserErsatz()
    await starte(
      ['list'],
      { TRIAGE_DATABASE_URL: 'postgresql://triage_leser@host/db', DATABASE_URL: 'postgresql://schreib@host/db' },
      fabrik,
      JETZT
    )
    expect(fabrik).toHaveBeenCalledWith('postgresql://triage_leser@host/db')
  })

  it('schließt den Leser auch dann, wenn das Lesen scheitert', async () => {
    const { leser, fabrik } = leserErsatz()
    vi.mocked(leser.lade).mockRejectedValue(new Error('Verbindung weg'))
    await expect(starte(['list'], { TRIAGE_DATABASE_URL: 'postgresql://t@h/db' }, fabrik, JETZT)).rejects.toThrow('Verbindung weg')
    expect(leser.schliessen).toHaveBeenCalledTimes(1)
  })
})

describe('briefkasten — Befehle', () => {
  const ENV = { TRIAGE_DATABASE_URL: 'postgresql://t@h/db' }

  it('export: Markdown mit Kurznummer, Kontext und Text', async () => {
    const { fabrik } = leserErsatz()
    const { code, ausgabe } = await starte(['export'], ENV, fabrik, JETZT)
    expect(code).toBe(0)
    expect(ausgabe).toContain('# Briefkasten — 1 Meldung')
    expect(ausgabe).toContain('## cmfmeldu · Fehler · Neu')
    expect(ausgabe).toContain('- Kontext: https://farmerzone.at/settings · 375x667 · Mozilla/5.0 (iPhone)')
    expect(ausgabe).toContain('- Kennung: S71')
    expect(ausgabe).toContain('- Hof: Biohof Sonnleitner (/sonnleitner)')
    expect(ausgabe).toContain('> Abholzeiten speichern geht nicht.')
    expect(ausgabe).toContain('> Es kommt keine Meldung.')
    expect(ausgabe).toContain('Nur lesen.')
  })

  it('export: gibt Status- und Art-Filter an den Leser', async () => {
    const { leser, fabrik } = leserErsatz()
    await starte(['export', '--status', 'erledigt,kein_fehler', '--art', 'wunsch'], ENV, fabrik, JETZT)
    expect(leser.lade).toHaveBeenCalledWith({ status: ['ERLEDIGT', 'KEIN_FEHLER'], art: 'WUNSCH' })
  })

  it('export ohne Treffer: leerer Briefkasten, kein Fehler', async () => {
    const { fabrik } = leserErsatz([])
    const { code, ausgabe } = await starte(['export'], ENV, fabrik, JETZT)
    expect(code).toBe(0)
    expect(ausgabe).toContain('_Keine Meldungen für diesen Filter._')
  })

  it('list: eine Zeile je Meldung', async () => {
    const { fabrik } = leserErsatz()
    const { code, ausgabe } = await starte(['list'], ENV, fabrik, JETZT)
    expect(code).toBe(0)
    expect(ausgabe.split('\n')).toHaveLength(1)
    expect(ausgabe).toMatch(/^cmfmeldu\s+Fehler\s+Neu\s+/)
    expect(ausgabe).toContain('Biohof Sonnleitner')
  })

  it('show: sucht per Kurznummer und zeigt die Meldung', async () => {
    const { leser, fabrik } = leserErsatz()
    const { code, ausgabe } = await starte(['show', 'cmfmeldu'], ENV, fabrik, JETZT)
    expect(code).toBe(0)
    expect(leser.finde).toHaveBeenCalledWith('cmfmeldu')
    expect(ausgabe).toContain('## cmfmeldu · Fehler · Neu')
    expect(ausgabe).toContain('- ID: cmfmeldung0000000001abc')
  })

  it('show: unbekannte Kurznummer → Code 1 mit klarer Meldung', async () => {
    const { fabrik } = leserErsatz()
    const { code, ausgabe } = await starte(['show', 'gibtsnix'], ENV, fabrik, JETZT)
    expect(code).toBe(1)
    expect(ausgabe).toContain('gibtsnix')
  })

  it('hilfe: ohne Befehl Code 0, mit unbekanntem Befehl Code 1 — beide ohne Datenbank', async () => {
    const { fabrik } = leserErsatz()
    expect(await starte([], {}, fabrik, JETZT)).toEqual({ code: 0, ausgabe: HILFE })
    const falsch = await starte(['delete', 'abc'], ENV, fabrik, JETZT)
    expect(falsch.code).toBe(1)
    expect(falsch.ausgabe).toContain('Unbekannter Befehl: delete')
    expect(fabrik).not.toHaveBeenCalled()
  })
})

describe('parseArgs', () => {
  it('fällt ohne Status auf NEU + GEPRUEFT zurück und ignoriert unbekannte Werte', () => {
    expect(parseArgs(['list'])).toEqual({ art: 'list', filter: { status: ['NEU', 'GEPRUEFT'], art: null } })
    expect(parseArgs(['list', '--status', 'quatsch', '--art', 'x'])).toEqual({
      art: 'list',
      filter: { status: ['NEU', 'GEPRUEFT'], art: null },
    })
  })

  it('show ohne Ziel ist ein Hilfe-Aufruf mit Grund', () => {
    expect(parseArgs(['show'])).toEqual({ art: 'hilfe', grund: 'show braucht eine Kurznummer oder ID.' })
  })
})
