import { z } from 'zod'

// Client-side form schema (no items/sessionId/farmId — those are added on submit)
export const checkoutFormSchema = z.object({
  customerName: z.string().min(2, 'Name muss mindestens 2 Zeichen haben'),
  customerEmail: z.string().email('Ungültige E-Mail-Adresse'),
  customerPhone: z.string().min(4, 'Telefonnummer ist zu kurz'),
  customerNote: z.string().optional(),
  // "YYYY-MM-DD|HH:MM|HH:MM" — encoded slot key
  pickupSlotKey: z.string().min(1, 'Bitte wähle einen Abholtermin'),
  paymentMethod: z.enum(['ONLINE', 'ONSITE_CASH', 'ONSITE_CARD']),
  onsiteConfirmed: z.boolean().optional(),
  optInEmail: z.boolean().default(false),
  optInWhatsApp: z.boolean().default(false),
})

export type CheckoutFormData = z.infer<typeof checkoutFormSchema>

// Server-side checkout request schema
export const checkoutRequestSchema = z.object({
  farmId: z.string().min(1),
  farmSlug: z.string().min(1),
  sessionId: z.string().min(1),
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(4),
  customerNote: z.string().optional(),
  pickupDate: z.string().min(1),       // ISO date string "YYYY-MM-DD"
  pickupTimeStart: z.string().min(1),  // "HH:MM"
  pickupTimeEnd: z.string().min(1),
  paymentMethod: z.enum(['ONLINE', 'ONSITE_CASH', 'ONSITE_CARD']),
  optInEmail: z.boolean().optional().default(false),
  optInWhatsApp: z.boolean().optional().default(false),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        name: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
      })
    )
    .min(1, 'Warenkorb ist leer'),
})

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>
