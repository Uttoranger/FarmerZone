/**
 * Tests für die Aktivitätsanzeige im Admin-Bereich.
 *
 * Beweist an der echten Query (src/server/queries/admin.ts) und den reinen
 * Helfern (src/lib/farm-aktivitaet.ts):
 *  - Ein Hof mit Inhalten liefert die Zählwerte für Produkte, Fotos und
 *    Abholzeiten sowie die Ja/Nein-Angaben zu Beschreibung und Logo.
 *  - Ein leerer Hof liefert überall null bzw. false.
 *  - Es bleibt bei EINER Abfrage — die Zählwerte kommen per `_count` mit,
 *    nicht über eine Zusatzabfrage je Hof.
 *  - Die Rohwerte (Beschreibungstext, Logo-URL) verlassen die Query nicht.
 *  - Die bestehende Sortierung „wartende zuerst" gilt unverändert weiter.
 *
 * Prisma ist gemockt — kein Datenbankzugriff.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { farm: { findMany: vi.fn() } },
}))

import { getAdminFarms } from '@/server/queries/admin'
import { aktivitaetsTeile, istOhneInhalt, AKTIVITAET_LEER } from '@/lib/farm-aktivitaet'
import { prisma } from '@/lib/prisma'

const farmFindMany = vi.mocked(prisma.farm.findMany)

const ANGELEGT = new Date('2026-08-01T10:00:00.000Z')
const FREIGESCHALTET = new Date('2026-08-02T10:00:00.000Z')

/** So kommt eine Zeile aus der Datenbank zurück — inklusive `_count`. */
function dbZeile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'farm_1',
    name: 'Pilothof',
    slug: 'pilothof',
    createdAt: ANGELEGT,
    approvedAt: FREIGESCHALTET,
    archivedAt: null,
    description: 'Wir sind ein kleiner Familienbetrieb.',
    logoUrl: 'https://blob.example/logo.png',
    country: 'AT',
    owner: { email: 'franz@test.local' },
    _count: { products: 3, farmPhotos: 2, pickupSlots: 1 },
    ...overrides,
  }
}

