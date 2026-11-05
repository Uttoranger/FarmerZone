/**
 * AGB- und Rücktrittssatz unter jedem Knopf, mit dem eine Bestellung verbindlich wird; der Abholtermin im
 * Bar-Formular nur einmal (Register N2/O4, Ergänzung 1.11.2026, Nr. 215).
 *
 * Beweist (echte Komponenten, serverseitig gerendert; die Reihenfolge im HTML ist die Reihenfolge im DOM):
 *  - Zahlungsschritt („Jetzt bezahlen“, „Erneut bezahlen“, „Zahlung fortsetzen“): AGB-Satz und
 *    Rücktrittssatz stehen je genau einmal NACH dem Knopf, in der festen Leiste; bei „Betrieb“ nur der
 *    AGB-Satz. Gegenprobe: ohne die Sätze findet die Suche nichts.
 *  - Beide Aufrufe des Zahlungsschritts im Formular reichen dieselbe Quelle (`KaufknopfSaetze`), die auch
 *    `KassenAbschluss` nutzt.
 *  - Bar-Formular mit gewähltem Termin: der Termin genau einmal (in „Deine Bestellung“), keine Zeile
 *    „Abholung …“ unter dem Knopf; ohne Termin bleibt die Bitte zu wählen; ein Mindestbestellwert bleibt
 *    stehen. Online-Formular unverändert (Termin oben und in der Zeile unter dem Knopf, Register N10).
 *  - Die Reservierungsfrist steht in der Übersicht, nicht in der Zeile unter dem Knopf — sie bleibt, wenn
 *    die Zeile entfällt.
 *
 * Prüfstand (TESTING_GUIDELINES §1): `useEffect` läuft im ganzen Formular je Quelltext einmal sofort (die Kasse
 * liest den Korb im Effekt), sonst nie; `useState` reicht durch — nur für „Erneut bezahlen“ setzt er den zweiten Zustand des
 * Zahlungsschritts (`abgelehnt`) auf wahr; dass es der richtige ist, zeigt die Karte „abgelehnt“ daneben.
 * `useForm` behält das echte react-hook-form und bekommt nur eine Vorbelegung (Termin, Zahlart).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const pruefstand = vi.hoisted(() => ({
  gelaufen: new Set<string>(),
  effekte: false,
  abgelehnt: false,
  zahlungsZustaende: 0,
  vorbelegung: {} as Record<string, string>,
}))

vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  // Nur im ganzen Formular laufen Effekte (dort liest die Kasse den Korb); der Zahlungsschritt braucht keine.
  function useEffect(effekt: () => void | (() => void)): void {
    if (!pruefstand.effekte) return
    const quelltext = effekt.toString()
    if (pruefstand.gelaufen.has(quelltext)) return
    pruefstand.gelaufen.add(quelltext)
    effekt()
  }
  function useState<S>(start: S | (() => S)): [S, (wert: S | ((alt: S) => S)) => void] {
    const paar = echt.useState(start)
    // Wer ruft: die Zeile unter dieser Funktion im Stapel. Nur im Zahlungsschritt (`ZahlungsInhalt`) zählen.
    const aufrufer = new Error().stack?.split('\n')[2] ?? ''
    if (aufrufer.includes('ZahlungsInhalt')) {
      const nummer = pruefstand.zahlungsZustaende++
      if (pruefstand.abgelehnt && nummer === 1) return [true as S, paar[1]]
    }
    return paar
  }
  return { ...echt, useEffect, useState, default: { ...echt, useEffect, useState } }
})
vi.mock('react-hook-form', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react-hook-form')>()
  return {
    ...echt,
    useForm: (optionen: Parameters<typeof echt.useForm>[0]) =>
      echt.useForm({ ...optionen, defaultValues: { ...(optionen?.defaultValues as object), ...pruefstand.vorbelegung } }),
  }
})
// Kein Mock auf Stripes Paket (tests/paket-mock-wache.test.ts): Ohne Stripe.js rendert die echte Hülle ihr Feld leer.
vi.mock('@/lib/stripe-client', () => ({ getStripePromise: () => null }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => '/hof-test/checkout',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))

import { CheckoutForm, KassenAbschluss, KaufknopfSaetze, ZahlungFortsetzen, type Zahlung } from '@/components/checkout/checkout-form'
import { StripeZahlung } from '@/components/checkout/stripe-payment'
import { KaufZusammenfassung } from '@/components/checkout/kauf-zusammenfassung'
import { ReservierungsHinweis, UebersichtKarte } from '@/components/checkout/kasse-teile'
import { abholKacheln, abholSatz, reservierungsStand, zahlungAbgelehntText, ZAHLWEG_ONLINE } from '@/lib/kasse'
import { MINDESTBESTELLWERT_SATZ } from '@/lib/konditionen'
import { mindestbestellwertHinweis } from '@/lib/plattformgebuehr'
import { SITZUNG_SCHLUESSEL, WARENKORB_SCHLUESSEL } from '@/lib/warenkorb-speicher'
import type { PublicFarm } from '@/server/queries/farm'
import { publicFarm } from './fabrik/public-farm'

const lies = (datei: string): string => readFileSync(join(__dirname, '..', datei), 'utf8')

// Montag, 5. Oktober 2026, 10:00 Uhr in Wien.
const JETZT = new Date('2026-10-05T08:00:00.000Z')
const BIS = new Date(JETZT.getTime() + 30 * 60_000).toISOString()
const HOFNAME = 'Hof Beispiel'
const ABHOLUNG = 'Sa, 10. Okt, 09:00–12:00 Uhr'
const POSITIONEN = [{ productId: 'p1', name: 'Ware 1', quantity: 1, unit: 'STUECK', unitSize: null }]

/** Merkmale der zwei Sätze im HTML: der Anfang des AGB-Satzes und der Link des Rücktrittssatzes. */
const AGB = 'Es gelten die'
const RUECKTRITT = 'Du kannst vom Kauf innerhalb von 14 Tagen'

