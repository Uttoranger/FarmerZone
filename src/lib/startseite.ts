/**
 * Was die Startseite zeigt und wohin sie führt — EINE Konfiguration, rein und
 * ohne Browser prüfbar (tests/startseite.test.ts). Die Abschnitte unter
 * src/components/startseite/ zeichnen nur.
 *
 * Mockups: docs/mockups/web-k0-startseite.html, mobil-k0-startseite.html.
 *
 * Jeder Link auf die Hofübersicht entsteht über schreibeHoefeFilter — so
 * landet ein Chip genau dort, wo /hoefe den Filter liest (bereich, kat,
 * gebinde, ansicht). Ein Standort steht NIE in einer dieser Adressen
 * (ARCHITECTURE §4, „Nie Standort/Koordinaten in die URL").
 */
import type { ProductCategoryValue } from '@/schemas/product'
import { MARKE } from '@/lib/marke'
import { LEERER_HOEFE_FILTER, schreibeHoefeFilter, type HoefeFilter } from '@/schemas/hoefe-filter'
import { KATEGORIE_LABEL } from '@/lib/taxonomie'
import {
  ABHOLZEILE_TEXT,
  VORSCHAU_ZEILEN,
  formatiereAbholung,
  waehleVorschauProdukte,
  type NaechsteAbholung,
  type NeuerBeitrag,
  type VorschauProdukt,
} from '@/lib/hofuebersicht'
import {
  SERVICEGEBUEHR_STANDARD_MIND_CENTS,
  SERVICEGEBUEHR_STANDARD_PROZENT,
  berechneServicegebuehr,
  centsAlsEuro,
  barOhneServicegebuehr,
} from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { BAR_OHNE_GEBUEHR_HINWEIS, PLATTFORMGEBUEHR_BEZEICHNUNG, PLATTFORMGEBUEHR_PROZENT, mitBarAusnahme } from '@/lib/konditionen'
import { bestellGebuehr, satzHundertstel, satzText, type GebuehrModell } from '@/lib/plattformgebuehr'
import { gruppenBeschriftung, type PinPunkt } from '@/lib/hoefe-anzeige'
import { liegtImAusschnitt, type GeoPunkt } from '@/lib/regionskarte'

/** Eine Adresse der Hofübersicht mit genau diesen Filtern; ohne Filter die nackte /hoefe. */
export function hoefeAdresse(teil: Partial<HoefeFilter> = {}): string {
  const query = schreibeHoefeFilter({ ...LEERER_HOEFE_FILTER, ...teil })
  return query ? `/hoefe?${query}` : '/hoefe'
}

// ─── „Oder direkt suchen" ───────────────────────────────────────────────────

export type SuchChip = { label: string; filter: Partial<HoefeFilter> }

/**
 * Die Chips unter „Höfe in deiner Nähe", Wortlaut aus dem Mockup. Futtermittel
 * ist ein Chip in derselben Reihe (E2) und öffnet den Bereich Futtermittel;
 * Brennmaterial ist die Kategorie BRENNHOLZ im Hofladen (E11) — der Chip
 * steht das ganze Jahr, nur das Werbeband hat Saison.
 */
export const STARTSEITE_CHIPS: readonly SuchChip[] = [
  { label: 'Eier', filter: { kategorien: ['EIER'] } },
  { label: 'Gemüse & Obst', filter: { kategorien: ['GEMUESE', 'OBST'] } },
  { label: 'Fleisch', filter: { kategorien: ['FLEISCH'] } },
  { label: 'Milch & Käse', filter: { kategorien: ['MILCH'] } },
  { label: 'Brot', filter: { kategorien: ['BROT'] } },
  { label: 'Honig', filter: { kategorien: ['HONIG'] } },
  { label: 'Futtermittel', filter: { bereich: 'FUTTERMITTEL' } },
  { label: KATEGORIE_LABEL.BRENNHOLZ, filter: { kategorien: ['BRENNHOLZ'] } },
]

