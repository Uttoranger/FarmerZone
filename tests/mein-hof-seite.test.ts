/**
 * „Mein Hof" in der HofShell (Gate 5, Nachtlauf Nr. 16; Mockups
 * web-h1-mein-hof-vorschau-handy, web-h1-mein-hof-vorschau-web,
 * web-h1-vorschau-vergroessert, mobil-h1-mein-hof).
 *
 * Beweist:
 *  - Reiter Hofseite | Beiträge stehen in der Adresse (?reiter=beitraege, E12);
 *    Ungültiges fällt still auf „Hofseite".
 *  - Die Beiträge-Übersicht ordnet Aktiv · Entwürfe · Vergangen, rechnet „vor
 *    …" vom übergebenen Zeitpunkt und sagt, wo ein Beitrag hinging.
 *  - Jede Zeile der Checkliste hat ein Ziel in den bestehenden Einstellungen,
 *    und das Ziel gibt es als Seite.
 *  - /farm-page liegt in der Routengruppe (hof) mit der HofShell; das
 *    Bauern-Layout bleibt bei der Bestandsnavigation (kein Big Bang).
 *  - Die Vorschau ist die echte Hofseite (?vorschau=1) — kein Nachbau.
 *  - Der Reiter „Beiträge" baut keinen neuen Editor: Neu und Bearbeiten
 *    führen in die bestehenden Seiten unter /status.
 *  - Kopf, Reiter und Beiträge rendern in beiden Themes mit Tokens (keine
 *    Farbliterale, kein black/white), Symbole aria-hidden.
 */
import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string }) => createElement('img', { src: props.src, alt: props.alt }),
}))

import { MEIN_HOF_REITER_HOFBEREICH, meinHofReiterAus } from '@/lib/bauern-navigation'
import { meinHofReiterSchema } from '@/schemas/mein-hof-reiter'
import { beitraegeUebersicht, type BeitragQuelle } from '@/lib/mein-hof-beitraege'
import { EINSTELLUNG_FUER_ZEILE } from '@/lib/hofseite-fortschritt'
import { hofseiteZeileIdSchema } from '@/schemas/hofseite-vorschau'
import { MeinHofSeitenkopf } from '@/components/mein-hof/seitenkopf'
import { BeitraegeReiter } from '@/components/mein-hof/beitraege-reiter'
import type { MeinHofKopfDaten } from '@/server/queries/farm'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('Reiter in der Adresse (E12)', () => {
  it('Hofseite ohne Parameter, Beiträge mit ?reiter=beitraege — beide auf /farm-page', () => {
    expect(MEIN_HOF_REITER_HOFBEREICH.map((r) => [r.id, r.label, r.href])).toEqual([
      ['hofseite', 'Hofseite', '/farm-page'],
      ['beitraege', 'Beiträge', '/farm-page?reiter=beitraege'],
    ])
  })

  it('liest den Reiter aus dem Parameter — Ungültiges, Leeres und Listen fallen still auf Hofseite', () => {
    expect(meinHofReiterAus('beitraege')).toBe('beitraege')
    expect(meinHofReiterAus('hofseite')).toBe('hofseite')
    expect(meinHofReiterAus(undefined)).toBe('hofseite')
    expect(meinHofReiterAus('')).toBe('hofseite')
    expect(meinHofReiterAus('produkte')).toBe('hofseite')
    expect(meinHofReiterAus('<script>')).toBe('hofseite')
    // Next liefert einen doppelten Parameter als Liste: der erste zählt.
    expect(meinHofReiterAus(['beitraege', 'hofseite'])).toBe('beitraege')
    expect(meinHofReiterAus(['x', 'beitraege'])).toBe('hofseite')
  })

  it('das Schema wirft nie', () => {
    expect(meinHofReiterSchema.parse(42)).toBe('hofseite')
    expect(meinHofReiterSchema.parse(null)).toBe('hofseite')
  })
})

