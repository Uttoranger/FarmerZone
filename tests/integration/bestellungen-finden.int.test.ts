/**
 * „Bestellungen finden" gegen ein ECHTES Postgres (Nr. 14, E7/E8, S4/S5):
 * Server Actions und Datenbankschicht echt, nur Mail, Sentry, Request-Kontext
 * und der Nachlauf sind gemockt. Die Tabellen sind die Aussage.
 *
 * Beweist:
 *  - Beim Finden entsteht KEIN User, KEINE Session, KEIN Account — weder für
 *    eine neue Adresse noch für eine mit ruhendem Konto noch für einen Hof.
 *    Es entsteht nur die Code-Zeile (und nach dem Code der Cookie).
 *  - Ein Hof bekommt keine Sonderbehandlung (gleiche Antwort, Code, Mail) —
 *    und sein Passwort-Konto bleibt unberührt.
 *  - Der Code liegt nur als HMAC in der Datenbank, Zähler 0, 10 Minuten.
 *  - Falsche Codes zählen IN DER DATENBANK, auch über zwei frisch geladene
 *    Instanzen; nach 5 Fehlversuchen nimmt auch der richtige nicht mehr an.
 *    Gegenprobe: nach 4 nimmt er an — genau einmal.
 *  - Gleichzeitige Fehlversuche: Jeder zählt (Zeilensperre), nie mehr als 5.
 *  - Abgelaufen: nimmt nicht an, die Zeile fällt weg (Frist beim Lesen).
 *  - Die Liste: nur Bestellungen der bewiesenen Adresse, auch in anderer
 *    Schreibweise gespeichert; nicht die einer anderen Adresse, nicht über
 *    „_" als Platzhalter, nicht über customerId (ruhendes Konto).
 *  - Frist beim Lesen: Eine verfallene Bar-Bestellung steht danach storniert da.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { erstelleHof, erstelleHofMitAnmeldung, intKennung, raeumeAuf } from './setup/basis'
import type { OrderStatus, PaymentMethod } from '@prisma/client'

vi.mock('server-only', () => ({}))

const kontext = vi.hoisted(() => ({
  gesetzt: [] as Array<{ name: string; value: string }>,
  nachlauf: [] as Array<() => Promise<void>>,
  codes: [] as Array<{ email: string; code: string }>,
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '203.0.113.7' })),
  cookies: vi.fn(async () => ({ set: (wert: { name: string; value: string }) => kontext.gesetzt.push(wert) })),
}))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => kontext.nachlauf.push(aufgabe),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendBestellCodeEmail: vi.fn(async (email: string, code: string) => {
    kontext.codes.push({ email, code })
    return { id: 'int-mail' }
  }),
  sendBestellungVerfallen: vi.fn(async () => {}),
}))

type Aktionen = typeof import('@/server/actions/bestellungen-finden')
type Server = typeof import('@/server/bestellungen-finden')

let aktionen: Aktionen
let instanzA: Server
let instanzB: Server

beforeAll(async () => {
  aktionen = await import('@/server/actions/bestellungen-finden')
  instanzA = await import('@/server/bestellungen-finden')
  // Eine zweite, frisch geladene Instanz — gemeinsam ist nur die Datenbank.
  vi.resetModules()
  instanzB = await import('@/server/bestellungen-finden')
})

afterEach(async () => {
  kontext.gesetzt = []
  kontext.nachlauf = []
  kontext.codes = []
  await prisma.verification.deleteMany({ where: { identifier: { startsWith: 'bestellungen-finden-otp-int-' } } })
  await raeumeAuf()
})

async function arbeiteNachlaufAb(): Promise<void> {
  while (kontext.nachlauf.length > 0) await kontext.nachlauf.shift()?.()
}

function neueAdresse(was = 'kundin'): string {
  return `${intKennung(was)}@example.com`
}

async function zaehleKonten(): Promise<{ user: number; session: number; account: number }> {
  return { user: await prisma.user.count(), session: await prisma.session.count(), account: await prisma.account.count() }
}

/** Fordert über die Action einen Code an und holt ihn aus der (gemockten) Mail. */
async function holeCode(email: string): Promise<string> {
  expect(await aktionen.fordereBestellCodeAn({ email })).toEqual({ ok: true })
  await arbeiteNachlaufAb()
  const mail = kontext.codes.filter((c) => c.email === email.trim().toLowerCase()).at(-1)
  if (!mail) throw new Error('kein Code verschickt')
  return mail.code
}

