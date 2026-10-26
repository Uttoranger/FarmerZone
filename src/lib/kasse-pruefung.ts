/**
 * Die Komfortprüfung des Kassenformulars im Browser — ohne Zod (Nr. 196).
 *
 * Vorher prüfte das Formular mit `zodResolver(checkoutFormSchema)`; damit lag
 * Zod samt Resolver im Bündel der Kasse. Jetzt prüft eine kleine reine
 * Funktion dieselben Regeln mit denselben Sätzen. Verbindlich bleibt der
 * Server: /api/checkout prüft mit `checkoutRequestSchema` und seinen eigenen
 * Daten (Betriebsnachweis gegen Product.abgabe). `checkoutFormSchema` bleibt in
 * src/schemas/checkout.ts als Beschreibung derselben Form; tests/leistung-196.test.ts
 * hält beide gleich (Gegenprobe an denselben Eingaben).
 */
import type { FieldErrors, Resolver } from 'react-hook-form'
import { pruefeBetriebsnachweis, type KaeuferArtValue } from '@/lib/betriebsnachweis'
import { EMAIL_MAX, NOTIZ_MAX, PERSONENNAME_MAX, TELEFON_MAX, ZU_LANG } from '@/lib/eingabegrenzen'
import { NEUE_BESTELLUNG_ZAHLARTEN, type NeueZahlart } from '@/lib/kasse'

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
] as const

/** Was das Formular nach der Prüfung abschickt — dieselbe Form wie `z.infer<typeof checkoutFormSchema>`. */
export type KasseFormularDaten = {
  customerName: string
  customerEmail: string
  customerPhone: string
  customerNote?: string
  pickupSlotKey: string
  paymentMethod: NeueZahlart
  kaeuferArt: KaeuferArtValue
  betriebsnummer?: string
  nurBetriebeImKorb: boolean
}

type Feld = keyof KasseFormularDaten

export const KASSE_FEHLER = {
  name: 'Bitte gib deinen Namen an – so weiß der Hof, wer abholt.',
  emailLeer: 'Bitte gib deine E-Mail-Adresse an – dorthin schicken wir dir die Bestätigung.',
  emailFalsch: 'Diese E-Mail-Adresse stimmt nicht ganz – bitte prüf sie, zum Beispiel du@beispiel.at.',
  telefon: 'Bitte gib eine Telefonnummer an – der Hof ruft nur an, falls bei der Abholung etwas ist.',
  abholung: 'Bitte wähle einen Abholtermin – so weiß der Hof, wann du kommst.',
  zahlart: 'Bitte wähle, wie du bezahlen möchtest – online jetzt oder bar bei der Abholung.',
  /** Kein Formularfeld lässt das zu; nur eine gebaute Eingabe landet hier. */
  ungueltig: 'Bitte prüf deine Angaben.',
} as const

/** Höchstlänge der Betriebsnummer (wie `checkoutRequestSchema`). */
const BETRIEBSNUMMER_MAX = 100

/**
 * Die Form einer E-Mail-Adresse — derselbe Ausdruck wie Zods `.email()`
 * (zod/v4/core regexes.email); tests/leistung-196.test.ts vergleicht beide.
 */
export const EMAIL_MUSTER = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/

export type KasseFormularErgebnis =
  | { ok: true; daten: KasseFormularDaten }
  | { ok: false; fehler: Partial<Record<Feld, string>> }

