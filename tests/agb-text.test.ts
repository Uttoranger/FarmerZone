/**
 * Der Text von /agb ist der Entwurf (Register O4, Nr. 90).
 *
 * Ursache: Die AGB sind ein Rechtstext. Änderungen am Wortlaut macht nur die
 * Projektleitung nach der anwaltlichen Prüfung, zuerst in docs/recht/agb.md —
 * dieselben Absätze stehen als Daten in src/lib/rechtstexte/agb.ts, damit die
 * Seite sie zeichnen kann. Zwei Fassungen desselben Rechtstexts laufen
 * auseinander, sobald eine allein geändert wird.
 *
 * Beweist:
 *  - Die Daten, zurück in Markdown geschrieben, sind der Entwurf — Zeile für
 *    Zeile, mit Fett, Links, Listen, der Tabelle in Punkt 2.4 und dem Anhang.
 *    Name und Domain setzt der Test aus MARKE und PRODUKTION_HOST ein (im
 *    Entwurf stehen sie als Text), die zwei Platzhalter des Entwurfs stehen
 *    als Stücke da. Gelesen wird die Datei bei jedem Lauf, nicht abgeschrieben.
 *  - „Kurz erklärt" steht als Einleitung in den Daten, die „Hinweise für die
 *    anwaltliche Prüfung" nicht.
 *  - Es sind vier Teile und 29 Punkte, fortlaufend nummeriert.
 *  - Der Stand-Vermerk der Seite nennt Fassung und Datum des Entwurfs.
 *  - Gegenprobe: Die Prüfung schlägt an, wenn ein Wort oder ein Link der Daten
 *    vom Entwurf abweicht.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MARKE } from '@/lib/marke'
import { PRODUKTION_HOST } from '@/lib/umgebung'
import {
  AGB_ANHANG,
  AGB_KURZ_ERKLAERT,
  AGB_STAND_VERMERK,
  AGB_TEILE,
  AGB_TITEL,
  type AgbBlock,
  type AgbTeil,
} from '@/lib/rechtstexte/agb'
import type { AgbStueck } from '@/lib/rechtstexte/stuecke'

const ENTWURF = readFileSync(join(process.cwd(), 'docs/recht/agb.md'), 'utf8')

/** So steht jeder Platzhalter im Entwurf. */
const PLATZHALTER_IM_ENTWURF = {
  betreiber: '[Betreiber laut Impressum, Rechtsform, Anschrift, E-Mail]',
  email: '[E-Mail laut Impressum]',
} as const

// ── Daten zurück in Markdown ─────────────────────────────────────────────────

function stueckAlsMarkdown(stueck: AgbStueck): string {
  if (typeof stueck === 'string') return stueck
  switch (stueck.art) {
    case 'fett':
      return `**${stueck.stuecke.map(stueckAlsMarkdown).join('')}**`
    case 'kursiv':
      return `*${stueck.text}*`
    case 'link':
      return `[${stueck.text}](${stueck.ziel})`
    case 'mail':
      return stueck.adresse
    case 'platzhalter':
      return PLATZHALTER_IM_ENTWURF[stueck.was]
  }
}

const zeileAlsMarkdown = (stuecke: readonly AgbStueck[]): string => stuecke.map(stueckAlsMarkdown).join('')

function blockAlsZeilen(block: AgbBlock): string[] {
  switch (block.art) {
    case 'absatz':
      return [`${block.nummer ? `${block.nummer} ` : ''}${zeileAlsMarkdown(block.stuecke)}`]
    case 'liste':
      return block.eintraege.map((eintrag) => `- ${zeileAlsMarkdown(eintrag)}`)
    case 'tabelle':
      return [
        `| ${block.kopf.join(' | ')} |`,
        '|---|---|',
        ...block.zeilen.map((zeile) => `| ${zeile.join(' | ')} |`),
      ]
    case 'zeilen':
      return block.zeilen.map(zeileAlsMarkdown)
  }
}

