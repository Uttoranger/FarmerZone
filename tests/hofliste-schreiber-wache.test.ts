/**
 * Wache: Jede Server-Action, die etwas schreibt, das die Hofliste zeigt,
 * erneuert ihren Zwischenspeicher sofort (Register N24-Ergänzung 22.10.2026, Nr. 137).
 *
 * Ursache: /hoefe und die Startseite lesen die Hofliste aus EINEM Eintrag unter
 * `HOEFE_CACHE_TAG` (fünf Minuten, `ladeOeffentlicheHoefe`). `revalidatePath`
 * erreicht ihn nicht. Bis Nr. 137 fehlte `updateTag(HOEFE_CACHE_TAG)` in 14
 * Actions — Pause, Abholzeiten, Name, Fotos, Titelbild, Stilllegung und eine
 * entzogene Freigabe standen bis zu fünf Minuten zu spät auf der Liste.
 *
 * Beweist (Quelltext von `src/server/actions/`, TypeScript-Syntaxbaum): Jede
 * exportierte Funktion, die — über `prisma` oder einen Transaktions-Client,
 * gleich wie er heißt, auch im Rückruf einer Transaktion —
 *  - `pickupSlot.` oder `farmPhoto.` mit `create`, `createMany`, `update`,
 *    `updateMany`, `delete`, `deleteMany` oder `upsert` aufruft, oder
 *  - `farm.update`/`farm.updateMany` mit einem Feld der Liste (`LISTEN_FELDER`)
 *    im `data`-Objekt (auch in Kurzform `{ isPaused }` und in Spreads von
 *    Objekt-Literalen: `...(x && { bannerUrl })`, `...(b ? { latitude } : {})`),
 * ruft `updateTag(HOEFE_CACHE_TAG)` direkt in ihrem eigenen Körper — nicht in
 * einem Rückruf darin (der Rückruf einer Transaktion liefe vor dem Commit).
 * Ausnahmen stehen je Funktion mit Grund in `AUSNAHMEN`; ein Eintrag, der nicht
 * mehr gebraucht wird, macht die Wache rot.
 *
 * Nicht gesehen (Näherung ohne TypeChecker): Schreiben in nicht exportierten
 * Helfern (z. B. `schreibeAusschnitt` in bild-ausschnitt.ts) und in Modulen
 * außerhalb von `src/server/actions/`, ein `data` aus einer Variablen und der
 * Spread einer Variablen (`...profil` in `updateProfile` — dort findet sie den
 * Kartenpunkt). Ob `updateTag` NACH dem Schreiben steht, prüft
 * tests/hofliste-schreiber-actions.test.ts je Action.
 *
 * Gegenprobe: Text-Attrappen mit `prisma.pickupSlot.create`, mit
 * `farm.update({ data: { isPaused } })` und mit
 * `farm.update({ data: { ...(neu && { bannerUrl: neu }) } })` ohne `updateTag`
 * schlagen an, ebenso ein Aufruf nur im Transaktions-Rückruf; der richtige
 * Aufbau, ein lesendes `where` und ein Feld, das die Liste nicht zeigt, nicht.
 * Keine Datei im Repository wird dafür verändert.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const ORDNER = join(WURZEL, 'src', 'server', 'actions')

/** Modelle, deren Zeilen die Hofliste zeigt (Abholzeiten, die ersten vier Fotos). */
const LISTEN_MODELLE = new Set(['pickupSlot', 'farmPhoto'])
const SCHREIB_METHODEN = new Set(['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'])
const HOF_METHODEN = new Set(['update', 'updateMany'])
/** Felder des Hofs, die die Hofliste zeigt oder nach denen sie auswählt (UEBERSICHT_HOF_SELECT, Sichtbarkeit). */
const LISTEN_FELDER = new Set([
  'isPaused',
  'archivedAt',
  'approvedAt',
  'istTesthof',
  'name',
  'city',
  'postalCode',
  'latitude',
  'longitude',
  'logoUrl',
  'bannerUrl',
  'bannerType',
])

/** Ausnahmen je Funktion (`Datei#Name`), jede mit Grund. */
const AUSNAHMEN: Record<string, string> = {
  'src/server/actions/onboarding.ts#createOnboardingSlots': 'ohne Aufrufer in src/ (Stand 22.10.2026)',
  'src/server/actions/farm-photos.ts#updateFarmPhotoCaptionAction': 'schreibt nur `caption`, die die Hofliste nicht liest',
  'src/server/actions/gruendung.ts#markiereAlsTesthof': '`updateTag(HOEFE_CACHE_TAG)` über `revalidiereTesthof` → `revalidiereGruendung`',
  'src/server/actions/gruendung.ts#nimmTesthofZurueck': '`updateTag(HOEFE_CACHE_TAG)` über `revalidiereTesthof` → `revalidiereGruendung`',
}

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

function eigenschaftsName(name: ts.PropertyName): string | null {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null
}

function ohneHuelle(ausdruck: ts.Expression): ts.Expression {
  let a = ausdruck
  while (ts.isParenthesizedExpression(a) || ts.isAsExpression(a) || ts.isSatisfiesExpression(a)) a = a.expression
  return a
}

