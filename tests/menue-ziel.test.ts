/**
 * Das Menü der Shells hängt in einer Landmarke (Nr. 132, Axe „region", Nacharbeit 126).
 *
 * Base UI hängt den Inhalt eines DropdownMenu per Portal an den <body> — außerhalb jeder Landmarke.
 * Seit Nr. 132 nimmt `DropdownMenuContent` einen Zielort (`container`); AdminShell und HofShell
 * geben ein Element in ihrem Kopf bzw. ihrer Seitenleiste mit. Offen ist ein Menü nur im Browser —
 * dort prüft Axe (Bericht 132); hier steht die Verdrahtung.
 *
 * Seit Nr. 140 (Regelvorschlag 132, freigegeben 21.10.2026) kommt der Zielort auch aus einem Kontext
 * (`MenueZielAnbieter` in src/components/ui/menue-ziel.tsx): Die Menüs im Inhalt (Hofliste, Meldungen) kommen an das
 * Ref der Shell nicht heran. `DropdownMenuContent` nimmt den Zielort aus dem Kontext, wenn kein `container` übergeben
 * ist; ohne Anbieter oder unter `ziel={null}` (Dialog, Blatt) bleibt es beim <body>.
 *
 * Beweist:
 *  - Das Konto-Menü der AdminShell bekommt einen Zielort, und das Ziel steht im <header>.
 *  - Das Menü „Neu" der HofShell bekommt einen Zielort, und das Ziel steht in der <aside>
 *    „Hofbereich", nicht im scrollenden Kasten darin (dessen overflow schnitte ab).
 *  - Ohne Angabe bleibt alles wie vorher (kein Zielort = <body>). Gegenprobe: Die Suche nach dem Ziel
 *    schlägt an, wenn es außerhalb der Landmarke steht.
 *  - Ein Menü ohne `container` im Inhalt der AdminShell bekommt das Ziel im <header> (dasselbe Ref wie das Konto-Menü);
 *    dasselbe Menü ohne Anbieter, unter `ziel={null}` und in der HofShell (Inhalt ist nicht unter dem Anbieter)
 *    bekommt keines; ein übergebener `container` gilt vor dem Kontext.
 *  - Quelltext: Der Anbieter der HofShell umschließt die Seitenleiste und nicht <main>, der der AdminShell Kopf und
 *    Inhalt. Jede Datei unter src/ mit `<DropdownMenuContent` steht in `MENUE_DATEIEN` mit der Shell, unter der sie
 *    rendert, oder mit Grund; eine neue Datei ohne Eintrag schlägt an.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { createElement, createRef, type ComponentType, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

/** Der `container`, den ein Menü selbst übergibt (Eigenschaft von DropdownMenuContent). */
const ziele = vi.hoisted(() => [] as unknown[])
/** Der `container`, mit dem das Portal am Ende entsteht — nach dem Kontext. */
const portalZiele = vi.hoisted(() => [] as unknown[])

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard', useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ signOut: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
// Das Portal von Base UI, nur umhüllt: festgehalten wird, was nach dem Kontext als `container` ankommt.
vi.mock('@base-ui/react/menu', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@base-ui/react/menu')>()
  return {
    ...echt,
    Menu: {
      ...echt.Menu,
      Portal: (props: Parameters<typeof echt.Menu.Portal>[0]) => {
        portalZiele.push(props.container)
        return createElement(echt.Menu.Portal, props)
      },
    },
  }
})
// Der echte Inhalt, nur umhüllt: festgehalten wird der Zielort, den die Shell mitgibt.
vi.mock('@/components/ui/dropdown-menu', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/components/ui/dropdown-menu')>()
  return {
    ...echt,
    DropdownMenuContent: (props: Parameters<typeof echt.DropdownMenuContent>[0]) => {
      ziele.push(props.container)
      return createElement(echt.DropdownMenuContent, props)
    },
  }
})

import { AdminShell } from '@/components/shells/admin-shell'
import { HofShell } from '@/components/shells/hof-shell'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MenueZielAnbieter } from '@/components/ui/menue-ziel'

function rendere(typ: unknown, props: Record<string, unknown>, inhalt: ReactNode = 'Inhalt'): string {
  ziele.length = 0
  portalZiele.length = 0
  return renderToStaticMarkup(createElement(typ as ComponentType<Record<string, unknown>>, props, inhalt))
}

