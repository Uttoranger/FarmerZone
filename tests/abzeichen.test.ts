/**
 * Abzeichen „Gründungshof“ (Register K2, Änderung Nr. 116; Mockup
 * system-k2-gruendung-abzeichen) — die Nummer des Platzes geht nie an den
 * Browser, das Etikett erscheint nur, wenn der Hof eins trägt.
 *
 * Beweist:
 *  - getPublicFarm liest den festgeschriebenen Platz, gibt aber nur
 *    `gruendungshof` und den Monat weiter — weder der Schlüssel noch die
 *    Nummer stehen im Ergebnis (Gegenprobe: die Zeile der Datenbank trägt sie);
 *  - die Abfragen der Hofliste und der Hofseite nehmen die Felder vor dem
 *    Rückgabewert heraus (Quelltext);
 *  - HofKarte zeigt das Etikett nur mit `gruendungshof` (Render-Test mit Gegenprobe);
 *  - der Knopf auf der Hofseite öffnet einen Dialog (aria-haspopup) und hat
 *    einen Namen mit dem sichtbaren Wort.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { farm: { findUnique: vi.fn() } } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/hoefe' }))

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { prisma } from '@/lib/prisma'
import { getPublicFarm } from '@/server/queries/farm'
import { HofKarte, type KartenHof } from '@/components/hoefe/entdecken-teile'
import { Abzeichen, AbzeichenKnopf } from '@/components/ui/abzeichen'
import { ABZEICHEN_TEXT } from '@/lib/gruendungshof'

const ZEILE = {
  id: 'hof_1',
  slug: 'sonnhof',
  name: 'Sonnhof',
  ownerName: 'Max Mustermann',
  description: '',
  address: 'Teststraße 1',
  postalCode: '5280',
  city: 'Teststadt',
  phone: '+43 660 000 0000',
  email: 'hof@example.com',
  logoUrl: null,
  bannerUrl: null,
  tagline: null,
  foundedYear: null,
  aboutText: null,
  bannerType: 'GRADIENT',
  bannerValue: null,
  bannerFocusY: 50,
  bannerAusschnitt: null,
  logoAusschnitt: null,
  sectionsConfig: null,
  acceptsOnline: true,
  acceptsOnsite: true,
  stripeAccountReady: true,
  isPaused: false,
  pauseMessage: null,
  serviceFeePercent: 0,
  serviceFeeMinCents: 0,
  serviceFeeActiveFrom: null,
  farmValues: [],
  farmPhotos: [],
  betriebsnummer: null,
  betriebsstatus: null,
  products: [],
  pickupSlots: [],
  approvedAt: new Date('2026-10-05T10:00:00Z'),
  gruendungPlatz: 4711,
  gruendungAusgenommen: false,
  gruendungAbzeichenZeigen: true,
}

describe('getPublicFarm — nur Ja/Nein, nie die Nummer', () => {
  it('Gründungshof mit Monat der Freischaltung; der Platz steht weder als Schlüssel noch als Wert im Ergebnis', async () => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue(ZEILE as never)
    const hof = await getPublicFarm('sonnhof')
    expect(hof).toMatchObject({ gruendungshof: true, gruendungSeit: 'Oktober 2026', abzeichenBlatt: null })
    const json = JSON.stringify(hof)
    expect(json).not.toContain('gruendungPlatz')
    expect(json).not.toContain('4711')
    expect(json).not.toContain('gruendungAbzeichenZeigen')
    // Gegenprobe: Die Zeile der Datenbank trägt beides — die Suche schlägt an.
    expect(JSON.stringify(ZEILE)).toContain('4711')
  })

  it('ausgeblendet oder ausgenommen: kein Abzeichen, kein Monat', async () => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({ ...ZEILE, gruendungAbzeichenZeigen: false } as never)
    expect(await getPublicFarm('sonnhof')).toMatchObject({ gruendungshof: false, gruendungSeit: null })
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({ ...ZEILE, gruendungAusgenommen: true } as never)
    expect(await getPublicFarm('sonnhof')).toMatchObject({ gruendungshof: false })
  })

  it('Quelltext: Hofseite und Hofliste nehmen den Platz vor dem Rückgabewert heraus', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/server/queries/farm.ts'), 'utf8')
    // Hofseite und Vorschau des Besitzers: beide entpacken die Felder, bevor der Rest gespreizt wird.
    expect(quelle.match(/const \{ betriebsnummer, approvedAt, gruendungPlatz, gruendungAusgenommen, gruendungAbzeichenZeigen, (?:plattformgebuehrProzent, )?\.\.\.rest \} = farm/g)).toHaveLength(2)
    // Hofliste: das Ergebnis nennt nur das Ja/Nein.
    const start = quelle.indexOf('return hoefe.map((hof) => {')
    const rueckgabe = quelle.slice(start, quelle.indexOf('\n  })\n', start))
    expect(rueckgabe).toContain('gruendungshof: zeigtAbzeichen(hof)')
    expect(rueckgabe).not.toMatch(/gruendungPlatz|\.\.\.hof\b/)
  })
})

describe('Abzeichen in der Höfe-Liste und auf der Hofseite', () => {
  const karte: KartenHof = {
    slug: 'sonnhof',
    name: 'Sonnhof',
    postalCode: '5280',
    city: 'Teststadt',
    isPaused: false,
    kategorien: [],
    abholfenster: [],
    angebot: [],
    fotos: [],
    entfernungKm: null,
    latitude: null,
    longitude: null,
    gruendungshof: true,
  }
  const render = (hof: KartenHof): string =>
    renderToStaticMarkup(createElement(HofKarte, { hof, bereich: 'LEBENSMITTEL', schaufenster: { produkte: [], weitere: 0 }, split: true, ausgewaehlt: false, jetzt: '2026-10-21T08:00:00.000Z' }))

  it('HofKarte trägt das Etikett nur mit gruendungshof — kein eigener Knopf in der Karte', () => {
    const mit = render(karte)
    expect(mit).toContain('Gründungshof')
    expect(mit).toContain('lucide-sprout')
    expect(mit).not.toContain('aria-haspopup')
    expect(render({ ...karte, gruendungshof: false })).not.toContain('Gründungshof')
  })

  it('das Etikett: Wort im Text (Großbuchstaben nur per CSS), Spross verborgen, Farben aus den Tokens', () => {
    const html = renderToStaticMarkup(createElement(Abzeichen, { groesse: 'klein' }))
    expect(html).toContain('>Gründungshof<')
    expect(html).toContain('uppercase')
    expect(html).toMatch(/lucide-sprout[^>]*aria-hidden="true"|aria-hidden="true"[^>]*lucide-sprout/)
    expect(html).toContain('bg-abzeichen-grund')
    expect(html).toContain('text-abzeichen')
  })

  it('auf der Hofseite ein Knopf, der einen Dialog öffnet — Name enthält das sichtbare Wort, Trefferfläche über ::before', () => {
    const html = renderToStaticMarkup(createElement(AbzeichenKnopf, { hofName: 'Sonnhof', seit: 'Oktober 2026', blatt: { plaetze: 100, frei: 71 } }))
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('aria-label="Gründungshof – was heißt das?"')
    // 26 px sichtbar + 2 × 9 px unsichtbarer Rand = 44 px Tippfläche.
    expect(html).toContain('before:-inset-y-[9px]')
    expect(html).not.toMatch(/Nr\.\s?\d/)
  })
})

describe('Schalter „Abzeichen zeigen“ — der Satz nennt nur Orte, an denen das Etikett wirklich steht', () => {
  it('„geteilte Bilder“ nur, wenn das Teilen-Bild das Etikett zeichnet (Register K2)', () => {
    const teilenBild = ['src/app/(public)/[farmSlug]/opengraph-image/route.tsx', 'src/components/teilen/teilen-bild-grafik.tsx', 'src/lib/teilen-bild.ts', 'src/server/queries/teilen-bild.ts']
      .map((datei) => readFileSync(join(process.cwd(), datei), 'utf8'))
      .join('\n')
    const zeichnetEtikett = /gruendungshof|Abzeichen/.test(teilenBild)
    expect(/geteilt|Teilen/i.test(ABZEICHEN_TEXT.schalterZeile)).toBe(zeichnetEtikett)
  })
})

describe('Erklär-Blatt der Hofseite — die Zahlen hinter dem Cache, nicht bei jedem Aufruf frisch gezählt', () => {
  it('hofseite-vorschau lädt sie über ladeAbzeichenBlatt; der Lader liegt hinter unstable_cache mit den Etiketten von Höfen und Einstellung', () => {
    const vorschau = readFileSync(join(process.cwd(), 'src/server/hofseite-vorschau.ts'), 'utf8')
    expect(vorschau).toContain('ladeAbzeichenBlatt()')
    expect(vorschau).not.toContain('gruendungFuerSeiten')
    const lader = readFileSync(join(process.cwd(), 'src/server/queries/plattform-einstellung.ts'), 'utf8')
    const rumpf = lader.slice(lader.indexOf('export async function ladeAbzeichenBlatt'))
    expect(rumpf).toMatch(/unstable_cache\(/)
    expect(rumpf).toMatch(/tags: \[HOEFE_CACHE_TAG, PLATTFORM_EINSTELLUNG_TAG\]/)
  })
})
