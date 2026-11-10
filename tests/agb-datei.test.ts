/**
 * Die AGB als Datei im Anhang (Nr. 207, Auftrag Punkt 1; N45 je Fassung) —
 * src/lib/rechtstexte/agb-datei.ts.
 *
 * Beweist (je Fassung 0.9 und 1.0):
 *  - der Inhalt ist derselbe Text wie die Daten der Fassung: jeder Titel, jede
 *    Nummer und jedes Textstück von Teil A bis D und von den Anhängen steht
 *    (HTML-maskiert) in der Datei, in derselben Reihenfolge; Anhang 1/2 von 1.0
 *    enthalten Sätze aus BELEHRUNG (src/lib/widerruf.ts);
 *  - ohne die Prüfhinweise und ohne „Kurz erklärt“;
 *  - je Fassung höchstens 300 kB; Links absolut auf die echte Seite;
 *  - Dateiname agb-<marke>-<Kennung>.html;
 *  - Vermerk 1.0 mit dem Datum des Stichtags; ohne geladenen Stichtag der
 *    Ersatzwert, und nirgends „dem dem“ (Gegenprobe: mit Datum kein Ersatzwert).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { AGB_TEXTE } from '@/lib/rechtstexte/agb-texte'
import { AGB_FASSUNGEN } from '@/lib/rechtstexte/agb-fassung'
import type { AgbBlock } from '@/lib/rechtstexte/agb-bloecke'
import { INKRAFTTRETEN_ERSATZ, PLATZHALTER_ANGABE, type AgbKontext, type AgbStueck } from '@/lib/rechtstexte/stuecke'
import { AGB_DATEI_MAX_BYTES, agbAlsHtml, agbDateiname } from '@/lib/rechtstexte/agb-datei'
import { BELEHRUNG } from '@/lib/widerruf'
import { formatDatumLang } from '@/lib/format'
import { MARKE } from '@/lib/marke'
import { PRODUKTION_ADRESSE } from '@/lib/umgebung'

const maskiere = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const STICHTAG = new Date('2027-02-01T00:00:00+01:00')
const KONTEXT: AgbKontext = { inkrafttreten: STICHTAG }

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
        return texteVon(PLATZHALTER_ANGABE(KONTEXT)[s.was])
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
    case 'hinweis':
      return texteVon(b.stuecke)
    case 'belehrung':
      return BELEHRUNG.teilA.abschnitte.flatMap((a) => [a.titel, ...a.absaetze])
    case 'formular':
      return [BELEHRUNG.teilB.einleitung, ...BELEHRUNG.teilB.zeilen, BELEHRUNG.teilB.fussnote]
  }
}

describe.each(AGB_FASSUNGEN)('agbAlsHtml(%s) — derselbe Text wie die Daten der Fassung', (kennung) => {
  const fassung = AGB_TEXTE[kennung]
  const html = agbAlsHtml(kennung, KONTEXT)
  const alleTexte = [
    ...fassung.teile.flatMap((t) => [t.titel, ...t.punkte.flatMap((p) => [p.titel, ...p.bloecke.flatMap(blockTexte)])]),
    ...fassung.anhaenge.flatMap((a) => [a.titel, ...a.bloecke.flatMap(blockTexte)]),
  ].filter((t) => t.trim() !== '')

  it('jedes Textstück von Teil A bis D und von den Anhängen steht in der Datei, in derselben Reihenfolge', () => {
    let ab = 0
    for (const t of alleTexte) {
      const stelle = html.indexOf(maskiere(t), ab)
      expect(stelle, `fehlt oder falsche Reihenfolge: ${t.slice(0, 60)}`).toBeGreaterThanOrEqual(0)
      ab = stelle
    }
    expect(html).toContain(maskiere(fassung.vermerk(KONTEXT)))
    expect(alleTexte.length).toBeGreaterThan(200)
  })

  it('ohne die Hinweise für die anwaltliche Prüfung und ohne „Kurz erklärt“ — Gegenprobe: die Quelle hat beides', () => {
    const quelle = readFileSync(kennung === '0.9' ? 'docs/recht/agb-0.9.md' : 'docs/recht/agb.md', 'utf8')
    expect(quelle).toMatch(/Hinweise für die anwaltliche Prüfung/)
    expect(html).not.toMatch(/anwaltliche Prüfung/)
    expect(fassung.kurzErklaert.titel).toBe('Kurz erklärt')
    expect(html).not.toContain(fassung.kurzErklaert.titel)
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

  it('Dateiname agb-<marke>-<Kennung>.html', () => {
    expect(agbDateiname(kennung)).toBe(`agb-${MARKE.toLowerCase()}-${kennung}.html`)
  })
})

describe('agbAlsHtml(1.0) — Vermerk, Stichtag und Muster', () => {
  it('Vermerk und Text nennen den Stichtag; ein anderer Stichtag ergibt ein anderes Datum', () => {
    const html = agbAlsHtml('1.0', KONTEXT)
    expect(html).toContain(`<i>Fassung 1.0 – gilt ab ${formatDatumLang(STICHTAG)}</i>`)
    expect(html.split(formatDatumLang(STICHTAG)).length - 1).toBe(3)
    const spaeter = new Date('2027-04-01T00:00:00+02:00')
    expect(agbAlsHtml('1.0', { inkrafttreten: spaeter })).toContain(`Fassung 1.0 – gilt ab ${formatDatumLang(spaeter)}`)
    expect(agbAlsHtml('1.0', { inkrafttreten: spaeter })).not.toContain(formatDatumLang(STICHTAG))
  })

  it('Ladefehler (kein Stichtag): der Ersatzwert steht in der Datei, nirgends „dem dem“', () => {
    const html = agbAlsHtml('1.0', { inkrafttreten: null })
    expect(html).toContain(`<i>Fassung 1.0 – gilt ab dem ${INKRAFTTRETEN_ERSATZ}</i>`)
    expect(html).toContain(`vor dem ${INKRAFTTRETEN_ERSATZ}`)
    expect(html).toContain(`ab dem ${INKRAFTTRETEN_ERSATZ}`)
    expect(html).not.toMatch(/dem dem/)
    // Gegenprobe: mit Stichtag kein Ersatzwert.
    expect(agbAlsHtml('1.0', KONTEXT)).not.toContain(INKRAFTTRETEN_ERSATZ)
  })

  it('Anhang 1 und 2 enthalten Sätze aus BELEHRUNG — mit den Platzhaltern statt Hofangaben', () => {
    const html = agbAlsHtml('1.0', KONTEXT)
    for (const satz of [BELEHRUNG.teilA.abschnitte[0].absaetze[0], BELEHRUNG.teilA.abschnitte[1].absaetze[1], BELEHRUNG.teilB.zeilen[0], BELEHRUNG.teilB.fussnote]) {
      expect(html).toContain(maskiere(satz))
    }
    expect(html).toContain('[Name, Anschrift, Telefonnummer und E-Mail-Adresse des Hofs]')
    // Gegenprobe: 0.9 hat das eigene Formular, nicht das gesetzliche Muster.
    expect(agbAlsHtml('0.9', KONTEXT)).not.toContain(maskiere(BELEHRUNG.teilA.abschnitte[0].absaetze[0]))
  })

  it('0.9 hängt nicht am Stichtag: mit und ohne Stichtag dieselbe Datei', () => {
    expect(agbAlsHtml('0.9', KONTEXT)).toBe(agbAlsHtml('0.9', { inkrafttreten: null }))
  })
})
