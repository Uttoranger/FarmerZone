import type { DbBremse } from '@/lib/bremse-datenbank'
import { tagVersetzt, wienKalendertag } from '@/lib/kalender'
import { MARKE } from '@/lib/marke'
import { PRODUKTION_HOST } from '@/lib/umgebung'
import { formatiereTelefon } from '@/lib/telefon-anzeige'
import type { MarkeArt } from '@/lib/marke-art'
import { link, type AgbStueck } from '@/lib/rechtstexte/stuecke'
import type { ProductCategoryValue } from '@/lib/taxonomie'
import { RUECKTRITT_TEXT, kostenSchaetzungSatz } from '@/lib/ruecktritt-angaben'

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
 * BELEHRUNG (Nr. 207): Muster-Widerrufsbelehrung (Teil A) und
 * Muster-Widerrufsformular (Teil B) nach Anhang I FAGG idF BGBl. I Nr. 59/2026
 * (gilt ab 1.10.2026), Wort für Wort.
 *   Quelle: https://ris.bka.gv.at/Dokumente/Bundesnormen/NOR40279264/NOR40279264.pdf
 *   Abgerufen: 31.10.2026.
 *   Wortlaut von der Projektleitung gegen das RIS geprüft übergeben; aus der
 *   Bauumgebung nicht abrufbar (Netz gesperrt).
 * Die Platzhalter in eckigen Klammern sind Daten, keine Textteile: Mit
 * signiertem Link bzw. in der Mail der eigenen Bestellung füllt sie
 * `belehrungMitHof` mit den Angaben des Hofs, sonst steht der Satz „… – stehen
 * in deiner Bestellung“. Nur die Domain steht als PRODUKTION_HOST (Register M1,
 * tests/marke-name-wache.test.ts); sonst ist kein Wort verändert.
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

/**
 * Der Hinweis je Position auf /widerruf: Hat der Hof beim Produkt „verdirbt
 * schnell – kein Rücktritt“ angegeben, steht zuerst diese Angabe (Nr. 214,
 * N39-Ergänzung), sonst der Satz je Kategorie. Die Position bleibt wählbar —
 * die App entscheidet nichts.
 */
