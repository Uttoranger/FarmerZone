/**
 * Datensparsamkeit für Sentry — reine, testbare Funktionen.
 *
 * WARUM (nicht verhandelbar): Bauern und Kundinnen sind identifizierbare
 * Personen — Namen, E-Mail-Adressen und Telefonnummern stehen in Formularen,
 * URLs und Fehlertexten. Sentry soll sehen, WAS kaputt ging, niemals WER es
 * war. Deshalb läuft JEDES Ereignis vor dem Versand durch bereinigeEreignis —
 * Fehler über beforeSend UND Transaktionen über beforeSendTransaction (die
 * laufen getrennt; nur beforeSend zu setzen ließe 10 % der Produktions-
 * Seitenaufrufe samt roher URL ungefiltert durch) — zusätzlich zu
 * sendDefaultPii: false (das nur das automatische Anreichern unterbindet,
 * nicht, was in Fehlertexten und URLs schon drinsteht).
 *
 * Die heiklen Träger, jeder einzeln getestet (tests/beobachtbarkeit.test.ts):
 * - Fehlertexte und Brotkrumen: E-Mail-Adressen (seit Nr. 56 auch mit
 *   Buchstaben jeder Schrift und mehrfach kodiert, %2540), Telefonnummern;
 *   im Fehlertext seit Nr. 56 auch Adressen mit Token, relativ wie absolut.
 * - URLs, auch im PFAD, nicht nur in der Query: /customers/<kundin@…> legt
 *   die Kunden-E-Mail (%40-kodiert) in den Pfad, /api/orders/confirm/<token>
 *   und /<hof>/bestaetigen/<token> (Bar-Bestätigung, H3) einen gültigen
 *   Einmal-Token — Query-Filter allein reicht nicht. In der Query fallen
 *   heikle Parameter nach NAMEN, und seit Nr. 47 werden die Werte der übrigen
 *   dekodiert bereinigt (?q=kundin@… stand sonst %40-kodiert da); seit
 *   Nr. 56 (Runde 1) gilt für eine Adresse in einem Wert (?next=/…?token=…)
 *   wieder die URL-Regel, und ein Anker mit „=" fällt wie eine Query.
 * - request-Daten: Cookies, Authorization, Referer (trägt die volle
 *   Vorgänger-URL), der POST-Körper (data) komplett.
 * - contexts.nextjs.request_path: von onRequestError roh angehängt.
 * - Blob-Speicher-URLs: tragen den Geräte-Dateinamen („Hof_Mueller.jpg" ist
 *   ein personenbezogenes Datum) im Pfad und als pathname-Parameter.
 * - Spans von Transaktionen: url.full/url.query der echten Navigation,
 *   auch im Wurzel-Span (contexts.trace.data).
 * - IP-Adressen (Nr. 37): user.ip_address (auch „{{auto}}"), die Header, mit
 *   denen Proxies die Adresse weiterreichen (X-Forwarded-For & Co., jede
 *   Schreibweise, auch x-original-forwarded-for und
 *   x-envoy-external-address), die daraus abgeleiteten Ortsangaben von
 *   Vercel und Cloudflare (x-vercel-ip-*, cf-ip*), request.env
 *   (REMOTE_ADDR) und die IP-Attribute der Spans.
 * - Die strukturierten Felder (Nr. 47, tests/sentry-hygiene-felder.test.ts):
 *   logentry (Nachricht und Parameter), tags, extra, alle Kontexte außer
 *   den technischen des SDK (UNBEDENKLICHE_KONTEXTE) und die Daten der
 *   Brotkrumen. Dort kann jeder Aufrufer alles ablegen — deshalb fallen
 *   heikle SCHLÜSSEL ganz weg (HEIKLER_SCHLUESSEL, IP-Header), und jeder
 *   Text geht durch bereinigeFreitext: E-Mail, Telefon, Code, Adressen mit
 *   Token, „token=…", lange Kennungen und — nur hier, nicht im Fehlertext —
 *   IP-Adressen (IPv4 und IPv6). Im Fehlertext bleiben sie, weil dort die
 *   Adresse unseres eigenen Datenbank-Servers steht („connect ETIMEDOUT
 *   …:6543") und kein Weg die Adresse einer Kundin in einen Text schreibt.
 *   Dieselbe Freitext-Regel gilt für die NACHRICHTEN: event.message und
 *   message der Brotkrumen (Console-Brotkrumen tragen dort dieselben
 *   Argumente wie in data.arguments). Ein Text unter einem Schlüssel mit
 *   „query" ist nur dann ein Query-String, wenn er so aussieht; sonst
 *   Freitext.
 * - Variablen in Stack-Frames (frame.vars, in Ausnahmen und Threads) fallen
 *   ganz weg: Sie können jedes Objekt tragen (Anfrage, Abo, Passwort), und
 *   zum Beheben reichen Datei, Funktion und Zeile.
 *
 * Namen lassen sich nicht per Muster erkennen — gegen sie wirkt die
 * strukturelle Sperre: kein sendDefaultPii, als Nutzerkennung ausschließlich
 * die Farm-ID (nie E-Mail, nie Name), und `user` wird hier auf die ID
 * eingedampft, falls je etwas anderes hineingerät.
 *
 * Die Funktionen sind bewusst rein (Ereignis rein, Ereignis raus) und ohne
 * Sentry-Laufzeit-Import, damit die Tests sie ohne Netz und ohne SDK-Aufbau
 * prüfen können. Ereignisse werden nie verworfen, nur bereinigt.
 */
import type { Event as SentryEvent } from '@sentry/nextjs'

/** Vercel-Umgebung → Sentry-environment. Alles Unbekannte ist 'development' —
 *  lieber zu viel als Entwicklung einsortiert als Rauschen in Produktion. */
export function ermittleUmgebung(
  vercelEnv: string | undefined
): 'production' | 'preview' | 'development' {
  if (vercelEnv === 'production') return 'production'
  if (vercelEnv === 'preview') return 'preview'
  return 'development'
}

/*
 * LAUFZEIT (Nr. 47): Alles hier läuft synchron in beforeSend, auf dem Server
 * wie im Browser, und das SDK kürzt vorher nichts (`maxValueLength` ist nicht
 * gesetzt). Jedes Muster muss deshalb in linearer Zeit laufen — auch bei
 * 100 000 Zeichen ohne Treffer (tests/sentry-hygiene-felder.test.ts misst
 * das). Ein Muster, das an jeder Stelle einer langen Zeichenfolge neu
 * ansetzt und jedes Mal bis zu ihrem Ende liest, braucht dafür Sekunden.
 */

/** Ein Zeichen des lokalen Teils einer E-Mail-Adresse (vor dem @):
 *  Buchstaben und Ziffern jeder Schrift, dazu . _ % + - (Nr. 56: vorher nur
 *  A–Z, bei „jürgen@…" blieb „jü" stehen). \p{M} nimmt zerlegt geschriebene
 *  Umlaute mit (u + Trema). */
const EMAIL_LOKAL = /[\p{L}\p{N}\p{M}._%+-]/u

/** Die Domain einer E-Mail-Adresse, ab dem Zeichen nach dem @ (klebend:
 *  lastIndex setzt ersetzeEmails): Teile aus Buchstaben und Ziffern jeder
 *  Schrift (Nr. 56: eine Domain mit Umlaut fiel vorher gar nicht), „-" und
 *  kodierten Bytes eines Nicht-ASCII-Zeichens — so steht ein Umlaut in einer
 *  Adresse (%C3%BC), nach einer zweiten Kodierung %25C3%25BC (Nr. 56, Runde 1:
 *  sonst blieb eine doppelt kodierte Adresse mit Umlaut in der Domain ganz
 *  stehen); am Ende eine Endung aus mindestens zwei Buchstaben. Nur die Bytes
 *  %80–%FF, auch mehrfach kodiert: Ein kodiertes @ oder „." (%40, %2540,
 *  %2E) und ein % ohne solches Byte gehören nie zur Domain, sonst setzte das
 *  kodierte Muster darunter quadratisch an. */
const EMAIL_DOMAIN =
  /(?:[\p{L}\p{N}\p{M}.-]|%(?:25)*[89A-Fa-f][0-9A-Fa-f])+\.(?:[\p{L}\p{M}]|%(?:25)*[89A-Fa-f][0-9A-Fa-f]){2,}/uy

/** Dieselben Adressen URL-kodiert (%40 statt @) — so stehen sie im Pfad —,
 *  seit Nr. 56 auch mehrfach kodiert (%2540: das % des %40 noch einmal
 *  kodiert, etwa in einer Weiterleitung, die eine schon kodierte Adresse
 *  weiterträgt). Angesetzt wird nur am Anfang einer Zeichenfolge
 *  (Lookbehind), sonst wäre das Muster quadratisch. Das Ergebnis bleibt
 *  gleich: %40 und %2540 gehören selbst zu den Zeichen des lokalen Teils, der
 *  Treffer ab dem Anfang nimmt schon das letzte passende der Folge — ein
 *  späterer Anfang fände nichts mehr. Linear bleibt es, weil ein Byte der
 *  Domain (%(25)*[89A-F]…) nie ein Trenner %(25)*40 sein kann: Jeder Versuch
 *  endet spätestens am nächsten Trenner. */
const EMAIL_KODIERT_MUSTER =
  /(?<![\p{L}\p{N}\p{M}._%+-])[\p{L}\p{N}\p{M}._%+-]+%(?:25)*40(?:[\p{L}\p{N}\p{M}.-]|%(?:25)*[89A-Fa-f][0-9A-Fa-f])+\.(?:[\p{L}\p{M}]|%(?:25)*[89A-Fa-f][0-9A-Fa-f]){2,}/giu

/** Wo eine Kennung beginnen kann: kein Buchstabe und keine Ziffer davor, oder
 *  ein Prozent-Escape, auch mehrfach kodiert (`Kennung%20c…`, `%2520`). */
const KENNUNG_ANFANG = String.raw`(?:(?<![A-Za-z0-9])|(?<=%(?:25)*[0-9A-Fa-f]{2}))`

/** Das Ende einer Kennung: kein Buchstabe und keine Ziffer dahinter — und endet
 *  sie auf eine Ziffer, geht dahinter keine Nummer weiter (Trenner und Ziffer wie
 *  in TELEFON_NUMMER). Sonst schützte ihre Form eine Nummer, die in ihr beginnt
 *  und hinter ihr weiterläuft (`…-012345678901+43 664 …`); die fällt dann mit dem
 *  Ende der Kennung, wie vor Nr. 64. */
const KENNUNG_ENDE = String.raw`(?![A-Za-z0-9])(?:(?<![0-9])|(?![\s/\-.()]{0,3}\d))`

/** Eine cuid, wie Prisma sie vergibt (`cuid()`, dieselbe Form wie MELDUNG_ID in
 *  src/lib/meldung-verweise.ts): „c" und 24 Kleinbuchstaben oder Ziffern. */
const CUID_FORM = String.raw`c[a-z0-9]{24}${KENNUNG_ENDE}`

/** Eine UUID: 8-4-4-4-12 Hex-Zeichen. */
const UUID_FORM = String.raw`[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}${KENNUNG_ENDE}`

/** Liegt diese Stelle in einer cuid oder UUID? Der Rückblick reicht nie weiter,
 *  als die Kennung lang ist, und prüft an jedem möglichen Anfang zuerst die
 *  Form — den Rand davor (mit seiner %25-Kette) nur, wo eine ganze Kennung
 *  beginnt; das ist höchstens ein Anfang je Stelle. */
const IN_KENNUNG = String.raw`(?:(?<=${KENNUNG_ANFANG}(?=${CUID_FORM})[a-z0-9]{1,24})|(?<=${KENNUNG_ANFANG}(?=${UUID_FORM})[0-9A-Fa-f-]{0,35}))`

/** Eine Telefonnummer: +43 664 123 4567, 0664/1234567, (0664) 1234567 … — eine
 *  führende +/0/(0-Gruppe und danach mindestens sieben weitere Ziffern mit
 *  üblichen Trennzeichen (höchstens drei am Stück). Bewusst konservativ:
 *  Datumsangaben (01.09.2026), Uhrzeiten und Postleitzahlen bleiben stehen. */
const TELEFON_NUMMER = String.raw`(?:\+|\(?0)\d(?:[\s/\-.()]{0,3}\d){7,}`

/** Vor jeder Nummer: Die Vorschau lässt jede Stelle sofort fallen, an der keine
 *  beginnt; danach beginnt keine in einer cuid oder UUID (Nr. 64: erkannt an der
 *  Form, IN_KENNUNG, geprüft an der ersten Ziffer, auch hinter „+" oder „("). */
const TELEFON_VORSCHAU = String.raw`(?=(?:\+|\(?0)\d)`
const NICHT_IN_KENNUNG = String.raw`(?![+(]?${IN_KENNUNG})`

/** Telefonnummern im Ablauf der Regeln. Nie mitten in einer Zahl, und eine
 *  Ziffernfolge, die links an einem Buchstaben, „_" oder „-" klebt, nur, wenn
 *  sie rechts frei endet (Nr. 56, Runde 1): vorher wurde „2026-10-10 20:02:00"
 *  zu „2[telefon entfernt]:02:00". Ein Prozent-Escape links (%20, %22, %28 …)
 *  ist eine freie Grenze wie ein Leerzeichen (Runde 2: „Ruf%2006641234567" —
 *  das Escape endet auf eine Ziffer, und die Nummer blieb stehen), auch
 *  mehrfach kodiert (%2520, Nacharbeit nach Runde 2). Die Nummern, die an einem
 *  Wort kleben, holt danach TELEFON_AM_WORT_MUSTER — erst ganz am Ende, denn ihr
 *  Platzhalter zerteilte ein Wort, das die Regeln danach ganz nehmen: eine
 *  lange Kennung, ein Kennungs-Segment, den Wert einer Zuweisung.
 *  Linear: Die Vorschau ganz vorn lässt jede Stelle sofort fallen, an der
 *  keine Nummer beginnt — erst dann liest der Rückblick eine %25-Kette, und
 *  die gehört zu höchstens zwei Anfängen; der Kennungs-Rückblick liest
 *  höchstens 36 Zeichen. Angesetzt wird nur am Anfang einer Ziffernfolge, die
 *  Vorschau liest sie einmal. */