/** Wie oft ein Text im Markup steht. */
const anzahl = (html: string, text: string): number => html.split(text).length - 1

/** Beide Sätze (bzw. nur der AGB-Satz) je genau einmal, nach dem Knopf und in der festen Leiste. */
function saetzeNachDemKnopf(html: string, knopf: string, privat: boolean): void {
  const stelleKnopf = html.indexOf(knopf)
  expect(stelleKnopf).toBeGreaterThan(-1)
  expect(anzahl(html, AGB)).toBe(1)
  expect(html.indexOf(AGB)).toBeGreaterThan(stelleKnopf)
  // Die Leiste beginnt vor dem Knopf; die Sätze stehen in ihr.
  expect(html.indexOf('data-unten-fest')).toBeLessThan(stelleKnopf)
  if (privat) {
    expect(anzahl(html, RUECKTRITT)).toBe(1)
    expect(html.indexOf(RUECKTRITT)).toBeGreaterThan(stelleKnopf)
    // Der Link zum Rücktritt öffnet im neuen Tab — wie unter „Weiter zur Zahlung“.
    expect(html).toContain('href="/widerruf" target="_blank" rel="noopener noreferrer"')
  } else {
    expect(html).not.toContain(RUECKTRITT)
  }
}

beforeEach(() => {
  pruefstand.gelaufen.clear()
  pruefstand.effekte = false
  pruefstand.abgelehnt = false
  pruefstand.zahlungsZustaende = 0
  pruefstand.vorbelegung = {}
})

