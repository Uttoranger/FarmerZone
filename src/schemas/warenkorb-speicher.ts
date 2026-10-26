/**
 * Der Warenkorb im localStorage des Browsers. Er ist Fremddaten
 * (CODING_STANDARDS §3): Jeder kann ihn im Browser ändern, und alte Stände
 * liegen noch auf den Geräten. Gelesen wird er deshalb nur über
 * leseWarenkorb (src/lib/warenkorb-speicher.ts), nie mit einem nackten
 * JSON.parse. Wahrheit über Preis und Bestand ist er nie — das prüft der
 * Server beim Reservieren und im Checkout.
 *
 * Ohne Zod (Nr. 196): Der Korb läuft auf jeder Kundenseite im Browser
 * (tests/leistung-196.test.ts). Die Prüfungen verhalten sich wie die früheren
 * Schemas (tests/leistung-196.test.ts, Gleichheit mit dem Zod-Stand):
 * unbekannte Felder fallen weg, jedes Pflichtfeld muss den richtigen Typ haben.
 */
export type WarenkorbPosition = {
  productId: string
  name: string
  price: number
  unit: string
  unitSize: number | null
  quantity: number
  imageUrl: string | null
}

/** Ein gelesener Korb: die Hülle, die Positionen einzeln geprüft (leseWarenkorb). */
export type WarenkorbSpeicher = {
  farmId: string
  farmSlug?: string
  items: WarenkorbPosition[]
}

/** Ein Objekt wie für Zods `z.object`: nicht null, kein Array. */
function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert)
}

/** Eine endliche Zahl, wie `z.number()` sie annimmt (kein NaN, kein Unendlich). */
function istZahl(wert: unknown): wert is number {
  return typeof wert === 'number' && Number.isFinite(wert)
}

const SLUG = /^[a-z0-9-]+$/

/** Eine Position, oder null, wenn ein Feld fehlt oder nicht passt — eine kaputte Position kostet nur sich selbst. */
export function leseWarenkorbPosition(roh: unknown): WarenkorbPosition | null {
  if (!istObjekt(roh)) return null
  const { productId, name, price, unit, unitSize, quantity, imageUrl } = roh
  if (typeof productId !== 'string' || productId.length < 1) return null
  if (typeof name !== 'string' || typeof unit !== 'string') return null
  if (!istZahl(price) || price < 0) return null
  if (unitSize !== null && !istZahl(unitSize)) return null
  if (!Number.isSafeInteger(quantity) || (quantity as number) <= 0) return null
  if (imageUrl !== null && typeof imageUrl !== 'string') return null
  return { productId, name, price, unit, unitSize, quantity: quantity as number, imageUrl }
}

/**
 * Die Hülle, die Positionen noch ungeprüft. `farmSlug` gibt es seit der
 * Kopfzeile der Kundenseiten (2026-09-27): Mit ihm führt das Warenkorb-Symbol
 * auf jeder Seite zum richtigen Hof. Ältere Einträge haben ihn nicht und
 * bleiben trotzdem lesbar; ein kaputter Slug fällt still weg.
 */
export function leseWarenkorbHuelle(roh: unknown): { farmId: string; farmSlug?: string; items: unknown[] } | null {
  if (!istObjekt(roh)) return null
  const { farmId, farmSlug, items } = roh
  if (typeof farmId !== 'string' || farmId.length < 1 || !Array.isArray(items)) return null
  const slug = typeof farmSlug === 'string' && farmSlug.length <= 100 && SLUG.test(farmSlug) ? farmSlug : undefined
  return { farmId, farmSlug: slug, items }
}
