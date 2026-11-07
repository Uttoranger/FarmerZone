/**
 * Gegenlesen „Recht“ (Nachtlauf 32, Nr. 259; A005, Register N45): Der Wortlaut
 * von AGB 1.0 ist in allen drei Quellen derselbe — Zeichen für Zeichen.
 *
 *  1. der Text zwischen „=== AGB 1.0 ANFANG ===“ und „=== AGB 1.0 ENDE ===“ in
 *     docs/nachtlauf/berichte/a005-agb-1-0-stichtag.md (die Freigabe),
 *  2. docs/recht/agb.md bis zu den Hinweisen für die anwaltliche Prüfung,
 *  3. die Mail-Datei agbAlsHtml('1.0', …) — gebaut aus src/lib/rechtstexte/agb.ts.
 *
 * Jede Quelle wird zu reinem Text gemacht. Gleich behandelt werden NUR:
 * Markdown- bzw. HTML-Auszeichnung, Zeilenumbrüche, mehrfache Leerzeichen und
 * die Platzhalter aus der festen Tabelle unten. Danach muss der Text Zeichen
 * für Zeichen gleich sein — auch Satzzeichen, Anführungszeichen und
 * Gedankenstriche. Die Bereinigung wird nie erweitert, damit ein Vergleich
 * passt: Meldet der Test etwas, ist der Text falsch, nicht der Test.
 *
 * Umfang der Mail-Datei: „Kurz erklärt“ ist kein Teil der AGB und steht seit
 * Nr. 207 nicht in der Datei (agb-datei.ts) — verglichen wird die Datei darum
 * mit dem Text ohne diesen Abschnitt; Quelle 1 und 2 vergleichen alles.
 *
 * Dauerhaft dazu: Fassung 0.9 (agb-0-9.ts, als Mail-Datei) gegen
 * docs/recht/agb-0.9.md — ohne „Kurz erklärt“ und ohne die Stand-Zeile, deren
 * Wortlaut die Datei als Entwurf führt (der Vermerk der Seite steht in
 * tests/agb-text.test.ts fest).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { agbAlsHtml } from '@/lib/rechtstexte/agb-datei'
import { PLATZHALTER_ANGABE, type AgbKontext, type AgbStueck } from '@/lib/rechtstexte/stuecke'
import { formatDatumLang } from '@/lib/format'
import { PRODUKTION_HOST } from '@/lib/umgebung'
import { MARKE } from '@/lib/marke'

const lies = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')

const A005 = lies('docs/nachtlauf/berichte/a005-agb-1-0-stichtag.md')
const AGB_MD = lies('docs/recht/agb.md')
const AGB_0_9_MD = lies('docs/recht/agb-0.9.md')

const KONTEXT: AgbKontext = { inkrafttreten: new Date('2027-02-01T00:00:00+01:00') }

/** Der Text der Freigabe zwischen den Marken. */
function freigabeText(): string {
  const anfang = A005.indexOf('=== AGB 1.0 ANFANG ===')
  const ende = A005.indexOf('=== AGB 1.0 ENDE ===')
  if (anfang === -1 || ende === -1) throw new Error('Marken der A005-Datei nicht gefunden')
  return A005.slice(A005.indexOf('\n', anfang) + 1, ende)
}

const HINWEISE = '\n---\n\n## Hinweise für die anwaltliche Prüfung'

function bisZuDenHinweisen(md: string): string {
  const ende = md.indexOf(HINWEISE)
  if (ende === -1) throw new Error('Hinweise für die anwaltliche Prüfung nicht gefunden')
  return md.slice(0, ende)
}

// ── Die feste Tabelle der Platzhalter ───────────────────────────────────────
//
// Je Platzhalter: genau der Text aus der A005-Datei, die Kennung im Code und
// was die Mail-Datei an seiner Stelle zeigt. Jeder kommt in allen drei Quellen
// gleich oft vor (letzter Test).

/** Reiner Text von Stücken — so, wie die Mail-Datei sie füllt. */
function klartext(stuecke: readonly AgbStueck[]): string {
  return stuecke
    .map((s) => {
      if (typeof s === 'string') return s
      switch (s.art) {
        case 'fett':
          return klartext(s.stuecke)
        case 'kursiv':
        case 'link':
          return s.text
        case 'mail':
          return s.adresse
        case 'platzhalter':
          return klartext(PLATZHALTER_ANGABE(KONTEXT)[s.was])
      }
    })
    .join('')
}