async function codeZeile(email: string) {
  return prisma.verification.findFirst({ where: { identifier: `bestellungen-finden-otp-${email}` } })
}

let bestellZaehler = 0
async function legeBestellungAn(
  farmId: string,
  customerEmail: string,
  teil: { status?: OrderStatus; paymentMethod?: PaymentMethod; createdAt?: Date; pickupDate?: Date; customerId?: string } = {}
) {
  bestellZaehler += 1
  return prisma.order.create({
    data: {
      orderNumber: intKennung(`nr${bestellZaehler}`).toUpperCase(),
      farmId,
      customerEmail,
      customerName: 'Erika Mustermann',
      customerPhone: '+43 660 0000000',
      status: teil.status ?? 'PAID',
      paymentMethod: teil.paymentMethod ?? 'ONLINE',
      paymentStatus: teil.status === 'PAID' || teil.status === undefined ? 'PAID' : 'PENDING',
      totalAmount: 10,
      serviceFeeCents: 50,
      pickupDate: teil.pickupDate ?? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      customerId: teil.customerId,
      ...(teil.createdAt ? { createdAt: teil.createdAt } : {}),
    },
  })
}

describe('kein Konto, keine Sitzung', () => {
  it('neue Adresse: Code anfordern und prüfen legt weder User noch Session noch Account an', async () => {
    const email = neueAdresse()
    const vorher = await zaehleKonten()

    const code = await holeCode(email)
    expect(await aktionen.zeigeBestellungen({ email, code })).toEqual({ ok: true })

    expect(await zaehleKonten()).toEqual(vorher)
    expect(await prisma.user.findFirst({ where: { email } })).toBeNull()
    // Entstanden ist nur der Cookie — und die Code-Zeile ist verbraucht.
    expect(kontext.gesetzt.map((k) => k.name)).toEqual(['fz-bestellungen'])
    expect(await codeZeile(email)).toBeNull()
  })

  it('Adresse mit ruhendem Kundenkonto (aus dem Checkout): keine neue Session, das Konto bleibt, wie es war', async () => {
    const email = neueAdresse()
    const konto = await prisma.user.create({ data: { id: intKennung('konto'), email, name: 'Erika Mustermann', role: 'CUSTOMER', emailVerified: false } })
    const vorher = await zaehleKonten()

    const code = await holeCode(email)
    expect(await aktionen.zeigeBestellungen({ email, code })).toEqual({ ok: true })

    expect(await zaehleKonten()).toEqual(vorher)
    expect(await prisma.session.count({ where: { userId: konto.id } })).toBe(0)
    expect(await prisma.user.findUniqueOrThrow({ where: { id: konto.id } })).toMatchObject({ emailVerified: false })
  })

  it('Hof-Adresse: keine Sonderbehandlung (Antwort, Code, Mail wie bei jeder Adresse) — Passwort und Sitzungen bleiben unberührt', async () => {
    const { ownerId, farm } = await erstelleHofMitAnmeldung()
    const email = farm.email
    const sitzungenVorher = await prisma.session.count({ where: { userId: ownerId } })
    const passwortVorher = (await prisma.account.findFirstOrThrow({ where: { userId: ownerId, providerId: 'credential' } })).password
    const vorher = await zaehleKonten()

    const code = await holeCode(email)
    expect(kontext.codes.map((c) => c.email)).toEqual([email])
    expect(await codeZeile(email)).not.toBeNull()
    expect(await aktionen.zeigeBestellungen({ email, code })).toEqual({ ok: true })

    expect(await zaehleKonten()).toEqual(vorher)
    expect(await prisma.session.count({ where: { userId: ownerId } })).toBe(sitzungenVorher)
    expect((await prisma.account.findFirstOrThrow({ where: { userId: ownerId, providerId: 'credential' } })).password).toBe(passwortVorher)
  })
})

