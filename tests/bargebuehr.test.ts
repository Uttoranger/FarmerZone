/**
 * Register B1 (Nachtlauf 19a): Keine Servicegebühr bei Barzahlung bis zum
 * SEPA-Start — die reinen Regeln.
 *
 * Beweist:
 *  - Stichtag: `BAR_SERVICEGEBUEHR_AB` steht neben `TARIFE_AB` und ist
 *    standardmäßig derselbe Zeitpunkt (Wiener Mitternacht); der Vortag heißt
 *    über den gemeinsamen Formatierer „31. Jänner 2027".
 *  - berechneServicegebuehr: Matrix bar/online × vor/nach dem Stichtag, die
 *    Grenze auf die Millisekunde (genau am Stichtag gilt die Gebühr), „Karte
 *    bei Abholung" bleibt unberührt, ein gebührenfreier Hof bleibt frei.
 *  - Kasse: Der Wechsel online → bar → online rechnet sofort neu; Hinweis und
 *    Zusatz „gleicher Betrag" nur, wenn es stimmt.
 *  - „Artikel fehlt" (E14): Bar ohne Gebühr bleibt ohne Gebühr; eine ältere
 *    Barbestellung mit Gebühr behält ihre Regel (gespeicherte Beträge).
 *  - Finanzen: Barbestellungen vor dem Stichtag bringen nichts ein und werden
 *    nicht als geschuldet gezählt (keine SEPA-Erwartung) — mit Summen.
 *  - Storno-/„nicht abgeholt"-Vermerke kommen mit 0 Cent aus.
 *  - Texte: ehrlich und aus einer Quelle (konditionen.ts).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  BAR_OHNE_GEBUEHR_BIS_TEXT,
  BAR_OHNE_GEBUEHR_HINWEIS,
  BAR_OHNE_GEBUEHR_SATZ,
  BAR_SERVICEGEBUEHR_AB,
  MONATSABRECHNUNG_TEXT,
  SERVICEGEBUEHR_ZAHLT_KUNDE,
  TARIFE_AB,
} from '@/lib/konditionen'
import {
  SERVICEGEBUEHR_HINWEIS,
  barOhneServicegebuehr,
  barZuKassierenCents,
  berechneServicegebuehr,
  gebuehrErstattungOffen,
  type ServicegebuehrEinstellung,
} from '@/lib/servicegebuehr'
import { barHinweis, kassenBetraege, kassenZahlarten } from '@/lib/kasse'
import { artikelFehltRechnung, artikelFehltZeilen, type ArtikelFehltBestellung } from '@/lib/artikel-fehlt'
import { einnahmenImMonat, topfVonBestellung, type BestellungFuerFinanzen } from '@/lib/finanzen'
import { BEISPIEL_GLEICH, STARTSEITE_FRAGEN, beispielRechnung } from '@/lib/startseite'
import { FUER_HOEFE_FRAGEN } from '@/lib/fuer-hoefe'
import { OrderConfirmedEmail } from '@/emails/order-confirmed'

const lies = (datei: string): string => readFileSync(join(process.cwd(), datei), 'utf8')
const normal = (text: string): string => text.replace(/ /g, ' ')

/** Hof mit der Gebühr nach E4 (5 %, mind. € 0,50), gültig seit September 2026. */
const HOF: ServicegebuehrEinstellung = {
  serviceFeePercent: 5,
  serviceFeeMinCents: 50,
  serviceFeeActiveFrom: new Date('2026-09-01T00:00:00.000Z'),
}
const GEBUEHRFREI: ServicegebuehrEinstellung = { ...HOF, serviceFeeActiveFrom: null }

const LANGE_VORHER = new Date('2026-10-06T10:00:00.000Z')
const KURZ_VORHER = new Date(BAR_SERVICEGEBUEHR_AB.getTime() - 1)
const GENAU = BAR_SERVICEGEBUEHR_AB
const DANACH = new Date('2027-02-15T10:00:00.000Z')

