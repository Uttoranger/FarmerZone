import type { DbBremse } from '@/lib/bremse-datenbank'
import { tagVersetzt, wienKalendertag } from '@/lib/kalender'
import { MARKE } from '@/lib/marke'
import { link, type AgbStueck } from '@/lib/rechtstexte/stuecke'
import type { ProductCategoryValue } from '@/lib/taxonomie'

/*
 * Widerruf online (§ 13a FAGG, Register N39, Nr. 200) — die reinen Regeln:
 * wann eine Bestellung widerrufen werden kann, der Hinweis je Kategorie
 * (§ 18 FAGG, nur Hinweis, keine Entscheidung) und alle Sätze aus EINER
 * Quelle (`WIDERRUF_TEXT`). Gespeichert, gebucht und verschickt wird in
 * src/server/widerruf.ts.
 *
 * Bewusst ohne zod und ohne Prisma-Laufzeit: Die Kasse liest den Rücktrittssatz
 * von hier (CODING_STANDARDS §3, „Kein Zod im Browser der Kundenseiten").
 *
 * BELEHRUNG: Der Wortlaut der Muster-Widerrufsbelehrung (Anhang I FAGG,
 * Teil A) und des Muster-Formulars (Teil B) kommt aus dem RIS
 * (ris.bka.gv.at, Bundesrecht konsolidiert, FAGG). Beim Bau am 30.10.2026 war
 * das RIS aus der Bauumgebung nicht erreichbar (Netz gesperrt) — deshalb steht
 * unten ein PLATZHALTER mit Vermerk (`BELEHRUNG`), kein Text aus dem Gedächtnis.
 * Nachtragen: Wortlaut wörtlich übernehmen, nur die Platzhalter ersetzen
 * („der Hof, bei dem du bestellt hast (Name und Anschrift in deiner
 * Bestellung)“ und „Agrilo leitet weiter“), Quelle und Abrufdatum hier.
 */

/** Frist in Kalendertagen ab der Abholung (§ 11 FAGG; AGB Punkt 12.1). */
export const WIDERRUF_FRIST_TAGE = 14

export const WIDERRUF_PFAD = '/widerruf'

export const WIDERRUF_STAENDE = ['eingegangen', 'rueckgabe_erhalten', 'erstattet', 'abgelehnt'] as const
export type WiderrufStand = (typeof WIDERRUF_STAENDE)[number]

export const WIDERRUF_UMFAENGE = ['ganz', 'teil'] as const
export type WiderrufUmfang = (typeof WIDERRUF_UMFAENGE)[number]

/** Längen der Felder — dieselben wie in der Tabelle (VarChar) und im Schema. */
export const WIDERRUF_GRENZEN = { name: 120, nachricht: 500, grund: 300, bestellnummer: 40, email: 254 } as const

/** Vermerk im Feld `grund`, wenn der Hof bar erstattet hat (Freigabe 200 Punkt 5). */
export const BAR_ERSTATTET = 'bar erstattet'

/**
 * Die Bremse ohne Link (Freigabe 200 Punkt 9): 5 je IP und Stunde, 3 je
 * Adresse und Tag — über alle Instanzen (src/server/bremse-datenbank.ts).
 */
const STUNDE_MS = 60 * 60 * 1000
export const WIDERRUF_BREMSEN = {
  ip: { zweck: 'widerruf-ip', max: 5, fensterMs: STUNDE_MS },
  adresse: { zweck: 'widerruf-adresse', max: 3, fensterMs: 24 * STUNDE_MS },
} as const satisfies Record<string, DbBremse>

/** Was `widerrufMoeglich` von der Bestellung braucht. */
export type WiderrufBestellung = { kaeuferArt: string; status: string; pickedUpAt: Date | null }

