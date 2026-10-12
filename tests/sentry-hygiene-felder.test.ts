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
    ['halbe Platzhalter nach token=', { exception: { values: [{ value: 'token=[code entfernt '.repeat(N / 4) }] } }],
    ['Schrägstriche nach Doppelpunkt im Fehlertext', { exception: { values: [{ value: ':/'.repeat(N) }] } }],
    ['Schrägstriche nach Umlauten im Fehlertext', { exception: { values: [{ value: 'ä/'.repeat(N) }] } }],
    ['viele Adressen nach Anführungszeichen im Fehlertext', { exception: { values: [{ value: '«/'.repeat(N / 10) }] } }],
    ['viele harmlose Schlüssel', { message: 'a=b '.repeat(N / 2) }],
    ['langer Schlüssel mit Trennern', { exception: { values: [{ value: 'a_'.repeat(N) + '=x' }] } }],
    ['camelCase-Schlüssel ohne Wert', { exception: { values: [{ value: 'aToken'.repeat(N / 3) + ':' }] } }],
    ['token= ohne Wert', { extra: { text: 'token=' + ' '.repeat(2 * N) + '&' } }],
    ['Schlüssel mit Anführungszeichen ohne Wert', { exception: { values: [{ value: 'token: "'.repeat(N / 4) }] } }],
    ['Ziffernfolge zwischen Buchstaben', { exception: { values: [{ value: 'x' + '0'.repeat(2 * N) + 'a' }] } }],
    ['viele Kennungen mit Ziffernfolgen', { exception: { values: [{ value: 'x0123456789a '.repeat(N / 6) }] } }],
    // Nr. 56, Runde 2.
    ['Prozent-Escapes vor Ziffern', { exception: { values: [{ value: '%200'.repeat(N / 2) }] } }],
    ['mehrfach kodierte Abfragewerte', { request: { url: 'https://farmerzone.at/?' + 'a=%252F%253Fb%253D1&'.repeat(N / 20) } }],
    ['ungültige Bytes im Abfragewert', { request: { url: 'https://farmerzone.at/?a=' + '%25C3'.repeat(N) } }],
    ['%25-Kette im Abfragewert', { request: { url: 'https://farmerzone.at/?a=%' + '25'.repeat(N) + '41' } }],
    ['Schlüssel nach Prozent-Escapes', { exception: { values: [{ value: '%20a='.repeat(N / 5) }] } }],
    ['kodierte Anker verschachtelt', { request: { url: 'https://farmerzone.at/#' + 'a%3D%2F%23'.repeat(N / 10) } }],
    ['viele relative Adressen als Nachricht', { message: ' /a?b=1'.repeat(N / 10) }],
    ['Schrägstriche nach Doppelpunkt in extra', { extra: { text: ':/'.repeat(N) } }],
    ['viele Zuweisungen im Pfad', { request: { url: 'https://farmerzone.at/' + 'a=b/'.repeat(N / 2) } }],
    ['token= im Pfad', { request: { url: 'https://farmerzone.at/' + 'token=a/'.repeat(N / 4) } }],
    // Nr. 56, Nacharbeit nach der Nachprüfung von Runde 2.
    ['lange Folge aus 25 als Nachricht', { message: '25'.repeat(N) }],
    ['%25-Ketten vor Nummern', { exception: { values: [{ value: ('%' + '25'.repeat(500) + '200664 1234567 ').repeat(N / 500) }] } }],
    ['viele kodierte Plus in einer Adresse als Abfragewert', { request: { url: 'https://farmerzone.at/?next=%2Fx%3Fa%3D' + '%252B'.repeat(N) } }],
    // Mit Leerraum davor, sonst gilt die ganze Nachricht als eine Adresse und das Muster läuft nicht.
    ['lange absolute Adresse mit Klammern als Nachricht', { message: 'Link https://farmerzone.at/x?' + 'f[a]=(1)&'.repeat(N / 10) }],
    ['relative Adressen vor absoluten als Nachricht', { message: ' /a?u=https://x.example/b?f[a]=1'.repeat(N / 20) }],
    ['lange Folge aus Schrägstrichen und http als Nachricht', { message: 'x /' + 'http/'.repeat(N / 3) }],
    ['viele Plus-Nummern-Anfänge in einer Abfrage', { request: { url: 'https://farmerzone.at/?' + 'a=+0&'.repeat(N / 5) } }],
    ['viele @ in einer Abfrage', { request: { url: 'https://farmerzone.at/?q=' + 'a@'.repeat(N) } }],
    // Nacharbeit nach Runde 2: Werte hinter Leerraum vorab.
    ['viele Codes mit Bindestrich als Nachricht', { message: 'code-123456,'.repeat(N / 4) }],
    ['viele Codes in einer Abfrage als Nachricht', { message: 'Abruf https://farmerzone.at/x?' + 'otp=123456&'.repeat(N / 4) }],
    ['viele Codes hinter Leerraum im Fehlertext', { exception: { values: [{ value: 'otp: 123456 '.repeat(N / 4) }] } }],
    ['viele Werte mit Adresse als Nachricht', { message: 'token: (/x?a=1&s=b) '.repeat(N / 8) }],
    ['Bearer vor langen Wörtern mit Schrägstrichen', { exception: { values: [{ value: ('Bearer ' + 'a/'.repeat(N / 10) + ' ').repeat(5) }] } }],
    ['viele Bearer mit Adresse in extra', { extra: { text: 'Bearer /x?s=1 '.repeat(N / 6) } }],
    ['Wert vor einem Wort aus vielen Schlüsseln', { message: 'token: /' + ',token:a'.repeat(N / 4) }],
    ['Wert aus einer langen Nummer', { message: 'token: 0' + '1 '.repeat(N) }],
    ['viele Paare im Pfad', { request: { url: 'https://farmerzone.at/x' + '&s=1&a=2'.repeat(N / 4) } }],
    ['viele Werte mit Ziffern dahinter', { message: ('token: a1 ' + '1 '.repeat(50)).repeat(N / 100) }],
    ['viele Adressen mit Nummern dahinter im Fehlertext', { exception: { values: [{ value: ' /a?s=0664 1234567'.repeat(N / 20) }] } }],
    ['Bearer vor einer langen E-Mail-Adresse', { message: 'Bearer kundin@' + 'a'.repeat(2 * N) }],
    ['viele Codes nach Schrägstrich', { message: 'code /123456?s=1 '.repeat(N / 10) }],
    ['viele Werte mit Adresse in den Ziffern dahinter', { extra: { text: 'token: a1 (/1?s=2 '.repeat(N / 10) } }],
    ['Kette aus Nummern und Adressen hinter einem Wert', { message: 'token: x1' + ' 0664 1234567/x?s=0'.repeat(N / 10) }],
    ['viele Werte mit kurzer Kette', { exception: { values: [{ value: 'token: x1 0664 1234567/x '.repeat(N / 15) }] } }],
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
  it('die Zuweisungs-Regel verschont nur eigene Platzhalter — ein Wert in eckigen Klammern fällt', () => {
    // Vorher verschonte sie jeden Wert, der mit „[" beginnt.
    expect(fehlertext('token=[abc123] password=[geheim]')).toBe('token=[entfernt] password=[entfernt]')
    expect(nachricht('token=[abc123] password=[geheim]')).toBe('token=[entfernt] password=[entfernt]')
    expect(bereinigeEreignis(ereignis({ extra: { text: 'secret: [abc123]' } })).extra).toEqual({ text: 'secret: [entfernt]' })
    // Ein eigener Platzhalter als ganzer Wert bleibt einfach stehen …
    expect(fehlertext('otp: 905173 abgelehnt')).toBe('otp: [code entfernt] abgelehnt')
    expect(nachricht('Passwort: kundin@example.com, token=[entfernt]')).toBe('Passwort: [e-mail entfernt], token=[entfernt]')
    // … hängt etwas daran, fällt der ganze Wert.
    expect(fehlertext('otp: 905173-abc abgelehnt')).toBe('otp: [entfernt] abgelehnt')
  })
  it('Adressen im Fehlertext auch nach Doppelpunkt, Komma, Semikolon, Klammer und typografischen Anführungszeichen — und mit HTTPS in Großbuchstaben', () => {
    // Vorher galt eine relative Adresse nur am Anfang oder nach Leerraum,
    // Klammer, Anführungszeichen und „=", eine absolute nur klein geschrieben.
    const faelle: [string, string][] = [
      ['Fehler bei:/api/orders/confirm/abc123', 'Fehler bei:/api/orders/confirm/[kennung entfernt]'],
      ['Fehler,/api/orders/confirm/abc123', 'Fehler,/api/orders/confirm/[kennung entfernt]'],
      ['Fehler;/hof-test/bestaetigen/abc123', 'Fehler;/hof-test/bestaetigen/[kennung entfernt]'],
      ['Daten {/api/orders/confirm/abc123 }', 'Daten {/api/orders/confirm/[kennung entfernt] }'],
      ['url „/account/unsubscribe?token=geheim-123“', 'url „/account/unsubscribe“'],
      ['url «/account/unsubscribe?token=geheim-123»', 'url «/account/unsubscribe»'],
      ['url:/account/unsubscribe?token=geheim-123&seite=2', 'url:/account/unsubscribe?seite=2'],
      ['GET HTTPS://FARMERZONE.AT/api/orders/confirm/abc123 failed', 'GET HTTPS://FARMERZONE.AT/api/orders/confirm/[kennung entfernt] failed'],
      ['GET Https://farmerzone.at/reset-password?token=abc123', 'GET Https://farmerzone.at/reset-password'],
    ]
    for (const [roh, sauber] of faelle) expect(fehlertext(roh), roh).toBe(sauber)
    // In Nachrichten gilt die Adress-Regel für absolute Adressen im Text — jetzt auch groß geschrieben.
    expect(nachricht('GET HTTPS://FARMERZONE.AT/api/orders/confirm/abc123 failed')).toBe(
      'GET HTTPS://FARMERZONE.AT/api/orders/confirm/[kennung entfernt] failed'
    )
    // Gegenproben: Ein Schrägstrich nach Buchstabe oder Ziffer (jeder Schrift) beginnt keine Adresse.
    for (const text of ['und/oder, 3/4 und 1/2', 'Maß/abcdefghijklmnopqrstuvwxyz', 'localhost:3000/api/orders/confirm/x', 'v1.2/beta', 'Gewicht 50%/Jahr']) {
      expect(fehlertext(text), text).toBe(text)
    }
  })
  it('die Zuweisungs-Regel erkennt Schlüssel mit Vorsilbe — access_token, resetToken, reset_token, x-api-key —, aber kein Wort, das nur so anfängt oder endet', () => {
    // Vorher verlangte sie eine Wortgrenze vor dem Schlüsselwort; „_" und ein
    // Großbuchstabe mitten im Schlüssel sind keine.
    const roh = 'Abmeldung access_token=abc123 resetToken=abc123 reset_token=abc123 X-Api-Key: abc123 APIKey=abc123 client_secret=abc123'
    const sauber =
      'Abmeldung access_token=[entfernt] resetToken=[entfernt] reset_token=[entfernt] X-Api-Key: [entfernt] APIKey=[entfernt] client_secret=[entfernt]'
    expect(fehlertext(roh)).toBe(sauber)
    expect(nachricht(roh)).toBe(sauber)
    expect(bereinigeEreignis(ereignis({ extra: { text: roh } })).extra).toEqual({ text: sauber })
    expect(fehlertext('Abruf /x?info=access_token%3Dabc123 gescheitert')).toBe('Abruf /x?info=access_token%3D%5Bentfernt%5D gescheitert')
    // Gegenproben: Wörter, die mit einem Schlüsselwort anfangen oder enden, und Fehlercodes.
    for (const text of ['tokenizer=abc123', 'Tokens: 5', 'Apfelessig: 2 Liter', 'Signaturen: 3', 'otpCount5 bleibt', 'code=P2002', 'Rabattcode: SOMMER']) {
      expect(fehlertext(text), text).toBe(text)
      expect(nachricht(text), text).toBe(text)
    }
  })
  it('ein Wert in Anführungszeichen fällt ebenso — Prisma-Meldung token: "…", JSON "access_token":"…"', () => {
    // Vorher blieb er stehen: Das Anführungszeichen beendete den Wert, bevor
    // er anfing. Im Fehlertext gilt die Regel für lange Kennungen bewusst
    // nicht (Server-Action-Kennungen, Chunk-Namen) — hier fällt der Wert über
    // seinen Schlüssel, gleich aus welchen Zeichen er besteht.
    const HEX = '3fa85f6457174562b3fc2c963f66afa63fa85f6457174562b3fc2c963f66afa6'
    expect(fehlertext(`Invalid prisma.session.findFirst() invocation: { where: { token: "${TOKEN}" } }`)).toBe(
      'Invalid prisma.session.findFirst() invocation: { where: { token: "[entfernt]" } }'
    )
    expect(fehlertext(`Ungültiger Token: "${HEX}"`)).toBe('Ungültiger Token: "[entfernt]"')
    expect(fehlertext('Antwort {"access_token":"abc123","expires_in":3600}')).toBe('Antwort {"access_token":"[entfernt]","expires_in":3600}')
    expect(fehlertext("secret='abc123' und 'password': 'geheim'")).toBe("secret='[entfernt]' und 'password': '[entfernt]'")
    expect(nachricht('token: "abc123"')).toBe('token: "[entfernt]"')
    // Gegenproben: Prisma nennt Felder in Backticks, die Meldung bleibt lesbar; ein Platzhalter bleibt einfach.
    for (const text of ['Argument `token`: Invalid value provided. Expected String, provided Int.', 'Fehler: "Bestellung fehlt"', 'token: "[entfernt]"']) {
      expect(fehlertext(text), text).toBe(text)
    }
  })
  it('die Telefon-Regel setzt nicht mitten in Zahlen und Kennungen an — Zeitstempel und cuid bleiben, echte Nummern fallen', () => {
    // Vorher hatte sie links keine Grenze: „2026-10-10 20:02:00" wurde zu
    // „2[telefon entfernt]:02:00", eine cuid mit „0" und acht Ziffern zerbrach.
    for (const text of ['Zeit 2026-10-10 20:02:00', 'Kennung clx0123456789abcdefghijklmn']) {
      expect(fehlertext(text), text).toBe(text)
      expect(nachricht(text), text).toBe(text)
    }
    // Eine UUID bleibt im Fehlertext ganz (in der Nachricht fällt sie als lange Kennung, wie bisher).
    expect(fehlertext('Anfrage 550e8400-e29b-41d4-a716-0123456789ab')).toBe('Anfrage 550e8400-e29b-41d4-a716-0123456789ab')
    // In einer Adresse fällt die cuid als langes Pfadsegment (URL-Regel), nicht zerbrochen als Nummer.
    expect(fehlertext('Fehler /api/farms/clx0123456789abcdefghijklmn/products')).toBe('Fehler /api/farms/[kennung entfernt]/products')
    const nummern: [string, string][] = [
      ['Rückruf +43 664 123 4567', 'Rückruf [telefon entfernt]'],
      ['Tel.:0664/1234567', 'Tel.:[telefon entfernt]'],
      ['unter (0664) 1234567 erreichbar', 'unter [telefon entfernt] erreichbar'],
      ['Nummer:+436641234567', 'Nummer:[telefon entfernt]'],
      ['Abruf /customers/06641234567', 'Abruf /customers/[telefon entfernt]'],
      // Auch direkt an einem Wort — nur eine Ziffernfolge, die auf BEIDEN Seiten an Buchstaben klebt, ist eine Kennung.
      ['Rückruf-0664 1234567', 'Rückruf-[telefon entfernt]'],
      ['Tel0664 1234567', 'Tel[telefon entfernt]'],
      ['tel_06641234567', 'tel_[telefon entfernt]'],
      ['Tel+43 664 1234567', 'Tel[telefon entfernt]'],
    ]
    for (const [roh, sauber] of nummern) {
      expect(fehlertext(roh), roh).toBe(sauber)
      expect(nachricht(roh), roh).toBe(sauber)
    }
  })
})