describe('Zahlungsschritt: die Sätze unter „Jetzt bezahlen“ und „Erneut bezahlen“', () => {
  const schritt = (privat: boolean, saetze = true): string => {
    pruefstand.zahlungsZustaende = 0
    return renderToStaticMarkup(
      createElement(StripeZahlung, {
        clientSecret: 'pi_test_secret',
        bestaetigung: '/hof-test/confirm/o1?sig=abc',
        farmSlug: 'hof-test',
        reserviertBis: BIS,
        stand: reservierungsStand(BIS, JETZT),
        betrag: { amountCents: 1082, serviceFeeCents: 52 },
        gebuehrText: 'Servicegebühr',
        korb: null,
        angaben: null,
        zusammenfassung: createElement(KaufZusammenfassung, { positionen: POSITIONEN, abholung: ABHOLUNG, hofName: HOFNAME }),
        privat,
        kaufknopfSaetze: saetze ? createElement(KaufknopfSaetze, { privat }) : null,
      })
    )
  }

  it('„Jetzt bezahlen“, Privat: AGB- und Rücktrittssatz je einmal nach dem Knopf', () => {
    saetzeNachDemKnopf(schritt(true), 'Jetzt bezahlen · € 10,82', true)
  })

  it('„Jetzt bezahlen“, Betrieb: nur der AGB-Satz', () => {
    saetzeNachDemKnopf(schritt(false), 'Jetzt bezahlen · € 10,82', false)
  })

  it('„Erneut bezahlen“ nach einer Ablehnung: dieselben Sätze nach dem Knopf', () => {
    pruefstand.abgelehnt = true
    const html = schritt(true)
    // Gegenprobe des Prüfstands: Es ist wirklich der Zustand „abgelehnt“ — die Karte dazu steht da.
    expect(html).toContain(zahlungAbgelehntText(null).titel)
    expect(html).not.toContain('Jetzt bezahlen')
    saetzeNachDemKnopf(html, 'Erneut bezahlen · € 10,82', true)
  })

  it('„Erneut bezahlen“, Betrieb: nur der AGB-Satz', () => {
    pruefstand.abgelehnt = true
    saetzeNachDemKnopf(schritt(false), 'Erneut bezahlen · € 10,82', false)
  })

  it('Gegenprobe: ohne die Sätze findet die Suche keinen von beiden', () => {
    const html = schritt(true, false)
    expect(html).toContain('Jetzt bezahlen · € 10,82')
    expect(html).not.toContain(AGB)
    expect(html).not.toContain(RUECKTRITT)
  })

  it('beide Aufrufe des Zahlungsschritts im Formular reichen dieselbe Quelle wie KassenAbschluss', () => {
    const quelle = lies('src/components/checkout/checkout-form.tsx')
    const aufrufe = quelle.split('<StripeZahlung').slice(1).map((teil) => teil.slice(0, teil.search(/\n\s*\/>/)))
    expect(aufrufe).toHaveLength(2)
    for (const aufruf of aufrufe) expect(aufruf).toContain('kaufknopfSaetze={<KaufknopfSaetze privat={privat} />}')
    const abschluss = quelle.slice(quelle.indexOf('export function KassenAbschluss'), quelle.indexOf('export function KaufknopfSaetze'))
    expect(abschluss).toContain('<KaufknopfSaetze privat={privat} />')
    // Keine Kopie: Die Sätze stehen im Zahlungsschritt nicht noch einmal ausgeschrieben.
    expect(lies('src/components/checkout/stripe-payment.tsx')).not.toMatch(/AgbSatz|KASSE_AGB_SATZ|kasseSatz/)
  })
})

describe('Zahlung fortsetzen (Nr. 202): derselbe Zahlungsschritt mit den Sätzen', () => {
  const zahlung: Zahlung = {
    clientSecret: 'pi_test_secret',
    bestaetigung: '/hof-test/confirm/o1?sig=abc',
    reserviertBis: BIS,
    betrag: { amountCents: 500, serviceFeeCents: 0 },
    gebuehrText: 'Servicegebühr',
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
        anzeige: null,
        jetztIso: JETZT.toISOString(),
        privat,
      })
    )

  it('Privat: AGB- und Rücktrittssatz je einmal nach „Jetzt bezahlen“', () => {
    saetzeNachDemKnopf(fortsetzen(true), 'Jetzt bezahlen · € 5,00', true)
  })

  it('Betrieb: nur der AGB-Satz', () => {
    saetzeNachDemKnopf(fortsetzen(false), 'Jetzt bezahlen · € 5,00', false)
  })
})

