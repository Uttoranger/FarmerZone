/**
 * Kein Netz als Zustand (Register N29, Nr. 175) — die Ansichten, gerendert mit
 * renderToStaticMarkup (TESTING_GUIDELINES: Umgebung node, kein DOM):
 *
 *  - Netz-Zeile: offline steht der Satz mit role="status", online nichts
 *    (der leere Rahmen bleibt als Live-Region).
 *  - Die Shells binden die Zeile ein (KundeShell, KundeFokusShell, HofShell).
 *  - Fehlerseite: ohne Ziel zur Startseite, im Hofbereich „Zu Heute" mit dem
 *    Briefkasten des Hofbereichs; „Problem melden" 44 px, data-design="neu".
 *  - Leerer Korb im Blatt: EmptyState mit Weg zum Angebot und zu den Höfen.
 */
import { Fragment, createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// Das Blatt rendert sonst in ein Portal, das renderToStaticMarkup nicht ausgibt (wie tests/korb-blatt-cent.test.ts).
vi.mock('@/components/ui/sheet', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/components/ui/sheet')>()
  type Kinder = { open?: boolean; children?: ReactNode }
  return {
    ...echt,
    Sheet: (props: Kinder) => createElement(Fragment, null, props.open ? props.children : null),
    SheetContent: (props: Kinder) => createElement('section', null, props.children),
    SheetTitle: (props: Kinder) => createElement('h2', null, props.children),
  }
})

import { NetzHinweis, NetzZeile } from '@/components/ui/netz-hinweis'
import { FehlerAnsicht } from '@/components/shared/fehler-ansicht'
import { CartSheet } from '@/components/farm/cart-sheet'
import { NETZ_ZEILE } from '@/lib/netz'
import { FEHLER_TEXT, HOF_FEHLER_TEXT, HOEFE_ENTDECKEN, ZU_HEUTE, ZUR_STARTSEITE, fehlerKicker } from '@/lib/fehlerseite'
import { KORB_LEER } from '@/lib/use-cart'

const quelle = (datei: string): string => readFileSync(join(process.cwd(), datei), 'utf8')

describe('Netz-Zeile', () => {
  it('offline: der Satz unter dem Kopf, als Status vorgelesen, in den Farben „zustand-tun"', () => {
    const html = renderToStaticMarkup(createElement(NetzZeile, { online: false }))
    expect(html).toContain('role="status"')
    expect(html).toContain(NETZ_ZEILE)
    expect(html).toContain('text-zustand-tun')
    expect(html).toContain('bg-zustand-tun-grund')
  })

  it('Gegenprobe: online kein Satz — nur der leere Rahmen der Live-Region', () => {
    const html = renderToStaticMarkup(createElement(NetzZeile, { online: true }))
    expect(html).not.toContain(NETZ_ZEILE)
    expect(html).toContain('role="status"')
  })

  it('auf dem Server gilt „online" — keine Zeile, die bei der Hydration abwiche', () => {
    expect(renderToStaticMarkup(createElement(NetzHinweis))).not.toContain(NETZ_ZEILE)
  })

  it('KundeShell, KundeFokusShell und HofShell binden die Zeile ein', () => {
    const kunde = quelle('src/components/shells/kunde-shell.tsx')
    expect(kunde.match(/<NetzHinweis \/>/g)).toHaveLength(2)
    expect(quelle('src/components/shells/hof-shell.tsx').match(/<NetzHinweis \/>/g)).toHaveLength(1)
  })
})

describe('Fehlerseite (500)', () => {
  it('ohne Ziel: zur Startseite, Briefkasten der Kundinnen, Fehlernummer im Kicker', () => {
    const html = renderToStaticMarkup(createElement(FehlerAnsicht, { fehlernummer: 'ab12cd', nochmal: () => {} }))
    expect(html).toContain('data-design="neu"')
    expect(html).toContain(FEHLER_TEXT)
    expect(html).toMatch(new RegExp(`href="/"[^>]*>${ZUR_STARTSEITE}<`))
    expect(html).toContain('href="/problem-melden?kennung=ab12cd"')
    expect(html).toContain(fehlerKicker('ab12cd'))
    expect(fehlerKicker('ab12cd')).toBe('Fehler 500 · Nr. ab12cd')
  })

  it('im Hofbereich: „Zu Heute", Text des Hofbereichs, Briefkasten /fehler-melden — Problem melden mit 44 px', () => {
    const html = renderToStaticMarkup(
      createElement(FehlerAnsicht, {
        fehlernummer: 'ab12cd',
        nochmal: () => {},
        ziel: { href: '/dashboard', text: ZU_HEUTE },
        text: HOF_FEHLER_TEXT,
        meldenPfad: '/fehler-melden',
        imLayout: true,
      })
    )
    expect(html).toMatch(new RegExp(`href="/dashboard"[^>]*>${ZU_HEUTE}<`))
    expect(html).toContain(HOF_FEHLER_TEXT)
    expect(html).not.toContain(ZUR_STARTSEITE)
    expect(html).toMatch(/<a href="\/fehler-melden\?kennung=ab12cd" class="[^"]*min-h-11/)
  })

  it('Gegenprobe: ohne Fehlernummer kein „Nr." und der nackte Link', () => {
    const html = renderToStaticMarkup(createElement(FehlerAnsicht, { nochmal: () => {} }))
    expect(html).not.toContain('Nr.')
    expect(html).toContain('href="/problem-melden"')
  })

  it('src/app/(hof)/error.tsx führt zu Heute, meldet an Sentry und gibt reset weiter', () => {
    const datei = quelle('src/app/(hof)/error.tsx')
    expect(datei).toContain("ziel={{ href: '/dashboard', text: ZU_HEUTE }}")
    expect(datei).toContain('Sentry.captureException(error)')
    expect(datei).toMatch(/nochmal=\{reset\}/)
    expect(datei).toContain('error.digest')
  })
})

describe('Leerer Korb im Blatt', () => {
  function blatt(): string {
    return renderToStaticMarkup(
      createElement(CartSheet, {
        open: true,
        onOpenChange: () => {},
        items: [],
        total: 0,
        farmSlug: 'hof-test',
        onUpdateQuantity: () => {},
        onRemoveItem: () => {},
        kaufSperre: { sperre: null, hofName: 'Hof Test', pauseMessage: null },
      })
    )
  }

  it('EmptyState mit Satz und zwei Wegen: zum Angebot des Hofs und zu den Höfen', () => {
    const html = blatt()
    expect(html).toContain('data-slot="empty-state"')
    expect(html).toContain(KORB_LEER.titel)
    expect(html).toContain(KORB_LEER.satz)
    expect(html).toContain(`href="/hof-test"`)
    expect(html).toContain(`href="/hoefe"`)
    expect(html).toContain(HOEFE_ENTDECKEN)
  })
})
