/**
 * Double-Opt-in für werbliche Mails (Register S11, Nachtlauf Nr. 38) —
 * Fachregeln und Texte, rein und ohne Datenbank prüfbar
 * (tests/abo-bestaetigung.test.ts). Ohne Geheimnis und ohne env, damit auch
 * Client-Komponenten (/account) die Texte lesen dürfen; der signierte Link
 * steht in abo-bestaetigung-token.ts (nur Server).
 *
 * Werblich sind die Mails an Abonnentinnen eines Hofes (Beiträge per Mail).
 * Bestellbestätigung, Abholung, Storno und Anmeldecode sind es nicht.
 *
 * Drei Zustände eines E-Mail-Abos (`CustomerFarmSubscription`):
 *  - Bestand: `emailOptInAngefragtAm` null — angelegt vor Nr. 38 (oder im
 *    Deploy-Fenster vom alten Code). Bleibt unverändert, solange der Mensch
 *    nichts anderes entscheidet (S11); `optInEmail` gilt wie bisher.
 *  - angefragt: `emailOptInAngefragtAm` gesetzt, `emailOptInBestaetigtAm`
 *    null — der Link ist unterwegs, `optInEmail` bleibt false. Keine Mail.
 *  - bestätigt: beide gesetzt und `optInEmail` true.
 */

/** So lange gilt der Link aus der Bestätigungsmail. */
export const ABO_BESTAETIGUNG_GUELTIG_TAGE = 7
export const ABO_BESTAETIGUNG_GUELTIG_MS = ABO_BESTAETIGUNG_GUELTIG_TAGE * 24 * 60 * 60 * 1000

/**
 * Bremse gegen Mailflut: Höchstens eine Bestätigungsmail je Abo in diesem
 * Abstand. Der frühere Link gilt ja weiter. Die Bremse steht in der
 * Datenbank (`emailOptInAngefragtAm`) und gilt damit über alle Instanzen.
 */
export const ABO_BESTAETIGUNG_PAUSE_MS = 10 * 60 * 1000

export type EmailAboStand = {
  optInEmail: boolean
  emailOptInAngefragtAm: Date | null
  emailOptInBestaetigtAm: Date | null
}

/**
 * Bekommt dieses Abo werbliche Mails? Nur mit `optInEmail` UND entweder aus
 * dem Bestand (nie angefragt) oder bestätigt. Dieselbe Bedingung steht als
 * Datenbankfilter in `WERBEMAIL_EMPFAENGER` (src/server/abo-anmeldung.ts).
 */
export function werbemailErlaubt(abo: EmailAboStand): boolean {
  return abo.optInEmail && (abo.emailOptInAngefragtAm === null || abo.emailOptInBestaetigtAm !== null)
}

/**
 * Wartet dieses Abo auf die Bestätigung, und gilt der Link noch? (Anzeige auf
 * /account.) Nur eine OFFENE Anfrage wartet: Ein bestätigtes, dann
 * ausgeschaltetes Abo behält seine Zeitpunkte als Nachweis, wartet aber auf
 * nichts — sein alter Link greift nicht mehr (Nachbesserung Runde 2).
 */
export function wartetAufBestaetigung(abo: EmailAboStand, jetzt: Date): boolean {
  if (werbemailErlaubt(abo) || abo.emailOptInAngefragtAm === null || abo.emailOptInBestaetigtAm !== null) return false
  return jetzt.getTime() - abo.emailOptInAngefragtAm.getTime() < ABO_BESTAETIGUNG_GUELTIG_MS
}

/**
 * Was eine E-Mail-Anmeldung (Bestätigungsseite einer Bestellung, Schalter auf
 * /account) auslöst:
 *  - `schon-aktiv`: Bestand oder bestätigt — nichts tun, keine Mail.
 *  - `gebremst`: Für eine noch offene Anfrage ging vor weniger als der Pause
 *    schon ein Link raus. Ein bestätigtes, dann abgemeldetes Abo ist nie
 *    gebremst — es bekommt eine neue Anfrage, sonst säße die Kundin fest.
 *  - `bestaetigung-schicken`: Neuer Link. Auch nach einer Abmeldung: Wer
 *    sich abgemeldet hat, bestätigt neu — sonst meldete jeder, der die
 *    Adresse kennt, sie wieder an.
 * Die Antwort an den Browser ist in allen drei Fällen dieselbe (keine
 * Auskunft darüber, ob eine Adresse schon abonniert ist).
 */
export type EmailAnmeldeSchritt = 'schon-aktiv' | 'gebremst' | 'bestaetigung-schicken'

export function emailAnmeldungSchritt(abo: EmailAboStand | null, jetzt: Date): EmailAnmeldeSchritt {
  if (abo && werbemailErlaubt(abo)) return 'schon-aktiv'
  const angefragt = abo?.emailOptInAngefragtAm
  const offen = angefragt && abo.emailOptInBestaetigtAm === null
  if (offen && jetzt.getTime() - angefragt.getTime() < ABO_BESTAETIGUNG_PAUSE_MS) return 'gebremst'
  return 'bestaetigung-schicken'
}

// ── Texte (eine Quelle für Seite, Aktion und Tests) ──────────────────────────

