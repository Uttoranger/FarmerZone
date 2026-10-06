/**
 * Die Frei-Prüfung der Hofadresse (checkSlugAvailability,
 * src/server/actions/onboarding.ts) — öffentlich aufrufbar, auch von der
 * Registrierung ohne Anmeldung (Nr. 17c, Altlast aus Bericht 15 (d)).
 * Datenbank und Request-Kontext gemockt, Zod, Slug-Regeln und Bremse echt.
 *
 * Beweist:
 *  - Die Antwort kennt nur „frei" oder „vergeben" ({ available, slug }, sonst
 *    nichts): Ein noch nicht freigeschalteter Hof und ein öffentlicher Hof
 *    ergeben dieselbe Antwort; reservierte Slugs sind „vergeben", ohne dass
 *    die Datenbank gefragt wird.
 *  - Der Slug in der Antwort ist genau der, den der Browser aus dem Namen
 *    selbst errechnet (generateSlug) — er verrät nichts darüber hinaus,
 *    keine Ausweich-Adresse mit Zahl.
 *  - Zod: Name ohne Inhalt, zu lang (über HOFNAME_MAX) oder kein Text →
 *    neutrale Antwort (null), keine Abfrage. 80 Zeichen gehen, auch wenn der
 *    Slug durch Umlaute doppelt so lang wird.
 *  - Jeder erzeugte Slug hält das Slug-Format (SLUG_MUSTER, SLUG_MAX).
 *  - Bremse in Produktion: je IP höchstens ADRESS_PRUEFUNG_MAX_PRO_MINUTE
 *    Prüfungen in der Minute, danach neutral (null) ohne Abfrage; eine
 *    andere IP ist davon unberührt. Lokal (nicht Produktion) keine Bremse.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const kontext = vi.hoisted(() => ({ ip: '203.0.113.20' }))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': kontext.ip })),
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: { farm: { findUnique: vi.fn(), create: vi.fn() } },
}))
vi.mock('@/lib/email', () => ({ sendNewFarmNotification: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { HOFNAME_MAX } from '@/lib/eingabegrenzen'
import { ADRESS_PRUEFUNG_MAX_PRO_MINUTE } from '@/lib/hof-adresse'
import { SLUG_MAX, SLUG_MUSTER, generateSlug } from '@/lib/slug'

type Aktionen = typeof import('@/server/actions/onboarding')

/** Frische Instanz — die Bremse lebt auf Modulebene. */
async function ladeAktionen(): Promise<Aktionen> {
  vi.resetModules()
  return import('@/server/actions/onboarding')
}

/** Produktion: Bremse an. env.ts verlangt dann Pflichtwerte — Platzhalter. */
function alsProduktion(): void {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('DATABASE_URL', 'postgresql://platzhalter@localhost:5432/keine')
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_platzhalter')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_platzhalter')
}

