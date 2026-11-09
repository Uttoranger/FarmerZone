/**
 * „Beispiel ansehen“ gegen ein ECHTES Postgres (Register N48, Nr. 270;
 * zeigeMailBeispielAction in src/server/actions/betrieb.ts).
 *
 * Beweist mit echter Anmeldung (Better Auth) und der echten Admin-Wache:
 *  - jedes Beispiel der Liste kommt mit Betreff und HTML zurück, und danach
 *    hat KEINE Tabelle des Schemas eine Zeile mehr oder weniger (alle
 *    Tabellen aus pg_tables vor und nach gezählt) — kein MailAuftrag, kein
 *    Protokolleintrag, keine Zeile im Admin-Protokoll, nichts;
 *  - ohne Anmeldung antwortet die Wache, und auch dann ändert sich nichts;
 *  - Gegenprobe: Die Zählung bemerkt eine einzige neue Zeile (ein Hof).
 * Resend ist eine Attrappe, die jeden Bau meldet — sie wird nie gebaut.
 * Daten mit `int-`, Adressen @example.com (erfunden). Danach weg.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const resendBau = vi.hoisted(() => vi.fn())

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class {
    constructor() {
      resendBau()
    }
  },
}))

import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { MAIL_BEISPIEL_IDS } from '@/lib/betrieb-mails'
import { zeigeMailBeispielAction } from '@/server/actions/betrieb'
import { erstelleHof, erstelleHofMitAnmeldung, machePasskeyAdmin, raeumeAuf } from './setup/basis'

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  await raeumeAuf()
})

/** Zeilen je Tabelle des Schemas `public` — alle Tabellen, die Postgres kennt, nicht eine Liste von Hand. */
async function zaehleAlleTabellen(): Promise<Record<string, number>> {
  const tabellen = await prisma.$queryRaw<{ name: string }[]>`SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  const stand: Record<string, number> = {}
  for (const { name } of tabellen) {
    // Der Name kommt aus dem Katalog, nie von außen; trotzdem als Bezeichner gequotet.
    const [zeile] = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${name.replaceAll('"', '""')}"`)
    stand[name] = zeile?.n ?? -1
  }
  return stand
}

async function alsAdmin(): Promise<void> {
  const { ownerId, cookie } = await erstelleHofMitAnmeldung()
  await machePasskeyAdmin(ownerId)
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
}

describe('Beispiele schreiben nichts', () => {
  it('jedes Beispiel: Betreff und HTML — keine Tabelle ändert ihre Zeilenzahl', async () => {
    await alsAdmin()
    const vorher = await zaehleAlleTabellen()
    expect(Object.keys(vorher).length).toBeGreaterThan(20)

    for (const beispiel of MAIL_BEISPIEL_IDS) {
      const antwort = await zeigeMailBeispielAction({ beispiel })
      expect(antwort, beispiel).toMatchObject({ ok: true })
      if ('ok' in antwort) expect(antwort.html.length, beispiel).toBeGreaterThan(0)
    }

    expect(await zaehleAlleTabellen()).toEqual(vorher)
    expect(resendBau).not.toHaveBeenCalled()
  }, 60_000)

  it('ohne Anmeldung: der Satz der Wache, keine Mail, keine Zeile', async () => {
    const vorher = await zaehleAlleTabellen()

    const antwort = await zeigeMailBeispielAction({ beispiel: 'anmeldecode' })

    expect(antwort).toHaveProperty('error')
    expect(antwort).not.toHaveProperty('html')
    expect(await zaehleAlleTabellen()).toEqual(vorher)
  })

  it('Gegenprobe: die Zählung bemerkt eine einzige neue Zeile', async () => {
    const vorher = await zaehleAlleTabellen()

    await erstelleHof()

    const nachher = await zaehleAlleTabellen()
    expect(nachher).not.toEqual(vorher)
    expect(Object.keys(nachher).filter((t) => nachher[t] !== vorher[t])).toContain('Farm')
  })
})
