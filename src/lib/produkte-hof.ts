/**
 * Was die Produkttabelle des Hofs zeigt (/products im neuen Design, Nachtlauf
 * Nr. 18; Mockups web-h2-produkte, mobil-h2-produkte, web-h2-ware-wieder-da-
 * teilen). Rein und ohne Datenbank prüfbar (tests/produkte-seite.test.ts); die
 * Komponenten in src/components/produkte/ zeigen nur an.
 *
 * Der Zustand eines Produkts kommt weiter aus `produktZustand`
 * (produkt-sichtbarkeit.ts) — hier stehen nur die Wörter des Mockups dazu:
 * Sichtbar, Nur noch N, Ausverkauft, Nicht im Shop. „Nicht im Shop" ist ein
 * Produkt, das der Hof ausgeblendet hat (isAvailable = false); eine eigene
 * Spalte dafür gibt es nicht. Das Wort gilt seit Nr. 28 (Register B2); der
 * Filterwert in der Adresse bleibt `entwuerfe`, damit alte Links gelten.
 */
import { IM_SHOP, NICHT_IM_SHOP, produktZustand } from '@/lib/produkt-sichtbarkeit'
import { formatEuro, formatGebinde, formatMenge, formatZahl, hofVorratText } from '@/lib/format'
import { PLATTFORMGEBUEHR_BEZEICHNUNG } from '@/lib/konditionen'
import { endpreisEuro, gebuehrWortFuerModell, satzText, type PreisAnzeige } from '@/lib/plattformgebuehr'
import { NETZ_SATZ_UNSICHER } from '@/lib/netz'
import { KATEGORIE_LABEL, istFuttermittel, type ProductCategoryValue } from '@/lib/taxonomie'
import { abholungText, type NaechstesFenster } from '@/lib/heute'
import { teilenMomenteAn } from '@/lib/teilen-momente'
import { PRODUKTE_FILTER_WERTE, type ProdukteAnsicht, type ProdukteFilter } from '@/schemas/produkte-filter'
import type { NeuBereich } from '@/schemas/url-auftrag'

// ─── Status ─────────────────────────────────────────────────────────────────

/** Die Töne der StatusBadge (components/ui/status-badge.tsx) — hier ohne Import aus den Komponenten. */
export type ProduktStatusTon = 'offen' | 'fertig' | 'neutral'

export type ProduktStatus = { text: string; ton: ProduktStatusTon }

/**
 * Die Marke einer Zeile. Reihenfolge wie produktZustand: „Nicht im Shop" sticht
 * „Ausverkauft" — ein ausgeblendetes Produkt ist für Kunden gar nicht da.
 * „N Größen warten auf Meldung" gehört zu Gate 6 (Futter-Sperre je Gebinde)
 * und kommt mit Nr. 20.
 */
export function produktStatus(p: { isAvailable: boolean; stock: number; unit: string; unitSize: number | null }): ProduktStatus {
  const zustand = produktZustand(p)
  switch (zustand.art) {
    case 'nicht-im-shop':
      return { text: NICHT_IM_SHOP, ton: 'neutral' }
    case 'ausverkauft':
      return { text: 'Ausverkauft', ton: 'neutral' }
    case 'knapp':
      // Mit der Einheit des Vorrats (N25): „Nur noch 3 kg", bei Gebinden „Nur noch 2 Pakete".
      return { text: `Nur noch ${hofVorratText(zustand.bestand, p.unit, p.unitSize)}`, ton: 'offen' }
    case 'im-shop':
      // Boards s1/w1-produkte (Lauf 30): Das Schild heißt wie der Schalter „Im Shop“, nicht mehr „Sichtbar“.
      return { text: IM_SHOP, ton: 'fertig' }
  }
}

// ─── Preis je Modell (N38; Boards s1/w1-produkte, s1/w1-produkt-neu) ────────

/**
 * „Du bekommst € 7,50" und „die Kundin zahlt € 7,95" — nur im Hofpreis-Modell
 * (`anzeige` gesetzt, preisAnzeigeFuer). Gerechnet wird nichts Neues: Der
 * Endpreis kommt aus `endpreisEuro` (je Stück aufgerundet, wie /api/checkout).
 * Im Modell „bisher" null — dann zahlt die Kundin die Servicegebühr erst in der
 * Kasse dazu, und die Zeile zeigt den Preis wie bisher.
 */
