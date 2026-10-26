/**
 * farmId-Wache für Schreibzugriffe in Server Actions (Nr. 178; ARCHITECTURE §3 „Besitz in der WHERE-Klausel").
 *
 * Ursache: Eine Hof-Action, die eine Zeile nur über ihre Kennung ändert (`where: { id }`), verlässt sich auf eine
 * Prüfung davor — liest sie zwischen Prüfen und Schreiben etwas anderes oder fehlt die Prüfung in einer neuen
 * Action, ändert sie die Zeile eines fremden Hofs. Die Regel „Besitz in der WHERE, nie in einem vorgelagerten if"
 * hatte keine Prüfung.
 *
 * Beweist (Quelltext von `src/server/actions/`, TypeScript-Syntaxbaum, kein Netz): Jedes `update`, `updateMany`,
 * `delete` und `deleteMany` auf einem Modell mit der Spalte `farmId` (gelesen aus prisma/schema.prisma) nennt
 * `farmId` in seiner WHERE — auch über eine Konstante derselben Funktion (`const basis = { id, farmId }`,
 * `where: basis` bzw. `{ ...basis }`). Wer es nicht tut, steht in FARMID_BESTAND (Datei, Funktion, Aufruf, Anzahl,
 * Grund). Der Bestand schrumpft: Ein Eintrag, dessen Stelle nicht mehr (oder seltener) vorkommt, macht die Wache
 * rot. Kommentare zählen nicht.
 *
 * GRENZE: Schreiben auf `Farm` selbst (`where: { id: farm.id }`, die Kennung aus der Sitzung) und auf Modelle ohne
 * `farmId` (Konto, Sitzung, Passkey …; dort gilt `userId` in der WHERE) prüft diese Wache nicht. Ob der Wert von
 * `farmId` aus der Sitzung stammt, sieht sie nicht — nur, dass die Spalte in der Bedingung steht.
 *
 * Gegenprobe (Text-Attrappen): `where: { id }`, eine Konstante ohne farmId und farmId nur im Kommentar schlagen an;
 * `where: { id, farmId }`, eine Konstante mit farmId, ein Aufbreiten davon und ein Modell ohne farmId nicht.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const ORDNER = join(WURZEL, 'src/server/actions')

type Stelle = { datei: string; funktion: string; aufruf: string }
type Eintrag = Stelle & { anzahl: number; grund: string }

const ADMIN = 'Admin-Action hinter verlangeAdminAktion bzw. der frischen Bestätigung: Betreiber ändern Zeilen jedes Hofs'
const TOKEN = 'Kein Hof angemeldet: die Bestellung bestimmt ein signiertes Token aus der Mail, bedingt geschrieben'
const VORAB = 'Altbestand vor Nr. 178: Besitz vorher mit farmId gelesen (findFirst/findUnique), geschrieben nur über die Kennung; farmId in die WHERE nachziehen'

/** Schreibzugriffe auf Modelle mit farmId ohne farmId in der WHERE. Nur schrumpfen. */
const FARMID_BESTAND: readonly Eintrag[] = [
  { datei: 'admin.ts', funktion: 'triageMeldungAction', aufruf: 'meldung.updateMany', anzahl: 1, grund: ADMIN },
  { datei: 'admin.ts', funktion: 'setzeBuendelStandAction', aufruf: 'meldung.updateMany', anzahl: 3, grund: ADMIN },
  { datei: 'admin.ts', funktion: 'legeMeldungAbAction', aufruf: 'meldung.updateMany', anzahl: 1, grund: ADMIN },
  { datei: 'bar-bestaetigung.ts', funktion: 'bestaetigeBarBestellung', aufruf: 'order.updateMany', anzahl: 1, grund: TOKEN },
  { datei: 'bar-bestaetigung.ts', funktion: 'sendeBarLinkErneut', aufruf: 'order.updateMany', anzahl: 1, grund: TOKEN },
  { datei: 'betrieb.ts', funktion: 'schickeMailJetztAction', aufruf: 'mailAuftrag.updateMany', anzahl: 1, grund: ADMIN },
  { datei: 'betrieb.ts', funktion: 'verwirfMailAction', aufruf: 'mailAuftrag.updateMany', anzahl: 1, grund: ADMIN },
  { datei: 'betrieb.ts', funktion: 'schickeBarLinkNochmal', aufruf: 'order.updateMany', anzahl: 1, grund: ADMIN },
  { datei: 'farm-photos.ts', funktion: 'updateFarmPhotoCaptionAction', aufruf: 'farmPhoto.update', anzahl: 1, grund: VORAB },
  { datei: 'farm-photos.ts', funktion: 'deleteFarmPhotoAction', aufruf: 'farmPhoto.delete', anzahl: 1, grund: VORAB },
  { datei: 'farm-photos.ts', funktion: 'deleteFarmPhotoAction', aufruf: 'farmPhoto.update', anzahl: 1, grund: 'Neu nummerieren: die Kennungen kommen aus findMany mit farmId des eigenen Hofs' },
  { datei: 'farm-photos.ts', funktion: 'reorderPhotosAction', aufruf: 'farmPhoto.update', anzahl: 1, grund: 'Die Liste ist vorher als genau die Fotos des eigenen Hofs geprüft (Transaktion); farmId in die WHERE nachziehen' },
  { datei: 'orders.ts', funktion: 'storniere', aufruf: 'product.update', anzahl: 1, grund: 'Bestand zurückbuchen: die Produkte kommen aus der Bestellung, die mit farmId des Hofs gelesen und bedingt storniert wurde' },
  { datei: 'orders.ts', funktion: 'storniere', aufruf: 'order.updateMany', anzahl: 2, grund: 'Nach dem bedingten Storno mit farmId: dieselbe Bestellung, nur Erstattungsfelder' },
  { datei: 'orders.ts', funktion: 'storniere', aufruf: 'order.update', anzahl: 1, grund: 'Nach dem bedingten Storno mit farmId: dieselbe Bestellung, nur Erstattungsfelder' },
  { datei: 'orders.ts', funktion: 'lasseServicegebuehrEntfallen', aufruf: 'order.update', anzahl: 1, grund: VORAB },
  { datei: 'postfach.ts', funktion: 'antworteAlsTeam', aufruf: 'unterhaltung.updateMany', anzahl: 2, grund: ADMIN },
  { datei: 'postfach.ts', funktion: 'markiereErstattungErledigt', aufruf: 'order.updateMany', anzahl: 1, grund: ADMIN },
  { datei: 'products.ts', funktion: 'updateProductImageAction', aufruf: 'product.update', anzahl: 1, grund: VORAB },
  { datei: 'products.ts', funktion: 'reorderProductsAction', aufruf: 'product.update', anzahl: 1, grund: 'Die Liste ist vorher als genau die Produkte des eigenen Hofs geprüft; farmId in die WHERE nachziehen' },
  { datei: 'subscriptions.ts', funktion: 'deleteCustomerAccount', aufruf: 'customerFarmSubscription.deleteMany', anzahl: 1, grund: 'Kundin löscht ihr Konto: alle Abos ihrer bestätigten Adresse, über alle Höfe' },
]

