import type { OrderStatus } from '@prisma/client'
import { MARKE } from '@/lib/marke'
import { PROBLEM_MELDEN } from '@/lib/fehlerseite'

/*
 * Konto-Anfragen eines Hofs im Admin (Register N36, Nachtlauf Nr. 190; Mockups
 * admin-konto-anfrage und admin-konto-schliessen): Anmelde-E-Mail ändern,
 * Auskunft exportieren, Konto schließen. Hier stehen die reinen Regeln und
 * alle Sätze — ohne Datenbank, auch für die Oberfläche. Die Wirkung steht in
 * src/server/actions/konto-anfragen.ts, Stufe 2 in src/lib/konto-schliessen.ts.
 */

// ─── Konto schließen, Stufe 1 ───────────────────────────────────────────────

/** So lange holt „Wieder öffnen“ alles zurück; danach ist Stufe 2 fällig. */
export const WIEDER_OEFFNEN_TAGE = 30

const TAG_MS = 24 * 60 * 60 * 1000

/** Noch offen: weder abgeholt noch storniert noch als „nicht abgeholt“ abgeschlossen. */
export const OFFENE_BESTELL_STAENDE = ['PENDING_CONFIRMATION', 'PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY'] as const satisfies readonly OrderStatus[]

/** Bis wann „Wieder öffnen“ geht; null = nicht geschlossen. */
export function wiederOeffnenBis(geschlossenAm: Date | null): Date | null {
  return geschlossenAm ? new Date(geschlossenAm.getTime() + WIEDER_OEFFNEN_TAGE * TAG_MS) : null
}

/** Geschlossen, noch nicht endgültig und keine 30 Tage her. */
export function wiederOeffnenMoeglich(hof: { geschlossenAm: Date | null; endgueltigAm: Date | null }, jetzt: Date): boolean {
  const bis = wiederOeffnenBis(hof.geschlossenAm)
  return bis !== null && hof.endgueltigAm === null && jetzt.getTime() < bis.getTime()
}

/** Wer vor dieser Grenze geschlossen wurde, ist für Stufe 2 fällig (älter als 30 Tage). */
export function endgueltigGrenze(jetzt: Date): Date {
  return new Date(jetzt.getTime() - WIEDER_OEFFNEN_TAGE * TAG_MS)
}

/** Warum Schließen noch nicht geht — null = es geht. Ohne Kennung der Kundschaft. */
export function schliessenSperre(offen: { bestellungen: number; erstattungen: number }): string | null {
  const teile: string[] = []
  if (offen.bestellungen > 0) teile.push(offen.bestellungen === 1 ? '1 Bestellung ist noch offen' : `${offen.bestellungen} Bestellungen sind noch offen`)
  if (offen.erstattungen > 0) teile.push(offen.erstattungen === 1 ? '1 Erstattung ist offen' : `${offen.erstattungen} Erstattungen sind offen`)
  if (teile.length === 0) return null
  return `Geht noch nicht: ${teile.join(' und ')}. Erst abschließen – sonst bleibt eine Bestellung oder Geld ohne Ansprechpartner.`
}

/** Der eingetippte Hofname — Groß-/Kleinschreibung und Ränder zählen nicht, leer nie. */
export function hofnameBestaetigt(eingabe: string, name: string): boolean {
  const soll = name.trim().toLocaleLowerCase('de')
  return soll !== '' && eingabe.trim().toLocaleLowerCase('de') === soll
}

// ─── Anmelde-E-Mail ändern ──────────────────────────────────────────────────

/** Art des Einmal-Links; der Bezug ist der HMAC der neuen Adresse (`email-aendern:<hash>`), nie die Adresse. */
export const EMAIL_AENDERN_ART = 'email-aendern'

/** Der Bestätigungslink gilt 24 Stunden (N36) — als Tage für einmalLinkAblauf. */
export const EMAIL_AENDERN_TAGE = 1

export const EMAIL_BESTAETIGEN_PFAD = '/konto/email-bestaetigen'

export function emailBestaetigenLink(appUrl: string, token: string): string {
  return `${appUrl}${EMAIL_BESTAETIGEN_PFAD}?t=${token}`
}

/** Wie eine Adresse verglichen und gehasht wird: ohne Ränder, klein. */
export function normalisiereAdresse(adresse: string): string {
  return adresse.trim().toLowerCase()
}

