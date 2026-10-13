/**
 * Leerzustände — je umgestellter Stelle rendert der echte Baustein einen EmptyState mit Titel und
 * Aktion (Register N9, docs/ai/DESIGN_SYSTEM.md „Zustände“). Die Quelltext-Wache dazu steht in
 * tests/leerzustaende-wache.test.ts.
 *
 * Beweist je Stelle:
 *  - Leer: der EmptyState zeigt den Titel (und den Satz) aus der Textquelle in src/lib und trägt
 *    die Aktion mit ihrem Ziel bzw. als Knopf.
 *  - Gegenprobe: Mit Inhalt rendert dieselbe Komponente keinen EmptyState — die Suche nach dem
 *    Merkmal (`data-slot="empty-state"`) schlägt also nicht überall an.
 *  - Heute ohne Abholzeit: Satz und Knopf „Abholzeiten eintragen“ stehen auf der Seite genau
 *    einmal (Packliste); die Karte „Nächste Abholung“ sagt es in einer Zeile (Nachbesserung Runde 1).
 *  - Der Knopf der Einstellungen sucht das Feld, das im Formular wirklich diese Kennung trägt.
 *  - WhatsApp ohne Abonnentin: der Titel des EmptyState ist die eine h1 der Seite.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }))
vi.mock('sonner', () => ({ toast: { success: () => undefined, error: () => undefined } }))
vi.mock('@/server/actions/farm', () => ({
  addPickupSlot: () => undefined,
  deletePickupSlot: () => undefined,
  togglePickupSlotActive: () => undefined,
}))
vi.mock('@/server/actions/status-posts', () => ({ setzeWhatsAppGetippt: () => undefined }))

import { ABHOLZEITEN_FEHLEN, ABHOLZEITEN_FORMULAR_ID } from '@/lib/pickup-slot-rules'
import { UMSATZ_LEER } from '@/lib/auswertung'
import { WHATSAPP_VERSAND_TEXT } from '@/lib/whatsapp-versand'
import { BEITRAEGE_HREF } from '@/lib/bauern-navigation'
import { WUNSCHLISTE_LEER, WUNSCHLISTE_SATZ } from '@/lib/admin-briefkasten'

let heute: typeof import('@/components/heute/heute-teile')
let abholzeiten: typeof import('@/components/settings/pickup-slots-client')
let briefkasten: typeof import('@/components/admin/briefkasten-teile')
let auswertung: typeof import('@/components/auswertung/auswertung-teile')
let whatsapp: typeof import('@/app/(hof)/status/[id]/send-whatsapp/whatsapp-tap-client')

beforeAll(async () => {
  heute = await import('@/components/heute/heute-teile')
  abholzeiten = await import('@/components/settings/pickup-slots-client')
  briefkasten = await import('@/components/admin/briefkasten-teile')
  auswertung = await import('@/components/auswertung/auswertung-teile')
  whatsapp = await import('@/app/(hof)/status/[id]/send-whatsapp/whatsapp-tap-client')
}, 30_000)

const html = (el: React.ReactElement) => renderToStaticMarkup(el)
const maskiere = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const anzahlEmptyStates = (h: string) => (h.match(/data-slot="empty-state"/g) ?? []).length
/** Wie oft der Text im Markup steht. */
const vorkommen = (h: string, text: string) => h.split(text).length - 1

/** Ein Link mit diesem Ziel, der nur diesen Text trägt. */
const alsLink = (href: string, text: string) => new RegExp(`<a href="${maskiere(href)}"[^>]*>${maskiere(text)}</a>`)
/** Ein Knopf (button type="button"), der nur diesen Text trägt. */
const alsKnopf = (text: string) => new RegExp(`<button type="button"[^>]*>${maskiere(text)}</button>`)