/** Modelle mit der Spalte farmId, so wie Prisma sie im Client nennt (erster Buchstabe klein). */
function hofModelle(schema: string): Set<string> {
  const modelle = new Set<string>()
  let aktuell: string | null = null
  for (const zeile of schema.split('\n')) {
    const kopf = zeile.match(/^model (\w+) \{/)
    if (kopf) aktuell = kopf[1]
    else if (/^\}/.test(zeile)) aktuell = null
    else if (aktuell && /^\s+farmId\s/.test(zeile)) modelle.add(aktuell[0].toLowerCase() + aktuell.slice(1))
  }
  return modelle
}

const SCHREIBEN = /^(update|updateMany|delete|deleteMany)$/

/** Nennt der Ausdruck farmId — direkt, über eine Konstante derselben Funktion oder ein Aufbreiten davon? */
function nenntFarmId(ausdruck: ts.Node, konstanten: Map<string, ts.Expression>, besucht = new Set<string>()): boolean {
  if (ts.isIdentifier(ausdruck)) {
    if (ausdruck.text === 'farmId') return true
    const wert = konstanten.get(ausdruck.text)
    if (!wert || besucht.has(ausdruck.text)) return false
    besucht.add(ausdruck.text)
    return nenntFarmId(wert, konstanten, besucht)
  }
  if ((ts.isPropertyAssignment(ausdruck) || ts.isShorthandPropertyAssignment(ausdruck)) && ts.isIdentifier(ausdruck.name) && ausdruck.name.text === 'farmId') return true
  return ts.forEachChild(ausdruck, (kind) => nenntFarmId(kind, konstanten, besucht) || undefined) ?? false
}

