/**
 * Tests für die Upload-Diagnose (src/lib/upload-diagnose.ts) und die Meldung
 * an den Bauern nach einem gescheiterten Transfer (transferFehlerText).
 *
 * Anlass JAVASCRIPT-NEXTJS-2: Jeder Transferfehler hieß „Verbindung
 * unterbrochen", und der Originalfehler ging verloren. Die Zuordnung ist hier
 * als reine Funktion festgehalten, ohne Mock. Die Meldungstexte des SDK
 * stehen 1:1 wie in @vercel/blob 2.4.0 (Präfix aus dem BlobError-Konstruktor).
 */
import { describe, expect, it } from 'vitest'
import {
  befundVon,
  bereinigeFehlerText,
  blobFehlerKlasse,
  fehlerKlasse,
  istLeseVerlust,
  ordneTransferFehler,
  UploadSchrittFehler,
} from '@/lib/upload-diagnose'
import {
  IMAGE_NETWORK_ERROR,
  IMAGE_READ_PERMISSION_ERROR,
  IMAGE_STORAGE_ERROR,
  IMAGE_UNKNOWN_ERROR,
  transferFehlerText,
  type TransferUrteil,
} from '@/lib/upload-fehler'

const blob = (text: string): Error => new Error(`Vercel Blob: ${text}`)

/** Wortlaut des Browsers, wenn die Freigabe für die Datei-Referenz weg ist. */
const nichtLesbar = (): Error =>
  new DOMException(
    'The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.',
    'NotReadableError'
  ) as unknown as Error
const nichtGefunden = (): Error =>
  new DOMException('A requested file or directory could not be found.', 'NotFoundError') as unknown as Error

describe('blobFehlerKlasse — die Unterklasse, obwohl das SDK keinen Namen setzt', () => {
  it('erkennt jede Unterklasse am Anfang ihrer Meldung', () => {
    const faelle: Array<[string, string]> = [
      ['Access denied, please provide a valid token for this resource.', 'BlobAccessError'],
      ['Client token has expired.', 'BlobClientTokenExpiredError'],
      ['Content type mismatch, contentType image/x is not allowed.', 'BlobContentTypeNotAllowedError'],
      ['Pathname mismatch, irgendwas. Check the pathname …', 'BlobPathnameMismatchError'],
      ['File is too large, the file length cannot be greater than 1.', 'BlobFileTooLargeError'],
      ['This store does not exist.', 'BlobStoreNotFoundError'],
      ['This store has been suspended.', 'BlobStoreSuspendedError'],
      ['Unknown error, please visit https://vercel.com/help.', 'BlobUnknownError'],
      ['The requested blob does not exist', 'BlobNotFoundError'],
      ['The blob service is currently not available. Please try again.', 'BlobServiceNotAvailable'],
      ['Too many requests please lower the number of concurrent requests .', 'BlobServiceRateLimited'],
      ['The request was aborted.', 'BlobRequestAbortedError'],
      ['Precondition failed: ETag mismatch.', 'BlobPreconditionFailedError'],
      ["OIDC is enabled for this project, but not for this token's environment.", 'BlobOidcEnvironmentNotAllowedError'],
    ]

    for (const [text, klasse] of faelle) {
      expect(blobFehlerKlasse(blob(text))).toBe(klasse)
    }
  })

  it('nennt einen SDK-Fehler ohne eigene Unterklasse schlicht BlobError', () => {
    // client_token_not_allowed, bad_request und die gescheiterte
    // Token-Abholung sind im SDK einfache BlobErrors.
    expect(blobFehlerKlasse(blob('Failed to  retrieve the client token'))).toBe('BlobError')
    expect(
      blobFehlerKlasse(blob('This operation is not available when using a client token.'))
    ).toBe('BlobError')
  })

  it('gibt für alles, was nicht vom SDK kommt, null zurück', () => {
    expect(blobFehlerKlasse(new TypeError('Failed to fetch'))).toBeNull()
    expect(blobFehlerKlasse(new Error('Access denied'))).toBeNull()
    expect(blobFehlerKlasse('Vercel Blob: Access denied')).toBeNull()
    expect(blobFehlerKlasse(null)).toBeNull()
  })
})

