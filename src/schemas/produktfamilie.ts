import { z } from 'zod'
import {
  ABGABE_VALUES,
  BEREICH_KATEGORIEN,
  KATEGORIE_LABEL,
  PRODUCT_SUBCATEGORY_VALUES,
  TROCKNUNG_VALUES,
  futtermittelartenFuer,
  futtermittelartSatz,
  gehoertZu,
  hatUnterkategorien,
} from '@/lib/taxonomie'
import { VERPACKUNG_VALUES } from '@/lib/futter-registrierung'
import {
  BRENN_GROESSEN_EINHEITEN,
  FUTTER_GROESSEN_EINHEITEN,
  GELAGERT_JAHRE_MAX,
  GROESSE_BEZEICHNUNG_MAX,
  GROESSEN_MAX,
  einheitPasstZurArt,
  namePasstFuerGroessen,
} from '@/lib/verkaufsgroessen'
import { PRODUKTNAME_MAX, VORRAT_MAX, ZU_LANG } from '@/lib/eingabegrenzen'
import { FUTTER_FEHLER, futterKennzeichnungSchema, nettoMengeZahl, preisZahl } from '@/schemas/product'

/*
 * Futter und Brennmaterial mit Verkaufsgrößen (Register E3, E10, E11; Gate 6,
 * Nachtlauf Nr. 20). EIN Formular legt je Größe ein Produkt an; die Server
 * Actions in src/server/actions/produktfamilie.ts prüfen mit genau diesen
 * Schemas. Die Sperre je Gebinde (S7) entscheidet NICHT das Schema — welche
 * Größe online geht, hängt an der Registrierung des Hofs und wird beim
 * Speichern serverseitig entschieden (src/lib/futter-registrierung.ts).
 */

export const FAMILIE_FEHLER = {
  groessen: 'Bitte wähle mindestens eine Verkaufsgröße.',
  zuVieleGroessen: `Höchstens ${GROESSEN_MAX} Größen je Produkt.`,
  bezeichnung: 'Bitte gib der Größe einen Namen, z. B. „5 kg-Sack".',
  doppelt: 'Zwei Größen heißen gleich — bitte eine umbenennen.',
  nameZuLang: `Name und Größe zusammen dürfen höchstens ${PRODUKTNAME_MAX} Zeichen haben — bitte kürzen.`,
  vorrat: 'Bitte eine ganze Zahl ab 0 eintippen.',
  kategorie: 'Bitte wähle, welches Futter es ist.',
  holzart: 'Bitte gib die Holzart an, z. B. Buche.',
  scheitlaenge: 'Bitte wähle die Scheitlänge — das fragt jeder Käufer.',
  wassergehalt: 'Bitte wähle den Wassergehalt der Hackschnitzel.',
  koernung: 'Bitte wähle die Körnung der Hackschnitzel.',
  raummeterHackschnitzel: 'Hackschnitzel gibt es nur lose — bitte Schüttraummeter statt Raummeter.',
} as const

/** Getippter Vorrat: ganze Zahl ab 0, höchstens VORRAT_MAX (wie die Produkttabelle). */
const vorratZahl = z.coerce
  .number({ error: FAMILIE_FEHLER.vorrat })
  .int(FAMILIE_FEHLER.vorrat)
  .min(0, FAMILIE_FEHLER.vorrat)
  .max(VORRAT_MAX, `Höchstens ${VORRAT_MAX.toLocaleString('de-AT')} – bitte prüf die Zahl.`)

const bezeichnungFeld = z.string().trim().min(1, FAMILIE_FEHLER.bezeichnung).max(GROESSE_BEZEICHNUNG_MAX, FAMILIE_FEHLER.bezeichnung)

const nameFeld = z.string().trim().min(2, 'Mindestens 2 Zeichen').max(PRODUKTNAME_MAX, ZU_LANG.produktname)

const beschreibungFeld = z.string().trim().max(1000, 'Maximal 1000 Zeichen').optional().or(z.literal(''))

/** Gemeinsame Prüfung beider Formulare: Größen eindeutig, jeder Name passt in die Grenze. */
function pruefeGroessen(
  daten: { name: string; groessen: readonly { bezeichnung: string }[] },
  ctx: z.RefinementCtx
): void {
  const gesehen = new Set<string>()
  daten.groessen.forEach((g, i) => {
    const schluessel = g.bezeichnung.trim().toLocaleLowerCase('de')
    if (gesehen.has(schluessel)) ctx.addIssue({ code: 'custom', path: ['groessen', i, 'bezeichnung'], message: FAMILIE_FEHLER.doppelt })
    gesehen.add(schluessel)
  })
  if (!namePasstFuerGroessen(daten.name, daten.groessen.map((g) => g.bezeichnung))) {
    ctx.addIssue({ code: 'custom', path: ['name'], message: FAMILIE_FEHLER.nameZuLang })
  }
}

// ─── Futter ────────────────────────────────────────────────────────────────

export const FUTTER_KATEGORIEN = BEREICH_KATEGORIEN.FUTTERMITTEL

export const futterGroesseSchema = z.object({
  bezeichnung: bezeichnungFeld,
  verpackung: z.enum(VERPACKUNG_VALUES),
  unit: z.enum(FUTTER_GROESSEN_EINHEITEN),
  /** Inhalt eines Gebindes in kg — daraus der Kilopreis und die Kennzeichnung je Gebinde. */
  nettoMenge: nettoMengeZahl,
  price: preisZahl,
  stock: vorratZahl,
})