/** Der letzte Tag der Frist (Wiener Kalendertag JJJJ-MM-TT) — Tag der Abholung + 14. */
export function widerrufFristEnde(pickedUpAt: Date): string {
  return tagVersetzt(wienKalendertag(pickedUpAt), WIDERRUF_FRIST_TAGE)
}

/**
 * Kann diese Bestellung online widerrufen werden? Nur Verbraucherinnen
 * (PRIVAT), nie eine stornierte Bestellung. Vor der Abholung immer (fachlich
 * ein Storno, src/server/widerruf.ts), danach bis einschließlich zum 14.
 * Wiener Kalendertag nach der Abholung.
 */
export function widerrufMoeglich(b: WiderrufBestellung, jetzt: Date): boolean {
  if (b.kaeuferArt !== 'PRIVAT') return false
  if (b.status === 'CANCELLED') return false
  if (!b.pickedUpAt) return true
  return wienKalendertag(jetzt) <= widerrufFristEnde(b.pickedUpAt)
}

const VERDERBLICH = 'Frische Lebensmittel verderben schnell – hier gilt das Rücktrittsrecht wahrscheinlich nicht (§ 18 Abs. 1 Z 4 FAGG). Der Hof prüft das im Einzelfall.'
const HALTBAR = 'Diese Ware ist meist haltbar – der Rücktritt ist hier wahrscheinlich möglich. Der Hof prüft das im Einzelfall.'
const JE_NACH_WARE = 'Ob du hier zurücktreten kannst, hängt von der Ware ab (etwa ob sie schnell verdirbt oder versiegelt war). Der Hof prüft das im Einzelfall.'

/**
 * Ein Satz je Produktkategorie, ob eine Ausnahme nach § 18 Abs. 1 FAGG
 * wahrscheinlich greift (AGB Punkt 12.2). NUR ein Hinweis: Die App entscheidet
 * nichts, der Hof prüft im Einzelfall und begründet eine Ablehnung (N39).
 * Vollständig über alle Werte von `ProductCategory` (TypeScript erzwingt jeden).
 */
const AUSNAHME_HINWEIS: Record<ProductCategoryValue, string> = {
  MILCH: VERDERBLICH,
  EIER: VERDERBLICH,
  FLEISCH: VERDERBLICH,
  FISCH: VERDERBLICH,
  GEMUESE: VERDERBLICH,
  OBST: VERDERBLICH,
  BROT: VERDERBLICH,
  HONIG: HALTBAR,
  GETRAENKE: JE_NACH_WARE,
  FUTTERMITTEL: HALTBAR,
  HEU_STROH: HALTBAR,
  GETREIDE_KOERNER: HALTBAR,
  MISCHFUTTER: HALTBAR,
  ERGAENZUNGSFUTTER: HALTBAR,
  BRENNHOLZ: HALTBAR,
  SONSTIGES: JE_NACH_WARE,
}

export function ausnahmeHinweis(kategorie: ProductCategoryValue): string {
  return AUSNAHME_HINWEIS[kategorie]
}

/** Eine gewählte Position: immer die ganze Menge der Position (Teilmengen bucht kein bestehender Weg). */
export type WiderrufPosition = { orderItemId: string; menge: number }

/** Die Positionen aus der JSON-Spalte — beim Lesen geprüft; Unlesbares gilt als keine Auswahl. */
export function lesePositionen(roh: unknown): WiderrufPosition[] {
  if (!Array.isArray(roh)) return []
  return roh.flatMap((p: unknown) => {
    if (typeof p !== 'object' || p === null) return []
    const { orderItemId, menge } = p as Record<string, unknown>
    return typeof orderItemId === 'string' && typeof menge === 'number' && Number.isInteger(menge) && menge > 0 ? [{ orderItemId, menge }] : []
  })
}

/**
 * Gehören die gewählten Positionen zu DIESER Bestellung (und fehlen nicht
 * schon)? null = nein (eine fremde, doppelte oder schon fehlende Position) —
 * dann wird nichts angelegt. Sonst die Positionen mit ihrer ganzen Menge.
 */
