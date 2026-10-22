/**
 * Region · gemeinsame Bausteine (Register N23, Nr. 122) — serverseitig gerendert
 * (TESTING_GUIDELINES §1: Merkmale mit Gegenprobe) und am Quelltext.
 *
 * Beweist:
 *  - KmWahl: mit und ohne Zahl je Stufe gleich hoch (36 px sichtbar, 44 px Trefferfläche),
 *    die Beschriftung der Wanne nennt die Zahl, wenn es sie gibt.
 *  - HofKurzkarte, Art „region": Bereich „Hof <Name>", „Zum Hof" im Tab-Weg, „Schließen"
 *    (44 px), der Inhalt des Aufrufers; die Art „tooltip" bleibt, wie sie war.
 *  - ErklaerKnopf: ein echter Knopf mit dem Titel als aria-label und 44 px; der Dialog
 *    schließt mit Escape und gibt den Fokus zurück, weil nichts den Dialog von Base UI
 *    daran hindert (Quelltext-Wache mit Gegenprobe — öffnen lässt er sich ohne Browser nicht).
 *  - HofKarte und HofKurzkarte rechnen die Entfernung nicht mehr selbst, sondern nutzen
 *    HofKopf; Produkttreffer und Karussell stehen mit Grund im Bestand (Lauf 20).
 *  - Ohne eigenen Standort: der Leerzustand mit Ausweg zur Karte im Hofprofil, darunter die
 *    eigene Hofkarte — oder der Satz, wenn der Hof nicht in der Liste steht (Testhof).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) => {
    const attribute = { ...rest }
    delete attribute.onNavigate
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
  useLinkStatus: () => ({ pending: false }),
}))
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, refresh() {} }), usePathname: () => '/region' }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
const eintrag = vi.hoisted(() => ({ wert: null as unknown, fehler: false }))
vi.mock('@/server/queries/region', () => ({
  ladeEigenenListeneintrag: async () => {
    if (eintrag.fehler) throw new Error('Testfehler')
    return eintrag.wert
  },
}))

import { KmWahl } from '@/components/region/km-wahl'
import { HofKurzkarte, KurzkartenInhalt, type HofKurzkarteProps, type KurzkartenHof } from '@/components/hoefe/hof-kurzkarte'
import { ErklaerKnopf } from '@/components/region/erklaer-knopf'
import { StandortFehlt } from '@/components/region/region-zustaende'
import { OhneStandort } from '@/app/(hof)/region/ohne-standort'
import { OHNE_STANDORT_TEXT, STANDORT_ANKER, ohneStandortHinweis } from '@/lib/region'
import type { KartenHof } from '@/components/hoefe/entdecken-teile'
import type { VorschauProdukt } from '@/lib/hofuebersicht'

const WURZEL = process.cwd()
const quelle = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8')
const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el)
const JETZT = '2026-10-21T08:00:00.000Z'

const STUFEN = [
  { km: 10 as const, href: '/region?km=10', aktiv: false },
  { km: 25 as const, href: '/region?km=25', aktiv: true },
  { km: 50 as const, href: '/region?km=50', aktiv: false },
]

describe('KmWahl — Umkreis mit Zahl je Stufe', () => {
  it('ohne Zahl: Beschriftung „Umkreis", jede Stufe sichtbar 36 px mit 44 px Trefferfläche', () => {
    const wanne = html(createElement(KmWahl, { stufen: STUFEN }))
    expect(wanne).toContain('aria-label="Umkreis"')
    expect(wanne.match(/class="relative inline-flex h-9 [^"]*before:-inset-y-1[^"]*"/g)).toHaveLength(3)
    expect(wanne).toMatch(/aria-current="page"[^>]*>25 km</)
    expect(wanne).not.toContain('text-[11.5px]')
  })

  it('mit Zahl: „25 km 8" je Stufe, gleich hoch, die Beschriftung nennt die Zahl', () => {
    const wanne = html(createElement(KmWahl, { stufen: STUFEN, zahlen: { 10: 3, 25: 8, 50: 19 }, zahlLabel: 'Umkreis, Zahl der Höfe je Stufe' }))
    expect(wanne).toContain('aria-label="Umkreis, Zahl der Höfe je Stufe"')
    for (const [km, zahl] of [[10, 3], [25, 8], [50, 19]]) expect(wanne).toContain(`>${km} km<span class="text-[11.5px] font-medium">${zahl}</span>`)
    expect(wanne.match(/class="relative inline-flex h-9 /g)).toHaveLength(3)
  })

  it('eine fehlende Zahl lässt nur die Zahl weg, nicht die Stufe', () => {
    const wanne = html(createElement(KmWahl, { stufen: STUFEN, zahlen: { 25: 8 }, zahlLabel: 'Umkreis, Zahl der Angebote je Stufe' }))
    expect(wanne.match(/<span class="text-\[11.5px\] font-medium">/g)).toHaveLength(1)
    expect(wanne.match(/<a /g)).toHaveLength(3)
  })
})

const HOF: KurzkartenHof = {
  slug: 'testhof-a',
  name: 'Testhof A',
  postalCode: '1010',
  city: 'Wien',
  isPaused: false,
  kategorien: ['EIER'],
  abholfenster: [{ dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }],
  angebot: [{}],
  fotos: [],
  entfernungKm: 6.2,
}
const produkt = (id: string, name: string): VorschauProdukt => ({
  id, name, price: 4.2, unit: 'STUECK', unitSize: null, imageUrl: null, bildAusschnitt: null, category: 'EIER', subcategory: null, verfuegbar: true,
})

describe('HofKurzkarte — die kurze Hofkarte am Pin in zwei Arten', () => {
  const region = html(
    // Die Kinder als drittes Argument wie im JSX; der Typ verlangt sie in den Props.
    createElement(HofKurzkarte, { art: 'region', hof: HOF, bereich: 'LEBENSMITTEL', id: 'karte-1', onSchliessen: () => {} } as HofKurzkarteProps, createElement('p', null, 'Inhalt aus Region'))
  )
  const tooltip = html(
    createElement(HofKurzkarte, { art: 'tooltip', hof: HOF, bereich: 'LEBENSMITTEL', id: 'vorschau-1' } as HofKurzkarteProps, createElement(KurzkartenInhalt, { hof: HOF, schaufenster: { produkte: [produkt('a', 'Freilandeier')] }, jetzt: JETZT }))
  )

  it('Art „region": ein Bereich „Hof <Name>" mit Kopf, Bild 40 px und dem Inhalt des Aufrufers', () => {
    expect(region).toContain('role="region"')
    expect(region).toContain('aria-label="Hof Testhof A"')
    expect(region).toContain('tabindex="-1"')
    for (const teil of ['Testhof A', '6,2 km', '1010', 'Wien', 'Inhalt aus Region']) expect(region, teil).toContain(teil)
    expect(region).toContain('size-10 rounded-full')
    expect(region).not.toContain('role="tooltip"')
  })

  it('Art „region": „Zum Hof" liegt im Tab-Weg, „Schließen" ist ein Knopf mit 44 px', () => {
    expect(region).toMatch(/<a href="\/testhof-a" class="[^"]*">Zum Hof/)
    expect(region).toMatch(/<button type="button" class="[^"]*size-11[^"]*">.*<span class="sr-only">Schließen<\/span><\/button>/)
  })

  it('Art „tooltip" bleibt, wie sie war: Rolle, Breite, „Zum Hof" nicht im Tab-Weg, kein „Schließen"', () => {
    expect(tooltip).toContain('id="vorschau-1" role="tooltip" style="width:288px"')
    expect(tooltip).toMatch(/<a href="\/testhof-a" tabindex="-1"[^>]*>Zum Hof/)
    expect(tooltip).toContain('Abholung heute 15:00–18:00')
    expect(tooltip).not.toContain('Schließen')
    expect(tooltip).not.toContain('role="region"')
  })
})

/** Was an der Verdrahtung des Dialogs fehlt; leer = alles da. Kommentare zählen nicht. */
function pruefeErklaerKnopf(text: string): string[] {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const fehlt: string[] = []
  if (!/from '@\/components\/ui\/dialog'/.test(code)) fehlt.push('Dialog aus src/components/ui/dialog.tsx')
  if (!/<DialogTrigger[\s\S]*?aria-label=\{titel\}/.test(code)) fehlt.push('DialogTrigger mit aria-label={titel}')
  // Ungesteuert: Base UI schließt mit Escape und gibt den Fokus an den Auslöser zurück (finalFocus: true).
  if (/\bopen=|onOpenChange|finalFocus|disablePointerDismissal/.test(code)) fehlt.push('ungesteuert, ohne eigene Fokus- oder Schließregel')
  if (!/<DialogClose[\s\S]*?>\s*Verstanden\s*<\/DialogClose>/.test(code)) fehlt.push('„Verstanden" schließt')
  return fehlt
}

