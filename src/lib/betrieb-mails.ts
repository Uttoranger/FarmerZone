/**
 * Admin › Betrieb › E-Mails (Register N26, N18-Ergänzung 24.10.2026; Nr. 161;
 * Mockups admin-betrieb-mails und mobil-admin-betrieb-mails, Fassung 3): was
 * die Seite aus den Zeilen der Mail-Warteschlange macht — Kacheln,
 * Warnkarte, „Braucht dich“, „Je Art“, Verlauf, Suche — und alle Sätze dazu.
 * Rein, ohne Datenbank, `jetzt` als Parameter (tests/betrieb-mails.test.ts).
 *
 * Wörter nur aus der Wortliste (N8): die Wege heißen „Sofort“, „Wichtig“ und
 * „Kann warten“ (im Code bleibt `vorrang` 0/1/2), „Jetzt schicken“ für eine
 * Mail, die nie hinausging, „Abgelehnt“ statt Bounce, „Spam gemeldet“ statt
 * Beschwerde. Das Fachwort Bounce steht genau einmal erklärt in der
 * Regel-Zeile.
 *
 * Personendaten: Eine Adresse erscheint nur gekürzt (`maskiereAdresse`), nie
 * ein Name, nie ein Inhalt. `maskiereAdresse` ist die EINE Quelle, auch für
 * „Alle Mails“ (Nr. 167).
 */
import {
  ABGELEHNT_WARN_PROZENT,
  ADMIN_BETRIEB_MAILS_HREF,
  GRENZE,
  MAIL_HAENGT_MINUTEN,
  MAIL_PROTOKOLL_AUFBEWAHREN_TAGE,
  MAIL_WARTET_MINUTEN,
  QUOTE_AB_MAILS,
  QUOTE_TAGE,
  RESEND_ABGELEHNT_GRENZE_PROZENT,
  RESEND_ABRECHNUNG_TAG,
  RESEND_SPAM_GRENZE_PROZENT,
  SPAM_WARN_PROZENT,
  STUFEN,
  anteil,
  prozentText,
  resendAbrechnungsBeginn,
  resendAbrechnungsEnde,
  stufe,
  utcTag,
  utcTagesbeginn,
  utcTagVersetzt,
  zuletztText,
  type Grenze,
  type MailWarnArt,
  type WarnEintrag,
  type WarnSchritt,
  type WarnStand,
} from '@/lib/betrieb'
import { MONAT_KURZ, formatDezimal, formatTagKurz, formatZahl } from '@/lib/format'
import { uhrzeitInWien } from '@/lib/fristen'
import { kalendertagInWien } from '@/lib/wiener-tag'
import { bestellMarke, zahlartText } from '@/lib/hof-bestellungen'
import { MARKE } from '@/lib/marke'
import type { MarkeArt } from '@/lib/marke-art'
import { MAIL_ARTEN, VORRANG, type MailArt } from '@/schemas/mail-auftrag'

// ─── Namen ───────────────────────────────────────────────────────────────────

/** Der deutsche Name jeder Art — eine unbekannte steht mit ihrem Kürzel da (`artName`). */
export const MAIL_ART_NAME: Record<MailArt, string> = {
  anmeldecode: 'Anmeldecode',
  bestellcode: 'Bestellcode',
  'login-link': 'Anmeldelink',
  'passwort-link': 'Passwort-Link',
  'email-bestaetigung': 'E-Mail bestätigen',
  'registrierungs-hinweis': 'Registrierungs-Hinweis',
  'bar-bestaetigungslink': 'Bar: Abholung bestätigen',
  'admin-sicherheit': 'Admin-Sicherheit',
  'neue-anmeldung': 'Neue Anmeldung',
  'zu-viele-versuche': 'Zu viele Versuche',
  'betrieb-warnung': 'Betrieb-Warnung',
  testmail: 'Testmail',
  'bestellung-bestaetigung': 'Bestellbestätigung',
  'bestellung-bezahlt-hof': 'Bezahlt (an den Hof)',
  'bar-bestaetigt-hof': 'Bar bestätigt (an den Hof)',
  abholbereit: 'Abholbereit',
  'nicht-abholbereit': 'Nicht abholbereit',
  storniert: 'Storniert',
  'artikel-fehlt': 'Artikel fehlt',
  verfallen: 'Verfallen',
  'zahlung-zu-spaet': 'Zahlung zu spät',
  'erstattung-offen': 'Erstattung offen',
  'neuer-hof': 'Neuer Hof',
  freischaltung: 'Freischaltung',
  meldung: 'Meldung',
  wochenbericht: 'Wochenbericht',
  postfach: 'Postfach an den Betreiber',
  'antwort-an-team': 'Antwort an das Team',
  'betreiber-bestaetigung': 'Betreiber-Bestätigung',
  'betreiber-testmail': 'Betreiber-Testmail',
  'abo-bestaetigung': 'Abo bestätigen',
  beitrag: 'Beitrag an Abos',
  rundschreiben: 'Rundschreiben',
  bescheid: 'Bescheid an Kundinnen',
}

function istMailArt(art: string): art is MailArt {
  return (MAIL_ARTEN as readonly string[]).includes(art)
}

/** Der Name einer Art aus der Datenbank — eine Art, die die Liste nicht kennt, mit ihrem Kürzel. */
export function artName(art: string): string {
  return istMailArt(art) ? MAIL_ART_NAME[art] : art
}

/** Die Wege einer Mail, wie sie auf der Seite heißen (Wortliste N8) — nie „Vorrang“, nie eine Zahl. */
export const WEG_NAME: Record<(typeof VORRANG)[keyof typeof VORRANG], string> = {
  [VORRANG.sofort]: 'Sofort',
  [VORRANG.wichtig]: 'Wichtig',
  [VORRANG.kannWarten]: 'Kann warten',
}

export function wegName(vorrang: number): string {
  return vorrang === VORRANG.sofort ? WEG_NAME[0] : vorrang === VORRANG.kannWarten ? WEG_NAME[2] : WEG_NAME[1]
}

// ─── Fehler in Worten ────────────────────────────────────────────────────────

/**
 * Was ein Fehlercode heißt: Grund in Worten, Kurzform für die Kachel, was zu
 * tun ist, ob „Jetzt schicken“ helfen kann, und der HTTP-Status, den Resend
 * dazu schickt (gezeigt wird „Code 429“). Gespeichert ist der Name des
 * Fehlers von Resend (`fehlerCode`, Nr. 158) bzw. ein eigener kurzer Code des
 * Workers — nie der Nachrichtentext.
 */
export type FehlerText = { grund: string; kurz: string; tun: string; jetztSchicken: boolean; http: number | null }

const NICHTS_TUN_EILT = 'Du musst nichts tun. Wenn es eilt: jetzt schicken.'
const ADRESSE_FALSCH = 'Nochmal schicken hilft hier nicht – die Adresse ist falsch geschrieben.'
const UNS_MELDEN = 'Das liegt an der Einrichtung, nicht an der Mail. Bitte der Entwicklung Bescheid geben.'

