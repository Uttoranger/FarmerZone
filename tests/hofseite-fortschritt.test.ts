/**
 * Tests für die Liste des Hofseiten-Editors (src/lib/hofseite-fortschritt.ts).
 *
 * Beweist:
 *  - Dreizehn Zeilen in drei Gruppen, in fester Reihenfolge; elf davon zählen,
 *    Leitspruch/Gründungsjahr und Werte sind freiwillig (Nr. 50).
 *  - Jede Zeile weiß, ob sie fertig ist, und sagt ihren Wert in einem Satz.
 *  - Fortschritt „n von m", Prozent und der Satz zu den fehlenden Teilen.
 *  - Abholzeiten als „Fr 15–18 · Sa 9–12", Montag zuerst.
 *  - Pausiert ist ein Zustand mit eigenem Wort, kein Fehlen.
 *  - Jede Zeile hat ein Ziel in der Vorschau und eins für die Einstellungen.
 *  - Unter lg stehen die Zeilen in der Reihenfolge der Hofseite (Nr. 50).
 */
import { describe, it, expect } from 'vitest'
import { hofseiteZeileIdSchema } from '@/schemas/hofseite-vorschau'
import {
  EINSTELLUNG_FUER_ZEILE,
  HOFSEITE_REIHENFOLGE,
  ZIEL_ABSCHNITT,
  abholzeitenKurz,
  hofseiteFortschritt,
  hofseiteStand,
  zeilenWieAufDerHofseite,
  type HofseiteStand,
} from '@/lib/hofseite-fortschritt'

const VOLL: HofseiteStand = {
  name: 'Hof Test',
  description: 'Gemüse und Eier aus Musterdorf',
  aboutText: 'Seit drei Generationen bauen wir Gemüse an.\nAlles aus eigener Hand.',
  logoUrl: 'https://bilder.example/logo.webp',
  bannerType: 'PHOTO',
  bannerUrl: 'https://bilder.example/titel.jpg',
  fotos: 3,
  address: 'Musterweg 1',
  postalCode: '4900',
  city: 'Musterdorf',
  hatKoordinaten: true,
  abholzeiten: [
    { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 5, startTime: '15:00', endTime: '18:00' },
  ],
  acceptsOnline: true,
  stripeAccountReady: true,
  phone: '+43 660 0000000',
  email: 'hof@example.com',
  isPaused: false,
  sektionen: [
    { key: 'status', visible: true, order: 1 },
    { key: 'about', visible: true, order: 2 },
    { key: 'values', visible: false, order: 3 },
    { key: 'gallery', visible: true, order: 4 },
    { key: 'products', visible: true, order: 5 },
  ],
  tagline: 'Frisch vom Feld',
  foundedYear: 1987,
  werte: ['Regional', 'Saisonal'],
}

const alleZeilen = (stand: HofseiteStand) => hofseiteFortschritt(stand).gruppen.flatMap((g) => g.zeilen)

