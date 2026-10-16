/**
 * Die Zählung in `raeumeAuf` gegen ein echtes Postgres (TESTING_GUIDELINES §5; Rechnung in
 * `tests/integration/setup/zaehlung.ts`, schnelle Prüfung in `tests/raeume-auf-zaehlung.test.ts`).
 *
 * Beweist (Zustand danach): `raeumeAuf` zählt vor und nach dem Aufräumen die Zeilen aller Tabellen mit
 * Fremdschlüssel auf ein Konto oder einen Hof. Hängt eine Zeile mit ON DELETE SET NULL an einem Test-Hof
 * (`Meldung.farmId`) und bleibt nach dem Löschen des Hofs stehen, bricht `raeumeAuf` mit dem Namen der
 * Tabelle ab — der Hof selbst ist dann trotzdem weg. Ist alles weg, läuft es leise durch.
 * Texte erfunden.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { erstelleHof, raeumeAuf } from './setup/basis'

const liegengeblieben: string[] = []

afterEach(async () => {
  await prisma.meldung.deleteMany({ where: { id: { in: liegengeblieben } } })
  liegengeblieben.length = 0
  await raeumeAuf()
})

describe('raeumeAuf — Zählung vor und nach dem Aufräumen', () => {
  it('bricht ab und nennt die Tabelle, wenn eine Zeile eines Test-Hofs liegen bleibt', async () => {
    const { farm } = await erstelleHof()
    const meldung = await prisma.meldung.create({
      data: { art: 'FEHLER', text: 'Erfundener Beispieltext', seiteUrl: '/beispiel', userAgent: 'test', viewport: '390x844', farmId: farm.id },
    })
    liegengeblieben.push(meldung.id)

    await expect(raeumeAuf()).rejects.toThrow(/Meldung": 1/)

    // Aufgeräumt wurde trotzdem: Der Hof ist weg, die Meldung steht ohne Hof da.
    expect(await prisma.farm.findUnique({ where: { id: farm.id } })).toBeNull()
    expect(await prisma.meldung.findUnique({ where: { id: meldung.id } })).toMatchObject({ farmId: null })
  })

  it('läuft leise durch, wenn alles weg ist, was am Test-Hof hing', async () => {
    const { farm } = await erstelleHof()
    const meldung = await prisma.meldung.create({
      data: { art: 'FEHLER', text: 'Erfundener Beispieltext', seiteUrl: '/beispiel', userAgent: 'test', viewport: '390x844', farmId: farm.id },
    })
    await prisma.meldung.delete({ where: { id: meldung.id } })

    await expect(raeumeAuf()).resolves.toBeUndefined()
  })
})
