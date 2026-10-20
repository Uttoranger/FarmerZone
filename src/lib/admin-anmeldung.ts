import { MARKE } from '@/lib/marke'
import { uhrzeitInWien } from '@/lib/fristen'
import { anmeldeZeitpunkt } from '@/lib/geraete'

/*
 * Admin nur mit Passkey (Register N20, Ergänzung Lauf 18; Nr. 115) — die
 * Regeln rein und ohne Datenbank, dazu die Texte der Seiten /login/admin,
 * /admin/einrichten, /admin/einstellungen/anmeldung, /admin/bestaetigen und
 * des Dialogs „Mit Passkey bestätigen". Wer etwas entscheidet:
 *  - src/lib/auth.ts (Hooks): Registrierung nur in den Fällen a–c
 *    (registrierungsFall), Anmeldeart der Sitzung (anmeldeartFuerPfad),
 *    Passkey-Adresse (passkeyAdresse).
 *  - src/server/admin-wache.ts: 12 Stunden (adminSitzungAbgelaufen), Pflicht
 *    (passkeyPflicht), frische Bestätigung (frischBestaetigt).
 * Ersatzcodes selbst (Form, Zufall, Hash) stehen in src/lib/ersatzcodes.ts.
 */

const MINUTE_MS = 60_000
const STUNDE_MS = 60 * MINUTE_MS

/** Admin-Sitzungen enden 12 Stunden nach dem Anmelden, ohne „Gerät merken" (N20). */
export const ADMIN_SITZUNG_STUNDEN = 12
/** Eine frische Bestätigung mit Passkey gilt 5 Minuten für heikle Aktionen (N20). */
export const FRISCH_MINUTEN = 5
/** Den ersten Passkey gibt es nur in den 24 Stunden nach `adminSeit` (N20). */
export const EINRICHTEN_FENSTER_STUNDEN = 24
/** Fälle a und b: Die Sitzung ist höchstens 15 Minuten alt (eigene Prüfung — `freshAge` des Plugins ist 1 Tag). */
export const EINRICHTEN_SITZUNG_MINUTEN = 15
/** Der E-Mail-Code der Einrichtung: 6 Ziffern, 10 Minuten (Freigabe §21, Punkt 3). */
export const EINRICHTUNGSCODE_STELLEN = 6
export const EINRICHTUNGSCODE_GUELTIG_MINUTEN = 10

/**
 * Wie eine Sitzung entstand — gesetzt beim Anlegen (databaseHooks in
 * src/lib/auth.ts). `ersatzcodeEingeloest`: Die Sitzung hat ihren einen neuen
 * Passkey schon angelegt (bedingtes Schreiben in registration.afterVerification).
 */
export const ANMELDEART = {
  passwort: 'passwort',
  passkey: 'passkey',
  ersatzcode: 'ersatzcode',
  ersatzcodeEingeloest: 'ersatzcode-eingeloest',
} as const

/** Better-Auth-Pfad der Anmeldung mit Ersatzcode (eigenes kleines Plugin in src/lib/auth.ts). */
export const ERSATZCODE_ANMELDEN_PFAD = '/admin-ersatzcode/anmelden'

/** Zweck des E-Mail-Codes der Einrichtung in EinmalLink — je Sitzung (Nr. 114: `<art>:<bezug>`). */
export const EINRICHTUNGSCODE_ART = 'admin-einrichten'

export const ADMIN_PFAD = {
  anmelden: '/login/admin',
  bereich: '/admin',
  einrichten: '/admin/einrichten',
  anmeldung: '/admin/einstellungen/anmeldung',
  bestaetigen: '/admin/bestaetigen',
} as const

/** Antwort einer Admin-Aktion, die erst nach einer frischen Bestätigung geht — useFrischBestaetigt öffnet dann den Dialog. */
export const FRISCH_FEHLER = 'frisch'

