/**
 * Kopfzeile der Kundenseiten (src/lib/kunden-kopf.ts): welche Seite welche
 * Form bekommt und wohin „Zurück" führt — rein, ohne Browser.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { angezeigterBereich, hoefeLink } from '@/lib/bereiche-anzeige'
import { bereichAusParameter } from '@/schemas/hoefe-filter'
import {
  eigenerVorgaenger,
  kopfForm,
  merkeVorgaenger,
  ordneWechsel,
  rueckweg,
  tippAufRueckweg,
  zeileNimmtVerlauf,
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
const BESTELLUNG_UNGUELTIG: KundenSeite = { art: 'bestellung-ungueltig' }
const ALLE = [HOFSEITE, FUTTER_HOFSEITE, CHECKOUT, BESTAETIGUNG, BESTELLUNG, BESTELLUNG_UNGUELTIG, HOFUEBERSICHT, INFO]

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

  it('Bestellverfolgung mit ungültigem Link: nie über den Verlauf, zur Hofübersicht — der Hof ist nicht bestätigt', () => {
    expect(rueckweg(BESTELLUNG_UNGUELTIG, true)).toEqual({ href: '/hoefe', verlauf: false })
    expect(rueckweg(BESTELLUNG_UNGUELTIG, false)).toEqual({ href: '/hoefe', verlauf: false })
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
  it('Zurück in der Handy-Leiste überall, wo es woanders hinführt als das F-Icon', () => {
    for (const seite of [HOFSEITE, FUTTER_HOFSEITE, CHECKOUT, BESTAETIGUNG, BESTELLUNG, BESTELLUNG_UNGUELTIG, INFO]) {
      expect(kopfForm(seite).zurueck, seite.art).toBe(true)
    }
    // Die Hofübersicht führt hinauf zur Startseite — das tut das F-Icon schon.
    expect(kopfForm(HOFUEBERSICHT).zurueck).toBe(false)
  })
  it('Warenkorb-Symbol weder auf der Hofseite noch im Bestellweg — sonst ja', () => {
    expect(kopfForm(HOFSEITE).warenkorb).toBe(false)
    for (const seite of [CHECKOUT, BESTAETIGUNG, BESTELLUNG, BESTELLUNG_UNGUELTIG]) {
      expect(kopfForm(seite).warenkorb, seite.art).toBe(false)
    }
    for (const seite of [HOFUEBERSICHT, INFO]) expect(kopfForm(seite).warenkorb, seite.art).toBe(true)
  })

  it('im Browser eine Rückweg-Zeile nur dort, wo die Kopfzeile selbst nicht zurückführt', () => {
    for (const seite of [HOFSEITE, CHECKOUT, BESTAETIGUNG, BESTELLUNG]) {
      expect(kopfForm(seite).rueckwegZeile, seite.art).toBe(true)
    }
    for (const seite of [HOFUEBERSICHT, INFO, BESTELLUNG_UNGUELTIG]) expect(kopfForm(seite).rueckwegZeile, seite.art).toBe(false)
  })
})

describe('merkeVorgaenger — die eigene Seite davor, je Dokument', () => {
  const folge = (wechsel: SeitenWechsel[]) => wechsel.reduce<string | null>(merkeVorgaenger, null)
  const link = (von: string): SeitenWechsel => ({ art: 'link', von })

  it('die erste Seite eines Dokuments hat keine — geteilter Link, neuer Tab, Neuladen', () => {
    expect(folge([{ art: 'start' }])).toBeNull()
  })

  it('nach einem Seitenwechsel in der App ist es die Seite, von der er kam', () => {
    expect(folge([{ art: 'start' }, link('/hoefe')])).toBe('/hoefe')
  })

  it('nach Zurück oder Vorwärts im Browser ist sie unbekannt — lieber der Link', () => {
    expect(folge([{ art: 'start' }, link('/hoefe'), { art: 'verlauf' }])).toBeNull()
    expect(folge([{ art: 'start' }, link('/hoefe'), { art: 'verlauf' }, link('/testhof')])).toBe('/testhof')
  })

  it('wer über den Ersatz-Link hinaufgestiegen ist, hat keine — sonst führte Zurück wieder hinunter', () => {
    expect(folge([{ art: 'start' }, { art: 'hinauf' }])).toBeNull()
  })

  it('ein Filterwechsel ändert nichts', () => {
    expect(folge([{ art: 'start' }, { art: 'nurQuery' }])).toBeNull()
    expect(folge([{ art: 'start' }, link('/hoefe'), { art: 'nurQuery' }])).toBe('/hoefe')
  })
})

describe('eigenerVorgaenger — Navigation API vor dem Merker', () => {
  it('kennt der Browser die Navigation API, entscheidet sie', () => {
    expect(eigenerVorgaenger({ vorherigerPfad: '/hoefe' }, null, false)).toBe('/hoefe')
    expect(eigenerVorgaenger({ vorherigerPfad: null }, '/hoefe', false)).toBeNull()
  })

  it('ein hinauf erreichter Eintrag hat keine eigene Seite davor — auch nach Neuladen', () => {
    expect(eigenerVorgaenger({ vorherigerPfad: '/testhof' }, null, true)).toBeNull()
  })

  it('sonst entscheidet der Merker', () => {
    expect(eigenerVorgaenger(undefined, '/hoefe', false)).toBe('/hoefe')
    expect(eigenerVorgaenger(undefined, null, false)).toBeNull()
  })
})

describe('ordneWechsel — was der Merker beobachtet hat', () => {
  const basis = { von: '/hoefe', pfad: '/testhof', durchVerlauf: false, hinaufZiel: null }

  it('erstes Mal, Filterwechsel, Link', () => {
    expect(ordneWechsel({ ...basis, von: null })).toEqual({ art: 'start' })
    expect(ordneWechsel({ ...basis, pfad: '/hoefe' })).toEqual({ art: 'nurQuery' })
    expect(ordneWechsel(basis)).toEqual({ art: 'link', von: '/hoefe' })
  })

  it('Zurück oder Vorwärts geht vor — auch vor einem gemerkten Hinaufsteigen', () => {
    expect(ordneWechsel({ ...basis, durchVerlauf: true, hinaufZiel: '/testhof' })).toEqual({ art: 'verlauf' })
  })

  it('Hinaufsteigen nur zu genau seinem Ziel — ein anderer Link dazwischen ist ein gewöhnlicher Wechsel', () => {
    expect(ordneWechsel({ ...basis, hinaufZiel: '/testhof' })).toEqual({ art: 'hinauf' })
    expect(ordneWechsel({ ...basis, hinaufZiel: '/impressum' })).toEqual({ art: 'link', von: '/hoefe' })
  })
})

describe('tippAufRueckweg — was ein Tipp tut', () => {
  it('Knopf: mit eigener Seite davor ein Schritt zurück, sonst hinauf zum Ziel', () => {
    expect(tippAufRueckweg(HOFSEITE, '/impressum', 'knopf')).toEqual({ aktion: 'verlauf' })
    expect(tippAufRueckweg(FUTTER_HOFSEITE, null, 'knopf')).toEqual({ aktion: 'hinauf', ziel: '/hoefe' })
  })

  it('Zeile: der Verlauf nur, wenn er genau zum Ziel führt', () => {
    expect(tippAufRueckweg(HOFSEITE, '/hoefe', 'zeile')).toEqual({ aktion: 'verlauf' })
    expect(tippAufRueckweg(HOFSEITE, '/impressum', 'zeile')).toEqual({ aktion: 'hinauf', ziel: '/hoefe' })
  })

  it('Bestätigung: immer hinauf zur Hofseite', () => {
    expect(tippAufRueckweg(BESTAETIGUNG, '/testhof/checkout', 'knopf')).toEqual({ aktion: 'hinauf', ziel: '/testhof' })
  })
})

describe('Kein Hin und Her — die Folge von Tipps auf „Zurück"', () => {
  /**
   * Ein Tipp samt dem Seitenwechsel, den er auslöst — mit denselben
   * Funktionen wie Kopfzeile (tippAufRueckweg) und Merker (ordneWechsel,
   * merkeVorgaenger).
   */
  type Stand = { pfad: string; vorgaenger: string | null }
  function tippe(seite: KundenSeite, stand: Stand): Stand {
    const tipp = tippAufRueckweg(seite, stand.vorgaenger, 'knopf')
    const pfad = tipp.aktion === 'verlauf' ? (stand.vorgaenger ?? stand.pfad) : tipp.ziel
    const wechsel = ordneWechsel({
      von: stand.pfad,
      pfad,
      durchVerlauf: tipp.aktion === 'verlauf',
      hinaufZiel: tipp.aktion === 'hinauf' ? tipp.ziel : null,
    })
    return { pfad, vorgaenger: merkeVorgaenger(stand.vorgaenger, wechsel) }
  }
  const erstAufruf = (pfad: string): Stand => ({ pfad, vorgaenger: merkeVorgaenger(null, { art: 'start' }) })

  it('geteilter Link auf die Hofseite → Zurück → Hofübersicht → Zurück → Startseite', () => {
    const aufHoefe = tippe(HOFSEITE, erstAufruf('/testhof'))
    expect(aufHoefe.pfad).toBe('/hoefe')
    expect(tippe(HOFUEBERSICHT, aufHoefe).pfad).toBe('/')
  })

  it('Bestätigung → Zurück → Hofseite → Zurück führt zur Hofübersicht, nicht zurück in die Bestätigung', () => {
    const bestaetigung: Stand = { pfad: '/testhof/confirm/b1', vorgaenger: '/testhof/checkout' }
    const aufHof = tippe(BESTAETIGUNG, bestaetigung)
    expect(aufHof.pfad).toBe('/testhof')
    expect(tippe(HOFSEITE, aufHof).pfad).toBe('/hoefe')
  })

  it('von der Hofübersicht auf die Hofseite und Zurück: ein Schritt im Verlauf, dorthin zurück', () => {
    const vonHoefe: Stand = { pfad: '/testhof', vorgaenger: merkeVorgaenger(null, { art: 'link', von: '/hoefe' }) }
    expect(tippAufRueckweg(HOFSEITE, vonHoefe.vorgaenger, 'knopf')).toEqual({ aktion: 'verlauf' })
    expect(tippe(HOFSEITE, vonHoefe).pfad).toBe('/hoefe')
  })
})

