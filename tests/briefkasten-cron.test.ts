/**
 * Tests für den Wochenlauf (src/app/api/cron/briefkasten/route.ts, Sprint
 * fehlerbriefkasten Teil F) — Datenbank, Mail und Blob gemockt.
 *
 * Beweist: ohne Secret oder mit falschem Bearer 401 und KEIN Zugriff auf die
 * Datenbank; die Zusammenfassung geht nur bei neuen oder liegen gebliebenen
 * Meldungen; die 90-Tage-Auswahl löscht nur abgeschlossene, alte Meldungen
 * samt Screenshot; ein scheiternder Blob-Aufruf hält die Löschung nicht auf.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@vercel/blob', () => ({ del: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendBriefkastenZusammenfassung: vi.fn() }))
vi.mock('@/server/queries/meldung', () => ({
  findeLoeschKandidaten: vi.fn(),
  loescheMeldungen: vi.fn(),
  zaehleFuerWochenlauf: vi.fn(),
}))

import { GET } from '@/app/api/cron/briefkasten/route'
import { del } from '@vercel/blob'
import { sendBriefkastenZusammenfassung } from '@/lib/email'
import { findeLoeschKandidaten, loescheMeldungen, zaehleFuerWochenlauf } from '@/server/queries/meldung'
import { AUFBEWAHRUNG_TAGE } from '@/lib/meldung'

const blobDel = vi.mocked(del)
const mail = vi.mocked(sendBriefkastenZusammenfassung)
const kandidaten = vi.mocked(findeLoeschKandidaten)
const loeschen = vi.mocked(loescheMeldungen)
const zaehlen = vi.mocked(zaehleFuerWochenlauf)

const JETZT = new Date('2026-09-14T05:00:00.000Z')
const TAG = 24 * 60 * 60 * 1000
const vorTagen = (n: number) => new Date(JETZT.getTime() - n * TAG)

function anfrage(auth?: string) {
  return new NextRequest('http://localhost/api/cron/briefkasten', {
    headers: auth ? { authorization: auth } : {},
  })
}

const RUHIG = { neu: 0, liegenGeblieben: 0, offen: 0, neueste: [] }

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(JETZT)
  vi.stubEnv('CRON_SECRET', 'geheim-123')
  kandidaten.mockResolvedValue([])
  loeschen.mockResolvedValue(0)
  zaehlen.mockResolvedValue(RUHIG)
  mail.mockResolvedValue(undefined)
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
    expect(await res.json()).toMatchObject({ zusammenfassung: false, neu: 0, liegenGeblieben: 0, geloescht: 0 })
  })
})

describe('Wochenlauf — Zusammenfassung', () => {
  it('schickt KEINE Mail, wenn nichts neu ist und nichts liegt', async () => {
    await GET(anfrage('Bearer geheim-123'))
    expect(mail).not.toHaveBeenCalled()
  })

  it('schickt eine Mail bei neuen Meldungen', async () => {
    zaehlen.mockResolvedValue({ neu: 2, liegenGeblieben: 0, offen: 2, neueste: [] })
    const res = await GET(anfrage('Bearer geheim-123'))
    expect(mail).toHaveBeenCalledTimes(1)
    expect(mail).toHaveBeenCalledWith(expect.objectContaining({ neu: 2, geloescht: 0 }))
    expect(await res.json()).toMatchObject({ zusammenfassung: true, neu: 2 })
  })

  it('schickt eine Mail, wenn Meldungen länger als 14 Tage in NEU/GEPRUEFT stehen', async () => {
    zaehlen.mockResolvedValue({ neu: 0, liegenGeblieben: 1, offen: 3, neueste: [] })
    await GET(anfrage('Bearer geheim-123'))
    expect(mail).toHaveBeenCalledTimes(1)
    expect(mail).toHaveBeenCalledWith(expect.objectContaining({ liegenGeblieben: 1 }))
  })

  it('übergibt den Stichtag „jetzt" an die Zählung', async () => {
    await GET(anfrage('Bearer geheim-123'))
    expect(zaehlen.mock.calls[0][0].getTime()).toBe(JETZT.getTime())
  })
})

describe('Wochenlauf — Löschung nach 90 Tagen', () => {
  it('löscht nur abgeschlossene Meldungen, deren Abschluss 90 Tage zurückliegt', async () => {
    kandidaten.mockResolvedValue([
      { id: 'alt_erledigt', status: 'ERLEDIGT', triagedAt: vorTagen(AUFBEWAHRUNG_TAGE + 1), createdAt: vorTagen(120), screenshotUrl: null },
      { id: 'genau_90', status: 'KEIN_FEHLER', triagedAt: vorTagen(AUFBEWAHRUNG_TAGE), createdAt: vorTagen(100), screenshotUrl: null },
      { id: 'frisch_erledigt', status: 'DUPLIKAT', triagedAt: vorTagen(10), createdAt: vorTagen(100), screenshotUrl: null },
      { id: 'ohne_triagedAt_alt', status: 'ERLEDIGT', triagedAt: null, createdAt: vorTagen(91), screenshotUrl: null },
      { id: 'ohne_triagedAt_jung', status: 'ERLEDIGT', triagedAt: null, createdAt: vorTagen(30), screenshotUrl: null },
    ])
    loeschen.mockResolvedValue(3)

    const res = await GET(anfrage('Bearer geheim-123'))

    expect(loeschen).toHaveBeenCalledTimes(1)
    expect(loeschen.mock.calls[0][0]).toEqual(['alt_erledigt', 'genau_90', 'ohne_triagedAt_alt'])
    expect(await res.json()).toMatchObject({ geloescht: 3 })
  })

  it('löscht die Screenshots der betroffenen Meldungen im Blob-Speicher', async () => {
    kandidaten.mockResolvedValue([
      { id: 'a', status: 'ERLEDIGT', triagedAt: vorTagen(100), createdAt: vorTagen(120), screenshotUrl: 'https://x.public.blob.vercel-storage.com/farms/f/meldung/a.webp' },
      { id: 'b', status: 'ERLEDIGT', triagedAt: vorTagen(100), createdAt: vorTagen(120), screenshotUrl: null },
      { id: 'c', status: 'ERLEDIGT', triagedAt: vorTagen(1), createdAt: vorTagen(120), screenshotUrl: 'https://x.public.blob.vercel-storage.com/farms/f/meldung/c.webp' },
    ])
    await GET(anfrage('Bearer geheim-123'))
    expect(blobDel).toHaveBeenCalledTimes(1)
    expect(blobDel.mock.calls[0][0]).toBe('https://x.public.blob.vercel-storage.com/farms/f/meldung/a.webp')
    expect(loeschen.mock.calls[0][0]).toEqual(['a', 'b'])
  })

  it('lässt einen scheiternden Blob-Aufruf die Löschung nicht aufhalten', async () => {
    kandidaten.mockResolvedValue([
      { id: 'a', status: 'ERLEDIGT', triagedAt: vorTagen(100), createdAt: vorTagen(120), screenshotUrl: 'https://x.public.blob.vercel-storage.com/farms/f/meldung/a.webp' },
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
