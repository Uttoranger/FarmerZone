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
 *  - /admin/meldungen leitet den Admin dauerhaft (308) in den Eingang mit
 *    Filter Meldung um (Nr. 87, seit Nr. 95 ohne die alten Filter),
 *    /admin/meldungen/[id] in die Spalte „Meldung entscheiden" des Eingangs
 *    (Nr. 95); ohne Recht 404 und keine Umleitung.
 *  - Die Zahl am Reiter „Postfach" ist „Offen" im Eingang (N14): ungelesene
 *    Antworten, Meldungen NEU/GEPRUEFT, wartende Höfe, offene Erstattungen.
 *  - Jede `route.ts` unter src/app/admin (rekursiv, Nr. 110): jede exportierte HTTP-Methode ruft als
 *    ERSTE Anweisung `await verlangeAdminSeite()` oder `await verlangeAdminAktion()` — oder die Datei
 *    steht in ROUTEN_OHNE_WACHE mit Grund und dem Beleg, der den Grund trägt (Link ohne Anmeldung;
 *    Prüfung im Aufruf). Eine neue Route ohne beides fällt hier auf, eine Ausnahme, die doch prüft, auch.
 *    Eine Datei, die eine Adresse ausliefert (`page`, `route`, `manifest`, `icon`, `sitemap` …), ist
 *    nur `page.tsx` oder `route.ts` — sonst gäbe es einen Weg am Layout und an dieser Wache vorbei.
 *  - Admin nur mit Passkey (Register N20; Nr. 115): Die Pflicht „erst Passkey"
 *    prüft JEDE Seite selbst — jede ruft `verlangeAdminSeite()` OHNE Argument,
 *    nur die Pflichtseite /admin/einrichten `verlangeEinrichtenSeite()` (lässt
 *    die offene Pflicht durch, eine Sitzung ohne Passkey nicht — Runde 3);
 *    ladeAdminbereich (Layout) mit `verlangeAdminShell()`. Im Pflicht-Zustand
 *    und in einer Sitzung ohne Passkey lädt das Layout keine Zähler.
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
  permanentRedirect: vi.fn((ziel: string) => {
    throw new Error(`PERMANENT:${ziel}`)
  }),
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    farm: { count: vi.fn() },
    meldung: { count: vi.fn() },
    order: { count: vi.fn() },
    $queryRaw: vi.fn(),
    passkey: { aggregate: vi.fn() },
    adminErsatzcode: { aggregate: vi.fn(async () => ({ _max: { benutztAm: null } })) },
  },
}))

import { ladeAdminbereich } from '@/server/adminbereich'
import { NextRequest } from 'next/server'
import { GET as meldungenUmleitung } from '@/app/admin/meldungen/route'
import { GET as meldungUmleitung } from '@/app/admin/meldungen/[id]/route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { adminSitzung } from './admin-sitzung'

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

/** Ob die erste Anweisung `await <name>()` ohne Argument ist — allein oder als Initialisierer. */
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
  if (!ts.isCallExpression(aufruf) || !ts.isIdentifier(aufruf.expression) || aufruf.expression.text !== name) return false
  return aufruf.arguments.length === 0
}

