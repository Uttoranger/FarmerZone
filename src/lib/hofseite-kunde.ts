/**
 * Die Hofseite für Kundinnen im neuen Design (Nachtlauf Nr. 10, Gate 4;
 * Mockups web-k2-hofseite, web-k2-alle-produkte-nach-kategorie,
 * mobil-k2-hofseite, mobil-k2-produkte) — was sie anbietet und wie sie es
 * nennt, rein und ohne Browser prüfbar (tests/hofseite-kunde.test.ts). Die
 * Komponenten in src/components/hofseite/ zeigen nur an.
 *
 * Kategorie-Abschnitte und Kartenzustand stehen bei den übrigen Regeln der
 * Kundenansicht in bereiche-anzeige.ts, Abholzeiten in pickup-days.ts, der
 * Gebührensatz in servicegebuehr.ts.
 */
import { formatEuro, formatZahl, mitAnzahl } from '@/lib/format'
import { kaufSperreHinweis, zeigeKaufknopf, type KaufSperre } from '@/lib/bereiche-anzeige'
import { calcLineTotal, decimalZuCents } from '@/lib/order-totals'
import { BAR_OHNE_GEBUEHR_HINWEIS } from '@/lib/konditionen'
import {
  barOhneServicegebuehr,
  centsAlsEuro,
  servicegebuehrSatz,
  type ServicegebuehrEinstellung,
} from '@/lib/servicegebuehr'
import { FARM_ARCHIVED_MESSAGE } from '@/lib/farm-archive'
import { FARM_NOT_APPROVED_MESSAGE } from '@/lib/farm-approval'
import { SHOP_PAUSED_MESSAGE } from '@/lib/shop-pause'
import { WARENKORB_ANKER } from '@/lib/warenkorb-speicher'
import { bereichAusParameter } from '@/schemas/hoefe-filter'
import {
  ALTER_REITER_BEITRAEGE,
  BEITRAG_PARAMETER,
  REITER_PARAMETER,
  leseHofReiter,
  type HofReiterAngebot,
  type HofReiterId,
} from '@/schemas/hofseite-reiter'

export type { HofReiterAngebot, HofReiterId }

// ─── Reiter ─────────────────────────────────────────────────────────────────

export type HofReiter = { id: HofReiterAngebot; label: string }

/**
 * So viele Beiträge zeigt die Hofseite höchstens (Register F8) — die neuesten.
 * Ältere sind kein Angebot mehr; „Aktuell vom Hof“ bliebe sonst eine Chronik.
 */
export const HOFSEITE_BEITRAEGE_MAX = 5

/**
 * Übersicht · Produkte (seit Nr. 128, Register F8): Die Beiträge stehen als
 * „Aktuell vom Hof“ oben in der Übersicht, einen Reiter „Beiträge“ gibt es
 * nicht mehr — die Leiste springt nicht mehr, je nachdem, ob ein Beitrag läuft.
 * Die Zahl im Reiter ist die Zahl dessen, was der Reiter dann zeigt.
 */
export function hofseiteReiter({ produktAnzahl }: { produktAnzahl: number }): HofReiter[] {
  return [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'produkte', label: produktAnzahl > 0 ? `Produkte · ${formatZahl(produktAnzahl)}` : 'Produkte' },
  ]
}

/**
 * Welcher Reiter offen ist. Ein gewählter Reiter aus der Adresse gilt, wenn
 * der Hof ihn anbietet; sonst öffnet `?bereich=futter` die Produkte — so
 * landen die Links von /hoefe und aus dem Umfeld beim Futter (der Sprung zum
 * Abschnitt folgt in der Seite). Alles andere: die Übersicht.
 */
export function aktiverReiter(
  suche: { reiter: string | null; bereich: string | null },
  angebot: readonly HofReiter[]
): HofReiterAngebot {
  const gewaehlt = leseHofReiter(suche.reiter)
  if (gewaehlt && angebot.some((r) => r.id === gewaehlt)) return gewaehlt
  if (bereichAusParameter(suche.bereich) === 'FUTTERMITTEL' && angebot.some((r) => r.id === 'produkte')) return 'produkte'
  return 'uebersicht'
}