/** Welche Anmeldeart ein Better-Auth-Pfad ergibt; null = keine Admin-Anmeldung (Code, Bestätigung …). */
export function anmeldeartFuerPfad(pfad: string | null | undefined): string | null {
  switch (pfad) {
    case '/sign-in/email':
      return ANMELDEART.passwort
    case '/passkey/verify-authentication':
      return ANMELDEART.passkey
    case ERSATZCODE_ANMELDEN_PFAD:
      return ANMELDEART.ersatzcode
    default:
      return null
  }
}

/** Sitzung älter als 12 Stunden? Dann gilt sie für den Admin-Bereich nicht mehr. */
export function adminSitzungAbgelaufen(angemeldetAm: Date, jetzt: Date): boolean {
  return jetzt.getTime() - angemeldetAm.getTime() >= ADMIN_SITZUNG_STUNDEN * STUNDE_MS
}

/** Höchstens 5 Minuten seit der letzten Bestätigung mit Passkey (genau 5:00 zählt noch). */
export function frischBestaetigt(passkeyAm: Date | null, jetzt: Date): boolean {
  if (passkeyAm === null) return false
  const alter = jetzt.getTime() - passkeyAm.getTime()
  return alter >= 0 && alter <= FRISCH_MINUTEN * MINUTE_MS
}

export type PasskeyStand = {
  anzahl: number
  /** createdAt des jüngsten Passkeys. */
  juengsterPasskey: Date | null
  /** benutztAm des zuletzt benutzten Ersatzcodes. */
  letzterErsatzcode: Date | null
}

/**
 * Die Pflicht „erst Passkey, dann Admin-Bereich": kein Passkey, oder der
 * zuletzt benutzte Ersatzcode ist jünger als der jüngste Passkey (nach einem
 * Ersatzcode ist ein neuer Passkey Pflicht).
 */
export function passkeyPflicht(stand: PasskeyStand): boolean {
  if (stand.anzahl === 0) return true
  if (stand.letzterErsatzcode === null) return false
  return stand.juengsterPasskey === null || stand.letzterErsatzcode.getTime() > stand.juengsterPasskey.getTime()
}

/** Bis wann der erste Passkey eingerichtet werden darf — null, wenn das Recht kein `adminSeit` trägt. */
export function einrichtenBis(adminSeit: Date | null): Date | null {
  return adminSeit === null ? null : new Date(adminSeit.getTime() + EINRICHTEN_FENSTER_STUNDEN * STUNDE_MS)
}

export function einrichtenOffen(adminSeit: Date | null, jetzt: Date): boolean {
  const bis = einrichtenBis(adminSeit)
  return bis !== null && jetzt.getTime() <= bis.getTime() && jetzt.getTime() >= (adminSeit?.getTime() ?? 0)
}

function sitzungJungGenug(angemeldetAm: Date, jetzt: Date): boolean {
  const alter = jetzt.getTime() - angemeldetAm.getTime()
  return alter >= 0 && alter <= EINRICHTEN_SITZUNG_MINUTEN * MINUTE_MS
}

export type RegistrierungsLage = {
  isAdmin: boolean
  adminSeit: Date | null
  passkeys: number
  sitzung: { angemeldetAm: Date; anmeldeart: string | null; passkeyAm: Date | null }
  /** Ein E-Mail-Code der Einrichtung wurde in DIESER Sitzung bestätigt. */
  codeBestaetigt: boolean
}

/** a: erster Passkey · b: nach Ersatzcode genau einer · c: weiterer, frisch bestätigt. */
export type RegistrierungsFall = 'erster' | 'ersatzcode' | 'weiterer'

/**
 * Darf diese Sitzung einen Passkey anlegen, und in welchem Fall (Freigabe
 * §21 Punkt 3, Lauf 18 Punkt 7)? null = nein (403 mit neutralem Text).
 *  (a) erster Passkey: keiner vorhanden, `adminSeit` höchstens 24 Stunden
 *      alt, Sitzung höchstens 15 Minuten alt und mit Passwort, E-Mail-Code in
 *      dieser Sitzung bestätigt;
 *  (b) Ersatzcode: Sitzung höchstens 15 Minuten alt mit Anmeldeart
 *      `ersatzcode` — genau einer (den Anspruch verbraucht afterVerification);
 *  (c) weiterer Passkey: schon einer da und `passkeyAm` höchstens 5 Minuten
 *      alt — nie in einer Sitzung aus einem Ersatzcode (sonst wären es zwei).
 */