describe('Aufbau', () => {
  it('drei Gruppen mit dreizehn Zeilen in fester Reihenfolge — Leitspruch und Werte stehen im Auftritt (Nr. 50)', () => {
    const { gruppen } = hofseiteFortschritt(VOLL)
    expect(gruppen.map((g) => [g.titel, g.zeilen.map((z) => z.titel)])).toEqual([
      [
        'Auftritt',
        ['Titelbild', 'Logo', 'Name und Kurzbeschreibung', 'Leitspruch und Gründungsjahr', 'Über uns', 'Werte', 'Fotos'],
      ],
      ['Abholen und Bezahlen', ['Adresse und Standort', 'Abholzeiten', 'Zahlungsarten', 'Kontakt']],
      ['Sichtbarkeit', ['Bestellungen', 'Abschnitte der Hofseite']],
    ])
  })

  it('freiwillig sind genau Leitspruch/Gründungsjahr und Werte', () => {
    expect(alleZeilen(VOLL).filter((z) => z.freiwillig).map((z) => z.id)).toEqual(['tagline', 'werte'])
  })

  it('die Zeilen-Kennungen sind genau die der Nachricht an die Vorschau — außer `aktuell`', () => {
    // „Aktuell vom Hof“ markiert nur (Nr. 129, Runde 2): eine Zeile mit Link, kein Teil des Fortschritts.
    expect(alleZeilen(VOLL).map((z) => z.id)).toEqual(hofseiteZeileIdSchema.options.filter((id) => id !== 'aktuell'))
    expect(hofseiteZeileIdSchema.options).toContain('aktuell')
  })

  it('jede Zeile hat ein Ziel in der Vorschau', () => {
    for (const id of hofseiteZeileIdSchema.options) expect(ZIEL_ABSCHNITT[id], id).toMatch(/^[a-z]+$/)
  })

  it('Leitspruch springt zum Titelbild; Über uns und Werte zur Karte „Über uns" (Nr. 50)', () => {
    expect(ZIEL_ABSCHNITT.tagline).toBe('titelbild')
    expect(ZIEL_ABSCHNITT['ueber-uns']).toBe('ueberuns')
    expect(ZIEL_ABSCHNITT.werte).toBe('ueberuns')
  })
})

describe('Ziel in den Einstellungen (Nr. 50: Mein Auftritt zieht in Mein Hof)', () => {
  it('alles aus dem früheren „Mein Auftritt" führt nach Mein Hof, der Rest in seine Einstellungsseite', () => {
    const meinHof = hofseiteZeileIdSchema.options.filter((id) => EINSTELLUNG_FUER_ZEILE[id] === '/farm-page')
    expect(meinHof).toEqual(['titelbild', 'logo', 'tagline', 'ueber-uns', 'werte', 'fotos', 'abschnitte'])
    expect(EINSTELLUNG_FUER_ZEILE.name).toBe('/settings/profile')
    expect(EINSTELLUNG_FUER_ZEILE.abholzeiten).toBe('/settings/pickup-slots')
    for (const ziel of Object.values(EINSTELLUNG_FUER_ZEILE)) expect(ziel).not.toBe('/settings/appearance')
  })
})

describe('Reihenfolge der Hofseite (Liste „Bearbeiten" unter lg, Nr. 50)', () => {
  // Die Abschnitte der Hofseite am Handy von oben nach unten (Übersicht mit
  // Produkten): Titelbild mit Name und Adresse, Pausen-Hinweis, Reiter, das
  // Schaufenster mit dem Fotostreifen (N5, Nr. 51), dann die Seitenspalte
  // (Abholung, Zahlung & Kontakt) und Über uns — hofseite-kunde.tsx.
  const AUF_DER_SEITE = ['titelbild', 'bestellungen', 'abschnitte', 'fotos', 'abholung', 'kontakt', 'ueberuns']

  it('jede Zeile genau einmal', () => {
    // Ohne `aktuell` (Nr. 129): Die Zeile steht in Liste und Editor als eigene erste Zeile, nicht im Fortschritt.
    expect(HOFSEITE_REIHENFOLGE.toSorted()).toEqual(hofseiteZeileIdSchema.options.filter((id) => id !== 'aktuell').toSorted())
  })

  it('in der Reihenfolge, in der die Abschnitte auf der Hofseite stehen', () => {
    const lage = HOFSEITE_REIHENFOLGE.map((id) => AUF_DER_SEITE.indexOf(ZIEL_ABSCHNITT[id]))
    expect(lage.every((l) => l >= 0)).toBe(true)
    expect(lage).toEqual(lage.toSorted((a, b) => a - b))
    expect(HOFSEITE_REIHENFOLGE).toEqual([
      'titelbild',
      'logo',
      'name',
      'tagline',
      'adresse',
      'bestellungen',
      'abschnitte',
      'fotos',
      'abholzeiten',
      'zahlung',
      'kontakt',
      'ueber-uns',
      'werte',
    ])
  })

  it('zeilenWieAufDerHofseite gibt die Zeilen des Fortschritts in dieser Reihenfolge zurück', () => {
    const zeilen = zeilenWieAufDerHofseite(hofseiteFortschritt(VOLL))
    expect(zeilen.map((z) => z.id)).toEqual(HOFSEITE_REIHENFOLGE)
    expect(zeilen.find((z) => z.id === 'werte')?.wert).toBe('Regional · Saisonal')
  })
})

