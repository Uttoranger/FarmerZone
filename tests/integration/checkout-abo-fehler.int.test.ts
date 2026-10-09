/**
 * Bestellung und Neuigkeiten-Abo sind getrennt (Register N2, Nachtlauf Nr. 46;
 * vorher Nr. 38, Nachbesserung Runde 1: ein Fehler beim Abo im Checkout) —
 * echte Datenbank.
 *
 * Beweist:
 *  - Der Checkout legt kein Abo mehr an, auch wenn ein alter Tab noch die
 *    Haken-Felder schickt (`optInEmail`, `optInWhatsApp`, `onsiteConfirmed`):
 *    Bestellung angelegt, Bestand gebucht, Betrag unverändert, keine Zeile in
 *    `CustomerFarmSubscription`, keine Bestätigungsmail.
 *  - Die Anmeldung auf der Bestätigungsseite (`meldeNeuigkeitenAn`) nimmt
 *    die Adresse aus der Bestellung und legt das Abo ohne Haken an
 *    (Double-Opt-in); eine falsche Signatur schreibt nichts.
 *  - Scheitert das Abo dort (Speichern oder Anfrage), bleibt die Bestellung
 *    Zeile für Zeile, wie sie war; Sentry bekommt nur einen festen Text, Tags
 *    und die Bestell-ID — nie die Adresse.
 *  - Nachbesserung Runde 1: Eine stornierte Bestellung meldet nichts an, und
 *    je Bestellung zählt die Datenbank-Bremse (`RateLimitZaehler`, Nr. 40)
 *    höchstens drei Anfragen am Tag — die vierte schickt keine Mail, die
 *    Antwort bleibt dieselbe. In der Tabelle steht nur Zweck und HMAC.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }))

vi.mock('@sentry/nextjs', async (original) => ({
  ...(await original<typeof import('@sentry/nextjs')>()),
  captureException: sentry.captureException,
}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn(), sendAboBestaetigung: vi.fn(async () => ({ id: 'mail-1' })) }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))
vi.mock('@/server/abo-anmeldung', async (original) => {
  const echt = await original<typeof import('@/server/abo-anmeldung')>()
  return { ...echt, meldeEmailAboAn: vi.fn(echt.meldeEmailAboAn) }
})

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { sendAboBestaetigung } from '@/lib/email'
import { bestellSignatur } from '@/lib/bestell-link'
import { NEUIGKEITEN_JE_BESTELLUNG_UND_TAG, NEUIGKEITEN_TEXT } from '@/lib/abo-bestaetigung'
import { DB_BREMSEN, bremsSchluessel } from '@/lib/bremse-datenbank'
import { meldeEmailAboAn } from '@/server/abo-anmeldung'
import { meldeNeuigkeitenAn } from '@/server/actions/neuigkeiten'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await raeumeAuf()
})

/** Bestellt eine Einheit bar — auf Wunsch mit den Feldern, die ein alter Tab noch schickt. */
async function bestelle(email: string, zusatz: Record<string, unknown> = {}) {
  const { farm } = await erstelleHof()
  const produkt = await erstelleProdukt(farm.id, { stock: 5 })
  const sitzung = intKennung('sitzung')
  await setzeHalt(produkt.id, sitzung, 1)
  const res = await checkout(
    checkoutAnfrage({
      farm,
      sessionId: sitzung,
      customerEmail: email,
      positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
      zusatz,
    })
  )
  const body = (await res.json()) as { orderId: string; bestaetigung: string }
  const sig = new URL(body.bestaetigung, 'http://localhost').searchParams.get('sig') ?? ''
  return { res, farmId: farm.id, produktId: produkt.id, orderId: body.orderId, sig }
}

/** Die Bestellung samt Positionen, so wie sie in der Datenbank steht. */
async function bestellungsStand(orderId: string) {
  return prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })
}

function sentryOhneAdresse(email: string): void {
  expect(sentry.captureException).toHaveBeenCalledOnce()
  const [fehler, kontext] = sentry.captureException.mock.calls[0]!
  expect((fehler as Error).message).toBe('Neuigkeiten nicht angemeldet')
  expect(JSON.stringify(kontext)).not.toContain(email)
  expect(JSON.stringify({ message: (fehler as Error).message, name: (fehler as Error).name })).not.toContain(email)
  expect(kontext).toMatchObject({ tags: { aufgabe: 'neuigkeiten', grund: 'abo_nicht_gespeichert' } })
}

