/**
 * Der Kopf von Mein Hof am Handy (Nachtlauf Nr. 143, Register N3, Ergänzung
 * 22.10.2026; Board system-h1-mein-hof-v3) — serverseitig gerendert
 * (TESTING_GUIDELINES §1), dazu Quelltext-Prüfungen mit Gegenprobe.
 *
 * Beweist:
 *  - EIN Baustein auf allen drei Reitern: /farm-page (unter lg, in seitenkopf.tsx)
 *    und /products (unter md) in derselben Hülle — die Reiter stehen an derselben Stelle.
 *  - Titelzeile nach Board s1-mein-hof (Register N3, Ergänzung 5.11.2026): „Mein Hof"
 *    (kein h1) mit Schild nur bei öffentlicher Hofseite, darunter „<Hof> · Stand <Datum
 *    in Wien>"; Teilen (nur öffentlich) und Kundenansicht als Symbole mit Namen für den
 *    Screenreader; kein Titelbild-Streifen, keine Adresse, kein „Kopieren" unter lg.
 *  - Zustandszeile: Punkt aria-hidden, Titel trägt die Bedeutung, der Knopf macht
 *    den nächsten Schritt — Pausieren/Fortsetzen an derselben Stelle (derselbe Knopf),
 *    „Eintragen"/„Abholzeiten" nach /settings/pickup-slots, „Produkte" nach /products;
 *    stillgelegt/wartet ohne Zeile.
 *  - Der Kopf nimmt nur Tokens (kein Farbliteral).
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

/** Mittwoch, 3. März 2027, 23:30 in Wien — in UTC noch Dienstag: Das Datum muss das Wiener sein. */
const JETZT = new Date('2027-03-03T22:30:00Z')

const kopf = (zustand: MeinHofZustand | null = ZUSTAND, hof: MeinHofKopfDaten = HOF, aktiv: 'produkte' | 'hofseite' | 'beitraege' = 'produkte') =>
  renderToStaticMarkup(createElement(MeinHofKopf, { hof, zustand, aktiv, jetzt: JETZT }))

describe('ein Kopf, eine Hülle (Reiter an derselben Stelle)', () => {
  it('/farm-page (beide Reiter) und /products stecken den Kopf in dieselbe Hülle', () => {
    const farmPage = quelle('src/app/(hof)/farm-page/page.tsx')
    const produkte = quelle('src/app/(hof)/products/page.tsx')
    // Seit Nr. 274 klebt der Kopf auf /farm-page unter lg (MEIN_HOF_KOPF_KLEBT); die Hülle bleibt dieselbe.
    expect(farmPage.match(/<div className=\{cn\(MEIN_HOF_KOPF_HUELLE, MEIN_HOF_KOPF_KLEBT\)\}>\s*<MeinHofSeitenkopf /g)).toHaveLength(2)
    expect(produkte).toMatch(/<div className=\{cn\(MEIN_HOF_KOPF_HUELLE, 'md:hidden'\)\}>\s*<MeinHofKopf /)
    // Unter lg rendert der Seitenkopf genau diesen Baustein, ohne eigenen Abstand davor.
    expect(quelle('src/components/mein-hof/seitenkopf.tsx')).toMatch(/<header className="print:hidden lg:mb-6">\s*\{[^}]*\}\s*<div className="lg:hidden">\s*\{[^}]*\}\s*<MeinHofKopf /)
    // Gegenprobe am echten Quelltext: Eine eigene Hülle auf /products (wie bis Nr. 142) fiele auf.
    const eigeneHuelle = produkte.replace("<div className={cn(MEIN_HOF_KOPF_HUELLE, 'md:hidden')}>", '<div className="px-4 pt-5 md:hidden">')
    expect(eigeneHuelle).not.toBe(produkte)
    expect(eigeneHuelle).not.toMatch(/<div className=\{cn\(MEIN_HOF_KOPF_HUELLE, 'md:hidden'\)\}>\s*<MeinHofKopf /)
    expect(MEIN_HOF_KOPF_HUELLE).toBe('mx-auto max-w-3xl px-4 pt-5 md:px-8 md:pt-7 lg:max-w-none')
  })

  it('die Ladeansichten nehmen denselben Kopf in derselben Hülle', () => {
    expect(quelle('src/app/(hof)/products/loading.tsx')).toMatch(/<div className=\{cn\(MEIN_HOF_KOPF_HUELLE, 'md:hidden'\)\}>\s*<MeinHofKopfLaden aktiv="produkte" \/>/)
    expect(quelle('src/components/mein-hof/mein-hof-laden.tsx')).toMatch(/<div className=\{MEIN_HOF_KOPF_HUELLE\}>[\s\S]*?<MeinHofKopfLaden aktiv="hofseite" \/>/)
    // Gleiche Höhen wie der Kopf: Titelzeile 56 px, Zustandszeile mindestens 70 px (zwei Satzzeilen), Reiter 48 px.
    const laden = quelle('src/components/mein-hof/mein-hof-laden.tsx')
    const echt = quelle('src/components/mein-hof/mein-hof-kopf.tsx')
    for (const mass of ['min-h-14', 'min-h-[70px]']) {
      expect(laden, mass).toContain(mass)
      expect(echt, mass).toContain(mass)
    }
  })
})