describe('Nr. 56, Nachbesserung Runde 2 — Befunde der Nachprüfung', () => {
  const fehlertext = (wert: string) => bereinigeEreignis(ereignis({ exception: { values: [{ value: wert }] } })).exception?.values?.[0].value
  const nachricht = (wert: string) => bereinigeEreignis(ereignis({ message: wert })).message
  const adresse = (pfad: string) => bereinigeEreignis(ereignis({ request: { url: `https://farmerzone.at${pfad}` } })).request?.url
  const extraText = (wert: string) => (bereinigeEreignis(ereignis({ extra: { text: wert } })).extra as { text?: string } | undefined)?.text

  it('eine Nummer direkt nach einem Prozent-Escape fällt (%20, %22, %27, %28) — in Pfad, Fehlertext, Nachricht und extra', () => {
    // Runde 1 zählte nur „keine Ziffer davor"; „%20" endet auf eine Ziffer,
    // und die Nummer dahinter ging roh an Sentry.
    const faelle: [string, string][] = [
      ['/kontakt/Ruf%2006641234567', '/kontakt/Ruf%20[telefon entfernt]'],
      ['name=Max%20Muster&tel=%2006641234567', 'name=Max%20Muster&tel=%20[telefon entfernt]'],
      ['Ruf%220664 1234567%22', 'Ruf%22[telefon entfernt]%22'],
      ['Ruf%270664/1234567%27', 'Ruf%27[telefon entfernt]%27'],
      ['Ruf%28(0664) 1234567', 'Ruf%28[telefon entfernt]'],
    ]
    for (const [roh, sauber] of faelle) {
      expect(fehlertext(roh), roh).toBe(sauber)
      expect(nachricht(roh), roh).toBe(sauber)
      expect(extraText(roh), roh).toBe(sauber)
    }
    expect(adresse('/kontakt/Ruf%2006641234567')).toBe('https://farmerzone.at/kontakt/Ruf%20[telefon entfernt]')
    // Gegenproben: Zeitstempel, cuid und UUID bleiben, auch nach einem Escape.
    for (const text of ['Zeit%202026-10-10%2020:02:00', 'Kennung%20clx0123456789abcdefghijklmn', 'Anfrage%20550e8400-e29b-41d4-a716-0123456789ab']) {
      expect(fehlertext(text), text).toBe(text)
    }
  })
  it('ein mehrfach kodierter Abfragewert verliert seinen Token — Adresse, Schema, Zuweisung; in Adresse, Fehlertext und Nachricht', () => {
    // Runde 1 sah nur die einmal dekodierte Form: „%2Freset-password%3Ftoken…"
    // beginnt nicht mit „/", „token%3D…" ist keine Zuweisung.
    const faelle: [string, string][] = [
      ['/login?next=%252Freset-password%253Ftoken%253Dabc123', '/login?next=%2Freset-password'],
      ['/login?next=https%253A%252F%252Fx.example%252Freset%253Ftoken%253Dabc123', '/login?next=https%3A%2F%2Fx.example%2Freset'],
      ['/login?next=/reset-password%253Ftoken%253Dabc123', '/login?next=%2Freset-password'],
      ['/login?info=token%253Dabc123', '/login?info=token%3D%5Bentfernt%5D'],
      // Dreifach kodiert, und fehlertolerant: Ein ungültiges Escape (%C3 allein) bleibt, der Rest wird dekodiert.
      ['/login?next=%25252Freset%25253Ftoken%25253Dabc123', '/login?next=%2Freset'],
      ['/login?next=%252Freset%253Ftoken%253Dabc%25C3', '/login?next=%2Freset'],
      ['/login?info=token%253D%25C3abc123', '/login?info=token%3D%5Bentfernt%5D'],
    ]
    for (const [roh, sauber] of faelle) {
      expect(adresse(roh), roh).toBe(`https://farmerzone.at${sauber}`)
      expect(fehlertext(`Fehler bei ${roh} gemeldet`), roh).toBe(`Fehler bei ${sauber} gemeldet`)
      expect(nachricht(roh), roh).toBe(sauber)
    }
    // Ebenso als Text unter einem Query-Schlüssel.
    expect(bereinigeEreignis(ereignis({ extra: { 'http.query': 'next=%252Freset-password%253Ftoken%253Dabc123' } })).extra).toEqual({
      'http.query': 'next=%2Freset-password',
    })
    // Gegenprobe: ein harmloser Wert bleibt.
    expect(adresse('/hoefe?q=100%25&seite=2')).toBe('https://farmerzone.at/hoefe?q=100%25&seite=2')
  })
  it('kodierte Trenner: Ein Escape vor dem Schlüssel ist eine Grenze, ein kodiertes „=" im Anker zählt wie ein rohes', () => {
    // Vorher wurde der Schlüssel zu „20token" bzw. „23token", und „#token%3D…"
    // galt ohne rohes „=" als Pfad.
    for (const [roh, sauber] of [
      ['Fehler%20token=abc123', 'Fehler%20token=[entfernt]'],
      ['Abruf /x%23token=abc123 gescheitert', 'Abruf /x%23token=[entfernt] gescheitert'],
      ['Wert%2Faccess_token:abc123', 'Wert%2Faccess_token:[entfernt]'],
    ]) {
      expect(fehlertext(roh), roh).toBe(sauber)
      expect(nachricht(roh), roh).toBe(sauber)
      expect(extraText(roh), roh).toBe(sauber)
    }
    for (const [roh, sauber] of [
      ['/x#token%3Dabc123', '/x'],
      ['/x#a%3D1%26token%3Dabc123', '/x#a=1'],
      ['/x#next%3D%2Fapi%2Forders%2Fconfirm%2Fabc123', '/x#next=%2Fapi%2Forders%2Fconfirm%2F%5Bkennung+entfernt%5D'],
    ]) {
      expect(adresse(roh), roh).toBe(`https://farmerzone.at${sauber}`)
      expect(fehlertext(`Fehler bei ${roh} gemeldet`), roh).toBe(`Fehler bei ${sauber} gemeldet`)
      expect(nachricht(roh), roh).toBe(sauber)
    }
    // Gegenproben: ein Prozentzeichen ohne Escape vor dem Schlüssel; ein Anker ohne „=", auch dekodiert.
    expect(fehlertext('100%token=abc123')).toBe('100%token=[entfernt]')
    expect(adresse('/hoefe#karte%20oben')).toBe('https://farmerzone.at/hoefe#karte%20oben')
    expect(fehlertext('Rabatt 50%20token')).toBe('Rabatt 50%20token')
  })
  it('Nachricht, Brotkrume und extra nehmen eingebettete relative Adressen wie der Fehlertext', () => {
    // Vorher galt dort die URL-Regel nur für absolute Adressen und für einen
    // Text, der ganz eine Adresse ist; eingebettet blieb der kodierte Token.
    const faelle: [string, string][] = [
      ['Fehler bei /login?next=%2Freset-password%3Ftoken%3Dabc123 gemeldet', 'Fehler bei /login?next=%2Freset-password gemeldet'],
      ['Error: NEXT_REDIRECT;replace;/login?next=%2Freset-password%3Ftoken%3Dabc123;307;', 'Error: NEXT_REDIRECT;replace;/login?next=%2Freset-password'],
      ['Abruf (/x?a=1#token=abc123) gescheitert', 'Abruf (/x?a=1) gescheitert'],
      ['Bestätigung „/hof-test/bestaetigen/kurz-123“ abgelaufen', 'Bestätigung „/hof-test/bestaetigen/[kennung entfernt]“ abgelaufen'],
    ]
    for (const [roh, sauber] of faelle) {
      const e = bereinigeEreignis(
        ereignis({ message: roh, extra: { text: roh }, breadcrumbs: [{ category: 'console', message: roh }], exception: { values: [{ value: roh }] } })
      )
      expect(e.message, roh).toBe(sauber)
      expect(e.extra, roh).toEqual({ text: sauber })
      expect(e.breadcrumbs?.[0].message, roh).toBe(sauber)
      expect(e.exception?.values?.[0].value, roh).toBe(sauber)
    }
    // Gegenproben wie im Fehlertext: „und/oder", Brüche, Pfade ohne Token; eine cuid ohne Adresse bleibt.
    for (const text of ['und/oder, 3/4 und 1/2', 'Fehler beim Laden von /hoefe?seite=2&kat=EIER', 'Kennung clx0123456789abcdefghijklmn']) {
      expect(nachricht(text), text).toBe(text)
    }
  })
  it('eine Zuweisung im Pfad einer Adresse fällt auch dort — request.url, ganze Nachricht, Brotkrume', () => {
    // Vorher prüfte die URL-Regel den Pfad nicht auf „token=…": „/x%23token=…"
    // (kodiertes #) oder „/x;token=…" blieben in der Adresse und in einem
    // Text, der ganz die Adresse ist.
    for (const [roh, sauber] of [
      ['/x%23token=abc123', '/x%23token=[entfernt]'],
      ['/x;token=abc123/weiter', '/x;token=[entfernt]'],
      ['/konto/access_token:abc123', '/konto/access_token:[entfernt]'],
    ]) {
      expect(adresse(roh), roh).toBe(`https://farmerzone.at${sauber}`)
      expect(nachricht(roh), roh).toBe(sauber)
      expect(bereinigeEreignis(ereignis({ breadcrumbs: [{ category: 'navigation', data: { to: roh } }] })).breadcrumbs?.[0].data?.to, roh).toBe(sauber)
    }
    // Gegenproben: Schema, Host und Port sind keine Zuweisung; ein harmloser Schlüssel im Pfad bleibt.
    expect(adresse('/hoefe/sorte=apfel')).toBe('https://farmerzone.at/hoefe/sorte=apfel')
    expect(bereinigeEreignis(ereignis({ request: { url: 'http://localhost:3000/hoefe' } })).request?.url).toBe('http://localhost:3000/hoefe')
  })
})

