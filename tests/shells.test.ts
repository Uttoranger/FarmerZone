/**
 * Die Shells aus Gate 2 (src/components/shells) — gerendert wie auf dem Server.
 *
 * Beweist:
 *  - Jede Shell setzt data-design="neu" und gliedert in Landmarken
 *    (header/aside, nav, main) mit Sprunglink „Zum Inhalt springen".
 *  - HofShell: Seitenleiste und Handy-Leiste zeigen die Einträge aus
 *    hofNavigation — dieselbe Quelle für Web und Handy; „Admin" nur für den
 *    Betreiber; Zahlen an Bestellungen und Admin. Postfach steht ganz oben im
 *    Mehr-Blatt mit seinem Zähler, und „Mehr" trägt die Zahl mit (N12) —
 *    ohne Ungelesenes keine Zahl.
 *  - KundeShell: ohne Sitzung mit „Anmelden" (→ /login, auch am Handy),
 *    mit Hof-Sitzung „Mein Hof" (→ /dashboard), mit Kundensitzung Suche und
 *    „Mein Konto" — ohne „Meine Höfe" und „Merken" (E8); Hell/Dunkel am Handy
 *    am Seitenfuß (Nr. 41, Register N1); Handy-Leiste mit drei Plätzen; die
 *    Fokus-Variante hat keine Unterleiste.
 *  - AdminShell: Reiter Höfe · Postfach · Startseite · Finanzen · Einstellungen, Zähler an Höfe und Postfach; der Weg
 *    zurück zum Hof und die Konto-Plakette als Link nur mit eigenem Hof
 *    (Nr. 41); keine Hof-Seitenleiste.
 *  - Kein Big Bang: Außer der Vorschau unter /intern binden nur die Routen
 *    eine Shell ein, deren Gate sie umgestellt hat (Liste UMGESTELLT, mit
 *    Gegenprobe).
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const pfad = { aktuell: '/dashboard' }
vi.mock('next/navigation', () => ({
  usePathname: () => pfad.aktuell,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ signOut: vi.fn() }))
// Ein Blatt liegt im Portal und steht auf dem Server nur offen im HTML. Für den
// Blick ins Mehr-Blatt rendert SheetBlatt seinen Inhalt auf Wunsch an Ort und
// Stelle (per vi.mock ersetzte Teilkomponente, TESTING_GUIDELINES §1); sonst
// bleibt es das echte.
const blatt = vi.hoisted(() => ({ inline: false }))
vi.mock('@/components/ui/sheet', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/components/ui/sheet')>()
  return {
    ...echt,
    SheetBlatt: (props: Parameters<typeof echt.SheetBlatt>[0]) =>
      blatt.inline ? createElement('div', { 'data-slot': 'sheet-blatt-inline' }, props.children as ReactNode) : createElement(echt.SheetBlatt, props),
  }
})

import { HofShell } from '@/components/shells/hof-shell'
import { KundeFokusShell, KundeShell } from '@/components/shells/kunde-shell'
import { AdminShell } from '@/components/shells/admin-shell'
import { hofNavigation } from '@/lib/bauern-navigation'
import { kundenNavigation, SEITENFUSS, type KundenSitzung } from '@/lib/kunden-navigation'
import { MARKE } from '@/lib/marke'
import { ADMIN_KONTO, ADMIN_REITER, ADMIN_ZURUECK } from '@/lib/admin-navigation'
import { ADMIN_POSTFACH_TEXT, POSTFACH_HREF, POSTFACH_TEXT } from '@/lib/postfach'

const INHALT = createElement('p', null, 'Inhalt der Seite')

/** createElement mit dem Inhalt als weiterem Argument — ohne dass TypeScript `children` in den Props verlangt. */
function el<P extends { children?: ReactNode }>(typ: ComponentType<P>, props: Omit<P, 'children'>): ReactElement {
  return createElement(typ as unknown as ComponentType<Omit<P, 'children'>>, props, INHALT)
}

function hof(isAdmin: boolean, aktuell = '/dashboard'): string {
  pfad.aktuell = aktuell
  return renderToStaticMarkup(
    el(HofShell, {
      hofName: 'Hof Beispiel',
      hofSlug: 'hof-beispiel',
      personName: 'Max Mustermann',
      isAdmin,
      zahlen: { bestellungen: 3, admin: 5 } })
  )
}

function kunde(sitzung: KundenSitzung, aktuell = '/hoefe'): string {
  pfad.aktuell = aktuell
  return renderToStaticMarkup(el(KundeShell, { sitzung }))
}

