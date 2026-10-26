/**
 * Nacharbeit 101 im Reiter „Meldungen" (Nachtlauf Nr. 105) — die Actions mit
 * gemockter Datenbank; den Zustand in Postgres (Kette, 90-Tage-Uhr, „Geplant
 * in", Ablegen) prüft tests/integration/meldungen-ablauf.int.test.ts.
 *
 * Beweist:
 *  - „Stand für alle": Scheitert das Rundschreiben an die Höfe nach der
 *    gespeicherten Transaktion (Wurf), laufen Neuladen und die Mail an die
 *    Kundin trotzdem; nach Sentry geht nur die Klasse, zurück kommt der Satz.
 *  - Ablegen: nur Admin, Antwort Pflicht (am Server geprüft), bedingt über
 *    den vorherigen Status; schon Abgelegtes und Duplikate nie.
 * Meldungstexte sind erfunden.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
// Der Bescheid an Kundinnen ist seit Nr. 159 ein Auftrag der Warteschlange (Kann warten).
vi.mock('@/server/mail-warteschlange', () => ({ stelleMailEin: vi.fn(async () => 1) }))
// Der Bescheid läuft über den Versand ohne eigene Wache (Register N20, Ergänzung 23.10.2026; Nr. 154).
vi.mock('@/server/rundschreiben', () => ({ verschickeRundschreiben: vi.fn() }))
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as (() => Promise<void>)[] }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@/lib/prisma', async () => {
  const meldung = { findMany: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })) }
  return {
    prisma: {
      // Die Wache liest seit Nr. 115 die Pflicht „erst Passkey“ (tests/admin-sitzung.ts).
      ...(await import('./admin-sitzung')).passkeyAttrappen(),
      user: { findUnique: vi.fn() },
      meldung,
      adminAktion: { create: vi.fn(async () => ({ id: 'a1' })) },
      $transaction: vi.fn(async (arbeit: (t: { meldung: typeof meldung }) => Promise<unknown>) => arbeit({ meldung })),
    },
  }
})

import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stelleMailEin } from '@/server/mail-warteschlange'
import { verschickeRundschreiben } from '@/server/rundschreiben'
import { MELDUNG_KLICK_TEXT, WUENSCHE_TEXT } from '@/lib/meldung'
import { legeMeldungAbAction, setzeBuendelStandAction } from '@/server/actions/admin'
import { adminSitzung } from './admin-sitzung'

const getSession = vi.mocked(auth.api.getSession)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const meldungUpdateMany = vi.mocked(prisma.meldung.updateMany)

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
  getSession.mockResolvedValue(adminSitzung('admin_1') as never)
  userFindUnique.mockResolvedValue({ isAdmin: true, adminInhaber: true } as never)
  meldungUpdateMany.mockResolvedValue({ count: 1 })
})

describe('Stand für alle — das Rundschreiben scheitert nach dem Speichern', () => {
  beforeEach(() => {
    vi.mocked(prisma.meldung.findMany)
      .mockResolvedValueOnce([
        { id: 'm1', farmId: 'hof-a', customerEmail: null },
        { id: 'm2', farmId: null, customerEmail: 'kundin@example.com' },
      ] as never)
      .mockResolvedValueOnce([] as never)
  })

  it('wirft es: Neuladen und Kundinnen-Mail laufen trotzdem, nach Sentry nur die Klasse, zurück der Satz', async () => {
    vi.mocked(verschickeRundschreiben).mockRejectedValue(new RangeError('Erfundene Antwort an die Höfe'))
    const ergebnis = await setzeBuendelStandAction({ clusterKey: 'abholzeiten', stand: 'umgesetzt', antwort: 'Erfundene Antwort an die Höfe', bescheid: 'hoefe' })

    expect(ergebnis).toEqual({ error: WUENSCHE_TEXT.bescheidNichtGesendet })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/postfach')
    expect(revalidatePath).toHaveBeenCalledWith('/meldungen')
    // Je Kundin ein Auftrag mit der Kennung ihrer Meldung — keine Adresse in der Warteschlange.
    expect(stelleMailEin).toHaveBeenCalledTimes(1)
    expect(vi.mocked(stelleMailEin).mock.calls[0]![0]).toEqual([expect.objectContaining({ art: 'bescheid', vorrang: 2, bezug: { meldungId: 'm2' } })])
    expect(JSON.stringify(vi.mocked(stelleMailEin).mock.calls)).not.toContain('kundin@example.com')
    const [fehler, kontext] = vi.mocked(Sentry.captureException).mock.calls[0] ?? []
    expect((fehler as Error).name).toBe('RangeError')
    expect(JSON.stringify([String((fehler as Error).message), kontext])).not.toContain('Erfundene')
  })

  it('meldet es einen Fehler: dasselbe — erst Neuladen und Mail, dann der Satz', async () => {
    vi.mocked(verschickeRundschreiben).mockResolvedValue({ error: 'Für diese Auswahl gibt es keinen Hof.' })
    const ergebnis = await setzeBuendelStandAction({ clusterKey: 'abholzeiten', stand: 'umgesetzt', antwort: 'Erfundene Antwort', bescheid: 'hoefe' })

    expect(ergebnis).toEqual({ error: WUENSCHE_TEXT.bescheidNichtGesendet })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/postfach')
    expect(stelleMailEin).toHaveBeenCalledTimes(1)
    expect(nachlauf.aufgaben).toHaveLength(0)
    // Die Kennung des Admins kommt aus der Wache dieser Aktion; die Optionen des Bescheids bleiben (nur Postfach, ohne Antwort).
    expect(vi.mocked(verschickeRundschreiben)).toHaveBeenCalledWith(
      expect.objectContaining({ perMail: false, antwortMoeglich: false, empfaenger: { art: 'ausgewaehlt', hofIds: ['hof-a'] } }),
      'admin_1'
    )
  })
})

describe('Ablegen aus dem Kartenmenü', () => {
  const EINGABE = { meldungId: 'cmfmeldung0000000001abc', antwort: 'Erfundene Antwort: das geht so schon.', vorherStatus: 'NEU' }

  it('ohne Admin: nichts geschrieben', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)
    expect(await legeMeldungAbAction(EINGABE)).toEqual({ error: 'Kein Zugriff.' })
    expect(meldungUpdateMany).not.toHaveBeenCalled()
  })

  it('ohne Antwort: der Satz der Pflicht, nichts geschrieben — die Prüfung steht am Server', async () => {
    expect(await legeMeldungAbAction({ ...EINGABE, antwort: '   ' })).toEqual({ error: MELDUNG_KLICK_TEXT.ablegenPflicht })
    expect(await legeMeldungAbAction({ ...EINGABE, antwort: undefined })).toEqual({ error: MELDUNG_KLICK_TEXT.ablegenPflicht })
    expect(meldungUpdateMany).not.toHaveBeenCalled()
  })

  it('schreibt nur KEIN_FEHLER, die Antwort und den Abschluss — bedingt über den Status der Karte', async () => {
    expect(await legeMeldungAbAction(EINGABE)).toEqual({})
    const aufruf = meldungUpdateMany.mock.calls[0]?.[0] as { where: unknown; data: Record<string, unknown> }
    expect(aufruf.where).toEqual({ id: EINGABE.meldungId, status: { equals: 'NEU', notIn: ['KEIN_FEHLER', 'DUPLIKAT'] } })
    expect(Object.keys(aufruf.data).sort()).toEqual(['antwortAnMelder', 'status', 'triagedAt'])
    expect(aufruf.data).toMatchObject({ status: 'KEIN_FEHLER', antwortAnMelder: EINGABE.antwort })
  })

  it('hat sich der Status inzwischen geändert: Satz mit Ausweg statt stillem Überschreiben', async () => {
    meldungUpdateMany.mockResolvedValue({ count: 0 })
    expect(await legeMeldungAbAction(EINGABE)).toEqual({ error: 'Die Meldung hat sich inzwischen geändert — lade die Seite neu und entscheide noch einmal.' })
  })
})