describe('fertig oder fehlt', () => {
  it('ein vollständiger Hof: 11 von 11, 100 %, nichts fehlt — auch die freiwilligen Zeilen ohne Schild', () => {
    const f = hofseiteFortschritt(VOLL)
    expect([f.erledigt, f.gesamt, f.prozent]).toEqual([11, 11, 100])
    expect(f.fehlend).toEqual([])
    expect(f.satz).toBe('Alles da — Kunden sehen deinen Hof vollständig.')
    for (const z of alleZeilen(VOLL)) expect(z.marke, z.id).toBeNull()
  })

  it('ohne Logo und ganz ohne Text für „Über uns": 8 von 11, 73 %, der Satz nennt alle drei', () => {
    // Ohne eigenen Text zeigt die Hofseite die Kurzbeschreibung (Nr. 49) — erst ohne beide fehlt „Über uns".
    const f = hofseiteFortschritt({ ...VOLL, logoUrl: null, aboutText: null, description: '' })
    expect([f.erledigt, f.gesamt, f.prozent]).toEqual([8, 11, 73])
    expect(f.fehlend).toEqual(['Logo', 'Name und Kurzbeschreibung', 'Über uns'])
    expect(f.satz).toBe('Es fehlen noch: Logo, Name und Kurzbeschreibung und Über uns.')
    const logo = alleZeilen({ ...VOLL, logoUrl: null }).find((z) => z.id === 'logo')!
    expect(logo.fertig).toBe(false)
    expect(logo.marke).toEqual({ text: 'Fehlt', farbe: 'bernstein' })
  })

  it('eine fehlende Zeile: „Es fehlt noch: …"; drei: mit Komma und „und"', () => {
    expect(hofseiteFortschritt({ ...VOLL, fotos: 0 }).satz).toBe('Es fehlt noch: Fotos.')
    expect(hofseiteFortschritt({ ...VOLL, fotos: 0, logoUrl: '', hatKoordinaten: false }).satz).toBe(
      'Es fehlen noch: Logo, Fotos und Adresse und Standort.'
    )
  })

  it('Titelbild: nur ein Foto zählt, ein Verlauf fehlt — auch mit alter URL daneben', () => {
    const verlauf = alleZeilen({ ...VOLL, bannerType: 'GRADIENT' }).find((z) => z.id === 'titelbild')!
    expect(verlauf.fertig).toBe(false)
    expect(verlauf.wert).toContain('Farbverlauf')
    expect(alleZeilen(VOLL).find((z) => z.id === 'titelbild')!.wert).toBe('Foto gesetzt · Ausschnitt anpassbar')
  })

  it('Name und Kurzbeschreibung: fehlt ohne Beschreibung, sonst „Name · Beschreibung"', () => {
    expect(alleZeilen(VOLL).find((z) => z.id === 'name')!.wert).toBe('Hof Test · Gemüse und Eier aus Musterdorf')
    const ohne = alleZeilen({ ...VOLL, description: '  ' }).find((z) => z.id === 'name')!
    expect(ohne.fertig).toBe(false)
    expect(ohne.wert).toBe('Hof Test — Kurzbeschreibung fehlt')
  })

  it('Über uns: der Text in einer Zeile, ohne Umbruch', () => {
    expect(alleZeilen(VOLL).find((z) => z.id === 'ueber-uns')!.wert).toBe(
      'Seit drei Generationen bauen wir Gemüse an. Alles aus eigener Hand.'
    )
    expect(alleZeilen({ ...VOLL, aboutText: ' \n ', description: '' }).find((z) => z.id === 'ueber-uns')!.wert).toBe('Noch kein Text')
  })

  it('Über uns (Nr. 49): ohne eigenen Text zählt die Kurzbeschreibung — wie auf der Hofseite', () => {
    for (const aboutText of [null, '', '  \n ']) {
      const zeile = alleZeilen({ ...VOLL, aboutText }).find((z) => z.id === 'ueber-uns')!
      expect(zeile.fertig, String(aboutText)).toBe(true)
      expect(zeile.marke).toBeNull()
      expect(zeile.wert).toBe('Gemüse und Eier aus Musterdorf')
    }
    // Ohne beides fehlt „Über uns" wie bisher.
    const leer = alleZeilen({ ...VOLL, aboutText: null, description: '  ' }).find((z) => z.id === 'ueber-uns')!
    expect(leer.fertig).toBe(false)
    expect(leer.marke).toEqual({ text: 'Fehlt', farbe: 'bernstein' })
  })

  it('Folge für den Prozentwert (Heute, Einrichten, Einstellungen, Mein Hof): ein Punkt mehr, sobald es eine Kurzbeschreibung gibt', () => {
    // Ein Hof wie die Seed-Höfe: Verlauf, kein Logo, keine Fotos, kein Über-uns-Text, aber eine Kurzbeschreibung.
    const neu = { ...VOLL, bannerType: 'GRADIENT', logoUrl: null, fotos: 0, aboutText: null, acceptsOnline: false, stripeAccountReady: false }
    // Vor Nr. 49 zählte „Über uns" nur den eigenen Text — derselbe Hof stand bei 7 von 11 (64 %).
    expect(hofseiteFortschritt(neu)).toMatchObject({ erledigt: 8, gesamt: 11, prozent: 73 })
    // Ohne Kurzbeschreibung fehlen „Name und Kurzbeschreibung" und „Über uns": 6 von 11.
    expect(hofseiteFortschritt({ ...neu, description: '' })).toMatchObject({ erledigt: 6, prozent: 55 })
  })

  it('Fotos: Einzahl, Mehrzahl, keine', () => {
    const wert = (fotos: number) => alleZeilen({ ...VOLL, fotos }).find((z) => z.id === 'fotos')!.wert
    expect([wert(0), wert(1), wert(3)]).toEqual(['Noch keine Fotos', '1 Foto', '3 Fotos'])
  })

  it('Adresse: fertig erst mit Kartenpunkt', () => {
    expect(alleZeilen(VOLL).find((z) => z.id === 'adresse')!.wert).toBe('Musterweg 1, 4900 Musterdorf · auf der Karte gesetzt')
    const ohne = alleZeilen({ ...VOLL, hatKoordinaten: false }).find((z) => z.id === 'adresse')!
    expect(ohne.fertig).toBe(false)
    expect(ohne.wert).toBe('Musterweg 1, 4900 Musterdorf · Standort auf der Karte fehlt')
  })

  it('Abholzeiten: fehlt ohne aktive Fenster', () => {
    expect(alleZeilen(VOLL).find((z) => z.id === 'abholzeiten')!.wert).toBe('Fr 15–18 · Sa 9–12')
    const ohne = alleZeilen({ ...VOLL, abholzeiten: [] }).find((z) => z.id === 'abholzeiten')!
    expect(ohne.fertig).toBe(false)
  })

  it('Zahlungsarten: online ist die Kür — ohne Stripe trotzdem fertig, aber mit dem Warnschild „Online fehlt"', () => {
    const zahlung = (stand: Parameters<typeof alleZeilen>[0]) => {
      const zeile = alleZeilen(stand).find((z) => z.id === 'zahlung')
      if (!zeile) throw new Error('Zeile „zahlung" fehlt')
      return zeile
    }
    const online = zahlung(VOLL)
    expect(online.wert).toBe('Online mit Karte · vor Ort bar und mit Karte')
    expect(online.marke).toBeNull()
    const bar = zahlung({ ...VOLL, stripeAccountReady: false })
    expect(bar.fertig).toBe(true)
    expect(bar.wert).toBe('Vor Ort bar und mit Karte · Online-Zahlung noch nicht eingerichtet')
    expect(bar.marke).toEqual({ text: 'Online fehlt', farbe: 'bernstein' })
    // Das Schild ist eine Warnung, kein Fehlen: Fortschritt und Satz zählen es nicht.
    const ohneOnline = hofseiteFortschritt({ ...VOLL, stripeAccountReady: false })
    expect(ohneOnline.fehlend).not.toContain('Zahlungsarten')
    expect(ohneOnline.erledigt).toBe(hofseiteFortschritt(VOLL).erledigt)
  })

  it('Kontakt: Telefon und E-Mail in der Zeile', () => {
    // Die Nummer einheitlich wie überall (formatiereTelefon, Register N8)
    expect(alleZeilen(VOLL).find((z) => z.id === 'kontakt')!.wert).toBe('+43 660 000 0000 · hof@example.com')
    expect(alleZeilen({ ...VOLL, phone: '' }).find((z) => z.id === 'kontakt')!.fertig).toBe(false)
  })

  it('Bestellungen: pausiert ist fertig, trägt aber „Pausiert"', () => {
    const p = alleZeilen({ ...VOLL, isPaused: true }).find((z) => z.id === 'bestellungen')!
    expect(p.fertig).toBe(true)
    expect(p.marke).toEqual({ text: 'Pausiert', farbe: 'bernstein' })
    expect(hofseiteFortschritt({ ...VOLL, isPaused: true }).erledigt).toBe(11)
    expect(alleZeilen(VOLL).find((z) => z.id === 'bestellungen')!.wert).toBe('Nimmt Bestellungen an — pausieren möglich')
  })

  it('Abschnitte: nur die sichtbaren, in ihrer Reihenfolge, in den Worten des Hofs', () => {
    expect(alleZeilen(VOLL).find((z) => z.id === 'abschnitte')!.wert).toBe('Aktuelles · Über uns · Fotos · Produkte')
    const gedreht = alleZeilen({
      ...VOLL,
      sektionen: [
        { key: 'products', visible: true, order: 1 },
        { key: 'status', visible: true, order: 2 },
      ],
    }).find((z) => z.id === 'abschnitte')!
    expect(gedreht.wert).toBe('Produkte · Aktuelles')
  })

  it('Leitspruch und Gründungsjahr (Nr. 50): beide, nur einer, keiner', () => {
    const zeile = (stand: Partial<HofseiteStand>) => alleZeilen({ ...VOLL, ...stand }).find((z) => z.id === 'tagline')!
    expect(zeile({}).wert).toBe('„Frisch vom Feld“ · seit 1987')
    expect(zeile({ foundedYear: null }).wert).toBe('„Frisch vom Feld“')
    expect(zeile({ tagline: '  ', foundedYear: 1987 }).wert).toBe('Seit 1987 · noch kein Leitspruch')
    const leer = zeile({ tagline: null, foundedYear: null })
    expect(leer.wert).toBe('Freiwillig — ein kurzer Satz unter deinem Hofnamen und seit wann es den Hof gibt')
    // Fertig mit dem Leitspruch; das Jahr ist ein Zusatz.
    expect([zeile({}).fertig, zeile({ foundedYear: null }).fertig, zeile({ tagline: '', foundedYear: 1987 }).fertig]).toEqual([true, true, false])
    // Ein Leitspruch mit Umbruch steht in einer Zeile.
    expect(zeile({ tagline: 'Frisch\nvom Feld', foundedYear: null }).wert).toBe('„Frisch vom Feld“')
  })

  it('Werte (Nr. 50): die Titel in ihrer Reihenfolge, ohne Werte ein Hinweis', () => {
    const zeile = (werte: string[]) => alleZeilen({ ...VOLL, werte }).find((z) => z.id === 'werte')!
    expect(zeile(['Saisonal', 'Regional', 'Handarbeit']).wert).toBe('Saisonal · Regional · Handarbeit')
    expect(zeile([]).wert).toBe('Freiwillig — bis zu 4, etwa Regional oder Saisonal')
    expect(zeile([]).fertig).toBe(false)
    expect(zeile(['Bio-zertifiziert']).fertig).toBe(true)
  })

  it('freiwillige Zeilen: ohne Inhalt ein graues „Fehlt" — sie zählen weder zum Fortschritt noch in den Satz', () => {
    const ohne = { ...VOLL, tagline: null, foundedYear: null, werte: [] }
    for (const id of ['tagline', 'werte']) {
      const zeile = alleZeilen(ohne).find((z) => z.id === id)!
      expect(zeile.marke, id).toEqual({ text: 'Fehlt', farbe: 'grau' })
    }
    const f = hofseiteFortschritt(ohne)
    expect([f.erledigt, f.gesamt, f.prozent]).toEqual([11, 11, 100])
    expect(f.fehlend).toEqual([])
    expect(f.satz).toBe('Alles da — Kunden sehen deinen Hof vollständig.')
  })

  it('kein Wert sagt „Shop": Der Hof hat eine Hofseite', () => {
    for (const z of alleZeilen({ ...VOLL, logoUrl: null, isPaused: true, stripeAccountReady: false })) {
      expect(`${z.titel} ${z.wert}`, z.id).not.toMatch(/shop/i)
    }
  })
})

