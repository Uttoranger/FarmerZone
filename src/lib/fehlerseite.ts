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
import { MELDUNG_KENNUNG_MAX } from '@/lib/meldung'

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
 * Was als Fehlernummer durchgeht.
 *
 * `error.digest` ist in Next.js ein Hash aus Ziffern; die Zeichenklasse ist
 * trotzdem streng, denn der Wert landet in einer URL und von dort in ein
 * Formularfeld: Erlaubt sind nur Buchstaben, Ziffern, Bindestrich und
 * Unterstrich. Alles andere fällt weg, nicht die ganze Kennung — ein Hash mit
 * einem Leerzeichen am Ende ist noch brauchbar.
 */
const ERLAUBT = /[^A-Za-z0-9_-]/g

/**
 * Bereinigt eine Fehlernummer für URL und Formular. Leer, wenn nichts
 * Brauchbares übrig bleibt.
 *
 * ZU LANG HEISST LEER, nicht abgeschnitten: Das Feld im Briefkasten nimmt
 * höchstens MELDUNG_KENNUNG_MAX Zeichen (`src/schemas/meldung.ts`), und eine
 * abgeschnittene Fehlernummer zeigt auf den falschen Fehler. Die vollständige
 * Nummer steht auf der Fehlerseite selbst — von dort lässt sie sich kopieren.
 */
export function bereinigeKennung(roh: unknown): string {
  if (typeof roh !== 'string') return ''
  const sauber = roh.trim().replace(ERLAUBT, '')
  return sauber.length === 0 || sauber.length > MELDUNG_KENNUNG_MAX ? '' : sauber
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
