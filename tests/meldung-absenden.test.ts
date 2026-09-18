/**
 * Tests für meldungAbsenden (src/server/actions/meldung.ts, Sprint
 * fehlerbriefkasten Teil B) — am echten Code, Prisma/Auth/Mail gemockt.
 *
 * Beweist: Pflichtfelder und Längen; Honigtopf und Zeitschranke lehnen STILL
 * ab (Erfolgsantwort samt Kurznummer, aber kein Datensatz); das abgelaufene
 * Formular ist die einzige sichtbare Ablehnung; ein Registrierungs-Token gilt
 * hier nicht; der Stundenzähler greift bei der sechsten Meldung; die
 * Betreiber-Mail geht NUR bei FEHLER; farmId kommt aus der Sitzung; ein
 * fremder Screenshot wird abgelehnt, ein Kundinnen-Screenshot verworfen;
 * Kundinnen werden in Produktion zusätzlich je IP gedrosselt — eine je Anfrage
 * erfundene E-Mail führt nicht am Stundenzähler vorbei.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    meldung: { count: vi.fn(), create: vi.fn() },
    farm: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/email', () => ({ sendMeldungNotification: vi.fn() }))

import { headers } from 'next/headers'
import { meldungAbsenden } from '@/server/actions/meldung'
import { generateFormToken, FORM_EXPIRED_MESSAGE, MIN_FORM_AGE_MS, MAX_FORM_AGE_MS } from '@/lib/form-token'
import { MELDUNGEN_PRO_STUNDE, MELDUNG_TEXT_MAX, ZU_VIELE_MELDUNGEN } from '@/lib/meldung'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendMeldungNotification } from '@/lib/email'

const getSession = vi.mocked(auth.api.getSession)
const meldungCount = vi.mocked(prisma.meldung.count)
const meldungCreate = vi.mocked(prisma.meldung.create)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const mail = vi.mocked(sendMeldungNotification)

const AUSGESTELLT = new Date('2026-09-01T10:00:00.000Z')
const NEUE_ID = 'cmfabcdefgh123456789xyz'

/** Ein Meldungs-Token so ausstellen, dass es beim Absenden `alterMs` alt ist. */
function tokenMitAlter(alterMs: number, zweck: 'meldung' | 'register' = 'meldung'): string {
  vi.useFakeTimers()
  vi.setSystemTime(AUSGESTELLT)
  const token = generateFormToken(zweck)
  vi.setSystemTime(new Date(AUSGESTELLT.getTime() + alterMs))
  return token
}

type Daten = Parameters<typeof meldungAbsenden>[0]

/** Eine ehrliche Meldung: Honigtopf leer, zehn Sekunden am Formular. */
function meldung(overrides: Partial<Daten> = {}): Daten {
  return {
    art: 'FEHLER',
    text: 'Die Abholzeiten lassen sich nicht speichern, es kommt keine Meldung.',
    seiteUrl: 'https://farmerzone.at/settings',
    userAgent: 'Mozilla/5.0 (iPhone)',
    viewport: '375x667',
    website: '',
    formToken: overrides.formToken ?? tokenMitAlter(10_000),
    ...overrides,
  }
}

function alsHof() {
  getSession.mockResolvedValue({ user: { id: 'user_hof', role: 'FARMER' } } as never)
  farmFindUnique.mockResolvedValue({ id: 'farm_1', name: 'Biohof Sonnleitner' } as never)
}

