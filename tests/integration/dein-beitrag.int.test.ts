/**
 * „Dein Beitrag“ in Heute und „Aktuell vom Hof“ in Mein Hof (Register E12,
 * Ergänzung Nr. 129, Runde 2) gegen ein ECHTES Postgres:
 *  - ladeLaufendenBeitrag: der neueste laufende Beitrag des EIGENEN Hofs nach
 *    AKTIVER_BEITRAG (veröffentlicht, nicht abgelaufen, „Auf der Hofseite
 *    zeigen“) — die eine Regel, die Mein Hof allein nutzt.
 *  - ladeDeinenBeitrag: dieselbe Regel für die Karte (keine zweite Fassung),
 *    dazu für den Anstoß: ein veröffentlichter Beitrag in den letzten 14 Tagen
 *    (auch einer nur per Mail) und Produkte im Shop (`isAvailable`).
 *
 * Jede Bedingung mit Gegenprobe. Der Zeitpunkt der Anfrage ist fest und liegt
 * in der Vergangenheit (Rahmen Lauf 19: nur so in tests/integration); er geht
 * als Argument hinein, die Systemuhr bleibt. Nur eigene Höfe (`int-`), die
 * raeumeAuf danach samt ihren Beiträgen und Produkten wieder löscht.
 */