export function registrierungsFall(lage: RegistrierungsLage, jetzt: Date): RegistrierungsFall | null {
  if (!lage.isAdmin) return null
  const { sitzung } = lage
  if (sitzung.anmeldeart === ANMELDEART.ersatzcode) return sitzungJungGenug(sitzung.angemeldetAm, jetzt) ? 'ersatzcode' : null
  if (sitzung.anmeldeart === ANMELDEART.ersatzcodeEingeloest) return null
  if (lage.passkeys === 0) {
    const erster =
      einrichtenOffen(lage.adminSeit, jetzt) &&
      sitzung.anmeldeart === ANMELDEART.passwort &&
      sitzungJungGenug(sitzung.angemeldetAm, jetzt) &&
      lage.codeBestaetigt
    return erster ? 'erster' : null
  }
  return frischBestaetigt(sitzung.passkeyAm, jetzt) ? 'weiterer' : null
}

export type EinrichtenLage = Omit<RegistrierungsLage, 'isAdmin' | 'codeBestaetigt'> & {
  /** Gilt die Pflicht (passkeyPflicht)? */
  pflicht: boolean
  codeBestaetigtAm: Date | null
}

/**
 * Was die Pflichtseite /admin/einrichten gerade zeigt (Mockup Schritt 4):
 *  - bestaetigen: erst der E-Mail-Code (Sitzung mit Passwort, jung genug);
 *  - passkey: bestätigt, jetzt den Passkey einrichten;
 *  - ersatzcode: nach einem Ersatzcode den einen neuen Passkey einrichten;
 *  - neu-anmelden: Sitzung zu alt oder nicht mit Passwort;
 *  - gesperrt: 24-Stunden-Fenster vorbei oder `adminSeit` leer;
 *  - ersatzcode-abgelaufen: nach einem Ersatzcode, aber die 15 Minuten sind um;
 *  - eingerichtet: Passkey da — Ersatzcodes und zweiter Passkey folgen.
 */
export type EinrichtenZustand = 'bestaetigen' | 'passkey' | 'ersatzcode' | 'neu-anmelden' | 'gesperrt' | 'ersatzcode-abgelaufen' | 'eingerichtet'

export function einrichtenZustand(lage: EinrichtenLage, jetzt: Date): EinrichtenZustand {
  const { sitzung } = lage
  const jung = sitzungJungGenug(sitzung.angemeldetAm, jetzt)
  if (sitzung.anmeldeart === ANMELDEART.ersatzcode && jung && (lage.passkeys === 0 || lage.pflicht)) return 'ersatzcode'
  if (lage.passkeys > 0) return lage.pflicht ? 'ersatzcode-abgelaufen' : 'eingerichtet'
  if (!einrichtenOffen(lage.adminSeit, jetzt)) return 'gesperrt'
  if (sitzung.anmeldeart !== ANMELDEART.passwort || !jung) return 'neu-anmelden'
  return lage.codeBestaetigtAm === null ? 'bestaetigen' : 'passkey'
}

/**
 * Wohin /admin/bestaetigen nach der Bestätigung führt: nur ein relativer Pfad
 * unter /admin, sonst /admin — keine offene Weiterleitung (auch nicht über
 * „//fremd", „/\fremd", „/admin.fremd" oder kodierte Schrägstriche).
 */
