/**
 * Datensparsamkeit für Sentry, Nr. 47: die Felder, die bis Lauf 7
 * ungefiltert durchliefen (Bericht Nr. 37, „Altlasten außerhalb von Auftrag
 * 37") — `logentry`, `tags`, `extra`, die übrigen `contexts`, die Variablen in
 * Stack-Frames (`frame.vars`) und die Daten der Brotkrumen.
 *
 * Seit der Nachbesserung 1 auch: Texte unter Query-Schlüsseln (Werte, nicht
 * nur Parameternamen) und die Nachrichten (event.message, message der
 * Brotkrumen) mit derselben Freitext-Regel wie logentry.
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
import { bereinigeEreignis } from '@/lib/sentry-hygiene'

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