const TELEFON_MUSTER = new RegExp(
  String.raw`${TELEFON_VORSCHAU}(?:(?<=%(?:25)*[0-9A-Fa-f]{2})|(?<!\d)(?:(?<![A-Za-z_-])|(?=${TELEFON_NUMMER}(?!\w))))${NICHT_IN_KENNUNG}${TELEFON_NUMMER}`,
  'g'
)

/** Telefonnummern zum Schluss (ersetzeNummernAmWort, Nr. 64): auch an Buchstabe,
 *  „_" oder „-" klebend („Telefon0664…Adresse", „Hof_0664…_foto.jpg" blieben
 *  stehen, solange die Ränder Kennungen schonen sollten — cuid und UUID erkennt
 *  NICHT_IN_KENNUNG jetzt an der Form) und mit „+" vorn auch hinter einer Ziffer
 *  („10:30+43…"). Mit 0 vorn weiter nie mitten in einer Zahl. Andere Kennungen
 *  mit „0" und acht Ziffern am Stück (Hex-Hashes) fallen dabei teilweise mit:
 *  die sichere Richtung. */
const TELEFON_AM_WORT_MUSTER = new RegExp(
  String.raw`${TELEFON_VORSCHAU}(?:(?=\+)|(?<!\d)|(?<=%(?:25)*[0-9A-Fa-f]{2}))${NICHT_IN_KENNUNG}${TELEFON_NUMMER}`,
  'g'
)

/** Query-Parameter, deren NAME auf Geheimnisse oder Personenbezug deutet.
 *  `pathname` gehört dazu: Die Blob-SDK-Aufrufe tragen darin den Blob-Pfad
 *  samt Geräte-Dateinamen. `s` ist die Signatur des Bestell-Links
 *  (src/lib/bestell-link.ts) — ein Zugangsgeheimnis; `reorder` trägt den
 *  selbsttragenden Nachbestell-Token (reorder-token.ts), gleiche Lage;
 *  `sig` ist dieselbe Signatur für die Bestätigungsseite (bestaetigungsPfad);
 *  `otp` der Anmeldecode der Kundinnen (E7, src/lib/anmeldecode.ts). */
const HEIKLE_PARAMETER = /token|code|secret|email|pathname|reorder|otp|^(s|sig)$/i

/** Der Anmeldecode im Text (6 Ziffern) — nur, wo „Code" oder „OTP" als
 *  eigenes Wort direkt davorsteht: Zehn Minuten lang ist er ein Zugang wie
 *  ein Passwort. Bestellnummern, Fehlercodes („Fehlercode 500") und
 *  Zeitstempel bleiben stehen, eine nackte Ziffernfolge ist nicht erkennbar
 *  als Code — der Code steht deshalb nie in einem Log (auth.ts). */
const ANMELDECODE_MUSTER = /\b(code|otp|anmeldecode)(\W{1,3})\d{6}\b/gi

/** Undurchsichtige Kennungen als GANZES Pfadsegment (Bestätigungs-Token der
 *  Bestellungen ist ein nanoid(32)). Trifft bewusst auch lange Hof-Slugs —
 *  Über-Redaktion ist die sichere Richtung, der Transaktions-NAME bleibt
 *  parametrisiert und damit lesbar. */
const KENNUNG_SEGMENT_MUSTER = /^[A-Za-z0-9_-]{24,}$/

/** Header, in denen Proxies und CDNs die Adresse der Kundin weiterreichen —
 *  klein geschrieben; verglichen wird case-insensitiv. Die Liste umfasst die
 *  des SDK (ipHeaderNames in @sentry/core) und mehr: x-vercel-proxied-for
 *  fängt das SDK selbst nicht ab. */
const IP_HEADER = new Set([
  'x-forwarded-for',
  'x-forwarded',
  'forwarded',
  'forwarded-for',
  'x-real-ip',
  'x-client-ip',
  'x-cluster-client-ip',
  'cf-connecting-ip',
  'cf-connecting-ipv6',
  'cf-pseudo-ipv4',
  'true-client-ip',
  'fastly-client-ip',
  'fly-client-ip',
  'x-vercel-forwarded-for',
  'x-vercel-proxied-for',
  'x-original-forwarded-for',
  'x-envoy-external-address',
])

/** Ist dieser Header-Name ein IP-Träger? x-vercel-ip-* und cf-ip* (Land,
 *  Stadt, Breiten- und Längengrad, Postleitzahl) sind aus der IP abgeleitet
 *  und fallen mit. In
 *  Span-Attributen schreibt das SDK Bindestriche als Unterstriche
 *  (http.request.header.x_forwarded_for) — beide Formen zählen. */
function istIpHeader(name: string): boolean {
  const normal = name.toLowerCase().replace(/_/g, '-')
  return IP_HEADER.has(normal) || normal.startsWith('x-vercel-ip-') || normal.startsWith('cf-ip')
}

/** Span-Attribute, die die Adresse der Gegenstelle tragen — in einem
 *  Server-Span ist das die Kundin. server.address (unser eigener Host)
 *  bleibt. */
const IP_SPAN_ATTRIBUTE = new Set([
  'user.ip_address',
  'client.address',
  'client.socket.address',
  'http.client_ip',
  'net.peer.ip',
  'net.sock.peer.addr',
  'network.peer.address',
])

const HEADER_ATTRIBUT_PRAEFIX = /^http\.(request|response)\.header\./i

function istIpSpanAttribut(schluessel: string): boolean {
  if (IP_SPAN_ATTRIBUTE.has(schluessel.toLowerCase())) return true
  return HEADER_ATTRIBUT_PRAEFIX.test(schluessel) && istIpHeader(schluessel.replace(HEADER_ATTRIBUT_PRAEFIX, ''))
}

/** Wie viele Code-Einheiten das Zeichen vor `stelle` belegt: zwei bei einem
 *  Zeichen außerhalb der Grundebene (Ersatzpaar), sonst eins. Nie über
 *  `grenze` hinaus. */
function breiteDavor(text: string, stelle: number, grenze: number): 1 | 2 {
  const tief = text.charCodeAt(stelle - 1)
  const hoch = text.charCodeAt(stelle - 2)
  return stelle - 2 >= grenze && tief >= 0xdc00 && tief <= 0xdfff && hoch >= 0xd800 && hoch <= 0xdbff ? 2 : 1
}

const EMAIL_ERSATZ = '[e-mail entfernt]'
const TELEFON_ERSATZ = '[telefon entfernt]'

/** Ein Stück Text, das einem Platzhalter weicht. */
type Bereich = { anfang: number; ende: number; ersatz: string }

/**
 * E-Mail-Adressen in freiem Text — dieselben Treffer wie
 * `/[\p{L}\p{N}\p{M}._%+-]+@<EMAIL_DOMAIN>/gu`, aber linear:
 * Jener Regex setzte in einer langen Folge ohne @ an jeder Stelle neu an
 * (100 000 Zeichen: rund 7 Sekunden). Hier wird von jedem @ aus gesucht —
 * nach links der lokale Teil, höchstens bis zum Ende des vorigen Treffers
 * (dort setzte auch der Regex wieder an), nach rechts die Domain. Nach links
 * zählt jedes Zeichen ganz, auch eines außerhalb der Grundebene (Nr. 56).
 * Die Bereiche sind geordnet und überlappen nicht.
 */
function findeEmailBereiche(text: string): Bereich[] {
  const bereiche: Bereich[] = []
  let ende = 0
  for (let at = text.indexOf('@'); at !== -1; at = text.indexOf('@', Math.max(at + 1, ende))) {
    let anfang = at
    while (anfang > ende) {
      const breite = breiteDavor(text, anfang, ende)
      if (!EMAIL_LOKAL.test(text.slice(anfang - breite, anfang))) break
      anfang -= breite
    }
    if (anfang === at) continue
    EMAIL_DOMAIN.lastIndex = at + 1
    if (!EMAIL_DOMAIN.test(text)) continue
    ende = EMAIL_DOMAIN.lastIndex
    bereiche.push({ anfang, ende, ersatz: EMAIL_ERSATZ })
  }
  return bereiche
}

/** Ersetzt die Vereinigung der Bereiche: Überlappende werden ein Bereich mit
 *  dem Platzhalter dessen, der zuerst beginnt (bei gleichem Anfang des
 *  längeren). Ordnet die Liste dabei. */
function ersetzeVereinigt(text: string, bereiche: Bereich[]): string {
  bereiche.sort((a, b) => a.anfang - b.anfang || b.ende - a.ende)
  let ergebnis = ''
  let ende = 0
  for (const bereich of bereiche) {
    if (bereich.anfang < ende) {
      ende = Math.max(ende, bereich.ende)
      continue
    }
    ergebnis += text.slice(ende, bereich.anfang) + bereich.ersatz
    ende = bereich.ende
  }
  return ergebnis + text.slice(ende)
}

function ersetzeEmails(text: string): string {
  return ersetzeVereinigt(text, findeEmailBereiche(text))
}

function bereinigeText(text: string): string {
  return ersetzeEmails(text)
    .replace(EMAIL_KODIERT_MUSTER, EMAIL_ERSATZ)
    .replace(TELEFON_MUSTER, TELEFON_ERSATZ)
    .replace(ANMELDECODE_MUSTER, '$1$2[code entfernt]')
}

/** Der letzte Schritt jeder Text-Regel (Nr. 64): Nummern, die an einem Wort
 *  kleben (TELEFON_AM_WORT_MUSTER). Danach liest keine Regel mehr ein ganzes
 *  Wort, das der Platzhalter zerteilen könnte. */
function ersetzeNummernAmWort(text: string): string {
  return text.replace(TELEFON_AM_WORT_MUSTER, TELEFON_ERSATZ)
}

/** bereinigeText samt Nachlese — für Texte, nach denen keine weitere Regel kommt. */
function bereinigeTextGanz(text: string): string {
  return ersetzeNummernAmWort(bereinigeText(text))
}

/** Ein Zeichen einer Nummer, das URLSearchParams kodiert: alles außer Ziffer, „." und „-". */
const KODIERTER_TRENNER = /[^\d.-]/

/**
 * Die Nachlese für einen Namen oder Wert einer Abfrage in einer Adresse im Text
 * (Nr. 64, Runde 1), bevor URLSearchParams ihn neu kodiert. Neu kodiert verliert
 * eine Nummer ihre Trenner („0664/1234567" → „0664%2F1234567", „0664 1234567" →
 * „0664+1234567"), und die Nachlese am Schluss des äußersten Durchgangs sähe sie
 * nicht mehr — in request.url fiel sie, in Nachricht, Fehlertext und
 * Span-Beschreibung blieb sie. Deshalb fallen hier die Nummern mit einem solchen
 * Trenner; die übrigen stehen neu kodiert unverändert da und bleiben der Nachlese
 * am Schluss, nach den Regeln, die ein ganzes Wort nehmen (eine lange Kennung aus
 * Hex-Ziffern zerteilt sie so nicht).
 */
function ersetzeNummernVorKodierung(text: string): string {
  return text.replace(TELEFON_AM_WORT_MUSTER, (nummer) => (KODIERTER_TRENNER.test(nummer) ? TELEFON_ERSATZ : nummer))
}

/** bereinigeText samt der Nachlese vor dem Neukodieren. */
function bereinigeTextVorKodierung(text: string): string {
  return ersetzeNummernVorKodierung(bereinigeText(text))
}

/** Eine Nummer mit „+" vorn in der Plus-Lesart einer Abfrage: nur mit freiem
 *  linken Rand — kein Buchstabe, keine Ziffer, kein „_" und kein „+" davor,
 *  oder ein Escape, das nach dem Dekodieren noch steht („tel:+43…",
 *  „Ruf,+43…", „(+43)…", „%22+43…"). Ein „+" an einem Wort ist dort meist ein
 *  Leerzeichen („Artikel+12345678" bleibt). Die weiteren „+" gelten als
 *  Trenner („+43+664+1234567": das erste ein Plus, die übrigen Leerzeichen).
 *  Linear: Angesetzt wird nur an einem „+", der Rückblick liest höchstens
 *  drei Zeichen. */
const PLUS_NUMMER_ROH = /(?:(?<=%[0-9A-Fa-f]{2})|(?<![\p{L}\p{N}\p{M}_+]))\+\d(?:[\s/\-.()+]{0,3}\d){7,}/gu

/**
 * Die Plus-Lesart eines Texts: erst Adressen mit @, dann Nummern mit „+" vorn,
 * wie nacheinander ersetzt — hinter einem Platzhalter ist der Rand frei
 * („kundin@example.com+43…"). Die Bereiche der Nummern stehen im Text vor dem
 * Ersetzen; in einem Platzhalter liegt keine (er trägt Buchstaben).
 */
function findePlusBereiche(text: string): Bereich[] {
  const emails = findeEmailBereiche(text)
  if (!text.includes('+')) return emails
  const bereiche = [...emails]
  let email = 0
  let versatz = 0
  for (const treffer of ersetzeVereinigt(text, [...emails]).matchAll(PLUS_NUMMER_ROH)) {
    while (email < emails.length && emails[email].anfang + versatz + EMAIL_ERSATZ.length <= treffer.index) {
      versatz += EMAIL_ERSATZ.length - (emails[email].ende - emails[email].anfang)
      email++
    }
    bereiche.push({ anfang: treffer.index - versatz, ende: treffer.index - versatz + treffer[0].length, ersatz: TELEFON_ERSATZ })
  }
  return bereiche
}

/** Ein Bereich, umgerechnet von einer Lesart auf eine andere. */
type Umrechnung = (von: number, bis: number) => [number, number]

/** Für eine Lesart, die nichts dekodiert. */
const GLEICH: Umrechnung = (von, bis) => [von, bis]

