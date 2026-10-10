/**
 * Die Wache über /admin seit der AdminShell (Nachtlauf Nr. 22f).
 *
 * Seit Nr. 22f trägt ein Layout (src/app/admin/layout.tsx) die AdminShell mit
 * Name und Zählern. Ein Layout rendert parallel zur Seite — ohne eigene
 * Prüfung zeigte es einem Unbefugten Kopf und Zähler, während die Seite noch
 * ihr notFound() wirft. Beweist:
 *  - Jede page.tsx unter src/app/admin (rekursiv) ruft als ERSTE Anweisung
 *    `await verlangeAdminSeite()` aus '@/server/admin-wache' — eine neue
 *    Admin-Route ohne Prüfung fällt hier auf (TypeScript-AST, kein Regex).
 *  - Das Layout lädt nur über ladeAdminbereich, und ladeAdminbereich prüft
 *    als ERSTE Anweisung mit verlangeAdminSeite.
 *  - Verhalten: Ohne Anmeldung → Login, angemeldet ohne Recht (frisch aus der
 *    Datenbank) → 404 — und in beiden Fällen wird nichts gezählt.
 *  - Gegenproben: Schnipsel ohne Wache und mit Wache an zweiter Stelle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`REDIRECT:${ziel}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn() }, farm: { count: vi.fn() }, meldung: { count: vi.fn() } },
}))

import { ladeAdminbereich } from '@/server/adminbereich'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const WURZEL = process.cwd()
const ADMIN = join(WURZEL, 'src/app/admin')

function* seiten(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* seiten(pfad)
    else if (name === 'page.tsx' || name === 'page.ts') yield pfad
  }
}

function lies(quelltext: string, pfad: string): ts.SourceFile {
  return ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function modifikator(knoten: ts.Node, art: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(knoten) && (ts.getModifiers(knoten) ?? []).some((m) => m.kind === art)
}

/** Die Funktion `name` bzw. die Standard-Export-Funktion einer Datei. */
function funktion(datei: ts.SourceFile, name: 'default' | string): ts.FunctionDeclaration | null {
  for (const s of datei.statements) {
    if (!ts.isFunctionDeclaration(s)) continue
    if (name === 'default' ? modifikator(s, ts.SyntaxKind.ExportKeyword) && modifikator(s, ts.SyntaxKind.DefaultKeyword) : s.name?.text === name) {
      return s
    }
  }
  return null
}

/** Unter welchem Namen `exportName` aus `modul` importiert ist — null, wenn gar nicht. */
function importiertAls(datei: ts.SourceFile, modul: string, exportName: string): string | null {
  for (const s of datei.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier) || s.moduleSpecifier.text !== modul) continue
    const benannt = s.importClause?.namedBindings
    if (benannt && ts.isNamedImports(benannt)) {
      for (const el of benannt.elements) if ((el.propertyName ?? el.name).text === exportName) return el.name.text
    }
  }
  return null
}

/** Ob die erste Anweisung `await <name>()` ist — allein oder als Initialisierer. */
function ersteIstAwait(fn: ts.FunctionDeclaration, name: string): boolean {
  const erste = fn.body?.statements[0]
  if (!erste) return false
  let ausdruck: ts.Expression | undefined
  if (ts.isExpressionStatement(erste)) ausdruck = erste.expression
  else if (ts.isVariableStatement(erste) && erste.declarationList.declarations.length === 1) {
    ausdruck = erste.declarationList.declarations[0].initializer
  }
  if (!ausdruck || !ts.isAwaitExpression(ausdruck)) return false
  const aufruf = ausdruck.expression
  return ts.isCallExpression(aufruf) && ts.isIdentifier(aufruf.expression) && aufruf.expression.text === name && aufruf.arguments.length === 0
}

/** Was an der Wache fehlt — leer heißt gedeckt. */
function wachenMaengel(quelltext: string, opt: { modul: string; exportName: string; funktionName: 'default' | string }, pfad = 'schnipsel.tsx'): string[] {
  const datei = lies(quelltext, pfad)
  const name = importiertAls(datei, opt.modul, opt.exportName)
  if (!name) return [`${pfad}: ${opt.exportName} nicht aus '${opt.modul}' importiert`]
  const fn = funktion(datei, opt.funktionName)
  if (!fn) return [`${pfad}: Funktion ${opt.funktionName} nicht gefunden`]
  if (!modifikator(fn, ts.SyntaxKind.AsyncKeyword)) return [`${pfad}: nicht async`]
  if (!ersteIstAwait(fn, name)) return [`${pfad}: erste Anweisung ist nicht \`await ${opt.exportName}()\``]
  return []
}

const SEITE = { modul: '@/server/admin-wache', exportName: 'verlangeAdminSeite', funktionName: 'default' } as const
const SEITEN = [...seiten(ADMIN)]

describe('jede Seite unter /admin', () => {
  it('es gibt die vier Seiten — sonst bewiese der Rest nichts', () => {
    expect(SEITEN.map((p) => relative(ADMIN, p).split(sep).join('/')).sort()).toEqual([
      'finanzen/page.tsx',
      'meldungen/[id]/page.tsx',
      'meldungen/page.tsx',
      'page.tsx',
    ])
  })

  it('ruft als erste Anweisung `await verlangeAdminSeite()` auf', () => {
    const maengel = SEITEN.flatMap((p) => wachenMaengel(readFileSync(p, 'utf8'), SEITE, relative(WURZEL, p)))
    expect(maengel).toEqual([])
  })
})