/** Ein Menü im Inhalt einer Seite, wie das der Hofliste: ohne eigenen `container`. */
function menueImInhalt(container?: unknown): ReactNode {
  return createElement(
    DropdownMenu,
    null,
    createElement(DropdownMenuTrigger, null, 'Mehr'),
    createElement(DropdownMenuContent, container === undefined ? null : { container: container as never }, createElement(DropdownMenuItem, null, 'Punkt')),
  )
}

const ADMIN = { personName: 'Max Mustermann', hatHof: true }
const HOF = { hofName: 'Testhof A', hofSlug: 'testhof-a', personName: 'Max Mustermann', isAdmin: false }

/** Der Abschnitt vom öffnenden Tag bis zu seinem schließenden — für header und aside, die nicht verschachtelt vorkommen. */
function abschnitt(html: string, tag: string): string {
  const anfang = html.indexOf(`<${tag}`)
  return anfang < 0 ? '' : html.slice(anfang, html.indexOf(`</${tag}>`, anfang))
}

const ZIEL = 'data-menue-ziel=""'
const istRef = (wert: unknown) => typeof wert === 'object' && wert !== null && 'current' in wert

describe('Menüs der Shells hängen in einer Landmarke', () => {
  it('AdminShell: das Konto-Menü bekommt einen Zielort, das Ziel steht im header', () => {
    const html = rendere(AdminShell, { personName: 'Max Mustermann', hatHof: true })

    expect(ziele).toHaveLength(1)
    expect(istRef(ziele[0])).toBe(true)
    expect(abschnitt(html, 'header')).toContain(ZIEL)
    expect(html.split(ZIEL)).toHaveLength(2)
    // Nicht in der Reiterzeile: Die scrollt (overflow-x-auto) und schnitte das Menü ab.
    expect(abschnitt(html, 'nav')).not.toContain(ZIEL)
  })

  it('HofShell: das Menü „Neu" bekommt einen Zielort, das Ziel steht in der Seitenleiste, nicht im scrollenden Kasten', () => {
    const html = rendere(HofShell, { hofName: 'Testhof A', hofSlug: 'testhof-a', personName: 'Max Mustermann', isAdmin: false })

    expect(ziele).toHaveLength(1)
    expect(istRef(ziele[0])).toBe(true)
    const seitenleiste = abschnitt(html, 'aside')
    expect(seitenleiste).toContain('aria-label="Hofbereich"')
    expect(seitenleiste).toContain(ZIEL)
    // Das Ziel folgt erst auf den letzten schließenden Kasten der Leiste — also nicht im overflow-Kasten.
    expect(seitenleiste.trimEnd().endsWith(`<div ${ZIEL}></div>`)).toBe(true)
  })

  it('Gegenprobe: ein Ziel außerhalb der Landmarke wird nicht gefunden', () => {
    const html = `<header class="x"><div></div></header><div ${ZIEL}></div>`
    expect(abschnitt(html, 'header')).not.toContain(ZIEL)
    expect(istRef(undefined)).toBe(false)
  })
})