/**
 * Die Adresse eines Reiters — die übrigen Parameter (Bereich, Nachbestell-
 * Link) bleiben, die Übersicht trägt keinen Reiter-Parameter. Der alte Reiter
 * „Beiträge“ bleibt als Ziel (Mein Hof › Beiträge): Er landet bei „Aktuell vom Hof“.
 */
export function reiterAdresse(pfad: string, suche: string, id: HofReiterId): string {
  const params = new URLSearchParams(suche)
  params.delete(REITER_PARAMETER)
  if (id !== 'uebersicht') params.set(REITER_PARAMETER, id)
  const query = params.toString()
  return query ? `${pfad}?${query}` : pfad
}

// ─── Übersicht: Produkte ────────────────────────────────────────────────────

/**
 * So viele Produkte zeigt die Übersicht ab lg, „Alle ansehen" führt zum Reiter
 * Produkte (Mockup web-k2-hofseite) — und ab md im Schaufenster, eine Reihe
 * aus drei Kacheln.
 */
export const UEBERSICHT_PRODUKTE = 3

/**
 * Das Schaufenster unter lg (Register N5, Nr. 51): Unter dem Kopf stehen
 * zuerst Fotostreifen und bis zu vier Produkte, dann „Alle Produkte (n)". Am
 * Handy sind es vier Zeilen.
 */
export const SCHAUFENSTER_PRODUKTE = 4

/**
 * Steht die Karte an Stelle `index` nur am Handy? Ab md fasst eine Reihe drei
 * Kacheln, ab lg gilt UEBERSICHT_PRODUKTE wie bisher. Entschieden wird über
 * Klassen (md:hidden), nie durch Messen im Browser: Server und Browser zeigen
 * dasselbe — kein Hydration-Unterschied, nach dem Laden springt nichts.
 */
export function stehtNurAmHandy(index: number): boolean {
  return index >= UEBERSICHT_PRODUKTE
}

/** Gibt es ein Schaufenster? Nur in der Übersicht und nur mit Produkten — ohne bleibt die Übersicht, wie sie war. */
export function zeigeSchaufenster(offen: HofReiterAngebot, produktAnzahl: number): boolean {
  return offen === 'uebersicht' && produktAnzahl > 0
}

/**
 * „Alle Produkte (9)" unter dem Schaufenster. Die Zahl ist dieselbe wie im
 * Reiter „Produkte · 9": alles, was der Reiter Produkte zeigt.
 */
export function alleProdukteText(anzahl: number): string {
  return `Alle Produkte (${formatZahl(anzahl)})`
}

/**
 * Die Produkte der Übersicht: zuerst, was man gerade kaufen kann, jeweils in
 * der Reihenfolge des Hofs; reicht das nicht, füllen die übrigen auf — eine
 * Übersicht voller „Ausverkauft" wäre ein schlechtes Schaufenster.
 */
export function uebersichtProdukte<P extends { isAvailable: boolean; stock: number }>(
  produkte: readonly P[],
  sperre: KaufSperre,
  anzahl: number = UEBERSICHT_PRODUKTE
): P[] {
  const kaufbar = produkte.filter((p) => zeigeKaufknopf(p, sperre))
  const rest = produkte.filter((p) => !zeigeKaufknopf(p, sperre))
  return [...kaufbar, ...rest].slice(0, anzahl)
}

/** „10 verfügbar" — wie viele man gerade in den Korb legen kann; mit Kaufsperre (N24) keins. */
export function verfuegbarText(produkte: readonly { isAvailable: boolean; stock: number }[], sperre: KaufSperre): string | null {
  const n = produkte.filter((p) => zeigeKaufknopf(p, sperre)).length
  return n > 0 ? `${formatZahl(n)} verfügbar` : null
}

// ─── Über uns ───────────────────────────────────────────────────────────────

/**
 * Was Kundinnen unter „Über uns" lesen — EINE Regel für die Hofseite
 * (components/hofseite/hofseite-kunde.tsx) und die Checkliste von Mein Hof
 * (hofseite-fortschritt.ts, seit Nr. 49): der eigene Text ohne Ränder; ist er
 * leer oder nur Leerraum, die Kurzbeschreibung; ist auch die leer, null.
 * Vorher prüfte die Checkliste nur den eigenen Text und meldete „Fehlt",
 * obwohl Kundinnen die Kurzbeschreibung lasen.
 */