/** Die Karte im Kopf und „Alle Höfe auf der Karte" führen hierhin. */
export const KARTE_ADRESSE = hoefeAdresse({ ansicht: 'karte' })

/** Der Knopf unter der Karte am Handy (Mockup mobil-k0-startseite-karte-region). */
export const KARTE_KNOPF = 'Alle Höfe auf der Karte'

/** Die Überschrift des Abschnitts mit der Karte am Handy (dasselbe Mockup); im Browser steht die Karte ohne sie im Kopf. */
export const KARTE_UEBERSCHRIFT = 'Höfe in deiner Region'

/** Die Pille unten rechts auf der Karte im Browser (Mockup web-k0-startseite-karte-region). */
export const KARTE_OEFFNEN = 'Karte öffnen'

/** „Brennmaterial finden" im Saisonband. */
export const BRENNMATERIAL_ADRESSE = hoefeAdresse({ kategorien: ['BRENNHOLZ'] })

// ─── Futter und Brennmaterial: zwei kurze Karten ────────────────────────────

/** Eine kurze Karte unter den Höfen (Board w1-/s1-startseite, Bild 2 und 3): Überzeile, ein Satz, ein Textlink. */
export type KurzKarte = {
  /** Die leise Überzeile — sie ist die Überschrift des Abschnitts (h2). */
  ueberzeile: string
  satz: string
  link: string
  adresse: string
}

/**
 * „Futter vom Hof" kurz wie im Board: ein Satz und der Weg in den Bereich
 * Futtermittel. Die zwei Zielgruppen (Kleinmengen, Ballen) stehen seit Nr. 234
 * nicht mehr auf der Startseite — die Mengen-Facette bietet /hoefe selbst an.
 */
export const FUTTER_KARTE: KurzKarte = {
  ueberzeile: 'Futter vom Hof',
  satz: 'Heu, Stroh und Futter – vom Sackerl bis zum Rundballen',
  link: 'Futter in deiner Nähe',
  adresse: hoefeAdresse({ bereich: 'FUTTERMITTEL' }),
}

/** „Brennmaterial vom Hof" kurz wie im Board; die Saison-Automatik der Liste bleibt (istBrennmaterialSaison). */
export const BRENNMATERIAL_KARTE: KurzKarte = {
  ueberzeile: 'Brennmaterial vom Hof',
  satz: 'Brennholz und Hackschnitzel aus dem eigenen Wald',
  link: 'Brennmaterial in deiner Nähe',
  adresse: BRENNMATERIAL_ADRESSE,
}

// ─── Höfe in deiner Nähe ────────────────────────────────────────────────────

/** So viele Höfe zeigt die Startseite — eine Reihe aus drei Karten im Browser (Board w1-startseite, Bild 1 und 2). */
export const STARTSEITE_HOEFE_DECKEL = 3

/** So viele Kategorien stehen in der Angebotszeile einer Karte. */
export const ANGEBOT_DECKEL = 4

/** Was die Auswahl von einem Hof der Übersicht braucht (HofUebersichtEintrag aus queries/farm.ts). */
export type StartseitenHofEingabe = {
  slug: string
  name: string
  postalCode: string
  city: string
  isPaused: boolean
  kategorien: readonly ProductCategoryValue[]
  naechsteAbholung: NaechsteAbholung | null
  fotos: readonly string[]
  latitude: number | null
  longitude: number | null
  /** Abzeichen „Gründungshof“ (Register K2, Nr. 116) — nur Ja/Nein; fehlt es, ohne Abzeichen. */
  gruendungshof?: boolean
  /** Der neueste aktive Beitrag, höchstens 7 Tage alt (Register N22, Nr. 129) — aus derselben Liste, keine zweite Abfrage. */
  neuerBeitrag?: NeuerBeitrag | null
  /** Die Produktvorschau der Hofliste (in der Reihenfolge der Hofseite) — daraus die drei Preise der Karte (Nr. 234). */
  produkte?: readonly VorschauProdukt[]
}

