/**
 * Datensparsamkeit für Sentry, Nr. 47: die Felder, die bis Lauf 7
 * ungefiltert durchliefen (Bericht Nr. 37, „Altlasten außerhalb von Auftrag
 * 37") — `logentry`, `tags`, `extra`, die übrigen `contexts`, die Variablen in
 * Stack-Frames (`frame.vars`) und die Daten der Brotkrumen.
 *
 * Seit der Nachbesserung 1 auch: Texte unter Query-Schlüsseln (Werte, nicht
 * nur Parameternamen) und die Nachrichten (event.message, message der
 * Brotkrumen) mit derselben Freitext-Regel wie logentry. Seit der
 * Nachbesserung 2: Laufzeit linear bei langen Texten, und die linear
 * gemachte E-Mail-Regel liefert dasselbe wie die alten Muster.
 *
 * Seit Nr. 56 (Altlasten aus Lauf 8 §6, Bericht 47) je ein Test für die drei
 * offenen Fälle: E-Mail mit Nicht-ASCII-Zeichen, doppelt kodierte Adressen
 * (%2540) und ein Token in einer relativen Adresse im Fehlertext
 * (exception.value) — dazu eine Gegenprobe und je Muster ein Laufzeit-Fall.
 *
 * Je Feld ein Test mit E-Mail-Adresse, Token und IP-Adresse darin; dazu
 * Gegenproben, dass Kennungen, Codes, Zahlen und die technischen Kontexte des
 * SDK (Versionsnummern!) stehen bleiben. Erfundene Werte: example.com und
 * Adressen aus den Dokumentationsbereichen (RFC 5737 / RFC 3849).
 *
 * Der Filter ist eine reine Funktion — kein Mock.
 */
import { describe, it, expect } from 'vitest'
import type { ErrorEvent } from '@sentry/nextjs'
import { bereinigeEreignis, ohneAnfrage } from '@/lib/sentry-hygiene'

function ereignis(teil: object): ErrorEvent {
  return teil as ErrorEvent
}

const MAIL = 'kundin@example.com'
const IP4 = '203.0.113.7'
const IP6 = '2001:db8::7'
const TOKEN = 'V1StGXR8_Z5jdHi6BmyT9pqLnv2wYc4k'
const HEIKEL = new RegExp(`${MAIL.replace('.', '\\.')}|203\\.0\\.113\\.7|2001:db8::7|${TOKEN}|geheim-123`)

describe('logentry — Nachricht und Parameter', () => {
  it('bereinigt die Nachricht (E-Mail, Link mit Token) und jeden Parameter (E-Mail, IP, Objekt)', () => {
    const e = bereinigeEreignis(
      ereignis({
        logentry: {
          message: `Mail an ${MAIL} mit Link https://farmerzone.at/reset-password?token=geheim-123 gescheitert`,
          params: [MAIL, IP4, { token: 'geheim-123' }, 42, `/fz/bestaetigen/${TOKEN}`],
        },
      })
    )

    expect(e.logentry?.message).toBe('Mail an [e-mail entfernt] mit Link https://farmerzone.at/reset-password gescheitert')
    expect(e.logentry?.params).toEqual(['[e-mail entfernt]', '[ip entfernt]', '[objekt entfernt]', 42, '/fz/bestaetigen/[kennung entfernt]'])
    expect(JSON.stringify(e)).not.toMatch(HEIKEL)
  })

  it('ein logentry, das kein Objekt ist, fällt weg — nicht zu sichten', () => {
    expect(bereinigeEreignis(ereignis({ logentry: `an ${MAIL}` })).logentry).toBeUndefined()
  })
})

describe('tags', () => {
  it('heikle Schlüssel fallen weg, Texte werden bereinigt, Bereich und Fehlercode bleiben', () => {
    const e = bereinigeEreignis(
      ereignis({
        tags: {
          bereich: 'kasse',
          grund: 'abo_nicht_gespeichert',
          code: 'P2002',
          kundin: MAIL,
          token: 'geheim-123',
          ip: IP4,
          'x-forwarded-for': IP4,
          link: 'https://farmerzone.at/account/unsubscribe?token=geheim-123&seite=2',
          herkunft: `Anfrage von ${IP6}`,
          anzahl: 3,
          aktiv: true,
        },
      })
    )

    expect(e.tags).toEqual({
      bereich: 'kasse',
      grund: 'abo_nicht_gespeichert',
      code: 'P2002',
      kundin: '[e-mail entfernt]',
      link: 'https://farmerzone.at/account/unsubscribe?seite=2',
      herkunft: 'Anfrage von [ip entfernt]',
      anzahl: 3,
      aktiv: true,
    })
    expect(JSON.stringify(e)).not.toMatch(HEIKEL)
  })

  it('ein Schlüssel, der selbst eine Adresse ist, fällt weg', () => {
    expect(bereinigeEreignis(ereignis({ tags: { [MAIL]: 'ja', bereich: 'kasse' } })).tags).toEqual({ bereich: 'kasse' })
  })
})

describe('extra', () => {
  it('bereinigt verschachtelt: heikle Schlüssel, IP und Pfad-Token im Text, Listen — Kennungen bleiben', () => {
    const e = bereinigeEreignis(
      ereignis({
        extra: {
          orderId: 'cmuri7v8f002nkl7dws941rn4',
          orderIds: ['cmuri7v8f002nkl7dws941rn4', 'cmuri7v8f002nkl7dws941rn5'],
          kundin: { email: MAIL, telefon: '+43 660 0000000', hinweis: `schreibt von ${MAIL}` },
          verbindung: `Verbindung von ${IP4}:6543 abgelehnt`,
          bestaetigung: `/fz/bestaetigen/${TOKEN}`,
          sitzung: { authorization: 'Bearer geheim-123', cookie: 'a=b' },
          freitext: 'Abmeldung mit token=geheim-123 versucht',
          vomHofCents: 1250,
          handbuchung: 'Überweisung mit diesem Betrag zurückbuchen',
        },
      })
    )

    expect(e.extra).toEqual({
      orderId: 'cmuri7v8f002nkl7dws941rn4',
      orderIds: ['cmuri7v8f002nkl7dws941rn4', 'cmuri7v8f002nkl7dws941rn5'],
      kundin: { hinweis: 'schreibt von [e-mail entfernt]' },
      verbindung: 'Verbindung von [ip entfernt]:6543 abgelehnt',
      bestaetigung: '/fz/bestaetigen/[kennung entfernt]',
      sitzung: {},
      freitext: 'Abmeldung mit token=[entfernt] versucht',
      vomHofCents: 1250,
      handbuchung: 'Überweisung mit diesem Betrag zurückbuchen',
    })
    expect(JSON.stringify(e)).not.toMatch(HEIKEL)
  })

  it('zu tief Verschachteltes fällt weg, statt ungeprüft mitzugehen', () => {
    let tief: Record<string, unknown> = { email: MAIL }
    for (let i = 0; i < 12; i++) tief = { ebene: tief }
    const e = bereinigeEreignis(ereignis({ extra: { tief } }))
    expect(JSON.stringify(e)).toContain('[objekt entfernt]')
    expect(JSON.stringify(e)).not.toMatch(HEIKEL)
  })

  it('ein extra, das kein Objekt ist, fällt weg', () => {
    expect(bereinigeEreignis(ereignis({ extra: [MAIL, IP4] })).extra).toBeUndefined()
  })
})

