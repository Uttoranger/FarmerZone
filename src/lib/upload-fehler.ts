// Warum ein Foto-Upload gescheitert ist — und was der Bauer dagegen tun kann.
//
// Seit der Umstellung auf die serverseitige Verarbeitung sieht die Welt anders
// aus als in den Sprints davor. Der Browser verkleinert nichts mehr; er sendet
// die Datei, wie sie ist. Damit verschwinden die beiden Ursachen, die aus der
// Canvas-Arbeit stammten ('dekodierung' und 'kodierung' im alten Sinn), und es
// bleiben drei, die sich sauber danach trennen, WER gescheitert ist:
//
//   lesen    Der Speicherdienst des Geräts gibt die Datei nicht heraus
//            (Android-App-Alben, SD-Backup). Ein anderes Format hilft NICHT —
//            die Datei muss erst lokal gespeichert werden.
//
//   format   Der Server hat die Bytes, kann sie aber nicht als Bild lesen.
//            Das ist jetzt eine BEWIESENE Aussage: sharp hat es versucht und
//            abgelehnt — nicht mehr eine Vermutung aus einem gescheiterten
//            Canvas. Ein echtes HEIF-Foto landet hier.
//
//   server   Alles Übrige auf unserer Seite. Das ist kein Rat an den Bauern,
//            sondern ein Eingeständnis: bei uns ist etwas schiefgegangen.
//
// Verbindungsabbrüche beim Senden sind BEWUSST keine vierte Ursache: Ein
// Abbruch sagt nichts über das Foto aus — nach dem Neuversuch im WLAN läuft
// dieselbe Datei durch. Sie bekommen einen eigenen schlichten Text
// (IMAGE_NETWORK_ERROR) und laufen als gewöhnlicher Error unverändert durch
// bildFehlerMeldung, statt eine der Foto-Ursachen zu usurpieren.
//
// Was dabei gewonnen ist: Keine dieser Ursachen hängt mehr an einer Fähigkeit
// des Browsers, die wir nicht kontrollieren. Der Fingerprint-Schutz, an dem sich
// die Sprints #59 bis #63 abgearbeitet haben, kann hier nichts mehr blockieren —
// es gibt keinen Canvas mehr, den er blockieren könnte.
//
// Reine Zuordnung ohne DOM, damit sie ohne Browser prüfbar ist.

export type BildFehlerArt = 'lesen' | 'format' | 'server'

/**
 * DIAGNOSE-KENNUNG DER PILOTPHASE — temporär.
 *
 * Jede Meldung endet auf ein Kürzel wie „[F64]": Buchstabe für die Ursache
 * (L = lesen, F = Format, S = Server), Zahl für den Code-Stand. Ohne das sind
 * die Meldungstexte über Stände hinweg identisch, und ein zugeschicktes
 * Bildschirmfoto verrät nicht, welcher Stand es erzeugt hat — bei einem Fehler,
 * der nur auf fremden Geräten auftritt, ist das der Unterschied zwischen
 * „gefixt" und „vielleicht gefixt".
 *
 * Von '62' auf '64' gezählt, weil dieser Umbau die Ursachen selbst ausgetauscht
 * hat: Ein „[F62]" auf einem Bildschirmfoto stammt aus der Canvas-Zeit, ein
 * „[F64]" vom Server. Die Zahl wird bei künftigen Upload-Änderungen weiter
 * hochgezählt. Nach der Stabilisierung wird das Werkzeug wieder entfernt:
 * Kennung hier löschen, die Meldungen enden dann wieder auf ihren letzten Satz.
 */
export const UPLOAD_DIAG = '64'

/** Hängt die Kennung an eine Meldung. Ein Ort, alle Meldungen. */
function mitKennung(text: string, buchstabe: 'L' | 'F' | 'S' | 'X'): string {
  return `${text} [${buchstabe}${UPLOAD_DIAG}]`
}

/**
 * WICHTIG: Die Fehlerklasse „Datei nicht lesbar" ([L]) liegt VOR der App und
 * wird durch den serverseitigen Umbau nicht geheilt — der Speicherdienst des
 * Geräts verweigert die Herausgabe, bevor irgendetwas von uns läuft. Ihre
 * Meldung samt „Eigene Dateien"-Ausweg bleibt deshalb zentral.
 */
export const IMAGE_READ_ERROR = mitKennung(
  'Die Datei konnte nicht aus ihrem Speicherort gelesen werden. Bitte speichere das Foto ' +
    'zuerst über Teilen → „Eigene Dateien" und wähle es von dort aus.',
  'L'
)

/**
 * Wortlaut unverändert seit #59 — aber die Aussage steht jetzt auf festem
 * Grund: Der Server hat die Datei in der Hand gehabt und sie nicht als Bild
 * lesen können. Vorher war es ein Schluss aus einem gescheiterten Canvas.
 */
export const IMAGE_FORMAT_ERROR = mitKennung(
  'Dieses Bildformat unterstützt dein Browser nicht (z. B. HEIC) — bitte JPEG oder PNG wählen',
  'F'
)

/**
 * Unser Fehler, nicht seiner. Deshalb kein Rat, was er anders machen soll —
 * nur die einzige Handlung, die tatsächlich hilft: noch einmal versuchen.
 */
export const IMAGE_SERVER_ERROR = mitKennung(
  'Das Bild konnte gerade nicht verarbeitet werden — bitte nochmal versuchen.',
  'S'
)

/**
 * Verbindungsabbruch beim Senden — BEWUSST keine vierte Ursache.
 *
 * Ein Abbruch sagt nichts über das Foto; die Ursachen oben beschreiben das
 * Foto. Darum kein BildFehler: Dieser Text wird als gewöhnlicher `Error`
 * geworfen und läuft durch bildFehlerMeldung unverändert durch (`art: null`).
 * Die S-Kennung trägt er trotzdem, weil die Handlungsempfehlung dieselbe ist
 * wie beim Serverfehler — nochmal versuchen — und ein Bildschirmfoto auch von
 * dieser Meldung den Code-Stand verraten soll.
 */
export const IMAGE_NETWORK_ERROR = mitKennung(
  'Verbindung unterbrochen — bitte nochmal versuchen.',
  'S'
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
  format: 'Format nicht unterstützt',
  server: 'Verarbeitung fehlgeschlagen',
}

const TEXT: Record<BildFehlerArt, string> = {
  lesen: IMAGE_READ_ERROR,
  format: IMAGE_FORMAT_ERROR,
  server: IMAGE_SERVER_ERROR,
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
    if (art === 'lesen' || art === 'format' || art === 'server') return art
  }
  return null
}

/**
 * Was einem gefangenen Fehler an Meldung zusteht.
 *
 * `art` ist null, wenn der Fehler nichts mit dem Foto zu tun hat — dann bleibt
 * es bei seiner eigenen Meldung, und es wird auch nichts protokolliert.
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
 * Kurze Notiz auf der Konsole — ausschließlich außerhalb der Produktion,
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
