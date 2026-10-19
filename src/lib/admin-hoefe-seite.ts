/**
 * Admin › Höfe im Seitenmuster (Register N15, Nr. 94; Mockups
 * admin-hoefe-und-freischaltung und admin-mobil-unterwegs-freischalten): die
 * Regeln hinter Kennzahlen, Unterreitern, Warteliste und der Spalte
 * Gründungshof. Rein und ohne Datenbank (tests/admin-hoefe-seite.test.ts).
 *
 * Gezählt wird aus den Zeilen der Hofliste (`adminHofZeile`), mit denselben
 * Regeln wie die Filter der Liste (`zaehleHofFilter`) — eine Zahl in der
 * Kachel ist dieselbe wie im Filter, nie eine zweite Abfrage. Geld kommt hier
 * nicht vor. Die Gründungsplätze rechnen mit der Zahl der Plätze, die die Seite
 * hereinreicht; sie steht an genau einer Stelle (src/app/admin/page.tsx).
 */
import { hoefeAdresse, zaehleHofFilter, type AdminHofZeile, type HofFilter } from '@/lib/admin-hoefe'
import type { KennzahlDaten, UnterreiterDaten } from '@/lib/admin-seiten'
import {
  GRUENDUNG_BIS_MARKE,
  GRUENDUNG_BIS_TITEL,
  aktionLaeuft,
  folgenDerAenderung,
  gruendungAlleVergeben,
  gruendungsplaetze,
  gruendungsplatzVon,
  kleinsteFreieNummer,
  vergabeFest,
  type GruendungAnzeige,
  type GruendungEinstellung,
  type GruendungFolgen,
  type GruendungRichtung,
  type HofFuerFolgen,
  type HofFuerPlatz,
  type PlatzWechsel,
} from '@/lib/gruendungshof'
import { tarifText } from '@/lib/konditionen'
import { MONAT_KURZ, formatDatumLang } from '@/lib/format'
import { kalendertagInWien } from '@/lib/wiener-tag'

// ─── Seitenkopf, Regel-Zeile ─────────────────────────────────────────────────

export const HOEFE_SEITE = {
  titel: 'Höfe',
  satz: 'Was wartet, steht oben. Gründungshöfe zählen nach der Freischaltung – Testhöfe nimmst du aus.',
  /** Beschriftung der Kennzahlen und der Unterreiter für Screenreader. */
  kennzahlen: 'Höfe in Zahlen',
  reiter: 'Ansicht der Höfe',
  /** Die Regel-Zeile in leiser Schrift — der Rest (Servicegebühr, Betriebsnummer) steht in admin-hoefe.ts. */
  regel:
    'Gründungsplätze zählen in der Reihenfolge der Freischaltung. Ein ausgenommener Hof (etwa ein Testhof) belegt keinen Platz, die Höfe danach rücken auf. ' +
    'Wieder zählen geht nur, solange ein Platz frei ist – so verliert nie ein anderer Hof seine Zusage. ' +
    'Das Ende je Hof stellst du über „⋯“ › „Gründungshof bis“ ein; der Standard steht unter Einstellungen › Gründungshöfe.',
  keineWartenden: 'Kein Hof wartet auf Freischaltung.',
} as const

// ─── Unterreiter ─────────────────────────────────────────────────────────────

export const HOEFE_REITER_IDS = ['warten', 'alle', 'gruendung'] as const
export type HoefeReiterId = (typeof HOEFE_REITER_IDS)[number]

const REITER_LABEL: Record<HoefeReiterId, { label: string; labelKurz?: string }> = {
  warten: { label: 'Warten auf Freischaltung', labelKurz: 'Warten' },
  alle: { label: 'Alle Höfe', labelKurz: 'Alle' },
  gruendung: { label: 'Gründungshöfe' },
}

/**
 * Welcher Reiter gilt? Ein gewählter bleibt, wie er ist (auch „Warten“ ohne
 * Wartende: Dann steht dort der Satz, dass keiner wartet). Ohne Wahl — oder mit
 * einem unbekannten Wert, den das Schema schon verworfen hat — zeigt die Seite
 * „Warten“, solange jemand wartet, sonst „Alle Höfe“: Wer nichts zu tun hat,
 * landet nicht auf einer leeren Liste.
 */
export function waehleHoefeReiter(gewaehlt: HoefeReiterId | null, wartende: number): HoefeReiterId {
  if (gewaehlt !== null) return gewaehlt
  return wartende > 0 ? 'warten' : 'alle'
}