describe('contexts — die übrigen', () => {
  it('eigene Kontexte werden bereinigt; die technischen Kontexte des SDK bleiben unberührt', () => {
    const technisch = {
      runtime: { name: 'node', version: 'v22.22.2' },
      browser: { name: 'Chrome', version: '120.0.0.0' },
      os: { name: 'Android', version: '14' },
      device: { family: 'K', model: 'Pixel 8', memory_size: 8_000_000_000 },
      app: { app_start_time: '2026-10-08T06:00:00.000Z' },
      culture: { locale: 'de-AT', timezone: 'Europe/Vienna' },
      cloud_resource: { 'cloud.provider': 'vercel', 'cloud.region': 'fra1' },
    }
    const e = bereinigeEreignis(
      ereignis({
        contexts: {
          ...technisch,
          upload: { dateiTyp: 'image/jpeg', weg: 'galerie', versuche: 2, androidVersion: null },
          kundin: { email: MAIL, ip: IP4, link: `https://farmerzone.at/account/neuigkeiten-bestaetigen?token=geheim-123`, notiz: `rief von ${IP6} an` },
          response: { status_code: 500, headers: { 'set-cookie': 'session=geheim-123', 'content-type': 'text/html' } },
        },
      })
    )

    for (const [name, wert] of Object.entries(technisch)) expect(e.contexts?.[name], name).toEqual(wert)
    expect(e.contexts?.upload).toEqual({ dateiTyp: 'image/jpeg', weg: 'galerie', versuche: 2, androidVersion: null })
    expect(e.contexts?.kundin).toEqual({ link: 'https://farmerzone.at/account/neuigkeiten-bestaetigen', notiz: 'rief von [ip entfernt] an' })
    expect(e.contexts?.response).toEqual({ status_code: 500, headers: { 'content-type': 'text/html' } })
    expect(JSON.stringify(e)).not.toMatch(HEIKEL)
  })

  it('der Next-Kontext bleibt bereinigt wie bisher, auch über request_path hinaus', () => {
    const e = bereinigeEreignis(
      ereignis({
        contexts: { nextjs: { request_path: `/customers/${MAIL.replace('@', '%40')}`, router_path: '/customers/[kundeId]', notiz: MAIL } },
      })
    )
    expect(e.contexts?.nextjs).toEqual({ request_path: '/customers/[e-mail entfernt]', router_path: '/customers/[kundeId]', notiz: '[e-mail entfernt]' })
  })

  it('ein Kontext, der kein Objekt ist, wird als Text bereinigt oder fällt weg', () => {
    const e = bereinigeEreignis(ereignis({ contexts: { kundin: `Mail ${MAIL} von ${IP4}`, liste: [MAIL] } }))
    expect(JSON.stringify(e)).not.toMatch(HEIKEL)
  })
})

describe('frame.vars — Variablen in Stack-Frames', () => {
  it('fallen ganz weg, in Ausnahmen und Threads; Datei, Funktion und Zeile bleiben', () => {
    const rahmen = () => ({
      filename: 'app:///src/server/abo-anmeldung.ts',
      function: 'meldeEmailAboAn',
      lineno: 51,
      vars: { email: MAIL, token: 'geheim-123', ip: IP4, abo: { customerEmail: MAIL } },
    })
    const e = bereinigeEreignis(
      ereignis({
        exception: { values: [{ type: 'Error', value: 'kaputt', stacktrace: { frames: [rahmen(), rahmen()] } }] },
        threads: { values: [{ id: 1, stacktrace: { frames: [rahmen()] } }] },
      })
    )

    const frames = e.exception?.values?.[0].stacktrace?.frames ?? []
    expect(frames).toHaveLength(2)
    for (const f of frames) {
      expect(f).toEqual({ filename: 'app:///src/server/abo-anmeldung.ts', function: 'meldeEmailAboAn', lineno: 51 })
    }
    expect(JSON.stringify(e)).not.toMatch(HEIKEL)
  })
})

describe('Brotkrumen — data vollständig', () => {
  it('jeder Wert wird bereinigt, nicht nur url/from/to/arguments', () => {
    const e = bereinigeEreignis(
      ereignis({
        breadcrumbs: [
          {
            category: 'fetch',
            data: {
              method: 'POST',
              url: '/api/abmelden?token=geheim-123',
              status_code: 500,
              client_ip: IP4,
              koerper: { email: MAIL, menge: 2 },
              notiz: `Antwort für ${MAIL} von ${IP6}`,
              'http.query': 'token=geheim-123&seite=2',
            },
          },
        ],
      })
    )

    expect(e.breadcrumbs?.[0].data).toEqual({
      method: 'POST',
      url: '/api/abmelden',
      status_code: 500,
      koerper: { menge: 2 },
      notiz: 'Antwort für [e-mail entfernt] von [ip entfernt]',
      'http.query': 'seite=2',
    })
    expect(JSON.stringify(e)).not.toMatch(HEIKEL)
  })
})