function alsKundin() {
  getSession.mockResolvedValue(null as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  alsHof()
  meldungCount.mockResolvedValue(0)
  meldungCreate.mockResolvedValue({ id: NEUE_ID, createdAt: new Date('2026-09-01T10:00:10.000Z') } as never)
  mail.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

// ── Pflichtfelder und Längen ────────────────────────────────────────────────

describe('meldungAbsenden — Eingabe', () => {
  it('lehnt zu kurzen Text ab, ohne zu speichern', async () => {
    const result = await meldungAbsenden(meldung({ text: 'kaputt' }))
    expect(result).toHaveProperty('error')
    expect(meldungCreate).not.toHaveBeenCalled()
  })

  it('lehnt Text über 2000 Zeichen ab', async () => {
    const result = await meldungAbsenden(meldung({ text: 'x'.repeat(MELDUNG_TEXT_MAX + 1) }))
    expect(result).toHaveProperty('error')
    expect(meldungCreate).not.toHaveBeenCalled()
  })

  it('nimmt genau 2000 Zeichen an', async () => {
    const result = await meldungAbsenden(meldung({ text: 'x'.repeat(MELDUNG_TEXT_MAX) }))
    expect(result).toEqual({ ok: true, kurznummer: NEUE_ID.slice(0, 8) })
    expect(meldungCreate).toHaveBeenCalledTimes(1)
  })

  it('lehnt eine unbekannte Art ab', async () => {
    const result = await meldungAbsenden(meldung({ art: 'BESCHWERDE' }))
    expect(result).toHaveProperty('error')
    expect(meldungCreate).not.toHaveBeenCalled()
  })

  it('lehnt eine zu lange Kennung und eine ungültige E-Mail ab', async () => {
    alsKundin()
    expect(await meldungAbsenden(meldung({ diagKennung: 'K'.repeat(21) }))).toHaveProperty('error')
    expect(await meldungAbsenden(meldung({ customerEmail: 'keine-adresse' }))).toHaveProperty('error')
    expect(meldungCreate).not.toHaveBeenCalled()
  })

  it('liefert die Kurznummer: die ersten acht Zeichen der neuen ID', async () => {
    const result = await meldungAbsenden(meldung())
    expect(result).toEqual({ ok: true, kurznummer: NEUE_ID.slice(0, 8) })
  })
})

// ── Honigtopf ───────────────────────────────────────────────────────────────

describe('meldungAbsenden — Honigtopf', () => {
  it('legt bei gefülltem Feld NICHTS an, meldet aber Erfolg mit Kurznummer', async () => {
    const result = await meldungAbsenden(meldung({ website: 'https://spam.example' }))
    expect(result).toMatchObject({ ok: true })
    expect((result as { kurznummer: string }).kurznummer).toHaveLength(8)
    expect(meldungCreate).not.toHaveBeenCalled()
    expect(mail).not.toHaveBeenCalled()
  })

  it('sticht die Ablaufmeldung: gefüllter Honigtopf schweigt auch bei altem Formular', async () => {
    const result = await meldungAbsenden(
      meldung({ website: 'spam', formToken: tokenMitAlter(MAX_FORM_AGE_MS + 1000) })
    )
    expect(result).toMatchObject({ ok: true })
    expect(meldungCreate).not.toHaveBeenCalled()
  })

  it('prüft den Honigtopf VOR der Validierung — auch unsinnige Eingabe bekommt keine Fehlermeldung', async () => {
    const result = await meldungAbsenden(meldung({ website: 'spam', text: '', art: 'X' }))
    expect(result).toMatchObject({ ok: true })
    expect(meldungCreate).not.toHaveBeenCalled()
  })
})

// ── Zeitschranke ────────────────────────────────────────────────────────────

describe('meldungAbsenden — Zeitschranke', () => {
  it('lehnt ein in unter drei Sekunden abgeschicktes Formular still ab', async () => {
    const result = await meldungAbsenden(meldung({ formToken: tokenMitAlter(MIN_FORM_AGE_MS - 1) }))
    expect(result).toMatchObject({ ok: true })
    expect(meldungCreate).not.toHaveBeenCalled()
  })

  it('lässt ein gültiges, altes Formular durch', async () => {
    const result = await meldungAbsenden(meldung({ formToken: tokenMitAlter(MIN_FORM_AGE_MS) }))
    expect(result).toEqual({ ok: true, kurznummer: NEUE_ID.slice(0, 8) })
    expect(meldungCreate).toHaveBeenCalledTimes(1)
  })

  it('lehnt ein fehlendes Token still ab', async () => {
    const result = await meldungAbsenden(meldung({ formToken: '' }))
    expect(result).toMatchObject({ ok: true })
    expect(meldungCreate).not.toHaveBeenCalled()
  })

  it('lehnt ein Registrierungs-Token still ab — anderer Zweck, gleiches Geheimnis', async () => {
    const result = await meldungAbsenden(meldung({ formToken: tokenMitAlter(10_000, 'register') }))
    expect(result).toMatchObject({ ok: true })
    expect(meldungCreate).not.toHaveBeenCalled()
  })

  it('meldet ein zu lange offenes Formular SICHTBAR', async () => {
    const result = await meldungAbsenden(meldung({ formToken: tokenMitAlter(MAX_FORM_AGE_MS + 1000) }))
    expect(result).toEqual({ error: FORM_EXPIRED_MESSAGE })
    expect(meldungCreate).not.toHaveBeenCalled()
  })
})

// ── Stundenzähler ───────────────────────────────────────────────────────────

describe('meldungAbsenden — Stundenzähler', () => {
  it('lässt die fünfte Meldung eines Hofes zu, lehnt die sechste ab', async () => {
    meldungCount.mockResolvedValue(MELDUNGEN_PRO_STUNDE - 1)
    expect(await meldungAbsenden(meldung())).toMatchObject({ ok: true })
    expect(meldungCreate).toHaveBeenCalledTimes(1)

    meldungCount.mockResolvedValue(MELDUNGEN_PRO_STUNDE)
    expect(await meldungAbsenden(meldung())).toEqual({ error: ZU_VIELE_MELDUNGEN })
    expect(meldungCreate).toHaveBeenCalledTimes(1)
  })

  it('zählt je Hof über die letzte Stunde — aus der Datenbank', async () => {
    await meldungAbsenden(meldung())
    const where = meldungCount.mock.calls[0][0]?.where as { farmId: string; createdAt: { gte: Date } }
    expect(where.farmId).toBe('farm_1')
    expect(Date.now() - where.createdAt.gte.getTime()).toBe(60 * 60 * 1000)
  })

  it('zählt bei Kundinnen je E-Mail und lehnt die sechste ab', async () => {
    alsKundin()
    meldungCount.mockResolvedValue(MELDUNGEN_PRO_STUNDE)
    const result = await meldungAbsenden(meldung({ customerEmail: 'anna@test.local' }))
    expect(result).toEqual({ error: ZU_VIELE_MELDUNGEN })
    const where = meldungCount.mock.calls[0][0]?.where as { customerEmail: string }
    expect(where.customerEmail).toBe('anna@test.local')
    expect(meldungCreate).not.toHaveBeenCalled()
  })

  it('drosselt Kundinnen in Produktion zusätzlich je IP — eine je Anfrage erfundene E-Mail hilft nicht', async () => {
    alsKundin()
    vi.stubEnv('NODE_ENV', 'production')
    vi.mocked(headers).mockResolvedValue(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }) as never)
    try {
      for (let i = 0; i < MELDUNGEN_PRO_STUNDE; i++) {
        const result = await meldungAbsenden(meldung({ art: 'FRAGE', customerEmail: `bot${i}@test.local` }))
        expect(result).toMatchObject({ ok: true })
      }
      expect(meldungCreate).toHaveBeenCalledTimes(MELDUNGEN_PRO_STUNDE)

      const sechste = await meldungAbsenden(meldung({ art: 'FRAGE', customerEmail: 'bot99@test.local' }))
      expect(sechste).toEqual({ error: ZU_VIELE_MELDUNGEN })
      expect(meldungCreate).toHaveBeenCalledTimes(MELDUNGEN_PRO_STUNDE)

      // Auch ganz ohne E-Mail: dieselbe IP, dieselbe Drossel
      const ohneMail = await meldungAbsenden(meldung({ art: 'FRAGE' }))
      expect(ohneMail).toEqual({ error: ZU_VIELE_MELDUNGEN })
    } finally {
      vi.unstubAllEnvs()
      vi.mocked(headers).mockResolvedValue(new Headers() as never)
    }
  })

  it('lässt eine andere IP unabhängig zu', async () => {
    alsKundin()
    vi.stubEnv('NODE_ENV', 'production')
    vi.mocked(headers).mockResolvedValue(new Headers({ 'x-forwarded-for': '198.51.100.2' }) as never)
    try {
      const result = await meldungAbsenden(meldung({ art: 'FRAGE' }))
      expect(result).toMatchObject({ ok: true })
      expect(meldungCreate).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllEnvs()
      vi.mocked(headers).mockResolvedValue(new Headers() as never)
    }
  })
})

