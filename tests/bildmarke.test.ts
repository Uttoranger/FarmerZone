/**
 * Die Bildmarke in der Oberfläche (src/components/shared/bildmarke.tsx,
 * wortmarke.tsx; Register M1, Ergänzung 14.10.2026): ein `<img>` auf die
 * SVG-Datei, keine zweite Zeichnung irgendwo im Code.
 *
 * Beweist (serverseitig gerendert, TESTING_GUIDELINES §1):
 *  - Die Wortmarke zeigt die kleine Fassung mit 32 px, 8 px Rundung (25 %),
 *    vorab geladen, ohne Optimierung, ohne Alternativtext — und den Namen aus
 *    MARKE; kein Inline-SVG, kein Farbwert.
 *  - Die Bildmarke nimmt Fassung, Größe und Rundung aus den Props (Gegenprobe).
 *  - Vorab geladen wird nur in der Kopfzeile: Der Fuß der Startseite gibt priority={false}.
 *  - Kein App-Icon als Marke in einer Komponente — die Handy-Leiste des KundenKopf zeigt die Bildmarke klein.
 *  - Quelltext-Wache: Die alten Zeichnungen (Blatt im Kreis der Wortmarke und
 *    des Teilen-Bilds) stehen nirgends mehr unter src/ — mit Gegenprobe, dass
 *    die Suche einen eingepflanzten Pfad fände.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type CSSProperties } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// next/image braucht die Laufzeit von Next; hier zählt nur, was die Komponente ihm gibt.
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string; width: number; height: number; style?: CSSProperties; className?: string; priority?: boolean; unoptimized?: boolean; 'aria-hidden'?: string }) =>
    createElement('img', {
      src: p.src,
      alt: p.alt,
      width: p.width,
      height: p.height,
      style: p.style,
      className: p.className,
      'aria-hidden': p['aria-hidden'],
      'data-priority': p.priority ? 'ja' : undefined,
      'data-unoptimized': p.unoptimized ? 'ja' : undefined,
    }),
}))

import { Bildmarke } from '@/components/shared/bildmarke'
import { Wortmarke } from '@/components/shared/wortmarke'
import { MARKE } from '@/lib/marke'
import { markeBildUrl } from '@/lib/marke-bild'

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el)

describe('Wortmarke', () => {
  it('zeigt die kleine Fassung als Bild (32 px, 8 px Rundung, vorab geladen, unverändert) und den Namen — kein Inline-SVG', () => {
    const text = html(createElement(Wortmarke))
    const bilder = text.match(/<img\b[^>]*>/g) ?? []
    expect(bilder).toHaveLength(1)
    const bild = bilder[0]
    expect(bild).toContain(`src="${markeBildUrl('klein')}"`)
    expect(bild).toContain('width="32"')
    expect(bild).toContain('height="32"')
    expect(bild).toContain('alt=""')
    expect(bild).toContain('aria-hidden="true"')
    expect(bild).toContain('border-radius:25%')
    expect(bild).toContain('data-priority="ja"')
    expect(bild).toContain('data-unoptimized="ja"')
    expect(text).toContain(`>${MARKE}<`)
    expect(text).not.toContain('<svg')
    expect(text).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })

  it('die Datei zeichnet nichts selbst: kein <svg>, kein <path>, kein Farbwert', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/components/shared/wortmarke.tsx'), 'utf8')
    expect(quelle).not.toMatch(/<svg|<path|<circle|#[0-9a-fA-F]{6}/)
  })
})

describe('Bildmarke', () => {
  it('nimmt Fassung, Größe und Rundung aus den Props; ohne priority kein Vorabladen (Gegenprobe zur Wortmarke)', () => {
    const voll = html(createElement(Bildmarke, { groesse: 64, fassung: 'voll' }))
    expect(voll).toContain(`src="${markeBildUrl('voll')}"`)
    expect(voll).toContain('width="64"')
    expect(voll).toContain('border-radius:22%')
    expect(voll).not.toContain('data-priority')
    expect(html(createElement(Bildmarke, { groesse: 16, fassung: 'klein', rundung: 0 }))).toContain('border-radius:0%')
    expect(markeBildUrl('voll')).not.toBe(markeBildUrl('klein'))
  })

  it('die Wortmarke lädt nur in der Kopfzeile vorab — der Fuß der Startseite gibt priority={false}', () => {
    expect(html(createElement(Wortmarke, { priority: false }))).not.toContain('data-priority')
    const fuss = readFileSync(join(process.cwd(), 'src/components/startseite/startseite-abschnitte.tsx'), 'utf8')
    expect(fuss).toContain('<Wortmarke priority={false} />')
  })
})

describe('Wache: nur EINE Zeichnung der Marke', () => {
  /** Die beiden alten Blätter: Wortmarke (viewBox 80, Kreis) und Teilen-Bild (viewBox 16×18). */
  const ALTE_ZEICHNUNGEN = ['C22 24 30 16', 'M8 1C3 5']

  function funde(ordner: string, muster: readonly string[]): string[] {
    const treffer: string[] = []
    for (const name of readdirSync(ordner)) {
      const pfad = join(ordner, name)
      if (statSync(pfad).isDirectory()) treffer.push(...funde(pfad, muster))
      else if (/\.(tsx?|css|svg|json)$/.test(name)) {
        const text = readFileSync(pfad, 'utf8')
        for (const m of muster) if (text.includes(m)) treffer.push(`${pfad}: ${m}`)
      }
    }
    return treffer
  }

  it('die alten Pfade stehen nirgends unter src/', () => {
    expect(funde(join(process.cwd(), 'src'), ALTE_ZEICHNUNGEN)).toEqual([])
  }, 30_000)

  it('keine Komponente nimmt ein App-Icon als Marke — die Kopfzeile am Handy zeigt die Bildmarke klein', () => {
    // Bis Nr. 92 stand in der Handy-Leiste des KundenKopf `/icons/icon-192.png` (das F-Icon); mit der vollen Fassung
    // darin stünde dort die große Marke bei 32 px. Die Ziele des Skripts nennt nur src/lib/marke-bild.ts.
    expect(funde(join(process.cwd(), 'src/components'), ['/icons/icon-'])).toEqual([])
    const kopf = readFileSync(join(process.cwd(), 'src/components/shared/kunden-kopf.tsx'), 'utf8')
    expect(kopf).toContain('<Bildmarke groesse={MARKE_KOPF_PX} fassung="klein"')
  })

  it('Gegenprobe: die Suche findet einen eingepflanzten Pfad in dieser Testdatei', () => {
    const hier = funde(join(process.cwd(), 'tests'), ['C22 24 30 16', '/icons/icon-'])
    expect(hier.some((f) => f.endsWith('bildmarke.test.ts: C22 24 30 16'))).toBe(true)
    expect(hier.some((f) => f.endsWith('bildmarke.test.ts: /icons/icon-'))).toBe(true)
  }, 30_000)
})