export const FEHLER_TEXTE: Record<string, FehlerText> = {
  rate_limit_exceeded: { grund: 'Resend war kurz überlastet', kurz: 'Resend überlastet', tun: NICHTS_TUN_EILT, jetztSchicken: true, http: 429 },
  daily_quota_exceeded: {
    grund: 'Das Tageskontingent bei Resend ist aufgebraucht',
    kurz: 'Tageskontingent voll',
    tun: 'Ab 0 Uhr Weltzeit geht es von selbst weiter.',
    jetztSchicken: false,
    http: 429,
  },
  monthly_quota_exceeded: {
    grund: 'Das Kontingent des Abrechnungszeitraums ist aufgebraucht',
    kurz: 'Kontingent voll',
    tun: `Ab dem ${RESEND_ABRECHNUNG_TAG}. geht es weiter – oder den Tarif bei Resend erhöhen.`,
    jetztSchicken: false,
    http: 429,
  },
  validation_error: { grund: 'Diese Adresse gibt es nicht', kurz: 'Adresse gibt es nicht', tun: ADRESSE_FALSCH, jetztSchicken: false, http: 422 },
  missing_required_field: { grund: 'Der Mail fehlte eine Angabe', kurz: 'Angabe fehlt', tun: UNS_MELDEN, jetztSchicken: false, http: 422 },
  invalid_parameter: { grund: 'Resend hat eine Angabe der Mail abgelehnt', kurz: 'Angabe abgelehnt', tun: UNS_MELDEN, jetztSchicken: false, http: 422 },
  invalid_from_address: { grund: 'Die Absenderadresse ist nicht freigegeben', kurz: 'Absender nicht freigegeben', tun: UNS_MELDEN, jetztSchicken: false, http: 422 },
  invalid_attachment: { grund: 'Ein Anhang war ungültig', kurz: 'Anhang ungültig', tun: UNS_MELDEN, jetztSchicken: false, http: 422 },
  invalid_api_key: { grund: 'Der Schlüssel für Resend gilt nicht', kurz: 'Schlüssel ungültig', tun: UNS_MELDEN, jetztSchicken: false, http: 403 },
  restricted_api_key: { grund: 'Der Schlüssel für Resend darf nicht senden', kurz: 'Schlüssel eingeschränkt', tun: UNS_MELDEN, jetztSchicken: false, http: 401 },
  missing_api_key: { grund: 'Der Schlüssel für Resend fehlt', kurz: 'Schlüssel fehlt', tun: UNS_MELDEN, jetztSchicken: false, http: 401 },
  security_error: { grund: 'Resend hat die Mail aus Sicherheitsgründen gestoppt', kurz: 'Sicherheit', tun: UNS_MELDEN, jetztSchicken: false, http: 451 },
  internal_server_error: { grund: 'Resend hatte einen Fehler', kurz: 'Fehler bei Resend', tun: NICHTS_TUN_EILT, jetztSchicken: true, http: 500 },
  application_error: { grund: 'Resend hatte einen Fehler', kurz: 'Fehler bei Resend', tun: NICHTS_TUN_EILT, jetztSchicken: true, http: 500 },
  ausnahme: { grund: 'Die Verbindung zu Resend ist abgebrochen', kurz: 'Verbindung abgebrochen', tun: NICHTS_TUN_EILT, jetztSchicken: true, http: null },
  renderer_fehler: { grund: 'Die Mail ließ sich gerade nicht zusammenstellen', kurz: 'Mail nicht zusammengestellt', tun: NICHTS_TUN_EILT, jetztSchicken: true, http: null },
  kein_renderer: { grund: 'Für diese Art gibt es keinen Versand über die Warteschlange', kurz: 'Art ohne Versand', tun: UNS_MELDEN, jetztSchicken: false, http: null },
  bezug_ungueltig: { grund: 'Der Bezug der Mail war ungültig', kurz: 'Bezug ungültig', tun: UNS_MELDEN, jetztSchicken: false, http: null },
  abo_abgemeldet: { grund: 'Das Abo ist abgemeldet', kurz: 'Abo abgemeldet', tun: 'Nichts zu tun – wer sich abmeldet, bekommt nichts mehr.', jetztSchicken: false, http: null },
  beitrag_fehlt: { grund: 'Den Beitrag gibt es nicht mehr', kurz: 'Beitrag gelöscht', tun: 'Nichts zu tun – der Hof hat den Beitrag gelöscht.', jetztSchicken: false, http: null },
}

/** Grund, Kurzform und „Was tun“ zu einem Code — ein unbekannter mit Ersatztext, „Jetzt schicken“ bleibt dann erlaubt. */
export function fehlerText(code: string | null): FehlerText & { code: string } {
  const c = code ?? 'unbekannt'
  const bekannt = Object.hasOwn(FEHLER_TEXTE, c) ? FEHLER_TEXTE[c] : undefined
  if (bekannt) return { ...bekannt, code: c }
  return { grund: `Unbekannter Fehler (Code ${c})`, kurz: 'Unbekannter Fehler', tun: NICHTS_TUN_EILT, jetztSchicken: true, http: null, code: c }
}

/** „Code 429“ — der HTTP-Status, wo bekannt, sonst der gespeicherte Code. */
export function codeText(code: string | null): string {
  const t = fehlerText(code)
  return `Code ${t.http ?? t.code}`
}

/** Die Codes, bei denen „Jetzt schicken“ nicht hilft — die Action lässt sie aus (dieselbe Liste wie der Knopf). */
export const CODES_OHNE_JETZT_SCHICKEN: readonly string[] = Object.entries(FEHLER_TEXTE)
  .filter(([, t]) => !t.jetztSchicken)
  .map(([c]) => c)

// ─── Adresse nur gekürzt ─────────────────────────────────────────────────────

/**
 * „k•••@example.at“: erster Buchstabe, drei Punkte, die Domain. Genug, um am
 * Telefon zu fragen „endet sie auf …?“, zu wenig, um die Adresse
 * abzuschreiben. Ohne @ oder ohne Teil davor: nur Punkte (nichts verraten).
 * Die EINE Stelle, an der eine Adresse für die Anzeige gekürzt wird (auch
 * „Alle Mails“, Nr. 167).
 */
export function maskiereAdresse(adresse: string): string {
  const getrimmt = adresse.trim()
  const at = getrimmt.lastIndexOf('@')
  if (at <= 0 || at === getrimmt.length - 1) return '•••'
  const erster = Array.from(getrimmt)[0] ?? ''
  return `${erster.toLowerCase()}•••@${getrimmt.slice(at + 1).toLowerCase()}`
}

// ─── Kennzahlen ──────────────────────────────────────────────────────────────

/** Eine Quote in % — erst ab QUOTE_AB_MAILS Mails, sonst null („zu wenig Mails“). */
export function quote(teil: number, basis: number): number | null {
  return basis >= QUOTE_AB_MAILS ? (teil / basis) * 100 : null
}

function prozent1(p: number): string {
  return `${formatDezimal(p, 1)} %`
}

function prozent2(p: number): string {
  return `${formatDezimal(p, 2)} %`
}

function minutenSeit(zeitpunkt: Date, jetzt: Date): number {
  return Math.max(0, Math.floor((jetzt.getTime() - zeitpunkt.getTime()) / 60_000))
}

/** „7 Min.“, „2 Std.“, „3 Tagen“ — wie lange etwas wartet. */
function seitText(zeitpunkt: Date, jetzt: Date): string {
  const minuten = minutenSeit(zeitpunkt, jetzt)
  if (minuten < 120) return `${formatZahl(minuten)} Min.`
  const stunden = Math.floor(minuten / 60)
  if (stunden < 48) return `${formatZahl(stunden)} Std.`
  return `${formatZahl(Math.floor(stunden / 24))} Tagen`
}

/** „12 s“, „2 min“ — die Wartezeit vom Einstellen bis zum Versand. */
export function wartezeitText(ms: number | null): string {
  if (ms === null) return '–'
  const s = Math.round(ms / 1000)
  if (s < 120) return `${formatZahl(s)} s`
  return `${formatZahl(Math.round(s / 60))} min`
}

/** „09:42“ heute, sonst „gestern 18:20“ bzw. „Mo, 12. Okt, 07:01“ (Wiener Zeit). */
function zeitText(zeitpunkt: Date, jetzt: Date): string {
  return kalendertagInWien(zeitpunkt) === kalendertagInWien(jetzt) ? uhrzeitInWien(zeitpunkt) : zuletztText(zeitpunkt, jetzt)
}

// ─── Eingaben aus der Datenbank (src/server/queries/mails.ts) ────────────────

