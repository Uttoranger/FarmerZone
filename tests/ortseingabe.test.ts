/**
 * Die Ortseingabe auf /hoefe (Nr. 84, Mockup system-k1-ortssuche-zustaende):
 * was ein Text im Suchfeld ist (erkenneOrtseingabe), was davon an Nominatim
 * geht (sucheOrtspunkt) und wie die Treffer in der Auswahl heißen.
 *
 * Nominatim ist gemockt: Der Lader nimmt die Parameter entgegen und liefert
 * nachgestellte Antworten in der Gestalt von format=jsonv2 (lat/lon als
 * STRINGS, `address` mit country_code und state). Kein Netz.
 */
import { describe, it, expect } from 'vitest'
import { kandidatenBeschriftung, erkenneOrtseingabe, sucheOrtspunkt, type Ortseingabe } from '@/lib/geokodierung'

describe('erkenneOrtseingabe — was ist der Text im Suchfeld?', () => {
  const TABELLE: Array<[string, Ortseingabe]> = [
    // Vier Ziffern: österreichische Postleitzahl, fünf: deutsche.
    ['5230', { art: 'plz', plz: '5230' }],
    ['84359', { art: 'plz', plz: '84359' }],
    // Postleitzahl und Ort, in beiden Reihenfolgen — getrennt weitergegeben.
    ['5230 Mattighofen', { art: 'plz-ort', plz: '5230', ort: 'Mattighofen' }],
    ['Mattighofen 5230', { art: 'plz-ort', plz: '5230', ort: 'Mattighofen' }],
    ['84359 Simbach', { art: 'plz-ort', plz: '84359', ort: 'Simbach' }],
    ['4910 Ried im Innkreis', { art: 'plz-ort', plz: '4910', ort: 'Ried im Innkreis' }],
    ['Ried im Innkreis 4910', { art: 'plz-ort', plz: '4910', ort: 'Ried im Innkreis' }],
    // Ein Ort ohne Ziffern.
    ['Ried im Innkreis', { art: 'ort', ort: 'Ried im Innkreis' }],
    ['Mattighofen', { art: 'ort', ort: 'Mattighofen' }],
    // Ein Wort ohne Ziffern ist ein möglicher Ort — ob es einer ist, sagt erst Nominatim.
    // Ein Produktwort wie „Heu" findet dort nichts und bleibt eine Produktsuche.
    ['Heu', { art: 'ort', ort: 'Heu' }],
    // Schreibweisen echter Ortsnamen: Umlaute, Punkt, Bindestrich.
    ['Sankt Georgen am Fillmannsbach', { art: 'ort', ort: 'Sankt Georgen am Fillmannsbach' }],
    ['St. Johann im Pongau', { art: 'ort', ort: 'St. Johann im Pongau' }],
    ['Garmisch-Partenkirchen', { art: 'ort', ort: 'Garmisch-Partenkirchen' }],
    ['Mühldorf', { art: 'ort', ort: 'Mühldorf' }],
  ]

  it.each(TABELLE)('„%s" → %j', (text, erwartet) => {
    expect(erkenneOrtseingabe(text)).toEqual(erwartet)
  })

  it('Ränder, doppelte Leerzeichen und ein Komma zwischen den Teilen stören nicht', () => {
    expect(erkenneOrtseingabe('  5230   Mattighofen ')).toEqual({ art: 'plz-ort', plz: '5230', ort: 'Mattighofen' })
    expect(erkenneOrtseingabe('5230, Mattighofen')).toEqual({ art: 'plz-ort', plz: '5230', ort: 'Mattighofen' })
    expect(erkenneOrtseingabe('Mattighofen, 5230')).toEqual({ art: 'plz-ort', plz: '5230', ort: 'Mattighofen' })
  })

  it('alles, was kein Ort sein kann, ist Text: zu kurz, falsche Ziffern, Zeichen, die in keinem Ortsnamen stehen', () => {
    const text = [
      '',
      '   ',
      'R',
      '12', //            weder vier noch fünf Ziffern
      '123',
      '123456', //        sechs Ziffern
      '4910a', //         Ziffern mit Buchstaben
      'Eier 10er', //     Ziffern, die keine Postleitzahl sind
      'Heu 25 kg',
      'Ried 4910 Innkreis', // Postleitzahl mitten im Namen
      '4910 4911', //     zwei Postleitzahlen
      '5230 Mattighofen 2',
      'Eier & Käse',
      '<b>Ried</b>',
      'x'.repeat(61), //  länger als jeder Ortsname (ORTSSUCHE_MAX_ZEICHEN = 60)
    ]
    for (const eingabe of text) expect(erkenneOrtseingabe(eingabe), JSON.stringify(eingabe)).toEqual({ art: 'text' })
  })

  it('genau an der Längengrenze ist es noch ein Ort', () => {
    expect(erkenneOrtseingabe('x'.repeat(60)).art).toBe('ort')
  })
})