describe('Beiträge-Übersicht', () => {
  const jetzt = '2026-10-06T10:00:00.000Z'
  const basis: BeitragQuelle = {
    id: 'b1',
    title: 'Erdbeeren sind da',
    isActive: false,
    isDraft: false,
    publishedAt: null,
    sentViaEmail: false,
    sentViaWhatsApp: false,
  }

  it('ordnet Aktiv · Entwürfe · Vergangen, leere Gruppen fallen weg', () => {
    const u = beitraegeUebersicht(
      [
        { ...basis, id: 'alt', publishedAt: '2026-10-01T10:00:00.000Z' },
        { ...basis, id: 'entwurf', isDraft: true },
        { ...basis, id: 'aktiv', isActive: true, publishedAt: '2026-10-06T07:00:00.000Z' },
      ],
      jetzt
    )
    expect(u.gruppen.map((g) => [g.titel, g.eintraege.map((e) => e.id)])).toEqual([
      ['Aktiv', ['aktiv']],
      ['Entwürfe', ['entwurf']],
      ['Vergangen', ['alt']],
    ])
    expect(u.anzahl).toBe(3)
    expect(beitraegeUebersicht([{ ...basis, isDraft: true }], jetzt).gruppen.map((g) => g.titel)).toEqual(['Entwürfe'])
    expect(beitraegeUebersicht([], jetzt)).toEqual({ gruppen: [], anzahl: 0 })
  })

  it('Marke je Zustand: aktiv grün, Entwurf und abgelaufen neutral', () => {
    const [aktiv] = beitraegeUebersicht([{ ...basis, isActive: true, publishedAt: jetzt }], jetzt).gruppen[0].eintraege
    expect(aktiv.marke).toEqual({ text: 'Aktiv', ton: 'fertig' })
    const [entwurf] = beitraegeUebersicht([{ ...basis, isDraft: true }], jetzt).gruppen[0].eintraege
    expect(entwurf.marke).toEqual({ text: 'Entwurf', ton: 'neutral' })
    const [alt] = beitraegeUebersicht([{ ...basis, publishedAt: '2026-09-01T10:00:00.000Z' }], jetzt).gruppen[0].eintraege
    expect(alt.marke).toEqual({ text: 'Abgelaufen', ton: 'neutral' })
  })

  it('„vor …" vom übergebenen Zeitpunkt, und wohin der Beitrag ging', () => {
    const eintrag = (q: Partial<BeitragQuelle>) => beitraegeUebersicht([{ ...basis, ...q }], jetzt).gruppen[0].eintraege[0]
    expect(eintrag({ isActive: true, publishedAt: '2026-10-06T07:00:00.000Z' }).zeile).toBe('vor 3 Stunden · Nur auf der Hofseite')
    expect(eintrag({ publishedAt: '2026-10-04T09:00:00.000Z', sentViaEmail: true }).zeile).toBe('vor 2 Tagen · Hofseite und E-Mail')
    expect(eintrag({ publishedAt: '2026-10-04T09:00:00.000Z', sentViaWhatsApp: true }).zeile).toBe('vor 2 Tagen · Hofseite und WhatsApp')
    expect(eintrag({ publishedAt: '2026-10-04T09:00:00.000Z', sentViaEmail: true, sentViaWhatsApp: true }).zeile).toBe(
      'vor 2 Tagen · Hofseite, E-Mail und WhatsApp'
    )
    expect(eintrag({ isDraft: true }).zeile).toBe('Noch nicht veröffentlicht')
  })
})

describe('Checkliste: Ziele in den bestehenden Einstellungen', () => {
  it('jede Zeile hat ein Ziel, und das Ziel ist eine Seite unter /settings', () => {
    for (const id of hofseiteZeileIdSchema.options) {
      const ziel = EINSTELLUNG_FUER_ZEILE[id]
      expect(ziel, id).toMatch(/^\/settings\/[a-z-]+$/)
      expect(existsSync(join(process.cwd(), `src/app/(hof)${ziel}/page.tsx`)), ziel).toBe(true)
    }
  })

  it('Gegenprobe: ein erfundenes Ziel gibt es nicht', () => {
    expect(existsSync(join(process.cwd(), 'src/app/(hof)/settings/gibt-es-nicht/page.tsx'))).toBe(false)
  })
})