/** Ein Name oder Wert einer Abfrage, roh und dekodiert wie von URLSearchParams
 *  (Escapes zu Bytes, die Bytes als UTF-8, Ungültiges als U+FFFD): `leer` mit
 *  „+" als Leerzeichen, `plus` mit jedem rohen „+" als Plus — Zeichen für
 *  Zeichen deckungsgleich. `zuDekodiert` rechnet einen Bereich im rohen Text
 *  auf die dekodierten um, mitten in einem kodierten Zeichen (%C3%BC) nach
 *  außen gerundet: Ein umgerechneter Bereich verliert nie ein Zeichen, das er
 *  berührt. */
type Lesarten = { roh: string; leer: string; plus: string; zuDekodiert: Umrechnung }

const UTF8 = new TextDecoder()

/** Das Byte eines Escapes an dieser Stelle, sonst -1. */
function leseEscapeByte(text: string, stelle: number): number {
  if (text[stelle] !== '%' || !/^[0-9A-Fa-f]{2}$/.test(text.slice(stelle + 1, stelle + 3))) return -1
  return parseInt(text.slice(stelle + 1, stelle + 3), 16)
}

function leseLesarten(roh: string): Lesarten {
  // Ohne Escape heißt dekodieren nur: „+" wird zum Leerzeichen.
  if (!roh.includes('%')) return { roh, leer: roh.replace(/\+/g, ' '), plus: roh, zuDekodiert: GLEICH }
  let leer = ''
  let plus = ''
  const anfang: number[] = []
  const ende: number[] = []
  let stelle = 0
  while (stelle < roh.length) {
    const byte = leseEscapeByte(roh, stelle)
    if (byte === -1) {
      anfang[stelle] = ende[stelle] = leer.length
      leer += roh[stelle] === '+' ? ' ' : roh[stelle]
      plus += roh[stelle]
      stelle++
      continue
    }
    // Ein kodiertes Zeichen: ein Byte und die Folgebytes (10xxxxxx) dahinter.
    // Je für sich dekodiert ergibt das dasselbe wie alle Bytes am Stück: Vor
    // einem Byte, das kein Folgebyte ist, beginnt UTF-8 neu.
    const start = stelle
    const bytes = [byte]
    for (stelle += 3; (leseEscapeByte(roh, stelle) & 0xc0) === 0x80; stelle += 3) bytes.push(leseEscapeByte(roh, stelle))
    const zeichen = byte < 0x80 && bytes.length === 1 ? String.fromCharCode(byte) : UTF8.decode(Uint8Array.from(bytes))
    for (let i = start; i < stelle; i++) {
      anfang[i] = leer.length
      ende[i] = i === start ? leer.length : leer.length + zeichen.length
    }
    leer += zeichen
    plus += zeichen
  }
  anfang[roh.length] = ende[roh.length] = leer.length
  return { roh, leer, plus, zuDekodiert: (von, bis) => [anfang[von], ende[bis]] }
}

/**
 * Ein Name oder Wert einer Abfrage in allen Lesarten (bereinigeQuery, Nr. 64).
 * Alle lesen den unveränderten Text, ihre Bereiche werden vereinigt (wie
 * ersetzeVorab): Ersetzte die rohe Lesart zuerst, schnitt sie der Telefon-Regel
 * die Nummer entzwei (`Abholung%3A+2026-10-10+0664%2F9876543` behielt
 * `%2F9876543`).
 * - Die Plus-Lesart roh wie vorher (findePlusBereiche: Adressen mit @, Nummern mit
 *   „+" vorn; ein Escape vor dem „+" ist ein freier Rand, kodierte Bytes in
 *   einer Domain zählen mit).
 * - Dieselbe dekodiert — einmal und, bei einem Wert, voll wie weiterDekodiert —,
 *   aber nur ihre Nummern: %20 und %2F sind dort Trenner (`+43%20664%20…`).
 *   Ihre Adressen nähmen der Regel des Werts in verklebten Folgen den Teil vor
 *   dem @ der nächsten Adresse weg.
 * - Von der Telefon-Regel, gelesen wie danach die Regel des Werts (ein Wert voll
 *   dekodiert, ein Name einmal), nur die Nummern, die ein Bereich der
 *   Plus-Lesarten anschneidet und die über ihn hinausreichen — ersetzt, ließe er
 *   von ihnen nur einen Rest —, und die Adressen, in die eine solche Nummer
 *   reicht. Alles Übrige nimmt die
 *   Regel des Werts selbst in ihrer Reihenfolge (erst Bearer und Zuweisungen,
 *   dann E-Mail und Telefon); ein Platzhalter davor schüfe dort neue Grenzen.
 * Beide dekodierten Lesarten laufen in denselben Runden — ein rohes „+" steht
 * in keiner Escape-Folge. Der Preis der Plus-Lesart: Vor einem rohen @ zählt
 * ein mit „+" angehängtes Wort zur Adresse („Hallo+kundin@…" fällt ganz) —
 * sicher, aber nicht mehr lesbar.
 */
function bereinigeLesarten({ roh, leer, plus, zuDekodiert }: Lesarten, voll: boolean): string {
  const plusLesarten = findePlusBereiche(roh).map((bereich): Bereich => {
    const [von, bis] = zuDekodiert(bereich.anfang, bereich.ende)
    return { anfang: von, ende: bis, ersatz: bereich.ersatz }
  })
  plusLesarten.push(...findePlusNummern(plus, GLEICH))
  const lesartPlus = voll ? weiterDekodiertMitRueckweg(plus) : null
  if (lesartPlus !== null && lesartPlus.text !== plus) plusLesarten.push(...findePlusNummern(lesartPlus.text, lesartPlus.zurueck))
  // Schneidet keiner, bleibt alles der Regel des Werts.
  if (plusLesarten.length === 0) return leer
  const lesart = voll ? weiterDekodiertMitRueckweg(leer) : { text: leer, zurueck: GLEICH }
  if (lesart === null) return ersetzeVereinigt(leer, plusLesarten)
  const nummern = findeSchneidende(
    [...lesart.text.matchAll(TELEFON_MUSTER)].map((treffer): Bereich => {
      const [von, bis] = lesart.zurueck(treffer.index, treffer.index + treffer[0].length)
      return { anfang: von, ende: bis, ersatz: TELEFON_ERSATZ }
    }),
    plusLesarten,
    true
  )
  // Reicht eine solche Nummer in eine Adresse, fällt die Adresse mit — sonst
  // nähme ihr die Nummer den Teil vor dem @.
  const adressen = findeSchneidende(
    findeEmailBereiche(lesart.text).map((email): Bereich => {
      const [von, bis] = lesart.zurueck(email.anfang, email.ende)
      return { anfang: von, ende: bis, ersatz: email.ersatz }
    }),
    nummern
  )
  const lesarten = [...plusLesarten, ...nummern, ...adressen]
  return ersetzeVereinigt(leer, voll ? [...lesarten, ...findeWerteUmLesarten(leer, lesarten)] : lesarten)
}

/**
 * Die Bereiche der Zuweisungs-Regel in einem Wert (bereinigeLesarten, Runde 1):
 * Danach liest sie ihn ohnehin (bereinigeAbfrageWert), aber mit Platzhaltern
 * darin, und deren Leerzeichen beendete den Wert zu früh
 * (`token: (xq%40example.com%2B436649876543x0664%209876543` behielt `0664 9876543`).
 * Deshalb liest sie hier den unveränderten, voll dekodierten Wert, in dem jeder
 * Bereich der Lesarten als ein Wort ohne Trenner gilt — wie ein Platzhalter an
 * seiner Stelle, nur ohne Leerzeichen: Ein „+" in einer Adresse der Plus-Lesart
 * (`otp: 012012xq+shop@example.com10:200664%209876543`) ist dort kein
 * Leerzeichen, und der Wert läuft über sie hinweg. Die Bereiche werden vereinigt.
 */
function findeWerteUmLesarten(leer: string, lesarten: Bereich[]): Bereich[] {
  let maskiert = ''
  let ende = 0
  for (const bereich of [...lesarten].sort((a, b) => a.anfang - b.anfang)) {
    if (bereich.ende <= ende) continue
    const von = Math.max(bereich.anfang, ende)
    maskiert += leer.slice(ende, von) + LESART_MASKE.repeat(bereich.ende - von)
    ende = bereich.ende
  }
  const lesart = weiterDekodiertMitRueckweg(maskiert + leer.slice(ende))
  if (lesart === null) return []
  return findeZuweisungsBereiche(lesart.text).map((wert): Bereich => {
    const [von, bis] = lesart.zurueck(wert.anfang, wert.ende)
    return { anfang: von, ende: bis, ersatz: wert.ersatz }
  })
}

/** Ein Zeichen, das für die Zuweisungs-Regel nichts ist: kein Wortzeichen (kein
 *  Schlüssel), kein Trenner eines Werts, keine Ziffer, kein Zeichen eines
 *  Bearer-Tokens — so liest sie einen maskierten Bereich wie einen Platzhalter. */
const LESART_MASKE = '#'

/** Die Bereiche aus `kandidaten`, die einen aus `anker` schneiden — mit
 *  `ueberstehend` nur die, die dabei über die Anker hinausreichen (ein ganz
 *  gedeckter fiele ohnehin). Linear nach dem Ordnen: Die zusammengelegten Anker
 *  und die Kandidaten laufen je einmal durch (ein Vergleich jedes Kandidaten
 *  mit jedem Anker wäre quadratisch). */
function findeSchneidende(kandidaten: Bereich[], anker: Bereich[], ueberstehend = false): Bereich[] {
  const vereint: { anfang: number; ende: number }[] = []
  for (const bereich of [...anker].sort((a, b) => a.anfang - b.anfang)) {
    const letzter = vereint.length > 0 ? vereint[vereint.length - 1] : null
    if (letzter !== null && bereich.anfang <= letzter.ende) letzter.ende = Math.max(letzter.ende, bereich.ende)
    else vereint.push({ anfang: bereich.anfang, ende: bereich.ende })
  }
  let i = 0
  return [...kandidaten]
    .sort((a, b) => a.anfang - b.anfang)
    .filter((kandidat) => {
      while (i < vereint.length && vereint[i].ende <= kandidat.anfang) i++
      if (i >= vereint.length || vereint[i].anfang >= kandidat.ende) return false
      return !ueberstehend || vereint[i].anfang > kandidat.anfang || vereint[i].ende < kandidat.ende
    })
}

/** Die Nummern mit „+" vorn einer Plus-Lesart, umgerechnet mit `zurueck`: für
 *  sich gelesen und hinter den Platzhaltern der Adressen (findePlusBereiche, dort ist
 *  der Rand frei: `kundin%40example.com+43…`). Nur hinter den Platzhaltern
 *  gelesen, endete eine Nummer, wo eine Adresse ihr Ende als Teil vor dem @
 *  nimmt (`+43 664 9876543Tel+kundin@…`) — und die Adresse fällt hier nicht. */
function findePlusNummern(text: string, zurueck: Umrechnung): Bereich[] {
  if (!text.includes('+')) return []
  const fuerSich = [...text.matchAll(PLUS_NUMMER_ROH)].map((treffer): Bereich => ({ anfang: treffer.index, ende: treffer.index + treffer[0].length, ersatz: TELEFON_ERSATZ }))
  return [...fuerSich, ...findePlusBereiche(text).filter((bereich) => bereich.ersatz === TELEFON_ERSATZ)].map((bereich) => {
    const [von, bis] = zurueck(bereich.anfang, bereich.ende)
    return { anfang: von, ende: bis, ersatz: TELEFON_ERSATZ }
  })
}

/** Die rohen Paare einer Abfrage, zerlegt wie von URLSearchParams: Ein „?" vorn
 *  fällt, leere Stücke zwischen „&" ebenso, der Name endet am ersten „=". */
function zerlegeRohePaare(query: string): [string, string][] {
  const stuecke = (query.startsWith('?') ? query.slice(1) : query).split('&').filter((stueck) => stueck !== '')
  return stuecke.map((stueck) => {
    const gleich = stueck.indexOf('=')
    return gleich === -1 ? [stueck, ''] : [stueck.slice(0, gleich), stueck.slice(gleich + 1)]
  })
}

/**
 * Entfernt heikle Parameter aus einem Query-String ('a=1&token=x' → 'a=1')
 * und bereinigt Namen und Werte der übrigen DEKODIERT — sonst stünde
 * „?q=kundin@…" als „q=kundin%40…" weiter da (Nr. 47). Die Regel ist dieselbe
 * wie für den Pfad (E-Mail, Telefon, Code), für Werte dazu die aus
 * bereinigeAbfrageWert; strukturierte Felder nehmen die Freitext-Regel
 * (`freitext`, bereinigeQueryText).
 *
 * Nummern und Adressen mit „+" liest sie in mehreren Lesarten (Nacharbeit nach
 * Runde 2, seit Nr. 64 auf demselben Text, bereinigeLesarten): mit „+" als Plus
 * („tel=+43…", „kundin+shop@…") und mit „+" als Leerzeichen
 * („tel=0664+1234567"). Mit nur einer Lesart blieb die andere Nummer stehen;
 * die Abfrage einer Adresse in einem Wert (?next=/x?tel=…) läuft so wie eine
 * eigene.
 */
function bereinigeQuery(query: string, freitext = false, tiefe = 0, nachlese = true): string {
  const regel = freitext ? bereinigeFreitext : nachlese ? bereinigeTextGanz : bereinigeTextVorKodierung
  const sauber = new URLSearchParams()
  for (const [nameRoh, wertRoh] of zerlegeRohePaare(query)) {
    const name = leseLesarten(nameRoh)
    // Ob ein Name heikel ist, entscheidet der unveränderte Name, nicht der
    // bereinigte („token@example.com=…" hieße sonst „[e-mail entfernt]").
    if (HEIKLE_PARAMETER.test(name.leer) || HEIKLE_PARAMETER.test(name.plus)) continue
    const wert = bereinigeLesarten(leseLesarten(wertRoh), true)
    sauber.append(
      regel(bereinigeLesarten(name, false)),
      freitext ? bereinigeFreitext(weiterDekodiert(wert)) : bereinigeAbfrageWert(wert, tiefe, nachlese)
    )
  }
  return sauber.toString()
}

