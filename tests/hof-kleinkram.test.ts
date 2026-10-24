/**
 * Kleinkram im Hofbereich (Nachtlauf 23, Nr. 157; Seitenkarte P6, P10, P8).
 *
 * Beweist:
 *  - Packliste (P6): Die Druckseite gibt verwaiste Bestellungen mit demselben
 *    `jetzt` frei wie /dashboard, BEVOR sie die Bestellungen liest — eine
 *    verfallene Bestellung steht nicht auf dem Papier (Gegenprobe: ohne Freigabe
 *    stünde sie da).
 *  - Abholzeit rückgängig (P10): Nach dem Löschen einer AKTIVEN Zeit trägt der
 *    Toast „Rückgängig"; der Klick legt die Zeit mit den vier Werten über
 *    `addPickupSlot` neu an. Eine pausierte Zeit behält den bisherigen Toast.
 *  - Bestätigen ohne Umweg (P8): Nach dem Bestätigen zeigt die Karte abgemeldet
 *    direkt das Formular der Hof-Anmeldung mit festem Ziel /onboarding;
 *    angemeldet bleibt es beim Link.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const m = vi.hoisted(() => ({
  reihenfolge: [] as string[],
  freigegeben: false,
  gibFrei: vi.fn(),
  findMany: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  addPickupSlot: vi.fn(),
  deletePickupSlot: vi.fn(),
  togglePickupSlotActive: vi.fn(),
  refresh: vi.fn(),
  /** Erzwingt den Anfangszustand von useState der Karte (der Test rendert nur, ohne Klick). */
  kartenStand: undefined as unknown,
}))

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: <T,>(anfang: T | (() => T)): [T, () => void] => [
    m.kartenStand !== undefined && anfang === 'offen' ? (m.kartenStand as T) : typeof anfang === 'function' ? (anfang as () => T)() : anfang,
    () => {},
  ],
  useTransition: (): [boolean, (lauf: () => void) => void] => [false, (lauf) => void lauf()],
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: () => ({ refresh: m.refresh, push: vi.fn() }),
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: async () => ({ user: { id: 'u1' } }) } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: async () => ({ id: 'farm_1', name: 'Testhof' }) }))
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findMany: m.findMany } } }))
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: m.gibFrei }))
vi.mock('sonner', () => ({ toast: m.toast }))
vi.mock('@/server/actions/farm', () => ({
  addPickupSlot: m.addPickupSlot,
  deletePickupSlot: m.deletePickupSlot,
  togglePickupSlotActive: m.togglePickupSlotActive,
}))
vi.mock('@/components/anmelden/hof-anmeldung', () => ({
  HofAnmeldung: ({ ziel }: { ziel?: string }) => createElement('div', { 'data-merkmal': 'hof-anmeldung', 'data-ziel': ziel ?? '' }),
}))
vi.mock('@/server/actions/email-bestaetigung', () => ({ bestaetigeEmail: vi.fn() }))

import PrintPacklistPage from '@/app/(farmer)/orders/today/print/page'
import { PickupSlotsClient } from '@/components/settings/pickup-slots-client'
import { BestaetigenKarte, NachBestaetigung, NeuerLinkWeg } from '@/components/email-bestaetigung/bestaetigen-karte'
import { ABHOLZEIT_GELOESCHT } from '@/lib/pickup-slot-rules'

function quelle(pfad: string): string {
  return readFileSync(join(process.cwd(), pfad), 'utf8')
}

async function flush(): Promise<void> {
  await new Promise((weiter) => setTimeout(weiter, 0))
}

beforeEach(() => {
  vi.clearAllMocks()
  m.freigegeben = false
  m.reihenfolge = []
  m.kartenStand = undefined
})
afterEach(() => vi.unstubAllGlobals())

describe('Packliste gibt verwaiste Bestellungen frei (P6)', () => {
  function bestellung(name: string) {
    return {
      id: name,
      customerName: name,
      orderNumber: `FZ-${name}`,
      pickupTimeStart: '14:00',
      pickupTimeEnd: '16:00',
      paymentMethod: 'ONLINE',
      totalAmount: '5.00',
      serviceFeeCents: 0,
      items: [],
    }
  }

  it('eine verfallene Bestellung steht nicht auf der Liste, weil vor dem Lesen freigegeben wird', async () => {
    m.gibFrei.mockImplementation(async () => {
      m.freigegeben = true
    })
    // Die Datenbank spiegelt die Freigabe: erst danach ist die verfallene Bestellung weg.
    m.findMany.mockImplementation(async () =>
      m.freigegeben ? [bestellung('Gueltig')] : [bestellung('Gueltig'), bestellung('Verfallen')]
    )

    const html = renderToStaticMarkup(await PrintPacklistPage())

    expect(html).toContain('Gueltig')
    expect(html).not.toContain('Verfallen')
    expect(m.gibFrei).toHaveBeenCalledTimes(1)
    expect(m.gibFrei.mock.calls[0][0]).toBe('farm_1')
    expect(m.gibFrei.mock.calls[0][1]).toBeInstanceOf(Date)
  })

  it('Gegenprobe: ohne die Freigabe stünde sie da', async () => {
    m.gibFrei.mockImplementation(async () => {})
    m.findMany.mockImplementation(async () => [bestellung('Gueltig'), bestellung('Verfallen')])

    expect(renderToStaticMarkup(await PrintPacklistPage())).toContain('Verfallen')
  })

  it('derselbe `jetzt` fürs Freigeben und für die Tagesgrenze', () => {
    const seite = quelle('src/app/(farmer)/orders/today/print/page.tsx')
    expect(seite).toContain('await gibVerwaisteFreiOhneRisiko(farm.id, jetzt)')
    expect(seite.indexOf('gibVerwaisteFreiOhneRisiko(farm.id, jetzt)')).toBeLessThan(seite.indexOf('prisma.order.findMany'))
    expect(seite.match(/new Date\(\)/g)).toHaveLength(1)
  })
})