describe('Nr. 56, Nacharbeit des Dirigenten — Befunde der Nachprüfung von Runde 2', () => {
  const fehlertext = (wert: string) => bereinigeEreignis(ereignis({ exception: { values: [{ value: wert }] } })).exception?.values?.[0].value
  const nachricht = (wert: string) => bereinigeEreignis(ereignis({ message: wert })).message
  const adresse = (pfad: string) => bereinigeEreignis(ereignis({ request: { url: `https://farmerzone.at${pfad}` } })).request?.url
  const extraText = (wert: string) => (bereinigeEreignis(ereignis({ extra: { text: wert } })).extra as { text?: string } | undefined)?.text
  const brotkrume = (wert: string) => bereinigeEreignis(ereignis({ breadcrumbs: [{ category: 'console', message: wert }] })).breadcrumbs?.[0].message
  const spanAdresse = (url: string) =>
    (bereinigeEreignis(ereignis({ type: 'transaction', spans: [{ data: { 'url.full': url } }] })) as unknown as { spans: Array<{ data: Record<string, unknown> }> })
      .spans[0].data['url.full']

  it('ein „+" zählt in beiden Lesarten — roh als Plus, zerlegt als Leerzeichen; in Pfad, Anker, Abfrage und Bearer einer Adresse im Wert', () => {
    // Runde 2 dekodierte %2B zu einem rohen „+"; die Abfrage der inneren
    // Adresse las es als Leerzeichen, und „+43…" galt nicht mehr als Nummer.
    // Die erste Nacharbeit hielt %2B stehen — dann sah die Telefon-Regel im
    // Pfad und im Anker keine Nummer mehr. Jetzt liest die Abfrage beide Lesarten.
    const faelle: [string, string][] = [
      ['/login?next=%2Fx%3Ftel%3D%252B436641234567', '/login?next=%2Fx%3Ftel%3D%255Btelefon%2Bentfernt%255D'],
      ['/login?next=%2Fx%3Ftel%3D%2B436641234567', '/login?next=%2Fx%3Ftel%3D%255Btelefon%2Bentfernt%255D'],
      ['/login?next=%2Fkunden%2F%252B436641234567', '/login?next=%2Fkunden%2F%5Btelefon+entfernt%5D'],
      ['/login?next=%2Fx%23%252B436641234567', '/login?next=%2Fx%23%5Btelefon+entfernt%5D'],
      ['/login?next=https%3A%2F%2Ffarmerzone.at%2Fkunden%2F%252B436641234567', '/login?next=https%3A%2F%2Ffarmerzone.at%2Fkunden%2F%5Btelefon+entfernt%5D'],
      ['/login?next=%2Fx%3Fh%3DBearer%2520abc%252Bdef123', '/login?next=%2Fx%3Fh%3DBearer%2B%255Bentfernt%255D'],
      // Auch in der Abfrage der Adresse selbst: als Plus, als Leerzeichen und gemischt.
      ['/x?tel=+436641234567', '/x?tel=%5Btelefon+entfernt%5D'],
      ['/x?tel=0664+1234567', '/x?tel=%5Btelefon+entfernt%5D'],
      ['/x?tel=+43+664+1234567', '/x?tel=%5Btelefon+entfernt%5D'],
      ['/x?q=%22+436641234567', '/x?q=%22%5Btelefon+entfernt%5D'],
    ]
    for (const [roh, sauber] of faelle) {
      expect(adresse(roh), roh).toBe(`https://farmerzone.at${sauber}`)
      expect(spanAdresse(`https://farmerzone.at${roh}`), roh).toBe(`https://farmerzone.at${sauber}`)
      expect(nachricht(roh), roh).toBe(sauber)
      expect(bereinigeEreignis(ereignis({ breadcrumbs: [{ category: 'navigation', data: { to: roh } }] })).breadcrumbs?.[0].data?.to, roh).toBe(sauber)
    }
    expect(fehlertext('Fehler bei /login?next=%2Fx%3Ftel%3D%2B436641234567 gemeldet')).toBe(
      'Fehler bei /login?next=%2Fx%3Ftel%3D%255Btelefon%2Bentfernt%255D gemeldet'
    )
    expect(bereinigeEreignis(ereignis({ extra: { 'http.query': 'next=%2Fx%3Fq%3Da%2520b%26tel%3D%252B436641234567' } })).extra).toEqual({
      'http.query': 'next=%2Fx%3Fq%3Da+b%26tel%3D%5Btelefon+entfernt%5D',
    })
    // Eine Adresse mit „+" fällt ganz — als Abfragewert, einfach und doppelt kodiert, roh und im Anker.
    for (const pfad of [
      '/login?next=%2Fx%3Fq%3Dkundin%252Bshop%2540example.com',
      '/login?next=%2Fx%3Fq%3Dkundin%2Bshop%40example.com',
      '/x?mail=kundin+shop@example.com',
      '/x#q%3Dkundin%2Bshop%40example.com',
    ]) {
      const ergebnis = adresse(pfad) ?? ''
      expect(ergebnis, pfad).not.toMatch(/kundin|shop/)
      expect(ergebnis, pfad).toMatch(/e-mail/)
      expect(nachricht(pfad) ?? '', pfad).not.toMatch(/kundin|shop/)
    }
    // Gegenproben: Ein Leerzeichen bleibt ein Leerzeichen, ein Wert ohne Adresse wird ganz dekodiert,
    // eine kodierte Adresse nimmt den Pfad davor nicht mit.
    expect(adresse('/login?next=%2Fsuche%3Fq%3Dmax%2Bmuster')).toBe('https://farmerzone.at/login?next=%2Fsuche%3Fq%3Dmax%2Bmuster')
    expect(adresse('/hoefe?q=frische+eier&seite=2')).toBe('https://farmerzone.at/hoefe?q=frische+eier&seite=2')
    expect(adresse('/login?info=%252B436641234567')).toBe('https://farmerzone.at/login?info=%5Btelefon+entfernt%5D')
    expect(adresse('/x?ziel=%2Fkunden%2Fanna%2540example.org')).toBe('https://farmerzone.at/x?ziel=%2Fkunden%2F%5Be-mail+entfernt%5D')
    // Roh zählt ein „+" vorn nur mit freiem linken Rand als Nummer — auch nach Satzzeichen;
    // an einem Wort oder einer Zahl ist es ein Leerzeichen.
    for (const [roh, sauber] of [
      ['/go?to=tel:+436641234567', '/go?to=tel%3A%5Btelefon+entfernt%5D'],
      ['/x?q=Ruf,+436641234567', '/x?q=Ruf%2C%5Btelefon+entfernt%5D'],
      ['/x?q=(+43)6641234567', '/x?q=%28%5Btelefon+entfernt%5D'],
      ['/api/og?url=https://farmerzone.at/anruf/tel:+436641234567', '/api/og?url=https%3A%2F%2Ffarmerzone.at%2Fanruf%2Ftel%3A%5Btelefon+entfernt%5D'],
    ]) {
      expect(adresse(roh), roh).toBe(`https://farmerzone.at${sauber}`)
    }
    expect(adresse('/x?q=Artikel+12345678')).toBe('https://farmerzone.at/x?q=Artikel+12345678')
    expect(adresse('/x?q=12+345678901')).toBe('https://farmerzone.at/x?q=12+345678901')
    // Der Preis des freien Rands (sichere Richtung): nach einem Satzzeichen gilt ein „+" vor acht Ziffern als Nummer.
    expect(adresse('/x?q=Bestellnr.+12345678')).toBe('https://farmerzone.at/x?q=Bestellnr.%5Btelefon+entfernt%5D')
    expect(adresse('/x?q=a%0912345678')).toBe('https://farmerzone.at/x?q=a%0912345678')
    // Der Preis der rohen Lesart (sichere Richtung): Ein mit „+" angehängtes Wort zählt zur Adresse.
    expect(adresse('/x?q=Hallo+kundin@example.com')).toBe('https://farmerzone.at/x?q=%5Be-mail+entfernt%5D')
    // Ein heikler Name bleibt heikel, auch wenn die rohe Lesart ihn ersetzt hätte.
    expect(adresse('/x?token@example.com=abc123&seite=2')).toBe('https://farmerzone.at/x?seite=2')
  })

  it('ein doppelt kodiertes Escape links ist eine Grenze wie ein einfaches — in Pfad, Fehlertext, Nachricht und extra', () => {
    // Runde 2 zählte nur %XX; „%2520" (ein kodiertes %20) endet auf „20", und
    // die Nummer dahinter blieb stehen. main machte daraus noch „%252[telefon entfernt]".
    const faelle: [string, string][] = [
      ['Ruf%252006641234567', 'Ruf%2520[telefon entfernt]'],
      ['Ruf%25220664 1234567', 'Ruf%2522[telefon entfernt]'],
      ['Ruf%25252006641234567', 'Ruf%252520[telefon entfernt]'],
    ]
    for (const [roh, sauber] of faelle) {
      expect(fehlertext(roh), roh).toBe(sauber)
      expect(nachricht(roh), roh).toBe(sauber)
      expect(extraText(roh), roh).toBe(sauber)
    }
    expect(adresse('/kontakt/Ruf%252006641234567')).toBe('https://farmerzone.at/kontakt/Ruf%2520[telefon entfernt]')
    // Gegenproben: Zeitstempel und Kennungen nach einem doppelt kodierten Escape bleiben.
    for (const text of ['Zeit%25202026-10-10%252020:02:00', 'Kennung%2520clx0123456789abcdefghijklmn']) {
      expect(fehlertext(text), text).toBe(text)
    }
  })

  it('eine absolute Adresse in Nachricht, Brotkrume und extra reicht bis zum Leerraum — „]", „)" und Anführungszeichen beenden sie nicht', () => {
    // Runde 2 beendete sie an ) ] ' " und Backtick; was dahinter stand, sah die
    // URL-Regel nicht mehr (reorder=…, s=…). main und Runde 1 nahmen \S+.
    const faelle: [string, string][] = [
      ['Link https://farmerzone.at/x?f[a]=1&reorder=abc123', 'Link https://farmerzone.at/x?f%5Ba%5D=1'],
      ['Link https://farmerzone.at/x?utm=(herbst)&s=abc123sig', 'Link https://farmerzone.at/x?utm=%28herbst%29'],
      [`Link https://farmerzone.at/x?q='a'&token=abc123`, 'Link https://farmerzone.at/x?q=%27a%27'],
      // In einer relativen Adresse: Sie liest die absolute mit, bis zum Leerraum — die
      // Parameter danach gehören zur äußeren Abfrage, auch ohne „?" in der absoluten.
      ['Abruf /api/og?url=https://farmerzone.at/x?f[a]=1&s=abc123sig gescheitert', 'Abruf /api/og?url=https%3A%2F%2Ffarmerzone.at%2Fx%3Ff%255Ba%255D%3D1 gescheitert'],
      ['Abruf /api/og?url=https://farmerzone.at/x&s=abc123sig gescheitert', 'Abruf /api/og?url=https%3A%2F%2Ffarmerzone.at%2Fx gescheitert'],
      ['Abruf /api/og?url=https://farmerzone.at/x&reorder=abc123 gescheitert', 'Abruf /api/og?url=https%3A%2F%2Ffarmerzone.at%2Fx gescheitert'],
      ['Abruf /api/og?url=https://farmerzone.at/x&pathname=hof/foto.jpg gescheitert', 'Abruf /api/og?url=https%3A%2F%2Ffarmerzone.at%2Fx gescheitert'],
      // Ein Wert, der selbst eine absolute Adresse ist, fällt mit seinem Schlüssel.
      ['Abruf /x?a=1&token=https://farmerzone.at/abc123 weg', 'Abruf /x?a=1 weg'],
      ['Abruf /proxy/https://farmerzone.at/x?f[a]=1&reorder=abc123 weg', 'Abruf /proxy/https://farmerzone.at/x?f%5Ba%5D=1 weg'],
      [`Wert =/https://farmerzone.at/x?q='a'&s=abc123sig weg`, 'Wert =/https://farmerzone.at/x?q=%27a%27 weg'],
    ]
    for (const [roh, sauber] of faelle) {
      expect(nachricht(roh), roh).toBe(sauber)
      expect(brotkrume(roh), roh).toBe(sauber)
      expect(extraText(roh), roh).toBe(sauber)
    }
    // Gegenprobe: eine relative Adresse endet weiter an der Klammer.
    expect(nachricht('Abruf (/x?a=1#token=abc123) gescheitert')).toBe('Abruf (/x?a=1) gescheitert')
  })

  it('ein Geheimnis hinter Leerraum fällt, auch wenn sein Schlüsselwort an einer Adresse hängt — in Nachricht, Brotkrume, extra und Fehlertext', () => {
    // Liest eine Adresse das Schlüsselwort mit (bis zum Leerraum), steht es danach
    // kodiert in ihr (%22Bearer, token%3A) — die Regeln danach sahen es nicht mehr,
    // der Wert dahinter blieb. Jetzt fällt er vorab (ersetzeVorab).
    const faelle = [
      'Fetch {"u":"/api/og?url=https://farmerzone.at/x","h":"Bearer abc123def456ghi"}',
      'Fetch [["url","/api/og?url=https://farmerzone.at/x"],["authorization","Bearer abc123def456ghi"]]',
      'Fetch {"u":"/api/og?url=https://farmerzone.at/x","code": 123456}',
      'Abruf /api/og?url=https://farmerzone.at/x,token: abc123def456 weg',
      '{"u":"/api/og?url=https://farmerzone.at/x","token": "abc123def456"}',
      'Fetch {"url":"https://farmerzone.at/x","headers":{"authorization":"Bearer abc123def456ghi"}}',
      'Login /api/auth?callbackUrl=https://farmerzone.at/konto&otp 123456 abgelaufen',
      // Ein „@" im Wert ist noch keine E-Mail-Adresse (Passwort).
      '{"u":"/api/og?url=https://farmerzone.at/x","password": "Sommer@2024"}',
      'Abruf https://farmerzone.at/x?a=1,password: Sommer@2024 weg',
    ]
    for (const roh of faelle) {
      for (const ergebnis of [nachricht(roh), extraText(roh), brotkrume(roh), fehlertext(roh)]) {
        expect(ergebnis ?? '', roh).not.toMatch(/abc123def456|123456|Sommer@2024/)
      }
    }
    // Der Vorab-Ersatz verschiebt keine Adressgrenze: Beginnt im Wert eine Adresse, fällt das ganze Wort.
    for (const roh of [
      'Weiter redirect_token: (/x?a=1&s=abc123sig) weg',
      'Weiter redirect_token: «/x?a=1&s=abc123sig» weg',
      'token: x(https://farmerzone.at/a?b=1&s=abc123sig) weg',
      'Abruf /api/og?url=https://farmerzone.at/x,token: /9j4AAQgeheim weg',
      'Weiter: Bearer /x?s=abc123sig weg',
      'Weiter: Bearer https://farmerzone.at/x?a=(1)&s=abc123sig weg',
      'Fehler code /123456?s=abc123sig weg',
    ]) {
      for (const ergebnis of [nachricht(roh), extraText(roh), brotkrume(roh), fehlertext(roh)]) {
        expect(ergebnis ?? '', roh).not.toMatch(/abc123sig|9j4AAQgeheim|123456/)
      }
    }
    expect(nachricht('Weiter: Bearer /x?s=abc123sig weg')).toBe('Weiter: Bearer [entfernt] weg')
    expect(nachricht('Fehler code /123456?s=abc123sig weg')).toBe('Fehler code /[code entfernt] weg')
    // Ohne Adresse im Wert fällt nur der Wert, Anführungszeichen und Klammern dahinter bleiben.
    expect(fehlertext('Invalid prisma.session.findFirst() invocation: { where: { token: "abc123def456" } }')).toBe(
      'Invalid prisma.session.findFirst() invocation: { where: { token: "[entfernt]" } }'
    )
    expect(nachricht(faelle[0])).toBe('Fetch {"u":"/api/og?url=https%3A%2F%2Ffarmerzone.at%2Fx%22%2C%22h%22%3A%22Bearer [entfernt]"}')
    expect(fehlertext(faelle[3])).toBe('Abruf /api/og?url=https%3A%2F%2Ffarmerzone.at%2Fx%2Ctoken%3A [entfernt] weg')
    // Gegenproben: Ein Wert, der selbst eine Adresse ist, fällt mit der ganzen Adresse;
    // ein Code und eine E-Mail-Adresse als Wert behalten ihren Platzhalter.
    expect(nachricht('redirect_token: /x?a=1&s=abc123sig weg')).toBe('redirect_token: [entfernt] weg')
    expect(nachricht('otp: 905173 abgelehnt')).toBe('otp: [code entfernt] abgelehnt')
    expect(nachricht('Passwort: kundin@example.com, token=[entfernt]')).toBe('Passwort: [e-mail entfernt], token=[entfernt]')
  })

  it('vorab fällt der Wert, kein Schlüssel — auch der Wert eines Schlüssels im selben Wort fällt', () => {
    // Der Ersatz bis zum Leerraum nahm den nächsten Schlüssel mit, und dessen Wert
    // hinter dem Leerraum blieb stehen. Jetzt lesen alle Regeln den unveränderten
    // Text, ihre Bereiche werden danach zusammengelegt.
    const faelle: [string, string][] = [
      ['Fehler token: abc,password: geheimB weg', 'Fehler token: [entfernt],password: [entfernt] weg'],
      ['Login fehlgeschlagen password: Sommer2024,token: geheimA weg', 'Login fehlgeschlagen password: [entfernt],token: [entfernt] weg'],
      ['Fehler Bearer abc,token: geheimC weg', 'Fehler Bearer [entfernt],token: [entfernt] weg'],
      ['Fehler Bearer abc,code: 482913 weg', 'Fehler Bearer [entfernt],code: [code entfernt] weg'],
      ['Fehler code 111222,token: geheimD weg', 'Fehler code [code entfernt],token: [entfernt] weg'],
      ['Fehler redirect_token: /konto,sig: geheimF weg', 'Fehler redirect_token: [entfernt] [entfernt] weg'],
      ['Fehler token: a,token: wertB,token: c weg', 'Fehler token: [entfernt],token: [entfernt],token: [entfernt] weg'],
      ['Fehler password: kundin@example.com,token: geheimI weg', 'Fehler password: [e-mail entfernt],token: [entfernt] weg'],
      ['{"token": "abc","password": "geheimE"}', '{"token": "[entfernt]","password": "[entfernt]"}'],
      // Eine Nummer hinter dem Wert verliert ihren Anfang nicht.
      ['Fehler token: abc,tel:+43 664 9876543 weg', 'Fehler token: [entfernt],tel:[telefon entfernt] weg'],
      ['Fehler Bearer x/y,+43 664 9876543 weg', 'Fehler Bearer [entfernt],[telefon entfernt] weg'],
      ['Fehler token: "a/b","telefon":"+43 664 9876543"', 'Fehler token: "[entfernt]","telefon":"[telefon entfernt]"'],
      // Ist der ganze Wert eine Nummer, nimmt ihn deren Regel, auch über den Leerraum hinweg.
      ['Fehler token: 0664 1234567 weg', 'Fehler token: [telefon entfernt] weg'],
      // Beginnt im Wert eine Nummer, fällt sie bis zu ihrem Ende mit — auch eine, die die
      // Telefon-Regel erst sähe, wenn die E-Mail-Adresse davor gefallen ist.
      ['Fehler token: «0664 9876543 weg', 'Fehler token: [entfernt] weg'],
      ['Fehler password: xgeheimP=+43 664 9876543', 'Fehler password: [entfernt]'],
      ['Fehler sig: kundin@example.com0664 9876543sig weg', 'Fehler sig: [entfernt] weg'],
      ['Fehler token: geheimQ1 /664/12345?s=abc123sig weg', 'Fehler token: [entfernt] weg'],
      ['Fehler token: x(0664) 1234567 weg', 'Fehler token: [entfernt] weg'],
      // Ein Code nimmt die Zahl dahinter nicht mit.
      ['Fehler code: 123456 3 Versuche', 'Fehler code: [code entfernt] 3 Versuche'],
      // Beginnt schon im Trenner eine Nummer, nimmt sie deren Regel.
      ['Fehler code: +436641 987654 weg', 'Fehler code: [telefon entfernt] weg'],
      ['Fehler code (066412 98765 weg', 'Fehler code [telefon entfernt] weg'],
      // Hängt am Bearer-Token ein „@", fällt die E-Mail-Adresse mit.
      ['Fehler Bearer kundin@example.com weg', 'Fehler Bearer [entfernt] weg'],
      // Ein Schlüssel oder Schlüsselwort direkt hinter der Nummer behält seinen Wert nicht.
      ['Fehler token: x+43 664 9876543token: geheimG weg', 'Fehler token: [entfernt] [entfernt] weg'],
      ['Fehler password: x0664/9876543Bearer geheimB2 weg', 'Fehler password: [entfernt] [entfernt] weg'],
      ['Fehler password: x0664/9876543code: 482913 weg', 'Fehler password: [entfernt] [code entfernt] weg'],
      ['Fehler oauth2token=geheimH weg', 'Fehler oauth2token=[entfernt] weg'],
    ]
    for (const [roh, sauber] of faelle) {
      expect(nachricht(roh), roh).toBe(sauber)
      expect(extraText(roh), roh).toBe(sauber)
      expect(brotkrume(roh), roh).toBe(sauber)
      expect(fehlertext(roh), roh).toBe(sauber)
    }
    for (const ergebnis of [nachricht('Fehler code 111222/x,+43 664 9876543 weg'), fehlertext('Fehler code 111222/x,+43 664 9876543 weg')]) {
      expect(ergebnis).not.toMatch(/111222|664|9876543/)
    }
    // Eine Nummer mit „ / " hinter einem Wert, der auf eine Ziffer endet (Nachprüfung von c8fb2fb):
    // Das „/" darin beginnt keine Adresse, der Bereich reicht bis zum Ende der Nummer.
    for (const roh of [
      'Anmeldung otp: 482913 0664 / 9876543 abgelehnt',
      'Fehler token: abc1 0664 / 987 65 43 weg',
      'Fehler Bearer abc123 0664 / 9876543 weg',
      'Login otp: 482913 - 0664 / 9876543',
      'Fehler token: x0664 / 9876543 weg',
      'Fehler token: a1 (/0664)1 987654 weg',
      // Was der Bereich dazunimmt, liest er wieder: eine Nummer im neuen Stück, ein „/" dahinter.
      'Fehler token: x1 9876543/x?a=1&s=0664 98 76 543 weg',
      'Fehler password: 4829130664 9876543/x?a=1&s=0664 98 76 543 weg',
      'Fehler code: Bearer 482913 /0abcx0664 / 98 76 5431',
    ]) {
      for (const ergebnis of [nachricht(roh), extraText(roh), brotkrume(roh), fehlertext(roh)]) {
        expect(ergebnis ?? '', roh).not.toMatch(/9876543|987 65 43|987654|98 76 543|482913/)
      }
    }
    // Gegenproben: Eine Adresse hinter dem Wert bleibt lesbar; eine Nummer, die nur den
    // Anfang des Werts deckt, nimmt ihn nicht mit; ein Code am Schlüssel in einer Adresse
    // fällt mit dieser (sein Platzhalter mit Leerzeichen schnitte sie sonst entzwei).
    expect(nachricht('Fehler token: abc,/hof/x?seite=2 weg')).toBe('Fehler token: [entfernt],/hof/x?seite=2 weg')
    expect(nachricht('Fehler token: 06641234567geheimT weg')).toBe('Fehler token: [entfernt] weg')
    expect(fehlertext('Fehler token: 06641234567geheimT weg')).toBe('Fehler token: [entfernt] weg')
    expect(nachricht('Abruf /x?code=123456&s=abc123sig weg')).toBe('Abruf /x weg')
    expect(nachricht('Abruf https://farmerzone.at/x?code=123456&s=abc123sig weg')).toBe('Abruf https://farmerzone.at/x weg')
    // Bleibt der Anfang einer Nummer in der Adresse stehen, fällt die Nummer danach ganz;
    // fällt er mit einem heiklen Parameter, fällt vorab ihr Rest dahinter.
    expect(nachricht('Link /x?tel=0664 1234567 weg')).toBe('Link /x?tel=[telefon entfernt] weg')
    expect(nachricht('Link /x?tel=0664987 6543 weg')).toBe('Link /x?tel=[telefon entfernt] weg')
    expect(fehlertext('Link /x?tel=0664 1234567 weg')).toBe('Link /x?tel=[telefon entfernt] weg')
    expect(nachricht('Link /x?s=0664 1234567 weg')).toBe('Link /x [telefon entfernt] weg')
    // Hinter einem Schlüsselwort ohne „=" am Ende einer Adresse fällt der Code vorab.
    expect(nachricht('Login https://farmerzone.at/konto&a=1&otp 123456 abgelaufen')).toBe(
      'Login https://farmerzone.at/konto&a=1&otp [code entfernt] abgelaufen'
    )
  })

  it('ein Wert hinter Leerraum fällt auch, wenn eine Adresse mit Abfrage davor sein Schlüsselwort mitliest', () => {
    const faelle = [
      '{"u":"https://farmerzone.at/x?a=1","token": "abc123def456"}',
      '{"u":"https://farmerzone.at/x?a=1","h":"Bearer abc123def456ghi"}',
      'Fehler https://farmerzone.at/x?a=1,code: 123456 weg',
      '{"u":"/x?a=1","code": 123456}',
      '{"u":"/x?a=1","h":"Bearer /9j4AAQgeheim"}',
      'Fehler /x?a=1,token: /9j4AAQgeheim weg',
      'Fehler https://farmerzone.at/x?a=1,token: (/y?s=abc123sig) weg',
      'Fehler /x?a=1&otp 123456 weg',
      // Hängt am Code oder an der Nummer noch etwas, fällt der ganze Wert schon vorab.
      'Fehler /x?a=1,otp: 905173-geheimO weg',
      'Fehler /x?a=1,token: 06641234567geheimT weg',
      'Fehler /x?a=1,token: geheimQ1 /664/12345?s=abc123sig weg',
      // Eine Nummer, die in einer Adresse beginnt und dahinter weitergeht, fällt ganz,
      // auch wenn in der Adresse ihr Anfang mit einem heiklen Parameter fällt.
      'Link https://farmerzone.at/x&s=0664 1234567 weg',
      'Link https://farmerzone.at/x?s=x-0664 1234567 weg',
      'Abruf /api/og?url=https://farmerzone.at/x&s=0664 1234567 weg',
      'Fehler code /482913 nach sig: code /123456 weg',
    ]
    for (const roh of faelle) {
      for (const ergebnis of [nachricht(roh), extraText(roh), brotkrume(roh), fehlertext(roh)]) {
        expect(ergebnis ?? '', roh).not.toMatch(/abc123|123456|905173|6641234567|9j4AAQ|geheim|12345/)
      }
    }
  })

  it('ein Abfragewert, der nach der letzten Runde noch kodiert ist, fällt ganz', () => {
    // Fünffach kodiert blieb der Token vorher kodiert stehen
    // (next=%252Freset%253Ftoken%253Dabc123); vierfach fiel er schon.
    let wert = '/reset?token=abc123'
    for (let i = 0; i < 5; i++) wert = encodeURIComponent(wert)
    expect(adresse(`/login?next=${wert}`)).toBe('https://farmerzone.at/login?next=%5Bentfernt%5D')
    expect(nachricht(`/login?next=${wert}`)).toBe('/login?next=%5Bentfernt%5D')
    // Gegenprobe: vierfach kodiert wird er ganz gelesen, der Token fällt, der Pfad bleibt.
    let vier = '/reset?token=abc123'
    for (let i = 0; i < 4; i++) vier = encodeURIComponent(vier)
    expect(adresse(`/login?next=${vier}`)).toBe('https://farmerzone.at/login?next=%2Freset')
  })
})
