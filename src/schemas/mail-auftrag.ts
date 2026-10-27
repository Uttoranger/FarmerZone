import { z } from 'zod'

/*
 * Die Mail-Warteschlange (Register N26, Nr. 158): welche Arten es gibt, welche
 * Stände ein Auftrag hat und was in `bezug` stehen darf. Hier, weil `art` und
 * `bezug` als Text bzw. JSON in der Datenbank stehen und beim Lesen geprüft
 * werden — und weil Admin › Betrieb (Nr. 161) dieselben Namen filtert.
 */

/**
 * Jede Mail, die das System verschickt — ein Name je `send…`- bzw.
 * `baue…`-Funktion in src/lib/email.ts, dazu die Testmail (/api/test-email)
 * und der Bescheid an Kundinnen. Welcher Weg zu welcher Art gehört, steht in
 * `MAIL_WEG` (Nr. 159); die Wache tests/mail-wege-wache.test.ts hält Liste,
 * Versandfunktionen und Renderer zusammen.
 */
export const MAIL_ARTEN = [
  // Sofort: Code, Einmal-Link oder Bestätigungslink — direkt, nur Protokoll.
  'anmeldecode',
  'bestellcode',
  'login-link',
  'passwort-link',
  'email-bestaetigung',
  'registrierungs-hinweis',
  'bar-bestaetigungslink',
  'admin-sicherheit',
  'neue-anmeldung',
  'zu-viele-versuche',
  'betrieb-warnung',
  'testmail',
  'betreiber-bestaetigung',
  // Konto-Anfragen und Team (Nr. 190): Einmal-Link bzw. Sicherheitsmail — direkt.
  'email-aendern-link',
  'email-geaendert-hinweis',
  'team-recht-geaendert',
  // Wichtig: Bestellungen, Höfe und Betreiber.
  'bestellung-bestaetigung',
  'bestellung-bezahlt-hof',
  'bar-bestaetigt-hof',
  'abholbereit',
  'nicht-abholbereit',
  'storniert',
  'artikel-fehlt',
  'verfallen',
  'zahlung-zu-spaet',
  'erstattung-offen',
  'neuer-hof',
  'freischaltung',
  'meldung',
  'wochenbericht',
  'postfach',
  'antwort-an-team',
  'betreiber-testmail',
  'abo-bestaetigung',
  // Kann warten: Beiträge, Rundschreiben, Bescheide.
  'beitrag',
  'rundschreiben',
  'bescheid',
] as const

export const mailArtSchema = z.enum(MAIL_ARTEN)
export type MailArt = z.infer<typeof mailArtSchema>

/** Der Weg einer Mail im Code; auf Admin-Seiten heißen sie „Sofort“, „Wichtig“, „Kann warten“ (Wortliste N8). */
export const VORRANG = { sofort: 0, wichtig: 1, kannWarten: 2 } as const
export type Vorrang = (typeof VORRANG)[keyof typeof VORRANG]

/**
 * Der Weg jeder Art (Register N26, Nr. 159) — EINE Liste für Einstellen,
 * Renderer-Tabelle, Wache und Admin › Betrieb. Sofort heißen die Mails mit
 * Code, Einmal-Link oder Bestätigungslink: Ihr Token oder Code darf nie in
 * die Tabelle, deshalb gehen sie direkt. Die Bestätigung einer weiteren
 * Betreiber-Adresse gehört dazu, obwohl Nr. 159 sie unter Wichtig nannte —
 * gespeichert ist nur der Hash ihres Tokens, ein Renderer könnte den Link nie
 * neu bauen (N26: Bestätigungslink geht direkt). Die Abo-Bestätigung dagegen
 * ist Wichtig: Ihr Link ist aus Abo und Anfragezeitpunkt signiert und
 * entsteht beim Versand frisch.
 */