describe('Formular: der Abholtermin einmal im Bar-Formular', () => {
  // Bar wird angeboten; ein Samstag mit Abholzeit.
  const HOF: PublicFarm = publicFarm({ name: HOFNAME, pickupSlots: [{ dayOfWeek: 6, startTime: '14:00', endTime: '16:00' }] })
  const [KACHEL] = abholKacheln(HOF.pickupSlots, JETZT, [])
  if (!KACHEL) throw new Error('Testaufbau: keine Abholkachel')
  const TERMIN = abholSatz(KACHEL)

  /** Korb mit Eiern; `menge` 2 = € 9,80, 3 = € 14,70. */
  const speicher = (menge: number): Record<string, string> => ({
    [SITZUNG_SCHLUESSEL]: 'sid_test',
    [WARENKORB_SCHLUESSEL]: JSON.stringify({
      farmId: HOF.id,
      farmSlug: HOF.slug,
      items: [{ productId: 'eier', name: 'Freilandeier 10er', price: 4.9, unit: 'STUECK', unitSize: null, quantity: menge, imageUrl: null }],
    }),
  })

  function kasse(hof: PublicFarm, vorbelegung: Record<string, string>, menge = 2): string {
    pruefstand.gelaufen.clear()
    pruefstand.effekte = true
    pruefstand.vorbelegung = vorbelegung
    const daten = speicher(menge)
    vi.stubGlobal('localStorage', { getItem: (k: string) => daten[k] ?? null, setItem: () => {}, removeItem: () => {} })
    return renderToStaticMarkup(
      createElement(CheckoutForm, { farm: hof, nurBetriebeIds: [], vorbelegung: null, ausgebuchteAbholfenster: [], sperre: null })
    )
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: JETZT })
    vi.stubGlobal('window', globalThis)
    vi.stubGlobal('fetch', () => new Promise(() => {}))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('Gegenprobe des Prüfstands: das fertige Formular mit dem vorbelegten Termin, nicht das Skelett', () => {
    const html = kasse(HOF, { pickupSlotKey: KACHEL.key, paymentMethod: 'ONSITE_CASH' })
    expect(html).toContain('Freilandeier 10er')
    expect(html).toContain(`<dd class="font-semibold">${TERMIN}</dd>`)
  })

  it('bar mit Termin: der Termin genau einmal (in „Deine Bestellung“), keine Zeile unter dem Knopf', () => {
    const html = kasse(HOF, { pickupSlotKey: KACHEL.key, paymentMethod: 'ONSITE_CASH' })
    const knopf = html.indexOf('Zahlungspflichtig bestellen · € 9,80')
    expect(knopf).toBeGreaterThan(-1)
    expect(anzahl(html, TERMIN)).toBe(1)
    expect(html.indexOf(TERMIN)).toBeLessThan(knopf)
    expect(html).not.toContain(`Abholung ${TERMIN}`)
    expect(html).not.toContain('bar am Hof · Bestätigung per E-Mail')
    // Die Sätze bleiben unter dem Knopf.
    saetzeNachDemKnopf(html, 'Zahlungspflichtig bestellen · € 9,80', true)
  })

  it('bar ohne Online-Angebot (nur bar): ebenso nur einmal', () => {
    const html = kasse({ ...HOF, stripeAccountReady: false }, { pickupSlotKey: KACHEL.key })
    expect(html).toContain('Zahlungspflichtig bestellen · € 9,80')
    expect(anzahl(html, TERMIN)).toBe(1)
  })

  it('bar ohne Termin: die Bitte zu wählen bleibt unter dem Knopf', () => {
    const html = kasse(HOF, { paymentMethod: 'ONSITE_CASH' })
    expect(html).toContain('Wähl noch, wann du abholst · bar am Hof · Bestätigung per E-Mail')
    expect(html.indexOf('Wähl noch, wann du abholst')).toBeGreaterThan(html.indexOf('Zahlungspflichtig bestellen'))
  })

  it('bar mit Termin unter dem Mindestbestellwert: der Grund bleibt unter dem Knopf', () => {
    const html = kasse({ ...HOF, preisAnzeige: { hundertstel: 600 } }, { pickupSlotKey: KACHEL.key, paymentMethod: 'ONSITE_CASH' }, 1)
    // Nr. 227 (Register N41 a, A3): der Hinweis mit dem Satz des Hofs statt MINDESTBESTELLWERT_SATZ — 1 × € 4,90, es fehlen € 5,10.
    const grund = mindestbestellwertHinweis(1000 - 490, 600)
    expect(html).not.toContain(MINDESTBESTELLWERT_SATZ)
    expect(html.indexOf(grund)).toBeGreaterThan(html.indexOf('Zahlungspflichtig bestellen'))
    expect(anzahl(html, TERMIN)).toBe(1)
  })

  it('online mit Termin: unverändert — Termin oben und in der Zeile unter „Weiter zur Zahlung“ (Register N10)', () => {
    const html = kasse(HOF, { pickupSlotKey: KACHEL.key, paymentMethod: 'ONLINE' })
    const knopf = html.indexOf('Weiter zur Zahlung')
    expect(knopf).toBeGreaterThan(-1)
    // Gegenprobe der Zählung: Hier steht der Termin zweimal.
    expect(anzahl(html, TERMIN)).toBe(2)
    expect(html.indexOf(`Abholung ${TERMIN} · ${ZAHLWEG_ONLINE}`)).toBeGreaterThan(knopf)
    saetzeNachDemKnopf(html, 'Weiter zur Zahlung', true)
  })
})