describe('ordneTransferFehler — was der Bauer liest', () => {
  it('nennt nur echte Netzfehler und unseren Abbruch „netz"', () => {
    for (const text of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.', 'Network request failed']) {
      expect(ordneTransferFehler(new TypeError(text), false)).toBe('netz')
    }
    // Unsere Wächter haben abgebrochen: netz, egal was das SDK daraus macht.
    expect(ordneTransferFehler(new Error(IMAGE_NETWORK_ERROR), true)).toBe('netz')
    expect(ordneTransferFehler(blob('Access denied, please provide a valid token for this resource.'), true)).toBe('netz')
    expect(ordneTransferFehler(blob('The request was aborted.'), false)).toBe('netz')
  })

  it('hält einen Programmierfehler nicht für einen Verbindungsabbruch, auch wenn er ein TypeError ist', () => {
    expect(ordneTransferFehler(new TypeError("Cannot read properties of undefined (reading 'url')"), false)).toBe('unbekannt')
  })

  it('ordnet jede Antwort des Bildspeichers ihm zu — Ablehnung wie Ausfall', () => {
    expect(ordneTransferFehler(blob('Access denied, please provide a valid token for this resource.'), false)).toBe('bildspeicher')
    expect(ordneTransferFehler(blob('The blob service is currently not available. Please try again.'), false)).toBe('bildspeicher')
    expect(
      ordneTransferFehler(blob('This operation is not available when using a client token.'), false)
    ).toBe('bildspeicher')
  })

  it('schiebt die Ablehnung durch unsere eigene Token-Route nicht dem Bildspeicher zu', () => {
    // Abgelaufene Sitzung, Pfad nicht erlaubt, Serverfehler: „bitte später
    // nochmal" hülfe dort nicht. Beide Wortlaute des SDK.
    expect(ordneTransferFehler(blob('Failed to  retrieve the client token'), false)).toBe('unbekannt')
    expect(ordneTransferFehler(blob('Failed to retrieve the client token'), false)).toBe('unbekannt')
  })

  it('bleibt bei allem anderen ehrlich unbestimmt', () => {
    expect(ordneTransferFehler(new RangeError('Invalid array length'), false)).toBe('unbekannt')
    expect(ordneTransferFehler(new Error('irgendwas'), false)).toBe('unbekannt')
    expect(ordneTransferFehler('kein Error', false)).toBe('unbekannt')
  })

  it("nennt eine Datei, die beim Senden unlesbar wird, 'lesen' — nicht 'netz'", () => {
    // Lesbar war sie in Stufe 0; im gestückelten Weg liest das SDK sie selbst
    // weiter (#134). Auch wenn nur die Nachricht durch eine fremde Schicht kam.
    expect(ordneTransferFehler(nichtLesbar(), false)).toBe('lesen')
    expect(ordneTransferFehler(new Error(`Vercel Blob: ${nichtLesbar().message}`), false)).toBe('lesen')
  })

  it('bleibt beim Abbruch unserer Wächter bei „netz", auch wenn ein Lesefehler zurückkommt', () => {
    // Unser abort() kann dem SDK jeden Fehler entlocken; abgebrochen haben WIR.
    expect(ordneTransferFehler(nichtLesbar(), true)).toBe('netz')
  })
})

describe('istLeseVerlust — die entzogene Freigabe, nicht der Abbruch', () => {
  it('erkennt den NotReadableError am Namen und an der Nachricht', () => {
    expect(istLeseVerlust(nichtLesbar())).toBe(true)
    // Ältere Safari-Stände: DOMException erbt dort nicht von Error.
    expect(istLeseVerlust({ name: 'NotReadableError', message: '' })).toBe(true)
  })

  it('beansprucht den Verbindungsabbruch NICHT für sich', () => {
    // Chrome meldet einen Leseverlust im fetch auch als „Failed to fetch".
    // Diesen Fall dem Lesen zuzuschlagen, hieße jeden echten Abbruch zur
    // entzogenen Freigabe zu erklären.
    expect(istLeseVerlust(new TypeError('Failed to fetch'))).toBe(false)
    expect(istLeseVerlust(new DOMException('abgebrochen', 'AbortError'))).toBe(false)
    expect(istLeseVerlust(nichtGefunden())).toBe(false)
    expect(istLeseVerlust(null)).toBe(false)
    expect(istLeseVerlust('NotReadableError')).toBe(false)
  })

  it('bleibt ruhig, wenn sich der Fehler nicht einmal lesen lässt', () => {
    const kaputt = {
      get name(): string {
        throw new Error('Getter kaputt')
      },
    }

    expect(istLeseVerlust(kaputt)).toBe(false)
  })
})

describe('transferFehlerText — die Meldung zum Urteil', () => {
  it('gibt jedem Urteil seinen eigenen Text', () => {
    expect(transferFehlerText('netz')).toBe(IMAGE_NETWORK_ERROR)
    expect(transferFehlerText('bildspeicher')).toBe(IMAGE_STORAGE_ERROR)
    expect(transferFehlerText('lesen')).toBe(IMAGE_READ_PERMISSION_ERROR)
    expect(transferFehlerText('unbekannt')).toBe(IMAGE_UNKNOWN_ERROR)
  })

  it('sagt „Verbindung unterbrochen" ausschließlich beim Netzfehler', () => {
    expect(transferFehlerText('netz')).toContain('Verbindung unterbrochen')
    expect(transferFehlerText('bildspeicher')).not.toContain('Verbindung')
    expect(transferFehlerText('lesen')).not.toContain('Verbindung')
    expect(transferFehlerText('unbekannt')).not.toContain('Verbindung')
  })

  it('fällt bei einem Urteil, das es nicht gibt, auf den unbestimmten Text zurück', () => {
    expect(transferFehlerText('gibt-es-nicht' as unknown as TransferUrteil)).toBe(IMAGE_UNKNOWN_ERROR)
  })
})

