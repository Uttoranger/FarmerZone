/**
 * Nr. 278 Runde 1 (Board s2-/w2-beitraege Bild 4, Liste Lauf 32 Z. 430): Die Vorschau zeigt einen
 * Beispielnamen statt der Marke „{Vorname}“, die Empfänger-Zeile zählt richtig (Einzahl/Mehrzahl).
 * Der abgeschickte Text bleibt der Text mit Platzhalter.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BEITRAG_ABLAUF_TEXT, beitragVorschauText } from '@/lib/beitrag-anlass'

describe('Vorschau „Neuer Beitrag“', () => {
  it('ersetzt {Vorname} durch den Beispielnamen, jedes Vorkommen', () => {
    expect(beitragVorschauText('Hallo {Vorname}! Bis bald, {Vorname}.')).toBe('Hallo Anna! Bis bald, Anna.')
    expect(beitragVorschauText('Ohne Anrede.')).toBe('Ohne Anrede.')
  })

  it('der Hinweis darunter nennt das Einsetzen', () => {
    expect(BEITRAG_ABLAUF_TEXT.vorschauNameHinweis).toBe('Name wird je Person eingesetzt.')
  })

  it('„1 E-Mail wird …“ in der Einzahl, „3 E-Mails werden …“ in der Mehrzahl', () => {
    expect(BEITRAG_ABLAUF_TEXT.mailZusammenfassung(1)).toBe('1 E-Mail wird automatisch versendet')
    expect(BEITRAG_ABLAUF_TEXT.mailZusammenfassung(3)).toBe('3 E-Mails werden automatisch versendet')
  })

  it('abgeschickt wird der Text mit Platzhalter, nie die Vorschau', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/app/(hof)/status/new/status-new-client.tsx'), 'utf8')
    const aufruf = quelle.slice(quelle.indexOf('publishStatusPost({'), quelle.indexOf('})', quelle.indexOf('publishStatusPost({')))
    expect(aufruf).toContain('body: body.trim()')
    expect(aufruf).not.toContain('beitragVorschauText')
    expect(quelle).not.toMatch(/E-Mails werden automatisch versendet/)
  })
})
