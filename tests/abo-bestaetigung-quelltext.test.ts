/**
 * Wache am Quelltext (Double-Opt-in, Register S11, Nr. 38): Empfänger
 * werblicher Mails kommen nur über `WERBEMAIL_EMPFAENGER`
 * (src/server/abo-anmeldung.ts) — nie über `optInEmail: true` allein. Sonst
 * bekäme eine angefragte, unbestätigte Anmeldung doch Werbung, sobald der
 * Haken irgendwo gesetzt ist.
 *
 * Einzige Stelle mit `optInEmail: true` ist abo-anmeldung.ts selbst (Filter
 * und das Setzen beim Bestätigen). Dazu: Wer `customerFarmSubscription`
 * nach `optInEmail` filtert, nimmt den Filter. Mit Gegenprobe.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it, expect } from 'vitest'

const WURZEL = join(process.cwd(), 'src')
const ERLAUBT = new Set(['server/abo-anmeldung.ts'])

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

/** `optInEmail: true` außerhalb eines `select` — ein `select` liest nur, er wählt niemanden aus. */
function filtertNachHaken(quelltext: string): boolean {
  return ohneKommentare(quelltext)
    .split('\n')
    .some((zeile) => HAKEN_AN.test(zeile) && !/\bselect\s*:/.test(zeile))
}

describe('Empfänger werblicher Mails nur über WERBEMAIL_EMPFAENGER', () => {
  it('`optInEmail: true` (außerhalb eines select) steht nur in src/server/abo-anmeldung.ts', () => {
    const treffer = dateien(WURZEL)
      .map((pfad) => relative(WURZEL, pfad).split('\\').join('/'))
      .filter((rel) => !ERLAUBT.has(rel))
      .filter((rel) => filtertNachHaken(readFileSync(join(WURZEL, rel), 'utf8')))
    expect(treffer).toEqual([])
  })

  it('der Versand der Beiträge und der Zähler auf „Neuer Beitrag" nehmen den Filter', () => {
    const versand = readFileSync(join(WURZEL, 'server/actions/status-posts.ts'), 'utf8')
    const zaehler = readFileSync(join(WURZEL, 'app/(hof)/status/new/page.tsx'), 'utf8')
    expect(versand).toMatch(/where:\s*\{\s*farmId:\s*farm\.id,\s*\.\.\.WERBEMAIL_EMPFAENGER\s*\}/)
    expect(zaehler).toMatch(/count\(\{\s*where:\s*\{\s*farmId:\s*farm\.id,\s*\.\.\.WERBEMAIL_EMPFAENGER\s*\}/)
  })

  it('Gegenprobe: die Suche erkennt den alten Filter, ein Kommentar zählt nicht', () => {
    expect(HAKEN_AN.test("where: { farmId: farm.id, optInEmail: true },")).toBe(true)
    expect(HAKEN_AN.test('count({ where: { farmId, optInEmail:true } })')).toBe(true)
    expect(filtertNachHaken('// früher: optInEmail: true\nconst a = 1')).toBe(false)
    expect(filtertNachHaken("select: { customerEmail: true, optInEmail: true },")).toBe(false)
    expect(filtertNachHaken("findMany({\n  where: { farmId: farm.id, optInEmail: true },\n})")).toBe(true)
    expect(HAKEN_AN.test('optInEmail: false')).toBe(false)
  })
})
