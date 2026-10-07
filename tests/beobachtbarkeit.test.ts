/**
 * Tests für die Beobachtbarkeit: den Datensparsamkeits-Filter
 * (src/lib/sentry-hygiene.ts), die Umgebungs-Ableitung, die optionale
 * DSN-Validierung (src/lib/env.ts), die Upload-Meldung
 * (src/lib/upload-meldung.ts) und die Initialisierungs-Wächter der
 * Instrumentierungs-Dateien.
 *
 * @sentry/nextjs ist als Import gemockt (Muster wie @/lib/email in
 * tests/admin-reject.test.ts): Geprüft wird UNSER Verhalten — dass ohne DSN
 * nie initialisiert wird und nichts wirft, und dass mit DSN die
 * datensparsamen Optionen (sendDefaultPii aus, beforeSend = Filter) gesetzt
 * sind. Der Filter selbst läuft als reine Funktion ohne Mock.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ErrorEvent } from '@sentry/nextjs'
import { bereinigeEreignis, ermittleUmgebung } from '@/lib/sentry-hygiene'
import { validateEnv } from '@/lib/env'
import { baueUploadMeldung, meldeUploadFehler, uploadUrsacheVon } from '@/lib/upload-meldung'
import {
  BildFehler,
  IMAGE_NETWORK_ERROR,
  IMAGE_STORAGE_ERROR,
  IMAGE_UNKNOWN_ERROR,
  UPLOAD_DIAG,
} from '@/lib/upload-fehler'

vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
}))

/** Test-Fixtur als Sentry-Ereignis — nur die geprüften Felder sind belegt. */
function ereignis(teil: object): ErrorEvent {
  return teil as ErrorEvent
}

