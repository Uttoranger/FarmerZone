/**
 * Die AGB als Datei im Anhang (Nr. 207, Auftrag Punkt 1) — src/lib/rechtstexte/agb-datei.ts.
 *
 * Beweist:
 *  - der Inhalt ist derselbe Text wie agb.ts: jeder Titel, jede Nummer und jedes
 *    Textstück von Teil A bis D und vom Anhang steht (HTML-maskiert) in der Datei,
 *    in derselben Reihenfolge;
 *  - ohne die Prüfhinweise aus docs/recht/agb.md und ohne „Kurz erklärt“
 *    (Gegenprobe: beide stehen in der Quelle bzw. in agb.ts);
 *  - höchstens 300 kB; Links absolut auf die echte Seite; Platzhalter gefüllt;
 *  - Dateiname agb-<marke>-<fassung>.html mit der Kennung aus AGB_STAND_VERMERK;
 *  - agbFassung liest die Kennung, ohne Kennung wirft sie (Gegenprobe).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { AGB_ANHANG, AGB_KURZ_ERKLAERT, AGB_STAND_VERMERK, AGB_TEILE, type AgbBlock } from '@/lib/rechtstexte/agb'
import { PLATZHALTER_ANGABE, type AgbStueck } from '@/lib/rechtstexte/stuecke'
import { AGB_DATEI_MAX_BYTES, agbAlsHtml, agbDateiname, agbFassung } from '@/lib/rechtstexte/agb-datei'
import { MARKE } from '@/lib/marke'
import { PRODUKTION_ADRESSE } from '@/lib/umgebung'

const maskiere = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Alle Klartexte eines Blocks in Lesereihenfolge (Platzhalter aufgelöst). */
function texteVon(stuecke: readonly AgbStueck[]): string[] {
  return stuecke.flatMap((s): string[] => {
    if (typeof s === 'string') return [s]
    switch (s.art) {
      case 'fett':
        return texteVon(s.stuecke)
      case 'kursiv':
        return [s.text]
      case 'link':
        return [s.text]
      case 'mail':
        return [s.adresse]
      case 'platzhalter':
        return texteVon(PLATZHALTER_ANGABE[s.was])
    }
  })
}

function blockTexte(b: AgbBlock): string[] {
  switch (b.art) {
    case 'absatz':
      return [...(b.nummer ? [b.nummer] : []), ...texteVon(b.stuecke)]
    case 'liste':
      return b.eintraege.flatMap(texteVon)
    case 'tabelle':
      return [...b.kopf, ...b.zeilen.flat()]
    case 'zeilen':
      return b.zeilen.flatMap(texteVon)
  }
}

const ALLE_TEXTE = [
  ...AGB_TEILE.flatMap((t) => [t.titel, ...t.punkte.flatMap((p) => [p.titel, ...p.bloecke.flatMap(blockTexte)])]),
  AGB_ANHANG.titel,
  ...AGB_ANHANG.bloecke.flatMap(blockTexte),
].filter((t) => t.trim() !== '')

describe('agbAlsHtml — derselbe Text wie agb.ts', () => {
  const html = agbAlsHtml()

  it('jedes Textstück von Teil A bis D und vom Anhang steht in der Datei, in derselben Reihenfolge', () => {
    let ab = 0
    for (const t of ALLE_TEXTE) {
      const stelle = html.indexOf(maskiere(t), ab)
      expect(stelle, `fehlt oder falsche Reihenfolge: ${t.slice(0, 60)}`).toBeGreaterThanOrEqual(0)
      ab = stelle
    }
    expect(html).toContain(maskiere(AGB_STAND_VERMERK))
    expect(ALLE_TEXTE.length).toBeGreaterThan(200)
  })

  it('ohne die Hinweise für die anwaltliche Prüfung und ohne „Kurz erklärt“ — Gegenprobe: beide gibt es in der Quelle', () => {
    const quelle = readFileSync('docs/recht/agb.md', 'utf8')
    expect(quelle).toMatch(/Hinweise für die anwaltliche Prüfung/)
    expect(html).not.toMatch(/anwaltliche Prüfung/)
    expect(AGB_KURZ_ERKLAERT.titel).toBe('Kurz erklärt')
    expect(html).not.toContain(AGB_KURZ_ERKLAERT.titel)
  })

  it('höchstens 300 kB, eigenständiges HTML in UTF-8, Links absolut auf die echte Seite', () => {
    expect(Buffer.byteLength(html, 'utf8')).toBeLessThanOrEqual(AGB_DATEI_MAX_BYTES)
    expect(AGB_DATEI_MAX_BYTES).toBe(300 * 1024)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<meta charset="utf-8">')
    expect(html).toContain(`href="${PRODUKTION_ADRESSE}/impressum"`)
    expect(html).not.toMatch(/href="\//)
    // Keine Farbe in der Datei — schwarz auf weiß in jedem Programm.
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(|color:/i)
  })
})

describe('Fassung und Dateiname', () => {
  it('die Kennung kommt aus AGB_STAND_VERMERK — heute „0.9“ (festgehalten, bis die Projektleitung 1.0 freigibt)', () => {
    expect(AGB_STAND_VERMERK).toMatch(/^Fassung 0\.9 /)
    expect(agbFassung()).toBe('0.9')
    expect(agbFassung('Fassung 1.0, Stand 1. Dezember 2026')).toBe('1.0')
  })

  it('Gegenprobe: ein Vermerk ohne Kennung wirft — keine Zustimmung zu „irgendeiner“ Fassung', () => {
    expect(() => agbFassung('Entwurf ohne Nummer')).toThrow()
  })

  it('Dateiname agb-<marke>-<fassung>.html', () => {
    expect(agbDateiname()).toBe(`agb-${MARKE.toLowerCase()}-0.9.html`)
    expect(agbDateiname('1.0')).toBe(`agb-${MARKE.toLowerCase()}-1.0.html`)
  })
})
