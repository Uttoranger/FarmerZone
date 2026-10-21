/**
 * Der Baustein „Angemeldete Geräte" zeigt unter /admin/einstellungen/anmeldung
 * den Hinweis für Admins (Passkeys prüfen), auf der Kontoseite des Hofs den
 * unveränderten (Register N20, Nr. 126). Beide Fassungen kommen aus
 * `geraeteHinweise` (src/lib/geraete.ts); hier steht nur, DASS jede Seite die
 * ihre bekommt. Die Sätze selbst prüft tests/geraete.test.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/server/actions/geraete', () => ({ meldeAlleAnderenAb: vi.fn(), meldeGeraetAb: vi.fn() }))

import { AngemeldeteGeraete } from '@/components/konto/angemeldete-geraete'
import { geraeteHinweise, type GeraeteZeile } from '@/lib/geraete'

const ZEILEN: GeraeteZeile[] = [
  { id: 'a', name: 'Windows · Chrome', art: 'computer', dieses: true, unterzeile: 'dieses Gerät · angemeldet seit 20.10.' },
  { id: 'b', name: 'Android · Chrome', art: 'handy', dieses: false, unterzeile: 'zuletzt vor 2 Stunden · angemeldet seit 19.10.' },
]

/** Der Text ohne die Zeichenreferenzen, mit denen React „–“ und Umlaute schreibt. */
const klartext = (html: string): string => html.replace(/&#x27;/g, "'")

describe('AngemeldeteGeraete: Hinweis je Bereich', () => {
  it('im Admin-Bereich der Hinweis mit den Passkeys', () => {
    const html = klartext(renderToStaticMarkup(createElement(AngemeldeteGeraete, { zeilen: ZEILEN, fuerAdmin: true })))

    expect(html).toContain(geraeteHinweise(true).hinweis)
    expect(html).not.toContain(geraeteHinweise(false).hinweis)
  })

  it('für Höfe der unveränderte Hinweis — ohne die Eigenschaft und mit false', () => {
    for (const eigenschaften of [{ zeilen: ZEILEN }, { zeilen: ZEILEN, fuerAdmin: false }]) {
      const html = klartext(renderToStaticMarkup(createElement(AngemeldeteGeraete, eigenschaften)))
      expect(html).toContain(geraeteHinweise(false).hinweis)
      expect(html).not.toContain('Passkeys')
    }
  })

  it('die Seiten reichen es durch: die Admin-Seite sagt fuerAdmin, die Kontoseite des Hofs nicht', () => {
    const lies = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')

    expect(lies('src/app/admin/einstellungen/anmeldung/page.tsx')).toMatch(/<AngemeldeteGeraete[^>]*\bfuerAdmin\b/)
    expect(lies('src/app/(hof)/settings/account/page.tsx')).not.toMatch(/<AngemeldeteGeraete[^>]*\bfuerAdmin\b/)
  })
})