export const MAIL_WEG = {
  anmeldecode: 'sofort',
  bestellcode: 'sofort',
  'login-link': 'sofort',
  'passwort-link': 'sofort',
  'email-bestaetigung': 'sofort',
  'registrierungs-hinweis': 'sofort',
  'bar-bestaetigungslink': 'sofort',
  'admin-sicherheit': 'sofort',
  'neue-anmeldung': 'sofort',
  'zu-viele-versuche': 'sofort',
  'betrieb-warnung': 'sofort',
  testmail: 'sofort',
  'betreiber-bestaetigung': 'sofort',
  'email-aendern-link': 'sofort',
  'email-geaendert-hinweis': 'sofort',
  'team-recht-geaendert': 'sofort',
  'bestellung-bestaetigung': 'wichtig',
  'bestellung-bezahlt-hof': 'wichtig',
  'bar-bestaetigt-hof': 'wichtig',
  abholbereit: 'wichtig',
  'nicht-abholbereit': 'wichtig',
  storniert: 'wichtig',
  'artikel-fehlt': 'wichtig',
  verfallen: 'wichtig',
  'zahlung-zu-spaet': 'wichtig',
  'erstattung-offen': 'wichtig',
  'neuer-hof': 'wichtig',
  freischaltung: 'wichtig',
  meldung: 'wichtig',
  wochenbericht: 'wichtig',
  postfach: 'wichtig',
  'antwort-an-team': 'wichtig',
  'betreiber-testmail': 'wichtig',
  'abo-bestaetigung': 'wichtig',
  beitrag: 'kannWarten',
  rundschreiben: 'kannWarten',
  bescheid: 'kannWarten',
} as const satisfies Record<MailArt, keyof typeof VORRANG>

/** Die Arten eines Wegs — eingestellt werden nur Wichtig und Kann warten. */
export type WichtigeArt = { [A in MailArt]: (typeof MAIL_WEG)[A] extends 'wichtig' ? A : never }[MailArt]
export type KannWartenArt = { [A in MailArt]: (typeof MAIL_WEG)[A] extends 'kannWarten' ? A : never }[MailArt]

export const MAIL_STATUS = ['offen', 'in_arbeit', 'gesendet', 'gescheitert', 'gesperrt', 'ohne_schluessel', 'verworfen'] as const
export const mailStatusSchema = z.enum(MAIL_STATUS)
export type MailStatus = z.infer<typeof mailStatusSchema>

/**
 * Eine Kennung (cuid, uuid, Slug-artige ID) — nie eine Adresse (kein @), nie
 * Text (kein Leerzeichen), nie ein Token (höchstens 64 Zeichen).
 */
const kennung = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)

/**
 * Der Bezug eines Auftrags: nur Kennungen unter Namen, die auf `Id` enden
 * (`orderId`, `aboId`, `postId` …), höchstens vier. So kann `bezug` keine
 * Adresse, keinen Namen, keinen Text und keinen Token tragen (N26).
 * Arten mit festem Bezug haben ein eigenes Schema in BEZUG_JE_ART.
 */
const kennungen = z
  .record(z.string().regex(/^[a-z][A-Za-z]{0,30}Id$/), kennung)
  .refine((b) => Object.keys(b).length <= 4)

/**
 * Ein Betrag oder eine Zahl, die beim Ereignis feststand (z. B. die Erstattung,
 * die Stripe eben gebucht hat) — als Ziffern, nie neu gerechnet (§2 Geld der
 * Freigabe): Der Renderer zeigt genau diesen Wert. Keine Personenangabe, kein
 * Text, kein Token.
 */
const ganzzahl = z.string().regex(/^(0|[1-9][0-9]{0,9})$/)

/** Zu wem eine Betreiber-Mail geht: `support` (die feste Adresse) oder die Kennung einer bestätigten weiteren Adresse. */
export const SUPPORT_EMPFAENGER = 'support'

/**
 * Was der Betreiber bei „Erstattung offen“ von Hand tun muss — der Fall
 * wählt Satz und Anweisung aus src/lib/erstattung-offen.ts (ein fester
 * Code statt Text in der Tabelle).
 */
export const ERSTATTUNG_OFFEN_FAELLE = [
  'storno_rest',
  'storno_rest_ohne_betraege',
  'storno_voll',
  'storno_unbekannt',
  'schon_erledigt',
  'vollstorno_zurueckgenommen',
  'zurueckgenommen',
  'unklar',
  'fremd',
] as const
export type ErstattungOffenFall = (typeof ERSTATTUNG_OFFEN_FAELLE)[number]

/** Beitrag an ein Abo: Schlüssel `beitrag:<postId>:<aboId>`. */
export const beitragBezugSchema = z.object({ postId: kennung, aboId: kennung }).strict()
export type BeitragBezug = z.infer<typeof beitragBezugSchema>

/** Eine Mail zu einer Bestellung: nur ihre Kennung. */
export const bestellungBezugSchema = z.object({ orderId: kennung }).strict()
/**
 * Wie es um die Erstattung eines Online-Stornos steht: `ausstehend`, solange
 * Stripe noch nicht geantwortet hat (der Auftrag steht schon in der
 * Storno-Transaktion), `offen`, wenn die Erstattung gescheitert ist.
 */
