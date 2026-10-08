/**
 * Entdecken im neuen Design (/hoefe, Nachtlauf Nr. 09, Gate 4) — was die
 * Seite an Chips, Facetten, aktiven Filtern, Kopf, Produkttreffern und
 * Leerzustand zeigt. Rein, ohne Datenbank und ohne Browser prüfbar
 * (tests/hoefe-entdecken.test.ts); die Komponenten unter
 * src/components/hoefe/ zeichnen nur.
 *
 * Mockups: docs/mockups/web-k1-entdecken-einstieg.html, web-k1-suche-filter,
 * web-k1-filter-futtermittel, web-k1-leerzustand, mobil-k1-entdecken,
 * mobil-k1-filter.
 *
 * JEDER CHIP IST EIN LINK (DESIGN_SYSTEM, „Links und Filter"): Er trägt sein
 * `ziel` — den Filter nach dem Tipp —, die Seite schreibt daraus die Adresse
 * über hoefeHref. So funktionieren Teilen, Mittelklick und Neuladen, und der
 * Parser (src/schemas/hoefe-filter.ts) liest genau das zurück.
 *
 * Welche Kategorien Angebot haben und was „passt", entscheidet weiter
 * src/lib/bereiche-anzeige.ts (kategorieChips, zeilePasst) — hier wird nur
 * angeordnet und benannt.
 */
import {
  LEERER_HOEFE_FILTER,
  schreibeHoefeFilter,
  wechsleBereich,
  type GebindeWahl,
  type HoefeFilter,
} from '@/schemas/hoefe-filter'
import {
  hatProduktfilter,
  kategorieChips,
  siegelChips,
  sortenChips,
  tierChips,
  zeilePasst,
  type AngebotsProdukt,
  type AngebotsZeile,
} from '@/lib/bereiche-anzeige'
import {
  KATEGORIE_LABEL,
  KLEINGEBINDE_BIS_KG,
  SIEGEL,
  TIERART_LABEL,
  UNTERKATEGORIE_LABEL,
  gehoertZu,
  type ProductCategoryValue,
} from '@/lib/taxonomie'
import { suchForm, type UmkreisStufe } from '@/lib/hofuebersicht'
import { mitAnzahl } from '@/lib/format'

// ─── Adresse ────────────────────────────────────────────────────────────────

/** Die Adresse von /hoefe mit genau diesem Filter; ohne Filter die nackte /hoefe. */
export function hoefeHref(filter: HoefeFilter): string {
  const query = schreibeHoefeFilter(filter)
  return query ? `/hoefe?${query}` : '/hoefe'
}

// ─── Wortlaut ───────────────────────────────────────────────────────────────

/**
 * Die Gebinde-Facette heißt im neuen Design „Kleinmengen | Ballen & mehr"
 * (E2). Die Grenze bleibt KLEINGEBINDE_BIS_KG (25 kg je Gebinde) — nur der
 * Wortlaut ist neu, nicht die Regel (gebindePasst in bereiche-anzeige.ts).
 */
export const MENGE_LABEL: Record<GebindeWahl, string> = { KLEIN: 'Kleinmengen', GROSS: 'Ballen & mehr' }

/** Was „Kleinmengen" heißt — steht unter der Facette, damit niemand raten muss. */
export const MENGEN_HINWEIS = `Kleinmengen heißt bis ${KLEINGEBINDE_BIS_KG} kg je Gebinde, Ballen & mehr alles darüber.`

/** Die Sortierung im Futter — derselbe Wortlaut in der Filterzeile und bei den aktiven Filtern. */
export const KILOPREIS_LABEL = 'Günstigster Kilopreis'

/** Seit Nr. 23 heißt BRENNHOLZ schon in der Taxonomie „Brennmaterial" (E11 Label) — keine Sonderregel mehr. */
function kategorieLabel(k: ProductCategoryValue): string {
  return KATEGORIE_LABEL[k]
}

// ─── Chips ──────────────────────────────────────────────────────────────────

/** Ein Chip: was er zeigt, ob er gewählt ist und welcher Filter nach dem Tipp gilt. */
export type EntdeckenChip = { schluessel: string; label: string; aktiv: boolean; ziel: HoefeFilter }

function umschalten<T>(liste: readonly T[], wert: T): T[] {
  return liste.includes(wert) ? liste.filter((w) => w !== wert) : [...liste, wert]
}

