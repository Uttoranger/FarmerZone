/**
 * Nr. 265 — eine Zählregel für „vergeben“ in Admin › Einstellungen ›
 * Gründungshöfe (Register K2, Änderung Nr. 116; N48): Kachel, Hinweis, Prüfung
 * im Browser und Server-Action nennen dieselbe Zahl, nämlich
 * `vergebeneGruendungsplaetze(hoefe, plaetze)` — vor dem Festschreiben
 * höchstens die Plätze, danach die festgeschriebenen. Vorher lieferte der
 * Lader alle Höfe im Rennen (36), die Kachel zeigte 12, der Hinweis „36 sind
 * schon vergeben“ und die Action prüfte gegen 12.
 *
 * Datenbank gemockt, Lader, Fachregeln, Formular und Action echt. Wer einen
 * Platz bekommt, ändert sich nicht (Gegenprobe ohne Zeile: Standard 12).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', async () => ({
  prisma: {
    plattformEinstellung: { findUnique: vi.fn(), upsert: vi.fn() },
    farm: { findMany: vi.fn(), count: vi.fn() },
    // Die Wache liest seit Nr. 115 die Pflicht „erst Passkey“ (tests/admin-sitzung.ts).
    ...(await import('./admin-sitzung')).passkeyAttrappen(),
    user: { findUnique: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), unstable_rethrow: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { GRUENDUNG_TEXT, MAX_GRUENDUNGSHOEFE, bildeGruendungBis, gruendungsZusageBeiFreigabe } from '@/lib/gruendungshof'
import {
  EINSTELLUNGEN_TEXT,
  GRUENDUNG_EINSTELLUNG_FEHLER,
  gruendungEinstellungAus,
  gruendungFormularStand,
  pruefeGruendungEingabe,
} from '@/lib/plattform-einstellung'
import { gruendungFuerSeiten, ladeAbzeichenBlatt, ladeGruendungStandAdmin, lesePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { ladeGruendungBis, ladeHoefeFuerGruendung } from '@/server/queries/admin'
import { speichereGruendungEinstellung } from '@/server/actions/plattform-einstellung'
import { EinstellungenGruendung, type GruendungFormularDaten } from '@/components/admin/einstellungen-gruendung'
import { einstellungsZeile } from './fabrik/plattform-einstellung'
import { adminSitzung } from './admin-sitzung'

const JETZT = new Date('2026-10-15T10:00:00+02:00')
const p = vi.mocked(prisma, { deep: true })

/** `anzahl` freigeschaltete, nicht stillgelegte Höfe — alle im Rennen um die Plätze. */
function hoefe(anzahl: number) {
  return Array.from({ length: anzahl }, (_, i) => ({
    id: `hof-${i + 1}`,
    ownerId: `besitzer-${i + 1}`,
    name: `Hof Müller ${i + 1}`,
    approvedAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
    createdAt: new Date(Date.UTC(2025, 0, 1)),
    archivedAt: null,
    gruendungBis: null,
    gruendungAusgenommen: false,
    gruendungPlatz: null,
  }))
}

/** Die Zeile der Einstellung mit `plaetze` Plätzen, nicht festgeschrieben. */
function zeile(plaetze: number) {
  return { ...einstellungsZeile(null), gruendungPlaetze: plaetze, gruendungMonate: 24 }
}

/** Die Seitendaten, wie src/app/admin/einstellungen/page.tsx sie aus Zeile und Lader baut. */
async function formularDaten(): Promise<GruendungFormularDaten> {
  const einstellung = await lesePlattformEinstellung()
  const stand = await ladeGruendungStandAdmin(einstellung)
  return {
    gespeichert: {
      plaetze: einstellung.gruendungPlaetze,
      monate: einstellung.gruendungMonate,
      aktionBisTag: einstellung.gruendungAktionBisTag,
      anzeige: einstellung.gruendungAnzeige,
      bisTag: einstellung.gruendungBisTag,
      festAm: einstellung.gruendungFestAm,
    },
    ...stand,
    jetzt: JETZT.toISOString(),
    protokoll: '',
    festgeschrieben: null,
  }
}

/** Die Zahl in der Kachel „Vergeben“ der gerenderten Gruppe. */
function kachelVergeben(html: string): number {
  const treffer = html.match(new RegExp(`>${EINSTELLUNGEN_TEXT.gruendung.kachelVergeben}</div><div[^>]*>(\\d+)</div>`))
  if (!treffer) throw new Error('Kachel „Vergeben“ nicht gefunden')
  return Number(treffer[1])
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
  p.$transaction.mockImplementation((async (rueckruf: (tx: typeof prisma) => unknown) => rueckruf(prisma)) as never)
  vi.mocked(auth.api.getSession).mockResolvedValue(adminSitzung('konto-1') as never)
  p.user.findUnique.mockResolvedValue({ isAdmin: true, adminInhaber: true } as never)
})

