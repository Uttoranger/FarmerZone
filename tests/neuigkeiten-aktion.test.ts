/**
 * „Neuigkeiten vom Hof per E-Mail" auf der Bestätigungsseite (Register N2,
 * Nachtlauf Nr. 46) — die Server Action `meldeNeuigkeitenAn`. Prisma, Mail,
 * Sentry und der Request-Kontext gemockt; Signatur, Zod, die Bremse des Abos
 * (`meldeEmailAboAn` mit `emailAnmeldungSchritt`) und die Bremse je IP echt.
 *
 * Beweist:
 *  - Zugang nur mit gültiger Signatur der Bestätigungsseite — geprüft vor
 *    jeder Datenbankabfrage; fremde Signatur, Unsinn, fehlende Kennung → Satz.
 *  - Die Adresse kommt aus der Bestellung, nie aus dem Browser (auch wenn der
 *    eine mitschickt); angelegt wird ohne Haken (Double-Opt-in, S11).
 *  - Keine Auskunft: neu, schon bestätigt, gebremst → dieselbe Antwort; Mail
 *    nur im ersten Fall, und die Bremse verhindert die zweite.
 *  - Ein Fehler beim Abo berührt die Bestellung nie (kein Schreiben an ihr),
 *    endet in einem Satz und geht ohne Adresse nach Sentry.
 *  - In Produktion bremst die Action je IP.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '203.0.113.7' })) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendAboBestaetigung: vi.fn(async () => ({ id: 'mail-1' })) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    customerFarmSubscription: { upsert: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
  },
}))

import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { sendAboBestaetigung } from '@/lib/email'
import { bestellSignatur } from '@/lib/bestell-link'
import { NEUIGKEITEN_PRO_MINUTE, NEUIGKEITEN_TEXT } from '@/lib/abo-bestaetigung'
import { meldeNeuigkeitenAn } from '@/server/actions/neuigkeiten'

const findeBestellung = vi.mocked(prisma.order.findUnique)
const upsert = vi.mocked(prisma.customerFarmSubscription.upsert)
const updateMany = vi.mocked(prisma.customerFarmSubscription.updateMany)
const ORDER_ID = 'cmorder0000000000000001'
const SIG = bestellSignatur(ORDER_ID)
const BESTELLUNG = { customerEmail: 'erika@example.org', farmId: 'farm-1', farm: { archivedAt: null } }
const NEU = { id: 'abo-1', optInEmail: false, emailOptInAngefragtAm: null, emailOptInBestaetigtAm: null }

beforeEach(() => {
  vi.clearAllMocks()
  findeBestellung.mockResolvedValue(BESTELLUNG as never)
  upsert.mockResolvedValue(NEU as never)
  updateMany.mockResolvedValue({ count: 1 } as never)
  vi.mocked(sendAboBestaetigung).mockResolvedValue({ id: 'mail-1' } as never)
  // Die Mail-Lieferung schreibt im Test den Bestätigungslink ins Log — hier nicht von Belang.
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('Zugang nur mit der Signatur der Bestätigungsseite', () => {
  it.each([
    ['ohne Eingabe', undefined],
    ['ohne Signatur', { orderId: ORDER_ID }],
    ['Signatur einer anderen Bestellung', { orderId: ORDER_ID, sig: bestellSignatur('cmorder0000000000000002') }],
    ['falsche Signatur', { orderId: ORDER_ID, sig: 'f'.repeat(64) }],
    ['Signatur in falscher Form', { orderId: ORDER_ID, sig: 'abc' }],
    ['Kennung mit Sonderzeichen', { orderId: 'x; DROP', sig: SIG }],
    ['Objekt statt Kennung', { orderId: { not: '' }, sig: SIG }],
  ])('%s: ein Satz mit Ausweg, keine Datenbankabfrage, kein Abo', async (_fall, eingabe) => {
    expect(await meldeNeuigkeitenAn(eingabe)).toEqual({ error: NEUIGKEITEN_TEXT.linkUngueltig })
    expect(findeBestellung).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('Gegenprobe: mit gültiger Signatur meldet sie an', async () => {
    expect(await meldeNeuigkeitenAn({ orderId: ORDER_ID, sig: SIG })).toEqual({ ok: true })
    expect(upsert).toHaveBeenCalledOnce()
  })

  it('stillgelegter Hof oder unbekannte Bestellung: kein Abo', async () => {
    findeBestellung.mockResolvedValueOnce({ ...BESTELLUNG, farm: { archivedAt: new Date() } } as never)
    expect(await meldeNeuigkeitenAn({ orderId: ORDER_ID, sig: SIG })).toEqual({ error: NEUIGKEITEN_TEXT.linkUngueltig })
    findeBestellung.mockResolvedValueOnce(null)
    expect(await meldeNeuigkeitenAn({ orderId: ORDER_ID, sig: SIG })).toEqual({ error: NEUIGKEITEN_TEXT.linkUngueltig })
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('Die Adresse kommt aus der Bestellung', () => {
  it('angelegt für Adresse und Hof der Bestellung, ohne Haken — eine mitgeschickte Adresse zählt nicht', async () => {
    await meldeNeuigkeitenAn({ orderId: ORDER_ID, sig: SIG, customerEmail: 'fremd@example.com', email: 'fremd@example.com', farmId: 'farm-x' })

    const aufruf = upsert.mock.calls[0]![0] as {
      where: { customerEmail_farmId: { customerEmail: string; farmId: string } }
      create: Record<string, unknown>
      update: Record<string, unknown>
    }
    expect(aufruf.where.customerEmail_farmId).toEqual({ customerEmail: 'erika@example.org', farmId: 'farm-1' })
    expect(aufruf.create).toMatchObject({ customerEmail: 'erika@example.org', farmId: 'farm-1', optInEmail: false })
    // Ein bestehendes Abo bleibt, wie es ist — den Haken setzt nur der Knopf in der Mail.
    expect(aufruf.update).toEqual({})
    expect(JSON.stringify(upsert.mock.calls)).not.toContain('fremd@example.com')
  })

  it('die Bestätigungsmail geht an die Adresse der Bestellung — mit Link, nach der Antwort', async () => {
    vi.mocked(prisma.customerFarmSubscription.findUnique).mockResolvedValue({ customerEmail: 'erika@example.org', farm: { name: 'Hof Test' } } as never)

    await meldeNeuigkeitenAn({ orderId: ORDER_ID, sig: SIG })

    await vi.waitFor(() => expect(sendAboBestaetigung).toHaveBeenCalledOnce())
    const [an, inhalt] = vi.mocked(sendAboBestaetigung).mock.calls[0]!
    expect(an).toBe('erika@example.org')
    expect(inhalt).toMatchObject({ hofName: 'Hof Test', url: expect.stringContaining('/account/neuigkeiten-bestaetigen?token=') })
    // Angefragt, nicht angemeldet: optInEmail bleibt false bis zum Klick.
    expect(updateMany.mock.calls[0]![0]).toMatchObject({ data: { optInEmail: false, emailOptInAngefragtAm: expect.any(Date) } })
  })
})

describe('Keine Auskunft, ob die Adresse schon angemeldet ist', () => {
  const BESTAETIGT = { id: 'abo-1', optInEmail: true, emailOptInAngefragtAm: new Date('2026-10-01T08:00:00Z'), emailOptInBestaetigtAm: new Date('2026-10-01T08:05:00Z') }
  const BESTAND = { id: 'abo-1', optInEmail: true, emailOptInAngefragtAm: null, emailOptInBestaetigtAm: null }

  it('neu, bestätigt, Bestand und gerade angefragt: dieselbe Antwort', async () => {
    const antworten = []
    for (const abo of [NEU, BESTAETIGT, BESTAND, { ...NEU, emailOptInAngefragtAm: new Date() }]) {
      upsert.mockResolvedValueOnce(abo as never)
      antworten.push(await meldeNeuigkeitenAn({ orderId: ORDER_ID, sig: SIG }))
    }
    expect(antworten).toEqual([{ ok: true }, { ok: true }, { ok: true }, { ok: true }])
  })

  it('schon bestätigt oder Bestand: keine neue Anfrage, keine Mail', async () => {
    for (const abo of [BESTAETIGT, BESTAND]) {
      upsert.mockResolvedValueOnce(abo as never)
      await meldeNeuigkeitenAn({ orderId: ORDER_ID, sig: SIG })
    }
    await vi.dynamicImportSettled()
    expect(updateMany).not.toHaveBeenCalled()
    expect(sendAboBestaetigung).not.toHaveBeenCalled()
  })

  it('die Bremse des Abos: eine offene Anfrage von vor fünf Minuten bekommt keinen zweiten Link', async () => {
    upsert.mockResolvedValueOnce({ ...NEU, emailOptInAngefragtAm: new Date(Date.now() - 5 * 60 * 1000) } as never)
    expect(await meldeNeuigkeitenAn({ orderId: ORDER_ID, sig: SIG })).toEqual({ ok: true })
    await vi.dynamicImportSettled()
    expect(updateMany).not.toHaveBeenCalled()
    expect(sendAboBestaetigung).not.toHaveBeenCalled()
  })
})

describe('Getrennt von der Bestellung', () => {
  it.each([
    ['das Speichern des Abos', () => upsert.mockRejectedValueOnce(new Error('Unique constraint erika@example.org'))],
    ['die Anfrage (bedingtes Schreiben)', () => updateMany.mockRejectedValueOnce(new Error('Verbindung weg bei erika@example.org'))],
    ['das Lesen der Bestellung', () => findeBestellung.mockRejectedValueOnce(new Error('Zeitüberschreitung'))],
  ])('scheitert %s: ein Satz an der Karte, die Bestellung bleibt unberührt, Sentry ohne Adresse', async (_fall, scheitern) => {
    scheitern()

    expect(await meldeNeuigkeitenAn({ orderId: ORDER_ID, sig: SIG })).toEqual({ error: NEUIGKEITEN_TEXT.fehler })

    expect(prisma.order.update).not.toHaveBeenCalled()
    expect(prisma.order.updateMany).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalledOnce()
    const [fehler, kontext] = vi.mocked(Sentry.captureException).mock.calls[0]!
    expect((fehler as Error).message).toBe('Neuigkeiten nicht angemeldet')
    expect(JSON.stringify({ kontext, message: (fehler as Error).message })).not.toContain('erika@example.org')
    expect(kontext).toMatchObject({ tags: { aufgabe: 'neuigkeiten', grund: 'abo_nicht_gespeichert' } })
  })

  it('die Action schreibt nie an der Bestellung — auch nicht im Erfolgsfall', async () => {
    await meldeNeuigkeitenAn({ orderId: ORDER_ID, sig: SIG })
    expect(prisma.order.update).not.toHaveBeenCalled()
    expect(prisma.order.updateMany).not.toHaveBeenCalled()
    expect(findeBestellung.mock.calls[0]![0]).toMatchObject({ where: { id: ORDER_ID } })
  })
})

describe('Bremse je IP in Produktion', () => {
  it(`nach ${NEUIGKEITEN_PRO_MINUTE} Anmeldungen in der Minute: „zu viele", ohne Datenbank`, async () => {
    vi.stubEnv('NODE_ENV', 'production')
    for (let i = 0; i < NEUIGKEITEN_PRO_MINUTE; i++) {
      expect(await meldeNeuigkeitenAn({ orderId: ORDER_ID, sig: SIG })).toEqual({ ok: true })
    }
    findeBestellung.mockClear()

    expect(await meldeNeuigkeitenAn({ orderId: ORDER_ID, sig: SIG })).toEqual({ error: NEUIGKEITEN_TEXT.zuViele, code: 'ZU_VIELE' })
    expect(findeBestellung).not.toHaveBeenCalled()
  })
})
