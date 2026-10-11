/**
 * Was ein Abschnitt von Mein Hof an die bestehenden Aktionen schickt
 * (Nachtlauf Nr. 50, Register N4) — rein und ohne Datenbank prüfbar
 * (tests/abschnitt-stand.test.ts).
 *
 * Beide Aktionen schreiben bei JEDEM Aufruf mehr als ein Feld:
 * saveAppearanceAction (server/actions/appearance.ts) Leitspruch,
 * Gründungsjahr, Über uns, Abschnitte und Werte (die Werte löscht sie und
 * legt sie neu an), updateProfile (server/actions/farm.ts) das ganze Profil.
 * Ein Abschnitt ändert deshalb nur sein eigenes Feld und schickt alles andere
 * aus dem FRISCHEN Stand mit — gelesen vom Server direkt vor dem Speichern
 * (components/mein-hof/abschnitt-speichern.ts), nie aus den Props der Seite:
 * Die hielten nach einem anderen Abschnitt alte Werte, bis die Seite neu
 * geladen ist, und schrieben sie zurück.
 *
 * Logo, Titelbild und Verlauf stehen nie darin: Sie haben eigene Aktionen,
 * und saveAppearanceAction rührt fehlende Felder nicht an.
 */
import type { Betriebsstatus } from '@prisma/client'
import { alsLand } from '@/lib/laender'
import { ZU_LANG } from '@/lib/eingabegrenzen'
import { ZEILE_TITEL } from '@/lib/hofseite-fortschritt'
import { GRUENDUNGSJAHR_FEHLER, WERTE_ZU_VIELE, type AppearanceSaveInput } from '@/schemas/auftritt'
import type { ProfileFormData } from '@/schemas/hofprofil'
import type { HofseiteZeileId } from '@/schemas/hofseite-vorschau'

/**
 * Die Sätze des Speicherwegs der Abschnitte (Blatt unter lg, Editor ab lg) —
 * eine Quelle. Deutsch, per Du, mit Ausweg (CODING_STANDARDS §4).
 */
export const ABSCHNITT_SPEICHERN_TEXT = {
  /** Ein Speichern wartet zu lange auf das vorige (Kette in components/mein-hof/abschnitt-speichern.ts). */
  vorigesHaengt: 'Das vorige Speichern ist noch nicht fertig. Lade die Seite neu und versuch es dann noch einmal.',
  /** Die Anfrage selbst scheiterte (Netz weg, Aktion nach einem Deploy unbekannt) — die Eingabe bleibt stehen. */
  gingNicht: 'Wir konnten das gerade nicht speichern. Versuch es noch einmal.',
  /** Die Sitzung ist abgelaufen (Lesen des frischen Stands, server/actions/appearance.ts und farm.ts). */
  nichtAngemeldet: 'Du bist nicht mehr angemeldet. Melde dich neu an und versuch es dann noch einmal.',
  /** Angemeldet, aber kein Hof zu diesem Konto — etwa in einem Tab mit einer älteren Anmeldung. */
  hofFehlt: 'Wir finden deinen Hof gerade nicht. Lade die Seite neu und versuch es dann noch einmal.',
  /** Ein Wert des Auftritts passt nicht ins Schema, und kein Abschnitt lässt sich zuordnen. */
  ungueltig: 'Wir konnten das nicht speichern. Lade die Seite neu und versuch es dann noch einmal.',
  /** Der Grund hinter dem Namen des Abschnitts, der sperrt, wenn das Schema dafür keinen eigenen Satz hat (auftrittFehlerText). */
  unspeicherbar: 'Dort steht etwas, das wir so nicht speichern können — bitte prüf es.',
} as const

/** Welcher Abschnitt ein Feld des Auftritts bearbeitet. */
const ZEILE_DES_FELDS: Partial<Record<string, HofseiteZeileId>> = {
  tagline: 'tagline',
  foundedYear: 'tagline',
  aboutText: 'ueber-uns',
  farmValues: 'werte',
  sectionsConfig: 'abschnitte',
  bannerType: 'titelbild',
  bannerValue: 'titelbild',
  bannerUrl: 'titelbild',
  logoUrl: 'logo',
}