describe('Texte unter Query-Schlüsseln (Nachbesserung 1)', () => {
  it('ein Text, der kein Query-String ist, geht durch die Freitext-Regel — nicht als Parametername durch', () => {
    const e = bereinigeEreignis(ereignis({ extra: { suchQuery: MAIL, 'db.query': `SELECT 1 WHERE mail = '${MAIL}' -- ${IP4}` } }))
    // Vorher: „kundin%40example.com=" (die Adresse als Parametername, kodiert).
    expect(e.extra).toEqual({ suchQuery: '[e-mail entfernt]', 'db.query': "SELECT 1 WHERE mail = '[e-mail entfernt]' -- [ip entfernt]" })
  })

  it('ein Query-String: heikle Parameter fallen weg, Namen und Werte werden DEKODIERT bereinigt', () => {
    const query = `q=${encodeURIComponent(MAIL)}&token=geheim-123&seite=2&von=${IP4}&id=${TOKEN}&ziel=${encodeURIComponent('/x?token=geheim-123')}`
    const e = bereinigeEreignis(ereignis({ extra: { 'http.query': query }, breadcrumbs: [{ data: { 'http.query': query } }] }))
    for (const ergebnis of [e.extra?.['http.query'], e.breadcrumbs?.[0].data?.['http.query']]) {
      const parameter = new URLSearchParams(String(ergebnis))
      expect([...parameter.keys()]).toEqual(['q', 'seite', 'von', 'id', 'ziel'])
      expect(parameter.get('q')).toBe('[e-mail entfernt]')
      expect(parameter.get('seite')).toBe('2')
      expect(parameter.get('von')).toBe('[ip entfernt]')
      expect(parameter.get('id')).toBe('[kennung entfernt]')
      expect(parameter.get('ziel')).toBe('/x')
      expect(String(ergebnis)).not.toMatch(/%40/)
    }
    expect(JSON.stringify(e)).not.toMatch(HEIKEL)
  })

  it('auch die Adresse der Anfrage: Werte im Query werden bereinigt, nicht nur Namen', () => {
    const e = bereinigeEreignis(
      ereignis({
        request: { url: `https://farmerzone.at/suche?q=${encodeURIComponent(MAIL)}&seite=2`, query_string: `q=${MAIL}&seite=2` },
      })
    )
    expect(new URLSearchParams(e.request?.url?.split('?')[1]).get('q')).toBe('[e-mail entfernt]')
    expect(new URLSearchParams(e.request?.query_string as string).get('q')).toBe('[e-mail entfernt]')
    expect(new URLSearchParams(e.request?.query_string as string).get('seite')).toBe('2')
    expect(JSON.stringify(e)).not.toMatch(/kundin(@|%40)example/)
  })
})

describe('Nachrichten — event.message und message der Brotkrumen (Nachbesserung 1)', () => {
  const NACHRICHT = `Abruf https://farmerzone.at/upload?token=geheim-123 von ${IP4} für ${MAIL}, token=geheim-123, Kennung ${TOKEN}`
  const SAUBER = 'Abruf https://farmerzone.at/upload von [ip entfernt] für [e-mail entfernt], token=[entfernt], Kennung [kennung entfernt]'

  it('die Nachricht des Ereignisses mit derselben Regel wie logentry', () => {
    expect(bereinigeEreignis(ereignis({ message: NACHRICHT })).message).toBe(SAUBER)
  })

  it('eine Console-Brotkrume trägt die Argumente als message UND als arguments — beide bereinigt', () => {
    const e = bereinigeEreignis(
      ereignis({
        breadcrumbs: [
          {
            category: 'console',
            level: 'error',
            message: `Abo-Mail an ${MAIL} gescheitert: https://farmerzone.at/account/unsubscribe?token=geheim-123 von ${IP6} ${TOKEN}`,
            data: {
              logger: 'console',
              arguments: [`Abo-Mail an ${MAIL} gescheitert:`, 'https://farmerzone.at/account/unsubscribe?token=geheim-123', `von ${IP6}`, TOKEN],
            },
          },
        ],
      })
    )
    expect(e.breadcrumbs?.[0].message).toBe(
      'Abo-Mail an [e-mail entfernt] gescheitert: https://farmerzone.at/account/unsubscribe von [ip entfernt] [kennung entfernt]'
    )
    expect(e.breadcrumbs?.[0].data).toEqual({
      logger: 'console',
      arguments: ['Abo-Mail an [e-mail entfernt] gescheitert:', 'https://farmerzone.at/account/unsubscribe', 'von [ip entfernt]', '[kennung entfernt]'],
    })
    expect(JSON.stringify(e)).not.toMatch(HEIKEL)
  })

  it('auch das Minimalereignis bereinigt seine Nachricht mit dieser Regel', () => {
    const roh: Record<string, unknown> = { event_id: 'e4', level: 'error', message: NACHRICHT }
    Object.defineProperty(roh, 'tags', {
      enumerable: true,
      get() {
        throw new Error('kaputt')
      },
    })
    expect(bereinigeEreignis(ereignis(roh))).toEqual({ event_id: 'e4', level: 'error', message: SAUBER, extra: { bereinigung: 'fehlgeschlagen' } })
  })

  it('Gegenprobe: Der Fehlertext behält die Adresse des Datenbank-Servers (Nr. 37), Harmloses bleibt', () => {
    const e = bereinigeEreignis(
      ereignis({
        message: 'Seite geladen in 120 ms um 10:30:45, Node 22.22.2, Status 503',
        breadcrumbs: [{ category: 'console', message: 'Bestellung 481234 gespeichert (farm cmuri7ryv000nkl7dnkc5bx72)' }],
        exception: { values: [{ type: 'Error', value: `connect ETIMEDOUT ${IP4}:6543` }] },
      })
    )
    expect(e.message).toBe('Seite geladen in 120 ms um 10:30:45, Node 22.22.2, Status 503')
    expect(e.breadcrumbs?.[0].message).toBe('Bestellung 481234 gespeichert (farm cmuri7ryv000nkl7dnkc5bx72)')
    expect(e.exception?.values?.[0].value).toBe(`connect ETIMEDOUT ${IP4}:6543`)
  })
})

