/**
 * Datenschutzerklärung, Fassung November 2026 (A006b): Struktur und Kopplung an
 * den Code — nicht der Wortlaut. Den Wortlaut gibt die Projektleitung vor; hier
 * steht, was sich am Code prüfen lässt:
 *
 *  - 18 Abschnitte mit festen Sprungmarken, das Verzeichnis zeigt genau diese;
 *    der alte Anker „umkreissuche“ führt weiter in Abschnitt 11.
 *  - Jede section und jeder Dienstleister in Abschnitt 4 ist markiert, damit die
 *    Prüfliste Recht (und spätere Läufe) sie finden, ohne Text zu suchen.
 *  - Zahlen (Fristen, Aufbewahrung) kommen aus den Konstanten, die sie im Code
 *    setzen — ändert sich eine, fällt der Text hier auf.
 *  - Web Analytics steht genau dann in der Erklärung, wenn der Code es einbindet.
 *  - Der Satz zur Rückbuchung steht wörtlich auf einer Zeile (Lauf 34 Nr. 290
 *    sucht und ersetzt ihn) und nennt den Menschen, der sich die Sperre ansieht.
 *
 * Jede Prüfung läuft einmal an einem kleinen, falschen Stück (Gegenprobe).
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children: ReactNode }) => createElement('div', { 'data-shell': 'kunde' }, children),
}))

import DatenschutzPage from '@/app/(public)/datenschutz/page'
import { CODES_NACH_ABLAUF_TAGE, MAIL_PROTOKOLL_AUFBEWAHREN_TAGE, SITZUNGEN_NACH_ABLAUF_TAGE } from '@/lib/betrieb'
import { SITZUNG_HOECHSTENS_TAGE } from '@/lib/sitzung-dauer'
import { RECHTSTEXT_TEXT } from '@/components/shared/rechtstext-vorlage'

const WURZEL = process.cwd()
const SEITE = 'src/app/(public)/datenschutz/page.tsx'
const lies = (pfad: string): string => readFileSync(join(WURZEL, pfad), 'utf8')
const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const alsText = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ')

const HTML = renderToStaticMarkup(createElement(DatenschutzPage))
const TEXT = alsText(HTML)
const QUELLE = lies(SEITE)

const ANKER = [
  'verantwortliche-stelle',
  'daten',
  'zweck',
  'dienstleister',
  'speicherdauer',
  'rechte',
  'beschwerderecht',
  'cookies',
  'neuigkeiten',
  'kunden-konto',
  'standortsuche',
  'meldungen',
  'postfach',
  'hof-daten',
  'sepa-lastschrift',
  'dpmg',
  'admin-protokoll',
  'server-logs',
]

const DIENSTLEISTER = ['hoefe', 'stripe', 'supabase', 'vercel', 'resend', 'sentry', 'cloudflare', 'osm', 'behoerden']
const MIT_SCC = ['stripe', 'supabase', 'vercel', 'resend', 'sentry', 'cloudflare']

const RUECKBUCHUNG = 'Bucht deine Bank eine Lastschrift zurück'

/** Die Überschriften h2 mit Kennung und Text, in der Reihenfolge der Seite. */
function ueberschriften(html: string): Array<{ anker: string; text: string }> {
  return [...html.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => ({ anker: m[1], text: alsText(m[2]).trim() }))
}

/** Die Einträge des Verzeichnisses (Sprünge auf der Seite), ohne Wiederholung, in Reihenfolge. */
function verzeichnis(html: string): Array<{ anker: string; text: string }> {
  const gesehen = new Map<string, string>()
  for (const m of html.matchAll(/<a[^>]*href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (!gesehen.has(m[1])) gesehen.set(m[1], alsText(m[2]).trim())
  }
  return [...gesehen].map(([anker, text]) => ({ anker, text }))
}

/** Je section: ihr data-abschnitt (oder null) und die Kennung der ersten h2 darin. */
function sektionen(html: string): Array<{ abschnitt: string | null; h2: string | null }> {
  return [...html.matchAll(/<section([^>]*)>([\s\S]*?)<\/section>/g)].map((m) => ({
    abschnitt: m[1].match(/data-abschnitt="([^"]+)"/)?.[1] ?? null,
    h2: m[2].match(/<h2 id="([^"]+)"/)?.[1] ?? null,
  }))
}