/** Was die Warteschlange gerade hält: offen oder in Arbeit, je Weg mit dem ältesten Auftrag. */
export type WarteschlangeDaten = {
  wichtig: number
  kannWarten: number
  aeltesteWichtigeAm: Date | null
  /** Die älteste wartende wichtige Mail — für Warnkarte, Leiste und „Jetzt schicken“. */
  aeltesteWichtige: { id: string; art: string; versuche: number; fehlerCode: string | null; naechsterVersuchAm: Date; zuBestellung: boolean } | null
  /** Seit wann der älteste fällige Auftrag ungeholt liegt (offen und fällig bzw. Belegung abgelaufen) — für „hängt“. */
  faelligSeit: Date | null
  /** „Kann warten“ pausiert gerade (Kontingent, N26). */
  kannWartenPausiert: boolean
}

/** Ein gescheiterter, wiederholter oder hängender Auftrag — ohne Adresse, Inhalt oder Bezug. */
export type ProblemAuftrag = {
  id: string
  art: string
  vorrang: number
  status: string
  versuche: number
  fehlerCode: string | null
  erstelltAm: Date
  naechsterVersuchAm: Date
  belegtBis: Date | null
}

/** Je Art und Weg die Zahlen der letzten 7 Tage (Zahl der Empfänger: eine Zeile je Empfänger). */
export type ArtZahlen = {
  art: string
  vorrang: number
  gesendet: number
  zugestellt: number
  gescheitert: number
  abgelehnt: number
  spam: number
  wartezeitMs: number | null
}

export type VerlaufTag = { tag: string; gesendet: number; gescheitert: number }

/** Der letzte Lauf des Ablaufs „E-Mails“ und wie viele Mails er geschickt hat. */
export type LetzterDurchlauf = { gestartetAm: Date; dauerMs: number | null; mails: number } | null

export type MailZaehler = { heute: number; imZeitraum: number }

/** Die Schwellen, ab denen „Kann warten“ pausiert (KANN_WARTEN_PAUSE der Warteschlange, Nr. 158). */
export type KannWartenPause = { tagProzent: number; zeitraumProzent: number }

// ─── Warnungen (Register N18, Ergänzung 24.10.2026) ──────────────────────────

/** Die Lage für die vier Mail-Warnungen — dieselbe Rechnung für die Prüfung im Ablauf und die Warnkarte der Seite. */
export type MailWarnLage = Record<MailWarnArt, { gilt: boolean; wert: string }>

export type QuotenDaten = { gesendet: number; abgelehnt: number; spam: number }

/**
 * Wann welche Warnung gilt: eine wichtige Mail wartet länger als 5 Minuten;
 * ein fälliger Auftrag liegt länger als 15 Minuten ungeholt; abgelehnt über
 * 2 % bzw. Spam gemeldet über 0,05 % in 7 Tagen, erst ab 50 Mails.
 */
export function mailWarnLage(w: Pick<WarteschlangeDaten, 'aeltesteWichtigeAm' | 'faelligSeit'>, q: QuotenDaten, jetzt: Date): MailWarnLage {
  const wartet = w.aeltesteWichtigeAm === null ? 0 : minutenSeit(w.aeltesteWichtigeAm, jetzt)
  const haengt = w.faelligSeit === null ? 0 : minutenSeit(w.faelligSeit, jetzt)
  const abgelehnt = quote(q.abgelehnt, q.gesendet)
  const spam = quote(q.spam, q.gesendet)
  return {
    'mail:wartet': { gilt: w.aeltesteWichtigeAm !== null && wartet > MAIL_WARTET_MINUTEN, wert: `${formatZahl(wartet)} Minuten` },
    'mail:haengt': { gilt: w.faelligSeit !== null && haengt > MAIL_HAENGT_MINUTEN, wert: `${formatZahl(haengt)} Minuten` },
    'mail:abgelehnt': { gilt: abgelehnt !== null && abgelehnt > ABGELEHNT_WARN_PROZENT, wert: prozent1(abgelehnt ?? 0) },
    'mail:spam': { gilt: spam !== null && spam > SPAM_WARN_PROZENT, wert: prozent2(spam ?? 0) },
  }
}

/**
 * Der Schritt einer Mail-Warnung: Gilt sie, warnt sie — höchstens einmal je
 * UTC-Tag (die Bedingung der Regel „ablauf“ in src/server/betrieb.ts: Stufe 0
 * oder vor heute gemeldet). Gilt sie nicht mehr, geht die Stufe still auf 0:
 * Eine Entwarnung je wartender Mail wäre nur Lärm.
 */
export function mailWarnSchritt(gilt: boolean, bisher: WarnStand, jetzt: Date): WarnSchritt {
  const bisherStufe = bisher?.stufe ?? 0
  if (!gilt) return bisherStufe > 0 ? { tun: 'still' } : { tun: 'nichts' }
  const heuteGemeldet = bisher !== null && bisher.gemeldetAm.getTime() >= utcTagesbeginn(jetzt).getTime()
  return bisherStufe === 0 || !heuteGemeldet ? { tun: 'warnen', stufe: 1 } : { tun: 'nichts' }
}

/** Ob das Lebenszeichen 503 antwortet: eine wichtige Mail wartet länger als 15 Minuten (Nr. 161). */
export function wichtigeMailHaengt(aeltesteWichtigeAm: Date | null, jetzt: Date, minuten: number): boolean {
  return aeltesteWichtigeAm !== null && minutenSeit(aeltesteWichtigeAm, jetzt) > minuten
}

// ─── Texte ───────────────────────────────────────────────────────────────────

/** Höchstens so viele Anfragen je Sekunde nimmt Resend an (resend.com, Stand 24.10.2026). */
export const RESEND_ANFRAGEN_JE_SEKUNDE = 10
/** „Je Art“ zeigt am Computer höchstens so viele Zeilen, bis „Alle n Arten zeigen“. */
export const JE_ART_ZEILEN = 5
/** So viele Tage zeigt der Verlauf. */
export const MAIL_VERLAUF_TAGE = 30

export const ADMIN_BETRIEB_MAILS_ALLE_ARTEN_HREF = `${ADMIN_BETRIEB_MAILS_HREF}&alle=1`

