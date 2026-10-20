/**
 * Postfach, Stufe 1 (Register N12, Nachtlauf Nr. 87) gegen ein echtes
 * Postgres — mit echter Anmeldung über Better Auth.
 *
 * Beweist (Zustand danach):
 *  - Fan-out: Senden legt in einer Transaktion je Empfänger genau einen Faden
 *    mit der ersten Nachricht vom Team an und zählt sie; ein doppelter oder
 *    stillgelegter Hof bekommt keinen; mit Haken geht je Faden eine Mail, nach
 *    der Antwort.
 *  - Ein fremder Hof kann einen Faden weder lesen noch beantworten noch als
 *    gelesen markieren — und erfährt nicht, dass es ihn gibt.
 *  - Lesestand nur für die eigene Seite (Hof: HOF, Admin: TEAM), er rückt nur
 *    vor; Zähler (SQL) und Liste (Regel in src/lib) sagen an denselben Zeilen
 *    dasselbe.
 *  - Antwort des Teams: höchstens eine Mail je Faden und Stunde; Antwort des
 *    Hofs: nie eine Mail an den Hof — seit Nr. 95 (N14) geht sie nach der
 *    Regel „Antwort eines Hofs" an die Empfängerliste des Teams.
 *  - Filter „ohne Online-Zahlung" und „Futter ohne Nummer" treffen die
 *    richtigen Höfe; stillgelegte nie.
 *  - Mit dem Hof gehen seine Fäden (Cascade); die Migration läuft ein zweites
 *    Mal ohne Fehler und ohne Änderung.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))

// Der Nachlauf wird gesammelt und selbst abgearbeitet (TESTING_GUIDELINES §3):
// So ist „keine Mail im Antwortpfad" bewiesen, ohne auf Zeit zu warten.
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as (() => Promise<void>)[] }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@/lib/email', () => ({
  sendPostfachMail: vi.fn(async () => ({ id: 'int-mail' })),
  sendHofAntwortAnTeam: vi.fn(async () => ({ gesendet: 1, gescheitert: 0 })),
}))

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { sendHofAntwortAnTeam, sendPostfachMail } from '@/lib/email'
import { empfaengerFuer, zaehleUngelesen, POSTFACH_FEHLER } from '@/lib/postfach'
import { antworteAlsHof, antworteAlsTeam, markiereGelesen, markiereGelesenTeam, sendeRundschreiben } from '@/server/actions/postfach'
import { ladeEmpfaengerHoefe, ladeFadenHof, ladeFaedenHof, zaehleUngelesenHof, zaehleUngelesenTeam } from '@/server/queries/postfach'
import { erstelleHof, erstelleHofMitAnmeldung, erstelleProdukt, raeumeAuf, machePasskeyAdmin } from './setup/basis'

const MIGRATION = readFileSync(join(process.cwd(), 'prisma', 'migrations', '20261013210000_postfach', 'migration.sql'), 'utf8')

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  vi.mocked(sendPostfachMail).mockClear()
  vi.mocked(sendHofAntwortAnTeam).mockClear()
  nachlauf.aufgaben.length = 0
  await prisma.rundschreiben.deleteMany({ where: { titel: { startsWith: 'int-' } } })
  await raeumeAuf()
})

async function alsSitzung(cookie: string): Promise<void> {
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
}

/** Ein Admin mit Hof (Better Auth) — das Team. */
async function erstelleAdmin(): Promise<{ cookie: string }> {
  const { ownerId, cookie } = await erstelleHofMitAnmeldung()
  await machePasskeyAdmin(ownerId)
  return { cookie }
}

async function arbeiteNachlaufAb(): Promise<void> {
  const aufgaben = nachlauf.aufgaben.splice(0)
  for (const aufgabe of aufgaben) await aufgabe()
}

/** Ein Rundschreiben an genau diese Höfe; gibt die Fäden je Hof zurück. */
async function sendeAn(cookie: string, hofIds: string[], abweichend: Record<string, unknown> = {}): Promise<Map<string, string>> {
  await alsSitzung(cookie)
  const ergebnis = await sendeRundschreiben({
    titel: 'int-Bitte die Abholzeiten prüfen',
    text: 'Erfundener Text für die Integrationsschicht.',
    art: 'WICHTIG',
    link: '/settings/pickup-slots',
    perMail: false,
    antwortMoeglich: true,
    empfaenger: { art: 'ausgewaehlt', hofIds },
    ...abweichend,
  })
  expect(ergebnis).toMatchObject({ ok: true })
  const faeden = await prisma.unterhaltung.findMany({ where: { farmId: { in: hofIds } }, select: { id: true, farmId: true } })
  return new Map(faeden.map((f) => [f.farmId, f.id]))
}