describe('bereinigeEreignis — der beforeSend-Filter', () => {
  it('entfernt E-Mail-Adressen aus Fehlertext und Ausnahme-Werten — auch mehrere', () => {
    const e = bereinigeEreignis(
      ereignis({
        message: 'Upload für hof@beispiel.at fehlgeschlagen (Konflikt mit hof@anderes.at)',
        exception: { values: [{ value: 'Nutzer f.mueller+hof@example.com nicht gefunden' }] },
      })
    )

    expect(e.message).toBe(
      'Upload für [e-mail entfernt] fehlgeschlagen (Konflikt mit [e-mail entfernt])'
    )
    expect(e.exception?.values?.[0].value).toBe('Nutzer [e-mail entfernt] nicht gefunden')
  })

  it('entfernt E-Mails auch aus dem URL-PFAD — roh und %40-kodiert (Kunden-Route)', () => {
    const e = bereinigeEreignis(
      ereignis({
        request: { url: 'https://farmerzone.at/customers/kunde%40beispiel.at' },
        breadcrumbs: [{ data: { from: '/customers/kunde@beispiel.at', to: '/orders' } }],
      })
    )

    expect(e.request?.url).toBe('https://farmerzone.at/customers/[e-mail entfernt]')
    expect(e.breadcrumbs?.[0].data?.from).toBe('/customers/[e-mail entfernt]')
    expect(e.breadcrumbs?.[0].data?.to).toBe('/orders')
  })

  it('entfernt undurchsichtige Kennungs-Segmente aus dem Pfad (Bestätigungs-Token)', () => {
    const e = bereinigeEreignis(
      ereignis({
        request: { url: 'https://farmerzone.at/api/orders/confirm/V1StGXR8_Z5jdHi6BmyT9pqLnv2wYc4k' },
      })
    )

    expect(e.request?.url).toBe('https://farmerzone.at/api/orders/confirm/[kennung entfernt]')
  })

  it('entfernt den Token der Bar-Bestätigung (/{hof}/bestaetigen/{token}) — Seite und Brotkrume', () => {
    const e = bereinigeEreignis(
      ereignis({
        request: { url: 'https://farmerzone.at/hof-test/bestaetigen/V1StGXR8_Z5jdHi6BmyT9pqLnv2wYc4k' },
        breadcrumbs: [{ data: { from: '/hof-test/bestaetigen/V1StGXR8_Z5jdHi6BmyT9pqLnv2wYc4k', to: '/hof-test' } }],
        contexts: { nextjs: { request_path: '/hof-test/bestaetigen/V1StGXR8_Z5jdHi6BmyT9pqLnv2wYc4k' } },
      })
    )

    expect(e.request?.url).toBe('https://farmerzone.at/hof-test/bestaetigen/[kennung entfernt]')
    expect(e.breadcrumbs?.[0].data?.from).toBe('/hof-test/bestaetigen/[kennung entfernt]')
    expect((e.contexts?.nextjs as { request_path: string }).request_path).toBe('/hof-test/bestaetigen/[kennung entfernt]')
  })

  it('der Token nach /bestaetigen/ und /api/orders/confirm/ fällt auch, wenn er kurz ist — die Route entscheidet, nicht die Länge', () => {
    const e = bereinigeEreignis(
      ereignis({
        request: { url: 'https://farmerzone.at/hof-test/bestaetigen/kurz-123?x=1' },
        breadcrumbs: [{ data: { url: '/api/orders/confirm/kurz-123' } }],
      })
    )

    expect(e.request?.url).toBe('https://farmerzone.at/hof-test/bestaetigen/[kennung entfernt]?x=1')
    expect(e.breadcrumbs?.[0].data?.url).toBe('/api/orders/confirm/[kennung entfernt]')
  })

  it('kurze Pfadteile anderer Routen bleiben lesbar — Gegenprobe', () => {
    const e = bereinigeEreignis(ereignis({ request: { url: 'https://farmerzone.at/hof-test/bestellung/abc' } }))

    expect(e.request?.url).toBe('https://farmerzone.at/hof-test/bestellung/abc')
  })

  it('dampft Blob-Speicher-URLs auf den Ursprung ein — der Pfad trägt den Geräte-Dateinamen', () => {
    const e = bereinigeEreignis(
      ereignis({
        breadcrumbs: [
          { data: { url: 'https://abc123.public.blob.vercel-storage.com/farm_1/logo/Hof_Mueller_Franz.jpg' } },
        ],
        request: { url: 'https://x.at/api?pathname=farm_1/logo/Hof_Mueller_Franz.jpg&art=logo' },
      })
    )

    expect(e.breadcrumbs?.[0].data?.url).toBe(
      'https://abc123.public.blob.vercel-storage.com/[pfad entfernt]'
    )
    // …und der pathname-Parameter zählt zu den heiklen Parametern.
    expect(e.request?.url).toBe('https://x.at/api?art=logo')
  })

  it('bereinigt contexts.nextjs.request_path — onRequestError hängt den rohen Pfad an', () => {
    const e = bereinigeEreignis(
      ereignis({
        contexts: { nextjs: { request_path: '/customers/kunde%40beispiel.at' } },
      })
    )

    expect(e.contexts?.nextjs?.request_path).toBe('/customers/[e-mail entfernt]')
  })

  it('löscht den POST-Körper (request.data) ersatzlos', () => {
    const e = bereinigeEreignis(
      ereignis({
        request: { data: { customerName: 'Klaus Müller', customerPhone: '0664 1234567' } },
      })
    )

    expect(e.request?.data).toBeUndefined()
  })

  it('bereinigt den Referer wie jede URL, statt ihn zu behalten', () => {
    const e = bereinigeEreignis(
      ereignis({
        request: {
          headers: {
            Referer: 'https://farmerzone.at/reset-password?token=abc',
            accept: 'text/html',
          },
        },
      })
    )

    expect(e.request?.headers?.Referer).toBe('https://farmerzone.at/reset-password')
    expect(e.request?.headers?.accept).toBe('text/html')
  })

  it('bereinigt Console-Brotkrumen-Argumente: Texte gefiltert, Strukturiertes fällt weg', () => {
    const e = bereinigeEreignis(
      ereignis({
        breadcrumbs: [
          {
            category: 'console',
            data: { arguments: ['Fehler bei hof@beispiel.at', { geheim: true }, 503, null] },
          },
        ],
      })
    )

    expect(e.breadcrumbs?.[0].data?.arguments).toEqual([
      'Fehler bei [e-mail entfernt]',
      '[objekt entfernt]',
      503,
      null,
    ])
  })

  it('bereinigt Span-Daten von Transaktionen: url.full, url.query, Beschreibung', () => {
    const e = bereinigeEreignis(
      ereignis({
        type: 'transaction',
        spans: [
          {
            description: 'GET https://farmerzone.at/unsubscribe?token=xyz',
            data: {
              'url.full': 'https://farmerzone.at/unsubscribe?token=xyz&seite=1',
              'url.query': 'token=xyz&seite=1',
              'http.response.status_code': 200,
            },
          },
        ],
      })
    )

    const span = (e as unknown as { spans: Array<{ description: string; data: Record<string, unknown> }> })
      .spans[0]
    expect(span.description).toBe('GET https://farmerzone.at/unsubscribe')
    expect(span.data['url.full']).toBe('https://farmerzone.at/unsubscribe?seite=1')
    expect(span.data['url.query']).toBe('seite=1')
    expect(span.data['http.response.status_code']).toBe(200)
  })

  it('wirft nie — auch bei kargen Ereignissen (Ausnahme ohne value, leere Brotkrume)', () => {
    expect(() =>
      bereinigeEreignis(
        ereignis({
          exception: { values: [{ type: 'TypeError' }] },
          breadcrumbs: [{}],
          request: {},
          contexts: {},
          user: {},
        })
      )
    ).not.toThrow()
  })

  it('entfernt Telefonnummern — auch Klammer-Schreibweisen, wie Nutzer sie tippen', () => {
    expect(bereinigeEreignis(ereignis({ message: 'Rückruf +43 664 123 4567 scheiterte' })).message).toBe(
      'Rückruf [telefon entfernt] scheiterte'
    )
    expect(bereinigeEreignis(ereignis({ message: 'unter (0664) 1234567 erreichbar' })).message).toBe(
      'unter [telefon entfernt] erreichbar'
    )
    expect(bereinigeEreignis(ereignis({ message: 'oder +43 (0) 664 1234567' })).message).toBe(
      'oder [telefon entfernt]'
    )
  })

  it('lässt Statuscodes, Datumsangaben, Uhrzeiten und Postleitzahlen stehen', () => {
    const e = bereinigeEreignis(
      ereignis({
        message: 'Status 503 am 01.09.2026 um 08:15:33 nach 2 Versuchen, PLZ 01067',
      })
    )

    expect(e.message).toBe('Status 503 am 01.09.2026 um 08:15:33 nach 2 Versuchen, PLZ 01067')
  })

  it('entfernt Authorization- und Cookie-Header samt Cookies, andere Header bleiben', () => {
    const e = bereinigeEreignis(
      ereignis({
        request: {
          headers: { Authorization: 'Bearer geheim', cookie: 'sitzung=abc', accept: 'text/html' },
          cookies: { sitzung: 'abc' },
        },
      })
    )

    expect(e.request?.headers).toEqual({ accept: 'text/html' })
    expect(e.request?.cookies).toBeUndefined()
  })

  it('entfernt token/code/secret/email aus Query-String und URL, harmlose Parameter bleiben', () => {
    const e = bereinigeEreignis(
      ereignis({
        request: {
          url: 'https://farmerzone.at/login?token=abc&seite=2',
          query_string: 'magic_token=xyz&code=123&email=a@b.at&seite=2',
        },
      })
    )

    expect(e.request?.url).toBe('https://farmerzone.at/login?seite=2')
    expect(e.request?.query_string).toBe('seite=2')
  })

  it('entfernt die Bestell-Link-Signatur (?s=…) und den Reorder-Token, „seite" und „sortierung" bleiben', () => {
    const e = bereinigeEreignis(
      ereignis({
        request: {
          // Beide sind Zugangsgeheimnisse: s öffnet die Bestellseite
          // (bestell-link.ts), reorder trägt den selbsttragenden
          // Nachbestell-Token. `^s$` darf dabei NICHT Wörter treffen, die
          // bloß ein s enthalten (seite, sortierung).
          url: 'https://farmerzone.at/hof/bestellung/abc?s=deadbeef&seite=2',
          query_string: 's=deadbeef&reorder=xyz.abc&seite=2&sortierung=neu',
        },
      })
    )

    expect(e.request?.url).toBe('https://farmerzone.at/hof/bestellung/abc?seite=2')
    expect(e.request?.query_string).toBe('seite=2&sortierung=neu')
  })

  it('entfernt auch die Signatur der Bestätigungsseite (?sig=…) — Stripes Parameter wie redirect_status bleiben', () => {
    const e = bereinigeEreignis(
      ereignis({
        request: {
          // sig öffnet /{hof}/confirm/{id} mit Name und E-Mail der Kundin
          // (bestell-link.ts, bestaetigungsPfad) — ein Zugangsgeheimnis.
          url: 'https://farmerzone.at/hof/confirm/abc?sig=deadbeef&redirect_status=succeeded',
          query_string: 'sig=deadbeef&redirect_status=succeeded',
        },
      })
    )

    expect(e.request?.url).toBe('https://farmerzone.at/hof/confirm/abc?redirect_status=succeeded')
    expect(e.request?.query_string).toBe('redirect_status=succeeded')
  })

  it('entfernt eine Objekt-Gestalt des Query-Strings ganz — die URL trägt das Unbedenkliche', () => {
    const e = bereinigeEreignis(
      ereignis({
        request: {
          url: 'https://farmerzone.at/upload?art=logo&token=x',
          query_string: { token: 'x', art: 'logo' },
        },
      })
    )

    expect(e.request?.query_string).toBeUndefined()
    expect(e.request?.url).toBe('https://farmerzone.at/upload?art=logo')
  })

  it('verliert bei einem zweiten ? in der URL nichts Harmloses', () => {
    const e = bereinigeEreignis(
      ereignis({ request: { url: 'https://x.at/p?a=1?b&token=geheim' } })
    )

    // URLSearchParams liest 'a' = '1?b' — der Wert bleibt, das Token fällt.
    expect(e.request?.url).toBe('https://x.at/p?a=1%3Fb')
  })

  it('dampft den Nutzer auf die ID ein — E-Mail und Name überleben nie', () => {
    const e = bereinigeEreignis(
      ereignis({ user: { id: 'farm_1', email: 'hof@beispiel.at', username: 'Klaus Müller' } })
    )

    expect(e.user).toEqual({ id: 'farm_1' })
  })

  it('bereinigt Brotkrumen (Text und URL), lässt Harmloses unangetastet', () => {
    const e = bereinigeEreignis(
      ereignis({
        message: 'Verarbeitung fehlgeschlagen [S71]',
        breadcrumbs: [
          { message: 'Klick von hof@beispiel.at', data: { url: '/upload?token=x&art=logo' } },
          { message: 'Seite geladen' },
        ],
      })
    )

    expect(e.message).toBe('Verarbeitung fehlgeschlagen [S71]')
    expect(e.breadcrumbs?.[0].message).toBe('Klick von [e-mail entfernt]')
    expect(e.breadcrumbs?.[0].data?.url).toBe('/upload?art=logo')
    expect(e.breadcrumbs?.[1].message).toBe('Seite geladen')
  })

  // Anmeldecode (E7, Nr. 08): Der Code ist für zehn Minuten ein Zugang wie
  // ein Passwort — er darf weder als Parameter noch im Text nach Sentry.
  it('entfernt den Anmeldecode aus Parametern (otp) und aus Text neben „Code"/„OTP"', () => {
    const e = bereinigeEreignis(
      ereignis({
        message: 'Anmeldung fehlgeschlagen für kundin@example.com mit Code 481234',
        exception: { values: [{ value: 'otp: 905173 abgelehnt' }] },
        request: {
          url: 'https://farmerzone.at/api/auth/sign-in/email-otp?otp=481234&seite=2',
          query_string: 'otp=481234&seite=2',
        },
        breadcrumbs: [{ message: 'Anmeldecode 112233 eingegeben', data: { url: '/account/login?otp=112233' } }],
      })
    )

    expect(e.message).toBe('Anmeldung fehlgeschlagen für [e-mail entfernt] mit Code [code entfernt]')
    expect(e.exception?.values?.[0].value).toBe('otp: [code entfernt] abgelehnt')
    expect(e.request?.url).toBe('https://farmerzone.at/api/auth/sign-in/email-otp?seite=2')
    expect(e.request?.query_string).toBe('seite=2')
    expect(e.breadcrumbs?.[0].message).toBe('Anmeldecode [code entfernt] eingegeben')
    expect(e.breadcrumbs?.[0].data?.url).toBe('/account/login')
  })

  it('Gegenprobe Anmeldecode: Bestellnummern, Fehlercodes und Zahlen ohne „Code" davor bleiben', () => {
    const text = 'Bestellung 481234 mit Fehlercode 500, Statuscode 404, Zeitstempel 1696500000'
    expect(bereinigeEreignis(ereignis({ message: text })).message).toBe(text)
  })
})

