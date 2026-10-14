/**
 * „Wer geöffnet bekam" (Nachtlauf Nr. 66, Register W1) gegen ein ECHTES
 * Postgres.
 *
 * Die Aussage:
 *  - Die Migration 20261012200000_whatsapp_getippt ist anwendbar (global-setup
 *    fährt `migrate deploy`): StatusPost.whatsappGetippt existiert als text[],
 *    nullable, mit leerem Default.
 *  - DEPLOY-FENSTER: Alter Code legt Beiträge an, ohne die Spalte zu kennen
 *    (rohes SQL nur mit den alten Spalten) — der Beitrag liest [].
 *  - Ein zweiter Lauf der Migration (IF NOT EXISTS) fasst keinen Beitrag an.
 *  - setzeWhatsAppGetippt mit echter Hof-Anmeldung: setzt, bleibt beim zweiten
 *    Mal gleich, setzt zurück, schreibt whatsappSentCount gleich der Länge mit,
 *    verliert bei gleichzeitigen Tipps nichts und schreibt weder in einen
 *    fremden Beitrag noch eine fremde Abonnements-ID.
 *  - getStatusPostForWhatsApp liest die Empfängerinnen live (nichts
 *    eingefroren) und liefert, wer geöffnet bekam; zaehleWhatsAppAbonnentinnen
 *    zählt dieselben.
 *  - Die Regel „wer WhatsApp bekommt" als Prisma-Bedingung (Liste, Zahl) und als
 *    SQL (whatsAppAbonnentinSql, EXISTS in setzeWhatsAppGetippt) wählt an
 *    DENSELBEN Zeilen dieselben Abonnentinnen (Regelvorschlag 75, Nr. 85).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn() }))

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { setzeWhatsAppGetippt } from '@/server/actions/status-posts'
import { getStatusPostForWhatsApp, whatsAppAbonnentinSql, zaehleWhatsAppAbonnentinnen } from '@/server/queries/status-posts'
import { erstelleHof, erstelleHofMitAnmeldung, intKennung, raeumeAuf } from './setup/basis'

const MIGRATION = readFileSync(
  join(process.cwd(), 'prisma', 'migrations', '20261012200000_whatsapp_getippt', 'migration.sql'),
  'utf8'
)
const ABO_WEG = 'Diese Person bekommt deine WhatsApp-Nachrichten nicht mehr. Lade die Seite neu.'
const BEITRAG_WEG = 'Diesen Beitrag gibt es nicht mehr. Lade die Seite neu.'

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  await raeumeAuf()
})

/** Ein veröffentlichter Beitrag des Hofs, per WhatsApp angekündigt. */
function beitragVon(farmId: string) {
  return prisma.statusPost.create({
    data: { farmId, title: 'Neue Eier', body: 'Frisch gelegt.', publishedAt: new Date(), sentViaWhatsApp: true, whatsappRecipientCount: 2 },
  })
}

/** Ein Abo mit WhatsApp-Häkchen und erfundener Nummer; die Adresse trägt das int-Präfix (raeumeAuf). */
function aboVon(farmId: string, mehr: { optInWhatsApp?: boolean; customerPhone?: string | null } = {}) {
  const kennung = intKennung('abo')
  return prisma.customerFarmSubscription.create({
    data: { farmId, customerEmail: `${kennung}@example.com`, optInWhatsApp: true, customerPhone: '+43 660 0000000', ...mehr },
  })
}

/** Ein Hof mit echter Sitzung; die Actions lesen sie aus den Kopfzeilen. */
async function angemeldeterHof() {
  const { farm, cookie } = await erstelleHofMitAnmeldung()
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return farm
}

function stand(id: string) {
  return prisma.statusPost.findUniqueOrThrow({ where: { id }, select: { whatsappGetippt: true, whatsappSentCount: true } })
}

