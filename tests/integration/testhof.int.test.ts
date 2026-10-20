/**
 * Testhof (Register N21, Nr. 119) gegen echtes Postgres — was nur die
 * Datenbank beantworten kann:
 *  - Markieren unter der Sperre: ohne Haken bei Platz abgewiesen und nichts
 *    geändert; mit Haken Testhof, ausgenommen, Platz frei (auch ein
 *    festgeschriebener), „geändert von“ für beides; zweimal ändert nichts;
 *  - Zurücknehmen lässt „ausgenommen“ stehen; nimmWiederAuf lehnt einen
 *    Testhof ab;
 *  - Markieren und Wiederaufnahme gleichzeitig: In jeder Verschränkung ist der
 *    Hof danach Testhof UND ausgenommen (die Sperre ordnet beide Wege);
 *  - die Sichtbarkeit an echten Zeilen: ein Testhof fehlt in /hoefe-Daten,
 *    Sitemap, Umfeld, Futter kaufen, im Höfe-Block der Startseite und in
 *    Admin › Startseite (und lässt sich dort nicht speichern), seine
 *    Hofseite lädt (istTesthof) mit noindex; ein nur ausgenommener Hof steht
 *    überall drin und wird indexiert.
 *
 * Alles trägt das Präfix int- (raeumeAuf). Die Einstellung der Gründung wird
 * je Fall gesetzt (viele Plätze, nicht festgeschrieben bzw. festgeschrieben)
 * und im afterEach exakt zurückgeschrieben. Seed-Zeilen werden nur gelesen.
 * Die Uhr bleibt echt (geteilte Test-DB); geprüft werden Zustände.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn(), unstable_rethrow: vi.fn() }))

import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { TESTHOF_ZAEHLT_NIE } from '@/lib/gruendungshof'
import { NEUER_BLOCK } from '@/lib/startseite-gestalten'
import { GRUENDUNG_AUSNEHMEN_GEAENDERT, TESTHOF_HAKEN_FEHLT } from '@/schemas/gruendung'
import { markiereAlsTesthof, nimmTesthofZurueck, nimmWiederAuf } from '@/server/actions/gruendung'
import { speichereEntwurf } from '@/server/actions/startseite'
import { getOeffentlicheHoefe, getPublicFarm } from '@/server/queries/farm'
import { hofIstOeffentlich, ladeSitemapHoefe } from '@/server/queries/seo'
import { getUmfeld } from '@/server/queries/umfeld'
import { getFutterKaufen } from '@/server/queries/futter-kaufen'
import { ladeStartseiteAdmin, zeilenFuerSeite } from '@/server/queries/startseite'
import { erstelleHof, erstelleHofMitAnmeldung, erstelleProdukt, raeumeAuf } from './setup/basis'

type Zeile = Awaited<ReturnType<typeof prisma.plattformEinstellung.findUnique>>
let vorher: Zeile = null

/** Früh freigeschaltet: Vor dem Festschreiben steht der Hof vorn in der Reihenfolge und hält einen Platz. */
const FRUEH = new Date('2000-01-01T00:00:00.000Z')
/** Ein Ort weit weg von den Seed-Höfen — das Umfeld sieht nur die Höfe dieses Tests. */
const ORT = { latitude: 47.05, longitude: 9.65 }

beforeEach(async () => {
  vorher = await prisma.plattformEinstellung.findUnique({ where: { id: 'plattform' } })
  await setzeEinstellung({ gruendungPlaetze: 1000, gruendungFestAm: null })
})

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  if (vorher) {
    const { id, ...werte } = vorher
    await prisma.plattformEinstellung.update({ where: { id }, data: { ...werte, zustellRegeln: werte.zustellRegeln ?? undefined } })
  }
  await raeumeAuf()
})

/** Nur die Spalten der Gründung — und nur, wenn die Zeile da ist (sonst gelten die Standardwerte, nicht festgeschrieben). */
async function setzeEinstellung(daten: { gruendungPlaetze: number; gruendungFestAm: Date | null }): Promise<void> {
  if (vorher) await prisma.plattformEinstellung.update({ where: { id: 'plattform' }, data: daten })
}

/** Ein Admin mit echter Sitzung; das Cookie geht über das gemockte headers() an die Action. */
async function alsAdmin(): Promise<string> {
  const { ownerId, cookie } = await erstelleHofMitAnmeldung()
  await prisma.user.update({ where: { id: ownerId }, data: { isAdmin: true } })
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return ownerId
}

async function stand(id: string) {
  return prisma.farm.findUniqueOrThrow({
    where: { id },
    select: {
      istTesthof: true,
      testhofGeaendertAm: true,
      testhofGeaendertVonUserId: true,
      gruendungAusgenommen: true,
      gruendungPlatz: true,
      gruendungGeaendertVonUserId: true,
    },
  })
}

