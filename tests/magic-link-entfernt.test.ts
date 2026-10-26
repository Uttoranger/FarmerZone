/**
 * Magic-Link-Plugin entfernt (Nr. 178, E7) — der Nachweis, dass kein Weg es nutzt.
 *
 * Beweist:
 *  - Im Quelltext unter src/ ruft niemand mehr `magicLink(…)`, `sendMagicLinkEmail` oder die Vorlage
 *    `customer-magic-link` auf; auch der Browser-Client kennt kein Magic-Link-Plugin.
 *  - Better Auth kennt weder das Plugin noch seine Endpunkte (`signInMagicLink`, `magicLinkVerify`).
 *  - Über HTTP antworten `/sign-in/magic-link` und `/magic-link/verify` mit 404 — Gegenprobe: ein bestehender Weg
 *    (`/ok`) antwortet 200, die 404 kommt also nicht vom Aufbau des Tests.
 * Dasselbe gegen ein echtes Postgres: tests/integration/anmeldecode.int.test.ts („Magic Links lassen sich nicht mehr
 * anfordern").
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const SRC = join(process.cwd(), 'src')

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return dateien(pfad)
    return /\.tsx?$/.test(name) ? [pfad] : []
  })
}

describe('Magic Link: kein Weg nutzt ihn', () => {
  it('im Quelltext kein Plugin, keine Versandfunktion, keine Vorlage', () => {
    const funde = dateien(SRC).filter((pfad) => /\bmagicLink\(|sendMagicLinkEmail|customer-magic-link|magicLinkClient/.test(readFileSync(pfad, 'utf8')))
    expect(funde).toEqual([])
  }, 30_000)

  it('Better Auth kennt weder Plugin noch Endpunkte', async () => {
    const { auth } = await import('@/lib/auth')
    expect((auth.options.plugins ?? []).map((p) => p.id)).not.toContain('magic-link')
    expect('signInMagicLink' in auth.api).toBe(false)
    expect('magicLinkVerify' in auth.api).toBe(false)
  }, 30_000)

  it('über HTTP 404 — Gegenprobe: /ok antwortet', async () => {
    const { auth } = await import('@/lib/auth')
    const basis = 'http://localhost:3000/api/auth'
    const anfordern = await auth.handler(
      new Request(`${basis}/sign-in/magic-link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ email: 'erika@example.com' }),
      })
    )
    expect(anfordern.status).toBe(404)
    expect((await auth.handler(new Request(`${basis}/magic-link/verify?token=erfunden`))).status).toBe(404)
    expect((await auth.handler(new Request(`${basis}/ok`))).status).toBe(200)
  }, 30_000)
})