export function ueberUnsText(hof: { aboutText: string | null; description: string }): string | null {
  const eigener = (hof.aboutText ?? '').trim()
  if (eigener) return eigener
  return hof.description.trim() || null
}

// ─── Käufer-Vorschau im Produktdialog (Nr. 51) ──────────────────────────────

/**
 * Was die Produktkarte in der Vorschau zeigt („So sehen Käufer dein
 * Produkt"): Foto, Name, Preis, Einheit — ohne Link, ohne Korb. Entsteht aus
 * den Formularwerten (kaeuferVorschau in components/products/produkt-preis.ts).
 */
export type KartenVorschau = {
  name: string
  imageUrl: string | null
  categoryImageUrl: string | null
  /** null: Das Preisfeld ist leer oder ungültig — die Karte zeigt dann KAEUFER_VORSCHAU.preisFehlt. */
  price: number | null
  unit: string
  unitSize: number | null
}

/** Überschrift und ruhige Platzhalter der Käufer-Vorschau — leere Felder zeigen nie „NaN" oder „€ 0,00". */
export const KAEUFER_VORSCHAU = {
  titel: 'So sehen Kunden dein Produkt',
  name: 'Dein Produkt',
  preisFehlt: 'Preis fehlt noch',
} as const

// ─── Zahlung (E5) ───────────────────────────────────────────────────────────

export type Zahlungsart = { art: 'online' | 'bar'; text: string }

/**
 * Wie man bei diesem Hof bezahlt. Online nur mit fertigem Stripe-Konto —
 * dieselbe Bedingung wie der Checkout (checkout-form.tsx, /api/checkout).
 * Vor Ort heißt seit E5 nur noch „Bar bei Abholung": Das Preismodell kennt
 * keine Kartenzahlung am Hof; ONSITE_CARD bleibt im Enum, bis keine offene
 * Bestellung ihn mehr trägt, wird aber nicht mehr beworben.
 */
export function zahlungsarten(hof: { acceptsOnline: boolean; stripeAccountReady: boolean; acceptsOnsite: boolean }): Zahlungsart[] {
  return [
    ...(hof.acceptsOnline && hof.stripeAccountReady ? [{ art: 'online' as const, text: 'Online bezahlen' }] : []),
    ...(hof.acceptsOnsite ? [{ art: 'bar' as const, text: 'Bar bei Abholung' }] : []),
  ]
}

// ─── Kontaktdaten des Hofs (Nr. 60) ─────────────────────────────────────────

/**
 * Steht in „Zahlung & Kontakt" an Stelle der Telefonnummer (Mockups
 * web/mobil-k2-hofseite-ohne-telefon). Telefon und E-Mail des Hofs bekommt
 * die Kundin mit der Bestellung: in der Kasse vor dem Kaufknopf, auf
 * Bestätigung und Bestellseite („Hof erreichen") und in der Bestätigungsmail.
 */
export const KONTAKT_NACH_DEM_KAUF = 'Fragen zu deiner Bestellung? Die Telefonnummer des Hofs steht in deiner Bestellbestätigung.'

/**
 * Der Hof ohne Telefon und E-Mail — für die Hofseite, BEVOR er an die
 * Client-Komponente geht: Was dort ankommt, steht in den Seitendaten, auch
 * wenn nichts es zeigt. Die Abfrage (getPublicFarm) behält beide, weil die
 * Kasse sie vor dem Kaufknopf nennt.
 */
export function entferneKontaktdaten<T extends { phone: string; email: string }>(hof: T): Omit<T, 'phone' | 'email'> {
  const ohne: Partial<T> = { ...hof }
  delete ohne.phone
  delete ohne.email
  return ohne as Omit<T, 'phone' | 'email'>
}

// ─── Servicegebühr (E4) ─────────────────────────────────────────────────────