describe('Checkout ohne Abo (Register N2)', () => {
  it('ein alter Tab mit Haken-Feldern: Bestellung steht, Bestand gebucht, kein Abo, keine Bestätigungsmail', async () => {
    const email = `${intKennung('kundin')}@example.com`

    const { res, farmId, produktId, orderId } = await bestelle(email, { optInEmail: true, optInWhatsApp: true, onsiteConfirmed: false })

    expect(res.status).toBe(200)
    const bestellung = await bestellungsStand(orderId)
    expect(bestellung).toMatchObject({ status: 'PENDING_CONFIRMATION', paymentMethod: 'ONSITE_CASH', customerEmail: email })
    expect(bestellung.totalAmount.toString()).toBe('10')
    expect((await prisma.product.findUniqueOrThrow({ where: { id: produktId } })).stock).toBe(4)
    expect(await prisma.customerFarmSubscription.count({ where: { farmId } })).toBe(0)
    await vi.dynamicImportSettled()
    expect(sendAboBestaetigung).not.toHaveBeenCalled()
    expect(meldeEmailAboAn).not.toHaveBeenCalled()
  })
})

describe('Anmeldung auf der Bestätigungsseite', () => {
  it('nimmt die Adresse der Bestellung und legt das Abo ohne Haken an (Double-Opt-in)', async () => {
    const email = `${intKennung('kundin')}@example.com`
    const { farmId, orderId, sig } = await bestelle(email)

    expect(await meldeNeuigkeitenAn({ orderId, sig, customerEmail: 'fremd@example.com' })).toEqual({ ok: true })

    const abos = await prisma.customerFarmSubscription.findMany({ where: { farmId } })
    expect(abos).toHaveLength(1)
    expect(abos[0]).toMatchObject({ customerEmail: email, optInEmail: false, optInWhatsApp: false, emailOptInBestaetigtAm: null })
    expect(abos[0]!.emailOptInAngefragtAm).toBeInstanceOf(Date)
    await vi.waitFor(() => expect(sendAboBestaetigung).toHaveBeenCalledOnce())
    expect(vi.mocked(sendAboBestaetigung).mock.calls[0]![0]).toBe(email)
  })

  it('falsche Signatur oder die einer anderen Bestellung: nichts geschrieben, keine Mail', async () => {
    const email = `${intKennung('kundin')}@example.com`
    const { farmId, orderId } = await bestelle(email)

    expect(await meldeNeuigkeitenAn({ orderId, sig: 'f'.repeat(64) })).toEqual({ error: NEUIGKEITEN_TEXT.linkUngueltig })
    expect(await meldeNeuigkeitenAn({ orderId, sig: bestellSignatur(`${orderId}x`) })).toEqual({ error: NEUIGKEITEN_TEXT.linkUngueltig })

    expect(await prisma.customerFarmSubscription.count({ where: { farmId } })).toBe(0)
    await vi.dynamicImportSettled()
    expect(sendAboBestaetigung).not.toHaveBeenCalled()
  })
})

