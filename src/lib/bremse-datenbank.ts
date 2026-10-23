import { createHmac } from 'crypto'
import { NEUIGKEITEN_JE_BESTELLUNG_UND_TAG } from '@/lib/abo-bestaetigung'
import { BAR_LINK_JE_BESTELLUNG_UND_TAG } from '@/lib/bar-bestaetigung'
import {
  ANMELDECODE_RATE_LIMIT,
  CODE_ANFORDERUNGEN_JE_ADRESSE,
  FALSCHE_CODES_JE_STUNDE,
  FALSCHE_CODES_JE_TAG,
  FALSCHE_PASSWOERTER_JE_STUNDE,
  type FehlversuchArt,
} from '@/lib/anmeldecode'
import { MELDUNGEN_PRO_STUNDE } from '@/lib/meldung'

/**
 * Die Bremse über alle Instanzen (Register R1, Nr. 40) — Regeln, rein und
 * ohne Datenbank prüfbar (tests/bremse-datenbank.test.ts).
 *
 * ZWEI STUFEN. Die erste ist die Bremse je Instanz im Speicher
 * (src/lib/rate-limit.ts, Better Auth): billig, aber auf Vercel hat jede warme
 * Instanz ihr eigenes Fenster. Die zweite zählt in der Tabelle
 * `RateLimitZaehler` (src/server/bremse-datenbank.ts) über alle Instanzen.
 * Gefragt wird sie erst, wenn die erste Stufe durchlässt — eine Schleife, die
 * schon im Speicher hängen bleibt, kostet keine Datenbankabfrage.
 *
 * GRENZEN = DIE DER ERSTEN STUFE. Dieselben Zahlen und Fenster, damit eine
 * Kundin auf einer einzigen Instanz nichts merkt; die Datenbank schließt nur
 * die Lücke zwischen den Instanzen. Die Zahlen kommen aus ihren bestehenden
 * Quellen (anmeldecode.ts, meldung.ts); Checkout und Registrierung stehen
 * hier, weil ihre Quellen `next/server` bzw. Better Auth laden — der Test
 * hält sie gleich (tests/bremse-datenbank.test.ts).
 *
 * FESTES FENSTER statt gleitendem: Ein Zähler je Fenster ist eine Zeile und
 * ein atomares Hochzählen. An der Fenstergrenze sind kurz bis zu doppelt so
 * viele Aufrufe möglich — die erste Stufe gleitet und fängt das je Instanz ab.
 */

export type DbBremse = {
  /** Steht im Klartext vor dem Hash — nur feste Wörter, nie ein Merkmal. */
  zweck: string
  max: number
  fensterMs: number
}

const MINUTE_MS = 60_000
const STUNDE_MS = 60 * MINUTE_MS
const TAG_MS = 24 * STUNDE_MS

/** Gleich `AUTH_RATE_LIMIT_*` in auth.ts (10 je Minute) — die Registrierung lief bisher über dieselbe Zahl. */
export const REGISTRIERUNG_JE_IP = { max: 10, fensterMs: MINUTE_MS } as const

/** Gleich `CHECKOUT_RESERVE_MAX_PER_WINDOW` und `RATE_LIMIT_WINDOW_MS` in rate-limit.ts. */
const CHECKOUT_JE_MINUTE = { max: 20, fensterMs: MINUTE_MS } as const

const anmeldecodeJeIp = { max: ANMELDECODE_RATE_LIMIT.max, fensterMs: ANMELDECODE_RATE_LIMIT.window * 1000 }
const codesJeAdresse = { max: CODE_ANFORDERUNGEN_JE_ADRESSE.max, fensterMs: CODE_ANFORDERUNGEN_JE_ADRESSE.fensterMs }

/**
 * Die fünf Wege aus R1 mit ihren Grenzen — dazu die Bremse je Bestellung
 * (Nr. 46, Runde 1) und zwei Drosseln, die niemanden bremsen, sondern nur
 * Sentry (Nr. 42) bzw. die Empfänger der Betreiber-Mails (Nr. 105) leise
 * halten (siehe unten).
 */
