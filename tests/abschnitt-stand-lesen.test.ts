/**
 * Die Lese-Aktion des frischen Stands (Nr. 50 Runde 1): ladeProfilStand
 * (server/actions/farm.ts) — Sitzung und Datenbank nachgebildet. Die
 * Schwester ladeAuftrittStand ist mit Nr. 65 entfallen: Die Abschnitte des
 * Auftritts schicken nur ihren Teil und lesen vorher nichts.
 *
 * Beweist: Ohne Sitzung sagt sie, dass man sich neu anmelden soll; mit
 * Sitzung, aber ohne Hof, dass wir den Hof nicht finden — zwei Sätze per Du,
 * mit Ausweg, aus einer Quelle (ABSCHNITT_SPEICHERN_TEXT). Vorher hieß es
 * knapp „Nicht angemeldet", auch dann, wenn nur der Hof fehlte.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSession, farmFinden } = vi.hoisted(() => ({
  getSession: vi.fn(),
  farmFinden: vi.fn(),
}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('@/lib/prisma', () => ({ prisma: { farm: { findUnique: farmFinden } } }))

import { ladeProfilStand } from '@/server/actions/farm'
import { ABSCHNITT_SPEICHERN_TEXT } from '@/lib/abschnitt-stand'

const SITZUNG = { user: { id: 'user-1' } }
const HOF = {
  name: 'Hof Test', ownerName: 'Max Mustermann', description: 'Gemüse aus Musterdorf', address: 'Musterweg 1',
  postalCode: '4900', city: 'Musterdorf', country: 'AT', phone: '+43 660 0000000', email: 'hof@example.com',
  latitude: null, longitude: null, betriebsnummer: null, betriebsstatus: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ladeProfilStand', () => {
  it('ohne Sitzung: neu anmelden — ohne Abfrage', async () => {
    getSession.mockResolvedValue(null)
    await expect(ladeProfilStand()).resolves.toEqual({ error: ABSCHNITT_SPEICHERN_TEXT.nichtAngemeldet })
    expect(farmFinden).not.toHaveBeenCalled()
  })

  it('angemeldet, aber ohne Hof: nicht „Nicht angemeldet", sondern wir finden den Hof nicht', async () => {
    getSession.mockResolvedValue(SITZUNG)
    farmFinden.mockResolvedValue(null)
    await expect(ladeProfilStand()).resolves.toEqual({ error: ABSCHNITT_SPEICHERN_TEXT.hofFehlt })
    expect(farmFinden).toHaveBeenCalledWith({ where: { ownerId: 'user-1' } })
  })

  it('mit Hof: das ganze Profil', async () => {
    getSession.mockResolvedValue(SITZUNG)
    farmFinden.mockResolvedValue(HOF)
    await expect(ladeProfilStand()).resolves.toEqual({ profil: HOF })
  })
})

describe('die Sätze', () => {
  it('per Du und mit Ausweg', () => {
    expect(ABSCHNITT_SPEICHERN_TEXT.nichtAngemeldet).toMatch(/^Du bist nicht mehr angemeldet\. Melde dich neu an/)
    expect(ABSCHNITT_SPEICHERN_TEXT.hofFehlt).toMatch(/deinen Hof[\s\S]*Lade die Seite neu/)
  })
})