/** Neue Kategorienwahl — Sorten, deren Kategorie nicht mehr gewählt ist, fallen mit. */
function mitKategorien(filter: HoefeFilter, kategorien: ProductCategoryValue[]): HoefeFilter {
  return { ...filter, kategorien, sorten: filter.sorten.filter((s) => kategorien.some((k) => gehoertZu(k, s))) }
}

/** Kategorie an/aus im Hofladen; aus dem Futter heraus wechselt sie zuerst den Bereich. */
function hofladenKategorieZiel(filter: HoefeFilter, k: ProductCategoryValue): HoefeFilter {
  if (filter.bereich !== 'LEBENSMITTEL') return mitKategorien(wechsleBereich(filter, 'LEBENSMITTEL'), [k])
  return mitKategorien(filter, umschalten(filter.kategorien, k))
}

/**
 * Die Kategorie-Reihe (E2: Futtermittel als Chip in DERSELBEN Reihe statt
 * einer Weiche darüber): „Alle", die Hofladen-Kategorien mit Angebot
 * (kategorieChips — Zählung ohne die eigene Wahl, mit Siegeln), am Ende
 * Futtermittel und Brennmaterial. Diese beiden stehen immer da, auch ohne
 * Angebot: Sie sind die zwei Wege, die die Startseite verspricht — ohne
 * Treffer führt der Leerzustand weiter.
 *
 * Mehrfachwahl bleibt ein ODER (wie vor dem Umbau, und wie „Gemüse & Obst"
 * der Startseite als `kat=GEMUESE,OBST` ankommt).
 */
export function kategorieReihe(
  hoefe: readonly { angebot: readonly AngebotsZeile[] }[],
  filter: HoefeFilter
): EntdeckenChip[] {
  const imHofladen = filter.bereich === 'LEBENSMITTEL'
  // Gezählt wird immer im Hofladen — auch, solange der Futter-Bereich offen ist.
  const basis = wechsleBereich(filter, 'LEBENSMITTEL')
  const daten = kategorieChips(hoefe, imHofladen ? filter : basis).filter((c) => c.wert !== 'BRENNHOLZ')

  return [
    {
      schluessel: 'alle',
      label: 'Alle',
      aktiv: imHofladen && filter.kategorien.length === 0,
      ziel: mitKategorien(basis, []),
    },
    ...daten.map((c) => ({
      schluessel: c.wert,
      label: kategorieLabel(c.wert),
      aktiv: imHofladen && filter.kategorien.includes(c.wert),
      ziel: hofladenKategorieZiel(filter, c.wert),
    })),
    {
      schluessel: 'futter',
      label: 'Futtermittel',
      aktiv: !imHofladen,
      ziel: imHofladen ? wechsleBereich(filter, 'FUTTERMITTEL') : basis,
    },
    {
      schluessel: 'BRENNHOLZ',
      label: KATEGORIE_LABEL.BRENNHOLZ,
      aktiv: imHofladen && filter.kategorien.includes('BRENNHOLZ'),
      ziel: hofladenKategorieZiel(filter, 'BRENNHOLZ'),
    },
  ]
}

/** Im Futter die zweite Reihe: Heu & Stroh, Getreide & Körner … — nur mit Angebot. */
export function futterReihe(
  hoefe: readonly { angebot: readonly AngebotsZeile[] }[],
  filter: HoefeFilter
): EntdeckenChip[] {
  if (filter.bereich !== 'FUTTERMITTEL') return []
  return kategorieChips(hoefe, filter).map((c) => ({
    schluessel: c.wert,
    label: kategorieLabel(c.wert),
    aktiv: filter.kategorien.includes(c.wert),
    ziel: mitKategorien(filter, umschalten(filter.kategorien, c.wert)),
  }))
}

/**
 * Die Mengen-Facette — nur im Futter, dort immer alle drei Stufen: Der
 * Futter-Chip blendet sie ein (E2). Eine Wahl, „Alle Mengen" nimmt sie heraus.
 */
export function mengenReihe(filter: HoefeFilter): EntdeckenChip[] {
  if (filter.bereich !== 'FUTTERMITTEL') return []
  const stufen: Array<{ wert: GebindeWahl | null; label: string }> = [
    { wert: null, label: 'Alle Mengen' },
    { wert: 'KLEIN', label: MENGE_LABEL.KLEIN },
    { wert: 'GROSS', label: MENGE_LABEL.GROSS },
  ]
  return stufen.map(({ wert, label }) => ({
    schluessel: wert ?? 'alle',
    label,
    aktiv: filter.gebinde === wert,
    ziel: { ...filter, gebinde: wert },
  }))
}

