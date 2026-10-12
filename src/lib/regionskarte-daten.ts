/**
 * Geodaten der Karte der Region auf der Startseite (Nr. 59) — ERZEUGT, nicht
 * von Hand gezeichnet. Nicht von Hand ändern: neu erzeugen.
 *
 * Quelle: Natural Earth, gemeinfrei (public domain), Maßstab 1:10 Mio.,
 * github.com/nvkelso/natural-earth-vector, Zweig master, abgerufen am
 * 12.10.2026:
 *   - ne_10m_rivers_lake_centerlines.geojson → Inn (Feld name)
 *   - ne_10m_rivers_europe.geojson → Salzach (Feld name)
 *   - ne_10m_roads.geojson → Straßen; Art aus dem Feld type (Major Highway →
 *     fernstrasse, Secondary Highway → hauptstrasse, Road → strasse),
 *     Beschriftung nur aus dem Feld label (E-Nummern), sonst keine
 *
 * Erzeugt mit einem Skript außerhalb des Repos (Python, ohne Pakete):
 *   1. Linien wählen: Inn und Salzach nach Namen, alle Straßen, die den
 *      Ausschnitt REGIONS_AUSSCHNITT (12,80–13,62 Länge, 47,93–48,40 Breite,
 *      src/lib/regionskarte.ts) berühren.
 *   2. Jede Strecke auf den Ausschnitt schneiden (Liang-Barsky); was den
 *      Ausschnitt verlässt und wieder betritt, wird ein eigener Linienzug.
 *   3. Vereinfachen nach Douglas-Peucker, Toleranz 0,0005 Grad (rund 40–55 m).
 *   4. Auf vier Nachkommastellen runden (rund 10 m), doppelte Punkte weg.
 *
 * NICHT in Natural Earth und deshalb nicht auf der Karte (Mockup
 * web-k0-startseite-karte-region): Orte, Mattig, Antiesen, Waldflächen, die
 * Bundesstraßen-Nummern (B148, B147, B156, B141) und „A8". Kommen sie dazu
 * (etwa aus einem OSM-Auszug, dann mit dem Hinweis „Kartendaten:
 * © OpenStreetMap-Mitwirkende" unter der Karte), ändert sich nur diese Datei.
 */

/** Ein Linienzug als Punkte [Länge, Breite] in Grad (WGS 84). */
export type Linienzug = readonly (readonly [lon: number, lat: number])[]

export type Fluss = { name: string; linien: readonly Linienzug[] }

export type StrassenArt = 'fernstrasse' | 'hauptstrasse' | 'strasse'

export type Strasse = {
  art: StrassenArt
  /** Die Nummer aus dem Feld label der Quelle („E56"), sonst null. */
  beschriftung: string | null
  linien: readonly Linienzug[]
}

export const FLUESSE: readonly Fluss[] = [
  {
    name: 'Inn',
    linien: [
      [[12.8, 48.2693], [12.8181, 48.275], [12.8322, 48.2699], [12.844, 48.2596], [12.8547, 48.2547], [12.8679, 48.253], [12.8867, 48.2529], [12.8955, 48.2476], [12.9312, 48.2119], [12.9467, 48.2203], [12.9789, 48.2322], [13.016, 48.2561], [13.0322, 48.2639], [13.136, 48.2913], [13.2737, 48.3073], [13.3073, 48.3199], [13.405, 48.3768], [13.419, 48.3924], [13.421, 48.4]],
    ],
  },
  {
    name: 'Salzach',
    linien: [
      [[12.9231, 47.93], [12.9136, 47.9363], [12.9055, 47.9392], [12.8855, 47.9532], [12.8616, 47.9628], [12.8534, 47.9708], [12.848, 47.9813], [12.845, 47.9935], [12.8299, 48.0158], [12.8, 48.0368]],
      [[12.8, 48.1509], [12.8039, 48.1544], [12.8441, 48.1782], [12.8765, 48.2081], [12.8992, 48.216], [12.9312, 48.2119]],
    ],
  },
]

export const STRASSEN: readonly Strasse[] = [
  {
    art: 'strasse',
    beschriftung: null,
    linien: [
      [[12.8358, 48.2381], [12.8287, 48.218], [12.8349, 48.1969], [12.8235, 48.1829], [12.8296, 48.1689], [12.8, 48.1562]],
      [[12.8, 48.0048], [12.8226, 47.9909], [12.848, 47.9848], [12.8612, 47.9611], [12.8962, 47.9541], [12.9138, 47.9454], [12.9267, 47.93]],
    ],
  },
  {
    art: 'strasse',
    beschriftung: null,
    linien: [
      [[13.3254, 48.4], [13.3012, 48.3828], [13.2898, 48.3688], [13.2679, 48.3556], [13.2267, 48.3442], [13.1943, 48.3311], [13.1548, 48.3258], [13.1215, 48.3153], [13.0742, 48.3083], [13.0295, 48.2829], [13.019, 48.2715]],
    ],
  },
  {
    art: 'strasse',
    beschriftung: null,
    linien: [
      [[13.4796, 48.4], [13.5029, 48.3863], [13.5353, 48.3994], [13.5403, 48.4]],
      [[13.5729, 48.4], [13.6063, 48.3951], [13.62, 48.3918]],
    ],
  },
  {
    art: 'strasse',
    beschriftung: 'E552',
    linien: [
      [[13.4192, 48.2099], [13.4431, 48.2127], [13.467, 48.2183], [13.5388, 48.2425]],
    ],
  },
  {
    art: 'hauptstrasse',
    beschriftung: 'E552',
    linien: [
      [[12.8406, 48.2429], [12.9924, 48.2495], [13.1515, 48.2749], [13.181, 48.2773], [13.1957, 48.2774], [13.2104, 48.2761], [13.2312, 48.2715], [13.2515, 48.2647], [13.3502, 48.221], [13.3709, 48.2146], [13.3951, 48.2103], [13.4192, 48.2099]],
    ],
  },
  {
    art: 'fernstrasse',
    beschriftung: 'E55',
    linien: [
      [[13.4916, 47.93], [13.5028, 47.9385], [13.5218, 47.9497], [13.5318, 47.9541], [13.5526, 47.9606], [13.5744, 47.9646], [13.62, 47.9654]],
    ],
  },
  {
    art: 'fernstrasse',
    beschriftung: 'E552',
    linien: [
      [[12.8, 48.2456], [12.8406, 48.2429]],
    ],
  },
  {
    art: 'fernstrasse',
    beschriftung: 'E56',
    linien: [
      [[13.418, 48.4], [13.4178, 48.3695], [13.4187, 48.3605], [13.4206, 48.3517], [13.4236, 48.3431], [13.4276, 48.3346], [13.4332, 48.3259], [13.4403, 48.3191], [13.449, 48.3165], [13.465, 48.3178], [13.4725, 48.3162], [13.478, 48.3107], [13.4796, 48.3031], [13.4777, 48.2872], [13.4794, 48.2798], [13.4843, 48.2732], [13.491, 48.2673], [13.4984, 48.2622], [13.5394, 48.2406]],
    ],
  },
  {
    art: 'fernstrasse',
    beschriftung: 'E56',
    linien: [
      [[13.5215, 48.2466], [13.5421, 48.2466], [13.5522, 48.2451], [13.5621, 48.2423], [13.5693, 48.2392], [13.605, 48.2174], [13.62, 48.2104]],
    ],
  },
]