/**
 * Die Adresse der Höfe-Seite mit Reiter, Filter und Suche. Der Filter gilt nur
 * im Reiter „Alle Höfe“ (dort stehen die Filter-Chips), die Suche überall. Die
 * Regel für Filter und Suche bleibt die von `hoefeAdresse`.
 */
export function hoefeSeitenAdresse(ansicht: { reiter: HoefeReiterId; filter: HofFilter; suche: string }): string {
  const basis = hoefeAdresse({ filter: ansicht.reiter === 'alle' ? ansicht.filter : 'alle', suche: ansicht.suche })
  const rest = new URLSearchParams(basis.split('?')[1] ?? '')
  return `/admin?${new URLSearchParams([['reiter', ansicht.reiter], ...rest]).toString()}`
}

export function hoefeUnterreiter(stand: { wartende: number; alle: number; gruendungshoefe: number; maxPlaetze: number; suche: string }): UnterreiterDaten[] {
  const zahl: Record<HoefeReiterId, string> = {
    warten: String(stand.wartende),
    alle: String(stand.alle),
    gruendung: `${stand.gruendungshoefe} / ${stand.maxPlaetze}`,
  }
  return HOEFE_REITER_IDS.map((id) => ({
    id,
    ...REITER_LABEL[id],
    href: hoefeSeitenAdresse({ reiter: id, filter: 'alle', suche: stand.suche }),
    zahl: zahl[id],
  }))
}

// ─── Kennzahlen ──────────────────────────────────────────────────────────────

type ZeileFuerZahlen = Pick<AdminHofZeile, 'name' | 'slug' | 'status' | 'stripeFehlt' | 'onlineAus'>

/**
 * Warten · Online · Pausiert · Ohne Zahlung · Gründungsplätze (Mockup, Register
 * N15). Warten zählt die Wartenden der Warteliste; Online, Pausiert und Ohne
 * Zahlung sind die Zahlen der gleichnamigen Filter („Ohne Zahlung“ ist der
 * Filter „Stripe fehlt“ und findet auch einen pausierten Hof ohne Stripe).
 * Ein Ton steht nur bei Handlungsbedarf: Warten, wenn jemand wartet;
 * Gründungsplätze, wenn einer wartet und noch ein Platz frei ist.
 * Am Handy stehen die drei, die das Mockup zeigt.
 *
 * Gründungsplätze seit Nr. 109 (Mockup admin-hoefe-gruendung-ausnehmen,
 * Register K2): „n von {Plätze}“, darunter „vergeben · k ausgenommen“ —
 * ausgenommene Höfe zählen nicht mit, `max` kommt aus der Einstellung.
 */
export function hoefeKennzahlen(hoefe: readonly ZeileFuerZahlen[], plaetze: { vergeben: number; max: number; ausgenommen: number }): KennzahlDaten[] {
  const filter = zaehleHofFilter(hoefe)
  const wartende = hoefe.filter((h) => h.status.id === 'wartet').length
  const frei = Math.max(0, plaetze.max - plaetze.vergeben)
  return [
    { id: 'warten', titel: 'Warten', wert: String(wartende), satz: 'auf Freischaltung', ton: wartende > 0 ? 'tun' : 'neutral' },
    { id: 'online', titel: 'Online', wert: String(filter.online), satz: 'verkaufen gerade', ton: 'neutral' },
    { id: 'pausiert', titel: 'Pausiert', wert: String(filter.pausiert), satz: 'Urlaubsmodus', ton: 'neutral', amHandy: false },
    { id: 'ohneZahlung', titel: 'Ohne Zahlung', wert: String(filter['stripe-fehlt']), satz: 'Stripe fehlt', ton: 'neutral', amHandy: false },
    {
      id: 'gruendungsplaetze',
      titel: 'Gründungsplätze',
      titelKurz: 'Plätze',
      wert: `${plaetze.vergeben} von ${plaetze.max}`,
      satz: plaetze.ausgenommen > 0 ? `vergeben · ${plaetze.ausgenommen} ausgenommen` : 'vergeben',
      ton: frei > 0 && wartende > 0 ? 'tun' : 'neutral',
    },
  ]
}

// ─── Warteliste: der Gründungsplatz bei Freischaltung ────────────────────────

export const GRUENDUNGSPLATZ_WARTELISTE = {
  bekaeme: (platz: number): string => `bekäme Gründungsplatz Nr. ${platz}`,
  erstMitFreischaltung: 'Gründungsplatz erst mit Freischaltung',
} as const

