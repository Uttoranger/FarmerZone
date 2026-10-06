/**
 * Texte der Seite „Für Höfe" (/fuer-hoefe, Nr. 15, Mockups web-h0-fuer-hoefe
 * und mobil-h0-fuer-hoefe) und der Schritte, die Registrieren daneben zeigt.
 * Preise stehen hier keine — die kommen aus src/lib/konditionen.ts.
 *
 * Die Antworten der Fragen beschreiben, was der Code heute tut (Stripe
 * Connect, „Nicht abgeholt" in servicegebuehr-Sprint, Pausieren über
 * Farm.isPaused) — keine Zusage darüber hinaus.
 */
import { SERVICEGEBUEHR_SATZ_TEXT } from '@/lib/konditionen'

export type Vorteil = { titel: string; text: string; kurz: string }

export const FUER_HOEFE_VORTEILE: readonly Vorteil[] = [
  {
    titel: 'Alle Bestellungen an einem Ort',
    text: 'Statt Anrufen und Zetteln: eine Liste je Abholzeit, abhaken beim Packen, Barbetrag steht schon drauf.',
    kurz: 'Packliste je Abholzeit',
  },
  {
    titel: 'Planbar',
    text: 'Du legst Abholzeiten und Bestellschluss fest. Der Vorrat zählt automatisch mit, ausverkauft heißt ausverkauft.',
    kurz: 'Abholzeiten und Bestellschluss legst du fest',
  },
  {
    titel: 'Voller Preis für dich',
    text: 'Die Servicegebühr zahlt der Kunde. Online-Zahlungen kommen per Stripe direkt auf dein Konto.',
    kurz: 'die Servicegebühr zahlt der Kunde',
  },
  {
    titel: 'Mehr Stammkunden',
    // Das QR-Plakat des Mockups kommt erst mit Gate 7 (Nr. 21) — bis dahin nicht versprechen.
    text: 'Ein Tipp, und dein Wochenangebot geht per WhatsApp an deine Kunden.',
    kurz: 'Wochenangebot per WhatsApp teilen',
  },
]

export type StartSchritt = { titel: string; text: string }

/** „So startest du" auf /fuer-hoefe. */
export const FUER_HOEFE_SCHRITTE: readonly StartSchritt[] = [
  { titel: 'Registrieren', text: 'Name, E-Mail, Passwort – zwei Minuten.' },
  { titel: 'Hof einrichten', text: 'Fotos, Abholzeiten, Produkte – in Ruhe, vor der Freischaltung.' },
  { titel: 'Zahlung einrichten', text: 'Online-Zahlung über Stripe und das SEPA-Mandat für die Monatsabrechnung.' },
  { titel: 'Freischaltung', text: 'Wir schauen kurz drüber, dann bist du online.' },
]

/** „So geht es weiter" neben dem Registrieren-Formular — dieselben Schritte, kürzer. */
export const REGISTRIEREN_SCHRITTE: readonly StartSchritt[] = [
  { titel: 'Konto erstellen', text: 'zwei Minuten, genau hier' },
  { titel: 'Hof einrichten', text: 'Fotos, Abholzeiten, Produkte – in Ruhe' },
  { titel: 'Zahlung einrichten', text: 'Stripe für Online-Zahlung, SEPA für die Monatsabrechnung' },
  { titel: 'Freischaltung', text: 'wir schauen kurz drüber, dann bist du online' },
]

/** Das Band zu Futter — E10-Wortlaut aus dem Mockup, ohne Zusage, dass die Plattform prüft (E9). */
export const FUER_HOEFE_FUTTER = {
  titel: 'Auch für Heu, Stroh und Futter',
  text:
    'Vom 1-kg-Sackerl für den Hasen bis zum Rundballen. Für lose Ware und Ballen aus eigener Ernte genügt deine ' +
    'LFBIS-Nummer – wir zeigen dir, wann du mehr brauchst.',
} as const

export type Frage = { frage: string; antwort: string }

export const FUER_HOEFE_FRAGEN: readonly Frage[] = [
  {
    frage: 'Brauche ich eine eigene Website?',
    antwort:
      // „mit QR-Code für den Hofladen" (Mockup) erst mit Gate 7 (Nr. 21).
      'Nein. Du bekommst eine eigene Hofseite unter farmerzone.at/dein-hof – zum Teilen per Link oder WhatsApp.',
  },
  {
    frage: 'Wie kommt das Geld zu mir?',
    antwort:
      'Online-Zahlungen laufen über Stripe und kommen direkt auf dein Konto. Barzahlungen kassierst du bei der ' +
      `Abholung selbst. Die Servicegebühr von ${SERVICEGEBUEHR_SATZ_TEXT} zahlt der Kunde zusätzlich.`,
  },
  {
    frage: 'Was, wenn ein Kunde nicht abholt?',
    antwort:
      'Du markierst die Bestellung als „Nicht abgeholt". Online bezahlt bleibt der Warenpreis bei dir; die ' +
      'Servicegebühr fällt dann weg.',
  },
  {
    frage: 'Kann ich pausieren, z. B. im Urlaub?',
    antwort:
      'Ja. Im Urlaubsmodus bleibt deine Hofseite sichtbar, aber niemand kann bestellen. Du schaltest ihn in den ' +
      'Einstellungen ein und wieder aus.',
  },
]

/** Der Abschluss unten auf der Seite. */
export const FUER_HOEFE_SCHLUSS = {
  titel: 'Bereit für deinen Hofladen online?',
  text: 'Registrieren dauert zwei Minuten. Einrichten kannst du in Ruhe.',
} as const
