/**
 * Das Korb-Blatt nach den Boards s1-/w1-korb (Nr. 227, Register N41 d) — gerendert mit renderToStaticMarkup.
 *
 * Beweist:
 *  - Das Blatt ist `SheetBlatt seite="rechts"` mit `SheetKopf` (genau ein „Schließen“), nicht mehr `SheetContent`
 *    mit Kreuz; der Titel nennt den Hof, leer nur „Warenkorb“.
 *  - Nach dem Abgleich steht oben EINE orange Karte mit Titel „Dein Warenkorb hat sich geändert.“ und dem Satz,
 *    vorgelesen als Status; ohne Satz keine Karte (Gegenprobe).
 *  - Unten Gesamt, „Inkl. Plattformgebühr · Reservierung gilt … Minuten.“ und „Zur Kasse“ grün über die volle Breite.
 *  - Leer (Bild 3, Runde 2): der Kasten links bündig mit Titel in der Grundschrift, „Zum Angebot“ in der Zeile darunter,
 *    das Symbol bleibt (Register N9).
 *  - N29 (Lücke aus Nr. 235): Scheitert „−“/„+“ am Netz, sagt das Blatt den N29-Satz mit „Nochmal“; eine Ablehnung des
 *    Servers den geglätteten Satz ohne „Nochmal“; eine stehende Menge nichts (Gegenprobe). Der Quelltext verwirft das
 *    Ergebnis von `onUpdateQuantity` nicht mehr.
 *
 * Das Blatt rendert sein Fenster beim Server-Rendern nicht (Portal): `SheetBlatt` und `SheetKopf` stehen an Ort und
 * Stelle (per vi.mock ersetzte Teilkomponenten, TESTING_GUIDELINES §1); der Kopf zeigt seinen Titel und vermerkt,
 * welches Schließen-Wort er trägt.
 */
import { Fragment, createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@/components/ui/sheet', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/components/ui/sheet')>()
  type Kinder = { open?: boolean; children?: ReactNode }
  return {
    ...echt,
    Sheet: (props: Kinder) => createElement(Fragment, null, props.open ? props.children : null),
    SheetBlatt: (props: Kinder & { seite?: string }) => createElement('section', { 'data-blatt': props.seite ?? 'unten' }, props.children),
    SheetKopf: (props: { titel?: ReactNode; schliessen?: string }) =>
      createElement('h2', { 'data-schliessen': props.schliessen ?? 'Schließen' }, props.titel),
  }
})

import { CartSheet, KORB_GEAENDERT_TITEL, mengeFehlerNach } from '@/components/farm/cart-sheet'
import { NETZ_SATZ } from '@/lib/netz'
import { KORB_LEER } from '@/lib/use-cart'
import type { CartItem } from '@/lib/use-cart'

const MILCH: CartItem = { productId: 'p1', name: 'Heumilch frisch', price: 1.4, unit: 'LITER', unitSize: 1, imageUrl: null, quantity: 4 }

function blatt(teil: { items?: CartItem[]; hinweis?: string | null; gebuehrKorb?: string | null } = {}): string {
  const items = teil.items ?? [MILCH]
  return renderToStaticMarkup(
    createElement(CartSheet, {
      open: true,
      onOpenChange: () => {},
      items,
      total: 5.6,
      farmSlug: 'hof-test',
      onUpdateQuantity: async () => ({ ok: true }),
      onRemoveItem: () => {},
      gebuehrKorb: teil.gebuehrKorb ?? 'inkl. Plattformgebühr',
      kaufSperre: { sperre: null, hofName: 'Hof Test', pauseMessage: null },
      hinweis: teil.hinweis ?? null,
    })
  )
}