export function sichererWeiterPfad(weiter: string | null | undefined): string {
  if (typeof weiter !== 'string' || !weiter.startsWith('/') || weiter.startsWith('//') || /[\\\s]/.test(weiter)) return ADMIN_PFAD.bereich
  let url: URL
  try {
    url = new URL(weiter, 'http://admin.invalid')
  } catch {
    return ADMIN_PFAD.bereich
  }
  if (url.origin !== 'http://admin.invalid') return ADMIN_PFAD.bereich
  if (url.pathname !== ADMIN_PFAD.bereich && !url.pathname.startsWith(`${ADMIN_PFAD.bereich}/`)) return ADMIN_PFAD.bereich
  if (/%2f|%5c/i.test(url.pathname)) return ADMIN_PFAD.bereich
  return `${url.pathname}${url.search}`
}

export function bestaetigenAdresse(weiter: string): string {
  return `${ADMIN_PFAD.bestaetigen}?weiter=${encodeURIComponent(sichererWeiterPfad(weiter))}`
}

/**
 * rpID und Herkunft der Passkeys aus der App-Adresse — geschützt bestimmt:
 * unlesbar oder leer → null, und hooks.before lehnt alle Passkey-Wege mit 503
 * ab (beim Laden von auth.ts wirft nichts). Ein Passkey gilt nur unter der
 * Adresse, unter der er eingerichtet wurde: in Vorschauen die Branch-Adresse,
 * unter der Adresse eines einzelnen Deployments scheitert er (gewollt).
 * `lokaleAppUrl` nur lokal (pnpm dev): Läuft der Server auf einem anderen
 * Port als 3000 (Bild-Test mit virtuellem Authenticator), nennt
 * NEXT_PUBLIC_APP_URL ihn — zählt nur als http://localhost:<Port>.
 */
export function passkeyAdresse(appUrl: string | null, lokaleAppUrl?: string | null): { rpID: string; origin: string[] } | null {
  if (!appUrl) return null
  let url: URL
  try {
    url = new URL(appUrl)
  } catch {
    return null
  }
  if (!url.hostname || (url.protocol !== 'https:' && url.protocol !== 'http:')) return null
  const origin = [url.origin]
  const lokal = lokaleHerkunft(lokaleAppUrl)
  if (lokal && url.hostname === 'localhost' && !origin.includes(lokal)) origin.push(lokal)
  return { rpID: url.hostname, origin }
}

/** http://localhost:<Port> aus NEXT_PUBLIC_APP_URL — sonst null. */
export function lokaleHerkunft(wert: string | null | undefined): string | null {
  if (!wert) return null
  try {
    const url = new URL(wert)
    return url.protocol === 'http:' && url.hostname === 'localhost' ? url.origin : null
  } catch {
    return null
  }
}

// ── Texte ───────────────────────────────────────────────────────────────────

export const ADMIN_ANMELDEN_TEXT = {
  seitentitel: 'Admin-Anmeldung',
  marke: `${MARKE} Admin`,
  titel: 'Admin-Anmeldung',
  einleitung: 'Melde dich mit deinem Passkey an: mit dem Handy, an diesem PC oder mit einem Sicherheitsschlüssel. Was davon, fragt dein Browser.',
  knopf: 'Mit Passkey anmelden',
  knopfLaeuft: 'Dein Browser fragt …',
  ersatzcodeOeffnen: 'Ersatzcode eingeben',
  ersatzcodeTitel: 'Mit Ersatzcode anmelden',
  ersatzcodeSatz: 'Nur für den Notfall: Jeder Code gilt einmal. Danach richtest du gleich einen neuen Passkey ein.',
  email: 'E-Mail',
  code: 'Ersatzcode',
  codePlatzhalter: 'XXXX-XXXX',
  ersatzcodeKnopf: 'Anmelden',
  hinweis:
    'Kein Passwort, kein Code per SMS oder E-Mail für Admin-Konten. Für das Handy braucht der PC Bluetooth; ohne Bluetooth: Passkey am PC (Windows Hello mit PIN) oder ein Sicherheitsschlüssel.',
  linkAufLogin: 'Mit Passkey anmelden',
  zumAdminBereich: 'Zum Admin-Bereich',
} as const

