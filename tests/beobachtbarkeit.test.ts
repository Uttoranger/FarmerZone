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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ErrorEvent } from '@sentry/nextjs'
import { bereinigeEreignis, ermittleUmgebung } from '@/lib/sentry-hygiene'
import { validateEnv } from '@/lib/env'
import { baueUploadMeldung, meldeUploadFehler, uploadUrsacheVon } from '@/lib/upload-meldung'
import { BildFehler, IMAGE_NETWORK_ERROR, UPLOAD_DIAG } from '@/lib/upload-fehler'

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
        exception: { values: [{ value: 'Nutzer j.f.mueller+hof@gmail.com nicht gefunden' }] },
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
  it('ordnet die Ursache zu: Foto-Urteil, Netzfehler, Unbekanntes', () => {
    expect(uploadUrsacheVon(new BildFehler('format'))).toBe('format')
    expect(uploadUrsacheVon(new BildFehler('lesen'))).toBe('lesen')
    expect(uploadUrsacheVon(new Error(IMAGE_NETWORK_ERROR))).toBe('netz')
    expect(uploadUrsacheVon(new Error('irgendwas anderes'))).toBe('unbekannt')
    expect(uploadUrsacheVon('kein Error')).toBe('unbekannt')
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