describe('Stichtag (konditionen.ts)', () => {
  it('steht standardmäßig auf dem Tarif-Stichtag: Mitternacht in Wien, 1. Februar 2027', () => {
    expect(BAR_SERVICEGEBUEHR_AB.getTime()).toBe(TARIFE_AB.getTime())
    // Winterzeit: Wiener Mitternacht ist 23:00 UTC des Vortags.
    expect(BAR_SERVICEGEBUEHR_AB.toISOString()).toBe('2027-01-31T23:00:00.000Z')
  })

  it('der letzte Tag ohne Bargebühr ist der Wiener Vortag, über den gemeinsamen Formatierer', () => {
    expect(normal(BAR_OHNE_GEBUEHR_BIS_TEXT)).toBe('31. Jänner 2027')
    expect(normal(BAR_OHNE_GEBUEHR_HINWEIS)).toBe('Bei Barzahlung bis 31. Jänner 2027 ohne Servicegebühr.')
    expect(normal(BAR_OHNE_GEBUEHR_SATZ)).toBe('Bei Barzahlung fällt bis 31. Jänner 2027 keine Servicegebühr an.')
  })

  it('das Datum steht nur in konditionen.ts — Kasse, Startseite und Mail nehmen die Konstante', () => {
    for (const datei of [
      'src/lib/kasse.ts',
      'src/lib/startseite.ts',
      'src/lib/fuer-hoefe.ts',
      'src/emails/order-confirmed.tsx',
      'src/components/checkout/checkout-form.tsx',
    ]) {
      expect(lies(datei), datei).not.toMatch(/Jänner|2027-01-31|31\.\s*0?1\.\s*2027/)
    }
    // Gegenprobe: die Suche schlägt an.
    expect('bis 31. Jänner 2027').toMatch(/Jänner|2027-01-31|31\.\s*0?1\.\s*2027/)
    expect('bis 31.01.2027').toMatch(/Jänner|2027-01-31|31\.\s*0?1\.\s*2027/)
  })
})

describe('barOhneServicegebuehr — die Frage, an der alles hängt', () => {
  it('nur bar und nur vor dem Stichtag', () => {
    expect(barOhneServicegebuehr('ONSITE_CASH', LANGE_VORHER)).toBe(true)
    expect(barOhneServicegebuehr('ONSITE_CASH', KURZ_VORHER)).toBe(true)
    expect(barOhneServicegebuehr('ONSITE_CASH', GENAU)).toBe(false)
    expect(barOhneServicegebuehr('ONSITE_CASH', DANACH)).toBe(false)
    expect(barOhneServicegebuehr('ONLINE', LANGE_VORHER)).toBe(false)
  })

  it('„Karte bei Abholung" (E5, Altbestand) nennt B1 nicht — sie bleibt, wie sie war', () => {
    expect(barOhneServicegebuehr('ONSITE_CARD', LANGE_VORHER)).toBe(false)
  })

  it('nimmt den Zeitpunkt auch als ISO-Text; ein unlesbarer befreit nicht', () => {
    expect(barOhneServicegebuehr('ONSITE_CASH', LANGE_VORHER.toISOString())).toBe(true)
    expect(barOhneServicegebuehr('ONSITE_CASH', 'kein Datum')).toBe(false)
  })

  it('die Grenze ist Mitternacht in Wien, nicht in UTC', () => {
    // 31.01.2027 23:30 UTC ist in Wien schon der 1. Februar, 00:30 Uhr.
    expect(barOhneServicegebuehr('ONSITE_CASH', new Date('2027-01-31T23:30:00.000Z'))).toBe(false)
    // 31.01.2027 22:30 UTC ist in Wien der 31. Jänner, 23:30 Uhr.
    expect(barOhneServicegebuehr('ONSITE_CASH', new Date('2027-01-31T22:30:00.000Z'))).toBe(true)
  })
})