export function hofpreisTeile(preis: number, anzeige: PreisAnzeige): { bekommst: string; zahlt: string } | null {
  if (!anzeige || !Number.isFinite(preis) || preis < 0) return null
  return {
    bekommst: `Du bekommst ${formatEuro(preis)}`,
    zahlt: `die Kundin zahlt ${formatEuro(endpreisEuro(preis, anzeige))}`,
  }
}

/** Beides in einer Zeile: „Du bekommst € 7,50 · die Kundin zahlt € 7,95" (Karten-Zeile, Größe im Formular). */
export function hofpreisZeile(preis: number, anzeige: PreisAnzeige): string | null {
  const teile = hofpreisTeile(preis, anzeige)
  return teile ? `${teile.bekommst} · ${teile.zahlt}` : null
}

/**
 * Der Satz zur Gebühr unter „So sehen Kunden dein Futter" bzw. „… dein Holz"
 * (V62; Board s1/w1-produkt-neu, Bild 2 und 4): ab dem Stichtag sind die
 * gezeigten Preise Endpreise — „Preise inkl. Plattformgebühr (6 %)" mit dem
 * Satz des Hofs; im Modell „bisher" der Satz von heute, mit dem Wort des Modells.
 */
export function vorschauGebuehrSatz(anzeige: PreisAnzeige): string {
  if (anzeige) return `Preise inkl. ${PLATTFORMGEBUEHR_BEZEICHNUNG} (${satzText(anzeige.hundertstel)} %)`
  return `Die ${gebuehrWortFuerModell('bisher')} zahlt die Kundin zusätzlich. Du bekommst genau deinen Preis.`
}

/**
 * Die Liste ohne Produkte (Register N9): Titel und Satz des Leerzustands.
 * `knopf` ist der Ausweg (Boards s1/w1-produkte, Bild 3: „Erstes Produkt anlegen"). Die Kopfzeile darüber
 * schweigt dann (`produkteKopfzeile`) — derselbe Satz stünde sonst zweimal untereinander.
 */
export const PRODUKTE_LEER = {
  titel: 'Noch keine Produkte',
  satz: 'Leg dein erstes Produkt an – deine Kundinnen sehen es sofort auf deiner Hofseite.',
  // Vor der Freischaltung sieht niemand die Hofseite: „sofort" wäre ein falsches Versprechen (Nr. 176, Board SterneHofStart 5).
  satzVorFreischaltung: 'Leg dein erstes Produkt an – deine Kundinnen sehen es, sobald dein Hof freigeschaltet ist.',
  knopf: 'Erstes Produkt anlegen',
} as const

/**
 * Kein Treffer (Boards s1/w1-produkte, Bild 4): mit Suche der Satz mit dem Wort,
 * sonst der Satz zum Filter; der Ausweg setzt die Suche bzw. den Filter zurück.
 */
export const PRODUKTE_KEIN_TREFFER = {
  titel: 'Kein Produkt passt',
  filterSatz: 'In diesem Filter ist gerade kein Produkt.',
  sucheKnopf: 'Suche zurücksetzen',
  filterKnopf: 'Alle Produkte zeigen',
} as const

/** „Prüf die Schreibweise oder leg „Kürbis“ als neues Produkt an." — ohne Suche der Satz zum Filter. */
export function keinTrefferSatz(suche: string): string {
  const wort = suche.trim()
  return wort ? `Prüf die Schreibweise oder leg „${wort}“ als neues Produkt an.` : PRODUKTE_KEIN_TREFFER.filterSatz
}

/** Der Satz des Leerzustands: nach der Freischaltung „sofort", davor erst mit der Freischaltung. */
export function produkteLeerSatz(hofSichtbar: boolean): string {
  return hofSichtbar ? PRODUKTE_LEER.satz : PRODUKTE_LEER.satzVorFreischaltung
}

/**
 * „Produkte · 6 · 5 sichtbar" (Board w1-produkte: Überschrift der Tabelle; vorher „6 Produkte · 5 sichtbar"
 * unter der h1) — ohne Produkt null (dann steht nur der Leerzustand). Gezählt wird isAvailable, NICHT der Bestand: Ein
 * ausverkauftes Produkt steht für Kunden sichtbar als „Ausverkauft" da. Wer es
 * aus der Zählung nähme, ließe den Hof glauben, er habe weniger eingestellt,
 * als die Kundin sieht.
 */