/** Sätze für Fehler der Anmeldung mit Passkey und Ersatzcode — keiner verrät, ob es ein Konto gibt. */
export const ADMIN_ANMELDEN_FEHLER = {
  abgebrochen: 'Die Anmeldung mit Passkey wurde abgebrochen. Versuch es noch einmal.',
  nutzerpruefung: 'Bitte bestätige mit Fingerabdruck, Gesicht oder PIN deines Geräts.',
  unbekannt: 'Diesen Passkey kennen wir nicht. Nimm den Passkey, den du für dein Admin-Konto eingerichtet hast.',
  fremdesKonto: 'Dieser Passkey gehört zu einem anderen Konto.',
  ersatzcodeFalsch: 'Diese Kombination aus E-Mail und Ersatzcode passt nicht.',
  zuViele: 'Das waren zu viele Versuche. Warte eine Stunde und probier es dann noch einmal.',
  nichtVerfuegbar: 'Die Anmeldung mit Passkey ist gerade nicht verfügbar. Versuch es später noch einmal.',
  allgemein: 'Das hat nicht geklappt. Versuch es noch einmal.',
} as const

/** Neutrale Absage, wenn eine Sitzung keinen Passkey anlegen darf (403). */
export const REGISTRIERUNG_GESPERRT = 'Einen Passkey kannst du hier gerade nicht einrichten.'

/**
 * Der Satz zu einem Fehler aus `signIn.passkey()`, `passkey.addPasskey()` oder
 * der Anmeldung mit Ersatzcode — nach dem `code` der Antwort (Server: die
 * Codes aus src/lib/auth.ts und des Plugins; Browser: WebAuthnError).
 */
export function passkeyFehlerText(fehler: { status?: number } | null | undefined): string {
  // Better Auth schickt den Code mit, sein Fehlertyp kennt ihn nicht immer.
  const code = (fehler as { code?: unknown } | null | undefined)?.code
  switch (typeof code === 'string' ? code : undefined) {
    case 'PASSKEY_FREMDES_KONTO':
      return ADMIN_ANMELDEN_FEHLER.fremdesKonto
    case 'NUTZERPRUEFUNG_FEHLT':
      return ADMIN_ANMELDEN_FEHLER.nutzerpruefung
    case 'PASSKEY_NOT_FOUND':
      return ADMIN_ANMELDEN_FEHLER.unbekannt
    case 'ERSATZCODE_FALSCH':
      return ADMIN_ANMELDEN_FEHLER.ersatzcodeFalsch
    case 'ZU_VIELE_VERSUCHE':
      return ADMIN_ANMELDEN_FEHLER.zuViele
    case 'PASSKEY_NICHT_VERFUEGBAR':
      return ADMIN_ANMELDEN_FEHLER.nichtVerfuegbar
    case 'PASSKEY_NICHT_ERLAUBT':
      return REGISTRIERUNG_GESPERRT
    case 'AUTH_CANCELLED':
    case 'REGISTRATION_CANCELLED':
    case 'ERROR_CEREMONY_ABORTED':
    case 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY':
      return ADMIN_ANMELDEN_FEHLER.abgebrochen
  }
  return fehler?.status === 429 ? ADMIN_ANMELDEN_FEHLER.zuViele : ADMIN_ANMELDEN_FEHLER.allgemein
}