describe('Die Reservierungsfrist bleibt sichtbar, wenn die Zeile unter dem Knopf entfällt', () => {
  it('sie steht in der Übersicht über dem Knopf, nicht in der Zeile darunter', () => {
    const html = renderToStaticMarkup(
      createElement(KassenAbschluss, {
        hof: { name: HOFNAME, ownerName: 'Erika Muster', address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf', phone: '+43 660 0000000', email: 'hof@example.com' },
        uebersicht: createElement(UebersichtKarte, {
          betraege: { warenCents: 980, gebuehrCents: 0, gesamtCents: 980 },
          gebuehrText: 'Servicegebühr (5 %)',
          reservierung: createElement(ReservierungsHinweis, { stand: reservierungsStand(BIS, JETZT), schritt: 'formular' }),
        }),
        online: false,
        wirdGesendet: false,
        gesperrt: false,
        gesamt: '€ 9,80',
        fussnote: '',
        privat: true,
        zusammenfassung: createElement(KaufZusammenfassung, { karte: true, positionen: POSITIONEN, abholung: ABHOLUNG, hofName: HOFNAME }),
      })
    )
    const frist = html.indexOf('für dich reserviert')
    expect(frist).toBeGreaterThan(-1)
    expect(frist).toBeLessThan(html.indexOf('Zahlungspflichtig bestellen'))
  })

  it('im Formular hängt die Frist an der Übersicht (reservierung), nicht an der Zeile unter dem Knopf', () => {
    const quelle = lies('src/components/checkout/checkout-form.tsx')
    const uebersicht = quelle.slice(quelle.indexOf('<KassenAbschluss'), quelle.indexOf('fussnote={'))
    expect(uebersicht).toMatch(/reservierung=\{[\s\S]*<ReservierungsHinweis[\s\S]*schritt="formular"/)
  })
})
