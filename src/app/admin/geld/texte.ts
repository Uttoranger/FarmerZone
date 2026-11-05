import { monatsgrenzenWienFuer, type Monatsschluessel } from '@/lib/servicegebuehr'
import { MARKE } from '@/lib/marke'
import { PLATTFORMGEBUEHR_BEZEICHNUNG } from '@/lib/konditionen'
import { GEBUEHREN_WORT, gebuehrenMehrzahl, type GebuehrWort } from '@/lib/plattformgebuehr'

/** „neben der Plattformgebühr“, über den Stichtag „neben den Gebühren“ — das Wort trägt den Artikel mit. */
function nebenDer(wort: GebuehrWort): string {
  return wort === GEBUEHREN_WORT ? `den ${wort}` : `der ${wort}`
}

/*
 * Die Sätze von Admin › Geld (Register N32, N37; Nr. 191; Mockup admin-geld)
 * — eine Quelle für Seite und Tests. „Finanzen“ heißt seit N32 „Geld“.
 */
export const GELD_TEXT = {
  titel: 'Geld',
  satz: `Was durch ${MARKE} fließt, ob es mit Stripe übereinstimmt, und der Monatsabschluss.`,
  kennzahlen: 'Geld in Zahlen',
  abgleich: 'Abgleich mit Stripe',
  abgleichZusatz: 'täglich, nur lesend',
  stripeGebuehrTraeger: `trägt ${MARKE} (Destination Charges)`,
  abschluss: (bezeichnung: string): string => `Monatsabschluss ${bezeichnung}`,
  abschliessen: (monatName: string): string => `${monatName} abschließen …`,
  abgeschlossen: 'abgeschlossen',
  nachAbschluss: 'Danach sind Kosten des Monats nur mit Grund änderbar.',
  laufendGrund: 'Geht erst nach dem Monatsende.',
  fehler: 'Wir konnten Geld gerade nicht laden.',
  /*
   * Ab hier das Wort der Gebühr als Pflicht-Argument (V63; Lauf 30, Nr. 230): `gebuehrWortFuerMonat`
   * bzw. `gebuehrWortFuerJahr` aus finanzen.ts — vor dem Stichtag „Servicegebühr“, danach
   * „Plattformgebühr“, über den Stichtag „Gebühren“. Keine Vorgabe: ein vergessenes Wort
   * fiele sonst still auf die Fassung „bisher“ zurück.
   */
  /** Die Zeile der Gebühren-Kachel (Board w3-admin-geld: „online € 36,40 · bar € 0,00“). */
  gebuehrSatz: (online: string, bar: string): string => `online ${online} · bar ${bar}`,
  /** Ergebnis ≥ 0 (Board w3-admin-geld Bild 2: „gedeckt“), darunter „noch nicht gedeckt“. */
  gedeckt: 'gedeckt',
  nichtGedeckt: 'noch nicht gedeckt',
  abgleichGleich: (wort: GebuehrWort): string => `Betrag, ${wort} und Erstattung gleich`,
  regel: (wort: GebuehrWort): string =>
    `Die Stripe-Gebühren der Kartenzahlungen trägt bei Destination Charges die Plattform – sie stehen darum als Kosten neben ${nebenDer(wort)}. Der Abgleich liest Zahlungen, Erstattungen und Gebühren der letzten 48 Stunden bei Stripe und vergleicht sie mit den Bestellungen. Weicht etwas ab, steht es als Aufgabe in Heute – mit Bestellnummer und Betrag.`,
} as const

/**
 * Die Jahresansicht über den Stichtag (Board w3-admin-geld Bild 4): Die Legende
 * sagt, bis wann welches Wort gilt, und jede Zeile der Tabelle nennt das Wort
 * ihres Monats — die alte Gebühr mit „(altes Modell)“. Die Wörter kommen aus
 * `gebuehrWortFuerMonat`, nie aus einem eigenen Datumsvergleich.
 */
export const GELD_JAHR_TEXT = {
  /** „Gebühren (bis Jänner Servicegebühr, ab Februar Plattformgebühr)“ — ohne einen der Teile nur das Wort. */
  legendeUeberStichtag: (vorher: { monat: string; wort: GebuehrWort } | null, nachher: { monat: string; wort: GebuehrWort } | null): string => {
    const teile = [vorher ? `bis ${vorher.monat} ${vorher.wort}` : null, nachher ? `ab ${nachher.monat} ${nachher.wort}` : null].filter((t) => t !== null)
    return teile.length === 0 ? GEBUEHREN_WORT : `${GEBUEHREN_WORT} (${teile.join(', ')})`
  },
  /** Das Wort eines Monats in der Tabelle; die Gebühr vor dem Stichtag mit „(altes Modell)“. */
  zeilenWort: (wort: GebuehrWort): string =>
    wort === PLATTFORMGEBUEHR_BEZEICHNUNG || wort === GEBUEHREN_WORT ? wort : `${wort} (altes Modell)`,
} as const