describe('Markieren und Zurücknehmen unter der Sperre', () => {
  it('Hof mit Platz: ohne Haken abgewiesen und unverändert; mit Haken Testhof, ausgenommen, wer für beides; zweimal ändert nichts', async () => {
    const adminId = await alsAdmin()
    const { farm } = await erstelleHof({ approvedAt: FRUEH })
    const unveraendert = await stand(farm.id)

    expect(await markiereAlsTesthof({ farmId: farm.id, bestaetigt: false })).toEqual({ error: TESTHOF_HAKEN_FEHLT })
    expect(await stand(farm.id)).toEqual(unveraendert)

    expect(await markiereAlsTesthof({ farmId: farm.id, bestaetigt: true })).toEqual({ ok: true })
    const markiert = await stand(farm.id)
    expect(markiert).toMatchObject({
      istTesthof: true,
      testhofGeaendertVonUserId: adminId,
      gruendungAusgenommen: true,
      gruendungPlatz: null,
      gruendungGeaendertVonUserId: adminId,
    })

    expect(await markiereAlsTesthof({ farmId: farm.id, bestaetigt: true })).toEqual({ error: GRUENDUNG_AUSNEHMEN_GEAENDERT })
    expect(await stand(farm.id)).toEqual(markiert)
  })

  it('festgeschrieben: der Platz des Hofs wird frei (gruendungPlatz null)', async () => {
    await alsAdmin()
    await setzeEinstellung({ gruendungPlaetze: 1000, gruendungFestAm: new Date('2026-10-01T08:00:00.000Z') })
    const belegt = new Set((await prisma.farm.findMany({ where: { gruendungPlatz: { not: null } }, select: { gruendungPlatz: true } })).map((f) => f.gruendungPlatz))
    const frei = Array.from({ length: 100 }, (_, i) => 900 + i).find((n) => !belegt.has(n))
    const { farm } = await erstelleHof({ approvedAt: FRUEH, gruendungPlatz: frei })

    expect(await markiereAlsTesthof({ farmId: farm.id, bestaetigt: false })).toEqual({ error: TESTHOF_HAKEN_FEHLT })
    expect(await markiereAlsTesthof({ farmId: farm.id, bestaetigt: true })).toEqual({ ok: true })
    expect(await stand(farm.id)).toMatchObject({ istTesthof: true, gruendungAusgenommen: true, gruendungPlatz: null })
  })

  it('Zurücknehmen lässt „ausgenommen“ stehen; nimmWiederAuf lehnt einen Testhof ab, ohne zu schreiben', async () => {
    await alsAdmin()
    const { farm } = await erstelleHof({ approvedAt: FRUEH })
    expect(await markiereAlsTesthof({ farmId: farm.id, bestaetigt: true })).toEqual({ ok: true })

    const markiert = await stand(farm.id)
    expect(await nimmWiederAuf({ farmId: farm.id })).toEqual({ error: TESTHOF_ZAEHLT_NIE })
    expect(await stand(farm.id)).toEqual(markiert)

    expect(await nimmTesthofZurueck({ farmId: farm.id })).toEqual({ ok: true })
    expect(await stand(farm.id)).toMatchObject({ istTesthof: false, gruendungAusgenommen: true, gruendungPlatz: null })
    // Danach geht wieder zählen über den bestehenden Eintrag.
    expect(await nimmWiederAuf({ farmId: farm.id })).toEqual({ ok: true })
    expect(await stand(farm.id)).toMatchObject({ istTesthof: false, gruendungAusgenommen: false })
  })

  it('Markieren und Wiederaufnahme gleichzeitig: in jeder Verschränkung Testhof UND ausgenommen', async () => {
    await alsAdmin()
    const { farm } = await erstelleHof({ approvedAt: FRUEH, gruendungAusgenommen: true })

    const [markieren, wieder] = await Promise.all([markiereAlsTesthof({ farmId: farm.id, bestaetigt: true }), nimmWiederAuf({ farmId: farm.id })])

    // Markieren gelingt immer (zuerst, oder nach der Wiederaufnahme mit Haken); die Wiederaufnahme nur, wenn sie zuerst kam.
    expect(markieren).toEqual({ ok: true })
    expect([{ ok: true }, { error: TESTHOF_ZAEHLT_NIE }]).toContainEqual(wieder)
    expect(await stand(farm.id)).toMatchObject({ istTesthof: true, gruendungAusgenommen: true, gruendungPlatz: null })
  })
})