describe('Laufzeit — linear auch bei langen Texten ohne Treffer (Nachbesserung 2)', () => {
  // Alles läuft synchron in beforeSend, und das SDK kürzt vorher nichts. Die
  // alten Muster brauchten für jeden dieser Texte Sekunden (quadratisch);
  // jetzt sind es Millisekunden. Die Grenze lässt Luft für eine volle Maschine.
  const GRENZE_MS = 500
  const N = 50_000
  const lang: [string, object][] = [
    ['Query-Text unter suchQuery', { extra: { suchQuery: 'a='.repeat(N) + ' x' } }],
    ['Query-Text unter http.query', { extra: { 'http.query': 'a='.repeat(N) + ' x' } }],
    ['lange Folge in extra', { extra: { text: 'a'.repeat(2 * N) } }],
    ['lange Folge als Nachricht', { message: 'a.'.repeat(N) }],
    ['lange Folge im Fehlertext', { exception: { values: [{ value: 'a%'.repeat(N) }] } }],
    ['viele @ im Fehlertext', { exception: { values: [{ value: 'a@'.repeat(N) }] } }],
    ['lange Domain ohne Endung', { exception: { values: [{ value: 'a@' + 'b.'.repeat(N) + 'c' }] } }],
    ['kodierte Adressen ohne Endung', { extra: { text: 'a%40'.repeat(N) } }],
    ['langer Pfad', { request: { url: 'https://farmerzone.at/' + 'a-'.repeat(N) } }],
    ['Brotkrume', { breadcrumbs: [{ message: 'a'.repeat(2 * N), data: { notiz: 'a-'.repeat(N), arguments: ['a'.repeat(2 * N)] } }] }],
    ['lange Ziffernfolge', { message: '01 '.repeat(N) }],
    ['token ohne Wert', { extra: { text: 'token' + ' '.repeat(2 * N) } }],
    ['Bearer ohne Wert', { extra: { text: 'Bearer' + ' '.repeat(2 * N) } }],
    // Nr. 56: die erweiterten E-Mail-Muster und die Adressen im Fehlertext.
    ['viele @ nach Umlauten', { exception: { values: [{ value: 'ä@'.repeat(N) }] } }],
    ['Domain mit Umlauten ohne Endung', { exception: { values: [{ value: 'a@' + 'ä.'.repeat(N) + 'c' }] } }],
    ['kodierte Umlaute ohne Endung', { extra: { text: 'a%40' + '%C3%A4.'.repeat(N) + '1' } }],
    ['doppelt kodiert ohne Endung', { extra: { text: 'a%2540'.repeat(N) } }],
    ['lange Folge aus %25', { exception: { values: [{ value: 'a%' + '25'.repeat(N) + '4' }] } }],
    // Jede Adresse wird einzeln zerlegt (URLSearchParams) — 5 000 genügen, um
    // Quadratisches zu sehen; 50 000 lagen unter Last schon nahe der Grenze.
    ['viele relative Adressen im Fehlertext', { exception: { values: [{ value: ' /a?b=1'.repeat(N / 10) }] } }],
    ['lange Folge aus Schrägstrichen im Fehlertext', { exception: { values: [{ value: '/'.repeat(2 * N) }] } }],
    ['Schrägstriche nach Klammern im Fehlertext', { exception: { values: [{ value: '(/'.repeat(N) }] } }],
    // Nr. 56, Runde 1: mehrfach kodierte Bytes in der Domain (%25C3, %2525C3).
    ['doppelt kodierte Umlaute ohne Endung', { extra: { text: 'a%2540' + '%25C3%25A4.'.repeat(N) + '1' } }],
    ['@ und doppelt kodierte Bytes ohne Punkt', { exception: { values: [{ value: 'a@' + '%25C3'.repeat(N) }] } }],
    ['%25-Kette mit 40 und kodierten Bytes', { exception: { values: [{ value: '%' + '25'.repeat(N) + '40' + '%25C3'.repeat(N) }] } }],
    ['halbe Bytes nach %2540', { extra: { text: ('x%2540' + '%258'.repeat(5)).repeat(N / 5) } }],
    ['Domain aus langen %2525-Ketten', { exception: { values: [{ value: 'a%40b' + ('%' + '25'.repeat(20) + 'C').repeat(N / 20) }] } }],
    // Nr. 56, Runde 1: Adressen in Abfragewerten und Anker — verschachtelt nur
    // bis MAX_ADRESS_TIEFE; jede Adresse als Wert wird einzeln zerlegt (5 000).
    ['verschachtelte Adressen in Abfragewerten', { exception: { values: [{ value: '/?a='.repeat(N) }] } }],
    ['verschachtelte Anker als Nachricht', { message: '/#a='.repeat(N) }],
    ['viele Adressen als Abfragewerte', { request: { url: 'https://farmerzone.at/?' + 'a=/b&'.repeat(N / 10) } }],
  ]

  for (const [name, teil] of lang) {
    it(`${name}: unter ${GRENZE_MS} ms`, () => {
      const start = performance.now()
      bereinigeEreignis(ereignis(teil))
      expect(performance.now() - start).toBeLessThan(GRENZE_MS)
    })
  }
})