describe('Rundschreiben senden (Fan-out)', () => {
  it('je Empfänger genau ein Faden mit der ersten Nachricht vom Team, gezählt; doppelt und stillgelegt fallen heraus', async () => {
    const { cookie } = await erstelleAdmin()
    const { farm: a } = await erstelleHof()
    const { farm: b } = await erstelleHof()
    const { farm: still } = await erstelleHof({ archivedAt: new Date() })

    const faeden = await sendeAn(cookie, [a.id, b.id, a.id, still.id], { perMail: true })

    const rundschreiben = await prisma.rundschreiben.findFirstOrThrow({ where: { titel: { startsWith: 'int-' } } })
    expect(rundschreiben.empfaenger).toBe(2)
    const regel = rundschreiben.empfaengerRegel as { art: string; hofIds: string[] }
    expect(regel.art).toBe('ausgewaehlt')
    expect([...regel.hofIds].sort()).toEqual([a.id, b.id].sort())
    expect([...faeden.keys()].sort()).toEqual([a.id, b.id].sort())
    const nachrichten = await prisma.nachricht.findMany({ where: { unterhaltung: { rundschreibenId: rundschreiben.id } } })
    expect(nachrichten).toHaveLength(2)
    for (const n of nachrichten) expect(n).toMatchObject({ vonFarmId: null, art: 'WICHTIG', linkUrl: '/settings/pickup-slots' })
    expect(await prisma.unterhaltung.count({ where: { farmId: still.id } })).toBe(0)

    // Die Mails laufen erst nach der Antwort — je Faden eine.
    expect(sendPostfachMail).not.toHaveBeenCalled()
    await arbeiteNachlaufAb()
    expect(sendPostfachMail).toHaveBeenCalledTimes(2)
    expect(vi.mocked(sendPostfachMail).mock.calls.map(([m]) => m.art)).toEqual(['rundschreiben', 'rundschreiben'])
  })

  it('ohne Haken keine Mail; ohne Admin-Recht kein Rundschreiben', async () => {
    const { cookie: adminCookie } = await erstelleAdmin()
    const { farm: a, cookie: hofCookie } = await erstelleHofMitAnmeldung()
    await sendeAn(adminCookie, [a.id])
    await arbeiteNachlaufAb()
    expect(sendPostfachMail).not.toHaveBeenCalled()

    await alsSitzung(hofCookie)
    const ergebnis = await sendeRundschreiben({ titel: 'int-Fremd', text: 'Erfunden.', art: 'INFO', link: '', perMail: false, antwortMoeglich: false, empfaenger: { art: 'alle' } })
    expect(ergebnis).toEqual({ error: 'Kein Zugriff.' })
    expect(await prisma.rundschreiben.count({ where: { titel: 'int-Fremd' } })).toBe(0)
  })

  it('mit dem Hof gehen seine Fäden, Nachrichten und Lesestände (Cascade)', async () => {
    const { cookie } = await erstelleAdmin()
    const { farm: a } = await erstelleHof()
    const faden = (await sendeAn(cookie, [a.id])).get(a.id)!
    await prisma.unterhaltungStand.create({ data: { unterhaltungId: faden, seite: 'HOF', gelesenBis: new Date() } })

    await prisma.farm.delete({ where: { id: a.id } })

    expect(await prisma.unterhaltung.count({ where: { id: faden } })).toBe(0)
    expect(await prisma.nachricht.count({ where: { unterhaltungId: faden } })).toBe(0)
    expect(await prisma.unterhaltungStand.count({ where: { unterhaltungId: faden } })).toBe(0)
  })
})

describe('Ein fremder Hof', () => {
  it('kann einen Faden weder lesen noch beantworten noch als gelesen markieren', async () => {
    const { cookie } = await erstelleAdmin()
    const { farm: eigen } = await erstelleHofMitAnmeldung()
    const { farm: fremd, cookie: fremdCookie } = await erstelleHofMitAnmeldung()
    const faden = (await sendeAn(cookie, [eigen.id])).get(eigen.id)!
    const nachricht = await prisma.nachricht.findFirstOrThrow({ where: { unterhaltungId: faden } })

    expect(await ladeFadenHof(fremd.id, faden)).toBeNull()
    expect(await ladeFadenHof(eigen.id, faden)).not.toBeNull()

    await alsSitzung(fremdCookie)
    expect(await antworteAlsHof({ unterhaltungId: faden, text: 'Erfundene Antwort.' })).toEqual({ error: POSTFACH_FEHLER.nichtGefunden })
    expect(await markiereGelesen({ unterhaltungId: faden, nachrichtId: nachricht.id })).toEqual({ error: POSTFACH_FEHLER.nichtGefunden })

    expect(await prisma.nachricht.count({ where: { unterhaltungId: faden } })).toBe(1)
    expect(await prisma.unterhaltungStand.count({ where: { unterhaltungId: faden } })).toBe(0)
    // Ein Hof ist kein Team.
    expect(await antworteAlsTeam({ unterhaltungId: faden, text: 'Erfunden.', wichtig: false, link: null, perMail: false })).toEqual({ error: 'Kein Zugriff.' })
  })
})