/** Was an der Wache fehlt — leer heißt gedeckt. */
function wachenMaengel(
  quelltext: string,
  opt: { modul: string; exportName: string; funktionName: 'default' | string },
  pfad = 'schnipsel.tsx'
): string[] {
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
/** Die Wache der Pflichtseite: offene Pflicht durch, Sitzung ohne Passkey bei erledigter Pflicht → /login/admin. */
const EINRICHTEN = { modul: '@/server/admin-wache', exportName: 'verlangeEinrichtenSeite', funktionName: 'default' } as const
const SEITEN = [...seiten(ADMIN)]
/** Die EINE Seite, die ohne Passkey öffnet (Register N20): die Pflichtseite. */
const PFLICHTSEITE = join(ADMIN, 'einrichten', 'page.tsx')

describe('jede Seite unter /admin', () => {
  it('es gibt die neun Seiten — sonst bewiese der Rest nichts (seit Nr. 87 das Postfach, seit Nr. 93 die Einstellungen, seit Nr. 94 die Startseite, seit Nr. 103 Betrieb, seit Nr. 115 Bestätigen, Einrichten und Einstellungen › Anmeldung; /admin/meldungen leitet seit Nr. 101 als Route Handler um und prüft trotzdem)', () => {
    expect(SEITEN.map((p) => relative(ADMIN, p).split(sep).join('/')).sort()).toEqual([
      'bestaetigen/page.tsx',
      'betrieb/page.tsx',
      'einrichten/page.tsx',
      'einstellungen/anmeldung/page.tsx',
      'einstellungen/page.tsx',
      'finanzen/page.tsx',
      'page.tsx',
      'postfach/page.tsx',
      'startseite/page.tsx',
    ])
  })

  it('ruft als erste Anweisung `await verlangeAdminSeite()` OHNE Argument auf — die Pflicht prüft jede Seite selbst (N20), außer /admin/einrichten', () => {
    const maengel = SEITEN.filter((p) => p !== PFLICHTSEITE).flatMap((p) => wachenMaengel(readFileSync(p, 'utf8'), SEITE, relative(WURZEL, p)))
    expect(maengel).toEqual([])
  })

  it('nur die Pflichtseite /admin/einrichten ruft als erste Anweisung `await verlangeEinrichtenSeite()` — nicht mehr die Seiten-Wache mit `ohnePasskey`', () => {
    const quelle = readFileSync(PFLICHTSEITE, 'utf8')
    expect(wachenMaengel(quelle, EINRICHTEN, relative(WURZEL, PFLICHTSEITE))).toEqual([])
    expect(quelle).not.toContain('ohnePasskey: true')
  })

  it('Gegenprobe: ein Argument fällt unter der Regel aller Seiten auf; die Pflichtseite mit der Seiten-Wache, mit Argument oder an zweiter Stelle auch', () => {
    const kopf = "import { verlangeAdminSeite, verlangeEinrichtenSeite } from '@/server/admin-wache'\n"
    expect(wachenMaengel(`${kopf}export default async function S() { await verlangeAdminSeite({ ohnePasskey: true })\n return null }`, SEITE)).toHaveLength(1)
    expect(wachenMaengel(`${kopf}export default async function S() { await verlangeEinrichtenSeite()\n return null }`, SEITE)).toHaveLength(1)
    expect(wachenMaengel(`${kopf}export default async function S() { await verlangeAdminSeite()\n return null }`, EINRICHTEN)).toHaveLength(1)
    expect(wachenMaengel(`${kopf}export default async function S() { await verlangeEinrichtenSeite({ ohnePasskey: true })\n return null }`, EINRICHTEN)).toHaveLength(1)
    expect(wachenMaengel(`${kopf}export default async function S() { const j = new Date()\n await verlangeEinrichtenSeite()\n return j }`, EINRICHTEN)).toHaveLength(1)
    expect(wachenMaengel(`${kopf}export default async function S() { const { pflicht } = await verlangeEinrichtenSeite()\n return pflicht }`, EINRICHTEN)).toEqual([])
  })

  it('die Umleitungen /admin/meldungen und /admin/meldungen/[id] (Route Handler, Nr. 101) prüfen als erste Anweisung im GET', () => {
    const routen = ['meldungen/route.ts', 'meldungen/[id]/route.ts'].map((r) => join(ADMIN, r))
    const maengel = routen.flatMap((p) => wachenMaengel(readFileSync(p, 'utf8'), { ...SEITE, funktionName: 'GET' }, relative(WURZEL, p)))
    expect(maengel).toEqual([])
  })

  it('jeder Export unter /admin (Route Handler, kein Layout) prüft als erste Anweisung mit verlangeAdminAktion — Finanzen (Nr. 100), Betrieb (Nr. 103) und Bilder ohne Verwendung (Nr. 104)', () => {
    const exporte = ['finanzen/export/route.ts', 'betrieb/export/route.ts', 'betrieb/bilder-export/route.ts'].map((r) => join(ADMIN, r))
    const aktion = { modul: '@/server/admin-wache', exportName: 'verlangeAdminAktion', funktionName: 'GET' } as const
    expect(exporte.flatMap((p) => wachenMaengel(readFileSync(p, 'utf8'), aktion, relative(WURZEL, p)))).toEqual([])
  })
})

// ─── Route Handler und Adress-Dateien unter /admin (Nr. 110) ────────────────

function* dateienUnter(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* dateienUnter(pfad)
    else yield pfad
  }
}

const HTTP_METHODEN = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

/** Dateien, die in Next eine Adresse ausliefern oder eine Adresse beschreiben — ohne Layout, ohne `page`. */
const LIEFERT_ADRESSE = /^(route|page|default|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest)\.[a-z]+$/

