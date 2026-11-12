/**
 * Kaufknopf ohne Betrag (§ 8 Abs. 2 FAGG, Recht R-Boards k5 Frage 2 und R2 Teil 4a, Nr. 309).
 *
 * Ursache: Die verbindlichen Knöpfe der Kasse trugen den Betrag („Zahlungspflichtig bestellen · € …“,
 * „Jetzt bezahlen · € …“, „Erneut bezahlen · € …“). § 8 Abs. 2 FAGG verlangt einen Knopf, der „nur“ sein
 * Wort trägt; ein Verstoß bindet die Kundin nicht an die Bestellung. Im Zahlungsschritt stand der
 * Gesamtpreis nicht in der Zusammenfassung, und bei Privat lag die Gewährleistungs-Mitteilung zwischen
 * Zusammenfassung und Knopf (gegen die Ergänzung zu N2 aus F027).
 *
 * Beweist (echte Komponenten, serverseitig gerendert):
 *  - `gesamtAnzeige` gibt für Hofpreis-Modell, Modell „bisher“ mit Gebühr und ohne Gebühr genau das
 *    Ergebnis der alten Rechnung im Formular (Vorher-nachher, drei Fälle).
 *  - Formular bar: Der Text des Absende-Knopfs ist genau „Zahlungspflichtig bestellen“ (kein „€“);
 *    „Gesamt“ und der Betrag stehen in der Zusammenfassung davor. Online bleibt „Weiter zur Zahlung · € …“.
 *  - Zahlungsschritt und „Zahlung fortsetzen“: Knopf genau „Jetzt bezahlen“ ohne „€“; die Zusammenfassung
 *    zwischen Übersicht und Knopf zeigt „Gesamt“ mit demselben Betrag wie die Übersicht, den Zusatz je Modell.
 *  - Reihenfolge (Privat; Formular bar, Formular online, Zahlungsschritt): Mitteilung → Zusammenfassung →
 *    Knopf; zwischen dem Ende der Zusammenfassung und dem Knopf nur die Hülle der Leiste (`data-unten-fest`).
 *  - Quelltext-Wache: In checkout-form.tsx und stripe-payment.tsx verbindet kein Vorlagentext ein Wort
 *    der verbindlichen Knöpfe mit einem Platzhalter; „Weiter zur Zahlung“ ist ausgenommen.
 *    Gegenprobe im Speicher mit dem alten Text.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

// Kein Mock auf Stripes Paket (tests/paket-mock-wache.test.ts): Ohne Stripe.js (stripe = null) rendert die
// echte Hülle ihr Zahlungsfeld leer, der Knopf ist aus — Übersicht, Zusammenfassung und Knopf stehen trotzdem.
vi.mock('@/lib/stripe-client', () => ({ getStripePromise: () => null }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => '/hof-test/checkout' }))
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))

import { KaufZusammenfassung } from '@/components/checkout/kauf-zusammenfassung'
import { StripeZahlung } from '@/components/checkout/stripe-payment'
import { KassenAbschluss, KaufknopfSaetze, ZahlungFortsetzen, type Zahlung } from '@/components/checkout/checkout-form'
import { UebersichtKarte } from '@/components/checkout/kasse-teile'
import type { AngabenHof } from '@/components/checkout/angaben-zum-hof'
import { gesamtAnzeige, reservierungsStand } from '@/lib/kasse'
import { INKL_PLATTFORMGEBUEHR } from '@/lib/konditionen'
import { formatEuro } from '@/lib/format'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { GEWAEHRLEISTUNG_MITTEILUNG as G } from '@/lib/rechtstexte/gewaehrleistung-mitteilung'
import { publicFarm } from './fabrik/public-farm'

const WURZEL = join(__dirname, '..')
const lies = (datei: string): string => readFileSync(join(WURZEL, datei), 'utf8')

const JETZT = new Date('2026-10-05T08:00:00.000Z')
const BIS = new Date(JETZT.getTime() + 30 * 60_000).toISOString()
const ABHOLUNG = 'Sa, 10. Okt, 09:00–12:00 Uhr'
const HOFNAME = 'Hof Beispiel'
const POSITIONEN = [{ productId: 'p1', name: 'Ware 1', quantity: 1, unit: 'STUECK', unitSize: null }]

/** Die Wörter der verbindlichen Knöpfe (Register N2/O4, Nr. 215). */
const VERBINDLICH = ['Zahlungspflichtig bestellen', 'Jetzt bezahlen', 'Erneut bezahlen'] as const

