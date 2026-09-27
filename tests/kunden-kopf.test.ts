/**
 * Kopfzeile der Kundenseiten (src/lib/kunden-kopf.ts): welche Seite welche
 * Form bekommt und wohin „Zurück" führt — rein, ohne Browser.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { hoefeLink } from '@/lib/bereiche-anzeige'
import { bereichAusParameter } from '@/schemas/hoefe-filter'
import {
  kopfForm,
  merkeVorgaenger,
  rueckweg,
  vorgaengerEigen,
  type KundenSeite,
  type SeitenWechsel,
} from '@/lib/kunden-kopf'

const HOFSEITE: KundenSeite = { art: 'hofseite', hofSlug: 'testhof', bereich: 'LEBENSMITTEL' }
const FUTTER_HOFSEITE: KundenSeite = { art: 'hofseite', hofSlug: 'testhof', bereich: 'FUTTERMITTEL' }
const CHECKOUT: KundenSeite = { art: 'checkout', hofSlug: 'testhof' }
const BESTAETIGUNG: KundenSeite = { art: 'bestaetigung', hofSlug: 'testhof' }
const BESTELLUNG: KundenSeite = { art: 'bestellung', hofSlug: 'testhof' }
const HOFUEBERSICHT: KundenSeite = { art: 'hofuebersicht' }
const INFO: KundenSeite = { art: 'info' }
const ALLE = [HOFSEITE, FUTTER_HOFSEITE, CHECKOUT, BESTAETIGUNG, BESTELLUNG, HOFUEBERSICHT, INFO]

describe('rueckweg — Hofseite', () => {
  it('vom eigenen Verlauf: einen Schritt zurück, dorthin, wo der Kunde herkam', () => {
    expect(rueckweg(HOFSEITE, true)).toEqual({ href: '/hoefe', verlauf: true })
  })

  it('aus einem geteilten Link oder direkt aufgerufen: zur Hofübersicht', () => {
    expect(rueckweg(HOFSEITE, false)).toEqual({ href: '/hoefe', verlauf: false })
  })

  it('eine Futter-Hofseite führt ohne eigenen Vorgänger in die Futter-Übersicht', () => {
    const weg = rueckweg(FUTTER_HOFSEITE, false)
    expect(weg).toEqual({ href: '/hoefe?bereich=futter', verlauf: false })
    // … und die Hofübersicht liest daraus wirklich den Futter-Bereich.
    expect(bereichAusParameter(new URLSearchParams(weg.href.split('?')[1]).get('bereich'))).toBe('FUTTERMITTEL')
  })

  it('eine Futter-Hofseite mit eigenem Vorgänger geht im Verlauf zurück', () => {
    expect(rueckweg(FUTTER_HOFSEITE, true).verlauf).toBe(true)
  })
})

describe('rueckweg — Bestellweg', () => {
  it('Checkout: vom eigenen Verlauf zurück, sonst zur Hofseite', () => {
    expect(rueckweg(CHECKOUT, true)).toEqual({ href: '/testhof', verlauf: true })
    expect(rueckweg(CHECKOUT, false)).toEqual({ href: '/testhof', verlauf: false })
  })

  it('Bestätigung und Bestellverfolgung gehen NIE über den Verlauf — davor stehen Stripe und die Bank', () => {
    for (const seite of [BESTAETIGUNG, BESTELLUNG]) {
      expect(rueckweg(seite, true), seite.art).toEqual({ href: '/testhof', verlauf: false })
      expect(rueckweg(seite, false), seite.art).toEqual({ href: '/testhof', verlauf: false })
    }
  })
})

describe('rueckweg — übrige Seiten', () => {
  it('Hofübersicht: vom eigenen Verlauf zurück, sonst zur Startseite', () => {
    expect(rueckweg(HOFUEBERSICHT, true)).toEqual({ href: '/', verlauf: true })
    expect(rueckweg(HOFUEBERSICHT, false)).toEqual({ href: '/', verlauf: false })
  })

  it('Impressum und Co.: vom eigenen Verlauf zurück, sonst zur Hofübersicht', () => {
    expect(rueckweg(INFO, true)).toEqual({ href: '/hoefe', verlauf: true })
    expect(rueckweg(INFO, false)).toEqual({ href: '/hoefe', verlauf: false })
  })

  it('jeder Rückweg ist ein eigener Pfad — nie eine fremde Adresse', () => {
    for (const seite of ALLE) {
      for (const eigen of [true, false]) {
        expect(rueckweg(seite, eigen).href, seite.art).toMatch(/^\/(?!\/)/)
      }
    }
  })
})

describe('kopfForm — welche Seite welche Form bekommt', () => {
  it('nur die Hofseite hat am Handy die Knöpfe über dem Titelbild', () => {
    expect(kopfForm(HOFSEITE).handy).toBe('titelbild-knoepfe')
    for (const seite of [CHECKOUT, BESTAETIGUNG, BESTELLUNG, HOFUEBERSICHT, INFO]) {
      expect(kopfForm(seite).handy, seite.art).toBe('leiste')
    }
  })

  it('Warenkorb-Symbol weder auf der Hofseite noch im Bestellweg — sonst ja', () => {
    expect(kopfForm(HOFSEITE).warenkorb).toBe(false)
    for (const seite of [CHECKOUT, BESTAETIGUNG, BESTELLUNG]) expect(kopfForm(seite).warenkorb, seite.art).toBe(false)
    for (const seite of [HOFUEBERSICHT, INFO]) expect(kopfForm(seite).warenkorb, seite.art).toBe(true)
  })

  it('im Browser eine Rückweg-Zeile nur dort, wo die Kopfzeile selbst nicht zurückführt', () => {
    for (const seite of [HOFSEITE, CHECKOUT, BESTAETIGUNG, BESTELLUNG]) {
      expect(kopfForm(seite).rueckwegZeile, seite.art).toBe(true)
    }
    for (const seite of [HOFUEBERSICHT, INFO]) expect(kopfForm(seite).rueckwegZeile, seite.art).toBe(false)
  })
})

describe('merkeVorgaenger — eigener Vorgänger je Dokument', () => {
  const folge = (wechsel: SeitenWechsel[]) => wechsel.reduce(merkeVorgaenger, false)

  it('die erste Seite eines Dokuments hat keinen eigenen Vorgänger — geteilter Link, neuer Tab, Neuladen', () => {
    expect(folge(['start'])).toBe(false)
  })

  it('nach einem Seitenwechsel in der App gibt es einen', () => {
    expect(folge(['start', 'link'])).toBe(true)
  })

  it('nach Zurück oder Vorwärts im Browser ist er unbekannt — lieber der Link', () => {
    expect(folge(['start', 'link', 'verlauf'])).toBe(false)
    expect(folge(['start', 'link', 'verlauf', 'link'])).toBe(true)
  })

  it('ein Filterwechsel ändert nichts', () => {
    expect(folge(['start', 'nurQuery'])).toBe(false)
    expect(folge(['start', 'link', 'nurQuery'])).toBe(true)
  })
})

describe('vorgaengerEigen — Navigation API vor dem Merker', () => {
  it('kennt der Browser navigation.canGoBack, entscheidet es', () => {
    expect(vorgaengerEigen(true, false)).toBe(true)
    expect(vorgaengerEigen(false, true)).toBe(false)
  })

  it('sonst entscheidet der Merker', () => {
    expect(vorgaengerEigen(undefined, true)).toBe(true)
    expect(vorgaengerEigen(undefined, false)).toBe(false)
  })
})

describe('hoefeLink', () => {
  it('Hofladen ohne Parameter, Futter mit bereich=futter', () => {
    expect(hoefeLink('LEBENSMITTEL')).toBe('/hoefe')
    expect(hoefeLink('FUTTERMITTEL')).toBe('/hoefe?bereich=futter')
  })
})

describe('Jede Kundenseite hat ihre Kopfzeile — am Quelltext', () => {
  const lies = (datei: string) => fs.readFileSync(path.resolve(__dirname, '..', datei), 'utf8')
  const ARTEN: Record<string, KundenSeite['art'][]> = {
    'src/app/(public)/hoefe/page.tsx': ['hofuebersicht'],
    'src/app/(public)/[farmSlug]/checkout/page.tsx': ['checkout'],
    'src/app/(public)/[farmSlug]/confirm/[orderId]/page.tsx': ['bestaetigung'],
    // Ungültiger Link: nicht einmal der Hof ist bestätigt → zur Hofübersicht.
    'src/app/(public)/[farmSlug]/bestellung/[orderId]/page.tsx': ['info', 'bestellung'],
    'src/app/(public)/impressum/page.tsx': ['info'],
    'src/app/(public)/datenschutz/page.tsx': ['info'],
    'src/app/(public)/konditionen/page.tsx': ['info'],
    'src/app/(public)/problem-melden/page.tsx': ['info'],
    // Die Hofseite rendert FarmPageView — dort steht der Kopf (siehe unten).
    'src/app/(public)/[farmSlug]/page.tsx': [],
  }

  it('kennt jede Seite unter (public) — eine neue Seite fällt hier auf', () => {
    const wurzel = path.resolve(__dirname, '..', 'src/app/(public)')
    const seiten: string[] = []
    const durchsuche = (ordner: string) => {
      for (const eintrag of fs.readdirSync(ordner, { withFileTypes: true })) {
        const voll = path.join(ordner, eintrag.name)
        if (eintrag.isDirectory()) durchsuche(voll)
        else if (eintrag.name === 'page.tsx') seiten.push(path.relative(path.resolve(__dirname, '..'), voll))
      }
    }
    durchsuche(wurzel)
    expect(seiten.sort()).toEqual(Object.keys(ARTEN).sort())
  })

  it('jede Seite rendert KundenKopf mit ihrer Art', () => {
    for (const [datei, arten] of Object.entries(ARTEN)) {
      const text = lies(datei)
      const gefunden = [...text.matchAll(/<KundenKopf\s+seite=\{\{\s*art:\s*'([a-z]+)'/g)].map((m) => m[1])
      expect(gefunden, datei).toEqual(arten)
    }
  })

  it('die Hofseite: Kopf und Titelbild-Knöpfe nur für Kundinnen, nie in der Vorschau des Bauern-Bereichs', () => {
    const text = lies('src/components/farm/farm-page-view.tsx')
    expect(text).toMatch(/art: 'hofseite'/)
    expect(text).toMatch(/\{!ownerMode && \(\s*<KundenKopf seite=\{kundenSeite\}/)
    expect(text).toMatch(/\{!ownerMode && <TitelbildKnoepfe/)
    // Der Leer-Zustand (ohne Titelbild) liegt schon hinter `if (!ownerMode)`.
    expect(text.match(/<KundenKopf /g)).toHaveLength(2)
  })

  it('die Startseite behält ihre LandingNav und bekommt keine zweite Kopfzeile', () => {
    const text = lies('src/app/page.tsx')
    expect(text).toMatch(/<LandingNav/)
    expect(text).not.toMatch(/KundenKopf/)
  })
})
