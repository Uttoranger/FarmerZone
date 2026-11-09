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
 *  - Seit Nr. 279 (Antwort der Projektleitung, 9.11.2026, Punkt 4): außerhalb der Produktion mit „[TEST] “ davor —
 *    derselbe Vorsatz wie die Titel-Vorlage des Wurzel-Layouts, aus EINER Quelle (src/lib/titel-vorsatz.ts). Der
 *    Server rendert ohne ihn (kein Browser); im Browser liest die Ansicht ihn von <html> (tests/hydrieren.test.ts).
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
import { TEST_VORSATZ, TITEL_VORSATZ_ATTRIBUT, titelVorsatz, vorsatzAusAttribut } from '@/lib/titel-vorsatz'
import { readFileSync } from 'node:fs'

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

describe('Vorsatz „[TEST]“ auf dem Titel der 500 (Nr. 279)', () => {
  it('eine Quelle: „[TEST] “ außerhalb der Produktion, in der Produktion nichts', () => {
    expect(TEST_VORSATZ).toBe('[TEST] ')
    expect(titelVorsatz(true)).toBe('[TEST] ')
    expect(titelVorsatz(false)).toBe('')
  })

  it('das Wurzel-Layout nimmt dieselbe Quelle für die Titel-Vorlage und legt den Vorsatz an <html> ab', () => {
    const layout = readFileSync('src/app/layout.tsx', 'utf8')
    expect(layout).toContain('titelVorsatz(ZEIGE_UMGEBUNGSBANNER)')
    expect(layout).toContain('[TITEL_VORSATZ_ATTRIBUT]: TITEL_PRAEFIX')
    // Keine zweite Quelle: Der Wortlaut steht nur in src/lib/titel-vorsatz.ts.
    expect(layout).not.toContain("'[TEST] '")
    expect(readFileSync('src/components/shared/fehler-ansicht.tsx', 'utf8')).not.toContain('[TEST]')
  })

  it('nur der bekannte Wert zählt — das Attribut schreibt keinen beliebigen Text in den Titel', () => {
    expect(vorsatzAusAttribut(TEST_VORSATZ)).toBe(TEST_VORSATZ)
    expect(vorsatzAusAttribut(null)).toBe('')
    expect(vorsatzAusAttribut('[ECHT] ')).toBe('')
    expect(TITEL_VORSATZ_ATTRIBUT).toBe('data-titel-vorsatz')
  })
})
