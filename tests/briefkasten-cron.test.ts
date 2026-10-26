/**
 * Tests für den Wochenlauf (src/app/api/cron/briefkasten/route.ts, Sprint
 * fehlerbriefkasten Teil F) — Datenbank, Mail und Blob gemockt.
 *
 * Beweist: ohne Secret oder mit falschem Bearer 401 und KEIN Zugriff auf die
 * Datenbank; die Zusammenfassung geht nur bei neuen oder liegen gebliebenen
 * Meldungen; die 90-Tage-Auswahl löscht nur abgeschlossene, alte Meldungen
 * samt Screenshot; ein scheiternder Blob-Aufruf hält die Löschung nicht auf.
 * Seit Nr. 95 (Register N14): Die Mail geht an die Empfängerliste der
 * Zustellung (empfaengerFuer('wochenbericht')); Regel aus (leere Liste) heißt
 * keine Mail, auch wenn etwas offen ist. Seit Nr. 159 je Adresse ein Auftrag
 * der Warteschlange (Wichtig); die Zahlen zählt der Renderer beim Versand.
 * Seit Nr. 192 geht die Wochenlage jede Woche, auch wenn im Eingang nichts
 * offen ist; nur die Regel der Zustellung entscheidet.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@vercel/blob', () => ({ del: vi.fn() }))
// Der Herzschlag-Rahmen (Nr. 103) reicht den Wochenlauf unverändert durch (tests/betrieb-herzschlag.test.ts).
vi.mock('@/server/betrieb', () => ({ mitHerzschlag: vi.fn(async (_name: string, lauf: () => Promise<unknown>) => lauf()) }))
vi.mock('@/server/mail-warteschlange', () => ({ stelleMailEin: vi.fn() }))
// Die Kennung der weiteren Adresse aus der Zustellung (empfaengerKennungen).
vi.mock('@/lib/prisma', () => ({ prisma: { betreiberEmpfaenger: { findMany: vi.fn(async () => [{ id: 'cteamaaaaaaaaaaaaaaaaaaa1', email: 'team@example.com' }]) } } }))
vi.mock('@/server/queries/postfach', () => ({ ladeBetreiberEmpfaenger: vi.fn(), zaehleOffenImEingang: vi.fn() }))
vi.mock('@/server/queries/meldung', () => ({
  findeHauptmeldungen: vi.fn(),
  findeLoeschKandidaten: vi.fn(),
  loescheMeldungen: vi.fn(),
  zaehleFuerWochenlauf: vi.fn(),
}))

import { GET } from '@/app/api/cron/briefkasten/route'
import { del } from '@vercel/blob'
import { stelleMailEin } from '@/server/mail-warteschlange'
import { SUPPORT_EMAIL } from '@/lib/support'
import { findeHauptmeldungen, findeLoeschKandidaten, loescheMeldungen, zaehleFuerWochenlauf } from '@/server/queries/meldung'
import { ladeBetreiberEmpfaenger, zaehleOffenImEingang } from '@/server/queries/postfach'
import { AUFBEWAHRUNG_TAGE } from '@/lib/meldung'

const blobDel = vi.mocked(del)
const mail = vi.mocked(stelleMailEin)
const kandidaten = vi.mocked(findeLoeschKandidaten)
const hauptmeldungen = vi.mocked(findeHauptmeldungen)
const loeschen = vi.mocked(loescheMeldungen)
const zaehlen = vi.mocked(zaehleFuerWochenlauf)
const liste = vi.mocked(ladeBetreiberEmpfaenger)
const eingang = vi.mocked(zaehleOffenImEingang)
const LISTE = [SUPPORT_EMAIL.toLowerCase(), 'team@example.com']

/** Je Adresse ein Auftrag „wochenbericht" mit der Zahl der eben gelöschten Meldungen; der Tag macht den Schlüssel eindeutig. */
function erwarteBericht(geloescht = 0): void {
  expect(mail).toHaveBeenCalledTimes(1)
  expect(mail.mock.calls[0]![0]).toEqual([
    expect.objectContaining({ art: 'wochenbericht', vorrang: 1, schluessel: 'wochenbericht:2026-09-14:support', bezug: { empfaengerId: 'support', geloeschtAnzahl: String(geloescht) } }),
    expect.objectContaining({
      art: 'wochenbericht',
      schluessel: 'wochenbericht:2026-09-14:cteamaaaaaaaaaaaaaaaaaaa1',
      bezug: { empfaengerId: 'cteamaaaaaaaaaaaaaaaaaaa1', geloeschtAnzahl: String(geloescht) },
    }),
  ])
}

