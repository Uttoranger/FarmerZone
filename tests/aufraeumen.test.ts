/**
 * Aufräumen und Bilder ohne Verwendung — Quelltext-Wache (Register N18,
 * Nr. 104), am Syntaxbaum von TypeScript, nicht an Regex über den Rohtext.
 *
 * Beweist:
 *  - Gelöscht wird nur in den fünf Tabellen mit fester Grenze (Session,
 *    Verification, WebhookEvent, BetriebMessung, seit Nr. 114 EinmalLink), je
 *    EIN deleteMany mit `where`; die Melde-Vermerke (MELDE_VERMERK_TYP) sind
 *    ausgenommen.
 *  - Keine Bestellung, kein Konto, kein Hof wird je angefasst: kein
 *    `order.delete*` (auch nicht über einen anderen Client), keine Rohabfrage.
 *  - Kein `del(` (Bild-Speicher) in aufraeumen.ts, betrieb-bilder.ts und den
 *    beiden Routen; kein Import von `del`.
 *  - Gegenprobe: Die Suche schlägt an einem Löschen von Bestellungen, an
 *    `del(` und am Import an — sonst bewiese ein leerer Fund nichts.
 *  - Seit Nr. 118 (Regelvorschlag 104): Jedes Schema-Feld, das nach einer Bildadresse aussieht (`Url`, `bild`,
 *    `image`, `photo`, `logo`, `banner`, `screenshot`, `foto` im Namen), wird von `ladeBildVerwendung` gelesen —
 *    oder steht in KEIN_BILD mit Grund. Ein neues Bild-Feld ließe seine Bilder sonst als „ohne Verwendung“
 *    erscheinen, und das Löschen nach Durchsicht (N18) träfe benutzte Bilder.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const WURZEL = process.cwd()

/** Je Datei: welche Empfänger von delete/deleteMany erlaubt sind. */
const DATEIEN: Record<string, readonly string[]> = {
  'src/server/aufraeumen.ts': ['prisma.session', 'prisma.verification', 'prisma.webhookEvent', 'prisma.betriebMessung', 'prisma.einmalLink'],
  'src/server/betrieb-bilder.ts': [],
  'src/app/api/cron/cleanup-reservations/route.ts': ['prisma.stockReservation'],
  'src/app/admin/betrieb/bilder-export/route.ts': [],
}

type Loeschen = { empfaenger: string; argument: ts.Expression | undefined }
type Befund = { loeschen: Loeschen[]; maengel: string[] }