export const STORNO_ERSTATTUNG = ['ausstehend', 'offen'] as const
/**
 * Storno: dazu die Erstattung in Cent, sobald Stripe online erstattet hat,
 * oder ihr Stand (`erstattung`), solange kein Betrag feststeht. Beides fehlt =
 * nichts zu erstatten (vor Ort, online nie bezahlt).
 */
export const stornoBezugSchema = z
  .object({ orderId: kennung, erstattetCents: ganzzahl.optional(), erstattung: z.enum(STORNO_ERSTATTUNG).optional() })
  .strict()
  .refine((b) => b.erstattetCents === undefined || b.erstattung === undefined)
/** „Artikel fehlt": Position und die Beträge aus der Rechnung beim Speichern; Erstattung nur online. */
export const artikelFehltBezugSchema = z
  .object({ orderId: kennung, itemId: kennung, bisherCents: ganzzahl, neuCents: ganzzahl, erstattetCents: ganzzahl.optional() })
  .strict()
/** Zahlung zu spät: die Erstattung, die Stripe eben gebucht hat. */
export const zahlungZuSpaetBezugSchema = z.object({ orderId: kennung, erstattetCents: ganzzahl }).strict()
export const erstattungOffenBezugSchema = z
  .object({
    empfaengerId: kennung,
    fall: z.enum(ERSTATTUNG_OFFEN_FAELLE),
    orderId: kennung.optional(),
    refundId: kennung.optional(),
    kundinCents: ganzzahl.optional(),
    hofCents: ganzzahl.optional(),
  })
  .strict()
export const hofBetreiberBezugSchema = z.object({ farmId: kennung, empfaengerId: kennung }).strict()
export const hofBezugSchema = z.object({ farmId: kennung }).strict()
export const meldungBetreiberBezugSchema = z.object({ meldungId: kennung, empfaengerId: kennung }).strict()
/** Wochenbericht: wie viele Meldungen der Lauf eben gelöscht hat — die übrigen Zahlen zählt der Renderer frisch. */
export const wochenberichtBezugSchema = z.object({ empfaengerId: kennung, geloeschtAnzahl: ganzzahl }).strict()
export const nachrichtBezugSchema = z.object({ nachrichtId: kennung }).strict()
export const nachrichtBetreiberBezugSchema = z.object({ nachrichtId: kennung, empfaengerId: kennung }).strict()
export const betreiberBezugSchema = z.object({ empfaengerId: kennung }).strict()
export const aboBezugSchema = z.object({ aboId: kennung }).strict()
export const fadenBezugSchema = z.object({ unterhaltungId: kennung }).strict()
export const meldungBezugSchema = z.object({ meldungId: kennung }).strict()

/** Der feste Bezug jeder eingestellten Art (Nr. 159) — Sofort-Arten werden nie eingestellt. */
const BEZUG_JE_ART: Partial<Record<MailArt, z.ZodType<Record<string, string>>>> = {
  'bestellung-bestaetigung': bestellungBezugSchema,
  'bestellung-bezahlt-hof': bestellungBezugSchema,
  'bar-bestaetigt-hof': bestellungBezugSchema,
  abholbereit: bestellungBezugSchema,
  'nicht-abholbereit': bestellungBezugSchema,
  verfallen: bestellungBezugSchema,
  storniert: stornoBezugSchema,
  'artikel-fehlt': artikelFehltBezugSchema,
  'zahlung-zu-spaet': zahlungZuSpaetBezugSchema,
  'erstattung-offen': erstattungOffenBezugSchema,
  'neuer-hof': hofBetreiberBezugSchema,
  freischaltung: hofBezugSchema,
  meldung: meldungBetreiberBezugSchema,
  wochenbericht: wochenberichtBezugSchema,
  postfach: nachrichtBezugSchema,
  'antwort-an-team': nachrichtBetreiberBezugSchema,
  'betreiber-testmail': betreiberBezugSchema,
  'abo-bestaetigung': aboBezugSchema,
  beitrag: beitragBezugSchema,
  rundschreiben: fadenBezugSchema,
  bescheid: meldungBezugSchema,
}

/** Das Schema für den Bezug einer Art (fest, sonst nur Kennungen). */
export function bezugSchemaFuer(art: MailArt): z.ZodType<Record<string, string>> {
  return BEZUG_JE_ART[art] ?? kennungen
}
