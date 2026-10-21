/**
 * Tests für Teilen-Fenster und QR-Plakat (Gate 7 Aufgaben 2 und 3).
 *
 * Beweist:
 *  - Anfangs sind die ersten drei kaufbaren Produkte im Bild, nie ein
 *    ausverkauftes; mehr als drei gehen nicht, ausverkauft bleibt aus.
 *  - Jeder Kanal trägt sein Kürzel `?k=` (und nur das); WhatsApp-Status und
 *    Instagram gehen über das Teilen-Menü mit Bild.
 *  - Das Plakat trägt die statische Hofseiten-Adresse mit `?k=qr`, nur für
 *    öffentliche Höfe (Abfrage mit der Sichtbarkeits-Bedingung), ist A4 und
 *    theme-fest (nur Farben, die in beiden Themes gleich sind), und Fremdtext
 *    steht escaped da.
 *  - Heute öffnet das Teilen-Fenster nur mit Daten vom Server und zeigt die
 *    Wirkung der letzten Woche.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/prisma', () => ({ prisma: { farm: { findFirst: vi.fn() } } }))
// next/image braucht die Laufzeit von Next; das Plakat gibt der Bildmarke nur Quelle, Maße und Rundung.
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string; width: number; height: number; className?: string; style?: Record<string, string>; 'aria-hidden'?: string }) =>
    createElement('img', { src: p.src, alt: p.alt, width: p.width, height: p.height, className: p.className, style: p.style, 'aria-hidden': p['aria-hidden'] }),
}))

import { prisma } from '@/lib/prisma'
import { beitragIdImLink, beitragLink, beitragLinkMitKanal, kanalZiel, PLAKAT_PFAD, schalteAuswahl, startAuswahl, FENSTER_KANAELE } from '@/lib/teilen-fenster'
import { teilenKanalAus, teilenLink } from '@/lib/teilen-kanal'
import { plakatBezahlen, type TeilenAuswahlEintrag } from '@/lib/teilen-bild'
import { getPlakatDaten } from '@/server/queries/teilen-bild'
import { QrPlakat } from '@/components/teilen/qr-plakat'
import { markeBildUrl } from '@/lib/marke-bild'

const findFirst = vi.mocked(prisma.farm.findFirst)
const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

const eintrag = (id: string, ausverkauft = false): TeilenAuswahlEintrag => ({ id, name: `Produkt ${id}`, preis: '€ 1,00', ausverkauft })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Auswahl „Im Bild"', () => {
  const auswahl = [eintrag('a'), eintrag('b', true), eintrag('c'), eintrag('d'), eintrag('e')]

  it('anfangs die ersten drei kaufbaren, ausverkauft nie', () => {
    expect(startAuswahl(auswahl)).toEqual(['a', 'c', 'd'])
    expect(startAuswahl([])).toEqual([])
  })

  it('ausschalten, wieder einschalten in der Reihenfolge des Hofs, höchstens drei', () => {
    expect(schalteAuswahl(['a', 'c', 'd'], 'c', auswahl)).toEqual(['a', 'd'])
    expect(schalteAuswahl(['a', 'd'], 'c', auswahl)).toEqual(['a', 'c', 'd'])
    // Der vierte geht nicht.
    expect(schalteAuswahl(['a', 'c', 'd'], 'e', auswahl)).toEqual(['a', 'c', 'd'])
  })

  it('ausverkauft und Unbekanntes lassen sich nicht einschalten', () => {
    expect(schalteAuswahl(['a'], 'b', auswahl)).toEqual(['a'])
    expect(schalteAuswahl(['a'], 'gibt-es-nicht', auswahl)).toEqual(['a'])
  })
})

describe('Kanäle', () => {
  const basis = { link: 'https://agrilo.at/hof-test', text: 'Frisch bei uns', hofName: 'Hof Test' }

  it('jeder Kanal trägt genau sein Kürzel', () => {
    const wa = kanalZiel('wa', basis)
    expect(wa).toEqual({
      art: 'oeffnen',
      href: `https://wa.me/?text=${encodeURIComponent('Frisch bei uns\nhttps://agrilo.at/hof-test?k=wa')}`,
    })
    expect(kanalZiel('fb', basis)).toEqual({
      art: 'oeffnen',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://agrilo.at/hof-test?k=fb')}`,
    })
    const mail = kanalZiel('mail', basis)
    expect(mail.art === 'oeffnen' && mail.href).toContain(encodeURIComponent('https://agrilo.at/hof-test?k=mail'))
    expect(mail.art === 'oeffnen' && mail.href.startsWith('mailto:?subject=Hof%20Test')).toBe(true)
  })

  it('Status und Instagram: Bild über das Teilen-Menü, Link mit eigenem Kürzel', () => {
    expect(kanalZiel('wa-status', basis)).toEqual({
      art: 'bild',
      text: 'Frisch bei uns\nhttps://agrilo.at/hof-test?k=wa-status',
      link: 'https://agrilo.at/hof-test?k=wa-status',
    })
    expect(kanalZiel('ig', { ...basis, text: '  ' })).toEqual({
      art: 'bild',
      text: 'https://agrilo.at/hof-test?k=ig',
      link: 'https://agrilo.at/hof-test?k=ig',
    })
  })

  it('die Reihenfolge des Mockups', () => {
    expect(FENSTER_KANAELE.map((k) => k.label)).toEqual(['WhatsApp', 'WhatsApp-Status', 'Facebook', 'Instagram', 'E-Mail'])
  })
})

describe('QR-Plakat', () => {
  it('nur öffentliche Höfe; der Code trägt die feste Adresse mit ?k=qr', async () => {
    findFirst.mockResolvedValue(null)
    expect(await getPlakatDaten('farm-1')).toBeNull()
    expect(findFirst.mock.calls[0][0]?.where).toMatchObject({ id: 'farm-1', isActive: true, archivedAt: null, approvedAt: { not: null } })

    findFirst.mockResolvedValue({
      name: 'Hof Test',
      slug: 'hof-test',
      city: 'Teststadt',
      acceptsOnline: true,
      acceptsOnsite: true,
      stripeAccountReady: false,
      pickupSlots: [
        { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 3, startTime: '15:00', endTime: '18:00' },
      ],
    } as never)
    const daten = await getPlakatDaten('farm-1')
    expect(daten).toMatchObject({
      hofName: 'Hof Test',
      ort: 'Teststadt',
      abholzeiten: 'Mi 15–18 · Sa 9–12 Uhr',
      // Stripe nicht fertig: auf dem Papier kein „online".
      bezahlen: 'Bar bei der Abholung bezahlen',
    })
    expect(daten?.link).toMatch(/\/hof-test\?k=qr$/)
  })

  it('Bezahlzeile je nach Zahlarten', () => {
    expect(plakatBezahlen({ online: true, bar: true })).toBe('Bar oder online bezahlen')
    expect(plakatBezahlen({ online: true, bar: false })).toBe('Online bezahlen')
    expect(plakatBezahlen({ online: false, bar: false })).toBeNull()
  })

  it('A4, theme-fest, Fremdtext escaped, QR als Bild mit Namen', () => {
    const html = renderToStaticMarkup(
      createElement(QrPlakat, {
        daten: {
          hofName: '<b>Hof</b>',
          ort: 'Teststadt',
          adresse: 'agrilo.at/hof-test',
          link: 'https://agrilo.at/hof-test?k=qr',
          abholzeiten: null,
          bezahlen: null,
        },
      })
    )
    expect(html).toContain('&lt;b&gt;Hof&lt;/b&gt;')
    expect(html).toContain('aspect-[210/297]')
    expect(html).toContain('print:w-[210mm]')
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="QR-Code zur Hofseite agrilo.at/hof-test"')
    // Ohne Abholzeiten keine leere Zeile „Abholung".
    expect(html).not.toContain('<b>Abholung</b>')
    // Theme-fest: nur Farben, die in beiden Themes gleich sind — kein background/foreground/card.
    expect(html).not.toMatch(/\b(bg-background|bg-card|text-foreground|text-muted-foreground)\b/)
    // Die Bildmarke neben der Adresse: die volle Fassung als Bild, gerundet, ohne Alternativtext (Register M1, Nr. 92).
    const marke = html.match(/<img\b[^>]*>/g) ?? []
    expect(marke).toHaveLength(1)
    expect(marke[0]).toContain(`src="${markeBildUrl('voll')}"`)
    expect(marke[0]).toContain('border-radius:22%')
    expect(marke[0]).toContain('aria-hidden="true"')
    expect(html).not.toContain('<path d="M8 1C3 5')
  })

  it('die Seite liegt in der HofShell und blendet ihren Kopf beim Drucken aus', () => {
    const seite = quelle('src/app/(hof)/status/plakat/page.tsx')
    expect(seite).toContain('@page { size: A4; margin: 0; }')
    expect(seite).toContain('print:hidden')
    expect(seite).toContain('getPlakatDaten(farm.id)')
    expect(PLAKAT_PFAD).toBe('/status/plakat')
  })
})

describe('Heute öffnet das Teilen-Fenster', () => {
  it('nur mit Daten vom Server, sonst bleibt das einfache Teilen; Wirkung der letzten Woche', () => {
    const seite = quelle('src/app/(hof)/dashboard/page.tsx')
    expect(seite).toContain('getTeilenFensterDaten(farm.id, jetzt)')
    expect(seite).toContain('letzteTage(jetzt, 7)')
    const karte = quelle('src/components/heute/heute-teile.tsx')
    expect(karte).toMatch(/fenster \?\s*\(\s*<TeilenFensterKnopf/)
    expect(karte).toContain('<HofTeilenKnopf')
  })

  it('der WhatsApp-Versand eines Beitrags trägt ?k=wa — über die Regel neben beitragLink', () => {
    expect(quelle('src/app/(hof)/status/[id]/send-whatsapp/whatsapp-tap-client.tsx')).toContain("beitragLinkMitKanal(`${APP_URL}/${farmSlug}`")
  })
})

describe('Link auf einen Beitrag: eine Regel für Mail und WhatsApp (Register T5)', () => {
  const HOF = 'https://agrilo.at/hof-test'

  it('die Kennung trägt der Link nur, wenn der Beitrag auf der Hofseite steht', () => {
    expect(beitragIdImLink({ id: 'cbeitrag', showOnFarmPage: true })).toBe('cbeitrag')
    expect(beitragIdImLink({ id: 'cbeitrag', showOnFarmPage: false })).toBeUndefined()
  })

  it('der Link je Person: genau dieser Beitrag, danach das Kürzel des Kanals (wie im Teilen-Fenster)', () => {
    const link = beitragLinkMitKanal(HOF, { id: 'cbeitrag', showOnFarmPage: true }, 'wa')
    expect(link).toBe('https://agrilo.at/hof-test?beitrag=cbeitrag&k=wa')
    expect(link).toBe(`${beitragLink(HOF, 'cbeitrag')}&k=wa`)
    expect(teilenKanalAus(new URL(link).searchParams.get('k'))).toBe('WHATSAPP')
  })

  it('Gegenprobe: ohne „auf der Hofseite“ ist es der Link ohne Beitrag — wie teilenLink', () => {
    const link = beitragLinkMitKanal(HOF, { id: 'cbeitrag', showOnFarmPage: false }, 'wa')
    expect(link).toBe('https://agrilo.at/hof-test?k=wa')
    expect(link).toBe(teilenLink('https://agrilo.at', 'hof-test', 'wa'))
  })
})