describe('E-Mail-Adressen — dasselbe Ergebnis wie die schlichten Muster (Nachbesserung 2, seit Nr. 56 auch Nicht-ASCII und %2540)', () => {
  // Die Referenz: die Regel als schlichte Regex (quadratisch, aber das
  // Ergebnis ist die Vorgabe). Bis Nr. 56 nur A–Z und %40; seit Nr. 56
  // Buchstaben und Ziffern jeder Schrift, in der Domain auch kodierte Bytes
  // eines Nicht-ASCII-Zeichens (%80–%FF, seit Runde 1 auch mehrfach kodiert:
  // %25C3, %2525C3 …) und kodiert auch %2540, %252540 ….
  // Über den Fehlertext geprüft: Dort gilt außer den E-Mail-Mustern nur die
  // Telefon- und Code-Regel und seit Nr. 56 die Adress-, Zuweisungs- und
  // Bearer-Regel. Die Texte tragen weder „http", „token" noch „Bearer", „/"
  // nur in einem Pfad ohne Token (dort gilt dieselbe E-Mail-Regel) und zu
  // wenige Ziffern am Stück für eine Telefonnummer oder einen Anmeldecode.
  const REF_EMAIL =
    /[\p{L}\p{N}\p{M}._%+-]+@(?:[\p{L}\p{N}\p{M}.-]|%(?:25)*[89A-Fa-f][0-9A-Fa-f])+\.(?:[\p{L}\p{M}]|%(?:25)*[89A-Fa-f][0-9A-Fa-f]){2,}/gu
  const REF_KODIERT =
    /[\p{L}\p{N}\p{M}._%+-]+%(?:25)*40(?:[\p{L}\p{N}\p{M}.-]|%(?:25)*[89A-Fa-f][0-9A-Fa-f])+\.(?:[\p{L}\p{M}]|%(?:25)*[89A-Fa-f][0-9A-Fa-f]){2,}/giu
  const referenz = (text: string) => text.replace(REF_EMAIL, '[e-mail entfernt]').replace(REF_KODIERT, '[e-mail entfernt]')
  const neu = (text: string) => bereinigeEreignis(ereignis({ exception: { values: [{ value: text }] } })).exception?.values?.[0].value

  it('an den Rändern: aneinandergeklebte, kodierte, halbe und doppelte Adressen', () => {
    const faelle = [
      'kundin@example.com', 'Mail an kundin@example.com, anna@example.org.', 'kundin@example.com-anna@example.org',
      'a@b.cc_x@d.ee', 'a@b.cc+x@d.ee', 'a@b.cc.x@d.ee', 'a@b.cc%x@d.ee', 'x@y.zz@w.vv', 'a@b.cc@d.ee', '@a.bc', 'a@', 'a@b',
      'a@b.c', 'a@.cc', 'a@b..cc', 'a@b-.cc', '.@a.bc', '-@-.--', 'A@B.CO', 'a.b@c-d.ef.gh', 'mailto:kundin@example.com',
      '<kundin@example.com>', 'kundin%40example.com', 'a%40b%40c.de', 'kundin%40example.com,anna%40example.org',
      '/customers/kunde%40beispiel.at', 'a@b.cc%40d.ee', 'a%40b.cc@d.ee', '%40a.bc', 'a%4', '@@a@@b.cc@@',
      // Seit Nr. 56: Nicht-ASCII (auch zerlegt geschrieben und außerhalb der Grundebene) und mehrfach kodiert.
      'jürgen.müller@example.com', 'kundin@bäckerei.example', 'Größe@straße.example', 'é@é.éé', 'jürgen@example.com',
      'a@b.c̈c', '𝒜𝒷@example.com', 'x𝒜@y.zz', 'a𝒜b@c𝒜d.e𝒜', '\uDC00a@b.cc', 'a\uD835@b.cc', 'kundin@m%C3%BCller.example',
      'j%C3%BCrgen%40b%C3%A4ckerei.example', 'a@b.%C3%A4%C3%B6', 'a@b.%C3', 'a@b%40c.de', 'a@b%2Ec.de', 'kundin%2540example.com',
      'kundin%252540example.com', 'a%25%2540b.cc', '%2540a.bc', 'a%2540', 'a%2540b%2540c.de', 'a%254b.cc', 'jü%2540bä.cc',
      '1@2.34', 'ä@ö.ü', 'ä@ö.üß-x@y.zz',
      // Seit Runde 1: die Bytes in der Domain ebenfalls mehrfach kodiert (%25C3 …).
      'j%25C3%25BCrgen%2540b%25C3%25A4ckerei.example', 'kundin%2540b%25C3%25A4ckerei.example',
      '/customers/kundin%2540b%25C3%25A4ckerei.example', 'kundin%252540b%2525C3%2525A4ckerei.example', 'a@b%25C3%25A4.cc',
      'a@b.%25C3%25A4%25C3%25B6', 'a%2540b.%2525C3', 'a%2540b%25C3', 'a%2540b%252540c.de', 'a%2540b%2525%25C3.de', 'a%40b%25.cc',
      'a%40b%2525.cc', 'a%40b%2589.cc', 'a%40b%2540.cc', 'a%40b%252E.cc', 'a@b%25C.cc', 'a@b%2525252525A4.cc',
    ]
    for (const text of faelle) expect(neu(text), text).toBe(referenz(text))
  })

  it('auf 5000 zufällig zusammengesetzten Texten (fester Startwert)', () => {
    // Aus Bruchstücken von Adressen: Gut die Hälfte der Texte trägt eine
    // Adresse, über ein Drittel mehrere, einige hundert aneinandergeklebt.
    // Seit Nr. 56 auch Umlaute, zerlegte Zeichen, ein Buchstabe außerhalb der
    // Grundebene und Kodierungen (%C3%BC, %2540, %25).
    const teile = [
      'a', 'Zz', 'kundin', '.', '-', '_', '+', '%', '%40', '%4', '@', ' ', 'de', 'com', ',', '(', 'b.c', 'xy.at', '@@', '..',
      'x@y.de', 'a%40b.at', '@b.cc', 'kundin@', 'ü', 'ß', 'É', 'ü', '𝒜', '%C3%BC', '%2540', '%25', 'bäck.at', 'jü@',
      // Seit Runde 1: mehrfach kodierte Bytes.
      '%25C3', '%2525A4', 'b%25C3%25A4.cc',
    ]
    let zustand = 47
    const zufall = (bis: number) => {
      zustand = (zustand * 48_271) % 2_147_483_647
      return zustand % bis
    }
    let mitAdresse = 0
    for (let i = 0; i < 5000; i++) {
      const text = Array.from({ length: 1 + zufall(25) }, () => teile[zufall(teile.length)]).join('')
      const erwartet = referenz(text)
      if (erwartet !== text) mitAdresse++
      expect(neu(text), text).toBe(erwartet)
    }
    expect(mitAdresse).toBeGreaterThan(2000)
  })
})

