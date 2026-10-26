/**
 * Ladeansichten und Fehlerseiten der öffentlichen Seiten.
 *
 * Befund vor diesem Fix: Von 48 Seiten hatte genau EINE eine Ladeansicht
 * (`src/app/(farmer)/loading.tsx`). Eine `global-error.tsx` gab es nicht —
 * scheitert das Root-Layout selbst, zeigte Next.js seine eigene, englische
 * Seite. Und die beiden vorhandenen Fehlerseiten trugen ein Emoji als
 * einzige Illustration, standen also außerhalb des Design-Systems.
 *
 * Geprüft wird, was ohne Browser prüfbar ist: dass die Dateien dort liegen,
 * wo Next.js sie erwartet, dass die beauftragten Texte eine einzige Quelle
 * haben und von beiden Fehlergrenzen benutzt werden, dass kein Emoji mehr
 * vorkommt, dass außer der Fehlernummer nichts Technisches angezeigt wird —
 * und dass die Fehlernummer sauber in den Briefkasten kommt.
 *
 * Das Aussehen selbst (Abmessungen, beide Themes, 375 px) ist in dieser
 * Umgebung nicht prüfbar: Diese Datei läuft in `node` und rendert nicht (TESTING_GUIDELINES §1).
 * jsdom gibt es seit Nr. 135 als Entwicklungspaket, nur dieser Test nutzt es nicht.
 * Dafür steht die Checkliste im PR.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import {
  FEHLER_TEXT,
  FEHLER_TITEL,
  HOEFE_ENTDECKEN,
  HOF_NICHT_GEFUNDEN_TEXT,
  HOF_NICHT_GEFUNDEN_TITEL,
  KENNUNG_PARAMETER,
  NICHT_GEFUNDEN_TEXT,
  NICHT_GEFUNDEN_TITEL,
  NOCHMAL_VERSUCHEN,
  PROBLEM_MELDEN,
  ZUR_STARTSEITE,
  bereinigeKennung,
  meldungLinkMitKennung,
} from '@/lib/fehlerseite'
import { MELDUNG_KENNUNG_MAX } from '@/lib/meldung'

const WURZEL = path.resolve(__dirname, '..')

function liesDatei(relativ: string): string {
  return fs.readFileSync(path.join(WURZEL, relativ), 'utf8')
}

function existiert(relativ: string): boolean {
  return fs.existsSync(path.join(WURZEL, relativ))
}

/** Emojis und Piktogramme — als Illustration im Produkt nicht erlaubt. */
const PIKTOGRAMM = /\p{Extended_Pictographic}/u

/** Ein drehender Kreis, in seinen drei Gestalten im Haus. */
const SPINNER = /animate-spin|Loader2|<Spinner/

/** Technisches, das auf einer Fehlerseite nichts zu suchen hat. */
const TECHNISCHES = /\{error\.message\}|\{error\.stack\}|\{error\.name\}|\{fehler\.message\}/

/** Eine Farbe als Literal statt als Token (Lint-Regel, CODING_STANDARDS §7). */
const FARBLITERAL = /#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\(/i

describe('Gegenproben — schlagen die Muster überhaupt an?', () => {
  // TESTING_GUIDELINES §2: Ein Quelltext-Test braucht die Gegenprobe. Alle
  // Prüfungen unten sind negativ („kommt nicht vor") und wären bei einem
  // Tippfehler im Muster stillschweigend wahr — hier steht, dass sie greifen.
  it('erkennt ein Piktogramm', () => {
    expect(PIKTOGRAMM.test('⚠️ Fehler')).toBe(true)
    expect(PIKTOGRAMM.test('🌾')).toBe(true)
    expect(PIKTOGRAMM.test('Fehler, ohne Bild')).toBe(false)
  })

  it('erkennt einen Spinner in seinen drei Gestalten', () => {
    expect(SPINNER.test('<Loader2 className="size-6 animate-spin" />')).toBe(true)
    expect(SPINNER.test('<div className="animate-spin" />')).toBe(true)
    expect(SPINNER.test('<Spinner />')).toBe(true)
    expect(SPINNER.test('<div className="animate-pulse" />')).toBe(false)
  })

  it('erkennt eine angezeigte Fehlermeldung', () => {
    expect(TECHNISCHES.test('<p>{error.message}</p>')).toBe(true)
    expect(TECHNISCHES.test('<pre>{error.stack}</pre>')).toBe(true)
    expect(TECHNISCHES.test('<p>{error.digest}</p>')).toBe(false)
  })

  it('erkennt eine Farbe als Literal', () => {
    expect(FARBLITERAL.test('bg-[#2D5F3F]')).toBe(true)
    expect(FARBLITERAL.test('rgb(0,0,0)')).toBe(true)
    expect(FARBLITERAL.test('oklch(0.95 0.01 93)')).toBe(true)
    expect(FARBLITERAL.test('bg-card text-foreground')).toBe(false)
  })
})

/**
 * Die öffentlichen Routen, die auf Serverdaten warten, und die Datei, die
 * Next.js dort als Ladeansicht erwartet.
 */
