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
 * (E = Leseerlaubnis entzogen, L = Lesen blieb stumm, D = Lesen gescheitert
 * ohne erkennbaren Grund, F = Format, S = Server, B = Bildspeicher,
 * X = unbestimmt), Zahl für den Code-Stand. Ohne das sind die Meldungstexte
 * über Stände hinweg
 * identisch, und ein zugeschicktes Bildschirmfoto verrät nicht, welcher Stand
 * es erzeugt hat — bei einem Fehler, der nur auf fremden Geräten auftritt, ist
 * das der Unterschied zwischen „gefixt" und „vielleicht gefixt".
 *
 * DIE ZÄHL-REGEL: Bei JEDER Verhaltensänderung am Upload-Ablauf auf die
 * Nummer des Sprints heben — eine veraltete Kennung ist schlimmer als keine,
 * denn sie behauptet einen Stand, der nicht mehr stimmt. Genau das war
 * passiert: '64' blieb stehen, während #66 (Zeitwächter), #69 (Stückelung
 * und Zweitversuch) und #71 (Quellen) das Verhalten änderten. Die Regel
 * steht auch in DEVELOPMENT.md („Upload-Diagnose") und ist im Test mit
 * Literal festgenagelt. Nach der Stabilisierung wird das Werkzeug wieder
 * entfernt: Kennung hier löschen, die Meldungen enden dann wieder auf ihren
 * letzten Satz.
 */
export const UPLOAD_DIAG = '135'

/** Hängt die Kennung an eine Meldung. Ein Ort, alle Meldungen. */
function mitKennung(text: string, buchstabe: 'E' | 'L' | 'D' | 'F' | 'S' | 'B' | 'X'): string {
  return `${text} [${buchstabe}${UPLOAD_DIAG}]`
}

/**
 * Die Datei kommt nicht heraus, WEIL DIE QUELLE STUMM BLEIBT ([L]) — das
 * Zeitlimit lief ab, ohne Bytes und ohne Fehler. Das ist die Signatur des
 * cloud-ausgelagerten Fotos: Die Galerie zeigt das Bild, der Abruf aus der
 * Cloud kommt nie zurück (Samsung-/OneDrive-Alben, „Speicher freigeben").
 * Die Meldung ist deshalb ein WEGWEISER auf die drei Wege, die daran
 * vorbeiführen: die Dokument-Auswahl („Aus Dateien"), die Kamera, und das
 * Teilen an die installierte App — beim Teilen stellt die Galerie die Bytes
 * selbst bereit, inklusive Cloud-Abruf.
 *
 * Seit #135 NUR noch für den Ablauf am Zeitlimit. Vorher stand dieser Text
 * hinter jedem Lesefehler, auch hinter dem sofortigen NotReadableError bei
 * einem Foto, das 0 Tage alt war (JAVASCRIPT-NEXTJS-4) — dort war das
 * Cloud-Album eine Erfindung, und der Bauer suchte in seinen Album-
 * Einstellungen nach einem Fehler, den es nicht gab.
 */
export const IMAGE_READ_ERROR = mitKennung(
  'Dieses Foto kann von hier nicht gelesen werden — das passiert bei Cloud-Alben. Wähle es ' +
    'über ‚Aus Dateien‘, nimm es neu auf, oder teile es aus der Galerie direkt an FarmerZone.',
  'L'
)

/**
 * Die Leseerlaubnis ist weg ([E]) — der Browser lehnt SOFORT mit
 * NotReadableError ab („permission problems … after a reference to a file was
 * acquired"). Kein Abruf, kein Warten: Das Gerät hat die Freigabe für diese
 * Referenz zurückgezogen, meist weil zwischen Auswahl und Lesen etwas am
 * Datei-Feld geschrieben hat.
 *
 * Die Meldung nennt deshalb die einzige Handlung, die hier wirklich hilft:
 * dasselbe Foto noch einmal auswählen. Bewusst OHNE die drei Wegweiser-
 * Auswege — sie kosten den Bauern drei Versuche für ein Problem, das der
 * nächste Griff löst.
 */
export const IMAGE_READ_PERMISSION_ERROR = mitKennung(
  'Das Handy hat das Foto nicht freigegeben — bitte wähle es nochmal aus.',
  'E'
)

/**
 * Das Lesen ist gescheitert, aber keiner der beiden erkennbaren Gründe passt
 * ([D]): kein Ablauf am Zeitlimit, kein NotReadableError — ein NotFoundError
 * etwa, oder ein Fehler, dessen Name sich nicht einmal lesen ließ.
 *
 * Dann bleibt der Wegweiser auf die drei Auswege, aber OHNE eine Ursache zu
 * behaupten. Eine falsche Ursache ist schlimmer als gar keine; das ist die
 * Lehre dieser ganzen Reihe.
 */
export const IMAGE_READ_UNCLEAR_ERROR = mitKennung(
  'Dieses Foto konnte nicht gelesen werden. Wähle es über ‚Aus Dateien‘, nimm es neu auf, ' +
    'oder teile es aus der Galerie direkt an FarmerZone.',
  'D'
)

/**
 * Warum die Lese-Stufe gescheitert ist — aus Sicht des Bauern.
 *
 *   erlaubnis    Sofortige Ablehnung mit NotReadableError: die Freigabe für
 *                die Datei-Referenz ist weg.
 *   cloud        Die Quelle blieb stumm, bis ein Zeitwächter aufgab.
 *   unbestimmt   Alles andere. Ehrlich unbestimmt statt geraten.
 */
export type LeseUrteil = 'erlaubnis' | 'cloud' | 'unbestimmt'

const LESE_TEXT: Record<LeseUrteil, string> = {
  erlaubnis: IMAGE_READ_PERMISSION_ERROR,
  cloud: IMAGE_READ_ERROR,
  unbestimmt: IMAGE_READ_UNCLEAR_ERROR,
}

/** Meldung an den Bauern nach einer gescheiterten Lese-Stufe. */
export function leseFehlerText(urteil: LeseUrteil): string {
  return LESE_TEXT[urteil] ?? IMAGE_READ_UNCLEAR_ERROR
}

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
 * Der Bildspeicher hat das Foto nicht genommen — so meldet es sein SDK:
 * als Ablehnung (4xx) oder als „gerade nicht verfügbar" (5xx).
 *
 * Bis #129 bekam auch dieser Fall „Verbindung unterbrochen". Das schickte den
 * Bauern auf die Suche nach besserem Empfang, obwohl der Bildspeicher selbst
 * Nein gesagt hatte. Eigene Kennung B, damit ein Bildschirmfoto diesen Fall
 * vom Netzfehler unterscheidet. Wie der Netzfehler kein BildFehler: Die
 * Ablehnung sagt nichts über das Foto.
 *
 * Bekannte Unschärfe: Im gestückelten Weg meldet das SDK auch einen
 * Netzfehler, der seine eigenen Wiederholungen überdauert hat, als „nicht
 * verfügbar". Unterscheiden lässt sich das nur in Sentry (Dauer des Anlaufs).
 */
export const IMAGE_STORAGE_ERROR = mitKennung(
  'Der Bildspeicher hat das Foto gerade nicht angenommen — bitte später nochmal.',
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
 *
 * Seit #129 auch der Text nach einem Transferfehler, der weder Netzfehler
 * noch Antwort des Bildspeichers war — dort stand vorher „Verbindung
 * unterbrochen", also genau so eine falsche Ursache.
 */
export const IMAGE_UNKNOWN_ERROR = mitKennung(
  'Das Foto konnte nicht hochgeladen werden. Bitte versuche es noch einmal oder wähle ein ' +
    'anderes Foto.',
  'X'
)

/**
 * Woran der Transfer des Originals gescheitert ist — aus Sicht des Bauern.
 *
 *   netz          Die Verbindung ist abgerissen (fetch-Netzfehler) oder
 *                 unsere Wächter haben abgebrochen.
 *   bildspeicher  Das SDK meldet, dass der Bildspeicher das Foto nicht
 *                 genommen hat (Ablehnung oder nicht verfügbar).
 *   lesen         Die Datei ist während des Sendens unlesbar geworden. Seit
 *                 #135 ein eigenes Urteil: Gelesen wurde sie in Stufe 0
 *                 noch, also hat das Gerät die Freigabe dazwischen
 *                 zurückgezogen — „Verbindung unterbrochen" schickte den
 *                 Bauern auf die Suche nach besserem Empfang.
 *   unbekannt     Alles andere, auch die Ablehnung durch unsere eigene
 *                 Token-Route. Ehrlich unbestimmt statt geraten.
 */
export type TransferUrteil = 'netz' | 'bildspeicher' | 'lesen' | 'unbekannt'

const TRANSFER_TEXT: Record<TransferUrteil, string> = {
  netz: IMAGE_NETWORK_ERROR,
  bildspeicher: IMAGE_STORAGE_ERROR,
  // Dieselbe Lage wie die sofortige Ablehnung in der Lese-Stufe — und derselbe
  // Ausweg: dasselbe Foto noch einmal auswählen.
  lesen: IMAGE_READ_PERMISSION_ERROR,
  unbekannt: IMAGE_UNKNOWN_ERROR,
}

/** Meldung an den Bauern nach einem gescheiterten Transfer. */
export function transferFehlerText(urteil: TransferUrteil): string {
  return TRANSFER_TEXT[urteil] ?? IMAGE_UNKNOWN_ERROR
}

/** Kurzgründe für die Sammelmeldung einer Serie (src/lib/upload-batch.ts). */
const KURZ: Record<BildFehlerArt, string> = {
  lesen: 'Datei nicht lesbar',
  format: 'Format nicht unterstützt',
  server: 'Verarbeitung fehlgeschlagen',
}

/**
 * Der Text zur Ursache, wenn nichts Genaueres bekannt ist.
 *
 * Für 'lesen' ist das seit #135 der unbestimmte Text, nicht mehr der
 * Cloud-Text: Wer nur die Ursache kennt, weiß nicht, ob die Quelle stumm blieb
 * oder die Freigabe entzogen wurde — und darf dann keine von beiden behaupten.
 * Den genauen Text setzt die Lese-Stufe über `leseFehlerText` selbst
 * (`new BildFehler('lesen', …)`).
 */
const TEXT: Record<BildFehlerArt, string> = {
  lesen: IMAGE_READ_UNCLEAR_ERROR,
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
 *
 * `text` überschreibt nur die Anzeige, nie die Ursache: Die Lese-Stufe kennt
 * ihren Fall genauer als die Ursache allein (Freigabe entzogen, stumme Quelle,
 * unbestimmt), soll aber weiter als 'lesen' nach Sentry gehen und in einer
 * Serie unter demselben Kurzgrund erscheinen.
 */
export class BildFehler extends Error {
  readonly bildFehlerArt: BildFehlerArt

  constructor(art: BildFehlerArt, text: string = bildFehlerText(art)) {
    super(text)
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
 *
 * Trägt ein Foto-Fehler einen eigenen Text, gilt der: Die Lese-Stufe
 * unterscheidet drei Fälle, die alle die Ursache 'lesen' haben (#135). Der
 * Kurzgrund bleibt der der Ursache — eine Serie listet Gründe, keine Fälle.
 */
export function bildFehlerMeldung(e: unknown): {
  text: string
  kurz: string
  art: BildFehlerArt | null
} {
  const art = bildFehlerArtVon(e)
  if (art) {
    const eigener = e instanceof Error && e.message ? e.message : bildFehlerText(art)
    return { text: eigener, kurz: bildFehlerKurz(art), art }
  }

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
