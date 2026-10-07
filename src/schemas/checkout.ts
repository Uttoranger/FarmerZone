import { z } from 'zod'
import { KAEUFER_ART_VALUES, pruefeBetriebsnachweis } from '@/lib/betriebsnachweis'
import {
  NOTIZ_MAX,
  PERSONENNAME_MAX,
  TELEFON_MAX,
  ZU_LANG,
} from '@/lib/eingabegrenzen'
import { emailSchema } from '@/schemas/email'
import { NEUE_BESTELLUNG_ZAHLARTEN } from '@/lib/kasse'

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

/** JJJJ-MM-TT — der Wiener Kalendertag des Abholfensters. */
const KALENDERTAG = /^\d{4}-\d{2}-\d{2}$/
/** HH:MM — Wiener Ortszeit, wie PickupSlot.startTime/endTime. */
const UHRZEIT = /^\d{2}:\d{2}$/

// Client-side form schema (no items/sessionId/farmId — those are added on submit)
export const checkoutFormSchema = z
  .object({
    customerName: z
      .string()
      .min(2, 'Name muss mindestens 2 Zeichen haben')
      .max(PERSONENNAME_MAX, ZU_LANG.personenname),
    customerEmail: emailSchema('Ungültige E-Mail-Adresse'),
    customerPhone: z
      .string()
      .min(4, 'Telefonnummer ist zu kurz')
      .max(TELEFON_MAX, ZU_LANG.telefon),
    customerNote: z.string().max(NOTIZ_MAX, ZU_LANG.notiz).optional(),
    // "YYYY-MM-DD|HH:MM|HH:MM" — encoded slot key
    pickupSlotKey: z.string().min(1, 'Bitte wähle einen Abholtermin'),
    // E5: Das Formular bietet nur noch online und bar an
    // (NEUE_BESTELLUNG_ZAHLARTEN, src/lib/kasse.ts). Die Anfrage an den
    // Server (unten) kennt ONSITE_CARD weiter — dort entscheidet die Route
    // NACH der Idempotenz, ob es eine neue Bestellung wäre.
    paymentMethod: z.enum(NEUE_BESTELLUNG_ZAHLARTEN, 'Bitte wähle, wie du bezahlen möchtest'),
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
    if (daten.paymentMethod === 'ONSITE_CASH' && !daten.onsiteConfirmed) {
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
  // Dieselben Obergrenzen wie im Formular — der Server ist die Wahrheit. Die
  // E-Mail kommt bereinigt und klein geschrieben heraus: Sie ist die einzige
  // Kennung der Kundin auf der Bestellung, ein Konto gibt es nicht (E8;
  // src/schemas/email.ts).
  customerName: z.string().min(2).max(PERSONENNAME_MAX, ZU_LANG.personenname),
  customerEmail: emailSchema(),
  customerPhone: z.string().min(4).max(TELEFON_MAX, ZU_LANG.telefon),
  customerNote: z.string().max(NOTIZ_MAX, ZU_LANG.notiz).optional(),
  // Nur die Form — ob es das Fenster beim Hof gibt, ob es in der Zukunft
  // liegt und noch Platz hat, prüft der Handler (src/lib/abholfenster.ts).
  // Ohne Form landete „morgen" als ungültiges Datum in der DB: ein 500.
  pickupDate: z.string().regex(KALENDERTAG, 'Ungültiges Abholdatum'), // "YYYY-MM-DD"
  pickupTimeStart: z.string().regex(UHRZEIT, 'Ungültige Uhrzeit'), // "HH:MM", Wiener Zeit
  pickupTimeEnd: z.string().regex(UHRZEIT, 'Ungültige Uhrzeit'),
  // Mit ONSITE_CARD: Ein alter Tab mit gleichem Schlüssel bekommt seine
  // bestehende Bestellung zurück; eine NEUE lehnt die Route ab (E5,
  // zahlartFuerNeueBestellung in src/lib/kasse.ts).
  paymentMethod: z.enum(['ONLINE', 'ONSITE_CASH', 'ONSITE_CARD']),
  optInEmail: z.boolean().optional().default(false),
  optInWhatsApp: z.boolean().optional().default(false),
  // Ob die Käuferart reicht, prüft der Handler gegen Product.abgabe aus der
  // DB (pruefeBetriebsnachweis) — hier nur die Form der Eingabe.
  kaeuferArt: z.enum(KAEUFER_ART_VALUES).optional().default('PRIVAT'),
  betriebsnummer: z.string().trim().max(100).optional(),
  // Kein `teilenKanal` mehr (Register T1, Nr. 25): Bestellungen bekommen
  // keinen Teilen-Kanal. Ein alter Tab, der das Feld noch schickt, scheitert
  // nicht — z.object verwirft unbekannte Felder still.
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        // NUR GEDULDET, NIE GELESEN: Der Name kommt aus dem Browser und ist
        // Fremdtext. Die Bestellung nimmt den Produktnamen aus der Datenbank
        // (route.ts, bestellPositionsName; tests/checkout-produktname.test.ts).
        // Das Feld steht hier, weil offene Tabs mit altem Code es noch
        // schicken und der neue Code es weiter mitsendet — optional, damit
        // eine Anfrage ohne Namen genauso durchgeht. Nicht mehr Pflicht und
        // nicht mehr gekürzt: Gelesen wird es nicht.
        name: z.string().optional(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
      })
    )
    .min(1, 'Warenkorb ist leer'),
})

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>

/**
 * Der Betrag, den /api/checkout beim Anlegen an Stripe gegeben hat — kommt mit
 * jeder Antwort, die ein Client-Secret trägt. Der Zahlungsschritt zeigt nur
 * diesen Wert (src/lib/kasse.ts, zahlungsBetraege); die Antwort ist für den
 * Browser eine Systemgrenze und wird deshalb geprüft.
 */
export const checkoutZahlungsBetragSchema = z
  .object({
    amountCents: z.number().int().positive(),
    serviceFeeCents: z.number().int().min(0),
  })
  .refine((b) => b.serviceFeeCents <= b.amountCents)

export type CheckoutZahlungsBetrag = z.infer<typeof checkoutZahlungsBetragSchema>
