import { blobSpeicherAusSchluessel, istEigeneBildUrl } from '@/lib/upload-pfade'

/**
 * Die Prüfung jeder Aktion, die eine Bild-Adresse speichert (Galerie,
 * Titelbild, Logo, Produktbild, Beitragsfoto, Screenshot einer Meldung):
 * nur Bilder dieses Hofes aus unserem eigenen Blob-Speicher. Sonst stünde auf
 * der Hofseite, in Mails an Abonnentinnen oder im Admin eine Adresse, die
 * jemand frei gewählt hat — ein Bild von fremdem Server (Zählpixel), ein Bild
 * eines anderen Hofes, oder eines, das nachträglich ausgetauscht wird.
 *
 * Der Speicher kommt aus `BLOB_READ_WRITE_TOKEN` — demselben Schlüssel, mit
 * dem der Upload schreibt. Fehlt er, ist keine Adresse erlaubt (fail-closed);
 * ohne ihn gäbe es auch keinen Upload.
 */
export function istEigenesBild(url: string, farmId: string): boolean {
  return istEigeneBildUrl(url, farmId, blobSpeicherAusSchluessel(process.env.BLOB_READ_WRITE_TOKEN))
}

/**
 * Darf diese Bild-Adresse gespeichert werden?
 *
 * Leer (Bild entfernen) geht immer. Eine fremde Adresse nur, wenn sie
 * UNVERÄNDERT schon gespeichert ist: Eine nachträgliche Prüfung sperrt keinen
 * Bestand (CODING_STANDARDS §8) — ein Altbild aus der Zeit vor dieser Prüfung
 * darf beim Speichern anderer Felder stehen bleiben. `bisher` wird nur
 * gelesen, wenn es darauf ankommt (keine Abfrage für den Normalfall).
 */
export async function bildUrlErlaubt(
  neu: string | null | undefined,
  farmId: string,
  bisher?: () => Promise<string | null | undefined>
): Promise<boolean> {
  if (neu === null || neu === undefined || neu === '') return true
  if (typeof neu !== 'string') return false
  if (istEigenesBild(neu, farmId)) return true
  if (!bisher) return false
  return (await bisher()) === neu
}

/** Der Satz für den Hof, wenn eine Bild-Adresse abgelehnt wird — mit Ausweg. */
export const BILD_NICHT_UEBERNOMMEN = 'Dieses Foto konnten wir nicht übernehmen. Bitte lade es noch einmal hoch.'
