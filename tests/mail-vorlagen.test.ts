/**
 * Die Kunden-Mails im hellen Stil (Nr. 13, Mockup web-k3-e-mails-web-mobil).
 *
 * Gerendert über das echte src/lib/email.ts (nur das Resend-SDK gemockt), mit
 * erfundenen Daten. Beweist je Mail:
 *  - keine Emojis, kein Magic Link (E7), keine Werbung in Vertragsmails (S11);
 *  - jeder Link zu einer Bestellung trägt eine gültige Signatur (S1);
 *  - Beträge in der gemeinsamen Schreibweise („€ 10,82"), nie „€ 10.82";
 *  - die Bestätigung nach der Bar-Bestätigung sagt nicht „bezahlt";
 *  - „Bitte bestätige" nennt die Frist aus fristen.ts.
 * Dazu am Quelltext (mit Gegenprobe): kein `toFixed` in den Vorlagen, Farben
 * nur in der Mail-Palette von src/emails/_layout.tsx.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

import { bestellLinkGilt } from '@/lib/bestell-link'

let email: typeof import('@/lib/email')

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  email = await import('@/lib/email')
}, 30_000)

afterAll(() => {
  vi.unstubAllEnvs()
})

const JETZT = new Date('2026-10-05T08:20:00Z')

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(JETZT)
})

afterEach(() => {
  vi.useRealTimers()
})

/** Eine Bestellung mit erfundenen Daten — Eier € 4,50, Brot € 5,80, Gebühr € 0,52. */
function bestellung(teil: Partial<import('@/lib/email').OrderForEmail> = {}): import('@/lib/email').OrderForEmail {
  return {
    id: 'order-1',
    orderNumber: 'HT-0210-A4F2',
    customerName: 'Erika Beispiel',
    customerEmail: 'erika@example.org',
    customerPhone: '+43 660 0000000',
    totalAmount: '10.30',
    serviceFeeCents: 52,
    createdAt: new Date('2026-10-05T08:12:00Z'),
    pickupDate: new Date('2026-10-05T12:00:00Z'),
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    paymentMethod: 'ONLINE',
    farm: {
      id: 'farm-1',
      name: 'Hof Beispiel',
      email: 'hof@example.org',
      ownerName: 'Max Muster',
      address: 'Feldweg 1',
      city: 'Beispieldorf',
      postalCode: '4910',
      phone: '+43 660 1111111',
      slug: 'hof-beispiel',
    },
    items: [
      { productName: 'Freilandeier', quantity: 1, unitPrice: '4.50', totalPrice: '4.50', product: { unit: 'STUECK', unitSize: null } },
      { productName: 'Bauernbrot', quantity: 2, unitPrice: '2.90', totalPrice: '5.80', product: { unit: 'STUECK', unitSize: null } },
    ],
    ...teil,
  }
}

function zuletzt(): { html: string; text: string; subject: string } {
  const aufruf = sendMock.mock.calls.at(-1)?.[0] as { html: string; subject: string } | undefined
  const html = String(aufruf?.html ?? '')
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;|&#xA0;/g, ' ')
    .replace(/\s+/g, ' ')
  return { html, text, subject: String(aufruf?.subject ?? '') }
}