/**
 * Die drei Wortlaute des Gebührenhinweises: in „Zahlung & Kontakt", über den
 * Produkten und im Mini-Warenkorb. Satz und Mindestgebühr kommen aus der
 * Hofeinstellung (servicegebuehrSatz); ohne Satz kein Hinweis. Nie in den
 * Produktpreis eingerechnet (DESIGN_SYSTEM, „Kaufstrecke"). Mit `zahlung`
 * ehrlich zu Register B1 (bar vor dem SEPA-Start ohne Gebühr); Seiten rufen
 * `gebuehrHinweisFuerHof`.
 */
export function gebuehrHinweis(
  satz: { prozent: number; mindestCents: number } | null,
  zahlung: GebuehrZahlung = OHNE_BAR_AUSNAHME
): { kurz: string; produkte: string; korb: string } | null {
  if (!satz) return null
  // Register B1: Bar kostet bis zum SEPA-Start nichts. Bietet der Hof dann nur
  // bar an, fällt gar keine Gebühr an — kein Hinweis auf etwas, das nicht kommt.
  if (zahlung.barOhneGebuehr && !zahlung.online) return null
  // Ohne Mindestgebühr kein „(mind. € 0,00)" — eine Untergrenze von null ist keine.
  const mindestens = satz.mindestCents > 0 ? ` (mind. ${formatEuro(centsAlsEuro(satz.mindestCents))})` : ''
  const grund = `Preise zzgl. ${formatZahl(satz.prozent)} % Servicegebühr${mindestens}`
  // Online UND bar vor dem Stichtag: die Ausnahme dazusagen, Satz aus konditionen.ts.
  const barAusnahme = zahlung.barOhneGebuehr && zahlung.bar
  const zusatz = barAusnahme ? ` ${BAR_OHNE_GEBUEHR_HINWEIS}` : ''
  return {
    kurz: `${grund} – im Warenkorb einzeln ausgewiesen. Der Hof bekommt den vollen Preis.${zusatz}`,
    produkte: `${grund} – einmal pro Bestellung, egal wie viel du in den Warenkorb legst.${zusatz}`,
    korb: barAusnahme ? GEBUEHR_KORB_NUR_ONLINE : 'zzgl. Servicegebühr',
  }
}

/** Neben der Korbsumme, solange bar keine Gebühr kostet (B1) — kurz, weil der Platz dort knapp ist. */
export const GEBUEHR_KORB_NUR_ONLINE = 'zzgl. Servicegebühr bei Online-Zahlung'

/** Welche Zahlarten der Hof anbietet und ob bar gerade ohne Gebühr ist (B1). */
export type GebuehrZahlung = { online: boolean; bar: boolean; barOhneGebuehr: boolean }

/** Ohne Angabe: der Hinweis wie vor B1 (Satz gilt für jede Zahlart). */
const OHNE_BAR_AUSNAHME: GebuehrZahlung = { online: true, bar: false, barOhneGebuehr: false }

/**
 * Der Gebührenhinweis für einen Hof, so wie Hofseite, Produktseite und
 * Mini-Warenkorb ihn zeigen: Satz aus der Hofeinstellung (Online-Zahlung),
 * Zahlarten aus derselben Regel wie die Kasse (`zahlungsarten`), die
 * Bar-Ausnahme nach `barOhneServicegebuehr`. `jetzt` kommt von der Seite
 * (Server-Uhr, als ISO-Text durchgereicht) — nie aus der Browser-Uhr beim Rendern.
 */
export function gebuehrHinweisFuerHof(
  hof: ServicegebuehrEinstellung & { acceptsOnline: boolean; stripeAccountReady: boolean; acceptsOnsite: boolean },
  jetzt: Date
): { kurz: string; produkte: string; korb: string } | null {
  const arten = zahlungsarten(hof)
  return gebuehrHinweis(servicegebuehrSatz(hof, jetzt), {
    online: arten.some((a) => a.art === 'online'),
    bar: arten.some((a) => a.art === 'bar'),
    barOhneGebuehr: barOhneServicegebuehr('ONSITE_CASH', jetzt),
  })
}

// ─── Mini-Warenkorb und Mengen ──────────────────────────────────────────────

/**
 * Zeilen und Summe des Korbs in ganzen Cent — auf demselben Weg wie der
 * Checkout (calcLineTotal → decimalZuCents, CODING_STANDARDS §2), nie als
 * `price * quantity` in Fließkomma: 3 × 1,10 € wären dort 3,3000000000000003 €.
 * Nur Anzeige; verbindlich rechnet der Server mit den Preisen der Datenbank.
 */
