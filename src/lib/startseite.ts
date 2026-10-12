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
import { LEERER_HOEFE_FILTER, schreibeHoefeFilter, type HoefeFilter } from '@/schemas/hoefe-filter'
import { KATEGORIE_LABEL } from '@/lib/taxonomie'
import { formatiereAbholung, type NaechsteAbholung } from '@/lib/hofuebersicht'
import {
  SERVICEGEBUEHR_STANDARD_MIND_CENTS,
  SERVICEGEBUEHR_STANDARD_PROZENT,
  berechneServicegebuehr,
  centsAlsEuro,
  barOhneServicegebuehr,
} from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { BAR_OHNE_GEBUEHR_HINWEIS, mitBarAusnahme } from '@/lib/konditionen'
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

/** Die Pille unten rechts auf der Karte im Browser (Mockup web-k0-startseite-karte-region). */
export const KARTE_OEFFNEN = 'Karte öffnen'

/** „Brennmaterial finden" im Saisonband. */
export const BRENNMATERIAL_ADRESSE = hoefeAdresse({ kategorien: ['BRENNHOLZ'] })

// ─── Futter vom Hof: zwei Zielgruppen ───────────────────────────────────────

export type FutterZielgruppe = {
  kicker: string
  titel: string
  punkte: readonly string[]
  knopf: string
  /** Die Hofübersicht im Bereich Futtermittel mit der passenden Gebinde-Facette (Grenze 25 kg). */
  filter: Partial<HoefeFilter>
  /** Die Illustration (public/categories/) — die Seite holt den Pfad über product-image.ts. */
  bild: ProductCategoryValue
}

/**
 * Wortlaut aus dem Mockup. „Kleinmengen" und „Ballen" sind die Gebinde-
 * Facette von /hoefe (bis 25 kg | darüber). Neutral statt Mockup: „Sackerl ab
 * 1 kg", „staubarm" und „Verladen mit Frontlader" sind Sache des einzelnen
 * Hofs, die Plattform sagt sie nicht zu — deshalb „je nach Hof". Bewusst NICHT übernommen:
 * „nur registrierte Futtermittelbetriebe" und „Bei Ballen zeigen wir die
 * Registrierung des Hofs gleich mit an" — beides gibt es erst mit Gate 6
 * (Sperre je Gebinde, Schild nach E9); vorher wäre es ein Versprechen, das
 * die Seite nicht hält.
 */
export const FUTTER_ZIELGRUPPEN: readonly FutterZielgruppe[] = [
  {
    kicker: 'Für Hase & Meerschwein',
    titel: 'Heu und Einstreu in kleinen Mengen',
    punkte: ['Kleine Mengen – Gebinde je nach Hof', 'direkt vom Hof aus der Region', 'mit Eiern und Gemüse gleich mitbestellen'],
    knopf: 'Kleinmengen finden',
    filter: { bereich: 'FUTTERMITTEL', gebinde: 'KLEIN' },
    bild: 'HEU_STROH',
  },
  {
    kicker: 'Für Pferd, Rind & Schaf',
    titel: 'Ballen und Futtergetreide',
    punkte: ['Kleinballen und Rundballen', 'Verladen am Hof – je nach Hof'],
    knopf: 'Ballen finden',
    filter: { bereich: 'FUTTERMITTEL', gebinde: 'GROSS' },
    bild: 'GETREIDE_KOERNER',
  },
]

// ─── Höfe in deiner Nähe ────────────────────────────────────────────────────

/** So viele Höfe zeigt die Startseite — eine Reihe im Browser. */
export const STARTSEITE_HOEFE_DECKEL = 4

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
}

/** Die Lage aus der Liste: nur mit beiden Koordinaten. */
function leseLage(hof: StartseitenHofEingabe): GeoPunkt | null {
  return hof.latitude === null || hof.longitude === null ? null : { lat: hof.latitude, lon: hof.longitude }
}

/** Erst die Höfe, bei denen man gerade bestellen kann, pausierte ans Ende — die Reihenfolge der Liste bleibt sonst. */
function ordneOffeneZuerst(hoefe: readonly StartseitenHofEingabe[]): StartseitenHofEingabe[] {
  return [...hoefe.filter((h) => !h.isPaused), ...hoefe.filter((h) => h.isPaused)]
}

function bereiteStartseitenHof(hof: StartseitenHofEingabe): StartseitenHof {
  return {
    slug: hof.slug,
    name: hof.name,
    ort: `${hof.postalCode} ${hof.city}`.trim(),
    abholung: hof.isPaused
      ? 'Macht gerade Pause'
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
  }
}

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
 */
export function beispielRechnung(jetzt: Date, warenpreisCents: number = BEISPIEL_WARENPREIS_CENTS): Beispielrechnung {
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
 * Die Fragen, wie die Startseite sie zeigt: vor dem Stichtag mit der
 * Bar-Ausnahme in „Wie bezahle ich?" (Register B1), danach unverändert.
 * `jetzt` von der Seite (Server-Uhr, revalidiert).
 */
export function startseitenFragen(jetzt: Date): readonly Frage[] {
  return STARTSEITE_FRAGEN.map((f) =>
    f.frage === 'Wie bezahle ich?' ? { ...f, antwort: mitBarAusnahme(f.antwort, jetzt, BAR_OHNE_GEBUEHR_HINWEIS) } : f
  )
}