/** Das öffnende Tag des ersten Links auf `href` im HTML. */
function linkTag(html: string, href: string): string {
  const tag = html.match(new RegExp(`<a [^>]*href="${href.replace(/[/?]/g, (z) => `\\${z}`)}"[^>]*>`))?.[0]
  expect(tag, href).toBeDefined()
  return tag ?? ''
}

/** Der Teil des HTML zwischen dem ersten Vorkommen von `start` und dem nächsten `ende` danach. */
function abschnitt(html: string, start: string, ende: string): string {
  const von = html.indexOf(start)
  expect(von, start).toBeGreaterThanOrEqual(0)
  return html.slice(von, html.indexOf(ende, von) + ende.length)
}

describe('alle Shells', () => {
  const alle = {
    hof: () => hof(false),
    kunde: () => kunde('gast'),
    fokus: () =>
      renderToStaticMarkup(
        el(KundeFokusShell, { titel: 'Warenkorb', zurueck: { href: '/hof-beispiel', label: 'Zurück zum Hof' } })
      ),
    admin: () => renderToStaticMarkup(el(AdminShell, { personName: 'Max Mustermann', hatHof: true })),
  }

  it.each(Object.entries(alle))('%s: data-design="neu", Landmarken und Sprunglink', (_name, rendere) => {
    // Die Bildmarke der Kopfzeile wird vorab geladen (next/image `priority`); ohne Dokument setzt React den
    // Vorlade-Link vor den Baum — im Browser steht er im <head>. Die Shell beginnt dahinter.
    const html = rendere().replace(/^(<link rel="preload"[^>]*>)+/, '')
    expect(html).toMatch(/^<div data-design="neu"/)
    expect(html).toContain('<a href="#inhalt"')
    expect(html).toContain('Zum Inhalt springen')
    expect(html).toMatch(/<main id="inhalt" tabindex="-1"[^>]*>[\s\S]*Inhalt der Seite[\s\S]*<\/main>/)
    expect(html).toMatch(/<header|<aside/)
    expect(html.match(/<main/g)).toHaveLength(1)
  })

  it.each(Object.entries(alle))('%s: jedes Symbol ist aria-hidden', (_name, rendere) => {
    for (const svg of rendere().match(/<svg[^>]*>/g) ?? []) {
      expect(svg).toContain('aria-hidden="true"')
    }
  })
})