// ─── Sätze ──────────────────────────────────────────────────────────────────

export const KONTO_ANFRAGE_TEXT = {
  titel: 'Konto-Anfragen des Hofs',
  satz: 'fragt jeweils nach deinem Passkey',
  erklaerung:
    'E-Mail ändern schickt einen Bestätigungslink an die neue Adresse. Schließen nimmt die Hofseite offline; nach 30 Tagen wird das Konto unkenntlich gemacht, sobald die Liste dafür freigegeben ist. Bestellungen bleiben, solange die Aufbewahrungspflicht gilt.',
  knopfEmail: 'Anmelde-E-Mail ändern …',
  knopfAuskunft: 'Auskunft exportieren …',
  knopfSchliessen: 'Konto schließen …',
  knopfWiederOeffnen: 'Wieder öffnen …',
  geschlossenZeile: (bis: string): string => `Konto geschlossen · wieder öffnen bis ${bis}`,
  endgueltigZeile: 'Konto endgültig geschlossen',
  grundLabel: 'Grund (für das Protokoll)',
  grundHilfe: 'Ohne E-Mail-Adresse und ohne Telefonnummer.',
  abbrechen: 'Abbrechen',
  nichtGefunden: 'Diesen Hof gibt es nicht mehr. Lade die Seite neu.',
  eingabe: 'Bitte füll alle Felder aus.',
  email: {
    titel: (hof: string): string => `Anmelde-E-Mail von ${hof} ändern`,
    heute: (gekuerzt: string): string => `Heute: ${gekuerzt}`,
    feld: 'Neue Adresse',
    schritte: [
      'Die neue Adresse bekommt einen Bestätigungslink (gilt 24 Stunden).',
      'Erst nach dem Klick gilt sie; bis dahin meldet sich der Hof wie bisher an.',
      'Die alte Adresse bekommt eine Sicherheitsmail mit „Das war ich nicht“.',
      'Alle Geräte des Hofs werden abgemeldet; der Eintrag steht in Akte und Protokoll.',
    ],
    knopf: 'Mit Passkey Link schicken',
    // Dieselbe Antwort, ob die Adresse schon ein Konto hat oder nicht (Freigabe Lauf 26, §2).
    erledigt: 'Wenn die Adresse verwendet werden kann, ist der Bestätigungslink unterwegs.',
    ungueltig: 'Das ist keine gültige E-Mail-Adresse.',
    gleich: 'Das ist schon die Anmelde-Adresse des Hofs.',
  },
  auskunft: {
    titel: (hof: string): string => `Auskunft für ${hof} exportieren`,
    satz: 'Eine JSON-Datei mit Konto, Hof, Produkten, Abholzeiten, Beiträgen, Postfach, eigenen Meldungen und den Bestellungen als Verkäufer – ohne Daten der Kundschaft.',
    knopf: 'Mit Passkey exportieren',
    erledigt: 'Die Datei ist geladen.',
  },
  auskunftKundin: {
    knopf: 'Auskunft für die Kundschaft …',
    titel: 'Auskunft für eine Adresse der Kundschaft',
    satz: 'Bestellungen, Abos und Sitzungen (ohne IP) zu genau dieser Adresse als JSON-Datei.',
    feld: 'Genaue E-Mail-Adresse',
    knopf2: 'Mit Passkey exportieren',
    erledigt: 'Die Datei ist geladen.',
  },
  schliessen: {
    titel: (hof: string): string => `Konto von ${hof} schließen`,
    sofort: 'Sofort',
    sofortPunkte: [
      'Hofseite und Produkte sind sofort offline; in der Suche erscheint der Hof nicht mehr.',
      'Anmelden ist gesperrt; alle Geräte werden abgemeldet.',
      'Abos der Kundschaft enden; niemand bekommt mehr Mails dieses Hofs.',
      `${WIEDER_OEFFNEN_TAGE} Tage lang kannst du alles mit einem Klick zurückholen.`,
    ],
    spaeter: `Nach ${WIEDER_OEFFNEN_TAGE} Tagen, endgültig`,
    spaeterPunkte: [
      'Name, Kontakt, Fotos und Texte des Hofs werden gelöscht bzw. unkenntlich – erst, wenn die Liste dafür freigegeben ist.',
      'Bestellungen und Beträge bleiben, solange die Aufbewahrungspflicht gilt – ohne Kontakt des Hofs.',
      'Das Stripe-Konto gehört dem Hof; offene Auszahlungen laufen dort weiter.',
    ],
    bestaetigenLabel: 'Zum Bestätigen den Hofnamen eintippen',
    bestaetigenFalsch: 'Der Hofname stimmt nicht.',
    knopf: 'Mit Passkey schließen',
    erledigt: 'Das Konto ist geschlossen.',
    schonGeschlossen: 'Dieses Konto ist schon geschlossen.',
  },
  wiederOeffnen: {
    titel: (hof: string): string => `Konto von ${hof} wieder öffnen`,
    satz: 'Hofseite und Anmelden gehen wieder. Abos der Kundschaft bleiben beendet; der Hof meldet sich neu an.',
    knopf: 'Mit Passkey wieder öffnen',
    erledigt: 'Das Konto ist wieder offen.',
    zuSpaet: `Wieder öffnen geht nur in den ersten ${WIEDER_OEFFNEN_TAGE} Tagen.`,
  },
} as const

