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
 * - Fehlertexte und Brotkrumen: E-Mail-Adressen, Telefonnummern.
 * - URLs, auch im PFAD, nicht nur in der Query: /customers/<kundin@…> legt
 *   die Kunden-E-Mail (%40-kodiert) in den Pfad, /api/orders/confirm/<token>
 *   und /<hof>/bestaetigen/<token> (Bar-Bestätigung, H3) einen gültigen
 *   Einmal-Token — Query-Filter allein reicht nicht.
 * - request-Daten: Cookies, Authorization, Referer (trägt die volle
 *   Vorgänger-URL), der POST-Körper (data) komplett.
 * - contexts.nextjs.request_path: von onRequestError roh angehängt.
 * - Blob-Speicher-URLs: tragen den Geräte-Dateinamen („Hof_Mueller.jpg" ist
 *   ein personenbezogenes Datum) im Pfad und als pathname-Parameter.
 * - Spans von Transaktionen: url.full/url.query der echten Navigation,
 *   auch im Wurzel-Span (contexts.trace.data).
 * - IP-Adressen (Nr. 37): user.ip_address (auch „{{auto}}"), die Header, mit
 *   denen Proxies die Adresse weiterreichen (X-Forwarded-For & Co., jede
 *   Schreibweise), Vercels daraus abgeleitete Ortsangaben (x-vercel-ip-*),
 *   request.env (REMOTE_ADDR) und die IP-Attribute der Spans.
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

/** E-Mail-Adressen in freiem Text. */
const EMAIL_MUSTER = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

/** Dieselben Adressen URL-kodiert (%40 statt @) — so stehen sie im Pfad. */
const EMAIL_KODIERT_MUSTER = /[A-Za-z0-9._%+-]+%40[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi

/** Telefonnummern: +43 664 123 4567, 0664/1234567, (0664) 1234567 … — eine
 *  führende +/0/(0-Gruppe und danach mindestens sieben weitere Ziffern mit
 *  üblichen Trennzeichen (höchstens drei am Stück). Bewusst konservativ:
 *  Datumsangaben (01.09.2026), Uhrzeiten und Postleitzahlen bleiben stehen. */
const TELEFON_MUSTER = /(?:\+|\(?0)\d(?:[\s/\-.()]{0,3}\d){7,}/g

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

function bereinigeText(text: string): string {
  return text
    .replace(EMAIL_MUSTER, '[e-mail entfernt]')
    .replace(EMAIL_KODIERT_MUSTER, '[e-mail entfernt]')
    .replace(TELEFON_MUSTER, '[telefon entfernt]')
    .replace(ANMELDECODE_MUSTER, '$1$2[code entfernt]')
}

/** Entfernt heikle Parameter aus einem Query-String ('a=1&token=x' → 'a=1'). */
function bereinigeQuery(query: string): string {
  const parameter = new URLSearchParams(query)
  const weg: string[] = []
  parameter.forEach((_, name) => {
    if (HEIKLE_PARAMETER.test(name)) weg.push(name)
  })
  for (const name of weg) parameter.delete(name)
  return parameter.toString()
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

/** Bereinigt eine volle URL: Pfad UND Query. Alles ab dem ERSTEN ? zählt als
 *  Query — auch ein weiteres ? darin (URLSearchParams nimmt es als Wertteil). */
function bereinigeUrl(url: string): string {
  // Blob-Speicher-URLs tragen den Geräte-Dateinamen im Pfad — dort ist
  // nichts Diagnostisches zu holen, der ganze Rest fällt weg.
  if (/^https?:\/\/[^/?]*\bblob\.vercel-storage\.com/i.test(url)) {
    return `${url.split('/').slice(0, 3).join('/')}/[pfad entfernt]`
  }
  const trenner = url.indexOf('?')
  if (trenner === -1) return bereinigePfad(url)
  const pfad = bereinigePfad(url.slice(0, trenner))
  const sauber = bereinigeQuery(url.slice(trenner + 1))
  return sauber ? `${pfad}?${sauber}` : pfad
}

/** Bereinigt URLs, die IN einem Text stecken (Span-Beschreibungen wie
 *  „GET https://…?token=…"), danach den Text selbst. */
function bereinigeTextMitUrls(text: string): string {
  return bereinigeText(text.replace(/https?:\/\/\S+/g, (url) => bereinigeUrl(url)))
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
  try {
    if (typeof roh.message === 'string') minimal.message = bereinigeText(roh.message)
  } catch {
    // Text nicht lesbar — fällt weg.
  }
  try {
    const werte = istObjekt(roh.exception) ? roh.exception.values : undefined
    const erste = Array.isArray(werte) && istObjekt(werte[0]) ? werte[0] : undefined
    if (erste) {
      minimal.exception = {
        values: [
          {
            ...(typeof erste.type === 'string' ? { type: erste.type } : {}),
            ...(typeof erste.value === 'string' ? { value: bereinigeText(erste.value) } : {}),
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
  if (typeof event.message === 'string') event.message = bereinigeText(event.message)
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
        ausnahme.value = bereinigeText(ausnahme.value)
      }
    }
  }

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

  // onRequestError hängt den ROHEN Anfragepfad an — /customers/<e-mail> und
  // /api/orders/confirm/<token> stünden sonst wörtlich im Ereignis.
  const kontexte = istObjekt(event.contexts) ? event.contexts : undefined
  const nextjsKontext = istObjekt(kontexte?.nextjs) ? kontexte.nextjs : undefined
  if (nextjsKontext && typeof nextjsKontext.request_path === 'string') {
    nextjsKontext.request_path = bereinigeUrl(nextjsKontext.request_path)
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
    if (typeof spur.message === 'string') spur.message = bereinigeText(spur.message)
    if (spur.data !== undefined && !istObjekt(spur.data)) delete spur.data
    const daten = spur.data as Record<string, unknown> | undefined
    if (daten) {
      // Navigations-Brotkrumen tragen from/to, fetch-Brotkrumen url.
      for (const schluessel of ['url', 'from', 'to']) {
        const wert = daten[schluessel]
        if (typeof wert === 'string') daten[schluessel] = bereinigeUrl(wert)
      }
      // Console-Brotkrumen tragen die rohen console.error-Argumente — Texte
      // werden bereinigt, alles Strukturierte fällt weg (könnte alles tragen).
      if (Array.isArray(daten.arguments)) {
        daten.arguments = daten.arguments.map((argument: unknown) => {
          if (typeof argument === 'string') return bereinigeTextMitUrls(argument)
          if (typeof argument === 'number' || typeof argument === 'boolean' || argument === null) {
            return argument
          }
          return '[objekt entfernt]'
        })
      }
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
