/**
 * Tests für die Startseite im neuen Design (Gate 4, Nr. 07): src/app/page.tsx,
 * ihre Abschnitte (src/components/startseite/) und ihre Konfiguration
 * (src/lib/startseite.ts). Die Saisonregel des Brennmaterial-Bands prüft
 * tests/brennmaterial-saison.test.ts.
 *
 * Beweist:
 *  - Metadaten: Titel, Beschreibung, Open Graph und Twitter-Karte nennen
 *    Futter und zeigen das große Vorschaubild.
 *  - Jeder Weg auf /hoefe (Chips, Futter-Zielgruppen, Brennmaterial, Karte)
 *    landet dort, wo /hoefe den Filter wieder liest — und keiner trägt einen
 *    Standort.
 *  - Die Höfeauswahl: höchstens vier, pausierte ans Ende, PLZ und Ort statt
 *    Kilometer, nächste Abholung, Angebot aus den Kategorien.
 *  - Die Beispielrechnung kommt aus berechneServicegebuehr (E4), nicht aus
 *    dem Mockup abgeschrieben.
 *  - Gerendert wie auf dem Server: Video stumm, in Schleife, playsInline, nur
 *    bei erlaubter Bewegung geladen, Standbild immer da; die Suche geht als
 *    `q` nach /hoefe; Sprungmarken #so-funktionierts und #fuer-hoefe für die
 *    Navigation der KundeShell; Hofkarten mit langem Namen, Leer- und
 *    Fehlerzustand mit Ausweg, Skelett; Fragen mit Antworten im HTML und
 *    ohne Kontoversprechen (E8); keine erfundenen Preise; keine Farbwerte im
 *    HTML (Tokens tragen beide Themes).
 *  - Aufbau der Seite: KundeShell statt LandingNav, Höfe hinter Suspense mit
 *    Skelett, Brennmaterial-Band hinter der Saisonregel.
 *
 * Gegenproben: Jede gesuchte Abwesenheit wird an einer Stelle gesucht, an der
 * dasselbe Merkmal nachweislich vorkommt.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }),
}))
// Die Seite selbst wird nur als Quelltext gelesen; ihre Metadaten importieren
// wir echt — dafür brauchen Sitzungs-Client, Datenbank und Cache Attrappen.
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null, isPending: false }) }))
vi.mock('@/server/queries/farm', () => ({ getOeffentlicheHoefe: async () => [] }))

import { metadata, revalidate } from '@/app/page'
import {
  BRENNMATERIAL_ADRESSE,
  FUTTER_ZIELGRUPPEN,
  KARTE_ADRESSE,
  STARTSEITE_CHIPS,
  STARTSEITE_FRAGEN,
  beispielRechnung,
  hoefeAdresse,
  waehleStartseitenHoefe,
  type StartseitenHofEingabe,
} from '@/lib/startseite'
import { kundenNavigation } from '@/lib/kunden-navigation'
import { STARTSEITE_VORSCHAUBILD } from '@/lib/vorschaubild'
import { KATEGORIE_LABEL } from '@/lib/taxonomie'
import type { ProductCategoryValue } from '@/schemas/product'
import { leseHoefeFilter, type HoefeFilter } from '@/schemas/hoefe-filter'
import { StartseiteKopf } from '@/components/startseite/startseite-kopf'
import {
  HoefeInDerNaehe,
  HofKarten,
  HofKartenFehler,
  HofKartenSkelett,
  KartenHof,
} from '@/components/startseite/hoefe-in-der-naehe'
import {
  BrennmaterialBand,
  Fragen,
  FuerHoefeBand,
  FutterAbschnitt,
  SoFunktionierts,
  StartseiteFuss,
} from '@/components/startseite/startseite-abschnitte'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')
const html = (element: ReactElement) => renderToStaticMarkup(element)

/** Liest eine /hoefe-Adresse so, wie /hoefe sie liest. */
function gelesen(adresse: string): HoefeFilter {
  const [pfad, query = ''] = adresse.split('?')
  expect(pfad, adresse).toBe('/hoefe')
  return leseHoefeFilter(new URLSearchParams(query))
}

