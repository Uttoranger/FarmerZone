/**
 * Frei-Prüfung der künftigen Hofadresse für die Vorschau unter dem Hofnamen
 * (HofAdresseVorschau, Registrieren und Einrichten). Die Prüfung selbst
 * (checkSlugAvailability) kommt als Parameter herein — so bleibt das Modul
 * rein und ohne Server-Abhängigkeit testbar.
 */

export type AdressStand = { slug: string; frei: boolean }

/**
 * Antwort der Prüfung: nur „frei" oder „vergeben" — ob ein vergebener Name
 * einem freigeschalteten oder einem wartenden Hof gehört, sagt sie nie.
 * `null` heißt „keine Auskunft" (Eingabe ungültig oder Bremse erreicht);
 * die Vorschau bleibt dann neutral.
 */
export type AdressPruefung = { slug: string; available: boolean } | null

type PruefeAdresse = (hofname: string) => Promise<AdressPruefung>

/**
 * So viele Prüfungen je IP und Minute lässt checkSlugAvailability in
 * Produktion zu. Die Vorschau fragt erst 400 ms nach dem letzten Tastendruck;
 * wer einen Namen tippt und verbessert, kommt kaum auf zehn — eine Schleife,
 * die Hofnamen durchprobiert, sofort. Hinter einem Mobilfunk-NAT teilen sich
 * mehrere Menschen eine IP, daher bewusst großzügig. Darüber gibt es keine
 * Auskunft (null), keinen Fehler.
 */
export const ADRESS_PRUEFUNG_MAX_PRO_MINUTE = 30

/**
 * Fragt, ob die Adresse zum Hofnamen frei ist. Schlägt die Anfrage fehl
 * (Netz weg, Server-Fehler), gibt es keinen Stand: Die Vorschau bleibt dann
 * neutral, statt „frei" oder „vergeben" zu behaupten. Bewusst ohne Meldung
 * nach Sentry — die Vorschau ist nur ein Hinweis, createFarm hängt bei einem
 * vergebenen Namen ohnehin eine Zahl an, und ein Funkloch beim Tippen ist
 * kein Fehler der App.
 */
export async function frageAdresseAb(hofname: string, pruefe: PruefeAdresse): Promise<AdressStand | null> {
  try {
    const ergebnis = await pruefe(hofname)
    if (!ergebnis) return null
    return { slug: ergebnis.slug, frei: ergebnis.available }
  } catch {
    return null
  }
}