function links(html: string): URL[] {
  return [...html.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .filter((h) => /^https?:/.test(h))
    .map((h) => new URL(h))
}

const BILDZEICHEN = /\p{Extended_Pictographic}|[✓✗]/u

/** Mails werden später gelesen als verschickt — relative Tagesangaben veralten über Nacht. */
const RELATIVER_TAG = /\b(heute|morgen|übermorgen|gestern)\b/i

const KUNDEN_MAILS: Array<[string, () => Promise<void>]> = [
  ['Bestätigung online', () => email.sendOrderConfirmation(bestellung())],
  ['Bestätigung bar', () => email.sendOrderConfirmation(bestellung({ paymentMethod: 'ONSITE_CASH' }))],
  ['Bitte bestätigen', () => email.sendOnsiteConfirmation(bestellung({ paymentMethod: 'ONSITE_CASH' }), 'token-1')],
  ['Abholbereit', () => email.sendOrderReady(bestellung())],
  ['Doch nicht abholbereit', () => email.sendOrderNotReady(bestellung())],
  ['Storniert online', () => email.sendOrderCancelled(bestellung(), 10.82)],
  ['Storniert bar', () => email.sendOrderCancelled(bestellung({ paymentMethod: 'ONSITE_CASH' }), null)],
  ['Verfallen', () => email.sendBestellungVerfallen(bestellung())],
  ['Zahlung zu spät', () => email.sendZahlungZuSpaet(bestellung(), 1082)],
]

describe.each(KUNDEN_MAILS)('Kunden-Mail „%s"', (_name, senden) => {
  it('ohne Emojis, ohne Magic Link, ohne Werbung', async () => {
    await senden()
    const { html, text, subject } = zuletzt()
    // Gegenprobe: Die Mail ist wirklich gerendert.
    expect(text).toContain('HT-0210-A4F2')
    expect(BILDZEICHEN.test(`${subject} ${text}`)).toBe(false)
    expect(html).not.toMatch(/magic-link|magicLink/i)
    expect(text).not.toMatch(/Newsletter|Neuigkeiten|abonnier/i)
  })

  it('jeder Link zu einer Bestellung trägt eine gültige Signatur', async () => {
    await senden()
    for (const link of links(zuletzt().html).filter((u) => /^\/hof-beispiel\/(bestellung|confirm)\//.test(u.pathname))) {
      const signatur = link.searchParams.get('s') ?? link.searchParams.get('sig') ?? ''
      expect(bestellLinkGilt('order-1', signatur), link.href).toBe(true)
    }
  })

  it('Tage stehen fest da — nie „heute" oder „morgen" (die Mail wird später gelesen als verschickt)', async () => {
    await senden()
    const { text, subject } = zuletzt()
    expect(`${subject} ${text}`).not.toMatch(RELATIVER_TAG)
  })

  it('Beträge nur als „€ 1.234,56" — nie mit Dezimalpunkt', async () => {
    await senden()
    const { text } = zuletzt()
    expect(text).not.toMatch(/€\s?\d+\.\d{2}\b/)
    expect(text).not.toMatch(/\d+\.\d{2}\s?€/)
  })
})

describe('Bestätigungs-Mail nach Mockup', () => {
  it('online: Bestellnummer (kein „Abholcode"), Positionen, Gebühr, „Online bezahlt" mit Gesamt', async () => {
    await email.sendOrderConfirmation(bestellung())
    const { text, html } = zuletzt()
    expect(text).toContain('Danke für deine Bestellung!')
    expect(text).toContain('Bestellnummer')
    expect(text).not.toContain('Abholcode')
    expect(text).toContain('Freilandeier')
    expect(text).toContain('€ 4,50')
    expect(text).toContain('€ 5,80')
    expect(text).toContain('Servicegebühr')
    expect(text).toContain('€ 0,52')
    expect(text).toMatch(/Online bezahlt\s*€ 10,82/)
    // Der signierte Weg zur Bestellung und die Route zum Hof.
    expect(links(html).some((u) => u.pathname === '/hof-beispiel/bestellung/order-1')).toBe(true)
    expect(links(html).some((u) => u.hostname === 'www.google.com' && u.pathname.startsWith('/maps'))).toBe(true)
  })

  it('bar bestätigt: sagt nie „bezahlt", sondern was bei der Abholung mitzubringen ist', async () => {
    await email.sendOrderConfirmation(bestellung({ paymentMethod: 'ONSITE_CASH' }))
    const { text } = zuletzt()
    expect(text).not.toMatch(/bezahlt|Zahlung erfolgreich/i)
    expect(text).toMatch(/Bar bei Abholung\s*€ 10,82/)
    expect(text).toContain('Bring bitte € 10,82 in bar mit.')
    // Gegenprobe: online steht „bezahlt" da.
    await email.sendOrderConfirmation(bestellung())
    expect(zuletzt().text).toMatch(/bezahlt/i)
  })

  it('alte Bestellung mit Karte bei Abholung (E5): „Karte bei Abholung"', async () => {
    await email.sendOrderConfirmation(bestellung({ paymentMethod: 'ONSITE_CARD' }))
    const { text } = zuletzt()
    expect(text).toMatch(/Karte bei Abholung\s*€ 10,82/)
    expect(text).not.toMatch(/bezahlt/i)
  })

  it('keine Werbung in der Vertragsmail: kein „Nochmal bestellen" direkt nach dem Bestellen (S11)', async () => {
    await email.sendOrderConfirmation(bestellung())
    const { html, text } = zuletzt()
    expect(html).not.toContain('reorder=')
    expect(text).not.toContain('Nochmal bestellen')
  })
})

describe('„Bitte bestätige" — Frist aus fristen.ts', () => {
  it('nennt die konkrete Uhrzeit: zwei Stunden ab der Bestellung, vor dem Abholbeginn', async () => {
    await email.sendOnsiteConfirmation(bestellung({ paymentMethod: 'ONSITE_CASH' }), 'token-1')
    const { text } = zuletzt()
    expect(text).toContain('Bitte bestätige bis Montag, 5. Oktober, 12:12 Uhr.')
    expect(text).toMatch(/Bar bei Abholung\s*€ 10,82/)
  })

  it('Bestellung kurz vor Mitternacht: die Frist steht als fester Tag — gelesen nach Mitternacht stimmt sie noch', async () => {
    vi.setSystemTime(new Date('2026-10-05T21:35:00Z')) // 23:35 in Wien
    await email.sendOnsiteConfirmation(
      bestellung({
        paymentMethod: 'ONSITE_CASH',
        createdAt: new Date('2026-10-05T21:30:00Z'),
        pickupDate: new Date('2026-10-06T12:00:00Z'),
      }),
      'token-1'
    )
    const { text } = zuletzt()
    expect(text).toContain('Bitte bestätige bis Dienstag, 6. Oktober, 01:30 Uhr.')
    expect(text).not.toMatch(RELATIVER_TAG)
  })

  it('ohne Bestellzeitpunkt bleibt der allgemeine Satz — nie eine erfundene Uhrzeit', async () => {
    await email.sendOnsiteConfirmation(bestellung({ paymentMethod: 'ONSITE_CASH', createdAt: undefined }), 'token-1')
    const { text } = zuletzt()
    expect(text).not.toContain('Bitte bestätige bis')
    expect(text).toContain('spätestens zwei Stunden')
  })
})

describe('Abholbereit-Mail (Vorlage pickup-reminder.tsx)', () => {
  it('Bestellnummer, Zeitfenster, Route — und der Hinweis, wie man dem Hof absagt', async () => {
    await email.sendOrderReady(bestellung())
    const { text, html } = zuletzt()
    expect(text).toContain('Deine Bestellung liegt bereit')
    expect(text).toContain('HT-0210-A4F2')
    expect(text).toContain('15:00–18:00 Uhr')
    expect(links(html).some((u) => u.hostname === 'www.google.com')).toBe(true)
    expect(html).toContain('href="tel:+43 660 1111111"')
  })
})

describe('Quelltext der Vorlagen', () => {
  const ORDNER = join(process.cwd(), 'src', 'emails')
  const vorlagen = readdirSync(ORDNER).filter((n) => n.endsWith('.tsx'))
  const lies = (n: string) => readFileSync(join(ORDNER, n), 'utf8')

  const TO_FIXED = /\.toFixed\(/
  const FARBE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/

  it('Gegenprobe: die Suchen schlagen an', () => {
    expect(TO_FIXED.test('€ {(p.total).toFixed(2)}')).toBe(true)
    expect(FARBE.test("color: '#15803d'")).toBe(true)
    expect(FARBE.test("color: 'rgba(255,255,255,0.6)'")).toBe(true)
    expect(vorlagen.length).toBeGreaterThan(10)
  })

  it('kein toFixed — Beträge gehen über formatEuro (src/lib/format.ts)', () => {
    expect(vorlagen.filter((n) => TO_FIXED.test(lies(n)))).toEqual([])
  })

  it('keine Mail rechnet relativ zum Versand: weder Vorlagen noch src/lib/email.ts rufen relative Tageshelfer auf', () => {
    // tagInWorten (fristen.ts), abholZeitText/kurzerTag/fristKurz (bestaetigung.ts)
    // sagen „heute"/„morgen" — richtig auf einer Seite, die beim Lesen rechnet,
    // falsch in einer Mail, die erst nach Mitternacht geöffnet wird.
    const RELATIVE_HELFER = /\b(tagInWorten|abholZeitText|kurzerTag|fristKurz)\b/
    // Gegenprobe: die Suche schlägt am alten Fehler an.
    expect(RELATIVE_HELFER.test('bestaetigenBis: `${tagInWorten(frist, new Date())}, ${uhrzeitInWien(frist)} Uhr`')).toBe(true)
    const mailCode = join(process.cwd(), 'src', 'lib', 'email.ts')
    const treffer = [...vorlagen.map((n) => [n, lies(n)] as const), ['src/lib/email.ts', readFileSync(mailCode, 'utf8')] as const]
      .filter(([, inhalt]) => RELATIVE_HELFER.test(inhalt))
      .map(([n]) => n)
    expect(treffer).toEqual([])
  })

  it('die Mail-Palette nimmt nur helle Tokens aus DESIGN_SYSTEM.md und die vorgerechneten Hinweiskarten-Tönungen', async () => {
    const { MAIL_FARBE } = await import('@/emails/_layout')
    const doku = readFileSync(join(process.cwd(), 'docs', 'ai', 'DESIGN_SYSTEM.md'), 'utf8')
    // Tabelle „Farbtokens": | --name | dunkel | hell |
    const hell = new Map(
      [...doku.matchAll(/^\| (--[\w-]+)[^|]*\| (#[0-9A-Fa-f]{6}) \| (#[0-9A-Fa-f]{6}) \|/gm)].map((m) => [m[1], m[3].toUpperCase()])
    )
    const mische = (vorne: string, grund: string, anteil: number) =>
      '#' +
      [1, 3, 5]
        .map((i) => Math.round(anteil * parseInt(vorne.slice(i, i + 2), 16) + (1 - anteil) * parseInt(grund.slice(i, i + 2), 16)))
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
    const flaeche = hell.get('--surface') ?? ''
    const erlaubt = new Set([
      ...hell.values(),
      // Hinweiskarte: 12 % Fläche, 45 % Rand auf --surface
      ...[hell.get('--accent') ?? '', hell.get('--primary') ?? ''].flatMap((f) => [mische(f, flaeche, 0.12), mische(f, flaeche, 0.45)]),
    ])
    // Gegenprobe: die Tabelle wird gelesen, und frei gewählte Zwischentöne fallen auf.
    expect(hell.size).toBeGreaterThan(8)
    expect(erlaubt.has('#C9C3AD')).toBe(false)
    expect(erlaubt.has('#3D4A3E')).toBe(false)
    const fremd = Object.entries(MAIL_FARBE).filter(([, wert]) => !erlaubt.has(wert.toUpperCase()))
    expect(fremd).toEqual([])
  })

  it('Farben nur in der Mail-Palette von _layout.tsx — alle Mails bleiben ein Stil', () => {
    expect(vorlagen.filter((n) => n !== '_layout.tsx' && FARBE.test(lies(n)))).toEqual([])
    expect(lies('_layout.tsx')).toMatch(/export const MAIL_FARBE/)
  })
})
