import { z } from 'zod'
import { PRODUCT_CATEGORY_VALUES } from '@/lib/taxonomie'
import {
  HOEFE_AUSWAHL_MAX,
  LINK_TEXT_MAX,
  STANDARD_REIHENFOLGE,
  TEXT_MAX,
  TITEL_MAX,
  UEBERZEILE_MAX,
  VORLAGEN,
  istRelativerLink,
  istZusatzArt,
  pruefeReihenfolge,
  type AbschnittArt,
} from '@/lib/startseite-gestalten'

/*
 * Das Format einer Fassung der Startseite (Register N16, Änderung Nr. 99) —
 * die Spalte StartseiteFassung.inhalt. EIN Format für alles, was die Seite
 * zeigen kann: die Live-Fassung, eine geplante, eine frühere und den Entwurf
 * (src/lib/startseite-fassung.ts, fassungAusEntwurf). Strikt (fremde Felder
 * sind ein Fehler), Version `v: 1`; dieselben Grenzen wie startseitenBlockSchema
 * und dieselbe Regel für die festen Abschnitte (pruefeReihenfolge) — aus
 * src/lib/startseite-gestalten.ts, nicht kopiert.
 *
 * Gelesen wird eine gespeicherte Fassung nur über leseFassung
 * (src/server/queries/startseite.ts): ungültig heißt null und eine Meldung
 * nach Sentry ohne Inhalt, nie ein Wurf auf der Startseite.
 *
 * `id` am Block ist die Kennung des Entwurfs-Blocks, aus dem er stammt
 * (Annahme Nr. 99, im Bericht): Daran erkennt „Was sich gegenüber live
 * ändert“ einen geänderten Block statt „entfernt + neu“, und „Als Entwurf
 * übernehmen“ legt ihn unter derselben Kennung wieder an.
 */

const KENNUNG = z.string().min(1).max(40)

/** Ein Standard-Abschnitt oder ein Zusatz-Abschnitt (Nr. 129: „Neu bei den Höfen“) — die Zahl regelt pruefeReihenfolge. */
function istAbschnittArt(wert: unknown): wert is AbschnittArt {
  return (STANDARD_REIHENFOLGE as readonly unknown[]).includes(wert) || istZusatzArt(wert)
}

/** Ein Zeitpunkt als ISO-Text (UTC, wie toISOString ihn schreibt). */
const ZEITPUNKT = z.iso.datetime()

export const fassungBlockSchema = z
  .strictObject({
    id: KENNUNG.optional(),
    vorlage: z.enum(VORLAGEN),
    ueberzeile: z.string().min(1).max(UEBERZEILE_MAX).optional(),
    titel: z.string().min(1).max(TITEL_MAX),
    text: z.string().min(1).max(TEXT_MAX).optional(),
    bildUrl: z.string().min(1).max(500).optional(),
    linkUrl: z.string().refine(istRelativerLink).optional(),
    linkText: z.string().min(1).max(LINK_TEXT_MAX).optional(),
    farmIds: z
      .array(KENNUNG)
      .max(HOEFE_AUSWAHL_MAX)
      .refine((ids) => new Set(ids).size === ids.length),
    kategorie: z.enum(PRODUCT_CATEGORY_VALUES).optional(),
    liveAb: ZEITPUNKT,
    liveBis: ZEITPUNKT.optional(),
  })
  .refine((b) => b.vorlage !== 'HOEFE_AUSWAHL' || b.farmIds.length > 0)
  .refine((b) => b.vorlage !== 'KATEGORIE_HINWEIS' || b.kategorie !== undefined)
  .refine((b) => b.liveBis === undefined || Date.parse(b.liveBis) > Date.parse(b.liveAb))

/** Ein Block nur an einer BLOCK-Zeile, nie an einem festen Abschnitt — als Typ und als Prüfung. */
export const fassungZeileSchema = z.union([
  z.strictObject({ art: z.custom<AbschnittArt>(istAbschnittArt), sichtbar: z.boolean() }),
  z.strictObject({ art: z.literal('BLOCK'), sichtbar: z.boolean(), block: fassungBlockSchema }),
])

export const fassungInhaltSchema = z
  .strictObject({
    v: z.literal(1),
    zeilen: z.array(fassungZeileSchema).min(STANDARD_REIHENFOLGE.length).max(100),
  })
  // Feste Abschnitte an ihren Plätzen, jeder Abschnitt genau einmal — dieselbe Regel wie beim Speichern.
  .refine((f) => pruefeReihenfolge(f.zeilen) === null)

export type FassungBlock = z.infer<typeof fassungBlockSchema>
export type FassungZeile = z.infer<typeof fassungZeileSchema>
export type FassungInhalt = z.infer<typeof fassungInhaltSchema>

// ─── Systemgrenzen der Actions ──────────────────────────────────────────────

const TAG = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const UHRZEIT = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

/** „Veröffentlichen …": jetzt, oder zu Tag und Uhrzeit in Wiener Zeit. */
export const veroeffentlichenSchema = z.discriminatedUnion('wann', [
  z.strictObject({ wann: z.literal('jetzt') }),
  z.strictObject({ wann: z.literal('termin'), datum: TAG, uhrzeit: UHRZEIT }),
])
export type VeroeffentlichenEingabe = z.infer<typeof veroeffentlichenSchema>

/** Zurückziehen: nur die Kennung der Fassung. */
export const fassungWahlSchema = z.strictObject({ id: KENNUNG })

/** „Als Entwurf übernehmen" bzw. „Entwurf verwerfen": eine Fassung — oder null für die Standard-Reihenfolge (es gibt noch keine). */
export const entwurfUebernehmenSchema = z.strictObject({ id: KENNUNG.nullable() })
