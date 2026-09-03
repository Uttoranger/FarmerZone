/**
 * Tests für die Grenzregion (Innviertel/Niederbayern): die PLZ-Heuristik
 * über beide Länder, die Plausibilisierung je Land, die dreistufige Kaskade
 * mit dem Land des Hofes samt Rückfallpunkt, und die Beschriftung der
 * Ortskandidaten.
 *
 * Der Nominatim-Lader ist injizierbar — geprüft wird die echte Logik mit
 * nachgestellten Antworten (jsonv2-Gestalt: lat/lon als STRINGS), ohne Netz.
 * Insbesondere WAS die Kaskade je Stufe anfragt: Der Länder-Anker muss in
 * BEIDEN Nominatim-Stufen mitgehen, sonst suchte die zweite still in
 * Österreich weiter.
 */
import { describe, it, expect } from 'vitest'
import {
  geokodiereAdresse,
  istImErlaubtenGebiet,
  istPostleitzahl,
  kandidatenBeschriftung,
  entdoppleTreffer,
  hinweisMehrere,
  werteNominatimAntwortAus,
  HINWEIS_ADRESSE_GEFUNDEN,
  HINWEIS_SELBST_SETZEN,
  LAENDER_GRENZEN,
  OESTERREICH_GRENZEN,
  RUECKFALL_PUNKT,
  RUECKFALL_PUNKTE,
} from '@/lib/geokodierung'
import {
  DE_ADMIN_KLAERUNG,
  DE_VORBEREITUNG_HINWEIS,
  LAENDER,
  LAND_CODE,
  UMKREIS_LAENDER_CODES,
  alsLand,
} from '@/lib/laender'

const ADRESSE = { address: 'Dorfstraße 12', postalCode: '4910', city: 'Ried im Innkreis' }

// Die Hinweistexte über die öffentliche Schnittstelle, damit ein geänderter
// Wortlaut hier auffällt statt still durchzurutschen.
const HINWEIS_TEXTE = { adresse: HINWEIS_ADRESSE_GEFUNDEN, selbst: HINWEIS_SELBST_SETZEN }

/** Ein Nominatim-jsonv2-Treffer; `land` wird zu address.country_code. */
function treffer(lat: string, lon: string, name: string, land?: string) {
  return { lat, lon, display_name: name, address: land ? { country_code: land } : {} }
}

describe('istPostleitzahl — vier oder fünf Stellen', () => {
  it('österreichische PLZ (vier Stellen) und deutsche PLZ (fünf Stellen)', () => {
    expect(istPostleitzahl('5261')).toBe(true) //  Uttendorf, AT
    expect(istPostleitzahl('84359')).toBe(true) // Simbach am Inn, DE
  })

  it('ein Ortsname ist keine Postleitzahl', () => {
    expect(istPostleitzahl('Simbach')).toBe(false)
    expect(istPostleitzahl('Ried im Innkreis')).toBe(false)
  })

  it('drei, sechs Stellen und Gemischtes zählen nicht', () => {
    expect(istPostleitzahl('491')).toBe(false)
    expect(istPostleitzahl('123456')).toBe(false)
    expect(istPostleitzahl('4910a')).toBe(false)
    expect(istPostleitzahl('')).toBe(false)
  })

  it('umschließende Leerzeichen stören nicht — das Feld liefert sie mit', () => {
    expect(istPostleitzahl('  84359  ')).toBe(true)
  })
})

