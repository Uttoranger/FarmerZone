/**
 * Zustellmeldungen von Resend (Register N26, Nr. 160) gegen ein ECHTES
 * Postgres: POST /api/webhooks/resend mit echter Svix-Signatur, die Aussage
 * ist der Zustand von "MailAuftrag" und des Abos danach.
 *
 * Beweist, je mit Gegenprobe:
 *  - Bounce zu einem Beitrag → `bounceAm` gesetzt, Abo abgemeldet (E-Mail
 *    und WhatsApp aus); ein anderes Abo bleibt.
 *  - Bounce zu einer Bestellmail → nur `bounceAm`, kein Abo angefasst.
 *  - Dasselbe Ereignis zweimal → der erste Zeitpunkt bleibt.
 *  - Zwei gleichzeitige Meldungen → genau ein Vermerk (updateMany mit leerer
 *    Spalte als Bedingung), der Zeitpunkt ist einer der beiden.
 *  - Unbekannte `resendId` → keine Zeile geändert.
 *
 * Daten: Schlüssel mit `int-zustellung-`, Adressen @example.com (erfunden);
 * danach weg.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac, randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/webhooks/resend/route'
import { VORRANG } from '@/schemas/mail-auftrag'
import { erstelleHof, intKennung, raeumeAuf } from './setup/basis'

const PRAEFIX = 'int-zustellung-'
const SCHLUESSEL = Buffer.from('int-resend-webhook-schluessel')

beforeEach(() => {
  vi.stubEnv('RESEND_WEBHOOK_SECRET', `whsec_${SCHLUESSEL.toString('base64')}`)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await prisma.mailAuftrag.deleteMany({ where: { schluessel: { startsWith: PRAEFIX } } })
  await raeumeAuf()
})

function meldung(type: string, emailId: string, createdAt: string): NextRequest {
  const text = JSON.stringify({ type, created_at: createdAt, data: { email_id: emailId, to: ['kundin@example.com'] } })
  const id = `msg_${randomUUID()}`
  const zeit = String(Math.floor(Date.now() / 1000))
  const signatur = createHmac('sha256', SCHLUESSEL).update(`${id}.${zeit}.${text}`).digest('base64')
  return new NextRequest('http://localhost/api/webhooks/resend', {
    method: 'POST',
    body: text,
    headers: { 'svix-id': id, 'svix-timestamp': zeit, 'svix-signature': `v1,${signatur}` },
  })
}

async function abo(farmId: string, email: string) {
  return prisma.customerFarmSubscription.create({
    data: { customerEmail: email, farmId, optInEmail: true, optInWhatsApp: true, customerPhone: '+43 660 0000000' },
  })
}

async function gesendeterAuftrag(daten: { art: 'beitrag' | 'abholbereit'; bezug: Record<string, string>; bestellungId?: string }) {
  const resendId = `${PRAEFIX}re-${randomUUID()}`
  await prisma.mailAuftrag.create({
    data: {
      art: daten.art,
      vorrang: daten.art === 'beitrag' ? VORRANG.kannWarten : VORRANG.wichtig,
      schluessel: `${PRAEFIX}${randomUUID()}`,
      bezug: daten.bezug,
      bestellungId: daten.bestellungId ?? null,
      status: 'gesendet',
      gesendetAm: new Date(),
      resendId,
    },
  })
  return resendId
}

function zustand(resendId: string) {
  return prisma.mailAuftrag.findUniqueOrThrow({ where: { resendId }, select: { zugestelltAm: true, bounceAm: true, beschwerdeAm: true } })
}

function aboStand(id: string) {
  return prisma.customerFarmSubscription.findUniqueOrThrow({ where: { id }, select: { optInEmail: true, optInWhatsApp: true } })
}

describe('Zustellmeldungen von Resend (echtes Postgres)', () => {
  it('Bounce zu einem Beitrag: bounceAm gesetzt und das Abo abgemeldet, ein anderes Abo bleibt', async () => {
    const { farm } = await erstelleHof()
    const getroffen = await abo(farm.id, `${intKennung('kundin')}@example.com`)
    const anderes = await abo(farm.id, `${intKennung('andere')}@example.com`)
    const resendId = await gesendeterAuftrag({ art: 'beitrag', bezug: { postId: 'int-post-1', aboId: getroffen.id } })

    const antwort = await POST(meldung('email.bounced', resendId, '2026-10-24T09:00:00.000Z'))

    expect(antwort.status).toBe(200)
    expect(await zustand(resendId)).toEqual({ zugestelltAm: null, bounceAm: new Date('2026-10-24T09:00:00.000Z'), beschwerdeAm: null })
    expect(await aboStand(getroffen.id)).toEqual({ optInEmail: false, optInWhatsApp: false })
    expect(await aboStand(anderes.id)).toEqual({ optInEmail: true, optInWhatsApp: true })
  })

  it('Bounce zu einer Bestellmail: nur vermerkt, das Abo derselben Adresse bleibt', async () => {
    const { farm } = await erstelleHof()
    const email = `${intKennung('kundin')}@example.com`
    const bestehend = await abo(farm.id, email)
    const resendId = await gesendeterAuftrag({ art: 'abholbereit', bezug: { orderId: 'int-order-1' }, bestellungId: 'int-order-1' })

    await POST(meldung('email.bounced', resendId, '2026-10-24T09:00:00.000Z'))

    expect((await zustand(resendId)).bounceAm).toEqual(new Date('2026-10-24T09:00:00.000Z'))
    expect(await aboStand(bestehend.id)).toEqual({ optInEmail: true, optInWhatsApp: true })
  })

  it('dasselbe Ereignis zweimal: der erste Zeitpunkt bleibt', async () => {
    const resendId = await gesendeterAuftrag({ art: 'abholbereit', bezug: { orderId: 'int-order-2' } })

    await POST(meldung('email.delivered', resendId, '2026-10-24T09:00:00.000Z'))
    const zweite = await POST(meldung('email.delivered', resendId, '2026-10-24T09:05:00.000Z'))

    expect(zweite.status).toBe(200)
    expect((await zustand(resendId)).zugestelltAm).toEqual(new Date('2026-10-24T09:00:00.000Z'))
  })

  it('zwei gleichzeitige Meldungen: genau ein Vermerk, mit dem Zeitpunkt einer der beiden', async () => {
    const resendId = await gesendeterAuftrag({ art: 'abholbereit', bezug: { orderId: 'int-order-3' } })

    const antworten = await Promise.all([
      POST(meldung('email.complained', resendId, '2026-10-24T09:00:00.000Z')),
      POST(meldung('email.complained', resendId, '2026-10-24T09:00:01.000Z')),
    ])

    expect(antworten.map((a) => a.status)).toEqual([200, 200])
    const am = (await zustand(resendId)).beschwerdeAm
    expect([new Date('2026-10-24T09:00:00.000Z').getTime(), new Date('2026-10-24T09:00:01.000Z').getTime()]).toContain(am?.getTime())
  })

  it('unbekannte resendId: 200, keine Zeile geändert (Gegenprobe: die bekannte bleibt leer)', async () => {
    const resendId = await gesendeterAuftrag({ art: 'abholbereit', bezug: { orderId: 'int-order-4' } })

    const antwort = await POST(meldung('email.delivered', `${PRAEFIX}unbekannt`, '2026-10-24T09:00:00.000Z'))

    expect(antwort.status).toBe(200)
    expect(await zustand(resendId)).toEqual({ zugestelltAm: null, bounceAm: null, beschwerdeAm: null })
  })
})