/** Die Sorten der gewählten Kategorien (gestrichelte zweite Ebene) — erst ab zwei Sorten (sortenChips). */
export function sortenReihe(
  hoefe: readonly { angebot: readonly AngebotsZeile[] }[],
  filter: HoefeFilter
): EntdeckenChip[] {
  return sortenChips(hoefe, filter).map((c) => ({
    schluessel: c.wert,
    label: c.label,
    aktiv: filter.sorten.includes(c.wert),
    ziel: { ...filter, sorten: umschalten(filter.sorten, c.wert) },
  }))
}

/** Siegel (Bio, Gentechnikfrei, AMA) in beiden Bereichen — nur, was es im Ausschnitt gibt. */
export function siegelReihe(
  hoefe: readonly { angebot: readonly AngebotsZeile[] }[],
  filter: HoefeFilter
): EntdeckenChip[] {
  return siegelChips(hoefe, filter, (s) => SIEGEL[s].name).map((c) => ({
    schluessel: c.wert,
    label: c.label,
    aktiv: filter.siegel.includes(c.wert),
    ziel: { ...filter, siegel: umschalten(filter.siegel, c.wert) },
  }))
}

/** „Für Tiere" im Futter — Mehrfachwahl als ODER, nur Tiere mit Angebot. */
export function tierReihe(
  hoefe: readonly { angebot: readonly AngebotsZeile[] }[],
  filter: HoefeFilter
): EntdeckenChip[] {
  return tierChips(hoefe, filter, (t) => TIERART_LABEL[t]).map((c) => ({
    schluessel: c.wert,
    label: c.label,
    aktiv: filter.tiere.includes(c.wert),
    ziel: { ...filter, tiere: umschalten(filter.tiere, c.wert) },
  }))
}

/** Die Sortierung nach Kilopreis — nur im Futter, ein Chip zum An- und Abschalten. */
export function sortierReihe(filter: HoefeFilter): EntdeckenChip[] {
  if (filter.bereich !== 'FUTTERMITTEL') return []
  const aktiv = filter.sortierung === 'GRUNDPREIS'
  return [{ schluessel: 'grundpreis', label: KILOPREIS_LABEL, aktiv, ziel: { ...filter, sortierung: aktiv ? null : 'GRUNDPREIS' } }]
}

// ─── Aktive Filter ──────────────────────────────────────────────────────────

/** Ein gesetzter Filter: wie er heißt und welcher Filter ohne ihn gilt. */
/**
 * `umkreis: true` markiert den Umkreis-Eintrag: Er lebt nur im Seitenzustand,
 * nie in der URL (#130) — sein `ohne` ist deshalb die unveränderte Adresse,
 * entfernt wird er über den Zustand, nicht über einen Link.
 */
export type AktiverFilter = { schluessel: string; label: string; ohne: HoefeFilter; umkreis?: true }

/**
 * Jeder gesetzte Filter einzeln, in der Reihenfolge Suche → Umkreis →
 * Bereich → Kategorien → Sorten → Siegel → Tiere → Menge → Sortierung. Die
 * Ansicht (Liste/Karte) ist kein Filter und steht hier nie, der Umkreis
 * „Alle" (null) auch nicht.
 */
export function aktiveFilter(filter: HoefeFilter, umkreis: UmkreisStufe = null): AktiverFilter[] {
  const liste: AktiverFilter[] = []
  for (const marke of filter.suchMarken) {
    liste.push({
      schluessel: `such-${marke}`,
      label: `Suche: ${marke}`,
      ohne: { ...filter, suchMarken: filter.suchMarken.filter((m) => m !== marke) },
    })
  }
  if (filter.suchtext.trim() !== '') {
    liste.push({ schluessel: 'suchtext', label: `Suche: ${filter.suchtext.trim()}`, ohne: { ...filter, suchtext: '' } })
  }
  if (umkreis !== null) {
    liste.push({ schluessel: 'umkreis', label: `Umkreis: ${umkreis} km`, ohne: filter, umkreis: true })
  }
  if (filter.bereich === 'FUTTERMITTEL') {
    liste.push({ schluessel: 'futter', label: 'Futtermittel', ohne: wechsleBereich(filter, 'LEBENSMITTEL') })
  }
  for (const k of filter.kategorien) {
    liste.push({ schluessel: `kat-${k}`, label: kategorieLabel(k), ohne: mitKategorien(filter, filter.kategorien.filter((w) => w !== k)) })
  }
  for (const s of filter.sorten) {
    liste.push({ schluessel: `sorte-${s}`, label: UNTERKATEGORIE_LABEL[s], ohne: { ...filter, sorten: filter.sorten.filter((w) => w !== s) } })
  }
  for (const s of filter.siegel) {
    liste.push({ schluessel: `siegel-${s}`, label: SIEGEL[s].name, ohne: { ...filter, siegel: filter.siegel.filter((w) => w !== s) } })
  }
  for (const t of filter.tiere) {
    liste.push({ schluessel: `tier-${t}`, label: `Für ${TIERART_LABEL[t]}`, ohne: { ...filter, tiere: filter.tiere.filter((w) => w !== t) } })
  }
  if (filter.gebinde) {
    liste.push({ schluessel: 'gebinde', label: MENGE_LABEL[filter.gebinde], ohne: { ...filter, gebinde: null } })
  }
  if (filter.sortierung === 'GRUNDPREIS') {
    liste.push({ schluessel: 'sort', label: KILOPREIS_LABEL, ohne: { ...filter, sortierung: null } })
  }
  return liste
}