describe('istImErlaubtenGebiet — die Plausibilisierung folgt dem Land', () => {
  // Ried im Innkreis (AT) und Simbach am Inn (DE) — eine Brücke auseinander.
  const RIED = { lat: 48.21, lon: 13.49 }
  const SIMBACH = { lat: 48.27, lon: 13.02 }

  it('ein Punkt in Oberösterreich ist als AT erlaubt', () => {
    expect(istImErlaubtenGebiet(RIED.lat, RIED.lon, 'AT')).toBe(true)
  })

  it('ein österreichischer Punkt AUSSERHALB der DE-Schachtel wird als DE abgelehnt', () => {
    // BEFUND, festgehalten: Für einen Punkt in OBERÖSTERREICH lässt sich das
    // nicht zeigen — die vorgegebene DE-Schachtel (47,2–55,1 / 5,8–15,1)
    // enthält Oberösterreich vollständig (es reicht nur bis Länge ~14,98).
    // Die Schachteln sind grobe Datenmüll-Fänger, keine Grenzverläufe; wo
    // sie überlappen, entscheidet allein das Länderfeld. Geprüft wird
    // deshalb ein Punkt, den wirklich nur Österreich enthält.
    expect(istImErlaubtenGebiet(48.21, 16.37, 'AT')).toBe(true) //  Wien
    expect(istImErlaubtenGebiet(48.21, 16.37, 'DE')).toBe(false)
    expect(istImErlaubtenGebiet(47.07, 15.44, 'AT')).toBe(true) //  Graz
    expect(istImErlaubtenGebiet(47.07, 15.44, 'DE')).toBe(false)
    // Und der Gegenbeweis zum Befund oben, ausdrücklich:
    expect(istImErlaubtenGebiet(RIED.lat, RIED.lon, 'DE')).toBe(true)
  })

  it('ein Punkt bei Simbach ist als DE erlaubt', () => {
    expect(istImErlaubtenGebiet(SIMBACH.lat, SIMBACH.lon, 'DE')).toBe(true)
  })

  it('ein Punkt in Norddeutschland ist als DE erlaubt, als AT nicht', () => {
    expect(istImErlaubtenGebiet(53.55, 9.99, 'DE')).toBe(true) //  Hamburg
    expect(istImErlaubtenGebiet(53.55, 9.99, 'AT')).toBe(false)
  })

  it('ein Punkt in Italien wird BEIDSEITIG abgelehnt', () => {
    expect(istImErlaubtenGebiet(41.9, 12.5, 'AT')).toBe(false) // Rom
    expect(istImErlaubtenGebiet(41.9, 12.5, 'DE')).toBe(false)
  })

  it('Null-Insel und unbrauchbare Zahlen fallen in jedem Land durch', () => {
    for (const land of LAENDER) {
      expect(istImErlaubtenGebiet(0, 0, land)).toBe(false)
      expect(istImErlaubtenGebiet(NaN, 14, land)).toBe(false)
      expect(istImErlaubtenGebiet(48, Infinity, land)).toBe(false)
    }
  })

  it('ein unbekannter Länderwert wird wie AT behandelt, nie wie „alles erlaubt"', () => {
    expect(istImErlaubtenGebiet(48.21, 16.37, 'XX')).toBe(true) //  Wien, wie AT
    expect(istImErlaubtenGebiet(53.55, 9.99, 'XX')).toBe(false) // Hamburg, wie AT
  })

  it('die Österreich-Schachtel ist unverändert — Bestandshöfe ändern ihr Verhalten nicht', () => {
    expect(OESTERREICH_GRENZEN).toEqual({ latMin: 46, latMax: 49.1, lonMin: 9.5, lonMax: 17.2 })
    expect(LAENDER_GRENZEN.AT).toBe(OESTERREICH_GRENZEN)
  })

  it('die Grenzregion liegt bewusst in BEIDEN Schachteln — das Länderfeld entscheidet', () => {
    // Braunau/Simbach: grobe Schachteln können den Grenzverlauf nicht
    // nachzeichnen, und sollen es auch nicht (sie fangen Datenmüll).
    expect(istImErlaubtenGebiet(SIMBACH.lat, SIMBACH.lon, 'AT')).toBe(true)
    expect(istImErlaubtenGebiet(SIMBACH.lat, SIMBACH.lon, 'DE')).toBe(true)
  })
})

