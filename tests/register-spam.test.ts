/**
 * Tests für die Bot-Abwehr der Registrierung (Honigtopf + Zeitschranke).
 *
 * Beweist am ECHTEN Code (src/server/actions/register.ts, src/lib/form-token.ts):
 *  - Gefüllter Honigtopf: keine Anlage, keine Rollenvergabe — aber dieselbe
 *    Erfolgsantwort wie bei einer echten Registrierung. Ein Bot soll nicht
 *    lernen, woran er gescheitert ist.
 *  - Unter drei Sekunden zwischen Seitenaufbau und Absenden: dieselbe stille
 *    Ablehnung. Ein gültiger, alter Zeitstempel läuft normal durch.
 *  - Manipulierte, fehlende und fremde Zeitstempel werden abgelehnt.
 *  - Ein zu lange offen gelegenes Formular bekommt als EINZIGER Fall eine
 *    sichtbare Meldung — sonst hielte ein Mensch sein Konto für angelegt.
 *
 * Prisma und Better Auth sind gemockt: die Zusicherung „es entsteht nichts"
 * wird daran geprüft, dass signUpEmail und user.update nie gerufen werden.
 * Die Betreiber-Mail hängt an createFarm (src/server/actions/onboarding.ts:65)
 * und damit an einem User, der hier gar nicht erst entsteht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn(), signUpEmail: vi.fn() } },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { update: vi.fn() } },
}))

import { registerFarmer } from '@/server/actions/register'
import {
  generateFormToken,
  checkFormToken,
  FORM_EXPIRED_MESSAGE,
  MIN_FORM_AGE_MS,
  MAX_FORM_AGE_MS,
} from '@/lib/form-token'
import { generateReorderToken } from '@/lib/reorder-token'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const signUpEmail = vi.mocked(auth.api.signUpEmail)
const userUpdate = vi.mocked(prisma.user.update)

const AUSGESTELLT = new Date('2026-08-01T10:00:00.000Z')

/** Ein Token so ausstellen, dass es beim Absenden `alterMs` alt ist. */
function tokenMitAlter(alterMs: number): string {
  vi.useFakeTimers()
  vi.setSystemTime(AUSGESTELLT)
  const token = generateFormToken()
  vi.setSystemTime(new Date(AUSGESTELLT.getTime() + alterMs))
  return token
}

/**
 * Ein Mensch: Honigtopf leer, Formular zehn Sekunden lang ausgefüllt.
 *
 * Den Zeitstempel stellt der Helfer NUR, wenn der Test keinen eigenen
 * mitbringt — sonst würde er die Uhr hinter dem Rücken des Tests noch einmal
 * vorstellen und dessen mühsam gealtertes Token wieder frisch aussehen lassen.
 */
function echteAnmeldung(overrides: Partial<Parameters<typeof registerFarmer>[0]> = {}) {
  return {
    firstName: 'Franz',
    lastName: 'Müller',
    email: 'franz@test.local',
    password: 'Hofladen1',
    website: '',
    formToken: overrides.formToken ?? tokenMitAlter(10_000),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  signUpEmail.mockResolvedValue({ user: { id: 'user_neu' } } as never)
  userUpdate.mockResolvedValue({} as never)
})

afterEach(() => {
  vi.useRealTimers()
})

// ── Honigtopf ───────────────────────────────────────────────────────────────