/** Ein frisch angemeldeter Hof, an dem noch nichts passiert ist. */
function leereZeile(overrides: Record<string, unknown> = {}) {
  return dbZeile({
    id: 'farm_leer',
    name: 'zzqx8t',
    slug: 'zzqx8t',
    approvedAt: null,
    description: '',
    logoUrl: null,
    _count: { products: 0, farmPhotos: 0, pickupSlots: 0 },
    ...overrides,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getAdminFarms — Zählwerte', () => {
  it('liefert für einen Hof mit Inhalten alle Lebenszeichen', async () => {
    farmFindMany.mockResolvedValue([dbZeile()] as never)

    const [hof] = await getAdminFarms()

    expect(hof.aktivitaet).toEqual({
      produkte: 3,
      fotos: 2,
      abholzeiten: 1,
      hatBeschreibung: true,
      hatLogo: true,
    })
  })

  it('liefert für einen leeren Hof überall null und false', async () => {
    farmFindMany.mockResolvedValue([leereZeile()] as never)

    const [hof] = await getAdminFarms()

    expect(hof.aktivitaet).toEqual({
      produkte: 0,
      fotos: 0,
      abholzeiten: 0,
      hatBeschreibung: false,
      hatLogo: false,
    })
    expect(istOhneInhalt(hof.aktivitaet)).toBe(true)
  })

  it('wertet eine Beschreibung aus reinen Leerzeichen als nicht vorhanden', async () => {
    // `description` ist eine Pflichtspalte, im Onboarding aber ein optionales
    // Feld: ein Hof ohne Beschreibung trägt einen leeren String, kein null.
    farmFindMany.mockResolvedValue([leereZeile({ description: '   \n  ' })] as never)

    const [hof] = await getAdminFarms()

    expect(hof.aktivitaet.hatBeschreibung).toBe(false)
  })

  it('erkennt einen Hof, der nur eine Beschreibung hat, als nicht leer', async () => {
    farmFindMany.mockResolvedValue([leereZeile({ description: 'Kleiner Hof im Innviertel.' })] as never)

    const [hof] = await getAdminFarms()

    expect(hof.aktivitaet.hatBeschreibung).toBe(true)
    expect(istOhneInhalt(hof.aktivitaet)).toBe(false)
  })

  it('zählt auch Unveröffentlichtes: ein einzelnes Produkt genügt als Lebenszeichen', async () => {
    farmFindMany.mockResolvedValue([
      leereZeile({ _count: { products: 1, farmPhotos: 0, pickupSlots: 0 } }),
    ] as never)

    const [hof] = await getAdminFarms()

    expect(hof.aktivitaet.produkte).toBe(1)
    expect(istOhneInhalt(hof.aktivitaet)).toBe(false)
  })
})

describe('getAdminFarms — eine einzige Abfrage', () => {
  it('holt die Zählwerte per _count mit, statt je Hof nachzufragen', async () => {
    farmFindMany.mockResolvedValue([dbZeile(), leereZeile()] as never)

    await getAdminFarms()

    expect(farmFindMany).toHaveBeenCalledTimes(1)
    const arg = farmFindMany.mock.calls[0][0] as { select: Record<string, unknown> }
    expect(arg.select._count).toEqual({
      select: { products: true, farmPhotos: true, pickupSlots: true },
    })
  })

  it('gibt Beschreibungstext und Logo-URL nicht nach außen weiter', async () => {
    farmFindMany.mockResolvedValue([dbZeile()] as never)

    const [hof] = await getAdminFarms()

    expect(hof).not.toHaveProperty('description')
    expect(hof).not.toHaveProperty('logoUrl')
    expect(hof).not.toHaveProperty('_count')
  })
})

describe('getAdminFarms — bestehende Zusicherungen', () => {
  it('sortiert wartende Höfe weiterhin nach vorn', async () => {
    farmFindMany.mockResolvedValue([dbZeile(), leereZeile()] as never)

    const hoefe = await getAdminFarms()

    expect(hoefe.map((h) => h.id)).toEqual(['farm_leer', 'farm_1'])
  })

  it('liefert die bisherigen Felder unverändert', async () => {
    farmFindMany.mockResolvedValue([dbZeile()] as never)

    const [hof] = await getAdminFarms()

    expect(hof).toMatchObject({
      id: 'farm_1',
      name: 'Pilothof',
      slug: 'pilothof',
      ownerEmail: 'franz@test.local',
      createdAt: ANGELEGT,
      approvedAt: FREIGESCHALTET,
      archivedAt: null,
    })
  })
})

describe('Beschriftung der Aktivitätszeile', () => {
  it('setzt Einzahl und Mehrzahl richtig', () => {
    expect(
      aktivitaetsTeile({
        produkte: 1,
        fotos: 1,
        abholzeiten: 1,
        hatBeschreibung: false,
        hatLogo: false,
      })
    ).toEqual(['1 Produkt', '1 Foto', '1 Abholzeit'])

    expect(
      aktivitaetsTeile({
        produkte: 3,
        fotos: 2,
        abholzeiten: 4,
        hatBeschreibung: false,
        hatLogo: false,
      })
    ).toEqual(['3 Produkte', '2 Fotos', '4 Abholzeiten'])
  })

  it('lässt Nullwerte ganz weg, statt „0 Produkte" zu schreiben', () => {
    expect(
      aktivitaetsTeile({
        produkte: 0,
        fotos: 2,
        abholzeiten: 0,
        hatBeschreibung: true,
        hatLogo: false,
      })
    ).toEqual(['2 Fotos', 'Beschreibung'])
  })

  it('hält die Reihenfolge stabil: Produkte, Fotos, Abholzeiten, Beschreibung, Logo', () => {
    expect(
      aktivitaetsTeile({
        produkte: 2,
        fotos: 1,
        abholzeiten: 3,
        hatBeschreibung: true,
        hatLogo: true,
      })
    ).toEqual(['2 Produkte', '1 Foto', '3 Abholzeiten', 'Beschreibung', 'Logo'])
  })

  it('meldet einen leeren Hof als ohne Inhalt — und hat dafür einen eigenen Wortlaut', () => {
    const leer = {
      produkte: 0,
      fotos: 0,
      abholzeiten: 0,
      hatBeschreibung: false,
      hatLogo: false,
    }

    expect(aktivitaetsTeile(leer)).toEqual([])
    expect(istOhneInhalt(leer)).toBe(true)
    expect(AKTIVITAET_LEER).toBe('Noch keine Inhalte')
  })

  it('gilt ein Logo allein schon als Lebenszeichen', () => {
    const nurLogo = {
      produkte: 0,
      fotos: 0,
      abholzeiten: 0,
      hatBeschreibung: false,
      hatLogo: true,
    }

    expect(aktivitaetsTeile(nurLogo)).toEqual(['Logo'])
    expect(istOhneInhalt(nurLogo)).toBe(false)
  })
})

describe('getAdminFarms — das Land des Hofes', () => {
  it('lädt country und reicht es als Land durch — dafür muss die Query es selektieren', async () => {
    farmFindMany.mockResolvedValue([dbZeile({ country: 'DE' })] as never)

    const [hof] = await getAdminFarms()

    expect(hof.land).toBe('DE')
    // Ohne `country: true` im select käme undefined an — das nagelt die
    // Zeile fest, an der die ganze Admin-Kennzeichnung hängt.
    const args = farmFindMany.mock.calls[0]![0]!
    expect((args.select as Record<string, unknown>).country).toBe(true)
  })

  it('ein Bestandshof ohne gesetztes Land gilt als Österreich, nie als undefined', async () => {
    // Nach der Migration steht überall "AT" — die Abbildung darf trotzdem
    // nicht an einem fehlenden Wert zerbrechen (alsLand).
    farmFindMany.mockResolvedValue([
      dbZeile({ country: 'AT' }),
      dbZeile({ id: 'farm_2', slug: 'zweiter', country: undefined }),
    ] as never)

    const hoefe = await getAdminFarms()

    expect(hoefe.map((h) => h.land)).toEqual(['AT', 'AT'])
  })
})