/** Eine Karte unter „Höfe in deiner Nähe" — fertig zum Zeichnen, ohne Decimal und Date. */
export type StartseitenHof = {
  slug: string
  name: string
  /** „4910 Ried im Innkreis" — PLZ und Ort, nie die Straße. */
  ort: string
  /** „Heute 15:00–18:00", „Macht gerade Pause" — null ohne Abholzeiten. */
  abholung: string | null
  /** Ob die Zeile Abholung ein Termin ist (grün) oder ein Hinweis. */
  abholungIstTermin: boolean
  /** „Eier · Brot · Gemüse" — leer, wenn nichts kaufbar ist. */
  angebot: string
  /** Das erste Foto des Fotostreifens (Titelbild zuerst), sonst null. */
  foto: string | null
  /** Wo der Hof liegt — null ohne Koordinaten (dann kein Pin auf der Karte). */
  lage: GeoPunkt | null
  /** Abzeichen „Gründungshof“ über dem Namen (Nr. 116) — fehlt es (Platzhalter im Admin), ohne Abzeichen. */
  gruendungshof?: boolean
  /** Für die Marke „Neu · vor …“ am Bild (BeitragMarke, Register N22) — fehlt es (Admin), ohne Marke. */
  neuerBeitrag?: NeuerBeitrag | null
  /** Pausiert: die Karte ausgegraut und gestrichelt (V18, HofkarteRahmen) — fehlt es (Admin), offen. */
  pausiert?: boolean
  /**
   * Bis zu drei verfügbare Produkte (VORSCHAU_ZEILEN, Auswahl wie auf /hoefe) für die Zeilen
   * „Name … Preis" (ProduktKurzliste) — fehlt es (Admin), ohne Zeilen. Nur Zahlen und Texte.
   */
  produkte?: VorschauProdukt[]
}

/** Die Lage aus der Liste: nur mit beiden Koordinaten. */
function leseLage(hof: StartseitenHofEingabe): GeoPunkt | null {
  return hof.latitude === null || hof.longitude === null ? null : { lat: hof.latitude, lon: hof.longitude }
}

/** Erst die Höfe, bei denen man gerade bestellen kann, pausierte ans Ende — die Reihenfolge der Liste bleibt sonst. */
function ordneOffeneZuerst(hoefe: readonly StartseitenHofEingabe[]): StartseitenHofEingabe[] {
  return [...hoefe.filter((h) => !h.isPaused), ...hoefe.filter((h) => h.isPaused)]
}

/**
 * Die drei Produkte einer Hofkarte der Startseite (Nacharbeit 226): dieselbe Auswahl wie die
 * Hofkarte auf /hoefe (waehleVorschauProdukte — verfügbare zuerst, in der Reihenfolge der
 * Hofseite), davon nur verfügbare: Ohne Suche gibt es keinen Grund, „derzeit aus" zu zeigen.
 * Gerechnet wird nichts — der Preis kommt aus der Hofliste (im Hofpreis-Modell der Endpreis).
 */
function startseitenProdukte(hof: StartseitenHofEingabe): VorschauProdukt[] {
  return waehleVorschauProdukte([...(hof.produkte ?? [])], [], undefined, VORSCHAU_ZEILEN).produkte.filter((p) => p.verfuegbar)
}

