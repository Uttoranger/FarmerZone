/**
 * Die Bremse über alle Instanzen (Register R1, Nr. 40) — Regeln aus
 * src/lib/bremse-datenbank.ts echt, die Datenbank in
 * src/server/bremse-datenbank.ts gemockt. Die Zählung in einem echten
 * Postgres (Nebenläufigkeit, zwei Instanzen, Fensterwechsel, Aufräumen)
 * prüft tests/integration/bremse-datenbank.int.test.ts.
 *
 * Beweist:
 *  - Grenzen je Weg sind die der ersten Stufe (gleiche Zahlen und Fenster).
 *  - Der Schlüssel ist Zweck + HMAC: keine IP, keine Adresse im Klartext,
 *    abhängig vom Geheimnis und vom Zweck.
 *  - Feste Fenster: Beginn, Ende, Retry-After.
 *  - Gezählt wird mit EINEM parametrisierten INSERT … ON CONFLICT … RETURNING;
 *    über der Grenze = gebremst, alle Merkmale werden gezählt.
 *  - FAIL-OPEN: Datenbankfehler und Zeitlimit lassen durch und melden an
 *    Sentry — ohne Schlüssel, IP oder Adresse.
 *  - Anmeldecode und Checkout bremsen nur in Produktion; ohne Header zählt
 *    keine IP.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/prisma', () => ({
  prisma: { $queryRaw: vi.fn(), rateLimitZaehler: { deleteMany: vi.fn() } },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import {
  DB_BREMSEN,
  DB_BREMSE_ZEITLIMIT_MS,
  REGISTRIERUNG_JE_IP,
  ZU_VIELE_ANFRAGEN,
  adressMerkmal,
  bremsSchluessel,
  fensterBeginn,
  fensterEnde,
  innerhalbDerGrenze,
  sekundenBisFensterEnde,
} from '@/lib/bremse-datenbank'
import { CHECKOUT_RESERVE_MAX_PER_WINDOW, RATE_LIMIT_WINDOW_MS } from '@/lib/rate-limit'
import { ANMELDECODE_RATE_LIMIT, CODE_ANFORDERUNGEN_JE_ADRESSE } from '@/lib/anmeldecode'
import { MELDUNGEN_PRO_STUNDE } from '@/lib/meldung'
import {
  anmeldecodeGebremst,
  bremseCheckout,
  bremseUeberAlleInstanzen,
  raeumeBremsZaehlerAuf,
  zaehleVersuche,
} from '@/server/bremse-datenbank'

const queryRaw = vi.mocked(prisma.$queryRaw)
const IP = '203.0.113.7'
const ADRESSE = 'kundin@example.com'
const JETZT = new Date('2026-10-07T12:00:30.000Z')

/** Die Datenbank antwortet je Schlüssel mit dem Stand aus `stand` (sonst 1). */
function datenbankZaehlt(stand: (schluessel: string) => number = () => 1): void {
  queryRaw.mockImplementation((async (...args: unknown[]) => {
    const werte = sqlWerte(args)
    const schluessel = werte.filter((w): w is string => typeof w === 'string')
    return schluessel.map((s) => ({ schluessel: s, zaehler: stand(s) }))
  }) as never)
}

/** Die Parameter des Tagged-Template-Aufrufs ($queryRaw`…${x}…`), flach. */
function sqlWerte(args: unknown[]): unknown[] {
  const flach: unknown[] = []
  const sammle = (wert: unknown) => {
    if (wert && typeof wert === 'object' && 'values' in wert && Array.isArray((wert as { values: unknown[] }).values)) {
      for (const w of (wert as { values: unknown[] }).values) sammle(w)
    } else {
      flach.push(wert)
    }
  }
  for (const a of args.slice(1)) sammle(a)
  return flach
}

function sqlText(args: unknown[]): string {
  return (args[0] as TemplateStringsArray).join('?')
}

