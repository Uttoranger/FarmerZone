/**
 * Shells und Navigation nach den Boards November 2026 (Nr. 220, Lauf 30) —
 * gerendert wie auf dem Server.
 *
 * Beweist:
 *  - Zähler „Bestellungen“ (N41 e): EINE Liste OPEN_STATUSES (exportiert) —
 *    alles außer abgeholt, storniert, nicht abgeholt; die Zahl der Navigation
 *    kommt nur daraus und steht in Unterleiste und Seitenleiste gleich.
 *  - Nichts unter dem Überstand (V28): Der Platz unter Inhalt und Seitenfuß
 *    reicht für Unterleiste samt erhobenem Mittelknopf.
 *  - Fokus und 44 px: jedes Bedienelement in Kopf, Seitenleiste und den
 *    Blättern „Mehr“ und „Neu“ trägt den sichtbaren Fokus und mindestens 44 px.
 *  - HofShell (Boards s1-/w1-mehr-neu, V13): Seitenleiste mit Marke,
 *    „+ Neu ▾“ (Zeichen statt Symbole), Menü „Neu“ mit 66 px Abstand und
 *    über der Zeile „Heute“, „Konto · <Name>“ mit dem Mond und „Abmelden“ darunter;
 *    Mehr-Blatt Postfach · Dein Tarif · Verkauf und Kunden · Konto und Hilfe
 *    (Person, …, Darstellung Hell/Dunkel, Abmelden) ohne Symbole; Neu-Blatt mit
 *    Kopf „Was legst du an? · Abbrechen“.
 *  - KundeShell (V10, V12, N41 c): „Warenkorb · n“ im Browser-Kopf nur gefüllt,
 *    Mittelknopf mit dem Wort „Warenkorb“, Startseite ohne aktiven Kopf-Punkt,
 *    in der Unterleiste „Entdecken“.
 *  - AdminShell (Boards s3-/w3-admin-shell): „n offen – ansehen“ als grüner
 *    Textlink, Mehr-Blatt ohne Symbole.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OrderStatus } from '@prisma/client'

const pfad = vi.hoisted(() => ({ aktuell: '/dashboard' }))
vi.mock('next/navigation', () => ({
  usePathname: () => pfad.aktuell,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ signOut: vi.fn() }))
const prismaMock = vi.hoisted(() => ({ order: { count: vi.fn(async () => 0) } }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
// Der Warenkorb im Kopf liest den Speicher des Browsers; hier stellt der Fall ihn.
const korb = vi.hoisted(() => ({ stand: null as { anzahl: number; href: string } | null }))
vi.mock('@/lib/use-warenkorb-kopf', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/lib/use-warenkorb-kopf')>()
  return { ...echt, useWarenkorbKopf: () => korb.stand }
})
// Ein Blatt liegt im Portal; für den Blick hinein rendert SheetBlatt an Ort und Stelle (wie in tests/shells.test.ts).
vi.mock('@/components/ui/sheet', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/components/ui/sheet')>()
  return {
    ...echt,
    SheetBlatt: (props: Parameters<typeof echt.SheetBlatt>[0]) => createElement('div', { 'data-slot': 'sheet-blatt-inline' }, props.kopf, props.children as ReactNode),
  }
})

import { HofShell } from '@/components/shells/hof-shell'
import { KundeShell } from '@/components/shells/kunde-shell'
import { AdminShell } from '@/components/shells/admin-shell'
import { OPEN_STATUSES, getOpenOrdersCount } from '@/server/queries/orders'
import {
  ABMELDEN_LABEL,
  DEIN_TARIF_TITEL,
  EINSTELLUNG_KONTO,
  HOF_NEU_ABBRECHEN,
  HOF_NEU_ANDERES_TITEL,
  HOF_NEU_TITEL,
  KONTO_KURZ,
  KONTO_UND_HILFE_TITEL,
  VERKAUF_UND_KUNDEN_TITEL,
  datumOhneUmbruch,
  postfachUnterzeile,
} from '@/lib/bauern-navigation'
import { DARSTELLUNG_TEXT, WARENKORB_WORT, kundenHandyAriaAktuell, kundenNavigation, warenkorbKopfText } from '@/lib/kunden-navigation'
import { ADMIN_MEHR_ZEILE } from '@/lib/admin-navigation'
import { POSTFACH_HREF, POSTFACH_TEXT } from '@/lib/postfach'
import { KUNDE_SHELL_MASSE } from '@/lib/kunde-shell-masse'
import { MARKE } from '@/lib/marke'
import type { TarifZeileDaten } from '@/lib/konditionen'

const INHALT = createElement('p', null, 'Inhalt der Seite')

function el<P extends { children?: ReactNode }>(typ: ComponentType<P>, props: Omit<P, 'children'>): ReactElement {
  return createElement(typ as unknown as ComponentType<Omit<P, 'children'>>, props, INHALT)
}

function quelle(datei: string): string {
  return readFileSync(join(process.cwd(), datei), 'utf8')
}

/** Der Teil des HTML vom ersten `start` bis zum nächsten `ende` danach. */
function abschnitt(html: string, start: string, ende: string): string {
  const von = html.indexOf(start)
  expect(von, start).toBeGreaterThanOrEqual(0)
  return html.slice(von, html.indexOf(ende, von) + ende.length)
}

