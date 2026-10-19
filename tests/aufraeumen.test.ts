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