describe('Gegenproben', () => {
  it('Harmloses bleibt in allen neuen Feldern unverändert', () => {
    const harmlos = {
      tags: { bereich: 'admin', seite: 'hoefe', zweck: 'anmeldecode-anfordern-ip,anmeldecode-adresse', code: 'P1008' },
      extra: { farmId: 'cmuri7ryv000nkl7dnkc5bx72', zeit: '08:15:33', tag: '01.09.2026', plz: '4910', betrag: 1999, liste: [1, 'zwei', null] },
      contexts: { upload: { dateiTyp: 'image/heic', versuche: 1 } },
      breadcrumbs: [{ category: 'fetch', data: { method: 'GET', url: '/hoefe?seite=2', status_code: 200 } }],
    }
    const e = bereinigeEreignis(ereignis(structuredClone(harmlos)))
    expect(e.tags).toEqual(harmlos.tags)
    expect(e.extra).toEqual(harmlos.extra)
    expect(e.contexts).toEqual(harmlos.contexts)
    expect(e.breadcrumbs).toEqual(harmlos.breadcrumbs)
  })

  it('Uhrzeiten und Zeitstempel sind keine IPv6-Adressen, Versionen mit drei Stellen keine IPv4-Adressen', () => {
    const text = 'um 10:30:45 (2026-10-08T10:30:45.123Z), Node 22.22.2, Fehler:: weiter'
    expect(bereinigeEreignis(ereignis({ extra: { text } })).extra).toEqual({ text })
  })

  it('wirft nie bei verquerer Gestalt der neuen Felder — und lässt dabei nichts Heikles durch', () => {
    const verquer: object[] = [
      { tags: `kundin ${MAIL}` },
      { tags: [MAIL] },
      { extra: null },
      { logentry: { message: 42, params: `von ${IP4}` } },
      { logentry: { params: { 0: MAIL } } },
      { contexts: { kundin: null, liste: [IP4] } },
      { exception: { values: [{ stacktrace: 'frames' }, { stacktrace: { frames: { 0: { vars: { ip: IP4 } } } } }] } },
      { exception: { values: [{ stacktrace: { frames: [null, 'x', { vars: `ip ${IP4}` }] } }] } },
      { threads: { values: 'x' } },
      { threads: 'x' },
      { breadcrumbs: [{ data: { tief: { tiefer: { ip: IP4 } } } }] },
    ]
    for (const teil of verquer) {
      let ergebnis: unknown
      expect(() => (ergebnis = bereinigeEreignis(ereignis(teil))), JSON.stringify(teil)).not.toThrow()
      expect(JSON.stringify(ergebnis), JSON.stringify(teil)).not.toMatch(HEIKEL)
    }
  })

  it('wirft ein Getter in den neuen Feldern, geht nur das Minimalereignis raus', () => {
    const roh: Record<string, unknown> = { event_id: 'e3', level: 'error', message: `an ${MAIL}` }
    Object.defineProperty(roh, 'tags', {
      enumerable: true,
      get() {
        throw new Error('kaputt')
      },
    })
    const e = bereinigeEreignis(ereignis(roh))
    expect(e).toEqual({ event_id: 'e3', level: 'error', message: 'an [e-mail entfernt]', extra: { bereinigung: 'fehlgeschlagen' } })
  })
})