describe('berechneServicegebuehr — Matrix bar/online × vor/nach dem Stichtag', () => {
  it.each([
    ['bar', 'ONSITE_CASH', 'lange vorher', LANGE_VORHER, { gebuehrCents: 0, prozentAngewendet: null }],
    ['bar', 'ONSITE_CASH', '1 ms vorher', KURZ_VORHER, { gebuehrCents: 0, prozentAngewendet: null }],
    ['bar', 'ONSITE_CASH', 'genau am Stichtag', GENAU, { gebuehrCents: 100, prozentAngewendet: 5 }],
    ['bar', 'ONSITE_CASH', 'danach', DANACH, { gebuehrCents: 100, prozentAngewendet: 5 }],
    ['online', 'ONLINE', 'lange vorher', LANGE_VORHER, { gebuehrCents: 100, prozentAngewendet: 5 }],
    ['online', 'ONLINE', '1 ms vorher', KURZ_VORHER, { gebuehrCents: 100, prozentAngewendet: 5 }],
    ['online', 'ONLINE', 'genau am Stichtag', GENAU, { gebuehrCents: 100, prozentAngewendet: 5 }],
    ['online', 'ONLINE', 'danach', DANACH, { gebuehrCents: 100, prozentAngewendet: 5 }],
  ] as const)('%s, %s %s: € 20,00 → %o', (_art, zahlungsart, _wann, zeitpunkt, erwartet) => {
    expect(berechneServicegebuehr(2000, HOF, zeitpunkt, zahlungsart)).toEqual(erwartet)
  })

  it('online bleibt bei der bestehenden Regel: Mindestgebühr und Aufrunden', () => {
    expect(berechneServicegebuehr(600, HOF, LANGE_VORHER, 'ONLINE').gebuehrCents).toBe(50)
    expect(berechneServicegebuehr(1030, HOF, LANGE_VORHER, 'ONLINE').gebuehrCents).toBe(52)
  })

  it('ein gebührenfreier Hof bleibt auch bar nach dem Stichtag frei', () => {
    expect(berechneServicegebuehr(2000, GEBUEHRFREI, DANACH, 'ONSITE_CASH')).toEqual({
      gebuehrCents: 0,
      prozentAngewendet: null,
    })
  })

  it('„Karte bei Abholung" rechnet wie bisher', () => {
    expect(berechneServicegebuehr(2000, HOF, LANGE_VORHER, 'ONSITE_CARD').gebuehrCents).toBe(100)
  })
})