describe('Lesestand je Seite', () => {
  it('der Hof setzt nur HOF, das Team nur TEAM — und er rückt nur vor', async () => {
    const { cookie: adminCookie } = await erstelleAdmin()
    const { farm: hof, cookie: hofCookie } = await erstelleHofMitAnmeldung()
    const faden = (await sendeAn(adminCookie, [hof.id])).get(hof.id)!
    const erste = await prisma.nachricht.findFirstOrThrow({ where: { unterhaltungId: faden } })

    // Das Team antwortet später — es gibt eine neuere Nachricht vom Team.
    await alsSitzung(adminCookie)
    expect(await antworteAlsTeam({ unterhaltungId: faden, text: 'Erfundene Antwort vom Team.', wichtig: false, link: null, perMail: false })).toMatchObject({ ok: true, mail: 'aus' })
    const zweite = await prisma.nachricht.findFirstOrThrow({ where: { unterhaltungId: faden }, orderBy: { createdAt: 'desc' } })
    expect(zweite.createdAt.getTime()).toBeGreaterThan(erste.createdAt.getTime())

    await alsSitzung(hofCookie)
    expect(await markiereGelesen({ unterhaltungId: faden, nachrichtId: zweite.id })).toEqual({ ok: true })
    // Ein alter Tab meldet die ältere Nachricht — der Stand bleibt.
    expect(await markiereGelesen({ unterhaltungId: faden, nachrichtId: erste.id })).toEqual({ ok: true })
    const staende = await prisma.unterhaltungStand.findMany({ where: { unterhaltungId: faden } })
    expect(staende.find((s) => s.seite === 'HOF')?.gelesenBis).toEqual(zweite.createdAt)
    // Die Antwort des Teams setzte TEAM (wer antwortet, hat gelesen) — der Hof hat ihn nicht verändert.
    expect(staende.find((s) => s.seite === 'TEAM')?.gelesenBis).toEqual(zweite.createdAt)

    // Der Hof antwortet: neu für das Team, nicht für den Hof.
    expect(await antworteAlsHof({ unterhaltungId: faden, text: 'Erfundene Antwort des Hofs.' })).toEqual({ ok: true })
    const antwort = await prisma.nachricht.findFirstOrThrow({ where: { unterhaltungId: faden, vonFarmId: hof.id } })
    expect(await zaehleUngelesenHof(hof.id)).toBe(0)

    await alsSitzung(adminCookie)
    const teamVorher = await zaehleUngelesenTeam()
    expect(await markiereGelesenTeam({ unterhaltungId: faden, nachrichtId: antwort.id })).toEqual({ ok: true })
    expect(await zaehleUngelesenTeam()).toBe(teamVorher - 1)
    const hofStand = await prisma.unterhaltungStand.findUniqueOrThrow({ where: { unterhaltungId_seite: { unterhaltungId: faden, seite: 'HOF' } } })
    expect(hofStand.gelesenBis).toEqual(antwort.createdAt)
  })

  it('Zähler (SQL) und Liste (Regel) sagen an denselben Zeilen dasselbe', async () => {
    const { cookie } = await erstelleAdmin()
    const { farm: hof, cookie: hofCookie } = await erstelleHofMitAnmeldung()
    await sendeAn(cookie, [hof.id], { titel: 'int-Erstes' })
    await sendeAn(cookie, [hof.id], { titel: 'int-Zweites', art: 'INFO' })

    expect(await zaehleUngelesenHof(hof.id)).toBe(2)
    expect(zaehleUngelesen(await ladeFaedenHof(hof.id))).toBe(2)

    const [neuester] = await ladeFaedenHof(hof.id)
    await alsSitzung(hofCookie)
    expect(await markiereGelesen({ unterhaltungId: neuester.id, nachrichtId: neuester.neuesteVomTeam!.id })).toEqual({ ok: true })
    expect(await zaehleUngelesenHof(hof.id)).toBe(1)
    expect(zaehleUngelesen(await ladeFaedenHof(hof.id))).toBe(1)
  })
})

