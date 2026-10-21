/**
 * Die Leitplanken von „Preise vergleichen" als Prüfungen (Register N23,
 * Freigabe Lauf 19 Nr. 124 Punkt 6) — die Grundlage für die rechtliche
 * Prüfung der Spanne durch die Projektleitung:
 *
 *   1. Kein Text empfiehlt einen Preis oder wertet ihn: eine Wache auf alle
 *      String-Literale und JSX-Texte aus src/lib/umfeld.ts,
 *      components/analytics/umfeld-*.tsx und components/region/preis-streifen.tsx
 *      (ohne className, ohne Groß-/Kleinschreibung, nur am Wortanfang) —
 *      mit Gegenprobe „Du solltest erhöhen".
 *   2. In den Daten der Pins steht kein Preis (kein „€" im Ergebnis von
 *      baueUmfeldKarte) — Gegenprobe: in den Zeilen derselben Eingabe schon.
 *   3. Keine Sortierung nach Preis — weder Zeilen noch aufgeklappte Zeile
 *      noch Karte am Pin; geprüft mit absichtlich vertauschten Preisen.
 *   4. Testhöfe, pausierte Höfe und der eigene Hof fehlen in Zählung, Streifen
 *      und Karte (die Abfrage hier mit Attrappe, gegen echtes Postgres in
 *      tests/integration/umfeld.int.test.ts).
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), findMany: vi.fn() },
    product: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { getUmfeld } from '@/server/queries/umfeld'
import { baueUmfeld, baueUmfeldKarte, baueUmfeldZeilen, type UmfeldEingabe, type UmfeldHof, type UmfeldProdukt } from '@/lib/umfeld'

const WURZEL = path.resolve(__dirname, '..')

// ─── 1. Wache auf die Texte ─────────────────────────────────────────────────

const ANALYTICS = 'src/components/analytics'
const GEWACHTE_DATEIEN = [
  'src/lib/umfeld.ts',
  ...fs
    .readdirSync(path.join(WURZEL, ANALYTICS))
    .filter((d) => /^umfeld-.*\.tsx$/.test(d))
    .map((d) => `${ANALYTICS}/${d}`),
  'src/components/region/preis-streifen.tsx',
]

/** Wortanfänge, die einen Preis empfehlen oder werten (Freigabe Nr. 124, Punkt 6). */
const VERBOTEN = ['empfehl', 'empfiehl', 'solltest', 'zu teuer', 'zu billig', 'zu günstig', 'erhöh', 'senk', 'günstiger als', 'teurer als', 'rang']

/** Die eine erlaubte Wendung — der letzte Satz von „So rechnen wir". */
const ERLAUBT = ['empfiehlt keine']

/**
 * Die Wortgrenze selbst gebaut: `\b` kennt in JavaScript keine Umlaute. Davor
 * steht kein Buchstabe und keine Ziffer irgendeiner Schrift — so schlagen
 * „Vorrang" und „orange" nicht an, „Rangliste" schon.
 */
function wortAnfang(wort: string): RegExp {
  const muster = wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
  return new RegExp(`(?<![\\p{L}\\p{N}])${muster}`, 'u')
}

/** Alle Texte einer Quelle: String-Literale, Teile von Template-Literalen, JSX-Text — ohne className und ohne Modulpfade. */
function texteAus(quelle: string, datei = 'datei.tsx'): string[] {
  const baum = ts.createSourceFile(datei, quelle, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const texte: string[] = []
  const besuche = (knoten: ts.Node): void => {
    if (ts.isJsxAttribute(knoten) && knoten.name.getText(baum) === 'className') return
    if ((ts.isImportDeclaration(knoten) || ts.isExportDeclaration(knoten)) && knoten.moduleSpecifier) {
      // Nur der Pfad fällt weg — ein `export const` mit Text bleibt gewacht.
      return
    }
    if (ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten)) texte.push(knoten.text)
    else if (ts.isTemplateHead(knoten) || ts.isTemplateMiddle(knoten) || ts.isTemplateTail(knoten)) texte.push(knoten.text)
    else if (ts.isJsxText(knoten) && knoten.text.trim() !== '') texte.push(knoten.text)
    ts.forEachChild(knoten, besuche)
  }
  besuche(baum)
  return texte
}

function funde(texte: readonly string[]): string[] {
  const treffer: string[] = []
  for (const roh of texte) {
    let text = roh.toLocaleLowerCase('de')
    for (const erlaubt of ERLAUBT) text = text.split(erlaubt).join(' ')
    for (const wort of VERBOTEN) if (wortAnfang(wort).test(text)) treffer.push(`${wort}: ${roh.trim()}`)
  }
  return treffer
}