export function produkteKopfzeile(produkte: readonly { isAvailable: boolean }[]): string | null {
  if (produkte.length === 0) return null
  const sichtbar = produkte.filter((p) => p.isAvailable).length
  return `Produkte · ${formatZahl(produkte.length)} · ${formatZahl(sichtbar)} sichtbar`
}

// ─── Filter und Suche ───────────────────────────────────────────────────────

export const PRODUKTE_FILTER_LABEL: Record<ProdukteFilter, string> = {
  alle: 'Alle',
  lebensmittel: 'Lebensmittel',
  futter: 'Futtermittel',
  brennmaterial: KATEGORIE_LABEL.BRENNHOLZ,
  // Der Wert heißt weiter `entwuerfe` (Adresse, alte Links) — nur das Wort ist neu (B2).
  entwuerfe: NICHT_IM_SHOP,
}

/**
 * Der Bereich einer Zeile, in den Wörtern des Neu-Menüs. Futter über die
 * Taxonomie (auch die Altlast FUTTERMITTEL), Brennholz eigen; alles andere —
 * auch Sonstiges und Produkte ohne Kategorie — steht unter Lebensmittel, wie
 * im Hofladen der Hofseite.
 */
export function produktBereich(category: ProductCategoryValue | null): NeuBereich {
  if (istFuttermittel(category)) return 'futter'
  if (category === 'BRENNHOLZ') return 'brennmaterial'
  return 'lebensmittel'
}

type FilterProdukt = { isAvailable: boolean; category: ProductCategoryValue | null }

export function passtZuProdukteFilter(p: FilterProdukt, filter: ProdukteFilter): boolean {
  switch (filter) {
    case 'alle':
      return true
    case 'entwuerfe':
      return !p.isAvailable
    default:
      return produktBereich(p.category) === filter
  }
}

/** Die Zahl hinter jedem Filter — aus der geladenen Liste, ohne eigene Abfrage. */
export function zaehleProdukteFilter(produkte: readonly FilterProdukt[]): Record<ProdukteFilter, number> {
  const zahlen = {} as Record<ProdukteFilter, number>
  for (const f of PRODUKTE_FILTER_WERTE) zahlen[f] = produkte.filter((p) => passtZuProdukteFilter(p, f)).length
  return zahlen
}

/**
 * Welche Chips stehen: die vier des Mockups immer, Brennmaterial nur, wenn der
 * Hof welches hat — oder der Filter gerade gewählt ist (sonst verschwände der
 * aktive Chip aus der Reihe).
 */
export function sichtbareProdukteFilter(zahlen: Record<ProdukteFilter, number>, gewaehlt: ProdukteFilter): ProdukteFilter[] {
  return PRODUKTE_FILTER_WERTE.filter((f) => f !== 'brennmaterial' || zahlen.brennmaterial > 0 || gewaehlt === f)
}

/** Suche im Namen, ohne Groß-/Kleinschreibung, Ränder egal; leer passt immer. */
export function passtZurSuche(name: string, suche: string): boolean {
  const s = suche.trim().toLocaleLowerCase('de')
  return s === '' || name.toLocaleLowerCase('de').includes(s)
}

export function filtereProdukte<T extends FilterProdukt & { name: string }>(produkte: readonly T[], ansicht: ProdukteAnsicht): T[] {
  return produkte.filter((p) => passtZuProdukteFilter(p, ansicht.filter) && passtZurSuche(p.name, ansicht.suche))
}

/** Die Adresse eines Filters — ein echter Link (DESIGN_SYSTEM „Links und Filter"); die Suche bleibt. */
export function filterAdresse(filter: ProdukteFilter, suche: string): string {
  const parameter = new URLSearchParams()
  if (filter !== 'alle') parameter.set('filter', filter)
  if (suche.trim()) parameter.set('suche', suche.trim())
  const rest = parameter.toString()
  return `/products${rest ? `?${rest}` : ''}`
}

// ─── Abschnitte der Karten-Zeilen (Register N25) ────────────────────────────

/**
 * Was am Ende der Abschnitte steht: im Filter „Alle" eine Zeile „Nicht im
 * Shop · n" (ein Link auf den Filter), unter einem Bereichsfilter die
 * ausgeblendeten Produkte dieses Bereichs mit ihren Zeilen.
 */
export type NichtImShopAbschnitt<T> = { art: 'zeile'; zahl: number } | { art: 'zeilen'; produkte: T[] }