describe('E-Mail zur Antwort des Teams', () => {
  it('höchstens eine je Faden und Stunde; eine Antwort des Hofs schickt nie eine an den Hof', async () => {
    const { cookie: adminCookie } = await erstelleAdmin()
    const { farm: hof, cookie: hofCookie } = await erstelleHofMitAnmeldung()
    const faden = (await sendeAn(adminCookie, [hof.id])).get(hof.id)!

    await alsSitzung(adminCookie)
    const eingabe = { unterhaltungId: faden, text: 'Erfundene Antwort.', wichtig: true, link: '/products', perMail: true }
    const [eins, zwei] = await Promise.all([antworteAlsTeam(eingabe), antworteAlsTeam(eingabe)])
    // Gleichzeitig: genau eine belegt die Stunde, gleich welche.
    expect([eins, zwei].map((e) => ('mail' in e ? e.mail : e.error)).sort()).toEqual(['gedrosselt', 'unterwegs'])
    expect(await antworteAlsTeam(eingabe)).toMatchObject({ ok: true, mail: 'gedrosselt' })

    await alsSitzung(hofCookie)
    expect(await antworteAlsHof({ unterhaltungId: faden, text: 'Erfundene Antwort des Hofs.' })).toEqual({ ok: true })

    await arbeiteNachlaufAb()
    expect(sendPostfachMail).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendPostfachMail).mock.calls[0][0]).toMatchObject({ art: 'antwort', unterhaltungId: faden, link: '/products' })
    // Die Antwort des Hofs geht an die Empfängerliste des Teams (Zustellung, N14), nie an den Hof.
    expect(sendHofAntwortAnTeam).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendHofAntwortAnTeam).mock.calls[0]![1]).toMatchObject({ unterhaltungId: faden, text: 'Erfundene Antwort des Hofs.' })
    expect(await prisma.nachricht.count({ where: { unterhaltungId: faden, vonFarmId: null, art: 'WICHTIG' } })).toBe(4)
  })
})

describe('Empfänger nach Filter', () => {
  it('„ohne Online-Zahlung" und „Futter ohne Nummer" treffen die richtigen Höfe, stillgelegte nie', async () => {
    const futterOhneNummer = (await erstelleHof({ stripeAccountReady: true, betriebsnummer: null })).farm
    const ohneStripe = (await erstelleHof({ stripeAccountReady: false })).farm
    const futterMitNummer = (await erstelleHof({ stripeAccountReady: true })).farm
    const futterAus = (await erstelleHof({ stripeAccountReady: true, betriebsnummer: null })).farm
    const still = (await erstelleHof({ stripeAccountReady: false, betriebsnummer: null, archivedAt: new Date() })).farm
    for (const [hof, verfuegbar] of [
      [futterOhneNummer, true],
      [futterMitNummer, true],
      [futterAus, false],
      [still, true],
    ] as const) {
      const produkt = await erstelleProdukt(hof.id)
      await prisma.product.update({ where: { id: produkt.id }, data: { category: 'HEU_STROH', isAvailable: verfuegbar } })
    }
    const eigene = new Set([futterOhneNummer.id, ohneStripe.id, futterMitNummer.id, futterAus.id, still.id])
    const hoefe = await ladeEmpfaengerHoefe()
    const nur = (ids: string[]) => ids.filter((id) => eigene.has(id)).sort()

    expect(nur(empfaengerFuer({ art: 'futter-ohne-nummer' }, hoefe))).toEqual([futterOhneNummer.id])
    expect(nur(empfaengerFuer({ art: 'ohne-online-zahlung' }, hoefe))).toEqual([ohneStripe.id])
    expect(nur(empfaengerFuer({ art: 'alle' }, hoefe))).toEqual([futterOhneNummer.id, ohneStripe.id, futterMitNummer.id, futterAus.id].sort())
    expect(nur(empfaengerFuer({ art: 'ausgewaehlt', hofIds: [still.id, ohneStripe.id] }, hoefe))).toEqual([ohneStripe.id])
  })
})

describe('Migration 20261013210000_postfach', () => {
  it('läuft ein zweites Mal ohne Fehler und ändert nichts', async () => {
    const { cookie } = await erstelleAdmin()
    const { farm } = await erstelleHof()
    const faden = (await sendeAn(cookie, [farm.id])).get(farm.id)!
    const vorher = await prisma.unterhaltung.findUniqueOrThrow({ where: { id: faden }, include: { nachrichten: true } })

    // Kommentare weg, dann je Anweisung — ein DO-Block ist eine Anweisung (er trägt eigene Semikolons).
    const ohneKommentare = MIGRATION.replace(/--.*$/gm, '')
    for (const treffer of ohneKommentare.matchAll(/\s*DO \$\$[\s\S]*?END \$\$;|[^;]+;/g)) {
      const anweisung = treffer[0].trim().replace(/;$/, '')
      if (anweisung) await prisma.$executeRawUnsafe(anweisung)
    }

    expect(await prisma.unterhaltung.findUniqueOrThrow({ where: { id: faden }, include: { nachrichten: true } })).toEqual(vorher)
  })
})