export const DB_BREMSEN = {
  // Anmeldecode (Better Auth emailOTP, Hook in auth.ts)
  anmeldecodeAnfordernIp: { zweck: 'anmeldecode-anfordern-ip', ...anmeldecodeJeIp },
  anmeldecodePruefenIp: { zweck: 'anmeldecode-pruefen-ip', ...anmeldecodeJeIp },
  anmeldecodeAdresse: { zweck: 'anmeldecode-adresse', ...codesJeAdresse },
  // Registrierung (registerFarmer)
  registrierungIp: { zweck: 'registrierung-ip', ...REGISTRIERUNG_JE_IP },
  // Problem melden (meldungAbsenden, nur ohne Hof-Sitzung — wie die erste Stufe)
  meldungIp: { zweck: 'meldung-ip', max: MELDUNGEN_PRO_STUNDE, fensterMs: STUNDE_MS },
  // Bestellungen finden
  bestellungenAnfordernIp: { zweck: 'bestellungen-anfordern-ip', ...anmeldecodeJeIp },
  bestellungenPruefenIp: { zweck: 'bestellungen-pruefen-ip', ...anmeldecodeJeIp },
  bestellungenAdresse: { zweck: 'bestellungen-adresse', ...codesJeAdresse },
  // Checkout (/api/checkout)
  checkoutIp: { zweck: 'checkout-ip', ...CHECKOUT_JE_MINUTE },
  checkoutSitzung: { zweck: 'checkout-sitzung', ...CHECKOUT_JE_MINUTE },
  // Keine Bremse für Menschen und ohne erste Stufe: „Stripe kennt das Konto
  // eines Hofs nicht" (Register Z2, Nr. 42) geht höchstens einmal je Hof und
  // Tag nach Sentry — über alle Instanzen, Merkmal ist die Hof-ID. Ein Tag ist
  // hier ein festes 24-Stunden-Fenster (UTC), für eine Drossel genügt das.
  stripeKontoUnbekannt: { zweck: 'stripe-konto-unbekannt', max: 1, fensterMs: TAG_MS },
  // Neuigkeiten auf der Bestätigungsseite (Nr. 46, Runde 1): je Bestellung und
  // Tag. Ohne erste Stufe — die Grenze schützt das Postfach hinter der
  // Bestellung, nicht den Server (src/lib/abo-bestaetigung.ts).
  neuigkeitenBestellung: { zweck: 'neuigkeiten-bestellung', max: NEUIGKEITEN_JE_BESTELLUNG_UND_TAG, fensterMs: TAG_MS },
  // Drossel ohne erste Stufe (Register N14, Ergänzung; Nr. 105): Die Mail
  // „Ein Hof hat geantwortet" geht höchstens einmal je Faden und VOLLER Stunde
  // (festes Fenster, 10:05 und 10:15 teilen eins, 11:05 beginnt ein neues).
  // Merkmal ist die Kennung des Fadens; der Zähler im Eingang zählt weiter.
  antwortHofMail: { zweck: 'antwort-hof-mail', max: 1, fensterMs: STUNDE_MS },
  // Falsche Codes und Passwörter je Adresse (Register E7, Ergänzung; Nr. 112):
  // ohne erste Stufe und als einzige FAIL-CLOSED (zaehleVersuchVorab in
  // src/server/bremse-datenbank.ts) — Merkmal ist die Adresse (adressMerkmal),
  // gezählt wird nur ein Fehlversuch. Codes zählen über beide Wege zusammen.
  codeFehlerStunde: { zweck: 'code-fehler-stunde', max: FALSCHE_CODES_JE_STUNDE, fensterMs: STUNDE_MS },
  codeFehlerTag: { zweck: 'code-fehler-tag', max: FALSCHE_CODES_JE_TAG, fensterMs: TAG_MS },
  passwortFehler: { zweck: 'passwort-fehler', max: FALSCHE_PASSWOERTER_JE_STUNDE, fensterMs: STUNDE_MS },
  // Drosseln ohne erste Stufe für die Warn-Mails (FEHLVERSUCH_MAIL_DROSSELN):
  // bei Codes eine je Pause, also je Fenster der Bremse, die voll wurde; bei
  // Passwörtern höchstens eine je Adresse und Tag (E7: „Warn-Mails dazu
  // höchstens eine am Tag").
  codeFehlerMailStunde: { zweck: 'code-fehler-mail-stunde', max: 1, fensterMs: STUNDE_MS },
  codeFehlerMailTag: { zweck: 'code-fehler-mail-tag', max: 1, fensterMs: TAG_MS },
  passwortFehlerMail: { zweck: 'passwort-fehler-mail', max: 1, fensterMs: TAG_MS },
  // Admin-Anmeldung (Register N20; Nr. 115), ohne erste Stufe und FAIL-CLOSED
  // (antwortet die Datenbank nicht: gebremst): Jeder Versuch zählt, auch ein
  // richtiger. Ersatzcodes je Adresse (adressMerkmal) und Stunde — gleich für
  // Adressen, die es nicht gibt (src/lib/auth.ts); der E-Mail-Code der
  // Einrichtung je Konto und Stunde (src/server/actions/admin-anmeldung.ts).
  adminErsatzcode: { zweck: 'admin-ersatzcode', max: 5, fensterMs: STUNDE_MS },
  adminEinrichtungscode: { zweck: 'admin-einrichtungscode', max: 5, fensterMs: STUNDE_MS },
  // Meldungen der CSP zum Beobachten (Register G8, Nr. 125): je IP 30 in der
  // Minute über alle Instanzen. Gefragt erst nach dem Entdoppeln und der ersten
  // Stufe im Speicher (src/app/api/csp-bericht/route.ts) — so schreibt nicht
  // jede Meldung in die Datenbank.
  cspBerichtIp: { zweck: 'csp-bericht-ip', max: 30, fensterMs: MINUTE_MS },
  // „Mail nicht bekommen? Erneut senden" auf der Bestätigungsseite (Register
  // S17 Punkt 2, Nr. 151): je Bestellung und Tag, wie `neuigkeitenBestellung`
  // ohne erste Stufe — die Grenze schützt das Postfach hinter der Bestellung.
  // Merkmal ist die Bestell-ID.
  barLinkBestellung: { zweck: 'bar-link-bestellung', max: BAR_LINK_JE_BESTELLUNG_UND_TAG, fensterMs: TAG_MS },

  // Reservieren und Halte erneuern (Register S17 Punkt 1, Nr. 150): EIN Zähler
  // je IP für /api/reserve und /api/warenkorb/pruefen zusammen, 20 in der
  // Minute wie die erste Stufe beider Routen (bremseReservieren in
  // src/server/bremse-datenbank.ts). Nur je IP — eine Grenze je Sitzung ist
  // eine offene Entscheidung der Projektleitung.
  reserveIp: { zweck: 'reserve-ip', ...CHECKOUT_JE_MINUTE },
} as const satisfies Record<string, DbBremse>