/** Der Inhalt der section mit diesem data-abschnitt. */
function sektion(html: string, anker: string): string {
  return html.match(new RegExp(`<section[^>]*data-abschnitt="${anker}"[^>]*>([\\s\\S]*?)</section>`))?.[1] ?? ''
}

/** Die Dienstleister eines Stücks in Reihenfolge, je mit ihrer Grundlage für Drittländer. */
function dienstleister(html: string): Array<{ name: string; grundlage: string | null }> {
  return [...html.matchAll(/<[a-z]+\s([^>]*data-dienstleister="([^"]+)"[^>]*)>/g)].map((m) => ({
    name: m[2],
    grundlage: m[1].match(/data-drittland-grundlage="([^"]+)"/)?.[1] ?? null,
  }))
}

const PLATZHALTER = /\[B\d+\]|\{[A-Z_]+\}|<BESTAETIGT|\[GRUNDLAGE\]|\[ANTHROPIC|Ä\d|A006:/
const STRIPE_LINK = /Stripe Link|Link von Stripe|Link by Stripe/i
const IMPORT_ADMIN_PROTOKOLL = /['"]@\/server\/admin-protokoll['"]/

/** Bindet eine der Dateien (ohne Kommentare) Web Analytics ein? Derselbe Umfang wie die Weiche W1. */
function bindetAnalyticsEin(dateien: Array<{ inhalt: string }>): boolean {
  return dateien.some((d) => /<(Analytics|AnalyticsGefiltert)\b/.test(ohneKommentare(d.inhalt)))
}

function dateienUnter(ordner: string): string[] {
  return readdirSync(join(WURZEL, ordner)).flatMap((name) => {
    const rel = `${ordner}/${name}`
    if (statSync(join(WURZEL, rel)).isDirectory()) return dateienUnter(rel)
    return /\.(ts|tsx)$/.test(name) ? [rel] : []
  })
}

/** Steht die Wortfolge im Quelltext zusammenhängend auf einer Zeile? */
const aufEinerZeile = (quelle: string, satz: string): boolean => quelle.split('\n').some((zeile) => zeile.includes(satz))

/** Der Text des li, in dem die Wortfolge steht (leer, wenn es keines gibt). */
function liMit(html: string, satz: string): string {
  const li = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => alsText(m[1])).find((t) => t.includes(satz))
  return li ?? ''
}

/** Der alte Anker steht in Abschnitt 11, ist keine Überschrift und kein Eintrag im Verzeichnis. */
function umkreisAnkerRichtig(html: string): boolean {
  return (
    /\sid="umkreissuche"/.test(sektion(html, 'standortsuche')) &&
    !/<h2 id="umkreissuche"/.test(html) &&
    !verzeichnis(html).some((e) => e.anker === 'umkreissuche')
  )
}

/** Was an den Dienstleistern in Abschnitt 4 nicht stimmt (leer = alles richtig). */
function maengelDienstleister(html: string): string[] {
  const vier = dienstleister(sektion(html, 'dienstleister'))
  const maengel: string[] = []
  if (vier.map((d) => d.name).join(',') !== DIENSTLEISTER.join(',')) maengel.push(`Reihe: ${vier.map((d) => d.name).join(',')}`)
  if (dienstleister(html).length !== vier.length) maengel.push('Markierung außerhalb von Abschnitt 4')
  for (const d of vier) {
    if (d.grundlage !== (MIT_SCC.includes(d.name) ? 'scc' : null)) maengel.push(`Grundlage ${d.name}: ${d.grundlage}`)
  }
  return maengel
}

/** Steht der Stand aus dem Quelltext als Stand-Zeile im Text? */
function standStimmt(quelle: string, text: string): boolean {
  const stand = quelle.match(/const DATENSCHUTZ_STAND = '([^']+)'/)?.[1]
  return Boolean(stand) && text.includes(RECHTSTEXT_TEXT.stand(stand ?? ''))
}

type Fristen = { sitzungen: number; codes: number; mailProtokoll: number; sitzungHoechstens: number }

