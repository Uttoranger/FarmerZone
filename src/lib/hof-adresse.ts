/**
 * Frei-Prüfung der künftigen Hofadresse für die Vorschau unter dem Hofnamen
 * (HofAdresseVorschau, Registrieren und Einrichten). Die Prüfung selbst
 * (checkSlugAvailability) kommt als Parameter herein — so bleibt das Modul
 * rein und ohne Server-Abhängigkeit testbar.
 */

export type AdressStand = { slug: string; frei: boolean }

type PruefeAdresse = (hofname: string) => Promise<{ slug: string; available: boolean }>

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
    return { slug: ergebnis.slug, frei: ergebnis.available }
  } catch {
    return null
  }
}