describe('bereinigeEreignis — keine IP-Adressen (Nr. 37)', () => {
  // Adressen aus den Dokumentationsbereichen (RFC 5737 / RFC 3849) —
  // erfunden, nie eine echte.
  const IP_HEADER = {
    'X-Forwarded-For': '203.0.113.7, 198.51.100.2',
    'x-real-ip': '203.0.113.7',
    'CF-Connecting-IP': '203.0.113.7',
    'True-Client-IP': '203.0.113.7',
    'X-Client-IP': '203.0.113.7',
    'X-Cluster-Client-IP': '203.0.113.7',
    Forwarded: 'for=203.0.113.7;proto=https',
    'X-Vercel-Forwarded-For': '203.0.113.7',
    'x-vercel-proxied-for': '203.0.113.7',
    'Fastly-Client-IP': '2001:db8::7',
    'X-Vercel-IP-City': 'Musterstadt',
    'x-vercel-ip-latitude': '48.1',
    'X-Original-Forwarded-For': '203.0.113.7',
    'x-envoy-external-address': '203.0.113.7',
    'CF-IPCountry': 'AT',
    'cf-ipcity': 'Musterstadt',
  }

  it('Fehler: entfernt user.ip_address und jeden IP-Header (jede Schreibweise), die Farm-ID bleibt', () => {
    const e = bereinigeEreignis(
      ereignis({
        user: { id: 'farm_1', ip_address: '203.0.113.7' },
        request: {
          url: 'https://farmerzone.at/orders',
          headers: { ...IP_HEADER, accept: 'text/html', 'user-agent': 'Testbrowser/1.0' },
          env: { REMOTE_ADDR: '203.0.113.7', SERVER_NAME: 'farmerzone.at' },
        },
      })
    )

    expect(e.user).toEqual({ id: 'farm_1' })
    expect(e.request?.headers).toEqual({ accept: 'text/html', 'user-agent': 'Testbrowser/1.0' })
    expect(e.request?.env).toBeUndefined()
    expect(JSON.stringify(e)).not.toMatch(/203\.0\.113\.7|2001:db8::7|Musterstadt/)
  })

  it('Fehler: auch „{{auto}}" überlebt nicht — Sentry soll die Adresse nie selbst ableiten', () => {
    expect(bereinigeEreignis(ereignis({ user: { ip_address: '{{auto}}' } })).user).toEqual({})
    expect(bereinigeEreignis(ereignis({ user: { id: 'farm_1', ip_address: '{{auto}}' } })).user).toEqual({
      id: 'farm_1',
    })
  })

  it('Transaktion: Nutzer, Header, Wurzel-Span (contexts.trace.data) und Spans ohne IP', () => {
    const e = bereinigeEreignis(
      ereignis({
        type: 'transaction',
        user: { id: 'farm_1', ip_address: '203.0.113.7' },
        request: { headers: { ...IP_HEADER, accept: 'text/html' } },
        contexts: {
          trace: {
            trace_id: 'a'.repeat(32),
            span_id: 'b'.repeat(16),
            data: {
              'user.ip_address': '203.0.113.7',
              'client.address': '203.0.113.7',
              'http.request.header.x_forwarded_for': '203.0.113.7',
              'http.request.header.x_vercel_proxied_for': '203.0.113.7',
              'http.request.header.accept': 'text/html',
              'url.full': 'https://farmerzone.at/reset-password?token=abc&seite=1',
              'http.response.status_code': 200,
            },
          },
        },
        spans: [
          {
            description: 'GET /orders',
            data: {
              'net.peer.ip': '203.0.113.7',
              'http.client_ip': '203.0.113.7',
              'network.peer.address': '2001:db8::7',
              'net.sock.peer.addr': '203.0.113.7',
              'http.request.header.x-real-ip': '203.0.113.7',
              'http.request.header.cf_connecting_ip': '203.0.113.7',
              'http.request.header.accept': 'text/html',
              'http.method': 'GET',
            },
          },
        ],
      })
    )

    expect(e.user).toEqual({ id: 'farm_1' })
    expect(e.request?.headers).toEqual({ accept: 'text/html' })
    const wurzel = e.contexts?.trace?.data as Record<string, unknown>
    expect(wurzel).toEqual({
      'http.request.header.accept': 'text/html',
      // Der Wurzel-Span trägt dieselbe rohe Adresse wie request.url — gleiche Regel.
      'url.full': 'https://farmerzone.at/reset-password?seite=1',
      'http.response.status_code': 200,
    })
    const span = (e as unknown as { spans: Array<{ data: Record<string, unknown> }> }).spans[0]
    expect(span.data).toEqual({ 'http.request.header.accept': 'text/html', 'http.method': 'GET' })
    expect(JSON.stringify(e)).not.toMatch(/203\.0\.113\.7|2001:db8::7|Musterstadt/)
  })

  it('Gegenprobe: Ereignisse ohne IP bleiben unverändert in Gestalt — Server-Adresse und Methode bleiben', () => {
    const e = bereinigeEreignis(
      ereignis({
        request: { method: 'POST', headers: { host: 'farmerzone.at', 'content-type': 'text/plain' } },
        spans: [{ data: { 'server.address': 'farmerzone.at', 'http.request.method': 'POST' } }],
      })
    )

    expect(e.request).toEqual({
      method: 'POST',
      headers: { host: 'farmerzone.at', 'content-type': 'text/plain' },
    })
    const span = (e as unknown as { spans: Array<{ data: Record<string, unknown> }> }).spans[0]
    expect(span.data).toEqual({ 'server.address': 'farmerzone.at', 'http.request.method': 'POST' })
  })

  it('wirft nie bei verquerer Gestalt — und lässt dabei keine IP durch', () => {
    const ip = '203.0.113.7'
    const verquer: object[] = [
      { request: { headers: { Referer: ['https://farmerzone.at/a', ip], 'X-Real-IP': ip } } },
      { request: { headers: { referer: 42, 'x-forwarded-for': ip } } },
      { request: { headers: `X-Forwarded-For: ${ip}` } },
      { request: { headers: [['x-forwarded-for', ip]] } },
      { request: `GET / von ${ip}` },
      { request: { url: 7, env: { REMOTE_ADDR: ip } } },
      { type: 'transaction', spans: { erster: { data: { 'client.address': ip } } } },
      { type: 'transaction', spans: `client.address=${ip}` },
      { type: 'transaction', spans: [null, 'x', { data: `net.peer.ip=${ip}` }, { data: { 'net.peer.ip': ip } }] },
      { contexts: { trace: null, nextjs: null } },
      { contexts: null, user: { id: 'farm_1', ip_address: ip } },
      { contexts: { trace: { data: `client.address=${ip}` } } },
      { user: ip },
      { user: { id: { ip_address: ip } } },
      { breadcrumbs: { 0: { data: { url: ip } } } },
      { breadcrumbs: [null, 'x', { data: `from ${ip}` }] },
      { exception: { values: { 0: { value: ip } } } },
      { message: 42 },
    ]

    for (const teil of verquer) {
      let ergebnis: unknown
      expect(() => (ergebnis = bereinigeEreignis(ereignis(teil))), JSON.stringify(teil)).not.toThrow()
      expect(JSON.stringify(ergebnis), JSON.stringify(teil)).not.toContain(ip)
    }
  })

  it('scheitert die Bereinigung doch, geht nur ein Minimalereignis raus — nie das Rohereignis', () => {
    const roh = {
      event_id: 'e1',
      level: 'error',
      environment: 'production',
      message: 'Rückruf an hof@beispiel.at gescheitert',
      exception: { values: [{ type: 'TypeError', value: 'kaputt bei hof@beispiel.at' }] },
      user: { id: 'farm_1', ip_address: '203.0.113.7' },
      breadcrumbs: [{ data: { url: 'https://farmerzone.at/?token=abc' } }],
      extra: { kundin: 'hof@beispiel.at' },
      tags: { ip: '203.0.113.7' },
      contexts: { nextjs: { request_path: '/customers/hof@beispiel.at' } },
    }
    // Ein Getter, der wirft — so verquer, dass die Bereinigung abbricht.
    Object.defineProperty(roh, 'request', {
      enumerable: true,
      get() {
        throw new Error('kaputt')
      },
    })

    let e: ErrorEvent | undefined
    expect(() => (e = bereinigeEreignis(ereignis(roh)))).not.toThrow()

    expect(e).toEqual({
      event_id: 'e1',
      level: 'error',
      environment: 'production',
      message: 'Rückruf an [e-mail entfernt] gescheitert',
      exception: { values: [{ type: 'TypeError', value: 'kaputt bei [e-mail entfernt]' }] },
      extra: { bereinigung: 'fehlgeschlagen' },
    })
    // Ein neues Objekt, nicht das Rohereignis (Vergleich ohne den werfenden Getter).
    expect(e === (roh as unknown)).toBe(false)
  })
})

