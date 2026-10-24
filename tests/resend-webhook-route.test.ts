/**
 * Zustellmeldungen von Resend (Register N26, Nr. 160): POST /api/webhooks/resend.
 *
 * Beweist mit echter Svix-Signatur (HMAC-SHA256, im Test gebaut) und
 * gemockter Datenbank:
 *  - fail-closed: ohne Geheimnis bzw. mit leerem Base64-Teil 503; falsche,
 *    fehlende oder zu alte Signatur 401 — jeweils ohne einen Zugriff auf die
 *    Datenbank. Zu groß → 413.
 *  - Signiert ist der ROHTEXT: dasselbe JSON anders formatiert passt nicht.
 *  - Mehrere Signaturen in der Kopfzeile: eine passende reicht.
 *  - email.delivered / bounced / complained setzen die Spalte per
 *    `updateMany` über die `resendId` (Bedingung: Spalte noch leer).
 *  - Bounce oder Spam-Meldung zu einem Beitrag → Abo abgemeldet (E-Mail und
 *    WhatsApp aus); zu einer Bestellmail → nur vermerkt.
 *  - Dasselbe Ereignis zweimal → keine zweite Änderung.
 *  - Unbekannte `resendId` und andere Ereignisse → 200 ohne Wirkung.
 *  - Nichts aus dem Inhalt außer `type`, `created_at`, `data.email_id`
 *    landet in einer Datenbank-Anweisung (Adresse im Inhalt).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'

const db = vi.hoisted(() => ({
  mailAuftrag: { findUnique: vi.fn(), updateMany: vi.fn() },
  customerFarmSubscription: { updateMany: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { POST } from '@/app/api/webhooks/resend/route'
import { RESEND_EREIGNIS_MAX_BYTES } from '@/schemas/resend-ereignis'

const SCHLUESSEL = Buffer.from('resend-webhook-testschluessel-32b')
const GEHEIMNIS = `whsec_${SCHLUESSEL.toString('base64')}`
const JETZT = new Date('2026-10-24T10:00:00.000Z')
const JETZT_S = Math.floor(JETZT.getTime() / 1000)
const ADRESSE = 'kundin-im-inhalt@example.org'

function signiere(id: string, zeit: string, text: string, schluessel = SCHLUESSEL): string {
  return createHmac('sha256', schluessel).update(`${id}.${zeit}.${text}`).digest('base64')
}

function meldung(type: string, emailId = 'email_abc', createdAt = '2026-10-24T09:59:30.000Z'): string {
  return JSON.stringify({ type, created_at: createdAt, data: { email_id: emailId, to: [ADRESSE], from: 'hof@example.com', subject: 'Neuigkeiten' } })
}

function anfrage(text: string, kopf: Partial<Record<'svix-id' | 'svix-timestamp' | 'svix-signature', string>> | null = null): NextRequest {
  const id = 'msg_test_1'
  const zeit = String(JETZT_S)
  const kopfzeilen = kopf ?? { 'svix-id': id, 'svix-timestamp': zeit, 'svix-signature': `v1,${signiere(id, zeit, text)}` }
  return new NextRequest('http://localhost/api/webhooks/resend', { method: 'POST', body: text, headers: kopfzeilen })
}

/** Ein Auftrag mit leeren Zustellspalten. */
function auftrag(art: string, bezug: unknown, gesetzt: Partial<Record<'zugestelltAm' | 'bounceAm' | 'beschwerdeAm', Date>> = {}) {
  return { art, bezug, zugestelltAm: null, bounceAm: null, beschwerdeAm: null, ...gesetzt }
}

