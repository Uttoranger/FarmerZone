// Warum ein Foto-Upload gescheitert ist — und was der Bauer dagegen tun kann.
//
// Vorher gab es dafür praktisch eine Antwort: „falsches Format". Die stimmt
// aber nur für die eine von zwei völlig verschiedenen Ursachen:
//
//   dekodierung  Der Browser kann die Datei nicht lesen. Klassiker: ein
//                HEIC-Foto vom iPhone, auf Android geöffnet. Ein anderes
//                Format wählen hilft — die Meldung stimmt.
//
//   kodierung    Der Browser KONNTE die Datei lesen, darf sie aber nicht
//                über den Canvas wieder herausgeben: toBlob liefert null oder
//                wirft, oder es gibt gar keinen 2D-Kontext. Das ist keine
//                Formatfrage, sondern eine Datenschutz-Einstellung — Braves
//                Fingerprint-Schutz ist der gemeldete Fall. Ein anderes Foto
//                zu wählen hilft hier NICHT, und genau das riet die alte
//                Meldung: „bitte JPEG oder PNG wählen", obwohl bereits ein
//                einwandfreies JPEG ausgewählt war.
//
// Reine Zuordnung ohne DOM, damit sie ohne Browser prüfbar ist — Canvas und
// createImageBitmap selbst lassen sich in jsdom nicht sinnvoll nachstellen.

export type BildFehlerArt = 'dekodierung' | 'kodierung'

/** Unverändert: der Browser kann die Datei nicht lesen. */
export const IMAGE_FORMAT_ERROR =
  'Dieses Bildformat unterstützt dein Browser nicht (z. B. HEIC) — bitte JPEG oder PNG wählen'

/**
 * Neu: lesen ging, verarbeiten nicht. Die Meldung nennt die Ursache beim Namen
 * und die zwei Wege heraus — ohne sie sucht der Bauer den Fehler bei seinem
 * Foto und findet ihn nie.
 */
export const IMAGE_ENCODE_BLOCKED_ERROR =
  'Dein Browser blockiert die Bildverarbeitung — das ist meist eine Datenschutz-Einstellung ' +
  '(z. B. Braves Fingerprint-Schutz). Bitte den Schutz für diese Seite lockern oder einen ' +
  'anderen Browser verwenden.'

/** Kurzgründe für die Sammelmeldung einer Serie (src/lib/upload-batch.ts). */
const KURZ: Record<BildFehlerArt, string> = {
  dekodierung: 'Format nicht unterstützt',
  kodierung: 'Bildverarbeitung blockiert',
}

const TEXT: Record<BildFehlerArt, string> = {
  dekodierung: IMAGE_FORMAT_ERROR,
  kodierung: IMAGE_ENCODE_BLOCKED_ERROR,
}

/** Volle Meldung für den Hinweis-Toast. */
export function bildFehlerText(art: BildFehlerArt): string {
  return TEXT[art]
}

/** Kurzform für die Sammelmeldung, wenn mehrere Fotos auf einmal laufen. */
export function bildFehlerKurz(art: BildFehlerArt): string {
  return KURZ[art]
}

/**
 * Fehler mit Ursache. Die Meldung steckt schon drin, damit auch ein Aufrufer,
 * der nur `error.message` kennt, den richtigen Text zeigt.
 *
 * `bildFehlerArt` liegt zusätzlich als eigenes Feld auf dem Objekt: `instanceof`
 * ist die schnellere Prüfung, hält aber nicht, wenn die Klasse in zwei Bundles
 * landet. Das Feld hält immer.
 */
export class BildFehler extends Error {
  readonly bildFehlerArt: BildFehlerArt

  constructor(art: BildFehlerArt) {
    super(bildFehlerText(art))
    this.name = 'BildFehler'
    this.bildFehlerArt = art
  }
}

/** Erkennt einen BildFehler auch dann, wenn `instanceof` nicht greift. */
export function bildFehlerArtVon(e: unknown): BildFehlerArt | null {
  if (e instanceof BildFehler) return e.bildFehlerArt
  if (typeof e === 'object' && e !== null && 'bildFehlerArt' in e) {
    const art = (e as { bildFehlerArt: unknown }).bildFehlerArt
    if (art === 'dekodierung' || art === 'kodierung') return art
  }
  return null
}

/**
 * Was einem gefangenen Fehler an Meldung zusteht.
 *
 * `art` ist null, wenn der Fehler nichts mit der Bildverarbeitung zu tun hat
 * (Netzwerk, Server-Antwort) — dann bleibt es bei seiner eigenen Meldung, und
 * es wird auch nichts protokolliert.
 */
export function bildFehlerMeldung(e: unknown): {
  text: string
  kurz: string
  art: BildFehlerArt | null
} {
  const art = bildFehlerArtVon(e)
  if (art) return { text: bildFehlerText(art), kurz: bildFehlerKurz(art), art }

  const text = e instanceof Error ? e.message : 'Upload fehlgeschlagen'
  return { text, kurz: text, art: null }
}

/**
 * Kurze Notiz auf der Serverkonsole — ausschließlich außerhalb der Produktion,
 * Muster wie in src/lib/auth.ts.
 *
 * Bewusst OHNE Dateinamen: „Hof_Mueller_Franz.jpg" ist ein personenbezogenes
 * Datum. MIME-Typ und Größe reichen, um im Zweifel nachzuvollziehen, woran es
 * lag, und sagen über niemanden etwas aus.
 */
export function protokolliereBildFehler(
  art: BildFehlerArt,
  datei: { type: string; size: number }
): void {
  if (process.env.NODE_ENV === 'production') return
  const kb = Math.round(datei.size / 1024)
  console.log(`[DEV] Foto abgewiesen (${art}): ${datei.type || 'Typ unbekannt'}, ${kb} kB`)
}
