/**
 * Wache: kein Absatz in docs/ai steht zweimal (fast) gleich da
 * (Regelvorschlag „Dirigent (2)“, Lauf 16; freigegeben für Nr. 118, Lauf 17).
 *
 * Ursache: „Beide Seiten behalten“ löst einen Merge-Konflikt in der Doku richtig, wenn beide Seiten
 * ABSCHNITTE ANHÄNGEN. Hat eine Seite einen bestehenden Absatz GEÄNDERT, steht danach die alte und die neue
 * Fassung untereinander — im Lauf 16 in ARCHITECTURE.md. Der Konflikt ist weg, die Doku widerspricht sich.
 * Gegenmaßnahme (docs/nachtlauf.md §4 Schritt 8): bei Konflikten in docs/ai den kombinierten Diff
 * (`git show --cc`) ansehen und doppelte Absätze zu EINEM auflösen.
 *
 * Beweist (docs/ai/*.md ohne das erzeugte BAUSTEINE.md, Code-Blöcke ausgenommen):
 *  - Kein Absatz, Listenpunkt oder Tabellenzeile ab 150 Zeichen ist mit einem anderen derselben Datei zu
 *    mindestens 70 % gleich (Anteil der Vierwortfolgen des kürzeren, die auch im längeren stehen). Die Zeilen
 *    der Funde stehen in der Meldung.
 *  - BESTAND: Paare, die schon vor Nr. 118 doppelt standen. Die Liste darf nur schrumpfen — ein Paar, das
 *    aufgelöst ist, fällt hier als veraltet auf.
 *  - Gegenprobe: Ein geänderter Absatz, zweimal kurz hintereinander, wird gefunden; zwei verschiedene
 *    Absätze desselben Themas und kurze Zeilen nicht.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const WURZEL = process.cwd()
const DOKU = join(WURZEL, 'docs/ai')

/** Ab dieser Länge zählt eine Einheit (kürzere Listenpunkte gleichen sich von Natur aus). */
const MIN_ZEICHEN = 150
/** Anteil der Vierwortfolgen des kürzeren Absatzes, der auch im längeren steht. */
const SCHWELLE = 0.7

/**
 * Doppelte Absätze, die schon vor Nr. 118 in der Doku standen: Datei, Anfang des ersten Absatzes (40 Zeichen).
 * Die alte Fassung nennt noch „Entwurf“ für Produkte, die neue „Nicht im Shop“ (Wortliste N8) — beim Auflösen
 * die neue Fassung behalten und Sätze, die nur die alte trägt, hinüberziehen. Stand für Lauf 18.
 */
const BESTAND: ReadonlyArray<{ datei: string; anfang: string }> = [
  { datei: 'DESIGN_SYSTEM.md', anfang: '- **Moment „wieder da"** (`WiederDaMoment`' },
  { datei: 'DESIGN_SYSTEM.md', anfang: '- **Produktdialog** im Geltungsbereich: am' },
  { datei: 'DESIGN_SYSTEM.md', anfang: '- **Freischaltungs-Moment** („Dein Hof ist' },
  { datei: 'DESIGN_SYSTEM.md', anfang: '- **Status** als `StatusBadge` aus `produk' },
]

/** Das Paar steht in BESTAND, wenn Datei und die ersten 40 Zeichen des ersten Absatzes passen. */
const imBestand = (b: { datei: string; anfang: string }, f: { datei: string; anfang: string }): boolean => b.datei === f.datei && b.anfang.slice(0, 40) === f.anfang

type Einheit = { zeile: number; text: string }
type Fund = { datei: string; anfang: string; zeilen: [number, number]; anteil: number }