/**
 * „Alle zurücksetzen": kein Filter mehr in der Adresse — die Ansicht
 * (Liste/Karte) bleibt, sie ist keiner. Den Umkreis (Zustand, nicht URL)
 * hebt der Aufrufer zugleich auf.
 */
export function alleZuruecksetzen(filter: HoefeFilter): HoefeFilter {
  return { ...LEERER_HOEFE_FILTER, ansicht: filter.ansicht }
}

/** Die Zahl am Filter-Knopf („Filter · 2"): alles außer der Suche, die steht im Feld. */
export function zaehleFilter(filter: HoefeFilter, umkreis: UmkreisStufe = null): number {
  return aktiveFilter(filter, umkreis).filter((f) => !f.label.startsWith('Suche: ')).length
}

// ─── Kopf, Ergebnisart, Zahl ────────────────────────────────────────────────

export type EntdeckenKopf = { titel: string; unterzeile: string }

/** Wortlaut aus den Mockups. */
export const ENTDECKEN_KOPF = {
  hoefe: { titel: 'Höfe in deiner Nähe', unterzeile: 'Frisch vom Hof – bestellen und im Zeitfenster abholen' },
  futter: { titel: 'Futtermittel in deiner Nähe', unterzeile: 'Vom Sackerl für den Hasen bis zum Rundballen' },
  sucheUnterzeile: 'Produkte statt Höfe, weil du nach einem Produkt suchst',
} as const

function suchbegriffe(filter: HoefeFilter): string[] {
  const text = filter.suchtext.trim()
  return text === '' ? filter.suchMarken : [...filter.suchMarken, text]
}

export function entdeckenKopf(filter: HoefeFilter): EntdeckenKopf {
  const begriffe = suchbegriffe(filter)
  if (begriffe.length > 0) {
    return { titel: `„${begriffe.join(', ')}" in deiner Nähe`, unterzeile: ENTDECKEN_KOPF.sucheUnterzeile }
  }
  return filter.bereich === 'FUTTERMITTEL' ? { ...ENTDECKEN_KOPF.futter } : { ...ENTDECKEN_KOPF.hoefe }
}

/**
 * Produkte statt Höfe: bei einer Suche (Mockup web-k1-suche-filter) und im
 * Futter (web-k1-filter-futtermittel: „Bei Futtermitteln zeigen wir Angebote
 * statt Höfe") — dort entscheidet die Menge je Produkt, nicht je Hof.
 */
export function zeigtProdukte(filter: HoefeFilter): boolean {
  return suchbegriffe(filter).length > 0 || filter.bereich === 'FUTTERMITTEL'
}

/** „4 Höfe" · „2 Treffer" · „3 Angebote" — was gerade gezählt wird. */
export function ergebnisZahl(filter: HoefeFilter, anzahl: number): string {
  if (suchbegriffe(filter).length > 0) return mitAnzahl(anzahl, 'Treffer', 'Treffer')
  if (filter.bereich === 'FUTTERMITTEL') return mitAnzahl(anzahl, 'Angebot', 'Angebote')
  return mitAnzahl(anzahl, 'Hof', 'Höfe')
}

// ─── Produkttreffer ─────────────────────────────────────────────────────────

export type ProduktTreffer<H> = { hof: H; produkt: AngebotsProdukt }

function enthaelt(name: string, begriff: string): boolean {
  return suchForm(name).includes(suchForm(begriff))
}