const JETZT = new Date('2026-09-14T05:00:00.000Z')
const TAG = 24 * 60 * 60 * 1000
const vorTagen = (n: number) => new Date(JETZT.getTime() - n * TAG)

function anfrage(auth?: string) {
  return new NextRequest('http://localhost/api/cron/briefkasten', {
    headers: auth ? { authorization: auth } : {},
  })
}

const RUHIG = { neu: 0, liegenGeblieben: 0, offen: 0, neueste: [] }
const NICHTS_OFFEN = { antworten: 0, meldungen: 0, hoefe: 0, erstattungen: 0, gesamt: 0 }
const offenImEingang = (z: Partial<typeof NICHTS_OFFEN>) => {
  const zahlen = { ...NICHTS_OFFEN, ...z }
  return { ...zahlen, gesamt: zahlen.antworten + zahlen.meldungen + zahlen.hoefe + zahlen.erstattungen }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(JETZT)
  vi.stubEnv('CRON_SECRET', 'geheim-123')
  kandidaten.mockResolvedValue([])
  hauptmeldungen.mockResolvedValue(new Map())
  loeschen.mockResolvedValue(0)
  zaehlen.mockResolvedValue(RUHIG)
  mail.mockResolvedValue(2)
  liste.mockResolvedValue(LISTE)
  eingang.mockResolvedValue(NICHTS_OFFEN)
  blobDel.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('Wochenlauf — Zugriff', () => {
  it('ohne Authorization: 401, nichts gelesen, nichts gelöscht', async () => {
    const res = await GET(anfrage())
    expect(res.status).toBe(401)
    expect(kandidaten).not.toHaveBeenCalled()
    expect(loeschen).not.toHaveBeenCalled()
    expect(mail).not.toHaveBeenCalled()
  })

  it('mit falschem Bearer: 401', async () => {
    const res = await GET(anfrage('Bearer falsch'))
    expect(res.status).toBe(401)
    expect(kandidaten).not.toHaveBeenCalled()
  })

  it('ohne konfiguriertes Secret: 401 auch mit leerem Bearer — fail-closed', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const res = await GET(anfrage('Bearer '))
    expect(res.status).toBe(401)
    expect(kandidaten).not.toHaveBeenCalled()
  })

  it('mit richtigem Bearer: 200 und Bericht', async () => {
    const res = await GET(anfrage('Bearer geheim-123'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ zusammenfassung: true, neu: 0, liegenGeblieben: 0, geloescht: 0 })
  })
})