/** Die Feldnamen in einem `data`-Ausdruck — samt Kurzform und Spreads von Objekt-Literalen. */
function felderIn(ausdruck: ts.Expression): string[] {
  const a = ohneHuelle(ausdruck)
  if (ts.isObjectLiteralExpression(a)) {
    return a.properties.flatMap((e) => {
      if (ts.isPropertyAssignment(e)) return [eigenschaftsName(e.name) ?? '']
      if (ts.isShorthandPropertyAssignment(e)) return [e.name.text]
      if (ts.isSpreadAssignment(e)) return felderIn(e.expression)
      return []
    })
  }
  if (ts.isBinaryExpression(a)) {
    const art = a.operatorToken.kind
    if (art === ts.SyntaxKind.AmpersandAmpersandToken) return felderIn(a.right)
    if (art === ts.SyntaxKind.BarBarToken || art === ts.SyntaxKind.QuestionQuestionToken) return [...felderIn(a.left), ...felderIn(a.right)]
  }
  if (ts.isConditionalExpression(a)) return [...felderIn(a.whenTrue), ...felderIn(a.whenFalse)]
  return []
}

function datenVon(aufruf: ts.CallExpression): ts.Expression | null {
  const erstes = aufruf.arguments[0]
  if (!erstes || !ts.isObjectLiteralExpression(ohneHuelle(erstes))) return null
  for (const e of (ohneHuelle(erstes) as ts.ObjectLiteralExpression).properties) {
    if (ts.isPropertyAssignment(e) && eigenschaftsName(e.name) === 'data') return e.initializer
  }
  return null
}

/** Schreibt dieser Aufruf etwas, das die Hofliste zeigt? `<Client>.<modell>.<methode>(…)`, der Client gleich welcher. */
function schreibtListe(aufruf: ts.CallExpression): boolean {
  const methode = aufruf.expression
  if (!ts.isPropertyAccessExpression(methode) || !ts.isPropertyAccessExpression(methode.expression)) return false
  const modell = methode.expression.name.text
  if (LISTEN_MODELLE.has(modell)) return SCHREIB_METHODEN.has(methode.name.text)
  if (modell !== 'farm' || !HOF_METHODEN.has(methode.name.text)) return false
  const daten = datenVon(aufruf)
  return daten !== null && felderIn(daten).some((feld) => LISTEN_FELDER.has(feld))
}

function istFunktion(knoten: ts.Node): knoten is ts.FunctionLikeDeclaration {
  return ts.isFunctionDeclaration(knoten) || ts.isFunctionExpression(knoten) || ts.isArrowFunction(knoten) || ts.isMethodDeclaration(knoten)
}

function naechsteFunktion(knoten: ts.Node): ts.Node | null {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) if (istFunktion(k)) return k
  return null
}

