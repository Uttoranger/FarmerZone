import * as Sentry from '@sentry/nextjs'
import {
  WIEDERHOLUNG_PAUSE_MS,
  fehleranzeigeMeldungFaellig,
  istVerbindungsabbruch,
  verbindungsUrsache,
} from '@/lib/verbindungsfehler'
import { bereinigeFehlerText } from '@/lib/upload-diagnose'
import { ohneAnfrage } from '@/lib/sentry-hygiene'

/*
 * Eine Wiederholung für öffentliche Lesepfade (Nr. 47) — Regel und Erkennung
 * in src/lib/verbindungsfehler.ts.
 *
 * NUR LESEN, NIE IN EINER TRANSAKTION: Eine wiederholte Leseabfrage richtet
 * nichts an. Ein wiederholtes Schreiben könnte doppelt buchen, und in einer
 * Transaktion ist die Verbindung nach dem Fehler ohnehin verbraucht. Welche
 * Stellen wiederholen dürfen, hält tests/oeffentlich-lesen.test.ts fest.
 *
 * SENTRY ERST, WENN AUCH DIE WIEDERHOLUNG SCHEITERT: Ein einzelner Schluckauf
 * des Poolers, den die zweite Runde heilt, ist kein Befund. Scheitert sie,
 * meldet dieser Helfer — auch beim Neubau im Hintergrund, wo kein Aufrufer
 * den Fehler mehr sieht (`unstable_cache` schreibt ihn dort nur ins Log) —
 * und reicht den Fehler weiter. Die Seiten fragen `schonGemeldet`, damit er
 * nicht zweimal ankommt.
 */

const gemeldet = new WeakSet<object>()

/** Hat `leseOeffentlichMitWiederholung` diesen Fehler schon an Sentry gemeldet? */
export function schonGemeldet(fehler: unknown): boolean {
  return typeof fehler === 'object' && fehler !== null && gemeldet.has(fehler)
}

function warteKurz(ms: number): Promise<void> {
  return new Promise((fertig) => setTimeout(fertig, ms))
}

/** Fester Text, Fehlerklasse, SQLSTATE und Kennung — der Rohtext nur bereinigt. */
function meldeVerbindungsabbruch(lesepfad: string, fehler: unknown): void {
  const { code, ursache } = verbindungsUrsache(fehler)
  const meldung = new Error('Öffentliche Abfrage: Datenbank auch nach einer Wiederholung nicht erreichbar')
  meldung.name = fehler instanceof Error ? fehler.name : 'Unbekannt'
  Sentry.captureException(meldung, {
    level: 'error',
    tags: { bereich: 'oeffentlich-lesen', lesepfad, grund: 'verbindung', code: code ?? 'unbekannt', ...(ursache ? { ursache } : {}) },
    extra: {
      versuche: 2,
      pauseMs: WIEDERHOLUNG_PAUSE_MS,
      ...(fehler instanceof Error ? { fehlertext: bereinigeFehlerText(fehler.message) } : {}),
    },
  })
  if (typeof fehler === 'object' && fehler !== null) gemeldet.add(fehler)
}

/**
 * Liest; bricht die Verbindung ab (SQLSTATE 08006, EAUTHTIMEOUT), genau
 * einmal neu nach `WIEDERHOLUNG_PAUSE_MS`. Jeder andere Fehler geht sofort
 * weiter. `warte` geben nur Tests mit.
 */
export async function leseOeffentlichMitWiederholung<T>(
  lesepfad: string,
  lesen: () => Promise<T>,
  { warte = warteKurz }: { warte?: (ms: number) => Promise<void> } = {}
): Promise<T> {
  try {
    return await lesen()
  } catch (erster) {
    if (!istVerbindungsabbruch(erster)) throw erster
  }
  await warte(WIEDERHOLUNG_PAUSE_MS)
  try {
    return await lesen()
  } catch (zweiter) {
    if (istVerbindungsabbruch(zweiter)) meldeVerbindungsabbruch(lesepfad, zweiter)
    throw zweiter
  }
}

// ─── Die Fehleranzeige wird ausgeliefert (Nr. 56) ──────────────────────────

/**
 * Wann diese Instanz zuletzt gemeldet hat, dass die Fehleranzeige
 * ausgeliefert wurde, und wie oft seither still. Modul-Zustand: auf Vercel je
 * warmer Instanz, ein Kaltstart beginnt neu — „je Instanz" ist die Zusage.
 */
export type FehleranzeigeMeldungen = { letzteMeldungMs: number | null; unterdrueckt: number }

/** Ein frischer Stand — der Modul-Zustand unten, und für Tests ein eigener je „Instanz". */
export function neueFehleranzeigeMeldungen(): FehleranzeigeMeldungen {
  return { letzteMeldungMs: null, unterdrueckt: 0 }
}

const FEHLERANZEIGEN_DIESER_INSTANZ = neueFehleranzeigeMeldungen()

/** Der feste Satz der Meldung — ohne Personendaten, ohne Suchtext. */
export const FEHLERANZEIGE_MELDUNG = 'Öffentliche Hofliste: Fehleranzeige ausgeliefert'

/**
 * Die Seite liefert ihre Fehleranzeige statt der Liste aus: eine Warnung mit
 * Tag `sichtbar=ja`, höchstens einmal je Instanz und zehn Minuten
 * (`fehleranzeigeMeldungFaellig`); die nächste nennt, wie oft die Anzeige
 * dazwischen still kam. Der Fehler selbst geht wie bisher getrennt nach
 * Sentry — diese Meldung sagt nur, dass ihn eine Kundin zu sehen bekam.
 *
 * Ohne Anfrage-Daten und Brotkrumen (`ohneAnfrage`): Die Adresse von /hoefe
 * trägt den Suchtext (?q=…). Scheitert Sentry, bleibt es still — die
 * Fehleranzeige steht ohnehin. `jetzt` und `meldungen` geben nur Tests mit.
 * Gibt zurück, ob eine Meldung fällig war.
 */
export function meldeFehleranzeige(
  bereich: string,
  jetzt: Date = new Date(),
  meldungen: FehleranzeigeMeldungen = FEHLERANZEIGEN_DIESER_INSTANZ
): boolean {
  if (!fehleranzeigeMeldungFaellig(meldungen.letzteMeldungMs, jetzt.getTime())) {
    meldungen.unterdrueckt += 1
    return false
  }
  const unterdruecktSeitLetzterMeldung = meldungen.unterdrueckt
  meldungen.letzteMeldungMs = jetzt.getTime()
  meldungen.unterdrueckt = 0
  try {
    Sentry.captureMessage(FEHLERANZEIGE_MELDUNG, (scope) =>
      scope
        .setLevel('warning')
        .setTags({ bereich, sichtbar: 'ja' })
        .setExtra('unterdruecktSeitLetzterMeldung', unterdruecktSeitLetzterMeldung)
        .addEventProcessor(ohneAnfrage)
    )
  } catch {
    // Telemetrie scheitert leise — die Fehleranzeige steht ohnehin.
  }
  return true
}