/** Welche Bremsen je Art zählen: Codes je Stunde und je Tag, Passwörter je Stunde. */
export const FEHLVERSUCH_BREMSEN = {
  code: [DB_BREMSEN.codeFehlerStunde, DB_BREMSEN.codeFehlerTag],
  passwort: [DB_BREMSEN.passwortFehler],
} as const satisfies Record<FehlversuchArt, readonly DbBremse[]>

/**
 * Pausiert bis wann? Eine Fehlversuch-Bremse ist voll, sobald ihr Stand
 * `max` erreicht: Der 10. falsche Code sperrt, der 11. Versuch wird
 * abgelehnt, ohne dass ein Code geprüft wird. Sind mehrere voll, gilt das
 * späteste Fensterende. `staende` in der Reihenfolge von `bremsen`; null = frei.
 */
export function fehlversuchSperreBis(bremsen: readonly DbBremse[], staende: readonly number[], jetzt: Date): Date | null {
  let bis: Date | null = null
  for (const [i, bremse] of bremsen.entries()) {
    if ((staende[i] ?? 0) < bremse.max) continue
    const ende = fensterEnde(jetzt, bremse.fensterMs)
    if (bis === null || ende.getTime() > bis.getTime()) bis = ende
  }
  return bis
}

/**
 * Hat genau DIESER Fehlversuch eine Bremse voll gemacht (Stand danach gleich
 * `max`)? Dann beginnt die Pause, und es geht eine Mail hinaus. Das Hochzählen
 * ist atomar: Nur ein Aufruf sieht genau `max` — so gibt es eine Mail je
 * Pause über alle Instanzen, ohne Merker im Speicher. Werden zwei Bremsen
 * zugleich voll (der 30. Code des Tages ist der 10. der Stunde), bleibt es
 * eine Mail, mit dem späteren Ende.
 */
export function pauseBeginntBis(bremsen: readonly DbBremse[], staendeNachher: readonly number[], jetzt: Date): Date | null {
  if (!bremsen.some((bremse, i) => staendeNachher[i] === bremse.max)) return null
  return fehlversuchSperreBis(bremsen, staendeNachher, jetzt)
}

/**
 * Je Fehlversuch-Bremse (gleiche Reihenfolge wie FEHLVERSUCH_BREMSEN) die
 * Drossel ihrer Warn-Mail, `max: 1` je Fenster. Der atomare Stand allein
 * reicht nicht: Gibt ein gleichzeitiger richtiger Versuch seinen Zähler
 * zurück, sieht der nächste Fehlversuch wieder genau `max` (Nachbesserung
 * Runde 3) — die Drossel hält es bei einer Mail je Pause.
 */
const FEHLVERSUCH_MAIL_DROSSELN = {
  code: [DB_BREMSEN.codeFehlerMailStunde, DB_BREMSEN.codeFehlerMailTag],
  passwort: [DB_BREMSEN.passwortFehlerMail],
} as const satisfies Record<FehlversuchArt, readonly DbBremse[]>

