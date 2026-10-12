// Legt in der Beispiel-App eine Bestellung an. Läuft nur auf dem Server.
// Dieser zweite Zeilenkommentar gehört zum selben Kopf.
export async function legeBestellungAn(name: string): Promise<{ ok: true; name: string }> {
  return { ok: true, name }
}