/** Welche Frist im HTML nicht mit dem Wert aus dem Code übereinstimmt — je Listenpunkt geprüft, nicht über die ganze Seite. */
function falscheFristen(html: string, w: Fristen): string[] {
  const text = alsText(html)
  const falsch: string[] = []
  if (!liMit(html, 'Sitzungen samt IP-Adresse').includes(`bis ${w.sitzungen} Tage nach ihrem Ablauf`)) falsch.push('sitzungen')
  if (!liMit(html, 'Anmeldecodes').includes(`Anmeldecodes: ${w.codes} Tag nach Ablauf`)) falsch.push('codes')
  if (!liMit(html, 'Versandprotokoll der E-Mails').includes(`: ${w.mailProtokoll} Tage`)) falsch.push('mailProtokoll')
  if (!text.includes(`höchstens aber ${w.sitzungHoechstens} Tage ab der Anmeldung`)) falsch.push('sitzungHoechstens')
  return falsch
}

/** Ist das Literal der Seite gleich ADMIN_PROTOKOLL_JAHRE, und steht die Zahl an beiden Stellen im Text? */
function adminJahreStimmen(quelleSeite: string, quelleProtokoll: string, html: string): boolean {
  const imCode = quelleProtokoll.match(/export const ADMIN_PROTOKOLL_JAHRE = (\d+)/)?.[1]
  const aufDerSeite = quelleSeite.match(/const ADMIN_PROTOKOLL_JAHRE_SEITE = (\d+)/)?.[1]
  if (!imCode || aufDerSeite !== imCode) return false
  return (
    liMit(html, 'Protokoll im Admin-Bereich:').includes(`Protokoll im Admin-Bereich: ${imCode} Jahre`) &&
    alsText(sektion(html, 'admin-protokoll')).includes(`löschen sie nach ${imCode} Jahren`)
  )
}

const FRISTEN: Fristen = {
  sitzungen: SITZUNGEN_NACH_ABLAUF_TAGE,
  codes: CODES_NACH_ABLAUF_TAGE,
  mailProtokoll: MAIL_PROTOKOLL_AUFBEWAHREN_TAGE,
  sitzungHoechstens: SITZUNG_HOECHSTENS_TAGE,
}

describe('Datenschutzerklärung — 18 Abschnitte mit festen Sprungmarken', () => {
  it('die Überschriften sind die 18 Abschnitte in dieser Reihenfolge, nummeriert von 1 bis 18', () => {
    const h2 = ueberschriften(HTML)
    expect(h2.map((u) => u.anker)).toEqual(ANKER)
    h2.forEach((u, i) => expect(u.text.startsWith(`${i + 1}. `), u.text).toBe(true))
  })

  it('das Verzeichnis zeigt genau diese Überschriften, mit demselben Text', () => {
    expect(verzeichnis(HTML)).toEqual(ueberschriften(HTML))
    expect(HTML).toContain(RECHTSTEXT_TEXT.abschnitte(18))
  })

  it('der alte Anker „umkreissuche“ führt in Abschnitt 11, ist aber keine Überschrift und kein Eintrag im Verzeichnis', () => {
    expect(umkreisAnkerRichtig(HTML)).toBe(true)
  })

  it('Gegenprobe: umkreissuche als h2, im Verzeichnis oder außerhalb von Abschnitt 11 fällt auf', () => {
    const elf = (innen: string) => `<section data-abschnitt="standortsuche"><h2 id="standortsuche">11. Ort</h2>${innen}</section>`
    expect(umkreisAnkerRichtig(elf('<span id="umkreissuche"></span>'))).toBe(true)
    expect(umkreisAnkerRichtig(elf('<h2 id="umkreissuche">Umkreis</h2>'))).toBe(false)
    expect(umkreisAnkerRichtig(`<a href="#umkreissuche">Umkreis</a>${elf('<span id="umkreissuche"></span>')}`)).toBe(false)
    expect(umkreisAnkerRichtig(`${elf('')}<span id="umkreissuche"></span>`)).toBe(false)
  })

  it('jede section trägt data-abschnitt mit der Kennung ihrer Überschrift', () => {
    const alle = sektionen(HTML)
    expect(alle).toHaveLength(18)
    for (const s of alle) expect(s.abschnitt, String(s.h2)).toBe(s.h2)
  })

  it('Gegenprobe: falsche Reihenfolge, fehlender Verzeichniseintrag und section ohne Markierung fallen auf', () => {
    const falsch =
      '<a href="#daten">2. Daten</a>' +
      '<section aria-labelledby="daten"><h2 id="daten">2. Daten</h2></section>' +
      '<section data-abschnitt="zweck"><h2 id="verantwortliche-stelle">1. Stelle</h2></section>'
    expect(ueberschriften(falsch).map((u) => u.anker)).not.toEqual(ANKER.slice(0, 2))
    expect(verzeichnis(falsch)).not.toEqual(ueberschriften(falsch))
    expect(sektionen(falsch).some((s) => s.abschnitt !== s.h2)).toBe(true)
  })
})

