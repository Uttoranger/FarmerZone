/**
 * Reine Datenlogik der öffentlichen Hofübersicht (/hoefe) — ohne Datenbank
 * und ohne Browser prüfbar (tests/hofuebersicht.test.ts).
 *
 * Hier lebt alles, was die Übersicht aus den Rohdaten der Query macht:
 * Kategorien einsammeln (distinct, ohne null), den nächsten anstehenden
 * Abholtermin bestimmen (wöchentlich wiederkehrende Fenster) und die
 * clientseitige Kategorie-Filterung.
 *
 * ZEITZONE: Die Abholfenster sind österreichische Ortszeiten („14:00"),
 * der Server läuft aber in UTC. Deshalb rechnen die Funktionen nie mit
 * `Date` selbst, sondern bekommen „jetzt" als bereits nach Europe/Vienna
 * aufgelösten Wochentag + Uhrzeit — die Auflösung macht wienJetzt().
 */
import type { ProductCategoryValue } from '@/schemas/product'
import { DAY_NAMES } from '@/lib/pickup-slot-rules'

export type AbholFenster = {
  /** 0=Sonntag … 6=Samstag — wie PickupSlot.dayOfWeek und JS getDay(). */
  dayOfWeek: number
  startTime: string
  endTime: string
}

/** „Jetzt" in österreichischer Ortszeit: Wochentag (0=So) + „HH:MM". */
export type OrtsZeit = { wochentag: number; uhrzeit: string }

/** Löst den Moment in Europe/Vienna auf — der eine unreine Baustein. */
export function wienJetzt(moment: Date = new Date()): OrtsZeit {
  const teile = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Vienna',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(moment)
  const wert = (typ: string) => teile.find((t) => t.type === typ)?.value ?? ''
  const wochentage = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    wochentag: Math.max(0, wochentage.indexOf(wert('weekday'))),
    uhrzeit: `${wert('hour')}:${wert('minute')}`,
  }
}

/** Distinct-Kategorien in der festen Reihenfolge des Produkt-Schemas;
 *  null (keine Angabe) fällt weg. Die Query liefert nur verfügbare Produkte —
 *  hier wird trotzdem noch einmal entdoppelt, Gürtel und Hosenträger. */
export function sammleKategorien(
  produkte: Array<{ category: ProductCategoryValue | null }>,
  reihenfolge: readonly ProductCategoryValue[]
): ProductCategoryValue[] {
  const vorhanden = new Set<ProductCategoryValue>()
  for (const p of produkte) {
    if (p.category) vorhanden.add(p.category)
  }
  return reihenfolge.filter((k) => vorhanden.has(k))
}

export type NaechsteAbholung = AbholFenster & {
  /** 0 = heute, 1 = morgen, … 6; 7 = das heutige Fenster ist schon vorbei
   *  und kommt erst in einer Woche wieder. */
  tageVoraus: number
}

/**
 * Der nächste ANSTEHENDE Abholtermin: Vergangene Fenster werden übersprungen —
 * ein Fenster zählt heute noch, solange sein Ende nicht erreicht ist (wer um
 * 14:30 schaut, kann um 15:00 im 14–16-Fenster abholen). Ohne Fenster: null.
 * „HH:MM"-Strings vergleichen sich lexikografisch korrekt.
 */
export function naechsteAbholung(
  fenster: AbholFenster[],
  jetzt: OrtsZeit
): NaechsteAbholung | null {
  let beste: NaechsteAbholung | null = null
  for (const f of fenster) {
    let tageVoraus = (f.dayOfWeek - jetzt.wochentag + 7) % 7
    if (tageVoraus === 0 && f.endTime <= jetzt.uhrzeit) tageVoraus = 7
    if (
      beste === null ||
      tageVoraus < beste.tageVoraus ||
      (tageVoraus === beste.tageVoraus && f.startTime < beste.startTime)
    ) {
      beste = { ...f, tageVoraus }
    }
  }
  return beste
}