const TARIF: TarifZeileDaten = {
  zustand: 'gruendungshof',
  titel: 'Gründungshof',
  zeile: 'ohne Grundgebühr bis 31. Jänner 2028',
  zeileHandy: 'ohne Grundgebühr bis 31. Jänner 2028',
}

function hof({ bestellungen = 0, postfach = 0, isAdmin = true }: { bestellungen?: number; postfach?: number; isAdmin?: boolean } = {}): string {
  pfad.aktuell = '/dashboard'
  return renderToStaticMarkup(
    el(HofShell, {
      hofName: 'Hof Beispiel',
      hofSlug: 'hof-beispiel',
      personName: 'Max Mustermann',
      isAdmin,
      zahlen: { bestellungen, postfach, admin: 3 },
      tarifZeile: TARIF,
    })
  )
}

/** Die Blätter der Leiste in ihrer Reihenfolge: zuerst „Neu“, dann „Mehr“. */
function blaetter(html: string): { neu: string; mehr: string } {
  const teile = html.split('data-slot="sheet-blatt-inline"')
  expect(teile.length, 'zwei Blätter').toBe(3)
  return { neu: teile[1], mehr: teile[2] }
}

/** Alle öffnenden Tags von Links und Knöpfen in einem Abschnitt. */
function bedienelemente(html: string): string[] {
  return html.match(/<(?:a|button)\b[^>]*>/g) ?? []
}

/** Ob ein Tag mindestens 44 px trifft: eigene Höhe/Größe ab 44 px oder die Fläche über ::before (TREFFER_44). */
function trifft44(tag: string): boolean {
  if (/\b(?:min-h-11|h-11|size-11|min-h-14|h-14|size-12|h-12)\b/.test(tag)) return true
  if (/before:min-h-11|before:-inset-y-/.test(tag)) return true
  // Ein Eintrag der Unterleiste füllt deren 68 px Höhe (items-stretch in bottom-nav.tsx) — er trägt keine eigene Höhe.
  if (/\bflex-1 flex-col items-center justify-center\b/.test(tag)) return true
  const px = [...tag.matchAll(/\b(?:min-h|h|size)-\[(\d+)px\]/g)].map((m) => Number(m[1]))
  return px.some((wert) => wert >= 44)
}

/** Ob ein Tag den sichtbaren Fokus trägt (FOKUS_RAHMEN oder FOKUS_RAHMEN_INNEN). */
function hatFokus(tag: string): boolean {
  return /focus-visible:outline-2/.test(tag) && /focus-visible:outline-solid/.test(tag) && /focus-visible:outline-ring/.test(tag)
}