describe('Heute — keine Abholzeiten', () => {
  it('Satz und Knopf stehen auf der Seite genau einmal — in der Packliste; die Karte sagt es in einer Zeile', () => {
    const packliste = html(createElement(heute.Packliste, { zeilen: [], zuPacken: 0, naechsteAbholung: null, leer: { abholfenster: null } }))
    const karte = html(createElement(heute.NaechsteAbholungKarte, { fenster: null, anzahl: 0 }))
    // So stehen die beiden Blöcke auf /dashboard untereinander (app/(hof)/dashboard/page.tsx).
    const seite = packliste + karte
    expect(vorkommen(seite, ABHOLZEITEN_FEHLEN.satz)).toBe(1)
    expect(vorkommen(seite, ABHOLZEITEN_FEHLEN.aktion.text)).toBe(1)
    expect(packliste).toMatch(alsLink(ABHOLZEITEN_FEHLEN.aktion.href, ABHOLZEITEN_FEHLEN.aktion.text))
    // Die Karte: nur der Titel als Zeile, kein EmptyState, kein Knopf, kein Link.
    expect(anzahlEmptyStates(karte)).toBe(0)
    expect(karte).toContain(ABHOLZEITEN_FEHLEN.titel)
    expect(karte).not.toContain('<a ')
    expect(karte).not.toContain('<button')
    // Die zweiten Fassungen von früher sind weg.
    expect(karte).not.toContain('Du hast noch keine Abholzeiten eingetragen')
    expect(packliste).not.toContain('damit Kunden bei dir bestellen')
  })

  it('Gegenprobe: mit Abholfenster steht in der Karte kein EmptyState, in der leeren Packliste der Weg ins Fenster', () => {
    const karte = html(createElement(heute.NaechsteAbholungKarte, { fenster: { tag: '2026-10-06', name: 'Heute', zeit: '15–18 Uhr' }, anzahl: 0 }))
    expect(anzahlEmptyStates(karte)).toBe(0)
    // Die eine Zeile ohne Aktion bleibt eine Zeile (N9, Art B).
    expect(karte).toContain('Noch keine Bestellungen')
    const packliste = html(
      createElement(heute.Packliste, { zeilen: [], zuPacken: 0, naechsteAbholung: null, leer: { abholfenster: { tag: '2026-10-06', name: 'Heute', zeit: '15–18 Uhr' } } })
    )
    expect(packliste).toContain('Nächste Abholung: Heute, 15–18 Uhr.')
    expect(packliste).not.toContain(ABHOLZEITEN_FEHLEN.satz)
    expect(packliste).not.toContain(ABHOLZEITEN_FEHLEN.aktion.text)
  })
})

describe('Einstellungen — Abholzeiten', () => {
  const slot = { id: 's1', dayOfWeek: 6, startTime: '09:00', endTime: '12:00', maxOrders: null, isActive: true }

  it('ohne Abholzeit: EmptyState mit Titel, Satz und einem Knopf zum Formular', () => {
    const h = html(createElement(abholzeiten.PickupSlotsClient, { initialSlots: [] }))
    expect(anzahlEmptyStates(h)).toBe(1)
    expect(h).toContain(ABHOLZEITEN_FEHLEN.titel)
    expect(h).toContain(ABHOLZEITEN_FEHLEN.satz)
    expect(h).toMatch(alsKnopf(ABHOLZEITEN_FEHLEN.aktion.text))
    expect(h).not.toContain('Noch keine Abholzeiten angelegt')
  })

  it('der Knopf führt ins Formular: Das erste Feld trägt die Kennung, die er sucht', () => {
    const h = html(createElement(abholzeiten.PickupSlotsClient, { initialSlots: [] }))
    expect(ABHOLZEITEN_FORMULAR_ID).toBeTruthy()
    expect(h).toContain(`id="${ABHOLZEITEN_FORMULAR_ID}"`)
    expect(h).toContain(`for="${ABHOLZEITEN_FORMULAR_ID}"`)
  })

  it('Gegenprobe: mit einer Abholzeit steht kein EmptyState da', () => {
    const h = html(createElement(abholzeiten.PickupSlotsClient, { initialSlots: [slot] }))
    expect(anzahlEmptyStates(h)).toBe(0)
    expect(h).toContain('Samstag')
  })
})