function bereiteStartseitenHof(hof: StartseitenHofEingabe): StartseitenHof {
  return {
    slug: hof.slug,
    name: hof.name,
    ort: `${hof.postalCode} ${hof.city}`.trim(),
    // Derselbe Pause-Satz wie die Abholzeile auf /hoefe (Board w1-startseite, Bild 2).
    abholung: hof.isPaused
      ? ABHOLZEILE_TEXT.pause
      : hof.naechsteAbholung
        ? formatiereAbholung(hof.naechsteAbholung)
        : null,
    abholungIstTermin: !hof.isPaused && hof.naechsteAbholung !== null,
    angebot: hof.kategorien
      .slice(0, ANGEBOT_DECKEL)
      .map((k) => KATEGORIE_LABEL[k])
      .join(' · '),
    foto: hof.fotos[0] ?? null,
    lage: leseLage(hof),
    gruendungshof: hof.gruendungshof === true,
    neuerBeitrag: hof.neuerBeitrag ?? null,
    pausiert: hof.isPaused,
    produkte: startseitenProdukte(hof),
  }
}

/**
 * Der Leerzustand der Hofkarten (Board w1-/s1-startseite, Bild 5) — Textquelle des EmptyState
 * (DESIGN_SYSTEM, „Leerzustände"), auch für /hoefe ohne einen einzigen Hof. Der Ausweg führt zur
 * Seite für Höfe statt gleich in die Registrierung: Wer hier landet, ist meist Kundin und erzählt
 * einem Hof davon.
 */
export const HOEFE_LEER = {
  titel: 'Die ersten Höfe kommen gerade dazu',
  satz: `Schau bald wieder vorbei – oder erzähl einem Hof von ${MARKE}.`,
  knopf: 'Für Höfe',
  adresse: '/fuer-hoefe',
} as const

/** Die sichtbare Beschriftung des Suchfelds im Kopf und sein Platzhalter (A1, Board w1-/s1-startseite, Bild 1). */
export const SUCHE_BESCHRIFTUNG = 'Hof oder Produkt'
export const SUCHE_PLATZHALTER = 'z. B. Eier oder Heu'

/** Wo der Browser merkt, dass die Person das Startvideo angehalten hat (nur „pause" wird gespeichert). */
export const HERO_VIDEO_SCHLUESSEL = 'fz-startvideo'

/**
 * Läuft das Startvideo? Nicht, wenn die Person es angehalten hat oder der
 * Datensparmodus an ist (`navigator.connection.saveData`) — dort lädt es nie.
 * „Bewegung reduzieren" regelt die Seite selbst (Quelle mit media-Bedingung).
 */
export function heroVideoSpielt({ gespeichert, sparmodus }: { gespeichert: string | null; sparmodus: boolean }): boolean {
  return !sparmodus && gespeichert !== 'pause'
}

/**
 * Die Überschrift der Hofkarten auf der Startseite. Die Seite kennt keinen
 * Standort (er bleibt im Browser, erst /hoefe fragt danach) — „in deiner Nähe"
 * wäre ein Versprechen ohne Grundlage. Mit Standort bleibt es auf /hoefe.
 */
export const STARTSEITE_HOEFE_TITEL = 'Höfe aus der Region'

/**
 * Die Höfe der Startseite. Einen Standort kennt die Seite nicht (er bleibt im
 * Browser, und erst /hoefe fragt danach) — deshalb die Reihenfolge der
 * Übersicht ohne Bezugspunkt (Freischaltung, die ältesten zuerst), pausierte
 * Höfe ans Ende: Wer zum ersten Mal kommt, soll zuerst Höfe sehen, bei denen
 * man gerade bestellen kann.
 */
export function waehleStartseitenHoefe(
  hoefe: readonly StartseitenHofEingabe[],
  deckel: number = STARTSEITE_HOEFE_DECKEL
): StartseitenHof[] {
  return ordneOffeneZuerst(hoefe).slice(0, Math.max(0, deckel)).map(bereiteStartseitenHof)
}

// ─── Karte der Region (Nr. 59) ──────────────────────────────────────────────

/** So viele Kategorien nennt die Hofkarte auf der Karte (Mockup: „Mattighofen · Gemüse · Eier"). */
export const KARTENHOF_KATEGORIEN = 2

