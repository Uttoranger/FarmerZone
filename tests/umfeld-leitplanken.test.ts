/**
 * Die Leitplanken von „Preise vergleichen" als Prüfungen (Register N23,
 * Freigabe Lauf 19 Nr. 124 Punkt 6, geschlossen im Lauf 20) — die Grundlage
 * für die rechtliche Prüfung der Spanne durch die Projektleitung:
 *
 *   1. Kein Text empfiehlt einen Preis oder wertet ihn. Zwei Wachen mit
 *      derselben Verbotsliste (ohne Groß-/Kleinschreibung, nur am Wortanfang):
 *      a) auf alle String-Literale und JSX-Texte aus src/lib/umfeld.ts,
 *         components/analytics/umfeld-*.tsx und components/region/preis-streifen.tsx,
 *      b) auf den gerenderten Text (`renderToStaticMarkup`) von Liste,
 *         aufgeklappter Zeile, Karte am Pin und dem geöffneten „So rechnen
 *         wir" — so zählen auch die wiederverwendeten Bausteine (`HofKopf`,
 *         `HoefeProduktzeilen`, `HofKurzkarte`, `ErklaerKnopf`) mit.
 *      Gegenprobe: „Du solltest erhöhen" bzw. ein verbotenes Wort in jedem
 *      der vier gerenderten Texte. Die Verbotsliste gilt nur für die Texte
 *      von „Preise vergleichen".
 *   2. Vor dem Antippen zeigt die Karte keinen Preis. Die Daten der Karte
 *      tragen die Preise der zwei Produkte als Zahl — wie die Hofseite; sie
 *      werden erst in der Karte am Pin zur Anzeige. Geprüft wird die
 *      Darstellung: Pin, Name am Pin und alles vor dem Antippen zeigen keinen
 *      Preis, auch nicht als Zahl (gerendert; Gegenprobe: ein Preis im
 *      Pin-Text macht die Prüfung rot, nach dem Antippen steht der Preis da).
 *   3. Keine Sortierung nach Preis — weder Zeilen noch aufgeklappte Zeile
 *      noch Karte am Pin; geprüft mit absichtlich vertauschten Preisen.
 *   4. Testhöfe, pausierte Höfe und der eigene Hof fehlen in Zählung, Streifen
 *      und Karte (die Abfrage hier mit Attrappe, gegen echtes Postgres in
 *      tests/integration/umfeld.int.test.ts).
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), findMany: vi.fn() },
    product: { findMany: vi.fn() },
  },
}))

// Zum Rendern ohne Browser: Was ein Antippen öffnet (eine Zeile, ein Pin), steht über den
// Startwert von useState schon da; die Karte (Leaflet) ist ein Stellvertreter, der die Pins
// so ausgibt, wie hoefe-karte.tsx sie beschriftet (Nummer, pinName, pinBeschriftung) und seine
// Eigenschaften festhält; der Dialog (Base UI zeichnet auf dem Server kein Fenster) ist ein
// schlichter Rahmen um den echten Inhalt von ErklaerKnopf.
const prueffeld = vi.hoisted(() => ({
  startwert: null as null | ((start: unknown) => unknown),
  karteEigenschaften: [] as unknown[],
}))

vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  return { ...echt, useState: ((start: unknown) => echt.useState(prueffeld.startwert ? prueffeld.startwert(start) : start)) as typeof echt.useState }
})
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => createElement('a', { href }, children),
}))
vi.mock('@/components/hoefe/hoefe-karte', async () => {
  const { pinBeschriftung, pinName } = await import('@/lib/hoefe-anzeige')
  return {
    default: (eigenschaften: { hoefe: { slug: string; nummer: number; name?: string }[]; zentrum?: { titel: string } }) => {
      prueffeld.karteEigenschaften.push(eigenschaften)
      return createElement(
        'div',
        { 'data-karte': '' },
        eigenschaften.zentrum ? createElement('span', { role: 'img', 'aria-label': eigenschaften.zentrum.titel }) : null,
        ...eigenschaften.hoefe.map((pin) =>
          createElement(
            'button',
            { key: pin.slug, 'data-pin': pin.slug, 'aria-label': pinBeschriftung(pin) },
            String(pin.nummer),
            pin.name ? createElement('span', null, pinName(pin.name)) : null
          )
        )
      )
    },
  }
})
vi.mock('@/components/ui/dialog', () => {
  const rahmen = (tag: string) =>
    function Rahmen({ children, 'aria-label': beschriftung }: { children?: ReactNode; 'aria-label'?: string }) {
      return createElement(tag, beschriftung ? { 'aria-label': beschriftung } : null, children)
    }
  return { Dialog: rahmen('div'), DialogTrigger: rahmen('button'), DialogContent: rahmen('section'), DialogTitle: rahmen('h2'), DialogClose: rahmen('button') }
})

import { prisma } from '@/lib/prisma'
import { getUmfeld } from '@/server/queries/umfeld'
import { LEERE_LAGE } from '@/lib/hoefe-anzeige'
import {
  UMFELD_TEXT,
  baueUmfeld,
  baueUmfeldKarte,
  baueUmfeldZeilen,
  type UmfeldEingabe,
  type UmfeldHof,
  type UmfeldKarte,
  type UmfeldProdukt,
  type UmfeldZeile,
} from '@/lib/umfeld'
import UmfeldKarteAnsicht from '@/components/analytics/umfeld-karte'
import { UmfeldListe } from '@/components/analytics/umfeld-liste'
import { ErklaerKnopf } from '@/components/region/erklaer-knopf'

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

/**
 * Wortanfänge, die einen Preis empfehlen oder werten (Freigabe Nr. 124, Punkt 6).
 * „günstig" gilt am Wortanfang — „günstigstes Angebot" wertet ebenso wie „zu günstig"
 * (Lauf 20); die Liste gilt nur für die Texte von „Preise vergleichen".
 */