describe('Kasse (Client-Vorschau) — derselbe Weg, mit der Zahlungsart', () => {
  const KORB = [
    { productId: 'eier', price: 4.5, quantity: 1 },
    { productId: 'brot', price: 5.8, quantity: 1 },
  ]

  it('Wechsel online → bar → online rechnet jedes Mal neu', () => {
    const online = kassenBetraege(KORB, HOF, LANGE_VORHER, 'ONLINE')
    const bar = kassenBetraege(KORB, HOF, LANGE_VORHER, 'ONSITE_CASH')
    const wiederOnline = kassenBetraege(KORB, HOF, LANGE_VORHER, 'ONLINE')
    expect(online).toEqual(expect.objectContaining({ warenCents: 1030, gebuehrCents: 52, gesamtCents: 1082 }))
    expect(bar).toEqual(expect.objectContaining({ warenCents: 1030, gebuehrCents: 0, gesamtCents: 1030 }))
    expect(wiederOnline).toEqual(online)
  })

  it('ab dem Stichtag kosten bar und online dasselbe', () => {
    expect(kassenBetraege(KORB, HOF, DANACH, 'ONSITE_CASH').gesamtCents).toBe(1082)
    expect(kassenBetraege(KORB, HOF, DANACH, 'ONLINE').gesamtCents).toBe(1082)
  })

  it('der Hinweis kommt nur, solange bar wirklich günstiger ist', () => {
    expect(barHinweis(HOF, LANGE_VORHER)).toBe(BAR_OHNE_GEBUEHR_HINWEIS)
    expect(barHinweis(HOF, KURZ_VORHER)).toBe(BAR_OHNE_GEBUEHR_HINWEIS)
    expect(barHinweis(HOF, GENAU)).toBeNull()
    // Ein gebührenfreier Hof (oder einer mit Datum in der Zukunft) kostet online auch nichts.
    expect(barHinweis(GEBUEHRFREI, LANGE_VORHER)).toBeNull()
    expect(barHinweis({ ...HOF, serviceFeeActiveFrom: DANACH }, LANGE_VORHER)).toBeNull()
  })

  it('„gleicher Betrag" verspricht der Zusatz nur, wenn es stimmt', () => {
    const hof = { acceptsOnline: true, stripeAccountReady: true, acceptsOnsite: true }
    const bar = (guenstiger: boolean) => kassenZahlarten(hof, guenstiger).find((z) => z.wert === 'ONSITE_CASH')?.zusatz
    expect(bar(false)).toBe('gleicher Betrag, du bestätigst per E-Mail')
    expect(bar(true)).toBe('du bestätigst per E-Mail')
    expect(kassenZahlarten(hof)).toEqual(kassenZahlarten(hof, false))
  })

  it('das Formular rechnet mit der gewählten Zahlart und zeigt den Hinweis aus barHinweis', () => {
    const formular = lies('src/components/checkout/checkout-form.tsx')
    expect(formular).toMatch(/kassenBetraege\(cart, farm, jetzt, paymentMethod\)/)
    expect(formular).toMatch(/barHinweis\(farm, jetzt\)/)
    expect(formular).toMatch(/kassenZahlarten\(farm, hinweisBar !== null\)/)
    // Gegenprobe: die alte Form ohne Zahlungsart fiele auf.
    expect('kassenBetraege(cart, farm, jetzt)').not.toMatch(/kassenBetraege\(cart, farm, jetzt, paymentMethod\)/)
  })

  it('der Server rechnet die Gebühr mit der Zahlungsart der Anfrage und seiner eigenen Uhr', () => {
    expect(lies('src/app/api/checkout/route.ts')).toMatch(
      /berechneServicegebuehr\(warenpreisCents, farm, now, data\.paymentMethod\)/
    )
  })
})

