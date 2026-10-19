/**
 * Admin › Einstellungen, Gruppe Gründungshöfe (Register K2-Ergänzung, N15;
 * Nr. 93; Aktion „100 Gründungshöfe“ seit Nr. 116) — die Prüfungen, das Schema
 * der Action, die Protokollzeile und die Wache der Action. Reine Funktionen
 * ohne Mock; die Action mit gemockter Datenbank und Sitzung, die Berechtigung
 * echt (verlangeAdminAktion).
 *
 * Beweist: Plätze nur erhöhen und nie unter die vergebenen; Monate nur
 * erhöhen, mehr nur, solange die Aktion nicht vorbei ist; „Aktion bis“ einmal
 * gesetzt nur früher (nie leer, nie später, nie vor dem heutigen WIENER Tag);
 * das Schema gibt nur eigene deutsche Sätze heraus; ohne Admin-Recht wird
 * nichts geschrieben und nichts gelesen; mit Recht nur die Felder der Gruppe,
 * unter der Sperre der Gründungsplätze in einer Transaktion.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    plattformEinstellung: { findUnique: vi.fn(), upsert: vi.fn() },
    farm: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
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
import { bildeGruendungBis, type GruendungEinstellung } from '@/lib/gruendungshof'
import {
  EINSTELLUNGEN_TEXT,
  GRUENDUNG_EINSTELLUNG_FEHLER,
  PLATTFORM_EINSTELLUNG_STANDARD,
  festgeschriebenZeile,
  gruendungZeileKurz,
  plattformEinstellungAus,
  protokollZeile,
  pruefeGruendungEingabe,
} from '@/lib/plattform-einstellung'
import { einstellungenGruppeSchema, gruendungEinstellungSchema } from '@/schemas/plattform-einstellung'
import { speichereGruendungEinstellung } from '@/server/actions/plattform-einstellung'
import { EinstellungenGruendung, type GruendungFormularDaten } from '@/components/admin/einstellungen-gruendung'

const JETZT = new Date('2026-10-15T10:00:00+02:00')
const GUT = { plaetze: 12, monate: 24, aktionBisTag: null, anzeige: true }
const STAND: GruendungEinstellung = { plaetze: 12, bis: bildeGruendungBis('2027-12-31'), anzeige: true, monate: 24, aktionBisTag: null, festAm: null }
const FEST: GruendungEinstellung = { ...STAND, plaetze: 100, aktionBisTag: '2027-03-31', festAm: new Date('2026-10-14T08:00:00Z') }

describe('pruefeGruendungEingabe — Plätze', () => {
  it('Plätze gleich den vergebenen: in Ordnung; einer weniger: der feste Satz', () => {
    expect(pruefeGruendungEingabe({ ...GUT, plaetze: 7 }, { ...STAND, plaetze: 7 }, 7, JETZT)).toBeNull()
    const satz = pruefeGruendungEingabe({ ...GUT, plaetze: 6 }, { ...STAND, plaetze: 6 }, 7, JETZT)
    expect(satz).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.weniger(7))
    expect(satz?.startsWith('Weniger Plätze als vergeben geht nicht')).toBe(true)
  })

  it('nur erhöhen: 12 → 100 geht, 12 → 11 nicht (auch über den vergebenen)', () => {
    expect(pruefeGruendungEingabe({ ...GUT, plaetze: 100 }, STAND, 7, JETZT)).toBeNull()
    expect(pruefeGruendungEingabe({ ...GUT, plaetze: 11 }, STAND, 7, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.plaetzeNurMehr(12))
  })

  it('keine ganze Zahl: der eigene Satz', () => {
    expect(pruefeGruendungEingabe({ ...GUT, plaetze: 2.5 }, STAND, 0, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.plaetze)
    expect(pruefeGruendungEingabe({ ...GUT, plaetze: Number.NaN }, STAND, 0, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.plaetze)
  })
})

describe('pruefeGruendungEingabe — Monate', () => {
  it('nur erhöhen: 24 → 30 geht, 24 → 18 nicht', () => {
    expect(pruefeGruendungEingabe({ ...GUT, monate: 30 }, STAND, 0, JETZT)).toBeNull()
    expect(pruefeGruendungEingabe({ ...GUT, monate: 18 }, STAND, 0, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.monateNurMehr(24))
    expect(pruefeGruendungEingabe({ ...GUT, monate: 0 }, STAND, 0, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.monate)
  })

  it('mehr Monate nur, solange die Aktion läuft — nach dem Stichtag nicht mehr, gleich viele schon', () => {
    const vorbei = { ...FEST, aktionBisTag: '2026-10-14' }
    const eingabe = { plaetze: 100, monate: 24, aktionBisTag: '2026-10-14', anzeige: true }
    expect(pruefeGruendungEingabe({ ...eingabe, monate: 30 }, vorbei, 5, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.monateVorbei)
    expect(pruefeGruendungEingabe(eingabe, vorbei, 5, JETZT)).toBeNull()
    // Gegenprobe: Die Aktion läuft — mehr Monate gehen.
    expect(pruefeGruendungEingabe({ ...eingabe, aktionBisTag: '2027-03-31', monate: 30 }, FEST, 5, JETZT)).toBeNull()
  })
})

describe('pruefeGruendungEingabe — Aktion bis: einmal gesetzt nur früher', () => {
  it('der erste Stichtag darf gesetzt werden, ab heute (Wiener Tag)', () => {
    expect(pruefeGruendungEingabe({ ...GUT, aktionBisTag: '2027-03-31' }, STAND, 0, JETZT)).toBeNull()
    expect(pruefeGruendungEingabe({ ...GUT, aktionBisTag: '2026-10-15' }, STAND, 0, JETZT)).toBeNull()
    expect(pruefeGruendungEingabe({ ...GUT, aktionBisTag: '2026-10-14' }, STAND, 0, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.vergangen)
    // 0:30 Uhr in Wien ist in UTC noch gestern — es zählt der Wiener Tag.
    expect(pruefeGruendungEingabe({ ...GUT, aktionBisTag: '2026-10-15' }, STAND, 0, new Date('2026-10-16T00:30:00+02:00'))).toBe(
      GRUENDUNG_EINSTELLUNG_FEHLER.vergangen
    )
  })

  it('nie nach hinten, nie leer — früher geht, gleich bleibt', () => {
    const eingabe = { plaetze: 100, monate: 24, anzeige: true }
    expect(pruefeGruendungEingabe({ ...eingabe, aktionBisTag: '2027-04-01' }, FEST, 0, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.nieNachHinten)
    expect(pruefeGruendungEingabe({ ...eingabe, aktionBisTag: null }, FEST, 0, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.nieNachHinten)
    expect(pruefeGruendungEingabe({ ...eingabe, aktionBisTag: '2027-02-28' }, FEST, 0, JETZT)).toBeNull()
    expect(pruefeGruendungEingabe({ ...eingabe, aktionBisTag: '2027-03-31' }, FEST, 0, JETZT)).toBeNull()
    expect(GRUENDUNG_EINSTELLUNG_FEHLER.nieNachHinten).toBe('Nie nach hinten schieben – sonst ist die Werbung irreführend.')
  })

  it('kein Kalendertag (30. Februar): der eigene Satz', () => {
    expect(pruefeGruendungEingabe({ ...GUT, aktionBisTag: '2027-02-30' }, STAND, 0, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.datum)
  })
})

describe('gruendungEinstellungSchema — nur eigene Sätze, nie Zods englischer Text', () => {
  const satzVon = (eingabe: unknown): string | undefined => {
    const r = gruendungEinstellungSchema.safeParse(eingabe)
    return r.success ? undefined : r.error.issues[0]?.message
  }

  it('lässt eine gültige Eingabe durch, mit und ohne Stichtag', () => {
    expect(gruendungEinstellungSchema.safeParse(GUT).success).toBe(true)
    expect(gruendungEinstellungSchema.safeParse({ ...GUT, aktionBisTag: '2027-03-31' }).success).toBe(true)
  })

  it.each([
    [{ ...GUT, plaetze: '12' }, GRUENDUNG_EINSTELLUNG_FEHLER.plaetze],
    [{ ...GUT, plaetze: 1.5 }, GRUENDUNG_EINSTELLUNG_FEHLER.plaetze],
    [{ ...GUT, monate: '24' }, GRUENDUNG_EINSTELLUNG_FEHLER.monate],
    [{ ...GUT, monate: 121 }, GRUENDUNG_EINSTELLUNG_FEHLER.monate],
    [{ ...GUT, aktionBisTag: 20270331 }, GRUENDUNG_EINSTELLUNG_FEHLER.datum],
    [{ ...GUT, aktionBisTag: '31.03.2027' }, GRUENDUNG_EINSTELLUNG_FEHLER.datum],
    [{ ...GUT, anzeige: 'ja' }, GRUENDUNG_EINSTELLUNG_FEHLER.ungueltig],
    [{ ...GUT, bisTag: '2028-06-30' }, GRUENDUNG_EINSTELLUNG_FEHLER.ungueltig],
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
    gruendungMonate: 24,
    gruendungAktionBis: new Date('2027-03-31T00:00:00.000Z'),
    gruendungFestAm: null,
    geaendertVonUserId: 'admin-1',
    updatedAt: new Date('2026-10-12T19:14:00.000Z'),
  }

  it('die DATE-Spalten werden zu Wiener Kalendertagen, die Zeitpunkte zu ISO-Text (JSON für den Cache)', () => {
    expect(plattformEinstellungAus(zeile)).toEqual({
      gruendungPlaetze: 15,
      gruendungBisTag: '2028-06-30',
      gruendungAnzeige: false,
      gruendungMonate: 24,
      gruendungAktionBisTag: '2027-03-31',
      gruendungFestAm: null,
      geaendertVonUserId: 'admin-1',
      geaendertAm: '2026-10-12T19:14:00.000Z',
    })
  })

  it('„Zuletzt geändert von … am …" in Wiener Zeit; nie geändert und gelöschtes Konto mit eigenem Satz', () => {
    expect(protokollZeile(plattformEinstellungAus(zeile), 'Maria Beispiel')).toBe('Zuletzt geändert von Maria Beispiel am 12.10.2026, 21:14')
    expect(protokollZeile(plattformEinstellungAus(zeile), null)).toBe('Zuletzt geändert von einem gelöschten Konto am 12.10.2026, 21:14')
    expect(protokollZeile(PLATTFORM_EINSTELLUNG_STANDARD, 'Maria Beispiel')).toBe('Noch nie geändert – es gelten die Standardwerte.')
  })

  it('„festgeschrieben am …“ erst nach dem Festschreiben; die Zeile am Handy nennt dann Monate und Stichtag', () => {
    expect(festgeschriebenZeile(plattformEinstellungAus(zeile))).toBeNull()
    expect(festgeschriebenZeile(plattformEinstellungAus({ ...zeile, gruendungFestAm: new Date('2026-10-19T19:14:00.000Z') }))).toBe(
      'Zusagen festgeschrieben am 19.10.2026, 21:14.'
    )
    const basis = { gesamt: 100, frei: 95, bisTag: '2027-12-31', monate: 24, aktionBisTag: '2027-03-31' }
    expect(gruendungZeileKurz({ ...basis, art: 'aktion' })).toBe('100 Plätze · 95 frei · 24 Monate · bis 31.03.2027')
    expect(gruendungZeileKurz({ ...basis, art: 'bisher' })).toBe('100 Plätze · 95 frei · bis 31.12.2027')
  })
})

describe('speichereGruendungEinstellung — die Wache, die Sperre und was geschrieben wird', () => {
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
    gruendungAusgenommen: false,
    gruendungPlatz: null,
  }))

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
    p.plattformEinstellung.findUnique.mockResolvedValue(null as never)
    p.farm.findMany.mockResolvedValue(sieben as never)
    // Die Transaktion ruft den Rückruf mit demselben Client — Reihenfolge prüfbar.
    p.$transaction.mockImplementation((async (rueckruf: (tx: typeof prisma) => unknown) => rueckruf(prisma)) as never)
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

  it('weniger Plätze als vergeben: der feste Satz, nichts geschrieben, kein Cache geleert', async () => {
    angemeldet(true)
    expect(await speichereGruendungEinstellung({ ...GUT, plaetze: 6 })).toEqual({ error: GRUENDUNG_EINSTELLUNG_FEHLER.weniger(7) })
    expect(p.plattformEinstellung.upsert).not.toHaveBeenCalled()
    expect(vi.mocked(updateTag)).not.toHaveBeenCalled()
  })

  it('nimmt die Sperre der Gründungsplätze, BEVOR Einstellung und Höfe gelesen werden', async () => {
    angemeldet(true)
    expect(await speichereGruendungEinstellung({ ...GUT, plaetze: 100 })).toEqual({ ok: true })
    const sperre = p.$executeRaw.mock.invocationCallOrder[0]
    expect(sperre).toBeLessThan(p.plattformEinstellung.findUnique.mock.invocationCallOrder[0])
    expect(sperre).toBeLessThan(p.farm.findMany.mock.invocationCallOrder[0])
  })

  it('mit Recht: die Felder der Gruppe samt Person — das Standard-Ende nie —, danach Cache und Seiten neu', async () => {
    angemeldet(true)
    expect(await speichereGruendungEinstellung({ plaetze: 100, monate: 24, aktionBisTag: '2027-03-31', anzeige: false })).toEqual({ ok: true })
    const werte = {
      gruendungPlaetze: 100,
      gruendungMonate: 24,
      gruendungAktionBis: new Date('2027-03-31T00:00:00.000Z'),
      gruendungAnzeige: false,
      geaendertVonUserId: 'konto-1',
    }
    expect(p.plattformEinstellung.upsert).toHaveBeenCalledWith({
      where: { id: 'plattform' },
      create: { id: 'plattform', ...werte },
      update: werte,
    })
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith('plattform-einstellung')
    for (const pfad of ['/', '/fuer-hoefe', '/register', '/konditionen', '/admin/einstellungen']) expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(pfad)
  })
})

describe('EinstellungenGruendung — Felder der Aktion und „Zusagen festschreiben“', () => {
  const daten: GruendungFormularDaten = {
    gespeichert: { plaetze: 12, monate: 24, aktionBisTag: null, anzeige: true, bisTag: '2027-12-31', festAm: null },
    vergeben: 7,
    ausgenommen: 0,
    jetzt: JETZT.toISOString(),
    protokoll: 'Noch nie geändert – es gelten die Standardwerte.',
    festschreiben: [],
    festschreibenPlaetze: null,
    festgeschrieben: null,
  }

  it('Plätze, Monate und Aktion bis sind bedienbar; das Standard-Ende nur lesend; der Knopf „Zusagen festschreiben …“ steht da', () => {
    const html = renderToStaticMarkup(createElement(EinstellungenGruendung, { daten }))
    const felder = html.match(/<input[^>]*>/g) ?? []
    expect(felder).toHaveLength(4)
    expect(felder.filter((f) => /readonly=""/i.test(f))).toHaveLength(1)
    expect(html).toContain('value="12"')
    expect(html).toContain('value="24"')
    expect(html).toContain(EINSTELLUNGEN_TEXT.gruendung.festschreiben)
    const schalter = html.match(/<button[^>]*role="switch"[^>]*>/)?.[0] ?? ''
    expect(schalter).toContain('aria-checked="true"')
  })

  it('nach dem Festschreiben: kein Knopf mehr, kein Standard-Ende, dafür die Zeile „festgeschrieben am …“', () => {
    const html = renderToStaticMarkup(
      createElement(EinstellungenGruendung, {
        daten: { ...daten, gespeichert: { ...daten.gespeichert, festAm: '2026-10-14T08:00:00.000Z' }, festgeschrieben: 'Zusagen festgeschrieben am 14.10.2026, 10:00.' },
      })
    )
    expect(html).not.toContain(EINSTELLUNGEN_TEXT.gruendung.festschreiben)
    expect(html).toContain('Zusagen festgeschrieben am 14.10.2026, 10:00.')
    expect(html.match(/<input[^>]*>/g) ?? []).toHaveLength(3)
  })
})
