/**
 * Die Pfade des Hofbereichs — EINE Liste für den Proxy (src/proxy.ts), für
 * robots.txt (src/lib/robots.ts) und für den Rücksprung nach der Anmeldung
 * (zielNachHofAnmeldung in src/lib/anmeldecode.ts, Nr. 156).
 *
 * Alle Ordner unter src/app/(farmer) und src/app/(hof); tests/proxy-pfade.test.ts
 * hält Liste und `matcher` des Proxys vollständig. Ohne Server-Importe, weil
 * anmeldecode.ts auch im Browser läuft.
 */
export const FARMER_PATHS = [
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
] as const

/** Ein Pfad des Hofbereichs: genau ein Eintrag oder darunter — „/ordersx" ist keiner. */
export function istHofPfad(pfad: string): boolean {
  return FARMER_PATHS.some((p) => pfad === p || pfad.startsWith(p + '/'))
}

/**
 * Der Kopf, über den die Wache einer Hof-Seite (verlangeHofDerSitzung) ihren
 * Pfad erfährt — ein Layout und eine Seite kennen ihn sonst nicht. Gesetzt
 * NUR im Proxy, mit `set`: Ein mitgeschickter Wert wird überschrieben. Er gilt
 * trotzdem als Eingabe, kommt nur geprüft in eine Adresse (hofAnmeldeAdresse)
 * und wird nie geloggt.
 */
export const HOF_PFAD_KOPF = 'x-hof-pfad'