/** Alle Sätze der Ansicht E-Mails — EINE Quelle (Mockups admin-betrieb-mails, mobil-admin-betrieb-mails). */
export const MAIL_TEXT = {
  satz: `Was ${MARKE} im Hintergrund braucht – E-Mails live, der Rest jeden Morgen gemessen.`,
  stand: (uhr: string): string => `Stand ${uhr} · jede Minute neu`,
  standKurz: (uhr: string): string => `E-Mails · Stand ${uhr}`,
  kacheln: 'E-Mails in Zahlen',
  ladefehler: 'Dieser Teil konnte gerade nicht geladen werden. Die Seite lädt jede Minute neu.',
  // Suche
  sucheTitel: 'Mails suchen',
  sucheZusatz: 'für „Ich habe keine Mail bekommen“',
  sucheLabel: 'Bestellnummer oder E-Mail-Adresse',
  sucheKnopf: 'Suchen',
  sucheHilfe: 'Für Anrufe: Nummer vom Beleg oder die Adresse der Kundin.',
  sucheUngueltig: 'Bitte eine Bestellnummer oder eine ganze E-Mail-Adresse eingeben.',
  keinTreffer: `Keine Bestellung und kein Hof mit dieser Angabe in den letzten ${MAIL_PROTOKOLL_AUFBEWAHREN_TAGE} Tagen.`,
  zugestelltHinweis: 'Laut Resend angekommen. Findet sie die Mail nicht: zuerst im Spam- oder Werbung-Ordner nachsehen lassen.',
  ohneBestellung: 'Ohne Bestellung',
  ausDerBestellung: 'aus der Bestellung',
  ausDemHof: 'aus dem Hof',
  nurGekuerzt: 'Adresse nur gekürzt',
  keineMail: 'Zu dieser Bestellung steht keine Mail im Protokoll.',
  // Braucht dich
  brauchtTitel: 'Braucht dich',
  brauchtLeer: 'Alles hinaus – keine Mail ist gescheitert oder hängt.',
  brauchtLeerSatz: 'Gescheiterte und hängende Mails erscheinen hier, sobald es welche gibt.',
  brauchtFuss: 'Jetzt schicken und Verwerfen fragen nach deinem Passkey. Verworfene Mails bleiben im Protokoll.',
  jetztSchicken: 'Jetzt schicken',
  verwerfen: 'Verwerfen',
  alleJetztSchicken: (n: number): string => `Alle ${formatZahl(n)} jetzt schicken`,
  alleVerwerfen: (n: number): string => `Alle ${formatZahl(n)} verwerfen`,
  ansehen: 'Ansehen',
  geschickt: (n: number): string => (n === 1 ? 'Die Mail geht gleich hinaus.' : `${formatZahl(n)} Mails gehen gleich hinaus.`),
  verworfen: (n: number): string => (n === 1 ? 'Die Mail ist verworfen – sie bleibt im Protokoll.' : `${formatZahl(n)} Mails sind verworfen – sie bleiben im Protokoll.`),
  nichtsGeaendert: 'Diese Mail lässt sich gerade nicht ändern – die Seite zeigt gleich den neuen Stand.',
  eingabeUngueltig: 'Diese Mail gibt es so nicht.',
  aktionFehler: 'Das hat nicht geklappt. Versuch es in ein paar Minuten noch einmal.',
  versuchtVonSelbst: 'versucht es von selbst',
  aufgegeben: 'aufgegeben',
  haengt: 'hängt',
  // Je Art
  jeArtTitel: 'Je Art',
  jeArtZusatz: `${QUOTE_TAGE} Tage · Zahl der Empfänger`,
  jeArtKurz: `Je Art · ${QUOTE_TAGE} Tage`,
  jeArtCaption: `Mails je Art in ${QUOTE_TAGE} Tagen, auffällige zuerst`,
  jeArtSpalten: { art: 'Art', weg: 'Weg', gesendet: 'Gesendet', zugestellt: 'Zugestellt', gescheitert: 'Gescheitert', abgelehnt: 'Abgelehnt', wartezeit: 'Wartezeit' },
  jeArtLeer: `In den letzten ${QUOTE_TAGE} Tagen ging keine Mail hinaus.`,
  alleArten: (n: number): string => `Alle ${formatZahl(n)} Arten zeigen`,
  wenigerArten: 'Nur auffällige zeigen',
  ausgeblendet: (n: number): string => `Auffällige zuerst · ${formatZahl(n)} ${n === 1 ? 'Art' : 'Arten'} ohne Fehler und Ablehnungen ausgeblendet`,
  // Verlauf
  verlaufTitel: 'Verlauf',
  verlaufZusatz: `${MAIL_VERLAUF_TAGE} Tage`,
  verlaufKurz: `Verlauf · ${MAIL_VERLAUF_TAGE} Tage`,
  verlaufGesendet: 'gesendet',
  verlaufGescheitert: 'gescheitert',
  // Warteschlange
  schlangeTitel: 'Warteschlange gerade jetzt',
  schlangeKurz: 'Warteschlange',
  wegWichtig: 'Wichtig · Bestellungen, Höfe',
  wegKannWarten: 'Kann warten · Beiträge, Rundschreiben',
  nachDenWichtigen: 'nach den wichtigen',
  pausiert: 'pausiert – das Kontingent ist knapp',
  leer: 'leer',
  letzterDurchlauf: (uhr: string, mails: number, dauer: string): string => `Letzter Durchlauf ${uhr} · ${formatZahl(mails)} ${mails === 1 ? 'Mail' : 'Mails'} in ${dauer}`,
  ohneDurchlauf: 'Der Ablauf „E-Mails“ hat sich bisher nicht gemeldet.',
  // Regel-Zeile
  regel: `Resend erlaubt ${RESEND_ANFRAGEN_JE_SEKUNDE} Anfragen je Sekunde, höchstens ${formatDezimal(RESEND_ABGELEHNT_GRENZE_PROZENT, 0)} % abgelehnte Mails (Bounce: das Postfach weist die Mail zurück) und ${formatDezimal(RESEND_SPAM_GRENZE_PROZENT, 2)} % Spam-Meldungen. Codes, Passwort- und Bestätigungslinks gehen sofort, ohne Warteschlange; alles andere läuft über die Warteschlange. Das Protokoll hält ${MAIL_PROTOKOLL_AUFBEWAHREN_TAGE} Tage. Gespeichert werden nie Adresse oder Inhalt.`,
} as const

// ─── Kacheln ─────────────────────────────────────────────────────────────────

/** Das Zustandswort jeder Kachel (WCAG 1.4.1: nie nur Farbe) — `tun` nur bei Handlungsbedarf. */
export type Zustand = { wort: string; art: Extract<MarkeArt, 'tun' | 'laeuft'> }

export type MailKachelId = 'heute' | 'zeitraum' | 'warteschlange' | 'gescheitert' | 'zustellung'

export type MailKachel = {
  id: MailKachelId
  titel: string
  wert: string
  von: string
  zustand: Zustand
  /** Balken mit Strich (in %), nur bei Heute und Abrechnungszeitraum. */
  balken: { anteil: number; strich: number; warnt: boolean } | null
  zeilen: string[]
  /** Leiser Satz, nur ab 1024 px. */
  satz: string | null
}

const IM_RAHMEN: Zustand = { wort: 'Im Rahmen', art: 'laeuft' }
const ACHTUNG: Zustand = { wort: 'Achtung', art: 'tun' }
const GUT: Zustand = { wort: 'Gut', art: 'laeuft' }

/** „2:00“ — wann der Resend-Tag in Wiener Zeit beginnt (Sommerzeit 2:00, Winterzeit 1:00). */
function tagesbeginnInWien(jetzt: Date): string {
  return uhrzeitInWien(utcTagesbeginn(jetzt)).replace(/^0/, '')
}

/** „17. Okt bis 16. Nov · noch 23 Tage“ — der laufende Abrechnungszeitraum von Resend. */
export function zeitraumText(jetzt: Date): string {
  const beginn = resendAbrechnungsBeginn(jetzt)
  const ende = resendAbrechnungsEnde(jetzt)
  const letzter = new Date(ende.getTime() - 86_400_000)
  const tag = (d: Date): string => `${d.getUTCDate()}. ${MONAT_KURZ[d.getUTCMonth()]}`
  const rest = Math.ceil((ende.getTime() - jetzt.getTime()) / 86_400_000)
  return `${tag(beginn)} bis ${tag(letzter)} · noch ${formatZahl(rest)} ${rest === 1 ? 'Tag' : 'Tage'}`
}

export type KachelEingabe = {
  zaehler: MailZaehler
  schlange: WarteschlangeDaten
  probleme: readonly ProblemAuftrag[]
  arten: readonly ArtZahlen[]
  pause: KannWartenPause
  tarif: string
}

/** Wie ein Problem dasteht: versucht es von selbst (offen mit Fehler), aufgegeben (gescheitert) oder hängt. */
export type ProblemStand = 'vonSelbst' | 'aufgegeben' | 'haengt'

export function problemStand(p: ProblemAuftrag, jetzt: Date): ProblemStand {
  if (p.status === 'gescheitert') return 'aufgegeben'
  const faellig = p.status === 'in_arbeit' ? p.belegtBis : p.naechsterVersuchAm
  if (faellig !== null && minutenSeit(faellig, jetzt) > MAIL_HAENGT_MINUTEN) return 'haengt'
  return 'vonSelbst'
}

