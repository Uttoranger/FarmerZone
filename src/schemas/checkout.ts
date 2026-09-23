import { z } from 'zod'
import { KAEUFER_ART_VALUES, pruefeBetriebsnachweis } from '@/lib/betriebsnachweis'

/**
 * Die Reihenfolge der Felder auf der Seite — maßgeblich dafür, zu welchem
 * Feld nach einer fehlgeschlagenen Prüfung gesprungen wird (Bug-Report
 * Befund 6: es sprang an den Seitenanfang statt zum ersten Fehler).
 */
export const CHECKOUT_FELD_REIHENFOLGE = [
  'pickupSlotKey',
  'customerName',
  'customerEmail',
  'customerPhone',
  'customerNote',
  'kaeuferArt',
  'betriebsnummer',
  'paymentMethod',
  'onsiteConfirmed',
] as const

// Client-side form schema (no items/sessionId/farmId — those are added on submit)
export const checkoutFormSchema = z
  .object({
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
    // Abschnitt „Betrieb" (Sprint Bereiche 1). Nur sichtbar, wenn eine
    // Position mit abgabe = NUR_BETRIEBE im Korb liegt.
    kaeuferArt: z.enum(KAEUFER_ART_VALUES).default('PRIVAT'),
    betriebsnummer: z.string().trim().max(100).optional(),
    // Kein Eingabefeld: Die Checkout-Seite setzt es aus der Abgabe der
    // Produkte in der DB. Nur für die Komfortprüfung im Browser — der Handler
    // prüft mit seinen eigenen Daten erneut und liest diesen Wert NIE.
    nurBetriebeImKorb: z.boolean().default(false),
  })
  // Die Abhol-Verpflichtung gehört in die Prüfung, nicht in die Absende-Funktion
  // (Bug-Report Befund 5). Nur so erzeugt sie denselben sichtbaren Fehler wie
  // die übrigen Pflichtfelder und nimmt am Sprung zum ersten Fehler teil.
  .superRefine((daten, ctx) => {
    const vorOrt = daten.paymentMethod === 'ONSITE_CASH' || daten.paymentMethod === 'ONSITE_CARD'
    if (vorOrt && !daten.onsiteConfirmed) {
      ctx.addIssue({
        code: 'custom',
        path: ['onsiteConfirmed'],
        message: 'Bitte bestätige die verbindliche Abholung',
      })
    }
    // Dieselbe Regel wie im Handler (src/lib/betriebsnachweis.ts).
    const nachweis = pruefeBetriebsnachweis(daten)
    if (!nachweis.ok) {
      ctx.addIssue({ code: 'custom', path: [nachweis.feld], message: nachweis.meldung })
    }
  })

export type CheckoutFormData = z.infer<typeof checkoutFormSchema>

// Server-side checkout request schema
export const checkoutRequestSchema = z.object({
  farmId: z.string().min(1),
  farmSlug: z.string().min(1),
  sessionId: z.string().min(1),
  // Beim ÖFFNEN des Checkouts im Browser erzeugt (crypto.randomUUID) und über
  // die ganze Sitzung mitgeschickt. Zweiter Request mit demselben Schlüssel →
  // bestehende Bestellung statt einer zweiten (Bug-Report Befund 4).
  // Optional, damit ein alter, noch offener Tab nicht in einen 400 läuft.
  idempotencyKey: z.string().min(8).max(100).optional(),
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
  // Ob die Käuferart reicht, prüft der Handler gegen Product.abgabe aus der
  // DB (pruefeBetriebsnachweis) — hier nur die Form der Eingabe.
  kaeuferArt: z.enum(KAEUFER_ART_VALUES).optional().default('PRIVAT'),
  betriebsnummer: z.string().trim().max(100).optional(),
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
