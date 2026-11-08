import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

/**
 * scripts/pruefung/messung.js (Nr. 262, Regelvorschlag 5): h1 hinter einem
 * offenen aria-modal-Element zählt als „Dialog offen“ (Register N48), Inhalte
 * geschlossener <details> zählen nicht — mit checkVisibility und ohne
 * (Rückfall über das nächste <details> ohne open).
 *
 * Eine Attrappe statt eines Browsers: ein kleiner Baum aus Objekten mit genau
 * den Methoden, die die Messung für h1 und Dialoge ruft. Text-, Ziel- und
 * Feldprüfung bekommen leere Listen (geprüft im echten Browser, Bilder 6.7).
 */

const SKRIPT = readFileSync(join(process.cwd(), 'scripts', 'pruefung', 'messung.js'), 'utf8')

type Knoten = {
  tagName: string
  attribute: Record<string, string>
  breite: number
  stil?: Partial<{ display: string; visibility: string; opacity: string }>
  kinder: Knoten[]
  eltern: Knoten | null
  /** undefined = der Browser kennt checkVisibility nicht (Rückfall). */
  checkVisibility?: () => boolean
}

function knoten(tagName: string, attribute: Record<string, string> = {}, kinder: Knoten[] = [], breite = 200): Knoten {
  const k: Knoten = { tagName: tagName.toUpperCase(), attribute, breite, kinder, eltern: null }
  for (const kind of kinder) kind.eltern = k
  return k
}

/** Einfache Selektoren, wie messung.js sie benutzt: tag, [attr], [attr="wert"], tag:not([attr]), durch Komma getrennt. */
function passt(k: Knoten, selektor: string): boolean {
  return selektor.split(',').some((teil) => {
    const t = teil.trim()
    const nicht = /^(\w+):not\(\[(\w[\w-]*)\]\)$/.exec(t)
    if (nicht) return k.tagName === nicht[1]!.toUpperCase() && !(nicht[2]! in k.attribute)
    const attr = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(t)
    if (attr) return attr[2] === undefined ? attr[1]! in k.attribute : k.attribute[attr[1]!] === attr[2]
    return /^\w+$/.test(t) && k.tagName === t.toUpperCase()
  })
}

function alsElement(k: Knoten): Record<string, unknown> {
  const el: Record<string, unknown> = {
    tagName: k.tagName,
    className: k.attribute['class'] ?? '',
    getAttribute: (n: string) => k.attribute[n] ?? null,
    getBoundingClientRect: () => ({ width: k.breite, height: k.breite ? 40 : 0 }),
    closest: (s: string) => {
      for (let x: Knoten | null = k; x; x = x.eltern) if (passt(x, s)) return alsElement(x)
      return null
    },
    querySelectorAll: () => [],
    innerText: '',
    textContent: '',
    _k: k,
  }
  if (k.checkVisibility) el['checkVisibility'] = k.checkVisibility
  return el
}

function alle(k: Knoten): Knoten[] {
  return [k, ...k.kinder.flatMap(alle)]
}

function miss(body: Knoten): { h1: number | string } {
  const elemente = alle(body)
  const document = {
    body: alsElement(body),
    documentElement: { classList: { contains: () => false } },
    createTreeWalker: () => ({ nextNode: () => false, currentNode: null }),
    querySelectorAll: (s: string) => (s === 'h1' || s === '[aria-modal="true"]' ? elemente.filter((k) => passt(k, s)).map(alsElement) : []),
    querySelector: () => null,
    getElementById: () => null,
  }
  const getComputedStyle = (el: { _k: Knoten }) => ({ display: 'block', visibility: 'visible', opacity: '1', clip: 'auto', clipPath: 'none', fontSize: '16px', ...el._k.stil })
  const kontext = {
    document,
    getComputedStyle,
    location: { pathname: '/attrappe' },
    innerWidth: 390,
    matchMedia: () => ({ matches: false }),
    NodeFilter: { SHOW_TEXT: 4 },
    CSS: { escape: (s: string) => s },
  }
  return JSON.parse(runInNewContext(SKRIPT, kontext) as string) as { h1: number | string }
}

describe('messung.js – h1', () => {
  it('zählt die sichtbare h1 einer Seite', () => {
    expect(miss(knoten('body', {}, [knoten('main', {}, [knoten('h1')])])).h1).toBe(1)
  })

  it('meldet „Dialog offen“, solange ein sichtbares aria-modal-Element offen ist', () => {
    const body = knoten('body', {}, [knoten('main', {}, [knoten('h1')]), knoten('div', { role: 'dialog', 'aria-modal': 'true' }, [knoten('h2')])])
    expect(miss(body).h1).toBe('Dialog offen')
  })

  it('ein geschlossener (unsichtbarer) Dialog ändert nichts', () => {
    const dialog = knoten('div', { role: 'dialog', 'aria-modal': 'true' }, [], 200)
    dialog.stil = { display: 'none' }
    expect(miss(knoten('body', {}, [knoten('h1'), dialog])).h1).toBe(1)
  })

  it('zwei h1, eine davon im geschlossenen <details> (Rückfall ohne checkVisibility): 1', () => {
    const body = knoten('body', {}, [knoten('h1'), knoten('details', {}, [knoten('summary'), knoten('h1')])])
    expect(miss(body).h1).toBe(1)
  })

  it('im offenen <details> zählt sie mit', () => {
    const body = knoten('body', {}, [knoten('h1'), knoten('details', { open: '' }, [knoten('summary'), knoten('h1')])])
    expect(miss(body).h1).toBe(2)
  })

  it('mit checkVisibility entscheidet der Browser (geschlossen → false)', () => {
    const versteckt = knoten('h1')
    versteckt.checkVisibility = () => false
    const sichtbar = knoten('h1')
    sichtbar.checkVisibility = () => true
    expect(miss(knoten('body', {}, [sichtbar, knoten('details', {}, [versteckt])])).h1).toBe(1)
  })
})
