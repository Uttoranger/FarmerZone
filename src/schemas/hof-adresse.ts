import { z } from 'zod'
import { HOFNAME_MAX } from '@/lib/eingabegrenzen'
import { SLUG_MAX, SLUG_MUSTER } from '@/lib/slug'

/**
 * Die Frei-Prüfung der Hofadresse (checkSlugAvailability, Nr. 17c) ist eine
 * öffentliche Aktion — auch die Registrierung ruft sie ohne Anmeldung. Ihr
 * Hofname gehorcht denselben Grenzen wie beim Anlegen (hofAnlegenSchema:
 * Ränder weg, höchstens HOFNAME_MAX), nur muss etwas drinstehen. Meldungen
 * braucht es keine: Die Vorschau zeigt bei ungültiger Eingabe nichts an, den
 * Fehler am Feld meldet das Formular selbst.
 */
export const adressPruefungSchema = z.string().trim().min(1).max(HOFNAME_MAX)

/**
 * Der daraus erzeugte Slug, bevor er die Datenbank erreicht — zweite Sperre
 * hinter generateSlug: Format und Länge wie die Slug-Regeln (src/lib/slug.ts).
 */
export const hofSlugSchema = z.string().max(SLUG_MAX).regex(SLUG_MUSTER)