describe('das Layout mit der AdminShell', () => {
  it('lädt Name und Zähler als erste Anweisung über ladeAdminbereich', () => {
    const quelle = readFileSync(join(ADMIN, 'layout.tsx'), 'utf8')
    expect(wachenMaengel(quelle, { modul: '@/server/adminbereich', exportName: 'ladeAdminbereich', funktionName: 'default' })).toEqual([])
  })

  it('ladeAdminbereich prüft als erste Anweisung mit verlangeAdminSeite', () => {
    const quelle = readFileSync(join(WURZEL, 'src/server/adminbereich.ts'), 'utf8')
    expect(wachenMaengel(quelle, { ...SEITE, funktionName: 'ladeAdminbereich' }, 'src/server/adminbereich.ts')).toEqual([])
  })
})

describe('Gegenproben — die Suche schlägt an', () => {
  const kopf = "import { verlangeAdminSeite } from '@/server/admin-wache'\n"
  it('erkennt eine Seite ohne Wache', () => {
    expect(wachenMaengel(`${kopf}export default async function S() { return null }`, SEITE)).toHaveLength(1)
  })
  it('erkennt eine Wache an zweiter Stelle', () => {
    expect(wachenMaengel(`${kopf}export default async function S() { const a = 1\n await verlangeAdminSeite()\n return a }`, SEITE)).toHaveLength(1)
  })
  it('erkennt eine gleichnamige Funktion aus einem anderen Modul', () => {
    expect(
      wachenMaengel("import { verlangeAdminSeite } from '@/lib/falsch'\nexport default async function S() { await verlangeAdminSeite() }", SEITE)
    ).toHaveLength(1)
  })
  it('lässt eine korrekte Seite durch', () => {
    expect(wachenMaengel(`${kopf}export default async function S() { await verlangeAdminSeite()\n return null }`, SEITE)).toEqual([])
  })
})

describe('ladeAdminbereich — Verhalten', () => {
  const getSession = vi.mocked(auth.api.getSession)
  const userFindUnique = vi.mocked(prisma.user.findUnique)
  const farmCount = vi.mocked(prisma.farm.count)
  const meldungCount = vi.mocked(prisma.meldung.count)

  beforeEach(() => {
    vi.clearAllMocks()
    farmCount.mockResolvedValue(2 as never)
    meldungCount.mockResolvedValue(3 as never)
  })

  it('ohne Anmeldung: zum Login, nichts gezählt', async () => {
    getSession.mockResolvedValue(null as never)
    await expect(ladeAdminbereich()).rejects.toThrow('REDIRECT:/login')
    expect(farmCount).not.toHaveBeenCalled()
    expect(meldungCount).not.toHaveBeenCalled()
  })

  it('angemeldet ohne Recht: 404, nichts gezählt — auch wenn die Session isAdmin behauptet', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', isAdmin: true } } as never)
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)
    await expect(ladeAdminbereich()).rejects.toThrow('NOT_FOUND')
    expect(farmCount).not.toHaveBeenCalled()
    expect(meldungCount).not.toHaveBeenCalled()
  })

  it('Admin ohne Hof: Name und Zähler — wartende Höfe und Meldungen zu entscheiden, kein Weg zum Hof', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } } as never)
    userFindUnique
      .mockResolvedValueOnce({ isAdmin: true } as never)
      .mockResolvedValueOnce({ name: 'Max Mustermann', role: 'CUSTOMER', farm: null } as never)
    expect(await ladeAdminbereich()).toEqual({ personName: 'Max Mustermann', hatHof: false, zahlen: { hoefe: 2, briefkasten: 3 } })
    expect(farmCount).toHaveBeenCalledWith({ where: { approvedAt: null } })
  })

  // Nr. 41 (Register N1): „← Mein Hof" und die Konto-Plakette nur mit eigenem Hof —
  // frisch aus der Datenbank, mit derselben Regel wie die Shell (kontoHatHof).
  it('Admin mit eigenem Hof (Rolle FARMER): hatHof — gelesen werden nur Name, Rolle und die Hof-Kennung', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } } as never)
    userFindUnique
      .mockResolvedValueOnce({ isAdmin: true } as never)
      .mockResolvedValueOnce({ name: 'Max Mustermann', role: 'FARMER', farm: { id: 'f1' } } as never)
    expect(await ladeAdminbereich()).toMatchObject({ personName: 'Max Mustermann', hatHof: true })
    expect(userFindUnique).toHaveBeenLastCalledWith({
      where: { id: 'u1' },
      select: { name: true, role: true, farm: { select: { id: true } } },
    })
  })

  it('Rolle FARMER ohne Hof: kein Weg zum Hof (der Hofbereich führte erst nach /onboarding)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } } as never)
    userFindUnique
      .mockResolvedValueOnce({ isAdmin: true } as never)
      .mockResolvedValueOnce({ name: 'Max Mustermann', role: 'FARMER', farm: null } as never)
    expect(await ladeAdminbereich()).toMatchObject({ hatHof: false })
  })
})
