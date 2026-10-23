/**
 * Die EINE Mail-Sperre für Beiträge (mailSperreWo, Nr. 149) gegen ein ECHTES
 * Postgres: Es sperrt nur ein Beitrag des eigenen Hofs, der per Mail ging,
 * mindestens eine Mail hinausbrachte (`emailRecipientCount > 0`) und jünger
 * als MAILABSTAND_TAGE ist. Action und Seite „Neuer Beitrag" fragen beide mit
 * dieser Bedingung (tests/status-posts.test.ts, tests/status-new-mailsperre.test.ts).
 * Jede Bedingung mit Gegenprobe; der Zeitpunkt geht als Argument hinein.
 */
import { afterEach, describe, expect, it } from 'vitest'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { mailSperreWo } from '@/lib/beitrag-mailabstand'
import { erstelleHof, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

const JETZT = new Date('2026-03-02T10:00:00.000Z')
const TAG = 24 * 3_600_000
const vor = (ms: number): Date => new Date(JETZT.getTime() - ms)

async function beitrag(farmId: string, abweichend: Partial<Prisma.StatusPostUncheckedCreateInput>) {
  return prisma.statusPost.create({
    data: { farmId, title: 'Erfundener Titel', body: 'Erfundener Text.', anlass: 'NEW_SEASON', publishedAt: vor(TAG), sentViaEmail: true, emailRecipientCount: 1, ...abweichend },
  })
}

async function gesperrt(farmId: string): Promise<boolean> {
  return (await prisma.statusPost.findFirst({ where: mailSperreWo(farmId, JETZT), select: { id: true } })) !== null
}

describe('mailSperreWo in der echten Datenbank', () => {
  it('eine angenommene Mail (Zahl 1) vor einem Tag sperrt', async () => {
    const { farm } = await erstelleHof()
    await beitrag(farm.id, {})
    expect(await gesperrt(farm.id)).toBe(true)
  })

  it('Gegenprobe: Zahl 0 (keine Mail angenommen) sperrt nicht', async () => {
    const { farm } = await erstelleHof()
    await beitrag(farm.id, { emailRecipientCount: 0 })
    expect(await gesperrt(farm.id)).toBe(false)
  })

  it('Gegenprobe: ohne Mail-Versand sperrt auch eine Zahl nicht', async () => {
    const { farm } = await erstelleHof()
    await beitrag(farm.id, { sentViaEmail: false, emailRecipientCount: 5 })
    expect(await gesperrt(farm.id)).toBe(false)
  })

  it('die Grenze: genau sieben mal 24 Stunden sperrt noch, eine Minute davor nicht mehr', async () => {
    const { farm } = await erstelleHof()
    const alt = await beitrag(farm.id, { publishedAt: new Date(vor(7 * TAG).getTime() - 60_000) })
    expect(await gesperrt(farm.id)).toBe(false)
    await prisma.statusPost.update({ where: { id: alt.id }, data: { publishedAt: vor(7 * TAG) } })
    expect(await gesperrt(farm.id)).toBe(true)
  })

  it('Gegenprobe: der Versand eines anderen Hofs sperrt nicht', async () => {
    const { farm } = await erstelleHof()
    const { farm: anderer } = await erstelleHof()
    await beitrag(anderer.id, {})
    expect(await gesperrt(farm.id)).toBe(false)
    expect(await gesperrt(anderer.id)).toBe(true)
  })
})
