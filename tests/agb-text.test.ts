/**
 * Der Text der AGB ist ihre Markdown-Datei — je Fassung (Register O4, N45).
 *
 * Ursache: Die AGB sind ein Rechtstext. Fassung 0.9 ist eingefroren
 * (docs/recht/agb-0.9.md ↔ src/lib/rechtstexte/agb-0-9.ts), Fassung 1.0 gilt
 * ab dem Stichtag (docs/recht/agb.md ↔ src/lib/rechtstexte/agb.ts). Zwei
 * Exemplare desselben Rechtstexts laufen auseinander, sobald eines allein
 * geändert wird.
 *
 * Beweist (je Fassung):
 *  - Die Daten, zurück in Markdown geschrieben, sind die Datei — Zeile für
 *    Zeile, mit Fett, Links, Listen, der Tabelle und den Anhängen. Name und
 *    Domain setzt der Test aus MARKE und PRODUKTION_HOST ein; die Platzhalter
 *    stehen als Stücke da; Anhang 1 und 2 von 1.0 stehen in der Datei als
 *    Verweis auf src/lib/widerruf.ts und in den Daten als Block
 *    'belehrung'/'formular'. Gelesen wird die Datei bei jedem Lauf.
 *  - 0.9 hat 29 Punkte, 1.0 hat 35; „Kurz erklärt“ hat je 6 Punkte; die
 *    Hinweise für die anwaltliche Prüfung stehen nicht in den Daten.
 *  - In 1.0 stehen weder „anwaltliche“ noch „Servicegebühr“.
 *  - Platzhalter in 1.0: Betreiber 1×, E-Mail 5×, Inkrafttreten 2× im Text
 *    plus die Stand-Zeile.
 *  - Der Stand-Vermerk: 0.9 „Fassung 0.9 – Entwurf, Stand …“, 1.0 „Fassung 1.0 –
 *    gilt ab <Tag>“ — der Regex kennt beide Formen der Markdown-Zeile.
 *  - Gegenproben: ein anderes Wort, ein anderer Link, eine fehlende Zeile.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MARKE } from '@/lib/marke'
import { PRODUKTION_HOST } from '@/lib/umgebung'
import { AGB_0_9 } from '@/lib/rechtstexte/agb-0-9'
import { AGB_1_0 } from '@/lib/rechtstexte/agb'
import { AGB_TEXTE } from '@/lib/rechtstexte/agb-texte'
import { AGB_FASSUNGEN } from '@/lib/rechtstexte/agb-fassung'
import type { AgbBlock, AgbFassungDaten, AgbTeil } from '@/lib/rechtstexte/agb-bloecke'
import { formatDatumLang } from '@/lib/format'
import type { AgbStueck } from '@/lib/rechtstexte/stuecke'

const DATEI = { '0.9': 'docs/recht/agb-0.9.md', '1.0': 'docs/recht/agb.md' } as const
const lies = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')

/** So steht jeder Platzhalter in der Datei. */
const PLATZHALTER_IM_TEXT = {
  betreiber: '[Betreiber laut Impressum, Rechtsform, Anschrift, E-Mail]',
  email: '[E-Mail laut Impressum]',
  inkrafttreten: '[Tag des Inkrafttretens]',
} as const

/** So stehen Anhang 1 und 2 in docs/recht/agb.md (Wortlaut aus A005): als Verweis auf das gesetzliche Muster. */
const MUSTER_VERWEIS = {
  // Die Domain als Konstante (Register M1, auch in Tests); die Datei nennt sie als Text, dateiAlsZeilen setzt die Konstante ein.
  belehrung: `[Wortlaut aus \`src/lib/widerruf.ts\` (\`BELEHRUNG.teilA\`, Abschnitte „Widerrufsrecht“ und „Folgen des Widerrufs“), nicht abgetippt: das gesetzliche Muster nach Anhang I Teil A FAGG idF BGBl. I Nr. 59/2026 mit dem Satz zur Online-Funktion unter ${PRODUKTION_HOST}/widerruf und dem Platzhalter „[Name, Anschrift, Telefonnummer und E-Mail-Adresse des Hofs]“.]`,
  formular:
    '[Wortlaut aus `src/lib/widerruf.ts` (`BELEHRUNG.teilB`), nicht abgetippt: das gesetzliche Muster nach Anhang I Teil B FAGG mit dem Platzhalter „[Name, Anschrift und E-Mail-Adresse des Hofs]“.]',
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
      return PLATZHALTER_IM_TEXT[stueck.was]
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
      return [`| ${block.kopf.join(' | ')} |`, '|---|---|', ...block.zeilen.map((zeile) => `| ${zeile.join(' | ')} |`)]
    case 'zeilen':
      return block.zeilen.map(zeileAlsMarkdown)
    case 'hinweis':
      return [block.kursiv ? `*${zeileAlsMarkdown(block.stuecke)}*` : zeileAlsMarkdown(block.stuecke)]
    case 'belehrung':
    case 'formular':
      return [MUSTER_VERWEIS[block.art]]
  }
}