describe('Leitplanke 1 — kein Text empfiehlt einen Preis oder wertet ihn', () => {
  it('in allen Texten von Preise vergleichen steht keines der verbotenen Wörter', () => {
    expect(GEWACHTE_DATEIEN).toEqual(expect.arrayContaining(['src/components/analytics/umfeld-liste.tsx', 'src/components/region/preis-streifen.tsx']))
    const alle: string[] = []
    for (const datei of GEWACHTE_DATEIEN) {
      const texte = texteAus(fs.readFileSync(path.join(WURZEL, datei), 'utf8'), datei)
      expect(texte.length, datei).toBeGreaterThan(0)
      alle.push(...texte)
      expect(funde(texte), datei).toEqual([])
    }
    // Gegenprobe der Suche: Sie liest wirklich die Sätze, um die es geht.
    expect(alle.join('\n')).toContain('So rechnen wir')
    expect(alle.join('\n')).toContain('empfiehlt keine Preise.')
    expect(alle.join('\n')).toContain('Kaufen geht über die Hofseite.')
  })

  it('Gegenprobe: „Du solltest erhöhen" macht die Wache rot', () => {
    expect(funde(texteAus("const satz = 'Du solltest erhöhen'"))).toEqual(['solltest: Du solltest erhöhen', 'erhöh: Du solltest erhöhen'])
  })

  it('Gegenprobe: jedes verbotene Wort schlägt an, auch groß geschrieben, in JSX und in Template-Literalen', () => {
    const quelle = [
      'const a = `Das ist ZU  TEUER für ${x}`',
      'const b = <p>Wir empfehlen dir das</p>',
      "const c = { satz: 'Der Hof empfiehlt € 2' }",
      "const d = 'Senke den Preis'",
      "const e = 'Platz 1 in der Rangliste'",
      "const f = 'günstiger als Hof B'",
    ].join(';\n')
    expect(funde(texteAus(quelle)).map((f) => f.split(':')[0])).toEqual(['zu teuer', 'empfehl', 'empfiehl', 'senk', 'rang', 'günstiger als'])
  })

  it('schlägt nicht an bei Wortteilen, Klassen-Namen und „empfiehlt keine"', () => {
    const quelle = [
      "const a = 'Vorrang hat die orange Fläche'",
      '<span className="senkrecht rangiert">Erdäpfel</span>',
      'const b = `${MARKE} empfiehlt keine Preise.`',
      "import { x } from '@/lib/rang'",
    ].join(';\n')
    expect(funde(texteAus(quelle))).toEqual([])
    // Gegenprobe: dasselbe Wort außerhalb von className schlägt an.
    expect(funde(texteAus('<span title="senkrecht">x</span>'))).toEqual(['senk: senkrecht'])
  })
})

// ─── Testdaten ──────────────────────────────────────────────────────────────

let zaehler = 0
beforeEach(() => {
  zaehler = 0
  vi.clearAllMocks()
})

function honig(euro: number, teil: Partial<UmfeldProdukt> = {}): UmfeldProdukt {
  zaehler += 1
  return {
    id: `prod-${zaehler}`,
    name: `Honig ${zaehler}`,
    category: 'HONIG',
    subcategory: 'BLUETENHONIG',
    preisCents: Math.round(euro * 100),
    unit: 'KG',
    unitSize: null,
    nettoMenge: null,
    nettoEinheit: null,
    imageUrl: null,
    bildAusschnitt: null,
    kaufbar: true,
    ...teil,
  }
}

function hof(slug: string, entfernungKm: number, produkte: UmfeldProdukt[]): UmfeldHof {
  return { slug, name: slug, postalCode: '1234', city: 'Testort', lat: 47.25, lon: 11.4, entfernungKm, fotos: [], kategorien: ['HONIG'], produkte }
}

const BASIS: UmfeldEingabe = { bereich: 'LEBENSMITTEL', km: 25, eigeneProdukte: [], hoefe: [], eigenerSlug: 'sonnhof' }
const STANDORT = { lat: 47.25, lon: 11.4 }

// ─── 2. Keine Preise an den Pins ────────────────────────────────────────────

describe('Leitplanke 2 — in den Daten der Pins steht kein Preis', () => {
  it('das serialisierte Ergebnis von baueUmfeldKarte enthält kein „€" — die Zeilen derselben Eingabe schon', () => {
    const eingabe = { ...BASIS, hoefe: [hof('testhof-a', 3, [honig(15.8), honig(9.9)]), hof('testhof-b', 8, [honig(18)])], eigeneProdukte: [honig(16)] }
    const karte = JSON.stringify(baueUmfeldKarte({ ...eingabe, eigenerStandort: STANDORT }))
    expect(karte).not.toContain('€')
    expect(karte).toContain('testhof-a')
    expect(JSON.stringify(baueUmfeldZeilen(eingabe))).toContain('€')
  })
})

// ─── 3. Keine Sortierung nach Preis ─────────────────────────────────────────