/** Prüft die Eingaben des Kassenformulars. Wirft nie; je Feld höchstens ein Satz (der erste, wie zuvor). */
export function pruefeKasseFormular(roh: Record<string, unknown>): KasseFormularErgebnis {
  const fehler: Partial<Record<Feld, string>> = {}
  const text = (wert: unknown): string | null => (typeof wert === 'string' ? wert : null)

  const name = text(roh.customerName)
  if (name === null || name.length < 2) fehler.customerName = KASSE_FEHLER.name
  else if (name.length > PERSONENNAME_MAX) fehler.customerName = ZU_LANG.personenname

  // Leer und falsch sind zwei Meldungen: Erst fehlt die Adresse, dann stimmt sie nicht.
  const emailRoh = text(roh.customerEmail)
  const email = emailRoh === null ? '' : emailRoh.trim().toLowerCase()
  if (emailRoh === null || email.length < 1) fehler.customerEmail = KASSE_FEHLER.emailLeer
  else if (email.length > EMAIL_MAX) fehler.customerEmail = ZU_LANG.email
  else if (!EMAIL_MUSTER.test(email)) fehler.customerEmail = KASSE_FEHLER.emailFalsch

  const telefon = text(roh.customerPhone)
  if (telefon === null || telefon.length < 4) fehler.customerPhone = KASSE_FEHLER.telefon
  else if (telefon.length > TELEFON_MAX) fehler.customerPhone = ZU_LANG.telefon

  const notiz = roh.customerNote === undefined ? undefined : text(roh.customerNote)
  if (notiz === null) fehler.customerNote = KASSE_FEHLER.ungueltig
  else if (notiz !== undefined && notiz.length > NOTIZ_MAX) fehler.customerNote = ZU_LANG.notiz

  const abholung = text(roh.pickupSlotKey)
  if (abholung === null || abholung.length < 1) fehler.pickupSlotKey = KASSE_FEHLER.abholung

  const zahlart = NEUE_BESTELLUNG_ZAHLARTEN.find((wert) => wert === roh.paymentMethod)
  if (zahlart === undefined) fehler.paymentMethod = KASSE_FEHLER.zahlart

  const kaeuferArt: KaeuferArtValue | undefined =
    roh.kaeuferArt === undefined ? 'PRIVAT' : roh.kaeuferArt === 'PRIVAT' || roh.kaeuferArt === 'BETRIEB' ? roh.kaeuferArt : undefined
  if (kaeuferArt === undefined) fehler.kaeuferArt = KASSE_FEHLER.ungueltig

  const nummerRoh = roh.betriebsnummer === undefined ? undefined : text(roh.betriebsnummer)
  const betriebsnummer = nummerRoh?.trim()
  if (nummerRoh === null || (betriebsnummer !== undefined && betriebsnummer.length > BETRIEBSNUMMER_MAX)) {
    fehler.betriebsnummer = KASSE_FEHLER.ungueltig
  }

  const nurBetriebeImKorb = roh.nurBetriebeImKorb === undefined ? false : roh.nurBetriebeImKorb
  if (typeof nurBetriebeImKorb !== 'boolean') fehler.nurBetriebeImKorb = KASSE_FEHLER.ungueltig

  // Dieselbe Regel wie im Handler (src/lib/betriebsnachweis.ts); sie steht neben
  // den Feldfehlern, damit die Kundin alles auf einmal sieht.
  if (kaeuferArt !== undefined && typeof nurBetriebeImKorb === 'boolean') {
    const nachweis = pruefeBetriebsnachweis({ nurBetriebeImKorb, kaeuferArt, betriebsnummer: betriebsnummer ?? null })
    if (!nachweis.ok && fehler[nachweis.feld] === undefined) fehler[nachweis.feld] = nachweis.meldung
  }

  if (
    Object.keys(fehler).length > 0 ||
    name === null ||
    telefon === null ||
    abholung === null ||
    !zahlart ||
    !kaeuferArt ||
    typeof nurBetriebeImKorb !== 'boolean'
  ) {
    return { ok: false, fehler }
  }
  const daten: KasseFormularDaten = {
    customerName: name,
    customerEmail: email,
    customerPhone: telefon,
    pickupSlotKey: abholung,
    paymentMethod: zahlart,
    kaeuferArt,
    nurBetriebeImKorb,
  }
  if (notiz !== undefined && notiz !== null) daten.customerNote = notiz
  if (betriebsnummer !== undefined) daten.betriebsnummer = betriebsnummer
  return { ok: true, daten }
}

/** Der Resolver für react-hook-form — an der Stelle von `zodResolver(checkoutFormSchema)`. */
export const kasseFormularResolver: Resolver<KasseFormularDaten> = (werte) => {
  const ergebnis = pruefeKasseFormular(werte)
  if (ergebnis.ok) return { values: ergebnis.daten, errors: {} }
  const errors: FieldErrors<KasseFormularDaten> = {}
  for (const [feld, message] of Object.entries(ergebnis.fehler) as [Feld, string][]) {
    errors[feld] = { type: 'validate', message }
  }
  return { values: {}, errors }
}

/**
 * Der Betrag, den /api/checkout beim Anlegen an Stripe gegeben hat — kommt mit
 * jeder Antwort, die ein Client-Secret trägt. Für den Browser eine
 * Systemgrenze: ganze Cent, Gesamtbetrag über 0, Gebühr nicht negativ und nie
 * größer als der Gesamtbetrag (wie `checkoutZahlungsBetragSchema`). Sonst null.
 */
export function leseZahlungsBetrag(roh: unknown): { amountCents: number; serviceFeeCents: number } | null {
  if (typeof roh !== 'object' || roh === null || Array.isArray(roh)) return null
  const { amountCents, serviceFeeCents } = roh as Record<string, unknown>
  if (!Number.isSafeInteger(amountCents) || !Number.isSafeInteger(serviceFeeCents)) return null
  const gesamt = amountCents as number
  const gebuehr = serviceFeeCents as number
  if (gesamt <= 0 || gebuehr < 0 || gebuehr > gesamt) return null
  return { amountCents: gesamt, serviceFeeCents: gebuehr }
}
