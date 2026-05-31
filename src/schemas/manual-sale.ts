import { z } from 'zod'

export const CHANNEL_OPTIONS = [
  { value: 'WHATSAPP', label: 'WhatsApp', icon: '💬' },
  { value: 'HOFLADEN', label: 'Hofladen', icon: '🏡' },
  { value: 'MARKT', label: 'Markt', icon: '🛒' },
  { value: 'BUSINESS', label: 'Geschäftskunde', icon: '🤝' },
  { value: 'OTHER', label: 'Sonstiges', icon: '···' },
] as const

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

export const manualSaleFormSchema = z.object({
  productId: z.string().nullable().optional(),
  productName: z.string().min(1, 'Produktname erforderlich').max(100),
  quantity: z.coerce.number().positive('Menge muss größer als 0 sein'),
  unit: z.enum(['STUECK', 'KG', 'G', 'LITER', 'ML', 'M3', 'PAKET']).nullable().optional(),
  totalAmount: z.coerce.number().positive('Betrag muss größer als 0 sein'),
  channel: z.enum(['WHATSAPP', 'HOFLADEN', 'MARKT', 'BUSINESS', 'OTHER']),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datum'),
  note: z.string().max(500).optional().or(z.literal('')),
})

export type ManualSaleFormData = z.infer<typeof manualSaleFormSchema>