describe('Sentry-Initialisierung — statisch: jeder init-Aufruf ohne Standard-PII', () => {
  /** Kommentare raus — ein „// sendDefaultPii: false" zählt nicht als
   *  Einstellung. `//` direkt nach `:` (https://) bleibt stehen. */
  function ohneKommentare(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  }

  /** Text zwischen der Klammer bei `start` und ihrem Gegenstück — Klammern in
   *  Zeichenketten zählen nicht. */
  function klammerInhalt(text: string, start: number): string {
    let tiefe = 0
    let zitat: string | null = null
    for (let i = start; i < text.length; i++) {
      const z = text[i]
      if (zitat) {
        if (z === '\\') i++
        else if (z === zitat) zitat = null
        continue
      }
      if (z === '"' || z === "'" || z === '`') zitat = z
      else if ('([{'.includes(z)) tiefe++
      else if (')]}'.includes(z) && --tiefe === 0) return text.slice(start + 1, i)
    }
    return text.slice(start + 1)
  }

  const escape = (name: string) => name.replace(/\$/g, '\\$')

  /** Jeder Aufruf einer init-Funktion aus einem @sentry/*-Paket: über einen
   *  beliebig benannten Namensraum (`import * as X`, Standard-Import,
   *  `await import`/`require`) oder als benannter Import (`import { init as y }`).
   *  Je Aufruf das Argument als Text. */
  function sentryInitAufrufe(dateien: Array<{ pfad: string; text: string }>) {
    const aufrufe: Array<{ pfad: string; aufruf: string; optionen: string }> = []
    for (const { pfad, text: roh } of dateien) {
      const text = ohneKommentare(roh)
      const namensraeume = new Set<string>()
      const initNamen = new Set<string>()
      for (const [, klausel] of text.matchAll(/import\s+(?!type\s)([^;]*?)\s+from\s+['"]@sentry\/[^'"]+['"]/g)) {
        const ns = klausel.match(/\*\s+as\s+([\w$]+)/)
        if (ns) namensraeume.add(ns[1])
        const standard = klausel.match(/^([\w$]+)\s*(,|$)/)
        if (standard) namensraeume.add(standard[1])
        for (const teil of klausel.match(/\{([^}]*)\}/)?.[1].split(',') ?? []) {
          const [importiert, lokal] = teil.trim().replace(/^type\s+/, '').split(/\s+as\s+/)
          if (importiert && /^init/.test(importiert)) initNamen.add((lokal ?? importiert).trim())
        }
      }
      for (const [, ziel] of text.matchAll(
        /(?:const|let|var)\s+([\w$]+|\{[^}]*\})\s*=\s*(?:await\s+import|require)\(\s*['"]@sentry\/[^'"]+['"]\s*\)/g
      )) {
        if (!ziel.startsWith('{')) namensraeume.add(ziel)
        else
          for (const teil of ziel.slice(1, -1).split(',')) {
            const [importiert, lokal] = teil.trim().split(/\s*:\s*/)
            if (importiert && /^init/.test(importiert)) initNamen.add((lokal ?? importiert).trim())
          }
      }
      const muster = [
        ...[...namensraeume].map((n) => new RegExp(`(?<![\\w$.])${escape(n)}\\s*\\.\\s*init\\w*\\s*\\(`, 'g')),
        ...[...initNamen].map((n) => new RegExp(`(?<![\\w$.])${escape(n)}\\s*\\(`, 'g')),
      ]
      for (const m of muster) {
        for (const treffer of text.matchAll(m)) {
          const klammer = treffer.index + treffer[0].length - 1
          aufrufe.push({
            pfad,
            aufruf: treffer[0].replace(/\s+/g, '').slice(0, -1),
            optionen: klammerInhalt(text, klammer).trim(),
          })
        }
      }
    }
    return aufrufe
  }

  /** Was an einem Aufruf fehlt oder verboten ist — leer = in Ordnung. */
  function verstoesse(optionen: string): string[] {
    const fehler: string[] = []
    if (!optionen.startsWith('{')) fehler.push('kein Objekt-Literal (nicht prüfbar)')
    if (!/\bsendDefaultPii\s*:\s*false\b/.test(optionen)) fehler.push('sendDefaultPii: false fehlt')
    if (!/\bbeforeSend\s*:\s*bereinigeEreignis\b/.test(optionen)) fehler.push('beforeSend fehlt')
    if (!/\bbeforeSendTransaction\s*:\s*bereinigeEreignis\b/.test(optionen)) fehler.push('beforeSendTransaction fehlt')
    // Ein gesetztes dataCollection schaltet im SDK (10.66) ALLE Vorgaben auf
    // „sammeln" — auch userInfo, also die IP — und überstimmt sendDefaultPii
    // (resolveDataCollectionOptions in @sentry/core). Ein Spread könnte es
    // unsichtbar hineintragen.
    if (/\bdataCollection\b/.test(optionen)) fehler.push('dataCollection gesetzt')
    if (/\.\.\./.test(optionen)) fehler.push('Spread in den Optionen')
    return fehler
  }

  /** src/ ganz, im Wurzelverzeichnis instrumentation*.* und sentry.*.config.* —
   *  eine NEUE init-Stelle (etwa eine Edge-Konfiguration) fällt automatisch
   *  unter die Regel. */
  function projektDateien(): Array<{ pfad: string; text: string }> {
    const wurzel = path.resolve(__dirname, '..')
    const quelle = /\.(c|m)?(t|j)sx?$/
    const kandidaten = [
      ...fs
        .readdirSync(wurzel)
        .filter((n) => quelle.test(n) && /^(sentry\.|instrumentation)/.test(n))
        .map((n) => path.join(wurzel, n)),
      ...(fs.readdirSync(path.join(wurzel, 'src'), { recursive: true }) as string[])
        .filter((n) => quelle.test(n))
        .map((n) => path.join(wurzel, 'src', n)),
    ]
    return kandidaten.map((pfad) => ({ pfad: path.relative(wurzel, pfad), text: fs.readFileSync(pfad, 'utf8') }))
  }

  it('findet genau die zwei init-Aufrufe: Server/Edge und Browser', () => {
    expect(
      sentryInitAufrufe(projektDateien())
        .map((a) => `${a.pfad} ${a.aufruf}`)
        .sort()
    ).toEqual(['src/instrumentation-client.ts Sentry.init', 'src/instrumentation.ts Sentry.init'])
  })

  it('jeder init-Aufruf setzt sendDefaultPii: false und beide Filter, nie dataCollection', () => {
    for (const { pfad, aufruf, optionen } of sentryInitAufrufe(projektDateien())) {
      expect(verstoesse(optionen), `${pfad} ${aufruf}`).toEqual([])
    }
  })

  it('Gegenprobe: erkennt benannte Importe, fremde Namensräume, dynamische Importe — je Aufruf, ohne Kommentare', () => {
    const quellen = [
      {
        pfad: 'a.ts',
        text: `import { init as starte, type Event } from '@sentry/nextjs'\nstarte({ dsn: 'https://k@o/1' })`,
      },
      {
        pfad: 'b.ts',
        text: `import * as Beob from '@sentry/node'\nBeob.init({\n  // sendDefaultPii: false,\n  beforeSend: bereinigeEreignis,\n  beforeSendTransaction: bereinigeEreignis,\n})`,
      },
      {
        pfad: 'c.ts',
        text: [
          `import * as Sentry from '@sentry/nextjs'`,
          `Sentry.init({ sendDefaultPii: false, beforeSend: bereinigeEreignis, beforeSendTransaction: bereinigeEreignis })`,
          `Sentry.init({ sendDefaultPii: false, beforeSend: bereinigeEreignis, beforeSendTransaction: bereinigeEreignis, dataCollection: {} })`,
        ].join('\n'),
      },
      {
        pfad: 'd.ts',
        text: `const S = await import('@sentry/browser')\nconst optionen = {}\nS.init(optionen)`,
      },
      { pfad: 'e.ts', text: `import Standard from '@sentry/nextjs'\nStandard.init({ ...basis, sendDefaultPii: false })` },
      { pfad: 'f.ts', text: `import * as Anderes from 'anderes-paket'\nAnderes.init({})` },
    ]

    const ergebnis = sentryInitAufrufe(quellen).map((a) => ({
      wo: `${a.pfad} ${a.aufruf}`,
      fehler: verstoesse(a.optionen),
    }))

    expect(ergebnis.map((e) => e.wo)).toEqual([
      'a.ts starte',
      'b.ts Beob.init',
      'c.ts Sentry.init',
      'c.ts Sentry.init',
      'd.ts S.init',
      'e.ts Standard.init',
    ])
    expect(ergebnis[0].fehler).toContain('sendDefaultPii: false fehlt')
    expect(ergebnis[1].fehler).toEqual(['sendDefaultPii: false fehlt'])
    expect(ergebnis[2].fehler).toEqual([])
    expect(ergebnis[3].fehler).toEqual(['dataCollection gesetzt'])
    expect(ergebnis[4].fehler).toContain('kein Objekt-Literal (nicht prüfbar)')
    expect(ergebnis[5].fehler).toContain('Spread in den Optionen')
  })
})

