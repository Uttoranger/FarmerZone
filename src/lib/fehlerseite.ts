/**
 * Die Texte der Fehlerseiten und der Weg in den Briefkasten — rein, ohne DOM.
 *
 * WARUM HIER UND NICHT IN DEN SEITEN: Die 500 gibt es zweimal. `error.tsx`
 * fängt einen Fehler innerhalb des Root-Layouts, `global-error.tsx` einen im
 * Root-Layout selbst — und dann ist das Layout weg, die Seite bringt ihr
 * eigenes `<html>` mit. Zwei Dateien mit demselben Wortlaut laufen
 * auseinander, sobald jemand einen Satz ändert. Hier steht er einmal.
 *
 * Die Texte sind geduzt und nennen keine Technik (CODING_STANDARDS §4): Eine
 * Kundin, die auf einen alten Link getippt hat, braucht einen Weg zurück,
 * keinen Statuscode.
 */
import { kennungAusUrl } from '@/schemas/fehlerseite'

/** 404 — irgendeine Adresse, die es nicht gibt. */
export const NICHT_GEFUNDEN_TITEL = 'Diese Seite gibt es nicht (mehr)'
export const NICHT_GEFUNDEN_TEXT =
  'Vielleicht hat sich der Link geändert, oder der Hof ist nicht mehr dabei. ' +
  'Von hier aus findest du schnell zurück.'

/**
 * 404 der Hofseite — derselbe Fall, aber die Besucherin wollte zu EINEM Hof.
 *
 * Ein stillgelegter Hof landet bewusst hier und nicht in einer eigenen
 * Ansicht: Warum ein Hof nicht mehr da ist, ist seine Sache, nicht die der
 * Besucherin. „Gibt es nicht (mehr)" ist für beide Fälle wahr.
 */
export const HOF_NICHT_GEFUNDEN_TITEL = 'Diesen Hof gibt es hier nicht (mehr)'
export const HOF_NICHT_GEFUNDEN_TEXT =
  'Vielleicht hat sich der Link geändert, oder der Hof ist nicht mehr dabei. ' +
  'Andere Höfe in deiner Nähe findest du hier.'

/**
 * 404 der Produktseite (Nr. 11) — der Hof, das Produkt oder beides gibt es
 * hier nicht (mehr), oder es steht gerade nicht im Shop. Auch hier kein Grund:
 * Die Seite unterscheidet die Fälle bewusst nicht (ein ausgeblendetes Produkt
 * soll sich nicht verraten).
 */
export const PRODUKT_NICHT_GEFUNDEN_TITEL = 'Dieses Produkt gibt es hier nicht (mehr)'
export const PRODUKT_NICHT_GEFUNDEN_TEXT =
  'Vielleicht ist es gerade nicht im Angebot, oder der Link hat sich geändert. ' +
  'Frische Produkte von Höfen in deiner Nähe findest du hier.'

/** 500 — unser Fehler. Beide Fehlerseiten sagen denselben Satz. */
export const FEHLER_TITEL = 'Da ist etwas schiefgelaufen'
export const FEHLER_TEXT = 'Das liegt an uns, nicht an dir. Deine Bestellungen und Daten sind sicher.'

/**
 * 500 im Hofbereich (Nr. 175, Board system-sterne-kein-netz, Punkt 4): Die
 * Seite steht unter dem Layout der Gruppe, die Unterleiste bleibt — darum
 * führt der Weg zurück zu Heute, nicht zur Startseite der Kundinnen.
 */
export const HOF_FEHLER_TEXT = 'Deine Bestellungen und Produkte sind sicher. Probier es gleich noch einmal – oder geh zu Heute.'

/** Der Kicker über der Überschrift beider 500 — mit Fehlernummer, wenn es eine gibt. */
export function fehlerKicker(fehlernummer?: string): string {
  const kennung = bereinigeKennung(fehlernummer)
  return kennung === '' ? 'Fehler 500' : `Fehler 500 · Nr. ${kennung}`
}

/** Der Kicker über der Überschrift jeder 404. */
export const NICHT_GEFUNDEN_KICKER = 'Fehler 404'