describe('Nr. 56 — die offenen Fälle aus Lauf 8 §6 (Bericht 47)', () => {
  const fehlertext = (wert: string) => bereinigeEreignis(ereignis({ exception: { values: [{ value: wert }] } })).exception?.values?.[0].value

  it('E-Mail mit Nicht-ASCII-Zeichen fällt ganz — Umlaut im Namen oder in der Domain, roh und kodiert', () => {
    // Vorher blieb bei einem Umlaut vor dem @ der Teil davor stehen („jü"), und
    // eine Domain mit Umlaut fiel gar nicht.
    expect(fehlertext('Nutzer jürgen.müller@example.com nicht gefunden')).toBe('Nutzer [e-mail entfernt] nicht gefunden')
    expect(fehlertext('Mail an kundin@bäckerei.example gescheitert')).toBe('Mail an [e-mail entfernt] gescheitert')
    expect(fehlertext('Größe@straße.example, José@example.com')).toBe('[e-mail entfernt], [e-mail entfernt]')
    // Zerlegt geschrieben (u + Trema) — so liefern manche Tastaturen den Umlaut.
    expect(fehlertext('an jürgen@example.com')).toBe('an [e-mail entfernt]')

    // In Adressen steht der Umlaut kodiert — mit kodiertem wie mit rohem @.
    const e = bereinigeEreignis(
      ereignis({
        request: { url: 'https://farmerzone.at/customers/j%C3%BCrgen%40b%C3%A4ckerei.example' },
        breadcrumbs: [{ data: { from: '/customers/kundin@m%C3%BCller.example', to: '/orders' } }],
        message: 'Abo für jürgen@bäckerei.example gescheitert',
        extra: { kundin: 'Jürgen <jürgen@bäckerei.example>' },
      })
    )
    expect(e.request?.url).toBe('https://farmerzone.at/customers/[e-mail entfernt]')
    expect(e.breadcrumbs?.[0].data?.from).toBe('/customers/[e-mail entfernt]')
    expect(e.message).toBe('Abo für [e-mail entfernt] gescheitert')
    expect(e.extra).toEqual({ kundin: 'Jürgen <[e-mail entfernt]>' })
    expect(JSON.stringify(e)).not.toMatch(/rgen@|b%C3%A4ckerei|m%C3%BCller|bäckerei/)
  })

  it('doppelt kodierte Adressen (%2540) fallen — im Pfad, im Next-Kontext, in Texten und im Fehlertext', () => {
    // %2540: das % des %40 noch einmal kodiert, etwa in einer Weiterleitung,
    // die eine schon kodierte Adresse weiterträgt. Dreifach kodiert ebenso.
    const e = bereinigeEreignis(
      ereignis({
        request: { url: 'https://farmerzone.at/customers/kundin%2540example.com?ziel=%2Fcustomers%2Fanna%252540example.org' },
        contexts: { nextjs: { request_path: '/customers/kundin%2540example.com' } },
        extra: { weiter: 'Weiter zu kundin%252540example.com' },
        exception: { values: [{ value: 'Weiterleitung zu /customers/kundin%2540example.com gescheitert' }] },
      })
    )
    const [pfad, query] = (e.request?.url ?? '').split('?')
    expect(pfad).toBe('https://farmerzone.at/customers/[e-mail entfernt]')
    expect(new URLSearchParams(query).get('ziel')).toBe('/customers/[e-mail entfernt]')
    expect(e.contexts?.nextjs).toEqual({ request_path: '/customers/[e-mail entfernt]' })
    expect(e.extra).toEqual({ weiter: 'Weiter zu [e-mail entfernt]' })
    expect(e.exception?.values?.[0].value).toBe('Weiterleitung zu /customers/[e-mail entfernt] gescheitert')
    expect(JSON.stringify(e)).not.toMatch(/kundin|anna/)
  })

  it('ein Token in einer relativen Adresse im Fehlertext fällt — als Parameter und als Pfadteil; die IP bleibt', () => {
    // Vorher blieb „Link /reset-password?token=…" im Fehlertext stehen (Bericht 47).
    expect(fehlertext('Link /reset-password?token=abc123 an kundin@example.com')).toBe('Link /reset-password an [e-mail entfernt]')
    expect(fehlertext('Bestätigung /hof-test/bestaetigen/kurz-123 abgelaufen')).toBe('Bestätigung /hof-test/bestaetigen/[kennung entfernt] abgelaufen')
    expect(fehlertext(`Abruf von "/api/orders/confirm/${TOKEN}?s=sig-123" gescheitert`)).toBe(
      'Abruf von "/api/orders/confirm/[kennung entfernt]" gescheitert'
    )
    expect(fehlertext('Weiterleitung (/account/unsubscribe?token=geheim-123&seite=2) verweigert')).toBe(
      'Weiterleitung (/account/unsubscribe?seite=2) verweigert'
    )
    // Dieselbe Regel für absolute Adressen, „token=…" und „Bearer …" — wie im Freitext.
    expect(fehlertext('GET https://farmerzone.at/account/neuigkeiten-bestaetigen?token=geheim-123 failed')).toBe(
      'GET https://farmerzone.at/account/neuigkeiten-bestaetigen failed'
    )
    expect(fehlertext('Abmeldung mit token=geheim-123 und Bearer geheim-123 abgelehnt')).toBe('Abmeldung mit token=[entfernt] und Bearer [entfernt] abgelehnt')
    // Ein schon ersetzter Code bleibt lesbar, auch im Freitext (vorher „otp: [entfernt] entfernt]").
    expect(fehlertext('otp: 905173 abgelehnt')).toBe('otp: [code entfernt] abgelehnt')
    expect(bereinigeEreignis(ereignis({ message: 'otp: 905173 abgelehnt' })).message).toBe('otp: [code entfernt] abgelehnt')
    // Die Adresse des Datenbank-Servers bleibt im Fehlertext (Nr. 37).
    expect(fehlertext(`connect ETIMEDOUT ${IP4}:6543`)).toBe(`connect ETIMEDOUT ${IP4}:6543`)

    // Auch das Minimalereignis bereinigt seinen Fehlertext mit dieser Regel:
    // Die Nachricht hat nur einen Getter, schon ihr Zurückschreiben — der
    // erste Schritt — wirft, der Fehlertext ist dann noch roh.
    const roh: Record<string, unknown> = { event_id: 'e5', level: 'error', exception: { values: [{ type: 'Error', value: 'Link /reset-password?token=abc123' }] } }
    Object.defineProperty(roh, 'message', { enumerable: true, get: () => 'kaputt' })
    expect(bereinigeEreignis(ereignis(roh)).exception?.values?.[0].value).toBe('Link /reset-password')
  })

  it('ohneAnfrage: ein Ereignis ohne Anfrage und Brotkrumen, der Rest bleibt (Fehleranzeige auf /hoefe)', () => {
    const e = ohneAnfrage(
      ereignis({
        message: 'Öffentliche Hofliste: Fehleranzeige ausgeliefert',
        level: 'warning',
        tags: { sichtbar: 'ja' },
        request: { url: 'https://farmerzone.at/hoefe?q=Musterhof', query_string: 'q=Musterhof', headers: { referer: 'https://farmerzone.at/hoefe?q=Bio' } },
        breadcrumbs: [{ category: 'navigation', data: { to: '/hoefe?q=Musterhof' } }],
      })
    )
    expect(e).toEqual({ message: 'Öffentliche Hofliste: Fehleranzeige ausgeliefert', level: 'warning', tags: { sichtbar: 'ja' } })
  })

  it('Gegenprobe: Harmloses mit Umlauten, Schrägstrichen und Kennungen bleibt', () => {
    for (const text of [
      'Größe 5 kg für Bäckerei Müller, 50 % Rabatt, 3 / 4 und/oder 1/2',
      'Fehler beim Laden von /hoefe?seite=2&kat=EIER',
      'Route /[farmSlug]/hoefe nutzt searchParams',
      "ENOENT: no such file or directory, open '/var/task/.next/server/app/page.js'",
      'Paket next@16.2.6 und @sentry/nextjs, Grüße @Hof-Team, jürgen@localhost',
      // Lange Kennungen ohne Adresse bleiben im Fehlertext — etwa die einer Server Action.
      'Failed to find Server Action "7fa3c9b1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8". This request might be from an older or newer deployment.',
      'Rabatt 50%2540 Stück, Code 25%40',
      `connect ETIMEDOUT ${IP4}:6543`,
    ]) {
      expect(fehlertext(text), text).toBe(text)
    }
    const harmlos = { notiz: 'Größe 5 kg für Bäckerei Müller, Grüße aus Österreich', pfad: '/hoefe/gemüse' }
    expect(bereinigeEreignis(ereignis({ extra: structuredClone(harmlos) })).extra).toEqual(harmlos)
  })
})