describe('bereinigeFehlerText — nichts über Hof oder Datei', () => {
  const HOF = 'cltesthofkennung000000001'

  it('lässt eine gewöhnliche Fehlermeldung unverändert', () => {
    expect(bereinigeFehlerText('Failed to fetch')).toBe('Failed to fetch')
    expect(bereinigeFehlerText('Vercel Blob: Client token has expired.')).toBe(
      'Vercel Blob: Client token has expired.'
    )
  })

  it('nimmt die übergebenen Werte wörtlich heraus — auch einen Dateinamen mit Leerzeichen', () => {
    const text = bereinigeFehlerText('Upload von Hof Test Stall.jpg für Hof x gescheitert', [
      'Hof Test Stall.jpg',
    ])
    expect(text).not.toContain('Stall')
    expect(text).toContain('[entfernt]')
  })

  it('nimmt Adressen, Pfade, E-Mail-Adressen, Bilddateien und Kennungen heraus', () => {
    const text = bereinigeFehlerText(
      `Fehler bei https://beispiel.public.blob.vercel-storage.com/originals/${HOF}/a.jpg, ` +
        `Pfad "originals/${HOF}/product/Stall_1.jpg", Datei Stall_2.HEIC, Mail max@example.com, ` +
        `Kennung ${HOF}`
    )
    expect(text).not.toContain(HOF)
    expect(text).not.toContain('https://')
    expect(text).not.toContain('originals')
    expect(text).not.toContain('Stall')
    expect(text).not.toContain('example.com')
  })

  it('lässt MIME-Typen stehen — sie haben einen Schrägstrich, sind aber kein Pfad', () => {
    expect(
      bereinigeFehlerText('Vercel Blob: Content type mismatch, contentType image/heic is not allowed.')
    ).toBe('Vercel Blob: Content type mismatch, contentType image/heic is not allowed.')
    expect(bereinigeFehlerText('Typ "application/octet-stream".')).toBe('Typ "application/octet-stream".')
    // Ein Pfad, der nur so anfängt, bleibt ein Pfad.
    expect(bereinigeFehlerText(`image/${HOF}/stall.jpg`)).toBe('[pfad]')
  })

  it('kürzt auf 200 Zeichen', () => {
    const text = bereinigeFehlerText('x '.repeat(300))
    expect(text).toHaveLength(202)
    expect(text.endsWith(' …')).toBe(true)
    // Genau an der Grenze bleibt der Text ganz.
    expect(bereinigeFehlerText('ab '.repeat(66) + 'ab')).toHaveLength(200)
  })

  it('übergeht zu kurze Werte, statt jeden Buchstaben zu ersetzen', () => {
    expect(bereinigeFehlerText('Failed to fetch', ['a'])).toBe('Failed to fetch')
  })
})

describe('befundVon — Klasse und bereinigte Nachricht', () => {
  it('nimmt Klasse und Nachricht eines gewöhnlichen Fehlers', () => {
    expect(befundVon(new TypeError('Load failed'))).toEqual({ klasse: 'TypeError', meldung: 'Load failed' })
    expect(befundVon(new DOMException('signal timed out', 'TimeoutError'))).toEqual({
      klasse: 'TimeoutError',
      meldung: 'signal timed out',
    })
  })

  it('bereinigt die Nachricht mit den übergebenen Werten', () => {
    expect(befundVon(new Error('kaputt bei Stall Nord'), ['Stall Nord']).meldung).toBe(
      'kaputt bei [entfernt]'
    )
  })

  it('übernimmt den mitgetragenen Befund eines Schritt-Fehlers', () => {
    const befund = { klasse: 'HttpAntwort', meldung: 'Kennung abgelehnt', status: 403 }
    expect(befundVon(new UploadSchrittFehler('Kein Zugriff', befund))).toEqual(befund)
  })

  it('kommt auch mit etwas zurecht, das kein Error ist', () => {
    expect(befundVon('kaputt')).toEqual({ klasse: 'string', meldung: 'kaputt' })
    expect(befundVon(undefined)).toEqual({ klasse: 'undefined', meldung: '' })
  })
})

describe('fehlerKlasse', () => {
  it('bevorzugt die Blob-Unterklasse vor dem Namen', () => {
    expect(fehlerKlasse(blob('Access denied, please provide a valid token for this resource.'))).toBe(
      'BlobAccessError'
    )
    expect(fehlerKlasse(new RangeError('x'))).toBe('RangeError')
  })
})
