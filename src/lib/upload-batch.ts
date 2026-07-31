/**
 * Sammelergebnis einer Foto-Serie (Mehrfachauswahl in der Galerie).
 *
 * Bewusst reine Funktion ohne DOM: Ein einzelnes fehlerhaftes Foto darf die
 * Serie nicht abbrechen, am Ende steht EINE Meldung — die wird hier gebaut
 * und ist damit ohne Browser prüfbar.
 */

export type BatchSkip = {
  /** Dateiname, damit der Bauer weiß, welches Foto fehlt */
  name: string
  /** Kurzer Grund, z. B. „Format nicht unterstützt" */
  reason: string
}

// Auf dem Telefon muss die Meldung lesbar bleiben — ab dem vierten
// übersprungenen Foto wird nur noch gezählt statt aufgezählt.
const MAX_NAMEN = 3

export function summarizeUploadBatch(uploaded: number, skipped: BatchSkip[]): string {
  const kopf = `${uploaded} ${uploaded === 1 ? 'Foto' : 'Fotos'} hochgeladen`
  if (skipped.length === 0) return kopf

  const gezeigt = skipped.slice(0, MAX_NAMEN).map((s) => `${s.name} — ${s.reason}`)
  const rest = skipped.length - gezeigt.length
  const liste = rest > 0 ? `${gezeigt.join('; ')} und ${rest} weitere` : gezeigt.join('; ')

  return `${kopf}, ${skipped.length} übersprungen: ${liste}`
}