/** Ein Abfragewert, der selbst eine Adresse ist: ab „/" oder mit Schema. */
const ADRESS_WERT = /^(?:https?:\/\/|\/)/i

/** Bis zu dieser Tiefe werden Adressen in Abfragewerten bereinigt
 *  (?next=/…?next=/…); eine noch tiefere fällt ganz. Jede Ebene liest den Rest
 *  noch einmal — ohne Grenze wäre die Laufzeit quadratisch. */
const MAX_ADRESS_TIEFE = 3

const ADRESSE_ERSATZ = '[adresse entfernt]'

/** Eine Folge von %XX-Escapes. */
const ESCAPE_FOLGE = /(?:%[0-9A-Fa-f]{2})+/g

/** Eine Folge von Escapes dekodiert; ist sie kein gültiges UTF-8 („%3D%C3"),
 *  nur ihre ASCII-Zeichen (die Trenner „=", „/", „?"), die übrigen Bytes
 *  bleiben, wie sie sind. */
function dekodiereFolge(folge: string): string {
  try {
    return decodeURIComponent(folge)
  } catch {
    return folge.replace(/%[0-7][0-9A-Fa-f]/g, (escape) => decodeURIComponent(escape))
  }
}

/** Dekodiert jede Folge von Escapes für sich — decodeURIComponent würfe
 *  sonst für den ganzen Text. */
function dekodiereFehlertolerant(text: string): string {
  return text.replace(ESCAPE_FOLGE, dekodiereFolge)
}

/** Ersatz für einen Abfragewert, der tiefer kodiert ist, als geprüft wird. */
const WERT_ERSATZ = '[entfernt]'

/**
 * Ein Abfragewert, so oft weiter dekodiert, wie er sich ändert — höchstens
 * MAX_ADRESS_TIEFE-mal (Nr. 56, Runde 2). URLSearchParams dekodiert einmal;
 * ein doppelt kodierter Wert (?next=%252Freset-password%253Ftoken%253D…, wie
 * ihn eine Weiterleitung erzeugt, die einen kodierten Wert noch einmal kodiert)
 * stand danach als „%2Freset-password%3Ftoken%3D…" da: keine Adresse, keine
 * Zuweisung, und der Token blieb. Ändert er sich nach der letzten Runde noch,
 * fällt er ganz (Nacharbeit nach Runde 2: fünffach kodiert blieb der Token
 * kodiert stehen) — was nicht ganz gelesen ist, geht nicht mit.
 */
function weiterDekodiert(wert: string): string {
  let text = wert
  for (let runde = 0; runde < MAX_ADRESS_TIEFE; runde++) {
    const weiter = dekodiereFehlertolerant(text)
    if (weiter === text) return text
    text = weiter
  }
  return dekodiereFehlertolerant(text) === text ? text : WERT_ERSATZ
}

/** Ein Text nach einer Runde dekodiereFehlertolerant, mit Rückweg: `anfang[i]`
 *  und `ende[i]` nennen für eine Stelle im Ergebnis die Stelle im Text davor —
 *  mitten in einer dekodierten Folge nach vorn bzw. nach hinten gerundet. */
type Dekodiert = { text: string; anfang: number[]; ende: number[] }

function dekodiereMitRueckweg(text: string): Dekodiert {
  let ergebnis = ''
  const anfang: number[] = []
  const ende: number[] = [0]
  let stelle = 0
  const uebernimm = (bis: number) => {
    for (; stelle < bis; stelle++) {
      anfang[ergebnis.length] = stelle
      ergebnis += text[stelle]
      ende[ergebnis.length] = stelle + 1
    }
  }
  for (const folge of text.matchAll(ESCAPE_FOLGE)) {
    uebernimm(folge.index)
    const dekodiert = dekodiereFolge(folge[0])
    const folgeEnde = folge.index + folge[0].length
    for (let i = 0; i < dekodiert.length; i++) {
      anfang[ergebnis.length + i] = folge.index
      ende[ergebnis.length + i + 1] = folgeEnde
    }
    ergebnis += dekodiert
    stelle = folgeEnde
  }
  uebernimm(text.length)
  anfang[ergebnis.length] = text.length
  return { text: ergebnis, anfang, ende }
}

/** weiterDekodiert mit Rückweg: `zurueck` rechnet einen Bereich im Ergebnis auf
 *  den Wert um. null, wenn der Wert ganz fällt (WERT_ERSATZ). */
function weiterDekodiertMitRueckweg(wert: string): { text: string; zurueck: Umrechnung } | null {
  if (!wert.includes('%')) return { text: wert, zurueck: GLEICH }
  const runden: Dekodiert[] = []
  let text = wert
  for (let runde = 0; ; runde++) {
    const weiter = dekodiereMitRueckweg(text)
    if (weiter.text === text) break
    if (runde === MAX_ADRESS_TIEFE) return null
    runden.push(weiter)
    text = weiter.text
  }
  const zurueck: Umrechnung = (von, bis) => runden.reduceRight<[number, number]>(([a, b], runde) => [runde.anfang[a], runde.ende[b]], [von, bis])
  return { text, zurueck }
}

/**
 * Ein Wert einer Abfrage in einer Adresse (Nr. 56, Runde 1). Ist er selbst
 * eine Adresse (?next=/reset-password?token=…, ?callbackUrl=https://…), gilt
 * für ihn die URL-Regel — vorher wurde er nur neu kodiert, und sein Token
 * blieb kodiert stehen (next=%2Freset-password%3Ftoken%3D…). Vorher fallen im
 * dekodierten Wert „token=…" und „Bearer …" (auch ohne Adresse:
 * ?next=reset?token=…). Beides prüft die ganz dekodierte Form (weiterDekodiert,
 * Runde 2); ein „+" darin liest die Abfrage der Adresse in beiden Lesarten
 * (bereinigeQuery). Strukturierte Felder brauchen den Rest nicht: Ihre Freitext-Regel
 * nimmt Adressen und Zuweisungen selbst.
 */
function bereinigeAbfrageWert(wert: string, tiefe: number, nachlese: boolean): string {
  const ohneZuweisung = ersetzeZuweisungen(weiterDekodiert(wert))
  if (!ADRESS_WERT.test(ohneZuweisung)) return nachlese ? bereinigeTextGanz(ohneZuweisung) : bereinigeTextVorKodierung(ohneZuweisung)
  return tiefe < MAX_ADRESS_TIEFE ? bereinigeUrl(ohneZuweisung, tiefe + 1, nachlese) : ADRESSE_ERSATZ
}

/** Bereinigt den Pfad-Teil: E-Mails (roh und kodiert), Telefonnummern,
 *  Zuweisungen wie „;token=…" oder „%23token=…" (Nr. 56, Runde 2: vorher
 *  prüfte die URL-Regel den Pfad nicht darauf) und undurchsichtige
 *  Kennungs-Segmente. `kodiert`: Der Pfad gehört zu einer Adresse, die selbst ein
 *  Abfragewert ist, und wird mit ihm neu kodiert (ersetzeNummernVorKodierung). */
function bereinigePfad(pfad: string, nachlese: boolean, kodiert: boolean): string {
  const segmente = ersetzeZuweisungen(bereinigeText(pfad)).split('/')
  const sauber = segmente
    .map((segment, i) => {
      if (KENNUNG_SEGMENT_MUSTER.test(segment)) return '[kennung entfernt]'
      // Bestätigungs-Token der Barbestellung: Was nach /bestaetigen/ bzw.
      // /orders/confirm/ steht, fällt IMMER — die Route entscheidet, nicht
      // die Länge des Tokens.
      const davor = segmente[i - 1]
      if (segment && (davor === 'bestaetigen' || (davor === 'confirm' && segmente[i - 2] === 'orders'))) {
        return '[kennung entfernt]'
      }
      return segment
    })
    .join('/')
  // Erst nach den Segmenten: Ein langes Segment fällt ganz, statt um eine Nummer zerteilt zu werden.
  return nachlese ? ersetzeNummernAmWort(sauber) : kodiert ? ersetzeNummernVorKodierung(sauber) : sauber
}

/** Bereinigt eine volle URL: Pfad, Query und Anker. Alles ab dem ERSTEN #
 *  ist der Anker (wie im Browser), davor alles ab dem ERSTEN ? die Query —
 *  auch ein weiteres ? darin (URLSearchParams nimmt es als Wertteil).
 *  `tiefe` zählt Adressen in Abfragewerten (bereinigeAbfrageWert). */
function bereinigeUrl(url: string, tiefe = 0, nachlese = true): string {
  // Blob-Speicher-URLs tragen den Geräte-Dateinamen im Pfad — dort ist
  // nichts Diagnostisches zu holen, der ganze Rest fällt weg.
  if (/^https?:\/\/[^/?]*\bblob\.vercel-storage\.com/i.test(url)) {
    return `${url.split('/').slice(0, 3).join('/')}/[pfad entfernt]`
  }
  const raute = url.indexOf('#')
  const ohneAnker = raute === -1 ? url : url.slice(0, raute)
  const anker = raute === -1 ? '' : bereinigeAnker(url.slice(raute + 1), tiefe, nachlese)
  const trenner = ohneAnker.indexOf('?')
  const pfad = bereinigePfad(trenner === -1 ? ohneAnker : ohneAnker.slice(0, trenner), nachlese, tiefe > 0)
  const query = trenner === -1 ? '' : bereinigeQuery(ohneAnker.slice(trenner + 1), false, tiefe, nachlese)
  return `${pfad}${query ? `?${query}` : ''}${anker ? `#${anker}` : ''}`
}

/** Der Anker einer Adresse (Nr. 56, Runde 1): Mit „=" trägt er Parameter wie
 *  eine Query (#token=…, so legen manche Anmeldewege den Token ab) und fällt
 *  wie sie; sonst gilt die Regel des Pfads (#abschnitt bleibt). Ein kodiertes
 *  „=" (%3D) zählt wie ein rohes (Runde 2: #token%3D… galt als Pfad und
 *  blieb) — dann wird der Anker vorher dekodiert. */
function bereinigeAnker(anker: string, tiefe: number, nachlese: boolean): string {
  const mitTrennern = anker.includes('=') ? anker : dekodiereFehlertolerant(anker)
  return mitTrennern.includes('=') ? bereinigeQuery(mitTrennern, false, tiefe, nachlese) : bereinigePfad(anker, nachlese, tiefe > 0)
}

/** Eine absolute Adresse in einem Text, bis zum Leerraum. */
const ADRESSE_IM_TEXT = /https?:\/\/\S+/gi

/** Bereinigt URLs, die IN einem Text stecken (Span-Beschreibungen wie
 *  „GET https://…?token=…", seit Nr. 56 Runde 1 auch groß geschrieben),
 *  danach den Text selbst. Geht eine Nummer aus einer Adresse hinter ihr weiter,
 *  fällt ihr Rest wie im Freitext (findeNummernReste, Nr. 64): Vorher fing die
 *  Telefon-Regel sie nur, wo die neu kodierte Adresse ihr den Anfang zufällig
 *  stehen ließ (`…token=2021-10-12+43 (664) 987-6543`). */
function bereinigeTextMitUrls(text: string): string {
  const ohneReste = ersetzeVereinigt(text, findeNummernReste(text, ADRESSE_IM_TEXT, [...text.matchAll(TELEFON_MUSTER)], false))
  return bereinigeTextGanz(ohneReste.replace(ADRESSE_IM_TEXT, (url) => bereinigeUrl(url, 0, false)))
}

/** Span-Attribute: IP-Träger fallen ganz weg, Query und URLs werden
 *  bereinigt. */
function bereinigeSpanDaten(daten: Record<string, unknown>): void {
  for (const [schluessel, wert] of Object.entries(daten)) {
    if (istIpSpanAttribut(schluessel)) {
      delete daten[schluessel]
      continue
    }
    if (typeof wert !== 'string') continue
    if (/query/i.test(schluessel)) daten[schluessel] = bereinigeQuery(wert)
    else if (/url|path|target/i.test(schluessel)) daten[schluessel] = bereinigeUrl(wert)
  }
}

/** Nur echte Objekte (kein Array, kein null) werden betreten — Ereignisse
 *  können aus fremdem Code verquer gebaut ankommen. */
function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert)
}

// ─── Strukturierte Felder (Nr. 47) ─────────────────────────────────────────

const IP_ERSATZ = '[ip entfernt]'
const OBJEKT_ERSATZ = '[objekt entfernt]'

/** IPv4 — vier Zahlen von 0 bis 255. Versionen mit drei Stellen (22.22.2)
 *  bleiben; eine vierstellige Version fiele mit, das ist die sichere Richtung. */
