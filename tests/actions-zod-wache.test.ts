/**
 * Zod-Wache für Server Actions (Nr. 178; CODING_STANDARDS §3 „Jede Systemgrenze validiert mit Zod").
 *
 * Ursache: Jeder Export einer `'use server'`-Datei ist ein öffentlicher Endpunkt; seine Parameter kommen aus dem
 * Browser, gleich welcher Typ in der Signatur steht (`markAsReady(orderId: string)` nimmt auch ein Objekt oder einen
 * Text mit 10 000 Zeichen). Die Regel hatte keine Prüfung; Beispiele ohne Schema waren `markAsReady` und
 * `deleteFarmPhotoAction`.
 *
 * Beweist (Quelltext von `src/server/actions/`, TypeScript-Syntaxbaum, kein Netz): Jede exportierte Funktion mit
 * mindestens einem Parameter ruft ein Zod-Schema auf (`.safeParse`, `.parse`, `.safeParseAsync`, `.parseAsync`) — im
 * eigenen Körper oder über eine Funktion derselben Datei, beliebig tief. Wer es nicht tut, steht in ZOD_BESTAND (je
 * Datei und Name mit Grund). Der Bestand schrumpft: Ein Eintrag, der ein Schema bekommen hat oder den es nicht mehr
 * gibt, macht die Wache rot (veraltet). Kommentare zählen nicht.
 *
 * GRENZE: Die Wache sieht nur, DASS ein Schema aufgerufen wird, nicht, ob es auf jeden Parameter angewandt wird.
 * Ein Schema über einen Helfer in einer anderen Datei (etwa `verschickeRundschreiben`) sieht sie nicht — solche
 * Exporte stehen mit Grund im Bestand.
 *
 * Gegenprobe (Text-Attrappen): eine Action mit Parameter ohne Schema, mit Schema nur im Kommentar und mit einem
 * Helfer ohne Schema schlagen an; direktes `safeParse`, `parse` über einen (auch zweistufigen) Helfer und eine
 * Action ohne Parameter nicht, ebenso wenig eine nicht exportierte Funktion.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ORDNER = join(process.cwd(), 'src/server/actions')

type Eintrag = { datei: string; name: string; grund: string }

const ALTBESTAND = 'Altbestand vor Nr. 178: die Kennung geht nur in eine WHERE mit Besitz- bzw. Admin-Prüfung; Schema nachziehen'

/** Exporte mit Parametern ohne eigenes Schema. Nur schrumpfen. */
const ZOD_BESTAND: readonly Eintrag[] = [
  { datei: 'admin.ts', name: 'approveFarmAction', grund: ALTBESTAND },
  { datei: 'admin.ts', name: 'revokeFarmApprovalAction', grund: ALTBESTAND },
  { datei: 'admin.ts', name: 'rejectFarmAction', grund: ALTBESTAND },
  { datei: 'appearance.ts', name: 'updateFarmLogoAction', grund: 'Altbestand vor Nr. 178: die Adresse prüft bildUrlErlaubt (nur eigener Blob-Speicher); Schema nachziehen' },
  { datei: 'appearance.ts', name: 'updateFarmBannerAction', grund: 'Altbestand vor Nr. 178: Art fest im Code verglichen, Adresse über bildUrlErlaubt; Schema nachziehen' },
  { datei: 'farm-photos.ts', name: 'reorderPhotosAction', grund: 'Altbestand vor Nr. 178: die Liste muss genau die eigenen Fotos sein (Transaktion); Schema nachziehen' },
  { datei: 'farm-photos.ts', name: 'moveFarmPhotoAction', grund: ALTBESTAND },
  { datei: 'farm.ts', name: 'holeAdresseZumPunkt', grund: 'Altbestand vor Nr. 178: Number.isFinite prüft beide Zahlen, sie gehen nur an die Geokodierung; Schema nachziehen' },
  { datei: 'farm.ts', name: 'deletePickupSlot', grund: ALTBESTAND },
  { datei: 'farm.ts', name: 'togglePickupSlotActive', grund: ALTBESTAND },
  { datei: 'orders.ts', name: 'markAsPickedUp', grund: ALTBESTAND },
  { datei: 'orders.ts', name: 'markAsPickedUpAndPaid', grund: ALTBESTAND },
  { datei: 'orders.ts', name: 'revertReady', grund: ALTBESTAND },
  { datei: 'orders.ts', name: 'revertPickedUp', grund: ALTBESTAND },
  { datei: 'orders.ts', name: 'revertOrderStatus', grund: ALTBESTAND },
  { datei: 'orders.ts', name: 'markAsNotPickedUp', grund: ALTBESTAND },
  { datei: 'postfach.ts', name: 'sendeRundschreiben', grund: 'Prüft mit Zod in verschickeRundschreiben (src/server/rundschreiben.ts), außerhalb dieser Datei; davor die frische Admin-Bestätigung' },
  { datei: 'products.ts', name: 'updateProductImageAction', grund: 'Altbestand vor Nr. 178: Besitz in der Abfrage, Adresse über bildUrlErlaubt; Schema nachziehen' },
  { datei: 'products.ts', name: 'deleteProduct', grund: ALTBESTAND },
  { datei: 'products.ts', name: 'reorderProductsAction', grund: 'Altbestand vor Nr. 178: die Liste muss genau die eigenen Produkte sein; Schema nachziehen' },
]