describe('sucheOrtspunkt — was an Nominatim geht', () => {
  /** Ein Nominatim-jsonv2-Treffer mit den Adressteilen, die der Dienst wirklich mitliefert. */
  function treffer(
    lat: number,
    lon: number,
    anzeige: string,
    adresse: Record<string, string>
  ): Record<string, unknown> {
    return { lat: String(lat), lon: String(lon), display_name: anzeige, address: adresse }
  }

  const MATTIGHOFEN = treffer(48.1067, 13.15, 'Mattighofen, Bezirk Braunau am Inn, Oberösterreich, 5230, Österreich', {
    town: 'Mattighofen',
    county: 'Bezirk Braunau am Inn',
    state: 'Oberösterreich',
    postcode: '5230',
    country_code: 'at',
  })

  async function angefragt(eingabe: string): Promise<Record<string, string>[]> {
    const aufrufe: Record<string, string>[] = []
    await sucheOrtspunkt(eingabe, async (parameter) => {
      aufrufe.push(parameter)
      return [MATTIGHOFEN]
    })
    return aufrufe
  }

  it('Postleitzahl UND Ort gehen zusammen und getrennt an Nominatim — nicht als ein Ortsname', async () => {
    for (const eingabe of ['5230 Mattighofen', 'Mattighofen 5230']) {
      expect(await angefragt(eingabe), eingabe).toEqual([
        { postalcode: '5230', city: 'Mattighofen', countrycodes: 'at,de', limit: '10' },
      ])
    }
  })

  it('eine Postleitzahl allein fragt als postalcode, ein Ort allein als city — beide Länder, zehn Treffer', async () => {
    expect(await angefragt('5230')).toEqual([{ postalcode: '5230', countrycodes: 'at,de', limit: '10' }])
    expect(await angefragt('84359')).toEqual([{ postalcode: '84359', countrycodes: 'at,de', limit: '10' }])
    expect(await angefragt('Ried im Innkreis')).toEqual([
      { city: 'Ried im Innkreis', countrycodes: 'at,de', limit: '10' },
    ])
  })

  it('Text, der kein Ort sein kann, geht gar nicht erst an Nominatim', async () => {
    for (const eingabe of ['', 'R', 'Eier 10er', 'Heu 25 kg']) {
      expect(await angefragt(eingabe), eingabe).toEqual([])
    }
    expect(await sucheOrtspunkt('Eier 10er', async () => [MATTIGHOFEN])).toEqual([])
  })

  it('zehn Kandidaten: erst entdoppeln, dann höchstens fünf — nicht erst kappen und dann entdoppeln', async () => {
    // Drei Zeilen desselben Orts (Gemeinde, Katastralgemeinde, Ortschaft) stehen vorn. Mit dem
    // alten Deckel von drei VOR der Entdopplung wäre davon nur EIN Ort übrig geblieben.
    const dreiMal = (lat: number) => treffer(lat, 13.5, 'Ried im Innkreis, Oberösterreich, 4910, Österreich', { village: 'Ried im Innkreis', state: 'Oberösterreich', country_code: 'at' })
    const antwort = [
      dreiMal(48.21),
      dreiMal(48.211),
      dreiMal(48.212),
      treffer(47.99, 14.06, 'Ried im Traunkreis, Oberösterreich, 4551, Österreich', { village: 'Ried im Traunkreis', state: 'Oberösterreich', country_code: 'at' }),
      treffer(48.29, 10.95, 'Ried, Landkreis Aichach-Friedberg, Bayern, 86510, Deutschland', { village: 'Ried', state: 'Bayern', country_code: 'de' }),
      treffer(47.57, 11.27, 'Ried, Kochel am See, Bayern, 82431, Deutschland', { village: 'Ried', state: 'Bayern', country_code: 'de' }),
      treffer(47.3, 12.1, 'Ried im Zillertal, Tirol, 6272, Österreich', { village: 'Ried im Zillertal', state: 'Tirol', country_code: 'at' }),
      treffer(47.2, 10.1, 'Ried im Oberinntal, Tirol, 6531, Österreich', { village: 'Ried im Oberinntal', state: 'Tirol', country_code: 'at' }),
      treffer(48.8, 12.2, 'Ried, Landkreis Straubing-Bogen, Bayern, 94327, Deutschland', { village: 'Ried', state: 'Bayern', country_code: 'de' }),
      treffer(47.1, 13.1, 'Ried, Pongau, Salzburg, 5600, Österreich', { village: 'Ried', state: 'Salzburg', country_code: 'at' }),
    ]
    expect(antwort).toHaveLength(10)

    const orte = await sucheOrtspunkt('Ried', async () => antwort)

    expect(orte).toHaveLength(5)
    expect(orte.map((o) => o.lat)).toEqual([48.21, 47.99, 48.29, 47.57, 47.3])
  })

  it('weniger als fünf bleiben weniger — und ohne Treffer kommt eine leere Liste', async () => {
    expect(await sucheOrtspunkt('Mattighofen', async () => [MATTIGHOFEN, MATTIGHOFEN])).toHaveLength(1)
    expect(await sucheOrtspunkt('Mattighofen', async () => [])).toEqual([])
  })
})