describe('36 Höfe im Rennen, 12 Plätze: eine Zahl für „vergeben“', () => {
  beforeEach(() => {
    p.plattformEinstellung.findUnique.mockResolvedValue(zeile(12) as never)
    p.farm.findMany.mockResolvedValue(hoefe(36) as never)
  })

  it('Kachel, Hinweis, Prüfung im Browser und Action nennen dieselbe Zahl (12)', async () => {
    const daten = await formularDaten()
    const html = renderToStaticMarkup(createElement(EinstellungenGruendung, { daten }))
    const gespeichert = gruendungEinstellungAus(await lesePlattformEinstellung())
    const zuWenig = { plaetze: 5, monate: 24, aktionBisTag: null, anzeige: true }

    // Kachel
    expect(kachelVergeben(html)).toBe(12)
    // Hinweis: Der gespeicherte Stand ist gültig — kein Satz „36 sind schon vergeben“.
    expect(html).not.toContain(GRUENDUNG_EINSTELLUNG_FEHLER.weniger(36))
    // Prüfung im Browser: dieselbe Regel mit der Zahl, die die Seite mitgibt.
    expect(pruefeGruendungEingabe(zuWenig, gespeichert, daten.vergeben, JETZT)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.weniger(12))
    // Action
    expect(await speichereGruendungEinstellung(zuWenig)).toEqual({ error: GRUENDUNG_EINSTELLUNG_FEHLER.weniger(12) })
  })

  it('das Formular prüft beim Tippen mit derselben Zahl wie die Action: 5 abgewiesen mit 12, 20 erlaubt wie auf dem Server', async () => {
    const daten = await formularDaten()
    const gespeichert = gruendungEinstellungAus(await lesePlattformEinstellung())
    const eingabe = (plaetze: number) => ({ plaetze, monate: 24, aktionBisTag: null, anzeige: true })

    expect(gruendungFormularStand(gespeichert, daten, eingabe(5), JETZT).fehler).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.weniger(12))
    expect(gruendungFormularStand(gespeichert, daten, eingabe(20), JETZT).fehler).toBeNull()
    expect(await speichereGruendungEinstellung(eingabe(20))).toEqual({ ok: true })
  })

  it('Kachel beim Tippen: rechnet mit den eingegebenen Plätzen — bei 100 sind danach 36 vergeben, 64 frei', async () => {
    const daten = await formularDaten()
    const gespeichert = gruendungEinstellungAus(await lesePlattformEinstellung())

    const hundert = gruendungFormularStand(gespeichert, daten, { plaetze: 100, monate: 24, aktionBisTag: null, anzeige: true }, JETZT)
    expect(hundert.vergeben).toBe(36)
    expect(hundert.zahlen.frei).toBe(64)
    // Ungültige Eingabe: die Kachel bleibt beim gespeicherten Stand — wieder 12.
    expect(gruendungFormularStand(gespeichert, daten, { plaetze: 5, monate: 24, aktionBisTag: null, anzeige: true }, JETZT).vergeben).toBe(12)
  })
})

describe('Testhöfe und ausgenommene Höfe zählen nicht, festgeschrieben zählen die Nummern', () => {
  it('36 freigeschaltete, davon 30 ausgenommen (Testhöfe sind immer ausgenommen): 6 vergeben', async () => {
    p.plattformEinstellung.findUnique.mockResolvedValue(zeile(12) as never)
    p.farm.findMany.mockResolvedValue(hoefe(36).map((h, i) => ({ ...h, gruendungAusgenommen: i >= 6, istTesthof: i >= 30 })) as never)

    const daten = await formularDaten()

    expect(daten.vergeben).toBe(6)
    expect(daten.ausgenommen).toBe(30)
    expect(kachelVergeben(renderToStaticMarkup(createElement(EinstellungenGruendung, { daten })))).toBe(6)
  })

  it('festgeschrieben: die gespeicherten Nummern, nicht die Höfe im Rennen', async () => {
    p.plattformEinstellung.findUnique.mockResolvedValue({ ...zeile(12), gruendungFestAm: new Date('2026-10-14T08:00:00Z') } as never)
    p.farm.findMany.mockResolvedValue(hoefe(36).map((h, i) => ({ ...h, gruendungPlatz: i < 9 ? i + 1 : null })) as never)

    const daten = await formularDaten()

    expect(daten.vergeben).toBe(9)
    expect(daten.inDerVergabe).toBe(9)
    expect(kachelVergeben(renderToStaticMarkup(createElement(EinstellungenGruendung, { daten })))).toBe(9)
  })
})

