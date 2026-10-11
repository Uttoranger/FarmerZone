/**
 * Die Kette des Speicherwegs der Abschnitte von Mein Hof
 * (components/mein-hof/abschnitt-speichern.ts, Nr. 50 Runde 1) — mit
 * nachgebildeten Aktionen. Den Zustand in einem echten Postgres prüft
 * tests/integration/auftritt-abschnitte.int.test.ts.
 *
 * Beweist:
 *  - Nacheinander: Das zweite Speichern liest erst, wenn das erste geschrieben
 *    hat — auch zwischen Auftritt und Profil (eine Kette je Fenster).
 *  - Ein Fehler hält die Kette nicht an: Der erste Lauf wirft (der Aufrufer
 *    bekommt den Fehler), der zweite läuft trotzdem und liest frisch.
 *  - Hängt ein Speichern, startet das nächste nicht daneben: Nach der
 *    Höchstwartezeit kommt der Satz mit Ausweg, ohne dass gelesen oder
 *    geschrieben wurde; die Kette wartet weiter auf das hängende. Kommt es
 *    doch zurück, läuft das nächste wieder normal.
 *  - Die Formulare zeigen jeden Fehler als Satz, auch eine gescheiterte
 *    Anfrage (speichernOhneWurf) — statt der Fehlerseite, die Eingabe bleibt.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ABSCHNITT_SPEICHERN_TEXT, type AuftrittStand } from '@/lib/abschnitt-stand'

const aktion = vi.hoisted(() => ({
  ladeAuftrittStand: vi.fn(),
  saveAppearanceAction: vi.fn(),
  ladeProfilStand: vi.fn(),
  updateProfile: vi.fn(),
}))
vi.mock('@/server/actions/appearance', () => ({
  ladeAuftrittStand: aktion.ladeAuftrittStand,
  saveAppearanceAction: aktion.saveAppearanceAction,
}))
vi.mock('@/server/actions/farm', () => ({
  ladeProfilStand: aktion.ladeProfilStand,
  updateProfile: aktion.updateProfile,
}))

const STAND: AuftrittStand = { tagline: 'Alt', foundedYear: null, aboutText: 'Über uns von früher', sectionsConfig: [], farmValues: [] }
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
  aktion.ladeAuftrittStand.mockResolvedValue({ stand: STAND })
  aktion.saveAppearanceAction.mockResolvedValue({})
  aktion.ladeProfilStand.mockResolvedValue({ profil: PROFIL })
  aktion.updateProfile.mockResolvedValue({})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('nacheinander', () => {
  it('das zweite Speichern liest erst, wenn das erste geschrieben hat — auch Profil nach Auftritt', async () => {
    const { speichereAuftritt, speichereProfil } = await speicherweg()
    const erstes = spaeteAntwort()
    aktion.saveAppearanceAction.mockReturnValueOnce(erstes.antwort)

    const eins = speichereAuftritt({ tagline: 'Eins' })
    const zwei = speichereProfil({ phone: '+43 660 1111111' })
    await vi.waitFor(() => expect(aktion.saveAppearanceAction).toHaveBeenCalledTimes(1))
    expect(aktion.ladeProfilStand).not.toHaveBeenCalled()

    erstes.freigeben()
    await expect(eins).resolves.toEqual({})
    await expect(zwei).resolves.toEqual({})
    expect(aktion.ladeProfilStand).toHaveBeenCalledTimes(1)
    expect(aktion.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ name: 'Hof Test', phone: '+43 660 1111111' }))
  })
})

describe('ein Fehler hält die Kette nicht an', () => {
  it('der erste Lauf wirft, der zweite läuft trotzdem und liest frisch', async () => {
    const { speichereAuftritt } = await speicherweg()
    aktion.ladeAuftrittStand
      .mockResolvedValueOnce({ stand: STAND })
      .mockResolvedValueOnce({ stand: { ...STAND, aboutText: 'Inzwischen gespeichert' } })
    aktion.saveAppearanceAction.mockRejectedValueOnce(new Error('Netz weg'))

    const eins = speichereAuftritt({ tagline: 'Eins' })
    const zwei = speichereAuftritt({ tagline: 'Zwei' })

    // Der Aufrufer bekommt den Fehler (das Formular zeigt dann seinen Satz).
    await expect(eins).rejects.toThrow('Netz weg')
    await expect(zwei).resolves.toEqual({})
    expect(aktion.ladeAuftrittStand).toHaveBeenCalledTimes(2)
    // Mit dem Stand des zweiten Lesens, nicht dem des ersten.
    expect(aktion.saveAppearanceAction).toHaveBeenLastCalledWith(expect.objectContaining({ tagline: 'Zwei', aboutText: 'Inzwischen gespeichert' }))
  })

  it('auch ein Fehler beim Lesen hält sie nicht an', async () => {
    const { speichereAuftritt } = await speicherweg()
    aktion.ladeAuftrittStand.mockRejectedValueOnce(new Error('Netz weg'))

    await expect(speichereAuftritt({ tagline: 'Eins' })).rejects.toThrow('Netz weg')
    await expect(speichereAuftritt({ tagline: 'Zwei' })).resolves.toEqual({})
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
    expect(aktion.ladeAuftrittStand).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await expect(zwei).resolves.toEqual({ error: ABSCHNITT_SPEICHERN_TEXT.vorigesHaengt })
    // Weder gelesen noch geschrieben — nichts lief neben dem hängenden.
    expect(aktion.ladeAuftrittStand).toHaveBeenCalledTimes(1)
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
  it('eine gescheiterte Anfrage wird zum Satz mit Ausweg', async () => {
    const { speichernOhneWurf } = await speicherweg()
    await expect(speichernOhneWurf(() => Promise.reject(new TypeError('Failed to fetch')))).resolves.toBe(ABSCHNITT_SPEICHERN_TEXT.gingNicht)
    expect(ABSCHNITT_SPEICHERN_TEXT.gingNicht).toBe('Wir konnten das gerade nicht speichern. Versuch es noch einmal.')
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