/** „Heute 14:00–16:00", „Morgen …", sonst „Freitag 14:00–16:00". Bei
 *  tageVoraus 7 wäre der nackte Wochentagsname der HEUTIGE — das läse sich
 *  wie das bereits vorbeie Fenster, deshalb ausdrücklich „in einer Woche". */
export function formatiereAbholung(a: NaechsteAbholung): string {
  if (a.tageVoraus === 0) return `Heute ${a.startTime}–${a.endTime}`
  if (a.tageVoraus === 1) return `Morgen ${a.startTime}–${a.endTime}`
  if (a.tageVoraus === 7) return `${DAY_NAMES[a.dayOfWeek]} in einer Woche, ${a.startTime}–${a.endTime}`
  return `${DAY_NAMES[a.dayOfWeek]} ${a.startTime}–${a.endTime}`
}

/** Höchstens so viele Fotos trägt ein Streifen — mehr wäre Ballast im
 *  Payload und niemand blättert weiter. */
export const FOTOSTREIFEN_DECKEL = 5

/**
 * Baut den Fotostreifen einer Hofkarte: Titelbild zuerst (NUR wenn
 * bannerType ein echtes Bild ist — GRADIENT ist Farbe, kein Foto), dann die
 * Galerie (bereits nach sortOrder), dann Produktfotos. Duplikate fallen weg
 * (dasselbe Foto kann Titelbild UND Galerie-Eintrag sein), Deckel bei 5.
 * Ein Hof ohne Fotos bekommt die leere Liste — und behält seine kompakte
 * Karte.
 */
export function baueFotostreifen(eingabe: {
  bannerUrl: string | null
  bannerType: string
  galerie: string[]
  produktFotos: string[]
}): string[] {
  const fotos: string[] = []
  if (eingabe.bannerType === 'PHOTO' && eingabe.bannerUrl) fotos.push(eingabe.bannerUrl)
  fotos.push(...eingabe.galerie, ...eingabe.produktFotos)
  return [...new Set(fotos)].slice(0, FOTOSTREIFEN_DECKEL)
}

/**
 * Kategorie-Filter der Übersicht — Mehrfachauswahl als ODER: Ein Hof bleibt,
 * wenn er MINDESTENS EINE der gewählten Kategorien führt. Leere Auswahl
 * zeigt alle. Rein clientseitig auf den geladenen Daten.
 */
export function filtereHoefe<H extends { kategorien: ProductCategoryValue[] }>(
  hoefe: H[],
  gewaehlt: ProductCategoryValue[]
): H[] {
  if (gewaehlt.length === 0) return hoefe
  const auswahl = new Set(gewaehlt)
  return hoefe.filter((h) => h.kategorien.some((k) => auswahl.has(k)))
}

// ─── Produktvorschau auf der Hofkarte ───────────────────────────────────────

/** Ein Produkt, so schmal wie die Vorschau es braucht. */
export type VorschauProdukt = {
  id: string
  name: string
  price: number
  unit: string
  unitSize: number | null
  imageUrl: string | null
  category: ProductCategoryValue | null
  /** Bestand abzüglich Reservierung — false heißt „derzeit aus". */
  verfuegbar: boolean
}

/** Höchstens so viele Zeilen zeigt eine Hofkarte. */
export const VORSCHAU_ZEILEN = 3