/**
 * Die Produktliste statt der Hofliste. Erwartet die Höfe, die die Übersicht
 * schon ausgewählt und geordnet hat (berechneHofAuswahl: Bereich, Facetten,
 * Umkreis, Suche), und nimmt daraus die Produkte, die
 *   - zum Filter passen (zeilePasst: Bereich, Kategorie, Sorte, Siegel,
 *     Tiere, Menge — je Produkt, nicht je Hof),
 *   - und zur Suche: Such-Marken untereinander ein ODER, der getippte Text
 *     ein UND; trifft der Text den Hofnamen, gelten alle Produkte des Hofs
 *     (wer „Waldhof" sucht, sieht, was der Waldhof hat) — dieselbe Regel wie
 *     filtereNachSuche für die Hofliste.
 * Reihenfolge: die der Höfe (Entfernung oder Freischaltung), darin die der
 * Hofseite; mit „Günstigster Kilopreis" nach Grundpreis, ohne Preis am Ende.
 * Das Angebot enthält nur Kaufbares (istKaufbar) — Ausverkauftes ist nie ein
 * Treffer.
 */
export function produktTreffer<H extends { name: string; angebot: readonly AngebotsProdukt[] }>(
  hoefe: readonly H[],
  filter: HoefeFilter
): ProduktTreffer<H>[] {
  if (!zeigtProdukte(filter)) return []
  const marken = filter.suchMarken.filter((m) => suchForm(m) !== '')
  const text = filter.suchtext.trim()

  const treffer: ProduktTreffer<H>[] = []
  for (const hof of hoefe) {
    const hofGetroffen = text !== '' && enthaelt(hof.name, text)
    for (const produkt of hof.angebot) {
      if (!zeilePasst(produkt, filter)) continue
      if (marken.length > 0 && !marken.some((m) => enthaelt(produkt.name, m))) continue
      if (text !== '' && !hofGetroffen && !enthaelt(produkt.name, text)) continue
      treffer.push({ hof, produkt })
    }
  }

  if (filter.bereich !== 'FUTTERMITTEL' || filter.sortierung !== 'GRUNDPREIS') return treffer
  return treffer
    .map((t, index) => ({ t, index, preis: t.produkt.grundpreis?.wert ?? null }))
    .sort((a, b) => {
      if (a.preis === null) return b.preis === null ? a.index - b.index : 1
      if (b.preis === null) return -1
      return a.preis - b.preis || a.index - b.index
    })
    .map(({ t }) => t)
}

// ─── Leerzustand ────────────────────────────────────────────────────────────

export type LeerAusweg =
  | { art: 'link'; label: string; ziel: HoefeFilter }
  /** Der Umkreis lebt nur im Browser (nie in der URL) — deshalb ein Knopf, kein Link. */
  | { art: 'umkreis'; label: string; stufe: UmkreisStufe }

export type Leerzustand = { titel: string; satz: string; ausweg: LeerAusweg }

/** Die nächste Umkreis-Stufe: 10 → 25 → 50 → ohne Grenze. */
export function naechsteUmkreisStufe(stufe: Exclude<UmkreisStufe, null>): UmkreisStufe {
  return stufe === 10 ? 25 : stufe === 25 ? 50 : null
}

/**
 * Nie nur „nichts gefunden" (DESIGN_SYSTEM, „Leerzustand mit Ausweg"): Der
 * Ausweg nennt das Mittel, das WIRKLICH hilft — die Suche nur, wenn sie die
 * Liste geleert hat (sucheLeertDieListe), sonst den Umkreis, sonst den
 * Bereich, sonst die Filter. „Benachrichtige mich" gibt es nicht: Werbliche
 * Nachrichten nur mit Double-Opt-in (S11), und das ist nicht gebaut.
 */