describe('der Code in der Datenbank', () => {
  it('liegt nur als Hash, mit Zähler 0 und 10 Minuten Laufzeit', async () => {
    const email = neueAdresse()
    const vorher = Date.now()
    const code = await holeCode(email)
    const zeile = await codeZeile(email)
    expect(zeile).not.toBeNull()
    expect(zeile?.value).not.toContain(code)
    expect(zeile?.value).toMatch(/^[0-9a-f]{64}:0$/)
    const laufzeit = (zeile?.expiresAt.getTime() ?? 0) - vorher
    expect(laufzeit).toBeGreaterThan(9 * 60_000)
    expect(laufzeit).toBeLessThanOrEqual(10 * 60_000 + 5_000)
  })

  it('ein neuer Code ersetzt den alten — der alte nimmt nicht mehr an', async () => {
    const email = neueAdresse()
    const alt = await holeCode(email)
    const neu = await holeCode(email)
    expect(await prisma.verification.count({ where: { identifier: `bestellungen-finden-otp-${email}` } })).toBe(1)
    if (alt !== neu) expect(await instanzA.pruefeBestellCode(email, alt)).toEqual({ ok: false, fehler: 'INVALID_OTP' })
    expect(await instanzA.pruefeBestellCode(email, neu)).toEqual({ ok: true })
  })

  it('der Code gilt nur für seine Adresse', async () => {
    const email = neueAdresse()
    const andere = neueAdresse('andere')
    const code = await holeCode(email)
    await holeCode(andere)
    expect(await instanzA.pruefeBestellCode(andere, code)).toMatchObject({ ok: false })
  })
})

describe('Versuche zählen in der Datenbank (S4)', () => {
  const falsch = (code: string) => (code === '000000' ? '111111' : '000000')

  it('3 Fehlversuche auf A, 2 auf B → 5 in der Zeile; danach nimmt B auch den richtigen nicht', async () => {
    const email = neueAdresse()
    const code = await holeCode(email)
    for (let i = 0; i < 3; i += 1) expect(await instanzA.pruefeBestellCode(email, falsch(code))).toEqual({ ok: false, fehler: 'INVALID_OTP' })
    expect((await codeZeile(email))?.value).toMatch(/:3$/)
    for (let i = 0; i < 2; i += 1) expect(await instanzB.pruefeBestellCode(email, falsch(code))).toEqual({ ok: false, fehler: 'INVALID_OTP' })
    expect((await codeZeile(email))?.value).toMatch(/:5$/)

    expect(await instanzB.pruefeBestellCode(email, code)).toEqual({ ok: false, fehler: 'TOO_MANY_ATTEMPTS' })
    expect(await aktionen.zeigeBestellungen({ email, code })).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' })
    expect(kontext.gesetzt).toEqual([])
  })

  it('Gegenprobe: nach 4 Fehlversuchen nimmt der richtige Code an — genau einmal', async () => {
    const email = neueAdresse()
    const code = await holeCode(email)
    for (let i = 0; i < 4; i += 1) await instanzA.pruefeBestellCode(email, falsch(code))
    expect(await instanzB.pruefeBestellCode(email, code)).toEqual({ ok: true })
    expect(await instanzA.pruefeBestellCode(email, code)).toEqual({ ok: false, fehler: 'INVALID_OTP' })
  })

  it('gleichzeitige Fehlversuche zählen alle — nie mehr als 5 kommen durch', async () => {
    const email = neueAdresse()
    const code = await holeCode(email)
    const antworten = await Promise.all(
      Array.from({ length: 8 }, (_, i) => (i % 2 === 0 ? instanzA : instanzB).pruefeBestellCode(email, falsch(code)))
    )
    // Zustand, nicht Weg: Welche Anfrage welche Antwort bekam, entscheidet die Maschine.
    expect(antworten.every((a) => !a.ok)).toBe(true)
    expect(antworten.filter((a) => !a.ok && a.fehler === 'INVALID_OTP')).toHaveLength(5)
    expect((await codeZeile(email))?.value).toMatch(/:5$/)
    expect(await instanzA.pruefeBestellCode(email, code)).toEqual({ ok: false, fehler: 'TOO_MANY_ATTEMPTS' })
  })

  it('abgelaufen: nimmt nicht an, die Zeile fällt weg', async () => {
    const email = neueAdresse()
    const code = await holeCode(email)
    await prisma.verification.updateMany({
      where: { identifier: `bestellungen-finden-otp-${email}` },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    })
    expect(await aktionen.zeigeBestellungen({ email, code })).toMatchObject({ code: 'OTP_EXPIRED' })
    expect(await codeZeile(email)).toBeNull()
    expect(kontext.gesetzt).toEqual([])
  })
})