describe('Honigtopf', () => {
  it('legt bei gefülltem Feld NICHTS an, meldet aber Erfolg', async () => {
    const result = await registerFarmer(echteAnmeldung({ website: 'https://spam.example' }))

    expect(result).toEqual({ ok: true })
    expect(signUpEmail).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('gibt exakt dieselbe Antwort wie eine echte Registrierung — der Bot lernt nichts', async () => {
    const abgewiesen = await registerFarmer(echteAnmeldung({ website: 'x' }))
    const echt = await registerFarmer(echteAnmeldung())

    expect(abgewiesen).toEqual(echt)
  })

  it('wertet auch reine Leerzeichen als leer — ein Autofill-Rest ist kein Bot', async () => {
    const result = await registerFarmer(echteAnmeldung({ website: '   ' }))

    expect(result).toEqual({ ok: true })
    expect(signUpEmail).toHaveBeenCalledTimes(1)
  })

  it('sticht die Ablaufmeldung: gefüllter Honigtopf schweigt auch bei altem Formular', async () => {
    const result = await registerFarmer(
      echteAnmeldung({ website: 'spam', formToken: tokenMitAlter(MAX_FORM_AGE_MS + 1000) })
    )

    expect(result).toEqual({ ok: true })
    expect(signUpEmail).not.toHaveBeenCalled()
  })
})

// ── Zeitschranke ────────────────────────────────────────────────────────────

describe('Zeitschranke', () => {
  it('lehnt ein in unter drei Sekunden abgeschicktes Formular still ab', async () => {
    const result = await registerFarmer(echteAnmeldung({ formToken: tokenMitAlter(500) }))

    expect(result).toEqual({ ok: true })
    expect(signUpEmail).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('lehnt auch knapp unter der Grenze ab', async () => {
    const result = await registerFarmer(
      echteAnmeldung({ formToken: tokenMitAlter(MIN_FORM_AGE_MS - 1) })
    )

    expect(result).toEqual({ ok: true })
    expect(signUpEmail).not.toHaveBeenCalled()
  })

  it('lässt ein gültiges, altes Formular normal durchlaufen', async () => {
    const result = await registerFarmer(
      echteAnmeldung({ formToken: tokenMitAlter(MIN_FORM_AGE_MS) })
    )

    expect(result).toEqual({ ok: true })
    expect(signUpEmail).toHaveBeenCalledTimes(1)
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user_neu' },
      data: { role: 'FARMER' },
    })
  })

  it('lehnt einen manipulierten Zeitstempel still ab', async () => {
    const token = tokenMitAlter(10_000)
    const hmac = token.slice(token.lastIndexOf('.') + 1)
    // Zeitstempel auf „gerade eben" zurückgedreht, Signatur unverändert
    const gefaelscht = Buffer.from(`register:${Date.now()}`).toString('base64url')

    const result = await registerFarmer(echteAnmeldung({ formToken: `${gefaelscht}.${hmac}` }))

    expect(result).toEqual({ ok: true })
    expect(signUpEmail).not.toHaveBeenCalled()
  })

  it('lehnt eine manipulierte Signatur still ab', async () => {
    const token = tokenMitAlter(10_000)
    const [payload, hmac] = token.split('.')
    const gedreht = hmac.slice(0, -1) + (hmac.at(-1) === 'a' ? 'b' : 'a')

    const result = await registerFarmer(echteAnmeldung({ formToken: `${payload}.${gedreht}` }))

    expect(result).toEqual({ ok: true })
    expect(signUpEmail).not.toHaveBeenCalled()
  })

  it('lehnt ein fehlendes Formular-Token still ab — direkt gepostet, ohne Seitenaufbau', async () => {
    const result = await registerFarmer(echteAnmeldung({ formToken: '' }))

    expect(result).toEqual({ ok: true })
    expect(signUpEmail).not.toHaveBeenCalled()
  })

  it('meldet ein zu lange offenes Formular SICHTBAR — sonst hielte ein Mensch es für erledigt', async () => {
    const result = await registerFarmer(
      echteAnmeldung({ formToken: tokenMitAlter(MAX_FORM_AGE_MS + 1000) })
    )

    expect(result).toEqual({ error: FORM_EXPIRED_MESSAGE })
    expect(signUpEmail).not.toHaveBeenCalled()
  })
})

// ── Token-Modul für sich ────────────────────────────────────────────────────

describe('checkFormToken', () => {
  it('bewertet ein frisches Token als zu schnell und ein gealtertes als in Ordnung', () => {
    const token = tokenMitAlter(0)
    expect(checkFormToken(token)).toBe('zu-schnell')

    vi.setSystemTime(new Date(AUSGESTELLT.getTime() + MIN_FORM_AGE_MS))
    expect(checkFormToken(token)).toBe('ok')

    vi.setSystemTime(new Date(AUSGESTELLT.getTime() + MAX_FORM_AGE_MS + 1))
    expect(checkFormToken(token)).toBe('abgelaufen')
  })

  it('lehnt Müll, leere Eingaben und Zeitstempel aus der Zukunft ab', () => {
    expect(checkFormToken('')).toBe('ungueltig')
    expect(checkFormToken('kein-punkt')).toBe('ungueltig')
    expect(checkFormToken('a.b')).toBe('ungueltig')

    const token = tokenMitAlter(0)
    vi.setSystemTime(new Date(AUSGESTELLT.getTime() - 60_000))
    expect(checkFormToken(token)).toBe('ungueltig')
  })

  it('lehnt ein gültig signiertes Token anderen Zwecks ab', () => {
    // Gleiches Geheimnis, gleiches Verfahren — aber kein Registrierungs-Token.
    expect(checkFormToken(generateReorderToken('order-1', 'farm-1'))).toBe('ungueltig')
  })
})
