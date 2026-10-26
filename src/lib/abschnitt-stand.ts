/**
 * Was ein Abschnitt von Mein Hof an die bestehenden Aktionen schickt
 * (Nachtlauf Nr. 50, Register N4) — rein und ohne Datenbank prüfbar
 * (tests/abschnitt-stand.test.ts).
 *
 * saveAppearanceAction (server/actions/appearance.ts) schreibt seit Nr. 65
 * nur, was mitkommt: Ein Abschnitt des Auftritts schickt nur seinen Teil
 * (bereiteAuftrittVor). updateProfile (server/actions/farm.ts) schreibt
 * weiter das ganze Profil: Ein Abschnitt des Profils ändert nur sein eigenes
 * Feld und schickt alles andere aus dem FRISCHEN Stand mit — gelesen vom
 * Server direkt vor dem Speichern (components/mein-hof/abschnitt-speichern.ts),
 * nie aus den Props der Seite: Die hielten nach einem anderen Abschnitt alte
 * Werte, bis die Seite neu geladen ist, und schrieben sie zurück.
 *
 * Logo, Titelbild und Verlauf stehen nie darin: Sie haben eigene Aktionen.
 */
import type { Betriebsstatus } from '@prisma/client'
import { alsLand } from '@/lib/laender'
import { GRUENDUNGSJAHR_FEHLER, WERTE_ZU_VIELE, ZU_LANG } from '@/lib/eingabegrenzen'
import { EINSTELLUNG_FUER_ZEILE, ZEILE_TITEL } from '@/lib/hofseite-fortschritt'
import type { AppearanceSaveInput } from '@/schemas/auftritt'
import type { ProfileFormData, profileSchema } from '@/schemas/hofprofil'
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
  /** Die Sitzung ist abgelaufen (Lesen des frischen Stands des Profils, server/actions/farm.ts). */
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
 * Sie nennt den Abschnitt, dessen Feld nicht passt, damit der Hof weiß, was
 * er ändern muss: „„Über uns“: Der Text darf höchstens 1000 Zeichen haben —
 * bitte kürzen. Erst danach lässt sich speichern." Seit Nr. 65 schickt jeder
 * Abschnitt nur seinen Teil; ein zu langer Altwert sperrt also nur noch den
 * eigenen Abschnitt. Ein Satz von Zod (englisch) kommt nie hinaus
 * (CODING_STANDARDS §4).
 */
export function auftrittFehlerText(issues: readonly { path: readonly PropertyKey[]; message: string }[]): string {
  const erstes = issues[0]
  const feld = erstes?.path[0]
  const zeile = typeof feld === 'string' ? ZEILE_DES_FELDS[feld] : undefined
  if (!erstes || !zeile) return ABSCHNITT_SPEICHERN_TEXT.ungueltig
  const grund = EIGENE_SAETZE.has(erstes.message) ? erstes.message : ABSCHNITT_SPEICHERN_TEXT.unspeicherbar
  return `„${ZEILE_TITEL[zeile]}“: ${grund} Erst danach lässt sich speichern.`
}

/** Was ein Abschnitt am Auftritt ändert. Ein fehlender Schlüssel heißt „nicht meins", null heißt „leeren". */
export type AuftrittTeil = Partial<Pick<AppearanceSaveInput, 'tagline' | 'foundedYear' | 'aboutText' | 'sectionsConfig' | 'farmValues'>>

/**
 * Der Teil eines Abschnitts, wie saveAppearanceAction ihn verlangt — nur die
 * Schlüssel, die der Abschnitt setzt (Register N4, Ergänzung Lauf 10): Die
 * Aktion schreibt nur, was mitkommt. Ein Schlüssel mit undefined fehlt auch
 * in der Anfrage. Werte bekommen sortOrder nach ihrem Platz, ein leerer
 * Untertitel wird null.
 */