export const EINRICHTEN_TEXT = {
  seitentitel: 'Admin-Zugang absichern',
  titel: 'Admin-Zugang absichern',
  einleitung: `Bevor sich der Admin-Bereich öffnet, richtest du deinen Passkey ein. Ab dann meldest du dich mit diesem Konto nur noch mit Passkey an – auch für deinen Hof.`,
  schrittBestaetigt: 'Bestätigt mit Passwort und Code per E-Mail',
  bestaetigtUm: (zeitpunkt: Date): string => `heute, ${uhrzeitInWien(zeitpunkt)} – gilt ${EINRICHTEN_SITZUNG_MINUTEN} Minuten für die Einrichtung`,
  schrittErsatzcode: 'Angemeldet mit Ersatzcode',
  ersatzcodeSatz: `Richte jetzt einen neuen Passkey ein – das geht ${EINRICHTEN_SITZUNG_MINUTEN} Minuten nach der Anmeldung.`,
  codeSchicken: 'Code per E-Mail schicken',
  codeErneut: 'Neuen Code schicken',
  codeGeschickt: `Wir haben dir einen Code per E-Mail geschickt. Er gilt ${EINRICHTUNGSCODE_GUELTIG_MINUTEN} Minuten.`,
  codeFeld: 'Code aus der E-Mail',
  codePruefen: 'Bestätigen',
  codeFalsch: 'Der Code stimmt nicht oder ist abgelaufen.',
  passwortNoetig: `Melde dich dafür neu mit Passwort an – die Einrichtung geht nur in den ersten ${EINRICHTEN_SITZUNG_MINUTEN} Minuten nach der Anmeldung.`,
  neuAnmelden: 'Neu anmelden',
  schrittPasskey: 'Passkey einrichten',
  schrittPasskeySatz: 'am Handy oder an diesem PC – dein Browser führt dich',
  einrichten: 'Einrichten',
  einrichtenLaeuft: 'Dein Browser fragt …',
  eingerichtet: 'Passkey eingerichtet',
  schrittErsatzcodes: 'Ersatzcodes sichern',
  schrittErsatzcodesSatz: '10 Codes für den Notfall – kommt nach dem Passkey',
  ersatzcodesErstellen: 'Ersatzcodes erstellen',
  ersatzcodesGesichert: 'Ersatzcodes gesichert',
  schrittZweiter: 'Zweiter Passkey (empfohlen)',
  schrittZweiterSatz: 'am PC (Windows Hello mit PIN) oder ein Sicherheitsschlüssel',
  zweiterEinrichten: 'Hinzufügen',
  fensterBis: (bis: Date): string =>
    `Die Einrichtung geht nur bis ${anmeldeZeitpunkt(bis)} – ${EINRICHTEN_FENSTER_STUNDEN} Stunden, nachdem das Admin-Recht vergeben wurde. Danach muss es neu gesetzt werden. Dein Hof bleibt die ganze Zeit erreichbar.`,
  gesperrt: 'Die Einrichtung ist gesperrt – das Admin-Recht muss neu gesetzt werden.',
  gesperrtSatz: 'Dein Hof bleibt erreichbar. Melde dich bei der Projektleitung.',
  ersatzcodeAbgelaufen: `Den neuen Passkey richtest du in den ersten ${EINRICHTEN_SITZUNG_MINUTEN} Minuten nach der Anmeldung mit Ersatzcode ein. Melde dich dafür mit einem weiteren Ersatzcode neu an.`,
  zurAnmeldung: 'Zur Admin-Anmeldung',
  fertig: 'Zum Admin-Bereich',
  fehlerPasskey: 'Der Passkey ließ sich nicht einrichten. Versuch es noch einmal.',
} as const

export const ANMELDUNG_EINSTELLUNG_TEXT = {
  titel: 'Anmeldung',
  satz: 'Passkeys, Ersatzcodes und angemeldete Geräte deines Admin-Kontos.',
  passkeys: 'Passkeys',
  hinzufuegen: 'Passkey hinzufügen',
  eingerichtet: 'eingerichtet',
  ohneName: 'Passkey',
  entfernen: 'Entfernen',
  entfernenFrage: 'Diesen Passkey entfernen?',
  entfernenSatz: 'Mit diesem Passkey kannst du dich danach nicht mehr anmelden. Wir schicken dir eine E-Mail.',
  letzter: 'Den letzten Passkey kannst du nicht entfernen.',
  ersatzcodes: 'Ersatzcodes',
  uebrig: (n: number, von: number): string => `${n} von ${von} übrig`,
  zuletztBenutzt: (wann: Date): string => `zuletzt einer benutzt am ${anmeldeZeitpunkt(wann)}`,
  nieBenutzt: 'bisher keiner benutzt',
  keine: 'Keine gültigen Codes – erstelle neue.',
  neueErstellen: 'Neue erstellen',
  neueFrage: 'Neue Ersatzcodes erstellen?',
  neueSatz: 'Die bisherigen Codes gelten danach nicht mehr.',
  geraete: 'Angemeldete Geräte',
  regel: `Admin-Sitzungen enden nach ${ADMIN_SITZUNG_STUNDEN} Stunden. Heikle Aktionen fragen den Passkey erneut (gilt ${FRISCH_MINUTEN} Minuten).`,
  abbrechen: 'Abbrechen',
} as const