export function leerzustand(eingabe: {
  sucheLeertDieListe: boolean
  umkreis: UmkreisStufe
  filter: HoefeFilter
}): Leerzustand {
  const { filter, umkreis } = eingabe
  if (eingabe.sucheLeertDieListe) {
    return {
      titel: 'Dazu haben wir gerade nichts gefunden',
      satz: 'Probier ein anderes Wort – oder nimm die Suche heraus.',
      ausweg: { art: 'link', label: 'Suche zurücksetzen', ziel: { ...filter, suchtext: '', suchMarken: [] } },
    }
  }
  if (umkreis !== null) {
    const stufe = naechsteUmkreisStufe(umkreis)
    return {
      titel: `Im Umkreis von ${umkreis} km ist gerade nichts dabei`,
      satz: 'Nimm den Umkreis weiter, dann siehst du mehr Höfe.',
      ausweg: { art: 'umkreis', label: stufe === null ? 'Umkreis aufheben' : `Auf ${stufe} km erweitern`, stufe },
    }
  }
  if (filter.bereich === 'FUTTERMITTEL' && !hatProduktfilter(filter)) {
    return {
      titel: 'Gerade verkauft hier kein Hof Futter',
      satz: 'Schau bald wieder vorbei – im Hofladen gibt es schon einiges.',
      ausweg: { art: 'link', label: 'Zum Hofladen', ziel: wechsleBereich(filter, 'LEBENSMITTEL') },
    }
  }
  return {
    titel: 'Kein Hof führt gerade etwas aus dieser Auswahl',
    satz: 'Nimm einen Filter heraus, dann siehst du mehr.',
    ausweg: { art: 'link', label: 'Alle zurücksetzen', ziel: alleZuruecksetzen(filter) },
  }
}

// ─── Ein Suchfeld „Ort oder Produkt" (Nr. 46) ───────────────────────────────

/**
 * Das eine Suchfeld auf /hoefe (Nachtlauf Nr. 46, freigabe.md §12): Höfe und
 * Produkte filtert es beim Tippen wie bisher (berechneHofAuswahl, im
 * Browser); einen Ort — Postleitzahl oder Name — löst es erst auf Wunsch auf,
 * serverseitig über `loeseOrtAuf` wie vorher das eigene Postleitzahl-Feld.
 * Daneben „Standort nutzen"; der Standort bleibt im Browser.
 */
export const SUCHFELD_TEXT = {
  platzhalter: 'Ort oder Produkt',
  beschriftung: 'Ort, Postleitzahl oder Produkt suchen',
  standort: 'Standort nutzen',
  nichtsGespeichert: 'Nichts wird gespeichert.',
  /** Standort abgelehnt oder nicht verfügbar — kein Fehler, nur der andere Weg. */
  ohneStandort: 'Kein Problem — tipp einfach deinen Ort oder deine Postleitzahl ins Suchfeld.',
  ohneTreffer: 'Diesen Ort kennen wir nicht — probier es mit der Postleitzahl.',
  /** Der Dialog des Browsers liegt noch offen: kein Scheitern, nur Geduld — und ein zweiter Weg. */
  dauert: 'Das dauert gerade — du kannst auch deinen Ort ins Suchfeld tippen.',
  ortAendern: 'Ort ändern',
  /** Der eigene Standort trägt keinen Namen — im Satz steht er so (Akkusativ bzw. Dativ). */
  rundUmStandort: 'deinen Standort',
  abStandort: 'deinem Standort',
  keinerDavon: 'Keiner davon',
  mehrereOrte: 'Welchen Ort meinst du?',
} as const

/**
 * Der Schlüssel des Eintrags „Höfe rund um …" in der Vorschlagsliste neben
 * den Produktnamen. Kein Produktname kann ihn tragen: Postgres speichert in
 * Text kein Nullzeichen.
 */
export const ORT_VORSCHLAG = '\u0000ort'

/** Ab zwei Zeichen kann der Text ein Ort sein — dieselbe Grenze wie `ortssucheSchema`. */
export function ortVorschlagAnbieten(text: string): boolean {
  return text.trim().length >= 2
}

/** „Höfe rund um „4910" zeigen" — der Eintrag, der den Text als Ort sucht. */
export function ortVorschlagText(text: string): string {
  return `Höfe rund um „${text.trim()}" zeigen`
}

/** Eine Postleitzahl vorn: „4910", „84359 Simbach" — das ist ein Ort, kein Produkt. */
export function siehtNachOrtAus(text: string): boolean {
  return /^\d{4,5}(?:\s|$)/.test(text.trim())
}

/**
 * Enter ohne markierten Vorschlag: Sieht der Text nach einer Postleitzahl aus
 * oder findet die Produktsuche nichts, sucht das Feld ihn als Ort. Sonst
 * bleibt es bei der Produktsuche, die beim Tippen schon wirkt — „Eier" ist
 * kein Ort. Wer bei einem Treffer trotzdem den Ort meint („Ried" neben dem
 * Riedhof), nimmt den Eintrag „Höfe rund um …" aus der Liste.
 */
export function enterSuchtOrt(text: string, treffer: number): boolean {
  if (!ortVorschlagAnbieten(text)) return false
  return siehtNachOrtAus(text) || treffer === 0
}