describe('Spalte StatusPost.whatsappGetippt', () => {
  it('existiert als text[], nullable, mit leerem Default', async () => {
    const spalten = await prisma.$queryRaw<
      { data_type: string; udt_name: string; is_nullable: string; column_default: string | null }[]
    >`
      SELECT data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'StatusPost' AND column_name = 'whatsappGetippt'`
    expect(spalten).toEqual([{ data_type: 'ARRAY', udt_name: '_text', is_nullable: 'YES', column_default: 'ARRAY[]::text[]' }])
  })

  it('Deploy-Fenster: ein Beitrag aus altem Code liest [] — niemand gilt als geöffnet', async () => {
    const { farm } = await erstelleHof()
    const kennung = intKennung('beitrag')
    // Nur Spalten, die es vor der Migration gab — so schreibt der alte Code (samt Zähler).
    await prisma.$executeRaw`
      INSERT INTO "StatusPost" ("id", "farmId", "title", "body", "publishedAt", "sentViaWhatsApp",
                                "whatsappRecipientCount", "whatsappSentCount", "updatedAt")
      VALUES (${kennung}, ${farm.id}, 'Neue Eier', 'Frisch gelegt.', now(), true, 3, 2, now())`

    expect(await stand(kennung)).toEqual({ whatsappGetippt: [], whatsappSentCount: 2 })
  })

  it('ein zweiter Lauf der Migration ändert keinen bestehenden Beitrag', async () => {
    const { farm } = await erstelleHof()
    const leer = await beitragVon(farm.id)
    const getippt = await prisma.statusPost.create({
      data: { farmId: farm.id, title: 'Spargel', body: 'Ab heute.', whatsappGetippt: ['cabo00000000000000000001'], whatsappSentCount: 1 },
    })
    const ids = [leer.id, getippt.id]
    const vorher = await prisma.statusPost.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } })

    // Prisma fährt eine Migration nicht in einer Transaktion — sie muss wiederholbar sein.
    // Erst die Kommentare weg (sie enthalten selbst Semikolons), dann je Anweisung.
    for (const anweisung of MIGRATION.replace(/--.*$/gm, '')
      .split(';')
      .map((teil) => teil.trim())
      .filter(Boolean)) {
      await prisma.$executeRawUnsafe(anweisung)
    }

    const nachher = await prisma.statusPost.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } })
    expect(nachher).toEqual(vorher)
    expect(nachher.find((p) => p.id === leer.id)?.whatsappGetippt).toEqual([])
    expect(nachher.find((p) => p.id === getippt.id)?.whatsappGetippt).toEqual(['cabo00000000000000000001'])
  })
})

describe('setzeWhatsAppGetippt mit echter Hof-Anmeldung', () => {
  it('setzt, bleibt beim zweiten Mal gleich, setzt zurück — der Zähler folgt der Liste', async () => {
    const farm = await angemeldeterHof()
    const beitrag = await beitragVon(farm.id)
    const anna = await aboVon(farm.id)
    const berta = await aboVon(farm.id)

    expect(await setzeWhatsAppGetippt(beitrag.id, anna.id, true)).toEqual({ ok: true, getippt: [anna.id] })
    expect(await setzeWhatsAppGetippt(beitrag.id, anna.id, true)).toEqual({ ok: true, getippt: [anna.id] })
    expect(await setzeWhatsAppGetippt(beitrag.id, berta.id, true)).toEqual({ ok: true, getippt: [anna.id, berta.id] })
    expect(await stand(beitrag.id)).toEqual({ whatsappGetippt: [anna.id, berta.id], whatsappSentCount: 2 })

    expect(await setzeWhatsAppGetippt(beitrag.id, anna.id, false)).toEqual({ ok: true, getippt: [berta.id] })
    expect(await setzeWhatsAppGetippt(beitrag.id, anna.id, false)).toEqual({ ok: true, getippt: [berta.id] })
    expect(await stand(beitrag.id)).toEqual({ whatsappGetippt: [berta.id], whatsappSentCount: 1 })
  })

  it('der alte Zähler eines Bestandsbeitrags folgt ab dem ersten Tipp der Liste', async () => {
    const farm = await angemeldeterHof()
    const beitrag = await prisma.statusPost.create({
      data: { farmId: farm.id, title: 'Alt', body: 'Alt.', publishedAt: new Date(), sentViaWhatsApp: true, whatsappSentCount: 7 },
    })
    const anna = await aboVon(farm.id)

    await setzeWhatsAppGetippt(beitrag.id, anna.id, true)

    expect(await stand(beitrag.id)).toEqual({ whatsappGetippt: [anna.id], whatsappSentCount: 1 })
  })

  it('gleichzeitige Tipps (zwei Tabs) verlieren nichts', async () => {
    const farm = await angemeldeterHof()
    const beitrag = await beitragVon(farm.id)
    const abos = []
    for (let i = 0; i < 6; i++) abos.push(await aboVon(farm.id))

    const antworten = await Promise.all(abos.map((abo) => setzeWhatsAppGetippt(beitrag.id, abo.id, true)))

    // Den Weg entscheidet die Maschine — zugesichert wird der Zustand danach.
    expect(antworten.every((antwort) => 'ok' in antwort)).toBe(true)
    const nachher = await stand(beitrag.id)
    expect([...nachher.whatsappGetippt].sort()).toEqual(abos.map((abo) => abo.id).sort())
    expect(nachher.whatsappSentCount).toBe(6)
  })

  it('fremdes Abonnement und fremder Beitrag: abgelehnt, nichts geschrieben', async () => {
    const farm = await angemeldeterHof()
    const beitrag = await beitragVon(farm.id)
    const eigenesAbo = await aboVon(farm.id)
    const { farm: fremd } = await erstelleHof()
    const fremdesAbo = await aboVon(fremd.id)
    const fremderBeitrag = await beitragVon(fremd.id)

    expect(await setzeWhatsAppGetippt(beitrag.id, fremdesAbo.id, true)).toEqual({ error: ABO_WEG })
    expect(await setzeWhatsAppGetippt(fremderBeitrag.id, eigenesAbo.id, true)).toEqual({ error: BEITRAG_WEG })
    expect(await setzeWhatsAppGetippt(fremderBeitrag.id, fremdesAbo.id, true)).toEqual({ error: BEITRAG_WEG })

    expect(await stand(beitrag.id)).toEqual({ whatsappGetippt: [], whatsappSentCount: 0 })
    expect(await stand(fremderBeitrag.id)).toEqual({ whatsappGetippt: [], whatsappSentCount: 0 })
  })

  it('eine E-Mail-Abonnentin (ohne WhatsApp-Häkchen, ohne oder mit leerer Nummer) lässt sich nicht als geöffnet markieren (Nr. 75)', async () => {
    const farm = await angemeldeterHof()
    const beitrag = await beitragVon(farm.id)
    const nurMail = await aboVon(farm.id, { optInWhatsApp: false })
    const ohneNummer = await aboVon(farm.id, { customerPhone: null })
    const leereNummer = await aboVon(farm.id, { customerPhone: '' })

    for (const abo of [nurMail, ohneNummer, leereNummer]) {
      expect(await setzeWhatsAppGetippt(beitrag.id, abo.id, true), abo.id).toEqual({ error: ABO_WEG })
    }

    expect(await stand(beitrag.id)).toEqual({ whatsappGetippt: [], whatsappSentCount: 0 })
  })
})