describe('ErklaerKnopf — „So rechnen wir"', () => {
  it('ein echter Knopf mit dem Titel als aria-label und 44 px Trefferfläche, das Symbol verborgen', () => {
    const knopf = html(createElement(ErklaerKnopf, { titel: 'So rechnen wir', punkte: ['Luftlinie ab deinem Hof.'] }))
    expect(knopf).toMatch(/<button [^>]*type="button"/)
    expect(knopf).toContain('aria-label="So rechnen wir"')
    expect(knopf).toContain('size-11')
    expect(knopf).toContain('aria-hidden="true"')
    // Geschlossen: die Punkte stehen erst im Dialog.
    expect(knopf).not.toContain('Luftlinie ab deinem Hof.')
  })

  const echt = quelle('src/components/region/erklaer-knopf.tsx')
  it('öffnet den Dialog aus ui/dialog ungesteuert — Escape schließt, der Fokus geht zurück auf den Knopf', () => {
    expect(pruefeErklaerKnopf(echt)).toEqual([])
  })

  const abwandlungen: Record<string, (t: string) => string> = {
    'gesteuert mit eigenem open': (t) => t.replace('<Dialog>', '<Dialog open={offen}>'),
    'Fokus nicht zurück (finalFocus={false})': (t) => t.replace('showCloseButton={false}', 'showCloseButton={false} finalFocus={false}'),
    'ohne aria-label am Auslöser': (t) => t.replace('aria-label={titel}', ''),
    '„Verstanden" ohne DialogClose': (t) => t.replace(/<DialogClose(\s+className=\{cn\(\s*'inline-flex h-12)/, '<button$1').replace(/Verstanden\s*<\/DialogClose>/, 'Verstanden</button>'),
  }
  for (const [name, abwandeln] of Object.entries(abwandlungen)) {
    it(`Gegenprobe: ${name} fällt auf`, () => {
      const abgewandelt = abwandeln(echt)
      expect(abgewandelt).not.toBe(echt)
      expect(pruefeErklaerKnopf(abgewandelt).length).toBeGreaterThan(0)
    })
  }
})

// ─── Eine Quelle für den Kopf: formatiereEntfernung( nur in HofKopf (und im Bestand) ───

/**
 * Wo `formatiereEntfernung(` in src/components noch selbst steht — mit Grund, und nur
 * kleiner werdend. Der Kopf von Produkttreffer und Karussell ist anders gebaut (Hofname
 * und Entfernung in einer Zeile bzw. auf dem Foto); ihr Umzug auf HofKopf ist für Lauf 20.
 */
const BESTAND_ENTFERNUNG: Record<string, string> = {
  'src/components/hoefe/hof-kopf.tsx': 'Die eine Quelle des Kopfs.',
  'src/components/hoefe/entdecken-teile.tsx': 'Produkttreffer (ProduktZeile): „Hof · Entfernung" in einer Zeile – Umzug auf HofKopf in Lauf 20.',
  'src/components/hoefe/hoefe-karussell.tsx': 'Karussell am Handy: Entfernung neben dem Namen über dem Foto – Umzug auf HofKopf in Lauf 20.',
}

function dateienMit(ordner: string, muster: RegExp): string[] {
  return readdirSync(join(WURZEL, ordner)).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(join(WURZEL, pfad)).isDirectory()) return dateienMit(pfad, muster)
    return /\.tsx?$/.test(name) && muster.test(quelle(pfad)) ? [relative(WURZEL, join(WURZEL, pfad)).split(sep).join('/')] : []
  })
}

/** Der Rumpf einer exportierten Funktion bis zur nächsten Deklaration auf oberster Ebene. */
function rumpf(text: string, kopf: string): string {
  const start = text.indexOf(kopf)
  expect(start, kopf).toBeGreaterThanOrEqual(0)
  const rest = text.slice(start + kopf.length)
  const ende = rest.search(/\n(export |function |const |type |\/\*\*)/)
  return ende === -1 ? rest : rest.slice(0, ende)
}

/** Was an „ein Kopf, eine Quelle" fehlt; leer = alles da. */
function pruefeKopf(teile: string, kurzkarte: string): string[] {
  const fehlt: string[] = []
  const hofKarte = rumpf(teile, 'export function HofKarte(')
  const kurz = rumpf(kurzkarte, 'export function HofKurzkarte(') + rumpf(kurzkarte, 'function KurzkarteBereich(')
  for (const [name, text] of [['HofKarte', hofKarte], ['HofKurzkarte', kurz]] as const) {
    if (text.includes('formatiereEntfernung(')) fehlt.push(`${name} rechnet die Entfernung selbst`)
    if (!text.includes('<HofKopf')) fehlt.push(`${name} ohne HofKopf`)
  }
  return fehlt
}

describe('HofKopf — ein Kopf für Hofkarte, Pin-Karte und Region', () => {
  const teile = quelle('src/components/hoefe/entdecken-teile.tsx')
  const kurzkarte = quelle('src/components/hoefe/hof-kurzkarte.tsx')

  it('HofKarte und HofKurzkarte rufen formatiereEntfernung( nicht selbst, sondern nutzen HofKopf', () => {
    expect(pruefeKopf(teile, kurzkarte)).toEqual([])
  })

  it('Gegenprobe: eine Kopie des alten Kopfs in HofKarte fällt auf', () => {
    const kopie = teile.replace(
      '<HofKopf hof={hof} als="h2" gedaempft={hof.isPaused} />',
      '<span className="shrink-0">{hof.entfernungKm !== null && formatiereEntfernung(hof.entfernungKm)}</span>'
    )
    expect(kopie).not.toBe(teile)
    expect(pruefeKopf(kopie, kurzkarte)).toEqual(['HofKarte rechnet die Entfernung selbst', 'HofKarte ohne HofKopf'])
  })

  it('sonst steht formatiereEntfernung( in src/components nur im Bestand — mit Grund', () => {
    const muster = /formatiereEntfernung\(/
    const gefunden = dateienMit('src/components', muster)
    expect(gefunden.sort()).toEqual(Object.keys(BESTAND_ENTFERNUNG).sort())
    // In entdecken-teile.tsx nur noch im Produkttreffer.
    const teileOhneProduktZeile = teile.replace(rumpf(teile, 'export function ProduktZeile('), '')
    expect(teileOhneProduktZeile).not.toMatch(muster)
    // Gegenprobe: das Muster schlägt an.
    expect(muster.test('{formatiereEntfernung(hof.entfernungKm)}')).toBe(true)
  })
})

// ─── Ohne eigenen Standort ───

const KARTEN_HOF: KartenHof = {
  ...HOF,
  entfernungKm: null,
  latitude: null,
  longitude: null,
  gruendungshof: false,
}

describe('Ohne eigenen Standort — für beide Reiter gleich', () => {
  it('Leerzustand mit Ausweg direkt zur Karte im Hofprofil, darunter die eigene Hofkarte mit „Nicht auf der Karte"', () => {
    const seite = html(createElement(StandortFehlt, { eigeneKarte: { hof: KARTEN_HOF, bereich: 'LEBENSMITTEL', schaufenster: { produkte: [produkt('a', 'Freilandeier')], weitere: 5 } }, jetzt: JETZT }))
    expect(seite).toContain(`<h2 class="font-heading text-lg font-semibold text-foreground">${OHNE_STANDORT_TEXT.titel}</h2>`)
    expect(seite).toContain(OHNE_STANDORT_TEXT.satz)
    expect(seite).toMatch(new RegExp(`<a href="/settings/profile#${STANDORT_ANKER}" class="[^"]*">${OHNE_STANDORT_TEXT.knopf}</a>`))
    expect(seite).toContain(OHNE_STANDORT_TEXT.ueberschriftListe)
    for (const teil of ['Testhof A', 'Nicht auf der Karte', 'Freilandeier', '+ 5 weitere Produkte']) expect(seite, teil).toContain(teil)
    expect(seite).not.toContain(OHNE_STANDORT_TEXT.nichtInDerListe)
  })

  it('steht der Hof nicht in der Liste (Testhof, nicht sichtbar), steht ein Satz statt der Karte', () => {
    const seite = html(createElement(StandortFehlt, { eigeneKarte: null, jetzt: JETZT }))
    expect(seite).toContain(OHNE_STANDORT_TEXT.nichtInDerListe)
    expect(seite).not.toContain('Nicht auf der Karte')
    expect(seite).toContain(OHNE_STANDORT_TEXT.knopf)
  })

  it('der Anker der Karte im Hofprofil ist da — mit Abstand nach oben', () => {
    expect(quelle('src/components/settings/profile-form.tsx')).toContain(`<div id="${STANDORT_ANKER}" className="scroll-mt-6">`)
  })
})

describe('Seite ohne Standort — der Teil, den beide Reiter einbinden', () => {
  const EINTRAG = {
    slug: 'testhof-a', name: 'Testhof A', postalCode: '1010', city: 'Wien', logoUrl: null, logoAusschnitt: null,
    latitude: null, longitude: null, isPaused: false, kategorien: ['EIER'],
    angebot: [{ id: 'a', name: 'Freilandeier', category: 'EIER', subcategory: null, labels: [], tiere: [], grundpreis: null, grossgebinde: null, price: 4.2, unit: 'STUECK', unitSize: null, imageUrl: null, bildAusschnitt: null }],
    naechsteAbholung: null, abholfenster: [{ dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }],
    produkte: [produkt('a', 'Freilandeier')], produkteGesamt: 1, produkteJeBereich: { LEBENSMITTEL: 1, FUTTERMITTEL: 0 },
    suchNamen: ['Freilandeier'], fotos: [], gruendungshof: false,
  }
  beforeEach(() => {
    eintrag.wert = null
    eintrag.fehler = false
  })

  it('mit eigenem Eintrag in der Liste: die eigene Hofkarte', async () => {
    eintrag.wert = EINTRAG
    const seite = html(await OhneStandort({ farmId: 'hof-1' }))
    expect(seite).toContain('Nicht auf der Karte')
    expect(seite).toContain('href="/testhof-a"')
  })

  it('Testhof oder nicht sichtbar (kein Eintrag): der Satz statt der Karte', async () => {
    const seite = html(await OhneStandort({ farmId: 'hof-1' }))
    expect(seite).toContain(OHNE_STANDORT_TEXT.nichtInDerListe)
    expect(seite).not.toContain('href="/testhof-a"')
  })

  it('scheitert das Laden, bleibt der Leerzustand mit Ausweg — ohne den Abschnitt der Liste', async () => {
    eintrag.fehler = true
    const seite = html(await OhneStandort({ farmId: 'hof-1' }))
    expect(seite).toContain(OHNE_STANDORT_TEXT.knopf)
    expect(seite).not.toContain(OHNE_STANDORT_TEXT.ueberschriftListe)
  })
})

describe('Die Seite in zwei Teilen', () => {
  it('page.tsx prüft Sitzung, Hof und Reiter und gibt ab; die Abfragen stehen in den Teilen', () => {
    const seite = quelle('src/app/(hof)/region/page.tsx')
    expect(seite).toContain("redirect('/login')")
    expect(seite).toContain("redirect('/onboarding')")
    expect(seite).toMatch(/<FutterReiter farm=\{farm\} suche=\{suche\} \/> : <PreiseReiter farm=\{farm\} suche=\{suche\} \/>/)
    expect(seite).not.toMatch(/getUmfeld|getFutterKaufen/)
    // Seit Nr. 124 lädt Preise vergleichen immer bis 50 km (Zahl je Stufe, N23); den Umkreis schneidet src/lib/umfeld.ts.
    expect(quelle('src/app/(hof)/region/preise-reiter.tsx')).toContain('getUmfeld(farm.id)')
    // Seit Nr. 123 lädt Futter kaufen einmal 50 km und filtert in der reinen Funktion (N23).
    expect(quelle('src/app/(hof)/region/futter-reiter.tsx')).toContain('getFutterKaufen(farm.id, jetzt)')
  })

  it('beide Reiter nennen Höfe ohne Standort mit demselben Satz', () => {
    expect(ohneStandortHinweis(2)).toBe('2 Höfe haben noch keinen Standort auf der Karte und fehlen hier.')
    for (const datei of ['src/lib/umfeld.ts', 'src/lib/futter-kaufen.ts']) {
      const text = quelle(datei)
      expect(text, datei).toContain('hinweise.push(ohneStandortHinweis(ohneStandort))')
      expect(text, datei).not.toContain('ohne Standort nicht berücksichtigt')
    }
  })
})
