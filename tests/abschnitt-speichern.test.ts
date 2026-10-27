/**
 * Die Kette des Speicherwegs der Abschnitte von Mein Hof
 * (components/mein-hof/abschnitt-speichern.ts, Nr. 50 Runde 1) — mit
 * nachgebildeten Aktionen. Den Zustand in einem echten Postgres prüft
 * tests/integration/auftritt-abschnitte.int.test.ts.
 *
 * Beweist:
 *  - Nacheinander: Das zweite Speichern beginnt erst, wenn das erste
 *    geschrieben hat — auch zwischen Auftritt und Profil (eine Kette je Fenster).
 *  - speichereAuftritt schickt nur den Teil des Abschnitts und liest vorher
 *    keinen Stand (Nr. 65, Register N4: die Aktion schreibt nur Mitgeschicktes).
 *  - Ein Fehler hält die Kette nicht an: Der erste Lauf wirft (der Aufrufer
 *    bekommt den Fehler), der zweite läuft trotzdem; das Profil liest frisch.
 *  - Hängt ein Speichern, startet das nächste nicht daneben: Nach der
 *    Höchstwartezeit kommt der Satz mit Ausweg, ohne dass geschrieben wurde; die Kette wartet weiter auf das hängende. Kommt es
 *    doch zurück, läuft das nächste wieder normal.
 *  - Die Formulare zeigen jeden Fehler als Satz, auch eine gescheiterte
 *    Anfrage (speichernOhneWurf) — statt der Fehlerseite, die Eingabe bleibt.
 *  - Sentry sieht die gescheiterte Anfrage trotzdem (Runde 2): Klasse und
 *    bereinigte Nachricht, nie Formularwerte; ein Netzabbruch nur als
 *    Brotkrume; scheitert Sentry selbst, kommt der Satz trotzdem.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ABSCHNITT_SPEICHERN_TEXT } from '@/lib/abschnitt-stand'
import { NETZ_SATZ, NETZ_SATZ_UNSICHER } from '@/lib/netz'

const aktion = vi.hoisted(() => ({
  saveAppearanceAction: vi.fn(),
  ladeProfilStand: vi.fn(),
  updateProfile: vi.fn(),
}))
vi.mock('@/server/actions/appearance', () => ({
  saveAppearanceAction: aktion.saveAppearanceAction,
}))
vi.mock('@/server/actions/farm', () => ({
  ladeProfilStand: aktion.ladeProfilStand,
  updateProfile: aktion.updateProfile,
}))
const sentry = vi.hoisted(() => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)

const PROFIL = {
  name: 'Hof Test', ownerName: 'Max Mustermann', description: 'Gemüse aus Musterdorf', address: 'Musterweg 1',
  postalCode: '4900', city: 'Musterdorf', country: 'AT', phone: '+43 660 0000000', email: 'hof@example.com',
  latitude: null, longitude: null, betriebsnummer: null, betriebsstatus: null,
}

/** Jeder Test bekommt ein frisches Modul — die Kette ist Zustand des Moduls. */
async function speicherweg() {
  vi.resetModules()
  return import('@/components/mein-hof/abschnitt-speichern')
}

/** Eine Antwort der Aktion, die erst kommt, wenn der Test sie freigibt. */
function spaeteAntwort() {
  let freigeben: (antwort: { error?: string }) => void = () => {}
  const antwort = new Promise<{ error?: string }>((fertig) => {
    freigeben = fertig
  })
  return { antwort, freigeben: (wert: { error?: string } = {}) => freigeben(wert) }
}

beforeEach(() => {
  vi.clearAllMocks()
  aktion.saveAppearanceAction.mockResolvedValue({})
  aktion.ladeProfilStand.mockResolvedValue({ profil: PROFIL })
  aktion.updateProfile.mockResolvedValue({})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('nacheinander', () => {
  it('das zweite Speichern beginnt erst, wenn das erste geschrieben hat — auch Profil nach Auftritt', async () => {
    const { speichereAuftritt, speichereProfil } = await speicherweg()
    const erstes = spaeteAntwort()
    aktion.saveAppearanceAction.mockReturnValueOnce(erstes.antwort)

    const eins = speichereAuftritt({ tagline: 'Eins' })
    const zwei = speichereProfil({ phone: '+43 664 0000000' })
    await vi.waitFor(() => expect(aktion.saveAppearanceAction).toHaveBeenCalledTimes(1))
    expect(aktion.ladeProfilStand).not.toHaveBeenCalled()

    erstes.freigeben()
    await expect(eins).resolves.toEqual({})
    await expect(zwei).resolves.toEqual({})
    expect(aktion.ladeProfilStand).toHaveBeenCalledTimes(1)
    expect(aktion.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ name: 'Hof Test', phone: '+43 664 0000000' }))
  })
})