/** Alles, was die Seite zeigt, in der Reihenfolge der Datei — ohne Leerzeilen, Trennstriche und Stand-Zeile. */
function datenAlsZeilen(fassung: AgbFassungDaten, teile: readonly AgbTeil[] = fassung.teile): string[] {
  return [
    `# ${fassung.titel}`,
    `## ${fassung.kurzErklaert.titel} (${fassung.kurzErklaert.zusatz})`,
    ...fassung.kurzErklaert.punkte.map((punkt) => `- ${zeileAlsMarkdown(punkt)}`),
    ...teile.flatMap((teil) => [
      `## ${teil.titel}`,
      ...teil.punkte.flatMap((punkt) => [`### ${punkt.nummer}. ${punkt.titel}`, ...punkt.bloecke.flatMap(blockAlsZeilen)]),
    ]),
    ...fassung.anhaenge.flatMap((anhang) => [`## ${anhang.titel}`, ...anhang.bloecke.flatMap(blockAlsZeilen)]),
  ]
}

// ── Die Datei ────────────────────────────────────────────────────────────────

const ENDE_DES_TEXTES = '## Hinweise für die anwaltliche Prüfung'

/** Die Stand-Zeile in beiden Formen: „**Entwurf, Stand … – Fassung 0.9. …**“ und „**Fassung 1.0 – gilt ab [Tag des Inkrafttretens]**“. */
const STAND_ZEILE = /^\*\*(?:Entwurf, Stand (\d+\. \S+ \d{4}) – Fassung (\d+\.\d+)\..*|Fassung (\d+\.\d+) – gilt ab \[Tag des Inkrafttretens\])\*\*$/

/** Der Name steht im Titel („… von <Name>"), die Domain in Punkt 1.2 — beides wird gelesen, nicht abgeschrieben. */
function nameUndDomain(text: string): { name: string; domain: string } {
  const titel = text.split('\n').find((z) => z.startsWith('# '))
  const domain = text.match(/Nutzung von (\S+) und der dazugehörigen Dienste/)
  if (!titel || !domain) throw new Error('Titel oder Punkt 1.2 nicht gefunden')
  return { name: titel.slice(titel.lastIndexOf(' von ') + ' von '.length).trim(), domain: domain[1] }
}

/** Die Zeilen der Datei, die auf die Seite gehören: bis zu den Hinweisen, ohne Stand-Zeile, Trennstriche und Leerzeilen, mit Name und Domain aus den Konstanten. */
function dateiAlsZeilen(text: string): string[] {
  const { name, domain } = nameUndDomain(text)
  const ende = text.indexOf(ENDE_DES_TEXTES)
  if (ende === -1) throw new Error('Die Hinweise für die anwaltliche Prüfung fehlen')
  return text
    .slice(0, ende)
    .split('\n')
    .filter((z) => z.trim() !== '' && z.trim() !== '---' && !STAND_ZEILE.test(z))
    .map((z) => z.split(domain).join(PRODUKTION_HOST).split(name).join(MARKE))
}

/** Die erste Zeile, in der beide auseinandergehen — oder null. */
function ersteAbweichung(daten: string[], datei: string[]): string | null {
  for (let i = 0; i < Math.max(daten.length, datei.length); i++) {
    if (daten[i] !== datei[i]) return `Zeile ${i + 1}\n  Daten: ${daten[i] ?? '(fehlt)'}\n  Datei: ${datei[i] ?? '(fehlt)'}`
  }
  return null
}

const zaehle = (text: string, muster: string): number => text.split(muster).length - 1