describe('zeileNimmtVerlauf — die Browser-Zeile unter der Kopfzeile', () => {
  it('„‹ Alle Höfe" geht im Verlauf zurück, wenn davor die Hofübersicht stand — mit Filtern', () => {
    expect(zeileNimmtVerlauf(HOFSEITE, '/hoefe')).toBe(true)
    expect(zeileNimmtVerlauf(FUTTER_HOFSEITE, '/hoefe')).toBe(true)
  })

  it('stand davor eine andere Seite, ist sie ein Link — ein Schritt zurück führte nicht zu „Alle Höfe"', () => {
    expect(zeileNimmtVerlauf(HOFSEITE, '/')).toBe(false)
    expect(zeileNimmtVerlauf(HOFSEITE, '/impressum')).toBe(false)
    expect(zeileNimmtVerlauf(HOFSEITE, null)).toBe(false)
  })

  it('im Checkout zurück zur Hofseite, wenn sie davor stand; Bestätigung und Bestellung nie', () => {
    expect(zeileNimmtVerlauf(CHECKOUT, '/testhof')).toBe(true)
    expect(zeileNimmtVerlauf(CHECKOUT, '/hoefe')).toBe(false)
    expect(zeileNimmtVerlauf(BESTAETIGUNG, '/testhof')).toBe(false)
    expect(zeileNimmtVerlauf(BESTELLUNG, '/testhof')).toBe(false)
  })
})