/**
 * Wählt die Produkte für das Schaufenster einer Hofkarte.
 *
 * REIHENFOLGE, in dieser Rangfolge:
 *   1. SUCHTREFFER — wer nach „Eier" gesucht hat, sieht die Eier zuerst,
 *      auch wenn sie ausverkauft sind (der Hof steht dann wegen seines
 *      Namens in der Liste; die Kennzeichnung „derzeit aus" erklärt es).
 *   2. Passt zum gesetzten Kategoriefilter — das Schaufenster zeigt, wonach
 *      gesucht wurde (ohne Filter entfällt diese Stufe).
 *   3. Verfügbar vor ausverkauft — was man kaufen kann, steht vorn.
 *   4. Sonst die gegebene Reihenfolge (sortOrder der Hofseite).
 * Fremde Kategorien gehen dabei NICHT verloren: Sie füllen die restlichen
 * Plätze, sobald die passenden aufgebraucht sind.
 *
 * Sind ALLE Produkte ausverkauft, erscheinen ausverkaufte — gekennzeichnet.
 * Ein leeres Schaufenster wäre die schlechtere Auskunft: Der Hof führt die
 * Ware, sie ist nur gerade weg.
 *
 * `gesamt` ist die Zahl ALLER verfügbar geschalteten Produkte des Hofes (aus
 * der Query, nicht aus dieser Liste): Die Vorschau lädt nur die ersten
 * wenigen, „+ n weitere" muss trotzdem stimmen.
 */
export function waehleVorschauProdukte(
  produkte: VorschauProdukt[],
  gewaehlteKategorien: ProductCategoryValue[] = [],
  gesamt: number = produkte.length,
  zeilen: number = VORSCHAU_ZEILEN,
  suchbegriffe: string[] = []
): { produkte: VorschauProdukt[]; weitere: number } {
  const auswahl = new Set(gewaehlteKategorien)
  const passt = (p: VorschauProdukt) => auswahl.size > 0 && p.category !== null && auswahl.has(p.category)
  const begriffe = suchbegriffe.map(suchForm).filter((b) => b !== '')
  const getroffen = (p: VorschauProdukt) =>
    begriffe.length > 0 && begriffe.some((b) => trifft(p.name, b))

  const geordnet = produkte
    .map((produkt, index) => ({ produkt, index }))
    .sort((a, b) => {
      if (getroffen(a.produkt) !== getroffen(b.produkt)) return getroffen(a.produkt) ? -1 : 1
      if (passt(a.produkt) !== passt(b.produkt)) return passt(a.produkt) ? -1 : 1
      if (a.produkt.verfuegbar !== b.produkt.verfuegbar) return a.produkt.verfuegbar ? -1 : 1
      return a.index - b.index
    })
    .map(({ produkt }) => produkt)

  const gezeigt = geordnet.slice(0, zeilen)
  return { produkte: gezeigt, weitere: Math.max(0, gesamt - gezeigt.length) }
}

// ─── Produktsuche: Vorschläge und Filter ────────────────────────────────────

/**
 * Die Vergleichsform eines Namens für die Suche: Groß-/Kleinschreibung,
 * Leerzeichen-Unterschiede (führend, mehrfach, anhängend) und die
 * Unicode-Normalform zählen nicht (NFC — ein per macOS-Paste zerlegtes
 * „Käse“ in NFD wäre sonst eine zweite, gleich aussehende Gruppe und eine
 * Marke, die nicht filtert). EINE Normalisierung für Vorschläge, Filter,
 * Trefferbevorzugung UND die Marken-Entdopplung in der Oberfläche (deshalb
 * exportiert) — zwei Regeln würden auseinanderlaufen.
 */