/** Das Suchfeld der 404 des Hauses (nur dort, Board s3/w3-fehlerseiten Bild 1). */
export const SUCHE_TEXT = { beschriftung: 'Hof oder Produkt suchen', platzhalter: 'Hof oder Produkt suchen …' } as const

/** Die Knopfbeschriftungen — auch sie gibt es mehrfach. */
export const ZU_HEUTE = 'Zu Heute'
/**
 * Der Weg zurück zum Hof auf der 404 eines Produkts. Ohne Namen: Eine
 * not-found-Datei kennt nur die Adresse, nicht den Hof (Board „Zu Hof Müller“
 * zeigt Beispieldaten), und ob es den Hof noch gibt, verrät der Link nicht.
 */
export const ZUM_HOF = 'Zum Hof'
export const ZUR_STARTSEITE = 'Zur Startseite'
export const HOEFE_ENTDECKEN = 'Höfe entdecken'
export const NOCHMAL_VERSUCHEN = 'Nochmal versuchen'
export const PROBLEM_MELDEN = 'Problem melden'

// ─── Der gemeinsame Aufbau (Lauf 30, Nr. 231; Boards s3/w3-fehlerseiten) ─────
//
// Jede Fehlerseite hat denselben Aufbau: Kreis mit Zeichen, Kicker, h1, Satz,
// ein Hauptknopf und ein Umriss (die 500 dazu „Problem melden“). Gezeichnet
// wird er EINMAL (`FehlerseiteAufbau`, src/components/shared/fehler-ansicht.tsx);
// hier steht, was je Fall verschieden ist: das Zeichen und die Welt.

/** Welche Welt die Seite trägt: Kundschaft grün, Hofbereich orange (N42 a, V51). */
export type FehlerWelt = 'kunde' | 'hof'

/** Das Zeichen im Kreis: die 404 zeigt einen Weg (Kompass), die 500 eine Warnung. */
export type FehlerZeichen = 'weg' | 'warnung'

/** Der Ton des Kreises je Zeichen — 404 ruhig grün, 500 orange, in beiden Welten gleich (Board). */
export const FEHLER_KREIS_TON: Record<FehlerZeichen, 'gruen' | 'orange'> = { weg: 'gruen', warnung: 'orange' }

/** Der Ton des Hauptknopfs je Welt: „Nochmal versuchen“ ist bei der Kundschaft grün, im Hofbereich orange. */
export const FEHLER_KNOPF_TON: Record<FehlerWelt, 'gruen' | 'orange'> = { kunde: 'gruen', hof: 'orange' }

/** Der Name des Parameters, über den die Fehlernummer in den Briefkasten kommt. */
export const KENNUNG_PARAMETER = 'kennung'

/**
 * Die Fehlernummer, geprüft — leer, wenn nichts Brauchbares übrig bleibt.
 *
 * Die Regel samt Begründung steht in `src/schemas/fehlerseite.ts`;
 * hier bleibt nur der bequeme Griff, den Seite und Link benutzen. Die
 * Prüfung wirft nicht, sie fällt auf den leeren Text zurück.
 */
export function bereinigeKennung(roh: unknown): string {
  return kennungAusUrl(roh)
}

/** Der Weg für den Hofbereich zu „Problem melden" (dessen eigener Briefkasten, Nr. 175/176). */
export const PROBLEM_MELDEN_HOF = '/fehler-melden'

/**
 * Der Link auf „Problem melden", mit der Fehlernummer vorausgefüllt.
 *
 * Ohne brauchbare Nummer der nackte Link — ein leerer Parameter in der URL
 * sagt nichts und sieht aus wie ein Fehler. Im Hofbereich geht es in dessen
 * eigenen Briefkasten (`/fehler-melden`, liest dieselbe Kennung).
 */
export function meldungLinkMitKennung(roh?: unknown, pfad: '/problem-melden' | '/fehler-melden' = '/problem-melden'): string {
  const kennung = bereinigeKennung(roh)
  if (kennung === '') return pfad
  return `${pfad}?${KENNUNG_PARAMETER}=${encodeURIComponent(kennung)}`
}