/** Die Wörter der Gebühr für Diagramm und Tabelle — fertig als Text, die Client-Komponente kennt keinen Stichtag. */
export type JahrGebuehrTexte = {
  /** Das Wort des Jahres: Kopf der Spalte, Beschriftung des Diagramms. */
  wort: GebuehrWort
  /** Die Legende; über den Stichtag mit „bis … / ab …“. */
  legende: string
  /** Das Wort des Vorjahres für seinen Balken; null ohne Vorjahr. */
  vorjahrWort: GebuehrWort | null
  /** Je Monat (Schlüssel) das Wort in seiner Zeile und am Balken — nur über den Stichtag, sonst leer. */
  jeMonat: Record<string, string>
  /** Je Monat das Wort für den Titel der Fläche über dem Diagramm (Mehrzahl). */
  titelJeMonat: Record<string, string>
}

/**
 * Über den Stichtag (V63, Board w3-admin-geld Bild 4) nennt die Legende, bis
 * wann welches Wort gilt, und jede Zeile ihr Wort; ganz vor oder ganz nach dem
 * Stichtag genügt das eine Wort im Kopf. Der letzte Monat mit „Servicegebühr“
 * und der erste mit „Plattformgebühr“ kommen aus `gebuehrWortFuerMonat` — ein
 * Monat, in den der Stichtag fällt, heißt „Gebühren“ und steht in keinem Teil.
 */
export function jahrGebuehrTexte(wort: GebuehrWort, vorjahrWort: GebuehrWort | null, monate: readonly Monatsschluessel[], worte: readonly GebuehrWort[]): JahrGebuehrTexte {
  // „Jänner 2027“ → „Jänner“: derselbe Monatsname wie im Kopf der Monatsansicht.
  const name = (m: Monatsschluessel): string => monatsgrenzenWienFuer(m).bezeichnung.split(' ')[0] ?? m
  const titelJeMonat = Object.fromEntries(monate.map((m, i) => [m, gebuehrenMehrzahl(worte[i] ?? wort)]))
  if (wort !== GEBUEHREN_WORT) return { wort, legende: gebuehrenMehrzahl(wort), vorjahrWort, jeMonat: {}, titelJeMonat }
  const paare = monate.map((monat, i) => ({ monat, wort: worte[i] ?? wort }))
  const erstesNeu = paare.find((p) => p.wort === PLATTFORMGEBUEHR_BEZEICHNUNG) ?? null
  const letztesAlt = paare.filter((p) => p.wort !== PLATTFORMGEBUEHR_BEZEICHNUNG && p.wort !== GEBUEHREN_WORT).at(-1) ?? null
  const legende = GELD_JAHR_TEXT.legendeUeberStichtag(
    letztesAlt && { monat: name(letztesAlt.monat), wort: letztesAlt.wort },
    erstesNeu && { monat: name(erstesNeu.monat), wort: erstesNeu.wort }
  )
  const jeMonat = Object.fromEntries(monate.map((m, i) => [m, GELD_JAHR_TEXT.zeilenWort(worte[i] ?? wort)]))
  return { wort, legende, vorjahrWort, jeMonat, titelJeMonat }
}

export const ADMIN_GELD_HREF = '/admin/geld'

/** Die Adresse eines Monats von Geld — ohne Monat der laufende. */
export function geldAdresse(monat?: Monatsschluessel): string {
  return monat ? `${ADMIN_GELD_HREF}?monat=${monat}` : ADMIN_GELD_HREF
}

/** Die Jahresansicht (dieselbe Seite wie bisher unter Finanzen, Nr. 100). */
export function geldJahrAdresse(jahr: number): string {
  return `${ADMIN_GELD_HREF}?zeitraum=jahr&jahr=${jahr}`
}

/**
 * /admin/finanzen → /admin/geld (308, N32) mit denselben Parametern — Lesezeichen,
 * die Links der Jahresansicht und die CSV-Rückkehr führen so weiter.
 */
export function vonFinanzenNachGeld(parameter: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams()
  for (const [name, wert] of Object.entries(parameter)) {
    for (const w of Array.isArray(wert) ? wert : wert === undefined ? [] : [wert]) q.append(name, w)
  }
  const text = q.toString()
  return text === '' ? ADMIN_GELD_HREF : `${ADMIN_GELD_HREF}?${text}`
}
