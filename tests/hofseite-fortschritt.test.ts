/**
 * Tests für die Liste des Hofseiten-Editors (src/lib/hofseite-fortschritt.ts).
 *
 * Beweist:
 *  - Elf Zeilen in drei Gruppen, in fester Reihenfolge.
 *  - Jede Zeile weiß, ob sie fertig ist, und sagt ihren Wert in einem Satz.
 *  - Fortschritt „n von m", Prozent und der Satz zu den fehlenden Teilen.
 *  - Abholzeiten als „Fr 15–18 · Sa 9–12", Montag zuerst.
 *  - Pausiert ist ein Zustand mit eigenem Wort, kein Fehlen.
 *  - Jede Zeile hat ein Ziel in der Vorschau.
 */
import { describe, it, expect } from 'vitest'
import { hofseiteZeileIdSchema } from '@/schemas/hofseite-vorschau'
import {
  ZIEL_ABSCHNITT,
  abholzeitenKurz,
  hofseiteFortschritt,
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
}

const alleZeilen = (stand: HofseiteStand) => hofseiteFortschritt(stand).gruppen.flatMap((g) => g.zeilen)

describe('Aufbau', () => {
  it('drei Gruppen mit elf Zeilen in fester Reihenfolge', () => {
    const { gruppen } = hofseiteFortschritt(VOLL)
    expect(gruppen.map((g) => [g.titel, g.zeilen.map((z) => z.titel)])).toEqual([
      ['Auftritt', ['Titelbild', 'Logo', 'Name und Kurzbeschreibung', 'Über uns', 'Fotos']],
      ['Abholen und Bezahlen', ['Adresse und Standort', 'Abholzeiten', 'Zahlungsarten', 'Kontakt']],
      ['Sichtbarkeit', ['Bestellungen', 'Abschnitte der Hofseite']],
    ])
  })

  it('die Zeilen-Kennungen sind genau die der Nachricht an die Vorschau', () => {
    expect(alleZeilen(VOLL).map((z) => z.id)).toEqual(hofseiteZeileIdSchema.options)
  })

  it('jede Zeile hat ein Ziel in der Vorschau', () => {
    for (const id of hofseiteZeileIdSchema.options) expect(ZIEL_ABSCHNITT[id], id).toMatch(/^[a-z]+$/)
  })
})

describe('fertig oder fehlt', () => {
  it('ein vollständiger Hof: 11 von 11, 100 %, nichts fehlt', () => {
    const f = hofseiteFortschritt(VOLL)
    expect([f.erledigt, f.gesamt, f.prozent]).toEqual([11, 11, 100])
    expect(f.fehlend).toEqual([])
    expect(f.satz).toBe('Alles da — Kunden sehen deinen Hof vollständig.')
    for (const z of alleZeilen(VOLL)) expect(z.marke, z.id).toBeNull()
  })

  it('ohne Logo und Über uns: 9 von 11, 82 %, der Satz nennt beide', () => {
    const f = hofseiteFortschritt({ ...VOLL, logoUrl: null, aboutText: null })
    expect([f.erledigt, f.gesamt, f.prozent]).toEqual([9, 11, 82])
    expect(f.fehlend).toEqual(['Logo', 'Über uns'])
    expect(f.satz).toBe('Es fehlen noch: Logo und Über uns.')
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
    expect(alleZeilen({ ...VOLL, aboutText: ' \n ' }).find((z) => z.id === 'ueber-uns')!.wert).toBe('Noch kein Text')
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

  it('Zahlungsarten: online ist die Kür — ohne Stripe trotzdem fertig', () => {
    expect(alleZeilen(VOLL).find((z) => z.id === 'zahlung')!.wert).toBe('Online mit Karte · vor Ort bar und mit Karte')
    const bar = alleZeilen({ ...VOLL, stripeAccountReady: false }).find((z) => z.id === 'zahlung')!
    expect(bar.fertig).toBe(true)
    expect(bar.wert).toBe('Vor Ort bar und mit Karte · online noch nicht eingerichtet')
  })

  it('Kontakt: Telefon und E-Mail in der Zeile', () => {
    expect(alleZeilen(VOLL).find((z) => z.id === 'kontakt')!.wert).toBe('+43 660 0000000 · hof@example.com')
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

  it('kein Wert sagt „Shop": Der Hof hat eine Hofseite', () => {
    for (const z of alleZeilen({ ...VOLL, logoUrl: null, isPaused: true, stripeAccountReady: false })) {
      expect(`${z.titel} ${z.wert}`, z.id).not.toMatch(/shop/i)
    }
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