describe('speichereAuftritt schickt nur den eigenen Abschnitt (Nr. 65)', () => {
  it('nur der Teil geht an die Aktion — Werte nach Platz, kein Stand wird vorher gelesen', async () => {
    const { speichereAuftritt } = await speicherweg()

    await expect(speichereAuftritt({ farmValues: [{ icon: 'bio', title: 'Bio-zertifiziert', subtitle: '', sortOrder: 3 }] })).resolves.toEqual({})

    expect(aktion.saveAppearanceAction).toHaveBeenCalledTimes(1)
    expect(aktion.saveAppearanceAction).toHaveBeenCalledWith({ farmValues: [{ icon: 'bio', title: 'Bio-zertifiziert', subtitle: null, sortOrder: 0 }] })
    expect(aktion.ladeProfilStand).not.toHaveBeenCalled()
  })
})

describe('ein Fehler hält die Kette nicht an', () => {
  it('der erste Lauf wirft, der zweite läuft trotzdem — mit seinem eigenen Teil', async () => {
    const { speichereAuftritt } = await speicherweg()
    aktion.saveAppearanceAction.mockRejectedValueOnce(new Error('Netz weg'))

    const eins = speichereAuftritt({ tagline: 'Eins' })
    const zwei = speichereAuftritt({ aboutText: 'Zwei' })

    // Der Aufrufer bekommt den Fehler (das Formular zeigt dann seinen Satz).
    await expect(eins).rejects.toThrow('Netz weg')
    await expect(zwei).resolves.toEqual({})
    expect(aktion.saveAppearanceAction).toHaveBeenCalledTimes(2)
    expect(aktion.saveAppearanceAction).toHaveBeenLastCalledWith({ aboutText: 'Zwei' })
  })

  it('das Profil liest nach einem Fehler frisch', async () => {
    const { speichereProfil } = await speicherweg()
    aktion.ladeProfilStand.mockResolvedValueOnce({ profil: PROFIL }).mockResolvedValueOnce({ profil: { ...PROFIL, name: 'Hof Inzwischen' } })
    aktion.updateProfile.mockRejectedValueOnce(new Error('Netz weg'))

    const eins = speichereProfil({ phone: '+43 664 0000000' })
    const zwei = speichereProfil({ phone: '+43 676 0000000' })

    await expect(eins).rejects.toThrow('Netz weg')
    await expect(zwei).resolves.toEqual({})
    expect(aktion.ladeProfilStand).toHaveBeenCalledTimes(2)
    // Mit dem Stand des zweiten Lesens, nicht dem des ersten.
    expect(aktion.updateProfile).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Hof Inzwischen', phone: '+43 676 0000000' }))
  })

  it('auch ein Fehler beim Lesen hält sie nicht an', async () => {
    const { speichereAuftritt, speichereProfil } = await speicherweg()
    aktion.ladeProfilStand.mockRejectedValueOnce(new Error('Netz weg'))

    await expect(speichereProfil({ phone: '+43 664 0000000' })).rejects.toThrow('Netz weg')
    await expect(speichereAuftritt({ tagline: 'Zwei' })).resolves.toEqual({})
    expect(aktion.updateProfile).not.toHaveBeenCalled()
    expect(aktion.saveAppearanceAction).toHaveBeenCalledTimes(1)
  })
})

describe('ein hängendes Speichern', () => {
  it('das nächste startet nicht daneben: nach der Höchstwartezeit der Satz, die Kette wartet weiter', async () => {
    vi.useFakeTimers()
    const { speichereAuftritt, KETTE_WARTET_HOECHSTENS_MS } = await speicherweg()
    const haengt = spaeteAntwort()
    aktion.saveAppearanceAction.mockReturnValueOnce(haengt.antwort)

    const eins = speichereAuftritt({ tagline: 'Eins' })
    const zwei = speichereAuftritt({ tagline: 'Zwei' })
    await vi.advanceTimersByTimeAsync(KETTE_WARTET_HOECHSTENS_MS - 1)
    // Gegenprobe: vor Ablauf der Wartezeit wartet es noch.
    expect(aktion.saveAppearanceAction).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await expect(zwei).resolves.toEqual({ error: ABSCHNITT_SPEICHERN_TEXT.vorigesHaengt })
    // Nichts geschrieben — nichts lief neben dem hängenden.
    expect(aktion.saveAppearanceAction).toHaveBeenCalledTimes(1)

    // Auch das nächste wartet noch auf das hängende.
    const drei = speichereAuftritt({ tagline: 'Drei' })
    await vi.advanceTimersByTimeAsync(KETTE_WARTET_HOECHSTENS_MS)
    await expect(drei).resolves.toEqual({ error: ABSCHNITT_SPEICHERN_TEXT.vorigesHaengt })
    expect(aktion.saveAppearanceAction).toHaveBeenCalledTimes(1)

    // Kommt das hängende doch zurück, läuft das nächste wieder normal.
    haengt.freigeben()
    await expect(eins).resolves.toEqual({})
    const vier = speichereAuftritt({ tagline: 'Vier' })
    await vi.advanceTimersByTimeAsync(0)
    await expect(vier).resolves.toEqual({})
    expect(aktion.saveAppearanceAction).toHaveBeenCalledTimes(2)
    expect(aktion.saveAppearanceAction).toHaveBeenLastCalledWith(expect.objectContaining({ tagline: 'Vier' }))
  })

  it('der Satz sagt, was zu tun ist — per Du, mit Ausweg', () => {
    expect(ABSCHNITT_SPEICHERN_TEXT.vorigesHaengt).toMatch(/Lade die Seite neu/)
  })
})