describe.each(AGB_FASSUNGEN)('AGB %s: Daten und Datei', (kennung) => {
  const fassung = AGB_TEXTE[kennung]
  const text = lies(DATEI[kennung])

  it('die Daten sind die Datei — Wort für Wort, Zeile für Zeile', () => {
    expect(fassung.kennung).toBe(kennung)
    expect(ersteAbweichung(datenAlsZeilen(fassung), dateiAlsZeilen(text))).toBeNull()
  })

  it('Gegenprobe: ein anderes Wort, ein anderer Link oder eine fehlende Zeile fallen auf', () => {
    const datei = dateiAlsZeilen(text)
    const zeile = datei.findIndex((z) => z.startsWith('12.4 '))
    expect(zeile).toBeGreaterThan(-1)
    const anders = [...datei]
    anders[zeile] = `${anders[zeile]} Zusatz.`
    expect(ersteAbweichung(datenAlsZeilen(fassung), anders)).toContain('Zusatz.')

    const ohneLink = datei.map((z) => z.replace('(/konditionen)', '(/preise)'))
    expect(ersteAbweichung(datenAlsZeilen(fassung), ohneLink)).toContain('/konditionen')

    expect(ersteAbweichung(datenAlsZeilen(fassung), datei.slice(0, -1))).toContain('(fehlt)')
  })

  it('Gegenprobe: ein Wort, das nur in den Daten geändert ist, fällt ebenfalls auf', () => {
    const geaendert = fassung.teile.map((teil) => ({
      ...teil,
      punkte: teil.punkte.map((punkt) =>
        punkt.nummer === 12
          ? { ...punkt, bloecke: punkt.bloecke.map((b) => (b.art === 'absatz' && b.nummer === '12.1' ? { ...b, stuecke: ['Du kannst jederzeit zurücktreten.'] } : b)) }
          : punkt
      ),
    }))
    expect(ersteAbweichung(datenAlsZeilen(fassung, geaendert), dateiAlsZeilen(text))).toContain('12.1')
  })

  it('Name und Domain werden aus der Datei gelesen und durch die Konstanten ersetzt', () => {
    const { name, domain } = nameUndDomain(text)
    expect(name.length).toBeGreaterThan(2)
    expect(domain).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/)
    const zeilen = dateiAlsZeilen(text).join('\n')
    expect(zeilen).toContain(MARKE)
    expect(zeilen).toContain(PRODUKTION_HOST)
  })

  it('„Kurz erklärt" hat 6 Punkte und steht als Einleitung da — die Hinweise für die anwaltliche Prüfung nicht', () => {
    expect(text).toContain(ENDE_DES_TEXTES)
    expect(fassung.kurzErklaert.zusatz).toBe('kein Teil der AGB')
    expect(fassung.kurzErklaert.punkte).toHaveLength(6)
    const alles = datenAlsZeilen(fassung).join('\n')
    expect(alles).not.toContain('Hinweise für die anwaltliche')
    // Gegenprobe: Die Suche findet die Überschrift dort, wo sie steht.
    expect(text.slice(text.indexOf(ENDE_DES_TEXTES))).toContain('anwaltliche')
  })

  it('die Absätze in Teil A bis D tragen die Nummer ihres Punkts („5.3" gehört zu Punkt 5)', () => {
    for (const punkt of fassung.teile.flatMap((t) => t.punkte)) {
      for (const block of punkt.bloecke) {
        if (block.art === 'absatz' && block.nummer) expect(block.nummer.startsWith(`${punkt.nummer}.`), block.nummer).toBe(true)
      }
    }
  })

  it('die Stand-Zeile der Datei nennt die Kennung der Fassung; der Vermerk der Seite beginnt mit ihr', () => {
    const zeile = text.split('\n').find((z) => STAND_ZEILE.test(z))
    expect(zeile).toBeDefined()
    const treffer = STAND_ZEILE.exec(zeile!)!
    expect(treffer[2] ?? treffer[3]).toBe(kennung)
    expect(fassung.vermerk({ inkrafttreten: new Date('2027-02-01T00:00:00+01:00') }).startsWith(`Fassung ${kennung} – `)).toBe(true)
  })
})