describe('„Artikel fehlt" (E14) bei Barzahlung', () => {
  /** Eier € 4,50 + Brot € 5,80, bar vor dem Stichtag bestellt: Snapshot wie der Checkout ihn schreibt. */
  function barOhneGebuehr(abweichend: Partial<ArtikelFehltBestellung> = {}): ArtikelFehltBestellung {
    return {
      status: 'CONFIRMED',
      paymentMethod: 'ONSITE_CASH',
      paymentStatus: 'PENDING',
      stripePaymentIntentId: null,
      warenpreisCents: 1030,
      serviceFeeCents: 0,
      serviceFeePercentApplied: null,
      serviceFeeMinCentsApplied: null,
      erstattetCents: 0,
      positionen: [
        { id: 'eier', betragCents: 450, fehlt: false },
        { id: 'brot', betragCents: 580, fehlt: false },
      ],
      ...abweichend,
    }
  }

  it('bar ohne Gebühr: neuer Betrag = verbleibender Warenwert, Gebühr bleibt 0, keine Erstattung', () => {
    const r = artikelFehltRechnung(barOhneGebuehr(), 'brot')
    expect(r).toEqual(
      expect.objectContaining({
        art: 'teil',
        zahlung: 'vor_ort',
        neuWarenCents: 450,
        neuGebuehrCents: 0,
        neuGesamtCents: 450,
        gebuehrDifferenzCents: 0,
        erstattungCents: 0,
        vomHofCents: 0,
      })
    )
  })

  it('der Dialog nennt 0 Gebühr und keinen Satz zur Monatsabrechnung', () => {
    const zeilen = artikelFehltZeilen(artikelFehltRechnung(barOhneGebuehr(), 'brot'), 'Anna')
    expect(zeilen?.neu.betrag).toBe('€ 4,50')
    expect(zeilen?.saetze).toEqual([])
  })

  it('auch nach zwei fehlenden Artikeln nie eine Gebühr', () => {
    const drei = barOhneGebuehr({
      warenpreisCents: 1530,
      positionen: [
        { id: 'eier', betragCents: 450, fehlt: false },
        { id: 'brot', betragCents: 580, fehlt: false },
        { id: 'honig', betragCents: 500, fehlt: false },
      ],
    })
    const erst = artikelFehltRechnung(drei, 'brot')
    expect(erst.art === 'teil' && erst.neuGebuehrCents).toBe(0)
    const danach = artikelFehltRechnung(
      { ...drei, warenpreisCents: 950, positionen: drei.positionen.map((p) => (p.id === 'brot' ? { ...p, fehlt: true } : p)) },
      'honig'
    )
    expect(danach).toEqual(expect.objectContaining({ neuGebuehrCents: 0, neuGesamtCents: 450 }))
  })

  it('eine ältere Barbestellung MIT Gebühr behält ihre Regel (gespeicherte Beträge, E4) — wie vor B1', () => {
    const alt = barOhneGebuehr({ serviceFeeCents: 52, serviceFeePercentApplied: 5, serviceFeeMinCentsApplied: 50 })
    expect(artikelFehltRechnung(alt, 'brot')).toEqual(
      expect.objectContaining({ neuGebuehrCents: 50, neuGesamtCents: 500 })
    )
  })

  it('online ändert sich nichts: Kundin € 5,82 zurück, vom Hof € 5,80', () => {
    const online = barOhneGebuehr({
      status: 'PAID',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      stripePaymentIntentId: 'pi_test',
      serviceFeeCents: 52,
      serviceFeePercentApplied: 5,
      serviceFeeMinCentsApplied: 50,
    })
    expect(artikelFehltRechnung(online, 'brot')).toEqual(
      expect.objectContaining({ neuGebuehrCents: 50, erstattungCents: 582, vomHofCents: 580 })
    )
  })
})

describe('Storno und „nicht abgeholt" mit 0 Cent', () => {
  it('bar ohne Gebühr: „Bar zu kassieren" ist der Warenpreis, kein offener Erstattungsvermerk', () => {
    expect(barZuKassierenCents({ totalAmount: 10.3, serviceFeeCents: 0, paymentMethod: 'ONSITE_CASH' })).toBe(1030)
    expect(
      gebuehrErstattungOffen({
        status: 'NOT_PICKED_UP',
        paymentMethod: 'ONSITE_CASH',
        serviceFeeCents: 0,
        serviceFeeRefundedAt: null,
      })
    ).toBe(false)
  })

  it('Storno und „nicht abgeholt" setzen den Vermerk nur bei einer Gebühr über 0 — keine negative Rechnung', () => {
    const orders = lies('src/server/actions/orders.ts')
    expect(orders).toMatch(/order\.serviceFeeCents > 0 && !order\.serviceFeeRefundedAt/)
    expect(orders).toMatch(/if \(order\.serviceFeeCents <= 0 \|\| order\.serviceFeeRefundedAt\) return \{ offen: false \}/)
  })
})

