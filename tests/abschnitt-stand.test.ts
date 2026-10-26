/**
 * Was ein Abschnitt von „Mein Hof" an die bestehenden Aktionen schickt
 * (src/lib/abschnitt-stand.ts, Nachtlauf Nr. 50, seit Nr. 65 nur der Teil).
 *
 * saveAppearanceAction schreibt seit Nr. 65 nur, was mitkommt (Register N4,
 * Ergänzung); updateProfile schreibt weiter das ganze Profil. Ein Abschnitt
 * des Auftritts schickt deshalb nur seinen Teil, ein Abschnitt des Profils
 * den Rest aus dem frischen Stand.
 *
 * Beweist (rein, ohne Datenbank):
 *  - bereiteAuftrittVor schickt nur die Schlüssel des Abschnitts: undefined
 *    heißt „nicht meins" und fehlt in der Anfrage, null heißt „leeren"; Werte
 *    in ihrer Reihenfolge (sortOrder = Platz); nie Logo oder Titelbild; das
 *    Schema der Aktion fügt nichts hinzu (kein Standard für fehlende Felder).
 *  - profilBasis und profilMitTeil: frischer Stand plus Teil für das Profil.
 *  - bereiteAdresseVor (Nr. 65): das Adress-Formular schickt die Adresse als
 *    Ganzes — Land und Kartenpunkt vom Laden; brauchtKartenpruefung sagt, wann
 *    der Hinweis „Standort auf der Karte prüfen" steht.
 *  - auftrittFehlerText nennt den Abschnitt, der das Speichern sperrt — mit
 *    dem Satz des Schemas, nie mit einem englischen Satz von Zod.
 *  - geaendertSeitLaden (Hof-Profil, Nr. 50 Runde 1) nimmt nur, was seit dem
 *    Laden geändert wurde — Text, Zahl, null; unverändert fehlt der Schlüssel.
 *    Die Adresse (Straße, PLZ, Ort, Land, Kartenpunkt) geht nur als Ganzes
 *    (Runde 2): Ist ein Teil geändert, gehen alle.
 *  - profilWieImSchema (Runde 2): der Maßstab dafür, Feld für Feld durch das
 *    Schema — scheitert ein Altwert, zählen E-Mail und Betriebsnummer
 *    trotzdem nicht als geändert.
 *  - Der Teil wird nicht verändert.
 */
import { describe, it, expect } from 'vitest'
import { appearanceSchema } from '@/schemas/auftritt'
import { profilBearbeitenSchema, profileSchema, type ProfileFormData } from '@/schemas/hofprofil'
import {
  ABSCHNITT_SPEICHERN_TEXT,
  auftrittFehlerText,
  bereiteAdresseVor,
  bereiteAuftrittVor,
  brauchtKartenpruefung,
  geaendertSeitLaden,
  KARTENPUNKT_TOLERANZ_GRAD,
  profilBasis,
  profilMitTeil,
  profilWieImSchema,
  type AuftrittTeil,
  type ProfilQuelle,
} from '@/lib/abschnitt-stand'

/** Ein Abschnitt, der alles setzt, was der Auftritt hat. */
const ALLES: Required<AuftrittTeil> = {
  tagline: 'Frisch vom Feld',
  foundedYear: 1950,
  aboutText: 'Seit drei Generationen.',
  sectionsConfig: [
    { key: 'products', visible: true, order: 1 },
    { key: 'gallery', visible: false, order: 2 },
  ],
  farmValues: [
    { icon: 'saisonal', title: 'Saisonal', subtitle: 'Was gerade wächst', sortOrder: 5 },
    { icon: 'regional', title: 'Regional', subtitle: null, sortOrder: 9 },
    { icon: 'handarbeit', title: 'Handarbeit', subtitle: '', sortOrder: 0 },
  ],
}

