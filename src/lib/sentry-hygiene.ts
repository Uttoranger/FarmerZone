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

/** Telefonnummern: +43 664 123 4567, 0664/1234567, (0664) 1234567 … — eine
 *  führende +/0/(0-Gruppe und danach mindestens sieben weitere Ziffern mit
 *  üblichen Trennzeichen (höchstens drei am Stück). Bewusst konservativ:
 *  Datumsangaben (01.09.2026), Uhrzeiten und Postleitzahlen bleiben stehen.
 *  Nie mitten in einer Zahl, und eine Ziffernfolge, die links an einem
 *  Buchstaben, „_" oder „-" klebt, nur, wenn sie rechts frei endet (Nr. 56,
 *  Runde 1): vorher wurde „2026-10-10 20:02:00" zu „2[telefon entfernt]:02:00",
 *  und eine Kennung mit „0" und acht Ziffern darin (cuid, UUID) zerbrach.
 *  „Rückruf-0664 1234567" und „Tel0664 …" fallen weiter. Ein Prozent-Escape
 *  links (%20, %22, %28 …) ist eine freie Grenze wie ein Leerzeichen (Runde 2:
 *  „Ruf%2006641234567" — das Escape endet auf eine Ziffer, und die Nummer
 *  blieb stehen). Linear: Angesetzt wird nur am Anfang einer Ziffernfolge,
 *  die Vorschau liest sie einmal. */
