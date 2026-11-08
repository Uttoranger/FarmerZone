/**
 * Nr. 263 (Register N48): Suche nach einer Meldung über die Kurznummer gegen ein echtes Postgres — mit echter
 * Anmeldung über Better Auth für den Duplikat-Verweis der Triage.
 *
 * Beweist (Zustand danach):
 *  - Neue (Ende, sechs Zeichen, groß oder klein), alte (Anfang, acht Zeichen) und volle Nummer finden die Meldung
 *    (getMeldungDetail, findeMeldungZurKurznummer) — die Vorauswahl in SQL und DIE Regel in kurznummer.ts passen
 *    zusammen.
 *  - Zwei Meldungen mit gleichem Ende: mehrdeutig — die Admin-Suche öffnet keine, der Duplikat-Verweis schreibt
 *    nichts und sagt „Diese Kurznummer passt zu mehreren Meldungen – gib die volle Nummer ein.“; mit der vollen
 *    Nummer wird genau die gemeinte verwiesen.
 *  - Ein Stück unter sechs Zeichen und LIKE-Platzhalter treffen nichts.
 * Meldungstexte sind erfunden.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { KURZNUMMER_MEHRDEUTIG, kurznummerAus } from '@/lib/kurznummer'
import { triageMeldungAction } from '@/server/actions/admin'
import { findeMeldungZurKurznummer, getMeldungDetail } from '@/server/queries/meldung'
import { erstelleHofMitAnmeldung, raeumeAuf, machePasskeyAdmin } from './setup/basis'

const meldungIds: string[] = []
let zaehler = 0

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  vi.clearAllMocks()
  await prisma.meldung.deleteMany({ where: { id: { in: meldungIds.splice(0) } } })
  await raeumeAuf()
})

/**
 * Eine Meldung mit gewähltem Ende. Die Kennung beginnt mit „int-“ (Aufräumen) und trägt danach vier Zeichen je
 * Meldung, damit auch die alte Nummer (die ersten acht Zeichen) eindeutig ist.
 */
async function legeMeldungAn(ende: string): Promise<string> {
  zaehler += 1
  const vorn = (process.pid * 100 + zaehler).toString(36).slice(-4).padStart(4, '0')
  const id = `int-${vorn}-kurznummer-${ende}`
  await prisma.meldung.create({
    data: {
      id,
      art: 'FEHLER',
      status: 'NEU',
      text: 'Erfundene Meldung für den Integrationstest der Kurznummer.',
      seiteUrl: '/int-test',
      userAgent: 'int-test',
      viewport: '390x844',
    },
  })
  meldungIds.push(id)
  return id
}

describe('Suche über die Kurznummer (eine Regel)', () => {
  it('findet die Meldung über neue, alte und volle Nummer', async () => {
    const id = await legeMeldungAn('q7w3z9')
    for (const eingabe of [kurznummerAus(id), 'q7w3z9', '#Q7W3Z9', id.slice(0, 8), id.slice(0, 8).toUpperCase(), id]) {
      expect(await getMeldungDetail(eingabe)).toMatchObject({ art: 'eine', meldung: { id } })
    }
  })

  it('zwei Meldungen mit gleichem Ende: mehrdeutig, die Admin-Suche öffnet keine; die volle Nummer findet je eine', async () => {
    const a = await legeMeldungAn('k2m8p4')
    const b = await legeMeldungAn('k2m8p4')
    expect(kurznummerAus(a)).toBe(kurznummerAus(b))
    expect(await findeMeldungZurKurznummer('K2M8P4')).toEqual({ art: 'mehrdeutig' })
    expect(await getMeldungDetail('K2M8P4')).toEqual({ art: 'mehrdeutig' })
    expect(await getMeldungDetail(a)).toMatchObject({ art: 'eine', meldung: { id: a } })
    expect(await getMeldungDetail(b)).toMatchObject({ art: 'eine', meldung: { id: b } })
    // Die alte Nummer ist bei beiden eine andere — sie findet je genau eine.
    expect(await getMeldungDetail(b.slice(0, 8))).toMatchObject({ art: 'eine', meldung: { id: b } })
  })

  it('ein Stück unter sechs Zeichen und LIKE-Platzhalter treffen nichts', async () => {
    const id = await legeMeldungAn('h5j6n1')
    for (const eingabe of ['5j6n1', 'n1', id.slice(0, 7), '%', '%%%%%%', '______', '__j6n1', 'h5j6n%']) {
      expect(await findeMeldungZurKurznummer(eingabe)).toEqual({ art: 'keine' })
    }
  })
})

describe('Duplikat-Verweis der Triage', () => {
  it('mehrdeutig schreibt nichts und sagt den Satz; die volle Nummer verweist auf genau die gemeinte', async () => {
    const { ownerId, cookie } = await erstelleHofMitAnmeldung()
    await machePasskeyAdmin(ownerId)
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
    const meldung = await legeMeldungAn('t4r6v2')
    const a = await legeMeldungAn('x8c1b5')
    const b = await legeMeldungAn('x8c1b5')

    const mehrdeutig = await triageMeldungAction(meldung, { status: 'DUPLIKAT', duplikatVonId: 'X8C1B5' })
    expect(mehrdeutig).toEqual({ error: KURZNUMMER_MEHRDEUTIG })
    expect(await prisma.meldung.findUniqueOrThrow({ where: { id: meldung } })).toMatchObject({ status: 'NEU', duplikatVonId: null })

    expect(await triageMeldungAction(meldung, { status: 'DUPLIKAT', duplikatVonId: b })).toEqual({})
    expect(await prisma.meldung.findUniqueOrThrow({ where: { id: meldung } })).toMatchObject({ status: 'DUPLIKAT', duplikatVonId: b })
    expect(a).not.toBe(b)
  })

  it('die neue und die alte Nummer verweisen, wenn sie eindeutig sind', async () => {
    const { ownerId, cookie } = await erstelleHofMitAnmeldung()
    await machePasskeyAdmin(ownerId)
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
    const erste = await legeMeldungAn('d3f7g2')
    const zweite = await legeMeldungAn('w9e2r6')
    const haupt = await legeMeldungAn('m1n4b8')

    expect(await triageMeldungAction(erste, { status: 'DUPLIKAT', duplikatVonId: kurznummerAus(haupt) })).toEqual({})
    expect(await triageMeldungAction(zweite, { status: 'DUPLIKAT', duplikatVonId: haupt.slice(0, 8) })).toEqual({})
    const nachher = await prisma.meldung.findMany({ where: { id: { in: [erste, zweite] } }, select: { duplikatVonId: true } })
    expect(nachher.map((m) => m.duplikatVonId)).toEqual([haupt, haupt])
  })
})