export const ABO_TEXT = {
  ungueltig: 'Dieser Link ist nicht gültig. Vielleicht wurde er beim Kopieren abgeschnitten.',
  abgelaufen: `Dieser Link ist abgelaufen. Er gilt ${ABO_BESTAETIGUNG_GUELTIG_TAGE} Tage.`,
  ueberholt: 'Dieser Link gilt nicht mehr. Vielleicht hast du die Anmeldung inzwischen ausgeschaltet oder einen neueren Link bekommen.',
  ausweg: 'Melde dich einfach noch einmal an – beim nächsten Einkauf oder unter „Mein Konto“. Dann schicken wir dir einen neuen Link.',
  abo_weg: 'Diese Anmeldung gibt es nicht mehr. Melde dich einfach noch einmal an, dann schicken wir dir einen neuen Link.',
  unerwartet: 'Das hat gerade nicht geklappt. Bitte versuch es noch einmal.',
  profilWartet: 'Wir haben dir einen Link geschickt. Bestätige die Anmeldung dort, dann bekommst du Neuigkeiten per E-Mail.',
  schalterWartet: 'Wartet auf deine Bestätigung – schau in dein Postfach.',
  // Die Seite hinter dem Link (/account/neuigkeiten-bestaetigen)
  seitenTitel: 'Anmeldung bestätigen',
  knopf: 'Anmeldung bestätigen',
  offenTitel: 'Bestätige deine Anmeldung',
  // Sätze mit Hofnamen als [davor, danach] — die Seite setzt den Namen fett dazwischen.
  offenSatz: ['Du möchtest Neuigkeiten von', 'per E-Mail bekommen? Tippe auf den Knopf, dann ist es erledigt.'],
  nichtAngemeldet: 'Du hast dich nicht angemeldet? Dann schließ diese Seite einfach – ohne Bestätigung schicken wir dir nichts.',
  danke: 'Danke, du bist angemeldet',
  dankeSatz: ['Ab jetzt bekommst du Neuigkeiten von', 'per E-Mail. Abmelden kannst du dich jederzeit über den Link in jeder Mail.'],
  schonTitel: 'Du bist schon angemeldet',
  schonSatz: ['Du bekommst Neuigkeiten von', 'per E-Mail. Hier ist nichts mehr zu tun.'],
  abgelaufenTitel: 'Der Link ist abgelaufen',
  fehlerTitel: 'Das hat nicht geklappt',
} as const

/**
 * Die Anmeldung auf der Bestätigungsseite einer Bestellung (Register N2,
 * Nr. 46) — vorher der Haken „Neuigkeiten vom Hof" in der Kasse. Die Adresse
 * kommt aus der Bestellung, nie aus dem Browser (meldeNeuigkeitenAn). Der Satz
 * danach ist für jede Adresse derselbe: Er verrät nicht, ob sie schon
 * angemeldet war (S11, keine Auskunft).
 */
export const NEUIGKEITEN_TEXT = {
  titel: 'Neuigkeiten vom Hof per E-Mail',
  // [davor, danach] — die Seite setzt den Hofnamen fett dazwischen.
  satz: ['Möchtest du erfahren, wenn es bei', 'frische Produkte oder Aktionen gibt? Freiwillig – abmelden kannst du dich jederzeit.'],
  knopf: 'Ja, Neuigkeiten per E-Mail',
  laeuft: 'Einen Moment …',
  // [davor, danach] — die Adresse aus der Bestellung dazwischen.
  bestaetigen: ['Wir schicken dir zuerst eine E-Mail an', 'zum Bestätigen. Ohne Bestätigung bekommst du nichts.'],
  danke: 'Danke! Falls du noch nicht angemeldet bist, kommt gleich eine E-Mail zum Bestätigen.',
  datenschutz: 'Abmelden kannst du dich jederzeit über den Link in jeder Nachricht. Mehr dazu in unserer',
  datenschutzLink: 'Datenschutzerklärung',
  linkUngueltig: 'Das hat nicht geklappt. Öffne diese Seite bitte über den Link in deiner Bestätigungsmail.',
  zuViele: 'Gerade kommen sehr viele Anfragen. Versuch es in einer Minute noch einmal.',
  fehler: 'Das hat gerade nicht geklappt. Deine Bestellung ist davon nicht betroffen – versuch es einfach noch einmal.',
} as const

/**
 * Bremse der Anmeldung auf der Bestätigungsseite je IP und Minute (nur in
 * Produktion, wie jede öffentliche Action). Die zweite Bremse ist die des
 * Abos selbst: höchstens ein Link je zehn Minuten (ABO_BESTAETIGUNG_PAUSE_MS).
 */
export const NEUIGKEITEN_PRO_MINUTE = 10

/** Der Satz für einen Link, der nicht (mehr) bestätigen kann — Seite und Knopf. */
export function aboFehlerSatz(grund: 'ungueltig' | 'abgelaufen' | 'ueberholt' | 'abo_weg'): string {
  if (grund === 'abo_weg') return ABO_TEXT.abo_weg
  return `${ABO_TEXT[grund]} ${ABO_TEXT.ausweg}`
}
