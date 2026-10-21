/**
 * Mock-Wache für Pakete mit Sicherheitsfunktion (Nr. 127, Regelvorschlag 115, freigegeben 20.10.2026).
 *
 * Ursache (Nr. 115): Ein `vi.mock` auf ein Paket erreicht Abhängigkeiten nicht, die außerhalb von Vite
 * laden (`@simplewebauthn/server` unter Better Auth); die Attrappe wäre wirkungslos geblieben, der Test
 * grün und der Weg ungeprüft. Wer ein solches Paket ersetzt, prüft denselben Weg mindestens einmal echt.
 * Die Regel selbst steht als ein Satz in TESTING_GUIDELINES §3; was sie ausmacht (Bestand mit Grund, nur schrumpfen),
 * steht hier.
 *
 * Beweist (Quelltext von `tests/`, TypeScript-Syntaxbaum, kein Netz): Ein `vi.mock` / `vi.doMock` auf
 * Better Auth und seine Plugins, Stripe, WebAuthn oder sharp steht nur in Dateien aus PAKET_MOCK_BESTAND —
 * je Datei mit Grund und dem Test, der den Weg echt prüft. Kommentare zählen nicht. Der Bestand schrumpft:
 * Eine Datei, die ihn nicht mehr braucht, fällt als veraltet auf. Die Projekt-Module `@/lib/auth` und
 * `@/lib/stripe` sind keine Pakete und bleiben frei (sie sind die Grenze, die Tests ersetzen dürfen).
 *
 * Gegenprobe: Attrappen mit `vi.mock('better-auth/…')`, `@better-auth/…`, `stripe`, `@stripe/…`,
 * `@simplewebauthn/…`, `sharp` (auch `vi.doMock` und die Form `vi.mock(import('…'))`) schlagen an; ein
 * Projekt-Modul, ein Kommentar und ein Text nicht.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const ORDNER = join(WURZEL, 'tests')

/** Pakete mit Sicherheitsfunktion: Anmeldung, Geld, Passkeys, Bilder aus Fremdhand. */
const SICHERHEITSPAKET = /^(better-auth(\/.*)?|@better-auth\/.*|stripe|@stripe\/.*|@simplewebauthn\/.*|sharp)$/

/** Dateien, die ein solches Paket heute ersetzen, je mit Grund und echtem Gegenstück. Nur schrumpfen. */
const PAKET_MOCK_BESTAND: Record<string, string> = {
  'agb-einbindung.test.ts':
    '@stripe/react-stripe-js: Zahlungsmaske läuft nur im Browser; der Test prüft die Seite um sie herum. Echt geprüft: Zahlung und Signatur in integration/webhook-zahlung.int.test.ts',
  'kasse-formular.test.ts':
    '@stripe/react-stripe-js: Zahlungsmaske läuft nur im Browser; der Test prüft das Formular um sie herum. Echt geprüft: integration/webhook-zahlung.int.test.ts',
  'kasse-seite.test.ts':
    '@stripe/react-stripe-js: Zahlungsmaske läuft nur im Browser; der Test prüft die Seite um sie herum. Echt geprüft: integration/webhook-zahlung.int.test.ts',
  'telefon-nach-kauf.test.ts':
    '@stripe/react-stripe-js: Zahlungsmaske läuft nur im Browser; der Test prüft die Props der Hofseite. Echt geprüft: integration/webhook-zahlung.int.test.ts',
  'stripe-client-wache.test.ts':
    'stripe: Die Attrappe zählt Konstruktor-Aufrufe, damit die Modus-Wache (Register Z2) ohne Netz geprüft wird. Echt geprüft: Client und Signatur in integration/webhook-zahlung.int.test.ts',
  'bild-ersetzen.test.ts':
    'sharp: Die Attrappe hält die Kette fest, die die Action baut. Echt geprüft: sharp-lader-sperre.test.ts und teilen-bild-jpeg.test.ts',
  'upload-bildformat.test.ts':
    'sharp: Die Attrappe hält fest, ob und mit welchem Format sharp erreicht wird (Tor davor). Echt geprüft: sharp-lader-sperre.test.ts und teilen-bild-jpeg.test.ts',
  'upload-sperre.test.ts':
    'sharp: Die Attrappe zählt block/unblock, ohne die Lader des Prozesses zu sperren. Echt geprüft: sharp-lader-sperre.test.ts',
  'upload-startseite.test.ts':
    'sharp: Die Attrappe hält die Kette der Startseiten-Bilder fest. Echt geprüft: sharp-lader-sperre.test.ts und teilen-bild-jpeg.test.ts',
}