describe('Zähler „Bestellungen“ (N41 e): eine Quelle', () => {
  it('OPEN_STATUSES ist alles außer abgeholt, storniert und nicht abgeholt — auch „Bestätigung offen“', () => {
    const geschlossen: OrderStatus[] = ['PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP']
    const erwartet = Object.values(OrderStatus).filter((s) => !geschlossen.includes(s))
    expect([...OPEN_STATUSES].sort()).toEqual([...erwartet].sort())
    expect(OPEN_STATUSES).toContain('PENDING_CONFIRMATION')
  })

  it('getOpenOrdersCount zählt genau diese Liste für den Hof', async () => {
    prismaMock.order.count.mockResolvedValueOnce(6)
    await expect(getOpenOrdersCount('hof-1')).resolves.toBe(6)
    expect(prismaMock.order.count).toHaveBeenCalledWith({ where: { farmId: 'hof-1', status: { in: [...OPEN_STATUSES] } } })
  })

  it('Layout und Einrichten reichen die Zahl aus getOpenOrdersCount an die Shell — keine zweite Zählung', () => {
    expect(quelle('src/server/hofbereich.ts')).toContain('getOpenOrdersCount(hof.id)')
    expect(quelle('src/app/(hof)/layout.tsx')).toContain('zahlen={{ bestellungen: offeneBestellungen,')
    expect(quelle('src/app/(auth)/onboarding/page.tsx')).toContain('getOpenOrdersCount(hof.id)')
    // Gegenprobe: Die Liste steht nur einmal im Quelltext — Prisma-frei in src/lib/bestellstatus-offen.ts (Nr. 222);
    // die Abfrage reicht sie weiter, der Chip in hof-bestellungen.ts nimmt sie von dort.
    const LISTE = /'PENDING_CONFIRMATION', 'PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY'/g
    expect(quelle('src/lib/bestellstatus-offen.ts').match(LISTE)).toHaveLength(1)
    expect(quelle('src/server/queries/orders.ts').match(LISTE)).toBeNull()
    expect(quelle('src/lib/hof-bestellungen.ts').match(LISTE)).toBeNull()
    expect(quelle('src/server/queries/orders.ts')).toContain("import { OPEN_STATUSES } from '@/lib/bestellstatus-offen'")
    expect(quelle('src/lib/hof-bestellungen.ts')).toContain("import { OPEN_STATUSES } from '@/lib/bestellstatus-offen'")
  })

  it('dieselbe Zahl in Unterleiste und Seitenleiste', () => {
    const html = hof({ bestellungen: 6 })
    const seitenleiste = abschnitt(html, '<aside', '</aside>')
    const leiste = abschnitt(html, 'data-slot="bottom-nav"', '</nav>')
    for (const teil of [seitenleiste, leiste]) {
      const link = abschnitt(teil, '<a href="/orders"', '</a>')
      expect(link).toContain('6 offene Bestellungen')
    }
  })

  it('Gegenprobe: ohne offene Bestellung steht nirgends eine Zahl daran', () => {
    expect(hof({ bestellungen: 0 })).not.toContain('offene Bestellungen')
  })
})

