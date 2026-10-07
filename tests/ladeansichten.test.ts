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
 * Umgebung nicht prüfbar: kein jsdom, kein Rendering (TESTING_GUIDELINES §1).
 * Dafür steht die Checkliste im PR.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
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
  { zweck: 'Öffentliche Infoseiten', datei: 'src/app/(public)/loading.tsx' },
  { zweck: 'Hofseite samt Produkten', datei: 'src/app/(public)/[farmSlug]/loading.tsx' },
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
]

/** Der Quelltext einer Ladeansicht samt der Bauteile, die sie rendert. */
function ansichtsText({ datei, teile }: { datei: string; teile?: readonly string[] }): string {
  return [datei, ...(teile ?? [])].map(liesDatei).join('\n')
}

/** Die vier Seiten, die bei einem Fehler oder einer falschen Adresse erscheinen. */
const FEHLERSEITEN = [
  'src/app/not-found.tsx',
  'src/app/(public)/[farmSlug]/not-found.tsx',
  'src/app/error.tsx',
  'src/app/global-error.tsx',
  'src/components/shared/fehler-ansicht.tsx',
] as const

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
    // Die Kasse steht seit Nr. 12 in der Fokus-Shell: deren Kopf ist 52 px
    // hoch (ab md 64) — der Platzhalter hat genau diese Maße.
    const FOKUS_SHELL = new Set(['src/app/(public)/[farmSlug]/checkout/loading.tsx'])
    for (const ansicht of LADEANSICHTEN) {
      expect(liesDatei(ansicht.datei), `${ansicht.zweck} ohne Kopfleisten-Platzhalter`).toMatch(
        FOKUS_SHELL.has(ansicht.datei) ? /h-\[52px\][^"]*md:h-16/ : /h-14[^"]*md:h-16/
      )
    }
  })

  it('die Kasse: Kopf-Platzhalter in den Maßen der Fokus-Shell', () => {
    // Gegenprobe zur Ausnahme oben: Die Shell hat wirklich 52 px / ab md 64 px.
    expect(liesDatei('src/components/shells/kunde-shell.tsx')).toMatch(/h-\[52px\][^"]*md:h-16/)
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
    const seite = liesDatei('src/app/page.tsx')
    const komponente = seite.slice(seite.indexOf('export default function HomePage('))
    expect(komponente.length).toBeLessThan(seite.length)
    expect(komponente).not.toMatch(/\bawait\b/)
    expect(komponente).toMatch(/<Suspense fallback=\{<HofKartenSkelett \/>\}>/)
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
    expect(text).toMatch(/href="\/"/)
    expect(text).toMatch(/href="\/hoefe"/)
    // Das Suchfeld ist ein GET-Formular auf die Hofübersicht und braucht kein
    // JavaScript; den Parameter prüft dort leseHoefeFilter.
    expect(text).toMatch(/<form action="\/hoefe" method="get"/)
    expect(text).toContain('SUCHTEXT_PARAMETER')
  })

  it('zeigt kein Emoji mehr', () => {
    // Vorher: eine Weizen-Ähre als einzige Illustration.
    expect(PIKTOGRAMM.test(liesDatei(datei))).toBe(false)
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
    expect(liesDatei(ansicht)).toContain('meldungLinkMitKennung(fehlernummer)')
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
})
