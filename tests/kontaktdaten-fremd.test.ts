/**
 * Register B3 (Nr. 27): Name und Telefon aus einer FREMDEN Alt-Registrierung
 * leeren — der Server-Teil hinter `databaseHooks.account.delete.before`
 * (src/server/kontaktdaten-fremd.ts).
 *
 * Beweist mit gemockter Datenbank:
 *  - Geleert wird nur über eine Bedingung in der WHERE-Klausel: genau dieses
 *    Konto, noch unbestätigt, CUSTOMER, kein Betreiber.
 *  - Andere Pfade oder Anbieter fassen die Datenbank nicht an.
 *  - Ein Datenbankfehler wirft nicht (die Anmeldung darf nicht scheitern),
 *    geht aber nach Sentry — ohne Adresse.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { updateMany: vi.fn() } } }))

import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { leereKontaktdatenNachFremdemPasswort } from '@/server/kontaktdaten-fremd'

const updateMany = vi.mocked(prisma.user.updateMany)

beforeEach(() => {
  vi.clearAllMocks()
  updateMany.mockResolvedValue({ count: 1 } as never)
})

describe('leereKontaktdatenNachFremdemPasswort', () => {
  it('leert Name und Telefon nur für ein unbestätigtes Kundinnen-Konto — Bedingung in der WHERE-Klausel', async () => {
    await leereKontaktdatenNachFremdemPasswort({ userId: 'user_1', providerId: 'credential' }, '/sign-in/email-otp')

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'user_1', emailVerified: false, role: 'CUSTOMER', isAdmin: false },
      data: { name: '', phone: null },
    })
  })

  it('ein anderer Pfad oder Anbieter fasst nichts an', async () => {
    await leereKontaktdatenNachFremdemPasswort({ userId: 'user_1', providerId: 'credential' }, '/delete-user')
    await leereKontaktdatenNachFremdemPasswort({ userId: 'user_1', providerId: 'google' }, '/sign-in/email-otp')
    await leereKontaktdatenNachFremdemPasswort({ userId: 'user_1', providerId: 'credential' }, null)

    expect(updateMany).not.toHaveBeenCalled()
  })

  it('ein Datenbankfehler wirft nicht, geht aber ohne Adresse nach Sentry', async () => {
    updateMany.mockRejectedValue(new Error('Verbindung weg bei kundin@example.com'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      leereKontaktdatenNachFremdemPasswort({ userId: 'user_1', providerId: 'credential' }, '/sign-in/email-otp')
    ).resolves.toBeUndefined()

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(Sentry.captureException).mock.calls)).not.toContain('@')
  })
})