/** Die Schreibstellen ohne farmId in der WHERE, je Funktion der obersten Ebene bzw. benannter Pfeilfunktion. */
function stellenOhneFarmId(quelltext: string, modelle: Set<string>, datei = 'schnipsel.ts'): Stelle[] {
  const quelle = ts.createSourceFile(datei, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const funde: Stelle[] = []
  const besuche = (k: ts.Node, funktion: string, konstanten: Map<string, ts.Expression>): void => {
    let name = funktion
    let eigene = konstanten
    if (ts.isFunctionDeclaration(k) && k.name) name = k.name.text
    if (ts.isVariableDeclaration(k) && ts.isIdentifier(k.name) && k.initializer && (ts.isArrowFunction(k.initializer) || ts.isFunctionExpression(k.initializer))) name = k.name.text
    if (ts.isVariableDeclaration(k) && ts.isIdentifier(k.name) && k.initializer && ts.isObjectLiteralExpression(k.initializer)) {
      konstanten.set(k.name.text, k.initializer)
    }
    if (name !== funktion) eigene = new Map(konstanten)
    if (ts.isCallExpression(k) && ts.isPropertyAccessExpression(k.expression) && SCHREIBEN.test(k.expression.name.text)) {
      const vorn = k.expression.expression
      if (ts.isPropertyAccessExpression(vorn) && modelle.has(vorn.name.text)) {
        const arg = k.arguments[0]
        const wo = arg && ts.isObjectLiteralExpression(arg)
          ? arg.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'where')
          : undefined
        if (!wo || !nenntFarmId(wo.initializer, eigene)) funde.push({ datei, funktion: name, aufruf: `${vorn.name.text}.${k.expression.name.text}` })
      }
    }
    ts.forEachChild(k, (kind) => besuche(kind, name, eigene))
  }
  besuche(quelle, '(Modul)', new Map())
  return funde
}

const MODELLE = hofModelle(readFileSync(join(WURZEL, 'prisma/schema.prisma'), 'utf8'))
const schluessel = (s: Stelle): string => `${s.datei}:${s.funktion}:${s.aufruf}`

/** Anzahl je Stelle in den Actions. */
function gezaehlt(): Map<string, number> {
  const zaehler = new Map<string, number>()
  for (const datei of readdirSync(ORDNER).filter((d) => d.endsWith('.ts'))) {
    for (const stelle of stellenOhneFarmId(readFileSync(join(ORDNER, datei), 'utf8'), MODELLE, datei)) {
      zaehler.set(schluessel(stelle), (zaehler.get(schluessel(stelle)) ?? 0) + 1)
    }
  }
  return zaehler
}

describe('farmId-Wache: Schreiben auf Hof-Daten nennt farmId in der WHERE', () => {
  it('die Modelle mit farmId kommen aus dem Schema (Bestellung, Produkt, Foto, Abholzeit …)', () => {
    for (const modell of ['order', 'product', 'farmPhoto', 'pickupSlot', 'statusPost']) expect(MODELLE.has(modell), modell).toBe(true)
    expect(MODELLE.has('farm')).toBe(false)
    expect(MODELLE.has('session')).toBe(false)
  })

  it('keine neue Stelle ohne farmId — und keine Stelle öfter als im Bestand', () => {
    const erlaubt = new Map(FARMID_BESTAND.map((e) => [schluessel(e), e.anzahl]))
    const zuViel = [...gezaehlt()].filter(([s, n]) => n > (erlaubt.get(s) ?? 0)).map(([s, n]) => `${s} ×${n}`)
    expect(zuViel).toEqual([])
  })

  it('der Bestand schrumpft: eine behobene Stelle macht den Eintrag veraltet', () => {
    const ist = gezaehlt()
    expect(FARMID_BESTAND.filter((e) => (ist.get(schluessel(e)) ?? 0) < e.anzahl).map(schluessel)).toEqual([])
  })

  it('jeder Eintrag nennt einen Grund, keiner doppelt', () => {
    expect(FARMID_BESTAND.filter((e) => e.grund.trim().length < 20)).toEqual([])
    expect(new Set(FARMID_BESTAND.map(schluessel)).size).toBe(FARMID_BESTAND.length)
  })

  it('Gegenprobe: ohne farmId, Konstante ohne farmId und nur im Kommentar schlagen an — mit farmId nicht', () => {
    const modelle = new Set(['order'])
    const quelltext = `
      export async function ohne(id: string) { await prisma.order.update({ where: { id }, data: {} }) }
      export async function konstanteOhne(id: string) { const wo = { id }; await prisma.order.updateMany({ where: wo, data: {} }) }
      export async function kommentar(id: string) { await prisma.order.delete({ where: { id /* farmId */ } }) }
      export async function mit(id: string, farmId: string) { await prisma.order.updateMany({ where: { id, farmId }, data: {} }) }
      export async function mitWert(id: string, hof: { id: string }) { await tx.order.deleteMany({ where: { id, farmId: hof.id } }) }
      export async function konstanteMit(id: string, farmId: string) { const basis = { id, farmId }; await prisma.order.updateMany({ where: basis, data: {} }) }
      export async function aufgebreitet(id: string, farmId: string) { const basis = { id, farmId }; await prisma.order.updateMany({ where: { ...basis, x: 1 }, data: {} }) }
      export async function anderesModell(id: string) { await prisma.session.deleteMany({ where: { id } }) }`
    expect(stellenOhneFarmId(quelltext, modelle).map((s) => s.funktion).sort()).toEqual(['kommentar', 'konstanteOhne', 'ohne'])
  })
})