describe('/farm-page in der HofShell', () => {
  const layout = quelle('src/app/(hof)/layout.tsx')
  const seite = quelle('src/app/(hof)/farm-page/page.tsx')

  it('die Routengruppe (hof) trägt die HofShell mit Zahlen aus dem gemeinsamen Lader', () => {
    expect(layout).toContain("from '@/components/shells/hof-shell'")
    expect(layout).toMatch(/<HofShell[\s\S]*?zahlen=\{/)
    expect(layout).toContain('ladeHofbereich()')
    // Freigabe- und Stilllegungs-Balken (neues Design), Service-Worker und Sentry-Kennung wie im Bestand.
    for (const teil of ['<HofBalken balken={balken}', '<ServiceWorkerAnmeldung', '<SentryNutzer farmId={hof.id}']) {
      expect(layout, teil).toContain(teil)
    }
  })

  it('das Bauern-Layout nimmt denselben Lader und bleibt bei der Bestandsnavigation', () => {
    const bestand = quelle('src/app/(farmer)/layout.tsx')
    expect(bestand).toContain('ladeHofbereich()')
    expect(bestand).toContain('<FarmerNav')
    expect(bestand).not.toContain('@/components/shells/')
  })

  it('/farm-page gibt es nur noch in (hof)', () => {
    expect(existsSync(join(process.cwd(), 'src/app/(farmer)/farm-page'))).toBe(false)
  })

  it('die Seite liest den Reiter nur über meinHofReiterAus und zeigt Hofseite ODER Beiträge', () => {
    expect(seite).toContain('meinHofReiterAus(')
    expect(seite).toMatch(/reiter === 'beitraege'/)
    expect(seite).toContain('<BeitraegeReiter')
    expect(seite).toContain('<HofseiteEditor')
    expect(seite).toContain('<FarmPageClient')
  })

  it('die Vorschau ist die echte Hofseite: Rahmen und Kundenansicht nehmen vorschauLink/vorschauAdresse', () => {
    const rahmen = quelle('src/components/farmer/hofseite-vorschau-rahmen.tsx')
    expect(rahmen).toMatch(/<iframe[\s\S]*?src=\{vorschauAdresse\(slug, anfang\)\}/)
    expect(rahmen).not.toMatch(/FarmPageView|HofseiteKunde/)
    const kunde = quelle('src/components/farmer/farm-page-client.tsx')
    expect(kunde).toMatch(/<iframe[\s\S]*?src=\{vorschauLink\(farm\.slug\)\}/)
  })
})

describe('Kopf und Reiter (neues Design)', () => {
  const kopf: MeinHofKopfDaten = {
    name: 'Hof Test',
    slug: 'hof-test',
    adresse: { anzeige: 'farmerzone.at/hof-test', url: 'https://farmerzone.at/hof-test' },
    logoUrl: null,
    titelbildUrl: null,
    bannerValue: null,
    bannerFocusY: 50,
    zustand: { art: 'sichtbar', schild: { text: 'Öffentlich', farbe: 'gruen' }, oeffentlich: true },
  }

  const rendere = (aktiv: 'hofseite' | 'beitraege', k: MeinHofKopfDaten = kopf) =>
    renderToStaticMarkup(createElement(MeinHofSeitenkopf, { hof: k, aktiv, beitraegeZahl: 2 }))

  it('Reiter als Links mit aria-current, Zahl hinter „Beiträge"', () => {
    const html = rendere('beitraege')
    expect(html).toContain('href="/farm-page"')
    expect(html).toMatch(/href="\/farm-page\?reiter=beitraege"[^>]*aria-current="page"/)
    expect(html).not.toMatch(/href="\/farm-page"[^>]*aria-current/)
    expect(html).toContain('Beiträge · 2')
  })

  it('öffentlich: Kundenansicht (Vorschau in neuem Tab) und Teilen; Zustand als StatusBadge', () => {
    const html = rendere('hofseite')
    expect(html).toContain('href="/hof-test?vorschau=1"')
    expect(html).toContain('Kundenansicht')
    expect(html).toContain('data-slot="status-badge" data-status="fertig"')
    expect(html).toContain('Öffentlich')
  })

  it('nicht freigegeben: Adresse als Text, kein Teilen, Schild neutral', () => {
    const html = rendere('hofseite', {
      ...kopf,
      zustand: { art: 'wartet', schild: { text: 'Noch nicht freigegeben', farbe: 'grau' }, oeffentlich: false },
    })
    expect(html).not.toContain('href="https://farmerzone.at/hof-test"')
    expect(html).not.toContain('Teilen')
    expect(html).toContain('data-status="neutral"')
    // Die Vorschau sieht der Besitzer auch vor der Freigabe (ansichtsModus).
    expect(html).toContain('href="/hof-test?vorschau=1"')
  })

  it('jedes Symbol ist aria-hidden', () => {
    for (const svg of rendere('hofseite').match(/<svg[^>]*>/g) ?? []) expect(svg).toContain('aria-hidden="true"')
  })
})

describe('Reiter „Beiträge"', () => {
  const jetzt = '2026-10-06T10:00:00.000Z'

  it('mit Beiträgen: Gruppen, „Neuer Beitrag" und die bestehende Seite /status verlinkt', () => {
    const html = renderToStaticMarkup(
      createElement(BeitraegeReiter, {
        uebersicht: beitraegeUebersicht(
          [{ id: 'b1', title: 'Erdbeeren sind da', isActive: true, isDraft: false, publishedAt: jetzt, sentViaEmail: false, sentViaWhatsApp: false }],
          jetzt
        ),
      })
    )
    expect(html).toContain('Erdbeeren sind da')
    expect(html).toContain('href="/status/new"')
    expect(html).toContain('href="/status"')
    expect(html).toContain('Aktiv')
  })

  it('leer: EmptyState mit Ausweg „Ersten Beitrag schreiben"', () => {
    const html = renderToStaticMarkup(createElement(BeitraegeReiter, { uebersicht: { gruppen: [], anzahl: 0 } }))
    expect(html).toContain('data-slot="empty-state"')
    expect(html).toContain('Ersten Beitrag schreiben')
    expect(html).toContain('href="/status/new"')
  })
})

describe('Tokens statt Farbwerte', () => {
  const dateien = [
    'src/components/mein-hof/seitenkopf.tsx',
    'src/components/mein-hof/beitraege-reiter.tsx',
    'src/components/mein-hof/checkliste-kompakt.tsx',
    'src/components/farmer/hofseite-editor.tsx',
    'src/components/farmer/hofseite-vorschau-rahmen.tsx',
    'src/components/farmer/farm-page-client.tsx',
    'src/app/(hof)/layout.tsx',
    'src/app/(hof)/farm-page/page.tsx',
    'src/app/(hof)/farm-page/loading.tsx',
  ]

  it.each(dateien)('%s: keine Farbliterale, kein black/white, keine Bestandspalette app-*', (datei) => {
    const text = quelle(datei)
    expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch)\(/)
    expect(text).not.toMatch(/\b(bg|text|border|ring|shadow|from|to|via|outline)-(black|white)\b/)
    expect(text).not.toMatch(/\bapp-(ink|page|chip|trough|bar|button|line)/)
  })

  it('Gegenprobe: die Suche findet Farbliterale und die Bestandspalette', () => {
    expect('text-app-ink').toMatch(/\bapp-(ink|page|chip|trough|bar|button|line)/)
    expect('shadow-black/25').toMatch(/\b(bg|text|border|ring|shadow|from|to|via|outline)-(black|white)\b/)
    expect(quelle('src/components/farm/farm-page-view.tsx')).toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch)\(/)
  })
})