/** Die Hofkarte auf der Karte — Text im Link, ohne Bild. */
export type KartenHofkarte = Pick<StartseitenHof, 'slug' | 'name' | 'abholung' | 'abholungIstTermin'> & {
  /** „Mattighofen · Gemüse · Eier" — Ort und bis zu zwei Kategorien. */
  zeile: string
}

export type StartseitenKarte = {
  /** Die Höfe der Liste, die im Ausschnitt liegen — so viele zählt der Zähler. */
  pins: PinPunkt[]
  hervorgehoben: KartenHofkarte | null
}

/**
 * Was die Karte der Region zeigt — aus DERSELBEN Liste wie die Hofkarten
 * darunter (keine zweite Abfrage). Auf der Karte stehen die Höfe mit
 * Koordinaten im Ausschnitt, pausierte mit: Sie stehen auch in der Liste.
 * Höfe ohne Koordinaten oder außerhalb fehlen auf der Karte und zählen nicht
 * — der Zähler nennt genau die Höfe, die die Karte zeigt.
 *
 * Hervorgehoben wird der zuletzt freigeschaltete Hof mit Foto (die Liste kommt
 * nach Freischaltung, die ältesten zuerst), sonst der erste in der Reihenfolge
 * der Hofkarten. Ein pausierter Hof wird nur hervorgehoben, wenn alle
 * pausieren: Die Karte soll einen Hof zeigen, bei dem man bestellen kann.
 */
export function waehleKartenHoefe(hoefe: readonly StartseitenHofEingabe[]): StartseitenKarte {
  const aufDerKarte = hoefe.flatMap((hof) => {
    const lage = leseLage(hof)
    return lage && liegtImAusschnitt(lage) ? [{ hof, lage }] : []
  })
  const pins = aufDerKarte.map(({ hof, lage }, i): PinPunkt => ({ slug: hof.slug, nummer: i + 1, lat: lage.lat, lon: lage.lon }))
  const hoefeDerKarte = aufDerKarte.map(({ hof }) => hof)
  const hof = hoefeDerKarte.findLast((h) => !h.isPaused && h.fotos.length > 0) ?? ordneOffeneZuerst(hoefeDerKarte)[0]
  if (!hof) return { pins, hervorgehoben: null }
  const { slug, name, abholung, abholungIstTermin } = bereiteStartseitenHof(hof)
  const zeile = [hof.city.trim(), ...hof.kategorien.slice(0, KARTENHOF_KATEGORIEN).map((k) => KATEGORIE_LABEL[k])]
    .filter(Boolean)
    .join(' · ')
  return { pins, hervorgehoben: { slug, name, abholung, abholungIstTermin, zeile } }
}

/** Der Zähler oben links auf der Karte: „19 Höfe in der Region". */
export function formatiereRegionsZaehler(anzahl: number): string {
  return `${gruppenBeschriftung(anzahl)} in der Region`
}

/** Der Name des Kartenlinks für Screenreader — mit der Zahl, sobald es mehr als einen Hof gibt. */
export function benenneKartenLink(anzahl: number): string {
  return anzahl > 1 ? `Alle ${anzahl} Höfe auf der Karte ansehen` : 'Alle Höfe auf der Karte ansehen'
}

// ─── Warum direkt vom Hof: Beispielrechnung ─────────────────────────────────

export type Beispielrechnung = {
  warenpreisCents: number
  gebuehrCents: number
  prozent: number
  /** Die Mindestgebühr für den Satz „mindestens € 0,50". */
  mindestCents: number
  duZahlstCents: number
  hofBekommtCents: number
  /** Der Satz unter dem Beispiel: für welche Zahlart es gilt (Register B1). */
  fussnote: string
  /**
   * Nur im Hofpreis-Modell (N38, Board w1-startseite „Beispiel“): das Modell
   * und der Satz „Der Hof verlangt … Du zahlst … – darin stecken 6 %
   * Plattformgebühr. …“. Im Modell „bisher“ fehlen beide — das Beispiel ist
   * dann genau das von vor Nr. 221.
   */
  modell?: 'hofpreis'
  satz?: string
}