describe('ermittleUmgebung', () => {
  it('bildet die Vercel-Umgebung ab und fällt sonst auf development zurück', () => {
    expect(ermittleUmgebung('production')).toBe('production')
    expect(ermittleUmgebung('preview')).toBe('preview')
    expect(ermittleUmgebung('development')).toBe('development')
    expect(ermittleUmgebung(undefined)).toBe('development')
    expect(ermittleUmgebung('irgendwas')).toBe('development')
  })
})

const PFLICHT_ENV = {
  DATABASE_URL: 'postgres://x',
  BETTER_AUTH_SECRET: 's',
  STRIPE_SECRET_KEY: 'sk',
  STRIPE_WEBHOOK_SECRET: 'whsec',
}

describe('env-Validierung — der DSN ist optional', () => {
  it('besteht ohne DSN: ein fehlender Wert verhindert keinen Start', () => {
    expect(() => validateEnv(PFLICHT_ENV)).not.toThrow()
  })

  it('normalisiert einen leer angelegten DSN zu undefined', () => {
    const env = validateEnv({ ...PFLICHT_ENV, NEXT_PUBLIC_SENTRY_DSN: '   ' })
    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined()
  })

  it('reicht einen gesetzten DSN durch', () => {
    const env = validateEnv({ ...PFLICHT_ENV, NEXT_PUBLIC_SENTRY_DSN: 'https://k@o.ingest.de.sentry.io/1' })
    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBe('https://k@o.ingest.de.sentry.io/1')
  })
})

