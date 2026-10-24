/**
 * „Alle Mails“ und „Nochmal schicken“ gegen ein ECHTES Postgres (Register
 * N27, S17, E7; Nr. 167; src/server/queries/mails.ts,
 * src/server/actions/betrieb.ts).
 *
 * Beweist, je mit Gegenprobe:
 *  - Liste: Filter (Art, Stand, Hof, nur vom Support), Seiten zu 50 über den
 *    Cursor, Kann warten nie einzeln, sondern als Summe je Beitrag;
 *  - Nochmal schicken: erlaubte Art → neue Zeile mit `nochmalVon`, Weg
 *    Wichtig, `ausloeser` support; das 4. Mal in 24 Stunden → abgelehnt, keine
 *    Zeile; Art aus NOCHMAL_NIE → abgelehnt; unpassender Stand → abgelehnt;
 *  - Bar-Link: neuer Hash gespeichert, alter Token ungültig, neuer gültig,
 *    Frist (createdAt) unverändert, nur `confirmationToken` geändert; die
 *    Protokollzeile „vom Support“ zeigt auf die ursprüngliche; der Token steht
 *    in keiner Zeile von MailAuftrag; eine bestätigte Bestellung → abgelehnt.
 *
 * Resend ist eine Attrappe (kein Netz, keine echte Mail). Daten mit `int-`,
 * Adressen @example.com (erfunden). Danach weg.
 */
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { ALLE_MAILS_TEXT } from '@/lib/betrieb-mails'
import { barTokenHash, tokenKandidaten } from '@/lib/bar-bestaetigung'
import { alleMailsAus } from '@/schemas/betrieb-mails'
import { ALLE_SEITE, ladeAlleMails, ladeKannWartenSummen } from '@/server/queries/mails'
import { schickeMailNochmalAction } from '@/server/actions/betrieb'
import { erstelleHof, intKennung, raeumeAuf } from './setup/basis'

const erfasst = vi.hoisted(() => ({ tokens: [] as string[] }))

vi.mock('server-only', () => ({}))
vi.mock('@/server/admin-wache', () => ({
  verlangeAdminAktion: vi.fn(async () => ({ ok: true, userId: 'int-admin' })),
  verlangeFrischeBestaetigung: vi.fn(async () => ({ ok: true, userId: 'int-admin', sitzungId: 'int-sitzung' })),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
// Der Worker nach dem Einstellen läuft hier nicht — geprüft wird die neue Zeile.
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: vi.fn(async () => ({ data: { id: `re_int_${Date.now()}_${Math.random().toString(36).slice(2)}` }, error: null })) }
    batch = { send: vi.fn() }
  },
}))
// Den Token, den die Mail bekommt, mitschreiben — der echte Versand läuft weiter.
vi.mock('@/lib/email', async (original) => {
  const echt = await original<typeof import('@/lib/email')>()
  return {
    ...echt,
    sendOnsiteConfirmation: async (...args: Parameters<typeof echt.sendOnsiteConfirmation>) => {
      erfasst.tokens.push(args[1])
      return echt.sendOnsiteConfirmation(...args)
    },
  }
})

async function raeumeMailsAuf(): Promise<void> {
  await prisma.mailAuftrag.deleteMany({ where: { OR: [{ schluessel: { startsWith: 'int-' } }, { bestellungId: { startsWith: 'int-' } }, { farmId: { startsWith: 'int-' } }] } })
}

afterEach(async () => {
  erfasst.tokens = []
  await raeumeMailsAuf()
  await raeumeAuf()
})

afterAll(async () => {
  await raeumeMailsAuf()
})

async function bestellung(farmId: string, teil: Record<string, unknown> = {}) {
  return prisma.order.create({
    data: {
      id: intKennung('bestellung'),
      orderNumber: `K${process.pid % 100_000}-${Math.floor(Math.random() * 9000 + 1000)}-A4F2`,
      farmId,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Musterfrau',
      customerPhone: '+43 660 0000000',
      totalAmount: '20.00',
      pickupDate: new Date(Date.now() + 2 * 86_400_000),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      status: 'READY',
      ...teil,
    },
  })
}

async function auftrag(daten: { art: string; vorrang?: number; status?: string; bestellungId?: string | null; farmId?: string | null; bezug?: object | null; ausloeser?: string; nochmalVon?: string; erstelltAm?: Date }) {
  return prisma.mailAuftrag.create({
    data: {
      art: daten.art,
      vorrang: daten.vorrang ?? 1,
      schluessel: intKennung('mail'),
      status: daten.status ?? 'gesendet',
      bestellungId: daten.bestellungId ?? null,
      farmId: daten.farmId ?? null,
      ...(daten.bezug ? { bezug: daten.bezug } : {}),
      ...(daten.ausloeser ? { ausloeser: daten.ausloeser } : {}),
      ...(daten.nochmalVon ? { nochmalVon: daten.nochmalVon } : {}),
      erstelltAm: daten.erstelltAm ?? new Date(Date.now() - 60_000),
      gesendetAm: new Date(),
    },
  })
}

