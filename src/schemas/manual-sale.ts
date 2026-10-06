import { z } from 'zod'
import { PRODUCT_UNIT_VALUES } from '@/schemas/product'
import { verkaufskanalSchema } from '@/schemas/verkaufskanal'
import { NOTIZ_MAX, PRODUKTNAME_MAX, VERKAUF_BETRAG_MAX, VERKAUF_MENGE_MAX, ZU_LANG } from '@/lib/eingabegrenzen'
import { tagVersetzt } from '@/lib/kalender'

export const CHANNEL_LABELS: Record<string, string> = {
  PLATFORM: 'Plattform',
  WHATSAPP: 'WhatsApp',
  HOFLADEN: 'Hofladen',
  MARKT: 'Markt',
  BUSINESS: 'Geschäftskunde',
  OTHER: 'Sonstiges',
}

const DATUM_FEHLT = 'Bitte wähl oben ein Datum aus.'

/** Ein echter Kalendertag: 2026-02-31 wäre sonst still der 3. März. */
function istKalendertag(tag: string): boolean {
  return tagVersetzt(tag, 0) === tag
}

// Betrag zuerst, alles andere freiwillig: Ohne Produkt und Menge speichert
// die Action „Ohne Angabe" und 1 (verkaufOhneAngaben in
// src/lib/verkauf-eintragen.ts) — Name und Menge sind im Schema Pflicht.
export const manualSaleFormSchema = z.object({
  productId: z.string().nullable().optional(),
  productName: z.string().trim().max(PRODUKTNAME_MAX, ZU_LANG.produktname).optional(),
  quantity: z
    .number({ error: 'Bitte nur Zahlen, z. B. 2,5.' })
    .positive('Menge muss größer als 0 sein')
    .max(VERKAUF_MENGE_MAX, 'Diese Menge ist zu groß. Bitte prüf die Zahl.')
    .nullable()
    .optional(),
  // Dieselbe Liste wie am Produkt — sonst scheitert ein Verkauf von Ballen/Big Bags (Bereiche 1).
  unit: z.enum(PRODUCT_UNIT_VALUES).nullable().optional(),
  totalAmount: z
    .number({ error: 'Bitte gib einen Betrag ein.' })
    .positive('Bitte gib einen Betrag ein.')
    .max(VERKAUF_BETRAG_MAX, 'Dieser Betrag ist zu hoch.'),
  channel: verkaufskanalSchema,
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, DATUM_FEHLT).refine(istKalendertag, DATUM_FEHLT),
  note: z.string().max(NOTIZ_MAX, ZU_LANG.notiz).optional().or(z.literal('')),
})

export type ManualSaleFormData = z.infer<typeof manualSaleFormSchema>

/** Die Kennung eines Verkaufs aus dem Browser — Fremddaten, bevor sie in eine WHERE-Klausel geht. */
export const verkaufIdSchema = z.string().min(1).max(64)