/**
 * Welchen Gründungsplatz bekäme dieser wartende Hof, wenn er jetzt
 * freigeschaltet würde? Die Reihenfolge der Freischaltung entscheidet
 * (`gruendungsplatzVon`): Der Hof käme mit `jetzt` als Letzter dazu, vor ihm
 * stehen die Höfe im Rennen — freigeschaltet und nicht stillgelegt; wartende
 * belegen nichts. Über der Zahl der Plätze: null (kein Platz mehr). Ein
 * ausgenommener Hof (Nr. 109) bekäme keinen.
 */
export function platzBeiFreischaltung(
  hofId: string,
  hoefe: readonly HofFuerPlatz[],
  jetzt: Date,
  einstellung: GruendungEinstellung
): number | null {
  const maxPlaetze = einstellung.plaetze
  const ausgenommen = hoefe.find((h) => h.id === hofId)?.gruendungAusgenommen === true
  // Festgeschrieben (Nr. 116): ein Hof mit Platz behält ihn (auch nach dem Stichtag, wie approveFarmAction),
  // sonst die kleinste freie Nummer — nur, solange die Aktion läuft. Sonst nennte die Warteliste nach dem
  // Stichtag einen Platz, den die Freischaltung nicht vergibt.
  if (vergabeFest(hoefe)) {
    if (ausgenommen) return null
    const plaetze = gruendungsplaetze(hoefe)
    const eigener = plaetze.get(hofId)
    if (eigener !== undefined) return eigener
    if (!aktionLaeuft(jetzt, einstellung, plaetze.size)) return null
    return kleinsteFreieNummer(new Set(plaetze.values()), Math.max(maxPlaetze, 0))
  }
  const mitHof: HofFuerPlatz[] = [
    ...hoefe.filter((h) => h.id !== hofId),
    { id: hofId, approvedAt: jetzt, createdAt: jetzt, archivedAt: null, gruendungAusgenommen: ausgenommen },
  ]
  const platz = gruendungsplatzVon(hofId, mitHof)
  return platz !== null && platz <= maxPlaetze ? platz : null
}

/**
 * Die Zeile unter einem wartenden Hof: „bekäme Gründungsplatz Nr. k“ — nur
 * mit eingerichtetem Stripe, denn ohne Stripe lässt sich der Hof nicht
 * freischalten (Register Z1) —, sonst „Gründungsplatz erst mit Freischaltung“.
 * Sind alle Plätze vergeben (`platz` null), steht keine Zeile da.
 */
export function wartelistePlatzZeile(hof: { stripeBereit: boolean }, platz: number | null): { art: 'bekaeme' | 'erst'; text: string } | null {
  if (platz === null) return null
  return hof.stripeBereit
    ? { art: 'bekaeme', text: GRUENDUNGSPLATZ_WARTELISTE.bekaeme(platz) }
    : { art: 'erst', text: GRUENDUNGSPLATZ_WARTELISTE.erstMitFreischaltung }
}

// ─── Spalte Gründungshof ─────────────────────────────────────────────────────

export const GRUENDUNGSHOF_SPALTE = { titel: 'Gründungshof', kein: 'kein Gründungshof' } as const

/** JJJJ-MM-TT → TT.MM.JJJJ. */
function tagKurz(kalendertag: string): string {
  const [jahr, monat, tag] = kalendertag.split('-')
  return `${tag}.${monat}.${jahr}`
}

/**
 * „Nr. 3 · bis 30.06.2027“ mit der Marke „abweichend“ bzw. „Standard“
 * (`GRUENDUNG_BIS_MARKE`); null ohne Platz — dort schreibt die Seite
 * „kein Gründungshof“. Fehlt trotz Platz das Ende, steht nur die Nummer.
 */
export function gruendungshofZelle(hof: { gruendungsplatz: number | null; gruendung: GruendungAnzeige | null }): { text: string; marke: string | null } | null {
  if (hof.gruendungsplatz === null) return null
  const nummer = `Nr. ${hof.gruendungsplatz}`
  if (hof.gruendung === null) return { text: nummer, marke: null }
  return {
    text: `${nummer} · bis ${tagKurz(hof.gruendung.bisTag)}`,
    marke: hof.gruendung.abweichend ? GRUENDUNG_BIS_MARKE.abweichend : GRUENDUNG_BIS_MARKE.standard,
  }
}

/** Die Gründungshöfe nach Platz, nur Höfe mit Platz (Reiter „Gründungshöfe“). */
export function gruendungshoefeListe<T extends { gruendungsplatz: number | null }>(hoefe: readonly T[]): T[] {
  return hoefe
    .filter((h): h is T & { gruendungsplatz: number } => h.gruendungsplatz !== null)
    .sort((a, b) => a.gruendungsplatz - b.gruendungsplatz)
}