export function waehlePositionen(
  gewaehlt: readonly string[],
  bestellung: readonly { id: string; quantity: number; fehlt: boolean }[]
): WiderrufPosition[] | null {
  if (gewaehlt.length === 0 || new Set(gewaehlt).size !== gewaehlt.length) return null
  const ergebnis: WiderrufPosition[] = []
  for (const id of gewaehlt) {
    const p = bestellung.find((b) => b.id === id)
    if (!p || p.fehlt) return null
    ergebnis.push({ orderItemId: id, menge: p.quantity })
  }
  return ergebnis
}

/** Umfasst die Auswahl alle noch vorhandenen Positionen? Dann ist es fachlich die ganze Bestellung. */
export function deckungGanz(positionen: readonly WiderrufPosition[], bestellung: readonly { id: string; fehlt: boolean }[]): boolean {
  const offen = bestellung.filter((b) => !b.fehlt)
  return offen.length > 0 && offen.every((b) => positionen.some((p) => p.orderItemId === b.id))
}

/** „30. Oktober 2026, 14:05 Uhr“ — Datum und Uhrzeit des Eingangs in Wien (Mail und Bestätigungsseite). */
export function eingangZeitpunkt(am: Date): string {
  const datum = am.toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })
  const zeit = am.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' })
  return `${datum}, ${zeit} Uhr`
}

/** Die Bestellnummer, wie die Kundin sie tippt, für den genauen Vergleich: ohne Ränder, in Großbuchstaben. */
export function normalisiereBestellnummer(eingabe: string): string {
  return eingabe.trim().toUpperCase()
}

/** Wie der Stand heißt (Hof, Admin) — Zustandswort, nie nur Farbe. */
export const WIDERRUF_STAND_TEXT: Record<WiderrufStand, string> = {
  eingegangen: 'Eingegangen',
  rueckgabe_erhalten: 'Rückgabe erhalten',
  erstattet: 'Erstattet',
  abgelehnt: 'Abgelehnt',
}