describe('Abschnitt 4 — Dienstleister und Grundlagen für Drittländer', () => {
  it('die Dienstleister stehen markiert in dieser Reihenfolge, Anthropic nicht; Standardvertragsklauseln genau bei den sechs Diensten mit Übermittlung in die USA', () => {
    expect(maengelDienstleister(HTML)).toEqual([])
    expect(HTML).not.toMatch(/data-dienstleister="anthropic"/)
  })

  it('Gegenprobe: ein zusätzlicher Dienst, eine fehlende und eine überzählige Grundlage fallen auf', () => {
    const eintrag = (name: string, scc: boolean) =>
      `<div data-dienstleister="${name}"${scc ? ' data-drittland-grundlage="scc"' : ''}></div>`
    const richtig = DIENSTLEISTER.map((n) => eintrag(n, MIT_SCC.includes(n)))
    const vier = (eintraege: string[]) => `<section data-abschnitt="dienstleister">${eintraege.join('')}</section>`
    expect(maengelDienstleister(vier(richtig))).toEqual([])
    expect(maengelDienstleister(vier([...richtig, eintrag('anthropic', true)]))).not.toEqual([])
    expect(maengelDienstleister(vier([eintrag('hoefe', false), eintrag('stripe', false), ...richtig.slice(2)]))).toEqual(['Grundlage stripe: null'])
    expect(maengelDienstleister(vier([eintrag('hoefe', true), ...richtig.slice(1)]))).toEqual(['Grundlage hoefe: scc'])
  })
})

describe('Kein Platzhalter, kein Entwurf, kein Stripe Link', () => {
  it('die Seite enthält keine Markierung des Auftrags und keinen Platzhalter', () => {
    expect(HTML).not.toMatch(PLATZHALTER)
    expect(TEXT).not.toMatch(/Entwurf/)
  })

  it('Stripe Link wird nicht genannt (im Dashboard aus)', () => {
    expect(TEXT).not.toMatch(STRIPE_LINK)
  })

  it('Gegenprobe: Platzhalter und Stripe Link werden gefunden', () => {
    for (const stueck of ['Grundlage: [GRUNDLAGE].', 'B2 [B2]', '{MARKE} speichert', '[Ä3] Satz', 'A006: alt', '[ANTHROPIC]']) {
      expect(stueck).toMatch(PLATZHALTER)
    }
    expect('Bezahlen mit Link von Stripe').toMatch(STRIPE_LINK)
  })
})