describe('Balken der HofShell', () => {
  it('stillgelegt: Satz und „Hof reaktivieren"; wartet: Hof-ID und Frage per Mail; sonst nichts', async () => {
    const { HofBalken } = await import('@/components/hofbereich/hof-balken')
    const still = renderToStaticMarkup(createElement(HofBalken, { balken: { art: 'stillgelegt' } }))
    expect(still).toContain('href="/settings/account"')
    expect(still).toContain('data-ton="orange"')
    const wartet = renderToStaticMarkup(
      createElement(HofBalken, { balken: { art: 'wartet', farmId: 'farm_test', farmName: 'Hof Test', country: 'AT' } })
    )
    expect(wartet).toContain('farm_test')
    expect(wartet).toContain('href="mailto:')
    expect(renderToStaticMarkup(createElement(HofBalken, { balken: null }))).toBe('')
  })

  it('der Mail-Link trägt Betreff und Hof-ID, Leerzeichen als %20', async () => {
    const { freischaltungsMailto } = await import('@/lib/farm-approval')
    const link = freischaltungsMailto('support@example.com', 'Hof Test', 'farm_test')
    expect(link.startsWith('mailto:support@example.com?subject=Freischaltung%3A%20Hof%20Test')).toBe(true)
    expect(link).toContain('farm_test')
    expect(link).not.toContain('+')
  })
})

describe('Bestandsteile im Geltungsbereich', () => {
  const css = quelle('src/app/globals.css')
  const block = css.slice(css.indexOf('[data-app-palette="neu"] {'), css.indexOf('}', css.indexOf('[data-app-palette="neu"] {')))

  it('jede Variable der Bestandspalette bekommt einen Wert aus dem Design-System', () => {
    const bestand = new Set([...css.matchAll(/^\s*(--(?:app|notice)[a-z-]*):/gm)].map((m) => m[1]))
    expect(bestand.size).toBeGreaterThan(10)
    for (const name of bestand) expect(block, name).toMatch(new RegExp(`${name}: [^;]*var\\(--(fz-|muted)`))
  })

  it('die Hofseite mit Stiften und die Formulare des Editors stehen im Geltungsbereich', () => {
    expect(quelle('src/components/farmer/farm-page-client.tsx')).toMatch(/<div data-app-palette="neu">\s*<FarmPageView/)
    expect(quelle('src/components/farmer/hofseite-editor.tsx')).toContain('data-app-palette="neu"')
  })
})

describe('dnd-kit ohne Hydration-Fehler', () => {
  it('DndContext bekommt eine feste Kennung aus useId', () => {
    const text = quelle('src/components/shared/reorder-context.tsx')
    expect(text).toContain('const id = useId()')
    expect(text).toMatch(/<DndContext id=\{id\}/)
  })
})