beforeEach(() => {
  vi.clearAllMocks()
  kontext.ip = '203.0.113.20'
  vi.mocked(prisma.farm.findUnique).mockResolvedValue(null)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('checkSlugAvailability — Antwort nur „frei" oder „vergeben"', () => {
  it('frei: genau { available: true, slug }', async () => {
    const { checkSlugAvailability } = await ladeAktionen()
    const antwort = await checkSlugAvailability('Hof am Bach')
    expect(antwort).toStrictEqual({ available: true, slug: 'hof-am-bach' })
  })

  it('ein noch nicht freigeschalteter Hof und ein öffentlicher Hof ergeben dieselbe Antwort', async () => {
    const { checkSlugAvailability } = await ladeAktionen()
    vi.mocked(prisma.farm.findUnique).mockResolvedValueOnce({ id: 'farm_wartet', approvedAt: null } as never)
    const wartet = await checkSlugAvailability('Hof am Bach')
    vi.mocked(prisma.farm.findUnique).mockResolvedValueOnce({ id: 'farm_online', approvedAt: new Date() } as never)
    const online = await checkSlugAvailability('Hof am Bach')

    expect(wartet).toStrictEqual({ available: false, slug: 'hof-am-bach' })
    expect(online).toStrictEqual(wartet)
    // Die Abfrage fragt den Freischaltungsstand gar nicht erst ab.
    for (const [argumente] of vi.mocked(prisma.farm.findUnique).mock.calls) {
      expect(argumente).toEqual({ where: { slug: 'hof-am-bach' }, select: { id: true } })
    }
  })

  it('reservierte Slugs sind „vergeben", ohne die Datenbank zu fragen', async () => {
    const { checkSlugAvailability } = await ladeAktionen()
    for (const name of ['Admin', 'API', 'Register', 'Für Höfe']) {
      expect(await checkSlugAvailability(name), name).toStrictEqual({ available: false, slug: generateSlug(name) })
    }
    expect(prisma.farm.findUnique).not.toHaveBeenCalled()
  })

  it('der Slug in der Antwort ist der, den der Browser aus dem Namen selbst errechnet', async () => {
    const { checkSlugAvailability } = await ladeAktionen()
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({ id: 'farm_belegt' } as never)
    for (const name of ['  Hof Öder  ', 'Müller & Söhne', 'Bio-Hof   Groß']) {
      const antwort = await checkSlugAvailability(name)
      expect(antwort?.slug, name).toBe(generateSlug(name))
      // Keine Ausweich-Adresse: Was createFarm stattdessen nähme, bleibt offen.
      expect(antwort?.slug).not.toMatch(/-\d+$/)
    }
  })
})

describe('checkSlugAvailability — Eingabe', () => {
  it('leer, nur Leerzeichen, kein Text → neutral, keine Abfrage', async () => {
    const { checkSlugAvailability } = await ladeAktionen()
    for (const eingabe of ['', '   ', 42, null, undefined, { name: 'Hof' }, ['Hof']] as unknown[]) {
      expect(await checkSlugAvailability(eingabe), String(eingabe)).toBeNull()
    }
    expect(prisma.farm.findUnique).not.toHaveBeenCalled()
  })

  it('länger als HOFNAME_MAX → neutral, keine Abfrage; genau HOFNAME_MAX geht', async () => {
    const { checkSlugAvailability } = await ladeAktionen()
    expect(await checkSlugAvailability('h'.repeat(HOFNAME_MAX + 1))).toBeNull()
    expect(await checkSlugAvailability('x'.repeat(100_000))).toBeNull()
    expect(prisma.farm.findUnique).not.toHaveBeenCalled()

    expect(await checkSlugAvailability('h'.repeat(HOFNAME_MAX))).toStrictEqual({
      available: true,
      slug: 'h'.repeat(HOFNAME_MAX),
    })
  })

  it('Ränder zählen nicht zur Länge (wie beim Anlegen)', async () => {
    const { checkSlugAvailability } = await ladeAktionen()
    expect(await checkSlugAvailability(`  ${'h'.repeat(HOFNAME_MAX)}  `)).not.toBeNull()
  })

  it('80 Umlaute ergeben einen doppelt so langen Slug — der gilt noch', async () => {
    const { checkSlugAvailability } = await ladeAktionen()
    const antwort = await checkSlugAvailability('ä'.repeat(HOFNAME_MAX))
    expect(antwort).toStrictEqual({ available: true, slug: 'ae'.repeat(HOFNAME_MAX) })
    expect(SLUG_MAX).toBeGreaterThanOrEqual(2 * HOFNAME_MAX)
  })
})

describe('Slug-Format', () => {
  it('jeder aus einem erlaubten Namen erzeugte Slug hält SLUG_MUSTER und SLUG_MAX', () => {
    const namen = [
      'Hof am Bach', '  -- Hof --  ', 'ÄÖÜ äöü ß ẞ', '!!!', '🐄 Kuhhof 🐄', 'a b\tc', 'İstanbul',
      'Hof---Mitte', '-', 'Äpfel', '12 Eichen', 'ß'.repeat(HOFNAME_MAX), 'Ä'.repeat(HOFNAME_MAX),
    ]
    for (const name of namen) {
      const slug = generateSlug(name)
      expect(slug, name).toMatch(SLUG_MUSTER)
      expect(slug.length, name).toBeLessThanOrEqual(SLUG_MAX)
    }
  })

  it('Gegenprobe: das Muster lehnt ab, was kein Slug ist', () => {
    for (const falsch of ['', '-hof', 'hof-', 'hof--mitte', 'Hof', 'hof mitte', 'hof_mitte', 'höf', 'hof/x']) {
      expect(falsch, falsch).not.toMatch(SLUG_MUSTER)
    }
  })
})

describe('checkSlugAvailability — Bremse', () => {
  it('in Produktion: nach dem Limit je IP neutral, ohne Abfrage; andere IP unberührt', async () => {
    alsProduktion()
    const { checkSlugAvailability } = await ladeAktionen()

    for (let i = 0; i < ADRESS_PRUEFUNG_MAX_PRO_MINUTE; i++) {
      expect(await checkSlugAvailability(`Hof ${i}`), `Aufruf ${i + 1}`).not.toBeNull()
    }
    vi.mocked(prisma.farm.findUnique).mockClear()

    expect(await checkSlugAvailability('Hof am Bach')).toBeNull()
    expect(prisma.farm.findUnique).not.toHaveBeenCalled()

    kontext.ip = '198.51.100.4'
    expect(await checkSlugAvailability('Hof am Bach')).toStrictEqual({ available: true, slug: 'hof-am-bach' })
  })

  it('ungültige Eingaben verbrauchen das Limit nicht', async () => {
    alsProduktion()
    const { checkSlugAvailability } = await ladeAktionen()
    for (let i = 0; i < ADRESS_PRUEFUNG_MAX_PRO_MINUTE + 5; i++) await checkSlugAvailability('')
    expect(await checkSlugAvailability('Hof am Bach')).not.toBeNull()
  })

  it('das Limit lässt normales Tippen durch (mindestens 20 Prüfungen in der Minute)', () => {
    expect(ADRESS_PRUEFUNG_MAX_PRO_MINUTE).toBeGreaterThanOrEqual(20)
  })

  it('lokal (nicht Produktion) keine Bremse', async () => {
    const { checkSlugAvailability } = await ladeAktionen()
    for (let i = 0; i < ADRESS_PRUEFUNG_MAX_PRO_MINUTE + 5; i++) {
      expect(await checkSlugAvailability(`Hof ${i}`)).not.toBeNull()
    }
  })
})
