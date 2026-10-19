/**
 * Was robots.txt Crawlern verbietet (Register N19, Filter-Falle auf /hoefe) —
 * die eine Liste; die Metadaten-Route `src/app/robots.ts` gibt sie nur aus.
 *
 * ROBOTS IST KEIN SCHUTZ: Ein Crawler darf die Datei übergehen. Geschützt wird
 * weiter über die Anmeldung (src/proxy.ts und die Prüfung in jeder Seite) und
 * über signierte Links (/teilen, Bestellungen). Die Sperre spart nur Aufrufe,
 * die niemandem nützen.
 */

/**
 * Entdecken mit Filtern: Jede Filterkombination ist eine eigene Adresse — ein
 * Crawler fände unbegrenzt viele (19.10.2026: 622.000 Aufrufe an einem Tag).
 * Die Seite selbst (/hoefe ohne Parameter) bleibt erlaubt.
 */
export const HOEFE_MIT_PARAMETERN = '/hoefe?'

/**
 * Die angemeldeten und privaten Bereiche. Der Hofbereich sind genau die Pfade
 * aus FARMER_PATHS in src/proxy.ts — tests/robots.test.ts gleicht beide ab.
 */
export const PRIVATE_BEREICHE = [
  '/dashboard',
  '/orders',
  '/products',
  '/sales',
  '/analytics',
  '/settings',
  '/customers',
  '/farm-page',
  '/status',
  '/fehler-melden',
  '/meldungen',
  '/region',
  '/postfach',
  '/admin',
  '/account',
  '/intern',
  '/api',
  '/onboarding',
  '/verify',
  '/reset-password',
  '/bestellungen',
  '/teilen',
  // „Das warst nicht du?" (Nr. 114): Links aus Mails, mit Token.
  '/sicherheit',
] as const

/**
 * Die Disallow-Zeilen: /hoefe mit Parametern, dazu je Bereich der Pfad selbst
 * (`$` verankert das Ende, RFC 9309), mit Parametern (`?`) und alles darunter
 * (`/`). Kein blankes Präfix: „/region" sperrte sonst auch die Hofseite
 * /regionalhof-… — ein Slug ist frei wählbar. Ein Crawler ohne `$` liest den
 * Pfad selbst als erlaubt; dort leitet die Anmeldung um.
 */
export function gesperrtePfade(): string[] {
  return [HOEFE_MIT_PARAMETERN, ...PRIVATE_BEREICHE.flatMap((bereich) => [`${bereich}$`, `${bereich}?`, `${bereich}/`])]
}
