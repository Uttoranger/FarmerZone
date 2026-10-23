/**
 * Frische Bestätigung für wirksame Admin-Aktionen (Register N20, Ergänzung
 * 23.10.2026; Nachtlauf Nr. 154) gegen ein echtes Postgres — mit echter
 * Anmeldung über Better Auth, die Sitzung zuletzt vor 10 Minuten mit Passkey
 * bestätigt (älter als 5 Minuten, also nicht mehr frisch).
 *
 * Beweist (Zustand danach):
 *  - Der Bescheid an die Höfe beim Stand eines Bündels kommt trotzdem an: Er
 *    läuft über denselben Versand wie ein Rundschreiben, aber mit der Wache
 *    von setzeBuendelStandAction — je Hof genau eine Nachricht, ohne Mail.
 *  - Gegenprobe mit derselben Sitzung: sendeRundschreiben antwortet
 *    `{ error: 'frisch' }`, kein Rundschreiben, kein Faden; fuegeEmpfaengerHinzu
 *    ebenso, keine Zeile und keine Bestätigungsmail.
 *  - Frisch bestätigt sendet sendeRundschreiben wie vorher.
 * Meldungstexte sind erfunden. Mails gemockt, der Nachlauf gesammelt und
 * selbst abgearbeitet (TESTING_GUIDELINES §3).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const nachlauf = vi.hoisted(() => ({ aufgaben: [] as (() => Promise<void>)[] }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@/lib/email', () => ({
  sendRaw: vi.fn(async () => ({ id: 'int-mail' })),
  sendPostfachMail: vi.fn(async () => ({ id: 'int-mail' })),
  sendBetreiberBestaetigung: vi.fn(async () => ({ id: 'int-mail' })),
}))

import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { sendBetreiberBestaetigung, sendPostfachMail } from '@/lib/email'
import { FRISCH_FEHLER } from '@/lib/admin-anmeldung'
import { WUENSCHE_TEXT } from '@/lib/meldung'
import { setzeBuendelStandAction } from '@/server/actions/admin'
import { fuegeEmpfaengerHinzu, sendeRundschreiben } from '@/server/actions/postfach'
import { erstelleHof, erstelleHofMitAnmeldung, intKennung, raeumeAuf, machePasskeyAdmin } from './setup/basis'

const MINUTE = 60_000
const meldungIds: string[] = []
// Better Auth vergibt die Kennung des Kontos selbst (ohne „int-") — die Rundschreiben hängen an ihr.
const adminIds: string[] = []
const EMPFAENGER = 'int-frisch-team@example.com'

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
  await prisma.meldung.deleteMany({ where: { id: { in: meldungIds.splice(0) } } })
  await prisma.rundschreiben.deleteMany({ where: { erstelltVonUserId: { in: adminIds.splice(0) } } })
  await prisma.betreiberEmpfaenger.deleteMany({ where: { email: EMPFAENGER } })
  await raeumeAuf()
})

/** Ein Admin mit Passkey; `vorMinuten` = wann er zuletzt mit Passkey bestätigt hat. */
async function erstelleAdmin(vorMinuten: number): Promise<{ userId: string }> {
  const { ownerId, cookie } = await erstelleHofMitAnmeldung()
  await machePasskeyAdmin(ownerId)
  await prisma.session.updateMany({ where: { userId: ownerId }, data: { passkeyAm: new Date(Date.now() - vorMinuten * MINUTE) } })
  adminIds.push(ownerId)
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return { userId: ownerId }
}

async function legeWunschAn(clusterKey: string, farmId: string): Promise<void> {
  const id = intKennung('meldung')
  await prisma.meldung.create({
    data: { id, art: 'WUNSCH', status: 'GEPRUEFT', text: 'Erfundener Wunsch für den Integrationstest.', seiteUrl: '/int-test', userAgent: 'int-test', viewport: '390x844', farmId, clusterKey },
  })
  meldungIds.push(id)
}

const RUNDSCHREIBEN = (hofIds: string[]) => ({
  titel: 'int-Frisch',
  text: 'Erfundener Text für die Integrationsschicht.',
  art: 'INFO',
  link: '',
  perMail: false,
  antwortMoeglich: false,
  empfaenger: { art: 'ausgewaehlt', hofIds },
})

describe('Bescheid an die Höfe ohne frische Bestätigung (N20, Ergänzung 23.10.2026)', () => {
  it('kommt bei einer Sitzung an, die älter als 5 Minuten ist — je Hof eine Nachricht, ohne Mail', async () => {
    const admin = await erstelleAdmin(10)
    const { farm: hofA } = await erstelleHof()
    const { farm: hofB } = await erstelleHof()
    const k = intKennung('buendel')
    await legeWunschAn(k, hofA.id)
    await legeWunschAn(k, hofB.id)

    const ergebnis = await setzeBuendelStandAction({ clusterKey: k, stand: 'umgesetzt', antwort: 'Erfundene Antwort: ist jetzt da.', bescheid: 'hoefe' })

    expect(ergebnis).toEqual({ ok: true, meldungen: 2, hoefe: 2, kundinnen: 0 })
    const faeden = await prisma.unterhaltung.findMany({ where: { farmId: { in: [hofA.id, hofB.id] } }, include: { nachrichten: true, rundschreiben: true } })
    expect(faeden.map((f) => f.farmId).sort()).toEqual([hofA.id, hofB.id].sort())
    for (const f of faeden) {
      expect(f.nachrichten).toHaveLength(1)
      expect(f.rundschreiben).toMatchObject({ titel: WUENSCHE_TEXT.bescheidTitel, perMail: false, antwortMoeglich: false, erstelltVonUserId: admin.userId })
    }
    await Promise.all(nachlauf.aufgaben.splice(0).map((a) => a()))
    expect(sendPostfachMail).not.toHaveBeenCalled()
  })

  it('Gegenprobe, dieselbe Sitzung: Rundschreiben und Empfänger antworten „frisch“ — nichts geschrieben, keine Mail', async () => {
    const admin = await erstelleAdmin(10)
    const { farm } = await erstelleHof()

    expect(await sendeRundschreiben({ ...RUNDSCHREIBEN([farm.id]), perMail: true })).toEqual({ error: FRISCH_FEHLER })
    expect(await fuegeEmpfaengerHinzu({ email: EMPFAENGER })).toEqual({ error: FRISCH_FEHLER })

    expect(await prisma.rundschreiben.count({ where: { erstelltVonUserId: admin.userId } })).toBe(0)
    expect(await prisma.unterhaltung.count({ where: { farmId: farm.id } })).toBe(0)
    expect(await prisma.betreiberEmpfaenger.count({ where: { email: EMPFAENGER } })).toBe(0)
    expect(nachlauf.aufgaben).toHaveLength(0)
    expect(sendPostfachMail).not.toHaveBeenCalled()
    expect(sendBetreiberBestaetigung).not.toHaveBeenCalled()
  })

  it('frisch bestätigt sendet das Rundschreiben wie vorher', async () => {
    const admin = await erstelleAdmin(1)
    const { farm } = await erstelleHof()

    expect(await sendeRundschreiben(RUNDSCHREIBEN([farm.id]))).toEqual({ ok: true, empfaenger: 1 })
    expect(await prisma.rundschreiben.count({ where: { erstelltVonUserId: admin.userId } })).toBe(1)
  })
})