describe('Abholzeit löschen mit „Rückgängig" (P10)', () => {
  type Baum = { type?: unknown; props?: Record<string, unknown> }
  function findeAlle(knoten: unknown, passt: (props: Record<string, unknown>) => boolean, funde: Baum[] = []): Baum[] {
    if (knoten == null || typeof knoten !== 'object') return funde
    if (Array.isArray(knoten)) {
      for (const k of knoten) findeAlle(k, passt, funde)
      return funde
    }
    const el = knoten as Baum
    if (!el.props) return funde
    if (passt(el.props)) funde.push(el)
    findeAlle(el.props.children, passt, funde)
    return funde
  }

  const AKTIV = { id: 's1', dayOfWeek: 2, startTime: '14:00', endTime: '16:00', maxOrders: 8, isActive: true }
  const PAUSIERT = { id: 's2', dayOfWeek: 4, startTime: '09:00', endTime: '11:00', maxOrders: null, isActive: false }

  async function loesche(slot: { id: string; dayOfWeek: number; startTime: string; endTime: string; maxOrders: number | null; isActive: boolean }, rueck: { onGespeichert?: () => void; meldeErfolg?: () => void } = {}) {
    m.deletePickupSlot.mockResolvedValue({})
    const baum = PickupSlotsClient({ initialSlots: [slot], ...rueck })
    const [zeile] = findeAlle(baum, (p) => typeof p.onDelete === 'function' && p.slot === slot)
    ;(zeile.props?.onDelete as () => void)()
    await flush()
  }

  it('aktive Zeit: Toast mit „Rückgängig"; der Klick legt sie mit den vier Werten neu an', async () => {
    m.addPickupSlot.mockResolvedValue({})
    const onGespeichert = vi.fn()
    const meldeErfolg = vi.fn()

    await loesche(AKTIV, { onGespeichert, meldeErfolg })

    expect(m.deletePickupSlot).toHaveBeenCalledWith('s1')
    expect(m.toast.success).toHaveBeenCalledTimes(1)
    const [text, optionen] = m.toast.success.mock.calls[0]
    expect(text).toBe(ABHOLZEIT_GELOESCHT.text)
    expect(optionen.action.label).toBe(ABHOLZEIT_GELOESCHT.rueckgaengig)
    // Auch in Mein Hof: kein „Gespeichert · Ansehen" an Stelle des Toasts.
    expect(meldeErfolg).not.toHaveBeenCalled()
    expect(onGespeichert).toHaveBeenCalledTimes(1)

    optionen.action.onClick()
    await flush()

    expect(m.addPickupSlot).toHaveBeenCalledWith({ dayOfWeek: 2, startTime: '14:00', endTime: '16:00', maxOrders: 8 })
    expect(onGespeichert).toHaveBeenCalledTimes(2)
    expect(m.toast.success).toHaveBeenLastCalledWith(ABHOLZEIT_GELOESCHT.zurueck)
  })

  it('scheitert das Zurückholen, steht die Meldung des Servers da', async () => {
    m.addPickupSlot.mockResolvedValue({ error: 'Diese Abholzeit existiert bereits.' })
    const onGespeichert = vi.fn()
    await loesche(AKTIV, { onGespeichert })

    m.toast.success.mock.calls[0][1].action.onClick()
    await flush()

    expect(m.toast.error).toHaveBeenCalledWith('Diese Abholzeit existiert bereits.')
    expect(onGespeichert).toHaveBeenCalledTimes(1)
  })

  it('wirft das Zurückholen (etwa ohne Netz), steht der Satz aus der einen Quelle da und die Seite lädt nicht neu', async () => {
    m.addPickupSlot.mockRejectedValue(new Error('Failed to fetch'))
    const onGespeichert = vi.fn()
    await loesche(AKTIV, { onGespeichert })
    m.refresh.mockClear()

    m.toast.success.mock.calls[0][1].action.onClick()
    await flush()

    expect(m.toast.error).toHaveBeenCalledWith(ABHOLZEIT_GELOESCHT.zurueckFehler)
    expect(m.toast.success).toHaveBeenCalledTimes(1)
    expect(m.refresh).not.toHaveBeenCalled()
    expect(onGespeichert).toHaveBeenCalledTimes(1)
  })

  it('Gegenprobe: pausierte Zeit behält den bisherigen Toast, ohne Aktion', async () => {
    const meldeErfolg = vi.fn()
    await loesche(PAUSIERT, { meldeErfolg })

    expect(m.toast.success).not.toHaveBeenCalled()
    expect(meldeErfolg).toHaveBeenCalledTimes(1)
    expect(m.addPickupSlot).not.toHaveBeenCalled()
  })

  it('Gegenprobe: pausierte Zeit ohne Mein Hof zeigt „Abholzeit gelöscht" ohne Aktion', async () => {
    await loesche(PAUSIERT)

    expect(m.toast.success).toHaveBeenCalledWith(ABHOLZEIT_GELOESCHT.text)
    expect(m.toast.success.mock.calls[0]).toHaveLength(1)
  })
})

