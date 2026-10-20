/**
 * Reiter „Meldungen" (Register N14, Ergänzung; Nachtlauf Nr. 101) gegen ein
 * echtes Postgres — mit echter Anmeldung über Better Auth.
 *
 * Beweist (Zustand danach):
 *  - „Stand für alle" schreibt nur die Meldungen des Bündels (Wünsche mit dem
 *    Stichwort, keine Duplikate, keine Fehler mit demselben Stichwort, kein
 *    anderes Bündel) und nur mit Admin; Duplikate bleiben Duplikat und
 *    bekommen nur die Antwort.
 *  - Bescheid an die Höfe: je Hof genau eine Nachricht (Hof zweimal im Bündel
 *    und Duplikat-Melder eingeschlossen); die Kundin mit Adresse bekommt die
 *    Betriebsmail erst im Nachlauf, über sendRaw.
 *  - Zusammenfassen ohne Selbstreferenz und ohne Kette, Trennen nur bei einem
 *    Duplikat; der Hof des Duplikats liest „Bereits bekannt" und nach dem
 *    Erledigen der Hauptmeldung „Bereits bekannt · Behoben".
 *  - Rückgängig stellt Status, Art und Notiz wieder her und scheitert sauber,
 *    wenn die Schreibroute inzwischen etwas gesetzt hat.
 *  - Aufbewahrung mit der zweiten Abfrage: Ein Duplikat mit offener
 *    Hauptmeldung bleibt, eines mit seit 91 Tagen erledigter geht.
 *  - Nacharbeit 101 (Nr. 105): Die Kette Duplikat → Duplikat scheitert auch
 *    beim Schreiben selbst (Hauptmeldung wird zwischen Prüfung und Schreiben
 *    Duplikat); erneutes Speichern eines Bündels ohne Wechsel lässt die
 *    90-Tage-Uhr stehen, zurück auf Gesammelt leert „Geplant in"; Ablegen
 *    schreibt nur, solange der Status der Karte gilt.
 * Meldungstexte sind erfunden. Mails gemockt (Prüfstellen), der Nachlauf
 * gesammelt und selbst abgearbeitet (TESTING_GUIDELINES §3).
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
}))

import { headers } from 'next/headers'
import type { MeldungArt, MeldungStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendRaw, sendPostfachMail } from '@/lib/email'
import { WUENSCHE_TEXT, kiEntscheidung, waehleZuLoeschende } from '@/lib/meldung'
import { fasseZusammenAction, legeMeldungAbAction, setzeBuendelStandAction, trenneDuplikatAction, triageMeldungAction } from '@/server/actions/admin'
import { findeHauptmeldungen, findeLoeschKandidaten, getMeldungenFuerHof } from '@/server/queries/meldung'
import { erstelleHof, erstelleHofMitAnmeldung, intKennung, raeumeAuf, machePasskeyAdmin } from './setup/basis'

const meldungIds: string[] = []
// Better Auth vergibt die Kennung des Kontos selbst (ohne „int-") — die Rundschreiben des Bescheids hängen an ihr.
const adminIds: string[] = []
const TAG = 24 * 60 * 60 * 1000

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
  await prisma.meldung.deleteMany({ where: { id: { in: meldungIds.splice(0) } } })
  await prisma.rundschreiben.deleteMany({ where: { erstelltVonUserId: { in: adminIds.splice(0) } } })
  await raeumeAuf()
})

async function alsSitzung(cookie: string): Promise<void> {
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
}

async function erstelleAdmin(): Promise<{ cookie: string; userId: string }> {
  const { ownerId, cookie } = await erstelleHofMitAnmeldung()
  await machePasskeyAdmin(ownerId)
  adminIds.push(ownerId)
  return { cookie, userId: ownerId }
}

async function legeMeldungAn(daten: {
  art?: MeldungArt
  status?: MeldungStatus
  farmId?: string | null
  customerEmail?: string | null
  clusterKey?: string | null
  duplikatVonId?: string | null
  triageNotiz?: string | null
  triagedAt?: Date | null
}): Promise<string> {
  const id = intKennung('meldung')
  await prisma.meldung.create({
    data: {
      id,
      art: daten.art ?? 'WUNSCH',
      status: daten.status ?? 'GEPRUEFT',
      text: 'Erfundener Wunsch für den Integrationstest.',
      seiteUrl: '/int-test',
      userAgent: 'int-test',
      viewport: '390x844',
      farmId: daten.farmId ?? null,
      customerEmail: daten.customerEmail ?? null,
      clusterKey: daten.clusterKey ?? null,
      duplikatVonId: daten.duplikatVonId ?? null,
      triageNotiz: daten.triageNotiz ?? null,
      triagedAt: daten.triagedAt ?? null,
    },
  })
  meldungIds.push(id)
  return id
}

async function arbeiteNachlaufAb(): Promise<void> {
  for (const aufgabe of nachlauf.aufgaben.splice(0)) await aufgabe()
}

describe('Stand für alle', () => {
  it('schreibt nur die Meldungen des Bündels und nur mit Admin', async () => {
    const admin = await erstelleAdmin()
    const hof = await erstelleHofMitAnmeldung()
    const { farm: andererHof } = await erstelleHof()
    const k = intKennung('buendel')
    const a = await legeMeldungAn({ clusterKey: k, farmId: hof.farm.id })
    const b = await legeMeldungAn({ clusterKey: k, status: 'NEU', farmId: andererHof.id })
    const anderesBuendel = await legeMeldungAn({ clusterKey: intKennung('buendel'), farmId: hof.farm.id })
    const fehlerGleichesWort = await legeMeldungAn({ clusterKey: k, art: 'FEHLER', farmId: andererHof.id })
    const duplikat = await legeMeldungAn({ art: 'FEHLER', status: 'DUPLIKAT', duplikatVonId: a, farmId: andererHof.id, clusterKey: k })
    const eingabe = { clusterKey: k, stand: 'geplant', sprintName: 'Nr. 97', antwort: 'Erfundene Antwort an die Höfe.', bescheid: 'niemand' }

    await alsSitzung(hof.cookie)
    expect(await setzeBuendelStandAction(eingabe)).toEqual({ error: 'Kein Zugriff.' })
    expect((await prisma.meldung.findUniqueOrThrow({ where: { id: a } })).status).toBe('GEPRUEFT')

    await alsSitzung(admin.cookie)
    expect(await setzeBuendelStandAction(eingabe)).toEqual({ ok: true, meldungen: 3, hoefe: 0, kundinnen: 0 })
    const nachher = await prisma.meldung.findMany({ where: { id: { in: [a, b, anderesBuendel, fehlerGleichesWort, duplikat] } } })
    const stand = new Map(nachher.map((m) => [m.id, m]))
    for (const id of [a, b]) expect(stand.get(id)).toMatchObject({ status: 'GEPLANT', sprintName: 'Nr. 97', antwortAnMelder: 'Erfundene Antwort an die Höfe.' })
    expect(stand.get(anderesBuendel)).toMatchObject({ status: 'GEPRUEFT', sprintName: null, antwortAnMelder: null })
    expect(stand.get(fehlerGleichesWort)).toMatchObject({ status: 'GEPRUEFT', antwortAnMelder: null })
    expect(stand.get(duplikat)).toMatchObject({ status: 'DUPLIKAT', duplikatVonId: a, antwortAnMelder: 'Erfundene Antwort an die Höfe.' })
    // „Niemanden": keine Nachricht, keine Mail.
    expect(await prisma.unterhaltung.count({ where: { farmId: { in: [hof.farm.id, andererHof.id] } } })).toBe(0)
    expect(nachlauf.aufgaben).toHaveLength(0)
  })

  it('„Nicht geplant" ohne Antwort und Bescheid ohne Antwort werden abgelehnt — nichts geschrieben', async () => {
    const admin = await erstelleAdmin()
    const k = intKennung('buendel')
    const a = await legeMeldungAn({ clusterKey: k })
    await alsSitzung(admin.cookie)
    expect(await setzeBuendelStandAction({ clusterKey: k, stand: 'nichtGeplant', antwort: ' ', bescheid: 'niemand' })).toEqual({ error: WUENSCHE_TEXT.antwortPflicht })
    expect(await setzeBuendelStandAction({ clusterKey: k, stand: 'umgesetzt', antwort: '', bescheid: 'hoefe' })).toEqual({ error: WUENSCHE_TEXT.bescheidBrauchtAntwort })
    expect((await prisma.meldung.findUniqueOrThrow({ where: { id: a } })).status).toBe('GEPRUEFT')
  })

  it('Bescheid: je Hof genau eine Nachricht, die Kundin mit Adresse bekommt die Betriebsmail im Nachlauf', async () => {
    const admin = await erstelleAdmin()
    const { farm: hofA } = await erstelleHof()
    const { farm: hofB } = await erstelleHof()
    const k = intKennung('buendel')
    const kundin = `${intKennung('kundin')}@example.com`
    const a1 = await legeMeldungAn({ clusterKey: k, farmId: hofA.id })
    await legeMeldungAn({ clusterKey: k, farmId: hofA.id })
    await legeMeldungAn({ clusterKey: k, customerEmail: kundin })
    await legeMeldungAn({ clusterKey: k })
    await legeMeldungAn({ art: 'FEHLER', status: 'DUPLIKAT', duplikatVonId: a1, farmId: hofB.id })

    await alsSitzung(admin.cookie)
    const ergebnis = await setzeBuendelStandAction({ clusterKey: k, stand: 'umgesetzt', antwort: 'Erfundene Antwort: ist jetzt da.', bescheid: 'hoefe' })
    expect(ergebnis).toEqual({ ok: true, meldungen: 5, hoefe: 2, kundinnen: 1 })

    const faeden = await prisma.unterhaltung.findMany({ where: { farmId: { in: [hofA.id, hofB.id] } }, include: { nachrichten: true, rundschreiben: true } })
    expect(faeden.map((f) => f.farmId).sort()).toEqual([hofA.id, hofB.id].sort())
    for (const f of faeden) {
      expect(f.nachrichten).toHaveLength(1)
      expect(f.nachrichten[0]).toMatchObject({ vonFarmId: null, text: 'Erfundene Antwort: ist jetzt da.' })
      expect(f.rundschreiben).toMatchObject({ titel: WUENSCHE_TEXT.bescheidTitel, perMail: false, antwortMoeglich: false })
    }
    // Kein Massenmail an die Höfe; die Kundin erst nach der Antwort.
    expect(sendPostfachMail).not.toHaveBeenCalled()
    expect(sendRaw).not.toHaveBeenCalled()
    await arbeiteNachlaufAb()
    expect(sendRaw).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendRaw).mock.calls[0]?.[0]).toBe(kundin)
    expect(vi.mocked(sendRaw).mock.calls[0]?.[1]).toBe(WUENSCHE_TEXT.bescheidTitel)
    expect(await prisma.rundschreiben.count({ where: { erstelltVonUserId: admin.userId } })).toBe(1)
  })
})

describe('Zusammenfassen und Trennen', () => {
  it('ohne Selbstreferenz und ohne Kette; der Hof liest „Bereits bekannt", nach dem Erledigen „Bereits bekannt · Behoben"; Trennen nur bei einem Duplikat', async () => {
    const admin = await erstelleAdmin()
    const { farm: hof } = await erstelleHof()
    const dup = await legeMeldungAn({ art: 'FEHLER', status: 'NEU', farmId: hof.id })
    const haupt = await legeMeldungAn({ art: 'FEHLER', status: 'GEPLANT' })
    const dritte = await legeMeldungAn({ art: 'FEHLER', status: 'NEU' })
    await alsSitzung(admin.cookie)

    expect(await fasseZusammenAction({ duplikatId: dup, hauptmeldungId: dup })).toEqual({ error: 'Eine Meldung kann nicht ihr eigenes Duplikat sein.' })
    expect((await prisma.meldung.findUniqueOrThrow({ where: { id: dup } })).status).toBe('NEU')

    expect(await fasseZusammenAction({ duplikatId: dup, hauptmeldungId: haupt })).toEqual({})
    expect(await prisma.meldung.findUniqueOrThrow({ where: { id: dup } })).toMatchObject({ status: 'DUPLIKAT', duplikatVonId: haupt })
    expect((await getMeldungenFuerHof(hof.id)).find((m) => m.id === dup)?.status).toBe('Bereits bekannt')

    // Keine Kette: ein Duplikat ist keine Hauptmeldung, eine Meldung mit Duplikaten wird keines.
    expect((await fasseZusammenAction({ duplikatId: dritte, hauptmeldungId: dup })).error).toBeDefined()
    expect((await fasseZusammenAction({ duplikatId: haupt, hauptmeldungId: dritte })).error).toBeDefined()
    expect((await prisma.meldung.findUniqueOrThrow({ where: { id: haupt } })).status).toBe('GEPLANT')

    const h = await prisma.meldung.findUniqueOrThrow({ where: { id: haupt } })
    expect(await triageMeldungAction(haupt, { status: 'ERLEDIGT', vorherStatus: h.status, vorherNotiz: h.triageNotiz })).toEqual({})
    expect((await getMeldungenFuerHof(hof.id)).find((m) => m.id === dup)).toMatchObject({ status: 'Bereits bekannt · Behoben', statusTon: 'fertig' })

    expect(await trenneDuplikatAction({ meldungId: dup })).toEqual({})
    expect(await prisma.meldung.findUniqueOrThrow({ where: { id: dup } })).toMatchObject({ status: 'GEPRUEFT', duplikatVonId: null })
    expect((await trenneDuplikatAction({ meldungId: haupt })).error).toBeDefined()
  })
})

describe('Rückgängig nach „Ja, ein Wunsch"', () => {
  it('stellt Status, Art und Notiz wieder her — und scheitert sauber nach einer Zwischenänderung', async () => {
    const admin = await erstelleAdmin()
    const notiz = 'Notiz des Menschen\n[KI] erfundener Grund'
    const id = await legeMeldungAn({ art: 'FEHLER', status: 'VERMUTLICH_WUNSCH', triageNotiz: notiz })
    const stand = { status: 'VERMUTLICH_WUNSCH' as const, art: 'FEHLER' as const, clusterKey: null, triageNotiz: notiz, duplikatVonId: null, sprintName: null, antwortAnMelder: null }
    await alsSitzung(admin.cookie)

    const erst = kiEntscheidung(stand, true)
    expect(await triageMeldungAction(id, erst.aufruf)).toEqual({})
    expect(await prisma.meldung.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'GEPRUEFT', art: 'WUNSCH', triageNotiz: notiz })
    expect(await triageMeldungAction(id, erst.rueckgaengig)).toEqual({})
    expect(await prisma.meldung.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'VERMUTLICH_WUNSCH', art: 'FEHLER', triageNotiz: notiz })

    const zweit = kiEntscheidung(stand, true)
    expect(await triageMeldungAction(id, zweit.aufruf)).toEqual({})
    // Die Schreibroute plant inzwischen (sie hängt eine Zeile an die Notiz).
    await prisma.meldung.update({ where: { id }, data: { status: 'GEPLANT', sprintName: 'PR #1', triageNotiz: `${notiz}\n[Audit] geplant` } })
    const ergebnis = await triageMeldungAction(id, zweit.rueckgaengig)
    expect(ergebnis.error).toMatch(/^Die Meldung hat sich inzwischen geändert/)
    expect(await prisma.meldung.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'GEPLANT', art: 'WUNSCH', sprintName: 'PR #1' })
  })
})

describe('Aufbewahrung mit der zweiten Abfrage', () => {
  it('ein Duplikat mit offener Hauptmeldung bleibt nach 200 Tagen, eines mit seit 91 Tagen erledigter geht', async () => {
    const jetzt = new Date()
    const offen = await legeMeldungAn({ art: 'FEHLER', status: 'GEPLANT', triagedAt: new Date(jetzt.getTime() - 150 * TAG) })
    const dupOffen = await legeMeldungAn({ art: 'FEHLER', status: 'DUPLIKAT', duplikatVonId: offen, triagedAt: new Date(jetzt.getTime() - 200 * TAG) })
    const erledigt = await legeMeldungAn({ art: 'FEHLER', status: 'ERLEDIGT', triagedAt: new Date(jetzt.getTime() - 91 * TAG) })
    const dupErledigt = await legeMeldungAn({ art: 'FEHLER', status: 'DUPLIKAT', duplikatVonId: erledigt, triagedAt: new Date(jetzt.getTime() - 5 * TAG) })

    // Nur die eigenen Zeilen — die Test-Datenbank ist geteilt, gelöscht wird hier nichts.
    const kandidaten = (await findeLoeschKandidaten()).filter((m) => meldungIds.includes(m.id))
    const haupt = await findeHauptmeldungen(kandidaten.flatMap((m) => (m.duplikatVonId ? [m.duplikatVonId] : [])))
    expect([...haupt.keys()].sort()).toEqual([offen, erledigt].sort())
    expect(waehleZuLoeschende(kandidaten, jetzt, haupt).map((m) => m.id).sort()).toEqual([erledigt, dupErledigt].sort())
    expect(waehleZuLoeschende(kandidaten, jetzt, haupt).map((m) => m.id)).not.toContain(dupOffen)
  })
})

describe('Nacharbeit 101 (Nr. 105)', () => {
  it('keine Kette beim Schreiben: wird die Hauptmeldung zwischen Prüfung und Schreiben Duplikat, bleibt alles stehen', async () => {
    const admin = await erstelleAdmin()
    const ziel = await legeMeldungAn({})
    const andere = await legeMeldungAn({})
    const haupt = await legeMeldungAn({ status: 'DUPLIKAT', duplikatVonId: andere })
    await alsSitzung(admin.cookie)

    // Die Prüfung vor dem Schreiben sieht noch die alte Hauptmeldung — so, als änderte sie sich danach.
    const vorher = vi.spyOn(prisma.meldung, 'findFirst').mockResolvedValueOnce({ id: haupt, status: 'GEPRUEFT' } as never)
    const ergebnis = await triageMeldungAction(ziel, { status: 'DUPLIKAT', duplikatVonId: haupt, vorherStatus: 'GEPRUEFT', vorherNotiz: null })
    vorher.mockRestore()

    expect(ergebnis).toMatchObject({ error: expect.stringContaining('Hauptmeldung') })
    expect(await prisma.meldung.findUniqueOrThrow({ where: { id: ziel }, select: { status: true, duplikatVonId: true } })).toEqual({ status: 'GEPRUEFT', duplikatVonId: null })
    // Ohne Spion fängt schon die Prüfung, mit eigenem Satz.
    expect(await fasseZusammenAction({ duplikatId: ziel, hauptmeldungId: haupt })).toMatchObject({ error: expect.any(String) })
    // Gegenprobe: auf eine offene Hauptmeldung schreibt dieselbe Anweisung.
    expect(await triageMeldungAction(ziel, { status: 'DUPLIKAT', duplikatVonId: andere, vorherStatus: 'GEPRUEFT', vorherNotiz: null })).toEqual({})
    expect(await prisma.meldung.findUniqueOrThrow({ where: { id: ziel }, select: { status: true, duplikatVonId: true } })).toEqual({ status: 'DUPLIKAT', duplikatVonId: andere })
  })

  it('erneutes Speichern ohne Wechsel lässt die 90-Tage-Uhr stehen; ein Wechsel stellt sie; Gesammelt leert „Geplant in"', async () => {
    const admin = await erstelleAdmin()
    const k = intKennung('buendel')
    const alt = new Date(Date.now() - 40 * TAG)
    const a = await legeMeldungAn({ clusterKey: k, status: 'GEPLANT', triagedAt: alt })
    const b = await legeMeldungAn({ clusterKey: k, status: 'GEPRUEFT', triagedAt: alt })
    await alsSitzung(admin.cookie)

    expect(await setzeBuendelStandAction({ clusterKey: k, stand: 'geplant', sprintName: 'Nr. 200', bescheid: 'niemand' })).toMatchObject({ ok: true })
    const nachGeplant = await prisma.meldung.findMany({ where: { id: { in: [a, b] } }, select: { id: true, triagedAt: true, sprintName: true, status: true } })
    const zeile = (id: string) => nachGeplant.find((m) => m.id === id)!
    expect(zeile(a).triagedAt).toEqual(alt)
    expect(zeile(b).triagedAt!.getTime()).toBeGreaterThan(alt.getTime())
    expect(nachGeplant.every((m) => m.status === 'GEPLANT' && m.sprintName === 'Nr. 200')).toBe(true)

    expect(await setzeBuendelStandAction({ clusterKey: k, stand: 'gesammelt', bescheid: 'niemand' })).toMatchObject({ ok: true })
    const nachGesammelt = await prisma.meldung.findMany({ where: { id: { in: [a, b] } }, select: { status: true, sprintName: true } })
    expect(nachGesammelt).toEqual([
      { status: 'GEPRUEFT', sprintName: null },
      { status: 'GEPRUEFT', sprintName: null },
    ])
  })

  it('Ablegen schreibt nur, solange der Status der Karte gilt — mit Antwort an den Melder', async () => {
    const admin = await erstelleAdmin()
    const id = await legeMeldungAn({ status: 'NEU', art: 'FEHLER' })
    await alsSitzung(admin.cookie)

    expect(await legeMeldungAbAction({ meldungId: id, antwort: ' ', vorherStatus: 'NEU' })).toMatchObject({ error: expect.any(String) })
    expect((await prisma.meldung.findUniqueOrThrow({ where: { id } })).status).toBe('NEU')

    expect(await legeMeldungAbAction({ meldungId: id, antwort: 'Erfundene Antwort: das ist so gewollt.', vorherStatus: 'NEU' })).toEqual({})
    const abgelegt = await prisma.meldung.findUniqueOrThrow({ where: { id }, select: { status: true, antwortAnMelder: true, triagedAt: true } })
    expect(abgelegt).toMatchObject({ status: 'KEIN_FEHLER', antwortAnMelder: 'Erfundene Antwort: das ist so gewollt.' })

    // Ein zweiter Klick aus einer alten Karte (Status NEU) ändert nichts mehr.
    expect(await legeMeldungAbAction({ meldungId: id, antwort: 'Erfundene andere Antwort.', vorherStatus: 'NEU' })).toMatchObject({ error: expect.any(String) })
    expect(await prisma.meldung.findUniqueOrThrow({ where: { id }, select: { status: true, antwortAnMelder: true, triagedAt: true } })).toEqual(abgelegt)
  })
})