/** Unter dem Beispiel, sobald bar und online wieder gleich viel kosten. */
export const BEISPIEL_GLEICH = 'Egal ob online oder bar bei Abholung.'

/** Der Warenpreis des Beispiels im Mockup: € 20,00. */
export const BEISPIEL_WARENPREIS_CENTS = 2000

/**
 * Die Beispielrechnung „Der Hof bekommt den vollen Preis" — gerechnet, nicht
 * abgeschrieben: über berechneServicegebuehr mit dem Satz für neue Höfe (E4),
 * damit Beispiel und Kasse nie auseinanderlaufen. Die Gebühr gilt im Beispiel
 * ab sofort.
 *
 * Gerechnet wird die ONLINE-Zahlung. Vor dem SEPA-Start kostet bar keine
 * Gebühr (B1) — dann sagt die Fußnote genau das, statt „egal ob online oder
 * bar". `jetzt` kommt von der Seite (Server-Uhr), wie überall.
 *
 * Ab dem Stichtag „Hofpreis-Modell ab“ (`modell` = 'hofpreis', von der Seite
 * über `gebuehrModellFuer`; V62, Nr. 221) rechnet das Beispiel über
 * `bestellGebuehr` mit dem Standardsatz — dieselbe Funktion wie Kasse und
 * /api/checkout, online und bar gleich. Ohne `modell` bleibt alles wie vor
 * Nr. 221 (die Seite stellt Nr. 226 um).
 */
export function beispielRechnung(jetzt: Date, warenpreisCents: number = BEISPIEL_WARENPREIS_CENTS, modell: GebuehrModell = 'bisher'): Beispielrechnung {
  if (modell === 'hofpreis') return beispielImHofpreis(warenpreisCents)
  const { gebuehrCents } = berechneServicegebuehr(
    warenpreisCents,
    {
      serviceFeePercent: SERVICEGEBUEHR_STANDARD_PROZENT,
      serviceFeeMinCents: SERVICEGEBUEHR_STANDARD_MIND_CENTS,
      serviceFeeActiveFrom: jetzt,
    },
    jetzt,
    'ONLINE'
  )
  return {
    warenpreisCents,
    gebuehrCents,
    prozent: SERVICEGEBUEHR_STANDARD_PROZENT,
    mindestCents: SERVICEGEBUEHR_STANDARD_MIND_CENTS,
    duZahlstCents: warenpreisCents + gebuehrCents,
    hofBekommtCents: warenpreisCents,
    fussnote: barOhneServicegebuehr('ONSITE_CASH', jetzt)
      ? `Bei Online-Zahlung. ${BAR_OHNE_GEBUEHR_HINWEIS}`
      : BEISPIEL_GLEICH,
  }
}

/** Das Beispiel im Hofpreis-Modell: Endpreis = Warenpreis + Gebühr je Stück (N38), der Hof bekommt den Warenpreis. */
function beispielImHofpreis(warenpreisCents: number): Beispielrechnung {
  // Der Standardsatz in Hundertstel über dieselbe Funktion wie Kasse und Hofseite (ohne eigenen Satz des Hofs).
  const hundertstel = satzHundertstel({ plattformgebuehrProzent: null })
  const { gebuehrCents, gesamtCents } = bestellGebuehr([{ preisCents: warenpreisCents, menge: 1 }], hundertstel)
  const euro = (cents: number) => formatEuro(centsAlsEuro(cents))
  return {
    warenpreisCents,
    gebuehrCents,
    prozent: PLATTFORMGEBUEHR_PROZENT,
    mindestCents: 0,
    duZahlstCents: gesamtCents,
    hofBekommtCents: warenpreisCents,
    fussnote: BEISPIEL_GLEICH,
    modell: 'hofpreis',
    satz:
      `Der Hof verlangt ${euro(warenpreisCents)} für deinen Einkauf. Du zahlst ${euro(gesamtCents)} – darin stecken ` +
      `${satzText(hundertstel)} % ${PLATTFORMGEBUEHR_BEZEICHNUNG}. Der Hof bekommt seine vollen ${euro(warenpreisCents)}.`,
  }
}