describe('HofShell', () => {
  it('Seitenleiste: jeder Eintrag aus hofNavigation, als Link, in dieser Reihenfolge', () => {
    const nav = hofNavigation({ isAdmin: true })
    const leiste = abschnitt(hof(true), '<aside', '</aside>')
    let letzte = -1
    for (const punkt of [...nav.haupt, ...nav.verkaufUndKunden, ...nav.unten]) {
      const stelle = leiste.indexOf(`href="${punkt.href}"`)
      expect(stelle, punkt.label).toBeGreaterThan(letzte)
      letzte = stelle
    }
    expect(leiste).toContain('Verkauf und Kunden')
    expect(leiste).toContain('Hofseite ansehen')
    expect(leiste).toContain('href="/hof-beispiel?vorschau=1"')
    expect(leiste).toContain('Abmelden')
  })

  it('Handy-Leiste (N3): Heute · Bestellungen · Neu · Mein Hof · Mehr — aus derselben Quelle, „Mein Hof" öffnet Produkte', () => {
    const leiste = abschnitt(hof(false), '<nav aria-label="Hauptnavigation" data-slot="bottom-nav"', '</nav>')
    const nav = hofNavigation({ isAdmin: false })
    const ziele = nav.handyLeiste.flatMap((p) => (p.art === 'punkt' ? [p.punkt.href] : []))
    expect([...leiste.matchAll(/<a href="([^"]+)"/g)].map((t) => t[1])).toEqual(ziele)
    expect(leiste).toContain('aria-label="Neu erstellen"')
    expect(leiste).toContain('>Mehr<')
    expect(leiste.indexOf('Neu erstellen')).toBeLessThan(leiste.indexOf('href="/products"'))
    expect(leiste).toMatch(/<a href="\/products"[^>]*>[\s\S]*?Mein Hof<\/span><\/a>/)
    expect(leiste).not.toContain('>Produkte<')
  })

  it('aktive Seite: aria-current an Seitenleiste und Leiste', () => {
    const html = hof(false, '/orders')
    expect(html.match(/<a href="\/orders" aria-current="page"/g)).toHaveLength(2)
  })

  it('Mein Hof (N3): auf /products ist „Produkte" der Seitenleiste und „Mein Hof" der Leiste die Seite', () => {
    const html = hof(false, '/products')
    const leiste = abschnitt(html, '<nav aria-label="Hauptnavigation" data-slot="bottom-nav"', '</nav>')
    const seitenleiste = abschnitt(html, '<aside', '</aside>')
    expect(leiste).toMatch(/<a href="\/products" aria-current="page"[^>]*>[\s\S]*?Mein Hof</)
    expect(seitenleiste).toMatch(/<a href="\/products" aria-current="page"[^>]*>[\s\S]*?Produkte</)
    expect(seitenleiste).not.toMatch(/<a href="\/farm-page" aria-current/)
  })

  it('Mein Hof (N3): auf /farm-page steht „Mein Hof" der Leiste für die Seite (true), die Seitenleiste zeigt Mein Hof als Seite', () => {
    const html = hof(false, '/farm-page')
    const leiste = abschnitt(html, '<nav aria-label="Hauptnavigation" data-slot="bottom-nav"', '</nav>')
    expect(leiste).toMatch(/<a href="\/products" aria-current="true"/)
    expect(abschnitt(html, '<aside', '</aside>')).toMatch(/<a href="\/farm-page" aria-current="page"/)
    // „Mehr" leuchtet dort nicht mehr (vor Nr. 49 lag Mein Hof im Mehr-Blatt).
    const mehrKnopf = leiste.slice(leiste.lastIndexOf('<button', leiste.indexOf('>Mehr<')), leiste.indexOf('>Mehr<'))
    expect(mehrKnopf).toContain('<button')
    expect(mehrKnopf).not.toContain('aria-current')
    // Gegenprobe: im Mehr-Blatt liegende Seiten lassen „Mehr" leuchten.
    const kunden = abschnitt(hof(false, '/customers'), '<nav aria-label="Hauptnavigation" data-slot="bottom-nav"', '</nav>')
    expect(kunden.slice(kunden.lastIndexOf('<button', kunden.indexOf('>Mehr<')), kunden.indexOf('>Mehr<'))).toContain('aria-current="true"')
  })

  it('„Admin" und seine Zahl nur für den Betreiber; Bestellungen trägt die Zahl', () => {
    expect(hof(false)).not.toContain('href="/admin"')
    const betreiber = hof(true)
    expect(betreiber).toContain('href="/admin"')
    expect(betreiber).toContain('5 Meldungen zu entscheiden')
    expect(betreiber).toContain('3 offene Bestellungen')
  })

  it('„Beiträge" ist kein eigener Punkt (E12)', () => {
    expect(hof(true)).not.toContain('href="/status"')
  })

  describe('Postfach am Handy (N12): ganz oben im Mehr-Blatt, „Mehr" trägt die Zahl', () => {
    function mitPostfach(postfach: number): { mehrKnopf: string; mehrBlatt: string; html: string } {
      pfad.aktuell = '/dashboard'
      blatt.inline = true
      try {
        const html = renderToStaticMarkup(
          el(HofShell, { hofName: 'Hof Beispiel', hofSlug: 'hof-beispiel', personName: 'Max Mustermann', isAdmin: false, zahlen: { bestellungen: 3, postfach } })
        )
        const mehr = html.indexOf('>Mehr<')
        // Das Mehr-Blatt ist das letzte Blatt der Leiste (davor das Blatt „Neu“).
        const mehrBlatt = html.slice(html.lastIndexOf('data-slot="sheet-blatt-inline"'))
        return { mehrKnopf: html.slice(html.lastIndexOf('<button', mehr), mehr), mehrBlatt, html }
      } finally {
        blatt.inline = false
      }
    }

    it('mit Ungelesenem: erste Zeile im Blatt ist das Postfach mit Zähler, die Zahl steht auch an „Mehr"', () => {
      const { mehrKnopf, mehrBlatt } = mitPostfach(2)
      const ersteZeile = mehrBlatt.slice(mehrBlatt.indexOf('<li data-slot="list-row"'), mehrBlatt.indexOf('</li>') + '</li>'.length)
      expect(mehrBlatt).toContain('Schließen')
      expect(ersteZeile).toContain(`href="${POSTFACH_HREF}"`)
      expect(ersteZeile).toContain(`2 ${POSTFACH_TEXT.zaehler}`)
      expect(mehrKnopf).toContain(`2 ${POSTFACH_TEXT.zaehler}`)
    })

    it('Gegenprobe: ohne Ungelesenes steht das Postfach weiter oben, aber nirgends eine Zahl dafür', () => {
      const { mehrKnopf, mehrBlatt, html } = mitPostfach(0)
      const ersteZeile = mehrBlatt.slice(mehrBlatt.indexOf('<li data-slot="list-row"'), mehrBlatt.indexOf('</li>') + '</li>'.length)
      expect(ersteZeile).toContain(`href="${POSTFACH_HREF}"`)
      expect(mehrKnopf).toContain('<button')
      expect(mehrKnopf).not.toContain('data-slot="zaehler"')
      expect(html).not.toContain(POSTFACH_TEXT.zaehler)
    })
  })
})

describe('KundeShell', () => {
  it('ohne Sitzung: Höfe entdecken · So funktioniert’s · Für Höfe · Anmelden', () => {
    const html = kunde('gast')
    const kopf = abschnitt(html, '<header', '</header>')
    for (const p of kundenNavigation({ sitzung: 'gast' }).web) expect(kopf).toContain(`href="${p.href}"`)
    expect(kopf).toContain('>Anmelden<')
    expect(kopf).not.toContain('role="search"')
    expect(kopf).not.toContain('Mein Konto')
    expect(kopf).not.toContain('Mein Hof')
  })

  // Nr. 41 (Register N1): „Anmelden" führt auf die Hof-Anmeldung (/login zeigt beide Wege)
  // und steht auch unter 768 px oben rechts — mit 44 px Fläche.
  it('ohne Sitzung: „Anmelden" führt auf /login, ist in keiner Breite ausgeblendet und 44 px hoch', () => {
    const kopf = abschnitt(kunde('gast'), '<header', '</header>')
    const anmelden = linkTag(kopf, '/login')
    expect(anmelden).not.toMatch(/\bhidden\b/)
    expect(anmelden).toMatch(/\b(min-)?h-11\b/)
    expect(kopf).not.toContain('href="/account/login"')
    // Gegenprobe: Die Suche findet ein ausgeblendetes Merkmal — die Textlinks stehen erst ab 768 px.
    expect(abschnitt(kopf, '<nav aria-label="Hauptnavigation"', '>')).toMatch(/\bhidden\b/)
  })

  it('Hof-Sitzung: „Mein Hof" auf /dashboard statt „Anmelden" — auch am Handy, ohne Suche und ohne „Mein Konto"', () => {
    const kopf = abschnitt(kunde('hof'), '<header', '</header>')
    const meinHof = linkTag(kopf, '/dashboard')
    expect(meinHof).not.toMatch(/\bhidden\b/)
    expect(meinHof).toMatch(/\b(min-)?h-11\b/)
    expect(kopf).toMatch(/<a [^>]*href="\/dashboard"[^>]*>Mein Hof<\/a>/)
    expect(kopf).not.toContain('>Anmelden<')
    expect(kopf).not.toContain('href="/login"')
    expect(kopf).not.toContain('role="search"')
    expect(kopf).not.toContain('Mein Konto')
  })

  it('Kundensitzung: Suche nach /hoefe?q=…, Mein Konto, kein Anmelden, kein „Mein Hof"', () => {
    const kopf = abschnitt(kunde('kunde'), '<header', '</header>')
    expect(kopf).toMatch(/<form role="search"[^>]*action="\/hoefe" method="get"/)
    expect(kopf).toContain('name="q"')
    expect(kopf).toContain('aria-label="Mein Konto"')
    expect(kopf).not.toContain('>Anmelden<')
    expect(kopf).not.toContain('Mein Hof')
  })

  // Nr. 41: Am Handy braucht „Anmelden" den Platz oben rechts — Hell/Dunkel steht dort am Seitenfuß.
  // Nr. 120 (Register N22): Der Seitenfuß steht nach dem Inhalt, mit Impressum, Datenschutz, AGB und „Problem melden".
  it.each(['gast', 'kunde', 'hof'] as const)('Seitenfuß nach dem Inhalt: die vier Links, am Handy Hell/Dunkel (Sitzung: %s)', (sitzung) => {
    const html = kunde(sitzung)
    expect(html.indexOf('<footer')).toBeGreaterThan(html.indexOf('</main>'))
    const fuss = abschnitt(html, '<footer', '</footer>')
    for (const href of ['/impressum', '/datenschutz', '/agb', '/problem-melden']) expect(fuss, href).toContain(`href="${href}"`)
    expect(fuss).toContain('aria-label="Dunkelmodus einschalten"')
    // Gegenprobe: Die Zeile fehlt im Kopf — dort steht vor der Hydration nur der Platzhalter des runden Schalters.
    expect(abschnitt(html, '<header', '</header>')).not.toContain('aria-label="Dunkelmodus einschalten"')
  })

  // Nr. 127 (Register N22, Ergänzung): Am Computer hat jede Seite der Kundschaft genau einen Fuß, diesen. Der
  // Fuß der Startseite erscheint nur am Handy; darum führt der Seitenfuß hier alles, was am Computer sonst
  // fehlte: die Marke und die Wege. „Für Höfe" führt zu /fuer-hoefe (das /register und /konditionen
  // verlinkt), „Anmelden" steht im Kopf — der Seitenfuß hat keine zweite Anmeldung.
  it.each(['gast', 'kunde', 'hof'] as const)('Seitenfuß am Computer: Wortmarke und die Wege, nie verborgen; „Anmelden" nur im Kopf (Sitzung: %s)', (sitzung) => {
    const html = kunde(sitzung)
    // `print:hidden` (nur beim Drucken) ist erlaubt; am Bildschirm ist der Seitenfuß nie verborgen.
    const klassen = abschnitt(html, '<footer', '>').match(/class="([^"]*)"/)?.[1].split(/\s+/) ?? []
    expect(klassen).toContain('border-t')
    expect(klassen).not.toContain('hidden')
    expect(klassen).not.toContain('md:hidden')
    const fuss = abschnitt(html, '<footer', '</footer>')
    expect(fuss.match(new RegExp(`text-brand-text">${MARKE}</span>`, 'g'))).toHaveLength(1)
    const wege = abschnitt(fuss, 'aria-label="Mehr entdecken"', '</nav>')
    expect(linkTag(wege, '/fuer-hoefe')).toBeDefined()
    expect(wege).toMatch(/<a [^>]*href="\/fuer-hoefe"[^>]*>Für Höfe<\/a>/)
    for (const text of ['Höfe entdecken', 'So funktioniert’s']) expect(wege).toContain(`>${text}</a>`)
    expect(fuss).not.toContain('Anmelden')
    // Gegenprobe: Ohne Sitzung steht „Anmelden" dort, wo es hingehört — im Kopf.
    if (sitzung === 'gast') expect(abschnitt(html, '<header', '</header>')).toContain('>Anmelden<')
  })

  it('/fuer-hoefe, das Ziel von „Für Höfe", verlinkt Registrierung und Konditionen', () => {
    const text = readFileSync(join(process.cwd(), 'src/components/fuer-hoefe/fuer-hoefe-abschnitte.tsx'), 'utf8')
    expect(text).toContain('href="/register"')
    expect(text).toContain('href="/konditionen"')
    expect(SEITENFUSS.wege).toContainEqual({ href: '/fuer-hoefe', label: 'Für Höfe' })
  })

  it('der Seitenfuß hält unten Platz für die Unterleiste frei, die Fokus-Seite ohne Unterleiste trägt ihn auch', () => {
    const fuss = abschnitt(kunde('gast'), '<footer', '>')
    expect(fuss).toMatch(/\bpb-28\b/)
    expect(fuss).toMatch(/\bmd:pb-0\b/)
    pfad.aktuell = '/hof-beispiel/produkt/p1'
    const ohneLeiste = renderToStaticMarkup(el(KundeShell, { sitzung: 'gast', unterleiste: false }))
    expect(ohneLeiste).toContain('data-slot="seitenfuss"')
    expect(ohneLeiste).not.toContain('data-slot="bottom-nav"')
  })

  // Nr. 14: „Bestellungen finden" (/bestellungen) ist das Ziel für alle — im Kopf und in der Leiste.
  it.each(['gast', 'kunde', 'hof'] as const)('„Meine Bestellungen" im Kopf und „Bestellungen" am Handy führen auf /bestellungen (Sitzung: %s)', (sitzung) => {
    const html = kunde(sitzung)
    const kopf = abschnitt(html, '<header', '</header>')
    // Ab 1024 px der lange Name, darunter der kurze — sonst bräche der Kopf bei 768 px um.
    expect(kopf).toMatch(/<a [^>]*href="\/bestellungen"[^>]*>[\s\S]*?<span class="hidden lg:inline">Meine Bestellungen<\/span><\/a>/)
    expect(kopf).toMatch(/<a [^>]*href="\/bestellungen"[^>]*><span class="lg:hidden">Bestellungen<\/span>/)
    const leiste = abschnitt(html, 'data-slot="bottom-nav"', '</nav>')
    expect(leiste).toMatch(/<a [^>]*href="\/bestellungen"[^>]*>[\s\S]*?Bestellungen/)
  })

  it('Kundensitzung: kein Weg zur Anmeldung; Gegenprobe: ohne Sitzung steht sie im Kopf', () => {
    expect(kunde('kunde')).not.toContain('href="/login"')
    expect(abschnitt(kunde('gast'), '<header', '</header>')).toContain('href="/login"')
  })

  it('E8: weder „Meine Höfe" noch „Merken" — in keiner Sitzung', () => {
    for (const html of [kunde('gast'), kunde('kunde'), kunde('hof')]) {
      expect(html).not.toContain('Meine Höfe')
      expect(html).not.toContain('Merken')
    }
  })

  it('Handy: Entdecken · Warenkorb · Bestellungen, der Warenkorb grün in der Mitte', () => {
    for (const sitzung of ['gast', 'kunde', 'hof'] as const) {
      const leiste = abschnitt(kunde(sitzung), 'data-slot="bottom-nav"', '</nav>')
      expect(leiste.match(/<a /g)).toHaveLength(3)
      expect(leiste.indexOf('Entdecken')).toBeLessThan(leiste.indexOf('Warenkorb'))
      expect(leiste.indexOf('Warenkorb')).toBeLessThan(leiste.indexOf('Bestellungen'))
      expect(leiste).toContain('bg-accent')
    }
  })

  it('Fokus-Variante: Zurück mit echtem Ziel, Titel als Überschrift, keine Unterleiste, eine Aktionsleiste', () => {
    const html = renderToStaticMarkup(
      el(KundeFokusShell, {
        titel: 'Warenkorb',
        zurueck: { href: '/hof-beispiel', label: 'Zurück zum Hof' },
        rechts: 'Hof Beispiel',
        aktion: createElement('button', { type: 'button' }, 'Zur Kasse') })
    )
    expect(html).toContain('<a href="/hof-beispiel" aria-label="Zurück zum Hof"')
    expect(html).toMatch(/<h1[^>]*>Warenkorb<\/h1>/)
    expect(html).not.toContain('data-slot="bottom-nav"')
    expect(html.match(/Zur Kasse/g)).toHaveLength(1)
    // Kasse und Bestätigung: kein Seitenfuß — dort steht der AGB-Satz unter dem Kaufknopf (Register N22, O4).
    expect(html).not.toContain('data-slot="seitenfuss"')
  })
})

