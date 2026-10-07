/**
 * Tests für die Teilen-Zählung (Gate 7, Nr. 21; Sicherheitsregel S8).
 *
 * Beweist:
 *  - Nur die sieben Kürzel gelten (wa, wa-status, fb, ig, mail, qr, link);
 *    alles andere ergibt null und lässt nichts scheitern — auch nicht den
 *    Checkout-Body.
 *  - Der geteilte Link trägt genau `?k=` und sonst nichts.
 *  - Gezählt wird auf den Wiener Kalendertag, nicht den UTC-Tag.
 *  - Maschinen (Vorschau-Abrufer, Suchmaschinen, Skripte) und Vorabrufe zählen nicht.
 *  - Der Tab merkt sich das Kürzel ohne Cookie, zählt höchstens einmal je
 *    Hof und Kanal und wirft nie — auch nicht ohne oder mit kaputtem Speicher.
 *  - Die Route POST /api/teilen/besuch schreibt nur Hof, Kanal und Tag:
 *    keine IP, keinen Browser-Text, keine Person (Gegenprobe: mit IP und
 *    Browser im Kopf der Anfrage).
 *  - Die Zusammenfassung für die Auswertung (22c) summiert je Kanal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    teilenAufruf: { upsert: vi.fn() },
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { prisma } from '@/lib/prisma'
import {
  TEILEN_KANAL_CODES,
  istMaschine,
  istVorabruf,
  teilenKanalAus,
  teilenLink,
  teilenTag,
} from '@/lib/teilen-kanal'
import { adresseOhneKanal, leseTeilenHerkunft, merkeTeilenBesuch } from '@/lib/teilen-herkunft'
import { checkoutTeilenKanalSchema, teilenBesuchSchema } from '@/schemas/teilen'
import { checkoutRequestSchema } from '@/schemas/checkout'
import { diesenMonat, fasseTeilenWirkungZusammen, letzteTage, teilenWirkungSatz } from '@/lib/teilen-wirkung'
import { POST as besuch } from '@/app/api/teilen/besuch/route'

const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const upsert = vi.mocked(prisma.teilenAufruf.upsert)

const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Kanäle und Link', () => {
  it('genau die sieben Kürzel aus dem Gate, jedes mit eigenem Kanal', () => {
    expect([...TEILEN_KANAL_CODES]).toEqual(['wa', 'wa-status', 'fb', 'ig', 'mail', 'qr', 'link'])
    const kanaele = TEILEN_KANAL_CODES.map((c) => teilenKanalAus(c))
    expect(kanaele).toEqual(['WHATSAPP', 'WHATSAPP_STATUS', 'FACEBOOK', 'INSTAGRAM', 'EMAIL', 'QR', 'LINK'])
  })

  it.each([undefined, null, '', 'WA', ' wa', 'tiktok', 'wa,fb', ['wa'], 7, { k: 'wa' }])(
    'ungültig (%j) ergibt null',
    (wert) => {
      expect(teilenKanalAus(wert)).toBeNull()
    }
  )

  it('der Link ist die Hofseite mit genau ?k=', () => {
    expect(teilenLink('https://farmerzone.at', 'hof-test', 'qr')).toBe('https://farmerzone.at/hof-test?k=qr')
    expect(teilenLink('https://farmerzone.at/', 'hof-test', 'wa-status')).toBe('https://farmerzone.at/hof-test?k=wa-status')
  })

  it('der Tag ist der Wiener Kalendertag (kurz nach Mitternacht in Wien = schon der neue Tag)', () => {
    // 22:30 UTC am 6. Oktober = 0:30 Uhr am 7. Oktober in Wien (Sommerzeit).
    expect(teilenTag(new Date('2026-10-06T22:30:00Z')).toISOString()).toBe('2026-10-07T00:00:00.000Z')
    expect(teilenTag(new Date('2026-10-06T21:30:00Z')).toISOString()).toBe('2026-10-06T00:00:00.000Z')
  })
})

describe('Maschinen und Vorabrufe zählen nicht', () => {
  it.each([
    'WhatsApp/2.23.20.0',
    'facebookexternalhit/1.1',
    'TelegramBot (like TwitterBot)',
    'Mozilla/5.0 (compatible; Googlebot/2.1)',
    'curl/8.4.0',
    'Mozilla/5.0 HeadlessChrome/120',
    '',
    null,
  ])('Maschine: %j', (ua) => {
    expect(istMaschine(ua)).toBe(true)
  })

  it('ein gewöhnlicher Browser ist keine Maschine (Gegenprobe)', () => {
    expect(istMaschine(BROWSER)).toBe(false)
  })

  it('Vorabruf an Sec-Purpose oder Purpose erkannt', () => {
    expect(istVorabruf(new Headers({ 'sec-purpose': 'prefetch;prerender' }))).toBe(true)
    expect(istVorabruf(new Headers({ purpose: 'prefetch' }))).toBe(true)
    expect(istVorabruf(new Headers({}))).toBe(false)
  })
})

describe('Schemas', () => {
  it('Checkout: ungültiges Kürzel wird undefined, die Anfrage bleibt gültig', () => {
    expect(checkoutTeilenKanalSchema.parse('wa')).toBe('wa')
    expect(checkoutTeilenKanalSchema.parse('tiktok')).toBeUndefined()
    expect(checkoutTeilenKanalSchema.parse(42)).toBeUndefined()
    expect(checkoutTeilenKanalSchema.parse(undefined)).toBeUndefined()

    const basis = {
      farmId: 'f1',
      farmSlug: 'hof-test',
      sessionId: 's1',
      customerName: 'Erika Mustermann',
      customerEmail: 'erika@example.com',
      customerPhone: '0000 000000',
      pickupDate: '2026-10-10',
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONSITE_CASH',
      items: [{ productId: 'p1', quantity: 1, unitPrice: 1 }],
    }
    const ungueltig = checkoutRequestSchema.safeParse({ ...basis, teilenKanal: '<script>' })
    expect(ungueltig.success).toBe(true)
    expect(ungueltig.data?.teilenKanal).toBeUndefined()
    expect(checkoutRequestSchema.parse({ ...basis, teilenKanal: 'qr' }).teilenKanal).toBe('qr')
  })

  it('Besuch: strikt — nur Slug und Kürzel, sonst 400', () => {
    expect(teilenBesuchSchema.safeParse({ farmSlug: 'hof-test', kanal: 'fb' }).success).toBe(true)
    expect(teilenBesuchSchema.safeParse({ farmSlug: 'hof-test', kanal: 'fb', geraet: 'x' }).success).toBe(false)
    expect(teilenBesuchSchema.safeParse({ farmSlug: 'Hof Test', kanal: 'fb' }).success).toBe(false)
    expect(teilenBesuchSchema.safeParse({ farmSlug: 'hof-test', kanal: 'unbekannt' }).success).toBe(false)
  })
})

function speicher(start: Record<string, string> = {}): Storage & { daten: Map<string, string> } {
  const daten = new Map(Object.entries(start))
  return {
    daten,
    length: 0,
    clear: () => daten.clear(),
    key: () => null,
    getItem: (k: string) => daten.get(k) ?? null,
    setItem: (k: string, v: string) => void daten.set(k, v),
    removeItem: (k: string) => void daten.delete(k),
  }
}

describe('Herkunft im Tab (sessionStorage, kein Cookie)', () => {
  it('merkt das Kürzel und zählt einmal je Hof und Kanal', () => {
    const s = speicher()
    expect(merkeTeilenBesuch(s, 'hof-a', 'wa')).toEqual({ kanal: 'wa', zaehlen: true })
    expect(merkeTeilenBesuch(s, 'hof-a', 'wa')).toEqual({ kanal: 'wa', zaehlen: false })
    expect(leseTeilenHerkunft(s, 'hof-a')).toBe('wa')
    // Anderer Kanal zählt eigens, der letzte Link gewinnt die Herkunft.
    expect(merkeTeilenBesuch(s, 'hof-a', 'qr')).toEqual({ kanal: 'qr', zaehlen: true })
    expect(leseTeilenHerkunft(s, 'hof-a')).toBe('qr')
    // Anderer Hof hat seine eigene Herkunft.
    expect(leseTeilenHerkunft(s, 'hof-b')).toBeNull()
  })

  it('ungültiges Kürzel ändert nichts und zählt nicht', () => {
    const s = speicher()
    merkeTeilenBesuch(s, 'hof-a', 'fb')
    expect(merkeTeilenBesuch(s, 'hof-a', 'tiktok')).toEqual({ kanal: null, zaehlen: false })
    expect(leseTeilenHerkunft(s, 'hof-a')).toBe('fb')
  })

  it('ohne oder mit kaputtem Speicher: wirft nie, liest null, zählt trotzdem den Besuch', () => {
    const wirft = {
      getItem: () => {
        throw new Error('gesperrt')
      },
      setItem: () => {
        throw new Error('gesperrt')
      },
    }
    expect(merkeTeilenBesuch(null, 'hof-a', 'mail')).toEqual({ kanal: 'mail', zaehlen: true })
    expect(merkeTeilenBesuch(wirft, 'hof-a', 'mail')).toEqual({ kanal: 'mail', zaehlen: true })
    expect(leseTeilenHerkunft(null, 'hof-a')).toBeNull()
    expect(leseTeilenHerkunft(wirft, 'hof-a')).toBeNull()
  })

  it('ein manipulierter Speicherwert wird verworfen', () => {
    expect(leseTeilenHerkunft(speicher({ 'farmerzone_teilen:hof-a': '"><img>' }), 'hof-a')).toBeNull()
  })

  it('nimmt nur ?k aus der Adresse, der Rest bleibt', () => {
    expect(adresseOhneKanal('https://x.at/hof-a?k=wa&bereich=futter#produkte', 'k')).toBe('/hof-a?bereich=futter#produkte')
    expect(adresseOhneKanal('https://x.at/hof-a?k=wa', 'k')).toBe('/hof-a')
    expect(adresseOhneKanal('https://x.at/hof-a?bereich=futter', 'k')).toBeNull()
  })
})

function besuchsAnfrage(body: unknown, kopf: Record<string, string> = { 'user-agent': BROWSER }): NextRequest {
  return new NextRequest('http://localhost/api/teilen/besuch', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...kopf },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/teilen/besuch', () => {
  it('zählt einen Besuch nur mit Hof, Kanal und Tag — keine IP, kein Browser, keine Person', async () => {
    farmFindUnique.mockResolvedValue({ id: 'farm-1' } as never)
    upsert.mockResolvedValue({ id: 'z1' } as never)

    const res = await besuch(
      besuchsAnfrage(
        { farmSlug: 'hof-test', kanal: 'wa' },
        { 'user-agent': BROWSER, 'x-forwarded-for': '203.0.113.7', cookie: 'sitzung=abc' }
      )
    )

    expect(res.status).toBe(200)
    expect(upsert).toHaveBeenCalledTimes(1)
    const argument = upsert.mock.calls[0][0]
    expect(Object.keys(argument.create).toSorted()).toEqual(['besuche', 'farmId', 'kanal', 'tag'])
    expect(argument.create).toMatchObject({ farmId: 'farm-1', kanal: 'WHATSAPP', besuche: 1 })
    expect(argument.update).toEqual({ besuche: { increment: 1 } })
    // Gegenprobe: Was im Kopf der Anfrage stand, steht nirgends im Aufruf.
    const text = JSON.stringify(upsert.mock.calls)
    expect(text).not.toContain('203.0.113.7')
    expect(text).not.toContain('iPhone')
    expect(text).not.toContain('sitzung')
    // Nur öffentlich sichtbare Höfe (dieselbe Bedingung wie die Hofseite).
    expect(farmFindUnique.mock.calls[0][0].where).toMatchObject({ slug: 'hof-test', isActive: true, archivedAt: null })
  })

  it('Maschine oder Vorabruf: gleiche Antwort, aber nichts gezählt', async () => {
    farmFindUnique.mockResolvedValue({ id: 'farm-1' } as never)
    const bot = await besuch(besuchsAnfrage({ farmSlug: 'hof-test', kanal: 'wa' }, { 'user-agent': 'WhatsApp/2.23' }))
    const vorab = await besuch(
      besuchsAnfrage({ farmSlug: 'hof-test', kanal: 'wa' }, { 'user-agent': BROWSER, 'sec-purpose': 'prefetch' })
    )
    expect(bot.status).toBe(200)
    expect(vorab.status).toBe(200)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('ungültiger Körper oder unbekanntes Kürzel: 400, nichts gezählt', async () => {
    expect((await besuch(besuchsAnfrage('kein json'))).status).toBe(400)
    expect((await besuch(besuchsAnfrage({ farmSlug: 'hof-test', kanal: 'tiktok' }))).status).toBe(400)
    expect((await besuch(besuchsAnfrage({ farmSlug: 'hof-test', kanal: 'wa', ip: '1.2.3.4' }))).status).toBe(400)
    expect(farmFindUnique).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('unbekannter oder nicht öffentlicher Hof: dieselbe Antwort, nichts gezählt', async () => {
    farmFindUnique.mockResolvedValue(null)
    const res = await besuch(besuchsAnfrage({ farmSlug: 'gibt-es-nicht', kanal: 'qr' }))
    expect(res.status).toBe(200)
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('Teilen-Wirkung (Abfrage für 22c, reine Zusammenfassung)', () => {
  it('summiert je Kanal, die stärksten zuerst, Kanäle ohne Wirkung fallen weg', () => {
    const wirkung = fasseTeilenWirkungZusammen([
      { kanal: 'QR', besuche: 2, bestellungen: 0 },
      { kanal: 'WHATSAPP', besuche: 10, bestellungen: 2 },
      { kanal: 'WHATSAPP', besuche: 4, bestellungen: 1 },
      { kanal: 'FACEBOOK', besuche: 0, bestellungen: 0 },
    ])
    expect(wirkung).toEqual({
      besuche: 16,
      bestellungen: 3,
      kanaele: [
        { kanal: 'WHATSAPP', name: 'WhatsApp', besuche: 14, bestellungen: 3 },
        { kanal: 'QR', name: 'Plakat (QR-Code)', besuche: 2, bestellungen: 0 },
      ],
    })
  })

  it('Satz der Teilen-Zeile: Einzahl und Mehrzahl, ohne Wirkung keiner', () => {
    expect(teilenWirkungSatz({ besuche: 14, bestellungen: 3 })).toBe('14 Besuche, 3 Bestellungen über deine Links')
    expect(teilenWirkungSatz({ besuche: 1, bestellungen: 1 })).toBe('1 Besuch, 1 Bestellung über deine Links')
    expect(teilenWirkungSatz({ besuche: 0, bestellungen: 0 })).toBeNull()
  })

  it('Zeiträume in Wiener Tagen', () => {
    const jetzt = new Date('2026-10-06T22:30:00Z') // 7. Oktober in Wien
    expect(letzteTage(jetzt, 7)).toEqual({ von: '2026-10-01', bis: '2026-10-07' })
    expect(diesenMonat(jetzt)).toEqual({ von: '2026-10-01', bis: '2026-10-07' })
  })
})