function pruefe(quelle: string, erlaubt: readonly string[]): Befund {
  const datei = ts.createSourceFile('pruefling.ts', quelle, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const loeschen: Loeschen[] = []
  const maengel: string[] = []
  const besuche = (knoten: ts.Node): void => {
    if (ts.isImportDeclaration(knoten) && knoten.importClause?.namedBindings && ts.isNamedImports(knoten.importClause.namedBindings)) {
      for (const e of knoten.importClause.namedBindings.elements) if ((e.propertyName ?? e.name).text === 'del') maengel.push('Import von del')
    }
    // prisma.$executeRaw`…` ist ein Tagged Template, kein Aufruf.
    if (ts.isTaggedTemplateExpression(knoten) && ts.isPropertyAccessExpression(knoten.tag) && /^\$(execute|query)Raw/.test(knoten.tag.name.text)) {
      maengel.push(`Rohabfrage ${knoten.tag.name.text}`)
    }
    if (ts.isCallExpression(knoten)) {
      const ziel = knoten.expression
      if (ts.isIdentifier(ziel) && ziel.text === 'del') maengel.push('del(')
      if (ts.isPropertyAccessExpression(ziel)) {
        const name = ziel.name.text
        const empfaenger = ziel.expression.getText(datei)
        if (name === 'del') maengel.push('del(')
        if (/^\$(execute|query)Raw/.test(name)) maengel.push(`Rohabfrage ${name}`)
        if (name === 'delete' || name === 'deleteMany') {
          loeschen.push({ empfaenger, argument: knoten.arguments[0] })
          if (/\b(order|orderItem|user|farm|account)\b/i.test(empfaenger)) maengel.push(`Bestellung, Konto oder Hof: ${empfaenger}.${name}`)
          else if (!erlaubt.includes(empfaenger)) maengel.push(`nicht erlaubt: ${empfaenger}.${name}`)
        }
      }
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return { loeschen, maengel }
}

function lies(pfad: string): string {
  return readFileSync(join(WURZEL, pfad), 'utf8')
}

describe('Aufräumen und Bilder ohne Verwendung löschen nur, was sie dürfen', () => {
  it.each(Object.entries(DATEIEN))('%s: kein del(, keine Bestellung, nur erlaubte Tabellen', (pfad, erlaubt) => {
    expect(pruefe(lies(pfad), erlaubt).maengel).toEqual([])
  })

  it('aufraeumen.ts: je EIN deleteMany mit where für die fünf Tabellen', () => {
    const { loeschen } = pruefe(lies('src/server/aufraeumen.ts'), DATEIEN['src/server/aufraeumen.ts'])
    expect(loeschen.map((l) => l.empfaenger).sort()).toEqual([
      'prisma.betriebMessung',
      'prisma.einmalLink',
      'prisma.session',
      'prisma.verification',
      'prisma.webhookEvent',
    ])
    for (const l of loeschen) {
      const arg = l.argument
      expect(arg !== undefined && ts.isObjectLiteralExpression(arg) && arg.properties.some((p) => p.name?.getText() === 'where')).toBe(true)
    }
  })

  it('aufraeumen.ts: die Melde-Vermerke bleiben (Bedingung mit MELDE_VERMERK_TYP aus erstattung-gescheitert)', () => {
    const quelle = lies('src/server/aufraeumen.ts')
    const { loeschen } = pruefe(quelle, DATEIEN['src/server/aufraeumen.ts'])
    const webhook = loeschen.find((l) => l.empfaenger === 'prisma.webhookEvent')
    expect(webhook?.argument?.getText()).toMatch(/type:\s*\{\s*not:\s*MELDE_VERMERK_TYP\s*\}/)
    expect(quelle).toContain("import { MELDE_VERMERK_TYP } from '@/server/erstattung-gescheitert'")
  })
})

describe('Gegenproben — die Suche schlägt an', () => {
  it('erkennt das Löschen von Bestellungen, auch über einen Transaktions-Client', () => {
    expect(pruefe('await prisma.order.deleteMany({ where: {} })', ['prisma.order']).maengel).toHaveLength(1)
    expect(pruefe('await tx.orderItem.delete({ where: { id } })', []).maengel).toHaveLength(1)
  })

  it('erkennt del( und den Import von del, aber nicht im Kommentar', () => {
    expect(pruefe("import { del as weg } from '@vercel/blob'\nawait del(url)\nawait blob.del(url)", []).maengel).toEqual(['Import von del', 'del(', 'del('])
    expect(pruefe('// await del(url)\nconst x = 1', []).maengel).toEqual([])
  })

  it('erkennt eine nicht erlaubte Tabelle und eine Rohabfrage', () => {
    expect(pruefe('await prisma.meldung.deleteMany({ where: {} })\nawait prisma.$executeRaw`DELETE FROM x`', []).maengel).toEqual([
      'nicht erlaubt: prisma.meldung.deleteMany',
      'Rohabfrage $executeRaw',
    ])
  })
})

/** Felder, die nach einer Bildadresse klingen, aber keine sind — mit Grund. Neue Zeilen nur mit einem Satz, der es belegt. */
const KEIN_BILD: Record<string, string> = {
  'User.image': 'Das Profilbild, das Better Auth von einem Anmeldedienst mitbringt; es liegt nie in unserem Bild-Speicher.',
  'Farm.bannerAusschnitt': 'Ausschnitt, Zoom und Filter des Titelbilds als Zahlen (Json), keine Adresse.',
  'Farm.logoAusschnitt': 'Ausschnitt und Zoom des Logos als Zahlen (Json), keine Adresse.',
  'Product.bildAusschnitt': 'Ausschnitt und Zoom des Produktfotos als Zahlen (Json), keine Adresse.',
  'StatusPost.fotoAusschnitt': 'Ausschnitt und Zoom des Beitragsfotos als Zahlen (Json), keine Adresse.',
  'Meldung.seiteUrl': 'Die Seite der App, auf der die Meldung entstand — nie ein Bild.',
  'Rundschreiben.linkUrl': 'Das Ziel des Links im Rundschreiben, kein Bild im Bild-Speicher.',
  'Nachricht.linkUrl': 'Das Ziel des Links in der Nachricht, kein Bild im Bild-Speicher.',
  'StartseiteBlock.linkUrl': 'Das Ziel des Links im Block (relativ oder Produktionsdomain), kein Bild.',
}

const BILD_NAME = /url|bild|image|photo|logo|banner|screenshot|foto/i

/** „Modell.feld“ für jedes String- oder Json-Feld im Schema, dessen Name nach einer Bildadresse klingt. */
function bildFelderImSchema(schema: string): string[] {
  const felder: string[] = []
  let modell: string | null = null
  for (const zeile of schema.split('\n')) {
    const kopf = /^model (\w+) \{/.exec(zeile)
    if (kopf) modell = kopf[1]
    else if (zeile.startsWith('}')) modell = null
    else if (modell) {
      const feld = /^\s+(\w+)\s+(String|Json)(\?|\[\])?(\s|$)/.exec(zeile)
      if (feld && BILD_NAME.test(feld[1])) felder.push(`${modell}.${feld[1]}`)
    }
  }
  return felder
}

/** „Modell.feld“, das `ladeBildVerwendung` je `prisma.<modell>.findMany({ select: { feld: true } })` liest. */
function felderDerBildVerwendung(quelltext: string): string[] {
  const datei = ts.createSourceFile('betrieb-bilder.ts', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const felder: string[] = []
  const imBlock = (knoten: ts.Node): void => {
    if (ts.isCallExpression(knoten) && ts.isPropertyAccessExpression(knoten.expression) && knoten.expression.name.text === 'findMany') {
      const tabelle = knoten.expression.expression
      const argument = knoten.arguments[0]
      if (ts.isPropertyAccessExpression(tabelle) && tabelle.expression.getText(datei) === 'prisma' && argument && ts.isObjectLiteralExpression(argument)) {
        const modell = tabelle.name.text.charAt(0).toUpperCase() + tabelle.name.text.slice(1)
        const auswahl = argument.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(datei) === 'select')
        if (auswahl && ts.isPropertyAssignment(auswahl) && ts.isObjectLiteralExpression(auswahl.initializer)) {
          for (const feld of auswahl.initializer.properties) if (feld.name) felder.push(`${modell}.${feld.name.getText(datei)}`)
        }
      }
    }
    ts.forEachChild(knoten, imBlock)
  }
  const funktion = datei.statements.find((st) => ts.isFunctionDeclaration(st) && st.name?.text === 'ladeBildVerwendung')
  if (funktion) imBlock(funktion)
  return felder
}

describe('Jedes Bild-Feld im Schema steht in ladeBildVerwendung (Regelvorschlag 104)', () => {
  const schema = (): string => lies('prisma/schema.prisma')
  const gelesen = (): string[] => felderDerBildVerwendung(lies('src/server/betrieb-bilder.ts'))

  it('Gegenprobe: die Suche findet Felder im Schema und die Auswahl in ladeBildVerwendung', () => {
    const probe = ['model Produkt {', '  id String @id', '  vorschauBildUrl String?', '  name String', '  fotoAusschnitt Json?', '  art Art', '}', 'model Hof {', '  logoUrl String?', '}'].join('\n')
    expect(bildFelderImSchema(probe)).toEqual(['Produkt.vorschauBildUrl', 'Produkt.fotoAusschnitt', 'Hof.logoUrl'])
    const quelle = "export async function ladeBildVerwendung() { await prisma.farm.findMany({ where: { logoUrl: { not: null } }, select: { logoUrl: true } }) }\nconst x = prisma.product.findMany({ select: { imageUrl: true } })"
    // findMany außerhalb von ladeBildVerwendung zählt nicht
    expect(felderDerBildVerwendung(quelle)).toEqual(['Farm.logoUrl'])
  })

  it('jedes Feld, das nach einer Bildadresse klingt, wird gelesen oder steht mit Grund in KEIN_BILD — ein neues fällt mit seinem Namen auf', () => {
    const gelesenSet = new Set(gelesen())
    const offen = bildFelderImSchema(schema()).filter((feld) => !gelesenSet.has(feld) && !(feld in KEIN_BILD))
    expect(
      offen,
      `Neues Feld, das nach einem Bild klingt: ${offen.join(', ')}. In ladeBildVerwendung (src/server/betrieb-bilder.ts) lesen — sonst erscheinen ` +
        'seine Bilder als „ohne Verwendung“ — oder mit Grund in KEIN_BILD eintragen.'
    ).toEqual([])
  })

  it('Gegenprobe: ein Feld, das weder gelesen wird noch in KEIN_BILD steht, wird gemeldet', () => {
    const schemaMitNeuem = schema().replace('model FarmPhoto {', 'model FarmPhoto {\n  vorschauBildUrl String?')
    const gelesenSet = new Set(gelesen())
    const offen = bildFelderImSchema(schemaMitNeuem).filter((feld) => !gelesenSet.has(feld) && !(feld in KEIN_BILD))
    expect(offen).toEqual(['FarmPhoto.vorschauBildUrl'])
  })

  it('jeder Eintrag in KEIN_BILD gibt es im Schema und wird nicht doch gelesen — sonst ist er veraltet', () => {
    const imSchema = new Set(bildFelderImSchema(schema()))
    const gelesenSet = new Set(gelesen())
    for (const [feld, grund] of Object.entries(KEIN_BILD)) {
      expect(imSchema.has(feld), `${feld} gibt es nicht mehr im Schema — aus KEIN_BILD nehmen.`).toBe(true)
      expect(gelesenSet.has(feld), `${feld} wird gelesen — aus KEIN_BILD nehmen.`).toBe(false)
      expect(grund.length, feld).toBeGreaterThan(30)
    }
  })
})