const LADEANSICHTEN: ReadonlyArray<{ zweck: string; datei: string; teile?: readonly string[] }> = [
  // Hofseite und Produktseite seit Nr. 117 als Suspense-Grenze IN der Seite (unten
  // „echte 404"); die Infoseiten sind statisch und brauchen keine.
  { zweck: 'Hofseite samt Produkten', datei: 'src/app/(public)/[farmSlug]/hofseite-skelett.tsx' },
  { zweck: 'Produktseite', datei: 'src/app/(public)/[farmSlug]/produkt/[id]/produkt-skelett.tsx' },
  { zweck: 'Höfe entdecken', datei: 'src/app/(public)/hoefe/loading.tsx' },
  {
    zweck: 'Warenkorb und Kasse',
    datei: 'src/app/(public)/[farmSlug]/checkout/loading.tsx',
    // Die Karten der Kasse stehen in einem eigenen Bauteil: Dieselbe Ansicht
    // zeigt das Formular, während es im Browser auf den Warenkorb wartet.
    teile: ['src/components/checkout/kasse-skelett.tsx'],
  },
  { zweck: 'Bestellbestätigung', datei: 'src/app/(public)/[farmSlug]/confirm/[orderId]/loading.tsx' },
  { zweck: 'Bestellverfolgung', datei: 'src/app/(public)/[farmSlug]/bestellung/[orderId]/loading.tsx' },
  { zweck: 'Bar-Bestätigung per Knopf', datei: 'src/app/(public)/[farmSlug]/bestaetigen/[token]/loading.tsx' },
  // Nr. 54: „Problem melden" wartet als einzige Infoseite wirklich auf den
  // Server (Sitzung) und zeigt seither die Form ihrer Karte.
  { zweck: 'Problem melden', datei: 'src/app/(public)/problem-melden/loading.tsx' },
]

/** Der Quelltext einer Ladeansicht samt der Bauteile, die sie rendert. */
function ansichtsText({ datei, teile }: { datei: string; teile?: readonly string[] }): string {
  return [datei, ...(teile ?? [])].map(liesDatei).join('\n')
}

/** Die vier Seiten, die bei einem Fehler oder einer falschen Adresse erscheinen, samt ihren Ansichten. */
const FEHLERSEITEN = [
  'src/app/not-found.tsx',
  'src/app/(public)/[farmSlug]/not-found.tsx',
  'src/components/shared/nicht-gefunden-ansicht.tsx',
  'src/app/error.tsx',
  'src/app/global-error.tsx',
  'src/components/shared/fehler-ansicht.tsx',
] as const

/** Die gemeinsame Ansicht beider 404 (seit Nr. 54, Mockups fehler-404-*). */
const NICHT_GEFUNDEN_ANSICHT = 'src/components/shared/nicht-gefunden-ansicht.tsx'