export type ProdukteAbschnitte<T> =
  | { art: 'liste'; produkte: T[] }
  | { art: 'abschnitte'; brauchtDich: T[]; imShop: T[]; nichtImShop: NichtImShopAbschnitt<T> | null }

/**
 * Die Karten-Zeilen unter 1024 px (Board system-h1-mein-hof-v3, Bildschirm A):
 * zuerst „Braucht dich" — im Shop und ausverkauft, dann wenig Vorrat (dieselbe
 * Grenze wie bei der Kundin, `produktZustand`), dann ein Hinweis mit
 * Handlung —, danach „Im Shop" in der Reihenfolge des Hofs (`PRODUCT_ORDER_BY`,
 * wie geladen). Innerhalb gleicher Art bleibt die eigene Reihenfolge; kein
 * Produkt steht zweimal. Mit einer Suche und im Filter „Nicht im Shop" gibt
 * es eine einfache Liste: Wer sucht, will den Treffer, keine Sortierung.
 *
 * Größen bleiben je eine Zeile (eigenes Produkt mit `familieId`) — anders als
 * das Board („4 Größen"): Zusammenfassen bräuchte eine eigene Ansicht der Größen.
 *
 * `hatHandlung` reicht die Ansicht herein: `produktHinweise` liegt in
 * src/components/products/, und src/lib importiert nichts aus den Komponenten.
 */
export function produkteAbschnitte<T extends FilterProdukt & { name: string; stock: number }>(
  produkte: readonly T[],
  ansicht: ProdukteAnsicht,
  hatHandlung: (produkt: T) => boolean
): ProdukteAbschnitte<T> {
  if (ansicht.filter === 'entwuerfe' || ansicht.suche.trim() !== '') {
    return { art: 'liste', produkte: filtereProdukte(produkte, ansicht) }
  }
  const imFilter = produkte.filter((p) => passtZuProdukteFilter(p, ansicht.filter))
  const imShopAlle = imFilter.filter((p) => p.isAvailable)
  const art = (p: T) => produktZustand(p).art
  const ausverkauft = imShopAlle.filter((p) => art(p) === 'ausverkauft')
  const knapp = imShopAlle.filter((p) => art(p) === 'knapp')
  const mitHinweis = imShopAlle.filter((p) => art(p) === 'im-shop' && hatHandlung(p))
  const brauchtDich = [...ausverkauft, ...knapp, ...mitHinweis]
  const imShop = imShopAlle.filter((p) => !brauchtDich.includes(p))

  let nichtImShop: NichtImShopAbschnitt<T> | null = null
  if (ansicht.filter === 'alle') {
    const zahl = zaehleProdukteFilter(produkte).entwuerfe
    if (zahl > 0) nichtImShop = { art: 'zeile', zahl }
  } else {
    const ausgeblendet = imFilter.filter((p) => !p.isAvailable)
    if (ausgeblendet.length > 0) nichtImShop = { art: 'zeilen', produkte: ausgeblendet }
  }
  return { art: 'abschnitte', brauchtDich, imShop, nichtImShop }
}

// ─── „Wieder da" ────────────────────────────────────────────────────────────

/** Der Anlass des Moments: Der Vorrat wechselt von 0 auf mehr als 0. */
export function istWiederDa(vorher: number, jetzt: number): boolean {
  return vorher <= 0 && jetzt > 0
}

/**
 * Darf der Moment kommen? Nur, wenn Kunden die Ware auch sehen: Hof sichtbar
 * (heuteHofSichtbar — freigegeben, nicht pausiert, nicht stillgelegt) und
 * Produkt sichtbar. Ein Teilen-Aufruf zu einem Produkt, das nicht im Shop steht, oder einem pausierten
 * Hof führte ins Leere. Seit Nr. 30 auch nicht, wenn der Hof die
 * Teilen-Momente abgeschaltet hat (Pflichtfeld, src/lib/teilen-momente.ts).
 */
export function wiederDaMomentMoeglich(m: {
  hofSichtbar: boolean
  produktSichtbar: boolean
  wiederDa: boolean
  teilenMomenteAus: boolean
}): boolean {
  return teilenMomenteAn(m) && m.wiederDa && m.hofSichtbar && m.produktSichtbar
}

export type WiederDaTexte = { titel: string; satz: string; teilenText: string }