describe('Nur für eine laufende Bestellung, höchstens drei Anfragen am Tag (Runde 1)', () => {
  /** Der Zähler dieser Bestellung — so, wie die Bremse ihn schlüsselt (Zweck im Klartext, Kennung nur im HMAC). */
  const zaehlerSchluessel = (orderId: string) =>
    bremsSchluessel(process.env.BETTER_AUTH_SECRET!, DB_BREMSEN.neuigkeitenBestellung.zweck, orderId)

  it('stornierte Bestellung: dieselbe Antwort, kein Abo, keine Mail, kein Zähler', async () => {
    const email = `${intKennung('kundin')}@example.com`
    const { farmId, orderId, sig } = await bestelle(email)
    await prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED', cancelReason: 'Vom Hof storniert' } })

    expect(await meldeNeuigkeitenAn({ orderId, sig })).toEqual({ ok: true })

    expect(await prisma.customerFarmSubscription.count({ where: { farmId } })).toBe(0)
    expect(await prisma.rateLimitZaehler.count({ where: { schluessel: zaehlerSchluessel(orderId) } })).toBe(0)
    await vi.dynamicImportSettled()
    expect(sendAboBestaetigung).not.toHaveBeenCalled()
  })

  it(`je Bestellung ${NEUIGKEITEN_JE_BESTELLUNG_UND_TAG} Anfragen am Tag: die vierte schickt keine Mail, die Antwort bleibt dieselbe`, async () => {
    const email = `${intKennung('kundin')}@example.com`
    const { orderId, sig } = await bestelle(email)
    const schluessel = zaehlerSchluessel(orderId)
    try {
      for (let anfrage = 1; anfrage <= NEUIGKEITEN_JE_BESTELLUNG_UND_TAG + 1; anfrage++) {
        // Die Bremse des Abos (10 Minuten) ist hier nicht Thema: die letzte Anfrage zurückdatiert,
        // wie in double-opt-in.int.test.ts. (Ein Tageswechsel in UTC mitten im Test ist praktisch ausgeschlossen.)
        await prisma.customerFarmSubscription.updateMany({
          where: { customerEmail: email },
          data: { emailOptInAngefragtAm: new Date(Date.now() - 20 * 60 * 1000) },
        })
        expect(await meldeNeuigkeitenAn({ orderId, sig })).toEqual({ ok: true })
        await vi.waitFor(() => expect(sendAboBestaetigung).toHaveBeenCalledTimes(Math.min(anfrage, NEUIGKEITEN_JE_BESTELLUNG_UND_TAG)))
      }
      await vi.dynamicImportSettled()
      expect(sendAboBestaetigung).toHaveBeenCalledTimes(NEUIGKEITEN_JE_BESTELLUNG_UND_TAG)

      const zeilen = await prisma.rateLimitZaehler.findMany({ where: { schluessel } })
      expect(zeilen.map((z) => z.zaehler)).toEqual([NEUIGKEITEN_JE_BESTELLUNG_UND_TAG + 1])
      // Weder Kennung noch Adresse im Klartext — nur Zweck und HMAC.
      expect(JSON.stringify(zeilen)).not.toContain(orderId)
      expect(JSON.stringify(zeilen)).not.toContain(email)
    } finally {
      await prisma.rateLimitZaehler.deleteMany({ where: { schluessel } })
    }
  })
})

describe('Ein Fehler beim Abo berührt die Bestellung nie', () => {
  it('meldeEmailAboAn wirft → Satz an der Karte, Bestellung unverändert, Sentry ohne Adresse', async () => {
    const email = `${intKennung('kundin')}@example.com`
    const { orderId, sig } = await bestelle(email)
    const vorher = await bestellungsStand(orderId)
    vi.mocked(meldeEmailAboAn).mockRejectedValueOnce(new Error(`Verbindung weg bei ${email}`))

    expect(await meldeNeuigkeitenAn({ orderId, sig })).toEqual({ error: NEUIGKEITEN_TEXT.fehler })

    expect(await bestellungsStand(orderId)).toEqual(vorher)
    sentryOhneAdresse(email)
  })

  it('das Speichern des Abos (upsert) wirft → Bestellung unverändert, kein Abo, Sentry ohne Adresse', async () => {
    const email = `${intKennung('kundin')}@example.com`
    const { farmId, orderId, sig } = await bestelle(email)
    const vorher = await bestellungsStand(orderId)
    vi.spyOn(prisma.customerFarmSubscription, 'upsert').mockRejectedValueOnce(new Error(`Unique constraint ${email}`))

    expect(await meldeNeuigkeitenAn({ orderId, sig })).toEqual({ error: NEUIGKEITEN_TEXT.fehler })

    expect(await bestellungsStand(orderId)).toEqual(vorher)
    expect(await prisma.customerFarmSubscription.count({ where: { farmId } })).toBe(0)
    expect(vi.mocked(meldeEmailAboAn)).not.toHaveBeenCalled()
    sentryOhneAdresse(email)
  })
})