const PLATZHALTER = [
  {
    kennung: 'betreiber',
    text: '[Betreiber laut Impressum, Rechtsform, Anschrift, E-Mail]',
    inDatei: klartext(PLATZHALTER_ANGABE(KONTEXT).betreiber),
    anzahl: 1,
  },
  { kennung: 'email', text: '[E-Mail laut Impressum]', inDatei: klartext(PLATZHALTER_ANGABE(KONTEXT).email), anzahl: 5 },
  { kennung: 'inkrafttreten', text: '[Tag des Inkrafttretens]', inDatei: formatDatumLang(KONTEXT.inkrafttreten!), anzahl: 3 },
  {
    kennung: 'belehrung',
    text: `[Wortlaut aus \`src/lib/widerruf.ts\` (\`BELEHRUNG.teilA\`, Abschnitte „Widerrufsrecht“ und „Folgen des Widerrufs“), nicht abgetippt: das gesetzliche Muster nach Anhang I Teil A FAGG idF BGBl. I Nr. 59/2026 mit dem Satz zur Online-Funktion unter ${PRODUKTION_HOST}/widerruf und dem Platzhalter „[Name, Anschrift, Telefonnummer und E-Mail-Adresse des Hofs]“.]`,
    inDatei: null,
    anzahl: 1,
  },
  {
    kennung: 'formular',
    text: '[Wortlaut aus `src/lib/widerruf.ts` (`BELEHRUNG.teilB`), nicht abgetippt: das gesetzliche Muster nach Anhang I Teil B FAGG mit dem Platzhalter „[Name, Anschrift und E-Mail-Adresse des Hofs]“.]',
    inDatei: null,
    anzahl: 1,
  },
] as const

const marke = (kennung: string): string => `⟦${kennung}⟧`

// ── Reiner Text ──────────────────────────────────────────────────────────────

