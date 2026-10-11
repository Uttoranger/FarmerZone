/**
 * Was ein Abschnitt von „Mein Hof" an die bestehenden Aktionen schickt
 * (src/lib/abschnitt-stand.ts, Nachtlauf Nr. 50).
 *
 * saveAppearanceAction schreibt bei JEDEM Aufruf Leitspruch, Gründungsjahr,
 * Über uns, Abschnitte und Werte (die Werte löscht sie und legt sie neu an);
 * updateProfile schreibt das ganze Profil. Ein Abschnitt darf deshalb nur sein
 * eigenes Feld ändern und muss den Rest aus dem frischen Stand mitschicken.
 *
 * Beweist (rein, ohne Datenbank):
 *  - auftrittBasis gibt jedes Feld des Stands unverändert weiter, Werte in
 *    ihrer Reihenfolge (sortOrder = Platz), und schickt nie Logo oder Titelbild.
 *  - auftrittMitTeil ändert nur, was der Abschnitt setzt: undefined heißt
 *    „nicht meins", null heißt „leeren".
 *  - profilBasis und profilMitTeil tun dasselbe für das Profil.
 *  - Der Stand wird nicht verändert (der nächste Abschnitt rechnet weiter damit).
 */
import { describe, it, expect } from 'vitest'
import { appearanceSchema } from '@/schemas/auftritt'
import { profileSchema } from '@/schemas/hofprofil'
import {
  auftrittBasis,
  auftrittMitTeil,
  auftrittStandAus,
  profilBasis,
  profilMitTeil,
  type AuftrittStand,
  type ProfilQuelle,
} from '@/lib/abschnitt-stand'

const STAND: AuftrittStand = {
  tagline: 'Frisch vom Feld',
  foundedYear: 1950,
  aboutText: 'Seit drei Generationen.',
  sectionsConfig: [
    { key: 'products', visible: true, order: 1 },
    { key: 'gallery', visible: false, order: 2 },
    { key: 'about', visible: true, order: 3 },
  ],
  farmValues: [
    { icon: 'saisonal', title: 'Saisonal', subtitle: 'Was gerade wächst' },
    { icon: 'regional', title: 'Regional', subtitle: null },
    { icon: 'handarbeit', title: 'Handarbeit', subtitle: '' },
  ],
}

describe('auftrittBasis', () => {
  it('gibt jedes Feld unverändert weiter — die Werte in ihrer Reihenfolge, sortOrder = Platz', () => {
    expect(auftrittBasis(STAND)).toEqual({
      tagline: 'Frisch vom Feld',
      foundedYear: 1950,
      aboutText: 'Seit drei Generationen.',
      sectionsConfig: STAND.sectionsConfig,
      farmValues: [
        { icon: 'saisonal', title: 'Saisonal', subtitle: 'Was gerade wächst', sortOrder: 0 },
        { icon: 'regional', title: 'Regional', subtitle: null, sortOrder: 1 },
        // Leerer Untertitel wird null — wie bisher in Mein Auftritt.
        { icon: 'handarbeit', title: 'Handarbeit', subtitle: null, sortOrder: 2 },
      ],
    })
  })

  it('schickt nie Logo, Titelbild oder Verlauf — die haben eigene Aktionen, und die Aktion rührt fehlende Felder nicht an', () => {
    const basis = auftrittBasis(STAND)
    for (const feld of ['logoUrl', 'bannerType', 'bannerUrl', 'bannerValue']) expect(basis, feld).not.toHaveProperty(feld)
  })

  it('besteht das Schema der Aktion', () => {
    expect(appearanceSchema.safeParse(auftrittBasis(STAND)).success).toBe(true)
  })
})