describe('Admin-Finanzen: Barbestellungen vor dem Stichtag tragen nichts bei', () => {
  function bestellung(felder: Partial<BestellungFuerFinanzen> = {}): BestellungFuerFinanzen {
    return {
      createdAt: new Date('2027-01-15T10:00:00.000Z'),
      status: 'PICKED_UP',
      paymentMethod: 'ONSITE_CASH',
      paymentStatus: 'PENDING',
      serviceFeeCents: 0,
      serviceFeeRefundedAt: null,
      provisionCents: 0,
      ...felder,
    }
  }

  it('bar vor dem Stichtag: kein Topf — auch eine ältere Bestellung mit Gebühr wird nicht eingezogen', () => {
    expect(topfVonBestellung(bestellung())).toBe('keiner')
    expect(topfVonBestellung(bestellung({ serviceFeeCents: 100 }))).toBe('keiner')
    expect(topfVonBestellung(bestellung({ status: 'READY', serviceFeeCents: 100 }))).toBe('keiner')
    expect(topfVonBestellung(bestellung({ createdAt: KURZ_VORHER, serviceFeeCents: 100 }))).toBe('keiner')
  })

  it('bar ab dem Stichtag: geschuldet bzw. erwartet wie bisher', () => {
    expect(topfVonBestellung(bestellung({ createdAt: GENAU, serviceFeeCents: 100 }))).toBe('geschuldet')
    expect(topfVonBestellung(bestellung({ createdAt: DANACH, status: 'READY', serviceFeeCents: 100 }))).toBe('erwartet')
  })

  it('online vor dem Stichtag bleibt eingezogen', () => {
    expect(
      topfVonBestellung(bestellung({ paymentMethod: 'ONLINE', paymentStatus: 'PAID', serviceFeeCents: 52 }))
    ).toBe('eingezogen')
  })

  it('Summen im Jänner 2027: nur die Online-Gebühr zählt, Barbestellungen weder als Einnahme noch als Bestellung', () => {
    const e = einnahmenImMonat(
      [
        bestellung({ paymentMethod: 'ONLINE', paymentStatus: 'PAID', serviceFeeCents: 52 }), // eingezogen
        bestellung(), // bar ohne Gebühr (B1)
        bestellung({ serviceFeeCents: 100 }), // ältere Barbestellung mit Gebühr — nicht eingezogen
        bestellung({ status: 'CONFIRMED' }), // bar offen — nichts erwartet
      ],
      '2027-01'
    )
    expect(e).toEqual(
      expect.objectContaining({
        eingezogenCents: 52,
        geschuldetCents: 0,
        erwartetCents: 0,
        gezaehltCents: 52,
        bestellungen: 1,
        offeneBestellungen: 0,
      })
    )
  })

  it('Summen im Februar 2027: Bar ab dem Stichtag ist wieder geschuldet', () => {
    const e = einnahmenImMonat(
      [
        bestellung({ createdAt: DANACH, serviceFeeCents: 100 }),
        bestellung({ createdAt: DANACH, paymentMethod: 'ONLINE', paymentStatus: 'PAID', serviceFeeCents: 52 }),
      ],
      '2027-02'
    )
    expect(e).toEqual(expect.objectContaining({ eingezogenCents: 52, geschuldetCents: 100, bestellungen: 2 }))
  })

  it('die Admin-Hofliste rechnet in rohem SQL dieselbe Regel (Spalte „bar")', () => {
    const sql = lies('src/server/queries/admin.ts')
    const bar = sql.slice(sql.indexOf('COALESCE(SUM("serviceFeeCents") FILTER ('), sql.indexOf('AS "bar"'))
    expect(bar).toContain('AND NOT ("paymentMethod" = \'ONSITE_CASH\' AND "createdAt" < ${BAR_SERVICEGEBUEHR_AB})')
    expect(sql).toMatch(/import \{ BAR_SERVICEGEBUEHR_AB \} from '@\/lib\/konditionen'/)
  })
})