describe('AGB 0.9 — eingefroren', () => {
  it('vier Teile, 29 Punkte, fortlaufend nummeriert, ein Anhang', () => {
    expect(AGB_0_9.teile.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(AGB_0_9.teile.flatMap((t) => t.punkte.map((p) => p.nummer))).toEqual(Array.from({ length: 29 }, (_, i) => i + 1))
    expect(AGB_0_9.anhaenge).toHaveLength(1)
  })

  it('Vermerk wie bis zum Stichtag; die Markdown-Zeile in der Entwurfs-Form', () => {
    expect(AGB_0_9.vermerk({ inkrafttreten: null })).toBe('Fassung 0.9 – Entwurf, Stand 13. Oktober 2026')
    const zeile = lies(DATEI['0.9']).split('\n').find((z) => STAND_ZEILE.test(z))!
    expect(STAND_ZEILE.exec(zeile)![1]).toBe('13. Oktober 2026')
  })

  it('Platzhalter wie im Entwurf: einmal der Betreiber, dreimal die E-Mail-Adresse, kein Tag des Inkrafttretens', () => {
    const daten = datenAlsZeilen(AGB_0_9).join('\n')
    expect(zaehle(daten, PLATZHALTER_IM_TEXT.betreiber)).toBe(1)
    expect(zaehle(daten, PLATZHALTER_IM_TEXT.email)).toBe(3)
    expect(zaehle(daten, PLATZHALTER_IM_TEXT.inkrafttreten)).toBe(0)
  })
})

describe('AGB 1.0', () => {
  const text = lies(DATEI['1.0'])

  it('vier Teile, 35 Punkte, fortlaufend nummeriert, drei Anhänge', () => {
    expect(AGB_1_0.teile.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(AGB_1_0.teile.flatMap((t) => t.punkte.map((p) => p.nummer))).toEqual(Array.from({ length: 35 }, (_, i) => i + 1))
    for (const punkt of AGB_1_0.teile.flatMap((t) => t.punkte)) {
      expect(punkt.titel.trim(), String(punkt.nummer)).not.toBe('')
      expect(punkt.bloecke.length, String(punkt.nummer)).toBeGreaterThan(0)
    }
    expect(AGB_1_0.anhaenge.map((a) => a.anker)).toEqual(['anhang-1', 'anhang-2', 'anhang-3'])
  })

  it('Tabelle in 2.6, Listen in 9.5 und 14.2 (14.2 mit dem Absatz danach ohne Nummer), Anhang 1/2 als Muster-Blöcke', () => {
    const bloeckeVon = (n: number) => AGB_1_0.teile.flatMap((t) => t.punkte).find((p) => p.nummer === n)!.bloecke
    const nach = (n: number, nummer: string) => bloeckeVon(n)[bloeckeVon(n).findIndex((b) => b.art === 'absatz' && b.nummer === nummer) + 1]
    expect(nach(2, '2.6')?.art).toBe('tabelle')
    expect(nach(9, '9.5')?.art).toBe('liste')
    expect(nach(14, '14.2')?.art).toBe('liste')
    const nachListe = bloeckeVon(14)[bloeckeVon(14).findIndex((b) => b.art === 'liste') + 1]
    expect(nachListe).toMatchObject({ art: 'absatz', nummer: null })
    expect(AGB_1_0.anhaenge[0].bloecke.map((b) => b.art)).toContain('belehrung')
    expect(AGB_1_0.anhaenge[1].bloecke.map((b) => b.art)).toContain('formular')
  })

  it('in den Daten stehen weder „anwaltliche“ noch „Servicegebühr“ (Gegenprobe: 0.9 nennt die Servicegebühr)', () => {
    const daten = JSON.stringify(AGB_1_0)
    expect(daten).not.toContain('anwaltliche')
    expect(daten).not.toContain('Servicegebühr')
    expect(JSON.stringify(AGB_0_9)).toContain('Servicegebühr')
  })

  it('Platzhalter: Betreiber 1×, E-Mail 5×, Inkrafttreten 2× im Text plus die Stand-Zeile — in Daten und Datei gleich', () => {
    const daten = datenAlsZeilen(AGB_1_0).join('\n')
    expect(zaehle(daten, PLATZHALTER_IM_TEXT.betreiber)).toBe(1)
    expect(zaehle(daten, PLATZHALTER_IM_TEXT.email)).toBe(5)
    expect(zaehle(daten, PLATZHALTER_IM_TEXT.inkrafttreten)).toBe(2)
    const ohneHinweise = text.slice(0, text.indexOf(ENDE_DES_TEXTES))
    expect(zaehle(ohneHinweise, PLATZHALTER_IM_TEXT.betreiber)).toBe(1)
    expect(zaehle(ohneHinweise, PLATZHALTER_IM_TEXT.email)).toBe(5)
    expect(zaehle(ohneHinweise, PLATZHALTER_IM_TEXT.inkrafttreten)).toBe(3)
  })

  it('der Vermerk ist eine Funktion des Stichtags; ohne geladenen Stichtag der Ersatz ohne „dem dem“', () => {
    const tag = new Date('2027-03-01T00:00:00+01:00')
    expect(AGB_1_0.vermerk({ inkrafttreten: tag })).toBe(`Fassung 1.0 – gilt ab ${formatDatumLang(tag)}`)
    // Gegenprobe: ein anderer Stichtag, ein anderer Vermerk.
    expect(AGB_1_0.vermerk({ inkrafttreten: new Date('2027-02-01T00:00:00+01:00') })).not.toBe(AGB_1_0.vermerk({ inkrafttreten: tag }))
    expect(AGB_1_0.vermerk({ inkrafttreten: null })).toBe(`Fassung 1.0 – gilt ab dem Stichtag auf ${PRODUKTION_HOST}/konditionen`)
  })

  it('docs/recht/agb.md endet mit dem einen Satz zu den Prüfhinweisen (keine Prüfhinweise im öffentlichen Repo)', () => {
    expect(text.slice(text.indexOf(ENDE_DES_TEXTES)).trim()).toBe(
      `${ENDE_DES_TEXTES}\n\nDie Prüfhinweise zu Fassung 1.0 führt die Projektleitung außerhalb des Repos (öffentliches Repo).`
    )
  })
})