describe('bereiteAuftrittVor — nur der Teil des Abschnitts geht an die Aktion', () => {
  it('schickt nur die Schlüssel des Abschnitts — alles andere fehlt in der Anfrage', () => {
    expect(bereiteAuftrittVor({ aboutText: 'Neuer Text' })).toEqual({ aboutText: 'Neuer Text' })
    expect(Object.keys(bereiteAuftrittVor({ sectionsConfig: ALLES.sectionsConfig }))).toEqual(['sectionsConfig'])
  })

  it('undefined heißt „nicht meins" und fehlt, null heißt „leeren"', () => {
    const teil = bereiteAuftrittVor({ tagline: undefined, foundedYear: null })
    expect(teil).toEqual({ foundedYear: null })
    expect(teil).not.toHaveProperty('tagline')
  })

  it('Werte in ihrer Reihenfolge: sortOrder = Platz, ein leerer Untertitel wird null', () => {
    expect(bereiteAuftrittVor({ farmValues: ALLES.farmValues }).farmValues).toEqual([
      { icon: 'saisonal', title: 'Saisonal', subtitle: 'Was gerade wächst', sortOrder: 0 },
      { icon: 'regional', title: 'Regional', subtitle: null, sortOrder: 1 },
      { icon: 'handarbeit', title: 'Handarbeit', subtitle: null, sortOrder: 2 },
    ])
    // Eine leere Liste heißt „alle Werte entfernt" — sie geht mit.
    expect(bereiteAuftrittVor({ farmValues: [] })).toEqual({ farmValues: [] })
  })

  it('schickt nie Logo, Titelbild oder Verlauf — die haben eigene Aktionen', () => {
    expect(Object.keys(bereiteAuftrittVor(ALLES)).toSorted()).toEqual(['aboutText', 'farmValues', 'foundedYear', 'sectionsConfig', 'tagline'])
  })

  it('das Schema der Aktion nimmt den Teil, wie er ist — für fehlende Felder setzt es nichts ein', () => {
    expect(appearanceSchema.safeParse(bereiteAuftrittVor(ALLES)).success).toBe(true)
    // Ein Standard (etwa [] für die Abschnitte) schriebe ein Feld, das der Abschnitt nicht schickt.
    expect(appearanceSchema.parse(bereiteAuftrittVor({ tagline: 'Neu' }))).toEqual({ tagline: 'Neu' })
    expect(appearanceSchema.parse({})).toEqual({})
  })

  it('verändert den Teil nicht', () => {
    const vorher = structuredClone(ALLES)
    bereiteAuftrittVor(ALLES)
    expect(ALLES).toEqual(vorher)
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
    expect(profilMitTeil(PROFIL, { phone: '+43 664 0000000' })).toEqual({ ...profilBasis(PROFIL), phone: '+43 664 0000000' })
    expect(profilMitTeil(PROFIL, { name: undefined }).name).toBe('Hof Test')
  })
})

describe('bereiteAdresseVor — das Adress-Formular in Mein Hof schickt die Adresse als Ganzes (Nr. 65)', () => {
  const EINGABE = { address: 'Neue Gasse 2', postalCode: '4901', city: 'Musterau' }

  it('Land und Kartenpunkt vom Laden gehen mit, Straße, PLZ und Ort aus dem Formular', () => {
    expect(bereiteAdresseVor(PROFIL, EINGABE)).toEqual({ ...EINGABE, country: 'AT', latitude: 48.2, longitude: 13.4 })
  })

  it('ohne Kartenpunkt geht null mit; ein unbekanntes Land wird wie überall AT (alsLand)', () => {
    expect(bereiteAdresseVor({ ...PROFIL, latitude: null, longitude: null }, EINGABE)).toMatchObject({ latitude: null, longitude: null })
    expect(bereiteAdresseVor({ ...PROFIL, country: 'XX' }, EINGABE).country).toBe('AT')
  })

  it('auf den frischen Stand eines anderen Tabs: die Adresse dieses Formulars als Ganzes, nie gemischt', () => {
    const andererTab = { ...PROFIL, country: 'DE', latitude: 48.137, longitude: 11.575 }
    expect(profilMitTeil(andererTab, bereiteAdresseVor(PROFIL, EINGABE))).toMatchObject({ ...EINGABE, country: 'AT', latitude: 48.2, longitude: 13.4 })
    // Gegenprobe: Nur Straße, PLZ und Ort (bis Nr. 65) mischten Land und Punkt des anderen Tabs hinein.
    expect(profilMitTeil(andererTab, EINGABE)).toMatchObject({ ...EINGABE, country: 'DE', latitude: 48.137, longitude: 11.575 })
  })
})

