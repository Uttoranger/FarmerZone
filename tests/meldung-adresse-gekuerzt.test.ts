/**
 * Register N33 (Nachtlauf 34, Nr. 304a): Die Meldung im Briefkasten zeigt die
 * Adresse der Kundin nur gekürzt (`maskiereAdresse`, die EINE Stelle) — die
 * volle Adresse steht nirgends in der Ausgabe, auch nicht in einem Attribut.
 * Die Antwort an die Kundin geht über den Bescheid der App; dafür braucht
 * niemand die volle Adresse.
 */
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }))
vi.mock('sonner', () => ({ toast: { success: () => undefined, error: () => undefined } }))
vi.mock('@/server/actions/admin', () => ({
  triageMeldungAction: () => undefined,
  fasseZusammenAction: () => undefined,
  legeMeldungAbAction: () => undefined,
  trenneDuplikatAction: () => undefined,
}))

import type { AdminMeldungDetail } from '@/server/queries/meldung'

let briefkasten: typeof import('@/components/admin/briefkasten-teile')

beforeAll(async () => {
  briefkasten = await import('@/components/admin/briefkasten-teile')
}, 30_000)

const JETZT = new Date('2026-11-10T10:00:00Z')
const ADRESSE = 'kundin@example.com'

function meldung(abweichend: Partial<AdminMeldungDetail>): AdminMeldungDetail {
  return {
    id: 'meldung-abcdefgh',
    kurznummer: 'abcdefgh',
    art: 'FEHLER',
    status: 'NEU',
    text: 'Das Foto lädt nicht',
    createdAt: new Date('2026-11-10T08:00:00Z'),
    seiteUrl: '/hof/testhof',
    userAgent: 'Testbrowser',
    viewport: '390x800',
    customerEmail: ADRESSE,
    screenshotUrl: null,
    diagKennung: null,
    clusterKey: null,
    triageNotiz: null,
    duplikatVonId: null,
    sprintName: null,
    triagedAt: null,
    antwortAnMelder: null,
    farm: null,
    ...abweichend,
  } as AdminMeldungDetail
}

describe('Meldung im Briefkasten: Adresse der Kundin gekürzt (N33)', () => {
  it('zeigt „k•••@example.com“ und nirgends die volle Adresse', () => {
    const h = renderToStaticMarkup(createElement(briefkasten.MeldungEntscheidenSpalte, { m: meldung({}), jetzt: JETZT }))
    expect(h).toContain('Kundin · k•••@example.com')
    expect(h).not.toContain(ADRESSE)
    expect(h).not.toContain('kundin@')
  })

  it('Gegenprobe: ohne Adresse steht „Anonym“, mit Hof der Hofname', () => {
    const anonym = renderToStaticMarkup(createElement(briefkasten.MeldungEntscheidenSpalte, { m: meldung({ customerEmail: null }), jetzt: JETZT }))
    expect(anonym).toContain('Anonym')
    const hof = renderToStaticMarkup(
      createElement(briefkasten.MeldungEntscheidenSpalte, { m: meldung({ farm: { id: 'f1', name: 'Testhof Eins', slug: 'testhof-eins' } }), jetzt: JETZT }),
    )
    expect(hof).toContain('Testhof Eins')
    expect(hof).not.toContain(ADRESSE)
  })
})