// ── Betreiber-Mail nur bei FEHLER ───────────────────────────────────────────

describe('meldungAbsenden — Betreiber-Mail', () => {
  it('schickt bei FEHLER genau eine Mail mit Kurznummer, Hof und Kontext', async () => {
    await meldungAbsenden(meldung({ art: 'FEHLER', diagKennung: 'S71' }))
    expect(mail).toHaveBeenCalledTimes(1)
    expect(mail).toHaveBeenCalledWith(
      expect.objectContaining({
        id: NEUE_ID,
        kurznummer: NEUE_ID.slice(0, 8),
        farmName: 'Biohof Sonnleitner',
        diagKennung: 'S71',
        seiteUrl: 'https://farmerzone.at/settings',
        viewport: '375x667',
      })
    )
  })

  it('schickt bei WUNSCH und FRAGE keine Mail — die werden gesammelt, nicht gemeldet', async () => {
    await meldungAbsenden(meldung({ art: 'WUNSCH' }))
    await meldungAbsenden(meldung({ art: 'FRAGE' }))
    expect(meldungCreate).toHaveBeenCalledTimes(2)
    expect(mail).not.toHaveBeenCalled()
  })

  it('lässt die Meldung nicht scheitern, wenn die Mail scheitert — sie ist gespeichert', async () => {
    mail.mockRejectedValue(new Error('Resend down'))
    const result = await meldungAbsenden(meldung({ art: 'FEHLER' }))
    expect(result).toEqual({ ok: true, kurznummer: NEUE_ID.slice(0, 8) })
    expect(meldungCreate).toHaveBeenCalledTimes(1)
  })
})

