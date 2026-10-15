/**
 * Die Zustellung des Admin-Postfachs (Register N14, Nachtlauf Nr. 95): welche
 * Einträge zusätzlich per E-Mail hinausgehen und an wen — rein und ohne
 * Datenbank prüfbar (tests/zustellung.test.ts). Ohne env und ohne Node-Module:
 * Die Datei lädt auch im Browser (Formular „Zustellung").
 *
 * Alles landet im Eingang; die Zustellung ist nur der Kanal. Eine Liste für
 * alle Arten: support@PRODUKTION_HOST (SUPPORT_EMAIL) ist fest und hat keine
 * Zeile in der Tabelle, dazu jede BESTÄTIGTE weitere Adresse
 * (BetreiberEmpfaenger, Double-Opt-in wie S11). Die Regeln stehen als Json in
 * PlattformEinstellung.zustellRegeln (Nr. 93); fehlt die Spalte oder ist sie
 * kaputt, gilt das heutige Verhalten (ZUSTELL_STANDARD).
 *
 * Wörter nur aus der Wortliste (Zustellung, Eingang, Aufgabe — nicht
 * „Benachrichtigung"); der Name nur aus MARKE (Register M1).
 */
import { z } from 'zod'
import { SUPPORT_EMAIL } from '@/lib/support'
import { MARKE } from '@/lib/marke'

// ─── Arten und Regeln ────────────────────────────────────────────────────────

/** Jede Betreiber-Mail gehört zu genau einer Art. */
export const ZUSTELL_ARTEN = ['fehlermeldung', 'hofWartet', 'erstattungOffen', 'antwortHof', 'wunschFrage', 'wochenbericht'] as const
export type ZustellArt = (typeof ZUSTELL_ARTEN)[number]

/** Die Arten, die der Admin schalten kann. Erstattung offen und Wünsche/Fragen sind fest (N14). */
export const SCHALTBARE_ARTEN = ['fehlermeldung', 'hofWartet', 'antwortHof', 'wochenbericht'] as const
export type SchaltbareArt = (typeof SCHALTBARE_ARTEN)[number]

/**
 * Die Regeln, wie sie gespeichert werden: je schaltbare Art an (sofort bzw.
 * Wochenbericht) oder aus. Ein fehlender oder kaputter Wert ist kein Fehler,
 * sondern der Standard — eine alte oder von Hand verbogene Zeile stoppt nie
 * eine Mail, die heute rausgeht.
 */
export const zustellRegelnSchema = z
  .object({
    fehlermeldung: z.boolean().default(true).catch(true),
    hofWartet: z.boolean().default(true).catch(true),
    antwortHof: z.boolean().default(true).catch(true),
    wochenbericht: z.boolean().default(true).catch(true),
  })
  .catch({ fehlermeldung: true, hofWartet: true, antwortHof: true, wochenbericht: true })

export type ZustellRegeln = z.infer<typeof zustellRegelnSchema>

/** Das heutige Verhalten (Freigabe §18): Fehler, Hof wartet, Antwort sofort, Wochenbericht an. */
export const ZUSTELL_STANDARD: ZustellRegeln = { fehlermeldung: true, hofWartet: true, antwortHof: true, wochenbericht: true }

/** Die Regeln aus der Json-Spalte — null, fehlende Felder oder Unsinn ergeben den Standard. */
export function zustellRegelnAus(json: unknown): ZustellRegeln {
  return zustellRegelnSchema.parse(json ?? {})
}

/**
 * Geht eine Mail dieser Art hinaus? „Erstattung offen" immer — es geht um
 * Geld der Kundin, die Regel „aus" gibt es dafür nicht. Wünsche und Fragen
 * nie sofort: Sie bleiben im Eingang und stehen im Wochenbericht (N14).
 */
export function regelAn(art: ZustellArt, regeln: ZustellRegeln): boolean {
  if (art === 'erstattungOffen') return true
  if (art === 'wunschFrage') return false
  return regeln[art]
}

/**
 * Die Liste aller Empfänger: SUPPORT_EMAIL fest und zuerst, dann die
 * bestätigten Adressen — jede höchstens einmal, klein geschrieben.
 */
export function empfaengerliste(bestaetigte: readonly string[]): string[] {
  const liste = [SUPPORT_EMAIL.toLowerCase()]
  for (const roh of bestaetigte) {
    const adresse = roh.trim().toLowerCase()
    if (adresse !== '' && !liste.includes(adresse)) liste.push(adresse)
  }
  return liste
}

/**
 * Wer bekommt eine Mail dieser Art? Die EINE Funktion für alle
 * Betreiber-Mails (Register N14): die Liste, wenn die Regel an ist, sonst
 * niemand — „Erstattung offen" ignoriert „aus". `bestaetigte` sind nur
 * Adressen mit bestaetigtAm; eine unbestätigte Adresse bekommt nie eine Mail
 * mit Hofnamen oder Meldungstext.
 */
