/**
 * Admin › Einstellungen, Gruppe Gründungshöfe (Register K2-Ergänzung, N15;
 * Nr. 93) — die Prüfungen, das Schema der Action, die Protokollzeile und die
 * Wache der Action. Reine Funktionen ohne Mock; die Action mit gemockter
 * Datenbank und Sitzung, die Berechtigung echt (verlangeAdminAktion).
 *
 * Beweist: Weniger Plätze als vergeben geht nicht (gleich viele schon), ein
 * Ende vor dem heutigen WIENER Tag nicht, heute schon;
 * das Schema gibt nur eigene deutsche Sätze heraus; ohne Admin-Recht wird
 * nichts geschrieben und nichts gelesen; mit Recht nur die Felder der Gruppe.
 * Bis zur Nacharbeit (Runde 1, pruefer-Blocker) sind Plätze gesamt und das
 * Standard-Ende gesperrt: Die Action lehnt jede Abweichung von 12 bzw.
 * 31.12.2027 ab und schreibt nichts — Gegenprobe: nur die Anzeige umschalten
 * geht; das Formular zeigt die zwei Felder nur lesend mit Hinweis.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    plattformEinstellung: { findUnique: vi.fn(), upsert: vi.fn() },
    farm: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { revalidatePath, updateTag } from 'next/cache'
import {
  EINSTELLUNGEN_TEXT,
  GRUENDUNG_EINSTELLUNG_FEHLER,
  PLATTFORM_EINSTELLUNG_STANDARD,
  plattformEinstellungAus,
  protokollZeile,
  pruefeGruendungEingabe,
  pruefeGruendungSperre,
} from '@/lib/plattform-einstellung'
import { einstellungenGruppeSchema, gruendungEinstellungSchema } from '@/schemas/plattform-einstellung'
import { speichereGruendungEinstellung } from '@/server/actions/plattform-einstellung'
import { EinstellungenGruendung } from '@/components/admin/einstellungen-gruendung'

const JETZT = new Date('2026-10-15T10:00:00+02:00')
const GUT = { plaetze: 12, bisTag: '2027-12-31', anzeige: true }

describe('pruefeGruendungEingabe', () => {
  it('Plätze gleich den vergebenen: in Ordnung; einer weniger: der feste Satz', () => {
    expect(pruefeGruendungEingabe({ ...GUT, plaetze: 7 }, 7, JETZT)).toBeNull()
    const satz = pruefeGruendungEingabe({ ...GUT, plaetze: 6 }, 7, JETZT)
    expect(satz).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.weniger(7))
    expect(satz?.startsWith('Weniger Plätze als vergeben geht nicht')).toBe(true)
  })

  it('das Ende: heute (Wiener Tag) in Ordnung, gestern nicht — auch um 0:30 Uhr, wenn in UTC noch gestern ist', () => {
    expect(pruefeGruendungEingabe({ ...GUT, bisTag: '2026-10-15' }, 0, JETZT)).toBeNull()
    expect(pruefeGruendungEingabe({ ...GUT, bisTag: '2026-10-14' }, 0, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.vergangen)
    expect(pruefeGruendungEingabe({ ...GUT, bisTag: '2026-10-15' }, 0, new Date('2026-10-16T00:30:00+02:00'))).toBe(
      GRUENDUNG_EINSTELLUNG_FEHLER.vergangen
    )
  })

  it('kein Kalendertag (30. Februar, leer) und keine ganze Zahl: eigene Sätze', () => {
    expect(pruefeGruendungEingabe({ ...GUT, bisTag: '2027-02-30' }, 0, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.datum)
    expect(pruefeGruendungEingabe({ ...GUT, bisTag: '' }, 0, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.datum)
    expect(pruefeGruendungEingabe({ ...GUT, plaetze: 2.5 }, 0, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.plaetze)
    expect(pruefeGruendungEingabe({ ...GUT, plaetze: -1 }, 0, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.plaetze)
  })
})

describe('pruefeGruendungSperre — Plätze und Standard-Ende bleiben bei den Konstanten', () => {
  it('genau 12 und 31.12.2027: in Ordnung; jede Abweichung: der feste Satz', () => {
    expect(pruefeGruendungSperre(GUT)).toBeNull()
    for (const abweichend of [{ ...GUT, plaetze: 13 }, { ...GUT, plaetze: 11 }, { ...GUT, bisTag: '2028-06-30' }, { ...GUT, bisTag: '2027-12-30' }]) {
      expect(pruefeGruendungSperre(abweichend)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.gesperrt)
    }
  })
})

describe('gruendungEinstellungSchema — nur eigene Sätze, nie Zods englischer Text', () => {
  const satzVon = (eingabe: unknown): string | undefined => {
    const r = gruendungEinstellungSchema.safeParse(eingabe)
    return r.success ? undefined : r.error.issues[0]?.message
  }

  it('lässt eine gültige Eingabe durch', () => {
    expect(gruendungEinstellungSchema.safeParse(GUT).success).toBe(true)
  })

  it.each([
    [{ ...GUT, plaetze: '12' }, GRUENDUNG_EINSTELLUNG_FEHLER.plaetze],
    [{ ...GUT, plaetze: 1.5 }, GRUENDUNG_EINSTELLUNG_FEHLER.plaetze],
    [{ ...GUT, bisTag: 20271231 }, GRUENDUNG_EINSTELLUNG_FEHLER.datum],
    [{ ...GUT, bisTag: '31.12.2027' }, GRUENDUNG_EINSTELLUNG_FEHLER.datum],
    [{ ...GUT, anzeige: 'ja' }, GRUENDUNG_EINSTELLUNG_FEHLER.ungueltig],
    [{ ...GUT, geaendertVonUserId: 'fremd' }, GRUENDUNG_EINSTELLUNG_FEHLER.ungueltig],
    [null, GRUENDUNG_EINSTELLUNG_FEHLER.ungueltig],
  ])('%j → eigener Satz', (eingabe, satz) => {
    expect(satzVon(eingabe)).toBe(satz)
  })

  it('die Gruppe aus der Adresse: Unbekanntes zeigt die erste — „betrieb“ gibt es seit Nr. 103 nicht mehr (die Seite leitet vorher um)', () => {
    expect(einstellungenGruppeSchema.parse('plattform')).toBe('plattform')
    expect(einstellungenGruppeSchema.parse('betrieb')).toBe('gruendung')
    expect(einstellungenGruppeSchema.parse('<script>')).toBe('gruendung')
    expect(einstellungenGruppeSchema.parse(['plattform', 'gruendung'])).toBe('gruendung')
    expect(einstellungenGruppeSchema.parse(undefined)).toBe('gruendung')
  })
})

describe('Protokollzeile und Zeile aus der Datenbank', () => {
  const zeile = {
    gruendungPlaetze: 15,
    gruendungBisStandard: new Date('2028-06-30T00:00:00.000Z'),
    gruendungAnzeige: false,
    geaendertVonUserId: 'admin-1',
    updatedAt: new Date('2026-10-12T19:14:00.000Z'),
  }

  it('die DATE-Spalte wird zum Wiener Kalendertag, der Zeitpunkt zum ISO-Text (JSON für den Cache)', () => {
    expect(plattformEinstellungAus(zeile)).toEqual({
      gruendungPlaetze: 15,
      gruendungBisTag: '2028-06-30',
      gruendungAnzeige: false,
      geaendertVonUserId: 'admin-1',
      geaendertAm: '2026-10-12T19:14:00.000Z',
    })
  })

  it('„Zuletzt geändert von … am …" in Wiener Zeit; nie geändert und gelöschtes Konto mit eigenem Satz', () => {
    expect(protokollZeile(plattformEinstellungAus(zeile), 'Maria Beispiel')).toBe('Zuletzt geändert von Maria Beispiel am 12.10.2026, 21:14')
    expect(protokollZeile(plattformEinstellungAus(zeile), null)).toBe('Zuletzt geändert von einem gelöschten Konto am 12.10.2026, 21:14')
    expect(protokollZeile(PLATTFORM_EINSTELLUNG_STANDARD, 'Maria Beispiel')).toBe('Noch nie geändert – es gelten die Standardwerte.')
  })
})

describe('speichereGruendungEinstellung — die Wache und was geschrieben wird', () => {
  const p = vi.mocked(prisma, { deep: true })
  const getSession = vi.mocked(auth.api.getSession)

  /** Sieben freigeschaltete Höfe — damit sind bei 12 Plätzen 7 vergeben. */
  const sieben = Array.from({ length: 7 }, (_, i) => ({
    id: `hof-${i}`,
    ownerId: `besitzer-${i}`,
    approvedAt: new Date(Date.UTC(2026, 0, 1 + i)),
    createdAt: new Date(Date.UTC(2025, 0, 1)),
    archivedAt: null,
    gruendungBis: null,
  }))

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
    p.plattformEinstellung.findUnique.mockResolvedValue(null as never)
    p.farm.findMany.mockResolvedValue(sieben as never)
  })

  function angemeldet(isAdmin: boolean) {
    getSession.mockResolvedValue({ user: { id: 'konto-1' } } as never)
    p.user.findUnique.mockResolvedValue({ isAdmin } as never)
  }

  it('ohne Anmeldung bzw. ohne Admin-Recht: abgelehnt, nichts gelesen, nichts geschrieben', async () => {
    getSession.mockResolvedValue(null as never)
    expect(await speichereGruendungEinstellung(GUT)).toEqual({ error: 'Nicht angemeldet.' })
    angemeldet(false)
    expect(await speichereGruendungEinstellung(GUT)).toEqual({ error: 'Kein Zugriff.' })
    expect(p.farm.findMany).not.toHaveBeenCalled()
    expect(p.plattformEinstellung.upsert).not.toHaveBeenCalled()
  })

  it('weniger Plätze als vergeben: der feste Satz, nichts geschrieben', async () => {
    angemeldet(true)
    expect(await speichereGruendungEinstellung({ ...GUT, plaetze: 6 })).toEqual({ error: GRUENDUNG_EINSTELLUNG_FEHLER.weniger(7) })
    expect(p.plattformEinstellung.upsert).not.toHaveBeenCalled()
  })

  it.each([
    ['mehr Plätze', { ...GUT, plaetze: 13 }],
    ['ein anderes Ende', { ...GUT, bisTag: '2028-06-30' }],
    ['beides', { plaetze: 20, bisTag: '2028-06-30', anzeige: false }],
  ])('gesperrt (%s): der feste Satz, nichts geschrieben, kein Cache geleert', async (_fall, eingabe) => {
    angemeldet(true)
    expect(await speichereGruendungEinstellung(eingabe)).toEqual({ error: GRUENDUNG_EINSTELLUNG_FEHLER.gesperrt })
    expect(p.plattformEinstellung.upsert).not.toHaveBeenCalled()
    expect(vi.mocked(updateTag)).not.toHaveBeenCalled()
  })

  it('mit Recht (Gegenprobe zur Sperre: nur die Anzeige umgeschaltet): die Felder der Gruppe samt Person, danach Cache und Seiten neu', async () => {
    angemeldet(true)
    expect(await speichereGruendungEinstellung({ ...GUT, anzeige: false })).toEqual({ ok: true })
    const werte = {
      gruendungPlaetze: 12,
      gruendungBisStandard: new Date('2027-12-31T00:00:00.000Z'),
      gruendungAnzeige: false,
      geaendertVonUserId: 'konto-1',
    }
    expect(p.plattformEinstellung.upsert).toHaveBeenCalledWith({
      where: { id: 'plattform' },
      create: { id: 'plattform', ...werte },
      update: werte,
    })
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith('plattform-einstellung')
    for (const pfad of ['/', '/fuer-hoefe', '/register', '/admin/einstellungen']) expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(pfad)
  })
})

describe('EinstellungenGruendung — die zwei gesperrten Felder', () => {
  const daten = { gespeichert: GUT, imRennen: 7, ausgenommen: 0, jetzt: JETZT.toISOString(), protokoll: 'Noch nie geändert – es gelten die Standardwerte.' }

  it('Plätze und Ende nur lesend mit Hinweis; der Schalter bleibt bedienbar', () => {
    const html = renderToStaticMarkup(createElement(EinstellungenGruendung, { daten }))
    const felder = html.match(/<input[^>]*>/g) ?? []
    expect(felder).toHaveLength(2)
    for (const feld of felder) expect(feld).toMatch(/readonly=""/i)
    expect(html).toContain('value="12"')
    expect(html).toContain('value="2027-12-31"')
    expect(html).toContain(EINSTELLUNGEN_TEXT.gruendung.gesperrtHinweis)
    // Gegenprobe: Der Schalter „Auf den Seiten zeigen" ist weder gesperrt noch nur lesend.
    const schalter = html.match(/<button[^>]*role="switch"[^>]*>/)?.[0] ?? ''
    expect(schalter).toContain('aria-checked="true"')
    expect(schalter).not.toMatch(/disabled|readonly/i)
  })
})
