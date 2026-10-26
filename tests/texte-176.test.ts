/**
 * Texte, Onboarding, Code-Login, Startvideo (Nr. 176, Punkte 3 bis 6) — jede
 * Änderung mit Gegenprobe. Ohne DOM: Seiten über renderToStaticMarkup, Quelltext
 * ohne Kommentare, wo nur der Wortlaut zählt.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => createElement('img', { src: String(props.src), alt: String(props.alt ?? '') }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }) }))

import { HoefeInDerNaehe } from '@/components/startseite/hoefe-in-der-naehe'
import { HeroVideo } from '@/components/startseite/hero-video'
import { HERO_VIDEO_SCHLUESSEL, STARTSEITE_HOEFE_TITEL, heroVideoSpielt } from '@/lib/startseite'
import { ENTDECKEN_KOPF } from '@/lib/hoefe-entdecken'
import { PRODUKTE_LEER, produkteLeerSatz } from '@/lib/produkte-hof'
import { GEBUEHR_ERSTATTUNG_OFFEN_HINWEIS } from '@/lib/servicegebuehr'

const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`])\/\/.*$/gm, '$1')
const quelle = (pfad: string): string => ohneKommentare(readFileSync(join(process.cwd(), pfad), 'utf8'))

describe('Cookie-Hinweis', () => {
  const text = quelle('src/components/cookie-banner.tsx')
  it('sagt sachlich, wofür: Anmeldung und Sicherheit; der Warenkorb liegt auf dem Gerät', () => {
    expect(text).toContain('technisch notwendige Cookies für Anmeldung und Sicherheit')
    expect(text).toContain('Dein Warenkorb bleibt auf deinem Gerät.')
  })
  it('Gegenprobe: kein „Session" in Nutzertexten des Hinweises', () => {
    expect(text).not.toMatch(/Session/)
  })
})

describe('Wortliste: Kasse statt Checkout, Warenkorb, Problem melden', () => {
  it('„im Checkout" steht in keinem der beiden Hof-Formulare mehr', () => {
    for (const datei of ['src/components/products/product-dialog.tsx', 'src/components/produkte/futter-formular.tsx']) {
      expect(quelle(datei), datei).not.toContain('im Checkout')
      expect(quelle(datei), datei).toContain('in der Kasse eine Betriebsnummer angeben')
    }
  })

  it('die Erstattung der Servicegebühr nennt einen Weg: Link „Problem melden", nicht „den Betreiber informieren"', () => {
    expect(GEBUEHR_ERSTATTUNG_OFFEN_HINWEIS).not.toContain('Betreiber')
    const detail = quelle('src/components/hof-bestellungen/bestell-detail.tsx')
    expect(detail).not.toContain('Betreiber')
    expect(detail.match(/PROBLEM_MELDEN\b/g)?.length).toBeGreaterThanOrEqual(2) // Link im Vermerk und Knopf am Toast
    expect(detail).toContain('href={PROBLEM_MELDEN_HOF}')
  })

  it('der Korb-Leiste und dem Blatt fehlt nichts: „Warenkorb" im Blatt und in der Kasse', () => {
    expect(quelle('src/components/farm/cart-sheet.tsx')).toContain('aus dem Warenkorb nehmen')
    expect(quelle('src/components/farm/cart-sheet.tsx')).not.toContain('aus dem Korb nehmen')
  })
})

describe('Startseite: Überschrift ohne Standort', () => {
  it('„Höfe aus der Region", nicht „in deiner Nähe"', () => {
    const html = renderToStaticMarkup(createElement(HoefeInDerNaehe, null, createElement("span")))
    expect(html).toContain(STARTSEITE_HOEFE_TITEL)
    expect(STARTSEITE_HOEFE_TITEL).toBe('Höfe aus der Region')
    expect(html).not.toContain('in deiner Nähe')
  })
  it('Gegenprobe: /hoefe kennt den Standort und behält „in deiner Nähe"', () => {
    expect(ENTDECKEN_KOPF.hoefe.titel).toBe('Höfe in deiner Nähe')
  })
})

describe('Onboarding', () => {
  it('der Satz zur Sichtbarkeit steht auch unter md (kein hidden md:block)', () => {
    const text = quelle('src/components/einrichten/einrichten-seite.tsx')
    const stelle = text.slice(text.indexOf('Kunden sehen deinen Hof erst nach der Freischaltung') - 200, text.indexOf('Kunden sehen deinen Hof erst nach der Freischaltung'))
    expect(stelle).toContain('<p className=')
    expect(stelle).not.toMatch(/hidden|md:block/)
  })

  it('leerer Produkte-Zustand: vor der Freischaltung kein „sofort", danach schon', () => {
    expect(produkteLeerSatz(true)).toBe(PRODUKTE_LEER.satz)
    expect(produkteLeerSatz(true)).toContain('sofort')
    expect(produkteLeerSatz(false)).not.toContain('sofort')
    expect(produkteLeerSatz(false)).toContain('freigeschaltet')
  })
})

describe('Startvideo', () => {
  it('läuft nur ohne Pause-Wahl und ohne Datensparmodus', () => {
    expect(heroVideoSpielt({ gespeichert: null, sparmodus: false })).toBe(true)
    expect(heroVideoSpielt({ gespeichert: 'pause', sparmodus: false })).toBe(false)
    expect(heroVideoSpielt({ gespeichert: null, sparmodus: true })).toBe(false)
    expect(heroVideoSpielt({ gespeichert: 'pause', sparmodus: true })).toBe(false)
  })

  it('läuft: Video da, Knopf mit 44 px und aria-pressed="false"', () => {
    const html = renderToStaticMarkup(createElement(HeroVideo, { anfang: true }))
    expect(html).toContain('<video')
    const knopf = html.match(/<button[^>]*>/)?.[0] ?? ''
    expect(knopf).toContain('aria-pressed="false"')
    expect(knopf).toContain('size-11')
    expect(knopf).toContain('aria-label="Hintergrundvideo anhalten"')
    expect(knopf).toContain('type="button"')
  })

  it('angehalten: kein Video mehr (lädt nichts nach), aria-pressed="true"', () => {
    const html = renderToStaticMarkup(createElement(HeroVideo, { anfang: false }))
    expect(html).not.toContain('<video')
    expect(html).toContain('aria-pressed="true"')
  })

  it('bevor der Browser entschieden hat (Server): kein Video — im Datensparmodus lädt nie etwas', () => {
    expect(renderToStaticMarkup(createElement(HeroVideo, {}))).not.toContain('<video')
  })

  it('der Knopf erscheint nur bei erlaubter Bewegung; die Wahl liegt im localStorage mit try/catch', () => {
    const text = quelle('src/components/startseite/hero-video.tsx')
    expect(text).toMatch(/hidden[^'"]*motion-safe:inline-flex/)
    expect(HERO_VIDEO_SCHLUESSEL).toBe('fz-startvideo')
    expect(text).toContain('HERO_VIDEO_SCHLUESSEL')
    expect(text.match(/localStorage\./g)?.length).toBe(3)
    expect(text.match(/try \{/g)?.length).toBe(2)
    expect(text).toContain('connection')
    expect(text).toContain('saveData')
  })

  it('die Suche der Startseite hat 16 px (kein Zoom auf iOS), nicht 15,5', () => {
    const text = quelle('src/components/startseite/startseite-kopf.tsx')
    expect(text).not.toContain('15.5px')
    expect(text).toMatch(/type="search"[\s\S]{0,300}text-base/)
  })
})