// ─── Gründungshof ausnehmen und wieder aufnehmen (Register K2, Nr. 109) ──────

/** Alle Texte des Menüs ⋯ und der Bestätigung (Mockups admin-hoefe-gruendung-ausnehmen, mobil-…) — EINE Quelle. */
export const GRUENDUNG_AUSNEHMEN_TEXT = {
  menue: { ausnehmen: 'Nicht als Gründungshof zählen …', aufnehmen: 'Wieder als Gründungshof zählen …' },
  menueBis: `${GRUENDUNG_BIS_TITEL} …`,
  titel: {
    ausnehmen: (name: string): string => `${name} nicht als Gründungshof zählen?`,
    aufnehmen: (name: string): string => `${name} wieder als Gründungshof zählen?`,
  },
  knopf: { ausnehmen: 'Nicht mehr zählen', aufnehmen: 'Wieder zählen' },
  erledigt: { ausnehmen: 'Der Hof zählt nicht mehr als Gründungshof.', aufnehmen: 'Der Hof zählt wieder als Gründungshof.' },
  keineNachricht: 'Der Hof bekommt keine Nachricht. Seine Hofseite und seine Bestellungen bleiben, wie sie sind.',
  zurueck: 'Zurück geht es über ⋯ › „Wieder als Gründungshof zählen“, solange ein Platz frei ist.',
  nummer: 'Die Nummer ist eine Reihenfolge, die Zusage ist das Datum.',
  /** Nach dem Festschreiben (Register K2, Nr. 116). */
  nummerFest: 'Die Nummern stehen fest – niemand rückt auf, ein freier Platz geht an die nächste Freischaltung.',
  endeAbHeute: 'Das Ende rechnet sich ab dem Tag der Wiederaufnahme – nie kürzer als ein noch gespeichertes Ende.',
  haken: 'Das ist ein Testhof – oder der Hof hat zugestimmt.',
  hakenGrund: 'Nötig, weil er gerade einen Platz hält (K1).',
  zuletzt: (person: string, am: string): string => `zuletzt geändert von ${person} am ${am}`,
  unbekannt: 'einem gelöschten Konto',
} as const

/** Höchstens so viele Höfe nennt die Bestätigung beim Nachrücken, dann „und n weitere“. */
export const FOLGEN_HOECHSTENS = 3

function zusage(bis: Date): string {
  return `${tarifText('HOFLADEN').name} ohne Grundgebühr bis ${formatDatumLang(bis)}`
}

function freiSatz(frei: number, plaetze: number): string {
  if (frei === 0) return `Danach sind alle ${plaetze} Plätze vergeben.`
  return frei === 1 ? `Frei ist danach 1 von ${plaetze} Plätzen.` : `Frei sind danach ${frei} von ${plaetze} Plätzen.`
}

/** „A, B und C“ — die letzten zwei mit „und“. */
function undListe(teile: readonly string[]): string {
  return teile.length <= 1 ? (teile[0] ?? '') : `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`
}

/** Beim Ausnehmen: „Lindenhof rückt auf Nr. 2, Sonnhof auf Nr. 3 und Birkenhof auf Nr. 4.“ — höchstens drei, dann „und n weitere“. */
function aufrueckenSatz(verschoben: readonly PlatzWechsel[]): string | null {
  if (verschoben.length === 0) return null
  const genannt = verschoben.slice(0, FOLGEN_HOECHSTENS).map((w, i) => (i === 0 ? `${w.name} rückt auf Nr. ${w.nach}` : `${w.name} auf Nr. ${w.nach}`))
  const rest = verschoben.length - genannt.length
  return rest > 0 ? `${genannt.join(', ')} – und ${rest} weitere rücken je eine Nummer vor.` : `${undListe(genannt)}.`
}

/**
 * Die Sätze der Bestätigung „in Zahlen“ (Register K2, Nr. 109): beim Ausnehmen
 * der verlorene Platz samt Zusage, wer auf welchen Platz rückt, ausdrücklich
 * ein Hof, der dadurch NEU Gründungshof wird, und die freien Plätze danach;
 * bei der Wiederaufnahme der neue Platz und wer dahinter eine Nummer weiter
 * rückt — die Zusage bleibt. `standardBis` ist das Standard-Ende der Einstellung.
 */