describe('Fehler im Formular statt Fehlerseite (speichernOhneWurf)', () => {
  it('eine am Netz gescheiterte Anfrage wird zum Netzsatz (Register N29, Nr. 175)', async () => {
    const { speichernOhneWurf } = await speicherweg()
    await expect(speichernOhneWurf(() => Promise.reject(new TypeError('Failed to fetch')))).resolves.toBe(NETZ_SATZ)
  })

  it('Gegenprobe: eine aus anderem Grund gescheiterte Anfrage bleibt beim Satz mit Ausweg', async () => {
    const { speichernOhneWurf } = await speicherweg()
    await expect(speichernOhneWurf(() => Promise.reject(new Error('kaputt')))).resolves.toBe(ABSCHNITT_SPEICHERN_TEXT.gingNicht)
    expect(ABSCHNITT_SPEICHERN_TEXT.gingNicht).toBe('Wir konnten das gerade nicht speichern. Versuch es noch einmal.')
  })

  it('aktionOhneWurf gibt die ganze Antwort durch und macht aus einem Wurf { error }', async () => {
    const { aktionOhneWurf } = await speicherweg()
    await expect(aktionOhneWurf(async () => ({ ok: true as const, zahl: 3 }))).resolves.toEqual({ ok: true, zahl: 3 })
    await expect(aktionOhneWurf(() => Promise.reject(new TypeError('Load failed')))).resolves.toEqual({ error: NETZ_SATZ, netz: true })
    await expect(aktionOhneWurf(() => Promise.reject(new Error('kaputt')))).resolves.toEqual({ error: ABSCHNITT_SPEICHERN_TEXT.gingNicht })
  })

  it('aktionOhneWurf mit unsicher: am Netz der Satz ohne Nochmal, sonst wie sonst (Ergänzung N29)', async () => {
    const { aktionOhneWurf } = await speicherweg()
    await expect(aktionOhneWurf(() => Promise.reject(new TypeError('Load failed')), { unsicher: true })).resolves.toEqual({
      error: NETZ_SATZ_UNSICHER,
      unsicher: true,
    })
    // Gegenproben: ohne die Option bleibt der alte Satz mit Nochmal; ein Programmierfehler ist kein Funkloch; Erfolg kommt durch.
    await expect(aktionOhneWurf(() => Promise.reject(new TypeError('Load failed')))).resolves.toEqual({ error: NETZ_SATZ, netz: true })
    await expect(aktionOhneWurf(() => Promise.reject(new Error('kaputt')), { unsicher: true })).resolves.toEqual({ error: ABSCHNITT_SPEICHERN_TEXT.gingNicht })
    await expect(aktionOhneWurf(async () => ({ ok: true as const }), { unsicher: true })).resolves.toEqual({ ok: true })
  })

  it('der Satz der Aktion bleibt, wie er ist; ohne Fehler null', async () => {
    const { speichernOhneWurf } = await speicherweg()
    await expect(speichernOhneWurf(async () => ({ error: 'Der Leitspruch darf höchstens 60 Zeichen haben — bitte kürzen.' }))).resolves.toBe(
      'Der Leitspruch darf höchstens 60 Zeichen haben — bitte kürzen.'
    )
    await expect(speichernOhneWurf(async () => ({}))).resolves.toBeNull()
  })

  it('die Formulare der Abschnitte speichern nur darüber', () => {
    const formulare = readFileSync(join(process.cwd(), 'src/components/mein-hof/abschnitt-formulare.tsx'), 'utf8')
    expect(formulare).toMatch(/const satz = await speichernOhneWurf\(speichern\)\s*if \(satz\) \{\s*setFehler\(satz\)/)
    // Gegenprobe: der alte Weg (ein Wurf ginge an die Fehlergrenze) steht nicht mehr da.
    expect(formulare).not.toMatch(/const antwort = await speichern\(\)/)
  })
})

describe('Sentry sieht die gescheiterte Anfrage (speichernOhneWurf)', () => {
  /** So wirft Next.js, wenn die Aktion nach einem Deploy unbekannt ist (server-action-reducer). */
  function aktionUnbekannt(): Error {
    const fehler = new Error(
      'Server Action "7f2c9d1e4b3a59687c0d1e2f3a4b5c6d7e8f9a0b1c" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action'
    )
    fehler.name = 'UnrecognizedActionError'
    return fehler
  }

  it('meldet Klasse und bereinigte Nachricht — ohne Kennung der Aktion, ohne Adresse', async () => {
    const { speichernOhneWurf } = await speicherweg()
    await expect(speichernOhneWurf(() => Promise.reject(aktionUnbekannt()))).resolves.toBe(ABSCHNITT_SPEICHERN_TEXT.gingNicht)

    expect(sentry.captureException).toHaveBeenCalledTimes(1)
    const [ereignis, kontext] = sentry.captureException.mock.calls[0]
    expect(ereignis).toBeInstanceOf(Error)
    expect(ereignis.name).toBe('UnrecognizedActionError')
    expect(ereignis.message).toBe('Mein Hof: Speichern gescheitert')
    expect(kontext).toEqual({
      level: 'error',
      tags: { bereich: 'mein-hof-speichern', klasse: 'UnrecognizedActionError' },
      extra: { fehlertext: expect.stringContaining('was not found on the server') },
    })
    expect(kontext.extra.fehlertext).not.toContain('7f2c9d1e4b3a59687c0d1e2f3a4b5c6d7e8f9a0b1c')
    expect(kontext.extra.fehlertext).not.toContain('https://')
    expect(sentry.addBreadcrumb).not.toHaveBeenCalled()
  })

  it('nie Formularwerte — auch nicht, wenn der Fehler aus dem Speichern mit ihnen kommt', async () => {
    const { speichernOhneWurf } = await speicherweg()
    const formular = { email: 'hof-27@example.com', phone: '+43 660 0000000', address: 'Musterweg 1' }
    // Ein Programmierfehler ist auch ein TypeError — aber kein Netzabbruch: Er wird gemeldet.
    const geworfen = speichernOhneWurf(async () => {
      throw new TypeError(`Cannot read properties of undefined (reading 'trim') bei ${formular.email}`)
    })
    await expect(geworfen).resolves.toBe(ABSCHNITT_SPEICHERN_TEXT.gingNicht)

    expect(sentry.captureException).toHaveBeenCalledTimes(1)
    const gesendet = JSON.stringify(sentry.captureException.mock.calls[0], (_schluessel, wert) =>
      wert instanceof Error ? { name: wert.name, message: wert.message } : wert
    )
    expect(gesendet).toContain('TypeError')
    expect(gesendet).toContain('[e-mail]')
    for (const wert of Object.values(formular)) expect(gesendet).not.toContain(wert)
  })

  it('ein Netzabbruch ist nur eine Brotkrume, kein Befund', async () => {
    const { speichernOhneWurf } = await speicherweg()
    await expect(speichernOhneWurf(() => Promise.reject(new TypeError('Failed to fetch')))).resolves.toBe(NETZ_SATZ)

    expect(sentry.captureException).not.toHaveBeenCalled()
    expect(sentry.addBreadcrumb).toHaveBeenCalledTimes(1)
    expect(sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'mein-hof',
      level: 'warning',
      message: 'Speichern: Verbindung abgebrochen',
      data: { klasse: 'TypeError' },
    })
  })

  it('scheitert Sentry selbst, kommt der Satz trotzdem', async () => {
    const { speichernOhneWurf } = await speicherweg()
    sentry.captureException.mockImplementationOnce(() => {
      throw new Error('Sentry kaputt')
    })
    await expect(speichernOhneWurf(() => Promise.reject(aktionUnbekannt()))).resolves.toBe(ABSCHNITT_SPEICHERN_TEXT.gingNicht)
  })

  it('ein Satz der Aktion ist kein Fehler — Sentry bleibt still', async () => {
    const { speichernOhneWurf } = await speicherweg()
    await speichernOhneWurf(async () => ({ error: ABSCHNITT_SPEICHERN_TEXT.nichtAngemeldet }))
    await speichernOhneWurf(async () => ({}))
    expect(sentry.captureException).not.toHaveBeenCalled()
    expect(sentry.addBreadcrumb).not.toHaveBeenCalled()
  })

  it('eine Klasse, die nicht wie ein Name aussieht, geht nicht mit', async () => {
    const { speichernOhneWurf } = await speicherweg()
    const fehler = new Error('kaputt')
    fehler.name = 'hof-27@example.com'
    await speichernOhneWurf(() => Promise.reject(fehler))
    const [ereignis, kontext] = sentry.captureException.mock.calls[0]
    expect(ereignis.name).toBe('Unbekannt')
    expect(kontext.tags.klasse).toBe('Unbekannt')
  })
})