describe('Nichts unter dem Überstand (V28)', () => {
  /** px aus einer Tailwind-Klasse `pb-28` (Viertel-rem in Pixel). */
  function pbPx(klassen: string): number {
    const wert = klassen.match(/(?:^|\s)pb-(\d+)(?:\s|$)/)?.[1]
    expect(wert, 'pb-…').toBeDefined()
    return Number(wert) * 4
  }
  const leiste = Number(KUNDE_SHELL_MASSE.match(/--kunde-unterleiste:calc\((\d+)px/)?.[1])
  const ueberstand = Number(KUNDE_SHELL_MASSE.match(/\[--kunde-ueberstand:(\d+)px\]/)?.[1])

  it('KundeShell: Der Seitenfuß hält Unterleiste plus erhobenen Warenkorb frei', () => {
    pfad.aktuell = '/hoefe'
    const fuss = abschnitt(renderToStaticMarkup(el(KundeShell, { sitzung: 'gast' })), '<footer', '>')
    expect(leiste).toBe(69)
    expect(ueberstand).toBe(20)
    expect(pbPx(fuss.match(/class="([^"]*)"/)?.[1] ?? '')).toBeGreaterThanOrEqual(leiste + ueberstand)
  })

  it('HofShell: Der Inhalt hält Unterleiste plus erhobenes „Neu“ frei', () => {
    const main = abschnitt(hof(), '<main', '>')
    expect(pbPx(main.match(/class="([^"]*)"/)?.[1] ?? '')).toBeGreaterThanOrEqual(leiste + ueberstand)
  })

  it('der Mittelknopf mit Wort ragt nicht weiter heraus als die Maße sagen (-mt-5 = 20 px)', () => {
    expect(quelle('src/components/ui/bottom-nav.tsx')).toMatch(/export function mittelknopfMitWortKlassen[\s\S]*?'group relative -mt-5 /)
    expect(quelle('src/components/shells/kunde-shell.tsx')).toContain('className={mittelknopfMitWortKlassen()}')
  })

  it('Gegenprobe: Die Rechnung schlägt bei zu wenig Platz an', () => {
    expect(pbPx('pb-20')).toBeLessThan(leiste + ueberstand)
  })
})

describe('Fokus und 44 px in den Shells', () => {
  it('HofShell: jedes Bedienelement in Seitenleiste, Unterleiste und den Blättern', () => {
    const html = hof({ bestellungen: 2, postfach: 1 })
    const teile = [abschnitt(html, '<aside', '</aside>'), ...html.split('data-slot="sheet-blatt-inline"').slice(1)]
    for (const teil of teile) {
      for (const tag of bedienelemente(teil)) {
        expect(trifft44(tag), tag).toBe(true)
        expect(hatFokus(tag), tag).toBe(true)
      }
    }
  })

  it('KundeShell: Kopf und Seitenfuß — gefüllter Warenkorb, alle Sitzungen', () => {
    korb.stand = { anzahl: 3, href: '/hof-beispiel?korb=1' }
    try {
      for (const sitzung of ['gast', 'kunde', 'hof'] as const) {
        pfad.aktuell = '/hoefe'
        const html = renderToStaticMarkup(el(KundeShell, { sitzung }))
        for (const teil of [abschnitt(html, '<header', '</header>'), abschnitt(html, '<footer', '</footer>')]) {
          for (const tag of bedienelemente(teil)) {
            expect(trifft44(tag), `${sitzung}: ${tag}`).toBe(true)
            expect(hatFokus(tag), `${sitzung}: ${tag}`).toBe(true)
          }
        }
      }
    } finally {
      korb.stand = null
    }
  })

  it('AdminShell: Kopf, Betriebsleiste und Mehr-Blatt', () => {
    pfad.aktuell = '/admin'
    const html = renderToStaticMarkup(
      el(AdminShell, { personName: 'Max Mustermann', hatHof: true, aufgaben: { href: '/admin', text: '2 offen · 1 überfällig – ansehen', kurz: '2 offen – ansehen' } })
    )
    for (const teil of [abschnitt(html, '<header', '</header>'), html.slice(html.indexOf('data-slot="sheet-blatt-inline"'))]) {
      for (const tag of bedienelemente(teil)) {
        expect(trifft44(tag), tag).toBe(true)
        expect(hatFokus(tag), tag).toBe(true)
      }
    }
  })

  it('Gegenprobe: ein Knopf ohne Fläche und ohne Fokus fällt auf', () => {
    expect(trifft44('<button class="h-9 px-2">')).toBe(false)
    expect(hatFokus('<button class="h-11 focus-visible:ring-2">')).toBe(false)
  })
})

describe('HofShell: Seitenleiste (V13, Board w1-mehr-neu)', () => {
  const seitenleiste = (): string => abschnitt(hof(), '<aside', '</aside>')

  it('oben die Marke, die Hofkarte mit „Hofseite ansehen“, dann „+ Neu ▾“ als Pille', () => {
    const leiste = seitenleiste()
    const marke = leiste.indexOf(`aria-label="${MARKE} – Heute"`)
    const hofseite = leiste.indexOf('>Hofseite ansehen<')
    const neu = leiste.indexOf('>Neu<')
    expect(marke).toBeGreaterThan(-1)
    expect(hofseite).toBeGreaterThan(marke)
    expect(neu).toBeGreaterThan(hofseite)
    expect(leiste.slice(leiste.lastIndexOf('<button', neu), neu)).toMatch(/rounded-full[^"]*bg-primary|bg-primary[^"]*rounded-full/)
  })

  it('„+ Neu ▾“ mit den Zeichen des Boards: „+“ und „▾“ stumm, der Name bleibt „Neu“ (UI-Runde 3)', () => {
    const leiste = seitenleiste()
    const neu = leiste.indexOf('>Neu<')
    const knopf = leiste.slice(leiste.lastIndexOf('<button', neu), leiste.indexOf('</button>', neu))
    expect(knopf).toContain('<span aria-hidden="true">+</span><span>Neu</span><span aria-hidden="true">▾</span>')
    // Gegenprobe: keine Symbole mehr im Knopf (vorher Plus und Winkel).
    expect(knopf).not.toMatch(/lucide-(plus|chevron-down)/)
  })

  it('Menü „Neu“ wie Board Bild 3: Einträge 64 px mit 2 px Abstand, deckt die Zeile „Heute“ ganz (Quelltext, offen nur im Browser)', () => {
    const shell = quelle('src/components/shells/hof-shell.tsx')
    expect(shell).toMatch(/const NEU_MENUE_EINTRAG = 'min-h-16 /)
    expect(shell).toContain("const NEU_MENUE_GRUPPE = 'flex flex-col gap-0.5'")
    const inhalt = shell.slice(shell.indexOf('<DropdownMenuContent'), shell.indexOf('>', shell.indexOf('<DropdownMenuContent')))
    // 2 px unter dem Knopf (mb-1 = 4 px vor „Heute“), 1 px links und 14 px rund: kein Rand und keine Ecke schaut hervor.
    for (const teil of ['sideOffset={2}', 'alignOffset={-1}', 'rounded-[14px]', 'container={menueZiel}', 'w-[334px]']) expect(inhalt, teil).toContain(teil)
    expect(shell).toMatch(/DropdownMenuTrigger[\s\S]{0,200}'mt-1\.5 mb-1 /)
  })

  it('ab 768 px ist „Neu“ immer das Menü am Knopf: auch der versteckte Knopf der Unterleiste öffnet es, nie das Blatt (UI-Runde 4)', () => {
    const shell = quelle('src/components/shells/hof-shell.tsx')
    // Das Menü ist gesteuert, damit der Knopf der Unterleiste es öffnen kann.
    expect(shell).toContain('<DropdownMenu open={menueOffen} onOpenChange={wechsleMenue}>')
    const wechsle = shell.slice(shell.indexOf('const wechsle ='), shell.indexOf('const wechsleMenue ='))
    expect(wechsle).toMatch(/if \(auf && welches === 'neu' && fensterBreit\(\) === true\) \{\s+setMenueOffen\(true\)\s+return/)
    // Gegenrichtung unter 768 px: der versteckte Knopf der Seitenleiste öffnet das Blatt.
    const menue = shell.slice(shell.indexOf('const wechsleMenue ='), shell.indexOf('}\n', shell.indexOf('const wechsleMenue =')) + 2)
    expect(menue).toMatch(/if \(auf && fensterBreit\(\) === false\) \{\s+setOffen\('neu'\)/)
    // Dieselbe Grenze wie die Klassen md:…
    expect(shell).toContain("window.matchMedia('(min-width: 768px)').matches")
  })

  it('die Marke sitzt wie im Board: sichtbar 32 px mit 4 px darunter, Tippfläche 44 px über ::before (UI-Runde 4)', () => {
    const leiste = seitenleiste()
    const marke = leiste.match(new RegExp(`<a [^>]*aria-label="${MARKE} – [^"]*"[^>]*>`))?.[0] ?? ''
    for (const k of ['relative', 'mb-1', 'min-h-8', 'before:absolute', 'before:-inset-y-1.5']) expect(marke, k).toContain(k)
    // 32 + 2 × 6 = 44 px Trefferfläche.
    expect(marke).not.toContain('min-h-11')
  })

  it('unten „Konto · <Name>“ als Link auf Konto und Sicherheit, daneben der Mond, „Abmelden“ darunter', () => {
    const leiste = seitenleiste()
    const konto = leiste.indexOf(`>${KONTO_KURZ} · Max Mustermann<`)
    expect(konto).toBeGreaterThan(-1)
    expect(leiste.slice(leiste.lastIndexOf('<a ', konto), konto)).toContain(`href="${EINSTELLUNG_KONTO.href}"`)
    // Vor dem Einhängen steht der Platzhalter des runden Schalters (44 px), danach der Knopf.
    const schalter = leiste.indexOf('inline-block size-11', konto)
    const abmelden = leiste.indexOf(`>${ABMELDEN_LABEL}</button>`)
    expect(schalter).toBeGreaterThan(konto)
    expect(abmelden).toBeGreaterThan(schalter)
    expect(leiste.indexOf('>Einstellungen<')).toBeLessThan(konto)
  })

  it('das Datum der Tarif-Zeile bricht nicht um', () => {
    expect(seitenleiste()).toContain('31. Jänner 2028')
  })
})

describe('HofShell: Blatt „Mehr“ (Board s1-mehr-neu)', () => {
  it('Postfach · Dein Tarif · Verkauf und Kunden · Konto und Hilfe, oben Titel und „Schließen“', () => {
    const { mehr } = blaetter(hof({ postfach: 1 }))
    const reihe = [`>Mehr<`, 'Schließen', `href="${POSTFACH_HREF}"`, `>${DEIN_TARIF_TITEL}<`, `>${VERKAUF_UND_KUNDEN_TITEL}<`, `>${KONTO_UND_HILFE_TITEL}<`]
    const stellen = reihe.map((m) => mehr.indexOf(m))
    for (const [i, stelle] of stellen.entries()) expect(stelle, reihe[i]).toBeGreaterThan(-1)
    expect([...stellen].sort((a, b) => a - b)).toEqual(stellen)
  })

  it('Postfach mit „1 neue Nachricht“ sichtbar und der Zahl für den Screenreader (nicht doppelt)', () => {
    const { mehr } = blaetter(hof({ postfach: 1 }))
    const zeile = abschnitt(mehr, `href="${POSTFACH_HREF}"`, '</a>')
    expect(zeile).toContain(`<span aria-hidden="true">${postfachUnterzeile(1)}</span>`)
    expect(zeile).toContain(`1 ${POSTFACH_TEXT.zaehler}`)
    // Gegenprobe: ohne Ungelesenes keine Unterzeile.
    expect(blaetter(hof({ postfach: 0 })).mehr).not.toContain('neue Nachricht')
  })

  it('Konto und Hilfe: Person zuerst, Admin nur für den Betreiber, dann Darstellung Hell/Dunkel und Abmelden', () => {
    const { mehr } = blaetter(hof())
    const gruppe = mehr.slice(mehr.indexOf(`aria-label="${KONTO_UND_HILFE_TITEL}"`))
    const reihe = ['Max Mustermann', '>Einstellungen<', '>Problem melden<', '>Admin<', `aria-label="${DARSTELLUNG_TEXT.titel}"`, `>${DARSTELLUNG_TEXT.hell}<`, `>${DARSTELLUNG_TEXT.dunkel}<`, `>${ABMELDEN_LABEL}<`]
    const stellen = reihe.map((m) => gruppe.indexOf(m))
    for (const [i, stelle] of stellen.entries()) expect(stelle, reihe[i]).toBeGreaterThan(-1)
    expect([...stellen].sort((a, b) => a - b)).toEqual(stellen)
    expect(blaetter(hof({ isAdmin: false })).mehr).not.toContain('>Admin<')
  })

  it('Zeilen ohne Symbol — nur der Pfeil am Ende (Gegenprobe: die Leiste darunter trägt Symbole)', () => {
    const html = hof({ postfach: 1 })
    const { mehr } = blaetter(html)
    const symbole = (mehr.match(/lucide-[a-z-]+/g) ?? []).filter((n) => n !== 'lucide-chevron-right' && n !== 'lucide' && !n.startsWith('lucide-sprout') && !n.startsWith('lucide-star'))
    expect(symbole).toEqual([])
    expect(abschnitt(html, 'data-slot="bottom-nav"', 'data-slot="sheet-blatt-inline"')).toContain('lucide-calendar-check')
  })
})

describe('HofShell: Blatt „Neu“ (Board s1-mehr-neu, Bild 3)', () => {
  it('Kopf „Was legst du an?“ mit „Abbrechen“ oben, darunter die Karten, „Oder etwas anderes“ sichtbar', () => {
    const { neu } = blaetter(hof())
    const titel = neu.indexOf(`>${HOF_NEU_TITEL}<`)
    const abbrechen = neu.indexOf(`>${HOF_NEU_ABBRECHEN}<`)
    const erste = neu.indexOf('>Lebensmittel<')
    const anderes = neu.indexOf(`>${HOF_NEU_ANDERES_TITEL}<`)
    expect(titel).toBeGreaterThan(-1)
    expect(abbrechen).toBeGreaterThan(titel)
    expect(erste).toBeGreaterThan(abbrechen)
    expect(anderes).toBeGreaterThan(erste)
    expect(neu.indexOf('>Verkauf eintragen<')).toBeGreaterThan(anderes)
  })

  it('Auswahlkarten 74 px hoch wie im Board (UI-Runde 4; vorher 60 px)', () => {
    const { neu } = blaetter(hof())
    const karte = neu.match(/<a [^>]*href="[^"]*"[^>]*>(?=<span class="min-w-0"><span[^>]*>Lebensmittel<)/)?.[0] ?? ''
    expect(karte).toContain('min-h-[74px]')
    expect(karte).not.toContain('min-h-[60px]')
  })
})

describe('Blätter „Mehr“ und „Neu“: Griff und Kopf stehen, der Inhalt scrollt darunter (Board s1-mehr-neu, Bild 2, UI-Runde 4)', () => {
  it('die HofShell gibt beiden Blättern den Kopf als `kopf`, nicht mehr als klebende Zeile im scrollenden Blatt', () => {
    const shell = quelle('src/components/shells/hof-shell.tsx')
    expect(shell).toContain('kopf={<SheetKopf titel={HOF_MEHR_TITEL} schliessen={HOF_MEHR_SCHLIESSEN} />}')
    expect(shell).toContain('kopf={<SheetKopf titel={HOF_NEU_TITEL} schliessen={HOF_NEU_ABBRECHEN} />}')
    expect(shell).not.toContain('BLATT_KOPF_KLEBT')
  })
})

describe('KundeShell: Kopf und Unterleiste (V10, V12, N41 c)', () => {
  function kunde(aktuell: string, stand: { anzahl: number; href: string } | null): string {
    pfad.aktuell = aktuell
    korb.stand = stand
    try {
      return renderToStaticMarkup(el(KundeShell, { sitzung: 'gast' }))
    } finally {
      korb.stand = null
    }
  }

  it('„Warenkorb · n“ im Browser-Kopf nur bei gefülltem Warenkorb', () => {
    const voll = abschnitt(kunde('/hoefe', { anzahl: 3, href: '/hof-beispiel' }), '<header', '</header>')
    expect(voll).toMatch(new RegExp(`<a href="/hof-beispiel"[^>]*>${warenkorbKopfText(3)}<span class="sr-only"> Artikel</span></a>`))
    const leer = abschnitt(kunde('/hoefe', null), '<header', '</header>')
    expect(leer).not.toContain(WARENKORB_WORT)
  })

  it('der Mittelknopf trägt das Wort „Warenkorb“; sein Name beginnt damit', () => {
    const leiste = abschnitt(kunde('/hoefe', { anzahl: 2, href: '/hof-beispiel' }), 'data-slot="bottom-nav"', '</nav>')
    expect(leiste).toContain(`>${WARENKORB_WORT}</span>`)
    expect(leiste).toContain(`aria-label="${warenkorbKopfText(2)} Artikel – öffnen"`)
    // Leer: der Ausweg zu den Höfen, das Wort bleibt.
    const leer = abschnitt(kunde('/hoefe', null), 'data-slot="bottom-nav"', '</nav>')
    expect(leer).toContain('aria-label="Warenkorb ist leer – Höfe entdecken"')
  })

  it('Startseite: Kopf ohne aktiven Punkt, in der Unterleiste „Entdecken“', () => {
    const html = kunde('/', null)
    expect(abschnitt(html, '<header', '</header>')).not.toContain('aria-current')
    expect(abschnitt(html, 'data-slot="bottom-nav"', '</nav>')).toMatch(/<a href="\/hoefe" aria-current="true"/)
    // Gegenprobe: auf /bestellungen gilt die Regel des Pfads.
    const [entdecken, bestellungen] = kundenNavigation({ sitzung: 'gast' }).handy.flatMap((p) => (p.art === 'punkt' ? [p.punkt] : []))
    expect(kundenHandyAriaAktuell('/bestellungen', entdecken)).toBeUndefined()
    expect(kundenHandyAriaAktuell('/bestellungen', bestellungen)).toBe('page')
    expect(kundenHandyAriaAktuell('/', bestellungen)).toBeUndefined()
  })

  it('die Links stehen gleich nach der Marke; aktiv grün, fett, unterstrichen', () => {
    const kopf = abschnitt(kunde('/hoefe', null), '<header', '</header>')
    const nav = abschnitt(kopf, '<nav aria-label="Hauptnavigation"', '>')
    expect(nav).toMatch(/\bflex-1\b/)
    const aktiv = kopf.match(/<a href="\/hoefe" aria-current="page" class="([^"]*)"/)?.[1] ?? ''
    for (const k of ['aria-[current]:text-brand-text', 'aria-[current]:font-bold', 'aria-[current]:underline']) expect(aktiv, k).toContain(k)
  })
})

describe('AdminShell (Boards s3-/w3-admin-shell)', () => {
  it('„n offen · m überfällig – ansehen“ als grüner Textlink ohne Warnsymbol', () => {
    pfad.aktuell = '/admin/hoefe'
    const html = renderToStaticMarkup(
      el(AdminShell, { personName: 'Max Mustermann', hatHof: false, aufgaben: { href: '/admin', text: '2 offen · 1 überfällig – ansehen', kurz: '2 offen – ansehen' } })
    )
    const link = abschnitt(html, '<a href="/admin" class="ml-auto', '</a>')
    expect(link).toContain('text-status-fertig')
    expect(link).toContain('underline')
    expect(link).not.toContain('lucide-triangle-alert')
  })

  it('Mehr-Blatt: Bereiche mit Unterzeile, ohne Symbole', () => {
    pfad.aktuell = '/admin'
    const html = renderToStaticMarkup(el(AdminShell, { personName: 'Max Mustermann', hatHof: true }))
    const mehr = html.slice(html.indexOf('data-slot="sheet-blatt-inline"'))
    expect(mehr).toContain(`>${ADMIN_MEHR_ZEILE.startseite}<`)
    expect(mehr).toContain('>Max Mustermann<')
    const symbole = (mehr.match(/lucide-[a-z-]+/g) ?? []).filter((n) => n !== 'lucide-chevron-right' && n !== 'lucide')
    expect(symbole).toEqual([])
  })
})

describe('Wörter und Helfer', () => {
  it('datumOhneUmbruch schützt Tag, Monat und Jahr — der Rest bleibt', () => {
    expect(datumOhneUmbruch('noch 11 Monate (bis 31. Jänner 2028)')).toBe('noch 11 Monate (bis 31. Jänner 2028)')
    expect(datumOhneUmbruch('bis 1. März 2027')).toBe('bis 1. März 2027')
    expect(datumOhneUmbruch('Startphase: kostenlos')).toBe('Startphase: kostenlos')
  })

  it('postfachUnterzeile: Einzahl und Mehrzahl', () => {
    expect(postfachUnterzeile(1)).toBe('1 neue Nachricht')
    expect(postfachUnterzeile(3)).toBe('3 neue Nachrichten')
  })
})