import { afterEach, describe, expect, it } from 'vitest'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ladeDeinenBeitrag, ladeLaufendenBeitrag } from '@/server/queries/dashboard'
import { getActiveStatusPosts } from '@/server/queries/status-posts'
import { erstelleHof, erstelleProdukt, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

const JETZT = new Date('2026-03-02T10:00:00.000Z')
const STUNDE = 3_600_000
const TAG = 24 * STUNDE
const vor = (ms: number): Date => new Date(JETZT.getTime() - ms)
const nach = (ms: number): Date => new Date(JETZT.getTime() + ms)

async function beitrag(farmId: string, titel: string, abweichend: Partial<Prisma.StatusPostUncheckedCreateInput> = {}) {
  return prisma.statusPost.create({
    data: { farmId, title: titel, body: 'Erfundener Text.', anlass: 'NEW_SEASON', publishedAt: vor(2 * STUNDE), ...abweichend },
  })
}

describe('ladeLaufendenBeitrag und ladeDeinenBeitrag — eine Regel für den laufenden Beitrag', () => {
  it('der neueste laufende Beitrag des eigenen Hofs, in beiden Abfragen derselbe', async () => {
    const { farm } = await erstelleHof()
    await beitrag(farm.id, 'Älter', { publishedAt: vor(3 * TAG) })
    const neu = await beitrag(farm.id, 'Die ersten Kürbisse sind da', { expiresAt: nach(6 * TAG), emailRecipientCount: 3, whatsappGetippt: ['a', 'b'] })

    const laufend = await ladeLaufendenBeitrag(farm.id, JETZT)
    expect(laufend).toEqual({
      id: neu.id,
      titel: 'Die ersten Kürbisse sind da',
      anlass: 'NEW_SEASON',
      foto: null,
      veroeffentlicht: neu.publishedAt?.toISOString(),
      endet: neu.expiresAt?.toISOString(),
      emailAnzahl: 3,
      whatsappAnzahl: 2,
    })
    expect((await ladeDeinenBeitrag(farm.id, JETZT)).aktiv).toEqual(laufend)
  })

  // Die Karte sagt „steht oben auf deiner Hofseite“: Bei gleicher Veröffentlichungszeit muss
  // derselbe Beitrag gewinnen wie auf der Hofseite (getActiveStatusPosts), sonst nennen Heute und
  // Mein Hof einen anderen. Ohne Ende, damit er auch zur Systemuhr der Hofseiten-Abfrage läuft.
  it('gleicher Zeitpunkt: derselbe Beitrag wie oben auf der Hofseite', async () => {
    const { farm } = await erstelleHof()
    const zeitpunkt = vor(2 * STUNDE)
    await beitrag(farm.id, 'Erster', { publishedAt: zeitpunkt, expiresAt: null })
    await beitrag(farm.id, 'Zweiter', { publishedAt: zeitpunkt, expiresAt: null })

    const oben = (await getActiveStatusPosts(farm.id, 1))[0]
    expect(oben).toBeDefined()
    expect((await ladeLaufendenBeitrag(farm.id, JETZT))?.id).toBe(oben.id)
    expect((await ladeDeinenBeitrag(farm.id, JETZT)).aktiv?.id).toBe(oben.id)
  })

  it('nur der eigene Hof — ein fremder Beitrag und ein fremdes Produkt zählen nie', async () => {
    const { farm: eigener } = await erstelleHof()
    const { farm: fremder } = await erstelleHof()
    await beitrag(fremder.id, 'Vom fremden Hof', { publishedAt: vor(STUNDE) })
    await erstelleProdukt(fremder.id)

    expect(await ladeLaufendenBeitrag(eigener.id, JETZT)).toBeNull()
    expect(await ladeDeinenBeitrag(eigener.id, JETZT)).toEqual({ aktiv: null, beitragInFrist: false, produkteImShop: false })
    // Gegenprobe: Für den fremden Hof zählt beides.
    expect(await ladeDeinenBeitrag(fremder.id, JETZT)).toMatchObject({ aktiv: { titel: 'Vom fremden Hof' }, beitragInFrist: true, produkteImShop: true })
  })

  it('aktiv nach AKTIVER_BEITRAG: abgelaufen oder erst später veröffentlicht nicht — ohne Ende oder noch laufend schon', async () => {
    const { farm: abgelaufen } = await erstelleHof()
    const { farm: spaeter } = await erstelleHof()
    const { farm: laeuft } = await erstelleHof()
    const { farm: ohneEnde } = await erstelleHof()
    await beitrag(abgelaufen.id, 'Abgelaufen', { publishedAt: vor(3 * TAG), expiresAt: vor(STUNDE) })
    await beitrag(spaeter.id, 'Erst morgen', { publishedAt: nach(TAG) })
    await beitrag(laeuft.id, 'Läuft noch', { publishedAt: vor(3 * TAG), expiresAt: nach(STUNDE) })
    await beitrag(ohneEnde.id, 'Ohne Ende', { expiresAt: null })

    expect(await ladeLaufendenBeitrag(abgelaufen.id, JETZT)).toBeNull()
    expect(await ladeLaufendenBeitrag(spaeter.id, JETZT)).toBeNull()
    expect((await ladeLaufendenBeitrag(laeuft.id, JETZT))?.titel).toBe('Läuft noch')
    expect(await ladeLaufendenBeitrag(ohneEnde.id, JETZT)).toMatchObject({ titel: 'Ohne Ende', endet: null })
    expect((await ladeDeinenBeitrag(abgelaufen.id, JETZT)).aktiv).toBeNull()
  })

  it('„Auf der Hofseite zeigen“ aus: keine Karte — für den Anstoß zählt der Beitrag trotzdem (auch nur per Mail)', async () => {
    const { farm: nurMail } = await erstelleHof()
    const { farm: hofseite } = await erstelleHof()
    await beitrag(nurMail.id, 'Nur per Mail', { showOnFarmPage: false })
    await beitrag(hofseite.id, 'Auf der Hofseite', { showOnFarmPage: true })

    expect(await ladeLaufendenBeitrag(nurMail.id, JETZT)).toBeNull()
    expect(await ladeDeinenBeitrag(nurMail.id, JETZT)).toMatchObject({ aktiv: null, beitragInFrist: true })
    // Gegenprobe: mit „Auf der Hofseite zeigen“ die Karte.
    expect((await ladeLaufendenBeitrag(hofseite.id, JETZT))?.titel).toBe('Auf der Hofseite')
  })

  it('14 Tage für den Anstoß: vor 13 Tagen zählt, vor 15 Tagen nicht', async () => {
    const { farm: innen } = await erstelleHof()
    const { farm: aussen } = await erstelleHof()
    // Abgelaufen: Es geht nur um die Frist, nicht um die Karte.
    await beitrag(innen.id, 'Vor 13 Tagen', { publishedAt: vor(13 * TAG), expiresAt: vor(TAG) })
    await beitrag(aussen.id, 'Vor 15 Tagen', { publishedAt: vor(15 * TAG), expiresAt: vor(TAG) })

    expect(await ladeDeinenBeitrag(innen.id, JETZT)).toMatchObject({ aktiv: null, beitragInFrist: true })
    expect(await ladeDeinenBeitrag(aussen.id, JETZT)).toMatchObject({ aktiv: null, beitragInFrist: false })
  })

  it('ein Entwurf zählt weder als Karte noch für die 14 Tage', async () => {
    const { farm } = await erstelleHof()
    const entwurf = await beitrag(farm.id, 'Entwurf', { publishedAt: null })

    expect(await ladeLaufendenBeitrag(farm.id, JETZT)).toBeNull()
    expect(await ladeDeinenBeitrag(farm.id, JETZT)).toMatchObject({ aktiv: null, beitragInFrist: false })
    // Gegenprobe: derselbe Beitrag veröffentlicht zählt für beides.
    await prisma.statusPost.update({ where: { id: entwurf.id }, data: { publishedAt: vor(STUNDE) } })
    expect(await ladeDeinenBeitrag(farm.id, JETZT)).toMatchObject({ aktiv: { titel: 'Entwurf' }, beitragInFrist: true })
  })

  it('Produkte im Shop über isAvailable: ein ausgeschaltetes Produkt zählt nicht', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id)
    await prisma.product.update({ where: { id: produkt.id }, data: { isAvailable: false } })

    expect((await ladeDeinenBeitrag(farm.id, JETZT)).produkteImShop).toBe(false)
    // Gegenprobe: eingeschaltet zählt es.
    await prisma.product.update({ where: { id: produkt.id }, data: { isAvailable: true } })
    expect((await ladeDeinenBeitrag(farm.id, JETZT)).produkteImShop).toBe(true)
  })
})