/** Die Bestätigungsseite /konto/email-bestaetigen (noindex, no-referrer). */
export const EMAIL_BESTAETIGEN_TEXT = {
  seitentitel: 'Neue Anmelde-Adresse bestätigen',
  titel: 'Neue Anmelde-Adresse bestätigen',
  satz: 'Tipp zur Sicherheit die neue Adresse noch einmal ein. Danach meldest du dich mit ihr an; alle Geräte werden abgemeldet.',
  feld: 'Neue E-Mail-Adresse',
  knopf: 'Adresse bestätigen',
  vorab: 'Erst dieser Knopf ändert die Adresse – ein Programm, das Links in Mails vorab öffnet, löst nichts aus.',
  fertigTitel: 'Die neue Adresse gilt',
  fertigSatz: 'Melde dich ab jetzt mit der neuen Adresse an. Alle Geräte sind abgemeldet.',
  zurAnmeldung: 'Zur Anmeldung',
  ungueltigTitel: 'Dieser Link gilt nicht mehr.',
  ungueltigSatz: 'Er war 24 Stunden und einmal gültig. Frag beim Team nach einem neuen Link.',
  falscheAdresse: 'Die Adresse passt nicht zu diesem Link. Tipp sie genau so ein, wie sie in der Mail steht.',
  // Freigabe 190, Punkt 1: derselbe Satz, ob die Adresse ein anderes Konto hat oder nicht verwendet werden darf.
  nichtVerwendbar: 'Diese Adresse kann nicht verwendet werden.',
  fehler: 'Wir konnten die Adresse gerade nicht ändern. Versuch es noch einmal.',
} as const

/** Mail an die NEUE Adresse mit dem Bestätigungslink (Sofort, nie nochmal). */
export const EMAIL_AENDERN_MAIL = {
  betreff: 'Bestätige deine neue Anmelde-Adresse',
  anrede: (hof: string | null): string => (hof ? `Hallo ${hof},` : 'Hallo,'),
  satz: `das Team von ${MARKE} hat auf deinen Wunsch die Anmelde-Adresse deines Kontos auf diese Adresse umgestellt. Erst wenn du bestätigst, gilt sie.`,
  knopf: 'Neue Adresse bestätigen',
  fuss: `Der Link gilt 24 Stunden und einmal. Warst du das nicht? Dann musst du nichts tun – die alte Adresse bleibt. Wir fragen dich nie per Mail nach deinem Passwort.`,
} as const

/** Sicherheitsmail an die ALTE Adresse nach der Änderung (Sofort, nie nochmal). */
export const EMAIL_GEAENDERT_MAIL = {
  betreff: 'Deine Anmelde-Adresse wurde geändert',
  anrede: (hof: string | null): string => (hof ? `Hallo ${hof},` : 'Hallo,'),
  satz: (wann: string): string => `am ${wann} wurde die Anmelde-Adresse deines Kontos geändert. Alle Geräte sind abgemeldet.`,
  warstDu: 'Hast du das beim Team angefragt? Dann musst du nichts tun.',
  knopf: 'Das war ich nicht',
  fuss: `Der Knopf öffnet eine Seite bei ${MARKE} – erst dort meldest du alle Geräte ab. Schreib uns danach über „${PROBLEM_MELDEN}“. Wir fragen dich nie per Mail nach deinem Passwort.`,
} as const
