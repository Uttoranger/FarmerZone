/**
 * Die Ein-Klick-Abmeldung `/api/abmelden` (RFC 8058, Nr. 47) gegen ein echtes
 * Postgres — der Zustand der Abos danach ist die Aussage.
 *
 * Beweist:
 *  - POST mit dem Token aus der Mail meldet ab: E-Mail und WhatsApp aus,
 *    eine offene Bestätigungsanfrage aufgelöst; andere Abos bleiben.
 *  - Zweimal ist wie einmal; ohne Abo dieselbe Antwort und kein neues Abo.
 *  - GET ändert nichts.
 *  - Ein falscher Token ändert nichts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { GET, POST } from '@/app/api/abmelden/route'
import { generateUnsubscribeToken } from '@/lib/unsubscribe'
import { erstelleHof, intKennung, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

function einKlick(token: string): NextRequest {
  return new NextRequest(`http://localhost/api/abmelden?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    body: 'List-Unsubscribe=One-Click',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  })
}

async function abo(farmId: string, email: string, abweichend: { emailOptInAngefragtAm?: Date | null } = {}) {
  return prisma.customerFarmSubscription.create({
    data: { customerEmail: email, farmId, optInEmail: true, optInWhatsApp: true, customerPhone: '+43 660 0000000', ...abweichend },
  })
}

function stand(id: string) {
  return prisma.customerFarmSubscription.findUniqueOrThrow({
    where: { id },
    select: { optInEmail: true, optInWhatsApp: true, emailOptInAngefragtAm: true, emailOptInBestaetigtAm: true },
  })
}

describe('POST /api/abmelden', () => {
  it('meldet mit dem Token ab — E-Mail und WhatsApp aus, das Abo bei einem anderen Hof bleibt', async () => {
    const { farm } = await erstelleHof()
    const { farm: andererHof } = await erstelleHof()
    const email = `${intKennung('kundin')}@example.com`
    const meins = await abo(farm.id, email)
    const anderes = await abo(andererHof.id, email)

    const antwort = await POST(einKlick(generateUnsubscribeToken(email, farm.id)))

    expect(antwort.status).toBe(200)
    expect(await antwort.json()).toEqual({ ok: true })
    expect(await stand(meins.id)).toMatchObject({ optInEmail: false, optInWhatsApp: false })
    expect(await stand(anderes.id)).toMatchObject({ optInEmail: true, optInWhatsApp: true })
  })

  it('löst eine offene Bestätigungsanfrage auf — ein alter Bestätigungslink findet sie nicht mehr', async () => {
    const { farm } = await erstelleHof()
    const email = `${intKennung('kundin')}@example.com`
    const offen = await abo(farm.id, email, { emailOptInAngefragtAm: new Date() })

    await POST(einKlick(generateUnsubscribeToken(email, farm.id)))

    expect(await stand(offen.id)).toMatchObject({ optInEmail: false, emailOptInAngefragtAm: null, emailOptInBestaetigtAm: null })
  })

  it('zweimal ist wie einmal; ohne Abo dieselbe Antwort — und es entsteht keines', async () => {
    const { farm } = await erstelleHof()
    const email = `${intKennung('kundin')}@example.com`
    const vorhanden = await abo(farm.id, email)
    const token = generateUnsubscribeToken(email, farm.id)

    const erste = await POST(einKlick(token))
    const zweite = await POST(einKlick(token))
    const ohneAbo = await POST(einKlick(generateUnsubscribeToken(`${intKennung('niemand')}@example.com`, farm.id)))

    for (const antwort of [erste, zweite, ohneAbo]) {
      expect(antwort.status).toBe(200)
      expect(await antwort.json()).toEqual({ ok: true })
    }
    expect(await stand(vorhanden.id)).toMatchObject({ optInEmail: false, optInWhatsApp: false })
    expect(await prisma.customerFarmSubscription.count({ where: { farmId: farm.id } })).toBe(1)
  })

  it('ein falscher Token ändert nichts', async () => {
    const { farm } = await erstelleHof()
    const email = `${intKennung('kundin')}@example.com`
    const vorhanden = await abo(farm.id, email)
    const token = generateUnsubscribeToken(email, farm.id)

    const antwort = await POST(einKlick(`${token.slice(0, -2)}00`))

    expect(antwort.status).toBe(400)
    expect(await stand(vorhanden.id)).toMatchObject({ optInEmail: true, optInWhatsApp: true })
  })
})

describe('GET /api/abmelden', () => {
  it('ändert nichts — es leitet nur zur Seite mit dem Knopf', async () => {
    const { farm } = await erstelleHof()
    const email = `${intKennung('kundin')}@example.com`
    const vorhanden = await abo(farm.id, email, { emailOptInAngefragtAm: new Date() })
    const token = generateUnsubscribeToken(email, farm.id)

    const antwort = GET(new NextRequest(`http://localhost/api/abmelden?token=${encodeURIComponent(token)}`))

    expect(antwort.status).toBe(303)
    expect(new URL(antwort.headers.get('location')!).pathname).toBe('/account/unsubscribe')
    const nachher = await stand(vorhanden.id)
    expect(nachher).toMatchObject({ optInEmail: true, optInWhatsApp: true })
    expect(nachher.emailOptInAngefragtAm).toBeInstanceOf(Date)
  })
})