describe('Sichtbarkeit an echten Zeilen', () => {
  async function zweiHoefe() {
    const { farm: testhof } = await erstelleHof({ ...ORT, istTesthof: true, gruendungAusgenommen: true })
    const { farm: ausgenommen } = await erstelleHof({ ...ORT, gruendungAusgenommen: true })
    await erstelleProdukt(testhof.id, { stock: 5 })
    await erstelleProdukt(ausgenommen.id, { stock: 5 })
    return { testhof, ausgenommen }
  }

  it('/hoefe-Daten und Sitemap: der Testhof fehlt, der nur ausgenommene Hof steht drin', async () => {
    const { testhof, ausgenommen } = await zweiHoefe()
    const hoefe = (await getOeffentlicheHoefe()).map((h) => h.slug)
    expect(hoefe).not.toContain(testhof.slug)
    expect(hoefe).toContain(ausgenommen.slug)
    const sitemap = (await ladeSitemapHoefe()).map((h) => h.slug)
    expect(sitemap).not.toContain(testhof.slug)
    expect(sitemap).toContain(ausgenommen.slug)
  })

  it('Hofseite per Link: lädt mit istTesthof und noindex; der nur ausgenommene Hof wird indexiert', async () => {
    const { testhof, ausgenommen } = await zweiHoefe()
    expect((await getPublicFarm(testhof.slug))?.istTesthof).toBe(true)
    expect(await hofIstOeffentlich(testhof.slug)).toMatchObject({ indexieren: false })
    expect((await getPublicFarm(ausgenommen.slug))?.istTesthof).toBe(false)
    expect(await hofIstOeffentlich(ausgenommen.slug)).toMatchObject({ indexieren: true })
  })

  it('Region › Umfeld: der Testhof fehlt im Umkreis, der Nachbar daneben steht da', async () => {
    const { testhof, ausgenommen } = await zweiHoefe()
    const { farm: eigen } = await erstelleHof(ORT)
    const umfeld = await getUmfeld(eigen.id, 10)
    if (!umfeld || !umfeld.eigenerStandort) throw new Error('Umfeld ohne Standort')
    const slugs = umfeld.hoefe.map((h) => h.slug)
    expect(slugs).not.toContain(testhof.slug)
    expect(slugs).toContain(ausgenommen.slug)
  })

  it('Region › Futter kaufen: der Testhof fehlt, der gleich gebaute Nachbar steht da', async () => {
    // erstelleHof trägt eine Betriebsnummer — ohne sie stünde keiner der beiden in Futter kaufen.
    const { testhof, ausgenommen } = await zweiHoefe()
    const { farm: eigen } = await erstelleHof(ORT)
    const daten = await getFutterKaufen(eigen.id, 10)
    if (!daten?.eigenerStandort) throw new Error('Futter kaufen ohne Standort')
    const ids = daten.hoefe.map((h) => h.id)
    expect(ids).not.toContain(testhof.id)
    expect(ids).toContain(ausgenommen.id)
  })

  it('Startseite › Höfe-Block: ein gewählter Testhof fällt weg, der Nachbar im selben Block bleibt', async () => {
    const { testhof, ausgenommen } = await zweiHoefe()
    // Der Weg vom gespeicherten Inhalt zu den Zeilen der Seite — derselbe für Live, Fassung und Entwurf.
    const [zeile] = await zeilenFuerSeite({
      v: 1,
      zeilen: [
        {
          art: 'BLOCK',
          sichtbar: true,
          block: { vorlage: 'HOEFE_AUSWAHL', titel: 'int-Höfe-Block', farmIds: [testhof.id, ausgenommen.id], liveAb: '2026-10-01T04:00:00.000Z' },
        },
      ],
    })
    if (zeile?.art !== 'BLOCK') throw new Error('keine Block-Zeile')
    expect(zeile.block.hofSlugs).toEqual([ausgenommen.slug])
  })

  it('Admin › Startseite: der Testhof steht nicht zur Wahl und lässt sich nicht speichern', async () => {
    await alsAdmin()
    const { testhof, ausgenommen } = await zweiHoefe()
    const admin = await ladeStartseiteAdmin(new Date())
    expect(admin.hoefe.map((h) => h.id)).not.toContain(testhof.id)
    expect(admin.hoefe.map((h) => h.id)).toContain(ausgenommen.id)

    const zeilen = await prisma.startseiteAbschnitt.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true } })
    const reihenfolge = [{ id: zeilen[0]!.id, sichtbar: true }, { id: NEUER_BLOCK, sichtbar: true }, ...zeilen.slice(1).map((z) => ({ id: z.id, sichtbar: true }))]
    const block = {
      vorlage: 'HOEFE_AUSWAHL' as const,
      ueberzeile: 'Erntezeit',
      titel: 'int-Testhof gewählt',
      text: null,
      bildUrl: null,
      linkUrl: '/hoefe',
      linkText: null,
      farmIds: [testhof.id],
      kategorie: null,
      liveAbTag: '2026-10-01',
      liveAbUhrzeit: '06:00',
      liveBisTag: null,
      liveBisUhrzeit: null,
    }
    expect(await speichereEntwurf({ reihenfolge, block })).toEqual({ error: 'Wähle nur freigeschaltete Höfe.' })
    expect(await prisma.startseiteBlock.count({ where: { titel: 'int-Testhof gewählt' } })).toBe(0)
  })
})