const filter = (teil: Record<string, string> = {}) => alleMailsAus({ reiter: 'mails', liste: 'alle', ...teil }).filter

describe('Liste', () => {
  it('Filter nach Hof, Art, Stand und „nur vom Support“ — Kann warten nie einzeln', async () => {
    const { farm } = await erstelleHof()
    const b = await bestellung(farm.id)
    const a = await auftrag({ art: 'abholbereit', bestellungId: b.id, farmId: farm.id })
    await auftrag({ art: 'storniert', status: 'gescheitert', bestellungId: b.id, farmId: farm.id })
    await auftrag({ art: 'abholbereit', bestellungId: b.id, farmId: farm.id, ausloeser: 'support', nochmalVon: a.id })
    await auftrag({ art: 'beitrag', vorrang: 2, farmId: farm.id, bezug: { postId: 'int-post-1', aboId: 'int-abo-1' } })
    await auftrag({ art: 'beitrag', vorrang: 2, farmId: farm.id, bezug: { postId: 'int-post-1', aboId: 'int-abo-2' } })
    const jetzt = new Date()

    const alle = await ladeAlleMails(filter({ hof: farm.id }), null, jetzt)
    expect(alle.anzahl).toBe(3)
    expect(alle.zeilen.map((z) => z.art)).not.toContain('beitrag')
    expect(alle.bestellnummern.get(b.id)).toBe(b.orderNumber)
    expect((await ladeAlleMails(filter({ hof: farm.id, art: 'storniert' }), null, jetzt)).anzahl).toBe(1)
    expect((await ladeAlleMails(filter({ hof: farm.id, stand: 'gescheitert' }), null, jetzt)).zeilen.map((z) => z.art)).toEqual(['storniert'])
    expect((await ladeAlleMails(filter({ hof: farm.id, support: '1' }), null, jetzt)).zeilen.map((z) => z.nochmalVon)).toEqual([a.id])
    // Gegenprobe: ein Filter auf Kann warten zeigt keine Zeile — nur die Summe.
    expect((await ladeAlleMails(filter({ hof: farm.id, weg: 'kannWarten' }), null, jetzt)).anzahl).toBe(0)
    const summen = await ladeKannWartenSummen(filter({ hof: farm.id }), jetzt)
    expect(summen).toEqual([expect.objectContaining({ art: 'beitrag', gruppe: 'int-post-1', gesendet: 2 })])
  })

  it('Seiten zu 50 über den Cursor (erstelltAm, id), neueste zuerst', async () => {
    const { farm } = await erstelleHof()
    const basis = Date.now() - 3_600_000
    await prisma.mailAuftrag.createMany({
      data: Array.from({ length: ALLE_SEITE + 2 }, (_, i) => ({
        art: 'abholbereit',
        vorrang: 1,
        schluessel: intKennung('mail'),
        status: 'gesendet',
        farmId: farm.id,
        erstelltAm: new Date(basis + i * 1000),
      })),
    })
    const jetzt = new Date()
    const erste = await ladeAlleMails(filter({ hof: farm.id }), null, jetzt)
    expect(erste.zeilen).toHaveLength(ALLE_SEITE)
    expect(erste.anzahl).toBe(ALLE_SEITE + 2)
    expect(erste.weiter).not.toBeNull()
    const zweite = await ladeAlleMails(filter({ hof: farm.id }), { am: erste.weiter!.erstelltAm, id: erste.weiter!.id }, jetzt)
    expect(zweite.zeilen).toHaveLength(2)
    expect(zweite.weiter).toBeNull()
    const ids = new Set([...erste.zeilen, ...zweite.zeilen].map((z) => z.id))
    expect(ids.size).toBe(ALLE_SEITE + 2)
    expect(erste.zeilen[0].erstelltAm.getTime()).toBeGreaterThan(zweite.zeilen[1].erstelltAm.getTime())
  })
})