/** Die eigenen Sätze des Schemas (src/schemas/auftritt.ts) — jeder andere Satz stammt von Zod und ist englisch. */
const EIGENE_SAETZE: ReadonlySet<string> = new Set([ZU_LANG.leitspruch, ZU_LANG.ueberUns, ZU_LANG.wertUntertitel, GRUENDUNGSJAHR_FEHLER, WERTE_ZU_VIELE])

/**
 * Die Meldung, wenn der Auftritt nicht ins Schema passt (saveAppearanceAction).
 * Jedes Speichern schickt alle Felder des Auftritts mit (auftrittMitTeil) —
 * ein zu langer Altwert sperrt also auch das Speichern eines anderen
 * Abschnitts. Die Meldung nennt darum den Abschnitt, der sperrt, damit der
 * Hof weiß, was er ändern muss: „„Über uns“: Der Text darf höchstens 1000
 * Zeichen haben — bitte kürzen. Erst danach lässt sich speichern." Ein Satz
 * von Zod (englisch) kommt nie hinaus (CODING_STANDARDS §4).
 */
export function auftrittFehlerText(issues: readonly { path: readonly PropertyKey[]; message: string }[]): string {
  const erstes = issues[0]
  const feld = erstes?.path[0]
  const zeile = typeof feld === 'string' ? ZEILE_DES_FELDS[feld] : undefined
  if (!erstes || !zeile) return ABSCHNITT_SPEICHERN_TEXT.ungueltig
  const grund = EIGENE_SAETZE.has(erstes.message) ? erstes.message : ABSCHNITT_SPEICHERN_TEXT.unspeicherbar
  return `„${ZEILE_TITEL[zeile]}“: ${grund} Erst danach lässt sich speichern.`
}

/** Die Felder, die saveAppearanceAction bei jedem Aufruf schreibt — genau der Stand, aus dem jeder Abschnitt speichert. */
export type AuftrittStand = {
  tagline: string | null
  foundedYear: number | null
  aboutText: string | null
  sectionsConfig: readonly { key: string; visible: boolean; order: number }[]
  farmValues: readonly { icon: string; title: string; subtitle: string | null }[]
}

/** Was ein Abschnitt am Auftritt ändert. Ein fehlender Schlüssel heißt „nicht meins", null heißt „leeren". */
export type AuftrittTeil = Partial<Pick<AppearanceSaveInput, 'tagline' | 'foundedYear' | 'aboutText' | 'sectionsConfig' | 'farmValues'>>

/** Die Werte, wie die Aktion sie verlangt: sortOrder ist der Platz, ein leerer Untertitel wird null. */
function werteFuerAktion(werte: AuftrittStand['farmValues']): AppearanceSaveInput['farmValues'] {
  return werte.map((w, platz) => ({ icon: w.icon, title: w.title, subtitle: w.subtitle || null, sortOrder: platz }))
}

/** Der ganze Auftritt aus dem Stand — ohne Logo und Titelbild. */
export function auftrittBasis(stand: AuftrittStand): AppearanceSaveInput {
  return {
    tagline: stand.tagline,
    foundedYear: stand.foundedYear,
    aboutText: stand.aboutText,
    sectionsConfig: stand.sectionsConfig.map((s) => ({ key: s.key, visible: s.visible, order: s.order })),
    farmValues: werteFuerAktion(stand.farmValues),
  }
}