describe('Wochenlauf — Zusammenfassung', () => {
  it('schickt die Wochenlage auch in einer ruhigen Woche (nichts neu, nichts offen)', async () => {
    const res = await GET(anfrage('Bearer geheim-123'))
    expect(liste).toHaveBeenCalledWith('wochenbericht')
    erwarteBericht()
    expect(await res.json()).toMatchObject({ zusammenfassung: true, offenImEingang: 0 })
  })

  it('schickt eine Mail bei neuen Meldungen', async () => {
    zaehlen.mockResolvedValue({ neu: 2, liegenGeblieben: 0, offen: 2, neueste: [] })
    eingang.mockResolvedValue(offenImEingang({ meldungen: 2 }))
    const res = await GET(anfrage('Bearer geheim-123'))
    erwarteBericht()
    expect(liste).toHaveBeenCalledWith('wochenbericht')
    expect(await res.json()).toMatchObject({ zusammenfassung: true, neu: 2 })
  })

  it('Regel „Wochenbericht" aus (leere Liste): keine Mail, obwohl etwas offen ist', async () => {
    zaehlen.mockResolvedValue({ neu: 2, liegenGeblieben: 1, offen: 3, neueste: [] })
    eingang.mockResolvedValue(offenImEingang({ meldungen: 3, hoefe: 1 }))
    liste.mockResolvedValue([])
    const res = await GET(anfrage('Bearer geheim-123'))
    expect(mail).not.toHaveBeenCalled()
    expect(await res.json()).toMatchObject({ zusammenfassung: false, neu: 2 })
  })

  it('Regel aus in einer ruhigen Woche: keine Mail (Gegenprobe)', async () => {
    liste.mockResolvedValue([])
    const res = await GET(anfrage('Bearer geheim-123'))
    expect(mail).not.toHaveBeenCalled()
    expect(await res.json()).toMatchObject({ zusammenfassung: false })
  })

  it('nur eine Aufgabe offen (Hof wartet), keine Meldung: der Bericht geht trotzdem', async () => {
    eingang.mockResolvedValue(offenImEingang({ hoefe: 1 }))
    const res = await GET(anfrage('Bearer geheim-123'))
    expect(liste).toHaveBeenCalledWith('wochenbericht')
    erwarteBericht()
    expect(await res.json()).toMatchObject({ zusammenfassung: true, offenImEingang: 1 })
  })

  it('nur eine offene Erstattung oder eine ungelesene Antwort: der Bericht geht', async () => {
    eingang.mockResolvedValue(offenImEingang({ erstattungen: 1 }))
    await GET(anfrage('Bearer geheim-123'))
    eingang.mockResolvedValue(offenImEingang({ antworten: 1 }))
    await GET(anfrage('Bearer geheim-123'))
    expect(mail).toHaveBeenCalledTimes(2)
  })

  it('Regel aus und nur eine Aufgabe offen: kein Bericht', async () => {
    eingang.mockResolvedValue(offenImEingang({ hoefe: 1 }))
    liste.mockResolvedValue([])
    await GET(anfrage('Bearer geheim-123'))
    expect(mail).not.toHaveBeenCalled()
  })

  it('nichts im Eingang offen: die Wochenlage geht trotzdem, offenImEingang bleibt 0', async () => {
    zaehlen.mockResolvedValue({ neu: 0, liegenGeblieben: 1, offen: 1, neueste: [] })
    const res = await GET(anfrage('Bearer geheim-123'))
    expect(liste).toHaveBeenCalledWith('wochenbericht')
    erwarteBericht()
    expect(await res.json()).toMatchObject({ zusammenfassung: true, offenImEingang: 0 })
  })

  it('schickt eine Mail, wenn Meldungen länger als 14 Tage in NEU/GEPRUEFT stehen', async () => {
    zaehlen.mockResolvedValue({ neu: 0, liegenGeblieben: 1, offen: 3, neueste: [] })
    eingang.mockResolvedValue(offenImEingang({ meldungen: 3 }))
    await GET(anfrage('Bearer geheim-123'))
    erwarteBericht()
  })

  it('übergibt den Stichtag „jetzt" an die Zählung', async () => {
    await GET(anfrage('Bearer geheim-123'))
    expect(zaehlen.mock.calls[0][0].getTime()).toBe(JETZT.getTime())
  })
})