describe('Titelzeile (Board s1-mein-hof statt Titelbild-Streifen)', () => {
  // Seit Lauf 31 (Nr. 238) stehen die Reiter direkt unter der Titelzeile, die Zustandskarte darunter.
  const titelzeile = (html: string) => html.slice(0, html.indexOf('<nav'))

  it('„Mein Hof" ohne h1, Schild „Öffentlich", darunter Hofname und Stand mit dem Wiener Datum', () => {
    const html = titelzeile(kopf())
    expect(html).not.toContain('<h1')
    expect(html).toMatch(/<p class="[^"]*\bfont-heading\b[^"]*">Mein Hof<\/p>/)
    expect(html).toMatch(/data-slot="status-badge" data-status="fertig"[^>]*>[\s\S]*?Öffentlich/)
    // Tag, Monat und Jahr mit geschütztem Leerzeichen — die Zeile bricht nicht zwischen „3.“ und „März“.
    expect(html).toContain('>Testhof A · Stand Mittwoch, 3.\u00a0März\u00a02027</p>')
    // Gegenprobe: in UTC wäre es noch Dienstag.
    expect(html).not.toContain('Dienstag')
  })

  it('auf /farm-page ist „Mein Hof" die sichtbare h1 (titelAlsH1), auf /products bleibt es ein Absatz', () => {
    const h1 = titelzeile(renderToStaticMarkup(createElement(MeinHofKopf, { hof: HOF, zustand: ZUSTAND, aktiv: 'hofseite', jetzt: JETZT, titelAlsH1: true })))
    expect(h1).toMatch(/<h1 class="[^"]*\bfont-heading\b[^"]*">Mein Hof<\/h1>/)
    expect(h1.match(/<h1\b/g)).toHaveLength(1)
    // Gegenprobe: ohne die Angabe (wie auf /products) keine h1.
    expect(titelzeile(kopf())).not.toContain('<h1')
  })

  it('kein Titelbild-Streifen mehr: kein Bild, kein Logo, kein Schleier — das Titelbild bleibt in der Liste „Bearbeiten"', () => {
    const html = kopf(ZUSTAND, { ...HOF, logoUrl: '/logo.webp' })
    expect(html).not.toContain('<img')
    expect(html).not.toContain('h-[76px]')
    const text = quelle('src/components/mein-hof/mein-hof-kopf.tsx')
    expect(text).not.toMatch(/next\/image|titelbildVerlauf|Hofbild|from-primary-foreground/)
    // Gegenprobe: die Zeile „Titelbild" der Liste „Bearbeiten" gibt es weiter.
    expect(quelle('src/lib/hofseite-fortschritt.ts')).toContain("titelbild: 'Titelbild'")
  })

  it('pausiert: Schild „Pausiert" (orange) neben dem Titel', () => {
    const html = titelzeile(kopf({ ...ZUSTAND, zustand: 'pausiert', sperre: 'pause' }, { ...HOF, zustand: { art: 'pausiert', schild: { text: 'Pausiert', farbe: 'bernstein' }, oeffentlich: true } }))
    expect(html).toMatch(/data-slot="status-badge" data-status="offen"[^>]*>[\s\S]*?Pausiert/)
  })

  it('nicht öffentlich: kein Schild (das sagen Zustandszeile bzw. Balken), kein Teilen, Kundenansicht bleibt', () => {
    const html = kopf(ZUSTAND, { ...HOF, zustand: { art: 'aus', schild: { text: 'Noch nicht freigegeben', farbe: 'grau' }, oeffentlich: false } })
    const zeile = titelzeile(kopf({ ...ZUSTAND, zustand: 'aus' }, { ...HOF, zustand: { art: 'aus', schild: { text: 'Noch nicht freigegeben', farbe: 'grau' }, oeffentlich: false } }))
    expect(zeile).not.toContain('data-slot="status-badge"')
    expect(zeile).not.toContain('Noch nicht freigegeben')
    expect(html).not.toContain('aria-label="Teilen"')
    expect(html).toContain('Kundenansicht')
  })

  it('Teilen und Kundenansicht als Symbole (44 px) mit Namen für den Screenreader; keine Adresse, kein Kopieren', () => {
    const html = titelzeile(kopf())
    expect(html).toMatch(/<button type="button" class="[^"]*\bsize-11\b[^"]*" aria-label="Teilen"><svg[^>]*aria-hidden="true"/)
    // Ohne Kundenansicht drumherum (der Kopf allein): Link in einen neuen Tab, das Wort nur für den Screenreader.
    expect(html).toMatch(/<a href="\/testhof-a\?vorschau=1"[^>]*class="[^"]*\bsize-11\b[^"]*"><svg[^>]*aria-hidden="true"[\s\S]*?<span class="sr-only">Kundenansicht<\/span>/)
    expect(html).not.toMatch(/>Kundenansicht<svg|<\/svg>Kundenansicht/)
    expect(html).not.toContain('agrilo.at/testhof-a')
    expect(html).not.toMatch(/Kopieren|kopieren/)
  })

  it('HofTeilenKnopf: die Variante mit Symbol trägt das Wort nur als aria-label', () => {
    const symbol = renderToStaticMarkup(createElement(HofTeilenKnopf, { name: 'Testhof A', slug: 'testhof-a', label: 'Teilen', nurSymbol: true }))
    expect(symbol).toMatch(/^<button type="button" aria-label="Teilen"><svg[^>]*aria-hidden="true">[\s\S]*?<\/svg><\/button>$/)
    // Gegenprobe: ohne die Variante steht das Wort sichtbar da, ohne aria-label.
    const wort = renderToStaticMarkup(createElement(HofTeilenKnopf, { name: 'Testhof A', slug: 'testhof-a', label: 'Teilen' }))
    expect(wort).toMatch(/<\/svg>Teilen<\/button>$/)
    expect(wort).not.toContain('aria-label')
  })

  it('der Kopf nimmt nur Tokens', () => {
    const text = quelle('src/components/mein-hof/mein-hof-kopf.tsx')
    expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch)\(|\b(bg|text|from|to|via)-(black|white)\b/)
    // Gegenprobe: die Suche findet ein Farbliteral.
    expect('from-[#080c09]/90').toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('Zustandszeile', () => {
  // Die Karte steht seit Lauf 31 unter den Reitern (Board s1-mein-hof) — sie reicht bis zum Ende des Kopfs.
  const zeile = (html: string) => (html.includes('data-zustands-karte') ? html.slice(html.lastIndexOf('<div', html.indexOf('data-zustands-karte'))) : '')

  it('Reiter vor der Karte: die Zustandskarte steht unter der Reiterleiste', () => {
    const html = kopf(ZUSTAND, HOF, 'hofseite')
    expect(html.indexOf('<nav aria-label="Mein Hof"')).toBeGreaterThan(-1)
    expect(html.indexOf('data-zustands-karte')).toBeGreaterThan(html.indexOf('</nav>'))
  })

  it('auf Beiträge keine Zustandskarte (Board s1-mein-hof Bild 5); die Reiter stehen trotzdem', () => {
    const html = kopf(ZUSTAND, HOF, 'beitraege')
    expect(html).not.toContain('data-zustands-karte')
    expect(html).toContain('<nav aria-label="Mein Hof"')
    // Gegenprobe: auf Hofseite steht sie.
    expect(kopf(ZUSTAND, HOF, 'hofseite')).toContain('data-zustands-karte')
  })

  it('nimmt an: grün getönt ohne Punkt, Titel, Satz mit der nächsten Abholung, Knopf „Pausieren" (öffnet das Blatt)', () => {
    const z = zeile(kopf())
    // Seit Nr. 251 die Zustandsfläche (im Dunkeln sichtbar getönt) mit farbiger Überschrift (Liste Lauf 32 mein-hof).
    expect(z).toMatch(/^<div class="[^"]*\bborder-zustand-laeuft\/30\b[^"]*\bbg-zustand-laeuft-grund\b/)
    expect(z).toContain('text-status-fertig">Nimmt Bestellungen an</p>')
    expect(z).not.toMatch(/size-\[9px\]/)
    expect(z).toContain('Nimmt Bestellungen an</p>')
    expect(z).toContain('>Nächste Abholung: Morgen 15:00–18:00</p>')
    // Umriss ohne Symbol wie im Board (Lauf 31).
    expect(z).toMatch(/<button type="button" class="[^"]*\bborder-foreground\b[^"]*">Pausieren<\/button>/)
    // Das Blatt ist zu.
    expect(z).not.toContain('Bestellungen pausieren?')
  })

  it('pausiert: derselbe Knopf heißt „Fortsetzen" (Umriss) — kein Blatt', () => {
    const z = zeile(kopf({ ...ZUSTAND, zustand: 'pausiert', sperre: 'pause' }))
    expect(z).toContain('>Pausiert</p>')
    // Derselbe Umriss wie „Pausieren“ (Board s1-mein-hof Bild 4: Rahmenknopf, nicht grün gefüllt).
    expect(z).toMatch(/<button type="button" class="[^"]*\bborder-foreground\b[^"]*">Fortsetzen<\/button>/)
    expect(z).not.toMatch(/\bbg-accent\b[^"]*">Fortsetzen/)
    expect(z).toMatch(/border-zustand-tun\/30/)
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
    const satz = /<p className=\{cn\(([^}]*)\)\}>\{zeile\.satz\}<\/p>/.exec(text)?.[1] ?? ''
    expect(satz).toContain('text-muted-foreground')
    expect(satz).not.toMatch(/truncate|line-clamp|whitespace-nowrap/)
  })

  it('Reiter: auf /products nur unter md, auf Hofseite und Beiträge auf allen Breiten unter lg', () => {
    expect(kopf()).toMatch(/<nav aria-label="Mein Hof" class="[^"]*\bmd:hidden\b/)
    expect(kopf(ZUSTAND, HOF, 'hofseite')).not.toMatch(/<nav aria-label="Mein Hof" class="[^"]*\bmd:hidden\b/)
  })
})

describe('„Hof pausieren“ (Dialog bzw. Blatt)', () => {
  const blatt = quelle('src/components/mein-hof/pausieren-blatt.tsx')

  it('Nr. 251 (Board s1-/w1-mein-hof Bild 3): ab 768 px Dialog in der Mitte, sonst Blatt; „Abbrechen“ oben rechts mit dem Startfokus, kein Kreuz', () => {
    expect(blatt).toContain('<DialogMitte ref={popup} titel={TITEL} schliessen="Abbrechen" initialFocus={abbrechenFokus} finalFocus={knopf}')
    expect(blatt).toMatch(/<SheetBlatt ref=\{popup\}[^>]*kopf=\{<SheetKopf titel=\{TITEL\} schliessen="Abbrechen" \/>\}[^>]*initialFocus=\{abbrechenFokus\}/)
    expect(blatt).toContain("const TITEL = 'Hof pausieren'")
    expect(blatt).toContain('useMindestbreite(768)')
    expect(blatt).not.toMatch(/aria-label="Schließen"|<X\b|<Pause\b/)
    // Am Handy volle Breite, ab 768 px rechtsbündig (Board w1-mein-hof Bild 3, Nr. 274).
    expect(blatt).toMatch(/'inline-flex min-h-12 w-full [^']*bg-primary[^']*md:w-auto md:self-end/)
  })

  it('Feld „Nachricht an deine Kundschaft (freiwillig)“, Kasten „So steht es auf deiner Hofseite“ neutral, Schluss-Satz', () => {
    expect(blatt).toMatch(/<label htmlFor=\{feldId\}[^>]*>\s*Nachricht an deine Kundschaft <span[^>]*>\(freiwillig\)<\/span>/)
    expect(blatt).toContain('So steht es auf deiner Hofseite')
    expect(blatt).toContain('Offene Bestellungen bleiben bestehen. Neue Bestellungen sind erst nach „Fortsetzen“ möglich.')
    expect(blatt).toContain('<ZeichenZaehler laenge={nachricht.trim().length} max={PAUSENACHRICHT_MAX} />')
    expect(blatt).not.toContain('maxLength')
    // Seit Nr. 274 neutral wie im Board (Abnahme Lauf 32 mein-hof 11): der Satz der Hofseite aus derselben Quelle, die Nachricht in „…“.
    expect(blatt).not.toContain('<KaufSperreHinweis')
    expect(blatt).toContain('{`${hofName} ${PAUSIERT_GERADE}.`}')
    expect(blatt).toContain('{`„${nachricht.trim()}“`}')
    expect(blatt).not.toMatch(/bg-zustand-tun|<Pause|<Hinweiskarte/)
  })

  it('Pausieren schreibt die Nachricht mit, Fortsetzen die gespeicherte; Meldungen aus EINER Quelle', () => {
    expect(blatt).toContain('await aktionOhneWurf(() => setPause(true, nachricht))')
    expect(blatt).toContain("await aktionOhneWurf(() => setPause(false, gespeicherteNachricht ?? ''))")
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
