/**
 * Die Datenschutzerklärung sagt, was der Code tut (Nachtlauf Nr. 33 und 57).
 *
 * Jede Aussage hier ist an die Stelle im Code gebunden, die sie wahr macht —
 * ändert sich der Code, schlägt der Test an und erinnert daran, die Erklärung
 * nachzuziehen:
 *  - Anmeldung: Code aus der E-Mail (E7); der Magic Link ist zu (19b).
 *  - Kein Konto beim Bestellen (E8, 17a); „Bestellungen finden" per Code mit
 *    kurzlebigem Cookie, die Minuten aus derselben Konstante wie die Seite.
 *  - Vercel Web Analytics ist eingebunden — Abschnitt 8 darf nicht sagen, es
 *    gebe keine Analyse-Werkzeuge.
 *  - Sentry ohne Bildschirmaufzeichnung (kein Session Replay).
 *  Seit Nr. 57:
 *  - Neuigkeiten: Anmeldung auf der Bestätigungsseite, nur per E-Mail,
 *    Double-Opt-in per Knopf (S11), Ein-Klick-Abmeldung (List-Unsubscribe),
 *    WhatsApp ohne neuen Einstieg (N2, Nr. 38/46/47).
 *  - „Standort nutzen": Der Standort bleibt im Browser.
 *  - Zähler zum Schutz vor Missbrauch: nur ein Prüfwert, Höchstdauer aus
 *    Fenster und Cron (R1, Nr. 40).
 *  - Sentry ohne IP-Adressen (Nr. 37).
 *  - Kartenkacheln: woher und wann (O6 offen, Quelle unverändert).
 *  - Die Seite steht in der KundeShell des neuen Designs.
 *
 * Gerendert mit renderToStaticMarkup (TESTING_GUIDELINES §1), mit Gegenprobe
 * je Suche.
 */
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ErrorEvent, Event as SentryEvent } from '@sentry/nextjs'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
// Kopfzeile und Shell lesen Sitzung und Pfad im Browser — hier zählt nur der Inhalt.
vi.mock('@/components/shared/kunden-kopf', () => ({ KundenKopf: () => null }))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

import DatenschutzPage from '@/app/(public)/datenschutz/page'
import { BESTELLUNGEN_ANSICHT_SEKUNDEN } from '@/lib/bestellungen-finden'
import { GESPERRTE_AUTH_PFADE } from '@/lib/anmeldecode'
import { ABO_BESTAETIGUNG_GUELTIG_TAGE, ABO_TEXT, NEUIGKEITEN_TEXT } from '@/lib/abo-bestaetigung'
import { listUnsubscribeKoepfe } from '@/lib/abmelde-link'
import { SUCHFELD_TEXT } from '@/lib/hoefe-entdecken'
import { DB_BREMSEN, bremsSchluessel } from '@/lib/bremse-datenbank'
import {
  HILFE_UND_RUECKMELDUNG,
  MEIN_KONTO,
  ZAEHLER_AUFRAEUMEN_SPIEL_MS,
  ZAEHLER_AUFRAEUMEN_STUNDE_UTC,
  ZAEHLER_JE_MERKMAL,
  ZAEHLER_STUNDEN,
  zaehlerHoechstensStunden,
} from '@/lib/datenschutz'
import { PROBLEM_MELDEN } from '@/lib/fehlerseite'
import { bereinigeEreignis } from '@/lib/sentry-hygiene'

const lies = (datei: string): string => readFileSync(join(process.cwd(), datei), 'utf8')

