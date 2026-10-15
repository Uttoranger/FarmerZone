import { z } from 'zod'
import { PRODUCT_CATEGORY_VALUES } from '@/lib/taxonomie'
import {
  HOEFE_AUSWAHL_MAX,
  LINK_TEXT_MAX,
  TEXT_MAX,
  TITEL_MAX,
  UEBERZEILE_MAX,
  VORLAGEN,
  istRelativerLink,
  zeitpunktAusEingabe,
} from '@/lib/startseite-gestalten'

/*
 * Die Systemgrenzen von Admin › Startseite (Register N16, Nr. 96): Speichern,
 * Block löschen, Vorschau-Link — und der Vorschau-Parameter der Startseite.
 * Formular und Action prüfen mit denselben Schemas; der Server prüft
 * zusätzlich, was nur die Datenbank weiß (freigeschaltete Höfe, feste
 * Abschnitte, eigene Bilder).
 */

/** Die Sätze, die eine Zod-Meldung an der Oberfläche sein dürfen (CODING_STANDARDS §4). */
export const STARTSEITE_SAETZE = {
  vorlage: 'Bitte wähle eine Vorlage.',
  titel: 'Bitte gib einen Titel ein.',
  titelLang: `Der Titel hat höchstens ${TITEL_MAX} Zeichen. Bitte kürzen.`,
  ueberzeile: `Die Überzeile hat höchstens ${UEBERZEILE_MAX} Zeichen. Bitte kürzen.`,
  text: `Der Text hat höchstens ${TEXT_MAX} Zeichen. Bitte kürzen.`,
  link: 'Das Link-Ziel beginnt mit „/“, etwa /hoefe – Adressen anderer Seiten gehen nicht.',
  linkText: `Der Linktext hat höchstens ${LINK_TEXT_MAX} Zeichen. Bitte kürzen.`,
  hoefeMax: `Wähle höchstens ${HOEFE_AUSWAHL_MAX} Höfe.`,
  hoefeDoppelt: 'Jeder Hof nur einmal.',
  hoefeMin: 'Wähle mindestens einen Hof.',
  kategorie: 'Wähle eine Kategorie.',
  tag: 'Bitte wähle einen Tag.',
  uhrzeit: 'Bitte gib eine Uhrzeit wie 06:00 ein.',
  umstellung: 'Diese Uhrzeit gibt es an dem Tag nicht (Zeitumstellung).',
  bisNachAb: '„Live bis“ liegt nach „Live ab“.',
  ungueltig: 'Bitte prüf die Angaben und speichere noch einmal.',
} as const

export const EIGENE_STARTSEITE_SAETZE: ReadonlySet<string> = new Set(Object.values(STARTSEITE_SAETZE))

const S = STARTSEITE_SAETZE
const KENNUNG = z.string().min(1).max(40)
const TAG = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, S.tag)
const UHRZEIT = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, S.uhrzeit)

/** Freitext: Ränder weg, leer heißt null (CODING_STANDARDS §8). */
function freitext(max: number, satz: string) {
  return z
    .string()
    .trim()
    .max(max, satz)
    .transform((v) => (v === '' ? null : v))
    .nullable()
}

export const startseitenBlockSchema = z
  .object({
    /** Fehlt bei einem neuen Block. */
    id: KENNUNG.optional(),
    vorlage: z.enum(VORLAGEN, S.vorlage),
    ueberzeile: freitext(UEBERZEILE_MAX, S.ueberzeile),
    titel: z
      .string(S.titel)
      .trim()
      .min(1, S.titel)
      .max(TITEL_MAX, S.titelLang),
    text: freitext(TEXT_MAX, S.text),
    bildUrl: z.string().max(500).nullable(),
    linkUrl: z
      .string()
      .trim()
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .refine((v) => v === null || istRelativerLink(v), S.link),
    linkText: freitext(LINK_TEXT_MAX, S.linkText),
    farmIds: z
      .array(KENNUNG)
      .max(HOEFE_AUSWAHL_MAX, S.hoefeMax)
      .refine((ids) => new Set(ids).size === ids.length, S.hoefeDoppelt),
    kategorie: z.enum(PRODUCT_CATEGORY_VALUES).nullable(),
    liveAbTag: TAG,
    liveAbUhrzeit: UHRZEIT,
    liveBisTag: TAG.nullable(),
    liveBisUhrzeit: UHRZEIT.nullable(),
  })
  .superRefine((b, ctx) => {
    if (b.vorlage === 'HOEFE_AUSWAHL' && b.farmIds.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['farmIds'], message: S.hoefeMin })
    }
    if (b.vorlage === 'KATEGORIE_HINWEIS' && b.kategorie === null) {
      ctx.addIssue({ code: 'custom', path: ['kategorie'], message: S.kategorie })
    }
    const ab = zeitpunktAusEingabe(b.liveAbTag, b.liveAbUhrzeit)
    if (!ab) {
      ctx.addIssue({ code: 'custom', path: ['liveAbUhrzeit'], message: S.umstellung })
      return
    }
    if (b.liveBisTag === null) return
    const bis = zeitpunktAusEingabe(b.liveBisTag, b.liveBisUhrzeit ?? '23:59')
    if (!bis) {
      ctx.addIssue({ code: 'custom', path: ['liveBisUhrzeit'], message: S.umstellung })
    } else if (bis.getTime() <= ab.getTime()) {
      ctx.addIssue({ code: 'custom', path: ['liveBisTag'], message: S.bisNachAb })
    }
  })

export type StartseitenBlockEingabe = z.input<typeof startseitenBlockSchema>
export type StartseitenBlockGeprueft = z.output<typeof startseitenBlockSchema>

/**
 * Speichern = die ganze Liste (Reihenfolge und Auge) und höchstens ein Block
 * in EINER Transaktion. Ein neuer Block steht in der Reihenfolge als
 * `NEUER_BLOCK` (src/lib/startseite-gestalten.ts).
 */
export const startseiteSpeichernSchema = z.object({
  reihenfolge: z
    .array(z.object({ id: KENNUNG, sichtbar: z.boolean() }))
    .min(1)
    .max(100),
  block: startseitenBlockSchema.nullable(),
})

export type StartseiteSpeichernEingabe = z.input<typeof startseiteSpeichernSchema>

export const blockLoeschenSchema = z.object({ blockId: KENNUNG })

export const vorschauAnfrageSchema = z.object({
  stand: z.enum(['heute', 'woche', 'block']),
  blockEntwurfId: KENNUNG.nullable(),
})

/** Der Vorschau-Parameter in der Adresse ist Fremddaten: Unsinn heißt „keine Vorschau", nie ein Fehler. */
export const vorschauParameterSchema = z.object({
  vorschau: z.string().max(400).regex(/^[A-Za-z0-9_-]+$/),
  sig: z.string().regex(/^[a-f0-9]{64}$/),
})
export type VorschauParameter = z.infer<typeof vorschauParameterSchema>