export function korbBetraege(
  positionen: readonly { productId: string; price: number; quantity: number }[]
): { zeilenCents: Map<string, number>; summeCents: number } {
  const zeilenCents = new Map<string, number>()
  let summeCents = 0
  for (const p of positionen) {
    const cents = decimalZuCents(calcLineTotal(p.price, p.quantity))
    zeilenCents.set(p.productId, cents)
    summeCents += cents
  }
  return { zeilenCents, summeCents }
}

/**
 * Bis wohin „+" im Mengen-Stepper der Produktkarte geht: der Bestand, an dem
 * auch „knapp" und „ausverkauft" hängen (kartenZustand). Liegt schon mehr im
 * Korb, als noch da ist (der Hof hat nachgezählt), bleibt die Korbmenge die
 * Grenze — „−" geht, „+" nicht. Verbindlich prüft /api/reserve.
 */
export function stepperObergrenze(bestand: number, imKorb: number): number {
  return Math.max(bestand, imKorb)
}

const MENGE_NICHT_GEAENDERT = 'Wir konnten die Menge nicht ändern. Versuch es gleich noch einmal.'
// Die Titel der Kaufsperre schickt /api/reserve bei 409 (Nr. 145) — aus kaufSperreHinweis, nie als eigenes
// Literal; der Hofname steht nur im Satz, nicht im Titel.
const VERSTAENDLICH = new Set<string>([
  SHOP_PAUSED_MESSAGE,
  FARM_ARCHIVED_MESSAGE,
  FARM_NOT_APPROVED_MESSAGE,
  kaufSperreHinweis('keine-abholzeit', '').titel,
  kaufSperreHinweis('ausgebucht', '').titel,
])

/**
 * Was die Kundin liest, wenn /api/reserve eine neue Menge ablehnt — statt
 * Stille. „Nur noch N verfügbar" und die Sätze zu Pause/Stilllegung sind
 * verständlich und bleiben; Fachwörter („Ungültige Parameter") nicht.
 */
export function mengeAbgelehntText(fehler: string | undefined): string {
  if (fehler && /^Nur noch \d+ verfügbar$/.test(fehler)) return `${fehler} – mehr hat der Hof gerade nicht.`
  if (fehler && VERSTAENDLICH.has(fehler)) return fehler
  return MENGE_NICHT_GEAENDERT
}

// ─── Beiträge ───────────────────────────────────────────────────────────────

/**
 * Wie lange ein Beitrag her ist — „heute", „vor 3 Stunden", „vor 2 Tagen".
 * Gerechnet vom übergebenen Zeitpunkt, den page.tsx einmal auf dem Server
 * bestimmt: Mit der Uhr beim Rendern wichen Server und Browser voneinander ab
 * (Hydration-Fehler).
 */
export function vorWieLange(iso: string, jetztIso: string): string {
  const stunden = Math.floor((new Date(jetztIso).getTime() - new Date(iso).getTime()) / (1000 * 60 * 60))
  if (stunden < 1) return 'heute'
  if (stunden < 24) return stunden === 1 ? 'vor 1 Stunde' : `vor ${stunden} Stunden`
  const tage = Math.floor(stunden / 24)
  return tage === 1 ? 'vor 1 Tag' : `vor ${tage} Tagen`
}

/**
 * Die Zeit über einer Beitragskarte (Register F8): Der neueste Beitrag heißt
 * „Aktuell · vor 2 Stunden“, die weiteren nur „vor 3 Tagen“ — „Aktuell“ steht
 * nie an zwei Karten. Auch ein geteilter Beitrag trägt die normale Zeit, kein
 * „Geteilt · …“ (Freigabe §1, Abweichung 1).
 */
export function beitragZeitText(istNeuester: boolean, veroeffentlichtIso: string, jetztIso: string): string {
  const her = vorWieLange(veroeffentlichtIso, jetztIso)
  return istNeuester ? `Aktuell · ${her}` : her
}

// ─── Aktuell vom Hof (Register F8, N5, T5; Nr. 128) ─────────────────────────

