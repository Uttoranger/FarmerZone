/**
 * Zod an zwei Systemgrenzen, die ihr Argument bisher ungeprüft bzw. ohne Zod
 * übernahmen (Nr. 19b, Morgenbericht Lauf 4 §7):
 *
 *  - `updateSubscription` (src/server/actions/subscriptions.ts): `farmId` und
 *    die beiden Schalter kommen aus dem Browser. Ohne Prüfung landete jede
 *    Zeichenkette (auch ein Objekt) als Hof-Kennung im upsert.
 *  - `loeseOrtAuf` (src/server/actions/hoefe.ts): öffentliche Aktion ohne
 *    Anmeldung — Text, Länge und Mindestlänge jetzt aus einem Schema.
 *
 * Prisma, Better Auth und die Nominatim-Anbindung sind gemockt; die Schemas
 * laufen echt. Aussage: Ungültiges erreicht nie die Datenbank bzw. Nominatim,
 * Gültiges schon (Gegenprobe).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    customerFarmSubscription: { upsert: vi.fn(), updateMany: vi.fn() },
  },
}))
// Die Bestätigungsmail (Double-Opt-in, Nr. 38) geht nach der Antwort — hier nicht.
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))
vi.mock('@/lib/geokodierung', async (original) => ({
  ...(await original<typeof import('@/lib/geokodierung')>()),
  sucheOrtspunkt: vi.fn(),
}))

import { updateSubscription } from '@/server/actions/subscriptions'
import { loeseOrtAuf } from '@/server/actions/hoefe'
import { aboAenderungSchema } from '@/schemas/abo'
import { ORTSSUCHE_MAX_ZEICHEN, ortssucheSchema } from '@/schemas/ortssuche'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sucheOrtspunkt } from '@/lib/geokodierung'

const upsert = vi.mocked(prisma.customerFarmSubscription.upsert)
const suche = vi.mocked(sucheOrtspunkt)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user_1' } } as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    email: 'anna@example.com', emailVerified: true, role: 'CUSTOMER', isAdmin: false,
  } as never)
  upsert.mockResolvedValue({ id: 'abo_1', optInEmail: false, emailOptInAngefragtAm: null, emailOptInBestaetigtAm: null } as never)
  vi.mocked(prisma.customerFarmSubscription.updateMany).mockResolvedValue({ count: 1 } as never)
  suche.mockResolvedValue([])
})

describe('aboAenderungSchema', () => {
  it('nimmt eine Hof-Kennung und zwei echte Schalter an', () => {
    expect(aboAenderungSchema.safeParse({ farmId: 'cmabc123', optInEmail: true, optInWhatsApp: false }).success).toBe(true)
  })

  it.each([
    ['leere Kennung', { farmId: '', optInEmail: true, optInWhatsApp: false }],
    ['Kennung mit Sonderzeichen', { farmId: 'farm 1; DROP', optInEmail: true, optInWhatsApp: false }],
    ['überlange Kennung', { farmId: 'a'.repeat(65), optInEmail: true, optInWhatsApp: false }],
    ['Objekt statt Kennung', { farmId: { not: '' }, optInEmail: true, optInWhatsApp: false }],
    ['Schalter als Text', { farmId: 'cmabc123', optInEmail: 'true', optInWhatsApp: false }],
  ])('lehnt ab: %s', (_fall, eingabe) => {
    expect(aboAenderungSchema.safeParse(eingabe).success).toBe(false)
  })
})

describe('updateSubscription — ungültige Eingabe erreicht die Datenbank nie', () => {
  it.each([
    ['leere Kennung', '', true, false],
    ['Objekt statt Kennung', { not: '' }, true, false],
    ['Schalter als Text', 'cmabc123', 'ja', false],
  ])('%s → Fehler, kein upsert', async (_fall, farmId, email, whatsapp) => {
    const ergebnis = await updateSubscription(farmId as never, email as never, whatsapp as never)
    expect(ergebnis.error).toBeTruthy()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('Gegenprobe: gültige Eingabe wird gespeichert', async () => {
    expect(await updateSubscription('cmabc123', true, false)).toEqual({ email: 'wartet' })
    expect(upsert).toHaveBeenCalledTimes(1)
  })
})

describe('ortssucheSchema und loeseOrtAuf', () => {
  it('schneidet Ränder ab und kappt auf die Höchstlänge', () => {
    const lang = `  ${'x'.repeat(ORTSSUCHE_MAX_ZEICHEN + 20)}  `
    expect(ortssucheSchema.parse(lang)).toHaveLength(ORTSSUCHE_MAX_ZEICHEN)
    expect(ortssucheSchema.parse('  Ried  ')).toBe('Ried')
  })

  it.each([
    ['Zahl', 4910],
    ['Objekt', { q: 'Ried' }],
    ['null', null],
    ['zu kurz nach dem Abschneiden', '  R  '],
  ])('%s → leere Liste, Nominatim wird nicht gefragt', async (_fall, eingabe) => {
    expect(await loeseOrtAuf(eingabe as never)).toEqual([])
    expect(suche).not.toHaveBeenCalled()
  })

  it('Gegenprobe: ein Ortsname erreicht die Suche, bereinigt', async () => {
    await loeseOrtAuf('  Ried im Innkreis  ')
    expect(suche).toHaveBeenCalledWith('Ried im Innkreis')
  })
})