/** Die Summe der Zahlen über alle Arten (Zustellung · 7 Tage). */
export function summeArten(arten: readonly ArtZahlen[]): QuotenDaten & { zugestellt: number; gescheitert: number } {
  return arten.reduce(
    (s, a) => ({
      gesendet: s.gesendet + a.gesendet,
      zugestellt: s.zugestellt + a.zugestellt,
      gescheitert: s.gescheitert + a.gescheitert,
      abgelehnt: s.abgelehnt + a.abgelehnt,
      spam: s.spam + a.spam,
    }),
    { gesendet: 0, zugestellt: 0, gescheitert: 0, abgelehnt: 0, spam: 0 }
  )
}

/**
 * Die fünf Kacheln (Mockup: Heute, Abrechnungszeitraum, Warteschlange,
 * Gescheitert · 24 h, Zustellung · 7 Tage). Jede trägt ihren Zustand als
 * Wort; Ton (`tun`) nur bei Handlungsbedarf.
 */
export function mailKacheln(e: KachelEingabe, jetzt: Date, grenze: Pick<Grenze, 'mailsTag' | 'mailsMonat'> = GRENZE): MailKachel[] {
  const tagAnteil = grenze.mailsTag === null ? null : anteil(e.zaehler.heute, grenze.mailsTag)
  const zeitraumAnteil = anteil(e.zaehler.imZeitraum, grenze.mailsMonat)
  const tagZustand: Zustand =
    tagAnteil === null || tagAnteil < e.pause.tagProzent ? IM_RAHMEN : stufe(tagAnteil) > 0 ? ACHTUNG : { wort: 'Kann warten pausiert', art: 'laeuft' }
  const zeitraumZustand: Zustand = stufe(zeitraumAnteil) > 0 ? ACHTUNG : IM_RAHMEN

  const offen = e.schlange.wichtig + e.schlange.kannWarten
  const wartet = e.schlange.aeltesteWichtigeAm !== null && minutenSeit(e.schlange.aeltesteWichtigeAm, jetzt) > MAIL_WARTET_MINUTEN
  const haengt = e.schlange.faelligSeit !== null && minutenSeit(e.schlange.faelligSeit, jetzt) > MAIL_HAENGT_MINUTEN

  const vonSelbst = e.probleme.filter((p) => p.status !== 'gescheitert').length
  const aufgegeben = e.probleme.filter((p) => p.status === 'gescheitert')
  const gruende = [...new Set(e.probleme.filter((p) => p.fehlerCode !== null).map((p) => fehlerText(p.fehlerCode).kurz))]

  const s = summeArten(e.arten)
  const zugestellt = quote(s.zugestellt, s.gesendet)
  const abgelehnt = quote(s.abgelehnt, s.gesendet)
  const spam = quote(s.spam, s.gesendet)
  const quoteWarnt = (abgelehnt !== null && abgelehnt > ABGELEHNT_WARN_PROZENT) || (spam !== null && spam > SPAM_WARN_PROZENT)

  return [
    {
      id: 'heute',
      titel: 'Heute',
      wert: formatZahl(e.zaehler.heute),
      von: grenze.mailsTag === null ? 'ohne Tagesgrenze' : `von ${formatZahl(grenze.mailsTag)}${tagAnteil === null ? '' : ` · ${prozentText(tagAnteil)}`}`,
      zustand: tagZustand,
      balken: tagAnteil === null ? null : { anteil: tagAnteil, strich: e.pause.tagProzent, warnt: stufe(tagAnteil) > 0 },
      zeilen: [`Zählt ab ${tagesbeginnInWien(jetzt)} Uhr – Resend rechnet in Weltzeit.`],
      satz:
        grenze.mailsTag === null
          ? `Kontingent: ${e.tarif}.`
          : `Ab ${formatZahl(e.pause.tagProzent)} % warten Beiträge und Rundschreiben auf morgen. Kontingent: ${e.tarif}.`,
    },
    {
      id: 'zeitraum',
      titel: 'Abrechnungszeitraum',
      wert: formatZahl(e.zaehler.imZeitraum),
      von: `von ${formatZahl(grenze.mailsMonat)} · ${prozentText(zeitraumAnteil)}`,
      zustand: zeitraumZustand,
      balken: { anteil: zeitraumAnteil, strich: STUFEN[0], warnt: stufe(zeitraumAnteil) > 0 },
      zeilen: [zeitraumText(jetzt)],
      satz: `Zählt wie Resend: je Empfänger, ab dem ${RESEND_ABRECHNUNG_TAG}. Ab ${formatZahl(e.pause.zeitraumProzent)} % warten Beiträge.`,
    },
    {
      id: 'warteschlange',
      titel: 'Warteschlange',
      wert: formatZahl(offen),
      von: 'offen',
      zustand: wartet || haengt ? ACHTUNG : offen === 0 ? { wort: 'Leer', art: 'laeuft' } : { wort: 'Läuft', art: 'laeuft' },
      balken: null,
      zeilen: [
        `${formatZahl(e.schlange.wichtig)} wichtig · ${formatZahl(e.schlange.kannWarten)} ${e.schlange.kannWarten === 1 ? 'kann' : 'können'} warten`,
        e.schlange.aeltesteWichtigeAm === null ? 'Keine wichtige Mail wartet.' : `Älteste wichtige Mail seit ${seitText(e.schlange.aeltesteWichtigeAm, jetzt)}`,
      ],
      satz: 'Läuft jede Minute und direkt nach dem Einstellen.',
    },
    {
      id: 'gescheitert',
      titel: 'Gescheitert · 24 h',
      wert: formatZahl(e.probleme.length),
      von: e.probleme.length === 1 ? 'Mail' : 'Mails',
      zustand: aufgegeben.length > 0 ? { wort: `${formatZahl(aufgegeben.length)} braucht dich`, art: 'tun' } : GUT,
      balken: null,
      zeilen: [`${formatZahl(vonSelbst)} ${MAIL_TEXT.versuchtVonSelbst} · ${formatZahl(aufgegeben.length)} ${MAIL_TEXT.aufgegeben}`, ...(gruende.length > 0 ? [gruende.join(' · ')] : [])],
      satz: 'Ohne Adresse und Inhalt – nur Art und Grund.',
    },
    {
      id: 'zustellung',
      titel: `Zustellung · ${QUOTE_TAGE} Tage`,
      wert: zugestellt === null ? '–' : prozent1(zugestellt),
      von: zugestellt === null ? 'zu wenig Mails' : 'zugestellt',
      zustand: quoteWarnt ? ACHTUNG : zugestellt === null ? IM_RAHMEN : GUT,
      balken: null,
      zeilen:
        zugestellt === null
          ? [`Aus ${formatZahl(s.gesendet)} ${s.gesendet === 1 ? 'Mail' : 'Mails'} – eine Quote zählt ab ${formatZahl(QUOTE_AB_MAILS)}.`]
          : [
              `Abgelehnt ${prozent1(abgelehnt ?? 0)} · Grenze ${formatDezimal(RESEND_ABGELEHNT_GRENZE_PROZENT, 0)} %`,
              `Spam gemeldet ${prozent2(spam ?? 0)} · Grenze ${formatDezimal(RESEND_SPAM_GRENZE_PROZENT, 2)} %`,
              `Aus ${formatZahl(s.gesendet)} Mails · Meldungen von Resend`,
            ],
      satz: 'Abgelehnt oder als Spam gemeldet → das Abo wird abgemeldet.',
    },
  ]
}

// ─── Warnkarte ───────────────────────────────────────────────────────────────

export type MailWarnkarte = {
  eintraege: WarnEintrag[]
  gruen: string
  /** Die wartende wichtige Mail, die „Jetzt schicken“ schickt — nur, wenn der Code es erlaubt. */
  jetztSchicken: string | null
}

/**
 * Die Warnkarte der Ansicht E-Mails — live aus der Lage, nicht aus der
 * gespeicherten Stufe (die Seite lädt jede Minute neu). Dazu der Satz, wann
 * die Warn-Mail hinausging, wenn sie heute ging.
 */
