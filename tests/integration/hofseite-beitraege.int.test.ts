/**
 * Die Beiträge der Hofseite (Register F8) gegen ein ECHTES Postgres: veröffentlicht,
 * nicht abgelaufen, „Auf der Hofseite zeigen“ an — der neueste zuerst, höchstens
 * so viele, wie die Seite zeigt. Was die Auswahl ausschließt (Entwurf, Frist, Hof)
 * und wie viele sie liefert, entscheidet die Abfrage in der Datenbank. Die Frist
 * gilt hier beim Lesen; kein Cron räumt abgelaufene Beiträge weg.
 *
 * Beweist: Reihenfolge und Grenze, die Ausschlüsse, die Trennung der Höfe, eine
 * feste Reihenfolge bei gleicher Veröffentlichungszeit — und dass die Liste
 * nicht mehr Felder hergibt als der Beitrag der Hofseite bisher (nichts vom
 * Versand an Abonnentinnen).
 */
import { describe, it, expect, afterEach } from 'vitest'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { HOFSEITE_BEITRAEGE_MAX } from '@/lib/hofseite-kunde'
import { getActiveStatusPosts } from '@/server/queries/status-posts'
import { erstelleHof, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

const STUNDE = 3_600_000
// Zeitpunkte relativ zur Systemuhr, großzügig gewählt (TESTING_GUIDELINES §1): nie auf die Sekunde.
const vor = (stunden: number): Date => new Date(Date.now() - stunden * STUNDE)
const nach = (stunden: number): Date => new Date(Date.now() + stunden * STUNDE)

async function beitrag(farmId: string, titel: string, abweichend: Partial<Prisma.StatusPostUncheckedCreateInput> = {}) {
  return prisma.statusPost.create({
    data: { farmId, title: titel, body: 'Erfundener Text.', anlass: 'ANNOUNCEMENT', publishedAt: vor(1), ...abweichend },
  })
}

const titel = (liste: { title: string }[]): string[] => liste.map((eintrag) => eintrag.title)

describe('getActiveStatusPosts — in der echten Datenbank', () => {
  it('liefert den neuesten zuerst und nie mehr als fünf', async () => {
    const { farm } = await erstelleHof()
    // Beitrag 1 ist der neueste, Beitrag 7 der älteste.
    for (let n = 1; n <= 7; n++) await beitrag(farm.id, `Beitrag ${n}`, { publishedAt: vor(n) })

    const liste = await getActiveStatusPosts(farm.id, HOFSEITE_BEITRAEGE_MAX)

    expect(titel(liste)).toEqual(['Beitrag 1', 'Beitrag 2', 'Beitrag 3', 'Beitrag 4', 'Beitrag 5'])
  })

  it('lässt Entwürfe, noch nicht Veröffentlichtes, Abgelaufenes und Ausgeblendetes aus', async () => {
    const { farm } = await erstelleHof()
    await beitrag(farm.id, 'Gilt noch zwei Tage', { publishedAt: vor(1), expiresAt: nach(48) })
    await beitrag(farm.id, 'Ohne Ende', { publishedAt: vor(2), expiresAt: null })
    await beitrag(farm.id, 'Entwurf', { publishedAt: null })
    await beitrag(farm.id, 'Kommt erst morgen', { publishedAt: nach(24) })
    await beitrag(farm.id, 'Abgelaufen', { publishedAt: vor(72), expiresAt: vor(24) })
    await beitrag(farm.id, 'Nicht für die Hofseite', { showOnFarmPage: false })

    const liste = await getActiveStatusPosts(farm.id, HOFSEITE_BEITRAEGE_MAX)

    expect(titel(liste)).toEqual(['Gilt noch zwei Tage', 'Ohne Ende'])
  })

  it('zeigt nur die Beiträge des eigenen Hofs', async () => {
    const { farm } = await erstelleHof()
    const { farm: anderer } = await erstelleHof()
    await beitrag(farm.id, 'Unser Beitrag')
    await beitrag(anderer.id, 'Beitrag eines anderen Hofs')

    const liste = await getActiveStatusPosts(farm.id, HOFSEITE_BEITRAEGE_MAX)

    expect(titel(liste)).toEqual(['Unser Beitrag'])
  })

  it('bei gleicher Veröffentlichungszeit entscheidet die Kennung — die Reihenfolge bleibt fest', async () => {
    const { farm } = await erstelleHof()
    const gleich = vor(3)
    await beitrag(farm.id, 'Erster', { id: `${farm.slug}-a`, publishedAt: gleich })
    await beitrag(farm.id, 'Zweiter', { id: `${farm.slug}-b`, publishedAt: gleich })

    const erst = await getActiveStatusPosts(farm.id, HOFSEITE_BEITRAEGE_MAX)
    const nochmal = await getActiveStatusPosts(farm.id, HOFSEITE_BEITRAEGE_MAX)

    expect(titel(erst)).toEqual(['Zweiter', 'Erster'])
    expect(titel(nochmal)).toEqual(titel(erst))
  })

  it('gibt nur die Felder her, die die Hofseite zeigt — nichts vom Versand', async () => {
    const { farm } = await erstelleHof()
    await beitrag(farm.id, 'Mit Foto', {
      photoUrl: 'https://example.com/foto.jpg',
      sentViaEmail: true,
      emailRecipientCount: 12,
      whatsappGetippt: ['abo-1'],
    })

    const [erster] = await getActiveStatusPosts(farm.id, HOFSEITE_BEITRAEGE_MAX)

    expect(Object.keys(erster ?? {}).sort()).toEqual(['anlass', 'body', 'fotoAusschnitt', 'id', 'linkedProductIds', 'photoUrl', 'publishedAt', 'title'])
    expect(typeof erster?.publishedAt).toBe('string')
  })
})