describe('Texte — ehrlich, aus einer Quelle', () => {
  it('/konditionen und /fuer-hoefe: der Grundsatz nennt die Bar-Ausnahme', () => {
    expect(SERVICEGEBUEHR_ZAHLT_KUNDE).toContain(BAR_OHNE_GEBUEHR_SATZ)
    expect(normal(SERVICEGEBUEHR_ZAHLT_KUNDE)).toBe(
      'Die Servicegebühr von 5 % (mind. € 0,50) zahlt der Kunde. ' +
        'Bei Barzahlung fällt bis 31. Jänner 2027 keine Servicegebühr an. ' +
        'Du bekommst immer den vollen Warenpreis – online wie bar.'
    )
  })

  it('/fuer-hoefe „Wie werde ich bezahlt?" nennt sie auch', () => {
    expect(FUER_HOEFE_FRAGEN.some((f) => f.antwort.includes(BAR_OHNE_GEBUEHR_SATZ))).toBe(true)
  })

  it('die Monatsabrechnung verspricht keinen Einzug aus der Zeit davor', () => {
    expect(MONATSABRECHNUNG_TEXT).not.toMatch(/nachträglich|rückwirkend/)
  })

  it('der Hinweis an der Gebühr behauptet nicht mehr „bei Online- und Barzahlung gleich"', () => {
    expect(SERVICEGEBUEHR_HINWEIS).not.toMatch(/gleich/)
    expect(SERVICEGEBUEHR_HINWEIS).toBe('Für Bereitstellung, Abwicklung und Zahlungsservice der Plattform.')
  })

  it('Startseite: das Beispiel ist die Online-Zahlung, die Fußnote folgt dem Stichtag', () => {
    expect(beispielRechnung(LANGE_VORHER)).toEqual(
      expect.objectContaining({ gebuehrCents: 100, fussnote: `Bei Online-Zahlung. ${BAR_OHNE_GEBUEHR_HINWEIS}` })
    )
    expect(beispielRechnung(GENAU).fussnote).toBe(BEISPIEL_GLEICH)
    expect(beispielRechnung(DANACH)).toEqual(expect.objectContaining({ gebuehrCents: 100, fussnote: BEISPIEL_GLEICH }))
  })

  it('Startseite „Wie bezahle ich?" nennt die Bar-Ausnahme', () => {
    expect(STARTSEITE_FRAGEN.find((f) => f.frage === 'Wie bezahle ich?')?.antwort).toContain(BAR_OHNE_GEBUEHR_HINWEIS)
  })
})

describe('Mail „Vor-Ort-Bestellung bestätigt" an den Hof', () => {
  const GRUND = {
    farmerName: 'Franz',
    customerName: 'Anna',
    customerPhone: '+43 660 0000000',
    orderNumber: 'TST-0101-AAAA',
    pickupDate: 'Samstag, 10. Oktober 2026',
    pickupTime: '09:00–12:00',
    items: [{ name: 'Eier', quantity: 1 }],
    total: 10.3,
    dashboardUrl: 'http://localhost:3000/orders',
  }
  const text = (props: Partial<Parameters<typeof OrderConfirmedEmail>[0]>): string =>
    normal(
      renderToStaticMarkup(createElement(OrderConfirmedEmail, { ...GRUND, ...props }))
        .replace(/<[^>]+>/g, ' ')
        .replace(/&#x27;/g, "'")
        .replace(/\s+/g, ' ')
    )

  it('bar vor dem Stichtag ohne Gebühr: der ganze Betrag bleibt dem Hof, mit dem Satz aus konditionen.ts', () => {
    const t = text({ serviceFee: 0, barZuKassieren: 10.3, barOhneGebuehr: true })
    expect(t).toContain('Bar zu kassieren: € 10,30')
    expect(t).toContain(`${normal(BAR_OHNE_GEBUEHR_SATZ)} Der ganze Betrag bleibt dir.`)
    expect(t).not.toContain('Monatsabrechnung')
  })

  it('eine ältere Barbestellung mit Gebühr vor dem Stichtag: keine Schuld gegenüber der Monatsabrechnung', () => {
    const t = text({ serviceFee: 0.52, barZuKassieren: 10.82, barOhneGebuehr: true })
    expect(t).toContain('davon Servicegebühr € 0,52; Warenpreis € 10,30 bleibt dir.')
    expect(t).not.toContain('schuldest')
  })

  it('ab dem Stichtag wie bisher: die Gebühr schuldet der Hof der Monatsabrechnung', () => {
    const t = text({ serviceFee: 0.52, barZuKassieren: 10.82, barOhneGebuehr: false })
    expect(t).toContain('davon Servicegebühr € 0,52 — die schuldest du der Monatsabrechnung; Warenpreis € 10,30 bleibt dir.')
    expect(t).not.toContain(normal(BAR_OHNE_GEBUEHR_SATZ))
  })
})