describe('Upload-Meldung', () => {
  it('ordnet die Ursache zu: Foto-Urteil, Netzfehler, Bildspeicher, Unbekanntes', () => {
    expect(uploadUrsacheVon(new BildFehler('format'))).toBe('format')
    expect(uploadUrsacheVon(new BildFehler('lesen'))).toBe('lesen')
    expect(uploadUrsacheVon(new Error(IMAGE_NETWORK_ERROR))).toBe('netz')
    expect(uploadUrsacheVon(new Error(IMAGE_STORAGE_ERROR))).toBe('bildspeicher')
    expect(uploadUrsacheVon(new Error(IMAGE_UNKNOWN_ERROR))).toBe('unbekannt')
    expect(uploadUrsacheVon(new Error('irgendwas anderes'))).toBe('unbekannt')
    expect(uploadUrsacheVon('kein Error')).toBe('unbekannt')
  })

  it('legt je Anlauf einen eigenen Kontext an und den Schritt als Tag', () => {
    // Eigene Kontexte statt einer Liste: Sentry kürzt ab der dritten Ebene.
    const meldung = baueUploadMeldung({
      ursache: 'netz',
      datei: { size: 1_000, type: 'image/jpeg' },
      weg: 'galerie',
      versuche: 2,
      diagnose: {
        schritt: 'uebertragung',
        anlaeufe: [
          { klasse: 'TypeError', meldung: 'Failed to fetch', dauerMs: 1_900 },
          { klasse: 'BlobServiceNotAvailable', meldung: 'Vercel Blob: The blob service …', dauerMs: 2_100 },
        ],
      },
    })

    expect(meldung.tags.schritt).toBe('uebertragung')
    expect(meldung.contexts.uploadAnlauf1).toEqual({
      klasse: 'TypeError',
      meldung: 'Failed to fetch',
      dauerMs: 1_900,
    })
    expect(meldung.contexts.uploadAnlauf2?.klasse).toBe('BlobServiceNotAvailable')
    expect(meldung.contexts.uploadAnlauf3).toBeUndefined()
  })

  it('trägt einen HTTP-Status mit, wo es einen gab', () => {
    const meldung = baueUploadMeldung({
      ursache: 'server',
      datei: { size: 1_000, type: 'image/jpeg' },
      weg: 'kamera',
      versuche: 1,
      diagnose: {
        schritt: 'abschluss',
        anlaeufe: [{ klasse: 'HttpAntwort', meldung: 'Verarbeitung abgelehnt (server)', status: 500, dauerMs: 400 }],
      },
    })

    expect(meldung.tags.schritt).toBe('abschluss')
    expect(meldung.contexts.uploadAnlauf1?.status).toBe(500)
  })

  it('reicht die Diagnose an Sentry weiter', async () => {
    const Sentry = await import('@sentry/nextjs')
    vi.mocked(Sentry.captureException).mockClear()
    const fehler = new Error(IMAGE_STORAGE_ERROR)

    meldeUploadFehler(fehler, {
      datei: { size: 1, type: 'image/png' },
      weg: 'dateien',
      versuche: 1,
      diagnose: {
        schritt: 'uebertragung',
        anlaeufe: [{ klasse: 'BlobAccessError', meldung: 'Vercel Blob: Access denied …', dauerMs: 300 }],
      },
    })

    expect(Sentry.captureException).toHaveBeenCalledWith(
      fehler,
      expect.objectContaining({
        tags: expect.objectContaining({ ursache: 'bildspeicher', schritt: 'uebertragung' }),
        contexts: expect.objectContaining({
          uploadAnlauf1: { klasse: 'BlobAccessError', meldung: 'Vercel Blob: Access denied …', dauerMs: 300 },
        }),
      })
    )
  })

  it('trägt Ursache, Kennung, Größe, Typ, Weg und Versuche — und KEINEN Dateinamen', () => {
    const meldung = baueUploadMeldung({
      ursache: 'server',
      datei: { size: 7_340_032, type: 'image/jpeg' },
      weg: 'kamera',
      versuche: 2,
    })

    expect(meldung.tags).toEqual({ bereich: 'foto-upload', ursache: 'server', kennung: UPLOAD_DIAG })
    expect(meldung.contexts.upload).toEqual({
      dateiGroesseBytes: 7_340_032,
      dateiTyp: 'image/jpeg',
      weg: 'kamera',
      versuche: 2,
      // Ohne Auskunft (kein Browser, keine Client Hints) ehrlich null.
      androidVersion: null,
    })
    // Kein Feld der Meldung darf je einen Dateinamen tragen.
    expect(JSON.stringify(meldung)).not.toMatch(/name/i)
  })

  it('nennt einen leeren MIME-Typ ehrlich unbekannt', () => {
    const meldung = baueUploadMeldung({
      ursache: 'lesen',
      datei: { size: 10, type: '' },
      weg: 'galerie',
      versuche: 0,
    })
    expect(meldung.contexts.upload.dateiTyp).toBe('unbekannt')
  })

  it('meldeUploadFehler wirft nie — Telemetrie darf den Upload-Ablauf nicht verändern', async () => {
    const Sentry = await import('@sentry/nextjs')
    vi.mocked(Sentry.captureException).mockImplementationOnce(() => {
      throw new Error('SDK kaputt')
    })

    expect(() =>
      meldeUploadFehler(new Error('x'), { datei: { size: 1, type: '' }, weg: 'galerie', versuche: 1 })
    ).not.toThrow()
  })
})