export const FRISCH_TEXT = {
  marke: 'Heikle Aktion',
  titel: 'Bitte bestätige mit deinem Passkey',
  satz: 'Diese Aktion geht erst nach einer frischen Bestätigung.',
  knopf: 'Mit Passkey bestätigen',
  knopfLaeuft: 'Dein Browser fragt …',
  hinweis: `Dein Browser fragt dann wie bei der Anmeldung: Handy (er zeigt dafür den QR-Code), dieser PC oder Sicherheitsschlüssel. Gilt danach ${FRISCH_MINUTEN} Minuten für weitere heikle Aktionen.`,
  abbrechen: 'Abbrechen',
  nichtBestaetigt: 'Nicht bestätigt – die Aktion ist nicht passiert.',
  seitentitel: 'Bestätigen',
  seitenSatz: 'Der Download geht erst nach einer frischen Bestätigung mit deinem Passkey.',
  weiter: 'Weiter',
} as const

export const ADMIN_AKTION_FEHLER = {
  pflicht: 'Richte zuerst deinen Passkey ein.',
  /** Das Konto hat einen Passkey, diese Sitzung hat keinen benutzt (Passwort-Sitzung von vor der Einrichtung). */
  ohnePasskey: 'Melde dich für den Admin-Bereich mit deinem Passkey an.',
  abgelaufen: 'Deine Admin-Sitzung ist abgelaufen. Melde dich neu mit deinem Passkey an.',
  letzterPasskey: 'Den letzten Passkey kannst du nicht entfernen.',
  passkeyFehlt: 'Diesen Passkey gibt es nicht mehr.',
} as const

// ── Mail „Admin-Sicherheit" (src/emails/admin-sicherheit.tsx) ───────────────

export type AdminSicherheitAnlass = 'passkey-hinzugefuegt' | 'passkey-entfernt' | 'ersatzcode-benutzt' | 'einrichtungscode'

export const ADMIN_SICHERHEIT_MAIL = {
  betreff: {
    'passkey-hinzugefuegt': 'Neuer Passkey bei deinem Admin-Konto',
    'passkey-entfernt': 'Passkey entfernt',
    'ersatzcode-benutzt': 'Ersatzcode benutzt',
    einrichtungscode: 'Dein Code für die Einrichtung',
  },
  satz: {
    'passkey-hinzugefuegt': 'wurde bei deinem Admin-Konto ein neuer Passkey eingerichtet:',
    'passkey-entfernt': 'wurde bei deinem Admin-Konto ein Passkey entfernt:',
    'ersatzcode-benutzt': 'hat sich jemand mit einem Ersatzcode bei deinem Admin-Konto angemeldet:',
    einrichtungscode: 'gib diesen Code auf der Seite „Admin-Zugang absichern" ein:',
  },
  anrede: 'Hallo,',
  vorher: 'am',
  warstDu: 'Warst du das? Dann musst du nichts tun. Sonst melde dich sofort bei der Projektleitung.',
  ersatzcodeFolge: 'Bevor sich der Admin-Bereich wieder öffnet, richtest du einen neuen Passkey ein.',
  codeGilt: `Der Code gilt ${EINRICHTUNGSCODE_GUELTIG_MINUTEN} Minuten und nur in der Sitzung, in der du ihn angefordert hast.`,
  codeNichtDu: 'Du wolltest keinen Passkey einrichten? Dann melde dich bei der Projektleitung.',
  fuss: `Diese E-Mail enthält keinen Link zum Anmelden. ${MARKE} fragt dich nie per Mail nach einem Passkey oder Ersatzcode.`,
} as const