/** Alles, was je an die Datenbank ging, als Text — für die Suche nach der Adresse. */
function allesAnDieDatenbank(): string {
  return JSON.stringify([
    db.mailAuftrag.findUnique.mock.calls,
    db.mailAuftrag.updateMany.mock.calls,
    db.customerFarmSubscription.updateMany.mock.calls,
  ])
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(JETZT)
  vi.stubEnv('RESEND_WEBHOOK_SECRET', GEHEIMNIS)
  db.mailAuftrag.findUnique.mockResolvedValue(null)
  db.mailAuftrag.updateMany.mockResolvedValue({ count: 1 })
  db.customerFarmSubscription.updateMany.mockImplementation((args: unknown) => ({ args }))
  db.$transaction.mockResolvedValue([{ count: 0 }, { count: 1 }])
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('Webhook Resend — Signatur und Schutz (fail-closed)', () => {
  it('gültige Signatur: 200 und vermerkt die Zustellung über die resendId', async () => {
    db.mailAuftrag.findUnique.mockResolvedValue(auftrag('bestellung-bestaetigung', { orderId: 'o1' }))

    const antwort = await POST(anfrage(meldung('email.delivered')))

    expect(antwort.status).toBe(200)
    expect(db.mailAuftrag.updateMany).toHaveBeenCalledWith({
      where: { resendId: 'email_abc', zugestelltAm: null },
      data: { zugestelltAm: new Date('2026-10-24T09:59:30.000Z') },
    })
  })

  it('ohne RESEND_WEBHOOK_SECRET: 503, kein Zugriff auf die Datenbank', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '')
    const antwort = await POST(anfrage(meldung('email.delivered')))
    expect(antwort.status).toBe(503)
    expect(db.mailAuftrag.findUnique).not.toHaveBeenCalled()
  })

  it('Geheimnis ohne Base64-Teil: 503 — ein leerer Schlüssel ließe jeden signieren', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_')
    const text = meldung('email.delivered')
    const id = 'msg_leer'
    const zeit = String(JETZT_S)
    const antwort = await POST(anfrage(text, { 'svix-id': id, 'svix-timestamp': zeit, 'svix-signature': `v1,${signiere(id, zeit, text, Buffer.alloc(0))}` }))
    expect(antwort.status).toBe(503)
    expect(db.mailAuftrag.findUnique).not.toHaveBeenCalled()
  })

  it('falsche Signatur: 401, nichts vermerkt', async () => {
    const text = meldung('email.bounced')
    const zeit = String(JETZT_S)
    const antwort = await POST(anfrage(text, { 'svix-id': 'msg_1', 'svix-timestamp': zeit, 'svix-signature': `v1,${signiere('msg_1', zeit, text, Buffer.from('ein-anderer-schluessel'))}` }))
    expect(antwort.status).toBe(401)
    expect(db.mailAuftrag.findUnique).not.toHaveBeenCalled()
  })

  it('fehlende Kopfzeilen: 401', async () => {
    const antwort = await POST(anfrage(meldung('email.bounced'), {}))
    expect(antwort.status).toBe(401)
    expect(db.mailAuftrag.findUnique).not.toHaveBeenCalled()
  })

  it('signiert ist der Rohtext: dasselbe JSON anders formatiert passt nicht', async () => {
    const text = meldung('email.delivered')
    const zeit = String(JETZT_S)
    const anders = JSON.stringify(JSON.parse(text), null, 2)
    const antwort = await POST(anfrage(anders, { 'svix-id': 'msg_1', 'svix-timestamp': zeit, 'svix-signature': `v1,${signiere('msg_1', zeit, text)}` }))
    expect(antwort.status).toBe(401)
  })

  it('Zeitstempel: genau 5 Minuten alt gilt, eine Sekunde älter oder weiter in der Zukunft nicht', async () => {
    db.mailAuftrag.findUnique.mockResolvedValue(auftrag('verfallen', { orderId: 'o1' }))
    const text = meldung('email.delivered')
    const mitZeit = (s: number) => {
      const zeit = String(s)
      return anfrage(text, { 'svix-id': 'msg_1', 'svix-timestamp': zeit, 'svix-signature': `v1,${signiere('msg_1', zeit, text)}` })
    }

    expect((await POST(mitZeit(JETZT_S - 300))).status).toBe(200)
    expect((await POST(mitZeit(JETZT_S - 301))).status).toBe(401)
    expect((await POST(mitZeit(JETZT_S + 301))).status).toBe(401)
    expect(db.mailAuftrag.findUnique).toHaveBeenCalledTimes(1)
  })

  it('mehrere Signaturen in der Kopfzeile: eine passende reicht (Wechsel des Geheimnisses)', async () => {
    db.mailAuftrag.findUnique.mockResolvedValue(auftrag('verfallen', { orderId: 'o1' }))
    const text = meldung('email.delivered')
    const zeit = String(JETZT_S)
    const alt = signiere('msg_1', zeit, text, Buffer.from('altes-geheimnis'))
    const antwort = await POST(anfrage(text, { 'svix-id': 'msg_1', 'svix-timestamp': zeit, 'svix-signature': `v1,${alt} v1,${signiere('msg_1', zeit, text)}` }))
    expect(antwort.status).toBe(200)
  })

  it('zu groß: 413, nichts gelesen und nichts vermerkt', async () => {
    const text = JSON.stringify({ type: 'email.delivered', polster: 'x'.repeat(RESEND_EREIGNIS_MAX_BYTES) })
    const antwort = await POST(anfrage(text))
    expect(antwort.status).toBe(413)
    expect(db.mailAuftrag.findUnique).not.toHaveBeenCalled()
  })
})