describe('geokodiereAdresse — die Kaskade nutzt das Land des Hofes', () => {
  it('Stufe 1 und Stufe 2 tragen BEIDE den Länder-Anker des Hofes', async () => {
    const angefragt: Record<string, string>[] = []
    await geokodiereAdresse(ADRESSE, 'DE', async (parameter) => {
      angefragt.push(parameter)
      return [] //  beide Stufen scheitern → wir sehen beide Anfragen
    })

    expect(angefragt).toHaveLength(2)
    expect(angefragt[0]).toMatchObject({ street: 'Dorfstraße 12', country: 'de' })
    expect(angefragt[1]).toEqual({ postalcode: '4910', city: 'Ried im Innkreis', country: 'de' })
    // Stufe 2 schickt die Straße nicht mehr mit (Bestandsverhalten).
    expect(angefragt[1]).not.toHaveProperty('street')
  })

  it('ohne Länderangabe bleibt es bei Österreich — Bestandsverhalten', async () => {
    const angefragt: Record<string, string>[] = []
    await geokodiereAdresse(ADRESSE, undefined, async (parameter) => {
      angefragt.push(parameter)
      return []
    })

    expect(angefragt[0]).toMatchObject({ country: 'at' })
    expect(angefragt[1]).toMatchObject({ country: 'at' })
  })

  it('der Rückfallpunkt der dritten Stufe folgt dem Land', async () => {
    const at = await geokodiereAdresse(ADRESSE, 'AT', async () => [])
    const de = await geokodiereAdresse(ADRESSE, 'DE', async () => [])

    expect(at.zentrum).toEqual(RUECKFALL_PUNKTE.AT)
    expect(de.zentrum).toEqual(RUECKFALL_PUNKTE.DE)
    // AT unverändert wie bisher, DE in Südostbayern — nicht irgendwo.
    expect(RUECKFALL_PUNKTE.AT).toEqual(RUECKFALL_PUNKT)
    expect(RUECKFALL_PUNKTE.AT).toEqual({ lat: 48.1, lon: 13.5 })
    expect(istImErlaubtenGebiet(RUECKFALL_PUNKTE.DE.lat, RUECKFALL_PUNKTE.DE.lon, 'DE')).toBe(true)
    // SÜDOSTBAYERN — und zwar auf BEIDEN Achsen festgenagelt. Die Breite
    // allein genügt nicht: Der AT-Punkt (48,1/13,5) liegt ebenfalls
    // zwischen 47,5 und 49, ein versehentliches Zurückfallen auf
    // Oberösterreich bliebe damit unbemerkt. Entscheidend ist die LÄNGE.
    expect(RUECKFALL_PUNKTE.DE.lat).toBeGreaterThan(47.5)
    expect(RUECKFALL_PUNKTE.DE.lat).toBeLessThan(49)
    expect(RUECKFALL_PUNKTE.DE.lon).toBeGreaterThan(12)
    expect(RUECKFALL_PUNKTE.DE.lon).toBeLessThan(13.4) //  westlich von Ried (13,49)
    // Und ausdrücklich: NICHT derselbe Punkt wie für Österreich.
    expect(RUECKFALL_PUNKTE.DE).not.toEqual(RUECKFALL_PUNKTE.AT)
  })

  it('Zoom-Stufen und Hinweistexte bleiben unverändert — auch für DE', async () => {
    const gefunden = await geokodiereAdresse(ADRESSE, 'DE', async () => [
      treffer('48.27', '13.02', 'Simbach am Inn, Deutschland', 'de'),
    ])
    expect(gefunden).toMatchObject({ stufe: 'adresse', zoom: 17, hinweis: HINWEIS_TEXTE.adresse })

    const rueckfall = await geokodiereAdresse(ADRESSE, 'DE', async () => [])
    expect(rueckfall).toMatchObject({ stufe: 'rueckfall', zoom: 8, hinweis: HINWEIS_TEXTE.selbst })
  })
})

describe('Ortskandidaten — die Landangabe macht sie unterscheidbar', () => {
  it('werteNominatimAntwortAus liest country_code als Großbuchstaben-Land', () => {
    const [k] = werteNominatimAntwortAus([treffer('48.27', '13.02', 'Simbach am Inn', 'de')])
    expect(k.land).toBe('DE')
  })

  it('ohne country_code bleibt das Feld weg statt geraten zu werden', () => {
    const [k] = werteNominatimAntwortAus([treffer('48.21', '13.49', 'Irgendwo')])
    expect(k.land).toBeUndefined()
  })

  it('nennt der Anzeigename das Land schon, wird es nicht doppelt angehängt', () => {
    expect(
      kandidatenBeschriftung({
        lat: 48.27,
        lon: 13.02,
        anzeigeName: 'Simbach am Inn, Landkreis Rottal-Inn, Bayern, Deutschland',
        land: 'DE',
      })
    ).toBe('Simbach am Inn, Landkreis Rottal-Inn, Bayern, Deutschland')
  })

  it('fehlt es im Namen, wird es ergänzt — sonst wäre der Treffer nicht zuzuordnen', () => {
    expect(kandidatenBeschriftung({ lat: 48.27, lon: 13.02, anzeigeName: 'Simbach', land: 'DE' })).toBe(
      'Simbach (Deutschland)'
    )
    expect(kandidatenBeschriftung({ lat: 48.21, lon: 13.49, anzeigeName: 'Ried', land: 'AT' })).toBe(
      'Ried (Österreich)'
    )
  })

  it('ohne Land bleibt der Name, wie er ist', () => {
    expect(kandidatenBeschriftung({ lat: 48.2, lon: 13.5, anzeigeName: 'Irgendwo' })).toBe('Irgendwo')
  })
})

describe('Länder-Stammdaten', () => {
  it('genau AT und DE, mit den Codes, die Nominatim erwartet', () => {
    expect(LAENDER).toEqual(['AT', 'DE'])
    expect(LAND_CODE).toEqual({ AT: 'at', DE: 'de' })
    expect(UMKREIS_LAENDER_CODES).toBe('at,de')
  })

  it('alsLand nimmt nur DE beim Wort — alles andere ist AT', () => {
    expect(alsLand('DE')).toBe('DE')
    expect(alsLand('AT')).toBe('AT')
    expect(alsLand('de')).toBe('AT') //  Kleinschreibung ist nicht unser Feldwert
    expect(alsLand(null)).toBe('AT')
    expect(alsLand(undefined)).toBe('AT')
    expect(alsLand('FR')).toBe('AT')
  })
})

