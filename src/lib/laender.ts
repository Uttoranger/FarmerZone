/**
 * Die Länder, in denen ein Hof liegen darf — heute Österreich und
 * Deutschland. Rein und ohne Abhängigkeiten, damit Schema-Validierung,
 * Geokodierung, Profilformular und Admin-Liste EINE Quelle teilen.
 *
 * Warum überhaupt Deutschland: Im Innviertel liegt Bayern näher als halbe
 * Bundesländer — Simbach und Braunau trennt eine Brücke. Die Plattform ist
 * dort aber noch nicht so weit (Steuer, Rechtstexte, Stripe): Deutsche Höfe
 * dürfen sich einrichten, werden aber nicht beiläufig freigeschaltet.
 * Deshalb steht der Vorbereitungs-Hinweis hier neben dem Land selbst.
 */

export const LAENDER = ['AT', 'DE'] as const
export type Land = (typeof LAENDER)[number]

/** Voreinstellung für Bestandshöfe und Neuanlagen (Schema-Default „AT"). */
export const LAND_VORGABE: Land = 'AT'

export const LAND_LABEL: Record<Land, string> = {
  AT: 'Österreich',
  DE: 'Deutschland',
}

/** Der Genitiv für Sätze wie „außerhalb Österreichs" — als Tabelle, damit
 *  ein drittes Land nicht still in einer Fallunterscheidung landet. */
export const LAND_GENITIV: Record<Land, string> = {
  AT: 'Österreichs',
  DE: 'Deutschlands',
}

/** Der ISO-Code für Nominatim (Kleinschreibung, wie der Dienst ihn erwartet). */
export const LAND_CODE: Record<Land, string> = { AT: 'at', DE: 'de' }

/** Beide Codes für die Umkreissuche: `countrycodes=at,de` — die Kundin darf
 *  über die Grenze suchen, ohne das Land anzugeben. */
export const UMKREIS_LAENDER_CODES = LAENDER.map((l) => LAND_CODE[l]).join(',')

/**
 * Ein unbekannter Wert wird zu einem gültigen Land — alles, was nicht
 * ausdrücklich „DE" ist, gilt als „AT". Bewusst nachsichtig statt werfend:
 * Die Spalte hat einen Default, aber gelesen wird sie an vielen Stellen, und
 * ein Datenmüll-Wert soll die Hofseite nicht zerlegen.
 */
export function alsLand(wert: unknown): Land {
  return wert === 'DE' ? 'DE' : LAND_VORGABE
}

/**
 * Der Vorbereitungs-Hinweis für deutsche Höfe — EIN Wortlaut für das
 * Hofprofil (bei der Länderwahl) und den bestehenden Warte-Hinweis der
 * Übersicht. Ruhig formuliert, kein Warnbalken: Der Hof hat nichts falsch
 * gemacht, wir sind noch nicht so weit.
 */
export const DE_VORBEREITUNG_HINWEIS =
  'Deutschland bereiten wir gerade vor. Du kannst deinen Hof schon vollständig ' +
  'einrichten — die Freischaltung dauert bei deutschen Höfen etwas länger, weil ' +
  'wir vorher steuerliche und rechtliche Fragen klären. Wir melden uns per E-Mail.'

/**
 * Die Erinnerung im Admin-Bereich neben der Freischalt-Schaltfläche. KEINE
 * Sperre — der Betreiber entscheidet, die Zeile hält nur fest, was vorher
 * geklärt sein muss.
 */
export const DE_ADMIN_KLAERUNG =
  'Vor der Freischaltung klären: Stripe-Konto in DE, steuerliche Behandlung, Kennzeichnungspflichten.'