// ── Kontext und Zuordnung ───────────────────────────────────────────────────

describe('meldungAbsenden — Zuordnung', () => {
  it('nimmt farmId aus der Sitzung und lässt customerEmail beim Hof leer', async () => {
    await meldungAbsenden(meldung({ customerEmail: 'mitgeschickt@test.local' }))
    const data = meldungCreate.mock.calls[0][0].data
    expect(data).toMatchObject({
      art: 'FEHLER',
      farmId: 'farm_1',
      customerEmail: null,
      seiteUrl: 'https://farmerzone.at/settings',
      userAgent: 'Mozilla/5.0 (iPhone)',
      viewport: '375x667',
    })
    expect(data).not.toHaveProperty('status')
  })

  it('speichert bei einer Kundin farmId null und die freiwillige E-Mail', async () => {
    alsKundin()
    await meldungAbsenden(meldung({ art: 'WUNSCH', customerEmail: 'anna@test.local' }))
    expect(meldungCreate.mock.calls[0][0].data).toMatchObject({
      farmId: null,
      customerEmail: 'anna@test.local',
    })
  })

  it('erkennt eine Kundinnen-Sitzung nicht als Hof', async () => {
    getSession.mockResolvedValue({ user: { id: 'user_k', role: 'CUSTOMER' } } as never)
    await meldungAbsenden(meldung())
    expect(farmFindUnique).not.toHaveBeenCalled()
    expect(meldungCreate.mock.calls[0][0].data).toMatchObject({ farmId: null })
  })

  it('nimmt einen Screenshot aus dem eigenen Hof-Ordner an', async () => {
    const url = 'https://abc123.public.blob.vercel-storage.com/farms/farm_1/meldung/1.webp'
    const result = await meldungAbsenden(meldung({ screenshotUrl: url }))
    expect(result).toMatchObject({ ok: true })
    expect(meldungCreate.mock.calls[0][0].data).toMatchObject({ screenshotUrl: url })
  })

  it('lehnt einen Screenshot aus einem fremden Hof-Ordner ab', async () => {
    const url = 'https://abc123.public.blob.vercel-storage.com/farms/farm_FREMD/meldung/1.webp'
    const result = await meldungAbsenden(meldung({ screenshotUrl: url }))
    expect(result).toEqual({ error: 'Der Screenshot gehört nicht zu diesem Hof.' })
    expect(meldungCreate).not.toHaveBeenCalled()
  })

  it('verwirft eine Screenshot-URL einer Kundin statt sie zu speichern', async () => {
    alsKundin()
    const url = 'https://abc123.public.blob.vercel-storage.com/farms/farm_1/meldung/1.webp'
    const result = await meldungAbsenden(meldung({ art: 'FRAGE', screenshotUrl: url }))
    expect(result).toMatchObject({ ok: true })
    expect(meldungCreate.mock.calls[0][0].data).toMatchObject({ screenshotUrl: null })
  })
})