/** Der frische Stand mit dem Teil des Abschnitts — nur, was der Abschnitt wirklich setzt, ändert sich. */
export function auftrittMitTeil(frisch: AuftrittStand, teil: AuftrittTeil): AppearanceSaveInput {
  const neu = auftrittBasis(frisch)
  if (teil.tagline !== undefined) neu.tagline = teil.tagline
  if (teil.foundedYear !== undefined) neu.foundedYear = teil.foundedYear
  if (teil.aboutText !== undefined) neu.aboutText = teil.aboutText
  if (teil.sectionsConfig !== undefined) neu.sectionsConfig = teil.sectionsConfig.map((s) => ({ ...s }))
  if (teil.farmValues !== undefined) neu.farmValues = werteFuerAktion(teil.farmValues.map((w) => ({ ...w, subtitle: w.subtitle ?? null })))
  return neu
}

/** Aus dem gelesenen Auftritt (getAppearanceData) genau die Felder des Stands. */
export function auftrittStandAus(daten: AuftrittStand): AuftrittStand {
  return {
    tagline: daten.tagline,
    foundedYear: daten.foundedYear,
    aboutText: daten.aboutText,
    sectionsConfig: daten.sectionsConfig.map((s) => ({ key: s.key, visible: s.visible, order: s.order })),
    farmValues: daten.farmValues.map((w) => ({ icon: w.icon, title: w.title, subtitle: w.subtitle })),
  }
}

/** Was das Profil zum Speichern braucht — die Felder aus getFarmSettings. */
export type ProfilQuelle = {
  name: string
  ownerName: string
  description: string
  address: string
  postalCode: string
  city: string
  /** Die Spalte ist freier Text; gespeichert wird nur AT oder DE (alsLand). */
  country: string
  phone: string
  email: string
  latitude: number | null
  longitude: number | null
  betriebsnummer: string | null
  betriebsstatus: Betriebsstatus | null
}

/**
 * Was am Profil geändert wird: ein Abschnitt von Mein Hof (Name und
 * Kurzbeschreibung, Adresse, Kontakt) oder das Hof-Profil mit allem, was dort
 * seit dem Laden geändert wurde (geaendertSeitLaden). Ein fehlender Schlüssel
 * heißt „nicht meins".
 */
export type ProfilTeil = Partial<ProfileFormData>

function setze<K extends keyof ProfileFormData>(ziel: Partial<ProfileFormData>, feld: K, wert: ProfileFormData[K]): void {
  ziel[feld] = wert
}

/** Das ganze Profil, wie updateProfile es verlangt — ohne Logo und Titelbild (die gehören nicht ins Profil). */
export function profilBasis(e: ProfilQuelle): ProfileFormData {
  return {
    name: e.name,
    ownerName: e.ownerName,
    description: e.description,
    address: e.address,
    postalCode: e.postalCode,
    city: e.city,
    country: alsLand(e.country),
    phone: e.phone,
    email: e.email,
    latitude: e.latitude,
    longitude: e.longitude,
    betriebsnummer: e.betriebsnummer,
    betriebsstatus: e.betriebsstatus,
  }
}

/** Der frische Stand mit dem Teil des Abschnitts. */
export function profilMitTeil(frisch: ProfilQuelle, teil: ProfilTeil): ProfileFormData {
  const neu = profilBasis(frisch)
  for (const feld of Object.keys(teil) as (keyof ProfileFormData)[]) {
    const wert = teil[feld]
    if (wert !== undefined) setze(neu, feld, wert)
  }
  return neu
}

/**
 * Was im Hof-Profil seit dem Laden der Seite geändert wurde — nur das geht
 * über den frischen Stand (speichereProfil). Ein älterer Tab des Hof-Profils
 * schickte sonst Name, Adresse oder Kontakt vom Laden mit und schriebe damit
 * zurück, was inzwischen in Mein Hof gespeichert wurde. Verglichen werden
 * einfache Werte (Text, Zahl, null).
 */
export function geaendertSeitLaden(anfang: ProfileFormData, jetzt: ProfileFormData): ProfilTeil {
  const teil: ProfilTeil = {}
  for (const feld of Object.keys(jetzt) as (keyof ProfileFormData)[]) {
    if (!Object.is(jetzt[feld], anfang[feld])) setze(teil, feld, jetzt[feld])
  }
  return teil
}
