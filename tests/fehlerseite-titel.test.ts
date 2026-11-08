/**
 * 500-Seite mit Seitentitel (Nr. 266, Lauf 33; axe „document-title“).
 *
 * Ursache: Die Fehlergrenzen (src/app/error.tsx, src/app/global-error.tsx) sind Client-Komponenten — `metadata`
 * gibt es dort nicht, und die Ansicht trug keinen `<title>`. Die Seite stand ohne Titel im Tab und im Verlauf.
 *
 * Beweist (renderToStaticMarkup, Umgebung node):
 *  - Die gerenderte Ansicht von error.tsx enthält genau einen `<title>` mit „Fehler — <Marke>“.
 *  - global-error ebenso: genau ein `<title>`, auch mit eigenem `<html>`.
 *  - Der Text kommt aus EINER Konstante neben FehlerAnsicht, die Marke aus src/lib/marke.ts.
 */
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
// Die Shell lädt error.tsx erst im Browser nach (next/dynamic) — hier steht sie als Rahmen um die Ansicht.
vi.mock('next/dynamic', () => ({ default: () => ({ children }: { children?: ReactNode }) => createElement('div', { 'data-shell': '' }, children) }))

import ErrorPage from '@/app/error'
import GlobalError from '@/app/global-error'
import { FEHLER_SEITENTITEL } from '@/components/shared/fehler-ansicht'
import { MARKE } from '@/lib/marke'

const FEHLER = Object.assign(new Error('Kaputt'), { digest: 'ab12cd' })

function titel(html: string): string[] {
  return [...html.matchAll(/<title>([^<]*)<\/title>/g)].map((t) => t[1] ?? '')
}

describe('Seitentitel der 500', () => {
  it('der Text: „Fehler — <Marke>“', () => {
    expect(FEHLER_SEITENTITEL).toBe(`Fehler — ${MARKE}`)
  })

  it('error.tsx: genau ein <title> mit „Fehler — <Marke>“', () => {
    const html = renderToStaticMarkup(createElement(ErrorPage, { error: FEHLER, reset: () => {} }))
    expect(titel(html)).toEqual([`Fehler — ${MARKE}`])
  })

  it('global-error.tsx: genau ein <title> mit „Fehler — <Marke>“, auch mit eigenem <html>', () => {
    const html = renderToStaticMarkup(createElement(GlobalError, { error: FEHLER, reset: () => {} }))
    expect(html).toContain('<html lang="de">')
    expect(titel(html)).toEqual([`Fehler — ${MARKE}`])
  })
})