const JETZT = new Date('2026-10-05T10:00:00Z')

function hof(teil: Partial<StartseitenHofEingabe> & { slug: string }): StartseitenHofEingabe {
  return {
    name: `Hof ${teil.slug}`,
    postalCode: '4910',
    city: 'Ried im Innkreis',
    isPaused: false,
    kategorien: ['EIER'],
    naechsteAbholung: null,
    fotos: [],
    ...teil,
  }
}

describe('Metadaten', () => {
  it('Titel und Beschreibung nennen Futter — Open Graph und Twitter-Karte sagen dasselbe', () => {
    expect(metadata.title).toBe('FarmerZone — Lebensmittel und Futter direkt vom Hof')
    expect(metadata.description).toMatch(/Heu/)
    expect(metadata.description).toMatch(/Futter/)
    expect(metadata.openGraph).toMatchObject({ title: metadata.title, description: metadata.description })
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', title: metadata.title })
  })

  it('das Vorschaubild: /og/startseite.jpg', () => {
    expect(metadata.openGraph?.images).toEqual([STARTSEITE_VORSCHAUBILD])
    expect(metadata.twitter?.images).toEqual([STARTSEITE_VORSCHAUBILD])
  })
})

describe('Wege auf /hoefe — /hoefe liest jeden wieder', () => {
  it('die Chips „Oder direkt suchen" in der Reihenfolge des Mockups', () => {
    expect(STARTSEITE_CHIPS.map((c) => c.label)).toEqual([
      'Eier',
      'Gemüse & Obst',
      'Fleisch',
      'Milch & Käse',
      'Brot',
      'Honig',
      'Futtermittel',
      'Brennmaterial',
    ])
  })

  it('jeder Chip landet in Bereich und Kategorien, die /hoefe daraus liest', () => {
    for (const chip of STARTSEITE_CHIPS) {
      const filter = gelesen(hoefeAdresse(chip.filter))
      expect(filter.bereich, chip.label).toBe(chip.filter.bereich ?? 'LEBENSMITTEL')
      expect(filter.kategorien, chip.label).toEqual(chip.filter.kategorien ?? [])
    }
  })

  it('Futtermittel ist ein Chip in derselben Reihe und öffnet den Bereich (E2)', () => {
    expect(hoefeAdresse({ bereich: 'FUTTERMITTEL' })).toBe('/hoefe?bereich=futter')
  })

  it('Brennmaterial ist die Kategorie Brennholz im Hofladen (E11) — Chip und Band führen gleich', () => {
    expect(BRENNMATERIAL_ADRESSE).toBe('/hoefe?kat=BRENNHOLZ')
    expect(gelesen(BRENNMATERIAL_ADRESSE).kategorien).toEqual(['BRENNHOLZ'])
    expect(hoefeAdresse(STARTSEITE_CHIPS.find((c) => c.label === 'Brennmaterial')?.filter)).toBe(BRENNMATERIAL_ADRESSE)
  })

  it('die zwei Futter-Zielgruppen: Kleinmengen und Ballen über die Gebinde-Facette', () => {
    expect(FUTTER_ZIELGRUPPEN.map((g) => g.knopf)).toEqual(['Kleinmengen finden', 'Ballen finden'])
    const [klein, gross] = FUTTER_ZIELGRUPPEN.map((g) => gelesen(hoefeAdresse(g.filter)))
    expect(klein).toMatchObject({ bereich: 'FUTTERMITTEL', gebinde: 'KLEIN' })
    expect(gross).toMatchObject({ bereich: 'FUTTERMITTEL', gebinde: 'GROSS' })
  })

  it('die Karte führt in die Kartenansicht', () => {
    expect(gelesen(KARTE_ADRESSE).ansicht).toBe('karte')
  })

  it('keine Adresse trägt einen Standort (ARCHITECTURE §4)', () => {
    const adressen = [
      ...STARTSEITE_CHIPS.map((c) => hoefeAdresse(c.filter)),
      ...FUTTER_ZIELGRUPPEN.map((g) => hoefeAdresse(g.filter)),
      BRENNMATERIAL_ADRESSE,
      KARTE_ADRESSE,
    ]
    for (const adresse of adressen) expect(adresse).not.toMatch(/[?&](lat|lon|lng|plz|ort|umkreis)=/i)
  })

  it('keine Zusage, die die Plattform nicht hält (Gebinde, Staub, Verladen sind Sache des Hofs)', () => {
    const texte = FUTTER_ZIELGRUPPEN.flatMap((g) => [g.kicker, g.titel, ...g.punkte]).join(' ')
    expect(texte).not.toMatch(/staubarm|Frontlader|ab 1 kg/i)
    expect(texte).toMatch(/je nach Hof/)
  })

  it('keine Zusage, die es erst mit Gate 6 gibt (Registrierung bei Ballen)', () => {
    const texte = FUTTER_ZIELGRUPPEN.flatMap((g) => [g.kicker, g.titel, ...g.punkte]).join(' ')
    expect(texte).not.toMatch(/registriert/i)
    // Gegenprobe: Die Suche findet Wörter in diesen Texten.
    expect(texte).toMatch(/Rundballen/)
  })
})