describe('Ladeansichten — jede öffentliche Route, die auf Daten wartet, zeigt eine', () => {
  for (const ansicht of LADEANSICHTEN) {
    it(`${ansicht.zweck}: ${ansicht.datei}`, () => {
      expect(existiert(ansicht.datei), `${ansicht.datei} fehlt`).toBe(true)
    })
  }

  it('zeigt Platzhalter in Kartenform, nie einen Spinner', () => {
    // DESIGN_SYSTEM.md, „Zustände": Laden ist ein Skeleton in Kartenform.
    // Ein rotierender Kreis sagt nur „irgendwas passiert".
    for (const ansicht of LADEANSICHTEN) {
      const text = ansichtsText(ansicht)
      expect(text, `${ansicht.zweck} ohne animate-pulse`).toContain('animate-pulse')
      // Gesucht ist die VERWENDUNG, nicht das Wort: „kein Spinner" steht als
      // Begründung in den Kopfkommentaren.
      expect(text, `${ansicht.zweck} mit Spinner`).not.toMatch(SPINNER)
    }
  })

  it('sagt Hilfsmitteln, dass hier gerade geladen wird', () => {
    for (const ansicht of LADEANSICHTEN) {
      expect(ansichtsText(ansicht), `${ansicht.zweck} ohne aria-busy`).toContain('aria-busy')
    }
  })

  it('bringt die Kopfleiste in ihrer echten Höhe mit — die Gruppe hat kein Layout', () => {
    // Die Kundenseiten rendern ihre Kopfleiste selbst (56 px, ab md 64).
    // Fehlt sie im Skeleton, springt die Seite beim Umschalten um ihre Höhe.
    // Seit Nr. 177 hat auch die Fokus-Shell (Kasse, Bar-Bestätigung) 56 px —
    // vorher 52 px mit eigener Ausnahme hier.
    for (const ansicht of LADEANSICHTEN) {
      expect(liesDatei(ansicht.datei), `${ansicht.zweck} ohne Kopfleisten-Platzhalter`).toMatch(/h-14[^"]*md:h-16/)
    }
  })

  it('die Kasse: Kopf-Platzhalter in den Maßen der Fokus-Shell', () => {
    // Die Fokus-Shell hat wirklich 56 px / ab md 64 px (Nr. 177) — und keine 52 px mehr (Gegenprobe zum alten Stand).
    const fokusShell = liesDatei('src/components/shells/kunde-shell.tsx').split('export function KundeFokusShell(')[1]
    expect(fokusShell).toMatch(/flex h-14 max-w-\[1200px\][^"]*md:h-16/)
    expect(fokusShell).not.toMatch(/h-\[52px\]/)
    expect(liesDatei('src/app/(public)/[farmSlug]/checkout/loading.tsx')).not.toMatch(/h-\[52px\]/)
    expect(liesDatei('src/app/(public)/[farmSlug]/checkout/loading.tsx')).toContain('data-design="neu"')
  })

  it('setzt keine Farbe als Literal — nur Tokens', () => {
    // CODING_STANDARDS §7 und die Lint-Regel: kein Hex, kein rgb(), kein oklch().
    for (const ansicht of LADEANSICHTEN) {
      expect(ansichtsText(ansicht), `${ansicht.zweck} mit Farbliteral`).not.toMatch(FARBLITERAL)
    }
  })

  it('enthält keine Emojis als Illustration', () => {
    for (const ansicht of LADEANSICHTEN) {
      expect(PIKTOGRAMM.test(ansichtsText(ansicht)), `${ansicht.zweck} mit Emoji`).toBe(false)
    }
  })

  it('zeigt an der Kasse dasselbe Bild wie das Formular beim Warten auf den Korb', () => {
    // Zwei Wartezeiten hintereinander: Server (loading.tsx), dann
    // localStorage (!isHydrated). Vorher stand an der zweiten ein Loader2.
    const formular = liesDatei('src/components/checkout/checkout-form.tsx')

    expect(formular).toContain('<KasseSkelett />')
    expect(formular).not.toMatch(/Loader2 className="size-6 animate-spin/)
  })
})

/**
 * Hofbereich und Bestandsbereich (Nachtlauf Nr. 31): JEDE Route hat ihre
 * eigene Ladeansicht. Befund vom 06.10.2026: Nahezu jeder Tab-Wechsel im
 * Hofbereich war ein Kaltstart — ohne loading.tsx gab es weder sofortige
 * Rückmeldung noch Vorladen bis zur Grenze. Die Rückfälle der Gruppen fangen
 * nur Routen, die neu dazukommen. Der Admin bekommt seine Ladeansichten mit
 * der AdminShell (Nr. 24, #203), samt Prüfung im Layout davor.
 */
const BEREICHE = ['src/app/(hof)', 'src/app/(farmer)'] as const

/**
 * Noch ohne eigene Ladeansicht, mit Grund: Die Auswertung zieht mit Nr. 22c
 * (#200) nach (hof); dort zeigt sie seit Nr. 121 einen Ladepunkt statt eines Skeletts;
 * bis dahin greift der Rückfall (farmer)/loading.tsx. Nach dem Merge gibt es
 * diese Ordner nicht mehr — die Ausnahme greift dann ins Leere.
 */
const OHNE_EIGENE = new Set(['src/app/(farmer)/analytics', 'src/app/(farmer)/analytics/umfeld'])

/**
 * Statt eines Skeletts bei jedem Klick zeigen diese Seiten einen Ladepunkt
 * (Nr. 121, loading-filter-wache; Muster Admin › Postfach, Nr. 105): Ihre Filter
 * stehen in der Adresse, die alte Ansicht bleibt stehen, bis die neue da ist
 * (`LadeRahmen`/`LadeInhalt`, `ladePunkt` am Link). Eine eigene `loading.tsx`
 * wäre genau das Skelett pro Klick; beim ersten Aufruf greift der Rückfall der
 * Gruppe. Die Liste darf nur kleiner werden – und nie ohne Ladepunkt in der Seite.
 * Region seit Nr. 122 (N23): `LadeRahmen` in der Seite, `LadeInhalt` und der Ladepunkt
 * am Reiter in den beiden Teilen der Seite (preise-reiter.tsx, futter-reiter.tsx).
 * Seit Nr. 127 (Nacharbeit 121): Mein Hof (`LadeRahmen` und `LadeInhalt` in `MeinHofAnsicht`, der
 * Ladepunkt an den Reitern in `MeinHofReiterLeiste` – zwei Stufen unter der Seite) und die Bestellung
 * (`BestellungenAnsicht` wie die Liste; der Ladepunkt sitzt zusätzlich an der Zeile der Liste, denn die
 * Zeilen öffnen diese Route, und das Skelett war dort die einzige Rückmeldung).
 */
const LADEPUNKT_STATT_SKELETT = new Set([
  'src/app/(hof)/postfach',
  'src/app/(hof)/orders',
  'src/app/(hof)/orders/[orderId]',
  'src/app/(hof)/analytics',
  'src/app/(hof)/region',
  'src/app/(hof)/farm-page',
])

/** Alle Ordner unter `wurzel` mit einer page.tsx. */
function routenOrdner(wurzel: string): string[] {
  const ergebnis: string[] = []
  const lauf = (ordner: string): void => {
    const eintraege = fs.readdirSync(path.join(WURZEL, ordner), { withFileTypes: true })
    if (eintraege.some((e) => e.isFile() && e.name === 'page.tsx')) ergebnis.push(ordner)
    for (const e of eintraege) if (e.isDirectory()) lauf(`${ordner}/${e.name}`)
  }
  lauf(wurzel)
  return ergebnis.sort()
}

/** Die Ladeansicht samt der Bauteile, die sie aus src/components bzw. relativ einbindet. */
function ladeansichtMitTeilen(datei: string, tiefe = 1): string {
  const text = liesDatei(datei)
  const teile = [...text.matchAll(/from '(@\/components\/[^']+|\.{1,2}\/[^']+)'/g)].map(([, spez]) => {
    const basis = spez.startsWith('@/')
      ? path.join('src', spez.slice(2))
      : path.join(path.dirname(datei), spez)
    return ['.tsx', '.ts', '/loading.tsx'].map((e) => basis + e).find((k) => existiert(k))
  })
  // `tiefe` 2: auch die Bauteile der Bauteile (der Ladepunkt sitzt bei Mein Hof im Reiter des Kopfs).
  const gefunden = teile.filter((t): t is string => t !== undefined)
  return [text, ...gefunden.map((t) => (tiefe > 1 ? ladeansichtMitTeilen(t, tiefe - 1) : liesDatei(t)))].join('\n')
}

describe('Ladeansichten — jede Route im Hofbereich und im Bestand hat eine eigene', () => {
  const routen = BEREICHE.flatMap(routenOrdner)

  it('findet die Routen überhaupt (Gegenprobe)', () => {
    expect(routen).toContain('src/app/(hof)/orders')
    expect(routen).toContain('src/app/(hof)/status/new')
    expect(routen).toContain('src/app/(farmer)/orders/today/print')
    expect(routen.length).toBeGreaterThanOrEqual(25)
  })

  for (const route of BEREICHE.flatMap(routenOrdner).filter((r) => !OHNE_EIGENE.has(r) && !LADEPUNKT_STATT_SKELETT.has(r))) {
    it(`${route} hat loading.tsx`, () => {
      expect(existiert(`${route}/loading.tsx`), `${route}/loading.tsx fehlt`).toBe(true)
    })
  }

  for (const route of LADEPUNKT_STATT_SKELETT) {
    it(`${route} zeigt einen Ladepunkt statt des Skeletts – ohne loading.tsx, mit LadeRahmen, LadeInhalt und ladePunkt`, () => {
      expect(routen, `${route} gibt es nicht mehr – aus LADEPUNKT_STATT_SKELETT nehmen`).toContain(route)
      expect(existiert(`${route}/loading.tsx`), `${route}/loading.tsx steht neben dem Ladepunkt`).toBe(false)
      const seite = ladeansichtMitTeilen(`${route}/page.tsx`, 2)
      // Der Punkt sitzt am Link: als Prop (`ladePunkt` am FilterChip) oder als `<LadePunkt />` im Link.
      for (const teil of ['LadeRahmen', 'LadeInhalt']) expect(seite, `${route}: ${teil} fehlt`).toContain(teil)
      expect(seite, `${route}: kein Ladepunkt am Link`).toMatch(/ladePunkt|<LadePunkt\b/)
    })
  }

  it('die Gruppen haben einen Rückfall für neue Routen', () => {
    expect(existiert('src/app/(hof)/loading.tsx')).toBe(true)
    expect(existiert('src/app/(farmer)/loading.tsx')).toBe(true)
  })

  it('alle zeigen Platzhalter in Kartenform mit aria-busy, ohne Spinner, Farbliteral oder Emoji', () => {
    const dateien = [
      ...BEREICHE.flatMap(routenOrdner)
        .filter((r) => !OHNE_EIGENE.has(r) && !LADEPUNKT_STATT_SKELETT.has(r))
        .map((r) => `${r}/loading.tsx`),
      'src/app/(hof)/loading.tsx',
      'src/app/(farmer)/loading.tsx',
    ]
    for (const datei of dateien) {
      const text = ladeansichtMitTeilen(datei)
      expect(text, `${datei} ohne animate-pulse`).toContain('animate-pulse')
      expect(text, `${datei} ohne aria-busy`).toContain('aria-busy')
      expect(text, `${datei} mit Spinner`).not.toMatch(SPINNER)
      expect(text, `${datei} mit Farbliteral`).not.toMatch(FARBLITERAL)
      expect(PIKTOGRAMM.test(text), `${datei} mit Emoji`).toBe(false)
    }
  })

  // Nr. 127: /farm-page hat keine eigene loading.tsx mehr (Ladepunkt statt Skelett); das Skelett von Mein Hof lebt als
  // Bauteil weiter, damit die Routen, die nur umleiten, die Form ihres Ziels zeigen (ARCHITECTURE §4).
  it('/status und /settings/appearance zeigen während der Umleitung die Form des Ziels (Mein Hof) – aus dem Bauteil, nicht aus farm-page/loading', () => {
    expect(existiert('src/app/(hof)/farm-page/loading.tsx')).toBe(false)
    expect(existiert('src/components/mein-hof/mein-hof-laden.tsx')).toBe(true)
    for (const datei of ['src/app/(hof)/status/loading.tsx', 'src/app/(hof)/settings/appearance/loading.tsx']) {
      const text = liesDatei(datei)
      expect(text, datei).toMatch(/from '@\/components\/mein-hof\/mein-hof-laden'/)
      expect(text, datei).not.toMatch(/farm-page\/loading/)
    }
    // Das Skelett selbst bleibt ein Skelett: Platzhalter in Kartenform, aria-busy, kein Spinner.
    const laden = liesDatei('src/components/mein-hof/mein-hof-laden.tsx')
    expect(laden).toContain('animate-pulse')
    expect(laden).toContain('aria-busy')
    expect(laden).not.toMatch(SPINNER)
  })

  it('Mein Hof: Der Ladepunkt sitzt an jedem Reiter, und die Zeilen der Bestellungen tragen ihn auch', () => {
    expect(liesDatei('src/components/mein-hof/reiter-leiste.tsx')).toMatch(/<LadePunkt\b/)
    const ansicht = liesDatei('src/components/mein-hof/mein-hof-ansicht.tsx')
    expect(ansicht).toContain('<LadeRahmen>')
    expect(ansicht).toContain('<LadeInhalt')
    // Die Zeile einer Bestellung ist ein Link auf /orders/[orderId]: Ohne Skelett braucht sie den Punkt.
    const zeile = liesDatei('src/components/hof-bestellungen/bestellungen-ansicht.tsx')
    const ab = zeile.slice(zeile.indexOf('function ListenZeile'))
    expect(ab.slice(0, ab.indexOf('</Link>'))).toMatch(/<LadePunkt\b/)
    // Gegenprobe: Die Suche kennt den Fall ohne Punkt.
    expect('<Link href={href}><span>Zeile</span></Link>').not.toMatch(/<LadePunkt\b/)
  })

  it('Hof und Bestand: Zugang prüft das Layout der Gruppe, vor jeder Ladeansicht', () => {
    for (const gruppe of ['src/app/(hof)/layout.tsx', 'src/app/(farmer)/layout.tsx']) {
      expect(liesDatei(gruppe), gruppe).toContain('await ladeHofbereich()')
    }
  })
})

describe('Hofseite und Produktseite — die 404 kommt vor dem Skelett (Nr. 117)', () => {
  // Mit einer loading.tsx davor streamt Next das Skelett zuerst; ein notFound()
  // der Seite kam dann mit Status 200 im Datenstrom (ARCHITECTURE §4). Jede
  // Adresse /<irgendwas> landet in [farmSlug] — auch /wp-login.php.
  const OHNE = ['src/app/(public)/loading.tsx', 'src/app/(public)/[farmSlug]/loading.tsx', 'src/app/(public)/[farmSlug]/produkt/[id]/loading.tsx']
  const SEITEN = [
    { datei: 'src/app/(public)/[farmSlug]/page.tsx', skelett: 'HofseiteSkelett', pruefung: 'pruefeHofseiteGeteilt(' },
    { datei: 'src/app/(public)/[farmSlug]/produkt/[id]/page.tsx', skelett: 'ProduktSkelett', pruefung: 'pruefeProduktseiteGeteilt(' },
  ] as const

  it('keine Ladeansicht über oder in der Hofseite', () => {
    for (const datei of OHNE) expect(existiert(datei), datei).toBe(false)
    // Gegenprobe: Die Suche findet Dateien, die es gibt.
    expect(existiert('src/app/(public)/hoefe/loading.tsx')).toBe(true)
  })

  it('die Seite prüft, ruft notFound() und setzt erst danach die Suspense-Grenze mit dem Skelett', () => {
    for (const { datei, skelett, pruefung } of SEITEN) {
      const text = liesDatei(datei)
      const seite = text.slice(text.indexOf('export default async function'))
      const stellen = [seite.indexOf(pruefung), seite.indexOf('notFound()'), seite.indexOf(`<Suspense fallback={<${skelett} />}>`)]
      expect(stellen.every((stelle) => stelle > -1), datei).toBe(true)
      expect([...stellen].sort((a, b) => a - b), datei).toEqual(stellen)
    }
  })

  it('die Infoseiten der Gruppe warten auf nichts — ohne Ladeansicht davor', () => {
    for (const ordner of ['agb', 'datenschutz', 'impressum', 'konditionen', 'fuer-hoefe']) {
      const text = liesDatei(`src/app/(public)/${ordner}/page.tsx`)
      expect(text, ordner).not.toMatch(/force-dynamic|searchParams|from 'next\/headers'/)
    }
    // Gegenprobe: Die Hofseite ist dynamisch und fiele hier auf.
    expect(liesDatei('src/app/(public)/[farmSlug]/page.tsx')).toMatch(/force-dynamic/)
  })
})

describe('Startseite — bewusst OHNE src/app/loading.tsx', () => {
  it('hat kein src/app/loading.tsx', () => {
    // Eine Datei im Wurzelsegment wäre der Fallback für JEDE Route ohne
    // nähere Ladeansicht, auch /login, /admin und /account. Die sähen dann
    // das Startseiten-Skeleton.
    expect(existiert('src/app/loading.tsx')).toBe(false)
  })

  it('wartet auf nichts — die Seite ist statisch, die Höfe laden hinter Suspense mit eigenem Skelett', () => {
    // Seit der Nachbesserung zu Nr. 07 ist die Startseite wieder statisch
    // (ISR, revalidate = 300): Die Sitzung für die Kopfzeile liest
    // KundeShellMitSitzung im Browser, die Höfe kommen aus dem Cache. Die
    // Ladeansicht ist die Suspense-Grenze um die Hofkarten (Skelett in
    // Kartenform), nicht eine Datei im Wurzelsegment. Wer auf der Seite ein
    // await einführt, sieht hier, dass sie dafür nicht gebaut ist.
    //
    // Seit Nr. 182 (Register N16, Ergänzung 25.10.2026) wartet die Seite auf
    // genau eins: die Liste der Abschnitte aus dem Datencache (ladeStartseite,
    // wirft nie). Die Vorschau aus Admin › Startseite hat ihre eigene,
    // dynamische Route (/startseite-vorschau); die Startseite liest nichts aus
    // der Anfrage. Jedes weitere await fällt hier auf.
    const seite = liesDatei('src/app/page.tsx')
    const komponente = seite.slice(seite.indexOf('export default async function HomePage('))
    expect(komponente.length).toBeLessThan(seite.length)
    expect(komponente.match(/\bawait\b[^\n]*/g)).toEqual(['await ladeStartseite(), jetzt, {'])
    // Die Höfe hinter Suspense stehen im gemeinsamen Baustein (src/components/startseite/startseiten-inhalt.tsx).
    expect(seite).toContain("from '@/components/startseite/startseiten-inhalt'")
    expect(liesDatei('src/components/startseite/startseiten-inhalt.tsx')).toMatch(/<Suspense fallback=\{<HofKartenSkelett \/>\}>/)
  })

  it('die Vorschau-Seite wartet auf die Prüfung von Link und Sitzung und erst danach auf ihre Quelle (Nr. 182)', () => {
    // Dynamisch (force-dynamic): Sie liest die Anfrage. Ohne gültige Vorschau lädt sie keine Zeilen.
    const seite = liesDatei('src/app/startseite-vorschau/page.tsx')
    const komponente = seite.slice(seite.indexOf('export default async function StartseitenVorschauSeite('))
    expect(komponente.length).toBeLessThan(seite.length)
    expect(komponente.match(/\bawait\b[^\n]*/g)).toEqual([
      'await leseStartseitenVorschau(await searchParams, jetzt)',
      'await ladeVorschauZeilen(vorschau), vorschau.datum, {',
    ])
    expect(seite).toContain("from '@/components/startseite/startseiten-inhalt'")
  })
})

describe('Die Texte der Fehlerseiten — eine Quelle für beide Grenzen', () => {
  it('trägt Titel und Text der 404 wie beauftragt', () => {
    expect(NICHT_GEFUNDEN_TITEL).toBe('Diese Seite gibt es nicht (mehr)')
    expect(NICHT_GEFUNDEN_TEXT).toBe(
      'Vielleicht hat sich der Link geändert, oder der Hof ist nicht mehr dabei. ' +
        'Von hier aus findest du schnell zurück.'
    )
  })

  it('trägt Titel und Text der 500 wie beauftragt', () => {
    expect(FEHLER_TITEL).toBe('Da ist etwas schiefgelaufen')
    expect(FEHLER_TEXT).toBe('Das liegt an uns, nicht an dir. Deine Bestellungen und Daten sind sicher.')
  })

  it('behauptet bei der Hof-404 keinen Grund', () => {
    // Warum ein Hof nicht mehr da ist, ist seine Sache — und dieselbe Seite
    // fängt auch den unbekannten Bestell-Link und den Hof in Pause.
    expect(HOF_NICHT_GEFUNDEN_TITEL).toContain('Hof')
    expect(HOF_NICHT_GEFUNDEN_TEXT).toContain('Vielleicht')
    expect(HOF_NICHT_GEFUNDEN_TEXT).not.toMatch(/stillgelegt|archiviert|gesperrt|Pause/)
  })

  it('duzt und nennt keine Technik', () => {
    for (const text of [NICHT_GEFUNDEN_TEXT, HOF_NICHT_GEFUNDEN_TEXT, FEHLER_TEXT]) {
      expect(text).not.toMatch(/\b(Sie|Ihnen|Ihre)\b/)
      expect(text).not.toMatch(/Error|Exception|500|404|Server|Code/)
    }
  })
})

describe('404 — „Diese Seite gibt es nicht (mehr)"', () => {
  const datei = 'src/app/not-found.tsx'

  it('zeigt Titel und Text aus der gemeinsamen Quelle', () => {
    const text = liesDatei(datei)

    expect(text).toContain('NICHT_GEFUNDEN_TITEL')
    expect(text).toContain('NICHT_GEFUNDEN_TEXT')
  })

  it('bietet beide Wege zurück und ein Suchfeld', () => {
    const text = liesDatei(datei)

    expect(text).toContain('ZUR_STARTSEITE')
    expect(text).toContain('HOEFE_ENTDECKEN')
    // Seit Nr. 54 zeichnet die gemeinsame Ansicht (Mockups fehler-404-*): Die
    // Seite gibt die Wege hinein — zuerst die Startseite, dann die Höfe.
    expect(text).toContain('<NichtGefundenAnsicht')
    expect(text).toMatch(/haupt=\{\{ href: '\/', text: ZUR_STARTSEITE \}\}/)
    expect(text).toMatch(/neben=\{\{ href: '\/hoefe', text: HOEFE_ENTDECKEN \}\}/)
    const ansicht = liesDatei(NICHT_GEFUNDEN_ANSICHT)
    expect(ansicht).toMatch(/<Link href=\{haupt\.href\}/)
    expect(ansicht).toMatch(/<Link href=\{neben\.href\}/)
    // Das Suchfeld ist ein GET-Formular auf die Hofübersicht und braucht kein
    // JavaScript; den Parameter prüft dort leseHoefeFilter.
    expect(ansicht).toMatch(/<form action="\/hoefe" method="get"/)
    expect(ansicht).toContain('SUCHTEXT_PARAMETER')
  })

  it('zeigt kein Emoji mehr', () => {
    // Vorher: eine Weizen-Ähre als einzige Illustration.
    expect(PIKTOGRAMM.test(liesDatei(datei))).toBe(false)
    expect(PIKTOGRAMM.test(liesDatei(NICHT_GEFUNDEN_ANSICHT))).toBe(false)
  })

  it('schickt niemanden mehr in den Hof-Login', () => {
    // Die 404 ist eine Kundenseite — und das, was ein Fremder unter /admin
    // sieht. „Hofbetreiber-Login" war dort der einzige zweite Weg.
    expect(liesDatei(datei)).not.toContain('Hofbetreiber-Login')
  })
})

describe('404 der Hofseite — ein stillgelegter Hof sieht aus wie ein unbekannter', () => {
  const datei = 'src/app/(public)/[farmSlug]/not-found.tsx'

  it('hat eine eigene not-found', () => {
    expect(existiert(datei), `${datei} fehlt`).toBe(true)
  })

  it('zeigt die Hof-Texte und führt zuerst in die Übersicht', () => {
    const text = liesDatei(datei)

    expect(text).toContain('HOF_NICHT_GEFUNDEN_TITEL')
    expect(text).toContain('HOF_NICHT_GEFUNDEN_TEXT')
    expect(text).toContain('HOEFE_ENTDECKEN')
    // Der grüne Weg ist hier die Hofübersicht, die Startseite der zweite.
    expect(text).toMatch(/haupt=\{\{ href: '\/hoefe', text: HOEFE_ENTDECKEN \}\}/)
    expect(text).toMatch(/neben=\{\{ href: '\/', text: ZUR_STARTSEITE \}\}/)
    expect(PIKTOGRAMM.test(text)).toBe(false)
  })
})

describe('500 — dieselbe Ansicht an beiden Grenzen', () => {
  const ansicht = 'src/components/shared/fehler-ansicht.tsx'

  it('zeigt Titel, Text und beide Knöpfe', () => {
    const text = liesDatei(ansicht)

    expect(text).toContain('FEHLER_TITEL')
    expect(text).toContain('FEHLER_TEXT')
    expect(text).toContain('NOCHMAL_VERSUCHEN')
    expect(text).toContain('ZUR_STARTSEITE')
    expect(text).toContain('PROBLEM_MELDEN')
  })

  it('löst „Nochmal versuchen" über reset() aus', () => {
    expect(liesDatei(ansicht)).toMatch(/onClick=\{nochmal\}/)
    for (const seite of ['src/app/error.tsx', 'src/app/global-error.tsx']) {
      expect(liesDatei(seite), `${seite} gibt reset nicht weiter`).toMatch(/nochmal=\{reset\}/)
    }
  })

  it('zeigt die Fehlernummer und sonst nichts Technisches', () => {
    for (const seite of ['src/app/error.tsx', 'src/app/global-error.tsx']) {
      expect(liesDatei(seite), `${seite} ohne Fehlernummer`).toContain('error.digest')
    }
    for (const datei of FEHLERSEITEN) {
      const text = liesDatei(datei)
      expect(text, `${datei} zeigt eine Fehlermeldung`).not.toMatch(TECHNISCHES)
    }
  })

  it('führt zum Briefkasten, mit der Fehlernummer vorausgefüllt', () => {
    expect(liesDatei(ansicht)).toContain('meldungLinkMitKennung(fehlernummer')
  })

  it('bleibt in beiden Fehlerseiten ohne Emoji', () => {
    for (const datei of FEHLERSEITEN) {
      expect(PIKTOGRAMM.test(liesDatei(datei)), `${datei} mit Emoji`).toBe(false)
    }
  })
})

describe('global-error — greift, wenn das Root-Layout selbst scheitert', () => {
  const datei = 'src/app/global-error.tsx'

  it('existiert', () => {
    expect(existiert(datei), `${datei} fehlt`).toBe(true)
  })

  it('bringt eigenes html und body mit — das Layout steht hier nicht mehr', () => {
    const text = liesDatei(datei)

    expect(text).toMatch(/<html lang="de">/)
    expect(text).toMatch(/<body/)
  })

  it('bringt auch das Stylesheet selbst mit', () => {
    // Ohne diesen Import stünde die Seite ohne jede Formatierung da: Der
    // Import im Root-Layout ist mit dem Layout weg.
    expect(liesDatei(datei)).toMatch(/import '\.\/globals\.css'/)
  })

  it('meldet den Fehler nach Sentry — wie die andere Grenze auch', () => {
    // BEIDE Grenzen melden, und das ist kein Doppel: Sie schließen sich aus.
    // global-error greift nur für Fehler im Root-Layout und für solche, die
    // error.tsx selbst wirft. Ein Render-Fehler im Seitenbaum landet in
    // error.tsx — und wäre ohne den Aufruf dort stumm, weil onRequestError
    // nur den Server abdeckt und eine React-Fehlergrenze den Client-SDK nicht
    // von selbst erreicht.
    for (const seite of ['src/app/global-error.tsx', 'src/app/error.tsx']) {
      expect(liesDatei(seite), `${seite} meldet nicht`).toContain('Sentry.captureException(error)')
    }
  })

  it('ist eine Client-Komponente — sie bekommt reset()', () => {
    expect(liesDatei(datei)).toMatch(/^'use client'/)
  })
})

describe('Die Fehlernummer auf dem Weg in den Briefkasten', () => {
  it('nimmt eine Fehlernummer, wie Next.js sie baut', () => {
    expect(bereinigeKennung('1234567890')).toBe('1234567890')
    expect(meldungLinkMitKennung('1234567890')).toBe(`/problem-melden?${KENNUNG_PARAMETER}=1234567890`)
  })

  it('wirft weg, was nicht in eine Kennung gehört', () => {
    // Der Wert landet in einer URL und von dort in ein Formularfeld.
    expect(bereinigeKennung('abc <script>')).toBe('abcscript')
    expect(bereinigeKennung('  ab-c_1  ')).toBe('ab-c_1')
    expect(bereinigeKennung('')).toBe('')
    expect(bereinigeKennung('   ')).toBe('')
    expect(bereinigeKennung(undefined)).toBe('')
    expect(bereinigeKennung(['a', 'b'])).toBe('')
    expect(bereinigeKennung(42)).toBe('')
  })

  it('lässt eine zu lange Nummer ganz weg, statt sie abzuschneiden', () => {
    // Eine abgeschnittene Fehlernummer zeigt auf den falschen Fehler. Die
    // vollständige steht auf der Fehlerseite und lässt sich kopieren.
    const grenze = 'a'.repeat(MELDUNG_KENNUNG_MAX)
    const zuLang = 'a'.repeat(MELDUNG_KENNUNG_MAX + 1)

    expect(bereinigeKennung(grenze)).toBe(grenze)
    expect(bereinigeKennung(zuLang)).toBe('')
    expect(meldungLinkMitKennung(zuLang)).toBe('/problem-melden')
  })

  it('zeigt ohne Nummer den nackten Link', () => {
    expect(meldungLinkMitKennung(undefined)).toBe('/problem-melden')
    expect(meldungLinkMitKennung('')).toBe('/problem-melden')
  })

  it('wird im Formular vorbelegt — geprüft, nicht roh', () => {
    const seite = liesDatei('src/app/(public)/problem-melden/page.tsx')

    expect(seite).toContain('bereinigeKennung')
    expect(seite).toContain('KENNUNG_PARAMETER')
    expect(seite).toContain('kennungVorbelegt={kennung}')
    // Seit Nr. 22e steht die Logik im gemeinsamen Hook (Bestandsformular und „Meldung abgeben").
    expect(liesDatei('src/components/shared/meldung-form.tsx')).toContain('useMeldungFormular({ formToken, alsHof, kennungVorbelegt })')
    expect(liesDatei('src/components/shared/use-meldung-formular.ts')).toMatch(/useState\(kennungVorbelegt\)/)
  })

  it('hält die Knopfbeschriftungen an einer Stelle', () => {
    expect(ZUR_STARTSEITE).toBe('Zur Startseite')
    expect(HOEFE_ENTDECKEN).toBe('Höfe entdecken')
    expect(NOCHMAL_VERSUCHEN).toBe('Nochmal versuchen')
    expect(PROBLEM_MELDEN).toBe('Problem melden')
  })

  /** Texte (Zeichenkette, Vorlage, JSX-Text) einer Datei mit „Problem melden" — Kommentare zählen nicht. */
  function problemMeldenTexte(quelltext: string, datei: string): string[] {
    const quelle = ts.createSourceFile(datei, quelltext, ts.ScriptTarget.Latest, true, datei.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const funde: string[] = []
    const besuche = (k: ts.Node): void => {
      const text =
        ts.isStringLiteral(k) || ts.isNoSubstitutionTemplateLiteral(k) || ts.isTemplateHead(k) || ts.isTemplateMiddle(k) || ts.isTemplateTail(k) || ts.isJsxText(k)
          ? k.text
          : null
      if (text?.includes('Problem melden')) funde.push(text.trim())
      ts.forEachChild(k, besuche)
    }
    besuche(quelle)
    return funde
  }

  it('„Problem melden" steht als Text nur in PROBLEM_MELDEN — Seiten, Menüs und Fußzeile nehmen die Konstante (Nr. 85)', () => {
    /** Wo das Wort noch als Text stehen darf — je mit Grund. */
    const ERLAUBT: Record<string, string> = {
      'src/lib/fehlerseite.ts': 'die Quelle selbst',
      'src/lib/bauern-navigation.ts': 'Navigation des Hofbereichs, dort baut Nr. 87 den Punkt Postfach (Nacharbeit)',
      'src/app/(public)/datenschutz/page.tsx': 'ein Satz der Datenschutzerklärung (Rechtstext)',
      'src/lib/rechtstexte/agb.ts': 'die AGB Wort für Wort aus docs/recht/agb.md (Nr. 90; Rechtstext ist von Textwachen ausgenommen, Freigabe §17 §2)',
    }
    const quellen = (ordner: string): string[] =>
      fs.readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
        const voll = path.join(ordner, e.name)
        return e.isDirectory() ? quellen(voll) : /\.(ts|tsx)$/.test(e.name) ? [voll] : []
      })
    const verstoesse = quellen(path.join(process.cwd(), 'src'))
      .map((voll) => path.relative(process.cwd(), voll).split(path.sep).join('/'))
      .filter((datei) => !(datei in ERLAUBT))
      .filter((datei) => problemMeldenTexte(liesDatei(datei), datei).length > 0)
    expect(verstoesse).toEqual([])
    // Gegenprobe: Die Suche schlägt an einem Text an, nicht an einem Kommentar.
    expect(problemMeldenTexte("const a = <a>Problem melden</a>; const b = 'Problem melden'", 'x.tsx')).toHaveLength(2)
    expect(problemMeldenTexte('// Problem melden\nconst a = PROBLEM_MELDEN', 'x.ts')).toEqual([])
  }, 30_000)
})