describe('Korb-Blatt (Boards s1-/w1-korb)', () => {
  it('Blatt rechts mit einem „Schließen“, Titel mit dem Hof', () => {
    const html = blatt()
    expect(html).toContain('data-blatt="rechts"')
    expect(html).toContain('data-schliessen="Schließen"')
    expect(html).toMatch(/<h2[^>]*>.*Warenkorb · .*Hof Test.*<\/h2>/)
  })

  it('leer: nur „Warenkorb“ im Titel', () => {
    const html = blatt({ items: [] })
    expect(html).toMatch(/<h2[^>]*>Warenkorb<\/h2>/)
    expect(html).not.toContain('Warenkorb · ')
  })

  it('nach dem Abgleich: eine Karte im Paar „tun“ mit Titel und Satz, vorgelesen als Status (Lauf 31)', () => {
    const satz = 'Bergkäse ist gerade ausverkauft – wir haben ihn herausgenommen.'
    const html = blatt({ hinweis: satz })
    const karte = html.indexOf(KORB_GEAENDERT_TITEL)
    expect(karte).toBeGreaterThan(-1)
    expect(html.indexOf(satz)).toBeGreaterThan(karte)
    // Titel und Satz in der Schrift des Bedeutungs-Paars „tun“ auf seiner Fläche (Board s1-/w1-korb Bild 2).
    expect(html.slice(0, karte)).toMatch(/<div role="status" class="[^"]*\bbg-zustand-tun-grund\b[^"]*\btext-zustand-tun\b[^"]*"><p[^>]*>$/)
  })

  it('Gegenprobe: ohne Satz keine Karte', () => {
    expect(blatt()).not.toContain(KORB_GEAENDERT_TITEL)
  })

  it('unten Gesamt, der Satz mit Gebühr und Reservierung, „Zur Kasse“ grün über die volle Breite', () => {
    const html = blatt()
    expect(html).toContain('Gesamt')
    expect(html.replace(/<!-- -->/g, '')).toContain('Inkl. Plattformgebühr · Reservierung gilt 15 Minuten.')
    const kasse = html.match(/<a href="\/hof-test\/checkout"[^>]*>/)?.[0] ?? ''
    expect(kasse).toContain('bg-accent')
    expect(kasse).toContain('w-full')
  })

  it('der Quelltext nimmt die Bausteine aus Nr. 219, nicht mehr SheetContent mit Kreuz', () => {
    const quelle = readFileSync(join(__dirname, '..', 'src/components/farm/cart-sheet.tsx'), 'utf8')
    expect(quelle).toMatch(/<SheetBlatt seite="rechts">/)
    expect(quelle).toMatch(/<SheetKopf\b/)
    expect(quelle).not.toMatch(/<SheetContent\b/)
  })

  it('leer (Bild 3, Runde 2): Kasten links bündig, Titel in der Grundschrift, „Zum Angebot“ in der dritten Zeile darunter', () => {
    const html = blatt({ items: [] })
    // renderToStaticMarkup maskiert & und > in Attributen.
    const leer = (html.match(/<div data-slot="empty-state" class="([^"]*)"/)?.[1] ?? '').replace(/&amp;/g, '&').replace(/&gt;/g, '>')
    expect(leer).toContain('grid')
    expect(leer).toContain('text-left')
    expect(leer).toContain('before:row-span-2')
    expect(leer).toContain('[&>p:first-of-type]:font-sans')
    expect(leer).toContain('[&>div]:row-start-3')
    // Register N9: Symbol, Satz, Aktion — das Symbol steht weiter im Kasten.
    expect(html).toMatch(/data-slot="empty-state"[^>]*><span[^>]*><svg/)
    expect(html).toContain(KORB_LEER.titel)
    expect(html).toContain(KORB_LEER.zumHof)
  })
})

describe('Korb-Blatt: Menge ohne Netz (Register N29)', () => {
  it('am Netz gescheitert: der N29-Satz mit „Nochmal“', () => {
    expect(mengeFehlerNach({ ok: false, error: NETZ_SATZ, nochmal: true })).toEqual({ text: NETZ_SATZ, nochmal: true })
  })

  it('vom Server abgelehnt: ein verständlicher Satz, kein „Nochmal“, nie der rohe Text', () => {
    const fehler = mengeFehlerNach({ ok: false, error: 'Serverfehler bei der Reservierung' })
    expect(fehler?.nochmal).toBe(false)
    expect(fehler?.text).not.toContain('Serverfehler')
    expect(fehler?.text).not.toBe(NETZ_SATZ)
  })

  it('Gegenprobe: Menge stand — kein Satz', () => {
    expect(mengeFehlerNach({ ok: true })).toBeNull()
  })

  it('der Quelltext wertet das Ergebnis von onUpdateQuantity aus und zeigt den Satz am Ort (SpeicherFehler)', () => {
    const quelle = readFileSync(join(__dirname, '..', 'src/components/farm/cart-sheet.tsx'), 'utf8')
    expect(quelle).toMatch(/onUpdateQuantity\(productId, menge\)\.then\(/)
    expect(quelle).not.toMatch(/onClick=\{\(\) => onUpdateQuantity\(/)
    expect(quelle).toMatch(/<SpeicherFehler text=\{mengeFehler\.text\} nochmal=\{mengeFehler\.nochmal\}/)
  })
})