describe('Nr. 56, Nachbesserung Runde 1 — Befunde der Prüfung', () => {
  const fehlertext = (wert: string) => bereinigeEreignis(ereignis({ exception: { values: [{ value: wert }] } })).exception?.values?.[0].value
  const nachricht = (wert: string) => bereinigeEreignis(ereignis({ message: wert })).message

  it('Umlaut-Domain doppelt und dreifach kodiert fällt — in Text, Adresse und Nachricht, im vollen und im Minimalereignis', () => {
    // Vorher blieb die ganze Adresse stehen: In der Domain galten nur einfach
    // kodierte Bytes (%C3), nicht %25C3 — so steht ein Umlaut, wenn eine
    // Weiterleitung die schon kodierte Adresse noch einmal kodiert.
    const DOPPELT = 'j%25C3%25BCrgen%2540b%25C3%25A4ckerei.example'
    const DREIFACH = 'kundin%252540b%2525C3%2525A4ckerei.example'
    for (const adresse of [DOPPELT, DREIFACH, 'kundin%2540b%25C3%25A4ckerei.example', 'kundin@b%25C3%25A4ckerei.example', 'kundin%2540beispiel.%25C3%25A4%25C3%25B6']) {
      const e = bereinigeEreignis(
        ereignis({
          exception: { values: [{ type: 'Error', value: `Mail an ${adresse} gescheitert, Pfad /customers/${adresse}` }] },
          message: `Abo für ${adresse} gescheitert`,
          extra: { text: `an ${adresse}` },
          request: { url: `https://farmerzone.at/customers/${adresse}` },
          breadcrumbs: [{ data: { from: `/customers/${adresse}` } }],
          contexts: { nextjs: { request_path: `/customers/${adresse}` } },
        })
      )
      expect(e.exception?.values?.[0].value, adresse).toBe('Mail an [e-mail entfernt] gescheitert, Pfad /customers/[e-mail entfernt]')
      expect(e.message, adresse).toBe('Abo für [e-mail entfernt] gescheitert')
      expect(e.extra, adresse).toEqual({ text: 'an [e-mail entfernt]' })
      expect(e.request?.url, adresse).toBe('https://farmerzone.at/customers/[e-mail entfernt]')
      expect(e.breadcrumbs?.[0].data?.from, adresse).toBe('/customers/[e-mail entfernt]')
      expect(e.contexts?.nextjs, adresse).toEqual({ request_path: '/customers/[e-mail entfernt]' })
      expect(JSON.stringify(e), adresse).not.toMatch(/ckerei|kundin|rgen|beispiel/)
    }

    // Minimalereignis: Die Nachricht hat nur einen Getter, schon ihr
    // Zurückschreiben wirft; Nachricht und Fehlertext bereinigt dann minimalEreignis.
    const roh: Record<string, unknown> = { event_id: 'e6', level: 'error', exception: { values: [{ type: 'Error', value: `Mail an ${DOPPELT}` }] } }
    Object.defineProperty(roh, 'message', { enumerable: true, get: () => `Abo für ${DREIFACH}` })
    expect(bereinigeEreignis(ereignis(roh))).toEqual({
      event_id: 'e6',
      level: 'error',
      message: 'Abo für [e-mail entfernt]',
      exception: { values: [{ type: 'Error', value: 'Mail an [e-mail entfernt]' }] },
      extra: { bereinigung: 'fehlgeschlagen' },
    })

    // Gegenprobe: ohne Domain samt Endung keine Adresse.
    for (const text of ['Rabatt 50%2540 Stück', 'Code 25%2540, 30%25C3 Rabatt', 'Anteil 5%25 von 100%25C3']) {
      expect(fehlertext(text), text).toBe(text)
      expect(nachricht(text), text).toBe(text)
    }
  })
  it('eine Adresse in einem Abfragewert oder im Anker verliert ihren Token — roh, kodiert und absolut, auch als ganze Nachricht', () => {
    // Vorher kodierte die URL-Regel den Wert nur neu, und der Token blieb
    // kodiert stehen (next=%2Freset-password%3Ftoken%3Dabc123); im Anker blieb
    // er, wenn die ganze Nachricht die Adresse war.
    const faelle: [string, string][] = [
      ['/login?next=/reset-password?token=abc123', '/login?next=%2Freset-password'],
      ['/login?next=%2Freset-password%3Ftoken%3Dabc123', '/login?next=%2Freset-password'],
      ['/login?next=/reset-password?token=abc123&seite=2', '/login?next=%2Freset-password&seite=2'],
      ['/login?callbackUrl=https://farmerzone.at/reset-password?token=abc123', '/login?callbackUrl=https%3A%2F%2Ffarmerzone.at%2Freset-password'],
      ['/login?next=/api/orders/confirm/abc123', '/login?next=%2Fapi%2Forders%2Fconfirm%2F%5Bkennung+entfernt%5D'],
      ['/login?next=/x/token=abc123', '/login?next=%2Fx%2Ftoken%3D%5Bentfernt%5D'],
      ['/x?info=Bearer%20abc123', '/x?info=Bearer+%5Bentfernt%5D'],
      ['/x?a=1#token=abc123', '/x?a=1'],
      ['/x#a=1&token=abc123', '/x#a=1'],
      ['/reset-password#token=abc123', '/reset-password'],
      ['/x#next=/reset-password?token=abc123', '/x#next=%2Freset-password'],
      // Gegenproben: ein Anker ohne „=", ein Wert ohne Adresse, eine harmlose Adresse im Wert.
      ['/hoefe#karte', '/hoefe#karte'],
      ['/hoefe?seite=2&kat=EIER', '/hoefe?seite=2&kat=EIER'],
      ['/login?callbackUrl=%2Fhof%2Fbestellungen', '/login?callbackUrl=%2Fhof%2Fbestellungen'],
    ]
    for (const [roh, sauber] of faelle) {
      expect(fehlertext(`Fehler bei ${roh} gemeldet`), roh).toBe(`Fehler bei ${sauber} gemeldet`)
      expect(nachricht(roh), roh).toBe(sauber)
      const e = bereinigeEreignis(
        ereignis({
          request: { url: `https://farmerzone.at${roh}`, headers: { Referer: `https://farmerzone.at${roh}` } },
          breadcrumbs: [{ category: 'navigation', data: { from: roh } }],
        })
      )
      expect(e.request?.url, roh).toBe(`https://farmerzone.at${sauber}`)
      expect(e.request?.headers?.Referer, roh).toBe(`https://farmerzone.at${sauber}`)
      expect(e.breadcrumbs?.[0].data?.from, roh).toBe(sauber)
    }
    // Abfrage für sich: request.query_string, Span-Daten und Texte unter Query-Schlüsseln.
    const e = bereinigeEreignis(
      ereignis({
        request: { query_string: 'next=%2Freset-password%3Ftoken%3Dabc123' },
        extra: { 'http.query': 'next=/reset-password?token=abc123&seite=2' },
        contexts: { trace: { data: { 'url.query': 'next=%2Freset-password%3Ftoken%3Dabc123' } } },
      })
    )
    expect(e.request?.query_string).toBe('next=%2Freset-password')
    expect(e.extra).toEqual({ 'http.query': 'next=%2Freset-password&seite=2' })
    expect(e.contexts?.trace?.data).toEqual({ 'url.query': 'next=%2Freset-password' })
    // Verschachtelt nur bis zu einer Tiefe — noch tiefer fällt der Wert ganz.
    expect(fehlertext('/a?x=/b?y=/c?z=/d?w=/e?token=abc123')).not.toMatch(/abc123/)
    let tief = fehlertext('/a?x=/b?y=/c?z=/d?w=/e') ?? ''
    for (let i = 0; i < 4; i++) tief = decodeURIComponent(tief.replace(/\+/g, ' '))
    expect(tief).toBe('/a?x=/b?y=/c?z=/d?w=[adresse entfernt]')
  })
})