/** Die Dateien, die unter /admin eine Adresse ausliefern, aber weder `page.tsx` noch `route.ts` sind. */
function fremdeAdressDateien(namen: string[]): string[] {
  return namen.filter((n) => LIEFERT_ADRESSE.test(n.split('/').pop() ?? '') && !/(^|\/)(page\.tsx?|route\.ts)$/.test(n))
}

/** Die exportierten HTTP-Methoden einer Route-Datei (`export async function GET`). */
function exportierteMethoden(quelltext: string, pfad = 'route.ts'): string[] {
  const datei = lies(quelltext, pfad)
  return datei.statements
    .filter((st): st is ts.FunctionDeclaration => ts.isFunctionDeclaration(st) && modifikator(st, ts.SyntaxKind.ExportKeyword))
    .map((st) => st.name?.text ?? '')
    .filter((n) => HTTP_METHODEN.includes(n))
}

/** Was an den Methoden einer Route fehlt: Jede prüft zuerst mit der Seiten- oder der Aktions-Wache. Leer = gedeckt. */
function routenMaengel(quelltext: string, pfad = 'route.ts'): string[] {
  const methoden = exportierteMethoden(quelltext, pfad)
  if (methoden.length === 0) return [`${pfad}: keine exportierte HTTP-Methode`]
  return methoden.flatMap((m) => {
    const seite = wachenMaengel(quelltext, { ...SEITE, funktionName: m }, pfad)
    const aktion = wachenMaengel(quelltext, { modul: '@/server/admin-wache', exportName: 'verlangeAdminAktion', funktionName: m }, pfad)
    return seite.length === 0 || aktion.length === 0 ? [] : [`${pfad}: ${m} prüft nicht als erste Anweisung mit verlangeAdminSeite oder verlangeAdminAktion`]
  })
}

/**
 * Routen unter /admin, die bewusst ohne Admin-Wache als erste Anweisung stehen — je Grund und ein Beleg, der
 * im Quelltext der Datei stehen muss. Eine neue Ausnahme braucht Grund und Beleg; fällt der Grund weg, fällt sie auf.
 */
const ROUTEN_OHNE_WACHE: { datei: string; beleg: RegExp; grund: string }[] = [
  {
    datei: 'postfach/zustellung/bestaetigen/route.ts',
    beleg: /OHNE Anmeldung/,
    grund: 'Der Link aus der Bestätigungsmail geht an Adressen ohne Konto: GET liest nur und zeigt den Knopf, POST löst einen einmaligen Token ein',
  },
]

const ROUTEN = [...dateienUnter(ADMIN)].filter((p) => p.endsWith(`${sep}route.ts`)).map((p) => relative(ADMIN, p).split(sep).join('/'))

describe('jede Route unter /admin (route.ts)', () => {
  it('es gibt die Routen, die bekannt sind — sonst bewiese der Rest nichts', () => {
    expect(ROUTEN.sort()).toEqual([
      'betrieb/bilder-export/route.ts',
      'betrieb/export/route.ts',
      'finanzen/export/route.ts',
      'meldungen/[id]/route.ts',
      'meldungen/route.ts',
      'postfach/zustellung/bestaetigen/route.ts',
    ])
  })

  it('jede exportierte Methode prüft als erste Anweisung mit der Admin-Wache — außer den Ausnahmen mit Grund', () => {
    const ausgenommen = ROUTEN_OHNE_WACHE.map((a) => a.datei)
    const maengel = ROUTEN.filter((r) => !ausgenommen.includes(r)).flatMap((r) => routenMaengel(readFileSync(join(ADMIN, r), 'utf8'), `src/app/admin/${r}`))
    expect(maengel).toEqual([])
  })

  it('jede Ausnahme gibt es noch, trägt ihren Beleg im Quelltext, nennt einen Grund — und prüft wirklich nicht selbst als Erstes', () => {
    for (const a of ROUTEN_OHNE_WACHE) {
      expect(ROUTEN, a.datei).toContain(a.datei)
      const quelle = readFileSync(join(ADMIN, a.datei), 'utf8')
      expect(quelle, a.datei).toMatch(a.beleg)
      expect(a.grund.split(' ').length, a.datei).toBeGreaterThanOrEqual(8)
      expect(routenMaengel(quelle, a.datei).length, `${a.datei} prüft inzwischen selbst — raus aus ROUTEN_OHNE_WACHE`).toBeGreaterThan(0)
    }
  })

  it('nur page.tsx und route.ts liefern unter /admin eine Adresse aus — kein manifest, icon, sitemap oder zweites page', () => {
    const namen = [...dateienUnter(ADMIN)].map((p) => relative(ADMIN, p).split(sep).join('/'))
    expect(namen.some((n) => n.endsWith('page.tsx')), 'die Wache sieht die Seiten').toBe(true)
    expect(fremdeAdressDateien(namen)).toEqual([])
  })
})