describe('Nochmal schicken', () => {
  it('erlaubte Art: neue Zeile mit nochmalVon, Weg Wichtig, vom Support — das 4. Mal in 24 Stunden abgelehnt', async () => {
    const { farm } = await erstelleHof()
    const b = await bestellung(farm.id)
    const a = await auftrag({ art: 'abholbereit', bestellungId: b.id, farmId: farm.id, bezug: { orderId: b.id } })

    for (let n = 1; n <= 3; n += 1) expect(await schickeMailNochmalAction({ id: a.id })).toEqual({ ok: true, satz: ALLE_MAILS_TEXT.unterwegs })
    const neu = await prisma.mailAuftrag.findMany({ where: { nochmalVon: a.id }, orderBy: { schluessel: 'asc' } })
    expect(neu.map((z) => [z.schluessel, z.vorrang, z.ausloeser, z.status, z.bestellungId, z.art])).toEqual([1, 2, 3].map((n) => [`nochmal:${a.id}:${n}`, 1, 'support', 'offen', b.id, 'abholbereit']))
    expect(neu[0].bezug).toEqual({ orderId: b.id })

    expect(await schickeMailNochmalAction({ id: a.id })).toEqual({ error: ALLE_MAILS_TEXT.grenze })
    expect(await prisma.mailAuftrag.count({ where: { nochmalVon: a.id } })).toBe(3)
  })

  it('Gegenprobe: Art aus NOCHMAL_NIE und unpassender Stand legen keine Zeile an', async () => {
    const { farm } = await erstelleHof()
    const b = await bestellung(farm.id, { status: 'CANCELLED' })
    const code = await auftrag({ art: 'anmeldecode', vorrang: 0, bestellungId: b.id })
    const bereit = await auftrag({ art: 'abholbereit', bestellungId: b.id, farmId: farm.id, bezug: { orderId: b.id } })
    expect(await schickeMailNochmalAction({ id: code.id })).toEqual({ error: ALLE_MAILS_TEXT.nieCode })
    expect(await schickeMailNochmalAction({ id: bereit.id })).toMatchObject({ error: expect.stringContaining('Passt nicht mehr') })
    expect(await prisma.mailAuftrag.count({ where: { nochmalVon: { in: [code.id, bereit.id] } } })).toBe(0)
  })
})

describe('Bar-Link nochmal', () => {
  it('neuer Hash, alter Token ungültig, neuer gültig, Frist unverändert, Token nie in MailAuftrag', async () => {
    const { farm } = await erstelleHof()
    const alt = 'altAltAltAltAltAltAltAltAltAlt12'
    const b = await bestellung(farm.id, { status: 'PENDING_CONFIRMATION', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', confirmationToken: barTokenHash(alt) })
    const vorher = await prisma.order.findUniqueOrThrow({ where: { id: b.id } })
    const erste = await auftrag({ art: 'bar-bestaetigungslink', vorrang: 0, bestellungId: b.id })

    expect(await schickeMailNochmalAction({ id: erste.id })).toEqual({ ok: true, satz: ALLE_MAILS_TEXT.unterwegs })
    expect(erfasst.tokens).toHaveLength(1)
    const neu = erfasst.tokens[0]

    const nachher = await prisma.order.findUniqueOrThrow({ where: { id: b.id } })
    expect(nachher.confirmationToken).toBe(barTokenHash(neu))
    expect(await prisma.order.count({ where: { confirmationToken: { in: tokenKandidaten(alt) } } })).toBe(0)
    expect(await prisma.order.count({ where: { id: b.id, confirmationToken: { in: tokenKandidaten(neu) } } })).toBe(1)
    // Nur confirmationToken hat sich geändert — Frist (createdAt), Stand, Zahlung bleiben.
    const ohneToken = (o: object) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'confirmationToken' && k !== 'updatedAt'))
    expect(ohneToken(nachher)).toEqual(ohneToken(vorher))

    const zeilen = await prisma.mailAuftrag.findMany({ where: { bestellungId: b.id } })
    const protokoll = zeilen.find((z) => z.nochmalVon === erste.id)
    expect(protokoll).toMatchObject({ art: 'bar-bestaetigungslink', vorrang: 0, ausloeser: 'support', farmId: farm.id })
    expect(JSON.stringify(zeilen)).not.toContain(neu)
    expect(JSON.stringify(zeilen)).not.toContain(barTokenHash(neu))
  })

  it('Gegenprobe: eine bestätigte Barbestellung bekommt keinen neuen Token und keine Mail', async () => {
    const { farm } = await erstelleHof()
    const alt = 'altAltAltAltAltAltAltAltAltAlt34'
    const b = await bestellung(farm.id, { status: 'CONFIRMED', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', confirmationToken: barTokenHash(alt) })
    const erste = await auftrag({ art: 'bar-bestaetigungslink', vorrang: 0, bestellungId: b.id })
    expect(await schickeMailNochmalAction({ id: erste.id })).toMatchObject({ error: expect.any(String) })
    expect(erfasst.tokens).toHaveLength(0)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: b.id } })).confirmationToken).toBe(barTokenHash(alt))
  })
})