const TELEFON_MUSTER =
  /(?:(?<=%[0-9A-Fa-f]{2})|(?<!\d)(?:(?<![A-Za-z_-])|(?=(?:\+|\(?0)\d(?:[\s/\-.()]{0,3}\d){7,}(?!\w))))(?:\+|\(?0)\d(?:[\s/\-.()]{0,3}\d){7,}/g

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

/**
 * E-Mail-Adressen in freiem Text — dasselbe Ergebnis wie
 * `text.replace(/[\p{L}\p{N}\p{M}._%+-]+@<EMAIL_DOMAIN>/gu, …)`, aber linear:
 * Jener Regex setzte in einer langen Folge ohne @ an jeder Stelle neu an
 * (100 000 Zeichen: rund 7 Sekunden). Hier wird von jedem @ aus gesucht —
 * nach links der lokale Teil, höchstens bis zum Ende des vorigen Treffers
 * (dort setzte auch der Regex wieder an), nach rechts die Domain. Nach links
 * zählt jedes Zeichen ganz, auch eines außerhalb der Grundebene (Nr. 56).
 */
function ersetzeEmails(text: string): string {
  let ergebnis = ''
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
    ergebnis += `${text.slice(ende, anfang)}[e-mail entfernt]`
    ende = EMAIL_DOMAIN.lastIndex
  }
  return ergebnis + text.slice(ende)
}

function bereinigeText(text: string): string {
  return ersetzeEmails(text)
    .replace(EMAIL_KODIERT_MUSTER, '[e-mail entfernt]')
    .replace(TELEFON_MUSTER, '[telefon entfernt]')
    .replace(ANMELDECODE_MUSTER, '$1$2[code entfernt]')
}

/**
 * Entfernt heikle Parameter aus einem Query-String ('a=1&token=x' → 'a=1')
 * und bereinigt Namen und Werte der übrigen DEKODIERT — sonst stünde
 * „?q=kundin@…" als „q=kundin%40…" weiter da (Nr. 47). Die Regel ist dieselbe
 * wie für den Pfad (E-Mail, Telefon, Code), für Werte dazu die aus
 * bereinigeAbfrageWert; strukturierte Felder nehmen die Freitext-Regel
 * (`freitext`, bereinigeQueryText).
 */
function bereinigeQuery(query: string, freitext = false, tiefe = 0): string {
  const regel = freitext ? bereinigeFreitext : bereinigeText
  const sauber = new URLSearchParams()
  new URLSearchParams(query).forEach((wert, name) => {
    if (HEIKLE_PARAMETER.test(name)) return
    sauber.append(regel(name), freitext ? bereinigeFreitext(wert) : bereinigeAbfrageWert(wert, tiefe))
  })
  return sauber.toString()
}

/** Ein Abfragewert, der selbst eine Adresse ist: ab „/" oder mit Schema. */
const ADRESS_WERT = /^(?:https?:\/\/|\/)/i

/** Bis zu dieser Tiefe werden Adressen in Abfragewerten bereinigt
 *  (?next=/…?next=/…); eine noch tiefere fällt ganz. Jede Ebene liest den Rest
 *  noch einmal — ohne Grenze wäre die Laufzeit quadratisch. */
const MAX_ADRESS_TIEFE = 3

const ADRESSE_ERSATZ = '[adresse entfernt]'

/**
 * Ein Wert einer Abfrage in einer Adresse (Nr. 56, Runde 1). Ist er selbst
 * eine Adresse (?next=/reset-password?token=…, ?callbackUrl=https://…), gilt
 * für ihn die URL-Regel — vorher wurde er nur neu kodiert, und sein Token
 * blieb kodiert stehen (next=%2Freset-password%3Ftoken%3D…). Vorher fallen im
 * dekodierten Wert „token=…" und „Bearer …" (auch ohne Adresse:
 * ?next=reset?token=…). Strukturierte Felder brauchen das nicht: Ihre
 * Freitext-Regel nimmt Adressen und Zuweisungen selbst.
 */
function bereinigeAbfrageWert(wert: string, tiefe: number): string {
  const ohneZuweisung = ersetzeZuweisungen(wert.replace(BEARER_MUSTER, 'Bearer [entfernt]'))
  if (!ADRESS_WERT.test(ohneZuweisung)) return bereinigeText(ohneZuweisung)
  return tiefe < MAX_ADRESS_TIEFE ? bereinigeUrl(ohneZuweisung, tiefe + 1) : ADRESSE_ERSATZ
}

/** Bereinigt den Pfad-Teil: E-Mails (roh und kodiert), Telefonnummern und
 *  undurchsichtige Kennungs-Segmente. */
function bereinigePfad(pfad: string): string {
  const segmente = bereinigeText(pfad).split('/')
  return segmente
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
}

/** Bereinigt eine volle URL: Pfad, Query und Anker. Alles ab dem ERSTEN #
 *  ist der Anker (wie im Browser), davor alles ab dem ERSTEN ? die Query —
 *  auch ein weiteres ? darin (URLSearchParams nimmt es als Wertteil).
 *  `tiefe` zählt Adressen in Abfragewerten (bereinigeAbfrageWert). */
function bereinigeUrl(url: string, tiefe = 0): string {
  // Blob-Speicher-URLs tragen den Geräte-Dateinamen im Pfad — dort ist
  // nichts Diagnostisches zu holen, der ganze Rest fällt weg.
  if (/^https?:\/\/[^/?]*\bblob\.vercel-storage\.com/i.test(url)) {
    return `${url.split('/').slice(0, 3).join('/')}/[pfad entfernt]`
  }
  const raute = url.indexOf('#')
  const ohneAnker = raute === -1 ? url : url.slice(0, raute)
  const anker = raute === -1 ? '' : bereinigeAnker(url.slice(raute + 1), tiefe)
  const trenner = ohneAnker.indexOf('?')
  const pfad = bereinigePfad(trenner === -1 ? ohneAnker : ohneAnker.slice(0, trenner))
  const query = trenner === -1 ? '' : bereinigeQuery(ohneAnker.slice(trenner + 1), false, tiefe)
  return `${pfad}${query ? `?${query}` : ''}${anker ? `#${anker}` : ''}`
}

/** Der Anker einer Adresse (Nr. 56, Runde 1): Mit „=" trägt er Parameter wie
 *  eine Query (#token=…, so legen manche Anmeldewege den Token ab) und fällt
 *  wie sie; sonst gilt die Regel des Pfads (#abschnitt bleibt). */
function bereinigeAnker(anker: string, tiefe: number): string {
  return anker.includes('=') ? bereinigeQuery(anker, false, tiefe) : bereinigePfad(anker)
}

/** Bereinigt URLs, die IN einem Text stecken (Span-Beschreibungen wie
 *  „GET https://…?token=…", seit Nr. 56 Runde 1 auch groß geschrieben),
 *  danach den Text selbst. */
function bereinigeTextMitUrls(text: string): string {
  return bereinigeText(text.replace(/https?:\/\/\S+/gi, (url) => bereinigeUrl(url)))
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
 *  Prisma Felder („Argument `token`: Invalid value …"). */
const ZUWEISUNG_KANDIDAT = /(?<![\w-])([\w-]+)(["']?\s*[=:]\s*["']?)/g

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
 *  resetToken, XMLToken, x-api-key). Ein Wort, das nur so anfängt oder endet
 *  (tokenizer, Apfelessig), ist kein Teil — vorher galt nur der Anfang eines
 *  Worts, und „access_token=…" blieb stehen. */
function istGeheimerSchluessel(schluessel: string): boolean {
  // Vorfilter: Steckt keines der Wörter auch nur als Teil darin, ist der
  // Schlüssel nie geheim — der häufige Fall, ohne Zerlegen.
  if (!GEHEIMES_WORT_IRGENDWO.test(schluessel)) return false
  const teile = schluessel
    .replace(/([a-z0-9])(?=[A-Z])|([A-Z])(?=[A-Z][a-z])/g, '$1$2_')
    .toLowerCase()
    .split(/[_-]+/)
  return teile.some((teil, i) => GEHEIMES_WORT.has(teil) || (teil === 'api' && teile[i + 1] === 'key'))
}

/**
 * „token=…", „secret: …" — Zuweisungen in freiem Text, auch ohne Adresse
 * davor: Der Wert bis zum nächsten Trenner fällt. Linear: Jeder Schlüssel
 * wird einmal gefunden und eingeteilt, jeder Wert einmal gelesen; Schlüssel in
 * einem schon ersetzten Wert zählen nicht mehr. Ist der ganze Wert schon ein
 * Platzhalter dieser Datei („otp: [code entfernt]"), bleibt er stehen — sonst
 * würde daraus „otp: [entfernt] entfernt]" (Nr. 56). Nur ein eigener
 * Platzhalter, nicht jeder Wert mit „[" (Runde 1: sonst blieb
 * „token=[abc123]" stehen); hängt etwas daran, fällt der ganze Wert.
 */
function ersetzeZuweisungen(text: string): string {
  let ergebnis = ''
  let ende = 0
  for (const treffer of text.matchAll(ZUWEISUNG_KANDIDAT)) {
    if (treffer.index < ende || !istGeheimerSchluessel(treffer[1])) continue
    const wertAnfang = treffer.index + treffer[0].length
    EIGENER_PLATZHALTER.lastIndex = wertAnfang
    const nachPlatzhalter = EIGENER_PLATZHALTER.test(text) ? EIGENER_PLATZHALTER.lastIndex : wertAnfang
    ZUWEISUNG_WERT.lastIndex = nachPlatzhalter
    ZUWEISUNG_WERT.test(text)
    const wertEnde = ZUWEISUNG_WERT.lastIndex
    // Kein Wert, oder er ist genau ein eigener Platzhalter: stehen lassen.
    if (wertEnde === wertAnfang || (nachPlatzhalter > wertAnfang && wertEnde === nachPlatzhalter)) continue
    ergebnis += `${text.slice(ende, wertAnfang)}[entfernt]`
    ende = wertEnde
  }
  return ergebnis + text.slice(ende)
}

const BEARER_MUSTER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/g

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
 * sonst die Text-Regel samt eingebetteter Adressen. IP-Adressen fallen
 * zuerst — sonst hielte die Telefon-Regel eine lange IPv4 für eine Nummer.
 */
function bereinigeFreitext(text: string): string {
  const ohneIp = entferneIps(text)
  if (/^(?:https?:\/\/|\/)\S*$/i.test(ohneIp)) return bereinigeUrl(ohneIp)
  const ohneZuweisung = ersetzeZuweisungen(bereinigeTextMitUrls(ohneIp).replace(BEARER_MUSTER, 'Bearer [entfernt]'))
  return ohneZuweisung.replace(LANGE_KENNUNG_MUSTER, '[kennung entfernt]')
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
  const mitAdressen = bereinigeText(text.replace(ADRESSE_IM_FEHLERTEXT, (adresse) => bereinigeUrl(adresse)))
  return ersetzeZuweisungen(mitAdressen.replace(BEARER_MUSTER, 'Bearer [entfernt]'))
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
  return HEIKLER_SCHLUESSEL.test(name) || istIpHeader(name) || istIpSpanAttribut(name) || bereinigeText(name) !== name
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
            ...(typeof typ === 'string' ? { type: bereinigeText(typ) } : {}),
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