export function suchForm(text: string): string {
  return text.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Die Anzeige-Schreibweise: wie eingegeben, nur Whitespace und
 *  Unicode-Form vereinheitlicht. */
function schreibweiseVon(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ')
}

/** Teiltreffer nach Suchform: „ei“ trifft „Freilandeier“. */
function trifft(name: string, begriff: string): boolean {
  return suchForm(name).includes(suchForm(begriff))
}

export type ProduktVorschlag = {
  /** Anzeigename — die häufigste Schreibweise der zusammengefassten Gruppe. */
  name: string
  /** Bei wie vielen Höfen es das Produkt gerade VERFÜGBAR gibt. */
  hoefe: number
}

/** Höchstens so viele Vorschlags-Knöpfe zeigt die Leiste. */
export const VORSCHLAGS_DECKEL = 12

/**
 * Die Vorschlags-Knöpfe unter dem Suchfeld: die VERFÜGBAREN Produkte der
 * übergebenen (also bereits nach Kategorie/Umkreis eingegrenzten) Höfe,
 * gleiche Namen über Schreibweisen hinweg zusammengefasst, gezählt nach
 * Höfen und danach absteigend sortiert (Gleichstand: alphabetisch, damit
 * die Reihenfolge nicht von der Ladereihenfolge abhängt).
 *
 * Gespeist aus `suchNamen` — den Namen ALLER verfügbaren Produkte je Hof
 * (queries/farm.ts, ungedeckelt): AUSVERKAUFTES ist dort schon aussortiert
 * (die Suche verspricht „was es gerade wirklich gibt“ — ein Vorschlag,
 * hinter dem nur „derzeit aus“ steht, wäre ein leeres Versprechen), und
 * anders als die acht Vorschau-Zeilen verschweigt die Liste kein Produkt
 * ab Platz neun.
 *
 * `suchtext` verengt die Liste auf passende Namen (Teiltreffer), erst
 * DANACH greift der Deckel — beim Tippen tauchen also auch Namen auf, die
 * ohne Eingabe hinter den zwölf häufigsten lägen.
 */
export function verfuegbareProduktnamen(
  hoefe: Array<{ suchNamen: string[] }>,
  suchtext: string = '',
  deckel: number = VORSCHLAGS_DECKEL
): ProduktVorschlag[] {
  type Gruppe = { schreibweisen: Map<string, number>; hoefe: number }
  const gruppen = new Map<string, Gruppe>()

  for (const hof of hoefe) {
    // BEIDE Zählungen sind je Hof entdoppelt: „bei wie vielen Höfen gibt es
    // das“ — und auch die Abstimmung über den Anzeigenamen. Sonst
    // überstimmte ein Hof, der „eier“ als 6er- UND 10er-Gebinde führt, mit
    // zwei Zeilen die Mehrheit der Höfe, die „Eier“ schreiben.
    const gezaehlteFormen = new Set<string>()
    const gezaehlteSchreibweisen = new Set<string>()
    for (const name of hof.suchNamen) {
      const form = suchForm(name)
      if (form === '') continue
      const gruppe = gruppen.get(form) ?? { schreibweisen: new Map(), hoefe: 0 }
      const schreibweise = schreibweiseVon(name)
      if (!gezaehlteFormen.has(form)) {
        gezaehlteFormen.add(form)
        gruppe.hoefe += 1
      }
      if (!gezaehlteSchreibweisen.has(schreibweise)) {
        gezaehlteSchreibweisen.add(schreibweise)
        gruppe.schreibweisen.set(schreibweise, (gruppe.schreibweisen.get(schreibweise) ?? 0) + 1)
      }
      gruppen.set(form, gruppe)
    }
  }

  const eingabe = suchForm(suchtext)
  return [...gruppen.entries()]
    .filter(([form]) => eingabe === '' || form.includes(eingabe))
    .map(([, gruppe]) => {
      let name = ''
      let haeufigkeit = -1
      for (const [schreibweise, anzahl] of gruppe.schreibweisen) {
        // Bei Gleichstand entscheidet die Sortierung mit caseFirst:'upper' —
        // „Freilandeier“ schlägt „freilandeier“, statt dass die zufällige
        // Ladereihenfolge der Höfe den Knopf beschriftet.
        const gewinnt =
          anzahl > haeufigkeit ||
          (anzahl === haeufigkeit &&
            schreibweise.localeCompare(name, 'de-AT', { caseFirst: 'upper' }) < 0)
        if (gewinnt) {
          name = schreibweise
          haeufigkeit = anzahl
        }
      }
      return { name, hoefe: gruppe.hoefe }
    })
    .sort((a, b) => b.hoefe - a.hoefe || a.name.localeCompare(b.name, 'de-AT'))
    .slice(0, deckel)
}

/**
 * Die Suchwirkung auf die Hofliste — rein, auf den geladenen Daten:
 *
 *   - Aktive Such-Marken sind untereinander ein ODER: Ein Hof bleibt, wenn
 *     er zu MINDESTENS EINER ein verfügbares Produkt führt (Teiltreffer —
 *     „Brot“ behält auch den Hof, der nur „Bauernbrot“ schreibt).
 *   - Der getippte Suchtext durchsucht Hofnamen UND Produktnamen; gegenüber
 *     den Marken ist er ein UND (eine weitere Einschränkung, wie Kategorie
 *     und Umkreis — nach dem Übernehmen als Marke ist das Feld ohnehin leer).
 *   - AUSVERKAUFTE Produkte zählen nicht als Treffer (Suche = „was es
 *     gerade wirklich gibt“) — `suchNamen` führt sie gar nicht erst; der
 *     HOFNAME trifft unabhängig davon.
 *
 * Kategorie- und Umkreisfilter laufen unverändert daneben (UND) — diese
 * Funktion kennt sie gar nicht.
 *
 * Geprüft wird gegen `suchNamen` — die Namen ALLER verfügbaren Produkte je
 * Hof (queries/farm.ts, aus der ungedeckelten Zeilen-Abfrage): Auf den acht
 * Vorschau-Zeilen wäre ein Hof, der das Gesuchte erst ab Platz neun führt,
 * ein falsches Negativ — dasselbe Loch, das beim Kategoriefilter bewusst
 * gestopft wurde (farm.ts, „wäre beim Filtern danach unauffindbar“).
 */
export function filtereNachSuche<H extends { name: string; suchNamen: string[] }>(
  hoefe: H[],
  suchtext: string,
  suchMarken: string[] = []
): H[] {
  const marken = suchMarken.map(suchForm).filter((m) => m !== '')
  const eingabe = suchForm(suchtext)
  if (marken.length === 0 && eingabe === '') return hoefe

  const fuehrt = (hof: H, begriff: string) =>
    hof.suchNamen.some((name) => trifft(name, begriff))

  return hoefe.filter((hof) => {
    if (marken.length > 0 && !marken.some((m) => fuehrt(hof, m))) return false
    if (eingabe !== '' && !trifft(hof.name, eingabe) && !fuehrt(hof, eingabe)) return false
    return true
  })
}

/** Alle Filtergriffe der Übersicht in einem Wert — die Eingabe von
 *  berechneHofAuswahl. */
export type UebersichtsFilter = {
  kategorien: ProductCategoryValue[]
  bezugspunkt: Bezugspunkt | null
  umkreis: UmkreisStufe
  suchtext: string
  suchMarken: string[]
}

/**
 * DIE Ableitung der Hofübersicht — rein, damit die Verdrahtung selbst
 * getestet ist und nicht nur ihre Einzelteile (die Komponente ruft nur noch
 * diese eine Funktion):
 *
 *   - `gefiltert`: Kategorie → Umkreis/Sortierung → Suche (alles UND).
 *   - `vorschlaege`: aus dem Kategorie/Umkreis-Ausschnitt („angeboten wird
 *     nur, was bei den sichtbaren Höfen gerade verfügbar ist“), bewusst
 *     OHNE die Such-Marken selbst — die sind untereinander ein ODER, und
 *     wer „Eier“ gewählt hat, soll „Brot“ vom Nachbarhof weiter angeboten
 *     bekommen; bereits aktive Marken erscheinen nicht noch einmal.
 *   - `suchbegriffe`: Marken plus getippter Text — fürs Schaufenster
 *     (Treffer zuerst, waehleVorschauProdukte).
 *   - `sucheAktiv`: es gibt aktive Suchbegriffe.
 *   - `sucheLeertDieListe`: die Leere geht WIRKLICH auf die Suche zurück
 *     (ohne sie gäbe es Treffer) — nur dann hilft „Suche zurücksetzen“;
 *     hat schon der Umkreis die Basis geleert, muss die Leermeldung IHN
 *     nennen, sonst führt der Knopf ins Leere.
 */
export function berechneHofAuswahl<
  H extends {
    name: string
    kategorien: ProductCategoryValue[]
    suchNamen: string[]
    latitude: number | null
    longitude: number | null
  },
>(
  hoefe: H[],
  filter: UebersichtsFilter
): {
  gefiltert: MitEntfernung<H>[]
  vorschlaege: ProduktVorschlag[]
  suchbegriffe: string[]
  sucheAktiv: boolean
  sucheLeertDieListe: boolean
} {
  const suchBasis = ordneNachEntfernung(
    filtereHoefe(hoefe, filter.kategorien),
    filter.bezugspunkt,
    filter.umkreis
  )
  const gefiltert = filtereNachSuche(suchBasis, filter.suchtext, filter.suchMarken)
  const eingabe = filter.suchtext.trim()
  const aktiv = new Set(filter.suchMarken.map(suchForm))
  const sucheAktiv = filter.suchMarken.length > 0 || eingabe !== ''
  return {
    gefiltert,
    vorschlaege: verfuegbareProduktnamen(suchBasis, filter.suchtext).filter(
      (v) => !aktiv.has(suchForm(v.name))
    ),
    suchbegriffe: eingabe === '' ? filter.suchMarken : [...filter.suchMarken, eingabe],
    sucheAktiv,
    sucheLeertDieListe: sucheAktiv && gefiltert.length === 0 && suchBasis.length > 0,
  }
}

/**
 * Der erste SICHTBARE Buchstabe (oder die erste Ziffer) eines Produktnamens,
 * groß — der Platzhalter für ein fehlendes Produktbild.
 *
 * Dasselbe Prinzip wie die Hof-Initialen (src/lib/hof-initialen.ts): ein
 * Zeichen auf Sandfläche statt eines gebrochenen Bild-Symbols. Gesucht wird
 * mit `\p{L}|\p{N}`, damit ein führendes Anführungszeichen oder Sternchen
 * („*Bio-Ei") nicht als Initiale endet; bleibt gar nichts übrig, steht dort
 * ein Mittelpunkt statt einer leeren Fläche.
 *
 * Hier und nicht in der Komponente, damit die Ableitung ohne Browser prüfbar
 * ist — Repo-Konvention für reine Logik.
 */
export function produktInitiale(name: string): string {
  const treffer = name.match(/\p{L}|\p{N}/u)
  return treffer ? treffer[0].toLocaleUpperCase('de-AT').slice(0, 1) : '·'
}

// ─── Umkreis: Entfernung, Sortierung, Stufen ────────────────────────────────
//
// DATENSPARSAMKEIT (nicht verhandelbar): Der Gerätestandort wird NIEMALS an
// einen Server geschickt — weder an uns noch an Dritte. Alles hier ist reine
// Rechnerei, die der BROWSER auf den ohnehin geladenen Hofkoordinaten
// ausführt. Nur die Postleitzahl-Variante schickt die EINGETIPPTE Eingabe an
// Nominatim (src/lib/geokodierung.ts, sucheOrtspunkt) — nie eine gemessene
// Position.

/** Der Bezugspunkt der Umkreissuche: eigener Standort oder aufgelöste PLZ. */
export type Bezugspunkt = { lat: number; lon: number; name?: string }

/** Die Stufen des Umkreis-Reglers. `null` = „egal" (Voreinstellung: Bei
 *  wenigen Höfen darf nichts versteckt werden). */
export type UmkreisStufe = 10 | 25 | 50 | null

export const UMKREIS_STUFEN: UmkreisStufe[] = [10, 25, 50, null]

const ERDRADIUS_KM = 6371

/**
 * Entfernung zweier Punkte auf der Kugel (Haversine) in Kilometern.
 * Für Österreich-Distanzen mehr als genau genug — und ohne Netz prüfbar.
 */
export function entfernungKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const bogen = (grad: number) => (grad * Math.PI) / 180
  const dLat = bogen(b.lat - a.lat)
  const dLon = bogen(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(bogen(a.lat)) * Math.cos(bogen(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * ERDRADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * „unter 0,1 km" · „0,4 km" · „1,3 km" · „12 km" · „143 km": Unter zehn
 * Kilometern zählt die erste Nachkommastelle, darüber wäre sie
 * Scheingenauigkeit (die Luftlinie ist ohnehin nicht der Fahrweg).
 *
 * Gerundet wird VOR der Entscheidung über die Darstellung — sonst stünde
 * 9,97 km als „10,0 km" da, direkt neben einem „10 km" für glatte zehn.
 * Und unter hundert Metern ist „0,0 km" keine Aussage, sondern ein Fehler
 * im Text.
 */
export function formatiereEntfernung(km: number): string {
  if (km < 0.1) return 'unter 0,1 km'
  const aufEineStelle = Math.round(km * 10) / 10
  if (aufEineStelle < 10) return `${aufEineStelle.toFixed(1).replace('.', ',')} km`
  return `${Math.round(km)} km`
}

/** Ein Hof mit berechneter Entfernung — null, wenn er (noch) keinen
 *  Kartenpunkt hat oder es keinen Bezugspunkt gibt. */
export type MitEntfernung<H> = H & { entfernungKm: number | null }

/**
 * Ordnet die Höfe nach Entfernung zum Bezugspunkt und wendet die
 * Umkreisstufe an.
 *
 * HÖFE OHNE KOORDINATEN stehen IMMER am Ende und werden von der
 * Umkreisgrenze NIE ausgeschlossen: Sie sind nicht weit weg, sie sind
 * unbekannt — ein Hof, der seinen Kartenpunkt noch nicht gesetzt hat, darf
 * dadurch nicht unsichtbar werden.
 *
 * Ohne Bezugspunkt bleibt die Reihenfolge unangetastet (Freischalt-
 * Reihenfolge der Query) und jede Entfernung ist null.
 */
export function ordneNachEntfernung<H extends { latitude: number | null; longitude: number | null }>(
  hoefe: H[],
  punkt: Bezugspunkt | null,
  stufe: UmkreisStufe = null
): MitEntfernung<H>[] {
  if (!punkt) return hoefe.map((hof) => ({ ...hof, entfernungKm: null }))

  const mitMass = hoefe.map((hof) => {
    // Number.isFinite statt bloßer null-Prüfung: latitude und longitude sind
    // unabhängig nullbar, und `double precision` kennt NaN/Infinity. Ein
    // einziger solcher Wert machte sonst die GANZE Sortierung unbrauchbar
    // (ein NaN-Vergleich liest sich für sort wie „gleich"). Unbrauchbare
    // Koordinaten zählen wie fehlende: ans Ende, nie ausgeschlossen.
    const brauchbar = Number.isFinite(hof.latitude) && Number.isFinite(hof.longitude)
    return {
      ...hof,
      entfernungKm: brauchbar
        ? entfernungKm(punkt, { lat: hof.latitude as number, lon: hof.longitude as number })
        : null,
    }
  })

  const imUmkreis =
    stufe === null
      ? mitMass
      : mitMass.filter((hof) => hof.entfernungKm === null || hof.entfernungKm <= stufe)

  return [...imUmkreis].sort((a, b) => {
    if (a.entfernungKm === null) return b.entfernungKm === null ? 0 : 1
    if (b.entfernungKm === null) return -1
    return a.entfernungKm - b.entfernungKm
  })
}