describe('AdminShell', () => {
  function admin(hatHof: boolean): string {
    pfad.aktuell = '/admin/meldungen/abc'
    return renderToStaticMarkup(el(AdminShell, { personName: 'Max Mustermann', hatHof, zahlen: { hoefe: 2, briefkasten: 3 } }))
  }

  it('Reiter Höfe · Postfach · Startseite · Finanzen · Einstellungen mit Zählern, „Zu meinem Hof", keine Hof-Seitenleiste', () => {
    const html = admin(true)
    const reiter = abschnitt(html, '<nav aria-label="Admin-Bereiche"', '</nav>')
    expect([...reiter.matchAll(/<a href="([^"]+)"/g)].map((t) => t[1])).toEqual(ADMIN_REITER.map((r) => r.href))
    expect(reiter).toContain('2 Höfe warten auf Freischaltung')
    // Die Zahl am Postfach zählt ungelesene Antworten und Meldungen (N12) — der Screenreader sagt beides.
    expect(reiter).toContain(`3 ${ADMIN_POSTFACH_TEXT.zaehlerReiter}`)
    // Wortliste (N12): Der Reiter heißt „Postfach“ — auch in der Zeile unter dem Kopf am Handy, die dieselben Reiter zeigt.
    expect(reiter).toContain('Postfach')
    expect(reiter).not.toContain('Briefkasten')
    // Die Detailseite einer Meldung gehört zum Postfach (Nr. 87): der Reiter zeigt auf /admin/postfach und bleibt aktiv.
    expect(reiter).toContain('<a href="/admin/postfach" aria-current="true"')
    expect(html).toContain('Zu meinem Hof')
    expect(html).toContain(`href="${ADMIN_ZURUECK.href}"`)
    expect(html).not.toContain('<aside')
  })

  // Nr. 41 (Register N1): Ohne eigenen Hof führte „← Mein Hof" ins Leere (/dashboard → /login).
  it('ohne eigenen Hof: kein „← Mein Hof"; Gegenprobe mit Hof', () => {
    const ohne = admin(false)
    expect(ohne).not.toContain(`href="${ADMIN_ZURUECK.href}"`)
    expect(ohne).not.toContain(ADMIN_ZURUECK.label)
    expect(ohne).not.toContain(`>${ADMIN_ZURUECK.kurz}<`)
    expect(admin(true)).toContain(`>${ADMIN_ZURUECK.kurz}<`)
  })

  it('mit Hof: die Initialen-Plakette ist ein Link auf „Konto und Sicherheit", auch am Handy sichtbar, 44 px', () => {
    const plakette = linkTag(admin(true), ADMIN_KONTO.href)
    // WCAG 2.5.3: Der zugängliche Name beginnt mit den sichtbaren Initialen.
    expect(plakette).toContain('aria-label="MM – Konto und Sicherheit (angemeldet: Max Mustermann)"')
    expect(plakette).not.toMatch(/\bhidden\b/)
    expect(plakette).toMatch(/\bsize-11\b/)
    expect(admin(true)).toMatch(/<a [^>]*href="\/settings\/account"[^>]*>[\s\S]*?>MM<\/span>/)
  })

  it('ohne Hof: die Plakette steht auch am Handy da, ist aber kein Link ins Leere (/settings/account liegt im Hofbereich)', () => {
    const ohne = admin(false)
    expect(ohne).not.toContain(`href="${ADMIN_KONTO.href}"`)
    const plakette = ohne.match(/<span title="Angemeldet: Max Mustermann"[^>]*>/)?.[0]
    expect(plakette).toBeDefined()
    expect(plakette).not.toMatch(/\bhidden\b/)
    expect(ohne).toContain('Angemeldet: Max Mustermann')
  })
})

describe('kein Big Bang', () => {
  const wurzel = join(process.cwd(), 'src/app')
  const dateien: string[] = []
  const suche = (ordner: string) => {
    for (const name of readdirSync(ordner)) {
      const p = join(ordner, name)
      if (statSync(p).isDirectory()) suche(p)
      else if (/\.(tsx?|jsx?)$/.test(name)) dateien.push(p)
    }
  }
  suche(wurzel)
  const nutzer = dateien.filter((d) => readFileSync(d, 'utf8').includes('@/components/shells/'))

  // Route für Route: Eine Route kommt hier dazu, wenn ihr Gate sie umstellt
  // (Nr. 07: die Startseite in die KundeShell; Nr. 10: die Hofseite).
  const UMGESTELLT = [
    'page.tsx',
    'account/login/page.tsx',
    '(auth)/login/page.tsx',
    '(public)/hoefe/page.tsx',
    '(public)/[farmSlug]/page.tsx',
    // Nr. 11: die Produktseite (Fokus-Variante der KundeShell, ohne Unterleiste) und ihre 404.
    '(public)/[farmSlug]/produkt/[id]/page.tsx',
    '(public)/[farmSlug]/produkt/[id]/not-found.tsx',
    // Nr. 13: die Bestätigungsseite (KundeShell ohne Unterleiste, mit und ohne Signatur).
    '(public)/[farmSlug]/confirm/[orderId]/page.tsx',
    // Nr. 14: „Bestellungen finden" (neu) und die bestehenden Seiten unter /account.
    '(public)/bestellungen/page.tsx',
    'account/profile/page.tsx',
    'account/unsubscribe/page.tsx',
    // Nr. 15: „Für Höfe" (neu, KundeShell), Registrieren (Fokus-Shell) und Einrichten (HofShell).
    '(public)/fuer-hoefe/page.tsx',
    '(auth)/register/page.tsx',
    '(auth)/onboarding/page.tsx',
    // Nr. 16: die Routengruppe (hof) — ihr Layout trägt die HofShell für jede
    // Route darin (seit Nr. 16 /farm-page); umgestellt wird durch Umzug des
    // Ordners von (farmer) nach (hof).
    '(hof)/layout.tsx',
    // Nr. 17b: „E-Mail bestätigen" (neu, Fokus-Shell wie /register).
    '(auth)/verify/page.tsx',
    // Nr. 22f: alle Routen unter /admin — ihr Layout trägt die AdminShell.
    'admin/layout.tsx',
    // Nr. 38: „Anmeldung bestätigen" (neu, Double-Opt-in, Fokus-Shell wie /verify).
    'account/neuigkeiten-bestaetigen/page.tsx',
    // Nr. 54: die alten Seiten ins neue Design — Bestellseite, Impressum,
    // Konditionen, Problem melden und die beiden 404 in der KundeShell; die
    // Bar-Bestätigung und die Passwort-Seiten in der Fokus-Shell.
    '(public)/[farmSlug]/bestellung/[orderId]/page.tsx',
    '(public)/impressum/page.tsx',
    '(public)/konditionen/page.tsx',
    // Nr. 90: die AGB (Register O4) sind gleich in der KundeShell entstanden.
    '(public)/agb/page.tsx',
    '(public)/problem-melden/page.tsx',
    'not-found.tsx',
    '(public)/[farmSlug]/not-found.tsx',
    '(public)/[farmSlug]/bestaetigen/[token]/page.tsx',
    '(auth)/forgot-password/page.tsx',
    '(auth)/reset-password/page.tsx',
    // Nr. 114: „Das war ich nicht" (neu, KundeShell ohne Unterleiste wie die Bestätigungsseite).
    'sicherheit/nicht-ich/page.tsx',
    // Nr. 120: nur der Seitenfuß (KundeFuss, Register N22) — die Seite selbst bleibt bei KundenKopf.
    '(public)/datenschutz/page.tsx',
  ]

  it('nur die Vorschau unter /intern und die umgestellten Routen binden eine Shell ein', () => {
    for (const datei of nutzer) {
      const pfad = relative(wurzel, datei)
      if (UMGESTELLT.includes(pfad)) continue
      expect(pfad, datei).toMatch(/^intern\//)
    }
  })

  // Nr. 120 (Register N22): Der Seitenfuß hängt an der KundeShell — jede Route, die sie trägt, hat ihn.
  // „Fertig, wenn": /hoefe, Hofseite, /bestellungen, /fuer-hoefe und die Startseite; /datenschutz bindet ihn selbst ein.
  it('Seitenfuß auf jeder Seite der Kundschaft: über die KundeShell, /datenschutz selbst', () => {
    const mitKundeShell = UMGESTELLT.filter((p) => /\bKundeShell(MitSitzung)?\b/.test(readFileSync(join(wurzel, p), 'utf8')))
    for (const p of ['page.tsx', '(public)/hoefe/page.tsx', '(public)/[farmSlug]/page.tsx', '(public)/bestellungen/page.tsx', '(public)/fuer-hoefe/page.tsx']) {
      expect(mitKundeShell, p).toContain(p)
    }
    expect(readFileSync(join(wurzel, '(public)/datenschutz/page.tsx'), 'utf8')).toMatch(/<KundeFuss \/>/)
    expect(readFileSync(join(process.cwd(), 'src/components/shells/kunde-shell.tsx'), 'utf8')).toMatch(/<KundeFuss\b/)
    // Gegenprobe: Eine Seite nur mit der Fokus-Shell zählt nicht.
    expect(/\bKundeShell(MitSitzung)?\b/.test("import { KundeFokusShell } from '@/components/shells/kunde-shell'")).toBe(false)
  })

  it('die umgestellten Routen binden ihre Shell wirklich ein', () => {
    const umgestellt = nutzer.map((d) => relative(wurzel, d)).filter((p) => UMGESTELLT.includes(p))
    expect(umgestellt.sort()).toEqual([...UMGESTELLT].sort())
  })

  // Nr. 12: Die Kasse rendert die Fokus-Shell in ihrer Client-Komponente —
  // „Zurück" hängt am Zustand im Browser (kassenZurueck). Die Seite bindet die
  // Komponente ein, die Komponente die Shell; sonst nutzt keine Datei unter
  // src/components eine Shell.
  const UMGESTELLT_UEBER_KOMPONENTE: Record<string, string> = {
    '(public)/[farmSlug]/checkout/page.tsx': 'src/components/checkout/checkout-form.tsx',
  }

  it('Routen, die ihre Shell über eine Komponente einbinden, tun das wirklich', () => {
    for (const [seite, komponente] of Object.entries(UMGESTELLT_UEBER_KOMPONENTE)) {
      const modul = komponente.replace(/^src\//, '@/').replace(/\.tsx$/, '')
      expect(readFileSync(join(wurzel, seite), 'utf8'), seite).toContain(`'${modul}'`)
      expect(readFileSync(join(process.cwd(), komponente), 'utf8'), komponente).toMatch(/@\/components\/shells\/kunde-shell'/)
    }
  })

  it('außer diesen Komponenten bindet nichts unter src/components eine Shell ein', () => {
    const komponenten: string[] = []
    const sammle = (ordner: string) => {
      for (const name of readdirSync(ordner)) {
        const p = join(ordner, name)
        if (statSync(p).isDirectory()) sammle(p)
        else if (/\.tsx?$/.test(name)) komponenten.push(p)
      }
    }
    sammle(join(process.cwd(), 'src/components'))
    const erlaubt = new Set(Object.values(UMGESTELLT_UEBER_KOMPONENTE))
    const fremd = komponenten
      .map((d) => relative(process.cwd(), d).split('\\').join('/'))
      .filter((d) => !d.startsWith('src/components/shells/') && !erlaubt.has(d))
      .filter((d) => /@\/components\/shells\//.test(readFileSync(join(process.cwd(), d), 'utf8')))
    // Gegenprobe: Die erlaubte Komponente findet die Suche.
    expect([...erlaubt].every((d) => /@\/components\/shells\//.test(readFileSync(join(process.cwd(), d), 'utf8')))).toBe(true)
    expect(fremd).toEqual([])
  })

  it('Gegenprobe: die Vorschau bindet alle drei Shells ein, die Suche findet sie also', () => {
    const text = nutzer.map((d) => readFileSync(d, 'utf8')).join('\n')
    for (const shell of ['hof-shell', 'kunde-shell', 'admin-shell']) expect(text).toContain(`@/components/shells/${shell}'`)
  })

  it('die Bestandslayouts bleiben bei ihrer Navigation', () => {
    expect(readFileSync(join(wurzel, '(farmer)/layout.tsx'), 'utf8')).toContain('<FarmerNav')
    expect(readFileSync(join(wurzel, '(farmer)/layout.tsx'), 'utf8')).not.toContain('data-design')
  })
})