describe('Admin — Briefkasten, Wunschliste', () => {
  it('ohne Wunsch: EmptyState „Noch keine Wünsche“, der Satz der Liste bleibt darunter', () => {
    const h = html(createElement(briefkasten.Wunschliste, { buendel: [] }))
    expect(anzahlEmptyStates(h)).toBe(1)
    expect(h).toContain(WUNSCHLISTE_LEER.titel)
    expect(h).toContain(WUNSCHLISTE_SATZ)
  })

  it('Gegenprobe: mit einem Bündel steht kein EmptyState da', () => {
    const buendel = [{ schluessel: 'dunkel', name: 'Dunkles Design', anzahl: 2, beispiele: [{ id: 'm1', text: 'Bitte dunkel' }], weitere: 0 }]
    const h = html(createElement(briefkasten.Wunschliste, { buendel }))
    expect(anzahlEmptyStates(h)).toBe(0)
    expect(h).toContain('Dunkles Design')
  })
})

describe('Auswertung — Umsatzkarte', () => {
  const basis = {
    zeitraum: 'diese Woche',
    summeCent: 0,
    vergleich: { richtung: 'keiner' as const, text: 'Noch keine Vorwoche zum Vergleich' },
    laufend: true,
    vergleichLabel: 'Vorwoche',
  }

  it('ohne Verkauf im Zeitraum: EmptyState mit Titel und dem Weg, einen Verkauf einzutragen', () => {
    const h = html(createElement(auswertung.UmsatzKarte, { ...basis, balken: [{ label: 'Mo', cent: 0, vergleichCent: 0 }] }))
    expect(anzahlEmptyStates(h)).toBe(1)
    expect(h).toContain(UMSATZ_LEER.titel)
    expect(h).toMatch(alsLink(UMSATZ_LEER.aktion.href, UMSATZ_LEER.aktion.text))
  })

  it('Gegenprobe: mit Umsatz steht kein EmptyState da', () => {
    const h = html(createElement(auswertung.UmsatzKarte, { ...basis, summeCent: 1000, balken: [{ label: 'Mo', cent: 1000, vergleichCent: 0 }] }))
    expect(anzahlEmptyStates(h)).toBe(0)
    expect(h).not.toContain(UMSATZ_LEER.titel)
  })
})

describe('WhatsApp — keine Abonnentin', () => {
  const basis = { postId: 'p1', title: 'Frische Eier', body: 'Heute neu im Shop.', farmSlug: 'hof-test', getippt: [] }
  const anzahlH1 = (h: string) => (h.match(/<h1\b/g) ?? []).length

  it('ohne Abonnentin: EmptyState mit Titel, Satz und dem Weg zurück zu den Beiträgen; sein Titel ist die eine h1', () => {
    const h = html(createElement(whatsapp.WhatsAppTapClient, { ...basis, abonnentinnen: [] }))
    expect(anzahlEmptyStates(h)).toBe(1)
    expect(h).toContain(WHATSAPP_VERSAND_TEXT.leer.satz)
    expect(h).toMatch(alsLink(BEITRAEGE_HREF.replaceAll('&', '&amp;'), WHATSAPP_VERSAND_TEXT.leer.aktion))
    expect(anzahlH1(h)).toBe(1)
    expect(h).toMatch(new RegExp(`<h1[^>]*>${maskiere(WHATSAPP_VERSAND_TEXT.leer.titel)}</h1>`))
    // Keine zweite Fassung der Überschrift (unsichtbar oder nicht) und kein Fachwort.
    expect(h).not.toContain('WhatsApp versenden')
    expect(h).not.toContain('Opt-in')
  })

  it('der Satz verspricht nicht mehr, als die Liste hält: nur Kundinnen mit Häkchen UND Nummer', () => {
    expect(WHATSAPP_VERSAND_TEXT.leer.satz).toMatch(/Nummer/)
  })

  it('Gegenprobe: mit einer Abonnentin steht kein EmptyState da, und die Seite hat weiter eine h1', () => {
    const abonnentinnen = [{ id: 'a1', name: 'Erika Mustermann', phone: '+43 660 0000000' }]
    const h = html(createElement(whatsapp.WhatsAppTapClient, { ...basis, abonnentinnen }))
    expect(anzahlEmptyStates(h)).toBe(0)
    expect(anzahlH1(h)).toBe(1)
    expect(h).toContain('Erika')
  })
})
