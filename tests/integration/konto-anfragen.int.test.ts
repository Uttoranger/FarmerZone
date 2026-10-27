/**
 * Konto-Anfragen und Team (Register N35, N36; Nachtlauf Nr. 190) gegen ein
 * ECHTES Postgres — mit echter Admin-Anmeldung (Passkey frisch), echter
 * Admin-Wache, echten Einmal-Links und echter Anmeldung (Better Auth).
 *
 * Beweist:
 *  - E-Mail ändern: Link aus der Mail an die NEUE Adresse; Bestätigen setzt
 *    Adresse und „bestätigt“, meldet alle Geräte ab, die alte Adresse bekommt
 *    den Hinweis mit „Das war ich nicht“; der Link gilt einmal und 24 Stunden;
 *    die Adresse eines anderen Kontos: dieselbe Antwort, kein Link;
 *  - Schließen: offene Bestellung → gesperrt; sonst Hofseite weg (null),
 *    Anmelden scheitert GLEICH wie ein falsches Passwort, Abos aus, Protokoll;
 *    Wieder öffnen → Hofseite und Anmelden wieder da;
 *  - Stufe 2: mit `false` (Code-Wert) passiert nichts; mit `true` per
 *    Test-Einstellung wird der Hof unkenntlich — Bestellung, Positionen und
 *    Beträge bleiben;
 *  - Team: ein Nicht-Inhaber ändert das Team nicht (Satz der Wache); der
 *    letzte Inhaber ist nicht entfernbar; Einladen setzt `adminSeit`.
 *
 * Testdaten mit Präfix int- (raeumeAuf); was Stufe 2 umbenennt und die
 * Protokollzeilen räumt der Test selbst ab. Mails gestellt.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendEmailAendernLink: vi.fn(async () => ({ id: 'm-1' })),
  sendEmailGeaendertHinweis: vi.fn(async () => ({ id: 'm-2' })),
  sendTeamRechtGeaendert: vi.fn(async () => ({ id: 'm-3' })),
  sendNeueAnmeldungEmail: vi.fn(async () => ({ id: 'm-4' })),
}))

import { headers } from 'next/headers'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { env } from '@/lib/env'
import { DB_BREMSEN, adressMerkmal, bremsSchluessel } from '@/lib/bremse-datenbank'
import { sendEmailAendernLink, sendEmailGeaendertHinweis } from '@/lib/email'
import { aendereAnmeldeEmail, bestaetigeEmailAenderung, oeffneKontoWieder, schliesseKonto } from '@/server/actions/konto-anfragen'
import { entfernePerson, ladePersonEin, setzeInhaber, setzeTeamRechte } from '@/server/actions/team'
import { getPublicFarm } from '@/server/queries/farm'
import { schliesseFaelligeEndgueltig } from '@/lib/konto-schliessen'
import { EMAIL_BESTAETIGEN_TEXT } from '@/lib/konto-anfragen'
import { ADMIN_RECHT_FEHLER } from '@/lib/admin-rechte'
import { TEAM_TEXT } from '@/lib/admin-team'
import { erstelleHof, erstelleHofMitAnmeldung, erstelleProdukt, intKennung, machePasskeyAdmin, raeumeAuf } from './setup/basis'

const PASSWORT = 'test-passwort-1234'
const HERKUNFT = 'http://localhost:3000'
const bezuege: string[] = []
const adressen: string[] = []
const umbenannt: { farmIds: string[]; userIds: string[] } = { farmIds: [], userIds: [] }

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  await prisma.adminAktion.deleteMany({ where: { bezugId: { in: bezuege.splice(0) } } })
  await prisma.rateLimitZaehler.deleteMany({
    where: { schluessel: { in: adressen.splice(0).map((a) => bremsSchluessel(env.BETTER_AUTH_SECRET, DB_BREMSEN.passwortFehler.zweck, adressMerkmal(a))) } },
  })
  // Stufe 2 nimmt dem Hof das Präfix (Slug, Adresse) — die Zeilen gehen hier.
  if (umbenannt.farmIds.length > 0) {
    await prisma.order.deleteMany({ where: { farmId: { in: umbenannt.farmIds } } })
    await prisma.product.deleteMany({ where: { farmId: { in: umbenannt.farmIds } } })
    await prisma.farm.deleteMany({ where: { id: { in: umbenannt.farmIds.splice(0) } } })
    await prisma.user.deleteMany({ where: { id: { in: umbenannt.userIds.splice(0) } } })
  }
  await raeumeAuf()
})

async function alsAdmin(): Promise<{ adminId: string; cookie: string }> {
  const { ownerId, cookie } = await erstelleHofMitAnmeldung()
  await machePasskeyAdmin(ownerId)
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return { adminId: ownerId, cookie }
}

async function anmelden(email: string, password: string): Promise<{ status: number; text: string }> {
  adressen.push(email)
  const antwort = await auth.handler(
    new Request(`${HERKUNFT}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: HERKUNFT },
      body: JSON.stringify({ email, password }),
    })
  )
  return { status: antwort.status, text: await antwort.text() }
}

async function bestellung(farmId: string, productId: string, status: 'READY' | 'PICKED_UP'): Promise<string> {
  const o = await prisma.order.create({
    data: {
      orderNumber: intKennung('nr'),
      farmId,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Mia Musterkundin',
      customerPhone: '+43 660 0000000',
      status,
      totalAmount: new Prisma.Decimal('7.00'),
      pickupDate: new Date(),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONSITE_CASH',
      items: { create: [{ productId, productName: 'Eier', unitPrice: new Prisma.Decimal('3.50'), quantity: 2, totalPrice: new Prisma.Decimal('7.00'), vatRate: new Prisma.Decimal('10') }] },
    },
    select: { id: true },
  })
  return o.id
}

const linkAusMail = (aufruf: number): string => {
  const link = vi.mocked(sendEmailAendernLink).mock.calls[aufruf][1].link
  return new URL(link).searchParams.get('t') ?? ''
}

describe('Anmelde-E-Mail ändern', () => {
  it('Link an die neue Adresse; Bestätigen setzt sie, meldet ab und schickt der alten den Hinweis; einmal gültig', async () => {
    await alsAdmin()
    const { farm, ownerId } = await erstelleHofMitAnmeldung()
    bezuege.push(farm.id)
    const alt = (await prisma.user.findUniqueOrThrow({ where: { id: ownerId } })).email
    const neu = `${intKennung('neu')}@example.com`
    expect(await prisma.session.count({ where: { userId: ownerId } })).toBe(1)

    expect(await aendereAnmeldeEmail({ farmId: farm.id, neueAdresse: neu, grund: 'Anfrage im Postfach' })).toEqual({ ok: true })
    expect(vi.mocked(sendEmailAendernLink).mock.calls.at(-1)?.[0]).toBe(neu)
    const token = linkAusMail(vi.mocked(sendEmailAendernLink).mock.calls.length - 1)
    const link = await prisma.einmalLink.findFirstOrThrow({ where: { userId: ownerId, zweck: { startsWith: 'email-aendern:' } } })
    expect(link.zweck).not.toContain(neu)
    expect(link.ablaufAm.getTime() - Date.now()).toBeLessThanOrEqual(24 * 3600_000)
    // Bis zum Klick bleibt alles, wie es ist.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ownerId } })).email).toBe(alt)

    // Falsche Adresse: der Link bleibt gültig.
    expect(await bestaetigeEmailAenderung({ token, adresse: `${intKennung('anders')}@example.com` })).toEqual({ error: EMAIL_BESTAETIGEN_TEXT.falscheAdresse })

    expect(await bestaetigeEmailAenderung({ token, adresse: neu.toUpperCase() })).toEqual({ ok: true })
    const konto = await prisma.user.findUniqueOrThrow({ where: { id: ownerId } })
    expect(konto.email).toBe(neu)
    expect(konto.emailVerified).toBe(true)
    expect(await prisma.session.count({ where: { userId: ownerId } })).toBe(0)
    expect(vi.mocked(sendEmailGeaendertHinweis).mock.calls.at(-1)?.[0]).toBe(alt)
    expect(vi.mocked(sendEmailGeaendertHinweis).mock.calls.at(-1)?.[1].link).toContain('/sicherheit/nicht-ich?t=')
    expect((await prisma.adminAktion.findMany({ where: { bezugId: farm.id } })).map((e) => e.art).sort()).toEqual(['anmelde_email_angefragt', 'anmelde_email_geaendert'])

    // Einmal: ein zweiter Klick findet nichts mehr.
    expect(await bestaetigeEmailAenderung({ token, adresse: neu })).toEqual({ error: EMAIL_BESTAETIGEN_TEXT.ungueltigTitel, ungueltig: true })
  })

  it('nach 24 Stunden gilt der Link nicht mehr', async () => {
    await alsAdmin()
    const { farm, ownerId } = await erstelleHofMitAnmeldung()
    bezuege.push(farm.id)
    const neu = `${intKennung('neu')}@example.com`
    await aendereAnmeldeEmail({ farmId: farm.id, neueAdresse: neu, grund: 'Anfrage im Postfach' })
    const token = linkAusMail(vi.mocked(sendEmailAendernLink).mock.calls.length - 1)
    await prisma.einmalLink.updateMany({ where: { userId: ownerId, zweck: { startsWith: 'email-aendern:' } }, data: { ablaufAm: new Date(Date.now() - 1000) } })
    expect(await bestaetigeEmailAenderung({ token, adresse: neu })).toEqual({ error: EMAIL_BESTAETIGEN_TEXT.ungueltigTitel, ungueltig: true })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ownerId } })).email).not.toBe(neu)
  })

  it('Adresse eines anderen Kontos: dieselbe Antwort, kein Link, keine Mail', async () => {
    await alsAdmin()
    const { farm, ownerId } = await erstelleHofMitAnmeldung()
    const { owner: anderes } = await erstelleHof()
    bezuege.push(farm.id)
    const vorher = vi.mocked(sendEmailAendernLink).mock.calls.length
    expect(await aendereAnmeldeEmail({ farmId: farm.id, neueAdresse: anderes.email.toUpperCase(), grund: 'Anfrage im Postfach' })).toEqual({ ok: true })
    expect(vi.mocked(sendEmailAendernLink).mock.calls.length).toBe(vorher)
    expect(await prisma.einmalLink.count({ where: { userId: ownerId, zweck: { startsWith: 'email-aendern:' } } })).toBe(0)
  })
})

describe('Konto schließen', () => {
  it('offene Bestellung sperrt; sonst offline, Anmelden wie falsches Passwort, Abos aus; Wieder öffnen holt alles zurück', async () => {
    await alsAdmin()
    const { farm, ownerId } = await erstelleHofMitAnmeldung()
    bezuege.push(farm.id)
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: ownerId } })).email
    const eier = await erstelleProdukt(farm.id, { stock: 10 })
    const offen = await bestellung(farm.id, eier.id, 'READY')
    await prisma.customerFarmSubscription.create({ data: { customerEmail: `${intKennung('abo')}@example.com`, farmId: farm.id, optInEmail: true } })

    const gesperrt = await schliesseKonto({ farmId: farm.id, grund: 'Hof hört auf', hofname: farm.name })
    expect(gesperrt).toEqual({ error: expect.stringContaining('1 Bestellung ist noch offen') })
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).geschlossenAm).toBeNull()

    await prisma.order.update({ where: { id: offen }, data: { status: 'PICKED_UP' } })
    expect(await getPublicFarm(farm.slug)).not.toBeNull()
    expect(await schliesseKonto({ farmId: farm.id, grund: 'Hof hört auf', hofname: farm.name })).toEqual({ ok: true })

    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).geschlossenAm).not.toBeNull()
    expect(await getPublicFarm(farm.slug)).toBeNull()
    expect(await prisma.session.count({ where: { userId: ownerId } })).toBe(0)
    expect(await prisma.customerFarmSubscription.count({ where: { farmId: farm.id, optInEmail: true } })).toBe(0)

    // Anmelden mit dem RICHTIGEN Passwort antwortet wie ein falsches bei einem offenen Konto.
    const { owner: kunde } = await erstelleHof()
    const geschlossen = await anmelden(email, PASSWORT)
    const falsch = await anmelden(kunde.email, 'falsch-passwort-1234')
    expect(geschlossen.status).toBe(401)
    expect(geschlossen).toEqual(falsch)

    expect(await oeffneKontoWieder({ farmId: farm.id, grund: 'Doch weiter' })).toEqual({ ok: true })
    expect(await getPublicFarm(farm.slug)).not.toBeNull()
    expect((await anmelden(email, PASSWORT)).status).toBe(200)
    expect((await prisma.adminAktion.findMany({ where: { bezugId: farm.id }, orderBy: { wann: 'asc' } })).map((e) => e.art)).toEqual(['konto_geschlossen', 'konto_wieder_geoeffnet'])
  })
})

describe('Konto schließen, Stufe 2', () => {
  it('mit dem Code-Wert (false) nichts; mit true per Test-Einstellung unkenntlich — Bestellung und Beträge bleiben', async () => {
    const { farm, owner } = await erstelleHof()
    const eier = await erstelleProdukt(farm.id, { stock: 10 })
    const best = await bestellung(farm.id, eier.id, 'PICKED_UP')
    await prisma.farmPhoto.create({ data: { farmId: farm.id, url: 'https://example.com/foto.webp', sortOrder: 0 } })
    await prisma.farm.update({ where: { id: farm.id }, data: { geschlossenAm: new Date(Date.now() - 31 * 86_400_000) } })
    const jetzt = new Date()
    const blob = { liste: vi.fn(async (prefix: string) => [`https://example.com/${prefix}a.webp`]), loesche: vi.fn(async () => undefined) }

    expect(await schliesseFaelligeEndgueltig(jetzt, { blob })).toBe(0)
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).endgueltigAm).toBeNull()

    expect(await schliesseFaelligeEndgueltig(jetzt, { freigegeben: true, blob })).toBeGreaterThanOrEqual(1)
    umbenannt.farmIds.push(farm.id)
    umbenannt.userIds.push(owner.id)
    const hof = await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })
    expect(hof).toMatchObject({ name: 'Geschlossener Hof', phone: '', email: '', address: '', ownerName: '', logoUrl: null })
    expect(hof.endgueltigAm).not.toBeNull()
    expect(await prisma.farmPhoto.count({ where: { farmId: farm.id } })).toBe(0)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).email).toMatch(/@geschlossen\.invalid$/)
    expect(blob.loesche).toHaveBeenCalledWith([`https://example.com/originals/${farm.id}/a.webp`, `https://example.com/farms/${farm.id}/a.webp`])

    const bleibt = await prisma.order.findUniqueOrThrow({ where: { id: best }, include: { items: true } })
    expect(bleibt.totalAmount.toFixed(2)).toBe('7.00')
    expect(bleibt.items.map((i) => [i.productName, i.quantity, i.totalPrice.toFixed(2)])).toEqual([['Eier', 2, '7.00']])

    // Ein zweiter Lauf ändert nichts mehr.
    expect(await schliesseFaelligeEndgueltig(jetzt, { freigegeben: true, blob })).toBe(0)
  })
})

describe('Team', () => {
  it('Einladen setzt adminSeit; Nicht-Inhaber ändert nichts; den letzten Inhaber kann niemand entfernen', async () => {
    const { adminId, cookie: inhaberKeks } = await alsAdmin()
    bezuege.push(adminId)
    const andereInhaber = await prisma.user.count({ where: { isAdmin: true, adminInhaber: true, id: { not: adminId } } })

    const { ownerId: helferId, cookie: helferKeks } = await erstelleHofMitAnmeldung()
    bezuege.push(helferId)
    const helfer = await prisma.user.findUniqueOrThrow({ where: { id: helferId } })
    const vorher = Date.now()
    expect(await ladePersonEin({ adresse: helfer.email })).toEqual({ ok: true })
    const eingeladen = await prisma.user.findUniqueOrThrow({ where: { id: helferId } })
    expect(eingeladen).toMatchObject({ isAdmin: true, adminInhaber: false, adminRechte: [] })
    expect(eingeladen.adminSeit?.getTime()).toBeGreaterThanOrEqual(vorher - 1000)
    // Unbekannte Adresse: dieselbe Antwort.
    expect(await ladePersonEin({ adresse: `${intKennung('niemand')}@example.com` })).toEqual({ ok: true })

    // Der Helfer (mit Passkey, ohne Inhaber) versucht, das Team zu ändern → Satz der Wache, nichts geändert.
    await machePasskeyAdmin(helferId)
    await prisma.user.update({ where: { id: helferId }, data: { adminInhaber: false } })
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie: helferKeks }) as never)
    expect(await setzeTeamRechte({ userId: helferId, rechte: ['geld'] })).toEqual({ error: ADMIN_RECHT_FEHLER })
    expect(await setzeInhaber({ userId: helferId, inhaber: true })).toEqual({ error: ADMIN_RECHT_FEHLER })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: helferId } })).adminInhaber).toBe(false)

    vi.mocked(headers).mockResolvedValue(new Headers({ cookie: inhaberKeks }) as never)
    // Nur prüfbar, wenn keine parallele Datei gerade einen Inhaber angelegt hat (geteilte Test-DB); die Regel selbst prüft auch tests/team.test.ts.
    if (andereInhaber === 0 && (await prisma.user.count({ where: { isAdmin: true, adminInhaber: true, id: { not: adminId } } })) === 0) {
      expect(await entfernePerson({ userId: adminId })).toEqual({ error: TEAM_TEXT.letzterInhaber })
      expect(await setzeInhaber({ userId: adminId, inhaber: false })).toEqual({ error: TEAM_TEXT.letzterInhaber })
      expect((await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).adminInhaber).toBe(true)
    }
    // Gegenprobe: mit dem Helfer als zweitem Inhaber geht Entfernen des Helfers.
    expect(await setzeTeamRechte({ userId: helferId, rechte: ['geld', 'mails_nochmal'] })).toEqual({ ok: true })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: helferId } })).adminRechte).toEqual(['mails_nochmal', 'geld'])
    expect(await entfernePerson({ userId: helferId })).toEqual({ ok: true })
    expect(await prisma.user.findUniqueOrThrow({ where: { id: helferId } })).toMatchObject({ isAdmin: false, adminInhaber: false, adminRechte: [], adminSeit: null })
  })
})
