/**
 * Fehlertext-Wache (Nr. 176; DESIGN_SYSTEM, „Symbole, Zeiger, Texte").
 *
 * Regel: Ein Fehlertext sagt, was passiert ist und was die Person tun kann;
 * „Pflichtfeld" und „Ungültig" allein sind nicht erlaubt. Eine Landwirtin, die
 * „Ungültige E-Mail-Adresse" liest, weiß nicht, was sie ändern soll.
 *
 * Beweist (Quelltext unter src/schemas, Kommentare zählen nicht): Keine
 * Zeichenkette ist nur „Pflichtfeld", „Erforderlich", „Ungültig" oder „Ungültig"
 * plus ein einziges Wort („Ungültige Uhrzeit"). Was heute noch so dasteht, steht
 * mit Grund in BESTAND — die Liste schrumpft nur: Ein Eintrag, den es nicht mehr
 * gibt, schlägt an, ein neuer Fund auch.
 * Gegenprobe: Text-Attrappen mit den alten Meldungen schlagen an, ganze Sätze nicht.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SCHEMAS = join(process.cwd(), 'src/schemas')

const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`])\/\/.*$/gm, '$1')

/** Zu knapp: nur das Wort, ohne Satz, der sagt, was zu tun ist. */
const ZU_KNAPP = /^(Pflichtfeld|Pflicht|Erforderlich|Required|Invalid|Ungültig(?:e[rsmn]?)?(?:\s+\S+)?)$/i

export function zuKnappeMeldungen(quelltext: string): string[] {
  const funde: string[] = []
  for (const m of ohneKommentare(quelltext).matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    const text = m[2].trim().replace(/[.!]$/, '')
    if (ZU_KNAPP.test(text)) funde.push(m[2])
  }
  return funde
}

/** Altbestand — nur zur Verkleinerung. Jeder Eintrag nennt, warum er (noch) so steht. */
const BESTAND: { datei: string; text: string; grund: string }[] = [
  { datei: 'hofprofil.ts', text: 'Pflichtfeld', grund: 'Hofprofil bearbeiten: Board SterneHofStart (Nr. 174) macht die Felder freiwillig oder gibt ihnen einen Grund.' },
  { datei: 'hofprofil.ts', text: 'Ungültige E-Mail-Adresse', grund: 'Hofprofil bearbeiten: kommt mit Nr. 174 in die Form der Meldungen von hofAnlegenFormularSchema.' },
  { datei: 'register.ts', text: 'Ungültige E-Mail-Adresse.', grund: 'Registrierung gehört zur Anmeldung; die Meldung folgt dem Muster der Kasse, sobald das Formular umgebaut wird.' },
  { datei: 'meldung.ts', text: 'Ungültige E-Mail-Adresse', grund: 'Prüfung auf dem Server für „Problem melden"; das Formular zeigt eigene Sätze an den Feldern.' },
  { datei: 'checkout.ts', text: 'Ungültiges Abholdatum', grund: 'Anfrage an den Server (checkoutRequestSchema): Der Browser schickt nur geprüfte Werte, die Kundin sieht diese Meldung nie.' },
  { datei: 'checkout.ts', text: 'Ungültige Uhrzeit', grund: 'Wie das Abholdatum: nur die Anfrage an den Server, nie am Formular.' },
  { datei: 'pause.ts', text: 'Ungültige Daten', grund: 'Server-Schema der Pause; die Seite zeigt die Fehler der Aktion, nicht diesen Text.' },
]

describe('Gegenprobe', () => {
  it('die alten Kurztexte schlagen an', () => {
    expect(zuKnappeMeldungen(`z.string().min(4, 'Pflichtfeld')`)).toEqual(['Pflichtfeld'])
    expect(zuKnappeMeldungen(`emailSchema("Ungültige E-Mail-Adresse")`)).toEqual(['Ungültige E-Mail-Adresse'])
    expect(zuKnappeMeldungen('x.regex(/a/, `Ungültig`)')).toEqual(['Ungültig'])
    expect(zuKnappeMeldungen(`m('Erforderlich.')`)).toEqual(['Erforderlich.'])
  })

  it('ganze Sätze mit Grund und Handlung schlagen nicht an; Kommentare zählen nicht', () => {
    expect(zuKnappeMeldungen(`m('Bitte gib deinen Namen an – so weiß der Hof, wer abholt.')`)).toEqual([])
    expect(zuKnappeMeldungen(`m('Diese E-Mail-Adresse stimmt nicht ganz – bitte prüf sie.')`)).toEqual([])
    expect(zuKnappeMeldungen(`// 'Pflichtfeld' stand hier\n/* 'Ungültig' */`)).toEqual([])
  })
})

describe('src/schemas', () => {
  const funde = readdirSync(SCHEMAS)
    .filter((d) => d.endsWith('.ts'))
    .flatMap((datei) => zuKnappeMeldungen(readFileSync(join(SCHEMAS, datei), 'utf8')).map((text) => ({ datei, text })))

  it('keine neue zu knappe Meldung: Jeder Fund steht mit Grund im Bestand', () => {
    const neu = funde.filter((f) => !BESTAND.some((b) => b.datei === f.datei && b.text === f.text))
    expect(neu.map((f) => `${f.datei} „${f.text}“`)).toEqual([])
  })

  it('der Bestand schrumpft nur: Ein behobener Eintrag muss aus der Liste', () => {
    const veraltet = BESTAND.filter((b) => !funde.some((f) => f.datei === b.datei && f.text === b.text))
    expect(veraltet.map((b) => `${b.datei} „${b.text}“`)).toEqual([])
  })

  it('jeder Bestandseintrag hat einen Grund in ganzen Worten', () => {
    for (const b of BESTAND) expect(b.grund.split(' ').length, `${b.datei} „${b.text}“`).toBeGreaterThanOrEqual(5)
  })

  it('das Kassen-Schema ist sauber: keine Meldung für die Felder der Kundin ist zu knapp', () => {
    const kasse = readFileSync(join(SCHEMAS, 'checkout.ts'), 'utf8')
    expect(zuKnappeMeldungen(kasse).sort()).toEqual(['Ungültige Uhrzeit', 'Ungültige Uhrzeit', 'Ungültiges Abholdatum'])
  })
})
