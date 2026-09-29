import { z } from 'zod'
import { PRODUCT_UNIT_VALUES } from '@/schemas/product'
import { verkaufskanalSchema } from '@/schemas/verkaufskanal'

export const CHANNEL_LABELS: Record<string, string> = {
  PLATFORM: 'Plattform',
  WHATSAPP: 'WhatsApp',
  HOFLADEN: 'Hofladen',
  MARKT: 'Markt',
  BUSINESS: 'Geschäftskunde',
  OTHER: 'Sonstiges',
}

export const CHANNEL_ICONS: Record<string, string> = {
  PLATFORM: '🖥️',
  WHATSAPP: '💬',
  HOFLADEN: '🏡',
  MARKT: '🛒',
  BUSINESS: '🤝',
  OTHER: '···',
}

// Betrag zuerst, alles andere freiwillig: Ohne Produkt und Menge speichert
// die Action „Ohne Angabe" und 1 (verkaufOhneAngaben in
// src/lib/verkauf-eintragen.ts) — Name und Menge sind im Schema Pflicht.
export const manualSaleFormSchema = z.object({
  productId: z.string().nullable().optional(),
  productName: z.string().trim().max(100, 'Höchstens 100 Zeichen').optional(),
  quantity: z.number({ error: 'Bitte nur Zahlen, z. B. 2,5.' }).positive('Menge muss größer als 0 sein').nullable().optional(),
  // Dieselbe Liste wie am Produkt — sonst scheitert ein Verkauf von Ballen/Big Bags (Bereiche 1).
  unit: z.enum(PRODUCT_UNIT_VALUES).nullable().optional(),
  totalAmount: z
    .number({ error: 'Bitte gib einen Betrag ein.' })
    .positive('Bitte gib einen Betrag ein.')
    .max(1_000_000, 'Dieser Betrag ist zu hoch.'),
  channel: verkaufskanalSchema,
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitte wähl oben ein Datum aus.'),
  note: z.string().max(500).optional().or(z.literal('')),
})

export type ManualSaleFormData = z.infer<typeof manualSaleFormSchema>