export function folgenSaetze(hof: { name: string; gruendungBis: Date | null }, folgen: GruendungFolgen, plaetze: number, standardBis: Date): string[] {
  const bis = (h: { gruendungBis: Date | null }): Date => h.gruendungBis ?? standardBis
  const saetze: string[] = []
  if (folgen.richtung === 'ausnehmen') {
    saetze.push(
      folgen.platzVorher !== null
        ? `${hof.name} verliert Platz Nr. ${folgen.platzVorher} und die Zusage „${zusage(bis(hof))}“.`
        : `${hof.name} hält gerade keinen Gründungsplatz – an den Plätzen ändert sich nichts.`
    )
    const aufruecken = aufrueckenSatz(folgen.verschoben)
    if (aufruecken) saetze.push(aufruecken)
    for (const w of folgen.neu) {
      saetze.push(`Neu Gründungshof: ${w.name} rückt auf Platz ${w.nach} und läuft dann bis ${formatDatumLang(bis(w))} ohne Grundgebühr.`)
    }
  } else {
    if (folgen.platzNachher !== null) {
      saetze.push(
        folgen.fest
          ? `${hof.name} bekommt Platz Nr. ${folgen.platzNachher}. ${GRUENDUNG_AUSNEHMEN_TEXT.endeAbHeute}`
          : `${hof.name} bekommt Platz Nr. ${folgen.platzNachher} – ${zusage(bis(hof))}.`
      )
    }
    const genannt = folgen.verschoben.slice(0, FOLGEN_HOECHSTENS)
    for (const w of genannt) saetze.push(`${w.name}: Nr. ${w.von} → Nr. ${w.nach} – die Zusage bleibt.`)
    const rest = folgen.verschoben.length - genannt.length
    if (rest > 0) saetze.push(`Und ${rest} weitere rücken je eine Nummer weiter – die Zusage bleibt.`)
  }
  saetze.push(freiSatz(folgen.freiNachher, plaetze))
  return saetze
}

/** Was Menü ⋯ und Bestätigung je Hof brauchen — fertig als Text, die Liste ist eine Client-Komponente. */
export type GruendungAenderung = {
  richtung: GruendungRichtung
  /** Der Eintrag im Menü ⋯. */
  menue: string
  /** Warum der Eintrag ausgegraut ist (Wiederaufnahme ohne freien Platz), sonst null. */
  gesperrt: string | null
  titel: string
  saetze: string[]
  hinweise: string[]
  /** Der Haken „Testhof oder Zustimmung“ erscheint nur, wenn der Hof gerade einen Platz hält. */
  haken: boolean
  knopf: string
}

/**
 * Menüeintrag und Bestätigung für einen freigeschalteten, nicht stillgelegten
 * Hof: ein ausgenommener wird wieder aufgenommen, jeder andere ausgenommen.
 * Gerechnet mit `folgenDerAenderung` aus derselben Liste wie die Plätze und
 * der Zahl der Plätze aus der Einstellung (nie die feste 12).
 */
export function gruendungAenderung<T extends HofFuerFolgen>(hof: T, hoefe: readonly T[], plaetze: number, standardBis: Date): GruendungAenderung {
  const richtung: GruendungRichtung = hof.gruendungAusgenommen ? 'aufnehmen' : 'ausnehmen'
  const folgen = folgenDerAenderung(hof, hoefe, plaetze, richtung)
  const t = GRUENDUNG_AUSNEHMEN_TEXT
  return {
    richtung,
    menue: t.menue[richtung],
    gesperrt: folgen.moeglich ? null : gruendungAlleVergeben(plaetze),
    titel: t.titel[richtung](hof.name),
    saetze: folgen.moeglich ? folgenSaetze(hof, folgen, plaetze, standardBis) : [],
    hinweise: richtung === 'ausnehmen' ? [t.keineNachricht, t.zurueck] : [t.keineNachricht, folgen.fest ? t.nummerFest : t.nummer],
    haken: richtung === 'ausnehmen' && folgen.platzVorher !== null,
    knopf: t.knopf[richtung],
  }
}

/** „zuletzt geändert von Name am 14. Okt“ — null, wenn nie geändert. Der Tag ist der Wiener. */
export function gruendungZuletztText(geaendertAm: Date | null, person: string | null): string | null {
  if (geaendertAm === null) return null
  const [, monat, tag] = kalendertagInWien(geaendertAm).split('-')
  return GRUENDUNG_AUSNEHMEN_TEXT.zuletzt(person ?? GRUENDUNG_AUSNEHMEN_TEXT.unbekannt, `${Number(tag)}. ${MONAT_KURZ[Number(monat) - 1]}`)
}
