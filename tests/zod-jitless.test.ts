/**
 * Zod ohne eval-Probe im Browser (Register G8, Ergänzung 31.10.2026; Nr. 208).
 *
 * Ursache: Zod 4 baut beim Anlegen jedes Objekt-Schemas einmal `new Function('')`, um zu prüfen, ob
 * es seine Prüfer kompilieren darf. Die Content-Security-Policy erlaubt kein `eval`; der Wurf wird
 * zwar abgefangen, der Browser meldet ihn aber als `script-src`-Verstoß — jede Seite mit einem
 * Formular füllte so den CSP-Bericht mit Treffern ohne Wirkung. `jitless` überspringt die Probe
 * (kein Sicherheitsgewinn, nur Signalqualität: die Policy bleibt unverändert, tests/csp.test.ts).
 *
 * Wichtig: Zod liest `jitless` beim ANLEGEN des Schemas (nicht erst beim Prüfen). Die Einstellung muss
 * also vor dem ersten Schema-Modul der Browser-Seite laufen; Next führt `src/instrumentation-client.ts`
 * vor jedem anderen Code des Browsers aus — darum steht sie dort und nur dort. Serverseitig bleibt
 * alles beim Alten (kein CSP, JIT ist dort schneller).
 *
 * Beweist:
 *  - Verhalten: Nach dem Import des Client-Einstiegs legt ein neues Objekt-Schema kein `Function` an;
 *    Prüfen (gültig und ungültig) liefert dieselben Ergebnisse.
 *  - Gegenprobe: Ohne den Import ruft dasselbe Anlegen `Function` auf — der Test misst also wirklich.
 *  - Wache: `jitless` steht in genau einer Datei unter `src/`, und die ist der Client-Einstieg
 *    (nicht der Server-Einstieg, nicht eine Komponente, die zu spät käme). Text-Attrappen schlagen an.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}))

type ZodGlobal = { __zod_globalConfig?: { jitless?: boolean } }
const zodGlobal = globalThis as unknown as ZodGlobal

/** Legt ein Objekt-Schema in einem frischen Modulregister an und zählt die Aufrufe von `Function`. */
async function legeSchemaAn(): Promise<{ aufrufe: number; z: typeof import('zod').z; schema: import('zod').ZodType }> {
  const { z } = await import('zod')
  const Echt = globalThis.Function
  let aufrufe = 0
  const Zaehler = function (this: unknown, ...args: string[]) {
    aufrufe++
    return Reflect.construct(Echt, args)
  } as unknown as FunctionConstructor
  Object.defineProperty(Zaehler, 'prototype', { value: Echt.prototype })
  vi.stubGlobal('Function', Zaehler)
  try {
    const schema = z.object({ name: z.string().min(2, 'zu kurz'), menge: z.number().int() })
    return { aufrufe, z, schema }
  } finally {
    vi.unstubAllGlobals()
  }
}

beforeEach(() => {
  vi.resetModules()
  delete zodGlobal.__zod_globalConfig?.jitless
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete zodGlobal.__zod_globalConfig?.jitless
})

describe('Client-Einstieg stellt Zod auf jitless', () => {
  it('Gegenprobe: ohne den Einstieg ruft das Anlegen eines Objekt-Schemas Function auf', async () => {
    const { aufrufe } = await legeSchemaAn()
    expect(aufrufe).toBeGreaterThan(0)
  })

  it('nach dem Import des Einstiegs entsteht kein Function-Aufruf mehr', async () => {
    await import('@/instrumentation-client')
    expect(zodGlobal.__zod_globalConfig?.jitless).toBe(true)
    const { aufrufe } = await legeSchemaAn()
    expect(aufrufe).toBe(0)
  })

  it('Prüfen liefert mit jitless dieselben Ergebnisse (gültig, ungültig, Fehlertext)', async () => {
    await import('@/instrumentation-client')
    const { schema } = await legeSchemaAn()
    expect(schema.safeParse({ name: 'Hof', menge: 3 })).toMatchObject({ success: true, data: { name: 'Hof', menge: 3 } })
    const schlecht = schema.safeParse({ name: 'H', menge: 1.5 })
    expect(schlecht.success).toBe(false)
    expect(schlecht.error?.issues.map((i) => i.path.join('.')).sort()).toEqual(['menge', 'name'])
    expect(schlecht.error?.issues.find((i) => i.path[0] === 'name')?.message).toBe('zu kurz')
  })
})

const WURZEL = process.cwd()
const CLIENT_EINSTIEG = 'src/instrumentation-client.ts'

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

/** Ob der Text `jitless: true` außerhalb von Kommentaren setzt. */
function setztJitless(text: string): boolean {
  const ohneKommentare = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  return /\bjitless\s*:\s*true\b/.test(ohneKommentare)
}

describe('Wache: eine Quelle', () => {
  it('jitless wird in genau einer Datei unter src/ gesetzt — im Client-Einstieg', () => {
    const treffer = [...quelldateien(join(WURZEL, 'src'))]
      .filter((pfad) => setztJitless(readFileSync(pfad, 'utf8')))
      .map((pfad) => relative(WURZEL, pfad).split(sep).join('/'))
    expect(treffer).toEqual([CLIENT_EINSTIEG])
  }, 30_000)

  it('der Server-Einstieg und der Einstieg setzen die Einstellung nicht doppelt', () => {
    expect(setztJitless(readFileSync(join(WURZEL, 'src/instrumentation.ts'), 'utf8'))).toBe(false)
    const einstieg = readFileSync(join(WURZEL, CLIENT_EINSTIEG), 'utf8')
    expect(einstieg.match(/jitless\s*:\s*true/g)?.length).toBe(1)
    expect(einstieg).toMatch(/from 'zod\/v4\/core'/)
  })

  it('Gegenprobe: Attrappen — gesetzt schlägt an, Kommentar und andere Werte nicht', () => {
    expect(setztJitless("z.config({ jitless: true })")).toBe(true)
    expect(setztJitless("config({\n  jitless : true,\n})")).toBe(true)
    expect(setztJitless('// z.config({ jitless: true })')).toBe(false)
    expect(setztJitless('/* jitless: true */ const a = 1')).toBe(false)
    expect(setztJitless('z.config({ jitless: false })')).toBe(false)
  })
})
