/**
 * Öffentliche Lesepfade bei einem Verbindungsabbruch genau einmal wiederholen
 * (Nr. 47). Befund aus Vercel: „(EAUTHTIMEOUT)" beim Hintergrund-Neubau der
 * Hofliste — der Pooler meldet einen Anmelde-Zeitablauf als SQLSTATE 08006.
 * Prisma 7 reicht ihn mit dem pg-Adapter als `DriverAdapterError` durch:
 * `cause = { kind: 'postgres', originalCode: '08006', originalMessage:
 * '(EAUTHTIMEOUT) …' }` (gemessen, Bericht Nr. 47).
 *
 * Beweist:
 *  - Erkannt wird nur dieser Abbruch (Code 08006 oder EAUTHTIMEOUT in der
 *    Ursache), auch angehängt an einen Prisma-Fehler; alles andere nicht.
 *  - Genau EINE Wiederholung nach kurzer Pause, nie eine zweite.
 *  - Sentry nur, wenn auch die Wiederholung scheitert — einmal, ohne
 *    Personendaten; der Fehler geht weiter an den Aufrufer, der ihn nicht
 *    ein zweites Mal meldet.
 *  - Wache: nur öffentliche Lesepfade, nie Schreiben, nie in Transaktionen.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { WIEDERHOLUNG_PAUSE_MS, istVerbindungsabbruch } from '@/lib/verbindungsfehler'
import { leseOeffentlichMitWiederholung, schonGemeldet } from '@/server/oeffentlich-lesen'

/** So kommt der Fehler des Poolers beim Aufrufer an (gemessen mit Prisma 7.8 und adapter-pg). */
function poolerAbbruch(): Error {
  const fehler = new Error('(EAUTHTIMEOUT) authentication timeout')
  fehler.name = 'DriverAdapterError'
  Object.assign(fehler, {
    cause: {
      originalCode: '08006',
      originalMessage: '(EAUTHTIMEOUT) authentication timeout',
      kind: 'postgres',
      code: '08006',
      severity: 'FATAL',
      message: '(EAUTHTIMEOUT) authentication timeout',
    },
  })
  return fehler
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('istVerbindungsabbruch', () => {
  it('erkennt den Abbruch des Poolers — über den Code und über EAUTHTIMEOUT', () => {
    expect(istVerbindungsabbruch(poolerAbbruch())).toBe(true)
    const nurCode = Object.assign(new Error('connection failure'), { name: 'DriverAdapterError', cause: { kind: 'postgres', originalCode: '08006' } })
    expect(istVerbindungsabbruch(nurCode)).toBe(true)
    const nurText = Object.assign(new Error('x'), { name: 'DriverAdapterError', cause: { kind: 'postgres', originalMessage: '(EAUTHTIMEOUT) timeout' } })
    expect(istVerbindungsabbruch(nurText)).toBe(true)
  })

  it('erkennt ihn auch, wenn Prisma den Fehler des Adapters an einen eigenen hängt', () => {
    const prismaFehler = Object.assign(new Error('Raw query failed'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2010',
      meta: { driverAdapterError: { name: 'DriverAdapterError', cause: { originalCode: '08006', kind: 'postgres' } } },
    })
    expect(istVerbindungsabbruch(prismaFehler)).toBe(true)
  })

  it('Gegenprobe: andere Fehler sind kein Abbruch — auch keine anderen Netzfehler', () => {
    const eindeutig = Object.assign(new Error('Unique'), { name: 'PrismaClientKnownRequestError', code: 'P2002' })
    const zeitlimit = Object.assign(new Error('Operation has timed out'), { name: 'PrismaClientKnownRequestError', code: 'P1008', meta: { driverAdapterError: { cause: { kind: 'SocketTimeout' } } } })
    const anderesPostgres = Object.assign(new Error('deadlock'), { name: 'DriverAdapterError', cause: { kind: 'postgres', originalCode: '40P01' } })
    for (const fehler of [eindeutig, zeitlimit, anderesPostgres, new Error('kaputt'), 'EAUTHTIMEOUT', null, undefined, 42, { cause: null }]) {
      expect(istVerbindungsabbruch(fehler), String(fehler)).toBe(false)
    }
  })
})

describe('leseOeffentlichMitWiederholung', () => {
  const warte = vi.fn(async () => {})

  it('ohne Fehler: ein Versuch, keine Pause, keine Meldung', async () => {
    const lesen = vi.fn(async () => ['hof-a'])
    expect(await leseOeffentlichMitWiederholung('oeffentliche-hoefe', lesen, { warte })).toEqual(['hof-a'])
    expect(lesen).toHaveBeenCalledTimes(1)
    expect(warte).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('Abbruch, dann Erfolg: genau eine Wiederholung nach der Pause, keine Meldung', async () => {
    const lesen = vi.fn().mockRejectedValueOnce(poolerAbbruch()).mockResolvedValueOnce(['hof-a'])
    expect(await leseOeffentlichMitWiederholung('oeffentliche-hoefe', lesen, { warte })).toEqual(['hof-a'])
    expect(lesen).toHaveBeenCalledTimes(2)
    expect(warte).toHaveBeenCalledExactlyOnceWith(WIEDERHOLUNG_PAUSE_MS)
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('die Pause ist kurz: zwischen 200 und 500 Millisekunden', () => {
    expect(WIEDERHOLUNG_PAUSE_MS).toBeGreaterThanOrEqual(200)
    expect(WIEDERHOLUNG_PAUSE_MS).toBeLessThanOrEqual(500)
  })

  it('scheitert auch die Wiederholung: eine Meldung ohne Personendaten, der Fehler geht weiter — nie ein dritter Versuch', async () => {
    const zweiter = poolerAbbruch()
    const lesen = vi.fn().mockRejectedValueOnce(poolerAbbruch()).mockRejectedValueOnce(zweiter).mockResolvedValue(['nie'])

    await expect(leseOeffentlichMitWiederholung('oeffentliche-hoefe', lesen, { warte })).rejects.toBe(zweiter)

    expect(lesen).toHaveBeenCalledTimes(2)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [gemeldet, kontext] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error, Record<string, unknown>]
    expect(gemeldet).not.toBe(zweiter)
    expect(gemeldet.name).toBe('DriverAdapterError')
    expect(kontext).toMatchObject({
      tags: { bereich: 'oeffentlich-lesen', lesepfad: 'oeffentliche-hoefe', grund: 'verbindung', code: '08006', ursache: 'EAUTHTIMEOUT' },
      extra: { versuche: 2, pauseMs: WIEDERHOLUNG_PAUSE_MS },
    })
    expect(schonGemeldet(zweiter)).toBe(true)
  })

  it('ein anderer Fehler: kein zweiter Versuch, keine Pause, keine Meldung hier — der Aufrufer meldet', async () => {
    const fehler = Object.assign(new Error('Unique'), { name: 'PrismaClientKnownRequestError', code: 'P2002' })
    const lesen = vi.fn().mockRejectedValue(fehler)

    await expect(leseOeffentlichMitWiederholung('oeffentliche-hoefe', lesen, { warte })).rejects.toBe(fehler)

    expect(lesen).toHaveBeenCalledTimes(1)
    expect(warte).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
    expect(schonGemeldet(fehler)).toBe(false)
  })

  it('Abbruch, dann ein anderer Fehler: der andere geht weiter, gemeldet wird er hier nicht', async () => {
    const anderer = new Error('kaputt')
    const lesen = vi.fn().mockRejectedValueOnce(poolerAbbruch()).mockRejectedValueOnce(anderer)
    await expect(leseOeffentlichMitWiederholung('oeffentliche-hoefe', lesen, { warte })).rejects.toBe(anderer)
    expect(lesen).toHaveBeenCalledTimes(2)
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})

// ─── Wache: nur öffentliche Lesepfade, nie Schreiben, nie in Transaktionen ─

const SRC = join(process.cwd(), 'src')
const HELFER = 'leseOeffentlichMitWiederholung'
/** Die einzigen Stellen, die wiederholen dürfen — öffentliche Lesepfade. */
const ERLAUBT = ['server/queries/oeffentliche-hoefe.ts']
const SCHREIBEN = /\$transaction|\$executeRaw|\.(create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)\(/

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return dateien(pfad)
    return /\.(ts|tsx)$/.test(name) ? [pfad] : []
  })
}

function lies(text: string, pfad = 'schnipsel.ts'): ts.SourceFile {
  return ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true, pfad.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

/** Die Aufrufe des Helfers: ihr Rückruf als Text und ob sie in einer $transaction stehen. */
function aufrufe(text: string, pfad = 'schnipsel.ts'): { rueckruf: string; inTransaktion: boolean }[] {
  const datei = lies(text, pfad)
  const funde: { rueckruf: string; inTransaktion: boolean }[] = []
  const besuche = (k: ts.Node): void => {
    if (ts.isCallExpression(k) && ts.isIdentifier(k.expression) && k.expression.text === HELFER) {
      let inTransaktion = false
      for (let e: ts.Node | undefined = k.parent; e; e = e.parent) {
        if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === '$transaction') inTransaktion = true
      }
      funde.push({ rueckruf: k.arguments[1]?.getText(datei) ?? '', inTransaktion })
    }
    ts.forEachChild(k, besuche)
  }
  besuche(datei)
  return funde
}

/** Der Rumpf einer benannten Funktion einer Datei. */
function rumpf(text: string, name: string): string {
  const datei = lies(text)
  const f = datei.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === name)
  return f?.body?.getText(datei) ?? ''
}

function verstoesse(text: string, pfad: string): string[] {
  return aufrufe(text, pfad).flatMap(({ rueckruf, inTransaktion }) => [
    ...(ERLAUBT.includes(pfad) ? [] : [`${pfad}: nicht als öffentlicher Lesepfad freigegeben`]),
    ...(inTransaktion ? [`${pfad}: in einer Transaktion`] : []),
    ...(SCHREIBEN.test(rueckruf) ? [`${pfad}: schreibt im Rückruf`] : []),
  ])
}

describe('Wache: Wiederholen nur auf öffentlichen Lesepfaden', () => {
  it('in src/ wiederholt nur die öffentliche Hofliste — ohne Schreiben, außerhalb jeder Transaktion', () => {
    const alle = dateien(SRC).map((pfad) => ({ pfad: relative(SRC, pfad).split('\\').join('/'), text: readFileSync(pfad, 'utf8') }))
    expect(alle.flatMap(({ pfad, text }) => verstoesse(text, pfad))).toEqual([])
    // Gegenprobe: Die Suche findet den einen echten Aufruf.
    expect(alle.flatMap(({ pfad, text }) => aufrufe(text, pfad).map(() => pfad))).toEqual(ERLAUBT)
  })

  it('die wiederholte Abfrage liest nur: getOeffentlicheHoefe ohne Schreiben und ohne Transaktion', () => {
    const koerper = rumpf(readFileSync(join(SRC, 'server/queries/farm.ts'), 'utf8'), 'getOeffentlicheHoefe')
    expect(koerper).toContain('prisma.farm.findMany(')
    expect(koerper).not.toMatch(SCHREIBEN)
  })

  it('Gegenprobe: ein Schreibweg, eine Transaktion und eine fremde Datei schlagen an', () => {
    const schreibt = `${HELFER}('x', () => prisma.farm.update({ where, data }))`
    expect(verstoesse(schreibt, ERLAUBT[0])).toEqual([`${ERLAUBT[0]}: schreibt im Rückruf`])
    const inTx = `prisma.$transaction(async (tx) => ${HELFER}('x', () => tx.farm.findMany()))`
    expect(verstoesse(inTx, ERLAUBT[0])).toEqual([`${ERLAUBT[0]}: in einer Transaktion`])
    expect(verstoesse(`${HELFER}('x', () => prisma.order.findMany())`, 'server/actions/orders.ts')).toEqual([
      'server/actions/orders.ts: nicht als öffentlicher Lesepfad freigegeben',
    ])
  })

  it('Startseite und /hoefe melden einen schon gemeldeten Abbruch nicht ein zweites Mal', () => {
    for (const seite of ['app/page.tsx', 'app/(public)/hoefe/page.tsx']) {
      const text = readFileSync(join(SRC, seite), 'utf8')
      expect(text, seite).toMatch(/if \(!schonGemeldet\(err\)\) Sentry\.captureException\(err/)
    }
  })
})