describe('Stand und Zahlen kommen aus dem Code', () => {
  it('die Stand-Zeile zeigt den Wert von DATENSCHUTZ_STAND aus der Seite', () => {
    expect(standStimmt(QUELLE, TEXT)).toBe(true)
  })

  it('Gegenprobe: ein anderer Stand in der Zeile oder ein fehlender Wert in der Quelle fällt auf', () => {
    expect(standStimmt("const DATENSCHUTZ_STAND = 'November 2026'", 'Stand: November 2026')).toBe(true)
    expect(standStimmt("const DATENSCHUTZ_STAND = 'November 2026'", 'Stand: Oktober 2026')).toBe(false)
    expect(standStimmt('const STAND = 1', 'Stand: November 2026')).toBe(false)
  })

  it('Fristen aus betrieb.ts und sitzung-dauer.ts stehen so im Text, jede in ihrem Punkt', () => {
    expect(falscheFristen(HTML, FRISTEN)).toEqual([])
  })

  it('Gegenprobe: eine falsche Zahl fällt auf, auch wenn ein anderer Punkt dieselbe Zahl trägt', () => {
    const stueck = (mail: number) =>
      '<ul><li>Sitzungen samt IP-Adresse: bis 7 Tage nach ihrem Ablauf.</li><li>Anmeldecodes: 1 Tag nach Ablauf.</li>' +
      `<li>Versandprotokoll der E-Mails (Prüfwert): ${mail} Tage.</li><li>Erledigte Meldungen: 90 Tage.</li></ul>` +
      '<p>höchstens aber 30 Tage ab der Anmeldung.</p>'
    const werte: Fristen = { sitzungen: 7, codes: 1, mailProtokoll: 90, sitzungHoechstens: 30 }
    expect(falscheFristen(stueck(90), werte)).toEqual([])
    expect(falscheFristen(stueck(60), werte)).toEqual(['mailProtokoll'])
    expect(falscheFristen(stueck(90), { ...werte, sitzungen: 14, sitzungHoechstens: 31 })).toEqual(['sitzungen', 'sitzungHoechstens'])
  })

  it('die Jahre des Admin-Protokolls sind gleich ADMIN_PROTOKOLL_JAHRE (aus dem Quelltext gelesen, die Datei lädt Prisma)', () => {
    expect(adminJahreStimmen(QUELLE, lies('src/server/admin-protokoll.ts'), HTML)).toBe(true)
  })

  it('Gegenprobe: ein abweichendes Literal oder eine andere Zahl im Text fällt auf', () => {
    const html = (jahre: number) =>
      `<ul><li>Protokoll im Admin-Bereich: ${jahre} Jahre (Abschnitt 17).</li></ul>` +
      `<section data-abschnitt="admin-protokoll"><p>löschen sie nach ${jahre} Jahren.</p></section>`
    const protokoll = 'export const ADMIN_PROTOKOLL_JAHRE = 5'
    expect(adminJahreStimmen('const ADMIN_PROTOKOLL_JAHRE_SEITE = 5', protokoll, html(5))).toBe(true)
    expect(adminJahreStimmen('const ADMIN_PROTOKOLL_JAHRE_SEITE = 6', protokoll, html(6))).toBe(false)
    expect(adminJahreStimmen('const ADMIN_PROTOKOLL_JAHRE_SEITE = 5', protokoll, html(7))).toBe(false)
  })

  it('die Seite importiert admin-protokoll.ts nicht', () => {
    expect(ohneKommentare(QUELLE)).not.toMatch(IMPORT_ADMIN_PROTOKOLL)
  })

  it('Gegenprobe: ein Import von admin-protokoll.ts fällt auf, der Anker gleichen Namens nicht', () => {
    expect("import { ADMIN_PROTOKOLL_JAHRE } from '@/server/admin-protokoll'").toMatch(IMPORT_ADMIN_PROTOKOLL)
    expect("await import('@/server/admin-protokoll')").toMatch(IMPORT_ADMIN_PROTOKOLL)
    expect("{ anker: 'admin-protokoll' }").not.toMatch(IMPORT_ADMIN_PROTOKOLL)
  })
})

describe('Web Analytics folgt dem Code', () => {
  it('„Vercel Web Analytics“ steht genau dann im Text, wenn eine Datei unter src/app es einbindet', () => {
    const eingebunden = bindetAnalyticsEin(dateienUnter('src/app').map((d) => ({ inhalt: lies(d) })))
    expect(TEXT.includes('Vercel Web Analytics')).toBe(eingebunden)
  })

  it('Gegenprobe: eingebunden wird erkannt, ein Kommentar zählt nicht', () => {
    expect(bindetAnalyticsEin([{ inhalt: '<body><AnalyticsGefiltert /></body>' }])).toBe(true)
    expect(bindetAnalyticsEin([{ inhalt: '<Analytics mode="x" />' }])).toBe(true)
    expect(bindetAnalyticsEin([{ inhalt: '// früher: <AnalyticsGefiltert />\n<body />' }])).toBe(false)
    expect(bindetAnalyticsEin([{ inhalt: '<AnalyticsKarte />' }])).toBe(false)
  })
})

describe('Rückbuchung — der Satz für Lauf 34 Nr. 290', () => {
  it('die Wortfolge steht im Quelltext auf einer Zeile', () => {
    expect(aufEinerZeile(QUELLE, RUECKBUCHUNG)).toBe(true)
  })

  it('der Punkt mit der Wortfolge nennt den Menschen, der sich die Sperre ansieht', () => {
    expect(liMit(HTML, RUECKBUCHUNG)).toContain('Mensch')
  })

  it('Gegenprobe: umbrochene Wortfolge und ein Punkt ohne Mensch fallen auf', () => {
    expect(aufEinerZeile('Bucht deine Bank eine\nLastschrift zurück', RUECKBUCHUNG)).toBe(false)
    expect(liMit(`<li>${RUECKBUCHUNG}, nimmt dein Hof nichts an.</li><li>Ein Mensch</li>`, RUECKBUCHUNG)).not.toContain('Mensch')
  })
})