function parse(quelltext: string, name = 'attrappe.ts'): ts.SourceFile {
  return ts.createSourceFile(name, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

function besuche(knoten: ts.Node, fn: (k: ts.Node) => void): void {
  fn(knoten)
  ts.forEachChild(knoten, (kind) => besuche(kind, fn))
}

/** Das Modul, das `vi.mock('…')`, `vi.doMock('…')` oder `vi.mock(import('…'))` ersetzt; sonst `null`. */
function ersetztesModul(k: ts.CallExpression): string | null {
  const ziel = k.expression
  if (!ts.isPropertyAccessExpression(ziel) || !ts.isIdentifier(ziel.expression) || ziel.expression.text !== 'vi') return null
  if (!['mock', 'doMock'].includes(ziel.name.text)) return null
  const erstes = k.arguments[0]
  if (!erstes) return null
  if (ts.isStringLiteral(erstes) || ts.isNoSubstitutionTemplateLiteral(erstes)) return erstes.text
  if (ts.isCallExpression(erstes) && erstes.expression.kind === ts.SyntaxKind.ImportKeyword) {
    const inner = erstes.arguments[0]
    if (inner && (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner))) return inner.text
  }
  return null
}

/** Die Sicherheitspakete, die eine Datei mit `vi.mock` ersetzt, je mit Zeile. Leer = keines. */
function paketMocks(quelltext: string, name = 'attrappe.ts'): string[] {
  const sf = parse(quelltext, name)
  const treffer: string[] = []
  besuche(sf, (k) => {
    if (!ts.isCallExpression(k)) return
    const modul = ersetztesModul(k)
    if (modul !== null && SICHERHEITSPAKET.test(modul)) {
      treffer.push(`${name}:${sf.getLineAndCharacterOfPosition(k.getStart(sf)).line + 1} vi.mock('${modul}')`)
    }
  })
  return treffer
}

function dateienUnter(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? dateienUnter(join(ordner, e.name)) : e.name.endsWith('.ts') ? [join(ordner, e.name)] : [],
  )
}

describe('Mock-Wache für Pakete mit Sicherheitsfunktion (Nr. 115, Regelvorschlag in Nr. 127)', () => {
  it('vi.mock auf Better Auth, Stripe, WebAuthn und sharp steht nur in Dateien aus dem Bestand', () => {
    const funde: Record<string, string[]> = {}
    for (const pfad of dateienUnter(ORDNER)) {
      const name = relative(ORDNER, pfad).split(sep).join('/')
      const gefunden = paketMocks(readFileSync(pfad, 'utf8'), name)
      if (gefunden.length > 0) funde[name] = gefunden
    }

    const neu = Object.keys(funde).filter((n) => !(n in PAKET_MOCK_BESTAND))
    expect(
      neu.map((n) => funde[n].join('\n')),
      'Das Paket echt prüfen (Integrationstest oder echte Signatur, Vorbild integration/admin-passkey.int.test.ts) oder die Datei mit Grund in PAKET_MOCK_BESTAND aufnehmen (TESTING_GUIDELINES §3)',
    ).toEqual([])
    const veraltet = Object.keys(PAKET_MOCK_BESTAND).filter((n) => !(n in funde))
    expect(veraltet, 'PAKET_MOCK_BESTAND: Datei ersetzt kein Paket mehr, Eintrag streichen').toEqual([])
    for (const grund of Object.values(PAKET_MOCK_BESTAND)) expect(grund.length).toBeGreaterThan(40)
  }, 30_000)

  it('findet den heutigen Bestand (kein leerer Fund) und die echten Gegenstücke gibt es', () => {
    const funde = dateienUnter(ORDNER).filter((p) => paketMocks(readFileSync(p, 'utf8')).length > 0)
    expect(funde.length).toBeGreaterThanOrEqual(Object.keys(PAKET_MOCK_BESTAND).length)
    for (const datei of ['integration/webhook-zahlung.int.test.ts', 'sharp-lader-sperre.test.ts', 'teilen-bild-jpeg.test.ts']) {
      expect(readFileSync(join(ORDNER, datei), 'utf8').length, datei).toBeGreaterThan(0)
    }
  }, 30_000)

  describe('Gegenprobe an Attrappen', () => {
    it('schlägt bei Better Auth, seinen Plugins, Stripe, WebAuthn und sharp an', () => {
      for (const modul of [
        'better-auth',
        'better-auth/plugins',
        'better-auth/next-js',
        '@better-auth/passkey',
        'stripe',
        '@stripe/stripe-js',
        '@stripe/react-stripe-js',
        '@simplewebauthn/server',
        'sharp',
      ]) {
        expect(paketMocks(`vi.mock('${modul}', () => ({}))`), modul).toHaveLength(1)
      }
    })

    it('schlägt bei vi.doMock, doppelten Anführungszeichen und der Form vi.mock(import(…)) an', () => {
      expect(paketMocks(`vi.doMock('better-auth/plugins', () => ({}))`)).toHaveLength(1)
      expect(paketMocks(`vi.mock("stripe", () => ({}))`)).toHaveLength(1)
      expect(paketMocks('vi.mock(`sharp`, () => ({}))')).toHaveLength(1)
      expect(paketMocks(`vi.mock(import('@simplewebauthn/server'), () => ({}))`)).toHaveLength(1)
    })

    it('nennt die Zeile des Fundes', () => {
      expect(paketMocks(`import { vi } from 'vitest'\n\nvi.mock('better-auth/crypto', () => ({}))`, 'neu.test.ts')).toEqual([
        "neu.test.ts:3 vi.mock('better-auth/crypto')",
      ])
    })

    it('lässt Projekt-Module, andere Pakete, Kommentare und Text durch', () => {
      const q = [
        `vi.mock('@/lib/auth', () => ({}))`,
        `vi.mock('@/lib/stripe', () => ({}))`,
        `vi.mock('@/lib/stripe-client', () => ({}))`,
        `vi.mock('next/headers', () => ({}))`,
        `vi.mock('stripe-mock-server', () => ({}))`,
        `vi.mock('sharpie', () => ({}))`,
        `// vi.mock('better-auth', () => ({}))`,
        `const hinweis = "vi.mock('sharp')"`,
        `import sharp from 'sharp'`,
      ].join('\n')
      expect(paketMocks(q)).toEqual([])
    })
  })
})
