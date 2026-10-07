/**
 * Die Beitrags-Actions (src/server/actions/status-posts.ts, Nr. 32,
 * Morgenbericht Lauf 5 §5):
 *  - Zod an ALLEN Actions (Kennung, Zähler, Felder des Beitrags) — nichts
 *    Ungeprüftes geht in eine WHERE-Klausel oder die Datenbank.
 *  - Besitz im selben Schreibvorgang: `updateMany`/`deleteMany` mit
 *    `{ id, farmId }` und `count` statt vorgelagertem `findFirst` und blindem
 *    `update`/`delete` per ID.
 *  - Nach außen nur Sätze für Menschen, nie `err.message`; Sentry bekommt einen
 *    festen Text und die Fehlerklasse, nie Titel, Text oder Adressen.
 *  - Deaktivieren und Löschen räumen auch die öffentliche Hofseite neu auf.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))
vi.mock('@/server/bild-url', () => ({ BILD_NICHT_UEBERNOMMEN: 'Bild nicht übernommen', bildUrlErlaubt: vi.fn(async () => true) }))
vi.mock('@/lib/email', () => ({ sendStatusUpdateEmail: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    order: { findMany: vi.fn() },
    customerFarmSubscription: { findMany: vi.fn() },
    statusPost: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

import { StatusPostAnlass } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { deleteStatusPost, expireStatusPost, markWhatsAppSent, publishStatusPost } from '@/server/actions/status-posts'
import { STATUS_POST_ANLASS_VALUES } from '@/schemas/status-post'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'

const HOF = { id: 'farm_1', name: 'Testhof', slug: 'testhof', logoUrl: null }
const sp = vi.mocked(prisma.statusPost)

const beitrag = (mehr: Record<string, unknown> = {}) => ({
  title: 'Neue Eier',
  body: 'Frisch gelegt.',
  anlass: 'FRESH_PRODUCT',
  showOnFarmPage: true,
  sendEmail: false,
  sendWhatsApp: false,
  ...mehr,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user_1' } } as never)
  vi.mocked(getFarmForUser).mockResolvedValue(HOF as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue({ slug: 'testhof', name: 'Testhof' } as never)
  sp.create.mockResolvedValue({ id: 'post_1' } as never)
  sp.updateMany.mockResolvedValue({ count: 1 } as never)
  sp.deleteMany.mockResolvedValue({ count: 1 } as never)
})

describe('Anlässe', () => {
  it('die Liste im Schema entspricht dem Enum der Datenbank', () => {
    expect([...STATUS_POST_ANLASS_VALUES].sort()).toEqual(Object.values(StatusPostAnlass).sort())
  })
})

describe('expireStatusPost — Besitz im selben Schreibvorgang', () => {
  it('deaktiviert per updateMany mit id UND farmId, kein vorgelagertes findFirst', async () => {
    expect(await expireStatusPost('post_1')).toEqual({})
    expect(sp.updateMany).toHaveBeenCalledWith({
      where: { id: 'post_1', farmId: 'farm_1' },
      data: { expiresAt: expect.any(Date) },
    })
    expect(sp.findFirst).not.toHaveBeenCalled()
    expect(sp.update).not.toHaveBeenCalled()
  })

  it('fremder oder verschwundener Beitrag (count 0) → Satz, keine Änderung anderswo', async () => {
    sp.updateMany.mockResolvedValue({ count: 0 } as never)
    const antwort = await expireStatusPost('post_fremd')
    expect(antwort.error).toBe('Diesen Beitrag gibt es nicht mehr. Lade die Seite neu.')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('räumt den Reiter und die öffentliche Hofseite neu auf', async () => {
    await expireStatusPost('post_1')
    expect(revalidatePath).toHaveBeenCalledWith('/farm-page')
    expect(revalidatePath).toHaveBeenCalledWith('/testhof')
  })

  it.each([[''], ['x'.repeat(65)], [42], [null], [{ id: 'post_1' }]])('ungültige Kennung %j → abgelehnt, nichts geschrieben', async (id) => {
    const antwort = await expireStatusPost(id as never)
    expect(antwort.error).toBeTruthy()
    expect(sp.updateMany).not.toHaveBeenCalled()
  })
})

describe('deleteStatusPost — Besitz im selben Schreibvorgang', () => {
  it('löscht per deleteMany mit id UND farmId, kein vorgelagertes findFirst', async () => {
    expect(await deleteStatusPost('post_1')).toEqual({})
    expect(sp.deleteMany).toHaveBeenCalledWith({ where: { id: 'post_1', farmId: 'farm_1' } })
    expect(sp.findFirst).not.toHaveBeenCalled()
    expect(sp.delete).not.toHaveBeenCalled()
  })

  it('fremder Beitrag (count 0) → Satz', async () => {
    sp.deleteMany.mockResolvedValue({ count: 0 } as never)
    expect((await deleteStatusPost('post_fremd')).error).toBe('Diesen Beitrag gibt es nicht mehr. Lade die Seite neu.')
  })

  it('räumt den Reiter und die öffentliche Hofseite neu auf', async () => {
    await deleteStatusPost('post_1')
    expect(revalidatePath).toHaveBeenCalledWith('/farm-page')
    expect(revalidatePath).toHaveBeenCalledWith('/testhof')
  })

  it('ungültige Kennung → abgelehnt, nichts gelöscht', async () => {
    expect((await deleteStatusPost('' as never)).error).toBeTruthy()
    expect(sp.deleteMany).not.toHaveBeenCalled()
  })
})

describe('markWhatsAppSent — Zod und Besitz', () => {
  it('zählt per updateMany mit id UND farmId', async () => {
    expect(await markWhatsAppSent('post_1', 3)).toEqual({})
    expect(sp.updateMany).toHaveBeenCalledWith({
      where: { id: 'post_1', farmId: 'farm_1' },
      data: { whatsappSentCount: 3 },
    })
    expect(sp.findFirst).not.toHaveBeenCalled()
    expect(sp.update).not.toHaveBeenCalled()
  })

  it.each([[-1], [1.5], [Number.NaN], [Infinity], ['3'], [1_000_000]])('ungültiger Zähler %j → abgelehnt', async (count) => {
    expect((await markWhatsAppSent('post_1', count as never)).error).toBeTruthy()
    expect(sp.updateMany).not.toHaveBeenCalled()
  })

  it('fremder Beitrag (count 0) → Satz', async () => {
    sp.updateMany.mockResolvedValue({ count: 0 } as never)
    expect((await markWhatsAppSent('post_fremd', 1)).error).toBe('Diesen Beitrag gibt es nicht mehr. Lade die Seite neu.')
  })
})

describe('publishStatusPost — Zod', () => {
  it('Gegenprobe: ein gültiger Beitrag geht durch (getrimmt)', async () => {
    const antwort = await publishStatusPost(beitrag({ title: '  Neue Eier  ' }) as never)
    expect(antwort.postId).toBe('post_1')
    expect(sp.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: 'Neue Eier', farmId: 'farm_1' }) }))
  })

  it.each([
    ['leerer Titel', { title: '   ' }],
    ['leerer Text', { body: '' }],
    ['unbekannter Anlass', { anlass: 'WERBUNG' }],
    ['Titel zu lang', { title: 'x'.repeat(201) }],
    ['Text zu lang', { body: 'x'.repeat(5001) }],
    ['Haken kein Wahrheitswert', { sendEmail: 'ja' }],
    ['Produktliste kein Array', { linkedProductIds: 'p1' }],
    ['Produkt-ID leer', { linkedProductIds: [''] }],
    ['Bild-Adresse keine Zeichenkette', { photoUrl: 42 }],
  ])('%s → Satz, nichts angelegt', async (_fall, mehr) => {
    const antwort = await publishStatusPost(beitrag(mehr) as never)
    expect(antwort.error).toBeTruthy()
    expect(antwort.postId).toBeUndefined()
    expect(sp.create).not.toHaveBeenCalled()
  })

  it('kein Objekt → Satz statt Absturz', async () => {
    expect((await publishStatusPost(null as never)).error).toBeTruthy()
  })
})

describe('Fehler nach außen: nie err.message, Sentry ohne Inhalte', () => {
  const INTERN = 'Invalid `prisma.statusPost.create()` invocation: title "Geheimer Titel" kundin@example.com'

  it('publishStatusPost: unerwarteter Fehler → Satz, Sentry mit festem Text', async () => {
    sp.create.mockRejectedValue(Object.assign(new Error(INTERN), { name: 'PrismaClientKnownRequestError', code: 'P2000' }))
    const antwort = await publishStatusPost(beitrag({ title: 'Geheimer Titel' }) as never)

    expect(antwort.error).toBe('Wir konnten den Beitrag gerade nicht veröffentlichen. Bitte versuch es noch einmal.')
    expect(JSON.stringify(antwort)).not.toContain('prisma')
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const gemeldet = JSON.stringify([
      (vi.mocked(Sentry.captureException).mock.calls[0]?.[0] as Error).message,
      vi.mocked(Sentry.captureException).mock.calls[0]?.[1],
    ])
    expect(gemeldet).not.toContain('Geheimer Titel')
    expect(gemeldet).not.toContain('example.com')
  })

  it.each([
    ['expireStatusPost', () => expireStatusPost('post_1'), () => sp.updateMany],
    ['deleteStatusPost', () => deleteStatusPost('post_1'), () => sp.deleteMany],
    ['markWhatsAppSent', () => markWhatsAppSent('post_1', 2), () => sp.updateMany],
  ] as const)('%s: unerwarteter Fehler → Satz, kein interner Text', async (_name, aufruf, schreiben) => {
    schreiben().mockRejectedValue(new Error(INTERN) as never)
    const antwort = await aufruf()
    expect(antwort.error).toBeTruthy()
    expect(antwort.error).not.toContain('prisma')
    expect(antwort.error).not.toContain('Geheimer')
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect((vi.mocked(Sentry.captureException).mock.calls[0]?.[0] as Error).message).not.toContain('Geheimer')
  })

  it('ohne Anmeldung → Satz zum Neu-Anmelden, nichts geschrieben, kein Sentry', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    for (const antwort of [
      await expireStatusPost('post_1'),
      await deleteStatusPost('post_1'),
      await markWhatsAppSent('post_1', 1),
      await publishStatusPost(beitrag() as never),
    ]) {
      expect(antwort.error).toBe('Bitte melde dich neu an.')
    }
    expect(sp.updateMany).not.toHaveBeenCalled()
    expect(sp.deleteMany).not.toHaveBeenCalled()
    expect(sp.create).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
