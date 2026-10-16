import { z } from 'zod'

/*
 * Der Ausschnitt eines Fotos (Register N13, Ergänzung 15.10.2026, und N17;
 * Nachtlauf Nr. 97): ein Fokuspunkt waagrecht und senkrecht, ein Zoom und
 * einer der sechs Filter — beim Titelbild dazu die Wahl „füllen oder ganz“ am
 * Computer. EIN Format für alle fünf Bildfelder (Farm.bannerAusschnitt,
 * Farm.logoAusschnitt, Product.bildAusschnitt, FarmPhoto.ausschnitt,
 * StatusPost.fotoAusschnitt), EINE Prüfung. Gespeichert wird nur der Wert,
 * nie eine zweite Bilddatei; den Stil daraus baut lib/bild-ausschnitt.ts.
 */

/** Die sechs Filter in der Reihenfolge der Kacheln (Mockup system-h1-titelbild-filter). */
export const BILD_FILTER_NAMEN = ['NATUERLICH', 'KLAR', 'WARM', 'KRAEFTIG', 'SANFT', 'SCHWARZWEISS'] as const

/** Die Wahl am Computer, nur beim Titelbild. AUTO = die Regel nach Seitenverhältnis (lib/titelbild.ts). */
export const DARSTELLUNG_WAHLEN = ['AUTO', 'FUELLEN', 'GANZ'] as const

export const bildFilterSchema = z.enum(BILD_FILTER_NAMEN)
export const darstellungWahlSchema = z.enum(DARSTELLUNG_WAHLEN)

const prozent = z.number().int().min(0).max(100)

/**
 * Streng: Ein fremder Schlüssel (etwa eine Hof-Kennung aus dem Formular) macht
 * den Wert ungültig, statt still verworfen zu werden.
 */
export const bildAusschnittSchema = z.strictObject({
  fokusX: prozent,
  fokusY: prozent,
  /** Prozent: 100 = so groß, wie `object-fit: cover` das Foto stellt; höchstens 250. */
  zoom: z.number().int().min(100).max(250),
  filter: bildFilterSchema,
  darstellung: darstellungWahlSchema.optional(),
})

export type BildAusschnitt = z.infer<typeof bildAusschnittSchema>
export type BildFilter = z.infer<typeof bildFilterSchema>
export type DarstellungWahl = z.infer<typeof darstellungWahlSchema>

/**
 * Liest einen gespeicherten Ausschnitt. Alles, was nicht passt (ein Altwert,
 * ein fremdes Format, ein Wert außerhalb der Grenzen), ergibt `null` — die
 * Seite zeigt das Foto dann wie vorher, nie einen Fehler.
 */
export function leseAusschnitt(json: unknown): BildAusschnitt | null {
  const gelesen = bildAusschnittSchema.safeParse(json)
  return gelesen.success ? gelesen.data : null
}

/** Ein Ausschnitt ohne die Wahl füllen/ganz — für alle Fotos außer dem Titelbild. */
const fotoAusschnittSchema = bildAusschnittSchema.omit({ darstellung: true })

/** Das Logo bekommt keinen Filter (Register N17): Es ist die Marke des Hofs. */
const logoAusschnittSchema = fotoAusschnittSchema.extend({ filter: z.literal('NATUERLICH') })

const kennung = z.string().min(1).max(64)

/**
 * Was „Speichern“ im Bild-Baustein schickt. Welcher Hof, sagt nie das
 * Formular, sondern die Sitzung (server/actions/bild-ausschnitt.ts); bei
 * Produkt, Foto und Beitrag steht die Kennung im Wert und der Hof in derselben
 * WHERE-Klausel. Freigeschaltet ist in Nr. 97 nur das Titelbild.
 */
export const bildAusschnittSpeichernSchema = z.discriminatedUnion('ziel', [
  z.strictObject({ ziel: z.literal('banner'), wert: bildAusschnittSchema }),
  z.strictObject({ ziel: z.literal('logo'), wert: logoAusschnittSchema }),
  z.strictObject({ ziel: z.literal('produkt'), productId: kennung, wert: fotoAusschnittSchema }),
  z.strictObject({ ziel: z.literal('foto'), farmPhotoId: kennung, wert: fotoAusschnittSchema }),
  z.strictObject({ ziel: z.literal('beitrag'), statusPostId: kennung, wert: fotoAusschnittSchema }),
])

export type BildAusschnittSpeichern = z.infer<typeof bildAusschnittSpeichernSchema>
export type BildAusschnittZiel = BildAusschnittSpeichern['ziel']