describe('Wochenlauf — Löschung nach 90 Tagen', () => {
  it('löscht nur abgeschlossene Meldungen, deren Abschluss 90 Tage zurückliegt', async () => {
    kandidaten.mockResolvedValue([
      { id: 'alt_erledigt', status: 'ERLEDIGT', triagedAt: vorTagen(AUFBEWAHRUNG_TAGE + 1), createdAt: vorTagen(120), screenshotUrl: null, duplikatVonId: null },
      { id: 'genau_90', status: 'KEIN_FEHLER', triagedAt: vorTagen(AUFBEWAHRUNG_TAGE), createdAt: vorTagen(100), screenshotUrl: null, duplikatVonId: null },
      { id: 'frisch_erledigt', status: 'DUPLIKAT', triagedAt: vorTagen(10), createdAt: vorTagen(100), screenshotUrl: null, duplikatVonId: null },
      { id: 'ohne_triagedAt_alt', status: 'ERLEDIGT', triagedAt: null, createdAt: vorTagen(91), screenshotUrl: null, duplikatVonId: null },
      { id: 'ohne_triagedAt_jung', status: 'ERLEDIGT', triagedAt: null, createdAt: vorTagen(30), screenshotUrl: null, duplikatVonId: null },
    ])
    loeschen.mockResolvedValue(3)

    const res = await GET(anfrage('Bearer geheim-123'))

    expect(loeschen).toHaveBeenCalledTimes(1)
    expect(loeschen.mock.calls[0][0]).toEqual(['alt_erledigt', 'genau_90', 'ohne_triagedAt_alt'])
    expect(await res.json()).toMatchObject({ geloescht: 3 })
  })

  it('löscht die Screenshots der betroffenen Meldungen im Blob-Speicher', async () => {
    kandidaten.mockResolvedValue([
      { id: 'a', status: 'ERLEDIGT', triagedAt: vorTagen(100), createdAt: vorTagen(120), screenshotUrl: 'https://x.public.blob.vercel-storage.com/farms/f/meldung/a.webp', duplikatVonId: null },
      { id: 'b', status: 'ERLEDIGT', triagedAt: vorTagen(100), createdAt: vorTagen(120), screenshotUrl: null, duplikatVonId: null },
      { id: 'c', status: 'ERLEDIGT', triagedAt: vorTagen(1), createdAt: vorTagen(120), screenshotUrl: 'https://x.public.blob.vercel-storage.com/farms/f/meldung/c.webp', duplikatVonId: null },
    ])
    await GET(anfrage('Bearer geheim-123'))
    expect(blobDel).toHaveBeenCalledTimes(1)
    expect(blobDel.mock.calls[0][0]).toBe('https://x.public.blob.vercel-storage.com/farms/f/meldung/a.webp')
    expect(loeschen.mock.calls[0][0]).toEqual(['a', 'b'])
  })

  it('lädt die Hauptmeldungen der Duplikate und lässt ein Duplikat mit offener Hauptmeldung stehen (Nr. 101)', async () => {
    kandidaten.mockResolvedValue([
      { id: 'dup_offen', status: 'DUPLIKAT', triagedAt: vorTagen(200), createdAt: vorTagen(210), screenshotUrl: null, duplikatVonId: 'haupt_offen' },
      { id: 'dup_alt', status: 'DUPLIKAT', triagedAt: vorTagen(5), createdAt: vorTagen(10), screenshotUrl: null, duplikatVonId: 'haupt_alt' },
    ])
    hauptmeldungen.mockResolvedValue(
      new Map([
        ['haupt_offen', { status: 'GEPLANT' as const, triagedAt: vorTagen(150), createdAt: vorTagen(220) }],
        ['haupt_alt', { status: 'ERLEDIGT' as const, triagedAt: vorTagen(91), createdAt: vorTagen(120) }],
      ])
    )
    await GET(anfrage('Bearer geheim-123'))
    expect(hauptmeldungen).toHaveBeenCalledWith(['haupt_offen', 'haupt_alt'])
    expect(loeschen.mock.calls[0][0]).toEqual(['dup_alt'])
  })

  it('lässt einen scheiternden Blob-Aufruf die Löschung nicht aufhalten', async () => {
    kandidaten.mockResolvedValue([
      { id: 'a', status: 'ERLEDIGT', triagedAt: vorTagen(100), createdAt: vorTagen(120), screenshotUrl: 'https://x.public.blob.vercel-storage.com/farms/f/meldung/a.webp', duplikatVonId: null },
    ])
    blobDel.mockRejectedValue(new Error('Blob weg'))
    const res = await GET(anfrage('Bearer geheim-123'))
    expect(res.status).toBe(200)
    expect(loeschen.mock.calls[0][0]).toEqual(['a'])
  })

  it('räumt zuerst auf und zählt danach — die Zusammenfassung nennt den Stand danach', async () => {
    const reihenfolge: string[] = []
    loeschen.mockImplementation(async () => {
      reihenfolge.push('loeschen')
      return 0
    })
    zaehlen.mockImplementation(async () => {
      reihenfolge.push('zaehlen')
      return RUHIG
    })
    await GET(anfrage('Bearer geheim-123'))
    expect(reihenfolge).toEqual(['loeschen', 'zaehlen'])
  })
})