export function empfaengerFuer(art: ZustellArt, zustellung: { regeln: ZustellRegeln; bestaetigte: readonly string[] }): string[] {
  return regelAn(art, zustellung.regeln) ? empfaengerliste(zustellung.bestaetigte) : []
}

// ─── Weitere Adressen (Double-Opt-in) ────────────────────────────────────────

/** So lange gilt der Link aus der Bestätigungsmail (Freigabe: 48 h). */
export const BESTAETIGUNG_GUELTIG_STUNDEN = 48
export const BESTAETIGUNG_GUELTIG_MS = BESTAETIGUNG_GUELTIG_STUNDEN * 60 * 60 * 1000

/** Rate-Limit „Adresse hinzufügen" je Admin (Freigabe: 5 je Stunde). */
export const HINZUFUEGEN_JE_STUNDE = 5
export const STUNDE_MS = 60 * 60 * 1000
/** Die Testmail höchstens einmal in dieser Spanne (Freigabe: eine je Minute). */
export const TESTMAIL_ABSTAND_MS = 60 * 1000

/** Bis wann ein neuer Link gilt. */
export function tokenBisAb(jetzt: Date): Date {
  return new Date(jetzt.getTime() + BESTAETIGUNG_GUELTIG_MS)
}

export type EmpfaengerZustand = 'bestaetigt' | 'ausstehend' | 'abgelaufen'

/** Bestätigt, wartet auf den Klick (Link gilt noch) oder abgelaufen — die Frist gilt beim Lesen. */
export function empfaengerZustand(e: { bestaetigtAm: Date | null; tokenBis: Date | null }, jetzt: Date): EmpfaengerZustand {
  if (e.bestaetigtAm !== null) return 'bestaetigt'
  return e.tokenBis !== null && e.tokenBis.getTime() > jetzt.getTime() ? 'ausstehend' : 'abgelaufen'
}

/** Die Seite hinter dem Link — ohne Anmeldung erreichbar (eigene Route, nicht unter dem Admin-Layout). */
export const ZUSTELLUNG_BESTAETIGEN_PFAD = '/admin/postfach/zustellung/bestaetigen'

export function bestaetigenPfad(token: string): string {
  return `${ZUSTELLUNG_BESTAETIGEN_PFAD}?token=${encodeURIComponent(token)}`
}

/** Ein Link-Token: 32 zufällige Bytes als base64url — genau 43 Zeichen. */
export const TOKEN_MUSTER = /^[A-Za-z0-9_-]{43}$/

// ─── Texte ───────────────────────────────────────────────────────────────────

/** Die Zeilen der Regeln — EINE Quelle für Formular und Bericht. */
export const ZUSTELL_REGEL_TEXT: Record<ZustellArt, string> = {
  fehlermeldung: 'Fehlermeldung – sofort, je Meldung',
  hofWartet: 'Neuer Hof wartet auf Freischaltung – sofort',
  erstattungOffen: 'Erstattung offen – sofort; Geld, deshalb immer an (nicht abschaltbar)',
  antwortHof: 'Antwort eines Hofs – sofort; aus heißt nur der Zähler im Eingang',
  wunschFrage: 'Wünsche und Fragen – nur im Eingang, gesammelt im Wochenbericht',
  wochenbericht: 'Wochenbericht – montags früh, nur wenn im Eingang etwas offen ist',
}

/** Die Reihenfolge im Formular (Mockup admin-postfach-zustellung). */
export const ZUSTELL_REGEL_REIHENFOLGE: readonly ZustellArt[] = ['fehlermeldung', 'hofWartet', 'erstattungOffen', 'antwortHof', 'wunschFrage', 'wochenbericht']

/** Alle Sätze des Reiters „Zustellung". */
export const ZUSTELLUNG_TEXT = {
  empfaengerTitel: 'Empfänger',
  empfaengerSatz: 'Wer die E-Mails bekommt. Eine Liste für alle Arten.',
  empfaengerBeschriftung: 'Empfänger der Betriebs-Mails',
  fest: 'fest',
  festSatz: 'Postfach der Plattform, immer dabei',
  bestaetigtAm: (datum: string) => `bestätigt am ${datum}`,
  ausstehend: (datum: string) => `hinzugefügt am ${datum} – Bestätigung ausstehend`,
  abgelaufen: (datum: string) => `hinzugefügt am ${datum} – Link abgelaufen; noch einmal hinzufügen schickt einen neuen`,
  entfernen: 'Entfernen',
  entfernenSr: (email: string) => `${email} entfernen`,
  hinzufuegenTitel: 'Adresse hinzufügen',
  platzhalter: 'name@example.com',
  hinzufuegen: 'Hinzufügen',
  hinweis:
    'Nur Adressen von Leuten, die Meldungen lesen dürfen – die Mails enthalten Hofnamen und Meldungstexte. Jede neue Adresse bestätigt zuerst über einen Link, erst dann bekommt sie Mails.',
  regelnTitel: 'Welche Einträge per E-Mail',
  regelnSatz: 'Alles landet im Eingang; hier steht nur, was zusätzlich sofort hinausgeht und was der Wochenbericht sammelt.',
  speichern: 'Speichern',
  verwerfen: 'Verwerfen',
  gespeichert: 'Regeln gespeichert.',
  testmail: 'Testmail an alle senden',
  testmailUnterwegs: (anzahl: number) => `Testmail an ${anzahl} ${anzahl === 1 ? 'Adresse' : 'Adressen'} unterwegs.`,
  unterwegs: (email: string) => `Wir haben einen Link an ${email} geschickt. Er gilt ${BESTAETIGUNG_GUELTIG_STUNDEN} Stunden.`,
  regel: 'Gesendet wird an die ganze Liste; eine Adresse ohne Bestätigung bekommt nichts.',
} as const