/**
 * Die Wörter des Abschnitts „Aktuell vom Hof“ — EINE Quelle für die
 * Komponente (components/hofseite/aktuell-vom-hof.tsx) und die Tests. „Aktuell
 * vom Hof“ ist das Wort für die Kundschaft, für den Hof heißt es „Beitrag“
 * (Wortliste).
 */
export const AKTUELL_VOM_HOF_TEXT = {
  titel: 'Aktuell vom Hof',
  anzahl: (n: number): string => mitAnzahl(n, 'Beitrag', 'Beiträge'),
  weiterlesen: 'Weiterlesen',
  weniger: 'Weniger anzeigen',
  dazu: 'Dazu im Hofladen',
  produktAnzahl: (n: number): string => ` · ${mitAnzahl(n, 'Produkt', 'Produkte')}`,
  derzeitAus: 'derzeit aus',
  inDenKorb: (name: string): string => `${name} in den Korb`,
  neuester: 'Neuester:',
  /** Steht über dem Abschnitt, wenn `?beitrag=` keinen aktiven Beitrag dieses Hofs trifft — ohne Auskunft, ob es ihn gab. */
  nichtMehrAktuell: 'Dieser Beitrag ist nicht mehr aktuell.',
} as const

/** Die Kennung des Abschnitts — Ziel alter Links (`?reiter=beitraege`). */
export const AKTUELL_ANKER = 'aktuell'

/** So viele verknüpfte Produkte stehen höchstens unter einem Beitrag („Dazu im Hofladen“). */
export const AKTUELL_PRODUKTE_MAX = 3

/** Wie „Aktuell vom Hof“ die Beiträge zeigt: einer als Karte, darunter Zeilen. */
export type BeitragsAnordnung<B> = {
  /** Oben als Karte: der Beitrag aus `?beitrag=`, sonst der neueste. */
  karte: B
  /** Trägt die Karte „Aktuell“? Nur der neueste (Register F8). */
  karteIstNeuester: boolean
  /** Die Zeile „Neuester: <Titel> ›“ — nur, wenn die Karte nicht selbst der neueste ist. */
  neuester: B | null
  /** Die übrigen als Zeilen, die an Ort und Stelle aufklappen, der neuere zuerst. */
  zeilen: B[]
  /** Wie viele Beiträge der Abschnitt zeigt — nie mehr als HOFSEITE_BEITRAEGE_MAX. */
  anzahl: number
}

/**
 * Ordnet die aktiven Beiträge für „Aktuell vom Hof“. `beitraege` kommt von
 * page.tsx: die fünf neuesten, der neueste zuerst, und — wenn `?beitrag=` einen
 * älteren aktiven Beitrag dieses Hofs trifft — dieser dahinter. `kennung` ist
 * der geprüfte Wert aus der Adresse (leseBeitragKennung).
 *
 * Trifft die Kennung, steht dieser Beitrag oben, „Aktuell“ trägt trotzdem nur
 * der neueste, und darunter steht „Neuester: …“. Trifft sie nicht (abgelaufen,
 * gelöscht, anderer Hof, unbekannt), zeigt die Übersicht alles wie ohne
 * Kennung und sagt nur, dass der Beitrag nicht mehr aktuell ist. Zusammen
 * stehen nie mehr als fünf Beiträge da.
 *
 * Scheiterte das Laden der Beiträge (`beitraegeFehler`, Nr. 134), weiß die Seite
 * nichts über den Beitrag aus der Adresse — er kann aktiv sein. Dann entfällt
 * der Satz, und die Übersicht zeigt sich wie ohne Beiträge.
 */
