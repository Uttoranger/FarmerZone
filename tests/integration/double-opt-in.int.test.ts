/**
 * Double-Opt-in für werbliche Mails (Register S11, Nachtlauf Nr. 38) gegen ein
 * ECHTES Postgres.
 *
 * Die Aussage ist der ZUSTAND danach und welche Mails rausgehen:
 *  - Migration 20261007180000_double_opt_in: zwei nullable Spalten, ein
 *    Abo aus altem Code (rohes INSERT ohne die Spalten) gilt als Bestand und
 *    bekommt weiter Mails; ein zweiter Lauf ändert nichts.
 *  - Neue Anmeldung auf der Bestätigungsseite (seit Nr. 46, Register N2;
 *    vorher ein Haken im Checkout): Bestätigungsmail, aber keine werbliche
 *    Mail bis zur Bestätigung; der Bestand daneben bekommt seine Mail.
 *  - Bestätigung per Knopf mit dem Token aus der Mail → Mails, mit gültigem
 *    Abmeldelink; Abmelden wirkt.
 *  - Die Seite hinter dem Link (GET) bestätigt nicht; abgelaufener und
 *    manipulierter Token werden abgelehnt, nichts geschrieben.
 *  - Erneute Anmeldung: unbestätigt kurz danach keine zweite Mail, gleichzeitig
 *    nur eine; bestätigt keine neue Bestätigung; weder der Checkout noch die
 *    Anmeldung auf der Bestätigungsseite verraten, ob die Adresse schon
 *    abonniert ist.
 * Mails, Stripe und der Cache sind gemockt; der Nachlauf läuft ohne Request
 * sofort (nach-der-antwort.ts), deshalb `vi.waitFor`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendOnsiteConfirmation: vi.fn(),
  sendStatusUpdateEmail: vi.fn(),
  sendAboBestaetigung: vi.fn(async () => ({ id: 'mail-1' })),
  sendAnmeldeCodeEmail: vi.fn(async () => ({ id: 'mail-2' })),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`REDIRECT ${ziel}`)
  }),
}))
// /account: hier zählt, was die Seite übergibt, nicht die Darstellung.
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({ KundeShellMitSitzung: () => null }))
vi.mock('@/app/account/profile/profile-client', () => ({ ProfileClient: () => null }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { sendAboBestaetigung, sendStatusUpdateEmail } from '@/lib/email'
import { POST as checkout } from '@/app/api/checkout/route'
import { publishStatusPost } from '@/server/actions/status-posts'
import type { ReactElement } from 'react'
import { auth } from '@/lib/auth'
import { bestaetigeNeuigkeiten, unsubscribeWithToken, updateSubscription } from '@/server/actions/subscriptions'
import AccountProfilePage from '@/app/account/profile/page'
import { meldeEmailAboAn, EMAIL_ABO_STAND } from '@/server/abo-anmeldung'
import { meldeNeuigkeitenAn } from '@/server/actions/neuigkeiten'
import { ABO_BESTAETIGUNG_GUELTIG_MS } from '@/lib/abo-bestaetigung'
import { erzeugeAboBestaetigungsToken } from '@/lib/abo-bestaetigung-token'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe'
import NeuigkeitenBestaetigenPage from '@/app/account/neuigkeiten-bestaetigen/page'
import { checkoutAnfrage, erstelleHofMitAnmeldung, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

const MIGRATION = readFileSync(
  join(process.cwd(), 'prisma', 'migrations', '20261007180000_double_opt_in', 'migration.sql'),
  'utf8'
)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(sendAboBestaetigung).mockResolvedValue({ id: 'mail-1' })
})

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  await prisma.verification.deleteMany({ where: { identifier: { contains: 'otp-int-' } } })
  await raeumeAuf()
})

type Hof = { farm: { id: string; slug: string }; cookie: string }

/** Hof mit Anmeldung (für den Beitrag) und allem, was der Checkout verlangt (wie erstelleHof). */
async function hofMitAnmeldung(): Promise<Hof> {
  const { farm, cookie } = await erstelleHofMitAnmeldung({
    isActive: true,
    betriebsnummer: 'LFBIS 0000000',
    betriebsstatus: 'PRIMAERPRODUKTION',
    pickupSlots: {
      create: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '15:00', endTime: '18:00' })),
    },
  })
  return { farm, cookie }
}