const VERBOTEN = ['empfehl', 'empfiehl', 'solltest', 'zu teuer', 'zu billig', 'günstig', 'erhöh', 'senk', 'teurer als', 'rang']

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
      "const g = 'Das günstigste Angebot'",
    ].join(';\n')
    expect(funde(texteAus(quelle)).map((f) => f.split(':')[0])).toEqual(['zu teuer', 'empfehl', 'empfiehl', 'senk', 'rang', 'günstig', 'günstig'])
  })

  it('schlägt nicht an bei Wortteilen, Klassen-Namen und „empfiehlt keine"', () => {
    const quelle = [
      "const a = 'Vorrang hat die orange Fläche'",
      '<span className="senkrecht rangiert">Erdäpfel</span>',
      'const b = `${MARKE} empfiehlt keine Preise.`',
      "const c = 'Ein ungünstiger Tag'",
      "import { x } from '@/lib/rang'",
    ].join(';\n')
    expect(funde(texteAus(quelle))).toEqual([])
    // Gegenprobe: dasselbe Wort außerhalb von className schlägt an.
    expect(funde(texteAus('<span title="senkrecht">x</span>'))).toEqual(['senk: senkrecht'])
  })

  it('„So rechnen wir" Punkt 3 zählt nur — der kleinste Grundpreis, kein „günstig"; der Satz von vorher schlägt an', () => {
    const punkt3 = UMFELD_TEXT.soRechnenWir[2]
    expect(punkt3).toContain('kleinsten Grundpreis')
    expect(funde([punkt3])).toEqual([])
    // Gegenprobe: bis Lauf 19 stand dort „sein günstigstes Angebot" — das wertet.
    const alt = 'Je Hof zählt sein günstigstes Angebot einer Sorte – ein Hof mit drei Heusorten zählt einmal.'
    expect(funde([alt]).map((f) => f.split(':')[0])).toEqual(['günstig'])
  })
})

// ─── Testdaten ──────────────────────────────────────────────────────────────