const leerzeichen = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** Markdown → reiner Text: zuerst die Platzhalter, dann Überschriften, Listen, Tabellen, Trennstriche, Fett, Kursiv, Links. */
function markdownAlsText(md: string): string {
  let text = md
  for (const p of PLATZHALTER) text = text.split(p.text).join(marke(p.kennung))
  text = text
    .split('\n')
    .filter((z) => z.trim() !== '---' && !/^\|(?:-+\|)+$/.test(z.trim()))
    .map((z) =>
      z
        .replace(/^#{1,6} /, '')
        .replace(/^- /, '')
        .replace(/^\| (.*) \|$/, (_, zellen: string) => zellen.split(' | ').join(' '))
    )
    .join('\n')
  // „(*)“ im Muster-Formular ist Text (Fußnotenzeichen des Gesetzes), keine Auszeichnung.
  text = text.split('(*)').join('\u0000')
  text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  text = text.split('\u0000').join('(*)')
  return leerzeichen(text)
}

/** HTML → reiner Text: das Muster und die gefüllten Platzhalter als Marke, Block-Elemente als Leerraum, Inline-Elemente ohne, Entitäten zurück. */
function htmlAlsText(html: string): string {
  let text = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'))
  text = text.replace(/<div class="muster">(.*?)<\/div>/g, (_, innen: string) => marke(innen.includes('<h4>') ? 'belehrung' : 'formular'))
  text = text
    .replace(/<\/?(?:p|h[1-6]|ul|li|table|thead|tbody|tr|th|td|div)(?: [^>]*)?>|<br>/g, ' ')
    .replace(/<\/?(?:strong|em|b|i|a)(?: [^>]*)?>/g, '')
  if (/<[a-z/]/i.test(text)) throw new Error(`Unbekanntes HTML-Element: ${/<[^>]*>/.exec(text)?.[0]}`)
  text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  // Die gefüllten Platzhalter — längste zuerst (der Betreiber enthält die E-Mail-Adresse).
  for (const p of [...PLATZHALTER].filter((p) => p.inDatei !== null).sort((a, b) => b.inDatei!.length - a.inDatei!.length)) {
    text = leerzeichen(text).split(leerzeichen(p.inDatei!)).join(marke(p.kennung))
  }
  return leerzeichen(text)
}

/** Ohne „Kurz erklärt“ (kein Teil der AGB, nicht in der Mail-Datei): vom Abschnitt bis zum nächsten Trennstrich. */
function ohneKurzErklaert(md: string): string {
  const anfang = md.indexOf('## Kurz erklärt')
  const ende = md.indexOf('\n---\n', anfang)
  if (anfang === -1 || ende === -1) throw new Error('„Kurz erklärt“ nicht gefunden')
  return md.slice(0, anfang) + md.slice(ende)
}

/** Die erste Stelle, an der zwei Texte auseinandergehen — mit Umgebung — oder null. */
function ersteAbweichung(a: string, b: string): string | null {
  if (a === b) return null
  let i = 0
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++
  return `Zeichen ${i}\n  A: …${a.slice(Math.max(0, i - 60), i + 60)}…\n  B: …${b.slice(Math.max(0, i - 60), i + 60)}…`
}

const zaehle = (text: string, muster: string): number => text.split(muster).length - 1

describe('AGB 1.0: Freigabe, docs/recht/agb.md und Mail-Datei sind wortgleich (Gegenlesen „Recht“)', () => {
  const freigabe = markdownAlsText(freigabeText())
  const doku = markdownAlsText(bisZuDenHinweisen(AGB_MD))
  const datei = htmlAlsText(agbAlsHtml('1.0', KONTEXT))

  it('docs/recht/agb.md ist der Text der Freigabe — Zeichen für Zeichen', () => {
    expect(ersteAbweichung(freigabe, doku)).toBeNull()
    // Wirklich dieselbe Datei bis auf die Hinweise am Ende, nicht nur nach der Bereinigung.
    expect(bisZuDenHinweisen(AGB_MD).trimEnd()).toBe(freigabeText().trimEnd())
  })

  it('die Mail-Datei ist der Text der Freigabe ohne „Kurz erklärt“ — Zeichen für Zeichen', () => {
    expect(ersteAbweichung(markdownAlsText(ohneKurzErklaert(freigabeText())), datei)).toBeNull()
  })

  it('jeder Platzhalter steht in allen drei Quellen gleich oft — so oft wie in der Tabelle', () => {
    const ohneKurz = markdownAlsText(ohneKurzErklaert(freigabeText()))
    for (const p of PLATZHALTER) {
      expect(zaehle(freigabe, marke(p.kennung)), `${p.kennung} in der Freigabe`).toBe(p.anzahl)
      expect(zaehle(doku, marke(p.kennung)), `${p.kennung} in docs/recht/agb.md`).toBe(p.anzahl)
      expect(zaehle(ohneKurz, marke(p.kennung)), `${p.kennung} ohne Kurz erklärt`).toBe(p.anzahl)
      expect(zaehle(datei, marke(p.kennung)), `${p.kennung} in der Mail-Datei`).toBe(p.anzahl)
    }
  })

  it('Gegenprobe: eine andere Zahl, ein anderes Anführungszeichen oder ein anderer Gedankenstrich fallen auf', () => {
    const html = agbAlsHtml('1.0', KONTEXT)
    const soll = markdownAlsText(ohneKurzErklaert(freigabeText()))
    expect(html).toContain('binnen 14 Tagen')
    expect(ersteAbweichung(soll, htmlAlsText(html.replace('binnen 14 Tagen', 'binnen 15 Tagen')))).not.toBeNull()
    expect(html).toContain('„Werktag“')
    expect(ersteAbweichung(soll, htmlAlsText(html.replace('„Werktag“', '"Werktag"')))).not.toBeNull()
    expect(html).toContain(`Was ${MARKE} ist – und was nicht`)
    expect(ersteAbweichung(soll, htmlAlsText(html.replace(' ist – und was nicht', ' ist - und was nicht')))).not.toBeNull()
  })

  it('Gegenprobe: ein Satz aus dem Muster, der in der Datei fehlt, fällt auf (die Marke steht dann nicht mehr da)', () => {
    const html = agbAlsHtml('1.0', KONTEXT)
    const ohneMuster = html.replace(/<div class="muster">.*?<\/div>/, '<p>Sie haben das Recht.</p>')
    expect(ersteAbweichung(markdownAlsText(ohneKurzErklaert(freigabeText())), htmlAlsText(ohneMuster))).not.toBeNull()
  })
})

describe('AGB 0.9: die eingefrorene Fassung ist ihre Datei (dauerhaft)', () => {
  it('Mail-Datei 0.9 = docs/recht/agb-0.9.md ohne „Kurz erklärt“, Stand-Zeile und Prüfhinweise — Zeichen für Zeichen', () => {
    const md = ohneKurzErklaert(AGB_0_9_MD.slice(0, AGB_0_9_MD.indexOf('\n---\n\n## Hinweise für die anwaltliche Prüfung')))
      .split('\n')
      .filter((z) => !z.startsWith('**Entwurf, Stand'))
      .join('\n')
    const html = agbAlsHtml('0.9', KONTEXT).replace(/<p><i>Fassung 0\.9 – Entwurf, Stand 13\. Oktober 2026<\/i><\/p>/, '')
    expect(ersteAbweichung(markdownAlsText(md), htmlAlsText(html))).toBeNull()
  })
})