describe('brauchtKartenpruefung — der Hinweis „Standort auf der Karte prüfen" nach geänderter Straße', () => {
  it('eine andere Straße bei gesetztem Punkt: ja; Ränder zählen nicht', () => {
    expect(brauchtKartenpruefung(PROFIL, 'Neue Gasse 2')).toBe(true)
    expect(brauchtKartenpruefung(PROFIL, '  Musterweg 1 ')).toBe(false)
    expect(brauchtKartenpruefung(PROFIL, 'Musterweg 1')).toBe(false)
  })

  it('ohne Punkt nicht (dort steht „setzen"), und nicht bei leerem Feld (dort kommt beim Speichern „Pflichtfeld")', () => {
    expect(brauchtKartenpruefung({ ...PROFIL, latitude: null }, 'Neue Gasse 2')).toBe(false)
    expect(brauchtKartenpruefung({ ...PROFIL, longitude: null }, 'Neue Gasse 2')).toBe(false)
    expect(brauchtKartenpruefung(PROFIL, '   ')).toBe(false)
  })
})

describe('geaendertSeitLaden (Hof-Profil)', () => {
  const ANFANG = profilBasis(PROFIL)

  it('nur, was seit dem Laden geändert wurde — auch null', () => {
    const jetzt = { ...ANFANG, phone: '+43 676 0000000', betriebsnummer: null }
    expect(geaendertSeitLaden(ANFANG, jetzt)).toEqual({ phone: '+43 676 0000000', betriebsnummer: null })
  })

  const GANZE_ADRESSE = { address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf', country: 'AT', latitude: 48.2, longitude: 13.4 }

  it('ein Teil der Adresse geändert: die ganze Adresse geht — Straße, PLZ, Ort, Land und Kartenpunkt', () => {
    expect(geaendertSeitLaden(ANFANG, { ...ANFANG, city: 'Neustadt' })).toEqual({ ...GANZE_ADRESSE, city: 'Neustadt' })
  })

  it('nur der Kartenpunkt verschoben (eine Zahl): die Adresse geht mit', () => {
    expect(geaendertSeitLaden(ANFANG, { ...ANFANG, latitude: 48.25 })).toEqual({ ...GANZE_ADRESSE, latitude: 48.25 })
  })

  it('Kartenpunkt typisch gewackelt (Größenwechsel der Karte, unter der Toleranz): unverändert — die Adresse bleibt beim frischen Stand', () => {
    // Leaflet rechnet die Mitte nach invalidateSize aus gerundeten Pixeln neu (Nachprüfung Runde 2).
    const gewackelt = { ...ANFANG, latitude: 48.2 + 3e-6, longitude: 13.4 - 4e-6, phone: '+43 676 0000000' }
    expect(geaendertSeitLaden(ANFANG, gewackelt)).toEqual({ phone: '+43 676 0000000' })
    expect(KARTENPUNKT_TOLERANZ_GRAD).toBe(1e-5)
  })

  it('Gegenprobe: ab einem Meter gilt der Punkt als bewegt, und von null auf einen Punkt immer', () => {
    expect(geaendertSeitLaden(ANFANG, { ...ANFANG, longitude: 13.4 + 2e-5 })).toEqual({ ...GANZE_ADRESSE, longitude: 13.4 + 2e-5 })
    const ohnePunkt = { ...ANFANG, latitude: null, longitude: null }
    expect(geaendertSeitLaden(ohnePunkt, ANFANG)).toEqual(GANZE_ADRESSE)
  })

  it('Kontakt und Adresse zugleich: beides, die Adresse ganz', () => {
    const jetzt = { ...ANFANG, phone: '+43 676 0000000', postalCode: '4901' }
    expect(geaendertSeitLaden(ANFANG, jetzt)).toEqual({ ...GANZE_ADRESSE, postalCode: '4901', phone: '+43 676 0000000' })
  })

  it('keine Mischadresse: der frische Stand eines anderen Tabs mischt sich nicht in die Adresse', () => {
    // Ein anderer Tab hat inzwischen eine ganz neue Adresse gespeichert; dieser Tab ändert nur den Ort.
    const frisch = { ...PROFIL, address: 'Neue Gasse 2', postalCode: '8701', city: 'Neustadt', latitude: 47.1, longitude: 15.3 }
    const teil = geaendertSeitLaden(ANFANG, { ...ANFANG, city: 'Musterau' })
    expect(profilMitTeil(frisch, teil)).toMatchObject({ ...GANZE_ADRESSE, city: 'Musterau' })
    // Gegenprobe: Feld für Feld gemischt stünde die Straße des anderen Tabs neben dem Ort dieses.
    expect(profilMitTeil(frisch, { city: 'Musterau' })).toMatchObject({ address: 'Neue Gasse 2', postalCode: '8701', city: 'Musterau' })
  })

  it('auf den Stand vom Laden zurückgesetzt: gilt als unverändert — dann gewinnt der frische Wert des anderen Tabs', () => {
    // Hier erst geändert, dann wieder auf „Musterdorf" gesetzt; ein anderer Tab hat inzwischen den Ort gespeichert.
    const frisch = { ...PROFIL, city: 'Neustadt' }
    const teil = geaendertSeitLaden(ANFANG, { ...ANFANG, city: 'Musterdorf' })
    expect(teil).toEqual({})
    expect(profilMitTeil(frisch, teil).city).toBe('Neustadt')
  })

  it('nichts geändert: leer — dann schreibt das Speichern den frischen Stand unverändert', () => {
    expect(geaendertSeitLaden(ANFANG, { ...ANFANG })).toEqual({})
  })

  it('zusammen mit profilMitTeil: der frische Stand plus genau diese Änderung', () => {
    // Inzwischen hat Mein Hof den Namen geändert; der ältere Tab ändert nur das Telefon.
    const frisch = { ...PROFIL, name: 'Hof Neuname' }
    const teil = geaendertSeitLaden(ANFANG, { ...ANFANG, phone: '+43 676 0000000' })
    expect(profilMitTeil(frisch, teil)).toEqual({ ...profilBasis(frisch), phone: '+43 676 0000000' })
    // Gegenprobe: das ganze Formular vom Laden schriebe den alten Namen zurück.
    expect(profilMitTeil(frisch, { ...ANFANG, phone: '+43 676 0000000' }).name).toBe('Hof Test')
  })
})

describe('profilWieImSchema — der Stand beim Laden, Feld für Feld durch das Schema (Hof-Profil)', () => {
  // So baut profile-form.tsx seine Startwerte und sein Schema — ohne profilBasis.
  const GELADEN: ProfileFormData = {
    name: 'Hof Test',
    ownerName: 'Max Mustermann',
    description: 'Gemüse und Eier aus Musterdorf',
    address: 'Musterweg 1',
    postalCode: '4900',
    city: 'Musterdorf',
    phone: '+43 660 0000000',
    email: '  Hof@Example.com ',
    country: 'AT',
    latitude: 48.2,
    longitude: 13.4,
    betriebsnummer: '  ',
    betriebsstatus: null,
  }
  const schemaFuer = (werte: ProfileFormData) => profilBearbeitenSchema({ name: werte.name, ownerName: werte.ownerName, phone: werte.phone })

  it('alles gültig: dasselbe wie das ganze Schema — Ränder weg, E-Mail klein, leere Betriebsnummer null', () => {
    const schema = schemaFuer(GELADEN)
    expect(profilWieImSchema(schema, GELADEN)).toEqual(schema.parse(GELADEN))
    expect(profilWieImSchema(schema, GELADEN)).toMatchObject({ email: 'hof@example.com', betriebsnummer: null })
  })

  it('ein Altwert scheitert am Schema: nur er bleibt, wie geladen — E-Mail und Betriebsnummer zählen nicht als geändert', () => {
    // Seit Nr. 174 ist die Beschreibung freiwillig; ein zu kurzer Altwert bleibt der Name der Inhaberin.
    const geladen = { ...GELADEN, ownerName: 'M' }
    const schema = schemaFuer(geladen)
    // Voraussetzung: Als Ganzes hält der Stand das Schema nicht ein.
    expect(schema.safeParse(geladen).success).toBe(false)

    const anfang = profilWieImSchema(schema, geladen)
    expect(anfang).toEqual({ ...geladen, email: 'hof@example.com', betriebsnummer: null })

    // Der Bauer korrigiert nur den Namen; zodResolver gibt die Ausgabe des Schemas weiter.
    const gespeichert = schema.parse({ ...geladen, ownerName: 'Maria Muster' })
    expect(geaendertSeitLaden(anfang, gespeichert)).toEqual({ ownerName: 'Maria Muster' })
    // Gegenprobe: Mit dem ungeprüften Stand zählten E-Mail und Betriebsnummer als geändert.
    expect(geaendertSeitLaden(geladen, gespeichert)).toEqual({
      ownerName: 'Maria Muster',
      email: 'hof@example.com',
      betriebsnummer: null,
    })
  })

  it('eine Betriebsnummer mit Rändern wird getrimmt, nicht verworfen', () => {
    const geladen = { ...GELADEN, betriebsnummer: ' LFBIS 0000000 ' }
    expect(profilWieImSchema(schemaFuer(geladen), geladen).betriebsnummer).toBe('LFBIS 0000000')
  })
})

describe('auftrittFehlerText — welcher Abschnitt sperrt', () => {
  const fehler = (eingabe: unknown) => {
    const ergebnis = appearanceSchema.safeParse(eingabe)
    if (ergebnis.success) throw new Error('Das Schema hätte ablehnen sollen')
    return auftrittFehlerText(ergebnis.error.issues)
  }

  it('ein zu langer Text in „Über uns": die Meldung nennt „Über uns"', () => {
    const eingabe = bereiteAuftrittVor({ aboutText: 'x'.repeat(1001) })
    expect(fehler(eingabe)).toBe('„Über uns“: Der Text darf höchstens 1000 Zeichen haben — bitte kürzen. Erst danach lässt sich speichern.')
  })

  it('ein zu langer Untertitel eines Werts: „Werte"', () => {
    const eingabe = bereiteAuftrittVor({ farmValues: [{ icon: 'bio', title: 'Bio-zertifiziert', subtitle: 'x'.repeat(101), sortOrder: 0 }] })
    expect(fehler(eingabe)).toMatch(/^„Werte“: Die Beschreibung darf höchstens 100 Zeichen haben — bitte kürzen\./)
  })

  it('ein Satz von Zod (englisch) kommt nie hinaus — dafür ein fester Satz, der Abschnitt bleibt genannt', () => {
    const eingabe = bereiteAuftrittVor({ farmValues: [{ icon: 'bio', title: 'x'.repeat(51), subtitle: null, sortOrder: 0 }] })
    const text = fehler(eingabe)
    expect(text).toBe(`„Werte“: ${ABSCHNITT_SPEICHERN_TEXT.unspeicherbar} Erst danach lässt sich speichern.`)
    expect(ABSCHNITT_SPEICHERN_TEXT.unspeicherbar).toBe('Dort steht etwas, das wir so nicht speichern können — bitte prüf es.')
    expect(text).not.toMatch(/[Tt]oo big|expected|characters/)
  })

  it('ohne zuordenbaren Abschnitt: der allgemeine Satz mit Ausweg', () => {
    expect(auftrittFehlerText([{ path: ['unbekannt'], message: 'Too big' }])).toBe(ABSCHNITT_SPEICHERN_TEXT.ungueltig)
    expect(auftrittFehlerText([])).toBe(ABSCHNITT_SPEICHERN_TEXT.ungueltig)
  })
})