/**
 * Was der Moment sagt. Der Teilen-Text nennt das Produkt und die nächste
 * Abholung — keine Zahl von Kunden („6 Kunden haben zuletzt … gekauft",
 * Mockup): Dafür gibt es noch keine Regel, was „zuletzt" heißt.
 */
export function wiederDaTexte(
  produkt: { name: string; vorrat: number; unit: string; unitSize: number | null },
  fenster: NaechstesFenster | null
): WiederDaTexte {
  const wann = abholungText(fenster)
  return {
    titel: `Wieder da: ${produkt.name}`,
    satz: `${formatMenge(produkt.vorrat, produkt.unit, produkt.unitSize)} im Vorrat. Sag deinen Kunden Bescheid?`,
    teilenText: wann ? `Wieder da bei uns: ${produkt.name}. ${wann}.` : `Wieder da bei uns: ${produkt.name}.`,
  }
}

// ─── „Gespeichert" (Nr. 30) ─────────────────────────────────────────────────

/**
 * Der Anlass des Moments „gespeichert": ein neu angelegtes Produkt bzw. eine
 * neue Familie mit Verkaufsgrößen (dann EIN Moment für alle Größen).
 * `kaufbar` = mindestens eine Größe ist im Shop, nicht gesperrt und hat
 * Vorrat (sagt der Server, Nachbesserung Nr. 30).
 */
export type ProduktAngelegt = { anlass: string; name: string; kaufbar: boolean }

/**
 * Darf der Moment „gespeichert" kommen? Wie bei „wieder da": Hof sichtbar,
 * das Neue ist kaufbar (ein Produkt, das nicht im Shop steht, eine gesperrte Futter-Größe oder Ware
 * ohne Vorrat — für Kunden „ausverkauft" — führte ins Leere) und die
 * Teilen-Momente sind nicht abgeschaltet.
 */
export function gespeichertMomentMoeglich(m: { hofSichtbar: boolean; kaufbar: boolean; teilenMomenteAus: boolean }): boolean {
  return teilenMomenteAn(m) && m.hofSichtbar && m.kaufbar
}

/**
 * Was der Moment sagt (Mockup mobil-h2-gespeichert-teilen: „… ist online",
 * Zitat „Neu bei uns: …"). Statt der Beschreibung aus dem Mockup („vom
 * Sackerl bis zum Rundballen") nennt der Teilen-Text die nächste Abholung —
 * wie „wieder da"; eine Beschreibung ist kein Pflichtfeld.
 */
export function gespeichertTexte(name: string, fenster: NaechstesFenster | null): WiederDaTexte {
  const wann = abholungText(fenster)
  return {
    titel: `${name} ist online`,
    satz: 'Kunden sehen es ab jetzt auf deiner Hofseite. Sag ihnen Bescheid?',
    teilenText: wann ? `Neu bei uns: ${name}. ${wann}.` : `Neu bei uns: ${name}.`,
  }
}

// ─── Vorrat ändern (Boards s1/w1-produkte, Bild 2) ──────────────────────────

/** Der Satz im Blatt bzw. Dialog unter dem Stepper — ersetzt die Sätze unter Tabelle und Zeilen. */
export const VORRAT_NULL_SATZ = 'Bei 0 steht „Ausverkauft“, das Produkt bleibt sichtbar.'

/**
 * „Dazu +5 +10 +25 +50" und „Ausverkauft" im Blatt bzw. Dialog (Register N25 nennt beide wörtlich;
 * die Boards s1/w1-produkte zeigen sie nicht — bei Widerspruch gilt das Register). „Dazu" setzt nur
 * das Feld, gespeichert wird erst mit „Speichern"; „Ausverkauft" speichert sofort 0.
 */
export const VORRAT_DAZU = [5, 10, 25, 50] as const
export const VORRAT_DAZU_TITEL = 'Dazu'
export const VORRAT_AUSVERKAUFT_KNOPF = 'Ausverkauft'

/** Der Titel: „Vorrat: Freilandeier". */
export function vorratTitel(name: string): string {
  return `Vorrat: ${name}`
}

/**
 * Die Frage über dem Stepper — in der Einheit, die der Vorrat zählt (dieselbe
 * wie `hofVorratText`): „Wie viele Pakete à 10 Stück hast du gerade?" (das
 * Board schreibt „Packungen"; der Hofbereich zählt Gebinde überall als Pakete),
 * „Wie viele kg hast du gerade?", „Wie viele Ballen hast du gerade?".
 */
