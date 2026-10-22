/**
 * Woran die Geld-Wachen einen Geldwert erkennen: an seinem Namen (Nr. 139, Regelvorschlag 139 aus Morgenbericht 21 §5).
 * EINE Stelle für die Wortstämme und den „letzten Namen“ eines Ausdrucks, damit `tests/geld-number-wache.test.ts` und
 * `tests/geld-fliesskomma-wache.test.ts` dasselbe Geld meinen. Lose Hilfsdatei ohne `.test` (TESTING_GUIDELINES
 * „Ordner“): Ein Import aus einer `.test.ts` ließe deren Tests doppelt laufen.
 */
import ts from 'typescript'

/** Wortstämme, die einen Geldwert benennen. */
export const GELD_STAMM = /price|amount|total|fee|betrag|preis|cents/i
/** Ein Satz in Prozent ist kein Betrag, auch wenn `fee` im Namen steht. */
export const KEIN_GELD = /percent|prozent/i
/** Methoden, die nur den Wert in eine andere Form bringen: Der Name davor ist der Name des Werts. */
export const WERT_METHODEN = new Set(['toString', 'toFixed', 'toPrecision', 'valueOf', 'toNumber', 'toDecimalPlaces'])

/** Klammern, `as`, `satisfies`, `!` und `<T>` ändern den Wert nicht. */
export function ohneHuelle(ausdruck: ts.Expression): ts.Expression {
  let k = ausdruck
  while (ts.isParenthesizedExpression(k) || ts.isAsExpression(k) || ts.isSatisfiesExpression(k) || ts.isNonNullExpression(k) || ts.isTypeAssertionExpression(k)) {
    k = k.expression
  }
  return k
}

/**
 * Die letzten Namen eines Ausdrucks: einer je Zugriffskette, bei Rechnung und Auswahl einer je Teil.
 * `p.price` → `price`, `betrag.toString()` → `betrag`, `preise[i]` → `preise`, `zeile['price']` → `price`.
 */
export function endnamen(ausdruck: ts.Expression): string[] {
  const k = ohneHuelle(ausdruck)
  if (ts.isIdentifier(k)) return [k.text]
  if (ts.isPropertyAccessExpression(k)) return [k.name.text]
  if (ts.isElementAccessExpression(k)) {
    const index = k.argumentExpression
    return ts.isStringLiteralLike(index) ? [index.text] : endnamen(k.expression)
  }
  if (ts.isCallExpression(k)) {
    const ziel = ohneHuelle(k.expression)
    if (ts.isPropertyAccessExpression(ziel)) return WERT_METHODEN.has(ziel.name.text) ? endnamen(ziel.expression) : [ziel.name.text]
    return endnamen(ziel)
  }
  if (ts.isBinaryExpression(k)) return [...endnamen(k.left), ...endnamen(k.right)]
  if (ts.isConditionalExpression(k)) return [...endnamen(k.whenTrue), ...endnamen(k.whenFalse)]
  if (ts.isPrefixUnaryExpression(k)) return endnamen(k.operand)
  return []
}

export function klingtNachGeld(name: string): boolean {
  return GELD_STAMM.test(name) && !KEIN_GELD.test(name)
}
