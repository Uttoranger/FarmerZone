/**
 * Einstellungen (Nachtlauf Nr. 22d) gegen ein ECHTES Postgres.
 *
 * Die Aussage: Übersicht und Konditionen lesen nur den Hof des angemeldeten
 * Besitzers (ownerId), zählen nur aktive Abholzeiten als Angebot, geben die
 * Stripe-Kennung nicht weiter (nur „Konto da") und reichen Geldsätze als
 * Text weiter — so, wie die Spalten sie gespeichert haben.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { ladeEinstellungenUebersicht, ladeKonditionenHof } from '@/server/queries/einstellungen'
import { einstellungenBereiche } from '@/lib/hof-einstellungen'
import { erstelleHof, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

describe('Einstellungen — nur der eigene Hof', () => {
  it('Übersicht: eigener Hof, pausierte Abholzeit zählt nicht als Angebot, keine Stripe-Kennung', async () => {
    const { farm, owner } = await erstelleHof({ acceptsOnline: true, stripeAccountId: `acct_int_${Date.now()}`, stripeAccountReady: false })
    await erstelleHof({ name: 'Fremder Hof', isPaused: true })
    // Alle Abholzeiten bis auf eine pausieren.
    const [erste] = await prisma.pickupSlot.findMany({ where: { farmId: farm.id }, orderBy: { dayOfWeek: 'asc' } })
    await prisma.pickupSlot.updateMany({ where: { farmId: farm.id, id: { not: erste.id } }, data: { isActive: false } })

    const daten = await ladeEinstellungenUebersicht(owner.id)
    expect(daten).not.toBeNull()
    expect(daten!.name).toBe('Hof Test')
    expect(daten!.isPaused).toBe(false)
    expect(daten!.abholzeiten).toHaveLength(1)
    expect(daten!.abholzeitenGesamt).toBe(7)
    expect(daten!.stripeKontoDa).toBe(true)
    expect(daten!.stripeBereit).toBe(false)
    expect(daten!.onlineAn).toBe(true)
    expect(JSON.stringify(daten)).not.toContain('acct_int_')
    expect(daten!.betriebsnummer).toBe('LFBIS 0000000')

    const bereiche = einstellungenBereiche(daten!, new Date())
    expect(bereiche).toHaveLength(8)
    expect(bereiche.find((b) => b.id === 'zahlung')?.ton).toBe('offen')
    expect(bereiche.find((b) => b.id === 'futtermittel')?.zeile).toBe('Primärproduktion · LFBIS 0000000')
  })

  it('Zahlung: Online an und Stripe nicht fertig → orange; nur bar (Online aus, kein Konto) → grau', async () => {
    const online = await erstelleHof({ acceptsOnline: true, stripeAccountReady: false })
    const nurBar = await erstelleHof({ acceptsOnline: false })

    const zahlung = async (ownerId: string) =>
      einstellungenBereiche((await ladeEinstellungenUebersicht(ownerId))!, new Date()).find((b) => b.id === 'zahlung')

    expect(await zahlung(online.owner.id)).toMatchObject({ ton: 'offen', zeile: 'Bar bei Abholung · Online-Zahlung noch nicht eingerichtet' })
    expect(await zahlung(nurBar.owner.id)).toMatchObject({ ton: 'neutral', zeile: 'Bar bei Abholung · Online-Zahlung ist aus' })
  })

  it('ohne Hof: null', async () => {
    expect(await ladeEinstellungenUebersicht('int-gibt-es-nicht')).toBeNull()
    expect(await ladeKonditionenHof('int-gibt-es-nicht')).toBeNull()
  })

  it('Konditionen: gespeicherte Sätze als Text, genau des eigenen Hofs', async () => {
    const giltAb = new Date('2026-01-01T00:00:00Z')
    const { owner } = await erstelleHof({ serviceFeePercent: '4.90', serviceFeeMinCents: 60, serviceFeeActiveFrom: giltAb })
    await erstelleHof({ serviceFeePercent: '7.00' })

    expect(await ladeKonditionenHof(owner.id)).toEqual({
      tarif: null,
      serviceFeePercent: '4.9',
      serviceFeeMinCents: 60,
      serviceFeeActiveFrom: giltAb,
      platformFeePercent: '0',
    })
  })
})