describe('kandidatenBeschriftung — Bundesland zur Unterscheidung', () => {
  const kandidaten = async (antwort: unknown[]) => (await sucheOrtspunkt('Ried', async () => antwort)).map(kandidatenBeschriftung)
  const eintrag = (lat: number, anzeige: string, adresse: Record<string, string>) => ({
    lat: String(lat),
    lon: '13.4',
    display_name: anzeige,
    address: adresse,
  })

  it('Ortsname und Bundesland statt des langen Nominatim-Namens', async () => {
    expect(
      await kandidaten([
        eintrag(48.1067, 'Mattighofen, Bezirk Braunau am Inn, Oberösterreich, 5230, Österreich', {
          town: 'Mattighofen',
          state: 'Oberösterreich',
          postcode: '5230',
          country_code: 'at',
        }),
      ])
    ).toEqual(['Mattighofen, Oberösterreich'])
  })

  it('verschiedene Orte, deren Kurzname gleich lautet, bekommen den längeren Namen — ohne Postleitzahl und Land', async () => {
    const namen = await kandidaten([
      eintrag(48.21, 'Ried im Innkreis, Oberösterreich, 4910, Österreich', { village: 'Ried im Innkreis', state: 'Oberösterreich', country_code: 'at' }),
      eintrag(48.29, 'Ried, Landkreis Aichach-Friedberg, Bayern, 86510, Deutschland', { village: 'Ried', state: 'Bayern', country_code: 'de' }),
      eintrag(47.57, 'Ried, Kochel am See, Bayern, 82431, Deutschland', { village: 'Ried', state: 'Bayern', country_code: 'de' }),
    ])

    expect(namen).toEqual([
      'Ried im Innkreis, Oberösterreich',
      'Ried, Landkreis Aichach-Friedberg, Bayern',
      'Ried, Kochel am See, Bayern',
    ])
    // Gegenprobe: ohne Kollision bleibt es beim kurzen Namen.
    expect(new Set(namen).size).toBe(namen.length)
  })

  it('ein Treffer auf eine Postleitzahl trägt den Ort oft nur im Nominatim-Namen — daher kommt er', async () => {
    expect(
      await kandidaten([
        eintrag(48.1067, '5230, Mattighofen, Bezirk Braunau am Inn, Oberösterreich, Österreich', {
          county: 'Bezirk Braunau am Inn',
          state: 'Oberösterreich',
          postcode: '5230',
          country_code: 'at',
        }),
      ])
    ).toEqual(['Mattighofen, Oberösterreich'])
  })

  it('Stadtstaaten: Ort und Bundesland heißen gleich — dann steht das Land dahinter', async () => {
    expect(
      await kandidaten([eintrag(48.2, 'Wien, Österreich', { city: 'Wien', state: 'Wien', country_code: 'at' })])
    ).toEqual(['Wien, Österreich'])
  })

  it('ohne Bundesland steht das Land hinter dem Ort — sonst wäre er auf beiden Seiten der Grenze nicht zuzuordnen', async () => {
    const [bayern] = await kandidaten([eintrag(48.2, 'Simbach', { village: 'Simbach', country_code: 'de' })])
    expect(bayern).toBe('Simbach, Deutschland')
  })

  it('ohne Ortsnamen in den Adressteilen und ohne Postleitzahl vorn bleibt die bisherige Beschriftung mit dem Land', async () => {
    expect(await kandidaten([eintrag(48.2, 'Simbach', { country_code: 'de' })])).toEqual(['Simbach (Deutschland)'])
  })
})