export function vorratFrage(unit: string, unitSize: number | null): string {
  const zwei = hofVorratText(2, unit, unitSize)
  const einheit = zwei.slice(formatZahl(2).length + 1)
  // Ohne Gebinde sagt formatGebinde „je kg" — dann steht nichts dahinter; ebenso, wenn das Gebinde
  // schon in Paketen zählt („6 Pakete"), sonst hieße es „Pakete à 6 Pakete".
  const paket = formatGebinde(unit, unitSize)
  const gebinde = paket.startsWith('je ') || paket.endsWith(` ${einheit}`) ? '' : ` à ${paket}`
  return `Wie viele ${einheit}${gebinde} hast du gerade?`
}

// ─── Fehler im Formular (V17; Board s1/w1-produkt-neu, Bild 5 und 6) ────────

/** Die Karte über dem Formular, wenn Felder markiert sind — statt eines Toasts. */
export const FORMULAR_PRUEFEN = 'Bitte prüfe die markierten Felder.'

/** Speichern gescheitert: Titel und Sätze der orangen Karte (ohne Feld). */
export const SPEICHERN_FEHLER = {
  titel: 'Speichern hat nicht geklappt',
  netz: 'Deine Eingaben sind noch da. Prüf den Empfang und versuch es noch einmal.',
  unsicherTitel: 'Keine Verbindung',
} as const

/** Was die Karte zeigt: Titel, Satz und ob „Nochmal" daneben steht. */
export type SpeicherFehlerAnzeige = { titel: string; satz: string; nochmal: boolean }

/** Der Server hat mit einem Satz abgelehnt (`{ error }`): Er steht in der Karte statt in einem Toast (V17). */
export function speicherFehlerAusAntwort(satz: string): SpeicherFehlerAnzeige {
  return { titel: SPEICHERN_FEHLER.titel, satz, nochmal: false }
}

/**
 * Der Aufruf ist geworfen. Am Netz (`istNetzFehler`) mit „Nochmal" (Register N29, Board
 * s1/w1-produkt-neu Bild 6) — aber nur, wenn ein zweiter Versuch nichts doppelt anlegt
 * (`wiederholbar`: Bearbeiten). Beim Anlegen kann der Server schon gespeichert haben, bevor
 * die Antwort verloren ging; dann der Satz „Wir wissen nicht, ob es geklappt hat …" ohne
 * Knopf (DESIGN_SYSTEM „Zustände", Ausnahme). Sonst der Satz des Formulars.
 */
export function speicherFehlerNachWurf(netz: boolean, wiederholbar: boolean, rueckfall: string): SpeicherFehlerAnzeige {
  if (netz && wiederholbar) return { titel: SPEICHERN_FEHLER.titel, satz: SPEICHERN_FEHLER.netz, nochmal: true }
  if (netz) return { titel: SPEICHERN_FEHLER.unsicherTitel, satz: NETZ_SATZ_UNSICHER, nochmal: false }
  return { titel: SPEICHERN_FEHLER.titel, satz: rueckfall, nochmal: false }
}

/**
 * Die Sätze zum Löschen eines Produkts (Nr. 195, Audit A5): Eines mit
 * Bestellungen bleibt erhalten und wird ausgeblendet — der Dialog sagt das
 * vorher, der Hinweis danach, was geschehen ist.
 */
export const PRODUKT_LOESCHEN_TEXT = {
  titel: 'Produkt löschen?',
  /** Der Satz nach dem Namen im Dialog. */
  dialogSatz:
    'wird dauerhaft gelöscht. Hat es schon Bestellungen, bleibt es erhalten und wird nur ausgeblendet. Vergangene Bestellungen bleiben immer erhalten. Nur ausblenden geht mit dem Schalter „Sichtbar“.',
  geloescht: 'Produkt gelöscht',
  ausgeblendet: 'Das Produkt hat schon Bestellungen und bleibt deshalb erhalten. Es ist jetzt ausgeblendet.',
} as const

/** Der Hinweis nach dem Löschen: gelöscht oder (mit Bestellungen) nur ausgeblendet. */
export function produktLoeschenHinweis(ergebnis: { archiviert: boolean }): string {
  return ergebnis.archiviert ? PRODUKT_LOESCHEN_TEXT.ausgeblendet : PRODUKT_LOESCHEN_TEXT.geloescht
}