export function mailWarnkarte(
  e: { lage: MailWarnLage; schlange: WarteschlangeDaten; zaehler: MailZaehler; arten: readonly ArtZahlen[] },
  warnungen: ReadonlyArray<{ art: string; stufe: number; gemeldetAm: Date }>,
  jetzt: Date,
  grenze: Pick<Grenze, 'mailsMonat'> = GRENZE
): MailWarnkarte {
  const eintraege: WarnEintrag[] = []
  const mailHeute: string[] = []
  const merkeMail = (art: string): void => {
    const w = warnungen.find((x) => x.art === art && x.stufe > 0)
    if (w && kalendertagInWien(w.gemeldetAm) === kalendertagInWien(jetzt)) mailHeute.push(uhrzeitInWien(w.gemeldetAm))
  }
  let jetztSchicken: string | null = null

  const a = e.schlange.aeltesteWichtige
  if (e.lage['mail:wartet'].gilt && a) {
    const f = a.fehlerCode === null ? null : fehlerText(a.fehlerCode)
    const versuche = a.versuche === 0 ? 'wartet auf den ersten Versuch' : `${formatZahl(a.versuche)} ${a.versuche === 1 ? 'Versuch' : 'Versuche'}`
    const wann = a.naechsterVersuchAm.getTime() > jetzt.getTime() ? `um ${uhrzeitInWien(a.naechsterVersuchAm)}` : 'gleich'
    eintraege.push({
      art: 'mail:wartet',
      titel: `${a.zuBestellung ? 'Eine Bestellmail' : 'Eine wichtige Mail'} wartet seit ${e.lage['mail:wartet'].wert}`,
      saetze: [
        `${artName(a.art)} · ${versuche}.`,
        ...(f ? [`${f.grund} (${codeText(a.fehlerCode)}).`] : []),
        `${MARKE} versucht es ${wann} von selbst – du musst nichts tun. Beiträge warten so lange.`,
      ],
    })
    merkeMail('mail:wartet')
    if (f === null || f.jetztSchicken) jetztSchicken = a.id
  }
  if (e.lage['mail:haengt'].gilt) {
    eintraege.push({
      art: 'mail:haengt',
      titel: `Die Warteschlange hängt seit ${e.lage['mail:haengt'].wert}`,
      saetze: ['Fällige Mails werden nicht abgeholt – der Ablauf „E-Mails“ läuft nicht oder bricht ab. Er steht im Überblick unter Abläufe.'],
    })
    merkeMail('mail:haengt')
  }
  const s = summeArten(e.arten)
  if (e.lage['mail:abgelehnt'].gilt) {
    eintraege.push({
      art: 'mail:abgelehnt',
      titel: `${e.lage['mail:abgelehnt'].wert} der Mails abgelehnt`,
      saetze: [
        `In ${QUOTE_TAGE} Tagen ${formatZahl(s.abgelehnt)} von ${formatZahl(s.gesendet)} Mails. Ab ${formatDezimal(RESEND_ABGELEHNT_GRENZE_PROZENT, 0)} % sperrt Resend das Konto.`,
      ],
    })
    merkeMail('mail:abgelehnt')
  }
  if (e.lage['mail:spam'].gilt) {
    eintraege.push({
      art: 'mail:spam',
      titel: `${e.lage['mail:spam'].wert} der Mails als Spam gemeldet`,
      saetze: [`In ${QUOTE_TAGE} Tagen ${formatZahl(s.spam)} von ${formatZahl(s.gesendet)} Mails. Ab ${formatDezimal(RESEND_SPAM_GRENZE_PROZENT, 2)} % sperrt Resend das Konto.`],
    })
    merkeMail('mail:spam')
  }
  const kontingent = anteil(e.zaehler.imZeitraum, grenze.mailsMonat)
  if (stufe(kontingent) > 0) {
    eintraege.push({
      art: 'mailsMonat',
      titel: stufe(kontingent) === 3 ? 'Kontingent des Abrechnungszeitraums voll' : `Kontingent bei ${prozentText(kontingent)}`,
      saetze: [`${formatZahl(e.zaehler.imZeitraum)} von ${formatZahl(grenze.mailsMonat)} Mails seit dem ${RESEND_ABRECHNUNG_TAG}. Beiträge und Rundschreiben warten zuerst.`],
    })
    merkeMail('mailsMonat')
  }

  const zustellung = quote(s.zugestellt, s.gesendet)
  const teile = [
    eintraege.length > 0 ? 'Sonst im grünen Bereich' : 'Alles im grünen Bereich',
    ...(zustellung === null ? [] : [`Zustellung ${prozent1(zustellung)}`]),
    `Kontingent ${prozentText(kontingent)}`,
    ...(mailHeute.length > 0 ? [`Warn-Mail ging um ${mailHeute[0]} an dich`] : []),
  ]
  return { eintraege, gruen: teile.join(' · '), jetztSchicken }
}

// ─── Braucht dich ────────────────────────────────────────────────────────────

export type BrauchtDichZeile = {
  id: string
  art: string
  name: string
  weg: string
  stand: { wort: string; art: Extract<MarkeArt, 'tun' | 'laeuft'> }
  grund: string
  zeile: string
  tun: string
  /** „Jetzt schicken“: nur über die Warteschlange (nicht Sofort), nicht in Arbeit, und nur wo der Code es erlaubt. */
  jetztSchicken: boolean
  verwerfen: boolean
}

/** Alle Aufträge einer Art auf einmal — nur für Arten, die die Liste kennt (die Action nimmt nur sie an). */
export type BrauchtDichGruppe = { art: MailArt; name: string; jetztSchicken: number; verwerfen: number }

/**
 * „Braucht dich“: gescheiterte, sich wiederholende und hängende Aufträge,
 * aufgegebene zuerst — Art, Weg, Stand, Grund mit Code, Versuche, letzter
 * bzw. nächster Versuch und der „Was tun“-Satz. Ohne Adresse, Inhalt oder
 * personenbezogene Kennung. Dazu je Art mit mehreren Zeilen die Knöpfe für
 * alle auf einmal.
 */
export function brauchtDich(probleme: readonly ProblemAuftrag[], jetzt: Date): { zeilen: BrauchtDichZeile[]; gruppen: BrauchtDichGruppe[] } {
  const rang: Record<ProblemStand, number> = { aufgegeben: 0, haengt: 1, vonSelbst: 2 }
  const zeilen = probleme
    .map((p) => ({ p, stand: problemStand(p, jetzt) }))
    .sort((x, y) => rang[x.stand] - rang[y.stand] || y.p.naechsterVersuchAm.getTime() - x.p.naechsterVersuchAm.getTime())
    .map(({ p, stand }): BrauchtDichZeile => {
      const f = p.fehlerCode === null ? null : fehlerText(p.fehlerCode)
      const versuche = `${formatZahl(p.versuche)} ${p.versuche === 1 ? 'Versuch' : 'Versuche'}`
      const zeile =
        stand === 'aufgegeben'
          ? `${MAIL_TEXT.aufgegeben} · ${zeitText(p.naechsterVersuchAm, jetzt)}`
          : stand === 'haengt'
            ? `${versuche} · hängt seit ${seitText(p.status === 'in_arbeit' && p.belegtBis ? p.belegtBis : p.naechsterVersuchAm, jetzt)}`
            : `${versuche} · nächster von selbst um ${uhrzeitInWien(p.naechsterVersuchAm)}`
      const darf = p.vorrang !== VORRANG.sofort && p.status !== 'in_arbeit' && (f === null || f.jetztSchicken)
      return {
        id: p.id,
        art: p.art,
        name: artName(p.art),
        weg: wegName(p.vorrang),
        stand:
          stand === 'aufgegeben'
            ? { wort: MAIL_TEXT.aufgegeben, art: 'tun' }
            : stand === 'haengt'
              ? { wort: MAIL_TEXT.haengt, art: 'tun' }
              : { wort: MAIL_TEXT.versuchtVonSelbst, art: 'laeuft' },
        grund: f ? `${f.grund} · ${codeText(p.fehlerCode)}` : 'Wartet auf den Ablauf „E-Mails“',
        zeile,
        tun: f ? f.tun : NICHTS_TUN_EILT,
        jetztSchicken: darf,
        verwerfen: p.status !== 'in_arbeit',
      }
    })
  const gruppen: BrauchtDichGruppe[] = []
  for (const z of zeilen) {
    if (!istMailArt(z.art)) continue
    const g = gruppen.find((x) => x.art === z.art)
    if (g) {
      g.jetztSchicken += z.jetztSchicken ? 1 : 0
      g.verwerfen += z.verwerfen ? 1 : 0
    } else gruppen.push({ art: z.art, name: z.name, jetztSchicken: z.jetztSchicken ? 1 : 0, verwerfen: z.verwerfen ? 1 : 0 })
  }
  return { zeilen, gruppen: gruppen.filter((g) => g.jetztSchicken > 1 || g.verwerfen > 1) }
}