type Funktion = { exportiert: boolean; knoten: ts.FunctionLikeDeclaration }

/** Alle Funktionen der obersten Ebene (Deklaration oder `const f = (…) =>`), mit Namen. */
function funktionen(datei: ts.SourceFile): Map<string, Funktion> {
  const karte = new Map<string, Funktion>()
  const exportiert = (n: ts.Node): boolean => ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  for (const st of datei.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) karte.set(st.name.text, { exportiert: exportiert(st), knoten: st })
    else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
          karte.set(d.name.text, { exportiert: exportiert(st), knoten: d.initializer })
        }
      }
    }
  }
  return karte
}

const PARSE = /^(safeParse|parse|safeParseAsync|parseAsync)$/

/** Exporte mit Parametern, die kein Schema erreichen. */
function ohneSchema(quelltext: string, pfad = 'schnipsel.ts'): string[] {
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const alle = funktionen(datei)
  const erreicht = (name: string, besucht = new Set<string>()): boolean => {
    if (besucht.has(name)) return false
    besucht.add(name)
    const f = alle.get(name)
    if (!f) return false
    let gefunden = false
    const besuche = (k: ts.Node): void => {
      if (gefunden) return
      if (ts.isCallExpression(k)) {
        const ziel = k.expression
        if (ts.isPropertyAccessExpression(ziel) && PARSE.test(ziel.name.text)) gefunden = true
        else if (ts.isIdentifier(ziel) && erreicht(ziel.text, besucht)) gefunden = true
      }
      ts.forEachChild(k, besuche)
    }
    besuche(f.knoten)
    return gefunden
  }
  return [...alle].filter(([name, f]) => f.exportiert && f.knoten.parameters.length > 0 && !erreicht(name)).map(([name]) => name)
}

function funde(): Eintrag[] {
  return readdirSync(ORDNER)
    .filter((d) => d.endsWith('.ts'))
    .flatMap((datei) => ohneSchema(readFileSync(join(ORDNER, datei), 'utf8'), datei).map((name) => ({ datei, name, grund: '' })))
}

const schluessel = (e: { datei: string; name: string }): string => `${e.datei}:${e.name}`

describe('Zod-Wache: jede Server Action mit Parametern ruft ein Schema auf', () => {
  it('keine neue Action ohne Schema — eine neue Stelle steht mit Datei und Name da', () => {
    const bekannt = new Set(ZOD_BESTAND.map(schluessel))
    expect(funde().filter((f) => !bekannt.has(schluessel(f))).map(schluessel)).toEqual([])
  })

  it('der Bestand schrumpft: ein Eintrag mit Schema oder ohne Action ist veraltet', () => {
    const gefunden = new Set(funde().map(schluessel))
    expect(ZOD_BESTAND.filter((e) => !gefunden.has(schluessel(e))).map(schluessel)).toEqual([])
  })

  it('jeder Eintrag nennt einen Grund, keiner doppelt', () => {
    expect(ZOD_BESTAND.filter((e) => e.grund.trim().length < 20)).toEqual([])
    expect(new Set(ZOD_BESTAND.map(schluessel)).size).toBe(ZOD_BESTAND.length)
  })

  it('markAsReady und deleteFarmPhotoAction haben ihr Schema (Nr. 178)', () => {
    const offen = new Set(funde().map(schluessel))
    expect(offen.has('orders.ts:markAsReady')).toBe(false)
    expect(offen.has('farm-photos.ts:deleteFarmPhotoAction')).toBe(false)
  })

  it('Gegenprobe: ohne Schema, nur im Kommentar und über einen Helfer ohne Schema schlagen an', () => {
    const quelltext = `'use server'
      export async function ohne(id: string) { return id }
      export async function kommentar(id: string) { /* schema.safeParse(id) */ return id }
      function helfer(x: string) { return x }
      export async function mitHelfer(id: string) { return helfer(id) }
      export async function direkt(id: unknown) { if (!schema.safeParse(id).success) return null; return id }
      function pruefe(x: unknown) { return schema.parse(x) }
      function zweistufig(x: unknown) { return pruefe(x) }
      export const ueberHelfer = async (id: unknown) => zweistufig(id)
      export async function ohneParameter() { return 1 }
      async function intern(id: string) { return id }`
    expect(ohneSchema(quelltext).sort()).toEqual(['kommentar', 'mitHelfer', 'ohne'])
  })
})