export function ausnahmeHinweis(kategorie: ProductCategoryValue, keinRuecktritt = false): string {
  return keinRuecktritt ? RUECKTRITT_TEXT.widerrufKeinRuecktritt : AUSNAHME_HINWEIS[kategorie]
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

/**
 * Die gewählten Positionen, die noch nicht gestrichen sind (Nachbesserung
 * Runde 3): Nach einem nur teilweise gebuchten Teilwiderruf vor der Abholung
 * stehen die schon gestrichenen weiter im Widerruf — der Hof sieht und
 * erstattet nur den Rest. Eine Position, die es in der Bestellung nicht gibt,
 * fällt ebenfalls weg.
 */
export function offenePositionen(positionen: readonly WiderrufPosition[], bestellung: readonly { id: string; fehlt: boolean }[]): WiderrufPosition[] {
  return positionen.filter((p) => bestellung.some((b) => b.id === p.orderItemId && !b.fehlt))
}

/** Wurde von der Wahl schon etwas gestrichen (teilweise gebucht)? Dann gilt eine Ablehnung nur noch dem Rest. */
export function teilweiseGestrichen(positionen: readonly WiderrufPosition[], bestellung: readonly { id: string; fehlt: boolean }[]): boolean {
  return positionen.some((p) => bestellung.some((b) => b.id === p.orderItemId && b.fehlt))
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

/** Welche Marke der Stand trägt (Admin) — offen ist ein Auftrag, erstattet erledigt, abgelehnt abgebrochen. */
export const WIDERRUF_STAND_MARKE: Record<WiderrufStand, MarkeArt> = {
  eingegangen: 'tun',
  rueckgabe_erhalten: 'laeuft',
  erstattet: 'erledigt',
  abgelehnt: 'abgebrochen',
}

/** Der Stand aus der Datenbank; ein unbekannter Wert zählt als offen (nie still als erledigt). */
export function alsWiderrufStand(roh: string): WiderrufStand {
  return (WIDERRUF_STAENDE as readonly string[]).includes(roh) ? (roh as WiderrufStand) : 'eingegangen'
}

/** Der Anker der Liste „Widerrufe ohne Bestellung“ in Admin › Bestellungen (Ziel der Aufgabe). */
export const WIDERRUF_OHNE_BESTELLUNG_ANKER = 'widerrufe-ohne-bestellung'

/** Die Sätze im Admin (Bestellungen, Akte) — sachlich (Nachbesserung Runde 2). */
export const WIDERRUF_ADMIN_TEXT = {
  titel: 'Widerrufe',
  eingang: (zeit: string) => `Eingang ${zeit}`,
  nachricht: 'Nachricht der Kundin',
  grundHof: 'Grund des Hofs',
  ohneBestellungTitel: 'Widerrufe ohne Bestellung',
  ohneBestellungSatz: 'Nummer und E-Mail passten zu keiner Bestellung. Prüf die Angaben, such die Bestellung und ordne den Widerruf zu – danach läuft er wie jeder andere: vor der Abholung Storno, sonst an den Hof.',
  eingegebeneNummer: (nummer: string | null) => (nummer ? `eingegeben: ${nummer}` : 'ohne Nummer'),
  freitext: 'Einzelne Artikel (Freitext)',
  zuordnen: 'Zuordnen …',
  zuordnenTitel: 'Widerruf einer Bestellung zuordnen',
  zuordnenSatz: 'Vor der Abholung storniert das die Bestellung bzw. erstattet online bezahlte Artikel, danach geht der Widerruf an den Hof. Die Kundin hat die Eingangsbestätigung schon.',
  bestellnummer: 'Bestellnummer',
  zuordnenKnopf: 'Zuordnen',
  nummerFehlt: 'Gib bitte die Bestellnummer ein.',
  nummerZuLang: 'Die Bestellnummer ist zu lang.',
  nummerUnbekannt: 'Diese Bestellnummer gibt es nicht.',
  schonZugeordnet: 'Dieser Widerruf ist schon zugeordnet. Lade die Seite neu.',
  fertigErstattet: 'Zugeordnet. Vor der Abholung storniert – die Kundin bekommt die Mail dazu.',
  fertigHof: 'Zugeordnet. Der Hof hat den Widerruf im Postfach.',
  akteLeer: 'Zu Bestellungen dieses Hofs gibt es keinen Widerruf.',
  akteSatz: 'Die neuesten Widerrufe zu Bestellungen dieses Hofs – ohne Name, Adresse und Nachricht.',
} as const

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

/** Die Platzhalter in Anhang I FAGG — Daten, keine Textteile (Kopfkommentar). */
const HOF_ANGABEN_VOLL = '[Name, Anschrift, Telefonnummer und E-Mail-Adresse des Hofs]'
const HOF_ANGABEN_FORMULAR = '[Name, Anschrift und E-Mail-Adresse des Hofs]'

/** Ohne signierten Link (Auftrag 207, Punkt 0): der Hinweis, wo die Angaben stehen. */
export const HOF_ANGABEN_OHNE_LINK = {
  voll: '[Name, Anschrift, Telefonnummer und E-Mail-Adresse des Hofs – stehen in deiner Bestellung]',
  formular: '[Name, Anschrift und E-Mail-Adresse des Hofs – stehen in deiner Bestellung]',
} as const

export type BelehrungAbschnitt = { titel: string; absaetze: readonly string[] }
export type Belehrung = {
  teilA: { titel: string; abschnitte: readonly BelehrungAbschnitt[] }
  teilB: { titel: string; einleitung: string; zeilen: readonly string[]; fussnote: string }
  hinweisTitel: string
  hinweis: string
}

/** Nach diesem Satz steht bei sperriger Ware die Schätzung (Gestaltungshinweis 5 b, belehrungMitKostenschaetzung). */
const RUECKSENDEKOSTEN_SATZ = 'Sie tragen die unmittelbaren Kosten der Rücksendung der Waren.'

/** Anhang I FAGG, Teil A und B, wörtlich (Quelle im Kopfkommentar). */
export const BELEHRUNG: Belehrung = {
  teilA: {
    titel: 'Teil A – Widerrufsbelehrung',
    abschnitte: [
      {
        titel: 'Widerrufsrecht',
        absaetze: [
          'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.',
          'Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen haben bzw. hat.',
          `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${HOF_ANGABEN_VOLL}) mittels einer eindeutigen Erklärung (z. B. mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.`,
          `Sie können Ihr Widerrufsrecht auch online unter ${PRODUKTION_HOST}${WIDERRUF_PFAD} ausüben. Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung mit Informationen zum Inhalt der Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs.`,
          'Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.',
        ],
      },
      {
        titel: 'Folgen des Widerrufs',
        absaetze: [
          'Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.',
          'Wir können die Rückzahlung verweigern, bis wir die Waren wieder zurückerhalten haben oder bis Sie den Nachweis erbracht haben, dass Sie die Waren zurückgesandt haben, je nachdem, welches der frühere Zeitpunkt ist.',
          'Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen vierzehn Tagen ab dem Tag, an dem Sie uns über den Widerruf dieses Vertrags unterrichten, an uns zurückzusenden oder zu übergeben. Die Frist ist gewahrt, wenn Sie die Waren vor Ablauf der Frist von vierzehn Tagen absenden.',
          RUECKSENDEKOSTEN_SATZ,
          'Sie müssen für einen etwaigen Wertverlust der Waren nur aufkommen, wenn dieser Wertverlust auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise der Waren nicht notwendigen Umgang mit ihnen zurückzuführen ist.',
        ],
      },
    ],
  },
  teilB: {
    titel: 'Teil B – Muster-Widerrufsformular',
    einleitung: '(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück)',
    zeilen: [
      `– An ${HOF_ANGABEN_FORMULAR}:`,
      '– Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)',
      '– Bestellt am (*)/erhalten am (*)',
      '– Name des/der Verbraucher(s)',
      '– Anschrift des/der Verbraucher(s)',
      '– Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)',
      '– Datum',
    ],
    fussnote: '(*) Unzutreffendes streichen.',
  },
  // Getrennt vom Muster und als Hinweis gekennzeichnet (Auftrag 207, du-Form). Die Ausnahmen
  // nach § 18 Abs. 1 FAGG stehen NICHT hier, sondern je Position (ausnahmeHinweis).
  hinweisTitel: 'Hinweis',
  hinweis: 'Waren, die du am Hof abgeholt hast, kannst du dort auch zurückgeben; dann entstehen dir keine Rücksendekosten.',
}

/**
 * Die Angaben des Hofs für die Belehrung (Anhang I FAGG, Gestaltungshinweis 2):
 * Name (Hofname und Inhaber wie „Angaben zum Hof“), Anschrift, Telefon und
 * E-Mail. Was fehlt, ist ein leerer Text und fällt in der Zeile weg — kein
 * Platzhalter wird erfunden.
 */
export type BelehrungHof = { name: string; anschrift: string; telefon: string; email: string }

/**
 * Baut die vier Angaben aus dem Hof. `email` ist die Adresse, unter der der Hof
 * erreichbar ist (hofKontaktEmail, vom Aufrufer bestimmt); `sichtbar` = false
 * (stillgelegt oder geschlossen, hofSichtbar) lässt wie auf /widerruf bisher
 * nur den Namen stehen.
 */
export function belehrungHof(
  farm: { name: string; ownerName: string; address: string; postalCode: string; city: string; phone: string },
  email: string,
  sichtbar = true
): BelehrungHof {
  const name = [farm.name, farm.ownerName].map((t) => t.trim()).filter(Boolean).join(', ')
  if (!sichtbar) return { name, anschrift: '', telefon: '', email: '' }
  const ort = [farm.postalCode, farm.city].map((t) => t.trim()).filter(Boolean).join(' ')
  const telefon = farm.phone.trim()
  return {
    name,
    anschrift: [farm.address.trim(), ort].filter(Boolean).join(', '),
    telefon: telefon ? formatiereTelefon(telefon) : '',
    email: email.trim(),
  }
}

/** „Hof X, Inhaberin, Feldweg 1, 4910 Ried, Telefon …, E-Mail …“ — fehlende Angaben fallen weg. */
function hofZeile(angaben: BelehrungHof, mitTelefon: boolean): string {
  const { name, anschrift, telefon, email } = angaben
  return [name, anschrift, mitTelefon && telefon ? `Telefon ${telefon}` : '', email ? `E-Mail ${email}` : '']
    .filter(Boolean)
    .join(', ')
}

/**
 * Die Belehrung zum Anzeigen: mit Hof (signierter Link, Mail der eigenen
 * Bestellung) stehen seine Angaben an den Platzhaltern, ohne Hof der Hinweis
 * „… – stehen in deiner Bestellung“. Sonst bleibt jedes Wort, wie es ist.
 */
export function belehrungMitHof(hof: BelehrungHof | null): Belehrung {
  const voll = hof ? hofZeile(hof, true) : HOF_ANGABEN_OHNE_LINK.voll
  const formular = hof ? hofZeile(hof, false) : HOF_ANGABEN_OHNE_LINK.formular
  // Als Funktion ersetzt: Ein „$“ in den Hofdaten wäre sonst ein Muster der Ersetzung.
  const fuelle = (text: string): string => text.replace(HOF_ANGABEN_VOLL, () => voll).replace(HOF_ANGABEN_FORMULAR, () => formular)
  return {
    ...BELEHRUNG,
    teilA: { ...BELEHRUNG.teilA, abschnitte: BELEHRUNG.teilA.abschnitte.map((a) => ({ ...a, absaetze: a.absaetze.map(fuelle) })) },
    teilB: { ...BELEHRUNG.teilB, zeilen: BELEHRUNG.teilB.zeilen.map(fuelle) },
  }
}

/**
 * Gestaltungshinweis 5 b (Nr. 214, Freigabe Punkt 4): Trägt die Bestellung
 * mindestens ein Produkt mit geschätzten Rücksendekosten, steht direkt nach
 * „Sie tragen die unmittelbaren Kosten der Rücksendung der Waren.“ im selben
 * Absatz „Die Kosten werden auf höchstens etwa X EUR geschätzt.“ — X aus
 * `ruecksendekostenSchaetzungEuro`. Ohne Schätzung (null) bleibt die
 * Belehrung Wort für Wort, wie sie ist; sonst ändert sich kein Wort.
 */
export function belehrungMitKostenschaetzung(belehrung: Belehrung, euro: number | null): Belehrung {
  if (euro === null) return belehrung
  const ergaenze = (t: string): string => (t === RUECKSENDEKOSTEN_SATZ ? `${t} ${kostenSchaetzungSatz(euro)}` : t)
  return {
    ...belehrung,
    teilA: { ...belehrung.teilA, abschnitte: belehrung.teilA.abschnitte.map((a) => ({ ...a, absaetze: a.absaetze.map(ergaenze) })) },
  }
}