describe('Webhook Resend — Wirkung', () => {
  it('Bounce zu einem Beitrag: Abo abgemeldet (E-Mail und WhatsApp aus), dann vermerkt', async () => {
    db.mailAuftrag.findUnique.mockResolvedValue(auftrag('beitrag', { postId: 'p1', aboId: 'abo1' }))

    const antwort = await POST(anfrage(meldung('email.bounced')))

    expect(antwort.status).toBe(200)
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(db.customerFarmSubscription.updateMany).toHaveBeenCalledWith({ where: { id: 'abo1' }, data: { optInEmail: false, optInWhatsApp: false } })
    expect(db.mailAuftrag.updateMany).toHaveBeenCalledWith({
      where: { resendId: 'email_abc', bounceAm: null },
      data: { bounceAm: new Date('2026-10-24T09:59:30.000Z') },
    })
  })

  it('Spam gemeldet zu einem Beitrag: ebenfalls abgemeldet', async () => {
    db.mailAuftrag.findUnique.mockResolvedValue(auftrag('beitrag', { postId: 'p1', aboId: 'abo1' }))
    await POST(anfrage(meldung('email.complained')))
    expect(db.customerFarmSubscription.updateMany).toHaveBeenCalledWith({ where: { id: 'abo1' }, data: { optInEmail: false, optInWhatsApp: false } })
    expect(db.mailAuftrag.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { beschwerdeAm: expect.any(Date) } }))
  })

  it('Zustellung zu einem Beitrag meldet nicht ab (Gegenprobe)', async () => {
    db.mailAuftrag.findUnique.mockResolvedValue(auftrag('beitrag', { postId: 'p1', aboId: 'abo1' }))
    await POST(anfrage(meldung('email.delivered')))
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.mailAuftrag.updateMany).toHaveBeenCalledTimes(1)
  })

  it('Bounce zu einer Bestellmail: nur vermerkt, kein Abo angefasst', async () => {
    db.mailAuftrag.findUnique.mockResolvedValue(auftrag('bestellung-bestaetigung', { orderId: 'o1' }))
    const antwort = await POST(anfrage(meldung('email.bounced')))
    expect(antwort.status).toBe(200)
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.customerFarmSubscription.updateMany).not.toHaveBeenCalled()
    expect(db.mailAuftrag.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { resendId: 'email_abc', bounceAm: null } }))
  })

  it('dasselbe Ereignis zweimal: beim zweiten Mal keine Änderung mehr', async () => {
    db.mailAuftrag.findUnique.mockResolvedValueOnce(auftrag('beitrag', { postId: 'p1', aboId: 'abo1' }))
    db.mailAuftrag.findUnique.mockResolvedValueOnce(auftrag('beitrag', { postId: 'p1', aboId: 'abo1' }, { bounceAm: new Date('2026-10-24T09:59:30.000Z') }))

    expect((await POST(anfrage(meldung('email.bounced')))).status).toBe(200)
    expect((await POST(anfrage(meldung('email.bounced')))).status).toBe(200)

    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(db.mailAuftrag.updateMany).toHaveBeenCalledTimes(1)
  })

  it('unbekannte resendId: 200 ohne Wirkung', async () => {
    const antwort = await POST(anfrage(meldung('email.bounced', 'email_fremd')))
    expect(antwort.status).toBe(200)
    expect(db.mailAuftrag.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { resendId: 'email_fremd' } }))
    expect(db.mailAuftrag.updateMany).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('anderes Ereignis (email.opened): 200 ohne Zugriff auf die Datenbank', async () => {
    const antwort = await POST(anfrage(meldung('email.opened')))
    expect(antwort.status).toBe(200)
    expect(db.mailAuftrag.findUnique).not.toHaveBeenCalled()
  })

  it('kaputter Inhalt mit gültiger Signatur: 400, nichts vermerkt', async () => {
    expect((await POST(anfrage('{kein json'))).status).toBe(400)
    expect((await POST(anfrage(JSON.stringify({ type: 'email.bounced', created_at: 'x', data: {} })))).status).toBe(400)
    expect(db.mailAuftrag.findUnique).not.toHaveBeenCalled()
  })

  it('unlesbarer Zeitpunkt: vermerkt mit dem Eingang', async () => {
    db.mailAuftrag.findUnique.mockResolvedValue(auftrag('verfallen', { orderId: 'o1' }))
    await POST(anfrage(meldung('email.delivered', 'email_abc', 'gestern')))
    expect(db.mailAuftrag.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { zugestelltAm: JETZT } }))
  })

  it('die Adresse aus dem Inhalt erreicht keine Datenbank-Anweisung (Gegenprobe: die resendId schon)', async () => {
    db.mailAuftrag.findUnique.mockResolvedValue(auftrag('beitrag', { postId: 'p1', aboId: 'abo1' }))
    await POST(anfrage(meldung('email.complained')))
    const gesendet = allesAnDieDatenbank()
    expect(gesendet).toContain('email_abc')
    expect(gesendet).not.toContain(ADRESSE)
    expect(gesendet).not.toContain('Neuigkeiten')
  })
})
