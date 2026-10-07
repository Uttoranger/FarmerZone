/**
 * Wache am Quelltext (Double-Opt-in, Register S11, Nr. 38):
 *  - Empfänger werblicher Mails kommen nur über `WERBEMAIL_EMPFAENGER`
 *    (src/server/abo-anmeldung.ts), nie über `optInEmail: true` allein.
 *  - Den Haken SCHREIBT nur der Knopf: `optInEmail: true` als Wert steht
 *    ausschließlich im Rumpf von `bestaetigeEmailAbo` (Nachbesserung Runde 2).
 *    Setzte ihn ein anderer Weg, gälte ein zurückgesetztes Abo („nie
 *    angefragt") als Bestand und bekäme Werbung ohne Bestätigung.
 * Ausgenommen sind nur Lesestellen: `select`-Zeilen, die Auswahl
 * `EMAIL_ABO_STAND` und der Filter `WERBEMAIL_EMPFAENGER` selbst. Mit Gegenprobe.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it, expect } from 'vitest'

const WURZEL = join(process.cwd(), 'src')

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return dateien(pfad)
    return /\.(ts|tsx)$/.test(name) ? [pfad] : []
  })
}

/** Trifft `optInEmail: true` als Wert — im Filter wie beim Setzen. */
const HAKEN_AN = /\boptInEmail\s*:\s*true\b/

function ohneKommentare(quelltext: string): string {
  return quelltext.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** Schneidet den Block in geschweiften Klammern ab `marke` heraus (samt Marke). */
function ohneBlock(quelltext: string, marke: string): string {
  const start = quelltext.indexOf(marke)
  if (start < 0) return quelltext
  let i = quelltext.indexOf('{', start + marke.length)
  let tiefe = 0
  for (; i < quelltext.length; i++) {
    if (quelltext[i] === '{') tiefe++
    else if (quelltext[i] === '}' && --tiefe === 0) break
  }
  return quelltext.slice(0, start) + quelltext.slice(i + 1)
}

/** Die erlaubten Lesestellen und den Knopf herausnehmen; übrig bleibt, was den Haken sonst nennt. */
function ohneErlaubteStellen(quelltext: string): string {
  let rest = ohneKommentare(quelltext)
  rest = ohneBlock(rest, 'export const WERBEMAIL_EMPFAENGER =')
  rest = ohneBlock(rest, 'export const EMAIL_ABO_STAND =')
  rest = ohneBlock(rest, 'export async function bestaetigeEmailAbo(')
  return rest
}

/** `optInEmail: true` außerhalb eines `select` und außerhalb der erlaubten Stellen. */
function nenntHakenAn(quelltext: string): boolean {
  return ohneErlaubteStellen(quelltext)
    .split('\n')
    .some((zeile) => HAKEN_AN.test(zeile) && !/\bselect\s*:/.test(zeile))
}

const ABO_ANMELDUNG = readFileSync(join(WURZEL, 'server/abo-anmeldung.ts'), 'utf8')

describe('Den Haken setzt nur der Knopf, Empfänger nur über WERBEMAIL_EMPFAENGER', () => {
  it('`optInEmail: true` steht in ganz src/ nur im Filter, in Lesestellen und in bestaetigeEmailAbo', () => {
    const treffer = dateien(WURZEL)
      .map((pfad) => relative(WURZEL, pfad).split('\\').join('/'))
      .filter((rel) => nenntHakenAn(readFileSync(join(WURZEL, rel), 'utf8')))
    expect(treffer).toEqual([])
  })

  it('bestaetigeEmailAbo schreibt den Haken wirklich (die Wache schneidet die richtige Stelle aus)', () => {
    expect(ohneKommentare(ABO_ANMELDUNG)).toMatch(/export async function bestaetigeEmailAbo\([\s\S]*data:\s*\{\s*optInEmail:\s*true/)
    const rest = ohneErlaubteStellen(ABO_ANMELDUNG)
    expect(rest).not.toContain('export async function bestaetigeEmailAbo(')
    // Der Rest der Datei bleibt stehen — es wird nicht zu viel ausgeschnitten.
    expect(rest).toContain('export async function ladeAboBestaetigung(')
    expect(rest).toContain('export async function meldeEmailAboAn(')
  })

  it('der Versand der Beiträge und der Zähler auf „Neuer Beitrag" nehmen den Filter', () => {
    const versand = readFileSync(join(WURZEL, 'server/actions/status-posts.ts'), 'utf8')
    const zaehler = readFileSync(join(WURZEL, 'app/(hof)/status/new/page.tsx'), 'utf8')
    expect(versand).toMatch(/where:\s*\{\s*farmId:\s*farm\.id,\s*\.\.\.WERBEMAIL_EMPFAENGER\s*\}/)
    expect(zaehler).toMatch(/count\(\{\s*where:\s*\{\s*farmId:\s*farm\.id,\s*\.\.\.WERBEMAIL_EMPFAENGER\s*\}/)
  })

  it('Gegenprobe: alter Filter, ein Schreiben außerhalb des Knopfs — auch in abo-anmeldung.ts — schlagen an', () => {
    expect(nenntHakenAn('findMany({\n  where: { farmId: farm.id, optInEmail: true },\n})')).toBe(true)
    expect(nenntHakenAn('count({ where: { farmId, optInEmail:true } })')).toBe(true)
    // Ein zweiter Schreibweg in abo-anmeldung.ts selbst, z. B. in meldeEmailAboAn:
    const mitZweitemWeg = ABO_ANMELDUNG.replace(
      'data: { optInEmail: false, emailOptInAngefragtAm: jetzt, emailOptInBestaetigtAm: null }',
      'data: { optInEmail: true, emailOptInAngefragtAm: jetzt, emailOptInBestaetigtAm: null }'
    )
    expect(mitZweitemWeg).not.toBe(ABO_ANMELDUNG)
    expect(nenntHakenAn(mitZweitemWeg)).toBe(true)
    expect(nenntHakenAn(ABO_ANMELDUNG)).toBe(false)
  })

  it('Gegenprobe: Kommentare und select-Zeilen zählen nicht', () => {
    expect(nenntHakenAn('// früher: optInEmail: true\nconst a = 1')).toBe(false)
    expect(nenntHakenAn('select: { customerEmail: true, optInEmail: true },')).toBe(false)
    expect(HAKEN_AN.test('optInEmail: false')).toBe(false)
  })
})
