/**
 * „Bearbeiten" in Mein Hof unter lg (Nachtlauf Nr. 50, Register N4; Mockup
 * mobil-h1-mein-hof) — serverseitig gerendert (TESTING_GUIDELINES §1).
 *
 * Beweist:
 *  - Die Liste zeigt oben den Stand „Zu n von 11 fertig" und darunter jede
 *    Zeile der Hofseite genau einmal, in der Reihenfolge der Hofseite — mit
 *    ihrem Stand (Häkchen „fertig" oder Schild) und „Bearbeiten" (der Name
 *    nennt die Zeile für den Screenreader). Das Blatt ist zu.
 *  - Jede Zeile öffnet ihren Baustein (AbschnittInhalt) — im Blatt stehen bei
 *    Formularen „Speichern" über die volle Breite und „Abbrechen" darunter,
 *    in der Zeile des Editors beide nebeneinander.
 *  - Neu herausgelöst: Leitspruch/Gründungsjahr (Textfelder, 44 px) und Werte
 *    (Kacheln mit aria-pressed, höchstens vier, danach gesperrt).
 *  - Die alte Hofseite mit Stiften steht nicht mehr darin.
 * Jede Suche hat ihre Gegenprobe.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/farm-page',
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }),
}))
vi.mock('@/server/actions/appearance', () => ({
  saveAppearanceAction: vi.fn(),
  updateFarmLogoAction: vi.fn(),
  updateFarmBannerAction: vi.fn(),
  updateBannerFocusAction: vi.fn(),
}))
vi.mock('@/server/actions/farm', () => ({
  updateProfile: vi.fn(),
  ladeProfilStand: vi.fn(),
  addPickupSlot: vi.fn(),
  deletePickupSlot: vi.fn(),
  togglePickupSlotActive: vi.fn(),
  setPause: vi.fn(),
}))
vi.mock('@/server/actions/farm-photos', () => ({
  addFarmPhotoAction: vi.fn(),
  deleteFarmPhotoAction: vi.fn(),
  moveFarmPhotoAction: vi.fn(),
  updateFarmPhotoCaptionAction: vi.fn(),
  reorderPhotosAction: vi.fn(),
}))
vi.mock('@/server/actions/products', () => ({ updateProductImageAction: vi.fn(), reorderProductsAction: vi.fn() }))
vi.mock('@/components/farm/cart-sheet', () => ({ CartSheet: () => null }))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))

import { AbschnitteListe } from '@/components/mein-hof/abschnitte-liste'
import { AbschnittInhalt, SOFORT_GESPEICHERT, type AbschnittHof } from '@/components/mein-hof/abschnitt-inhalt'
import { HOFSEITE_REIHENFOLGE, hofseiteFortschritt, type HofseiteStand } from '@/lib/hofseite-fortschritt'
import { hofseiteZeileIdSchema, type HofseiteZeileId } from '@/schemas/hofseite-vorschau'
import type { FarmSettings } from '@/server/queries/farm'
import type { AppearanceData } from '@/server/queries/appearance'

const STAND: HofseiteStand = {
  name: 'Hof Test',
  description: 'Gemüse aus Musterdorf',
  aboutText: null,
  logoUrl: null,
  bannerType: 'GRADIENT',
  bannerUrl: null,
  fotos: 0,
  address: 'Musterweg 1',
  postalCode: '4900',
  city: 'Musterdorf',
  hatKoordinaten: true,
  abholzeiten: [{ dayOfWeek: 5, startTime: '15:00', endTime: '18:00' }],
  acceptsOnline: false,
  stripeAccountReady: false,
  phone: '+43 660 0000000',
  email: 'hof@example.com',
  isPaused: false,
  sektionen: [{ key: 'products', visible: true, order: 1 }],
  tagline: 'Frisch vom Feld',
  foundedYear: null,
  werte: [],
}

const HOF: AbschnittHof = {
  slug: 'hof-test',
  name: 'Hof Test',
  adresse: 'Musterweg 1, 4900 Musterdorf',
  logoUrl: null,
  bannerType: 'GRADIENT',
  bannerUrl: null,
  bannerValue: null,
  bannerFocusY: 50, bannerAusschnitt: null,
  isPaused: false,
  pauseMessage: null,
}

const EINSTELLUNGEN: FarmSettings = {
  id: 'hof-1',
  name: 'Hof Test',
  ownerName: 'Max Mustermann',
  description: 'Gemüse aus Musterdorf',
  address: 'Musterweg 1',
  postalCode: '4900',
  city: 'Musterdorf',
  country: 'AT',
  latitude: 48.2,
  longitude: 13.4,
  phone: '+43 660 0000000',
  email: 'hof@example.com',
  logoUrl: null,
  bannerUrl: null,
  isPaused: false,
  pauseMessage: null,
  slug: 'hof-test',
  betriebsnummer: null,
  betriebsstatus: null,
  pickupSlots: [{ id: 'slot-1', dayOfWeek: 5, startTime: '15:00', endTime: '18:00', maxOrders: null, isActive: true }],
}

const AUFTRITT: AppearanceData = {
  farmId: 'hof-1',
  tagline: 'Frisch vom Feld',
  foundedYear: 1987,
  aboutText: null,
  logoUrl: null,
  bannerType: 'GRADIENT',
  bannerUrl: null,
  bannerValue: null,
  sectionsConfig: [{ key: 'products', visible: true, order: 1 }],
  farmValues: [{ id: 'w1', icon: 'regional', title: 'Regional', subtitle: 'Aus dem Innviertel', sortOrder: 0 }],
  farmPhotos: [],
  slug: 'hof-test',
}

function liste(stand: HofseiteStand = STAND): string {
  return renderToStaticMarkup(
    createElement(AbschnitteListe, { fortschritt: hofseiteFortschritt(stand), hof: HOF, einstellungen: EINSTELLUNGEN, auftritt: AUFTRITT })
  )
}

function inhalt(id: HofseiteZeileId, darstellung: 'zeile' | 'blatt', auftritt: AppearanceData = AUFTRITT, hof: AbschnittHof = HOF): string {
  return renderToStaticMarkup(
    createElement(AbschnittInhalt, {
      id,
      hof,
      einstellungen: EINSTELLUNGEN,
      auftritt,
      darstellung,
      onGespeichert: () => {},
      onAbbrechen: () => {},
    })
  )
}

describe('Liste „Bearbeiten"', () => {
  it('oben der Stand — die freiwilligen Zeilen zählen nicht mit', () => {
    const html = liste()
    expect(html).toMatch(/<h2 id="bearbeiten-stand"[^>]*>Zu (?:<!-- -->)?8(?:<!-- -->)? von (?:<!-- -->)?11(?:<!-- -->)? fertig<\/h2>/)
    // Gegenprobe: mit Leitspruch, aber ohne Werte — beide freiwillig, die Zahl bleibt dieselbe.
    expect(liste({ ...STAND, tagline: null, werte: ['Regional'] })).toContain('fertig</h2>')
    expect(hofseiteFortschritt({ ...STAND, tagline: null }).erledigt).toBe(hofseiteFortschritt(STAND).erledigt)
  })

  it('jede Zeile genau einmal, in der Reihenfolge der Hofseite', () => {
    const ids = [...liste().matchAll(/data-bearbeiten-zeile="([a-z-]+)"/g)].map((m) => m[1])
    expect(ids).toEqual(HOFSEITE_REIHENFOLGE)
    expect(ids.toSorted()).toEqual(hofseiteZeileIdSchema.options.toSorted())
  })

  it('jede Zeile zeigt ihren Stand und „Bearbeiten" — der Knopf nennt die Zeile', () => {
    const html = liste()
    const zeilen = html.split('data-bearbeiten-zeile=').slice(1)
    expect(zeilen).toHaveLength(13)
    for (const zeile of zeilen) {
      expect(zeile).toMatch(/<button type="button"[^>]*><span class="sr-only">[^<]+: <\/span>Bearbeiten<svg/)
      expect(zeile).toMatch(/<span class="sr-only">fertig<\/span>|data-slot="status-badge"/)
    }
    // Gegenprobe: Hier fehlen Logo (orange) und Werte (freiwillig, grau); Leitspruch und Abholzeiten sind fertig.
    const zeileVon = (id: string) => zeilen.find((z) => z.startsWith(`"${id}"`)) ?? ''
    expect(zeileVon('logo')).toMatch(/data-status="offen"[^>]*><span class="min-w-0 truncate">Fehlt/)
    expect(zeileVon('werte')).toMatch(/data-status="neutral"[^>]*><span class="min-w-0 truncate">Fehlt/)
    expect(zeileVon('tagline')).toContain('<span class="sr-only">fertig</span>')
    expect(zeileVon('abholzeiten')).toContain('<span class="sr-only">fertig</span>')
  })

  it('in Worten ohne Fachbegriff: „Leitspruch und Gründungsjahr", nicht „Tagline"', () => {
    // Nur der sichtbare Text — die Kennung der Zeile (data-bearbeiten-zeile="tagline") ist kein Text.
    const text = liste().replace(/<[^>]+>/g, ' ')
    expect(text).toContain('Leitspruch und Gründungsjahr')
    expect(text).not.toMatch(/Tagline/i)
    expect(inhalt('tagline', 'blatt').replace(/<[^>]+>/g, ' ')).not.toMatch(/Tagline/i)
  })

  it('das Blatt ist zu, und die alte Hofseite mit Stiften steht nicht darin', () => {
    const html = liste()
    expect(html).not.toContain('data-slot="sheet-blatt"')
    expect(html).not.toMatch(/lucide-pencil|Du bearbeitest deine Hof-Seite/)
    // Gegenprobe: Der Baustein selbst hat sein „Speichern" — nur eben im Blatt, das zu ist.
    expect(inhalt('ueber-uns', 'blatt')).toContain('Speichern')
  })
})

describe('Bausteine im Blatt und im Editor', () => {
  const FORMULARE = hofseiteZeileIdSchema.options.filter((id) => !SOFORT_GESPEICHERT.has(id))

  it('jede Zeile hat ihren Baustein — in beiden Darstellungen', () => {
    for (const id of hofseiteZeileIdSchema.options) {
      for (const darstellung of ['zeile', 'blatt'] as const) {
        expect(inhalt(id, darstellung), `${id} ${darstellung}`).toContain('data-app-palette="neu"')
      }
    }
  })

  it('Formulare im Blatt: „Speichern" über die volle Breite, „Abbrechen" als Textknopf darunter', () => {
    expect(FORMULARE).toEqual(['name', 'tagline', 'ueber-uns', 'werte', 'adresse', 'kontakt', 'abschnitte'])
    for (const id of FORMULARE) {
      const html = inhalt(id, 'blatt')
      expect(html, id).toMatch(/<button[^>]*type="submit"[^>]*class="[^"]*\bw-full\b[^"]*"[^>]*>Speichern<\/button>/)
      expect(html.indexOf('>Speichern<'), id).toBeLessThan(html.indexOf('>Abbrechen<'))
      // Textknopf in der Farbe der Textknöpfe (wie „Schließen"), nicht im Status-Grün (Runde 1).
      expect(html, id).toMatch(/<button type="button" class="[^"]*\btext-brand-text\b[^"]*">Abbrechen<\/button>/)
      expect(html, id).not.toContain('text-status-fertig')
    }
  })

  it('Abschnitte der Hofseite: jeder Schalter steht in seinem Label — die ganze Zeile schaltet, 44 px hoch', () => {
    const html = inhalt('abschnitte', 'blatt')
    const zeilen = html.match(/<li>[\s\S]*?<\/li>/g) ?? []
    expect(zeilen).toHaveLength(1)
    for (const zeile of zeilen) {
      const label = /^<li>(<label[^>]*>)/.exec(zeile)?.[1] ?? ''
      expect(label).toContain('for="abschnitt-products"')
      expect(label).toMatch(/class="[^"]*\bmin-h-11\b[^"]*\bw-full\b[^"]*"/)
      expect(zeile).toMatch(/role="switch"[\s\S]*<\/label><\/li>$/)
    }
    // Gegenprobe: Der Schalter neben dem Label (die alte Form) fiele auf.
    expect('<li><label for="x">Text</label><span role="switch"></span></li>').not.toMatch(/role="switch"[\s\S]*<\/label><\/li>$/)
  })

  it('Formulare im Editor: beide Knöpfe nebeneinander, keiner über die volle Breite', () => {
    for (const id of FORMULARE) {
      const html = inhalt(id, 'zeile')
      expect(html, id).toMatch(/>Abbrechen<\/button><button[^>]*type="submit"/)
      expect(html, id).not.toMatch(/type="submit"[^>]*class="[^"]*\bw-full\b/)
    }
  })

  it('Leitspruch und Gründungsjahr: zwei Textfelder, 44 px hoch, das Jahr mit Zifferntastatur', () => {
    const html = inhalt('tagline', 'blatt')
    // Die Startwerte setzt react-hook-form erst im Browser (nicht im Server-HTML).
    expect(html).toMatch(/<input id="hofseite-leitspruch"[^>]*name="tagline"/)
    expect(html).toMatch(/<input id="hofseite-gruendungsjahr"[^>]*inputMode="numeric"[^>]*name="gruendungsjahr"/)
    const felder = html.match(/<input[^>]*>/g) ?? []
    expect(felder).toHaveLength(2)
    for (const feld of felder) expect(feld).toMatch(/\bh-11\b/)
    // Das Jahr ist Text, nie type="number" (CODING_STANDARDS §8).
    expect(html).not.toContain('type="number"')
  })

  it('Werte: sechs Kacheln mit aria-pressed; gewählte gedrückt, mit Satz und Pfeilen', () => {
    const html = inhalt('werte', 'blatt')
    expect(html.match(/aria-pressed="(true|false)"/g)).toHaveLength(6)
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html).toMatch(/<input[^>]*id="wert-satz-0"[^>]*value="Aus dem Innviertel"/)
    expect(html).toContain('aria-label="Regional nach oben"')
    expect(html).toContain('aria-label="Regional entfernen"')
  })

  it('Werte: bei vier gewählten sind die übrigen Kacheln gesperrt, und der Satz sagt warum', () => {
    const vier: AppearanceData = {
      ...AUFTRITT,
      farmValues: ['Regional', 'Saisonal', 'Handarbeit', 'Tierwohl'].map((title, i) => ({ id: `w${i}`, icon: 'x', title, subtitle: null, sortOrder: i })),
    }
    const html = inhalt('werte', 'blatt', vier)
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(4)
    expect(html.match(/aria-pressed="false" disabled=""/g)).toHaveLength(2)
    expect(html).toContain('4 von 4 gewählt — nimm erst einen heraus')
    // Gegenprobe: mit einem Wert ist keine Kachel gesperrt.
    expect(inhalt('werte', 'blatt')).not.toMatch(/aria-pressed="(?:true|false)" disabled=""/)
  })

  it('Bilder speichern sofort: kein „Speichern", der Upload-Knopf ist 44 px hoch', () => {
    for (const id of ['titelbild', 'logo', 'fotos'] as const) {
      expect(inhalt(id, 'blatt'), id).not.toContain('>Speichern<')
    }
    expect(inhalt('logo', 'blatt')).toMatch(/class="inline-flex min-h-11[^"]*"[^>]*>.*Logo hochladen/)
    expect(inhalt('fotos', 'blatt')).toContain('Fotos hinzufügen')
    expect(inhalt('titelbild', 'blatt')).toContain('Titelbild ersetzen')
  })

  it('Titelbild mit Foto: „Titelbild entfernen" als 44-px-Knopf — über die vorhandene Aktion, keine neue Logik', () => {
    const mitFoto: AbschnittHof = { ...HOF, bannerType: 'PHOTO', bannerUrl: '/titelbild.jpg' }
    for (const darstellung of ['blatt', 'zeile'] as const) {
      expect(inhalt('titelbild', darstellung, AUFTRITT, mitFoto), darstellung).toMatch(
        /<button type="button" aria-label="Titelbild entfernen" class="[^"]*\bsize-11\b[^"]*"/
      )
    }
    // Zurück auf den Verlauf, wie früher in „Mein Auftritt".
    const quelle = readFileSync(join(process.cwd(), 'src/components/mein-hof/bild-bausteine.tsx'), 'utf8')
    expect(quelle).toContain("updateFarmBannerAction('GRADIENT', null)")
    // Gegenprobe: Ohne Foto gibt es nichts zu entfernen.
    expect(inhalt('titelbild', 'blatt')).not.toContain('Titelbild entfernen')
  })
})