/**
 * Bestellt eine Einheit bar und meldet sich — wenn gewünscht — danach auf der
 * Bestätigungsseite für „Neuigkeiten per E-Mail" an (seit Nr. 46 dort statt
 * als Haken im Checkout), mit dem signierten Pfad aus der Antwort.
 */
async function bestelle(hof: Hof, customerEmail: string, neuigkeiten: boolean): Promise<Response> {
  const produkt = await erstelleProdukt(hof.farm.id, { stock: 5 })
  const sitzung = intKennung('sitzung')
  await setzeHalt(produkt.id, sitzung, 1)
  const antwort = await checkout(
    checkoutAnfrage({
      farm: hof.farm,
      sessionId: sitzung,
      customerEmail,
      positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
    })
  )
  if (neuigkeiten) {
    expect(await meldeNeuigkeitenAn(await zugangAus(antwort.clone()))).toEqual({ ok: true })
  }
  return antwort
}

/** Kennung und Signatur aus dem signierten Pfad der Bestätigungsseite in der Checkout-Antwort. */
async function zugangAus(antwort: Response): Promise<{ orderId: string; sig: string }> {
  const { bestaetigung } = (await antwort.json()) as { bestaetigung: string }
  const url = new URL(bestaetigung, 'http://localhost')
  return { orderId: url.pathname.split('/').at(-1) ?? '', sig: url.searchParams.get('sig') ?? '' }
}

/** Veröffentlicht einen Beitrag mit Versand per Mail — als angemeldeter Hof. */
async function beitragPerMail(hof: Hof): Promise<{ emailCount?: number; error?: string }> {
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie: hof.cookie }) as never)
  return publishStatusPost({
    title: 'Frische Eier',
    body: 'Heute frisch gelegt.',
    anlass: 'FRESH_PRODUCT',
    showOnFarmPage: true,
    sendEmail: true,
    sendWhatsApp: false,
  })
}

function empfaengerDerBeitragsmails(): string[] {
  return vi.mocked(sendStatusUpdateEmail).mock.calls.map(([daten]) => daten.to)
}

/** Der Token aus dem Link der letzten Bestätigungsmail an diese Adresse. */
async function tokenAusDerMail(email: string): Promise<string> {
  await vi.waitFor(() => expect(vi.mocked(sendAboBestaetigung).mock.calls.some(([an]) => an === email)).toBe(true))
  const aufruf = vi.mocked(sendAboBestaetigung).mock.calls.filter(([an]) => an === email).at(-1)!
  const token = new URL(aufruf[1].url).searchParams.get('token')
  if (!token) throw new Error('Kein Token im Link')
  return token
}

async function bestandsAbo(farmId: string, email: string): Promise<void> {
  await prisma.customerFarmSubscription.create({ data: { customerEmail: email, farmId, optInEmail: true } })
}

async function abo(farmId: string, email: string) {
  return prisma.customerFarmSubscription.findUniqueOrThrow({
    where: { customerEmail_farmId: { customerEmail: email, farmId } },
  })
}