// ── gesamtAnzeige: Vorher-nachher ───────────────────────────────────────────

type Fall = { gesamtCents: number; gebuehrCents: number; hofpreis: boolean; gebuehrTitel: string }

/** Die Rechnung, die bis Nr. 309 im Formular stand (checkout-form.tsx, `gesamt` und `gesamtZusatz`), wörtlich. */
function alteRechnung(k: Fall): { betrag: string; zusatz: string | null } {
  const gesamt = formatEuro(centsAlsEuro(k.gesamtCents))
  const gesamtZusatz = k.hofpreis
    ? INKL_PLATTFORMGEBUEHR
    : k.gebuehrCents > 0
      ? `inkl. ${k.gebuehrTitel} ${formatEuro(centsAlsEuro(k.gebuehrCents))}`
      : null
  return { betrag: gesamt, zusatz: gesamtZusatz }
}

describe('gesamtAnzeige: dasselbe Ergebnis wie die alte Rechnung im Formular', () => {
  const FAELLE: { name: string; fall: Fall; erwartet: { betrag: string; zusatz: string | null } }[] = [
    {
      name: 'Hofpreis-Modell: „inkl. Plattformgebühr“, auch mit Gebühr im Betrag',
      fall: { gesamtCents: 1082, gebuehrCents: 52, hofpreis: true, gebuehrTitel: 'Plattformgebühr' },
      erwartet: { betrag: formatEuro(10.82), zusatz: 'inkl. Plattformgebühr' },
    },
    {
      name: 'Modell „bisher“ mit Gebühr: „inkl. <Titel> € …“',
      fall: { gesamtCents: 1082, gebuehrCents: 52, hofpreis: false, gebuehrTitel: 'Servicegebühr (5 %)' },
      erwartet: { betrag: formatEuro(10.82), zusatz: `inkl. Servicegebühr (5 %) ${formatEuro(0.52)}` },
    },
    {
      name: 'ohne Gebühr (bar vor dem Stichtag): kein Zusatz',
      fall: { gesamtCents: 980, gebuehrCents: 0, hofpreis: false, gebuehrTitel: 'Servicegebühr' },
      erwartet: { betrag: formatEuro(9.8), zusatz: null },
    },
  ]

  for (const { name, fall, erwartet } of FAELLE) {
    it(name, () => {
      expect(gesamtAnzeige(fall)).toEqual(alteRechnung(fall))
      expect(gesamtAnzeige(fall)).toEqual(erwartet)
    })
  }
})

// ── Gerenderte Kasse ────────────────────────────────────────────────────────

/** Der eine Knopf mit genau diesem Wort — ohne Betrag dahinter. */
const knopf = (wort: string): string => `>${wort}</button>`

/** Der Abschnitt „Deine Bestellung“ (er enthält keinen weiteren Abschnitt; sein Ende ist das erste </section>). */
function zusammenfassungIn(html: string): { start: number; ende: number; text: string } {
  const start = html.lastIndexOf('<section', html.indexOf('data-kauf-zusammenfassung'))
  const ende = html.indexOf('</section>', start) + '</section>'.length
  return { start, ende, text: html.slice(start, ende) }
}