describe('Die beiden vorgeschriebenen Wortlaute — byteweise festgenagelt', () => {
  // Der Auftrag gibt sie WÖRTLICH vor, und keine Anzeige-Prüfung schützt
  // sie (die Suite läuft ohne DOM). Hier stehen sie deshalb im Klartext:
  // Wer sie umschreibt, muss diesen Test mitändern und merkt es dabei.
  it('der Vorbereitungs-Hinweis für deutsche Höfe (D-1/D-2)', () => {
    expect(DE_VORBEREITUNG_HINWEIS).toBe(
      'Deutschland bereiten wir gerade vor. Du kannst deinen Hof schon vollständig ' +
        'einrichten — die Freischaltung dauert bei deutschen Höfen etwas länger, weil ' +
        'wir vorher steuerliche und rechtliche Fragen klären. Wir melden uns per E-Mail.'
    )
  })

  it('die Klär-Erinnerung im Admin-Bereich (E-2)', () => {
    expect(DE_ADMIN_KLAERUNG).toBe(
      'Vor der Freischaltung klären: Stripe-Konto in DE, steuerliche Behandlung, Kennzeichnungspflichten.'
    )
  })
})

describe('entdoppleTreffer — der häufige Weg bleibt einstufig', () => {
  const t = (lat: number, lon: number, anzeigeName: string, land?: string) => ({
    lat,
    lon,
    anzeigeName,
    ...(land ? { land } : {}),
  })

  it('mehrere Zeilen desselben Ortes werden zu einer — sonst gäbe es eine Rückfrage ohne Erkenntnis', () => {
    // Genau das liefert Nominatim für eine österreichische Postleitzahl:
    // Gemeinde, Katastralgemeinde, Ortschaft — alle im selben Ort.
    const eindeutig = entdoppleTreffer([
      t(48.21, 13.49, '4910 Ried im Innkreis, Österreich', 'AT'),
      t(48.212, 13.492, '4910 Ried im Innkreis, Österreich', 'AT'),
      t(48.215, 13.488, 'Ried im Innkreis, Bezirk Ried, Österreich', 'AT'),
    ])

    expect(eindeutig).toHaveLength(1)
    expect(eindeutig[0].anzeigeName).toBe('4910 Ried im Innkreis, Österreich')
  })

  it('SIMBACH UND BRAUNAU bleiben BEIDE — sie trennt eine Brücke, rund 1,3 km', () => {
    // Der Fall, dessentwegen es die Rückfrage überhaupt gibt. Eine reine
    // Abstandsregel würfe genau ihn zusammen; das Land entscheidet.
    const eindeutig = entdoppleTreffer([
      t(48.267, 13.025, 'Simbach am Inn, Bayern, Deutschland', 'DE'),
      t(48.256, 13.036, 'Braunau am Inn, Oberösterreich, Österreich', 'AT'),
    ])

    expect(eindeutig).toHaveLength(2)
    expect(eindeutig.map((k) => k.land)).toEqual(['DE', 'AT'])
  })

  it('gleicher Anzeigename zählt immer als derselbe Ort, egal wie weit weg', () => {
    expect(
      entdoppleTreffer([t(48.2, 13.0, 'Neukirchen', 'AT'), t(47.3, 12.0, 'Neukirchen', 'AT')])
    ).toHaveLength(1)
    // Verschiedene Namen, weit auseinander: beide bleiben.
    expect(entdoppleTreffer([t(48.2, 13.0, 'A', 'AT'), t(47.3, 12.0, 'B', 'AT')])).toHaveLength(2)
  })

  it('die Reihenfolge bleibt, der beste Treffer gewinnt', () => {
    const eindeutig = entdoppleTreffer([
      t(48.2, 13.0, 'Erster', 'AT'),
      t(48.2001, 13.0001, 'Zweiter', 'AT'),
    ])
    expect(eindeutig.map((k) => k.anzeigeName)).toEqual(['Erster'])
  })

  it('leere Eingabe bleibt leer', () => {
    expect(entdoppleTreffer([])).toEqual([])
  })
})

describe('hinweisMehrere — die Ansage nennt die Anzahl', () => {
  it('zwei und drei ausgeschrieben, darüber die Ziffer', () => {
    expect(hinweisMehrere(2)).toBe('Zwei Orte passen — welchen meinst du?')
    expect(hinweisMehrere(3)).toBe('Drei Orte passen — welchen meinst du?')
    expect(hinweisMehrere(5)).toBe('5 Orte passen — welchen meinst du?')
  })
})