describe('Migration 20261007180000_double_opt_in', () => {
  it('zwei Spalten, nullable, ohne Default', async () => {
    const spalten = await prisma.$queryRaw<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]>`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'CustomerFarmSubscription'
        AND column_name IN ('emailOptInAngefragtAm', 'emailOptInBestaetigtAm')
      ORDER BY column_name`
    expect(spalten).toEqual([
      { column_name: 'emailOptInAngefragtAm', data_type: 'timestamp without time zone', is_nullable: 'YES', column_default: null },
      { column_name: 'emailOptInBestaetigtAm', data_type: 'timestamp without time zone', is_nullable: 'YES', column_default: null },
    ])
  })

  it('Deploy-Fenster: ein Abo aus altem Code (ohne die Spalten) gilt als Bestand und bekommt die Beitragsmail', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('altabo')}@example.com`
    // Nur Spalten, die es vor der Migration gab — so schreibt der alte Code.
    await prisma.$executeRaw`
      INSERT INTO "CustomerFarmSubscription" ("id", "customerEmail", "farmId", "optInEmail", "optInWhatsApp", "updatedAt")
      VALUES (${intKennung('abo')}, ${email}, ${hof.farm.id}, true, false, now())`

    expect(await beitragPerMail(hof)).toMatchObject({ emailCount: 1 })
    expect(empfaengerDerBeitragsmails()).toEqual([email])
  })

  it('Deploy-Fenster: setzt alter Code den Haken auf einer angefragten Anmeldung, bleibt sie ohne Werbung', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(hof, email, true)
    await tokenAusDerMail(email)
    // Der alte Checkout schreibt nur optInEmail: true, die neuen Spalten bleiben.
    await prisma.$executeRaw`
      UPDATE "CustomerFarmSubscription" SET "optInEmail" = true WHERE "customerEmail" = ${email}`

    expect(await beitragPerMail(hof)).toMatchObject({ emailCount: 0 })
    expect(vi.mocked(sendStatusUpdateEmail)).not.toHaveBeenCalled()
  })

  it('ein zweiter Lauf der Migration ändert kein bestehendes Abo', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestandsAbo(hof.farm.id, email)
    await prisma.customerFarmSubscription.updateMany({
      where: { customerEmail: email },
      data: { emailOptInAngefragtAm: new Date('2026-10-07T10:00:00Z'), emailOptInBestaetigtAm: new Date('2026-10-07T10:05:00Z') },
    })
    const vorher = await abo(hof.farm.id, email)

    for (const anweisung of MIGRATION.replace(/--.*$/gm, '')
      .split(';')
      .map((teil) => teil.trim())
      .filter(Boolean)) {
      await prisma.$executeRawUnsafe(anweisung)
    }

    expect(await abo(hof.farm.id, email)).toEqual(vorher)
  })
})

describe('Neue Anmeldung auf der Bestätigungsseite', () => {
  it('Bestätigungsmail genau einmal — aber keine Beitragsmail bis zur Bestätigung; der Bestand bekommt seine', async () => {
    const hof = await hofMitAnmeldung()
    const neu = `${intKennung('neu')}@example.com`
    const bestand = `${intKennung('bestand')}@example.com`
    await bestandsAbo(hof.farm.id, bestand)

    expect((await bestelle(hof, neu, true)).status).toBe(200)
    await tokenAusDerMail(neu)

    const angelegt = await abo(hof.farm.id, neu)
    expect(angelegt.optInEmail).toBe(false)
    expect(angelegt.emailOptInAngefragtAm).toBeInstanceOf(Date)
    expect(angelegt.emailOptInBestaetigtAm).toBeNull()
    expect(vi.mocked(sendAboBestaetigung)).toHaveBeenCalledOnce()
    expect(vi.mocked(sendAboBestaetigung).mock.calls[0]![1]).toMatchObject({ hofName: 'Hof Test' })

    expect(await beitragPerMail(hof)).toMatchObject({ emailCount: 1 })
    expect(empfaengerDerBeitragsmails()).toEqual([bestand])
    // Der Bestand bleibt unverändert.
    expect(await abo(hof.farm.id, bestand)).toMatchObject({ optInEmail: true, emailOptInAngefragtAm: null, emailOptInBestaetigtAm: null })
  })

  it('nach dem Knopf mit dem Token aus der Mail: Beitragsmail mit gültigem Abmeldelink; Abmelden wirkt', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(hof, email, true)
    const token = await tokenAusDerMail(email)

    expect(await bestaetigeNeuigkeiten({ token })).toEqual({ ok: true, hofName: 'Hof Test' })
    const bestaetigt = await abo(hof.farm.id, email)
    expect(bestaetigt.optInEmail).toBe(true)
    expect(bestaetigt.emailOptInBestaetigtAm).toBeInstanceOf(Date)

    expect(await beitragPerMail(hof)).toMatchObject({ emailCount: 1 })
    const [mail] = vi.mocked(sendStatusUpdateEmail).mock.calls.map(([daten]) => daten)
    expect(mail!.to).toBe(email)
    // Seit Nr. 47 bekommt der Versand den Token und baut daraus Link und
    // Abmelde-Kopfzeilen (src/lib/abmelde-link.ts).
    const abmeldeToken = mail!.abmeldeToken
    expect(verifyUnsubscribeToken(abmeldeToken)).toEqual({ email, farmId: hof.farm.id })

    expect(await unsubscribeWithToken(abmeldeToken)).toEqual({})
    expect((await abo(hof.farm.id, email)).optInEmail).toBe(false)
  })

  it('ein zweiter Klick überschreibt den Zeitpunkt der Bestätigung nicht', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(hof, email, true)
    const token = await tokenAusDerMail(email)
    await bestaetigeNeuigkeiten({ token })
    const erster = (await abo(hof.farm.id, email)).emailOptInBestaetigtAm

    expect(await bestaetigeNeuigkeiten({ token })).toEqual({ ok: true, hofName: 'Hof Test' })
    expect((await abo(hof.farm.id, email)).emailOptInBestaetigtAm).toEqual(erster)
  })
})

describe('Der Link aus der Mail', () => {
  it('die Seite (GET) bestätigt nicht — nur der Knopf', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(hof, email, true)
    const token = await tokenAusDerMail(email)
    const vorher = await abo(hof.farm.id, email)

    await NeuigkeitenBestaetigenPage({ searchParams: Promise.resolve({ token }) })

    expect(await abo(hof.farm.id, email)).toEqual(vorher)
    expect(vorher.optInEmail).toBe(false)
  })

  it('abgelaufener Token → abgelehnt, nichts geschrieben', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(hof, email, true)
    await tokenAusDerMail(email)
    const vorher = await abo(hof.farm.id, email)
    const alt = erzeugeAboBestaetigungsToken(vorher.id, new Date(Date.now() - ABO_BESTAETIGUNG_GUELTIG_MS - 60_000))

    const antwort = await bestaetigeNeuigkeiten({ token: alt })

    expect(antwort).toHaveProperty('error')
    expect('error' in antwort && antwort.error).toContain('abgelaufen')
    expect(await abo(hof.farm.id, email)).toEqual(vorher)
  })

  it('Unsinn statt Token → abgelehnt mit Satz und Ausweg, kein Absturz', async () => {
    for (const eingabe of [undefined, {}, { token: '' }, { token: 'x'.repeat(600) }, { token: { not: '' } }, { token: 'abc.def' }]) {
      const antwort = await bestaetigeNeuigkeiten(eingabe)
      expect(antwort, JSON.stringify(eingabe)).toHaveProperty('error')
      expect('error' in antwort && antwort.error).toContain('Melde dich einfach noch einmal an')
    }
  })

  it('manipulierter Token (fremde Abo-ID) → abgelehnt, nichts geschrieben', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(hof, email, true)
    const token = await tokenAusDerMail(email)
    const vorher = await abo(hof.farm.id, email)
    const [b64, sig] = token.split('.')
    const payload = Buffer.from(b64!, 'base64url').toString().replace(vorher.id, `${vorher.id}x`)

    const antwort = await bestaetigeNeuigkeiten({ token: `${Buffer.from(payload).toString('base64url')}.${sig}` })

    expect(antwort).toHaveProperty('error')
    expect(await abo(hof.farm.id, email)).toEqual(vorher)
  })
})

describe('Erneute Anmeldung', () => {
  it('unbestätigt, kurz danach: keine zweite Bestätigungsmail', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(hof, email, true)
    await tokenAusDerMail(email)

    await bestelle(hof, email, true)
    await vi.dynamicImportSettled()

    expect(vi.mocked(sendAboBestaetigung)).toHaveBeenCalledOnce()
  })

  it('zwei gleichzeitige Anmeldungen verschicken nur einen Link', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await prisma.customerFarmSubscription.create({ data: { customerEmail: email, farmId: hof.farm.id } })
    const stand = await prisma.customerFarmSubscription.findFirstOrThrow({ where: { customerEmail: email }, select: EMAIL_ABO_STAND })

    const jetzt = new Date()
    const schritte = await Promise.all([meldeEmailAboAn(stand, jetzt), meldeEmailAboAn(stand, jetzt)])

    expect(schritte.sort()).toEqual(['bestaetigung-schicken', 'gebremst'])
    await vi.waitFor(() => expect(vi.mocked(sendAboBestaetigung)).toHaveBeenCalledOnce())
  })

  it('bestätigt: keine neue Bestätigung, Abo bleibt bestätigt', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(hof, email, true)
    await bestaetigeNeuigkeiten({ token: await tokenAusDerMail(email) })
    const vorher = await abo(hof.farm.id, email)
    vi.mocked(sendAboBestaetigung).mockClear()

    await bestelle(hof, email, true)
    await vi.dynamicImportSettled()

    expect(vi.mocked(sendAboBestaetigung)).not.toHaveBeenCalled()
    const nachher = await abo(hof.farm.id, email)
    expect(nachher.optInEmail).toBe(true)
    expect(nachher.emailOptInBestaetigtAm).toEqual(vorher.emailOptInBestaetigtAm)
  })

  it('keine Auskunft: neue, bestätigte und Bestandsadresse bekommen dieselbe Antwort', async () => {
    const hof = await hofMitAnmeldung()
    const neu = `${intKennung('neu')}@example.com`
    const bestand = `${intKennung('bestand')}@example.com`
    await bestandsAbo(hof.farm.id, bestand)

    const antworten = [await bestelle(hof, neu, false), await bestelle(hof, bestand, false)]
    const zugaenge = await Promise.all(antworten.map((r) => zugangAus(r.clone())))
    const anmeldungen = [await meldeNeuigkeitenAn(zugaenge[0]), await meldeNeuigkeitenAn(zugaenge[1])]

    const koerper = await Promise.all(antworten.map((r) => r.json() as Promise<Record<string, unknown>>))
    expect(antworten.map((r) => r.status)).toEqual([200, 200])
    expect(Object.keys(koerper[0]!).sort()).toEqual(Object.keys(koerper[1]!).sort())
    expect(JSON.stringify(koerper)).not.toMatch(/optIn|subscri|neuigkeit/i)
    // Die Anmeldung auf der Bestätigungsseite antwortet für beide gleich.
    expect(anmeldungen).toEqual([{ ok: true }, { ok: true }])
  })
})

/** Kundin mit Code anmelden (E7) — danach gelten die Actions unter /account für ihre Adresse. */
async function meldeKundinMitCodeAn(email: string): Promise<void> {
  await prisma.user.create({ data: { id: intKennung('konto'), email, name: 'Erika Mustermann', role: 'CUSTOMER', emailVerified: false } })
  const otp = await auth.api.createVerificationOTP({ body: { email, type: 'sign-in' } })
  const { headers: antwort } = await auth.api.signInEmailOTP({ body: { email, otp }, returnHeaders: true })
  const cookie = antwort.getSetCookie().map((zeile) => zeile.split(';')[0]).join('; ')
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
}

type ProfilAbo = { farmId: string; optInEmail: boolean; emailWartet: boolean }

async function profilAbos(): Promise<ProfilAbo[]> {
  const seite = (await AccountProfilePage()) as ReactElement<{ children: ReactElement<{ subscriptions: ProfilAbo[] }> }>
  return seite.props.children.props.subscriptions
}

describe('Ausschalten und Abmelden lösen die offene Anfrage auf (Nachbesserung Runde 1)', () => {
  it('wartet → aus → neu laden → aus; der alte Link bestätigt nicht', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(hof, email, true)
    const alterLink = await tokenAusDerMail(email)
    await meldeKundinMitCodeAn(email)
    expect(await profilAbos()).toEqual([expect.objectContaining({ farmId: hof.farm.id, optInEmail: false, emailWartet: true })])

    expect(await updateSubscription(hof.farm.id, false, false)).toEqual({ email: 'aus' })

    expect(await profilAbos()).toEqual([expect.objectContaining({ optInEmail: false, emailWartet: false })])
    expect(await bestaetigeNeuigkeiten({ token: alterLink })).toHaveProperty('error')
    expect(await abo(hof.farm.id, email)).toMatchObject({ optInEmail: false, emailOptInAngefragtAm: null, emailOptInBestaetigtAm: null })
    // Ohne Haken und nie angefragt: keine Werbung (nicht als Bestand).
    expect(await beitragPerMail(hof)).toMatchObject({ emailCount: 0 })
  })

  it('danach wieder einschalten verlangt einen neuen Link; der neue bestätigt', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(hof, email, true)
    await tokenAusDerMail(email)
    await meldeKundinMitCodeAn(email)
    await updateSubscription(hof.farm.id, false, false)
    vi.mocked(sendAboBestaetigung).mockClear()

    expect(await updateSubscription(hof.farm.id, true, false)).toEqual({ email: 'wartet' })
    const neuerLink = await tokenAusDerMail(email)

    expect(await bestaetigeNeuigkeiten({ token: neuerLink })).toEqual({ ok: true, hofName: 'Hof Test' })
  })

  it('bestätigt → aus → an: neuer Link, erst nach der neuen Bestätigung wieder Mails (Runde 2)', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(hof, email, true)
    const ersterLink = await tokenAusDerMail(email)
    await bestaetigeNeuigkeiten({ token: ersterLink })
    await meldeKundinMitCodeAn(email)
    expect(await updateSubscription(hof.farm.id, false, false)).toEqual({ email: 'aus' })
    expect((await abo(hof.farm.id, email)).optInEmail).toBe(false)
    expect(await profilAbos()).toEqual([expect.objectContaining({ optInEmail: false, emailWartet: false })])
    vi.mocked(sendAboBestaetigung).mockClear()

    // Sofort wieder an — keine Bremse, eine neue Anfrage.
    expect(await updateSubscription(hof.farm.id, true, false)).toEqual({ email: 'wartet' })
    const neuerLink = await tokenAusDerMail(email)
    expect(neuerLink).not.toBe(ersterLink)
    expect(await abo(hof.farm.id, email)).toMatchObject({ optInEmail: false, emailOptInBestaetigtAm: null })
    expect(await profilAbos()).toEqual([expect.objectContaining({ optInEmail: false, emailWartet: true })])

    expect(await bestaetigeNeuigkeiten({ token: neuerLink })).toEqual({ ok: true, hofName: 'Hof Test' })
    expect(await beitragPerMail(hof)).toMatchObject({ emailCount: 1 })
    expect(empfaengerDerBeitragsmails()).toEqual([email])
  })

  it('der WhatsApp-Schalter löst bei einer wartenden Anmeldung keine zweite Bestätigungsmail aus', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(hof, email, true)
    await tokenAusDerMail(email)
    await meldeKundinMitCodeAn(email)
    // Bremse ausgehebelt: Die Anfrage liegt 20 Minuten zurück, der Link gilt noch.
    await prisma.customerFarmSubscription.updateMany({
      where: { customerEmail: email },
      data: { emailOptInAngefragtAm: new Date(Date.now() - 20 * 60 * 1000) },
    })
    vi.mocked(sendAboBestaetigung).mockClear()

    expect(await updateSubscription(hof.farm.id, true, true)).toEqual({ email: 'wartet' })
    await vi.dynamicImportSettled()

    expect(vi.mocked(sendAboBestaetigung)).not.toHaveBeenCalled()
  })

  it('Abmeldelink bei offener Anfrage: aufgelöst, der alte Link bestätigt nicht', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(hof, email, true)
    const alterLink = await tokenAusDerMail(email)
    const { generateUnsubscribeToken } = await import('@/lib/unsubscribe')

    expect(await unsubscribeWithToken(generateUnsubscribeToken(email, hof.farm.id))).toEqual({})

    expect(await bestaetigeNeuigkeiten({ token: alterLink })).toHaveProperty('error')
    expect(await abo(hof.farm.id, email)).toMatchObject({ optInEmail: false, emailOptInAngefragtAm: null })
  })

  it('kein Replay: bestätigt → abgemeldet → der alte Link meldet nicht wieder an', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(hof, email, true)
    const link = await tokenAusDerMail(email)
    await bestaetigeNeuigkeiten({ token: link })
    const { generateUnsubscribeToken } = await import('@/lib/unsubscribe')
    await unsubscribeWithToken(generateUnsubscribeToken(email, hof.farm.id))

    const antwort = await bestaetigeNeuigkeiten({ token: link })

    expect(antwort).toHaveProperty('error')
    expect('error' in antwort && antwort.error).toContain('gilt nicht mehr')
    expect((await abo(hof.farm.id, email)).optInEmail).toBe(false)
    expect(await beitragPerMail(hof)).toMatchObject({ emailCount: 0 })
  })

  it('ein neuerer Link ersetzt den alten', async () => {
    const hof = await hofMitAnmeldung()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(hof, email, true)
    const alterLink = await tokenAusDerMail(email)
    // Nach der Bremse erneut angemeldet.
    await prisma.customerFarmSubscription.updateMany({
      where: { customerEmail: email },
      data: { emailOptInAngefragtAm: new Date(Date.now() - 20 * 60 * 1000) },
    })
    vi.mocked(sendAboBestaetigung).mockClear()
    await bestelle(hof, email, true)
    const neuerLink = await tokenAusDerMail(email)

    expect(await bestaetigeNeuigkeiten({ token: alterLink })).toHaveProperty('error')
    expect(await bestaetigeNeuigkeiten({ token: neuerLink })).toEqual({ ok: true, hofName: 'Hof Test' })
  })
})