/** Alles, was die Seite zeigt, in der Reihenfolge des Entwurfs — ohne Leerzeilen und Trennstriche. */
function datenAlsZeilen(teile: readonly AgbTeil[] = AGB_TEILE): string[] {
  return [
    `# ${AGB_TITEL}`,
    `## ${AGB_KURZ_ERKLAERT.titel} (${AGB_KURZ_ERKLAERT.zusatz})`,
    ...AGB_KURZ_ERKLAERT.punkte.map((punkt) => `- ${zeileAlsMarkdown(punkt)}`),
    ...teile.flatMap((teil) => [
      `## ${teil.titel}`,
      ...teil.punkte.flatMap((punkt) => [`### ${punkt.nummer}. ${punkt.titel}`, ...punkt.bloecke.flatMap(blockAlsZeilen)]),
    ]),
    `## ${AGB_ANHANG.titel}`,
    ...AGB_ANHANG.bloecke.flatMap(blockAlsZeilen),
  ]
}

// ── Der Entwurf ──────────────────────────────────────────────────────────────

const ENDE_DES_TEXTES = '## Hinweise für die anwaltliche Prüfung'

/** Der Name steht im Entwurf im Titel („… von <Name>"), die Domain in Punkt 1.2 — beides wird gelesen, nicht abgeschrieben. */
function nameUndDomain(entwurf: string): { name: string; domain: string } {
  const titel = entwurf.split('\n').find((z) => z.startsWith('# '))
  const domain = entwurf.match(/Nutzung von (\S+) und der dazugehörigen Dienste/)
  if (!titel || !domain) throw new Error('Titel oder Punkt 1.2 des Entwurfs nicht gefunden')
  return { name: titel.slice(titel.lastIndexOf(' von ') + ' von '.length).trim(), domain: domain[1] }
}

/** Die Zeilen des Entwurfs, die auf die Seite gehören: bis zu den Hinweisen, ohne Vermerk, Trennstriche und Leerzeilen, mit Name und Domain aus den Konstanten. */
function entwurfAlsZeilen(entwurf: string): string[] {
  const { name, domain } = nameUndDomain(entwurf)
  const ende = entwurf.indexOf(ENDE_DES_TEXTES)
  if (ende === -1) throw new Error('Die Hinweise für die anwaltliche Prüfung fehlen im Entwurf')
  return entwurf
    .slice(0, ende)
    .split('\n')
    .filter((z) => z.trim() !== '' && z.trim() !== '---' && !z.startsWith('**Entwurf, Stand'))
    .map((z) => z.split(domain).join(PRODUKTION_HOST).split(name).join(MARKE))
}

/** Die erste Zeile, in der beide auseinandergehen — oder null. */
function ersteAbweichung(daten: string[], entwurf: string[]): string | null {
  for (let i = 0; i < Math.max(daten.length, entwurf.length); i++) {
    if (daten[i] !== entwurf[i]) return `Zeile ${i + 1}\n  Daten:   ${daten[i] ?? '(fehlt)'}\n  Entwurf: ${entwurf[i] ?? '(fehlt)'}`
  }
  return null
}