/** Fehler an der Oberfläche (deutsch, geduzt, mit Ausweg). */
export const ZUSTELLUNG_FEHLER = {
  email: 'Das sieht nicht nach einer E-Mail-Adresse aus.',
  schonFest: 'Diese Adresse ist schon fest dabei.',
  schonBestaetigt: 'Diese Adresse bekommt schon Mails.',
  zuViele: `Du hast in der letzten Stunde schon ${HINZUFUEGEN_JE_STUNDE} Adressen hinzugefügt. Versuch es später noch einmal.`,
  testZuOft: 'Eine Testmail geht höchstens einmal pro Minute. Warte kurz und versuch es dann noch einmal.',
  nichtGefunden: 'Diese Adresse steht nicht mehr in der Liste. Lade die Seite neu.',
  eingabe: 'Das hat nicht geklappt. Bitte lade die Seite neu.',
  mailFehler: 'Die Adresse steht in der Liste, aber der Link ging nicht hinaus. Füg sie bitte noch einmal hinzu.',
} as const

/** Die Seite hinter dem Link aus der Bestätigungsmail. */
export const BESTAETIGEN_TEXT = {
  titel: 'Adresse bestätigen',
  offenSatz: `Bestätige, dass diese Adresse die Betriebs-Mails von ${MARKE} bekommen soll: neue Höfe, Fehlermeldungen, offene Erstattungen.`,
  knopf: 'Adresse bestätigen',
  dankeTitel: 'Adresse bestätigt',
  dankeSatz: 'Ab jetzt bekommt diese Adresse die Betriebs-Mails. Austragen kann dich das Team, das dich eingetragen hat.',
  abgelaufenTitel: 'Der Link ist abgelaufen',
  abgelaufenSatz: `Links gelten ${BESTAETIGUNG_GUELTIG_STUNDEN} Stunden. Bitte die Person, die dich eingetragen hat, die Adresse unter Postfach › Zustellung noch einmal hinzuzufügen – dann kommt ein neuer Link.`,
  ungueltigTitel: 'Dieser Link gilt nicht',
  ungueltigSatz: 'Vielleicht ist er schon benutzt oder die Adresse wurde entfernt. Bitte die Person, die dich eingetragen hat, um einen neuen Link.',
} as const

/** Betreff und Sätze der drei Mails der Zustellung (src/emails/betreiber-*.tsx). */
export const ZUSTELLUNG_MAIL_TEXT = {
  bestaetigungBetreff: `Bitte bestätige deine Adresse · ${MARKE}`,
  bestaetigungTitel: 'Bitte bestätige deine Adresse',
  bestaetigungSatz: `Jemand aus dem Team von ${MARKE} hat diese Adresse für die Betriebs-Mails eingetragen: neue Höfe, Fehlermeldungen, offene Erstattungen. Öffne den Link und tippe auf der Seite auf „${BESTAETIGEN_TEXT.knopf}“. Erst dann schicken wir dir etwas.`,
  bestaetigungGueltig: `Der Link gilt ${BESTAETIGUNG_GUELTIG_STUNDEN} Stunden.`,
  bestaetigungIgnorieren: 'Wenn du damit nichts zu tun hast, ignorier diese Mail. Dann bekommst du nichts von uns.',
  antwortBetreff: (hof: string, titel: string) => `Antwort von ${hof}: ${titel}`,
  antwortTitel: 'Ein Hof hat geantwortet',
  antwortZu: 'Zu',
  antwortOeffnen: 'Im Eingang öffnen',
  testBetreff: `Testmail · ${MARKE}`,
  testTitel: 'Testmail aus dem Postfach',
  testSatz: 'So kommen die Betriebs-Mails bei dir an. Diese Adresse steht auf der Liste unter Postfach › Zustellung.',
  fuss: `Betriebs-Mail von ${MARKE}.`,
} as const