/** Absätze, Listenpunkte, Nummern, Tabellenzeilen und Überschriften als Einheiten — ohne Code-Blöcke. */
function einheiten(markdown: string): Einheit[] {
  const ergebnis: Einheit[] = []
  let aktuell: Einheit | null = null
  let imCode = false
  const abschliessen = (): void => {
    if (aktuell) ergebnis.push({ zeile: aktuell.zeile, text: aktuell.text.replace(/\s+/g, ' ').trim() })
    aktuell = null
  }
  markdown.split('\n').forEach((zeile, i) => {
    if (/^\s*```/.test(zeile)) {
      abschliessen()
      imCode = !imCode
      return
    }
    if (imCode) return
    if (zeile.trim() === '') return abschliessen()
    if (/^(\s*[-*] |\s*\d+\. |\|)|^#+ /.test(zeile)) abschliessen()
    if (aktuell) aktuell.text += ` ${zeile}`
    else aktuell = { zeile: i + 1, text: zeile }
  })
  abschliessen()
  return ergebnis
}

function vierwortfolgen(text: string): Set<string> {
  const woerter = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  const folgen = new Set<string>()
  for (let i = 0; i + 4 <= woerter.length; i++) folgen.add(woerter.slice(i, i + 4).join(' '))
  return folgen
}

/** Paare ähnlicher Einheiten in einem Text. */
function findeDoppelte(datei: string, markdown: string): Fund[] {
  const lang = einheiten(markdown).filter((e) => e.text.length >= MIN_ZEICHEN)
  const folgen = lang.map((e) => vierwortfolgen(e.text))
  const funde: Fund[] = []
  for (let i = 0; i < lang.length; i++) {
    for (let j = i + 1; j < lang.length; j++) {
      const [klein, gross] = folgen[i].size <= folgen[j].size ? [folgen[i], folgen[j]] : [folgen[j], folgen[i]]
      if (klein.size === 0) continue
      let gemeinsam = 0
      for (const f of klein) if (gross.has(f)) gemeinsam++
      const anteil = gemeinsam / klein.size
      if (anteil >= SCHWELLE) funde.push({ datei, anfang: lang[i].text.slice(0, 40), zeilen: [lang[i].zeile, lang[j].zeile], anteil: Math.round(anteil * 100) / 100 })
    }
  }
  return funde
}

function dokuDateien(): string[] {
  return readdirSync(DOKU).filter((n) => n.endsWith('.md') && n !== 'BAUSTEINE.md')
}

describe('kein Absatz in docs/ai steht zweimal da (Regelvorschlag Dirigent 2)', () => {
  const ALT =
    '- **Moment „wieder da“:** ab 768 px schwebende Karte unten rechts (400 px, Rand primary, ohne Schleier, Escape und Nicht jetzt schließen), darunter ein Blatt. Häkchen grün, Titel mit dem Namen des Produkts, Satz mit Menge, Zitat mit dem Teilen-Text und der Knopf Teilen in Orange.'
  const NEU =
    '- **Moment „wieder da“:** ab 768 px schwebende Karte unten rechts (400 px, Rand primary, ohne Schleier, Escape und Nicht jetzt schließen, Live-Region), darunter ein Blatt. Häkchen grün, Titel mit dem Namen des Produkts, Satz mit Menge, Zitat mit dem Teilen-Text und der Knopf Teilen in Orange, danach ein Satz zum Abschalten.'
  const ANDERER =
    '- **Freischaltungs-Moment:** Dialog ab 768 px, darunter ein Blatt; Hof teilen in Orange und Später. Höchstens einmal je Gerät, nur bei sichtbarem Hof und nur in den ersten 14 Tagen nach der Freigabe, danach nie wieder.'

  it('Gegenprobe: ein geänderter Absatz, alte und neue Fassung untereinander, wird gefunden — mit seinen Zeilen', () => {
    const funde = findeDoppelte('probe.md', ['# Titel', '', ALT, NEU, '', 'Ein Satz dazwischen.'].join('\n'))
    expect(funde).toHaveLength(1)
    expect(funde[0].zeilen).toEqual([3, 4])
    expect(funde[0].anteil).toBeGreaterThanOrEqual(SCHWELLE)
  })

  it('Gegenprobe: derselbe Absatz durch eine Leerzeile getrennt oder weit auseinander wird auch gefunden', () => {
    const lang = ['# A', '', ALT, '', ...Array.from({ length: 30 }, (_, i) => `Zeile ${i} mit eigenem Text, der nichts mit dem Rest zu tun hat und deshalb nie gleicht.`), '', NEU].join('\n')
    expect(findeDoppelte('probe.md', lang)).toHaveLength(1)
  })

  it('zwei verschiedene Absätze desselben Themas, kurze Zeilen und Code-Blöcke zählen nicht', () => {
    expect(findeDoppelte('probe.md', [ALT, '', ANDERER].join('\n'))).toEqual([])
    expect(findeDoppelte('probe.md', ['- **Kurz:** ein kurzer Punkt.', '- **Kurz:** ein kurzer Punkt.'].join('\n'))).toEqual([])
    expect(findeDoppelte('probe.md', ['```', ALT, '```', '```', NEU, '```'].join('\n'))).toEqual([])
  })

  it('die Doku hat keinen doppelten Absatz, der nicht in BESTAND steht — ein neuer fällt mit Datei und Zeilen auf', () => {
    const neu = dokuDateien()
      .flatMap((datei) => findeDoppelte(datei, readFileSync(join(DOKU, datei), 'utf8')))
      .filter((f) => !BESTAND.some((b) => imBestand(b, f)))
    expect(
      neu.map((f) => `${f.datei} Zeile ${f.zeilen[0]} und ${f.zeilen[1]} (${Math.round(f.anteil * 100)} % gleich): ${f.anfang}`),
      'Doppelter Absatz in docs/ai — nach einem Merge den kombinierten Diff (git show --cc) ansehen und zu EINEM Absatz auflösen.'
    ).toEqual([])
  })

  it('jeder Eintrag in BESTAND steht noch doppelt da — sonst ist er aufgelöst und gehört aus der Liste', () => {
    const funde = dokuDateien().flatMap((datei) => findeDoppelte(datei, readFileSync(join(DOKU, datei), 'utf8')))
    for (const b of BESTAND) {
      expect(
        funde.some((f) => imBestand(b, f)),
        `${b.datei}: „${b.anfang}“ steht nicht mehr doppelt da — aus BESTAND nehmen.`
      ).toBe(true)
    }
  })
})