export function ordneBeitraege<B extends { id: string }>(
  beitraege: readonly B[],
  kennung: string | null,
  beitraegeFehler = false
): { anordnung: BeitragsAnordnung<B> | null; nichtMehrAktuell: boolean } {
  const geteilt = kennung === null ? undefined : beitraege.find((b) => b.id === kennung)
  const nichtMehrAktuell = !beitraegeFehler && kennung !== null && geteilt === undefined
  const [neuester] = beitraege
  if (neuester === undefined) return { anordnung: null, nichtMehrAktuell }
  const karte = geteilt ?? neuester
  const karteIstNeuester = karte === neuester
  // Karte und „Neuester“ zählen mit: zusammen nie mehr als fünf.
  const oben = karteIstNeuester ? 1 : 2
  const zeilen = beitraege.filter((b) => b !== karte && b !== neuester).slice(0, HOFSEITE_BEITRAEGE_MAX - oben)
  return {
    anordnung: { karte, karteIstNeuester, neuester: karteIstNeuester ? null : neuester, zeilen, anzahl: oben + zeilen.length },
    nichtMehrAktuell,
  }
}

/**
 * „Dazu im Hofladen“ (Board §6, Freigabe §1 Abweichung 4): die verknüpften
 * Produkte eines Beitrags, höchstens drei — kaufbare zuerst, je in der
 * Reihenfolge von `linkedProductIds`, danach ausverkaufte (gedimmt, ohne „+“).
 *
 * `produkte` ist die Produktliste der Hofseite (farm.products im Shop) — dieselbe
 * Regel, keine zweite: Was die Liste nicht zeigt (nicht im Shop, gelöscht, ein
 * anderer Hof), fällt weg. Zurück kommen die Produkte der Liste selbst, damit
 * das „+“ denselben Gegenstand in den Korb legt wie die Produktkarte.
 * Ausverkauft heißt wie an der Karte: ohne Vorrat (zeigeKaufknopf ohne Pause —
 * die Pause nimmt nur das „+“ weg, sie macht nichts „derzeit aus“).
 */
export function beitragProdukte<P extends { id: string; isAvailable: boolean; stock: number }>(
  linkedProductIds: readonly string[],
  produkte: readonly P[]
): { produkt: P; ausverkauft: boolean }[] {
  const nachId = new Map(produkte.map((p) => [p.id, p]))
  const verknuepft = linkedProductIds.flatMap((id) => {
    const produkt = nachId.get(id)
    return produkt ? [{ produkt, ausverkauft: !zeigeKaufknopf(produkt, null) }] : []
  })
  return [...verknuepft.filter((z) => !z.ausverkauft), ...verknuepft.filter((z) => z.ausverkauft)].slice(0, AKTUELL_PRODUKTE_MAX)
}

/**
 * Ein alter Link mit `?reiter=beitraege` (bis Nr. 128 der Reiter „Beiträge“)
 * springt zu „Aktuell vom Hof“ — aber nur, wenn der Abschnitt da ist; ohne
 * aktiven Beitrag bleibt die Seite oben.
 */
export function springeZuAktuell(reiterRoh: string | null, abschnittDa: boolean): boolean {
  return reiterRoh === ALTER_REITER_BEITRAEGE && abschnittDa
}

/** Wie gesprungen wird: mit `prefers-reduced-motion` ohne Animation. */
export function scrollVerhalten(reduzierteBewegung: boolean): ScrollBehavior {
  return reduzierteBewegung ? 'auto' : 'smooth'
}

/**
 * „Neuester: …“ — dieselbe Seite ohne `?beitrag=`: Dann steht der neueste oben.
 * Die übrigen Parameter (Vorschau, Bereich) bleiben.
 */
export function adresseOhneBeitrag(pfad: string, suche: string): string {
  const params = new URLSearchParams(suche)
  params.delete(BEITRAG_PARAMETER)
  const query = params.toString()
  return query ? `${pfad}?${query}` : pfad
}

// ─── Warenkorb-Anker ────────────────────────────────────────────────────────

/**
 * Führt ein Link genau zu DIESER Hofseite mit #warenkorb? Dann öffnet die
 * Seite den Korb, statt zu navigieren: Der Warenkorb der Shell (Kopf und
 * Mittelknopf) zeigt auf `/{hof}#warenkorb`, und ein Link auf die eigene
 * Seite mit Anker lädt nichts neu — der Anker allein öffnete nichts.
 */
export function oeffnetKorbHier(href: string, aktuell: string): boolean {
  const hier = new URL(aktuell)
  const ziel = new URL(href, hier)
  return ziel.origin === hier.origin && ziel.pathname === hier.pathname && ziel.hash === `#${WARENKORB_ANKER}`
}