/** Alle Sätze aus einer Quelle (Freigabe 200: Knöpfe wörtlich). */
export const WIDERRUF_TEXT = {
  knopfWiderrufen: 'Vertrag widerrufen',
  knopfBestaetigen: 'Widerruf bestätigen',
  fussLink: 'Vertrag widerrufen',
  titel: 'Vertrag widerrufen',
  einleitung: `Hier kannst du deinen Kaufvertrag mit dem Hof widerrufen. Dein Vertragspartner ist der Hof, bei dem du bestellt hast – ${MARKE} leitet deinen Widerruf an ihn weiter und bestätigt dir den Eingang sofort per E-Mail.`,
  // Kasse (Freigabe 200 Punkt 8): neben dem Kaufknopf, nicht bei „Betrieb“.
  kasseSatz: [
    'Du kannst vom Kauf innerhalb von 14 Tagen nach der Abholung zurücktreten – außer bei schnell verderblicher Ware. So geht’s: ',
    link('Rücktritt', WIDERRUF_PFAD),
  ] satisfies AgbStueck[] as readonly AgbStueck[],
  ganz: 'Die ganze Bestellung',
  teil: 'Einzelne Artikel',
  positionenTitel: 'Was willst du widerrufen?',
  name: 'Dein Name',
  email: 'Deine E-Mail-Adresse',
  emailHinweis: 'An diese Adresse schicken wir die Eingangsbestätigung.',
  bestellnummer: 'Bestellnummer',
  bestellnummerHinweis: 'Steht in deiner Bestellbestätigung, z. B. HM-2611-A4F2.',
  freitext: 'Welche Artikel?',
  freitextHinweis: 'Schreib kurz, welche Artikel du zurückgeben willst.',
  nachricht: 'Nachricht an den Hof (freiwillig)',
  zusammenfassung: 'Bitte prüfe deinen Widerruf',
  zusammenfassungSatz: 'Mit „Widerruf bestätigen“ schickst du den Widerruf ab.',
  zurueck: 'Zurück',
  eingangTitel: 'Dein Widerruf ist bei uns eingegangen',
  eingangAm: (zeit: string) => `Eingegangen am ${zeit}.`,
  eingangMail: 'Wir haben dir eine Bestätigung per E-Mail geschickt.',
  naechsteSchritte: [
    'Der Hof, bei dem du bestellt hast, ist dein Vertragspartner. Wir leiten deinen Widerruf an ihn weiter.',
    'Hast du noch nicht abgeholt, wird die Bestellung storniert; was du online bezahlt hast, bekommst du zurück.',
    'Hast du die Ware schon abgeholt, bring sie bitte innerhalb von 14 Tagen zum Hof zurück. Der Hof meldet sich und erstattet dir den Betrag.',
  ],
  speichern: 'Drucken oder speichern',
  fehlerEingabe: 'Bitte prüf deine Angaben.',
  fehlerZuViele: 'Zu viele Versuche. Bitte versuch es später noch einmal.',
  fehlerSpeichern: 'Wir konnten deinen Widerruf nicht speichern. Versuch es bitte gleich noch einmal.',
  nichtMehr: 'Diese Bestellung lässt sich hier nicht mehr widerrufen. Wende dich bitte direkt an den Hof.',
  linkUngueltig: 'Dieser Link ist nicht gültig',
  // Belehrung: Platzhalter, solange der RIS-Wortlaut fehlt (Kopfkommentar).
  belehrungTitel: 'Rücktrittsbelehrung',
  formularTitel: 'Muster-Rücktrittsformular',
  // Hof
  hofKarteTitel: 'Widerruf eingegangen',
  hofKarteSatz: (n: number) => (n === 1 ? 'Eine Kundin hat einen Kauf widerrufen.' : `${n} Kundinnen haben einen Kauf widerrufen.`),
  hofErstatten: 'Rückgabe erhalten – erstatten …',
  hofAblehnen: 'Ablehnen …',
  hofGrund: 'Grund der Ablehnung',
  hofGrundHinweis: 'Pflicht. Die Kundin bekommt den Grund per E-Mail.',
  hofErstattenSatz: 'Die Kundin bekommt den Preis der zurückgegebenen Ware zurück – online über Stripe, bar gibst du ihn selbst zurück.',
  hofBarSatz: 'Bar bezahlt: Gib den Betrag bar zurück. Wir vermerken „bar erstattet“.',
  hofGrundFehlt: 'Bitte schreib einen Grund.',
  hofErstattet: 'Erstattung gespeichert',
  hofAbgelehnt: 'Ablehnung gespeichert',
  hofFehler: 'Das hat nicht geklappt. Versuch es bitte gleich noch einmal.',
  hofPostfach: (nummer: string) => `Widerruf zu Bestellung ${nummer}: Bitte prüf die Rückgabe und erstatte oder lehne mit Grund ab.`,
  hofAusnahme: 'Ausnahmen nach § 18 FAGG (etwa schnell verderbliche Ware) prüfst du im Einzelfall.',
} as const

/** Die Belehrung — Platzhalter mit Vermerk, bis der Wortlaut aus dem RIS übernommen ist. */
export const BELEHRUNG = {
  platzhalter: true,
  vermerk: 'Der Wortlaut der Muster-Widerrufsbelehrung (Anhang I FAGG, Teil A) und des Muster-Formulars (Teil B) wird nach Prüfung hier eingefügt.',
  agbHinweis: [
    'Bis dahin gilt, was in unseren AGB unter Punkt 12 „Rücktritt vom Kaufvertrag“ steht: ',
    link('AGB lesen', '/agb'),
  ] satisfies AgbStueck[] as readonly AgbStueck[],
} as const