describe('Gegenproben — Routen und Adress-Dateien', () => {
  const kopf = "import { verlangeAdminAktion, verlangeAdminSeite } from '@/server/admin-wache'\n"

  it('erkennt eine Methode ohne Wache, mit Wache an zweiter Stelle und eine zweite Methode ohne Wache', () => {
    expect(routenMaengel(`${kopf}export async function GET() { return Response.json({}) }`)).toHaveLength(1)
    expect(routenMaengel(`${kopf}export async function GET() { const a = 1\n await verlangeAdminAktion()\n return a }`)).toHaveLength(1)
    expect(routenMaengel(`${kopf}export async function GET() { await verlangeAdminSeite()\n return null }\nexport async function POST() { return null }`)).toHaveLength(1)
  })

  it('erkennt eine Route ohne exportierte Methode und eine Wache aus einem anderen Modul', () => {
    expect(routenMaengel(`${kopf}export const GET = async () => { await verlangeAdminSeite() }`)).toHaveLength(1)
    expect(routenMaengel("import { verlangeAdminAktion } from '@/lib/falsch'\nexport async function GET() { await verlangeAdminAktion() }")).toHaveLength(1)
  })

  it('lässt Seiten- und Aktions-Wache als erste Anweisung durch, auch je Methode verschieden', () => {
    expect(routenMaengel(`${kopf}export async function GET() { await verlangeAdminSeite()\n return null }`)).toEqual([])
    expect(routenMaengel(`${kopf}export async function GET() { const a = await verlangeAdminAktion()\n return a }`)).toEqual([])
    expect(
      routenMaengel(`${kopf}export async function GET() { await verlangeAdminSeite() }\nexport async function POST() { await verlangeAdminAktion() }`)
    ).toEqual([])
  })

  it('erkennt Adress-Dateien, die weder page.tsx noch route.ts sind — in jedem Ordner', () => {
    expect(fremdeAdressDateien(['page.tsx', 'betrieb/route.ts', 'betrieb/betrieb-teile.tsx', 'layout.tsx', 'loading.tsx'])).toEqual([])
    expect(fremdeAdressDateien(['manifest.ts', 'a/icon.png', 'b/sitemap.xml', 'c/robots.txt', 'd/opengraph-image.tsx', 'e/default.tsx', 'f/route.tsx'])).toEqual([
      'manifest.ts',
      'a/icon.png',
      'b/sitemap.xml',
      'c/robots.txt',
      'd/opengraph-image.tsx',
      'e/default.tsx',
      'f/route.tsx',
    ])
  })
})