/** Die Kennzeichnung gilt für alle Größen gleich — nur die Nettomenge kommt je Größe. */
export const familienKennzeichnungSchema = futterKennzeichnungSchema.omit({ nettoMenge: true, nettoEinheit: true })

export const futterFamilieSchema = z
  .object({
    name: nameFeld,
    description: beschreibungFeld,
    category: z.enum(FUTTER_KATEGORIEN, { error: FAMILIE_FEHLER.kategorie }),
    subcategory: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.enum(PRODUCT_SUBCATEGORY_VALUES).nullable()),
    bio: z.boolean().default(false),
    abgabe: z.enum(ABGABE_VALUES).default('ALLE'),
    kennzeichnung: familienKennzeichnungSchema,
    groessen: z.array(futterGroesseSchema).min(1, FAMILIE_FEHLER.groessen).max(GROESSEN_MAX, FAMILIE_FEHLER.zuVieleGroessen),
  })
  .superRefine((daten, ctx) => {
    pruefeGroessen(daten, ctx)
    // Sorte: Pflicht, wo die Kategorie welche hat (Heu & Stroh, Getreide &
    // Körner — Rückfrage F2), und sie muss dazugehören.
    const sorte = daten.subcategory
    if (sorte === null) {
      if (hatUnterkategorien(daten.category)) ctx.addIssue({ code: 'custom', path: ['subcategory'], message: FUTTER_FEHLER.unterkategorie })
    } else if (!gehoertZu(daten.category, sorte)) {
      ctx.addIssue({
        code: 'custom',
        path: ['subcategory'],
        message: `Diese Sorte passt nicht zu ${KATEGORIE_LABEL[daten.category]}.`,
      })
    }
    const art = daten.kennzeichnung.futtermittelart
    if (art === null || !futtermittelartenFuer(daten.category).includes(art)) {
      ctx.addIssue({
        code: 'custom',
        path: ['kennzeichnung', 'futtermittelart'],
        message: futtermittelartSatz(daten.category) ?? FUTTER_FEHLER.fehlt,
      })
    }
  })

export type FutterFamilieEingabe = z.input<typeof futterFamilieSchema>
export type FutterFamilie = z.infer<typeof futterFamilieSchema>

// ─── Brennmaterial ─────────────────────────────────────────────────────────

export const BRENN_ARTEN = ['BRENNHOLZ_SCHEIT', 'ANZUENDHOLZ', 'HACKSCHNITZEL'] as const

const klasseFeld = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.coerce.number().int().min(1).max(100).nullable()
)

export const brennGroesseSchema = z.object({
  bezeichnung: bezeichnungFeld,
  unit: z.enum(BRENN_GROESSEN_EINHEITEN),
  price: preisZahl,
  stock: vorratZahl,
})

export const brennmaterialFamilieSchema = z
  .object({
    name: nameFeld,
    description: beschreibungFeld,
    art: z.enum(BRENN_ARTEN),
    holzart: z.string().trim().min(2, FAMILIE_FEHLER.holzart).max(60, FAMILIE_FEHLER.holzart),
    scheitlaengeCm: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z.coerce.number().int().min(5).max(300).nullable()
    ),
    trocknung: z.enum(TROCKNUNG_VALUES),
    wassergehalt: klasseFeld,
    koernung: klasseFeld,
    gelagertJahre: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z.coerce.number().int().min(0).max(GELAGERT_JAHRE_MAX).nullable()
    ),
    ueberdacht: z.boolean().default(false),
    groessen: z.array(brennGroesseSchema).min(1, FAMILIE_FEHLER.groessen).max(GROESSEN_MAX, FAMILIE_FEHLER.zuVieleGroessen),
  })
  .superRefine((daten, ctx) => {
    pruefeGroessen(daten, ctx)
    // Welche Angabe je Art Pflicht ist (Schema-Kommentar BrennmaterialAngaben):
    // Scheitlänge bei Brennholz, Wassergehalt und Körnung bei Hackschnitzeln.
    if (daten.art === 'BRENNHOLZ_SCHEIT' && daten.scheitlaengeCm === null) {
      ctx.addIssue({ code: 'custom', path: ['scheitlaengeCm'], message: FAMILIE_FEHLER.scheitlaenge })
    }
    if (daten.art === 'HACKSCHNITZEL') {
      if (daten.wassergehalt === null) ctx.addIssue({ code: 'custom', path: ['wassergehalt'], message: FAMILIE_FEHLER.wassergehalt })
      if (daten.koernung === null) ctx.addIssue({ code: 'custom', path: ['koernung'], message: FAMILIE_FEHLER.koernung })
    }
    daten.groessen.forEach((g, i) => {
      if (!einheitPasstZurArt(daten.art, g.unit)) {
        ctx.addIssue({ code: 'custom', path: ['groessen', i, 'unit'], message: FAMILIE_FEHLER.raummeterHackschnitzel })
      }
    })
  })
  .transform((daten) => ({
    ...daten,
    // Hackschnitzel haben keine Scheitlänge, Scheitholz keine W/P-Klassen —
    // eine übrig gebliebene Wahl aus einer anderen Art wird nicht gespeichert.
    scheitlaengeCm: daten.art === 'HACKSCHNITZEL' ? null : daten.scheitlaengeCm,
    wassergehalt: daten.art === 'HACKSCHNITZEL' ? daten.wassergehalt : null,
    koernung: daten.art === 'HACKSCHNITZEL' ? daten.koernung : null,
  }))

export type BrennmaterialFamilieEingabe = z.input<typeof brennmaterialFamilieSchema>
export type BrennmaterialFamilie = z.infer<typeof brennmaterialFamilieSchema>
