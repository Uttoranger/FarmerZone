import { DB_BREMSEN, type DbBremse } from '@/lib/bremse-datenbank'
import { kundenNavigation } from '@/lib/kunden-navigation'
import { UNTEN } from '@/lib/bauern-navigation'

/*
 * Zahlen und Namen der Datenschutzerklärung, die aus dem Code folgen
 * (Nachtlauf Nr. 57). Die Seite (src/app/(public)/datenschutz/page.tsx)
 * schreibt sie nicht selbst hin, sondern nimmt sie von hier;
 * tests/datenschutz-sachstand.test.ts gleicht sie mit dem Code und mit
 * vercel.json ab. Ändert sich ein Fenster, der Cron oder ein Name, schlägt
 * der Test an und erinnert daran, die Erklärung nachzuziehen.
 */

const STUNDE_MS = 60 * 60 * 1000
const TAG_MS = 24 * STUNDE_MS

/**
 * Um diese Stunde (UTC) löscht der tägliche Cron `cleanup-reservations` die
 * abgelaufenen Zähler der Bremse — dieselbe Zahl wie in vercel.json
 * (`0 3 * * *`). Steht hier, weil vercel.json kein Modul ist.
 */
export const ZAEHLER_AUFRAEUMEN_STUNDE_UTC = 3

/**
 * So viel später kann der Cron anlaufen: Im Hobby-Tarif (docs/ai/TECH_STACK.md
 * §5) startet Vercel einen täglichen Cron irgendwann innerhalb der angegebenen
 * Stunde, nicht pünktlich zur vollen Stunde. Das steht in Vercels Regeln, nicht
 * im Code — deshalb als eigene Konstante und als offene Frage im Bericht 57
 * (Tarif und Laufzeit prüfen).
 */
export const ZAEHLER_AUFRAEUMEN_SPIEL_MS = STUNDE_MS

/**
 * Wie lange ein Zähler der Bremse höchstens in der Datenbank steht, auf ganze
 * Stunden aufgerundet: sein Fenster plus die Wartezeit bis zum ersten
 * Aufräumen nach dem Fensterende (gelöscht wird erst, wenn `ablauf` vorbei
 * ist, src/server/bremse-datenbank.ts), plus das Spiel beim Start des Crons.
 *
 * Die Fenster beginnen bei Vielfachen ihrer Länge seit 1970 (`fensterBeginn`).
 * Ein Fenster unter einem Tag kann deshalb zu jeder Uhrzeit enden, kurz nach
 * einem Aufräumen — dann wartet die Zeile bis zum nächsten Tag. Ein Fenster
 * aus ganzen Tagen endet immer um Mitternacht UTC, das Aufräumen folgt ab
 * `ZAEHLER_AUFRAEUMEN_STUNDE_UTC`.
 */
export function zaehlerHoechstensStunden(fensterMs: number): number {
  const ganzeTage = fensterMs % TAG_MS === 0
  const bisZumAufraeumenMs = ganzeTage ? ZAEHLER_AUFRAEUMEN_STUNDE_UTC * STUNDE_MS : TAG_MS
  return Math.ceil((fensterMs + bisZumAufraeumenMs + ZAEHLER_AUFRAEUMEN_SPIEL_MS) / STUNDE_MS)
}

/**
 * Wonach die Bremsen zählen — so nennt sie die Erklärung (Abschnitt 2,
 * „Schutz vor Missbrauch"). Jede Bremse aus `DB_BREMSEN` steht in genau einer
 * Gruppe; kommt eine neue dazu, schlägt die Wache an.
 */
export const ZAEHLER_JE_MERKMAL = {
  ip: [
    DB_BREMSEN.anmeldecodeAnfordernIp,
    DB_BREMSEN.anmeldecodePruefenIp,
    DB_BREMSEN.registrierungIp,
    DB_BREMSEN.meldungIp,
    DB_BREMSEN.bestellungenAnfordernIp,
    DB_BREMSEN.bestellungenPruefenIp,
    DB_BREMSEN.checkoutIp,
  ],
  adresse: [DB_BREMSEN.anmeldecodeAdresse, DB_BREMSEN.bestellungenAdresse],
  // Die zufällige Kennung, die der Browser für Warenkorb und Reservierung
  // anlegt (localStorage, src/lib/use-cart.ts) — im Code „Sitzung".
  warenkorb: [DB_BREMSEN.checkoutSitzung],
  bestellung: [DB_BREMSEN.neuigkeitenBestellung],
  // Die Kennung eines Hofs (Tagesfenster, damit eine Sentry-Meldung höchstens
  // einmal am Tag kommt, Register Z2). Die Erklärung nennt diesen Zähler heute
  // nicht; ob sie es soll, ist eine offene Frage im Bericht 57.
  hof: [DB_BREMSEN.stripeKontoUnbekannt],
} as const satisfies Record<string, readonly DbBremse[]>

function hoechstensStunden(bremsen: readonly DbBremse[]): number {
  return Math.max(...bremsen.map((bremse) => zaehlerHoechstensStunden(bremse.fensterMs)))
}

/** Die beiden Höchstdauern, die die Erklärung nennt. */
export const ZAEHLER_STUNDEN = {
  /** Zähler je IP-Adresse, E-Mail-Adresse oder Warenkorb-Kennung. */
  person: hoechstensStunden([...ZAEHLER_JE_MERKMAL.ip, ...ZAEHLER_JE_MERKMAL.adresse, ...ZAEHLER_JE_MERKMAL.warenkorb]),
  /** Zähler je Bestellung (Anmeldung zu Neuigkeiten auf der Bestätigungsseite). */
  bestellung: hoechstensStunden(ZAEHLER_JE_MERKMAL.bestellung),
} as const

// ── Namen aus der Oberfläche ─────────────────────────────────────────────────
//
// Die Erklärung nennt Punkte so, wie die Navigation sie zeigt. Fehlt ein Punkt
// einmal, bleibt der Name leer — dann schlägt die Wache an, statt dass die
// Seite einen alten Namen weiterträgt.

/** „Mein Konto" — der Punkt im Kopf einer Kundensitzung (src/lib/kunden-navigation.ts). */
export const MEIN_KONTO = kundenNavigation({ sitzung: 'kunde' }).konto?.label ?? ''

/** „Hilfe und Rückmeldung" — dort melden Höfe Fehler (Seitenleiste und Mehr-Blatt, src/lib/bauern-navigation.ts). */
export const HILFE_UND_RUECKMELDUNG = UNTEN.find((punkt) => punkt.id === 'hilfe')?.label ?? ''