describe('Instrumentierung — ohne DSN still, mit DSN datensparsam', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('Server: register() wirft ohne DSN nicht und initialisiert nichts', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '')
    const Sentry = await import('@sentry/nextjs')
    const { register } = await import('@/instrumentation')

    await expect(register()).resolves.toBeUndefined()
    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('Server: register() initialisiert mit DSN datensparsam (PII aus, Filter dran)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://k@o.ingest.de.sentry.io/1')
    vi.stubEnv('VERCEL_ENV', 'preview')
    const Sentry = await import('@sentry/nextjs')
    const { register } = await import('@/instrumentation')

    await register()

    expect(Sentry.init).toHaveBeenCalledTimes(1)
    const optionen = vi.mocked(Sentry.init).mock.calls[0][0] as {
      environment?: string
      tracesSampleRate?: number
      sendDefaultPii?: boolean
      beforeSend?: (e: ErrorEvent) => ErrorEvent
      beforeSendTransaction?: (e: ErrorEvent) => ErrorEvent
    }
    expect(optionen).toMatchObject({
      environment: 'preview',
      tracesSampleRate: 0,
      sendDefaultPii: false,
    })
    // Der Filter hängt wirklich dran — geprüft am Verhalten, nicht an der
    // Funktions-Identität (resetModules lädt das Modul frisch).
    const gefiltert = optionen.beforeSend?.(ereignis({ message: 'von hof@beispiel.at' }))
    expect(gefiltert?.message).toBe('von [e-mail entfernt]')
    // Auch Transaktionen laufen durch den Filter — beforeSend allein ließe
    // sie samt roher URL passieren.
    const transaktion = optionen.beforeSendTransaction?.(
      ereignis({ request: { url: 'https://x.at/reset-password?token=abc' } })
    )
    expect(transaktion?.request?.url).toBe('https://x.at/reset-password')
  })

  it('Client: Import ohne DSN wirft nicht und initialisiert nichts', async () => {
    const Sentry = await import('@sentry/nextjs')
    await import('@/instrumentation-client')

    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('Client: Import mit DSN initialisiert datensparsam, Produktion tastet mit 0.1', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://k@o.ingest.de.sentry.io/1')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production')
    const Sentry = await import('@sentry/nextjs')
    await import('@/instrumentation-client')

    expect(Sentry.init).toHaveBeenCalledTimes(1)
    const optionen = vi.mocked(Sentry.init).mock.calls[0][0] as {
      environment?: string
      tracesSampleRate?: number
      sendDefaultPii?: boolean
      beforeSend?: (e: ErrorEvent) => ErrorEvent
      beforeSendTransaction?: (e: ErrorEvent) => ErrorEvent
    }
    expect(optionen).toMatchObject({
      environment: 'production',
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    })
    const gefiltert = optionen.beforeSend?.(ereignis({ message: 'von hof@beispiel.at' }))
    expect(gefiltert?.message).toBe('von [e-mail entfernt]')
    // Gerade hier zwingend: In Produktion tastet 0.1 — die Pageload-
    // Transaktion trägt die volle Adresszeile.
    const transaktion = optionen.beforeSendTransaction?.(
      ereignis({ request: { url: 'https://x.at/reset-password?token=abc' } })
    )
    expect(transaktion?.request?.url).toBe('https://x.at/reset-password')
  })
})