describe('getStatusPostForWhatsApp und zaehleWhatsAppAbonnentinnen', () => {
  it('liest die Empfängerinnen live, je Person Kennung, Name und Nummer — dazu, wer geöffnet bekam', async () => {
    const { farm } = await erstelleHof()
    const beitrag = await beitragVon(farm.id)
    const anna = await aboVon(farm.id)
    await aboVon(farm.id, { optInWhatsApp: false })
    await aboVon(farm.id, { customerPhone: null })
    await prisma.statusPost.update({ where: { id: beitrag.id }, data: { whatsappGetippt: [anna.id] } })
    // Nach dem Veröffentlichen dazugekommen — gehört trotzdem in die Liste (nichts eingefroren).
    const berta = await aboVon(farm.id)

    const daten = await getStatusPostForWhatsApp(farm.id, beitrag.id)

    expect(daten?.getippt).toEqual([anna.id])
    expect(daten?.abonnentinnen.map((a) => a.id)).toEqual([anna.id, berta.id])
    expect(Object.keys(daten?.abonnentinnen[0] ?? {}).sort()).toEqual(['id', 'name', 'phone'])
    expect(await zaehleWhatsAppAbonnentinnen(farm.id)).toBe(2)
  })

  it('ein Beitrag eines anderen Hofs liefert nichts', async () => {
    const { farm } = await erstelleHof()
    const { farm: fremd } = await erstelleHof()
    const fremderBeitrag = await beitragVon(fremd.id)
    expect(await getStatusPostForWhatsApp(farm.id, fremderBeitrag.id)).toBeNull()
  })

  it('Prisma-Form und SQL-Form der Regel wählen an denselben Zeilen dieselben Abonnentinnen (Regelvorschlag 75)', async () => {
    const { farm } = await erstelleHof()
    const { farm: fremd } = await erstelleHof()
    const beitrag = await beitragVon(farm.id)
    // Jede Kombination aus Häkchen und Nummer (gesetzt, leer, fehlt) — nacheinander angelegt.
    const kombinationen = [
      { optInWhatsApp: true, customerPhone: '+43 660 0000000' },
      { optInWhatsApp: true, customerPhone: '' },
      { optInWhatsApp: true, customerPhone: null },
      { optInWhatsApp: false, customerPhone: '+43 664 0000000' },
      { optInWhatsApp: false, customerPhone: '' },
      { optInWhatsApp: false, customerPhone: null },
    ]
    const abos: { id: string }[] = []
    for (const k of kombinationen) abos.push(await aboVon(farm.id, k))
    // Eine Abonnentin eines anderen Hofs gehört in keine der beiden Formen.
    await aboVon(fremd.id)

    const prismaForm = ((await getStatusPostForWhatsApp(farm.id, beitrag.id))?.abonnentinnen ?? []).map((a) => a.id).sort()
    const sqlForm = (
      await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "CustomerFarmSubscription" WHERE ${whatsAppAbonnentinSql(farm.id)}`
    )
      .map((z) => z.id)
      .sort()

    expect(sqlForm).toEqual(prismaForm)
    expect(prismaForm).toEqual([abos[0].id])
    expect(await zaehleWhatsAppAbonnentinnen(farm.id)).toBe(1)
  })

  it('eine leere Nummer zählt nicht — weder in der Liste noch in der Zahl (Nr. 75)', async () => {
    const { farm } = await erstelleHof()
    const beitrag = await beitragVon(farm.id)
    const mitNummer = await aboVon(farm.id)
    await aboVon(farm.id, { customerPhone: '' })

    const daten = await getStatusPostForWhatsApp(farm.id, beitrag.id)

    expect(daten?.abonnentinnen.map((a) => a.id)).toEqual([mitNummer.id])
    expect(await zaehleWhatsAppAbonnentinnen(farm.id)).toBe(1)
  })
})