// ─── Fragen ─────────────────────────────────────────────────────────────────

export type Frage = { frage: string; antwort: string }

/**
 * „Gut zu wissen". Die Fragen stehen im Mockup, die Antworten nur bei der
 * ersten — und die widerspricht E8 (kein Kundenkonto, docs/nachtlauf/
 * freigabe.md): Wir legen KEIN Konto an. Die übrigen Antworten beschreiben,
 * was es heute gibt — nichts, was erst kommt.
 */
export const STARTSEITE_FRAGEN: readonly Frage[] = [
  {
    frage: 'Brauche ich ein Konto?',
    antwort:
      'Nein. Du bestellst mit deiner E-Mail-Adresse, ganz ohne Konto. Den Link zu deiner Bestellung bekommst du mit der Bestätigung per E-Mail.',
  },
  {
    frage: 'Wie bezahle ich?',
    antwort: `Online beim Bestellen oder bar bei der Abholung – was der Hof anbietet, siehst du vor dem Bestellen. Zum Warenpreis kommen ${SERVICEGEBUEHR_STANDARD_PROZENT} % Servicegebühr, mindestens ${formatEuro(centsAlsEuro(SERVICEGEBUEHR_STANDARD_MIND_CENTS))}, als eigene Zeile im Warenkorb.`,
  },
  {
    frage: 'Was, wenn ich nicht abholen kann?',
    antwort:
      'Sag dem Hof bitte so früh wie möglich Bescheid. Seine Telefonnummer findest du in deiner Bestellbestätigung.',
  },
  {
    frage: 'Wird auch geliefert?',
    antwort:
      'Nein. Du holst deine Bestellung zur gewählten Zeit direkt am Hof ab – dafür gibt es keine Lieferkosten, und der Hof bekommt den vollen Preis.',
  },
]

/**
 * „Wie bezahle ich?" ab dem Stichtag „Hofpreis-Modell ab“ (V62, N38; Board
 * w1-startseite): Die Gebühr steckt im Endpreis, online und bar gleich — keine
 * eigene Zeile, keine Bar-Ausnahme. Der Satz aus derselben Quelle wie das
 * Beispiel (Standardsatz über `satzHundertstel`).
 */
export const WIE_BEZAHLE_ICH_HOFPREIS =
  'Online beim Bestellen oder bar bei der Abholung – was der Hof anbietet, siehst du vor dem Bestellen. Die Preise sind ' +
  `Endpreise: Darin stecken ${satzText(satzHundertstel({ plattformgebuehrProzent: null }))} % ${PLATTFORMGEBUEHR_BEZEICHNUNG}, ` +
  'online und bar gleich.'

/**
 * Die Fragen, wie die Startseite sie zeigt — „Wie bezahle ich?" je Modell:
 * im Modell „bisher“ vor dem Bar-Stichtag mit der Bar-Ausnahme (Register B1),
 * danach wie in STARTSEITE_FRAGEN; im Hofpreis-Modell `WIE_BEZAHLE_ICH_HOFPREIS`.
 * `jetzt` von der Seite (Server-Uhr, revalidiert), `modell` aus `gebuehrModellFuer`.
 */
export function startseitenFragen(jetzt: Date, modell: GebuehrModell): readonly Frage[] {
  return STARTSEITE_FRAGEN.map((f) => {
    if (f.frage !== 'Wie bezahle ich?') return f
    if (modell === 'hofpreis') return { ...f, antwort: WIE_BEZAHLE_ICH_HOFPREIS }
    return { ...f, antwort: mitBarAusnahme(f.antwort, jetzt, BAR_OHNE_GEBUEHR_HINWEIS) }
  })
}
