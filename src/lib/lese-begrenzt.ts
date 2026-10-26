/*
 * Den Körper einer Anfrage begrenzt lesen — die EINE Hilfe für Routen, die
 * Fremdtext von außen annehmen (/api/csp-bericht, /api/webhooks/resend;
 * Nr. 170). Die Angabe `content-length` des Absenders prüft die Route vorher
 * selbst; gezählt wird trotzdem hier, denn die Angabe kann fehlen oder lügen.
 */

/**
 * Liest höchstens `max` Bytes als UTF-8; null = mehr geschickt (dann wird
 * nicht weitergelesen, der Datenstrom wird abgebrochen). Ohne Körper ''.
 * Bricht der Absender den Datenstrom ab, wirft `read()` — das fängt die Route.
 */
export async function leseBegrenzt(request: Request, max: number): Promise<string | null> {
  if (!request.body) return ''
  const leser = request.body.getReader()
  const teile: Uint8Array[] = []
  let laenge = 0
  for (;;) {
    const { done, value } = await leser.read()
    if (done) break
    laenge += value.byteLength
    if (laenge > max) {
      await leser.cancel()
      return null
    }
    teile.push(value)
  }
  return Buffer.concat(teile).toString('utf8')
}