describe('Menüs im Inhalt nehmen den Zielort aus dem Kontext (Nr. 140)', () => {
  it('AdminShell: ein Menü ohne container im Inhalt bekommt das Ziel im header — dasselbe Ref wie das Konto-Menü', () => {
    const html = rendere(AdminShell, ADMIN, menueImInhalt())

    // Das Konto-Menü gibt sein Ref von Hand mit, das Menü im Inhalt nicht.
    expect(ziele).toHaveLength(2)
    expect(istRef(ziele[0])).toBe(true)
    expect(ziele[1]).toBeUndefined()
    // Am Portal kommt bei beiden das Ref der Shell an, und dessen Ziel steht im header.
    expect(portalZiele).toHaveLength(2)
    expect(istRef(portalZiele[1])).toBe(true)
    expect(portalZiele[1]).toBe(ziele[0])
    expect(abschnitt(html, 'header')).toContain(ZIEL)
  })

  it('Gegenprobe: dasselbe Menü ohne Anbieter bekommt kein Ziel (der body)', () => {
    rendere('div', {}, menueImInhalt())
    expect(portalZiele).toEqual([undefined])
  })

  it('unter ziel={null} (Dialog, Blatt) bleibt das Menü am body, auch mitten in der AdminShell', () => {
    rendere(AdminShell, ADMIN, createElement(MenueZielAnbieter, { ziel: null }, menueImInhalt()))
    expect(portalZiele).toHaveLength(2)
    expect(istRef(portalZiele[0])).toBe(true)
    expect(portalZiele[1]).toBeUndefined()
  })

  it('ein übergebener container gilt vor dem Kontext', () => {
    const eigenes = createRef<HTMLElement>()
    rendere(AdminShell, ADMIN, menueImInhalt(eigenes))
    expect(portalZiele[1]).toBe(eigenes)
    expect(portalZiele[1]).not.toBe(portalZiele[0])
  })

  it('HofShell: der Anbieter gilt nur für die Seitenleiste — ein Menü im Inhalt (main) bekommt kein Ziel', () => {
    rendere(HofShell, HOF, menueImInhalt())
    // Das Menü „Neu“ der Seitenleiste hat sein Ref, das im Inhalt keines: Ein Ziel in der Leiste, die unter md versteckt ist,
    // ließe ein Menü im Inhalt unsichtbar hängen.
    expect(portalZiele).toHaveLength(2)
    expect(istRef(portalZiele[0])).toBe(true)
    expect(portalZiele[1]).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// Quelltext: wo der Anbieter steht, und welche Dateien ein Menü haben.
// ---------------------------------------------------------------------------------------------------------------------

function quelldatei(text: string, name: string): ts.SourceFile {
  return ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function tagName(knoten: ts.JsxOpeningLikeElement): string {
  return knoten.tagName.getText()
}

/** Die Tags innerhalb des ersten `<MenueZielAnbieter>` einer Datei (nur Elemente, keine Komponenten ohne Tag). */
function tagsImAnbieter(text: string): string[] | null {
  let tags: string[] | null = null
  const besuche = (k: ts.Node): void => {
    if (tags === null && ts.isJsxElement(k) && tagName(k.openingElement) === 'MenueZielAnbieter') {
      tags = []
      const innen = (n: ts.Node): void => {
        if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) tags?.push(tagName(n))
        ts.forEachChild(n, innen)
      }
      k.children.forEach(innen)
      return
    }
    ts.forEachChild(k, besuche)
  }
  besuche(quelldatei(text, 'datei.tsx'))
  return tags
}

describe('Quelltext: der Anbieter der Shells', () => {
  const lies = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')

  it('HofShell: der Anbieter umschließt die Seitenleiste (aside), nicht den Inhalt (main)', () => {
    const tags = tagsImAnbieter(lies('src/components/shells/hof-shell.tsx'))
    expect(tags).not.toBeNull()
    expect(tags).toContain('aside')
    expect(tags).not.toContain('main')
  })

  it('AdminShell: der Anbieter umschließt Kopf (header) und Inhalt (main)', () => {
    const tags = tagsImAnbieter(lies('src/components/shells/admin-shell.tsx'))
    expect(tags).not.toBeNull()
    expect(tags).toContain('header')
    expect(tags).toContain('main')
  })

  it('Gegenprobe: ohne Anbieter, mit Anbieter um den falschen Teil und mit einem Anbieter in einem Kommentar', () => {
    expect(tagsImAnbieter('const a = <div><main /></div>')).toBeNull()
    expect(tagsImAnbieter('// <MenueZielAnbieter ziel={x}><main /></MenueZielAnbieter>\nconst a = <div><main /></div>')).toBeNull()
    expect(tagsImAnbieter('const a = <div><MenueZielAnbieter ziel={x}><aside /></MenueZielAnbieter><main /></div>')).toEqual(['aside'])
  })
})

/**
 * Datei → die Shell, unter der ihr Menü rendert (`unter`), oder der Grund, warum es keinen Anbieter hat (`grund`).
 * `AdminShell`: admin-konto.tsx im Kopf, hoefe-ansicht.tsx (/admin) und meldungen-werkzeug.tsx (/admin/postfach)
 * im Inhalt — src/app/admin/layout.tsx stellt die Seiten in die AdminShell. `HofShell`: das Menü „Neu“ in der Seitenleiste.
 */
const MENUE_DATEIEN: Record<string, { unter: 'AdminShell' | 'HofShell' } | { grund: string }> = {
  'src/components/admin/hoefe-ansicht.tsx': { unter: 'AdminShell' },
  'src/components/admin/meldungen-werkzeug.tsx': { unter: 'AdminShell' },
  'src/components/shells/admin-konto.tsx': { unter: 'AdminShell' },
  'src/components/shells/hof-shell.tsx': { unter: 'HofShell' },
  'src/components/farmer/farmer-nav.tsx': { grund: 'Gruppe (farmer), Befund im Bericht' },
}

/** Hat die Datei ein `<DropdownMenuContent` als Element (Kommentare und Zeichenketten zählen nicht)? */
function hatMenue(text: string, name: string): boolean {
  if (!text.includes('DropdownMenuContent')) return false
  let gefunden = false
  const besuche = (k: ts.Node): void => {
    if ((ts.isJsxOpeningElement(k) || ts.isJsxSelfClosingElement(k)) && tagName(k) === 'DropdownMenuContent') gefunden = true
    ts.forEachChild(k, besuche)
  }
  besuche(quelldatei(text, name))
  return gefunden
}

function menueProbleme(dateien: string[], liste: typeof MENUE_DATEIEN): string[] {
  const probleme = dateien.filter((d) => liste[d] === undefined).map((d) => `${d} hat ein <DropdownMenuContent> und steht nicht in MENUE_DATEIEN`)
  for (const [datei, eintrag] of Object.entries(liste)) {
    if (!dateien.includes(datei)) probleme.push(`${datei} steht in MENUE_DATEIEN und hat kein <DropdownMenuContent> mehr`)
    if ('grund' in eintrag && eintrag.grund.trim() === '') probleme.push(`${datei} steht ohne Grund in MENUE_DATEIEN`)
  }
  return probleme
}

function quelldateien(ordner: string): string[] {
  const funde: string[] = []
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) funde.push(...quelldateien(pfad))
    else if (/\.tsx$/.test(name)) funde.push(pfad)
  }
  return funde
}

describe('Quelltext: jede Datei mit einem Menü steht in der Liste', () => {
  it('jede Datei unter src/ mit <DropdownMenuContent steht in MENUE_DATEIEN, mit ihrer Shell oder mit Grund', () => {
    // Liest und parst jede .tsx-Datei unter src/ (TESTING_GUIDELINES §4: Zeitgrenze 30_000 an genau diesem it).
    const dateien = quelldateien(join(process.cwd(), 'src'))
      .map((pfad) => ({ name: relative(process.cwd(), pfad).split(sep).join('/'), pfad }))
      .filter(({ name, pfad }) => name !== 'src/components/ui/dropdown-menu.tsx' && hatMenue(readFileSync(pfad, 'utf8'), name))
      .map(({ name }) => name)
    // Nicht blind: Die Wache sah die fünf Dateien.
    expect(dateien.length).toBeGreaterThanOrEqual(5)
    expect(menueProbleme(dateien, MENUE_DATEIEN)).toEqual([])
  }, 30_000)

  it('die Seiten unter /admin stehen in der AdminShell (src/app/admin/layout.tsx)', () => {
    expect(readFileSync(join(process.cwd(), 'src/app/admin/layout.tsx'), 'utf8')).toMatch(/<AdminShell\b/)
  })

  it('Gegenprobe: eine neue Datei mit <DropdownMenuContent ohne Eintrag schlägt an, ein Kommentar nicht', () => {
    expect(hatMenue('export const a = <DropdownMenuContent className="w-72"><x /></DropdownMenuContent>', 'src/neu.tsx')).toBe(true)
    expect(hatMenue('export const a = <DropdownMenuContent />', 'src/neu.tsx')).toBe(true)
    expect(hatMenue('// <DropdownMenuContent> kommt später\nexport const a = 1', 'src/neu.tsx')).toBe(false)
    expect(hatMenue("export const a = '<DropdownMenuContent'", 'src/neu.tsx')).toBe(false)
    expect(menueProbleme(['src/neu.tsx'], MENUE_DATEIEN).filter((p) => p.startsWith('src/neu.tsx'))).toEqual([
      'src/neu.tsx hat ein <DropdownMenuContent> und steht nicht in MENUE_DATEIEN',
    ])
    expect(menueProbleme(Object.keys(MENUE_DATEIEN), { ...MENUE_DATEIEN, 'src/alt.tsx': { grund: 'x' } })).toEqual(['src/alt.tsx steht in MENUE_DATEIEN und hat kein <DropdownMenuContent> mehr'])
    expect(menueProbleme(Object.keys(MENUE_DATEIEN), { ...MENUE_DATEIEN, 'src/farmer.tsx': { grund: ' ' } }).filter((p) => p.includes('farmer.tsx'))).toContain('src/farmer.tsx steht ohne Grund in MENUE_DATEIEN')
  })
})