describe('waehleStartseitenHoefe', () => {
  it('zeigt höchstens vier Höfe, in der Reihenfolge der Übersicht', () => {
    const auswahl = waehleStartseitenHoefe(['a', 'b', 'c', 'd', 'e'].map((slug) => hof({ slug })))
    expect(auswahl.map((h) => h.slug)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('stellt pausierte Höfe ans Ende und sagt es statt einer Abholzeit', () => {
    const auswahl = waehleStartseitenHoefe([
      hof({ slug: 'pause', isPaused: true, naechsteAbholung: { dayOfWeek: 1, startTime: '15:00', endTime: '18:00', tageVoraus: 0 } }),
      hof({ slug: 'offen' }),
    ])
    expect(auswahl.map((h) => h.slug)).toEqual(['offen', 'pause'])
    expect(auswahl[1]).toMatchObject({ abholung: 'Macht gerade Pause', abholungIstTermin: false })
  })

  it('PLZ und Ort statt Kilometer, die nächste Abholung, das erste Foto', () => {
    const [eintrag] = waehleStartseitenHoefe([
      hof({
        slug: 'x',
        naechsteAbholung: { dayOfWeek: 1, startTime: '15:00', endTime: '18:00', tageVoraus: 0 },
        fotos: ['/titelbild.jpg', '/zweites.jpg'],
      }),
    ])
    expect(eintrag).toMatchObject({
      ort: '4910 Ried im Innkreis',
      abholung: 'Heute 15:00–18:00',
      abholungIstTermin: true,
      foto: '/titelbild.jpg',
    })
  })

  it('ohne Abholzeit keine Zeile, ohne Foto kein Bild', () => {
    const [eintrag] = waehleStartseitenHoefe([hof({ slug: 'x' })])
    expect(eintrag).toMatchObject({ abholung: null, abholungIstTermin: false, foto: null })
  })

  it('das Angebot: höchstens vier Kategorien, mit Namen aus der Taxonomie', () => {
    const [eintrag] = waehleStartseitenHoefe([
      hof({ slug: 'x', kategorien: ['EIER', 'BROT', 'GEMUESE', 'HONIG', 'HEU_STROH'] }),
    ])
    expect(eintrag.angebot).toBe(['EIER', 'BROT', 'GEMUESE', 'HONIG'].map((k) => KATEGORIE_LABEL[k as ProductCategoryValue]).join(' · '))
  })

  it('keine Höfe → leere Auswahl (die Seite zeigt den Leerzustand)', () => {
    expect(waehleStartseitenHoefe([])).toEqual([])
  })
})

describe('beispielRechnung', () => {
  it('rechnet das Beispiel des Mockups über berechneServicegebuehr: € 20,00 → € 1,00 Gebühr', () => {
    expect(beispielRechnung(JETZT)).toEqual({
      warenpreisCents: 2000,
      gebuehrCents: 100,
      prozent: 5,
      mindestCents: 50,
      duZahlstCents: 2100,
      hofBekommtCents: 2000,
    })
  })

  it('folgt der Regel: aufgerundet und mit Mindestgebühr', () => {
    expect(beispielRechnung(JETZT, 1030).gebuehrCents).toBe(52)
    expect(beispielRechnung(JETZT, 250).gebuehrCents).toBe(50)
  })
})

describe('Kopf — Video, Standbild und Suche', () => {
  const kopf = html(createElement(StartseiteKopf, {}))
  const video = kopf.slice(kopf.indexOf('<video'), kopf.indexOf('</video>'))

  it('das Video läuft stumm, in Schleife, im Bild (playsInline), ohne Ton und Bedienung', () => {
    expect(video).toMatch(/<video [^>]*autoPlay=""/)
    expect(video).toMatch(/<video [^>]*muted=""/)
    expect(video).toMatch(/<video [^>]*loop=""/)
    expect(video).toMatch(/<video [^>]*playsInline=""/)
    expect(video).toMatch(/<video [^>]*aria-hidden="true"/)
    expect(video).not.toMatch(/controls/)
    expect(video).toContain('src="/landing/hero-loop.mp4"')
  })

  it('bei „Bewegung reduzieren" nur das Standbild: Quelle nur ohne den Wunsch, Video erst dann sichtbar', () => {
    expect(video).toMatch(/<source media="\(prefers-reduced-motion: no-preference\)"/)
    expect(video).toMatch(/class="[^"]*\bhidden\b[^"]*motion-safe:block/)
    expect(video).toContain('preload="none"')
    // Kein poster: Das Standbild darunter (next/image, verkleinert) zeigt sich
    // durch, solange das Video noch kein Bild hat — mit poster lud der
    // Browser dasselbe Foto ein zweites Mal im Original.
    expect(video).not.toMatch(/poster=/)
    // Das Standbild steht außerhalb des Videos und damit immer da.
    const standbild = kopf.indexOf('src="/landing/hero-poster.jpg"')
    expect(standbild).toBeGreaterThanOrEqual(0)
    expect(standbild).toBeLessThan(kopf.indexOf('<video'))
  })

  it('genau eine Überschrift erster Ordnung', () => {
    expect(kopf.match(/<h1\b/g)).toHaveLength(1)
    expect(kopf).toContain('am Hof abholen.')
  })

  it('die Suche geht als q nach /hoefe — der Parameter, den /hoefe versteht', () => {
    const formular = kopf.match(/<form [^>]*>/)?.[0] ?? ''
    expect(formular).toContain('role="search"')
    expect(formular).toContain('action="/hoefe"')
    expect(formular).toContain('method="get"')
    expect(kopf).toMatch(/<input type="search"[^>]*name="q"/)
    expect(gelesen('/hoefe?q=Eier').suchtext).toBe('Eier')
  })

  it('die Karte führt zur Kartenansicht; der Hof davor nur, wenn es einen gibt', () => {
    expect(kopf).toContain(`href="${KARTE_ADRESSE}"`)
    const mitHof = html(
      createElement(StartseiteKopf, {
        kartenHof: createElement(KartenHof, { hof: waehleStartseitenHoefe([hof({ slug: 'erster' })])[0] }),
      })
    )
    expect(mitHof).toContain('href="/erster"')
    expect(html(createElement(KartenHof, { hof: null }))).toBe('')
  })
})

describe('Höfe in deiner Nähe — gefüllt, leer, laden, Fehler', () => {
  const LANGER_NAME = 'Hof '.padEnd(80, 'x')
  const abschnitt = (karten: ReactElement) => html(createElement(HoefeInDerNaehe, null, karten))

  it('gefüllt: jede Karte ist ein Link auf die Hofseite, der volle Name im title', () => {
    const hoefe = waehleStartseitenHoefe([hof({ slug: 'kurz', name: 'Hof Kurz' }), hof({ slug: 'lang', name: LANGER_NAME })])
    const text = abschnitt(createElement(HofKarten, { hoefe }))
    expect(text).toMatch(/<a href="\/kurz" title="Hof Kurz"/)
    expect(text).toContain(`title="${LANGER_NAME}"`)
    expect(text).toContain('line-clamp-2')
  })

  it('die Chips stehen in jedem Zustand darunter', () => {
    const text = abschnitt(createElement(HofKartenSkelett))
    for (const chip of STARTSEITE_CHIPS) expect(text).toContain(`href="${hoefeAdresse(chip.filter).replace(/&/g, '&amp;')}"`)
  })

  it('leer: kein nacktes „nichts gefunden" — ein Satz und ein Ausweg', () => {
    const text = abschnitt(createElement(HofKarten, { hoefe: [] }))
    expect(text).toContain('Die ersten Höfe kommen gerade dazu')
    expect(text).toContain('href="/register"')
    // Gegenprobe: Mit Höfen gibt es den Leerzustand nicht.
    expect(abschnitt(createElement(HofKarten, { hoefe: waehleStartseitenHoefe([hof({ slug: 'a' })]) }))).not.toContain(
      'Die ersten Höfe kommen gerade dazu'
    )
  })

  it('laden: ein Skelett mit aria-busy in der Form der Karten', () => {
    expect(html(createElement(HofKartenSkelett))).toContain('aria-busy="true"')
  })

  it('Fehler: inline mit Weg zur Übersicht, ohne Technik', () => {
    const text = html(createElement(HofKartenFehler))
    expect(text).toContain('Wir konnten die Höfe gerade nicht laden.')
    expect(text).toContain('href="/hoefe"')
    expect(text).not.toMatch(/Error|Prisma|500/)
  })
})

describe('Sprungmarken für die Navigation der KundeShell', () => {
  const web = kundenNavigation({ angemeldet: false }).web.map((p) => p.href)

  it('„So funktioniert’s" zeigt auf #so-funktionierts — und der Abschnitt trägt die Marke', () => {
    expect(web).toContain('/#so-funktionierts')
    expect(html(createElement(SoFunktionierts, { rechnung: beispielRechnung(JETZT) }))).toMatch(/<section id="so-funktionierts"/)
  })

  it('„Für Höfe" zeigt auf #fuer-hoefe — und das Band trägt die Marke', () => {
    expect(web).toContain('/#fuer-hoefe')
    expect(html(createElement(FuerHoefeBand))).toMatch(/<section id="fuer-hoefe"/)
  })
})

describe('Abschnitte', () => {
  it('So funktioniert’s + Warum: ein Abschnitt, Beispiel mit den gerechneten Beträgen', () => {
    const text = html(createElement(SoFunktionierts, { rechnung: beispielRechnung(JETZT) }))
    expect(text.match(/<section\b/g)).toHaveLength(1)
    expect(text).toContain('In drei Schritten zum Hofkorb')
    expect(text).toContain('Du weißt, woher es kommt')
    for (const betrag of ['€ 20,00', '€ 1,00', '€ 21,00', '€ 0,50']) expect(text).toContain(betrag)
  })

  it('Futter: zwei Zielgruppen mit ihren Wegen auf /hoefe', () => {
    const text = html(createElement(FutterAbschnitt))
    expect(text).toContain('Für Hase &amp; Meerschwein')
    expect(text).toContain('Für Pferd, Rind &amp; Schaf')
    for (const gruppe of FUTTER_ZIELGRUPPEN) expect(text).toContain(`href="${hoefeAdresse(gruppe.filter).replace(/&/g, '&amp;')}"`)
  })

  it('Brennmaterial: Saison-Marke, erklärte Raummeter, Weg auf /hoefe', () => {
    const text = html(createElement(BrennmaterialBand))
    expect(text).toContain('Saison Oktober bis März')
    expect(text).toContain('Raummeter (ein Kubikmeter geschichtetes Holz)')
    expect(text).toContain('Schüttraummeter (ein Kubikmeter lose geschüttet)')
    expect(text).toContain(`href="${BRENNMATERIAL_ADRESSE}"`)
  })

  it('keine erfundenen Preise: Futter, Brennmaterial und „Für Höfe" nennen keinen Betrag (E6)', () => {
    for (const element of [createElement(FutterAbschnitt), createElement(BrennmaterialBand), createElement(FuerHoefeBand)]) {
      expect(html(element)).not.toMatch(/€/)
    }
    // Gegenprobe: Wo ein Betrag steht, findet die Suche ihn.
    expect(html(createElement(SoFunktionierts, { rechnung: beispielRechnung(JETZT) }))).toMatch(/€/)
  })

  it('„So funktioniert’s": Bestellnummer statt eines Abholcodes, den es nicht gibt', () => {
    const text = html(createElement(SoFunktionierts, { rechnung: beispielRechnung(JETZT) }))
    expect(text).toContain('Bestellnummer zeigen')
    expect(text).not.toMatch(/Abholcode/)
  })

  it('Für Höfe: keine unbelegte Zeitangabe', () => {
    const text = html(createElement(FuerHoefeBand))
    expect(text).not.toMatch(/zehn Minuten|Minuten/)
    expect(text).toContain('Schnell eingerichtet')
  })

  it('Für Höfe: registrieren in Orange, „Mehr für Höfe" zu den Konditionen', () => {
    const text = html(createElement(FuerHoefeBand))
    expect(text).toMatch(/<a href="\/register"[^>]*bg-primary/)
    expect(text).toContain('href="/konditionen"')
  })

  it('Fragen: alle Antworten im HTML, auch zugeklappt — die erste offen', () => {
    const text = html(createElement(Fragen))
    for (const { frage, antwort } of STARTSEITE_FRAGEN) {
      expect(text).toContain(frage)
      expect(text).toContain(antwort.replace(/&/g, '&amp;'))
    }
  })

  it('Fragen ohne Skript: <details name="fragen">, nur die erste offen, Fokus sichtbar', () => {
    const text = html(createElement(Fragen))
    const details = text.match(/<details\b[^>]*>/g) ?? []
    expect(details).toHaveLength(STARTSEITE_FRAGEN.length)
    for (const tag of details) expect(tag).toContain('name="fragen"')
    expect(details[0]).toMatch(/\bopen=""/)
    for (const tag of details.slice(1)) expect(tag).not.toMatch(/\bopen\b/)
    expect(text.match(/<summary\b[^>]*focus-visible:outline-solid/g)).toHaveLength(STARTSEITE_FRAGEN.length)
    expect(text).not.toMatch(/data-slot="accordion"/)
    expect(quelle('src/components/startseite/startseite-abschnitte.tsx')).not.toMatch(/@\/components\/ui\/accordion/)
  })

  it('die Servicegebühr in Euro, nicht in Cent', () => {
    const zahlung = STARTSEITE_FRAGEN.find((f) => f.frage === 'Wie bezahle ich?')
    expect(zahlung?.antwort).toContain('mindestens € 0,50')
    expect(zahlung?.antwort).not.toMatch(/Cent/)
  })

  it('keine Konto-Zusage (E8): Bestellen ohne Konto', () => {
    const konto = STARTSEITE_FRAGEN.find((f) => f.frage === 'Brauche ich ein Konto?')
    expect(konto?.antwort).toMatch(/^Nein\./)
    expect(konto?.antwort).toMatch(/ohne Konto/)
    expect(konto?.antwort).not.toMatch(/legen dir ein Konto/)
  })

  it('der Fuß: Weg der Höfe zur Anmeldung, Registrieren, Rechtliches', () => {
    const text = html(createElement(StartseiteFuss, { jahr: 2026 }))
    for (const href of ['/login', '/register', '/konditionen', '/impressum', '/datenschutz', '/#so-funktionierts']) {
      expect(text).toContain(`href="${href}"`)
    }
    expect(text).toContain('© 2026 FarmerZone')
  })
})

describe('Themes: Farben nur über Tokens', () => {
  const alles = [
    html(createElement(StartseiteKopf, {})),
    html(createElement(HoefeInDerNaehe, null, createElement(HofKarten, { hoefe: waehleStartseitenHoefe([hof({ slug: 'a' })]) }))),
    html(createElement(FutterAbschnitt)),
    html(createElement(BrennmaterialBand)),
    html(createElement(SoFunktionierts, { rechnung: beispielRechnung(JETZT) })),
    html(createElement(FuerHoefeBand)),
    html(createElement(Fragen)),
    html(createElement(StartseiteFuss, { jahr: 2026 })),
  ]

  it('kein Farbwert im HTML — dasselbe Markup gilt hell und dunkel', () => {
    // Ausgenommen die Bildmarke im Fuß: Ein Logo behält seine Farben in beiden
    // Modi (wortmarke.tsx, CODING_STANDARDS §7 „Was dem Modus NICHT folgt").
    for (const text of alles.map((t) => t.replace(/<svg[\s\S]*?<\/svg>/g, ''))) {
      expect(text).not.toMatch(/#[0-9a-f]{3,8}\b/i)
      expect(text).not.toMatch(/\b(rgba?|hsla?|oklch)\(/)
    }
  })

  it('Gegenprobe: die Token-Klassen stehen im HTML', () => {
    const zusammen = alles.join('')
    for (const token of ['to-background', 'bg-card', 'border-border', 'text-muted-foreground', 'bg-accent', 'bg-primary', 'text-status-fertig']) {
      expect(zusammen, token).toContain(token)
    }
  })
})

describe('Aufbau der Seite', () => {
  const seite = quelle('src/app/page.tsx')

  it('in der KundeShell (Sitzung aus dem Browser), ohne die alte LandingNav', () => {
    expect(seite).toMatch(/<KundeShellMitSitzung>/)
    expect(seite).not.toMatch(/LandingNav|KundenKopf/)
  })

  it('statisch vom CDN: weder headers() noch cookies() noch auth.api, alle fünf Minuten neu (ISR)', () => {
    // Liest die Seite die Anfrage, wird sie dynamisch: Jeder Besuch startet
    // dann eine Serverless-Funktion, und Kopf und LCP-Standbild warten darauf.
    // Nur der Code zählt — die Kommentare der Seite erklären genau diese Regel.
    const code = seite.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/\bheaders\(\)|\bcookies\(\)|auth\.api\b|next\/headers|from '@\/lib\/auth'/)
    expect(revalidate).toBe(300)
    expect(seite).toMatch(/^export const revalidate = 300$/m)
    // Gegenprobe: Dieselbe Suche findet alle drei auf einer Seite, die die
    // Sitzung auf dem Server liest.
    const dynamisch = quelle('src/app/account/profile/page.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(dynamisch).toMatch(/\bheaders\(\)/)
    expect(dynamisch).toMatch(/auth\.api\b/)
  })

  it('die Höfe hinter Suspense mit Skelett — Kopf und Suche warten nicht auf die Datenbank', () => {
    expect(seite).toMatch(/<Suspense fallback=\{<HofKartenSkelett \/>\}>\s*<HofKartenGeladen \/>/)
  })

  it('das Brennmaterial-Band nur in der Saison', () => {
    expect(seite).toMatch(/\{istBrennmaterialSaison\(jetzt\) && <BrennmaterialBand \/>\}/)
    expect(seite.match(/<BrennmaterialBand/g)).toHaveLength(1)
  })

  it('die Reihenfolge des Mockups', () => {
    const reihe = [
      '<StartseiteKopf',
      '<HoefeInDerNaehe',
      '<FutterAbschnitt',
      '<BrennmaterialBand',
      '<SoFunktionierts',
      '<FuerHoefeBand',
      '<Fragen',
      '<StartseiteFuss',
    ].map((m) => seite.indexOf(m))
    expect(reihe.every((stelle) => stelle > 0)).toBe(true)
    expect([...reihe].sort((a, b) => a - b)).toEqual(reihe)
  })
})