describe('AGB: Daten und Entwurf (Register O4)', () => {
  it('die Daten sind der Entwurf — Wort für Wort, Zeile für Zeile', () => {
    expect(ersteAbweichung(datenAlsZeilen(), entwurfAlsZeilen(ENTWURF))).toBeNull()
  })

  it('Gegenprobe: ein anderes Wort, ein anderer Link oder eine fehlende Zeile fallen auf', () => {
    const entwurf = entwurfAlsZeilen(ENTWURF)
    const zeile = entwurf.findIndex((z) => z.startsWith('12.4 '))
    expect(zeile).toBeGreaterThan(-1)
    const anders = [...entwurf]
    anders[zeile] = anders[zeile].replace('binnen 14 Tagen', 'binnen 15 Tagen')
    expect(ersteAbweichung(datenAlsZeilen(), anders)).toContain('binnen 14 Tagen')

    const ohneLink = entwurf.map((z) => z.replace('(/konditionen)', '(/preise)'))
    expect(ersteAbweichung(datenAlsZeilen(), ohneLink)).toContain('/konditionen')

    expect(ersteAbweichung(datenAlsZeilen(), entwurf.slice(0, -1))).toContain('(fehlt)')
  })

  it('Gegenprobe: ein Wort, das nur in den Daten geändert ist, fällt ebenfalls auf', () => {
    const geaendert = AGB_TEILE.map((teil) => ({
      ...teil,
      punkte: teil.punkte.map((punkt) =>
        punkt.nummer === 12
          ? { ...punkt, bloecke: punkt.bloecke.map((b) => (b.art === 'absatz' && b.nummer === '12.1' ? { ...b, stuecke: ['Du kannst jederzeit zurücktreten.'] } : b)) }
          : punkt
      ),
    }))
    expect(ersteAbweichung(datenAlsZeilen(geaendert), entwurfAlsZeilen(ENTWURF))).toContain('12.1')
  })

  it('Name und Domain des Entwurfs werden aus dem Entwurf gelesen und durch die Konstanten ersetzt', () => {
    const { name, domain } = nameUndDomain(ENTWURF)
    expect(name.length).toBeGreaterThan(2)
    expect(domain).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/)
    // Ohne Ersatz stünde der Name des Entwurfs noch in den Zeilen, wenn er ein anderer ist als MARKE.
    const zeilen = entwurfAlsZeilen(ENTWURF).join('\n')
    expect(zeilen).toContain(MARKE)
    expect(zeilen).toContain(PRODUKTION_HOST)
    if (name !== MARKE) expect(zeilen).not.toContain(name)
  })

  it('„Kurz erklärt" steht als Einleitung in den Daten — die Hinweise für die anwaltliche Prüfung nicht', () => {
    expect(ENTWURF).toContain(ENDE_DES_TEXTES)
    expect(AGB_KURZ_ERKLAERT.zusatz).toBe('kein Teil der AGB')
    expect(AGB_KURZ_ERKLAERT.punkte).toHaveLength(6)
    const alles = datenAlsZeilen().join('\n')
    expect(alles).not.toContain('anwaltliche')
    expect(alles).not.toContain('Hinweise für')
    // Gegenprobe: Die Suche findet das Wort dort, wo es steht.
    expect(ENTWURF.slice(ENTWURF.indexOf(ENDE_DES_TEXTES))).toContain('anwaltliche')
  })

  it('vier Teile, 29 Punkte, fortlaufend nummeriert, jeder mit Text', () => {
    expect(AGB_TEILE.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd'])
    const nummern = AGB_TEILE.flatMap((t) => t.punkte.map((p) => p.nummer))
    expect(nummern).toEqual(Array.from({ length: 29 }, (_, i) => i + 1))
    for (const punkt of AGB_TEILE.flatMap((t) => t.punkte)) {
      expect(punkt.titel.trim(), String(punkt.nummer)).not.toBe('')
      expect(punkt.bloecke.length, String(punkt.nummer)).toBeGreaterThan(0)
    }
  })

  it('die Absätze tragen ihre Nummer („5.3" gehört zu Punkt 5)', () => {
    for (const punkt of AGB_TEILE.flatMap((t) => t.punkte)) {
      for (const block of punkt.bloecke) {
        if (block.art === 'absatz' && block.nummer) expect(block.nummer.startsWith(`${punkt.nummer}.`), block.nummer).toBe(true)
      }
    }
  })

  it('die Platzhalter stehen so oft da wie im Entwurf: einmal der Betreiber, dreimal die E-Mail-Adresse', () => {
    const zaehle = (text: string, muster: string): number => text.split(muster).length - 1
    const daten = datenAlsZeilen().join('\n')
    expect(zaehle(ENTWURF, PLATZHALTER_IM_ENTWURF.betreiber)).toBe(1)
    expect(zaehle(daten, PLATZHALTER_IM_ENTWURF.betreiber)).toBe(1)
    expect(zaehle(ENTWURF, PLATZHALTER_IM_ENTWURF.email)).toBe(3)
    expect(zaehle(daten, PLATZHALTER_IM_ENTWURF.email)).toBe(3)
  })

  it('der Stand-Vermerk nennt Fassung und Datum des Entwurfs', () => {
    const vermerk = ENTWURF.split('\n').find((z) => z.startsWith('**Entwurf, Stand'))
    expect(vermerk).toBeDefined()
    const stand = vermerk!.match(/Stand (\d+\. \w+ \d{4}) – Fassung (\d+(?:\.\d+)*)\./)
    expect(stand).not.toBeNull()
    expect(AGB_STAND_VERMERK).toBe(`Fassung ${stand![2]} – Entwurf, Stand ${stand![1]}`)
  })
})