describe('hofseiteStand (Nr. 50)', () => {
  const HOF = {
    name: 'Hof Test',
    description: 'Gemüse',
    aboutText: null,
    logoUrl: null,
    bannerType: 'GRADIENT',
    bannerUrl: null,
    farmPhotos: [],
    address: 'Musterweg 1',
    postalCode: '4900',
    city: 'Musterdorf',
    pickupSlots: [],
    acceptsOnline: false,
    stripeAccountReady: false,
    phone: '+43 660 0000000',
    email: 'hof@example.com',
    isPaused: false,
    sectionsConfig: [],
  }

  it('nimmt Leitspruch, Gründungsjahr und die Titel der Werte in ihrer Reihenfolge', () => {
    const stand = hofseiteStand(
      { ...HOF, tagline: 'Frisch', foundedYear: 1950, farmValues: [{ title: 'Saisonal' }, { title: 'Regional' }] },
      { latitude: null, longitude: null }
    )
    expect(stand).toMatchObject({ tagline: 'Frisch', foundedYear: 1950, werte: ['Saisonal', 'Regional'] })
  })

  it('ohne diese Felder (Heute lädt sie nicht): leer — und der Fortschritt bleibt derselbe', () => {
    const ohne = hofseiteStand(HOF, { latitude: null, longitude: null })
    expect(ohne).toMatchObject({ tagline: null, foundedYear: null, werte: [] })
    const mit = hofseiteStand({ ...HOF, tagline: 'Frisch', foundedYear: 1950, farmValues: [{ title: 'Bio-zertifiziert' }] }, { latitude: null, longitude: null })
    expect(hofseiteFortschritt(ohne)).toMatchObject({ erledigt: hofseiteFortschritt(mit).erledigt, gesamt: 11 })
  })
})

describe('abholzeitenKurz', () => {
  it('Montag zuerst, mehrere Fenster eines Tages mit Komma, Sonntag zuletzt', () => {
    expect(
      abholzeitenKurz([
        { dayOfWeek: 0, startTime: '10:00', endTime: '11:30' },
        { dayOfWeek: 1, startTime: '16:00', endTime: '18:00' },
        { dayOfWeek: 1, startTime: '08:00', endTime: '10:00' },
      ])
    ).toBe('Mo 8–10, 16–18 · So 10–11:30')
  })

  it('leer bleibt leer', () => {
    expect(abholzeitenKurz([])).toBe('')
  })
})