describe('Der Rückweg nimmt den ANGEZEIGTEN Bereich, nicht den URL-Parameter', () => {
  const heu = { category: 'HEU_STROH' as const }
  const eier = { category: 'EIER' as const }
  const weg = (produkte: { category: 'HEU_STROH' | 'EIER' }[], wunsch: 'FUTTERMITTEL' | 'LEBENSMITTEL' | null) =>
    rueckweg({ art: 'hofseite', hofSlug: 'testhof', bereich: angezeigterBereich(produkte, wunsch) }, false).href

  it('ein reiner Futterhof ohne ?bereich — geteilte Links tragen keinen — führt in die Futter-Übersicht', () => {
    expect(weg([heu], null)).toBe('/hoefe?bereich=futter')
  })

  it('ein Hof mit beidem ohne Parameter zeigt den Hofladen', () => {
    expect(weg([heu, eier], null)).toBe('/hoefe')
    expect(weg([heu, eier], 'FUTTERMITTEL')).toBe('/hoefe?bereich=futter')
  })

  it('ein reiner Hofladen mit ?bereich=futter zeigt trotzdem den Hofladen', () => {
    expect(weg([eier], 'FUTTERMITTEL')).toBe('/hoefe')
  })

  it('ohne Produkte der Hofladen', () => {
    expect(weg([], null)).toBe('/hoefe')
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
    // Der Checkout rendert den Kopf in CheckoutForm (siehe unten).
    'src/app/(public)/[farmSlug]/checkout/page.tsx': [],
    // Ohne gültige Signatur ist nicht einmal der Hof bestätigt → zur Hofübersicht.
    'src/app/(public)/[farmSlug]/confirm/[orderId]/page.tsx': ['bestellung-ungueltig', 'bestaetigung'],
    // Ungültiger Link: nicht einmal der Hof ist bestätigt → zur Hofübersicht.
    'src/app/(public)/[farmSlug]/bestellung/[orderId]/page.tsx': ['bestellung-ungueltig', 'bestellung'],
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
        else if (eintrag.name === 'page.tsx') seiten.push(path.relative(path.resolve(__dirname, '..'), voll).split(path.sep).join('/'))
      }
    }
    durchsuche(wurzel)
    expect(seiten.sort()).toEqual(Object.keys(ARTEN).sort())
  })

  it('jede Seite rendert KundenKopf mit ihrer Art', () => {
    for (const [datei, arten] of Object.entries(ARTEN)) {
      const text = lies(datei)
      const gefunden = [...text.matchAll(/<KundenKopf\s+seite=\{\{\s*art:\s*'([a-z-]+)'/g)].map((m) => m[1])
      expect(gefunden, datei).toEqual(arten)
    }
  })

  it('die Hofseite: Kopf und Teilen-Knopf nur für Kundinnen, nie in der Vorschau des Bauern-Bereichs', () => {
    const text = lies('src/components/farm/farm-page-view.tsx')
    expect(text).toMatch(/art: 'hofseite'/)
    expect(text).toMatch(/\{!ownerMode && \(\s*<KundenKopf seite=\{kundenSeite\}/)
    expect(text).toMatch(/\{!ownerMode && <TitelbildTeilen/)
    // Über dem Titelbild steht nur noch Teilen — Zurück und Menü trägt die Leiste darüber.
    expect(text).not.toMatch(/TitelbildKnoepfe/)
    // Der Leer-Zustand (ohne Titelbild) liegt schon hinter `if (!ownerMode)`.
    expect(text.match(/<KundenKopf /g)).toHaveLength(2)
  })

  it('der Checkout: kein Kopf, sobald eine Bestellung angelegt ist — und nie im Zahlungsschritt', () => {
    const text = lies('src/components/checkout/checkout-form.tsx')
    // Ab angelegter Bestellung keine Kopfzeile — auch nach „Zurück" aus dem Zahlungsschritt.
    expect(text).toMatch(/const kopf = bestellungAngelegt \? null : \(\s*<KundenKopf seite=\{\{ art: 'checkout'/)
    expect(text).toMatch(/setBestellungAngelegt\(true\)\s*setPaymentStep\(/)
    const zahlungsschritt = text.slice(text.indexOf('if (paymentStep) {'), text.indexOf('if (!isHydrated) {'))
    expect(zahlungsschritt).toMatch(/<StripePaymentStep/)
    expect(zahlungsschritt).not.toMatch(/\{kopf\}/)
    // Laden, leerer Korb, Formular
    expect(text.match(/\{kopf\}/g)).toHaveLength(3)
  })

  it('die Startseite behält ihre LandingNav und bekommt keine zweite Kopfzeile', () => {
    const text = lies('src/app/page.tsx')
    expect(text).toMatch(/<LandingNav/)
    expect(text).not.toMatch(/KundenKopf/)
  })
})