describe('die Liste: nur die bewiesene Adresse', () => {
  it('eigene Bestellungen, auch groß geschrieben gespeichert — nicht die einer anderen Adresse', async () => {
    const { farm } = await erstelleHof()
    const email = neueAdresse()
    const andere = neueAdresse('andere')
    const eigen = await legeBestellungAn(farm.id, email)
    const grossGeschrieben = await legeBestellungAn(farm.id, email.toUpperCase())
    await legeBestellungAn(farm.id, andere)

    const liste = await instanzA.ladeBestellungenZurAdresse(email)
    expect(liste.map((b) => b.id).sort()).toEqual([eigen.id, grossGeschrieben.id].sort())
    expect(liste[0]).toMatchObject({ hofName: 'Hof Test', gesamtCents: 1050, artikel: 0 })
    expect(liste[0].link).toMatch(new RegExp(`^/${farm.slug}/confirm/[^?]+\\?sig=[0-9a-f]{64}$`))
  })

  it('„_" ist kein Platzhalter: a_b@ sieht die Bestellungen von axb@ nicht (Gegenprobe: die eigenen schon)', async () => {
    const { farm } = await erstelleHof()
    const stamm = intKennung('kundin')
    const mitUnterstrich = `${stamm}-a_b@example.com`
    const fremd = await legeBestellungAn(farm.id, `${stamm}-axb@example.com`)
    const eigen = await legeBestellungAn(farm.id, mitUnterstrich)

    const liste = await instanzA.ladeBestellungenZurAdresse(mitUnterstrich)
    expect(liste.map((b) => b.id)).toEqual([eigen.id])
    expect(liste.map((b) => b.id)).not.toContain(fremd.id)
  })

  it('nicht über customerId: das ruhende Konto einer Adresse holt keine Bestellung mit anderer Mail-Adresse', async () => {
    const { farm } = await erstelleHof()
    const email = neueAdresse()
    const konto = await prisma.user.create({ data: { id: intKennung('konto'), email, name: 'Erika Mustermann', role: 'CUSTOMER' } })
    const anderswohin = await legeBestellungAn(farm.id, neueAdresse('andere'), { customerId: konto.id })

    const liste = await instanzA.ladeBestellungenZurAdresse(email)
    expect(liste.map((b) => b.id)).not.toContain(anderswohin.id)
  })

  it('Frist beim Lesen: eine verfallene Bar-Bestellung steht danach storniert da', async () => {
    const { farm } = await erstelleHof()
    const email = neueAdresse()
    const verfallen = await legeBestellungAn(farm.id, email, {
      status: 'PENDING_CONFIRMATION',
      paymentMethod: 'ONSITE_CASH',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    })

    const liste = await instanzA.ladeBestellungenZurAdresse(email)
    expect(liste.find((b) => b.id === verfallen.id)?.status).toBe('CANCELLED')
    expect((await prisma.order.findUniqueOrThrow({ where: { id: verfallen.id } })).status).toBe('CANCELLED')
  })
})
