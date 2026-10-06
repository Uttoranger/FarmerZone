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
import { kennungAusUrlSchema } from '@/schemas/fehlerseite'

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

/** Die Knopfbeschriftungen — auch sie gibt es mehrfach. */
export const ZUR_STARTSEITE = 'Zur Startseite'
export const HOEFE_ENTDECKEN = 'Höfe entdecken'
export const NOCHMAL_VERSUCHEN = 'Nochmal versuchen'
export const PROBLEM_MELDEN = 'Problem melden'

/** Der Name des Parameters, über den die Fehlernummer in den Briefkasten kommt. */
export const KENNUNG_PARAMETER = 'kennung'

/**
 * Die Fehlernummer, geprüft — leer, wenn nichts Brauchbares übrig bleibt.
 *
 * Die Regel samt Begründung steht im Schema (`src/schemas/fehlerseite.ts`);
 * hier bleibt nur der bequeme Griff, den Seite und Link benutzen. `parse`
 * wirft nicht: Das Schema fällt über `.catch` auf den leeren Text zurück.
 */
export function bereinigeKennung(roh: unknown): string {
  return kennungAusUrlSchema.parse(roh)
}

/**
 * Der Link auf „Problem melden", mit der Fehlernummer vorausgefüllt.
 *
 * Ohne brauchbare Nummer der nackte Link — ein leerer Parameter in der URL
 * sagt nichts und sieht aus wie ein Fehler.
 */
export function meldungLinkMitKennung(roh?: unknown): string {
  const kennung = bereinigeKennung(roh)
  if (kennung === '') return '/problem-melden'
  return `/problem-melden?${KENNUNG_PARAMETER}=${encodeURIComponent(kennung)}`
}