/** Die Drosseln der Bremsen, die DIESER Fehlversuch voll gemacht hat (Stand danach gleich `max`). */
export function warnMailDrosseln(art: FehlversuchArt, staendeNachher: readonly number[]): DbBremse[] {
  const bremsen: readonly DbBremse[] = FEHLVERSUCH_BREMSEN[art]
  const drosseln: readonly DbBremse[] = FEHLVERSUCH_MAIL_DROSSELN[art]
  return drosseln.filter((_, i) => staendeNachher[i] === bremsen[i].max)
}

/**
 * So lange darf die zweite Stufe dauern. Danach gilt sie als nicht
 * erreichbar und lässt durch (fail-open): Eine langsame Datenbank darf weder
 * eine Anmeldung noch eine Bestellung aufhalten. Ausnahme: die
 * Fehlversuch-Bremsen oben gelten dann als voll (fail-closed).
 */
export const DB_BREMSE_ZEITLIMIT_MS = 1500

/**
 * Höchstens eine Sentry-Meldung je Instanz in dieser Spanne, wenn die zweite
 * Stufe ausfällt (Nr. 47). Fällt die Datenbank aus, scheitert JEDE Anfrage
 * auf den fünf Wegen an der Bremse — ohne Abstand käme je Anmeldeversuch und
 * je Bestellung eine Meldung, und die eigentliche Störung ginge darin unter.
 */
export const BREMSE_MELDE_ABSTAND_MS = 10 * MINUTE_MS

/**
 * Ist eine Meldung fällig? Die erste immer, danach erst wieder nach
 * `BREMSE_MELDE_ABSTAND_MS`. Läuft die Uhr zurück, bleibt es ruhig.
 */
export function bremsMeldungFaellig(letzteMeldungMs: number | null, jetztMs: number): boolean {
  return letzteMeldungMs === null || jetztMs - letzteMeldungMs >= BREMSE_MELDE_ABSTAND_MS
}

/** Derselbe Satz wie bei der ersten Stufe (`enforceRateLimit`). */
export const ZU_VIELE_ANFRAGEN = 'Zu viele Anfragen — bitte warte einen Moment und versuche es erneut.'

/** Für die Registrierung: geduzt, ohne Fachwort, mit Ausweg. */
export const REGISTRIERUNG_ZU_VIELE =
  'Das waren gerade zu viele Versuche. Warte eine Minute und probier es dann noch einmal.'

/** Beginn des festen Fensters, in dem `jetzt` liegt — ein Vielfaches der Fensterlänge seit 1970. */
export function fensterBeginn(jetzt: Date, fensterMs: number): Date {
  return new Date(Math.floor(jetzt.getTime() / fensterMs) * fensterMs)
}

/** Ende dieses Fensters — ab da ist die Zeile Altlast für den Cron. */
export function fensterEnde(jetzt: Date, fensterMs: number): Date {
  return new Date(fensterBeginn(jetzt, fensterMs).getTime() + fensterMs)
}

/** 32 Hex-Zeichen = 128 Bit: Zufallstreffer zwischen zwei Merkmalen gibt es nicht. */
export const SCHLUESSEL_HASH_LAENGE = 32

/**
 * Der Schlüssel in der Tabelle: Zweck im Klartext (zum Auswerten), das
 * Merkmal nur als HMAC mit dem Server-Geheimnis. Ein nackter Hash ließe sich
 * für IPv4 (4 Mrd. Werte) oder bekannte Adressen nachrechnen; mit Geheimnis
 * nicht. Das Präfix „bremse:" trennt diese Verwendung des Geheimnisses von
 * den Signaturen (wie „kunde:" in kunden-id.ts). Der Zweck steht mit im HMAC:
 * Dieselbe IP hat je Weg einen anderen Schlüssel.
 */
export function bremsSchluessel(geheimnis: string, zweck: string, merkmal: string): string {
  const hash = createHmac('sha256', geheimnis)
    .update(`bremse:${zweck}:${merkmal}`)
    .digest('hex')
    .slice(0, SCHLUESSEL_HASH_LAENGE)
  return `${zweck}:${hash}`
}

/** Adressen zählen ohne Rand und klein — wie die erste Stufe (anmeldecode-sperre.ts). */
export function adressMerkmal(email: string): string {
  return email.trim().toLowerCase()
}

/** Erlaubt, solange der Zähler NACH diesem Versuch die Grenze nicht übersteigt. */
export function innerhalbDerGrenze(zaehler: number, max: number): boolean {
  return zaehler <= max
}

/** Sekunden bis zum Ende des Fensters, mindestens 1 — für `Retry-After`. */
export function sekundenBisFensterEnde(jetzt: Date, fensterMs: number): number {
  return Math.max(1, Math.ceil((fensterEnde(jetzt, fensterMs).getTime() - jetzt.getTime()) / 1000))
}