// ─── Je Art ──────────────────────────────────────────────────────────────────

export type JeArtZeile = {
  art: string
  name: string
  weg: string
  gesendet: string
  zugestellt: string
  gescheitert: string
  abgelehnt: string
  wartezeit: string
  auffaellig: boolean
  /** Die Zeile am Handy: „Wichtig · 1 gescheitert · 1 abgelehnt“ bzw. „alles zugestellt“. */
  kurz: string
}

/**
 * „Je Art“ (7 Tage): auffällige zuerst (mit Fehler oder Ablehnung), dann
 * nach Zahl; am Computer höchstens 5 Zeilen, bis „Alle n Arten zeigen“.
 * Dieselben Arten derselben Art über zwei Wege (z. B. nochmal geschickt)
 * bleiben getrennte Zeilen. Wartezeit nur über die Warteschlange.
 */
export function jeArt(arten: readonly ArtZahlen[], alle: boolean): { zeilen: JeArtZeile[]; gezeigt: JeArtZeile[]; ausgeblendet: number; summe: string } {
  const zeilen = [...arten]
    .map((a) => ({ a, auffaellig: a.gescheitert > 0 || a.abgelehnt > 0 }))
    .sort((x, y) => Number(y.auffaellig) - Number(x.auffaellig) || y.a.gesendet - x.a.gesendet || x.a.art.localeCompare(y.a.art))
    .map(({ a, auffaellig }): JeArtZeile => {
      const teile = [
        ...(a.gescheitert > 0 ? [`${formatZahl(a.gescheitert)} gescheitert`] : []),
        ...(a.abgelehnt > 0 ? [`${formatZahl(a.abgelehnt)} abgelehnt`] : []),
      ]
      const kurz = teile.length > 0 ? teile.join(' · ') : a.zugestellt >= a.gesendet && a.gesendet > 0 ? 'alles zugestellt' : `${formatZahl(a.zugestellt)} zugestellt`
      return {
        art: a.art,
        name: artName(a.art),
        weg: wegName(a.vorrang),
        gesendet: formatZahl(a.gesendet),
        zugestellt: formatZahl(a.zugestellt),
        gescheitert: formatZahl(a.gescheitert),
        abgelehnt: formatZahl(a.abgelehnt),
        wartezeit: a.vorrang === VORRANG.sofort ? '–' : wartezeitText(a.wartezeitMs),
        auffaellig,
        kurz: `${wegName(a.vorrang)} · ${kurz}`,
      }
    })
  const unauffaellig = zeilen.filter((z) => !z.auffaellig).length
  const gezeigt = alle ? zeilen : zeilen.slice(0, JE_ART_ZEILEN)
  const s = summeArten(arten)
  return {
    zeilen,
    gezeigt,
    ausgeblendet: alle ? 0 : Math.min(unauffaellig, zeilen.length - gezeigt.length),
    summe: `${formatZahl(s.gesendet)} gesendet · ${formatZahl(s.gescheitert)} gescheitert · ${formatZahl(s.abgelehnt)} abgelehnt`,
  }
}

// ─── Verlauf ─────────────────────────────────────────────────────────────────

export type MailVerlauf = { tage: VerlaufTag[]; hoechstens: number; satz: string; von: string; mitte: string }

/**
 * 30 Tage bis heute (UTC-Tage wie der Zähler), fehlende Tage mit 0; dazu der
 * Satz aus denselben Zahlen, der auch für Screenreader steht: Schnitt,
 * Spitzen (Tage über dem Doppelten des Schnitts, höchstens zwei) und an wie
 * vielen Tagen Mails scheiterten.
 */
export function mailVerlauf(roh: readonly VerlaufTag[], jetzt: Date): MailVerlauf {
  const heute = utcTag(jetzt)
  const von = utcTagVersetzt(heute, -(MAIL_VERLAUF_TAGE - 1))
  const tage: VerlaufTag[] = Array.from({ length: MAIL_VERLAUF_TAGE }, (_, i) => {
    const tag = utcTagVersetzt(von, i)
    const r = roh.find((x) => x.tag === tag)
    return { tag, gesendet: r?.gesendet ?? 0, gescheitert: r?.gescheitert ?? 0 }
  })
  const summe = tage.reduce((s, t) => s + t.gesendet, 0)
  const schnitt = summe / MAIL_VERLAUF_TAGE
  const hoechstens = Math.max(1, ...tage.map((t) => t.gesendet))
  const tagName = (tag: string): string => `${Number(tag.slice(8, 10))}.`
  const monat = (tag: string): string => MONAT_KURZ[Number(tag.slice(5, 7)) - 1]
  const spitzen = tage
    .filter((t) => schnitt > 0 && t.gesendet >= 2 * schnitt && t.gesendet >= 10)
    .sort((x, y) => y.gesendet - x.gesendet)
    .slice(0, 2)
    .sort((x, y) => x.tag.localeCompare(y.tag))
  const gescheitertTage = tage.filter((t) => t.gescheitert > 0).length
  const saetze: string[] = []
  if (summe === 0) saetze.push(`In den letzten ${MAIL_VERLAUF_TAGE} Tagen ging keine Mail hinaus.`)
  else {
    saetze.push(`Im Schnitt ${formatZahl(Math.round(schnitt))} ${Math.round(schnitt) === 1 ? 'Mail' : 'Mails'} am Tag.`)
    if (spitzen.length === 1) saetze.push(`Spitze am ${tagName(spitzen[0].tag)} ${monat(spitzen[0].tag)}.`)
    if (spitzen.length === 2) {
      const gleicherMonat = monat(spitzen[0].tag) === monat(spitzen[1].tag)
      saetze.push(
        `Spitzen am ${tagName(spitzen[0].tag)}${gleicherMonat ? '' : ` ${monat(spitzen[0].tag)}`} und ${tagName(spitzen[1].tag)} ${monat(spitzen[1].tag)}.`
      )
    }
  }
  saetze.push(
    gescheitertTage === 0
      ? 'Keine gescheiterte Mail.'
      : `An ${formatZahl(gescheitertTage)} ${gescheitertTage === 1 ? 'Tag' : 'Tagen'} einzelne gescheiterte Mails.`
  )
  const kurz = (tag: string): string => `${tagName(tag)} ${monat(tag)}`
  return { tage, hoechstens, satz: saetze.join(' '), von: kurz(von), mitte: kurz(utcTagVersetzt(von, Math.floor(MAIL_VERLAUF_TAGE / 2))) }
}

// ─── Warteschlange (Karte) ───────────────────────────────────────────────────

export type SchlangeKarte = { zeilen: Array<{ weg: string; wert: string }>; durchlauf: string; kurz: string }