describe('Bestätigen ohne Umweg (P8)', () => {
  const ref = { current: null }

  it('abgemeldet: das Formular der Hof-Anmeldung mit festem Ziel, kein Umweg über /login', () => {
    const html = renderToStaticMarkup(createElement(NachBestaetigung, { angemeldet: false, ueberschrift: ref }))

    expect(html).toContain('data-merkmal="hof-anmeldung"')
    expect(html).toContain('data-ziel="/onboarding"')
    expect(html).not.toContain('/login')
    expect(html).toContain('Danke, deine E-Mail ist bestätigt')
  })

  it('Gegenprobe: angemeldet zeigt den Link /onboarding, kein Formular', () => {
    const html = renderToStaticMarkup(createElement(NachBestaetigung, { angemeldet: true, ueberschrift: ref }))

    expect(html).toContain('href="/onboarding"')
    expect(html).not.toContain('hof-anmeldung')
  })

  it('Fehlerzustand der Karte, abgemeldet: zeigt NeuerLinkWeg mit dem Satz und dem Formular (Ziel /verify), kein Link auf /login', () => {
    m.kartenStand = { fehler: 'Der Link ist abgelaufen.' }
    const html = renderToStaticMarkup(createElement(BestaetigenKarte, { token: 't', angemeldet: false }))

    expect(html).toContain('Der Link ist abgelaufen.')
    expect(html).toContain('Melde dich an, dann schicken wir dir einen neuen Link.')
    expect(html).toContain('data-ziel="/verify"')
    expect(html).not.toContain('/login')
  })

  it('Gegenprobe: Fehlerzustand angemeldet zeigt den Link auf /verify, ohne den Satz und ohne Formular', () => {
    m.kartenStand = { fehler: 'Der Link ist abgelaufen.' }
    const html = renderToStaticMarkup(createElement(BestaetigenKarte, { token: 't', angemeldet: true }))

    expect(html).toContain('href="/verify"')
    expect(html).not.toContain('Melde dich an, dann schicken wir dir einen neuen Link.')
    expect(html).not.toContain('hof-anmeldung')
  })

  it('ohne Fehler (Anfangszustand) steht kein Weg zu einem neuen Link da', () => {
    const html = renderToStaticMarkup(createElement(BestaetigenKarte, { token: 't', angemeldet: false }))

    expect(html).not.toContain('data-ziel="/verify"')
    expect(html).not.toContain('Melde dich an, dann schicken wir dir einen neuen Link.')
  })

  it('NeuerLinkWeg abgemeldet: dasselbe Formular mit Ziel /verify, kein Link auf /login', () => {
    const html = renderToStaticMarkup(createElement(NeuerLinkWeg, { angemeldet: false }))

    expect(html).toContain('data-merkmal="hof-anmeldung"')
    expect(html).toContain('data-ziel="/verify"')
    expect(html).not.toContain('/login')
  })

  it('Gegenprobe: angemeldet bleibt es beim Link „Neuen Link anfordern" auf /verify, ohne Formular', () => {
    const html = renderToStaticMarkup(createElement(NeuerLinkWeg, { angemeldet: true }))

    expect(html).toContain('href="/verify"')
    expect(html).toContain('Neuen Link anfordern')
    expect(html).not.toContain('hof-anmeldung')
  })

  it('das Ziel steht fest im Code und kommt nie aus der Adresse', () => {
    const karte = quelle('src/components/email-bestaetigung/bestaetigen-karte.tsx')
    expect(karte).toContain('ziel="/onboarding"')
    expect(karte).not.toContain('searchParams')
    expect(karte).not.toContain('location')
    const anmeldung = quelle('src/components/anmelden/hof-anmeldung.tsx')
    expect(anmeldung).toContain("ziel?: '/onboarding' | '/verify'")
    expect(anmeldung).toContain('ziel ?? zielNachHofAnmeldung(')
  })
})