beforeEach(() => {
  vi.clearAllMocks()
  queryRaw.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('Grenzen je Weg = die der ersten Stufe', () => {
  it('Checkout: 20 je Minute, je IP und je Sitzung — wie enforceRateLimit', () => {
    for (const b of [DB_BREMSEN.checkoutIp, DB_BREMSEN.checkoutSitzung]) {
      expect(b.max).toBe(CHECKOUT_RESERVE_MAX_PER_WINDOW)
      expect(b.fensterMs).toBe(RATE_LIMIT_WINDOW_MS)
    }
  })

  it('Anmeldecode und Bestellungen finden: 3 je Minute je IP, 5 Codes je Adresse in 15 Minuten', () => {
    for (const b of [
      DB_BREMSEN.anmeldecodeAnfordernIp,
      DB_BREMSEN.anmeldecodePruefenIp,
      DB_BREMSEN.bestellungenAnfordernIp,
      DB_BREMSEN.bestellungenPruefenIp,
    ]) {
      expect(b).toMatchObject({ max: ANMELDECODE_RATE_LIMIT.max, fensterMs: ANMELDECODE_RATE_LIMIT.window * 1000 })
    }
    for (const b of [DB_BREMSEN.anmeldecodeAdresse, DB_BREMSEN.bestellungenAdresse]) {
      expect(b).toMatchObject({ max: CODE_ANFORDERUNGEN_JE_ADRESSE.max, fensterMs: CODE_ANFORDERUNGEN_JE_ADRESSE.fensterMs })
    }
  })

  it('Problem melden: 5 je Stunde je IP — wie die Drossel in meldung.ts', () => {
    expect(DB_BREMSEN.meldungIp).toMatchObject({ max: MELDUNGEN_PRO_STUNDE, fensterMs: 60 * 60 * 1000 })
  })

  it('Registrierung: 10 je Minute je IP — die Zahl des Better-Auth-Limits in auth.ts', () => {
    const quelle = readFileSync(join(process.cwd(), 'src', 'lib', 'auth.ts'), 'utf8')
    expect(quelle).toMatch(new RegExp(`AUTH_RATE_LIMIT_MAX = ${REGISTRIERUNG_JE_IP.max}\\b`))
    expect(quelle).toMatch(new RegExp(`AUTH_RATE_LIMIT_WINDOW_SECONDS = ${REGISTRIERUNG_JE_IP.fensterMs / 1000}\\b`))
    expect(DB_BREMSEN.registrierungIp).toMatchObject(REGISTRIERUNG_JE_IP)
  })

  it('jeder Zweck ist eindeutig und ein festes Wort (steht im Klartext vor dem Hash)', () => {
    const zwecke = Object.values(DB_BREMSEN).map((b) => b.zweck)
    expect(new Set(zwecke).size).toBe(zwecke.length)
    for (const z of zwecke) expect(z).toMatch(/^[a-z-]+$/)
  })
})

describe('bremsSchluessel — nie das Merkmal im Klartext', () => {
  it('Zweck plus 32 Hex-Zeichen, ohne IP oder Adresse', () => {
    for (const merkmal of [IP, ADRESSE, 'int-sitzung-1']) {
      const s = bremsSchluessel('geheimnis-a', 'checkout-ip', merkmal)
      expect(s).toMatch(/^checkout-ip:[0-9a-f]{32}$/)
      expect(s).not.toContain(merkmal)
      expect(s).not.toContain('203.0')
      expect(s).not.toContain('@')
    }
  })

  it('gleich für dasselbe Merkmal (zwei Instanzen finden dieselbe Zeile)', () => {
    expect(bremsSchluessel('g', 'checkout-ip', IP)).toBe(bremsSchluessel('g', 'checkout-ip', IP))
  })

  it('hängt am Geheimnis — ohne es lässt sich der Schlüssel nicht nachrechnen', () => {
    expect(bremsSchluessel('g1', 'checkout-ip', IP)).not.toBe(bremsSchluessel('g2', 'checkout-ip', IP))
  })

  it('hängt am Zweck — dieselbe IP hat je Weg einen anderen Hash', () => {
    const a = bremsSchluessel('g', 'checkout-ip', IP).split(':')[1]
    const b = bremsSchluessel('g', 'meldung-ip', IP).split(':')[1]
    expect(a).not.toBe(b)
  })

  it('Adressen ohne Rand und klein — wie die erste Stufe', () => {
    expect(adressMerkmal('  Kundin@Example.COM ')).toBe(ADRESSE)
  })
})

describe('feste Fenster', () => {
  it('Beginn ist ein Vielfaches der Fensterlänge, Ende eine Länge später', () => {
    expect(fensterBeginn(JETZT, 60_000).toISOString()).toBe('2026-10-07T12:00:00.000Z')
    expect(fensterEnde(JETZT, 60_000).toISOString()).toBe('2026-10-07T12:01:00.000Z')
    expect(fensterBeginn(JETZT, 15 * 60_000).toISOString()).toBe('2026-10-07T12:00:00.000Z')
    expect(fensterBeginn(JETZT, 60 * 60_000).toISOString()).toBe('2026-10-07T12:00:00.000Z')
  })

  it('die letzte Millisekunde gehört noch zum Fenster, die nächste nicht', () => {
    const letzte = new Date('2026-10-07T12:00:59.999Z')
    const naechste = new Date('2026-10-07T12:01:00.000Z')
    expect(fensterBeginn(letzte, 60_000).getTime()).toBe(fensterBeginn(JETZT, 60_000).getTime())
    expect(fensterBeginn(naechste, 60_000).getTime()).toBe(fensterEnde(JETZT, 60_000).getTime())
  })

  it('Retry-After: Sekunden bis zum Fensterende, mindestens 1', () => {
    expect(sekundenBisFensterEnde(JETZT, 60_000)).toBe(30)
    expect(sekundenBisFensterEnde(new Date('2026-10-07T12:00:59.999Z'), 60_000)).toBe(1)
  })

  it('erlaubt bis einschließlich zur Grenze', () => {
    expect(innerhalbDerGrenze(3, 3)).toBe(true)
    expect(innerhalbDerGrenze(4, 3)).toBe(false)
  })
})

describe('zaehleVersuche — ein atomares INSERT … ON CONFLICT', () => {
  it('ein parametrisierter Aufruf: gehashte Schlüssel als Parameter, kein Klartext im SQL', async () => {
    datenbankZaehlt()
    await zaehleVersuche(
      [
        { bremse: DB_BREMSEN.checkoutIp, merkmal: IP },
        { bremse: DB_BREMSEN.checkoutSitzung, merkmal: 'int-sitzung-1' },
      ],
      JETZT
    )
    expect(queryRaw).toHaveBeenCalledTimes(1)
    const args = queryRaw.mock.calls[0] as unknown[]
    const sql = sqlText(args)
    expect(sql).toMatch(/INSERT INTO "RateLimitZaehler"/)
    expect(sql).toMatch(/ON CONFLICT \("schluessel", "fensterStart"\)/)
    expect(sql).toMatch(/"zaehler" = "RateLimitZaehler"\."zaehler" \+ 1/)
    expect(sql).toMatch(/RETURNING "schluessel", "zaehler"/)
    expect(sql).not.toContain(IP)

    const werte = sqlWerte(args)
    const schluessel = werte.filter((w) => typeof w === 'string') as string[]
    expect(schluessel).toHaveLength(2)
    expect(schluessel[0]).toMatch(/^checkout-ip:[0-9a-f]{32}$/)
    expect(schluessel[1]).toMatch(/^checkout-sitzung:[0-9a-f]{32}$/)
    expect(JSON.stringify(werte)).not.toContain(IP)
    expect(JSON.stringify(werte)).not.toContain('int-sitzung-1')
    // Fensterbeginn und Ablauf als Zeitpunkte, nicht als Text.
    expect(werte.filter((w) => w instanceof Date)).toEqual([
      new Date('2026-10-07T12:00:00.000Z'),
      new Date('2026-10-07T12:01:00.000Z'),
      new Date('2026-10-07T12:00:00.000Z'),
      new Date('2026-10-07T12:01:00.000Z'),
    ])
  })

  it('derselbe Schlüssel zweimal wird nur einmal geschrieben (sonst bricht ON CONFLICT ab)', async () => {
    datenbankZaehlt(() => 2)
    const staende = await zaehleVersuche(
      [
        { bremse: DB_BREMSEN.checkoutIp, merkmal: IP },
        { bremse: DB_BREMSEN.checkoutIp, merkmal: IP },
      ],
      JETZT
    )
    expect(sqlWerte(queryRaw.mock.calls[0] as unknown[]).filter((w) => typeof w === 'string')).toHaveLength(1)
    expect(staende).toEqual([2, 2])
  })

  it('ohne Versuche keine Abfrage', async () => {
    expect(await zaehleVersuche([], JETZT)).toEqual([])
    expect(queryRaw).not.toHaveBeenCalled()
  })
})

describe('bremseUeberAlleInstanzen', () => {
  it('erlaubt, solange jeder Stand innerhalb seiner Grenze liegt', async () => {
    datenbankZaehlt(() => 20)
    expect(await bremseUeberAlleInstanzen([{ bremse: DB_BREMSEN.checkoutIp, merkmal: IP }], JETZT)).toBe(true)
  })

  it('bremst, sobald EIN Merkmal über der Grenze ist — gezählt werden trotzdem alle', async () => {
    datenbankZaehlt((s) => (s.startsWith('checkout-sitzung:') ? 21 : 1))
    const erlaubt = await bremseUeberAlleInstanzen(
      [
        { bremse: DB_BREMSEN.checkoutIp, merkmal: IP },
        { bremse: DB_BREMSEN.checkoutSitzung, merkmal: 'int-sitzung-1' },
      ],
      JETZT
    )
    expect(erlaubt).toBe(false)
    expect(sqlWerte(queryRaw.mock.calls[0] as unknown[]).filter((w) => typeof w === 'string')).toHaveLength(2)
  })

  it('FAIL-OPEN bei Datenbankfehler: lässt durch, Sentry erfährt es ohne IP, Adresse oder Schlüssel', async () => {
    const fehler = new Error(`Verbindung verloren bei ${IP} für ${ADRESSE}`)
    fehler.name = 'PrismaClientKnownRequestError'
    queryRaw.mockRejectedValue(fehler)

    const erlaubt = await bremseUeberAlleInstanzen(
      [
        { bremse: DB_BREMSEN.anmeldecodeAnfordernIp, merkmal: IP },
        { bremse: DB_BREMSEN.anmeldecodeAdresse, merkmal: ADRESSE },
      ],
      JETZT
    )
    expect(erlaubt).toBe(true)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [gemeldet, kontext] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error, Record<string, unknown>]
    expect(gemeldet).not.toBe(fehler)
    expect(gemeldet.name).toBe('PrismaClientKnownRequestError')
    expect(kontext).toMatchObject({
      tags: { aufgabe: 'bremse-datenbank', grund: 'datenbank', zweck: 'anmeldecode-anfordern-ip,anmeldecode-adresse' },
    })
    const alles = JSON.stringify([gemeldet.message, gemeldet.name, kontext])
    expect(alles).not.toContain(IP)
    expect(alles).not.toContain(ADRESSE)
    expect(alles).not.toMatch(/[0-9a-f]{32}/)
  })

  it('FAIL-OPEN bei Zeitlimit: eine hängende Datenbank hält niemanden auf', async () => {
    vi.useFakeTimers()
    queryRaw.mockImplementation((() => new Promise(() => {})) as never)
    const ergebnis = bremseUeberAlleInstanzen([{ bremse: DB_BREMSEN.checkoutIp, merkmal: IP }], JETZT)
    await vi.advanceTimersByTimeAsync(DB_BREMSE_ZEITLIMIT_MS)
    expect(await ergebnis).toBe(true)
    expect(vi.mocked(Sentry.captureException).mock.calls[0]?.[1]).toMatchObject({ tags: { grund: 'zeitlimit' } })
  })

  it('Gegenprobe: ohne Fehler keine Sentry-Meldung', async () => {
    datenbankZaehlt()
    await bremseUeberAlleInstanzen([{ bremse: DB_BREMSEN.checkoutIp, merkmal: IP }], JETZT)
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})

describe('anmeldecodeGebremst — zweite Stufe im Hook von auth.ts', () => {
  const anfrage = () => new Headers({ 'x-forwarded-for': `${IP}, 10.0.0.1` })

  it('außerhalb der Produktion: nie gebremst, keine Abfrage', async () => {
    datenbankZaehlt(() => 99)
    expect(await anmeldecodeGebremst('anfordern', anfrage(), ADRESSE, JETZT)).toBe(false)
    expect(queryRaw).not.toHaveBeenCalled()
  })

  it('Anfordern zählt je IP und je Adresse; über einer Grenze gebremst', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    datenbankZaehlt((s) => (s.startsWith('anmeldecode-adresse:') ? CODE_ANFORDERUNGEN_JE_ADRESSE.max + 1 : 1))
    expect(await anmeldecodeGebremst('anfordern', anfrage(), '  Kundin@Example.COM ', JETZT)).toBe(true)
    const schluessel = sqlWerte(queryRaw.mock.calls[0] as unknown[]).filter((w) => typeof w === 'string') as string[]
    expect(schluessel.map((s) => s.split(':')[0])).toEqual(['anmeldecode-anfordern-ip', 'anmeldecode-adresse'])
    // Die Adresse zählt normalisiert: derselbe Schlüssel wie bei der sauberen Schreibweise.
    expect(schluessel[1]).toBe(bremsSchluessel(process.env.BETTER_AUTH_SECRET!, 'anmeldecode-adresse', ADRESSE))
  })

  it('Anmelden mit Code zählt nur je IP', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    datenbankZaehlt(() => ANMELDECODE_RATE_LIMIT.max)
    expect(await anmeldecodeGebremst('pruefen', anfrage(), null, JETZT)).toBe(false)
    const schluessel = sqlWerte(queryRaw.mock.calls[0] as unknown[]).filter((w) => typeof w === 'string') as string[]
    expect(schluessel.map((s) => s.split(':')[0])).toEqual(['anmeldecode-pruefen-ip'])
  })

  it('ohne Header (Aufruf vom Server) zählt keine IP — nur die Adresse', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    datenbankZaehlt()
    await anmeldecodeGebremst('anfordern', undefined, ADRESSE, JETZT)
    const schluessel = sqlWerte(queryRaw.mock.calls[0] as unknown[]).filter((w) => typeof w === 'string') as string[]
    expect(schluessel.map((s) => s.split(':')[0])).toEqual(['anmeldecode-adresse'])
    vi.clearAllMocks()
    expect(await anmeldecodeGebremst('pruefen', undefined, null, JETZT)).toBe(false)
    expect(queryRaw).not.toHaveBeenCalled()
  })

  it('Datenbankfehler: nicht gebremst (fail-open)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    queryRaw.mockRejectedValue(new Error('weg'))
    expect(await anmeldecodeGebremst('anfordern', anfrage(), ADRESSE, JETZT)).toBe(false)
  })
})