function istExportiert(knoten: ts.Node): boolean {
  return ts.canHaveModifiers(knoten) && (ts.getModifiers(knoten) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

/** Die exportierten Funktionen einer Datei: `export (async) function x` und `export const x = (async) (…) => …`. */
function exportierteFunktionen(datei: ts.SourceFile): Array<{ name: string; funktion: ts.FunctionLikeDeclaration }> {
  const liste: Array<{ name: string; funktion: ts.FunctionLikeDeclaration }> = []
  for (const anweisung of datei.statements) {
    if (!istExportiert(anweisung)) continue
    if (ts.isFunctionDeclaration(anweisung) && anweisung.name) liste.push({ name: anweisung.name.text, funktion: anweisung })
    if (ts.isVariableStatement(anweisung)) {
      for (const d of anweisung.declarationList.declarations) {
        const wert = d.initializer && ohneHuelle(d.initializer)
        if (ts.isIdentifier(d.name) && wert && (ts.isArrowFunction(wert) || ts.isFunctionExpression(wert))) liste.push({ name: d.name.text, funktion: wert })
      }
    }
  }
  return liste
}

type Befund = { funktion: string; erneuert: boolean }

/** Alle exportierten Funktionen, die etwas schreiben, das die Hofliste zeigt — und ob sie sie direkt erneuern. */
function hoflisteSchreiber(quelltext: string, pfad = 'schnipsel.ts'): Befund[] {
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const befunde: Befund[] = []
  for (const { name, funktion } of exportierteFunktionen(datei)) {
    let schreibt = false
    let erneuert = false
    const besuche = (k: ts.Node): void => {
      if (ts.isCallExpression(k)) {
        if (schreibtListe(k)) schreibt = true
        const [erstes] = k.arguments
        if (
          ts.isIdentifier(k.expression) &&
          k.expression.text === 'updateTag' &&
          erstes !== undefined &&
          ts.isIdentifier(erstes) &&
          erstes.text === 'HOEFE_CACHE_TAG' &&
          naechsteFunktion(k) === funktion
        ) {
          erneuert = true
        }
      }
      ts.forEachChild(k, besuche)
    }
    if (funktion.body) besuche(funktion.body)
    if (schreibt) befunde.push({ funktion: `${pfad}#${name}`, erneuert })
  }
  return befunde
}

describe('Wache: jede Action, die etwas schreibt, das die Hofliste zeigt, erneuert sie sofort', () => {
  // Parst jede Datei unter src/server/actions (Freigabe Lauf 21 §2: Zeitgrenze an genau diesem it).
  it('jede solche exportierte Action in src/server/actions ruft updateTag(HOEFE_CACHE_TAG), Ausnahmen nur mit Grund', () => {
    const alle: Befund[] = []
    for (const pfad of quelldateien(ORDNER)) {
      alle.push(...hoflisteSchreiber(readFileSync(pfad, 'utf8'), relative(WURZEL, pfad).split(sep).join('/')))
    }
    const funktionen = alle.map((b) => b.funktion)

    // Die Suche findet die bekannten Wege in jeder ihrer Formen (sonst bewiese „keine Lücke“ nichts):
    // Kurzform, Spread mit Bedingung, Transaktions-Client im Rückruf, Liste in $transaction, Fotos, Admin.
    for (const bekannt of [
      'src/server/actions/farm.ts#setPause',
      'src/server/actions/farm.ts#updateProfile',
      'src/server/actions/farm.ts#togglePickupSlotActive',
      'src/server/actions/appearance.ts#saveAppearanceAction',
      'src/server/actions/farm-archive.ts#reactivateFarm',
      'src/server/actions/farm-photos.ts#reorderPhotosAction',
      'src/server/actions/admin.ts#revokeFarmApprovalAction',
    ]) {
      expect(funktionen).toContain(bekannt)
    }

    const ohneErneuern = alle.filter((b) => !b.erneuert).map((b) => b.funktion)
    expect(ohneErneuern.filter((f) => !(f in AUSNAHMEN)), 'ohne updateTag(HOEFE_CACHE_TAG)').toEqual([])
    expect(Object.keys(AUSNAHMEN).filter((f) => !ohneErneuern.includes(f)), 'veraltete Ausnahme').toEqual([])
  }, 30_000)

  it('Gegenprobe: neue Funktionen ohne updateTag schlagen an — Abholzeit, Pause in Kurzform, Titelbild im bedingten Spread', () => {
    const abholzeit = `export async function a(farmId: string) {
      await prisma.pickupSlot.create({ data: { farmId, dayOfWeek: 1, startTime: '09:00', endTime: '12:00' } })
    }`
    const pause = `export async function b(id: string, isPaused: boolean) {
      await prisma.farm.update({ where: { id }, data: { isPaused } })
    }`
    const titelbild = `export const c = async (id: string, neu: string | null) => {
      await prisma.farm.update({ where: { id }, data: { ...(neu && { bannerUrl: neu }) } })
    }`
    for (const attrappe of [abholzeit, pause, titelbild]) {
      expect(hoflisteSchreiber(attrappe), attrappe).toEqual([{ funktion: expect.any(String), erneuert: false }])
    }
  })

  it('Gegenprobe: ein updateTag nur im Rückruf der Transaktion zählt nicht, ein Kartenpunkt im Bedingungs-Spread wird gesehen', () => {
    const imRueckruf = `export async function d(id: string) {
      await prisma.$transaction(async (db) => {
        await db.farm.updateMany({ where: { id }, data: { archivedAt: null } })
        updateTag(HOEFE_CACHE_TAG)
      })
    }`
    const kartenpunkt = `export async function e(id: string, lat: number | null) {
      await prisma.farm.update({ where: { id }, data: { ...(lat !== null ? { latitude: lat } : {}) } })
    }`
    expect(hoflisteSchreiber(imRueckruf)).toEqual([{ funktion: 'schnipsel.ts#d', erneuert: false }])
    expect(hoflisteSchreiber(kartenpunkt)).toEqual([{ funktion: 'schnipsel.ts#e', erneuert: false }])
  })

  it('Gegenprobe: der richtige Aufbau, ein lesendes where und ein Feld, das die Liste nicht zeigt, schlagen nicht an', () => {
    const richtig = `export async function f(id: string) {
      await prisma.$transaction(async (tx) => {
        await tx.farm.update({ where: { id }, data: { archivedAt: null } })
      })
      updateTag(HOEFE_CACHE_TAG)
    }`
    const lesend = `export async function g(id: string) {
      return prisma.farm.findMany({ where: { id, isPaused: false } })
    }`
    const andererWert = `export async function h(id: string) {
      await prisma.farm.update({ where: { id, isPaused: false }, data: { serviceFeePercent: 5 } })
    }`
    const nichtExportiert = `async function i(id: string) {
      await prisma.pickupSlot.deleteMany({ where: { id } })
    }`
    expect(hoflisteSchreiber(richtig)).toEqual([{ funktion: 'schnipsel.ts#f', erneuert: true }])
    expect(hoflisteSchreiber(lesend)).toEqual([])
    expect(hoflisteSchreiber(andererWert)).toEqual([])
    expect(hoflisteSchreiber(nichtExportiert)).toEqual([])
  })
})