export function schlangeKarte(s: WarteschlangeDaten, lauf: LetzterDurchlauf, jetzt: Date): SchlangeKarte {
  const wichtig = s.wichtig === 0 ? MAIL_TEXT.leer : `${formatZahl(s.wichtig)} · seit ${s.aeltesteWichtigeAm ? seitText(s.aeltesteWichtigeAm, jetzt) : '–'}`
  const kannWarten = s.kannWarten === 0 ? MAIL_TEXT.leer : `${formatZahl(s.kannWarten)} · ${s.kannWartenPausiert ? MAIL_TEXT.pausiert : MAIL_TEXT.nachDenWichtigen}`
  const dauer = lauf?.dauerMs == null ? '–' : `${formatZahl(Math.max(1, Math.round(lauf.dauerMs / 1000)))} s`
  return {
    zeilen: [
      { weg: MAIL_TEXT.wegWichtig, wert: wichtig },
      { weg: MAIL_TEXT.wegKannWarten, wert: kannWarten },
    ],
    durchlauf: lauf === null ? MAIL_TEXT.ohneDurchlauf : MAIL_TEXT.letzterDurchlauf(zeitText(lauf.gestartetAm, jetzt), lauf.mails, dauer),
    kurz: `${s.wichtig === 0 ? 'keine wichtige' : `${formatZahl(s.wichtig)} wichtig${s.aeltesteWichtigeAm ? ` seit ${seitText(s.aeltesteWichtigeAm, jetzt)}` : ''}`} · ${formatZahl(s.kannWarten)} ${s.kannWarten === 1 ? 'kann' : 'können'} warten`,
  }
}

// ─── Suche ───────────────────────────────────────────────────────────────────

/** Eine Zeile aus MailAuftrag für die Suche — ohne Bezug, ohne Fingerabdruck. */
export type SuchMail = {
  id: string
  art: string
  vorrang: number
  status: string
  bestellungId: string | null
  erstelltAm: Date
  gesendetAm: Date | null
  zugestelltAm: Date | null
  bounceAm: Date | null
  beschwerdeAm: Date | null
}

export type SuchBestellung = {
  id: string
  orderNumber: string
  hofName: string
  pickupDate: Date
  paymentMethod: string
  paymentStatus: string
  status: string
  customerEmail: string
}

export type TrefferZeile = { name: string; weg: string; stand: string; marke: { text: string; art: MarkeArt } | null }
export type TrefferGruppe = { kopf: string; unterzeile: string | null; an: string | null; zeilen: TrefferZeile[]; leer: string | null }
export type SuchErgebnis =
  | { art: 'leer' }
  | { art: 'hinweis'; satz: string }
  | { art: 'treffer'; gruppen: TrefferGruppe[]; zugestellt: boolean }

/** Der Stand einer Mail in der Suche: wann, und als Marke, was Resend gemeldet hat. */
function trefferZeile(m: SuchMail, jetzt: Date): TrefferZeile {
  const name = artName(m.art)
  const weg = wegName(m.vorrang)
  if (m.status === 'gesendet' && m.gesendetAm) {
    const marke: TrefferZeile['marke'] =
      m.beschwerdeAm !== null
        ? { text: 'Spam gemeldet', art: 'tun' }
        : m.bounceAm !== null
          ? { text: 'Abgelehnt', art: 'tun' }
          : m.zugestelltAm !== null
            ? { text: 'zugestellt', art: 'laeuft' }
            : null
    return { name, weg, stand: `gesendet ${zeitText(m.gesendetAm, jetzt)}`, marke }
  }
  const stand: Record<string, string> = {
    offen: 'wartet',
    in_arbeit: 'wird geschickt',
    gescheitert: MAIL_TEXT.aufgegeben,
    gesperrt: 'nicht verschickt – nur Test-Adressen erlaubt',
    ohne_schluessel: 'nicht verschickt – ohne Schlüssel für Resend',
    verworfen: 'verworfen',
  }
  return {
    name,
    weg,
    stand: `${stand[m.status] ?? m.status} · ${zeitText(m.erstelltAm, jetzt)}`,
    marke: m.status === 'gescheitert' ? { text: MAIL_TEXT.aufgegeben, art: 'tun' } : null,
  }
}

/**
 * Mails, die noch kommen: „Abholbereit · kommt, wenn der Hof packt“, solange
 * die Bestellung offen ist und die Mail fehlt; bei einer unbestätigten
 * Barbestellung die Bestätigung.
 */
export function erwarteteMails(b: Pick<SuchBestellung, 'status'>, vorhanden: readonly string[]): TrefferZeile[] {
  const zeilen: TrefferZeile[] = []
  if (b.status === 'PENDING_CONFIRMATION' && !vorhanden.includes('bestellung-bestaetigung')) {
    zeilen.push({ name: MAIL_ART_NAME['bestellung-bestaetigung'], weg: WEG_NAME[1], stand: 'noch nicht fällig · kommt, wenn die Bestellung bestätigt ist', marke: null })
  }
  if (['PAID', 'CONFIRMED', 'IN_PREPARATION'].includes(b.status) && !vorhanden.includes('abholbereit')) {
    zeilen.push({ name: MAIL_ART_NAME.abholbereit, weg: WEG_NAME[1], stand: 'noch nicht fällig · kommt, wenn der Hof packt', marke: null })
  }
  return zeilen
}

function bestellKopf(b: SuchBestellung): { kopf: string; unterzeile: string } {
  return {
    kopf: `${b.orderNumber} · ${b.hofName} · Abholung ${formatTagKurz(kalendertagInWien(b.pickupDate))}`,
    unterzeile: `${zahlartText(b.paymentMethod, b.paymentStatus)} · ${bestellMarke(b.status).text}`,
  }
}

/**
 * Das Ergebnis der Suche, gruppiert nach Bestellung, dann „Ohne Bestellung“.
 * Die Adresse erscheint nur gekürzt, mit ihrer Herkunft. Kein Treffer ergibt
 * denselben Satz, gleich ob es die Adresse sonst gibt.
 */
export function suchErgebnis(
  e: { bestellungen: readonly SuchBestellung[]; mails: readonly SuchMail[]; adresse: string | null },
  jetzt: Date
): SuchErgebnis {
  if (e.bestellungen.length === 0 && e.mails.length === 0) return { art: 'hinweis', satz: MAIL_TEXT.keinTreffer }
  const gruppen: TrefferGruppe[] = []
  const ordne = (liste: readonly SuchMail[]): SuchMail[] => [...liste].sort((x, y) => x.erstelltAm.getTime() - y.erstelltAm.getTime())
  for (const b of e.bestellungen) {
    const mails = ordne(e.mails.filter((m) => m.bestellungId === b.id))
    const { kopf, unterzeile } = bestellKopf(b)
    const vonKundin = e.adresse === null || e.adresse === b.customerEmail.trim().toLowerCase()
    const zeilen = [...mails.map((m) => trefferZeile(m, jetzt)), ...erwarteteMails(b, mails.map((m) => m.art))]
    gruppen.push({
      kopf,
      unterzeile,
      an: `an ${maskiereAdresse(e.adresse ?? b.customerEmail)} · ${vonKundin ? MAIL_TEXT.ausDerBestellung : MAIL_TEXT.ausDemHof}`,
      zeilen,
      leer: zeilen.length === 0 ? MAIL_TEXT.keineMail : null,
    })
  }
  const ohne = ordne(e.mails.filter((m) => m.bestellungId === null || !e.bestellungen.some((b) => b.id === m.bestellungId)))
  if (ohne.length > 0) {
    gruppen.push({
      kopf: MAIL_TEXT.ohneBestellung,
      unterzeile: null,
      an: e.adresse === null ? null : `an ${maskiereAdresse(e.adresse)}`,
      zeilen: ohne.map((m) => trefferZeile(m, jetzt)),
      leer: null,
    })
  }
  return { art: 'treffer', gruppen, zugestellt: e.mails.some((m) => m.zugestelltAm !== null) }
}