describe('das Layout mit der AdminShell', () => {
  it('lädt Name und Zähler als erste Anweisung über ladeAdminbereich', () => {
    const quelle = readFileSync(join(ADMIN, 'layout.tsx'), 'utf8')
    expect(wachenMaengel(quelle, { modul: '@/server/adminbereich', exportName: 'ladeAdminbereich', funktionName: 'default' })).toEqual([])
  })

  it('ladeAdminbereich prüft als erste Anweisung mit verlangeAdminShell() — lässt Pflicht und Sitzung ohne Passkey durch (ohne Zähler), das Layout umhüllt auch die Pflichtseite', () => {
    const quelle = readFileSync(join(WURZEL, 'src/server/adminbereich.ts'), 'utf8')
    expect(wachenMaengel(quelle, { modul: '@/server/admin-wache', exportName: 'verlangeAdminShell', funktionName: 'ladeAdminbereich' }, 'src/server/adminbereich.ts')).toEqual([])
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
  const orderCount = vi.mocked(prisma.order.count)
  // zaehleUngelesenTeam (Postfach, Nr. 87): Fäden mit ungelesener Antwort eines Hofs.
  const ungelesenTeam = vi.mocked(prisma.$queryRaw)

  const passkeyAggregate = vi.mocked(prisma.passkey.aggregate)

  beforeEach(() => {
    vi.clearAllMocks()
    passkeyAggregate.mockResolvedValue({ _count: { _all: 1 }, _max: { createdAt: new Date(0) } } as never)
    farmCount.mockResolvedValue(2 as never)
    meldungCount.mockResolvedValue(3 as never)
    orderCount.mockResolvedValue(1 as never)
    ungelesenTeam.mockResolvedValue([{ anzahl: 4 }] as never)
  })

  it('ohne Anmeldung: zum Login, nichts gezählt', async () => {
    getSession.mockResolvedValue(null as never)
    await expect(ladeAdminbereich()).rejects.toThrow('REDIRECT:/login')
    expect(farmCount).not.toHaveBeenCalled()
    expect(meldungCount).not.toHaveBeenCalled()
    expect(ungelesenTeam).not.toHaveBeenCalled()
  })

  it('angemeldet ohne Recht: 404, nichts gezählt — auch wenn die Session isAdmin behauptet', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', isAdmin: true } } as never)
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)
    await expect(ladeAdminbereich()).rejects.toThrow('NOT_FOUND')
    expect(farmCount).not.toHaveBeenCalled()
    expect(meldungCount).not.toHaveBeenCalled()
    expect(ungelesenTeam).not.toHaveBeenCalled()
  })

  it('Admin ohne Hof: Name und Zähler — wartende Höfe; am Postfach „Offen" im Eingang (N14), kein Weg zum Hof', async () => {
    getSession.mockResolvedValue(adminSitzung('u1') as never)
    userFindUnique
      .mockResolvedValueOnce({ isAdmin: true } as never)
      // adminPflichtOffen liest adminSeit (Nr. 179: nur Passkeys ab dem Recht zählen).
      .mockResolvedValueOnce({ adminSeit: null } as never)
      .mockResolvedValueOnce({ name: 'Max Mustermann', role: 'CUSTOMER', farm: null } as never)
    // Meldungen 3 + ungelesene Antworten 4 + wartende Höfe 2 + offene Erstattung 1.
    // betrieb: null — Punkt und Hinweis von Admin › Betrieb nur in der Produktion (N15/N18, Nr. 103; tests/betrieb-seite.test.ts).
    expect(await ladeAdminbereich()).toEqual({ personName: 'Max Mustermann', hatHof: false, zahlen: { hoefe: 2, briefkasten: 3 + 4 + 2 + 1 }, betrieb: null })
    expect(farmCount).toHaveBeenCalledWith({ where: { approvedAt: null } })
    expect(farmCount).toHaveBeenCalledWith({ where: { approvedAt: null, archivedAt: null } })
    expect(meldungCount).toHaveBeenCalledWith({ where: { status: { in: ['NEU', 'GEPRUEFT'] } } })
    expect(orderCount).toHaveBeenCalledWith({ where: { erstattungOffenSeit: { not: null } } })
  })

  it('Admin ohne Passkey (Pflicht, N20): die Shell mit Name, aber ohne Zähler und Betriebshinweis — nichts gezählt', async () => {
    getSession.mockResolvedValue(adminSitzung('u1') as never)
    passkeyAggregate.mockResolvedValue({ _count: { _all: 0 }, _max: { createdAt: null } } as never)
    userFindUnique
      .mockResolvedValueOnce({ isAdmin: true } as never)
      // adminPflichtOffen liest adminSeit (Nr. 179: nur Passkeys ab dem Recht zählen).
      .mockResolvedValueOnce({ adminSeit: null } as never)
      .mockResolvedValueOnce({ name: 'Max Mustermann', role: 'CUSTOMER', farm: null } as never)
    expect(await ladeAdminbereich()).toEqual({ personName: 'Max Mustermann', hatHof: false, betrieb: null })
    expect(farmCount).not.toHaveBeenCalled()
    expect(meldungCount).not.toHaveBeenCalled()
    expect(orderCount).not.toHaveBeenCalled()
    expect(ungelesenTeam).not.toHaveBeenCalled()
  })

  it('Sitzung ohne Passkey (das Konto hat einen, N20): die Shell ohne Zähler — die Seite leitet zur Admin-Anmeldung um', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' }, session: { id: 'sitzung-u1', createdAt: new Date(), passkeyAm: null } } as never)
    userFindUnique
      .mockResolvedValueOnce({ isAdmin: true } as never)
      // adminPflichtOffen liest adminSeit (Nr. 179: nur Passkeys ab dem Recht zählen).
      .mockResolvedValueOnce({ adminSeit: null } as never)
      .mockResolvedValueOnce({ name: 'Max Mustermann', role: 'CUSTOMER', farm: null } as never)
    expect(await ladeAdminbereich()).toEqual({ personName: 'Max Mustermann', hatHof: false, betrieb: null })
    expect(farmCount).not.toHaveBeenCalled()
    expect(meldungCount).not.toHaveBeenCalled()
    expect(ungelesenTeam).not.toHaveBeenCalled()
  })

  // Nr. 41 (Register N1): „← Mein Hof" und die Konto-Plakette nur mit eigenem Hof —
  // frisch aus der Datenbank, mit derselben Regel wie die Shell (kontoHatHof).
  it('Admin mit eigenem Hof (Rolle FARMER): hatHof — gelesen werden nur Name, Rolle und die Hof-Kennung', async () => {
    getSession.mockResolvedValue(adminSitzung('u1') as never)
    userFindUnique
      .mockResolvedValueOnce({ isAdmin: true } as never)
      // adminPflichtOffen liest adminSeit (Nr. 179: nur Passkeys ab dem Recht zählen).
      .mockResolvedValueOnce({ adminSeit: null } as never)
      .mockResolvedValueOnce({ name: 'Max Mustermann', role: 'FARMER', farm: { id: 'f1' } } as never)
    expect(await ladeAdminbereich()).toMatchObject({ personName: 'Max Mustermann', hatHof: true })
    expect(userFindUnique).toHaveBeenLastCalledWith({
      where: { id: 'u1' },
      select: { name: true, role: true, farm: { select: { id: true } } },
    })
  })

  it('Rolle FARMER ohne Hof: kein Weg zum Hof (der Hofbereich führte erst nach /onboarding)', async () => {
    getSession.mockResolvedValue(adminSitzung('u1') as never)
    userFindUnique
      .mockResolvedValueOnce({ isAdmin: true } as never)
      // adminPflichtOffen liest adminSeit (Nr. 179: nur Passkeys ab dem Recht zählen).
      .mockResolvedValueOnce({ adminSeit: null } as never)
      .mockResolvedValueOnce({ name: 'Max Mustermann', role: 'FARMER', farm: null } as never)
    expect(await ladeAdminbereich()).toMatchObject({ hatHof: false })
  })
})

