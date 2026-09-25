/**
 * Der Versuchszähler des Stop-Hooks (.claude/hooks/stop-zaehler.mjs).
 *
 * Beweist: Zwei parallele Sitzungen zählen unabhängig — die Fehlversuche der
 * einen lassen die andere nicht vorzeitig durch, und der Erfolg der einen
 * löscht nicht den Zähler der anderen. Ohne session_id zählt jeder
 * Arbeitsordner für sich. Unsinnige IDs landen nie im Dateinamen. Dateien
 * älter als 24 h werden beim Start weggeräumt, jüngere nicht.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  MAX_ALTER_MS,
  raeumeAlteAuf,
  sitzungAusStdin,
  zaehlerDatei,
  zaehlerLesen,
  zaehlerLoeschen,
  zaehlerSchreiben,
} from '../.claude/hooks/stop-zaehler.mjs'

let ordner = ''
beforeEach(() => {
  ordner = mkdtempSync(join(tmpdir(), 'stop-zaehler-'))
})
afterEach(() => {
  rmSync(ordner, { recursive: true, force: true })
})

describe('Zähler je Sitzung', () => {
  it('zwei Sitzungen zählen unabhängig voneinander', () => {
    const a = zaehlerDatei(ordner, sitzungAusStdin('{"session_id":"sitzung-a"}'), '/projekt')
    const b = zaehlerDatei(ordner, sitzungAusStdin('{"session_id":"sitzung-b"}'), '/projekt')
    expect(a).not.toBe(b)

    zaehlerSchreiben(a, ordner, 1)
    zaehlerSchreiben(a, ordner, zaehlerLesen(a) + 1)
    zaehlerSchreiben(b, ordner, 1)

    expect(zaehlerLesen(a)).toBe(2)
    expect(zaehlerLesen(b)).toBe(1)

    // Sitzung B wird grün — der Zähler von A bleibt stehen.
    zaehlerLoeschen(b)
    expect(zaehlerLesen(b)).toBe(0)
    expect(zaehlerLesen(a)).toBe(2)
  })

  it('ohne session_id: kurzer Hash des Arbeitsordners, verschieden je Worktree', () => {
    const haupt = zaehlerDatei(ordner, sitzungAusStdin(''), 'C:/Projekte/bauern-plattform')
    const worktree = zaehlerDatei(ordner, sitzungAusStdin('{}'), 'C:/Projekte/bauern-plattform-nachschliff')
    expect(haupt).not.toBe(worktree)
    expect(basename(haupt)).toMatch(/^farmerzone-stop-hook-[0-9a-f]{12}\.count$/)
    expect(zaehlerDatei(ordner, null, 'C:/Projekte/bauern-plattform')).toBe(haupt)
  })

  it('eine session_id mit Pfadzeichen oder falschem Typ wird verworfen', () => {
    expect(sitzungAusStdin('{"session_id":"../../etc"}')).toBeNull()
    expect(sitzungAusStdin('{"session_id":42}')).toBeNull()
    expect(sitzungAusStdin('kein json')).toBeNull()
    expect(sitzungAusStdin('{"session_id":"675811f4-7fbf-4c4f"}')).toBe('675811f4-7fbf-4c4f')
  })
})

describe('raeumeAlteAuf', () => {
  it('löscht Zählerdateien älter als 24 h, lässt jüngere und fremde Dateien stehen', () => {
    const jetzt = Date.now()
    const alt = join(ordner, 'farmerzone-stop-hook-alt.count')
    const altGlobal = join(ordner, 'farmerzone-stop-hook.count')
    const jung = join(ordner, 'farmerzone-stop-hook-jung.count')
    const fremd = join(ordner, 'etwas-anderes.count')
    for (const datei of [alt, altGlobal, jung, fremd]) writeFileSync(datei, '1')
    const vorher = new Date(jetzt - MAX_ALTER_MS - 60_000)
    utimesSync(alt, vorher, vorher)
    utimesSync(altGlobal, vorher, vorher)
    utimesSync(fremd, vorher, vorher)

    const geloescht = raeumeAlteAuf(ordner, jetzt)

    expect(geloescht.sort()).toEqual(['farmerzone-stop-hook-alt.count', 'farmerzone-stop-hook.count'])
    expect(existsSync(jung)).toBe(true)
    expect(existsSync(fremd)).toBe(true)
  })

  it('ein fehlender Ordner ist kein Fehler', () => {
    expect(raeumeAlteAuf(join(ordner, 'gibt-es-nicht'), Date.now())).toEqual([])
  })
})