let zaehler = 0
beforeEach(() => {
  zaehler = 0
  prueffeld.karteEigenschaften = []
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

// ─── 1b. Dieselbe Wache auf den gerenderten Text ────────────────────────────

/** Jeder Textknoten für sich, dazu die Texte in aria-label, title und alt — Klassen und Adressen zählen nicht. */
function sichtbareTexte(html: string): string[] {
  const entschluesselt = (t: string) => t.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  const beschriftungen = [...html.matchAll(/\s(?:aria-label|title|alt)="([^"]*)"/g)].map((m) => m[1])
  const knoten = html.replace(/<[^>]*>/g, '\n').split('\n')
  return [...knoten, ...beschriftungen].map((t) => entschluesselt(t).trim()).filter((t) => t !== '')
}

/** Die Zeilen einer Eingabe mit vier Höfen im Honig: drei stehen gleich da, „1 weiterer Hof" hinter dem Knopf. */
function eingabeMitVierHoefen(): UmfeldEingabe {
  const benannt = (slug: string, km: number, name: string, euro: number[]): UmfeldHof => ({ ...hof(slug, km, euro.map((e) => honig(e))), name })
  return {
    ...BASIS,
    eigeneProdukte: [honig(16.99)],
    hoefe: [
      benannt('testhof-a', 3, 'Testhof A', [13.37, 6.66]),
      benannt('testhof-b', 8, 'Testhof B', [18.19]),
      benannt('sonnhof-c', 12, 'Sonnhof C', [14.28]),
      benannt('testhof-d', 20, 'Testhof D', [12.45]),
    ],
  }
}

/** Rendert die Liste; `offen` ist die Zeile, die schon aufgeklappt dasteht (ohne: alle zu). */
function rendereListe(zeilen: UmfeldZeile[], offen: string | null = null): string {
  prueffeld.startwert = (start) => (start === null ? offen : start)
  try {
    return renderToStaticMarkup(createElement(UmfeldListe, { zeilen }))
  } finally {
    prueffeld.startwert = null
  }
}

/** Rendert die Karte; `angetippt` ist der Pin, dessen Karte schon aufgegangen ist (ohne: nichts angetippt). */
function rendereKarte(karte: UmfeldKarte, angetippt: string | null = null): string {
  prueffeld.startwert = (start) => (start === LEERE_LAGE ? { ...LEERE_LAGE, ausgewaehlt: angetippt } : start)
  try {
    return renderToStaticMarkup(createElement(UmfeldKarteAnsicht, { karte, eigenerName: 'Sonnhof' }))
  } finally {
    prueffeld.startwert = null
  }
}

/** Der Inhalt hinter dem (i): Titel, die Punkte aus der Textquelle und „Verstanden". */
function rendereSoRechnenWir(punkte: readonly string[] = UMFELD_TEXT.soRechnenWir): string {
  return renderToStaticMarkup(createElement(ErklaerKnopf, { titel: UMFELD_TEXT.soRechnenWirTitel, punkte }))
}

const wortfunde = (html: string): string[] => funde(sichtbareTexte(html))

describe('Leitplanke 1 — auch der gerenderte Text: Liste, aufgeklappte Zeile, Karte am Pin, „So rechnen wir"', () => {
  function zeilenUndKarte() {
    const eingabe = eingabeMitVierHoefen()
    return { zeilen: baueUmfeldZeilen(eingabe), karte: baueUmfeldKarte({ ...eingabe, eigenerStandort: STANDORT }) }
  }

  it('die Liste mit zugeklappten Zeilen enthält keines der verbotenen Wörter', () => {
    const { zeilen } = zeilenUndKarte()
    const html = rendereListe(zeilen)
    expect(wortfunde(html)).toEqual([])
    // Gegenprobe: gerendert ist die Zeile — aber noch nicht ihr Inhalt.
    expect(sichtbareTexte(html)).toEqual(expect.arrayContaining([zeilen[0].titel, zeilen[0].anzahlText]))
    expect(html).not.toContain(UMFELD_TEXT.kaufen)
  })

  it('die aufgeklappte Zeile — mit Kopf und Produktzeilen der wiederverwendeten Bausteine — enthält keines der verbotenen Wörter', () => {
    const { zeilen } = zeilenUndKarte()
    const html = rendereListe(zeilen, zeilen[0].schluessel)
    expect(wortfunde(html)).toEqual([])
    // Gegenprobe: HofKopf (Name, PLZ und Ort), HoefeProduktzeilen (Name, Preis) und der Knopf stehen wirklich da.
    expect(sichtbareTexte(html)).toEqual(
      expect.arrayContaining(['Testhof A', '1234 Testort', 'Honig 3', '€ 6,66 / kg', UMFELD_TEXT.kaufen, '1 weiterer Hof'])
    )
  })

  it('die Karte am Pin — HofKurzkarte mit Produktzeilen — enthält keines der verbotenen Wörter', () => {
    const { karte } = zeilenUndKarte()
    const html = rendereKarte(karte, 'testhof-a')
    expect(wortfunde(html)).toEqual([])
    // Gegenprobe: Kopf, Produktzeile, „Zum Hof" und „Schließen" der Karte am Pin stehen wirklich da.
    expect(sichtbareTexte(html)).toEqual(expect.arrayContaining(['Hof Testhof A', 'Testhof A', 'Honig 3', 'Zum Hof', 'Schließen']))
  })

  it('„So rechnen wir", geöffnet, enthält keines der verbotenen Wörter — und den erlaubten Satz', () => {
    const html = rendereSoRechnenWir()
    expect(wortfunde(html)).toEqual([])
    // Gegenprobe: Der Dialog rendert geschlossen nicht mit — hier steht sein Inhalt wirklich da.
    expect(html).toContain('empfiehlt keine Preise.')
    expect(sichtbareTexte(html)).toEqual(expect.arrayContaining([UMFELD_TEXT.soRechnenWirTitel, ...UMFELD_TEXT.soRechnenWir, 'Verstanden']))
  })

  it('Gegenprobe: ein verbotenes Wort schlägt in allen vier gerenderten Texten an, auch in den wiederverwendeten Bausteinen', () => {
    const { zeilen, karte } = zeilenUndKarte()
    const mitHofName = (name: string): UmfeldZeile[] => [{ ...zeilen[0], hoefe: zeilen[0].hoefe.map((h, i) => (i === 0 ? { ...h, name } : h)) }]
    const mitProduktName = (name: string): UmfeldZeile[] => [
      { ...zeilen[0], hoefe: zeilen[0].hoefe.map((h, i) => (i === 0 ? { ...h, produkte: h.produkte.map((p) => ({ ...p, name })) } : h)) },
    ]
    const offen = (z: UmfeldZeile[]) => rendereListe(z, z[0].schluessel)
    const pinMit = (teil: Partial<UmfeldKarte['pins'][number]>): UmfeldKarte => ({
      ...karte,
      pins: karte.pins.map((p, i) => (i === 0 ? { ...p, ...teil } : p)),
    })

    expect(wortfunde(rendereListe([{ ...zeilen[0], hinweis: 'Du solltest erhöhen' }]))).toHaveLength(2)
    expect(wortfunde(offen(mitHofName('Hof zu teuer')))).toEqual(['zu teuer: Hof zu teuer'])
    expect(wortfunde(offen(mitProduktName('Günstigster Honig')))).toEqual(['günstig: Günstigster Honig'])
    expect(wortfunde(rendereKarte(pinMit({ name: 'Rangliste' }), 'testhof-a'))).toContain('rang: Rangliste')
    expect(wortfunde(rendereKarte(pinMit({ produkte: karte.pins[0].produkte.map((p) => ({ ...p, name: 'Senke den Preis' })) }), 'testhof-a'))).toContain(
      'senk: Senke den Preis'
    )
    expect(wortfunde(rendereSoRechnenWir([...UMFELD_TEXT.soRechnenWir, 'Wir empfehlen dir einen Preis.']))).toEqual(['empfehl: Wir empfehlen dir einen Preis.'])
  })
})

// ─── 2. Vor dem Antippen kein Preis ─────────────────────────────────────────

/** Die Schreibweisen eines Preises in Cent: Cent-Zahl, Zahl der Daten (15.8), mit Punkt und zwei Stellen, mit Komma — und überall das „€". */
function preisFunde(text: string, preiseCents: readonly number[]): string[] {
  const kandidaten = ['€', ...preiseCents.flatMap((c) => [String(c), String(c / 100), (c / 100).toFixed(2), (c / 100).toFixed(2).replace('.', ',')])]
  // Eine Zahl, die in zwei Schreibweisen gleich lautet (6.66), zählt einmal.
  return [...new Set(kandidaten)].filter((k) => text.includes(k))
}

/** Die Preise (Cent) aller Produkte der Eingabe — die Zahlen, die vor dem Antippen nirgends stehen dürfen. */
function preiseVon(eingabe: UmfeldEingabe): number[] {
  return [...eingabe.eigeneProdukte, ...eingabe.hoefe.flatMap((h) => h.produkte)].map((p) => p.preisCents)
}

/** Alles, was die Karte zeigt, bevor jemand einen Pin antippt: ihr HTML und die Eigenschaften, die die Kartenkomponente bekommt. */
function vorDemAntippen(karte: UmfeldKarte): string {
  prueffeld.karteEigenschaften = []
  const html = rendereKarte(karte)
  return `${html}\n${JSON.stringify(prueffeld.karteEigenschaften)}`
}

describe('Leitplanke 2 — Vor dem Antippen zeigt die Karte keinen Preis', () => {
  it('die Daten der Karte tragen die Preise der zwei Produkte als Zahl, wie die Hofseite — ohne fertigen Preistext mit „€"; die Zeilen derselben Eingabe haben ihn', () => {
    const eingabe = { ...BASIS, hoefe: [hof('testhof-a', 3, [honig(15.8), honig(9.9)]), hof('testhof-b', 8, [honig(18)])], eigeneProdukte: [honig(16)] }
    const karte = JSON.stringify(baueUmfeldKarte({ ...eingabe, eigenerStandort: STANDORT }))
    expect(karte).not.toContain('€')
    expect(karte).toContain('testhof-a')
    expect(JSON.stringify(baueUmfeldZeilen(eingabe))).toContain('€')
    // Gegenprobe der Suche: Die Zahl steht in den Daten — deshalb prüft der nächste Fall die Darstellung, nicht die Daten.
    expect(preisFunde(karte, [1580, 990])).toEqual(['15.8', '9.9'])
  })

  it('Pin, Name am Pin und alles vor dem Antippen zeigen keinen Preis, auch nicht als Zahl', () => {
    const eingabe = eingabeMitVierHoefen()
    const karte = baueUmfeldKarte({ ...eingabe, eigenerStandort: STANDORT })
    const vorher = vorDemAntippen(karte)
    expect(preisFunde(vorher, preiseVon(eingabe))).toEqual([])
    // Gegenprobe: Es steht etwas da — alle vier Pins mit Nummer und Name, dazu der eigene Hof; nur kein Preis.
    expect(sichtbareTexte(vorher)).toEqual(expect.arrayContaining(['Testhof A', 'Testhof D', 'Testhof A, Nummer 1', 'Sonnhof (dein Hof)']))
    expect(vorher).not.toContain('Zum Hof')
    expect(prueffeld.karteEigenschaften).toHaveLength(1)
  })

  it('Gegenprobe: ein Preis im Pin-Text macht die Prüfung rot', () => {
    const eingabe = eingabeMitVierHoefen()
    const karte = baueUmfeldKarte({ ...eingabe, eigenerStandort: STANDORT })
    const pinMit = (name: string): UmfeldKarte => ({ ...karte, pins: karte.pins.map((p, i) => (i === 0 ? { ...p, name } : p)) })
    expect(preisFunde(vorDemAntippen(pinMit('Testhof A € 13,37')), preiseVon(eingabe))).toEqual(expect.arrayContaining(['€', '13,37']))
    // Auch ohne „€": Die Zahl allein im Namen genügt.
    expect(preisFunde(vorDemAntippen(pinMit('Testhof A 13.37')), preiseVon(eingabe))).toEqual(['13.37'])
  })

  it('Gegenprobe: erst nach dem Antippen steht der Preis der Produkte in der Karte am Pin', () => {
    const eingabe = eingabeMitVierHoefen()
    const karte = baueUmfeldKarte({ ...eingabe, eigenerStandort: STANDORT })
    const nachher = rendereKarte(karte, 'testhof-a')
    expect(sichtbareTexte(nachher)).toEqual(expect.arrayContaining(['€ 13,37 / kg', '€ 6,66 / kg']))
    expect(preisFunde(nachher, preiseVon(eingabe)).length).toBeGreaterThan(0)
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
