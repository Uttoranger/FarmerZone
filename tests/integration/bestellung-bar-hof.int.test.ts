/**
 * Integrationstest — Mail „Neue Bestellung bar“ an den Hof (Nr. 256, N46)
 * über /api/checkout gegen ein echtes Postgres.
 *
 * Die Aussagen (Zustand danach):
 *  - Eine Barbestellung legt nach der Antwort genau EINEN Auftrag
 *    'bestellung-bar-hof' an: Weg Wichtig, Schlüssel `<art>:<orderId>`, im
 *    Bezug nur die Kennung der Bestellung — keine Adresse.
 *  - Scheitert das Einstellen, bleiben Bestellung und Antwort unverändert
 *    (CLAUDE.md §2: ein Nachlauf rollt nie eine gültige Bestellung zurück);
 *    der Fehler geht nur an Sentry.
 *  - Ein zweiter Aufruf mit demselben Idempotenz-Schlüssel (Wiederholungsweg)
 *    legt keinen zweiten Auftrag an, und auch ein zweites Einstellen desselben
 *    Auftrags nicht (fachlicher Schlüssel).
 *  - Gegenprobe: Eine Online-Bestellung legt keinen an.
 *
 * Mail und Stripe sind gemockt; den Fehler beim Einstellen macht ein Trigger
 * der Test-Datenbank (setup/mail-sperre.ts); der Nachlauf wird gesammelt und von Hand
 * abgearbeitet, der Worker läuft nie — nichts wird verschickt.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(async () => ({ id: 'pi_int_256', client_secret: 'pi_int_256_secret' })), retrieve: vi.fn() } },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
// Der Nachlauf wird gesammelt: So läuft er erst, nachdem die Antwort feststeht, und der Worker nie.
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as (() => Promise<void>)[] }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))

import * as Sentry from '@sentry/nextjs'
import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { stelleEinOhneRisiko } from '@/server/mail-warteschlange'
import { bestellMailAuftrag } from '@/server/mail-arten/bestellung'
import { auftraege, checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'
import { gibMailAuftraegeFrei, sperreMailAuftraege } from './setup/mail-sperre'

afterEach(async () => {
  await gibMailAuftraegeFrei()
  nachlauf.aufgaben.length = 0
  vi.clearAllMocks()
  await raeumeAuf()
})

/** Arbeitet den gesammelten Nachlauf ab, bis nichts mehr nachkommt — ohne den Worker (der hängt sich selbst an). */
async function nachlaufAbarbeiten(): Promise<void> {
  const jetzt = nachlauf.aufgaben.splice(0)
  for (const aufgabe of jetzt) await aufgabe()
  // Was das Einstellen anhängt, ist der Worker: verworfen, damit nichts verschickt wird.
  nachlauf.aufgaben.length = 0
}

async function vorbereiten(paymentMethod: 'ONSITE_CASH' | 'ONLINE' = 'ONSITE_CASH') {
  const { farm } = await erstelleHof(paymentMethod === 'ONLINE' ? { acceptsOnline: true, stripeAccountReady: true, stripeAccountId: intKennung('acct') } : {})
  const produkt = await erstelleProdukt(farm.id, { stock: 5 })
  const sitzung = intKennung('sitzung')
  await setzeHalt(produkt.id, sitzung, 1)
  const schluessel = intKennung('idem')
  const anfrage = () =>
    checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        idempotencyKey: schluessel,
        paymentMethod,
        positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
      })
    )
  return { farm, anfrage }
}

describe('POST /api/checkout — Mail „Neue Bestellung bar“ an den Hof', () => {
  it('eine Barbestellung legt nach der Antwort genau einen Auftrag an — nur die Kennung im Bezug', async () => {
    const { farm, anfrage } = await vorbereiten()

    const antwort = await anfrage()
    expect(antwort.status).toBe(200)
    const { orderId } = (await antwort.json()) as { orderId: string }
    // Vor dem Nachlauf: noch kein Auftrag — die Antwort wartet nicht auf die Warteschlange.
    expect(await auftraege({ bestellungId: orderId, art: 'bestellung-bar-hof' })).toEqual([])

    await nachlaufAbarbeiten()

    expect(await auftraege({ bestellungId: orderId })).toEqual([
      { art: 'bestellung-bar-hof', vorrang: 1, schluessel: `bestellung-bar-hof:${orderId}`, bestellungId: orderId, farmId: farm.id, bezug: { orderId } },
    ])
    const zeile = await prisma.mailAuftrag.findFirstOrThrow({ where: { bestellungId: orderId, art: 'bestellung-bar-hof' }, select: { status: true } })
    expect(zeile.status).toBe('offen')
  })

  it('scheitert das Einstellen, bleiben Bestellung und Antwort unverändert — der Fehler geht nur an Sentry', async () => {
    const { anfrage } = await vorbereiten()
    // Postgres lehnt jedes Anlegen eines Mail-Auftrags ab (Trigger nur in der Test-DB, setup/mail-sperre.ts).
    await sperreMailAuftraege('immer')

    const antwort = await anfrage()
    expect(antwort.status).toBe(200)
    const koerper = (await antwort.json()) as { orderId: string; requiresConfirmation: boolean }
    expect(koerper.requiresConfirmation).toBe(true)
    const vorher = await prisma.order.findUniqueOrThrow({ where: { id: koerper.orderId } })

    await expect(nachlaufAbarbeiten()).resolves.toBeUndefined()

    expect(await prisma.order.findUniqueOrThrow({ where: { id: koerper.orderId } })).toEqual(vorher)
    expect(vorher.status).toBe('PENDING_CONFIRMATION')
    expect(await auftraege({ bestellungId: koerper.orderId })).toEqual([])
    const gruende = vi.mocked(Sentry.captureException).mock.calls.map(([, k]) => (k as { tags?: Record<string, string> }).tags?.grund)
    expect(gruende).toContain('einstellen_gescheitert')
  })

  it('ein zweiter Aufruf (Wiederholungsweg) und ein zweites Einstellen legen keinen zweiten Auftrag an', async () => {
    const { farm, anfrage } = await vorbereiten()

    const erste = await anfrage()
    const { orderId } = (await erste.json()) as { orderId: string }
    await nachlaufAbarbeiten()

    const zweite = await anfrage()
    expect(zweite.status).toBe(200)
    expect(((await zweite.json()) as { orderId: string; wiederholt?: boolean }).orderId).toBe(orderId)
    await nachlaufAbarbeiten()
    // Derselbe Auftrag noch einmal eingestellt: Der fachliche Schlüssel hält ihn auf.
    await stelleEinOhneRisiko('bestellung-bar-hof', orderId, bestellMailAuftrag('bestellung-bar-hof', { id: orderId, farmId: farm.id }))

    expect(await prisma.mailAuftrag.count({ where: { bestellungId: orderId, art: 'bestellung-bar-hof' } })).toBe(1)
  })

  it('Gegenprobe: eine Online-Bestellung legt keinen Auftrag „Neue Bestellung bar“ an', async () => {
    const { anfrage } = await vorbereiten('ONLINE')

    const antwort = await anfrage()
    expect(antwort.status).toBe(200)
    const { orderId } = (await antwort.json()) as { orderId: string }
    await nachlaufAbarbeiten()

    expect(await prisma.mailAuftrag.count({ where: { bestellungId: orderId, art: 'bestellung-bar-hof' } })).toBe(0)
  })
})
