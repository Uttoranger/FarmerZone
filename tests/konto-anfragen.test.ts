/**
 * Konto-Anfragen (Register N36, Nachtlauf Nr. 190) an den echten Actions —
 * Prisma, Wache, Einmal-Links und Mail gestellt, Protokoll echt.
 *
 * Beweist:
 *  - jede Admin-Action fragt genau die EINE heikle Wache mit ihrem Recht
 *    (E-Mail ändern und Schließen: hoefe_freischalten; Auskunft:
 *    adresse_anzeigen); ohne Recht wird nichts geschrieben oder verschickt;
 *  - E-Mail ändern: Einmal-Link mit Zweck `email-aendern:<Hash>` (nie die
 *    Adresse), 24 Stunden, Mail an die NEUE Adresse; hat ein anderes Konto die
 *    Adresse, gibt es keinen Link und keine Mail — und dieselbe Antwort;
 *  - Schließen: offene Bestellung oder Erstattung sperrt mit Grund (nichts
 *    geschrieben); falscher Hofname sperrt; sonst geschlossenAm bedingt,
 *    Sitzungen weg, Abos aus (optInEmail false), Protokoll;
 *  - Wieder öffnen nur in den ersten 30 Tagen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmailAendernLink: vi.fn(async () => ({ id: 'm-1' })), sendEmailGeaendertHinweis: vi.fn(async () => ({ id: 'm-2' })) }))
vi.mock('@/server/admin-wache', () => ({ verlangeFrischeBestaetigung: vi.fn(), verlangeAdminAktion: vi.fn() }))
vi.mock('@/server/geraete', () => ({ erzeugeEinmalLink: vi.fn(async () => 'T'.repeat(43)), loeseEinmalLinkEin: vi.fn(), einmalTokenHash: vi.fn(() => 'h') }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    farm: { findUnique: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })) },
    order: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
    session: { deleteMany: vi.fn(async () => ({ count: 2 })) },
    customerFarmSubscription: { updateMany: vi.fn(async () => ({ count: 3 })), findMany: vi.fn(async () => []) },
    user: { count: vi.fn(async () => 0), findFirst: vi.fn(async () => null) },
    einmalLink: { count: vi.fn(async () => 0) },
  }
  return { prisma: { ...tx, $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)), adminAktion: { create: vi.fn(async () => ({ id: 'p' })) } } }
})

import { prisma } from '@/lib/prisma'
import { verlangeFrischeBestaetigung, verlangeAdminAktion } from '@/server/admin-wache'
import { erzeugeEinmalLink } from '@/server/geraete'
import { sendEmailAendernLink } from '@/lib/email'
import { aendereAnmeldeEmail, exportiereAuskunftHof, exportiereAuskunftKundin, oeffneKontoWieder, schliesseKonto } from '@/server/actions/konto-anfragen'
import { ADMIN_RECHT_FEHLER } from '@/lib/admin-rechte'
import { KONTO_ANFRAGE_TEXT } from '@/lib/konto-anfragen'

const wache = vi.mocked(verlangeFrischeBestaetigung)
const protokoll = vi.mocked(prisma.adminAktion.create)
const HOF = { name: 'Hof am Bach', slug: 'hof-am-bach', ownerId: 'u1', geschlossenAm: null, endgueltigAm: null, owner: { email: 'alt@example.com' } }

beforeEach(() => {
  vi.clearAllMocks()
  wache.mockResolvedValue({ ok: true, userId: 'admin-1', sitzungId: 's1', mitPasskey: true })
  vi.mocked(prisma.farm.findUnique).mockResolvedValue(HOF as never)
  vi.mocked(prisma.order.count).mockResolvedValue(0 as never)
  vi.mocked(prisma.user.count).mockResolvedValue(0 as never)
  vi.mocked(prisma.farm.updateMany).mockResolvedValue({ count: 1 } as never)
})

const AKTIONEN: Array<[string, () => Promise<unknown>, string]> = [
  ['aendereAnmeldeEmail', () => aendereAnmeldeEmail({ farmId: 'f1', neueAdresse: 'neu@example.com', grund: 'Anfrage im Postfach' }), 'hoefe_freischalten'],
  ['exportiereAuskunftHof', () => exportiereAuskunftHof({ farmId: 'f1', grund: 'Auskunft angefragt' }), 'adresse_anzeigen'],
  ['exportiereAuskunftKundin', () => exportiereAuskunftKundin({ adresse: 'mia@example.com', grund: 'Auskunft angefragt' }), 'adresse_anzeigen'],
  ['schliesseKonto', () => schliesseKonto({ farmId: 'f1', grund: 'Hof hört auf', hofname: 'Hof am Bach' }), 'hoefe_freischalten'],
  ['oeffneKontoWieder', () => oeffneKontoWieder({ farmId: 'f1', grund: 'Doch weiter' }), 'hoefe_freischalten'],
]

describe('Wache je Action', () => {
  it.each(AKTIONEN)('%s fragt die heikle Wache mit ihrem Recht', async (_n, aufruf, recht) => {
    // Was nach der Wache geschieht, prüfen die Abschnitte unten (die Attrappe des Hofs hat keine Beziehungen).
    await aufruf().catch(() => undefined)
    expect(wache).toHaveBeenCalledTimes(1)
    expect(wache).toHaveBeenCalledWith({ recht })
    expect(verlangeAdminAktion).not.toHaveBeenCalled()
  })

  it.each(AKTIONEN)('%s ohne Recht: Satz der Wache, nichts gelesen oder geschrieben', async (_n, aufruf) => {
    wache.mockResolvedValue({ error: ADMIN_RECHT_FEHLER })
    expect(await aufruf()).toEqual({ error: ADMIN_RECHT_FEHLER })
    expect(prisma.farm.findUnique).not.toHaveBeenCalled()
    expect(prisma.farm.updateMany).not.toHaveBeenCalled()
    expect(erzeugeEinmalLink).not.toHaveBeenCalled()
    expect(protokoll).not.toHaveBeenCalled()
  })
})

describe('aendereAnmeldeEmail', () => {
  it('Link 24 Stunden mit Hash der neuen Adresse, Mail an die neue Adresse, Protokoll ohne Adresse', async () => {
    expect(await aendereAnmeldeEmail({ farmId: 'f1', neueAdresse: 'Neu@Example.com', grund: 'Anfrage im Postfach' })).toEqual({ ok: true })
    const link = vi.mocked(erzeugeEinmalLink).mock.calls[0][0]
    expect(link.userId).toBe('u1')
    expect(link.tage).toBe(1)
    expect(link.zweck).toMatch(/^email-aendern:[0-9a-f]{64}$/)
    expect(link.zweck).not.toContain('neu')
    expect(vi.mocked(sendEmailAendernLink).mock.calls[0][0]).toBe('neu@example.com')
    const eintrag = protokoll.mock.calls[0][0].data
    expect(eintrag).toMatchObject({ art: 'anmelde_email_angefragt', bezugArt: 'hof', bezugId: 'f1' })
    expect(JSON.stringify(eintrag)).not.toContain('example.com')
  })

  it('Adresse eines anderen Kontos: kein Link, keine Mail — dieselbe Antwort', async () => {
    const frei = await aendereAnmeldeEmail({ farmId: 'f1', neueAdresse: 'neu@example.com', grund: 'Anfrage im Postfach' })
    vi.clearAllMocks()
    wache.mockResolvedValue({ ok: true, userId: 'admin-1', sitzungId: 's1', mitPasskey: true })
    vi.mocked(prisma.farm.findUnique).mockResolvedValue(HOF as never)
    vi.mocked(prisma.user.count).mockResolvedValue(1 as never)
    const vergeben = await aendereAnmeldeEmail({ farmId: 'f1', neueAdresse: 'vergeben@example.com', grund: 'Anfrage im Postfach' })
    expect(vergeben).toEqual(frei)
    expect(erzeugeEinmalLink).not.toHaveBeenCalled()
    expect(sendEmailAendernLink).not.toHaveBeenCalled()
  })

  it('ungültige Adresse und die alte Adresse: eigener Satz, nichts angelegt', async () => {
    expect(await aendereAnmeldeEmail({ farmId: 'f1', neueAdresse: 'keine-adresse', grund: 'x' })).toEqual({ error: KONTO_ANFRAGE_TEXT.email.ungueltig })
    expect(await aendereAnmeldeEmail({ farmId: 'f1', neueAdresse: 'ALT@example.com', grund: 'x' })).toEqual({ error: KONTO_ANFRAGE_TEXT.email.gleich })
    expect(erzeugeEinmalLink).not.toHaveBeenCalled()
  })
})

describe('schliesseKonto', () => {
  it('offene Bestellung oder Erstattung: gesperrt mit Grund, nichts geschrieben', async () => {
    vi.mocked(prisma.order.count).mockResolvedValueOnce(1 as never).mockResolvedValueOnce(1 as never)
    const r = await schliesseKonto({ farmId: 'f1', grund: 'Hof hört auf', hofname: 'Hof am Bach' })
    expect(r).toEqual({ error: expect.stringContaining('1 Bestellung ist noch offen und 1 Erstattung ist offen') })
    expect(prisma.farm.updateMany).not.toHaveBeenCalled()
    expect(prisma.session.deleteMany).not.toHaveBeenCalled()
    expect(protokoll).not.toHaveBeenCalled()
  })

  it('falscher Hofname: abgelehnt', async () => {
    expect(await schliesseKonto({ farmId: 'f1', grund: 'Hof hört auf', hofname: 'Hof am Berg' })).toEqual({ error: KONTO_ANFRAGE_TEXT.schliessen.bestaetigenFalsch })
    expect(prisma.farm.updateMany).not.toHaveBeenCalled()
  })

  it('sonst: geschlossenAm bedingt, Sitzungen des Hofs weg, Abos aus, Protokoll', async () => {
    expect(await schliesseKonto({ farmId: 'f1', grund: 'Hof hört auf', hofname: ' hof am bach ' })).toEqual({ ok: true })
    expect(vi.mocked(prisma.farm.updateMany).mock.calls[0][0]).toMatchObject({ where: { id: 'f1', geschlossenAm: null } })
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } })
    expect(prisma.customerFarmSubscription.updateMany).toHaveBeenCalledWith({ where: { farmId: 'f1' }, data: { optInEmail: false, optInWhatsApp: false } })
    expect(protokoll.mock.calls[0][0].data).toMatchObject({ art: 'konto_geschlossen', bezugArt: 'hof', bezugId: 'f1', grund: 'Hof hört auf' })
  })
})

describe('oeffneKontoWieder', () => {
  it('in den ersten 30 Tagen; danach nicht', async () => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({ ...HOF, geschlossenAm: new Date(Date.now() - 2 * 86_400_000) } as never)
    expect(await oeffneKontoWieder({ farmId: 'f1', grund: 'Doch weiter' })).toEqual({ ok: true })
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({ ...HOF, geschlossenAm: new Date(Date.now() - 31 * 86_400_000) } as never)
    expect(await oeffneKontoWieder({ farmId: 'f1', grund: 'Doch weiter' })).toEqual({ error: KONTO_ANFRAGE_TEXT.wiederOeffnen.zuSpaet })
    expect(prisma.farm.updateMany).toHaveBeenCalledTimes(1)
  })
})