describe('Einstellung 100: jede Anzeige nennt bzw. rechnet mit 100 (Nr. 265, Punkt 3)', () => {
  beforeEach(() => {
    p.plattformEinstellung.findUnique.mockResolvedValue(zeile(100) as never)
    p.farm.findMany.mockResolvedValue(hoefe(36) as never)
    p.farm.count.mockResolvedValue(0 as never)
  })

  it('Startseite, /fuer-hoefe und /register: 100 Plätze, 64 frei, voraussichtlich Nr. 37', async () => {
    const g = await gruendungFuerSeiten(JETZT)

    expect(g.gesamt).toBe(100)
    expect(g.frei).toBe(64)
    expect(GRUENDUNG_TEXT.satz(g).betont).toBe('Noch 64 von 100 Gründungsplätzen frei')
    expect(GRUENDUNG_TEXT.pill(g)).toContain('noch 64 von 100 Plätzen')
    expect(g.voraussichtlicherPlatz).toBe(37)
  })

  it('Hofseite: das Abzeichen-Blatt nennt 100 Plätze', async () => {
    expect(await ladeAbzeichenBlatt()).toEqual({ plaetze: 100, frei: 64 })
  })

  it('Tarif-Zeile und „Dein Stand“ (ladeGruendungBis): Platz 20 hat das Standard-Ende, Platz 37 nicht', async () => {
    expect(await ladeGruendungBis({ id: 'hof-20' })).toEqual(bildeGruendungBis('2027-12-31'))
    expect(await ladeGruendungBis({ id: 'hof-37' })).toBeNull()
  })

  it('Gründungs-Nachricht bei der Freischaltung (Regel aus approveFarmAction): Platz 20 bekommt die Zusage', async () => {
    const einstellung = gruendungEinstellungAus(await lesePlattformEinstellung())
    const liste = await ladeHoefeFuerGruendung()

    expect(gruendungsZusageBeiFreigabe({ id: 'hof-20', gruendungBis: null }, liste, einstellung)).toEqual({ platz: 20, bis: einstellung.bis })
  })

  it('Aktion-Karte auf /konditionen (festgeschrieben, Aktion läuft): „Aktion 100 Gründungshöfe“', async () => {
    p.plattformEinstellung.findUnique.mockResolvedValue({ ...zeile(100), gruendungFestAm: new Date('2026-10-14T08:00:00Z') } as never)
    p.farm.findMany.mockResolvedValue(hoefe(36).map((h, i) => ({ ...h, gruendungPlatz: i + 1 })) as never)

    const g = await gruendungFuerSeiten(JETZT)

    expect(g.aktionLaeuft).toBe(true)
    expect(GRUENDUNG_TEXT.aktion(g).titel).toBe('Aktion 100 Gründungshöfe')
    expect(GRUENDUNG_TEXT.aktion(g).saetze.join(' ')).toContain('Noch 64 von 100 Plätzen.')
  })
})

describe('Gegenprobe ohne Zeile: der Standard 12 wie bisher', () => {
  beforeEach(() => {
    p.plattformEinstellung.findUnique.mockResolvedValue(null as never)
    p.farm.findMany.mockResolvedValue(hoefe(36) as never)
    p.farm.count.mockResolvedValue(0 as never)
  })

  it('Seiten, Kachel und Zählregel mit 12 — Platz 12 Gründungshof, Platz 13 nicht', async () => {
    const daten = await formularDaten()

    expect(MAX_GRUENDUNGSHOEFE).toBe(12)
    expect((await gruendungFuerSeiten(JETZT)).gesamt).toBe(MAX_GRUENDUNGSHOEFE)
    expect(daten.vergeben).toBe(MAX_GRUENDUNGSHOEFE)
    expect(kachelVergeben(renderToStaticMarkup(createElement(EinstellungenGruendung, { daten })))).toBe(MAX_GRUENDUNGSHOEFE)
    expect(await ladeGruendungBis({ id: 'hof-12' })).not.toBeNull()
    expect(await ladeGruendungBis({ id: 'hof-13' })).toBeNull()
  })
})
