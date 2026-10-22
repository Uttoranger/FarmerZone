/**
 * Der Kopf von Mein Hof am Handy (Nachtlauf Nr. 143, Register N3, Ergänzung
 * 22.10.2026; Board system-h1-mein-hof-v3) — serverseitig gerendert
 * (TESTING_GUIDELINES §1), dazu Quelltext-Prüfungen mit Gegenprobe.
 *
 * Beweist:
 *  - EIN Baustein auf allen drei Reitern: /farm-page (unter lg, in seitenkopf.tsx)
 *    und /products (unter md) in derselben Hülle — die Reiter stehen an derselben Stelle.
 *  - Streifen mit Logo, Name (kein h1), Teilen als runder Knopf mit `aria-label`
 *    (nur öffentlich) und „Kundenansicht"; keine Adresse, kein „Kopieren" unter lg.
 *  - Zustandszeile: Punkt aria-hidden, Titel trägt die Bedeutung, der Knopf macht
 *    den nächsten Schritt — Pausieren/Fortsetzen an derselben Stelle (derselbe Knopf),
 *    „Eintragen"/„Abholzeiten" nach /settings/pickup-slots, „Produkte" nach /products;
 *    stillgelegt/wartet ohne Zeile.
 *  - Der Schleier über dem Titelbild nimmt nur Tokens, theme-fest.
 *  - Blatt „Bestellungen pausieren?" nach DESIGN_SYSTEM (kein Kreuz, Hauptaktion
 *    volle Breite, „Abbrechen" als Textknopf), Vorschau = echte Hinweiskarte,
 *    Meldungen aus EINER Quelle; der Zähler zählt getrimmt — auch in PauseClient.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
  useLinkStatus: () => ({ pending: false }),
}))
vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string }) => createElement('img', { src: props.src, alt: props.alt }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/settings/pause',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/server/actions/farm', () => ({ setPause: vi.fn() }))

import { MeinHofKopf, MEIN_HOF_KOPF_HUELLE } from '@/components/mein-hof/mein-hof-kopf'
import { PauseClient } from '@/components/settings/pause-client'
import { HofTeilenKnopf } from '@/components/farmer/hof-teilen-knopf'
import { PAUSENACHRICHT_MAX } from '@/lib/eingabegrenzen'
import { PAUSE_MELDUNG } from '@/lib/shop-pause'
import type { MeinHofKopfDaten } from '@/server/queries/farm'
import type { MeinHofZustand } from '@/server/mein-hof-zustand'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

const HOF: MeinHofKopfDaten = {
  name: 'Testhof A',
  slug: 'testhof-a',
  adresse: { anzeige: 'agrilo.at/testhof-a', url: 'https://agrilo.at/testhof-a' },
  logoUrl: null,
  logoAusschnitt: null,
  titelbildUrl: null,
  bannerValue: null,
  bannerFocusY: 50,
  zustand: { art: 'sichtbar', schild: { text: 'Öffentlich', farbe: 'gruen' }, oeffentlich: true },
}
const ZUSTAND: MeinHofZustand = {
  zustand: 'sichtbar',
  sperre: null,
  naechste: { dayOfWeek: 5, startTime: '15:00', endTime: '18:00', tageVoraus: 1, kalendertag: '2026-10-23' },
  pauseMessage: null,
  abholzeitAktiv: true,
  kaufbar: true,
}

const kopf = (zustand: MeinHofZustand | null = ZUSTAND, hof: MeinHofKopfDaten = HOF, aktiv: 'produkte' | 'hofseite' | 'beitraege' = 'produkte') =>
  renderToStaticMarkup(createElement(MeinHofKopf, { hof, zustand, aktiv }))

describe('ein Kopf, eine Hülle (Reiter an derselben Stelle)', () => {
  it('/farm-page (beide Reiter) und /products stecken den Kopf in dieselbe Hülle', () => {
    const farmPage = quelle('src/app/(hof)/farm-page/page.tsx')
    const produkte = quelle('src/app/(hof)/products/page.tsx')
    expect(farmPage.match(/<div className=\{MEIN_HOF_KOPF_HUELLE\}>\s*<MeinHofSeitenkopf /g)).toHaveLength(2)
    expect(produkte).toMatch(/<div className=\{cn\(MEIN_HOF_KOPF_HUELLE, 'md:hidden'\)\}>\s*<MeinHofKopf /)
    // Unter lg rendert der Seitenkopf genau diesen Baustein, ohne eigenen Abstand davor.
    expect(quelle('src/components/mein-hof/seitenkopf.tsx')).toMatch(/<header className="print:hidden lg:mb-6">\s*\{[^}]*\}\s*<div className="lg:hidden">\s*<MeinHofKopf /)
    // Gegenprobe am echten Quelltext: Eine eigene Hülle auf /products (wie bis Nr. 142) fiele auf.
    const eigeneHuelle = produkte.replace("<div className={cn(MEIN_HOF_KOPF_HUELLE, 'md:hidden')}>", '<div className="px-4 pt-5 md:hidden">')
    expect(eigeneHuelle).not.toBe(produkte)
    expect(eigeneHuelle).not.toMatch(/<div className=\{cn\(MEIN_HOF_KOPF_HUELLE, 'md:hidden'\)\}>\s*<MeinHofKopf /)
    expect(MEIN_HOF_KOPF_HUELLE).toBe('mx-auto max-w-3xl px-4 pt-5 md:px-8 md:pt-7 lg:max-w-none')
  })

  it('die Ladeansichten nehmen denselben Kopf in derselben Hülle', () => {
    expect(quelle('src/app/(hof)/products/loading.tsx')).toMatch(/<div className=\{cn\(MEIN_HOF_KOPF_HUELLE, 'md:hidden'\)\}>\s*<MeinHofKopfLaden aktiv="produkte" \/>/)
    expect(quelle('src/components/mein-hof/mein-hof-laden.tsx')).toMatch(/<div className=\{MEIN_HOF_KOPF_HUELLE\}>[\s\S]*?<MeinHofKopfLaden aktiv="hofseite" \/>/)
    // Gleiche Höhen wie der Kopf: Streifen 76 px, Zustandszeile mindestens 70 px (zwei Satzzeilen), Reiter 48 px.
    const laden = quelle('src/components/mein-hof/mein-hof-laden.tsx')
    const echt = quelle('src/components/mein-hof/mein-hof-kopf.tsx')
    for (const mass of ['h-[76px]', 'min-h-[70px]']) {
      expect(laden, mass).toContain(mass)
      expect(echt, mass).toContain(mass)
    }
  })
})

describe('Streifen', () => {
  it('Logo, Name ohne h1, Teilen als runder Knopf mit aria-label, Kundenansicht — keine Adresse, kein Kopieren', () => {
    const html = kopf()
    expect(html).not.toContain('<h1')
    expect(html).toMatch(/<p class="[^"]*line-clamp-2[^"]*" title="Testhof A">Testhof A<\/p>/)
    expect(html).toMatch(/<button type="button" class="[^"]*\bw-11\b[^"]*" aria-label="Teilen"><svg[^>]*aria-hidden="true"/)
    expect(html).toContain('Kundenansicht')
    expect(html).not.toContain('agrilo.at/testhof-a')
    expect(html).not.toMatch(/Kopieren|kopieren/)
  })

  it('nicht öffentlich: kein Teilen, Kundenansicht bleibt', () => {
    const html = kopf(ZUSTAND, { ...HOF, zustand: { art: 'aus', schild: { text: 'Noch nicht freigegeben', farbe: 'grau' }, oeffentlich: false } })
    expect(html).not.toContain('aria-label="Teilen"')
    expect(html).toContain('Kundenansicht')
  })

  it('HofTeilenKnopf: die Variante mit Symbol trägt das Wort nur als aria-label', () => {
    const symbol = renderToStaticMarkup(createElement(HofTeilenKnopf, { name: 'Testhof A', slug: 'testhof-a', label: 'Teilen', nurSymbol: true }))
    expect(symbol).toMatch(/^<button type="button" aria-label="Teilen"><svg[^>]*aria-hidden="true">[\s\S]*?<\/svg><\/button>$/)
    // Gegenprobe: ohne die Variante steht das Wort sichtbar da, ohne aria-label.
    const wort = renderToStaticMarkup(createElement(HofTeilenKnopf, { name: 'Testhof A', slug: 'testhof-a', label: 'Teilen' }))
    expect(wort).toMatch(/<\/svg>Teilen<\/button>$/)
    expect(wort).not.toContain('aria-label')
  })

  it('Schleier und Schrift nur aus Tokens, theme-fest (primary-foreground / accent-foreground)', () => {
    const text = quelle('src/components/mein-hof/mein-hof-kopf.tsx')
    expect(text).toContain("'bg-linear-to-r from-primary-foreground/90 via-primary-foreground/75 via-55% to-primary-foreground/40'")
    expect(text).toMatch(/text-accent-foreground/)
    expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch)\(|\b(bg|text|from|to|via)-(black|white)\b/)
    // Gegenprobe: die Suche findet ein Farbliteral.
    expect('from-[#080c09]/90').toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('Zustandszeile', () => {
  const zeile = (html: string) => html.slice(html.indexOf('min-h-[70px]'), html.indexOf('<nav'))

  it('nimmt an: Punkt aria-hidden, Titel, Satz mit der nächsten Abholung, Knopf „Pausieren" (öffnet das Blatt)', () => {
    const z = zeile(kopf())
    expect(z).toMatch(/<span aria-hidden="true" class="[^"]*\bbg-status-fertig\b/)
    expect(z).toContain('>Nimmt Bestellungen an</p>')
    expect(z).toContain('>Nächste Abholung: Morgen 15:00–18:00</p>')
    expect(z).toMatch(/<button type="button" class="[^"]*"><svg[^>]*aria-hidden="true">[\s\S]*?<\/svg>Pausieren<\/button>/)
    // Das Blatt ist zu.
    expect(z).not.toContain('Bestellungen pausieren?')
  })

  it('pausiert: derselbe Knopf heißt „Fortsetzen" (grün) — kein Blatt', () => {
    const z = zeile(kopf({ ...ZUSTAND, zustand: 'pausiert', sperre: 'pause' }))
    expect(z).toContain('>Pausiert</p>')
    expect(z).toMatch(/<button type="button" class="[^"]*\bbg-accent\b[^"]*">Fortsetzen<\/button>/)
    expect(z).toMatch(/border-primary\/45/)
  })

  it('ohne Abholzeit und ausgebucht: Links nach /settings/pickup-slots; kein Produkt: nach /products', () => {
    expect(zeile(kopf({ ...ZUSTAND, sperre: 'keine-abholzeit', naechste: null }))).toMatch(/<a href="\/settings\/pickup-slots"[^>]*>Eintragen<\/a>/)
    expect(zeile(kopf({ ...ZUSTAND, sperre: 'ausgebucht', naechste: null }))).toMatch(/<a href="\/settings\/pickup-slots"[^>]*>Abholzeiten<\/a>/)
    expect(zeile(kopf({ ...ZUSTAND, kaufbar: false }))).toMatch(/<a href="\/products"[^>]*>Produkte<\/a>/)
  })

  it('stillgelegt und wartet: keine Zeile (der Balken sagt es); ohne Daten auch nicht — die Reiter stehen trotzdem', () => {
    for (const html of [kopf({ ...ZUSTAND, zustand: 'stillgelegt' }), kopf({ ...ZUSTAND, zustand: 'wartet' }), kopf(null)]) {
      expect(html).not.toContain('min-h-[70px]')
      expect(html).toContain('<nav aria-label="Mein Hof"')
    }
    // Gegenprobe: freigeschaltet, aber nicht aktiv — grau, ohne Knopf.
    const aus = zeile(kopf({ ...ZUSTAND, zustand: 'aus' }))
    expect(aus).toContain('>Noch nicht freigegeben</p>')
    expect(aus).not.toMatch(/<button|<a /)
  })

  it('der Satz wird nie gekürzt', () => {
    const text = quelle('src/components/mein-hof/mein-hof-kopf.tsx')
    const satz = /<p className="([^"]*)">\{zeile\.satz\}<\/p>/.exec(text)?.[1] ?? ''
    expect(satz).toContain('text-muted-foreground')
    expect(satz).not.toMatch(/truncate|line-clamp|whitespace-nowrap/)
  })

  it('Reiter: auf /products nur unter md, auf Hofseite und Beiträge auf allen Breiten unter lg', () => {
    expect(kopf()).toMatch(/<nav aria-label="Mein Hof" class="[^"]*\bmd:hidden\b/)
    expect(kopf(ZUSTAND, HOF, 'hofseite')).not.toMatch(/<nav aria-label="Mein Hof" class="[^"]*\bmd:hidden\b/)
  })
})

describe('Blatt „Bestellungen pausieren?"', () => {
  const blatt = quelle('src/components/mein-hof/pausieren-blatt.tsx')

  it('Form nach DESIGN_SYSTEM: Titel mit Fokus, kein Kreuz, „Pausieren" volle Breite, „Abbrechen" als Textknopf darunter', () => {
    expect(blatt).toContain('<SheetBlatt initialFocus={titel} finalFocus={knopf}')
    expect(blatt).toContain('Bestellungen pausieren?')
    expect(blatt).not.toMatch(/aria-label="Schließen"|<X\b|lucide-react['"];?\s*$.*\bX\b/m)
    const pausieren = blatt.indexOf("{laeuft ? 'Pausiert …' : 'Pausieren'}")
    const abbrechen = blatt.indexOf('Abbrechen\n')
    expect(pausieren).toBeGreaterThan(0)
    expect(pausieren).toBeLessThan(abbrechen)
    expect(blatt).toMatch(/'inline-flex h-12 w-full [^']*bg-primary/)
    expect(blatt).toMatch(/<SheetClose\s+disabled=\{laeuft\}\s+className=\{cn\('mx-auto min-h-11[^']*text-brand-text/)
  })

  it('drei Sätze, Feld mit Label, Zähler getrimmt ohne maxLength, Vorschau = die echte Hinweiskarte', () => {
    for (const satz of [
      'Deine Hofseite bleibt sichtbar, mit deiner Nachricht.',
      'Bestellen kann gerade niemand, bis du fortsetzt.',
      'Bestellungen, die schon da sind, bleiben. Die holen deine Kundinnen wie geplant ab.',
    ]) {
      expect(blatt).toContain(satz)
    }
    expect(blatt).toMatch(/<label htmlFor=\{feldId\}[^>]*>\s*Nachricht an deine Kundinnen <span[^>]*>\(freiwillig\)<\/span>/)
    expect(blatt).toContain('<ZeichenZaehler laenge={nachricht.trim().length} max={PAUSENACHRICHT_MAX} />')
    expect(blatt).not.toContain('maxLength')
    expect(blatt).toContain('<KaufSperreHinweis sperre="pause" hofName={hofName} pauseMessage={nachricht} />')
  })

  it('Pausieren schreibt die Nachricht mit, Fortsetzen die gespeicherte; Meldungen aus EINER Quelle', () => {
    expect(blatt).toContain('await setPause(true, nachricht)')
    expect(blatt).toContain("await setPause(false, gespeicherteNachricht ?? '')")
    expect(blatt).toContain('toast.success(PAUSE_MELDUNG.pausiert)')
    expect(blatt).toContain('toast.success(PAUSE_MELDUNG.fortgesetzt)')
    // Ein Fehler steht im Blatt, das Blatt bleibt offen.
    expect(blatt).toMatch(/if \(res\.error\) \{\s*\/\/[^\n]*\n\s*setFehler\(res\.error\)\s*return/)
    const client = quelle('src/components/settings/pause-client.tsx')
    expect(client).toContain('PAUSE_MELDUNG.pausiert : PAUSE_MELDUNG.fortgesetzt')
    // Gegenprobe: kein Wortlaut der Meldung mehr als eigenes Literal.
    expect(client + blatt).not.toContain(`'${PAUSE_MELDUNG.pausiert}'`)
  })
})

describe('Zähler der Pausen-Nachricht (Nacharbeit 137): getrimmt wie im Server', () => {
  const zaehler = (nachricht: string) => renderToStaticMarkup(createElement(PauseClient, { initialPaused: false, initialMessage: nachricht }))

  it('PauseClient: Leerzeichen am Rand zählen nicht', () => {
    const genau = 'x'.repeat(PAUSENACHRICHT_MAX)
    const html = zaehler(`  ${genau}   `)
    expect(html).toContain(`${PAUSENACHRICHT_MAX} / ${PAUSENACHRICHT_MAX}<`)
    expect(html).not.toContain('Bitte kürzen')
    // Gegenprobe: ein Zeichen mehr im Inneren ist zu lang.
    expect(zaehler(`  ${genau}x `)).toContain('Bitte kürzen')
    // An der Schwelle (80 % = 240): 239 Zeichen mit Rand bleiben unsichtbar, ungetrimmt wären es 259.
    const knapp = 'x'.repeat((PAUSENACHRICHT_MAX * 4) / 5 - 1)
    expect(zaehler(`          ${knapp}          `)).not.toContain(` / ${PAUSENACHRICHT_MAX}`)
    // Gegenprobe: ein Zeichen mehr im Inneren, und der Zähler steht mit der getrimmten Zahl.
    expect(zaehler(`          ${knapp}x          `)).toContain(`${knapp.length + 1} / ${PAUSENACHRICHT_MAX}<`)
    expect(quelle('src/components/settings/pause-client.tsx')).toContain('<ZeichenZaehler laenge={message.trim().length} max={PAUSENACHRICHT_MAX} />')
  })
})