/** Vor diesen Zeichen beginnt ein „/" ein Regex-Literal, sonst ist es eine Division. */
const REGEX_NACH_ZEICHEN = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^'])
const REGEX_NACH_WORT = /\b(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/

/**
 * Quelltext ohne Kommentare — ein Wort im Kommentar ist keine Tatsache.
 *
 * Zeichen für Zeichen statt per Muster (Nachbesserung Runde 1): Zeichenketten
 * ('…', "…", `…` samt ${…}) und Regex-Literale bleiben unangetastet. Das
 * frühere Muster schnitt ab jedem „/*" in einem Text („image/*") bis zum
 * nächsten „*\/" und warf den Code dazwischen weg. Ob ein „/" ein Regex
 * beginnt, entscheidet wie bei einem Lexer das Zeichen bzw. Wort davor; ein
 * „//" direkt nach „:" bleibt stehen (Adressen im JSX-Text). Zeichenketten
 * enden spätestens am Zeilenende — ein Apostroph im JSX-Text kostet so
 * höchstens eine Zeile.
 */
function ohneKommentare(quelle: string): string {
  let i = 0
  let aus = ''
  let davor = ''
  const kopiere = (bis: number) => {
    aus += quelle.slice(i, bis)
    i = bis
  }
  const zeichenkette = (anfuehrung: string) => {
    let j = i + 1
    while (j < quelle.length && quelle[j] !== anfuehrung && quelle[j] !== '\n') j += quelle[j] === '\\' ? 2 : 1
    kopiere(Math.min(j + 1, quelle.length))
    davor = anfuehrung
  }
  const regex = () => {
    let j = i + 1
    let klasse = false
    while (j < quelle.length && quelle[j] !== '\n') {
      const z = quelle[j]
      if (z === '\\') {
        j += 2
        continue
      }
      if (z === '[') klasse = true
      else if (z === ']') klasse = false
      else if (z === '/' && !klasse) break
      j++
    }
    j++
    while (j < quelle.length && /[a-z]/i.test(quelle[j])) j++
    kopiere(Math.min(j, quelle.length))
    davor = 'a'
  }
  const vorlage = () => {
    aus += '`'
    i++
    while (i < quelle.length && quelle[i] !== '`') {
      if (quelle[i] === '\\') {
        kopiere(i + 2)
        continue
      }
      if (quelle[i] === '$' && quelle[i + 1] === '{') {
        aus += '${'
        i += 2
        code(true)
        aus += '}'
        i++
        continue
      }
      aus += quelle[i++]
    }
    aus += '`'
    i++
    davor = '`'
  }
  const code = (inVorlage: boolean) => {
    let tiefe = 0
    while (i < quelle.length) {
      const z = quelle[i]
      const n = quelle[i + 1]
      if (z === '/' && n === '/' && quelle[i - 1] !== ':') {
        while (i < quelle.length && quelle[i] !== '\n') i++
        continue
      }
      if (z === '/' && n === '*') {
        const ende = quelle.indexOf('*/', i + 2)
        i = ende < 0 ? quelle.length : ende + 2
        aus += ' '
        continue
      }
      if (z === "'" || z === '"') {
        zeichenkette(z)
        continue
      }
      if (z === '`') {
        vorlage()
        continue
      }
      // Nur das Ende prüfen: ganz `aus` je „/" zu kopieren wäre bei JSX-Dateien voller „/>" quadratisch.
      if (z === '/' && (REGEX_NACH_ZEICHEN.has(davor) || REGEX_NACH_WORT.test(aus.slice(-24).trimEnd()))) {
        regex()
        continue
      }
      if (inVorlage && z === '{') tiefe++
      if (inVorlage && z === '}') {
        if (tiefe === 0) return
        tiefe--
      }
      aus += z
      i++
      if (z !== ' ' && z !== '\n' && z !== '\t' && z !== '\r') davor = z
    }
  }
  code(false)
  return aus
}

let quellenSpeicher: { datei: string; code: string }[] | null = null

/** Alle .ts/.tsx-Dateien unter src/ ohne Kommentare — einmal je Lauf gelesen, zwei Tests brauchen sie. */
function quellen(): { datei: string; code: string }[] {
  if (quellenSpeicher) return quellenSpeicher
  const dateien: string[] = []
  const suche = (ordner: string) => {
    for (const name of readdirSync(ordner)) {
      const pfad = join(ordner, name)
      if (statSync(pfad).isDirectory()) suche(pfad)
      else if (/\.tsx?$/.test(name)) dateien.push(relative(process.cwd(), pfad).split('\\').join('/'))
    }
  }
  suche(join(process.cwd(), 'src'))
  quellenSpeicher = dateien.map((datei) => ({ datei, code: ohneKommentare(lies(datei)) }))
  return quellenSpeicher
}

/**
 * Eine Datei des installierten Sentry-SDK, gefunden über die Paketauflösung Glied für Glied
 * (@sentry/nextjs → @sentry/react → …), nicht über den pnpm-Pfad mit seinen Prüfsummen. Ändert ein
 * Update das Verhalten, schlägt die Wache an und erinnert an die Erklärung.
 */
function sentryDatei(kette: readonly string[], datei: string): string {
  let von = join(process.cwd(), 'package.json')
  let ordner = ''
  for (const paket of kette) {
    const fund = createRequire(von)
      .resolve.paths(paket)
      ?.map((suchort) => join(suchort, paket))
      .find((kandidat) => existsSync(join(kandidat, 'package.json')))
    if (!fund) throw new Error(`${paket} nicht gefunden`)
    ordner = realpathSync(fund)
    von = join(ordner, 'package.json')
  }
  return readFileSync(join(ordner, datei), 'utf8')
}
const SENTRY_BROWSER = ['@sentry/nextjs', '@sentry/react', '@sentry/browser'] as const
const SENTRY_KERN = [...SENTRY_BROWSER, '@sentry/core'] as const

/** Der sichtbare Text der Seite, ohne Tags, Leerraum zusammengezogen. */
function seitenText(): string {
  return renderToStaticMarkup(createElement(DatenschutzPage))
    // React trennt benachbarte Textknoten mit <!-- --> — der Browser zeigt dort nichts, also kein Leerzeichen.
    .replace(/<!-- -->/g, '')
    // Ein <span> (Name in „…") steht mitten im Satz — ohne Leerzeichen, sonst stünde eines vor dem Komma.
    .replace(/<\/?span[^>]*>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

/** Der Text eines Abschnitts: von seiner Überschrift bis zur nächsten. */
function abschnitt(titel: RegExp): string {
  const text = seitenText()
  const start = text.search(titel)
  expect(start, `Abschnitt ${titel}`).toBeGreaterThanOrEqual(0)
  const rest = text.slice(start + 1)
  const ende = rest.search(/ (?:\d+\. [A-ZÄÖÜ]|Standortsuche und Kartendarstellung|Umkreissuche auf der Hofübersicht|Fehler- und Wunschmeldungen|Stand: )/)
  return text.slice(start, ende < 0 ? undefined : start + 1 + ende)
}

/** Nennt ein Text einen Link als Anmeldeweg? */
const LINK_ALS_ANMELDEWEG = /magic[\s-]?link|login-link|link zur anmeldung|anmelde-?link/i

describe('Datenschutzerklärung — Anmeldung', () => {
  it('nennt keinen Link mehr als Anmeldeweg, weil der Magic Link zu ist', () => {
    // Gegenprobe Code: Der Magic Link ist wirklich gesperrt (E7, 19b).
    expect(GESPERRTE_AUTH_PFADE).toContain('/sign-in/magic-link')
    expect(GESPERRTE_AUTH_PFADE).toContain('/magic-link/verify')
    // Gegenprobe Suche: Der alte Wortlaut hätte angeschlagen.
    expect('per einmaligem Login-Link (Magic Link)').toMatch(LINK_ALS_ANMELDEWEG)

    expect(seitenText()).not.toMatch(LINK_ALS_ANMELDEWEG)
  })

  it('beschreibt die Anmeldung mit Code aus der E-Mail', () => {
    expect(seitenText()).toMatch(/Kunden-Konto \(Anmeldung mit Code\)/)
    expect(seitenText()).toMatch(/mit einem Code, den wir dir per E-Mail schicken/)
  })
})

describe('Datenschutzerklärung — kein Konto beim Bestellen (E8)', () => {
  it('sagt, dass beim Bestellen kein Konto entsteht — und der Checkout legt keins an', () => {
    // Gegenprobe Code: Die Bestellung entsteht ohne Konto (customerId bleibt leer).
    const checkout = lies('src/app/api/checkout/route.ts')
    expect(checkout).toMatch(/KEIN KUNDENKONTO \(E8/)
    expect(checkout).not.toMatch(/prisma\.user\.(create|upsert)/)
    expect(checkout).not.toMatch(/customerId:/)

    expect(seitenText()).toMatch(/Beim Bestellen wird kein Konto angelegt\./)
  })

  it('nennt „Bestellungen finden" mit Code und die Dauer des Cookies aus derselben Konstante', () => {
    const minuten = BESTELLUNGEN_ANSICHT_SEKUNDEN / 60
    // Gegenprobe: die Konstante ist eine ganze Minutenzahl.
    expect(Number.isInteger(minuten)).toBe(true)
    expect(seitenText()).toMatch(new RegExp(`„Bestellungen finden“ läuft ebenfalls über einen Code per E-Mail`))
    expect(seitenText()).toContain(`für ${minuten} Minuten ein Cookie`)
  })
})

describe('Datenschutzerklärung — Reichweitenmessung', () => {
  it('bestreitet keine Analyse-Werkzeuge, solange Vercel Web Analytics eingebunden ist', () => {
    // Gegenprobe Code: Das Root-Layout bindet Vercel Web Analytics ein.
    expect(lies('src/app/layout.tsx')).toMatch(/from '@vercel\/analytics\/next'/)
    // Gegenprobe Suche: Der alte Satz aus Abschnitt 8 hätte angeschlagen.
    const alterSatz = 'Es werden keine Tracking-Cookies, Werbe-Cookies oder Analyse-Tools eingesetzt.'
    expect(alterSatz).toMatch(/Analyse-Tools eingesetzt/)

    const text = seitenText()
    expect(text).not.toMatch(/Analyse-Tools eingesetzt/)
    expect(text).toMatch(/Vercel Web Analytics/)
  })
})

describe('Datenschutzerklärung — Sentry', () => {
  it('sagt „keine Aufzeichnung der Bildschirmsitzung" nur, solange kein Session Replay eingebunden ist', () => {
    for (const datei of ['src/instrumentation.ts', 'src/instrumentation-client.ts']) {
      const quelle = lies(datei)
      // Gegenprobe: Die Datei ist die Sentry-Initialisierung.
      expect(quelle, datei).toMatch(/Sentry\.init\(/)
      expect(quelle, datei).toMatch(/sendDefaultPii: false/)
      expect(quelle, datei).not.toMatch(/replayIntegration|replaysSessionSampleRate|replaysOnErrorSampleRate/)
    }
    expect(seitenText()).toMatch(/keine Aufzeichnung deiner Bildschirmsitzung/)
  })

  it('nennt IP-Adressen unter dem, was vor dem Versand fällt — und der Filter nimmt sie wirklich heraus (Nr. 37)', () => {
    // Testadressen aus RFC 5737, nie eine echte.
    const roh = {
      request: {
        url: 'https://beispiel.invalid/hoefe',
        headers: { 'X-Forwarded-For': '192.0.2.10', 'x-real-ip': '192.0.2.10', 'x-vercel-ip-city': 'Ried', accept: 'text/html' },
        env: { REMOTE_ADDR: '192.0.2.10' },
      },
      user: { id: 'hof-1', ip_address: '192.0.2.10' },
    }
    // Gegenprobe: Das Rohereignis trägt die Adresse wirklich.
    expect(JSON.stringify(roh)).toContain('192.0.2.10')

    // Wie in tests/beobachtbarkeit.test.ts: ein Teil-Ereignis, als Fehlerereignis gereicht.
    const teil: object = structuredClone(roh)
    const bereinigt = bereinigeEreignis(teil as ErrorEvent)
    expect(JSON.stringify(bereinigt)).not.toContain('192.0.2.10')
    expect(JSON.stringify(bereinigt)).not.toMatch(/x-vercel-ip-city/i)
    expect(bereinigt.user).toEqual({ id: 'hof-1' })
    // Harmloses bleibt — der Filter wirft nicht einfach alles weg.
    expect(bereinigt.request?.headers).toMatchObject({ accept: 'text/html' })

    expect(abschnitt(/Sentry \(Fehlerdiagnose\)/)).toMatch(/\(IP-Adressen, E-Mail-Adressen, Telefonnummern/)
  })

  it('sagt, Berichte aus dem Browser bäten Sentry, die IP nicht aus der Verbindung zu nehmen — dafür steht sendDefaultPii: false ohne dataCollection', () => {
    // Im SDK (10.66) ergibt sendDefaultPii: false ohne dataCollection im Browser
    // infer_ip „never"; schon ein leeres dataCollection schaltet alles auf „an".
    const browser = ohneKommentare(lies('src/instrumentation-client.ts'))
    expect(browser).toMatch(/sendDefaultPii: false/)
    expect(browser).not.toMatch(/dataCollection/)
    // Gegenprobe: Der Kommentar nennt dataCollection — die Suche ohne Kommentare sieht ihn nicht.
    expect(lies('src/instrumentation-client.ts')).toMatch(/dataCollection/)

    expect(abschnitt(/Sentry \(Fehlerdiagnose\)/)).toMatch(/nicht aus der Verbindung/)
  })
})

describe('Datenschutzerklärung — Sentry-Sitzungen (Nachbesserung Runde 1)', () => {
  it('nennt die Sitzungsmeldungen mit User-Agent und sagt, dass die Bitte um Verzicht auf die IP für sie nicht gilt', () => {
    // Unser Browser-init nimmt keine eigene Integrationsliste — es gilt die des SDK.
    const EIGENE_LISTE = /\bintegrations\s*:|defaultIntegrations\s*:/
    expect(ohneKommentare(lies('src/instrumentation-client.ts'))).not.toMatch(EIGENE_LISTE)
    expect('Sentry.init({ dsn, integrations: [] })').toMatch(EIGENE_LISTE)
    // Im installierten SDK: Sitzungen sind Standard und tragen den User-Agent; ihr Umschlag nennt nur Name und
    // Version des SDK. infer_ip steckt nur im Ereignis von Fehlern und Messungen (event.sdk.settings).
    const sdk = sentryDatei(SENTRY_BROWSER, 'build/npm/esm/prod/sdk.js')
    expect(sdk.slice(sdk.indexOf('function getDefaultIntegrations'))).toMatch(/browserSessionIntegration\(\)/)
    expect(sentryDatei(SENTRY_KERN, 'build/esm/session.js')).toMatch(/user_agent: session\.userAgent/)
    expect(sentryDatei(SENTRY_KERN, 'build/esm/utils/envelope.js')).toMatch(/const \{ name, version \} = metadataOrEvent\.sdk;\s*return \{ name, version \};/)
    expect(sentryDatei(SENTRY_KERN, 'build/esm/envelope.js')).toMatch(/settings: event\.sdk\?\.settings \|\| newSdkInfo\.settings/)
    const client = sentryDatei(SENTRY_BROWSER, 'build/npm/esm/prod/client.js')
    expect(client).toMatch(/infer_ip: userInfo \? "auto" : "never"/)
    // Eine IP käme in die Sitzung nur über userInfo (aus) oder über den Nutzer — und der trägt nur die Hof-ID.
    expect(client).toMatch(/if \(userInfo\) \{\s*this\.on\("beforeSendSession", addAutoIpAddressToSession\)/)
    expect(lies('src/components/farmer/sentry-nutzer.tsx')).toMatch(/Sentry\.setUser\(\{ id: farmId \}\)/)
    // Fehlerberichte und Messungen tragen den User-Agent in den Kopfzeilen der Anfrage: HttpContext ist Standard
    // und hängt sie in preprocessEvent an jedes Ereignis — der Client ruft das für Fehler und Transaktionen auf …
    expect(sdk.slice(sdk.indexOf('function getDefaultIntegrations'))).toMatch(/httpContextIntegration\(\)/)
    const httpKontext = sentryDatei(SENTRY_BROWSER, 'build/npm/esm/prod/integrations/httpcontext.js')
    expect(httpKontext).toMatch(/preprocessEvent\(event\) \{[\s\S]*?const reqData = getHttpRequestData\(\);/)
    expect(sentryDatei(SENTRY_BROWSER, 'build/npm/esm/prod/helpers.js')).toMatch(/"User-Agent": userAgent/)
    // Auf der obersten Ebene der Methode (4 Leerzeichen), also ohne Bedingung — erst danach zählt event.type.
    expect(sentryDatei(SENTRY_KERN, 'build/esm/client.js')).toMatch(
      /_prepareEvent\(event, hint, currentScope, isolationScope\) \{[\s\S]{0,300}?\n {4}this\.emit\("preprocessEvent", event, hint\);\n {4}if \(!event\.type\)/,
    )
    // … und unser Filter (beforeSend und beforeSendTransaction) lässt ihn stehen.
    expect(ohneKommentare(lies('src/instrumentation-client.ts'))).toMatch(/beforeSendTransaction: bereinigeEreignis/)
    const messung: SentryEvent = { type: 'transaction', request: { headers: { 'User-Agent': 'Testbrowser/1.0' } } }
    expect(bereinigeEreignis(messung).request?.headers).toEqual({ 'User-Agent': 'Testbrowser/1.0' })

    const text = abschnitt(/Sentry \(Fehlerdiagnose\)/)
    expect(text).toMatch(/aus deinem Browser bei jedem Seitenaufruf eine kurze Sitzungsmeldung/)
    expect(text).toMatch(/Die Sitzungsmeldungen enthalten selbst keine IP-Adresse, tragen diese Bitte aber nicht mit\./)
    expect(text).toMatch(/Fehlerberichte, Messungen und Sitzungsmeldungen enthalten die Kennung deines Browsers \(User-Agent\)/)
  })
})

describe('Datenschutzerklärung — Zahlung', () => {
  it('nennt als gespeicherten Zahlungsbezug die Kennung des Zahlungsvorgangs, nicht eine „anonymisierte" ID', () => {
    // Gegenprobe Code: Die Bestellung speichert die PaymentIntent-Kennung von Stripe.
    expect(lies('prisma/schema.prisma')).toMatch(/stripePaymentIntentId\s+String\?/)

    const text = seitenText()
    expect(text).not.toMatch(/anonymisierte Bestätigungs-ID/)
    expect(text).toMatch(/die Kennung des Zahlungsvorgangs bei Stripe/)
  })
})

describe('Datenschutzerklärung — Neuigkeiten (S11, N2)', () => {
  it('nennt die Anmeldung auf der Bestätigungsseite mit dem Knopf von dort — und die Kasse fragt wirklich nicht mehr', () => {
    expect(lies('src/app/(public)/[farmSlug]/confirm/[orderId]/page.tsx')).toMatch(/<NeuigkeitenKarte\b/)
    expect(lies('src/components/bestaetigung/neuigkeiten-karte.tsx')).toMatch(/NEUIGKEITEN_TEXT\.knopf/)
    // Die Kasse kennt die Felder nicht mehr, und der Checkout schreibt kein Abo (Nr. 46).
    expect(ohneKommentare(lies('src/schemas/checkout.ts'))).not.toMatch(/optInEmail|optInWhatsApp/)
    expect(ohneKommentare(lies('src/app/api/checkout/route.ts'))).not.toMatch(/customerFarmSubscription/)
    // Gegenprobe Suche: Dieselbe Suche findet die Felder dort, wo es sie gibt.
    expect(ohneKommentare(lies('src/server/actions/subscriptions.ts'))).toMatch(/optInEmail/)

    const text = abschnitt(/9\. Newsletter und Neuigkeiten von Höfen/)
    expect(text).toContain(`„${NEUIGKEITEN_TEXT.knopf}“`)
    expect(text).toMatch(/Bestätigungsseite/)
    expect(text).toMatch(/Beim Bestellen selbst fragen wir nicht danach\./)
    // Der alte Wortlaut (Haken in der Kasse, E-Mail und/oder WhatsApp) ist weg.
    expect(seitenText()).not.toMatch(/Beim Abschluss einer Bestellung kannst du optional zustimmen|und\/oder WhatsApp/)
  })

  it('Double-Opt-in: erst der Knopf hinter dem Link meldet an, und der Link gilt so lange, wie die Seite sagt', () => {
    // Die Anmeldung legt das Abo ohne Haken an; den Haken setzt nur die Bestätigung.
    expect(lies('src/server/actions/neuigkeiten.ts')).toMatch(/create: \{ customerEmail, farmId: bestellung\.farmId, optInEmail: false, optInWhatsApp: false \}/)
    expect(lies('src/server/abo-anmeldung.ts')).toMatch(/data: \{ optInEmail: true, emailOptInBestaetigtAm: jetzt \}/)
    expect(lies('src/components/abo-bestaetigung/bestaetigen-karte.tsx')).toMatch(/ABO_TEXT\.knopf/)
    // Werbliche Mails gehen nur an Bestand und Bestätigte.
    expect(lies('src/server/actions/status-posts.ts')).toMatch(/where: \{ farmId: farm\.id, \.\.\.WERBEMAIL_EMPFAENGER \}/)

    const text = abschnitt(/9\. Newsletter und Neuigkeiten von Höfen/)
    expect(text).toContain(`„${ABO_TEXT.knopf}“`)
    expect(text).toContain(`Der Link gilt ${ABO_BESTAETIGUNG_GUELTIG_TAGE} Tage.`)
    expect(text).toMatch(/vorher bekommst du keine Neuigkeiten/)
  })

  it('Ein-Klick-Abmeldung: jede Neuigkeiten-Mail trägt Abmeldelink und List-Unsubscribe, Abmelden schaltet E-Mail und WhatsApp aus', () => {
    // Die Kopfzeilen nach RFC 8058 stehen an der werblichen Mail (Nr. 47).
    expect(listUnsubscribeKoepfe('https://beispiel.invalid', 'token')).toEqual({
      'List-Unsubscribe': '<https://beispiel.invalid/api/abmelden?token=token>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
    expect(lies('src/lib/email.ts')).toMatch(/headers: listUnsubscribeKoepfe\(APP_URL, opts\.abmeldeToken\)/)
    expect(lies('src/app/api/abmelden/route.ts')).toMatch(/export async function POST\(/)
    expect(lies('src/emails/status-update.tsx')).toMatch(/Abmelden/)
    // Abmelden — per Knopf wie per Ein-Klick — schaltet für diesen Hof beides aus.
    expect(lies('src/server/abo-anmeldung.ts')).toMatch(/data: \{ optInEmail: false, optInWhatsApp: false \}/)

    const text = abschnitt(/9\. Newsletter und Neuigkeiten von Höfen/)
    expect(text).toMatch(/Über den Link „Abmelden“ in jeder Neuigkeiten-Mail/)
    expect(text).toMatch(/Bietet dein E-Mail-Programm selbst „Abmelden“ an, genügt dort ein Klick, ohne weitere Rückfrage\./)
    expect(text).toMatch(/für diesen Hof per E-Mail und per WhatsApp/)
  })

  it('WhatsApp ohne neuen Einstieg: kein Weg schreibt mehr eine Telefonnummer ins Abo, und der Schalter braucht eine', () => {
    const SCHREIBT_ABO = /customerFarmSubscription\.(create|createMany|upsert|update|updateMany)\(/
    // Der Leerraum steht im Lookahead: `\s*` davor wiche sonst per Backtracking aus. Erlaubt sind nur
    // `null` (schreibt keine Nummer) und `true` (Lese-Auswahl); dazu fällt die Kurzschrift `{ customerPhone }`.
    const NUMMER_GESETZT = /customerPhone:(?!\s*(?:null|true)\b)|[{,]\s*customerPhone\s*(?=[,}])/
    const schreiber = quellen().filter(({ code }) => SCHREIBT_ABO.test(code))
    // Gegenprobe: Die Suche findet die bekannten Schreibwege.
    expect(schreiber.map(({ datei }) => datei)).toEqual(
      expect.arrayContaining(['src/server/actions/neuigkeiten.ts', 'src/server/actions/subscriptions.ts', 'src/server/abo-anmeldung.ts'])
    )
    for (const { datei, code } of schreiber) {
      expect(code, datei).not.toMatch(NUMMER_GESETZT)
    }
    // Gegenprobe: Eine Nummer aus der Eingabe schlüge an, auch in Kurzschrift — `null` und eine Lese-Auswahl nicht.
    expect('create: { customerPhone: daten.customerPhone }').toMatch(NUMMER_GESETZT)
    expect('create: { customerEmail, customerPhone }').toMatch(NUMMER_GESETZT)
    expect('create: { customerPhone, farmId }').toMatch(NUMMER_GESETZT)
    expect('create: { customerPhone: null }').not.toMatch(NUMMER_GESETZT)
    expect('select: { customerPhone: true }').not.toMatch(NUMMER_GESETZT)
    // Ohne Nummer ist der WhatsApp-Schalter unter „Mein Konto" gesperrt.
    expect(lies('src/app/account/profile/profile-client.tsx')).toMatch(/disabled=\{!sub\.customerPhone\}/)

    const text = abschnitt(/9\. Newsletter und Neuigkeiten von Höfen/)
    expect(text).toMatch(/Neuigkeiten per WhatsApp lassen sich nicht mehr neu bestellen\./)
  })

  it('nennt die gespeicherten Angaben — genau die Felder des Abos', () => {
    const modell = lies('prisma/schema.prisma').match(/model CustomerFarmSubscription \{([\s\S]*?)\n\}/)?.[1] ?? ''
    const felder = modell
      .split('\n')
      .map((zeile) => zeile.trim())
      .filter((zeile) => /^[a-z]\w*\s/.test(zeile))
      .map((zeile) => zeile.split(/\s+/)[0])
    // Kommt ein Feld dazu, gehört es in die Erklärung (und hier in die Liste).
    expect(felder).toEqual([
      'id',
      'customerEmail',
      'farmId',
      'optInEmail',
      'optInWhatsApp',
      'customerPhone',
      'emailOptInAngefragtAm',
      'emailOptInBestaetigtAm',
      'createdAt',
      'updatedAt',
      'farm',
    ])

    const text = abschnitt(/9\. Newsletter und Neuigkeiten von Höfen/)
    expect(text).toMatch(/Gespeichert werden deine E-Mail-Adresse, der Hof, wann wir dir den Bestätigungslink geschickt und wann du bestätigt hast/)
    expect(text).toMatch(/bei früheren WhatsApp-Anmeldungen auch deine Telefonnummer/)
  })
})

describe('Datenschutzerklärung — Umkreissuche „Standort nutzen"', () => {
  it('nennt den Knopf mit seinem Namen auf der Seite, nicht mehr „In meiner Nähe"', () => {
    expect(lies('src/components/hoefe/hoefe-suche.tsx')).toMatch(/\{SUCHFELD_TEXT\.standort\}/)
    // Gegenprobe Suche: Der alte Wortlaut hätte angeschlagen.
    expect('Tippst du auf der Hofübersicht „In meiner Nähe“').toMatch(/In meiner Nähe/)

    const text = abschnitt(/Umkreissuche auf der Hofübersicht/)
    expect(text).toContain(`„${SUCHFELD_TEXT.standort}“`)
    expect(seitenText()).not.toMatch(/In meiner Nähe/)
  })

  it('sagt, der Standort bleibe im Browser — und der Code schickt, merkt und schreibt ihn nirgends hin', () => {
    const VERLAESST_DIE_SEITE = /\bfetch\(|localStorage|sessionStorage|document\.cookie|history\.(push|replace)State/
    const hook = ohneKommentare(lies('src/components/hoefe/use-ortssuche.ts'))
    expect(hook).toMatch(/navigator\.geolocation\.getCurrentPosition\(/)
    // Die gemessene Position geht nur an den Zustand der Seite …
    expect(hook).toMatch(/onStandort\(\{ lat: position\.coords\.latitude, lon: position\.coords\.longitude \}\)/)
    expect(hook).not.toMatch(VERLAESST_DIE_SEITE)
    // … und die Ortssuche bekommt nur den getippten Text.
    expect(hook.match(/loeseOrtAuf\(([^)]*)\)/g)).toEqual(['loeseOrtAuf(text)'])
    // Die Seite schreibt nur die Filter in die Adresse — und deren Schema kennt keinen Standort.
    expect(ohneKommentare(lies('src/schemas/hoefe-filter.ts'))).not.toMatch(/\b(lat|lon|bezugspunkt)\b/)
    const seite = ohneKommentare(lies('src/components/hoefe/hoefe-client.tsx'))
    expect(seite).not.toMatch(/\bfetch\(|localStorage|sessionStorage|document\.cookie/)
    expect(seite.match(/history\.(push|replace)State\(/g)).toEqual(['history.replaceState('])
    expect(seite).toMatch(/const query = schreibeHoefeFilter\(neu\)\s*window\.history\.replaceState\(null, '', query \?/)
    // An die Karte geht er auch nicht: Sie bekommt nur die Höfe (ganzer Block bis „/>", Props enthalten „=>").
    const karten = seite.match(/<HoefeKarte\b[\s\S]*?\/>/g) ?? []
    expect(karten).toHaveLength(2)
    for (const karte of karten) expect(karte).not.toMatch(/bezugspunkt/i)
    // Gegenprobe: Ein Merken im Browser schlüge an.
    expect("localStorage.setItem('ort', JSON.stringify(punkt))").toMatch(VERLAESST_DIE_SEITE)

    const text = abschnitt(/Umkreissuche auf der Hofübersicht/)
    expect(text).toMatch(/nicht an uns und an niemanden sonst übertragen/)
    expect(text).toMatch(/steht nicht in der Adresse der Seite/)
    expect(text).toContain(`„${SUCHFELD_TEXT.ortAendern}“`)
  })

  it('sagt, nur die Hofübersicht dürfe nach dem Standort fragen — wie es die Kopfzeilen erlauben', () => {
    const konfiguration = lies('next.config.ts')
    expect(konfiguration).toMatch(/source: '\/\(\.\*\)',[\s\S]*?geolocation=\(\)' \}/)
    expect(konfiguration).toMatch(/source: '\/hoefe',\s*headers: \[\s*\{ key: 'Permissions-Policy', value: 'camera=\(\), microphone=\(\), geolocation=\(self\)' \}/)
    expect(konfiguration.match(/geolocation=\(self\)/g)).toHaveLength(1)

    expect(abschnitt(/Umkreissuche auf der Hofübersicht/)).toMatch(/Nach dem Standort fragen darf nur die Hofübersicht/)
  })
})

describe('Datenschutzerklärung — Schutz vor Missbrauch (R1)', () => {
  it('ordnet jede Bremse genau einer Gruppe der Erklärung zu', () => {
    const genannt = Object.values(ZAEHLER_JE_MERKMAL).flatMap((gruppe) => gruppe.map((bremse) => bremse.zweck))
    const alle = Object.values(DB_BREMSEN).map((bremse) => bremse.zweck)
    expect(new Set(genannt).size).toBe(genannt.length)
    expect([...genannt].sort()).toEqual([...alle].sort())
  })

  it('rechnet die Höchstdauer aus Fenster, Wartezeit bis zum täglichen Aufräumen und dem Spiel beim Start', () => {
    const minute = 60_000
    const stunde = 60 * minute
    const spiel = ZAEHLER_AUFRAEUMEN_SPIEL_MS / stunde
    // Gegenprobe: Das Spiel ist eine ganze Stunde (Hobby-Tarif), sonst stimmten die Rundungen unten nicht.
    expect(spiel).toBe(1)
    // Fenster unter einem Tag: bis zum nächsten Tag warten, plus Spiel; angebrochene Stunden zählen ganz.
    expect(zaehlerHoechstensStunden(minute)).toBe(1 + 24 + spiel)
    expect(zaehlerHoechstensStunden(15 * minute)).toBe(1 + 24 + spiel)
    expect(zaehlerHoechstensStunden(stunde)).toBe(1 + 24 + spiel)
    expect(zaehlerHoechstensStunden(23 * stunde)).toBe(23 + 24 + spiel)
    // Ganze Tage enden um Mitternacht UTC, das Aufräumen folgt ab der Cron-Stunde.
    expect(zaehlerHoechstensStunden(24 * stunde)).toBe(24 + ZAEHLER_AUFRAEUMEN_STUNDE_UTC + spiel)
    expect(zaehlerHoechstensStunden(48 * stunde)).toBe(48 + ZAEHLER_AUFRAEUMEN_STUNDE_UTC + spiel)
  })

  it('nennt die Höchstdauern aus Code und vercel.json — und der Cron räumt wirklich zu dieser Stunde auf', () => {
    const crons = JSON.parse(lies('vercel.json')).crons as { path: string; schedule: string }[]
    const aufraeumen = crons.find((cron) => cron.path === '/api/cron/cleanup-reservations')
    expect(aufraeumen?.schedule).toBe(`0 ${ZAEHLER_AUFRAEUMEN_STUNDE_UTC} * * *`)
    expect(lies('src/app/api/cron/cleanup-reservations/route.ts')).toMatch(/await raeumeBremsZaehlerAuf\(/)
    const server = lies('src/server/bremse-datenbank.ts')
    expect(server).toMatch(/ablauf: fensterEnde\(jetzt, bremse\.fensterMs\)/)
    expect(server).toMatch(/deleteMany\(\{ where: \{ ablauf: \{ lt: jetzt \} \} \}\)/)
    // Abgeleitet, nicht festgeschrieben: längstes Fenster der Personen-Zähler plus ein Tag plus Spiel bzw.
    // Tagesfenster je Bestellung plus Cron-Stunde plus Spiel (heute 26 bzw. 28; Bericht 40 nannte 25).
    const stunde = 60 * 60_000
    const spiel = ZAEHLER_AUFRAEUMEN_SPIEL_MS / stunde
    const personen = [...ZAEHLER_JE_MERKMAL.ip, ...ZAEHLER_JE_MERKMAL.adresse, ...ZAEHLER_JE_MERKMAL.warenkorb]
    const laengstesFenster = Math.max(...personen.map((bremse) => bremse.fensterMs)) / stunde
    expect(ZAEHLER_STUNDEN).toEqual({
      person: Math.ceil(laengstesFenster + 24 + spiel),
      bestellung: DB_BREMSEN.neuigkeitenBestellung.fensterMs / stunde + ZAEHLER_AUFRAEUMEN_STUNDE_UTC + spiel,
    })

    const text = abschnitt(/2\. Welche Daten wir verarbeiten/)
    expect(text).toContain(`nach höchstens etwa ${ZAEHLER_STUNDEN.person} Stunden`)
    expect(text).toContain(`nach höchstens etwa ${ZAEHLER_STUNDEN.bestellung} Stunden`)
    expect(abschnitt(/5\. Speicherdauer/)).toContain(`höchstens etwa ${ZAEHLER_STUNDEN.person} Stunden`)
  })

  it('sagt, gespeichert werde nur ein Prüfwert — und in der Tabelle steht nie IP, Adresse oder Kennung', () => {
    const ip = bremsSchluessel('geheim-nur-fuer-tests', DB_BREMSEN.checkoutIp.zweck, '192.0.2.7')
    expect(ip).toMatch(/^checkout-ip:[0-9a-f]{32}$/)
    expect(ip).not.toContain('192.0.2.7')
    const adresse = bremsSchluessel('geheim-nur-fuer-tests', DB_BREMSEN.anmeldecodeAdresse.zweck, 'kundin@example.com')
    expect(adresse).not.toMatch(/@|kundin/)
    // Gegenprobe: Mit einem anderen Geheimnis entsteht ein anderer Wert (kein nackter Hash).
    expect(bremsSchluessel('anderes-geheimnis', DB_BREMSEN.checkoutIp.zweck, '192.0.2.7')).not.toBe(ip)
    const modell = lies('prisma/schema.prisma').match(/model RateLimitZaehler \{([\s\S]*?)\n\}/)?.[1] ?? ''
    const felder = modell.split('\n').map((zeile) => zeile.trim()).filter((zeile) => /^[a-z]\w*\s/.test(zeile)).map((zeile) => zeile.split(/\s+/)[0])
    expect(felder).toEqual(['schluessel', 'fensterStart', 'zaehler', 'ablauf'])

    const text = abschnitt(/2\. Welche Daten wir verarbeiten/)
    expect(text).toMatch(/nur ein Prüfwert, den unser Server mit einem geheimen Schlüssel/)
    expect(text).toMatch(/je IP-Adresse und je E-Mail-Adresse/)
    expect(text).toMatch(/je Warenkorb-Kennung deines Browsers/)
    expect(text).toMatch(/je Bestellung/)
    // „Problem melden" sagt weiter „keine IP-Adresse" — und nennt den Zähler daneben.
    expect(abschnitt(/Fehler- und Wunschmeldungen/)).toMatch(/zählen wir die Meldungen ohne Hof-Anmeldung zusätzlich je IP-Adresse/)
  })
})

describe('Datenschutzerklärung — Kartenkacheln (O6)', () => {
  it('Kacheln laden genau zwei Leaflet-Stellen, beide direkt von tile.openstreetmap.org — die Region nutzt die Karte von /hoefe', () => {
    const ebenen = quellen().flatMap(({ datei, code }) =>
      [...code.matchAll(/tileLayer\(\s*'([^']+)'/g)].map((treffer) => `${datei} ${treffer[1]}`)
    )
    expect(ebenen.sort()).toEqual([
      'src/components/hoefe/hoefe-karte.tsx https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      'src/components/settings/standort-karte.tsx https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    ])
    expect(lies('src/components/analytics/umfeld-karte.tsx')).toMatch(/import HoefeKarte, \{ type KartenHof \} from '@\/components\/hoefe\/hoefe-karte'/)
    const umfeld = lies('src/components/analytics/umfeld-anzeige.tsx')
    expect(umfeld).toMatch(/wahl === 'karte' \? \(\s*<UmfeldKarteAnsicht/)
    // Auch dort steht die Ansicht in der Adresse (`?ansicht=karte`) — ein Link öffnet die Karte direkt.
    expect(umfeld).toMatch(/leseUmfeldAnsicht\(useSearchParams\(\)\.get\('ansicht'\)\)/)
    expect(lies('src/lib/bauern-navigation.ts')).toMatch(/label: 'Region', href: REGION_HREF/)

    const text = abschnitt(/Standortsuche und Kartendarstellung/)
    expect(text).toMatch(/OpenStreetMap Foundation \(tile\.openstreetmap\.org\)/)
    expect(text).toMatch(/Minikarte im Hofprofil/)
    expect(text).toMatch(/die Karte unter „Region“, sobald dort die Kartenansicht offen ist — auch über einen Link/)
    // Gegenprobe Suche: Der Satz aus Runde 0 („sobald ein Hof dort „Karte“ wählt") hätte angeschlagen.
    const NUR_NACH_WAHL = /sobald ein Hof dort „Karte“ wählt/
    expect('die Karte unter „Region“, sobald ein Hof dort „Karte“ wählt').toMatch(NUR_NACH_WAHL)
    expect(text).not.toMatch(NUR_NACH_WAHL)
  })

  it('sagt, was der Browser beim Laden der Kacheln mitschickt — IP, User-Agent und als Herkunft nur der Ursprung', () => {
    // Der Ursprung statt der ganzen Adresse: strict-origin-when-cross-origin für alle Seiten, keine eigene
    // Regel an den Kachel-Ebenen.
    expect(lies('next.config.ts')).toMatch(/source: '\/\(\.\*\)',[\s\S]*?\{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' \}/)
    for (const datei of ['src/components/hoefe/hoefe-karte.tsx', 'src/components/settings/standort-karte.tsx']) {
      expect(ohneKommentare(lies(datei)), datei).not.toMatch(/referrerPolicy|crossOrigin/)
    }
    // Gegenprobe Suche: Eine eigene Regel an der Ebene schlüge an.
    expect("L.tileLayer(url, { referrerPolicy: 'unsafe-url' })").toMatch(/referrerPolicy|crossOrigin/)

    const text = abschnitt(/Standortsuche und Kartendarstellung/)
    expect(text).toMatch(/die Kennung deines Browsers \(User-Agent\) sowie als Herkunft nur die Adresse unserer Website ohne Seitenpfad/)
    // Der Satz aus Runde 0 ließ beides aus.
    expect(text).not.toMatch(/ansiehst; weitere Angaben über dich schickt die Karte nicht mit/)
  })

  it('auf der Hofübersicht: ab 1024 px lädt die Karte mit der Seite, schmaler erst in der Kartenansicht — die auch ein Link öffnet', () => {
    const client = lies('src/components/hoefe/hoefe-client.tsx')
    expect(client.match(/matchMedia\('\(min-width: 1024px\)'\)/g)).toHaveLength(2)
    const breit = client.indexOf('if (istBreit) {')
    const schmalMitKarte = client.indexOf("ansicht === 'karte' ? (")
    const ersteKarte = client.indexOf('<HoefeKarte')
    // Im Splitscreen steht die Karte sofort da, schmal nur in der Kartenansicht.
    expect(breit).toBeGreaterThan(0)
    expect(ersteKarte).toBeGreaterThan(breit)
    expect(ersteKarte).toBeLessThan(schmalMitKarte)
    expect(client.match(/<HoefeKarte\b/g)).toHaveLength(2)
    expect(client).toMatch(/aria-label="Karte öffnen"/)
    // Die Kartenansicht steht in der Adresse, und die Startseite verlinkt sie direkt: Neuladen, Zurück,
    // ein geteilter Link oder „Alle Höfe auf der Karte" laden die Kacheln auch am Handy ohne „Karte öffnen".
    const filter = lies('src/schemas/hoefe-filter.ts')
    expect(filter).toMatch(/ansicht: ansichtSchema\.parse\(params\.get\(P\.ansicht\)\)/)
    expect(filter).toMatch(/if \(filter\.ansicht === 'karte'\) params\.set\(P\.ansicht, 'karte'\)/)
    expect(lies('src/lib/startseite.ts')).toMatch(/export const KARTE_ADRESSE = hoefeAdresse\(\{ ansicht: 'karte' \}\)/)
    expect(lies('src/components/startseite/hoefe-in-der-naehe.tsx')).toMatch(/href=\{KARTE_ADRESSE\}/)
    // Gegenprobe Suche: Die falsche Fassung aus Runde 0 hätte angeschlagen.
    const NUR_NACH_KNOPF = /erst, wenn du „Karte öffnen“ tippst/
    expect('auf schmaleren Bildschirmen erst, wenn du „Karte öffnen“ tippst').toMatch(NUR_NACH_KNOPF)

    const text = abschnitt(/Standortsuche und Kartendarstellung/)
    expect(text).not.toMatch(NUR_NACH_KNOPF)
    expect(text).toMatch(/ab 1024 Pixel Breite steht die Karte neben der Liste und lädt gleich mit der Seite/)
    expect(text).toMatch(/auf schmaleren Bildschirmen lädt sie erst in der Kartenansicht — nach „Karte öffnen“ oder über einen Link, der direkt dorthin führt/)
  })
})

describe('Datenschutzerklärung — neues Design (Nr. 57)', () => {
  it('steht in der KundeShell, ohne den alten Kopf, und bleibt statisch', () => {
    const seite = ohneKommentare(lies('src/app/(public)/datenschutz/page.tsx'))
    expect(seite).toMatch(/<KundeShellMitSitzung>/)
    expect(seite).not.toMatch(/KundenKopf/)
    expect(seite).not.toMatch(/\bheaders\(\)|\bcookies\(\)|next\/headers/)
    // Metadaten wie bisher: nur der Titel, keine Regel für Suchmaschinen.
    expect(seite).toMatch(/export const metadata: Metadata = \{ title: 'Datenschutz — FarmerZone' \}/)
    expect(seite).not.toMatch(/robots/)
    // Gegenprobe: Die Suche findet die Shell auf „Für Höfe".
    expect(lies('src/app/(public)/fuer-hoefe/page.tsx')).toMatch(/<KundeShellMitSitzung>/)
  })
})

describe('Datenschutzerklärung — Namen und die Wache selbst (Nachbesserung Runde 1)', () => {
  it('jeder Name in „…" steht so in der Oberfläche — aus seiner Konstante oder an die Stelle gebunden, die ihn zeigt', () => {
    // Aus Konstanten: Die Seite liest sie, also stimmen sie von selbst — leer hieße, die Quelle fehlt.
    const ausKonstanten = [NEUIGKEITEN_TEXT.knopf, ABO_TEXT.knopf, SUCHFELD_TEXT.standort, SUCHFELD_TEXT.ortAendern, PROBLEM_MELDEN, MEIN_KONTO, HILFE_UND_RUECKMELDUNG]
    for (const name of ausKonstanten) expect(name.length, 'Name ohne Quelle').toBeGreaterThan(0)
    // Feste Texte ohne Konstante: gebunden an die Stelle, an der die Oberfläche sie zeigt.
    const gebunden: Record<string, [string, RegExp]> = {
      Abmelden: ['src/emails/status-update.tsx', /href=\{unsubscribeUrl\}[^>]*>\s*Abmelden\s*</],
      'Karte öffnen': ['src/components/hoefe/hoefe-client.tsx', /aria-label="Karte öffnen"/],
      Region: ['src/lib/bauern-navigation.ts', /label: 'Region', href: REGION_HREF/],
      'Bestellungen finden': ['src/components/bestellungen/bestellungen-ansicht.tsx', /aria-label="Bestellungen finden"/],
    }
    for (const [name, [datei, stelle]] of Object.entries(gebunden)) expect(lies(datei), name).toMatch(stelle)
    // Verweise auf Abschnitte dieser Seite selbst.
    const text = seitenText()
    const verweise = ['Standortsuche und Kartendarstellung', 'Schutz vor Missbrauch']
    for (const verweis of verweise) expect(text).toContain(verweis)

    const erlaubt = new Set<string>([...ausKonstanten, ...Object.keys(gebunden), ...verweise])
    const genannt = [...text.matchAll(/„([^“]+)“/g)].map((treffer) => treffer[1])
    // Gegenprobe: Die Suche findet Namen beider Arten.
    expect(genannt).toEqual(expect.arrayContaining([NEUIGKEITEN_TEXT.knopf, MEIN_KONTO, 'Abmelden', 'Region']))
    for (const name of genannt) expect(erlaubt.has(name), `„${name}“ hat keine Quelle`).toBe(true)
    // „Fehler melden" steht seit Nr. 22e nirgends mehr in der Oberfläche; der Punkt heißt „Hilfe und Rückmeldung".
    expect(text).not.toMatch(/Fehler melden/)
  })

  it('der Kommentar-Entferner lässt Zeichenketten, Vorlagen und Regex-Literale stehen', () => {
    const quelle = [
      "const a = 'image/*'",
      'const b = 1 /* weg-1 */ + 2',
      "const c = '*/'",
      'const d = "https://beispiel.invalid" // weg-2',
      'const e = `x ${"//"} y ${{ k: 1 }.k}` // weg-3',
      'const f = /\\/\\*/g.test(a)',
      'const g = /a\\/\\//',
      'function h() { return /\\/\\// }',
      '<p>siehe https://beispiel.invalid</p>',
    ].join('\n')
    const ohne = ohneKommentare(quelle)
    expect(ohne).not.toMatch(/weg-/)
    for (const bleibt of ["const a = 'image/*'", 'const b = 1', '+ 2', "const c = '*/'", 'https://beispiel.invalid"', '${"//"}', 'const f = /\\/\\*/g', 'const g = /a\\/\\//', 'return /\\/\\// }', '<p>siehe https://beispiel.invalid</p>']) {
      expect(ohne, bleibt).toContain(bleibt)
    }
    // Gegenprobe: Das Muster aus Runde 0 hätte von 'image/*' bis zum nächsten „*/" alles verschluckt.
    const altesMuster = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(altesMuster(quelle)).not.toContain('const b')
  })
})