describe('auftrittMitTeil', () => {
  it('ändert nur das eigene Feld — alles andere aus dem frischen Stand', () => {
    const neu = auftrittMitTeil(STAND, { aboutText: 'Neuer Text' })
    expect(neu).toEqual({ ...auftrittBasis(STAND), aboutText: 'Neuer Text' })
  })

  it('undefined heißt „nicht meins", null heißt „leeren"', () => {
    expect(auftrittMitTeil(STAND, { tagline: undefined }).tagline).toBe('Frisch vom Feld')
    expect(auftrittMitTeil(STAND, { tagline: null, foundedYear: null })).toMatchObject({ tagline: null, foundedYear: null, aboutText: 'Seit drei Generationen.' })
  })

  it('neue Werte bekommen sortOrder nach ihrem Platz, die übrigen Felder bleiben', () => {
    const neu = auftrittMitTeil(STAND, {
      farmValues: [
        { icon: 'bio', title: 'Bio-zertifiziert', subtitle: null, sortOrder: 7 },
        { icon: 'saisonal', title: 'Saisonal', subtitle: 'Was gerade wächst', sortOrder: 3 },
      ],
    })
    expect(neu.farmValues.map((v) => [v.title, v.sortOrder])).toEqual([
      ['Bio-zertifiziert', 0],
      ['Saisonal', 1],
    ])
    expect(neu.sectionsConfig).toEqual(STAND.sectionsConfig)
    expect(neu.tagline).toBe('Frisch vom Feld')
  })

  it('verändert den Stand nicht', () => {
    const vorher = structuredClone(STAND)
    auftrittMitTeil(STAND, { sectionsConfig: [{ key: 'products', visible: true, order: 1 }], farmValues: [] })
    expect(STAND).toEqual(vorher)
  })
})

describe('auftrittStandAus', () => {
  it('nimmt aus dem gelesenen Auftritt genau die Felder, die die Aktion immer schreibt', () => {
    // So liefert getAppearanceData den Auftritt — mit Kennungen, Bildern und Fotos.
    const gelesen = {
      ...STAND,
      farmId: 'hof-1',
      logoUrl: 'https://bilder.example/logo.webp',
      bannerType: 'PHOTO' as const,
      bannerUrl: null,
      bannerValue: null,
      farmPhotos: [],
      slug: 'hof-test',
      farmValues: [{ id: 'w1', icon: 'bio', title: 'Bio-zertifiziert', subtitle: null, sortOrder: 4 }],
    }
    const stand = auftrittStandAus(gelesen)
    expect(stand).toEqual({
      tagline: 'Frisch vom Feld',
      foundedYear: 1950,
      aboutText: 'Seit drei Generationen.',
      sectionsConfig: STAND.sectionsConfig,
      farmValues: [{ icon: 'bio', title: 'Bio-zertifiziert', subtitle: null }],
    })
  })
})

const PROFIL: ProfilQuelle = {
  name: 'Hof Test',
  ownerName: 'Max Mustermann',
  description: 'Gemüse und Eier aus Musterdorf',
  address: 'Musterweg 1',
  postalCode: '4900',
  city: 'Musterdorf',
  country: 'AT',
  latitude: 48.2,
  longitude: 13.4,
  phone: '+43 660 0000000',
  email: 'hof@example.com',
  betriebsnummer: 'LFBIS 0000000',
  betriebsstatus: 'PRIMAERPRODUKTION',
}

describe('profilBasis und profilMitTeil', () => {
  it('das ganze Profil, wie updateProfile es verlangt — ohne Logo und Titelbild', () => {
    const basis = profilBasis(PROFIL)
    expect(basis).toEqual({ ...PROFIL, country: 'AT' })
    expect(profileSchema.safeParse(basis).success).toBe(true)
    expect(basis).not.toHaveProperty('logoUrl')
  })

  it('ein unbekanntes Land fällt auf Österreich (alsLand) — die Spalte ist ein freier Text', () => {
    expect(profilBasis({ ...PROFIL, country: 'XX' }).country).toBe('AT')
  })

  it('ändert nur das eigene Feld', () => {
    expect(profilMitTeil(PROFIL, { phone: '+43 660 1111111' })).toEqual({ ...profilBasis(PROFIL), phone: '+43 660 1111111' })
    expect(profilMitTeil(PROFIL, { name: undefined }).name).toBe('Hof Test')
  })
})