const IPV4_MUSTER = /\b(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\b/g

/** IPv6 — Hex-Gruppen mit „::" oder acht volle Gruppen. Uhrzeiten
 *  (10:30:45) haben weder das eine noch das andere; davor und danach steht
 *  kein Wortzeichen und kein Doppelpunkt, so bleibt auch „Fehler::" stehen. */
const IPV6_MUSTER =
  /(?<![\w:])(?=[0-9a-f:]*::|(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4})(?=[0-9a-f:]*[0-9a-f])[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}(?![\w:])/gi

/** Ein Schlüssel vor „=" oder „:" — die ganze Folge aus Wortzeichen und „-"
 *  (ersetzeZuweisungen); ob er geheim ist, entscheidet istGeheimerSchluessel.
 *  Anführungszeichen um Schlüssel und Wert gehören zum Trenner (Runde 1):
 *  Prisma schreibt `token: "…"`, JSON `"access_token":"…"` — vorher beendete
 *  das Zeichen den Wert, bevor er anfing. Backticks nicht: In ihnen nennt
 *  Prisma Felder („Argument `token`: Invalid value …"). Ein Prozent-Escape
 *  davor ist eine Grenze wie ein Leerzeichen (Runde 2: in „Fehler%20token=…"
 *  hieß der Schlüssel sonst „20token"); mitten in einem Escape beginnt keiner. */
const ZUWEISUNG_KANDIDAT = /(?:(?<=%[0-9A-Fa-f]{2})|(?<![\w-])(?:(?<!%)|(?![0-9A-Fa-f]{2})))([\w-]+)(["']?\s*[=:]\s*["']?)/g

/** Wörter, die einen Schlüssel geheim machen. `code` fehlt bewusst:
 *  „code=P2002" ist ein Prisma-Fehlercode. */
const GEHEIMES_WORT = new Set(['token', 'secret', 'passwort', 'password', 'otp', 'signatur', 'signature', 'sig', 'apikey', 'authorization'])

/** Jedes Wort aus GEHEIMES_WORT enthält eines davon (api: apikey, api_key). */
const GEHEIMES_WORT_IRGENDWO = /token|secret|passwor[dt]|otp|sig|api|authorization/i

/** Ein Platzhalter dieser Datei („[entfernt]", „[code entfernt]" …), klebend. */
const EIGENER_PLATZHALTER = /\[[a-z -]{0,12}entfernt\]/iy

/** Ein Wert bis zum nächsten Trenner, klebend. */
const ZUWEISUNG_WERT = /[^\s&,;"'<>]*/y

/** Ist ein Teil des Schlüssels ein geheimes Wort? Teile trennen „_", „-" und
 *  der Wechsel zu einem Großbuchstaben (Runde 1: access_token, reset-token,
 *  resetToken, XMLToken, x-api-key), seit der Nacharbeit nach Runde 2 auch
 *  der von Ziffern zu Buchstaben (oauth2token; ein Schlüssel direkt hinter
 *  einer Nummer, „…4567token: …", die vorab mit einem Wert fällt). Ein Wort,
 *  das nur so anfängt oder endet (tokenizer, Apfelessig), ist kein Teil —
 *  vorher galt nur der Anfang eines Worts, und „access_token=…" blieb stehen. */
function istGeheimerSchluessel(schluessel: string): boolean {
  // Vorfilter: Steckt keines der Wörter auch nur als Teil darin, ist der
  // Schlüssel nie geheim — der häufige Fall, ohne Zerlegen.
  if (!GEHEIMES_WORT_IRGENDWO.test(schluessel)) return false
  const teile = schluessel
    .replace(/([a-z0-9])(?=[A-Z])|([A-Z])(?=[A-Z][a-z])|(\d)(?=[a-z])/g, '$1$2$3_')
    .toLowerCase()
    .split(/[_-]+/)
  return teile.some((teil, i) => GEHEIMES_WORT.has(teil) || (teil === 'api' && teile[i + 1] === 'key'))
}

/**
 * Werte von Geheimnissen: „token=…", „secret: …" (Zuweisungen in freiem Text,
 * auch ohne Adresse davor; der Wert bis zum nächsten Trenner) und „Bearer …".
 * Ist der ganze Wert schon ein Platzhalter dieser Datei („otp: [code
 * entfernt]"), bleibt er stehen — sonst würde daraus „otp: [entfernt]
 * entfernt]" (Nr. 56). Nur ein eigener Platzhalter, nicht jeder Wert mit „["
 * (Runde 1: sonst blieb „token=[abc123]" stehen); hängt etwas daran, fällt der
 * ganze Wert.
 *
 * Seit Nr. 64 lesen beide Regeln den unveränderten Text, ihre Bereiche werden
 * zusammengelegt (wie ersetzeVorab): Es fällt nur ein Wert, nie ein Schlüssel —
 * vorher fiel zuerst der Bearer-Token und nahm einen Schlüssel dahinter mit
 * („Bearer +otp: 012012", der Code blieb). Beginnt in einem Wert eine Nummer,
 * fällt sie bis zu ihrem Ende, sonst bliebe hinter dem Wert ein Rest, in dem
 * die Telefon-Regel keine Nummer mehr sieht (`token=0664 1234567`,
 * `Bearer 0664+9876543` in einem Abfragewert — dort laufen die Werte vor der
 * Telefon-Regel; NUMMER_IM_WERT). Linear: Jeder Schlüssel wird einmal gefunden
 * und eingeteilt, jeder Wert einmal gelesen; die Nummern liest ein Durchgang
 * über die zusammengelegten Bereiche.
 */
function ersetzeZuweisungen(text: string): string {
  return ersetzeVereinigt(text, findeZuweisungsBereiche(text))
}

/** Die Bereiche von ersetzeZuweisungen, geordnet und zusammengelegt — für Regeln,
 *  die sie mit eigenen Bereichen auf demselben Text vereinigen (bereinigeLesarten,
 *  findeNummernReste). */
function findeZuweisungsBereiche(text: string): Bereich[] {
  const werte: Bereich[] = []
  for (const treffer of text.matchAll(BEARER_MUSTER)) {
    const ende = treffer.index + treffer[0].length
    werte.push({ anfang: ende - treffer[1].length, ende, ersatz: WERT_ERSATZ })
  }
  // Ein Schlüssel zählt nicht, wenn sein Wert im Wert einer Zuweisung davor
  // beginnt — so liest sich jeder Wert nur einmal. Trägt sein Trenner Leerraum,
  // beginnt sein Wert erst dahinter, und er zählt (`token: abc]otp: 123456`,
  // `Bearer otp: 123456`): Vorher zählte kein Schlüssel in einem Wert, und main
  // fing seinen Wert nur, wo ein Platzhalter den Wert davor zerteilt hatte. Ein
  // Bearer-Token ist kein solcher Wert (`Bearer token=%2F…`: Der Token endet am
  // Escape, der Wert von token nicht).
  let zuweisungEnde = 0
  for (const treffer of text.matchAll(ZUWEISUNG_KANDIDAT)) {
    const wertAnfang = treffer.index + treffer[0].length
    if (wertAnfang < zuweisungEnde || !istGeheimerSchluessel(treffer[1])) continue
    const wertEnde = zuweisungsEnde(text, wertAnfang)
    if (wertEnde === -1) continue
    werte.push({ anfang: wertAnfang, ende: wertEnde, ersatz: WERT_ERSATZ })
    zuweisungEnde = wertEnde
  }
  if (werte.length === 0) return werte
  werte.sort((a, b) => a.anfang - b.anfang)
  const nummern = [...text.matchAll(NUMMER_IM_WERT)]
  const vereint: Bereich[] = []
  let nummer = 0
  for (const wert of werte) {
    const letzter = vereint.length > 0 ? vereint[vereint.length - 1] : null
    // Auch aneinanderstoßende Werte werden einer (Token und Wert dahinter).
    if (letzter !== null && wert.anfang <= letzter.ende) letzter.ende = Math.max(letzter.ende, wert.ende)
    else vereint.push({ ...wert })
    const aktuell = vereint[vereint.length - 1]
    for (; nummer < nummern.length && nummern[nummer].index < aktuell.ende; nummer++) {
      if (nummern[nummer].index >= aktuell.anfang) aktuell.ende = Math.max(aktuell.ende, nummern[nummer].index + nummern[nummer][0].length)
    }
  }
  return vereint
}

/** Eine Nummer, die einen Wert verlängert (ersetzeZuweisungen): ohne Ränder,
 *  ein „+" zählt auch als Trenner — so liest eine Abfrage den Wert später
 *  (`otp: 012012+43 664 9876543` in ?next=…: Sonst fiele `012012+43` und
 *  „664 9876543" bliebe). Linear: Ein Versuch, der scheitert, liest höchstens
 *  acht Ziffern samt Trennern. */
const NUMMER_IM_WERT = /(?:\+|\(?0)\d(?:[\s/\-.()+]{0,3}\d){7,}/g

/** Wo der Wert einer Zuweisung ab `wertAnfang` endet — -1, wenn er stehen
 *  bleibt: Es gibt keinen, oder er ist genau ein eigener Platzhalter. */
function zuweisungsEnde(text: string, wertAnfang: number): number {
  EIGENER_PLATZHALTER.lastIndex = wertAnfang
  const nachPlatzhalter = EIGENER_PLATZHALTER.test(text) ? EIGENER_PLATZHALTER.lastIndex : wertAnfang
  ZUWEISUNG_WERT.lastIndex = nachPlatzhalter
  ZUWEISUNG_WERT.test(text)
  const wertEnde = ZUWEISUNG_WERT.lastIndex
  return wertEnde === wertAnfang || (nachPlatzhalter > wertAnfang && wertEnde === nachPlatzhalter) ? -1 : wertEnde
}

/** „Bearer" und sein Token. Hängt am Token ein „@", ist er der Anfang einer
 *  E-Mail-Adresse: Das Wort bis zum Leerraum fällt mit (wie in ersetzeVorab) —
 *  sonst bliebe die Adresse ohne ihren Anfang stehen (Nr. 64). */
const BEARER_MUSTER = /\bBearer\s+([A-Za-z0-9._~+/=-]+(?:@\S*)?)/g

/** Lange undurchsichtige Zeichenfolgen (Token, Signaturen, Hashes) ab 32
 *  Zeichen. Datensatz-Kennungen (cuid, 25 Zeichen) und Stripe-Kennungen
 *  bleiben lesbar — sie sind der Anker zum Beheben. */
const LANGE_KENNUNG_MUSTER = /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_-])/g

/** Schlüssel, deren Wert nie nach Sentry geht — gleich, was drinsteht.
 *  `mail` allein (Tag „welche Mail") und `code` (Fehlercode) gehören nicht dazu. */
const HEIKLER_SCHLUESSEL =
  /token|secret|passw|e-?mail|cookie|authorization|^auth$|session|telefon|phone|otp|anmeldecode|signatur|signature|^sig$|^s$|iban|kreditkarte|^ip$|ip_?addr|ip_?adresse|client_?ip|remote_?addr/i

/** Kontexte, die das SDK selbst mit technischen Angaben füllt — Laufzeit,
 *  Betriebssystem, Browser, Gerät, Prozess, Sprache und Zeitzone,
 *  Rechenzentrum. Kein Freitext von Menschen, deshalb bleiben sie unberührt:
 *  Die IP-Regel träfe sonst Versionen wie „120.0.0.0" (Chrome). `trace` hat
 *  seine eigene Regel (Span-Daten); jeder andere Kontext — auch eigene wie
 *  `upload` — wird bereinigt. */
const UNBEDENKLICHE_KONTEXTE = new Set(['runtime', 'os', 'browser', 'device', 'app', 'culture', 'cloud_resource'])

/** Bis zu dieser Tiefe wird ein Wert gesichtet; darunter fällt er weg, statt
 *  ungeprüft mitzugehen (das SDK kappt ohnehin nach drei Ebenen). */
const MAX_TIEFE = 8

function entferneIps(text: string): string {
  return text.replace(IPV4_MUSTER, IP_ERSATZ).replace(IPV6_MUSTER, IP_ERSATZ)
}

/**
 * Ein Text aus einem strukturierten Feld. Ist er ganz eine Adresse (absolut
 * oder ab „/"), gilt die URL-Regel (Pfad-Token, heikle Parameter, Blob-Pfad);
 * sonst die Text-Regel samt eingebetteter Adressen — seit Nr. 56, Runde 2,
 * relativ mit derselben Grenze wie im Fehlertext, absolut (auch in einer
 * relativen) bis zum Leerraum (ADRESSE_IM_FREITEXT), Werte hinter Leerraum
 * vorab (ersetzeVorab): Vorher blieb
 * „Fehler bei /login?next=%2F…%3Ftoken%3D…" in Nachricht, Brotkrume und extra
 * stehen, im Fehlertext fiel der Token.
 * IP-Adressen fallen zuerst — sonst hielte die Telefon-Regel eine lange IPv4
 * für eine Nummer.
 */
function bereinigeFreitext(text: string): string {
  const ohneIp = entferneIps(text)
  if (/^(?:https?:\/\/|\/)\S*$/i.test(ohneIp)) return bereinigeUrl(ohneIp)
  const vorab = ersetzeVorab(ohneIp, ADRESSE_IM_FREITEXT, true)
  const mitAdressen = bereinigeText(vorab.replace(ADRESSE_IM_FREITEXT, (adresse) => bereinigeUrl(adresse, 0, false)))
  const ohneZuweisung = ersetzeZuweisungen(mitAdressen)
  // Lange Kennungen und Nachlese auf demselben Text, vereinigt (Runde 1): Nacheinander
  // nahm die Kennung das Ende einer Nummer mit (`<uuid>+43 (664) 987-6543<Kennung>`
  // ließ `+43 (664)` stehen); eine Nummer ganz in einer Kennung fällt mit ihr.
  return ersetzeVereinigt(ohneZuweisung, [
    ...findeTreffer(ohneZuweisung, LANGE_KENNUNG_MUSTER).map((kennung): Bereich => ({ ...kennung, ersatz: KENNUNG_ERSATZ })),
    ...findeTreffer(ohneZuweisung, TELEFON_AM_WORT_MUSTER).map((nummer): Bereich => ({ ...nummer, ersatz: TELEFON_ERSATZ })),
  ])
}

const KENNUNG_ERSATZ = '[kennung entfernt]'

/** „Bearer" vor einem Token (ersetzeVorab), auch direkt hinter Ziffern wie
 *  die Schlüssel (istGeheimerSchluessel): `…4567Bearer …` sahen die Regeln danach
 *  erst, wenn die Nummer gefallen war — vorab fiel sie aber womöglich schon mit
 *  einem anderen Wert. */
const BEARER_VORAB = /(?:\b|(?<=\d))Bearer\s+(?=[A-Za-z0-9._~+/=-])/g

/** ANMELDECODE_MUSTER für ersetzeVorab, ebenso auch direkt hinter Ziffern. */
const ANMELDECODE_VORAB = /(?:\b|(?<=\d))(code|otp|anmeldecode)(\W{1,3})\d{6}\b/gi

/** Ein Bearer-Token wie in BEARER_MUSTER, klebend. */
const BEARER_TOKEN = /[A-Za-z0-9._~+/=-]+/y

/** Der Rest eines Worts bis zum Leerraum, klebend. */
const BIS_LEERRAUM = /\S*/y

/** Weitere Ziffern einer Nummer hinter Trennern wie in TELEFON_MUSTER, klebend. */
const ZIFFERN_REST = /(?:[\s/\-.()]{1,3}\d)(?:[\s/\-.()]{0,3}\d)*/y

/** Ein „/" nach Leerraum oder Klammer: Dort beginnt in Ziffern eine Adresse. */
const ADRESSE_IN_ZIFFERN = /(?<=[\s()])\//g

/** Wo eine Adresse beginnen kann: wie in ADRESSE_IM_FREITEXT und ADRESSE_IM_FEHLERTEXT. */
const ADRESS_ANFANG = /https?:\/\/|(?<![\p{L}\p{N}\p{M}_/.~%-])\//iu

/**
 * Das Ende eines Werts aus ersetzeVorab. Beginnt in ihm eine Adresse, fällt
 * das ganze Wort bis zum Leerraum: Endete der Ersatz am Wert, blieben die
 * übrigen Parameter der Adresse stehen (`token: (/x?a=1&s=…)`,
 * `Bearer https://…?a=(1)&s=…`), und über Leerraum reicht keine Adresse.
 * Vor dem Wert steht Leerraum oder ein Trenner, an dem keine beginnt — so
 * liest ADRESS_ANFANG das Wort wie die Durchgänge danach.
 */
function endeMitAdresse(text: string, anfang: number, ende: number): number {
  const wort = wortEnde(text, anfang)
  const adresse = text.slice(anfang, wort).search(ADRESS_ANFANG)
  return adresse !== -1 && anfang + adresse < ende ? wort : ende
}

/** Das Ende des Worts ab `stelle`. */
function wortEnde(text: string, stelle: number): number {
  BIS_LEERRAUM.lastIndex = stelle
  BIS_LEERRAUM.test(text)
  return BIS_LEERRAUM.lastIndex
}

/** Wie viele Nummern aus `liste` (geordnet) vor `stelle` beginnen — binär gesucht. */
function zaehleNummernVor(liste: RegExpExecArray[], stelle: number): number {
  let links = 0
  let rechts = liste.length
  while (links < rechts) {
    const mitte = (links + rechts) >> 1
    if (liste[mitte].index < stelle) links = mitte + 1
    else rechts = mitte
  }
  return links
}

/** Die Nummer aus `liste` (geordnet, ohne Überlappung), die als letzte vor `stelle` beginnt. */
function findeNummerVor(liste: RegExpExecArray[], stelle: number): RegExpExecArray | undefined {
  const davor = zaehleNummernVor(liste, stelle)
  return davor > 0 ? liste[davor - 1] : undefined
}

/** Wo die erste Nummer aus `liste` (geordnet) ab `stelle` beginnt, sonst undefined. */
function findeErsteNummerAb(liste: RegExpExecArray[], stelle: number): number | undefined {
  return liste[zaehleNummernVor(liste, stelle)]?.index
}

/**
 * Die Reste von Nummern hinter Adressen (ersetzeVorab, seit Nr. 64 auch
 * bereinigeTextMitUrls): Eine Telefonnummer reicht über Leerraum, eine Adresse
 * nicht. Beginnt eine Nummer der Telefon-Regel oder der Nachlese in einer
 * Adresse und geht dahinter weiter (`…?s=0664 1234567`, `…?q=a1+43 664 …`),
 * fällt ihr Rest hinter der Adresse — sonst sähe die Telefon-Regel im Rest keine
 * Nummer mehr, wenn ihr Anfang mit einem Wert fällt. Er bleibt nur, wenn eine
 * der beiden Regeln die Nummer danach über die Grenze der bereinigten Adresse
 * nimmt (`?tel=0664`, `/x/<uuid>+43 664 …`). Seit Nr. 64 zählt dafür jede Nummer,
 * die in der bereinigten Adresse beginnt und über ihre Grenze in den Rest reicht —
 * vorher musste der Anfang der Nummer dort unverändert stehen, und neu kodiert
 * (`?q=(0043 664 …` → `%280043`) blieb er stehen, nur der Rest fiel. Nur die
 * Zeichen zu vergleichen genügte ohnehin nicht: `?a=106&s=06 64 …` endet
 * bereinigt zufällig auch auf „06", aber mitten in einer Zahl setzt die Regel
 * nicht an. Reicht eine E-Mail-Adresse in den Rest (`… 9876543xq%40…`), nimmt
 * ihre Regel ab ihrem Anfang die Ziffern vor der Telefon-Regel: Dann muss die
 * Telefon-Regel nur bis dorthin reichen. `nummern` sind die Treffer der
 * Telefon-Regel im Text. Seit Nr. 64, Runde 1, zählt auch eine Nummer, die erst
 * in einer dekodierten Lesart der Adresse beginnt (findeDekodiertenRest), und der
 * Rest bleibt auch, wenn der Wert einer Zuweisung aus der bereinigten Adresse ihn
 * ganz deckt; `langeKennungen`: Im Freitext fällt eine lange Kennung, die der Rest
 * anschneidet, mit ihm (findeKennungsEnde). Linear:
 * Jede Adresse, über deren Ende eine Nummer reicht, wird einmal mehr bereinigt
 * und gelesen, ebenso jede, hinter der eine Ziffer folgt; Nummern und
 * E-Mail-Adressen sucht je ein Durchgang.
 */
function findeNummernReste(text: string, adressen: RegExp, nummern: RegExpExecArray[], langeKennungen: boolean): Bereich[] {
  const bereiche: Bereich[] = []
  const nummernAmWort = [...text.matchAll(TELEFON_AM_WORT_MUSTER)]
  const emails = [...findeEmailBereiche(text), ...[...text.matchAll(EMAIL_KODIERT_MUSTER)].map((treffer) => ({ anfang: treffer.index, ende: treffer.index + treffer[0].length }))]
  emails.sort((a, b) => a.anfang - b.anfang)
  let email = 0
  const treffer = [...text.matchAll(adressen)]
  for (const [i, adresse] of treffer.entries()) {
    const ende = adresse.index + adresse[0].length
    const nummer = [findeNummerVor(nummern, ende), findeNummerVor(nummernAmWort, ende)].find(
      (kandidat) => kandidat !== undefined && kandidat.index >= adresse.index && kandidat.index + kandidat[0].length > ende
    )
    // Der Rest liest nur bis zur nächsten Adresse — so liest jede Stelle nur einmal
    // (`/1 /2 /3 …`: Die Kette liefe sonst von jeder Adresse bis ans Ende).
    const kette = NUMMER_KETTE.exec(text.slice(ende, i + 1 < treffer.length ? treffer[i + 1].index : text.length))?.[0] ?? ''
    const nummerEnde = Math.max(nummer === undefined ? ende : nummer.index + nummer[0].length, ende + findeDekodiertenRest(adresse[0], kette))
    if (nummerEnde === ende) continue
    // Die Adressen sind geordnet: Eine E-Mail-Adresse, die vor diesem Rest endet, endet vor jedem weiteren.
    while (email < emails.length && emails[email].ende <= ende) email++
    const bis = email < emails.length && emails[email].anfang < nummerEnde ? emails[email].anfang : nummerEnde
    const bereinigt = bereinigeUrl(adresse[0], 0, false)
    const zusammen = bereinigt + text.slice(ende, bis)
    // Nimmt eine Regel danach die Nummer über die Grenze der bereinigten Adresse,
    // bleibt der Rest für sie: die Telefon-Regel oder die Nachlese — über die Grenze
    // genügt, eine Lesart mit „+" als Trenner liest die Nummer oft weiter
    // (`+43 664 9876543+012`), und fiele ihr Rest vorher, bliebe ihr Anfang in der
    // Adresse —, oder der Wert einer Zuweisung aus der Adresse, wenn er den ganzen
    // Rest deckt: Fehlertext und Freitext lesen Zuweisungen danach im ganzen Text,
    // über ein „)" am Adressende hinweg (`/token=(0664)+987+65+43…`), und ein
    // Platzhalter hier zerteilte den Wert (endet er vorher, an `/token=(0664) 98…`,
    // fällt der Rest wie sonst).
    const grenze = bereinigt.length
    const nimmtSie =
      [...findeTreffer(zusammen, TELEFON_MUSTER), ...findeTreffer(zusammen, TELEFON_AM_WORT_MUSTER)].some((nummer) => nummer.anfang < grenze && nummer.ende > grenze) ||
      findeZuweisungsBereiche(zusammen).some((wert) => wert.anfang < grenze && wert.ende >= zusammen.length)
    if (nimmtSie) continue
    // Das Zeichen, an dem die Adresse endet, bleibt — so bleibt auch ihre Grenze.
    let rest = ende + 1
    while (rest < nummerEnde && /\s/.test(text[rest])) rest++
    if (rest >= nummerEnde) continue
    // Im Freitext fällt eine lange Kennung, die der Rest anschneidet, mit ihm — so weit,
    // wie sie nach E-Mail- und Telefon-Regel noch steht: Die laufen vor der Regel der
    // langen Kennung (`…9876543cka…0664/9876543`, `…9876543cka…xq%40example.com`).
    const grenzeKennung = Math.min(findeErsteNummerAb(nummern, nummerEnde) ?? text.length, email < emails.length ? emails[email].anfang : text.length)
    bereiche.push({ anfang: rest, ende: langeKennungen ? findeKennungsEnde(text, nummerEnde, grenzeKennung) : nummerEnde, ersatz: TELEFON_ERSATZ })
  }
  return bereiche
}

/** Die Treffer eines Musters als Bereiche. */
function findeTreffer(text: string, muster: RegExp): { anfang: number; ende: number }[] {
  return [...text.matchAll(muster)].map((treffer) => ({ anfang: treffer.index, ende: treffer.index + treffer[0].length }))
}

/** Zeichen einer langen Kennung (LANGE_KENNUNG_MUSTER) ab einer Stelle, klebend. */
const KENNUNG_ZEICHEN = /[A-Za-z0-9_-]*/y

/** Das Ende der langen Kennung, in der das Zeichen vor `stelle` liegt und die vor
 *  `grenze` endet, sonst `stelle` (findeNummernReste im Freitext): Endet der Rest
 *  einer Nummer in einer Folge, die LANGE_KENNUNG_MUSTER danach ganz nähme
 *  (`… 9876543cka…`), zerteilte sein Platzhalter sie, und der Teil dahinter bliebe
 *  stehen — die Bereiche werden vereinigt. Linear: Die Folge liegt im Rest hinter
 *  einer Adresse, vor der nächsten. */
function findeKennungsEnde(text: string, stelle: number, grenze: number): number {
  KENNUNG_ZEICHEN.lastIndex = stelle
  KENNUNG_ZEICHEN.test(text)
  const bis = Math.min(KENNUNG_ZEICHEN.lastIndex, grenze)
  let von = stelle
  while (von > 0 && /[A-Za-z0-9_-]/.test(text[von - 1])) von--
  return bis - von >= 32 ? bis : stelle
}

/** Ziffern und Trenner einer Nummer am Anfang, auch „+" wie in der Plus-Lesart:
 *  So weit kann eine Nummer aus einer Adresse in den Text dahinter reichen. */
const NUMMER_KETTE = /^[\s/\-.()+\d]*/

/** Ein Text so oft dekodiert, wie er sich ändert — höchstens eine Runde mehr,
 *  als weiterDekodiert prüft (was tiefer kodiert ist, fällt dort ganz). */
function dekodiereGanz(text: string): string {
  let ergebnis = text
  for (let runde = 0; runde <= MAX_ADRESS_TIEFE; runde++) {
    const weiter = dekodiereFehlertolerant(ergebnis)
    if (weiter === ergebnis) break
    ergebnis = weiter
  }
  return ergebnis
}

/**
 * Wie weit eine Nummer, die in einer dekodierten Lesart der Adresse beginnt, in
 * die `kette` dahinter reicht — 0, wenn keine (findeNummernReste, Nr. 64, Runde 1).
 * Die URL-Regel liest Abfragewerte dekodiert und nimmt dort eine Nummer bis zum
 * Ende der Adresse; ihr Rest dahinter blieb roh stehen
 * (`?q=token=%280664%29%2098765430043 664 9876543` → `token%3D%5Bentfernt%5D 664 9876543`).
 * main fing ihn nur zufällig: Die neu kodierte Adresse stellte dem Rest ein „+"
 * oder ein Escape voran. Gelesen wird wie in der URL-Regel: mit „+" als
 * Leerzeichen die Telefon-Regel, die Nachlese und die Zuweisungs-Regel samt
 * Nummer im Wert, mit „+" als Plus die Nummern der Plus-Lesart. Die Kette bleibt
 * roh, wie sie im Text steht. Linear: jede Lesart einmal dekodiert und je Regel
 * einmal gelesen.
 */
function findeDekodiertenRest(adresse: string, kette: string): number {
  if (!/\d/.test(kette)) return 0
  let weite = 0
  const miss = (lesart: string, bereiche: { anfang: number; ende: number }[]) => {
    for (const bereich of bereiche) {
      if (bereich.anfang < lesart.length && bereich.ende > lesart.length) weite = Math.max(weite, bereich.ende - lesart.length)
    }
  }
  const leer = dekodiereGanz(adresse.replace(/\+/g, ' '))
  miss(leer, [...findeTreffer(leer + kette, TELEFON_MUSTER), ...findeTreffer(leer + kette, TELEFON_AM_WORT_MUSTER), ...findeZuweisungsBereiche(leer + kette)])
  const plus = dekodiereGanz(adresse)
  miss(plus, findePlusNummern(plus + kette, GLEICH))
  return weite
}

/**
 * Werte hinter Leerraum fallen vor den Adressen (Nacharbeit nach Runde 2):
 * „Bearer …", „code: 123456", „token: …". Liest eine Adresse davor ihr
 * Schlüsselwort mit — sie reicht bis zum Leerraum (`…?a=1,"h":"Bearer`) —,
 * steht es danach kodiert in ihr (`%22Bearer`, `token%3A`): Die Regeln
 * danach sähen es nicht mehr, und der Wert dahinter bliebe. Ein Wert ohne
 * Leerraum vor sich liegt in derselben Adresse wie sein Schlüssel; den nimmt
 * die URL-Regel.
 *
 * Es fällt der Wert, kein Schlüssel davor: Nähme der Ersatz einen mit, bliebe
 * dessen Wert stehen (`token: abc,password: geheim`). Beginnt im Wert eine
 * Adresse, fällt das Wort mit (endeMitAdresse). Eine Telefonnummer reicht über
 * Leerraum: Beginnt sie im Wert, fällt sie bis zu ihrem Ende mit; beginnt sie
 * in einer Adresse und geht dahinter weiter (`…?s=0664 1234567`), fällt ihr
 * Rest hinter der Adresse, wenn ihr Anfang dort mit einem heiklen Parameter
 * fällt — sonst sähe die Telefon-Regel im Rest keine Nummer mehr. Alle Regeln
 * lesen den unveränderten Text, ihre Bereiche werden danach zusammengelegt —
 * so nimmt auch ein Wort, das fällt, keinem Schlüssel darin seinen Wert
 * hinter dem Leerraum. Linear: Nummern und Adressen werden je einmal gesucht,
 * jede Regel setzt je Treffer einmal an, jedes Wort liest sie höchstens
 * einmal, und eine Adresse, über deren Ende eine Nummer reicht, wird einmal
 * mehr bereinigt. `langeKennungen`: Danach folgt LANGE_KENNUNG_MUSTER (Freitext).
 */
function ersetzeVorab(text: string, adressen: RegExp, langeKennungen: boolean): string {
  const nummern = [...text.matchAll(TELEFON_MUSTER)]
  const bereiche: Bereich[] = []
  /** Ein Wert ab `anfang`, mit Adresse und Nummer, die in ihm beginnen. Ist er
   *  ganz eine Nummer, nimmt ihn deren Regel, mit ihrem Platzhalter. Endet ein
   *  Geheimnis (`ziffernRest`) auf eine Ziffer, fallen die Ziffern dahinter mit:
   *  Ob eine Nummer dort beginnt, sieht die Telefon-Regel oft erst, wenn vorher
   *  eine E-Mail-Adresse gefallen ist (`kundin@example.com0664 1234567`). Der
   *  Bereich wächst, bis nichts mehr dazukommt — in dem, was er dazunimmt, kann
   *  wieder eine Nummer oder Adresse beginnen. Jede Runde liest nur das neue Stück. */
  const wert = (anfang: number, ende: number, ersatz: string, ziffernRest = true, nummerAb = anfang) => {
    const bis = endeMitAdresse(text, anfang, ende)
    const erste = findeNummerVor(nummern, bis)
    if (erste !== undefined && erste.index >= nummerAb && erste.index <= anfang && erste.index + erste[0].length >= bis) return
    let ganz = bis
    for (;;) {
      let neu = ganz
      const nummer = findeNummerVor(nummern, neu)
      if (nummer !== undefined && nummer.index >= nummerAb) neu = Math.max(neu, nummer.index + nummer[0].length)
      if (ziffernRest && /\d/.test(text[neu - 1])) {
        ZIFFERN_REST.lastIndex = neu
        if (ZIFFERN_REST.test(text)) neu = ZIFFERN_REST.lastIndex
      }
      // Beginnt im neuen Stück eine Adresse (` /664/1?s=…`), fällt ihr Wort mit — das
      // der letzten, es reicht am weitesten (` /1 /2?s=…`).
      const von = Math.max(bis, ganz - 1)
      let adresse = -1
      for (const anfangAdresse of text.slice(von, neu).matchAll(ADRESSE_IN_ZIFFERN)) adresse = anfangAdresse.index
      if (adresse !== -1) neu = Math.max(neu, wortEnde(text, von + adresse))
      // Klebt am Ende ein „/" — davor steht dann eine Ziffer, nach der keine Adresse
      // beginnt —, begänne hinter dem Platzhalter eine, die vorher keine war
      // (`…6543/x?s=0664 …`): Das Wort fällt mit.
      if (text[neu] === '/') neu = wortEnde(text, neu)
      if (neu === ganz) break
      ganz = neu
    }
    bereiche.push({ anfang, ende: ganz, ersatz })
  }
  // Die Codes zuerst: Bei „otp: 123456" greifen Code und Zuweisung; reichen
  // beide gleich weit, bleibt der Code-Platzhalter (die Sortierung unten ist stabil).
  for (const treffer of text.matchAll(ANMELDECODE_VORAB)) {
    const trenner = treffer[2]
    if (!/\s/.test(trenner)) continue
    const anfang = treffer.index + treffer[1].length + trenner.length
    // Mit „/" davor beginnt eine Adresse (`code /123456?s=…`): Das Wort fällt mit,
    // sonst schnitte der Platzhalter sie hinter dem Code entzwei. Beginnt schon
    // im Trenner eine Nummer (`code: +436641 987654`), nimmt sie deren Regel.
    const ende = trenner.includes('/') ? wortEnde(text, anfang) : treffer.index + treffer[0].length
    wert(anfang, ende, '[code entfernt]', false, treffer.index + treffer[1].length)
  }
  for (const treffer of text.matchAll(BEARER_VORAB)) {
    const anfang = treffer.index + treffer[0].length
    BEARER_TOKEN.lastIndex = anfang
    BEARER_TOKEN.test(text)
    // Hängt am Token ein „@", ist er der Anfang einer E-Mail-Adresse: Das Wort fällt mit.
    const ende = text[BEARER_TOKEN.lastIndex] === '@' ? wortEnde(text, anfang) : BEARER_TOKEN.lastIndex
    wert(anfang, ende, '[entfernt]')
  }
  for (const treffer of text.matchAll(ZUWEISUNG_KANDIDAT)) {
    if (!/\s/.test(treffer[2]) || !istGeheimerSchluessel(treffer[1])) continue
    const anfang = treffer.index + treffer[0].length
    const ende = zuweisungsEnde(text, anfang)
    // Ist der ganze Wert eine E-Mail-Adresse, nimmt ihn deren Regel — auch ohne Schlüssel.
    if (ende === -1 || ersetzeEmails(text.slice(anfang, ende)) === '[e-mail entfernt]') continue
    wert(anfang, ende, '[entfernt]')
  }
  bereiche.push(...findeNummernReste(text, adressen, nummern, langeKennungen))
  // Ein Bereich, der vor dem Ende des vorigen beginnt, liegt in ihm: In einem
  // Wort beginnen zwei Werte nur am selben Ort (otp: 123456) — dann zuerst der
  // längere, „otp: 905173-abc" fällt als Wert —, und der Rest einer Nummer
  // hinter einer Adresse endet, wo die Nummer endet.
  bereiche.sort((a, b) => a.anfang - b.anfang || b.ende - a.ende)
  let ergebnis = ''
  let ende = 0
  for (const bereich of bereiche) {
    if (bereich.anfang < ende) continue
    ergebnis += text.slice(ende, bereich.anfang) + bereich.ersatz
    ende = bereich.ende
  }
  return ergebnis + text.slice(ende)
}

/** Adressen in einem Fehlertext (Nr. 56): absolut (https://…, auch groß
 *  geschrieben) oder relativ ab „/". Eine relative beginnt nie direkt nach
 *  einem Buchstaben oder einer Ziffer jeder Schrift, nach „_", „/", „.", „~",
 *  „%" oder „-" — so werden „und/oder", „3/4" und „localhost:3000/…" keine
 *  Adresse; nach Doppelpunkt, Komma, Klammer oder Anführungszeichen schon
 *  (Runde 1: vorher nur am Anfang, nach Leerraum, ( [ < " ' ` und „="; „bei:/api/…"
 *  blieb stehen). Leerraum, Anführungszeichen (auch typografische) und
 *  schließende Klammern beenden sie. Linear: Jede Stelle wird höchstens
 *  einmal gelesen. */
const ADRESSE_IM_FEHLERTEXT =
  /https?:\/\/[^\s"'`<>)\]«»„“”‚‘’]+|(?<![\p{L}\p{N}\p{M}_/.~%-])\/[^\s"'`<>)\]«»„“”‚‘’]*/giu

/** Adressen in Nachricht, Brotkrume und extra (bereinigeFreitext): relativ
 *  wie im Fehlertext, absolut aber bis zum Leerraum wie bereinigeTextMitUrls
 *  (Nacharbeit nach Runde 2) — „]", „)" und Anführungszeichen stehen in
 *  Adressen (?f[a]=1, ?utm=(herbst)); endete die Adresse dort, sah die
 *  URL-Regel „&reorder=…" oder „&s=…" dahinter nicht mehr. Steckt in einer
 *  relativen Adresse eine absolute (/api/og?url=https://…), liest die
 *  relative sie mit, bis zum Leerraum: Endete sie davor, landeten die
 *  übrigen Parameter der äußeren Abfrage im Pfad der absoluten, und „&s=…"
 *  blieb. Liest sie so ein Schlüsselwort mit, dessen Wert hinter Leerraum
 *  steht, hat ersetzeVorab diesen Wert vorher genommen. Die Vorschau prüft je
 *  Zeichen acht Zeichen, das bleibt linear.
 *  Im Fehlertext bleibt die engere Grenze: Dort stehen Adressen oft in
 *  Klammern oder JSON, und der Text danach hilft beim Beheben. */
const ADRESSE_IM_FREITEXT =
  /https?:\/\/\S+|(?<![\p{L}\p{N}\p{M}_/.~%-])\/(?:(?!https?:\/\/)[^\s"'`<>)\]«»„“”‚‘’])*(?:https?:\/\/\S*)?/giu

/**
 * Der Fehlertext (exception.value): E-Mail, Telefon und Code wie bisher, seit
 * Nr. 56 auch Adressen mit Token — relativ wie absolut (Bericht 47: „Link
 * /reset-password?token=…" blieb stehen) — mit der URL-Regel, dazu
 * „token=…" und „Bearer …". IP-Adressen bleiben (Adresse des
 * Datenbank-Servers, Nr. 37), ebenso lange Kennungen ohne Adresse:
 * Fehlertexte von Next.js und Prisma tragen technische Kennungen (etwa die
 * einer Server Action, Chunk-Namen beim Nachladen), die beim Beheben helfen.
 * Ein Token mit Schlüssel fällt trotzdem, auch in Anführungszeichen
 * (Prisma: token: "…", Runde 1); einer ganz ohne Schlüssel bleibt.
 */
function bereinigeFehlertext(text: string): string {
  const vorab = ersetzeVorab(text, ADRESSE_IM_FEHLERTEXT, false)
  const mitAdressen = bereinigeText(vorab.replace(ADRESSE_IM_FEHLERTEXT, (adresse) => bereinigeUrl(adresse, 0, false)))
  return ersetzeNummernAmWort(ersetzeZuweisungen(mitAdressen))
}

/**
 * Ein Text unter einem Schlüssel mit „query" (http.query, suchQuery …): Sieht
 * er aus wie ein Query-String (kein Leerraum, mindestens ein „="), fallen
 * heikle Parameter weg, und Namen und Werte gehen dekodiert durch die
 * Freitext-Regel. Sonst ist er Freitext wie jeder andere — „kundin@…" unter
 * `suchQuery` ist kein Parametername.
 */
function bereinigeQueryText(text: string): string {
  // Bis zum ersten „=" ohne Leerraum, danach ohne Leerraum — so setzt das
  // Muster nur einmal an (`^\S*=\S*$` probierte jedes „=" durch: quadratisch).
  return /^[^\s=]*=\S*$/.test(text) ? bereinigeQuery(text, true) : bereinigeFreitext(text)
}

/** Heikel ist ein Schlüssel nach Namen, als IP-Träger oder wenn er selbst
 *  eine Adresse oder Nummer enthält. */
function istHeiklerSchluessel(name: string): boolean {
  return HEIKLER_SCHLUESSEL.test(name) || istIpHeader(name) || istIpSpanAttribut(name) || bereinigeTextGanz(name) !== name
}

/** Ein beliebiger Wert: Texte bereinigt, Zahlen und Wahrheitswerte bleiben,
 *  Objekte und Listen werden betreten, alles andere (Funktion, Symbol) fällt weg. */
function bereinigeWert(wert: unknown, schluessel: string | null, tiefe: number): unknown {
  if (typeof wert === 'string') {
    // Ein Query-String trägt seine Geheimnisse als Parameter — und in den Werten.
    if (schluessel !== null && /query/i.test(schluessel)) return bereinigeQueryText(wert)
    return bereinigeFreitext(wert)
  }
  if (wert === null || typeof wert === 'number' || typeof wert === 'boolean') return wert
  if (tiefe >= MAX_TIEFE) return OBJEKT_ERSATZ
  if (Array.isArray(wert)) return wert.map((eintrag) => bereinigeWert(eintrag, schluessel, tiefe + 1))
  if (istObjekt(wert)) return bereinigeEintraege(wert, tiefe + 1)
  return undefined
}

/** Ein Objekt als NEUES Objekt: heikle Schlüssel fehlen, jeder Wert ist bereinigt. */
function bereinigeEintraege(objekt: Record<string, unknown>, tiefe: number): Record<string, unknown> {
  const sauber: Record<string, unknown> = {}
  for (const [schluessel, wert] of Object.entries(objekt)) {
    if (istHeiklerSchluessel(schluessel)) continue
    const neu = bereinigeWert(wert, schluessel, tiefe)
    if (neu !== undefined) sauber[schluessel] = neu
  }
  return sauber
}

/** Ein Argument einer Konsolen-Zeile: Texte bereinigt, Strukturiertes fällt weg (könnte alles tragen). */
function konsolenArgument(argument: unknown): unknown {
  if (typeof argument === 'string') return bereinigeFreitext(argument)
  if (typeof argument === 'number' || typeof argument === 'boolean' || argument === null) return argument
  return OBJEKT_ERSATZ
}

/** Entfernt `vars` aus allen Frames der Stacktraces einer Liste (Ausnahmen bzw. Threads). */
function entferneFrameVariablen(werte: unknown): void {
  if (!Array.isArray(werte)) return
  for (const wert of werte) {
    if (!istObjekt(wert) || wert.stacktrace === undefined) continue
    if (!istObjekt(wert.stacktrace)) {
      delete wert.stacktrace
      continue
    }
    const frames = wert.stacktrace.frames
    if (frames === undefined) continue
    if (!Array.isArray(frames)) {
      delete wert.stacktrace.frames
      continue
    }
    for (const frame of frames) if (istObjekt(frame)) delete frame.vars
  }
}

/**
 * Ein Ereignis ohne die Daten der Anfrage (Adresse samt Abfrage, Kopfzeilen
 * mit Referer) und ohne Brotkrumen — als Event-Prozessor für Meldungen, die
 * nur sagen, DASS etwas geschah, auf einer Seite, deren Adresse Suchtext
 * trägt (/hoefe?q=…, Nr. 56). Die URL-Regel ließe Suchwörter stehen: Sie
 * kennt nur E-Mail, Telefon, Code und heikle Parameternamen.
 */
export function ohneAnfrage<E extends SentryEvent>(event: E): E {
  delete event.request
  delete event.breadcrumbs
  return event
}

/**
 * Der zentrale Filter — läuft auf Server, Edge und im Browser, für
 * FEHLER-Ereignisse (beforeSend) wie für TRANSAKTIONEN (beforeSendTransaction).
 * Entfernt, was der Kopfkommentar aufzählt; verwirft nie ein Ereignis —
 * ein gefiltertes Ereignis ist besser als keines.
 *
 * WIRFT NIE: Ein Fehler in beforeSend lässt das SDK das Ereignis verwerfen,
 * und wir sähen den Fehler nie. Scheitert die Bereinigung trotzdem an einer
 * unerwarteten Gestalt, geht ein Minimalereignis raus (siehe
 * minimalEreignis) — nie das Rohereignis, das noch ungefiltert wäre.
 */
export function bereinigeEreignis<E extends SentryEvent>(event: E): E {
  try {
    return bereinigeVollstaendig(event)
  } catch {
    return minimalEreignis(event)
  }
}

/** Notbehelf, wenn die Bereinigung scheitert: Nur Kennung, Zeit, Art, Stufe,
 *  Umgebung und der bereinigte Fehlertext bleiben — kein request, user,
 *  contexts, spans, breadcrumbs, extra, tags. Jedes Feld wird einzeln und
 *  nur als einfacher Wert übernommen, damit auch hier nichts wirft. */
function minimalEreignis<E extends SentryEvent>(event: E): E {
  const minimal: Record<string, unknown> = {}
  const roh = event as unknown as Record<string, unknown>
  for (const feld of ['event_id', 'timestamp', 'start_timestamp', 'type', 'level', 'platform', 'environment', 'release', 'dist']) {
    try {
      const wert = roh[feld]
      if (typeof wert === 'string' || typeof wert === 'number') minimal[feld] = wert
    } catch {
      // Getter, der wirft — Feld fällt weg.
    }
  }
  // Jedes Feld genau EINMAL lesen und lokal halten: Ein Getter könnte beim
  // zweiten Lesen etwas anderes (Rohes) liefern als beim geprüften ersten.
  // Der Text wird hier selbst bereinigt — die Bereinigung kann abgebrochen
  // sein, bevor sie ihn erreicht hat.
  try {
    const nachricht = roh.message
    if (typeof nachricht === 'string') minimal.message = bereinigeFreitext(nachricht)
  } catch {
    // Text nicht lesbar — fällt weg.
  }
  try {
    const ausnahme = roh.exception
    const werte = istObjekt(ausnahme) ? ausnahme.values : undefined
    const erste = Array.isArray(werte) ? werte[0] : undefined
    if (istObjekt(erste)) {
      const typ = erste.type
      const wert = erste.value
      minimal.exception = {
        values: [
          {
            ...(typeof typ === 'string' ? { type: bereinigeTextGanz(typ) } : {}),
            ...(typeof wert === 'string' ? { value: bereinigeFehlertext(wert) } : {}),
          },
        ],
      }
    }
  } catch {
    // Ausnahme nicht lesbar — fällt weg.
  }
  minimal.extra = { bereinigung: 'fehlgeschlagen' }
  return minimal as unknown as E
}

function bereinigeVollstaendig<E extends SentryEvent>(event: E): E {
  // Die Nachricht trägt dasselbe wie logentry (captureMessage, Konsole) —
  // deshalb dieselbe Freitext-Regel. Nur der Fehlertext (exception.value)
  // behält IP-Adressen und lange Kennungen, siehe bereinigeFehlertext.
  if (typeof event.message === 'string') event.message = bereinigeFreitext(event.message)
  else if (event.message !== undefined) delete event.message

  if (event.exception !== undefined && !istObjekt(event.exception)) delete event.exception
  if (event.exception?.values !== undefined && !Array.isArray(event.exception.values)) {
    // Keine Liste — nicht zu sichten, also weg.
    delete event.exception.values
  }
  const ausnahmen = event.exception?.values
  if (Array.isArray(ausnahmen)) {
    for (const ausnahme of ausnahmen) {
      if (istObjekt(ausnahme) && typeof ausnahme.value === 'string') {
        ausnahme.value = bereinigeFehlertext(ausnahme.value)
      }
    }
  }
  // Variablen der Stack-Frames: ganz weg, in Ausnahmen wie in Threads.
  entferneFrameVariablen(ausnahmen)
  const mitThreads = event as { threads?: unknown }
  if (mitThreads.threads !== undefined && !istObjekt(mitThreads.threads)) delete mitThreads.threads
  if (istObjekt(mitThreads.threads)) {
    const threadWerte = mitThreads.threads.values
    if (threadWerte !== undefined && !Array.isArray(threadWerte)) delete mitThreads.threads.values
    entferneFrameVariablen(mitThreads.threads.values)
  }

  // logentry: eine Nachricht mit Parametern (Sentry.parameterize) — die
  // Nachricht wie jeder Text, die Parameter wie Konsolen-Argumente.
  if (event.logentry !== undefined && !istObjekt(event.logentry)) delete event.logentry
  if (event.logentry) {
    const eintrag = event.logentry as Record<string, unknown>
    if (typeof eintrag.message === 'string') eintrag.message = bereinigeFreitext(eintrag.message)
    else if (eintrag.message !== undefined) delete eintrag.message
    if (Array.isArray(eintrag.params)) eintrag.params = eintrag.params.map(konsolenArgument)
    else if (eintrag.params !== undefined) delete eintrag.params
  }

  // tags und extra: Jeder Aufrufer kann hier alles ablegen. Was kein Objekt
  // ist, lässt sich nicht sichten und fällt weg.
  if (event.tags !== undefined && !istObjekt(event.tags)) delete event.tags
  if (event.tags) event.tags = bereinigeEintraege(event.tags, 0) as typeof event.tags
  if (event.extra !== undefined && !istObjekt(event.extra)) delete event.extra
  if (event.extra) event.extra = bereinigeEintraege(event.extra, 0)

  if (event.request !== undefined && !istObjekt(event.request)) {
    // Eine Anfrage, die kein Objekt ist, können wir nicht sichten — weg.
    delete event.request
  }
  if (event.request) {
    delete event.request.cookies
    // Der POST-Körper ist das PII-dichteste Feld (Checkout: Name, Telefon,
    // E-Mail, Adresse) — komplett weg, nie nur gefiltert.
    delete event.request.data
    if (event.request.headers !== undefined && !istObjekt(event.request.headers)) {
      // Header als Text oder Liste („x-forwarded-for: …") — nicht sichtbar
      // zu filtern, also ganz weg.
      delete event.request.headers
    }
    if (event.request.headers) {
      const header = event.request.headers as Record<string, unknown>
      for (const name of Object.keys(header)) {
        if (/^(authorization|cookie)$/i.test(name) || istIpHeader(name)) {
          delete header[name]
        } else if (/^referer$/i.test(name)) {
          // Der Referer trägt die volle Vorgänger-URL (same-origin) — er wird
          // wie jede URL bereinigt, damit /customers/<e-mail> nicht über die
          // Hintertür einwandert. Kein Text → weg.
          const wert = header[name]
          if (typeof wert === 'string') header[name] = bereinigeUrl(wert)
          else delete header[name]
        }
      }
    }
    // Server-Umgebung der Anfrage (REMOTE_ADDR, REMOTE_HOST …) — trägt die
    // Adresse der Gegenstelle und sonst nichts, was wir zum Beheben brauchen.
    delete event.request.env
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = bereinigeQuery(event.request.query_string)
    } else if (event.request.query_string !== undefined) {
      // Objekt- oder Tupel-Gestalt: der Einfachheit halber ganz weg — die
      // bereinigte URL trägt die unbedenklichen Parameter ohnehin.
      delete event.request.query_string
    }
    if (typeof event.request.url === 'string') event.request.url = bereinigeUrl(event.request.url)
    else if (event.request.url !== undefined) delete event.request.url
  }

  // Kontexte: Die technischen des SDK bleiben, `trace` hat unten seine eigene
  // Regel, jeder andere wird bereinigt — auch `nextjs`: onRequestError hängt
  // dort den ROHEN Anfragepfad an (/customers/<e-mail>,
  // /api/orders/confirm/<token>), den die URL-Regel säubert.
  if (event.contexts !== undefined && !istObjekt(event.contexts)) delete event.contexts
  const kontexte = istObjekt(event.contexts) ? event.contexts : undefined
  if (kontexte) {
    for (const [name, wert] of Object.entries(kontexte)) {
      if (UNBEDENKLICHE_KONTEXTE.has(name) || name === 'trace') continue
      if (istHeiklerSchluessel(name)) {
        delete kontexte[name]
        continue
      }
      const neu = bereinigeWert(wert, name, 0)
      if (neu === undefined) delete kontexte[name]
      else kontexte[name] = neu as (typeof kontexte)[string]
    }
  }

  if (event.user !== undefined && event.user !== null) {
    // Ausschließlich die Farm-ID überlebt — nie E-Mail, nie Name, nie IP,
    // auch nicht „{{auto}}" (das bäte Sentry, die Adresse selbst aus der
    // Verbindung zu nehmen). Bewusst kein `ip_address: null`: Im SDK (10.66)
    // wirkt null nur gegen das automatische „{{auto}}", das ohne
    // sendDefaultPii ohnehin nicht gesetzt wird; dass der Ingest nichts
    // ableitet, regeln sendDefaultPii: false (Browser: infer_ip „never") und
    // die Projekteinstellung im Dashboard (Bericht Nr. 37).
    const id = istObjekt(event.user) ? event.user.id : undefined
    event.user = typeof id === 'string' || typeof id === 'number' ? { id } : {}
  }

  if (event.breadcrumbs !== undefined && !Array.isArray(event.breadcrumbs)) delete event.breadcrumbs
  for (const spur of event.breadcrumbs ?? []) {
    if (!istObjekt(spur)) continue
    // Console-Brotkrumen tragen die Argumente zweimal: als `arguments` und
    // aneinandergehängt als `message` — beide mit derselben Regel (Nr. 47).
    if (typeof spur.message === 'string') spur.message = bereinigeFreitext(spur.message)
    if (spur.data !== undefined && !istObjekt(spur.data)) delete spur.data
    const daten = spur.data as Record<string, unknown> | undefined
    if (daten) {
      // Seit Nr. 47 JEDER Wert, nicht nur die bekannten: fetch- und
      // XHR-Brotkrumen tragen außer url auch Körper und Kopfzeilen, eigene
      // Brotkrumen beliebige Daten.
      const sauber: Record<string, unknown> = {}
      for (const [schluessel, wert] of Object.entries(daten)) {
        if (schluessel === 'arguments' && Array.isArray(wert)) {
          // Console-Brotkrumen tragen die rohen console.error-Argumente —
          // Texte werden bereinigt, alles Strukturierte fällt weg.
          sauber.arguments = wert.map(konsolenArgument)
        } else if ((schluessel === 'url' || schluessel === 'from' || schluessel === 'to') && typeof wert === 'string') {
          // Navigations-Brotkrumen tragen from/to, fetch-Brotkrumen url —
          // auch relativ, deshalb immer die URL-Regel.
          sauber[schluessel] = bereinigeUrl(entferneIps(wert))
        } else if (!istHeiklerSchluessel(schluessel)) {
          const neu = bereinigeWert(wert, schluessel, 1)
          if (neu !== undefined) sauber[schluessel] = neu
        }
      }
      spur.data = sauber
    }
  }

  // Spans einer Transaktion tragen die ECHTEN Navigations-URLs (url.full,
  // url.query), Beschreibungen wie „GET https://…" und die Adresse der
  // Gegenstelle — gleiche Regeln. Der Wurzel-Span steht nicht in `spans`,
  // sondern in contexts.trace.data.
  const mitSpans = event as { spans?: unknown }
  if (mitSpans.spans !== undefined && !Array.isArray(mitSpans.spans)) delete mitSpans.spans
  for (const span of (mitSpans.spans as unknown[] | undefined) ?? []) {
    if (!istObjekt(span)) continue
    if (typeof span.description === 'string') span.description = bereinigeTextMitUrls(span.description)
    if (span.data !== undefined && !istObjekt(span.data)) delete span.data
    if (span.data) bereinigeSpanDaten(span.data as Record<string, unknown>)
  }
  const spur = istObjekt(kontexte?.trace) ? kontexte.trace : undefined
  if (spur && spur.data !== undefined && !istObjekt(spur.data)) delete spur.data
  if (spur?.data) bereinigeSpanDaten(spur.data as Record<string, unknown>)

  return event
}
