/**
 * Kasse leer mit Grund (Register N28, Nr. 169; Fund aus Bericht 165): Fällt durch die Prüfung beim Öffnen alles aus
 * dem Korb, stand nur „Dein Korb ist leer" da — der Grund (`korbHinweis`) stand nur im vollen Zweig. Jetzt rendert der
 * leere Zustand `KasseLeer` die orange Hinweiskarte ÜBER dem leeren Zustand, nicht in dessen Satz.
 *
 * Die Komponente wird direkt gerendert: Der Hinweis entsteht in der Kasse erst nach einem `await` (Prüfung beim
 * Öffnen) und fehlte im Server-Render der ganzen Kasse.
 */
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => '/hof-test/checkout',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))

import { KasseLeer } from '@/components/checkout/checkout-form'

const HOF = { name: 'Testhof A', slug: 'hof-test' }
const GRUND = 'Eine Position ist nicht mehr verfügbar und wurde entfernt.'

describe('KasseLeer (Register N28)', () => {
  it('mit Hinweis: die orange Karte als Status über dem leeren Zustand', () => {
    const html = renderToStaticMarkup(createElement(KasseLeer, { hof: HOF, hinweis: GRUND }))

    expect(html).toContain('role="status"')
    expect(html).toContain('data-ton="orange"')
    expect(html).toContain(GRUND)
    expect(html).toContain('Dein Korb ist leer')
    // Die Karte steht ÜBER dem leeren Zustand, nicht in dessen Satz.
    expect(html.indexOf(GRUND)).toBeLessThan(html.indexOf('Dein Korb ist leer'))
    expect(html).toContain('href="/hof-test"')
  })

  it('Gegenprobe: ohne Hinweis nur der leere Zustand mit Ausweg', () => {
    const html = renderToStaticMarkup(createElement(KasseLeer, { hof: HOF, hinweis: null }))

    expect(html).not.toContain('role="status"')
    expect(html).not.toContain('data-ton="orange"')
    expect(html).toContain('Dein Korb ist leer')
    expect(html).toContain('Leg bei Testhof A etwas in den Korb, dann kannst du hier bestellen.')
    expect(html).toContain('Zurück zum Hof')
  })
})
