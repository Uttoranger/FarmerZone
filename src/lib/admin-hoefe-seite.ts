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
import { GRUENDUNG_BIS_MARKE, gruendungsplatzVon, type GruendungAnzeige, type HofFuerPlatz } from '@/lib/gruendungshof'

// ─── Seitenkopf, Regel-Zeile ─────────────────────────────────────────────────

export const HOEFE_SEITE = {
  titel: 'Höfe',
  satz: 'Freischalten, Gründungsplätze und Konditionen je Hof. Was wartet, steht oben.',
  /** Beschriftung der Kennzahlen und der Unterreiter für Screenreader. */
  kennzahlen: 'Höfe in Zahlen',
  reiter: 'Ansicht der Höfe',
  /** Die Regel-Zeile in leiser Schrift — der Rest (Servicegebühr, Betriebsnummer) steht in admin-hoefe.ts. */
  regel:
    'Gründungsplätze zählen in der Reihenfolge der Freischaltung. Das Ende je Hof stellst du über „⋯“ › „Gründungshof bis“ ein; ' +
    'der Standard steht unter Einstellungen › Gründungshöfe.',
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
 */
export function hoefeKennzahlen(hoefe: readonly ZeileFuerZahlen[], plaetze: { vergeben: number; max: number }): KennzahlDaten[] {
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
      titelKurz: 'Plätze frei',
      wert: `${frei} frei`,
      satz: `${plaetze.vergeben} von ${plaetze.max} vergeben`,
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
 * belegen nichts. Über der Zahl der Plätze: null (kein Platz mehr).
 */
export function platzBeiFreischaltung(hofId: string, hoefe: readonly HofFuerPlatz[], jetzt: Date, maxPlaetze: number): number | null {
  const mitHof: HofFuerPlatz[] = [...hoefe.filter((h) => h.id !== hofId), { id: hofId, approvedAt: jetzt, createdAt: jetzt, archivedAt: null }]
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