describe('/admin/meldungen — Umleitung in den Reiter „Meldungen" (echter 308, Nr. 101)', () => {
  const getSession = vi.mocked(auth.api.getSession)
  const userFindUnique = vi.mocked(prisma.user.findUnique)
  const umleiten = (suche = '') => meldungenUmleitung(new NextRequest(`http://localhost/admin/meldungen${suche}`))

  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue(adminSitzung('u1') as never)
    vi.mocked(prisma.passkey.aggregate).mockResolvedValue({ _count: { _all: 1 }, _max: { createdAt: new Date(0) } } as never)
  })

  it('Admin: 308 auf den Reiter — die alten Filter gibt es dort nicht', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: true } as never)
    for (const antwort of [await umleiten('?status=NEU&art=FEHLER'), await umleiten()]) {
      expect(antwort.status).toBe(308)
      expect(antwort.headers.get('location')).toBe('http://localhost/admin/postfach?reiter=meldungen')
    }
  })

  it('Gegenprobe: ohne Recht 404 — die Umleitung verrät das Ziel nicht', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)
    await expect(umleiten('?status=NEU')).rejects.toThrow('NOT_FOUND')
  })
})

describe('/admin/meldungen/[id] — Umleitung in die Spalte „Meldung entscheiden" (echter 308, Nr. 95/101)', () => {
  const getSession = vi.mocked(auth.api.getSession)
  const userFindUnique = vi.mocked(prisma.user.findUnique)
  const umleiten = (id: string) => meldungUmleitung(new NextRequest(`http://localhost/admin/meldungen/${id}`), { params: Promise.resolve({ id }) })

  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue(adminSitzung('u1') as never)
    vi.mocked(prisma.passkey.aggregate).mockResolvedValue({ _count: { _all: 1 }, _max: { createdAt: new Date(0) } } as never)
  })

  it('Admin: 308 auf /admin/postfach?art=meldung&meldung=<id> — auch mit der Kurznummer', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: true } as never)
    const voll = await umleiten('ckmeldung00000000000000000')
    expect(voll.status).toBe(308)
    expect(voll.headers.get('location')).toBe('http://localhost/admin/postfach?art=meldung&meldung=ckmeldung00000000000000000')
    expect((await umleiten('ab12cd34')).headers.get('location')).toBe('http://localhost/admin/postfach?art=meldung&meldung=ab12cd34')
  })

  it('Gegenprobe: ohne Recht 404 — die Umleitung verrät das Ziel nicht', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)
    await expect(umleiten('ab12cd34')).rejects.toThrow('NOT_FOUND')
  })
})
