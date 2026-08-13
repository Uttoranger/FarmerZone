// Warum ein Foto-Upload gescheitert ist — und was der Bauer dagegen tun kann.
//
// Vorher gab es dafür praktisch eine Antwort: „falsches Format". Die stimmt
// aber nur für eine von inzwischen DREI völlig verschiedenen Ursachen. Sie
// werden in genau dieser Reihenfolge geprüft, weil jede die nächste erst
// möglich macht — wer nicht lesen kann, kann auch nicht dekodieren:
//
//   lesen        Der Browser bekommt die Bytes gar nicht erst. Auf Android
//                liefern manche Speicherdienste (SD-Backup, App-Alben,
//                Cloud-Alben) eine Datei-Referenz aus, hinter der beim
//                Zugriff nichts mehr steht. Das Foto ist einwandfrei, der
//                Weg dorthin nicht. Ein anderes Format zu wählen hilft
//                NICHT — die Datei muss erst lokal gespeichert werden.
//
//   dekodierung  Die Bytes sind da, aber der Browser versteht sie nicht.
//                Klassiker: ein HEIC-Foto vom iPhone, auf Android geöffnet.
//                Ein anderes Format wählen hilft — die Meldung stimmt.
//
//   kodierung    Der Browser KONNTE die Datei lesen und verstehen, darf sie
//                aber nicht über den Canvas wieder herausgeben: toBlob liefert
//                null oder wirft, oder es gibt gar keinen 2D-Kontext. Keine
//                Formatfrage, sondern eine Datenschutz-Einstellung — Braves
//                Fingerprint-Schutz ist der gemeldete Fall.
//
// Warum „lesen" überhaupt nötig wurde: Bis dahin fasste NIEMAND die Bytes an,
// bevor die Dekodier-Probe urteilte. Ein Speicherdienst, der nichts liefert,
// ließ damit nur img.onerror feuern — ununterscheidbar von einem unbekannten
// Format. Forensisch einwandfreie JPEGs bekamen so browserübergreifend die
// Format-Meldung, und der Rat darin konnte nie helfen.
//
// Reine Zuordnung ohne DOM, damit sie ohne Browser prüfbar ist — Canvas und
// createImageBitmap selbst lassen sich in jsdom nicht sinnvoll nachstellen.

export type BildFehlerArt = 'lesen' | 'dekodierung' | 'kodierung'

/**
 * DIAGNOSE-KENNUNG DER PILOTPHASE — temporär.
 *
 * Jede Meldung endet auf ein Kürzel wie „[F62]": Buchstabe für die Ursache
 * (L = lesen, F = Format, B = blockiert), Zahl für den Code-Stand. Ohne das
 * sind die Meldungstexte über Stände hinweg identisch, und ein zugeschicktes
 * Bildschirmfoto verrät nicht, welcher Stand es erzeugt hat — bei einem Fehler,
 * der nur auf fremden Geräten auftritt, ist das der Unterschied zwischen
 * „gefixt" und „vielleicht gefixt".
 *
 * Die Zahl wird bei künftigen Upload-Änderungen hochgezählt. Nach der
 * Stabilisierung wird das Werkzeug wieder entfernt: Kennung hier löschen, die
 * Meldungen enden dann wieder auf ihren letzten Satz.
 */
export const UPLOAD_DIAG = '62'

/** Hängt die Kennung an eine Meldung. Ein Ort, alle Meldungen. */
function mitKennung(text: string, buchstabe: 'L' | 'F' | 'B' | 'X'): string {
  return `${text} [${buchstabe}${UPLOAD_DIAG}]`
}

/** Neu: die Bytes kommen nicht beim Browser an. */
export const IMAGE_READ_ERROR = mitKennung(
  'Die Datei konnte nicht aus ihrem Speicherort gelesen werden. Bitte speichere das Foto ' +
    'zuerst über Teilen → „Eigene Dateien" und wähle es von dort aus.',
  'L'
)

/** Unverändert im Wortlaut: der Browser versteht das Format nicht. */
export const IMAGE_FORMAT_ERROR = mitKennung(
  'Dieses Bildformat unterstützt dein Browser nicht (z. B. HEIC) — bitte JPEG oder PNG wählen',
  'F'
)

/**
 * Lesen und Verstehen ging, Verarbeiten nicht. Die Meldung nennt die Ursache
 * beim Namen und die zwei Wege heraus — ohne sie sucht der Bauer den Fehler bei
 * seinem Foto und findet ihn nie.
 */
export const IMAGE_ENCODE_BLOCKED_ERROR = mitKennung(
  'Dein Browser blockiert die Bildverarbeitung — das ist meist eine Datenschutz-Einstellung ' +
    '(z. B. Braves Fingerprint-Schutz). Bitte den Schutz für diese Seite lockern oder einen ' +
    'anderen Browser verwenden.',
  'B'
)

/**
 * Rückfall für eine Ursache, die es hier nicht gibt.
 *
 * Der Typ verspricht drei Arten, zur Laufzeit kann trotzdem etwas anderes
 * ankommen — ein alter Bundle-Stand nach einem Deployment, ein Wert über eine
 * Modulgrenze. Dann darf NICHT eine der drei echten Meldungen erscheinen: Eine
 * falsche Ursache ist schlimmer als gar keine, das ist die Lehre dieser ganzen
 * Reihe. Also eine ehrlich unbestimmte Meldung — mit eigener Kennung, damit ein
 * Bildschirmfoto diesen Fall sofort als das ausweist, was er ist: ein Fehler
 * in unserem Code, nicht am Foto.
 */
export const IMAGE_UNKNOWN_ERROR = mitKennung(
  'Das Foto konnte nicht hochgeladen werden. Bitte versuche es noch einmal oder wähle ein ' +
    'anderes Foto.',
  'X'
)

/** Kurzgründe für die Sammelmeldung einer Serie (src/lib/upload-batch.ts). */
const KURZ: Record<BildFehlerArt, string> = {
  lesen: 'Datei nicht lesbar',
  dekodierung: 'Format nicht unterstützt',
  kodierung: 'Bildverarbeitung blockiert',
}

const TEXT: Record<BildFehlerArt, string> = {
  lesen: IMAGE_READ_ERROR,
  dekodierung: IMAGE_FORMAT_ERROR,
  kodierung: IMAGE_ENCODE_BLOCKED_ERROR,
}

/**
 * Volle Meldung für den Hinweis-Toast.
 *
 * Das `??` sieht für TypeScript nach totem Code aus — der Typ lässt nichts
 * anderes zu. Es steht trotzdem da, weil der Typ nur zur Übersetzungszeit gilt
 * und dieser Pfad genau für den Fall existiert, in dem er nicht mehr stimmt.
 */
export function bildFehlerText(art: BildFehlerArt): string {
  return TEXT[art] ?? IMAGE_UNKNOWN_ERROR
}

/** Kurzform für die Sammelmeldung, wenn mehrere Fotos auf einmal laufen. */
export function bildFehlerKurz(art: BildFehlerArt): string {
  return KURZ[art] ?? 'Upload fehlgeschlagen'
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
    if (art === 'lesen' || art === 'dekodierung' || art === 'kodierung') return art
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