describe('Leitplanke 3 — keine Sortierung nach Preis', () => {
  const tausche = (eingabe: UmfeldEingabe, a: number, b: number): UmfeldEingabe => ({
    ...eingabe,
    hoefe: eingabe.hoefe.map((h) => ({
      ...h,
      produkte: h.produkte.map((p) => (p.preisCents === a ? { ...p, preisCents: b } : p.preisCents === b ? { ...p, preisCents: a } : p)),
    })),
  })

  it('die aufgeklappte Zeile bleibt nach Entfernung, auch wenn der fernere Hof billiger wird', () => {
    const eingabe = { ...BASIS, hoefe: [hof('nah', 4, [honig(1)]), hof('mittel', 9, [honig(2)]), hof('fern', 20, [honig(3)])] }
    const slugs = (e: UmfeldEingabe) => baueUmfeldZeilen(e)[0].hoefe.map((h) => h.slug)
    expect(slugs(eingabe)).toEqual(['nah', 'mittel', 'fern'])
    expect(slugs(tausche(eingabe, 100, 300))).toEqual(['nah', 'mittel', 'fern'])
  })

  it('die Zeilen bleiben in ihrer Reihenfolge, wenn die Preise zwischen ihnen tauschen', () => {
    const kaese = (euro: number) => honig(euro, { category: 'MILCH', subcategory: 'KAESE' })
    const eingabe = { ...BASIS, hoefe: [hof('a', 4, [honig(10), kaese(20)]), hof('b', 9, [honig(11), kaese(21)])] }
    const titel = (e: UmfeldEingabe) => baueUmfeldZeilen(e).map((z) => z.titel)
    const vorher = titel(eingabe)
    expect(titel(tausche(tausche(eingabe, 1000, 2000), 1100, 2100))).toEqual(vorher)
  })

  it('die Karte am Pin zeigt die Produkte in der Reihenfolge der Hofseite, nicht nach Preis', () => {
    const produkte = [honig(9), honig(3), honig(6)]
    const eingabe = { ...BASIS, hoefe: [hof('testhof-a', 4, produkte)], eigenerStandort: STANDORT }
    const ids = (e: UmfeldEingabe & { eigenerStandort: typeof STANDORT }) => baueUmfeldKarte(e).pins[0].produkte.map((p) => p.id)
    expect(ids(eingabe)).toEqual(['prod-1', 'prod-2'])
    expect(ids({ ...eingabe, ...tausche(eingabe, 900, 300) })).toEqual(['prod-1', 'prod-2'])
  })
})

// ─── 4. Testhöfe, pausierte Höfe, eigener Hof ───────────────────────────────

describe('Leitplanke 4 — Testhöfe, pausierte Höfe und der eigene Hof fehlen in Zählung, Streifen und Karte', () => {
  it('der eigene Hof fehlt — auch wenn er in den Daten steht; sein Preis steht nur als „Deins"', () => {
    const eingabe = {
      ...BASIS,
      hoefe: [hof('sonnhof', 2, [honig(5)]), hof('testhof-a', 4, [honig(10)]), hof('testhof-b', 9, [honig(12)])],
      eigeneProdukte: [honig(11)],
      ohneStandort: [],
      abgeschnittenAbKm: null,
    }
    const ansicht = baueUmfeld(eingabe)
    expect(ansicht.zahlen).toEqual({ 10: 2, 25: 2, 50: 2 })
    expect(ansicht.zeilen[0].preise[0].streifen).toMatchObject({ werte: [1000, 1200], deins: 1100 })
    expect(ansicht.zeilen[0].hoefe.map((h) => h.slug)).toEqual(['testhof-a', 'testhof-b'])
    expect(baueUmfeldKarte({ ...eingabe, eigenerStandort: STANDORT }).pins.map((p) => p.slug)).toEqual(['testhof-a', 'testhof-b'])
  })

  function abfrageVorbereiten() {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({ slug: 'sonnhof', latitude: 47.25, longitude: 11.4, products: [] } as never)
    vi.mocked(prisma.farm.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never)
  }

  it('Testhöfe fehlen: die Abfrage verlangt istTesthof: false — Zählung, Streifen und Karte bekommen sie nie', async () => {
    abfrageVorbereiten()
    await getUmfeld('hof-1')
    const { where } = vi.mocked(prisma.farm.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(where.istTesthof).toBe(false)
  })

  it('pausierte Höfe fehlen: die Abfrage verlangt isPaused: false', async () => {
    abfrageVorbereiten()
    await getUmfeld('hof-1')
    const { where } = vi.mocked(prisma.farm.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(where.isPaused).toBe(false)
  })

  it('den eigenen Hof schließt schon die Abfrage aus', async () => {
    abfrageVorbereiten()
    await getUmfeld('hof-1')
    const { where } = vi.mocked(prisma.farm.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(where.id).toEqual({ not: 'hof-1' })
  })
})