export function bereiteAuftrittVor(teil: AuftrittTeil): AppearanceSaveInput {
  const anfrage: AppearanceSaveInput = {}
  if (teil.tagline !== undefined) anfrage.tagline = teil.tagline
  if (teil.foundedYear !== undefined) anfrage.foundedYear = teil.foundedYear
  if (teil.aboutText !== undefined) anfrage.aboutText = teil.aboutText
  if (teil.sectionsConfig !== undefined) anfrage.sectionsConfig = teil.sectionsConfig.map((s) => ({ key: s.key, visible: s.visible, order: s.order }))
  if (teil.farmValues !== undefined) anfrage.farmValues = werteFuerAktion(teil.farmValues.map((w) => ({ ...w, subtitle: w.subtitle ?? null })))
  return anfrage
}

/** Die Werte, wie die Aktion sie verlangt: sortOrder ist der Platz, ein leerer Untertitel wird null. */
function werteFuerAktion(werte: readonly { icon: string; title: string; subtitle: string | null }[]): NonNullable<AppearanceSaveInput['farmValues']> {
  return werte.map((w, platz) => ({ icon: w.icon, title: w.title, subtitle: w.subtitle || null, sortOrder: platz }))
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
 * Der Stand beim Laden, Feld für Feld so, wie das Schema ihn ausgibt: Ränder
 * weg, die E-Mail klein, eine leere Betriebsnummer null. Der Maßstab für
 * geaendertSeitLaden — das Formular gibt beim Speichern die Ausgabe des
 * Schemas weiter (zodResolver), ein unverändertes Feld muss also schon beim
 * Laden genauso aussehen. Feld für Feld, nicht als Ganzes: Hält EIN Feld das
 * Schema nicht ein (ein Altwert, etwa eine zu kurze Beschreibung), bleibt nur
 * dieses, wie es geladen wurde. Sonst zählten mit ihm E-Mail und
 * Betriebsnummer als geändert und schrieben den Stand eines anderen Tabs
 * zurück.
 */
export function profilWieImSchema(schema: typeof profileSchema, werte: ProfileFormData): ProfileFormData {
  const ergebnis: ProfileFormData = { ...werte }
  for (const feld of Object.keys(werte) as (keyof ProfileFormData)[]) {
    const geprueft = schema.shape[feld].safeParse(werte[feld])
    if (geprueft.success) setze(ergebnis, feld, geprueft.data)
  }
  return ergebnis
}

/** Was das Adress-Formular in Mein Hof zeigt und schickt — Straße, PLZ, Ort. */
export type AdressEingabe = Pick<ProfileFormData, 'address' | 'postalCode' | 'city'>

/**
 * Die Adresse, wie das Adress-Formular in Mein Hof sie schickt: Straße, PLZ
 * und Ort aus dem Formular, Land und Kartenpunkt vom Laden der Seite — EINE
 * Adresse als Ganzes (Register N4, Ergänzung Lauf 10). Nur Straße, PLZ und
 * Ort mischten sonst Land und Punkt eines anderen Tabs aus dem frischen Stand
 * hinein (profilMitTeil). Ohne Punkt geht null mit; updateProfile lässt einen
 * gespeicherten Punkt dann stehen.
 */
export function bereiteAdresseVor(geladen: Pick<ProfilQuelle, 'country' | 'latitude' | 'longitude'>, eingabe: AdressEingabe): ProfilTeil {
  return {
    address: eingabe.address,
    postalCode: eingabe.postalCode,
    city: eingabe.city,
    country: alsLand(geladen.country),
    latitude: geladen.latitude,
    longitude: geladen.longitude,
  }
}

/**
 * Der Hinweis im Adress-Formular von Mein Hof, sobald die Straße geändert ist:
 * Der Kartenpunkt zieht nicht mit (die Karte gibt es nur im Hof-Profil). Text
 * und Ziel aus einer Quelle; das Ziel ist der Ort, an dem die Adresse außerhalb
 * von Mein Hof bearbeitet wird.
 */
export const KARTENPUNKT_PRUEFEN = { text: 'Standort auf der Karte prüfen', href: EINSTELLUNG_FUER_ZEILE.adresse } as const

/**
 * Steht der Hinweis KARTENPUNKT_PRUEFEN? Nur mit gesetztem Punkt (sonst heißt
 * der Link „setzen") und einer anderen, nicht leeren Straße — Ränder zählen
 * nicht (das Schema nimmt sie ohnehin nicht mit). Ein leeres Feld meldet
 * beim Speichern selbst „Pflichtfeld".
 */
export function brauchtKartenpruefung(geladen: Pick<ProfilQuelle, 'address' | 'latitude' | 'longitude'>, strasse: string): boolean {
  if (geladen.latitude === null || geladen.longitude === null) return false
  const neu = strasse.trim()
  return neu !== '' && neu !== geladen.address.trim()
}

/**
 * Die Felder, die zusammen EINE Adresse sind: Straße, PLZ, Ort, Land und der
 * Kartenpunkt. Sie gehen nur gemeinsam — so wie das Adress-Blatt in Mein Hof
 * Straße, PLZ und Ort immer zusammen schickt. Einzeln gemischt, ergäben zwei
 * Tabs eine Adresse, die es nicht gibt: die Straße aus dem einen, den Ort
 * aus dem anderen, den Punkt auf der Karte woanders.
 */
const ADRESSE: readonly (keyof ProfileFormData)[] = ['address', 'postalCode', 'city', 'country', 'latitude', 'longitude']

/**
 * Ab dieser Abweichung (in Grad, rund ein Meter) gilt der Kartenpunkt als
 * bewegt. Leaflet rechnet die Mitte nach einem Größenwechsel der Karte
 * (Handy drehen, Fenster schmaler) aus gerundeten Pixeln neu — um bis zu
 * eine Pixelbreite, ohne dass jemand die Karte angefasst hat. Ohne Toleranz
 * nähme so ein Wackeln die ganze Adresse dieses Tabs mit (ADRESSE) und
 * schriebe zurück, was inzwischen in Mein Hof gespeichert wurde. Die
 * Toleranz fängt das typische Wackeln ab, nicht das größte (bei Zoom 17 ist
 * eine Pixelbreite etwas mehr als 1e-5 Grad Länge). Die Ursache — ein
 * Größenwechsel meldet sich als Punktwahl — behebt Nr. 52 in der
 * Standortkarte (use-karten-groesse: invalidateSize in merker.still(), die
 * Mitte von vorher wird wiederhergestellt); erst beide zusammen sind dicht.
 */
export const KARTENPUNKT_TOLERANZ_GRAD = 1e-5

function unveraendert(feld: keyof ProfileFormData, vorher: unknown, jetzt: unknown): boolean {
  if ((feld === 'latitude' || feld === 'longitude') && typeof vorher === 'number' && typeof jetzt === 'number') {
    return Math.abs(jetzt - vorher) < KARTENPUNKT_TOLERANZ_GRAD
  }
  return Object.is(jetzt, vorher)
}

/**
 * Was im Hof-Profil seit dem Laden der Seite geändert wurde — nur das geht
 * über den frischen Stand (speichereProfil). Ein älterer Tab des Hof-Profils
 * schickte sonst Name, Adresse oder Kontakt vom Laden mit und schriebe damit
 * zurück, was inzwischen in Mein Hof gespeichert wurde. Verglichen werden
 * einfache Werte (Text, Zahl, null). Ist ein Teil der Adresse geändert, geht
 * die ganze Adresse dieses Tabs (ADRESSE).
 *
 * Ein Wert, der auf den Stand vom Laden zurückgesetzt wurde, gilt als
 * unverändert — dann gewinnt der frische Wert eines anderen Tabs. Der
 * Kartenpunkt gilt erst ab KARTENPUNKT_TOLERANZ_GRAD als bewegt.
 */
export function geaendertSeitLaden(anfang: ProfileFormData, jetzt: ProfileFormData): ProfilTeil {
  const teil: ProfilTeil = {}
  for (const feld of Object.keys(jetzt) as (keyof ProfileFormData)[]) {
    if (!unveraendert(feld, anfang[feld], jetzt[feld])) setze(teil, feld, jetzt[feld])
  }
  if (ADRESSE.some((feld) => feld in teil)) {
    for (const feld of ADRESSE) setze(teil, feld, jetzt[feld])
  }
  return teil
}