describe('bremseCheckout — zweite Stufe in /api/checkout', () => {
  const anfrage = () => new Request('http://localhost/api/checkout', { headers: { 'x-forwarded-for': IP } })

  it('außerhalb der Produktion: null, keine Abfrage', async () => {
    expect(await bremseCheckout(anfrage(), 'int-sitzung-1', JETZT)).toBeNull()
    expect(queryRaw).not.toHaveBeenCalled()
  })

  it('innerhalb der Grenze: null', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    datenbankZaehlt(() => CHECKOUT_RESERVE_MAX_PER_WINDOW)
    expect(await bremseCheckout(anfrage(), 'int-sitzung-1', JETZT)).toBeNull()
  })

  it('über der Grenze: 429 mit dem Text der ersten Stufe und Retry-After bis zum Fensterende', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    datenbankZaehlt(() => CHECKOUT_RESERVE_MAX_PER_WINDOW + 1)
    const antwort = await bremseCheckout(anfrage(), 'int-sitzung-1', JETZT)
    expect(antwort?.status).toBe(429)
    expect(antwort?.headers.get('Retry-After')).toBe('30')
    expect(await antwort?.json()).toEqual({ error: ZU_VIELE_ANFRAGEN })
  })

  it('Datenbankfehler: null — eine gültige Bestellung scheitert nie an der Bremse', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    queryRaw.mockRejectedValue(new Error('weg'))
    expect(await bremseCheckout(anfrage(), 'int-sitzung-1', JETZT)).toBeNull()
  })
})

describe('raeumeBremsZaehlerAuf', () => {
  it('löscht nur Zeilen, deren Fenster vorbei ist', async () => {
    vi.mocked(prisma.rateLimitZaehler.deleteMany).mockResolvedValue({ count: 4 })
    expect(await raeumeBremsZaehlerAuf(JETZT)).toBe(4)
    expect(prisma.rateLimitZaehler.deleteMany).toHaveBeenCalledWith({ where: { ablauf: { lt: JETZT } } })
  })
})