/** Kein „€“ in einem Knopf: der Text aller <button> im Markup. */
const knopfTexte = (html: string): string[] => [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((t) => t[1] ?? '')

/** Mitteilung → Zusammenfassung → Knopf; dazwischen nur die Hülle der festen Leiste. */
function reihenfolge(html: string, wort: string): void {
  const mitteilung = html.indexOf('data-gewaehrleistung')
  const z = zusammenfassungIn(html)
  const k = html.indexOf(knopf(wort))
  expect(mitteilung).toBeGreaterThan(-1)
  expect(mitteilung).toBeLessThan(z.start)
  expect(z.ende).toBeLessThan(k)
  // Bis zum Knopf: genau ein Element, die Hülle der AktionsLeiste — kein Text, keine Karte, keine Mitteilung.
  const dazwischen = html.slice(z.ende, html.lastIndexOf('<button', k))
  const tags = dazwischen.match(/<[a-z][^>]*>/g) ?? []
  expect(tags).toHaveLength(1)
  expect(tags[0]).toContain('data-unten-fest')
  expect(dazwischen.replace(/<[^>]*>/g, '').trim()).toBe('')
}

describe('Formular (KassenAbschluss): bar ohne Betrag am Knopf, Gesamt in der Zusammenfassung', () => {
  const HOF: AngabenHof = { name: HOFNAME, ownerName: 'Erika Muster', address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf', phone: '+43 660 0000000', email: 'hof@example.com' }
  const GESAMT = gesamtAnzeige({ gesamtCents: 1082, gebuehrCents: 52, hofpreis: false, gebuehrTitel: 'Servicegebühr (5 %)' })
  const abschluss = (online: boolean, privat = true): string =>
    renderToStaticMarkup(
      createElement(KassenAbschluss, {
        hof: HOF,
        uebersicht: createElement(UebersichtKarte, { betraege: { warenCents: 1030, gebuehrCents: 52, gesamtCents: 1082 }, gebuehrText: 'Servicegebühr (5 %)' }),
        online,
        wirdGesendet: false,
        gesperrt: false,
        gesamt: GESAMT.betrag,
        fussnote: '',
        privat,
        zusammenfassung: createElement(KaufZusammenfassung, { karte: true, positionen: POSITIONEN, abholung: ABHOLUNG, hofName: HOFNAME, gesamt: GESAMT }),
      })
    )

  it('bar: der Absende-Knopf heißt genau „Zahlungspflichtig bestellen“, ohne „€“', () => {
    const html = abschluss(false)
    const submit = html.match(/<button type="submit"[^>]*>([\s\S]*?)<\/button>/)
    expect(submit?.[1]).toBe('Zahlungspflichtig bestellen')
    expect(knopfTexte(html).join(' ')).not.toContain('€')
  })

  it('bar: „Gesamt“, Betrag und Zusatz stehen in der Zusammenfassung vor dem Knopf', () => {
    const html = abschluss(false)
    const z = zusammenfassungIn(html)
    expect(z.text).toContain('Gesamt')
    expect(z.text).toContain(GESAMT.betrag)
    expect(z.text).toContain(`inkl. Servicegebühr (5 %) ${formatEuro(0.52)}`)
    expect(z.ende).toBeLessThan(html.indexOf(knopf('Zahlungspflichtig bestellen')))
  })

  it('online: „Weiter zur Zahlung · € …“ bleibt, wie es ist', () => {
    const html = abschluss(true)
    expect(html).toContain(knopf(`Weiter zur Zahlung · ${GESAMT.betrag}`))
    for (const wort of VERBINDLICH) expect(html).not.toContain(knopf(wort))
  })

  it('bar, Privat: Mitteilung → Zusammenfassung → Knopf', () => {
    reihenfolge(abschluss(false), 'Zahlungspflichtig bestellen')
  })

  it('online, Privat: Mitteilung → Zusammenfassung → Knopf', () => {
    reihenfolge(abschluss(true), `Weiter zur Zahlung · ${GESAMT.betrag}`)
  })

  it('Betrieb: keine Mitteilung, die Zusammenfassung steht weiter direkt über dem Knopf', () => {
    const html = abschluss(false, false)
    expect(html).not.toContain('data-gewaehrleistung')
    expect(zusammenfassungIn(html).ende).toBeLessThan(html.indexOf(knopf('Zahlungspflichtig bestellen')))
  })
})

describe('Zahlungsschritt: „Jetzt bezahlen“ ohne Betrag, Gesamt in der Zusammenfassung', () => {
  const schritt = (k: { hofpreis: boolean; betrag: { amountCents: number; serviceFeeCents: number }; gebuehrText: string; privat?: boolean }): string =>
    renderToStaticMarkup(
      createElement(StripeZahlung, {
        clientSecret: 'pi_test_secret',
        bestaetigung: '/hof-test/confirm/o1?sig=abc',
        farmSlug: 'hof-test',
        reserviertBis: BIS,
        stand: reservierungsStand(BIS, JETZT),
        betrag: k.betrag,
        gebuehrText: k.gebuehrText,
        hofpreis: k.hofpreis,
        korb: null,
        angaben: null,
        zusammenfassung: (gesamt: { betrag: string; zusatz: string | null }) =>
          createElement(KaufZusammenfassung, { positionen: POSITIONEN, abholung: ABHOLUNG, hofName: HOFNAME, gesamt }),
        privat: k.privat ?? true,
        kaufknopfSaetze: createElement(KaufknopfSaetze, { privat: k.privat ?? true, hofpreis: k.hofpreis, agbPfad: '/agb' }),
      })
    )
  const BISHER = { hofpreis: false, betrag: { amountCents: 1082, serviceFeeCents: 52 }, gebuehrText: 'Servicegebühr (5 %)' }
  const HOFPREIS = { hofpreis: true, betrag: { amountCents: 1082, serviceFeeCents: 52 }, gebuehrText: 'Plattformgebühr' }

  it('der Knopf heißt genau „Jetzt bezahlen“, ohne „€“', () => {
    const html = schritt(BISHER)
    expect(html).toContain(knopf('Jetzt bezahlen'))
    expect(knopfTexte(html).join(' ')).not.toContain('€')
  })

  it('Modell „bisher“: „Gesamt“ mit dem Betrag der Übersicht und „inkl. <Titel> € …“ in der Zusammenfassung', () => {
    const html = schritt(BISHER)
    const z = zusammenfassungIn(html)
    // Die Übersicht steht vor der Zusammenfassung und nennt denselben Betrag.
    expect(html.slice(0, z.start)).toContain(formatEuro(10.82))
    expect(z.text).toContain('Gesamt')
    expect(z.text).toContain(formatEuro(10.82))
    expect(z.text).toContain(`inkl. Servicegebühr (5 %) ${formatEuro(0.52)}`)
    expect(z.ende).toBeLessThan(html.indexOf(knopf('Jetzt bezahlen')))
  })

  it('Hofpreis-Modell: Zusatz „inkl. Plattformgebühr“', () => {
    const z = zusammenfassungIn(schritt(HOFPREIS))
    expect(z.text).toContain(formatEuro(10.82))
    expect(z.text).toContain('inkl. Plattformgebühr')
  })

  it('Privat: Mitteilung → Zusammenfassung → Knopf', () => {
    reihenfolge(schritt(BISHER), 'Jetzt bezahlen')
  })

  it('Betrieb: keine Mitteilung; Gesamt bleibt in der Zusammenfassung', () => {
    const html = schritt({ ...BISHER, privat: false })
    expect(html).not.toContain('data-gewaehrleistung')
    expect(html).not.toContain(G.ueberschrift)
    expect(zusammenfassungIn(html).text).toContain('Gesamt')
  })
})

describe('Zahlung fortsetzen: derselbe Knopf ohne Betrag, Gesamt aus dem Betrag der Bestellung', () => {
  const zahlung: Zahlung = {
    clientSecret: 'pi_test_secret',
    bestaetigung: '/hof-test/confirm/o1?sig=abc',
    reserviertBis: BIS,
    betrag: { amountCents: 530, serviceFeeCents: 30 },
    gebuehrText: 'Plattformgebühr',
    abholung: ABHOLUNG,
    name: '',
    email: 'kundin@example.com',
  }
  const fortsetzen = (privat: boolean): string =>
    renderToStaticMarkup(
      createElement(ZahlungFortsetzen, {
        farm: publicFarm({ name: HOFNAME }),
        zahlung,
        positionen: POSITIONEN.map((p) => ({ ...p, price: 5 })),
        zeilenCents: { p1: 500 },
        anzeige: { hundertstel: 600 },
        jetztIso: JETZT.toISOString(),
        privat,
        agbFassung: '1.0',
      })
    )

  it('Knopf genau „Jetzt bezahlen“; Gesamt € 5,30 mit „inkl. Plattformgebühr“ in der Zusammenfassung davor', () => {
    const html = fortsetzen(true)
    expect(knopfTexte(html).join(' ')).not.toContain('€')
    const z = zusammenfassungIn(html)
    expect(z.text).toContain('Gesamt')
    expect(z.text).toContain(formatEuro(5.3))
    expect(z.text).toContain('inkl. Plattformgebühr')
    reihenfolge(html, 'Jetzt bezahlen')
  })

  it('Betrieb: ohne Mitteilung, Knopf weiter ohne Betrag', () => {
    const html = fortsetzen(false)
    expect(html).not.toContain('data-gewaehrleistung')
    expect(html).toContain(knopf('Jetzt bezahlen'))
  })
})

// ── Quelltext-Wache ─────────────────────────────────────────────────────────

const DATEIEN = ['src/components/checkout/checkout-form.tsx', 'src/components/checkout/stripe-payment.tsx']

/**
 * Vorlagentexte mit Platzhalter, die ein Wort der verbindlichen Knöpfe tragen — in ihrem festen Text oder in
 * einem Text innerhalb eines Platzhalters (`${abgelehnt ? 'Erneut bezahlen' : …} · ${gesamt}`). Dasselbe für
 * eine Verkettung mit `+`. „Weiter zur Zahlung“ schließt nichts ab (AGB 9.4) und ist kein Wort der Liste.
 */
function knopfMitPlatzhalter(datei: string, quelltext: string): string[] {
  const quelle = ts.createSourceFile(datei, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const funde: string[] = []
  const texteIn = (knoten: ts.Node): string[] => {
    const texte: string[] = []
    const sammle = (k: ts.Node): void => {
      if (ts.isStringLiteral(k) || ts.isNoSubstitutionTemplateLiteral(k)) texte.push(k.text)
      else if (ts.isTemplateHead(k) || ts.isTemplateMiddle(k) || ts.isTemplateTail(k)) texte.push(k.text)
      ts.forEachChild(k, sammle)
    }
    sammle(knoten)
    return texte
  }
  const besuche = (k: ts.Node): void => {
    const verbunden =
      ts.isTemplateExpression(k) ||
      (ts.isBinaryExpression(k) && k.operatorToken.kind === ts.SyntaxKind.PlusToken && !(ts.isBinaryExpression(k.parent) && k.parent.operatorToken.kind === ts.SyntaxKind.PlusToken))
    if (verbunden && texteIn(k).some((t) => VERBINDLICH.some((w) => t.includes(w)))) {
      funde.push(`${datei}:${quelle.getLineAndCharacterOfPosition(k.getStart()).line + 1}: ${k.getText()}`)
      return
    }
    ts.forEachChild(k, besuche)
  }
  besuche(quelle)
  return funde
}

describe('Quelltext-Wache: kein verbindlicher Knopf mit Platzhalter', () => {
  it('checkout-form.tsx und stripe-payment.tsx bauen „Zahlungspflichtig bestellen“, „Jetzt bezahlen“ und „Erneut bezahlen“ ohne Platzhalter', () => {
    expect(DATEIEN.flatMap((d) => knopfMitPlatzhalter(d, lies(d)))).toEqual([])
  })

  it('„Weiter zur Zahlung · ${gesamt}“ ist ausgenommen und steht weiter im Formular', () => {
    const quelle = lies('src/components/checkout/checkout-form.tsx')
    expect(quelle).toContain('`Weiter zur Zahlung · ${gesamt}`')
    expect(knopfMitPlatzhalter('x.tsx', 'const k = `Weiter zur Zahlung · ${gesamt}`')).toEqual([])
  })

  it('Gegenprobe: die alten Knopftexte fallen auf — Vorlage, Platzhalter mit Bedingung und Verkettung', () => {
    expect(knopfMitPlatzhalter('x.tsx', 'const k = `Zahlungspflichtig bestellen · ${gesamt}`')).toHaveLength(1)
    expect(knopfMitPlatzhalter('x.tsx', "const k = `${abgelehnt ? 'Erneut bezahlen' : 'Jetzt bezahlen'} · ${gesamt}`")).toHaveLength(1)
    expect(knopfMitPlatzhalter('x.tsx', "const k = 'Jetzt bezahlen · ' + gesamt")).toHaveLength(1)
    // Das Wort allein (ohne Platzhalter) bleibt erlaubt.
    expect(knopfMitPlatzhalter('x.tsx', "const k = abgelehnt ? 'Erneut bezahlen' : 'Jetzt bezahlen'")).toEqual([])
  })
})
