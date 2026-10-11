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
 *  - auftrittFehlerText nennt den Abschnitt, der das Speichern sperrt — mit
 *    dem Satz des Schemas, nie mit einem englischen Satz von Zod.
 *  - geaendertSeitLaden (Hof-Profil, Nr. 50 Runde 1) nimmt nur, was seit dem
 *    Laden geändert wurde — Text, Zahl, null; unverändert fehlt der Schlüssel.
 *  - Der Stand wird nicht verändert (der nächste Abschnitt rechnet weiter damit).
 */
import { describe, it, expect } from 'vitest'
import { appearanceSchema } from '@/schemas/auftritt'
import { profileSchema } from '@/schemas/hofprofil'
import {
  ABSCHNITT_SPEICHERN_TEXT,
  auftrittBasis,
  auftrittFehlerText,
  auftrittMitTeil,
  auftrittStandAus,
  geaendertSeitLaden,
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

describe('geaendertSeitLaden (Hof-Profil)', () => {
  const ANFANG = profilBasis(PROFIL)

  it('nur, was seit dem Laden geändert wurde — auch Zahl und null', () => {
    const jetzt = { ...ANFANG, phone: '+43 660 2222222', latitude: 48.25, betriebsnummer: null }
    expect(geaendertSeitLaden(ANFANG, jetzt)).toEqual({ phone: '+43 660 2222222', latitude: 48.25, betriebsnummer: null })
  })

  it('nichts geändert: leer — dann schreibt das Speichern den frischen Stand unverändert', () => {
    expect(geaendertSeitLaden(ANFANG, { ...ANFANG })).toEqual({})
  })

  it('zusammen mit profilMitTeil: der frische Stand plus genau diese Änderung', () => {
    // Inzwischen hat Mein Hof den Namen geändert; der ältere Tab ändert nur das Telefon.
    const frisch = { ...PROFIL, name: 'Hof Neuname' }
    const teil = geaendertSeitLaden(ANFANG, { ...ANFANG, phone: '+43 660 2222222' })
    expect(profilMitTeil(frisch, teil)).toEqual({ ...profilBasis(frisch), phone: '+43 660 2222222' })
    // Gegenprobe: das ganze Formular vom Laden schriebe den alten Namen zurück.
    expect(profilMitTeil(frisch, { ...ANFANG, phone: '+43 660 2222222' }).name).toBe('Hof Test')
  })
})

describe('auftrittFehlerText — welcher Abschnitt sperrt', () => {
  const fehler = (eingabe: unknown) => {
    const ergebnis = appearanceSchema.safeParse(eingabe)
    if (ergebnis.success) throw new Error('Das Schema hätte ablehnen sollen')
    return auftrittFehlerText(ergebnis.error.issues)
  }

  it('ein zu langer Altwert in „Über uns" sperrt auch das Speichern des Leitspruchs — die Meldung nennt „Über uns"', () => {
    const eingabe = auftrittMitTeil({ ...STAND, aboutText: 'x'.repeat(1001) }, { tagline: 'Neuer Leitspruch' })
    expect(fehler(eingabe)).toBe('„Über uns“: Der Text darf höchstens 1000 Zeichen haben — bitte kürzen. Erst danach lässt sich speichern.')
  })

  it('ein zu langer Untertitel eines Werts: „Werte"', () => {
    const eingabe = auftrittBasis({ ...STAND, farmValues: [{ icon: 'bio', title: 'Bio-zertifiziert', subtitle: 'x'.repeat(101) }] })
    expect(fehler(eingabe)).toMatch(/^„Werte“: Die Beschreibung darf höchstens 100 Zeichen haben — bitte kürzen\./)
  })

  it('ein Satz von Zod (englisch) kommt nie hinaus — dafür ein fester Satz, der Abschnitt bleibt genannt', () => {
    const eingabe = auftrittBasis({ ...STAND, farmValues: [{ icon: 'bio', title: 'x'.repeat(51), subtitle: null }] })
    const text = fehler(eingabe)
    expect(text).toMatch(/^„Werte“: Dort steht etwas, das wir so nicht speichern können/)
    expect(text).not.toMatch(/[Tt]oo big|expected|characters/)
  })

  it('ohne zuordenbaren Abschnitt: der allgemeine Satz mit Ausweg', () => {
    expect(auftrittFehlerText([{ path: ['unbekannt'], message: 'Too big' }])).toBe(ABSCHNITT_SPEICHERN_TEXT.ungueltig)
    expect(auftrittFehlerText([])).toBe(ABSCHNITT_SPEICHERN_TEXT.ungueltig)
  })
})
