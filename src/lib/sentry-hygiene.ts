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
 *   einen gültigen Bestätigungs-Token — Query-Filter allein reicht nicht.
 * - request-Daten: Cookies, Authorization, Referer (trägt die volle
 *   Vorgänger-URL), der POST-Körper (data) komplett.
 * - contexts.nextjs.request_path: von onRequestError roh angehängt.
 * - Blob-Speicher-URLs: tragen den Geräte-Dateinamen („Hof_Mueller.jpg" ist
 *   ein personenbezogenes Datum) im Pfad und als pathname-Parameter.
 * - Spans von Transaktionen: url.full/url.query der echten Navigation.
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
 *  selbsttragenden Nachbestell-Token (reorder-token.ts), gleiche Lage. */
const HEIKLE_PARAMETER = /token|code|secret|email|pathname|reorder|^s$/i

/** Undurchsichtige Kennungen als GANZES Pfadsegment (Bestätigungs-Token der
 *  Bestellungen ist ein nanoid(32)). Trifft bewusst auch lange Hof-Slugs —
 *  Über-Redaktion ist die sichere Richtung, der Transaktions-NAME bleibt
 *  parametrisiert und damit lesbar. */
const KENNUNG_SEGMENT_MUSTER = /^[A-Za-z0-9_-]{24,}$/

function bereinigeText(text: string): string {
  return text
    .replace(EMAIL_MUSTER, '[e-mail entfernt]')
    .replace(EMAIL_KODIERT_MUSTER, '[e-mail entfernt]')
    .replace(TELEFON_MUSTER, '[telefon entfernt]')
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
  return bereinigeText(pfad)
    .split('/')
    .map((segment) => (KENNUNG_SEGMENT_MUSTER.test(segment) ? '[kennung entfernt]' : segment))
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

/**
 * Der zentrale Filter — läuft auf Server, Edge und im Browser, für
 * FEHLER-Ereignisse (beforeSend) wie für TRANSAKTIONEN (beforeSendTransaction).
 * Entfernt, was der Kopfkommentar aufzählt; verwirft nie ein Ereignis —
 * ein gefiltertes Ereignis ist besser als keines.
 */
export function bereinigeEreignis<E extends SentryEvent>(event: E): E {
  if (event.message) event.message = bereinigeText(event.message)

  for (const ausnahme of event.exception?.values ?? []) {
    if (ausnahme.value) ausnahme.value = bereinigeText(ausnahme.value)
  }

  if (event.request) {
    delete event.request.cookies
    // Der POST-Körper ist das PII-dichteste Feld (Checkout: Name, Telefon,
    // E-Mail, Adresse) — komplett weg, nie nur gefiltert.
    delete event.request.data
    if (event.request.headers) {
      for (const name of Object.keys(event.request.headers)) {
        if (/^(authorization|cookie)$/i.test(name)) {
          delete event.request.headers[name]
        } else if (/^referer$/i.test(name)) {
          // Der Referer trägt die volle Vorgänger-URL (same-origin) — er wird
          // wie jede URL bereinigt, damit /customers/<e-mail> nicht über die
          // Hintertür einwandert.
          event.request.headers[name] = bereinigeUrl(event.request.headers[name])
        }
      }
    }
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = bereinigeQuery(event.request.query_string)
    } else if (event.request.query_string !== undefined) {
      // Objekt- oder Tupel-Gestalt: der Einfachheit halber ganz weg — die
      // bereinigte URL trägt die unbedenklichen Parameter ohnehin.
      delete event.request.query_string
    }
    if (event.request.url) event.request.url = bereinigeUrl(event.request.url)
  }

  // onRequestError hängt den ROHEN Anfragepfad an — /customers/<e-mail> und
  // /api/orders/confirm/<token> stünden sonst wörtlich im Ereignis.
  const nextjsKontext = event.contexts?.nextjs as Record<string, unknown> | undefined
  if (nextjsKontext && typeof nextjsKontext.request_path === 'string') {
    nextjsKontext.request_path = bereinigeUrl(nextjsKontext.request_path)
  }

  if (event.user) {
    // Ausschließlich die Farm-ID überlebt — nie E-Mail, nie Name, nie IP.
    event.user = event.user.id !== undefined ? { id: event.user.id } : {}
  }

  for (const spur of event.breadcrumbs ?? []) {
    if (spur.message) spur.message = bereinigeText(spur.message)
    if (spur.data) {
      // Navigations-Brotkrumen tragen from/to, fetch-Brotkrumen url.
      for (const schluessel of ['url', 'from', 'to']) {
        const wert = spur.data[schluessel]
        if (typeof wert === 'string') spur.data[schluessel] = bereinigeUrl(wert)
      }
      // Console-Brotkrumen tragen die rohen console.error-Argumente — Texte
      // werden bereinigt, alles Strukturierte fällt weg (könnte alles tragen).
      if (Array.isArray(spur.data.arguments)) {
        spur.data.arguments = spur.data.arguments.map((argument) => {
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
  // url.query) und Beschreibungen wie „GET https://…" — gleiche Regeln.
  const spans = (event as { spans?: Array<{ description?: string; data?: Record<string, unknown> }> })
    .spans
  for (const span of spans ?? []) {
    if (span.description) span.description = bereinigeTextMitUrls(span.description)
    for (const [schluessel, wert] of Object.entries(span.data ?? {})) {
      if (typeof wert !== 'string') continue
      if (/query/i.test(schluessel)) span.data![schluessel] = bereinigeQuery(wert)
      else if (/url|path|target/i.test(schluessel)) span.data![schluessel] = bereinigeUrl(wert)
    }
  }

  return event
}
