/**
 * Der Korb-Hinweis mit dem Namen des entfernten Produkts (Liste Lauf 32, korb, B-Zeile; Board s1-/w1-korb Bild 2;
 * Nr. 276): „Bergkäse ist gerade ausverkauft – wir haben es herausgenommen.“ statt „Eine Position ist nicht mehr
 * verfügbar und wurde entfernt.“
 *
 * Warum im Browser und nicht in der Quelle: Der Satz der Quelle (`befundMeldung` in src/lib/reservierung.ts) entsteht
 * aus einem `WarenkorbBefund`, der keine Produktnamen kennt — auch in den Antworten von /api/checkout, /api/reserve und
 * /api/warenkorb/pruefen. Die Namen kennt nur der Korb im Browser. Darum bleibt die Quelle samt Antworten unverändert,
 * und die beiden Stellen, die den Satz zeigen (Abgleich der Hofseite, Prüfung beim Öffnen der Kasse), ersetzen darin
 * nur den Teil zu entfernten Positionen.
 *
 * Nur Text — kein Geld, keine Frist, kein Bestand.
 */
import { befundMeldung, type PositionsBefund } from '@/lib/reservierung'

/** Was die Funktion von einer Korbposition braucht: Produkt und Name (GespeichertePosition, CartItem). */
type KorbPositionMitName = { productId: string; name: string }

/**
 * Der Satz der Quelle zu `anzahl` entfernten Positionen — erzeugt über `befundMeldung` selbst, nie als zweites
 * Literal: Ändert jemand dort den Wortlaut, findet diese Funktion ihn weiter (oder nicht mehr, dann bleibt der Satz der
 * Quelle stehen). Nur entfernte Positionen, nichts abgelaufen: Dann besteht der Satz der Quelle genau aus diesem Teil.
 */
function quellSatzEntfernt(anzahl: number): string | null {
  const positionen: PositionsBefund[] = Array.from({ length: anzahl }, (_, i) => ({
    productId: `entfernt-${i}`,
    gewuenscht: 1,
    moeglich: 0,
    abgelaufen: false,
    zustand: 'weg',
  }))
  return befundMeldung({ positionen, etwasAbgelaufen: false, etwasGeaendert: true })
}

/** „A“, „A und B“, „A, B und C“. */
function aufzaehlung(namen: readonly string[]): string {
  if (namen.length <= 1) return namen[0] ?? ''
  return `${namen.slice(0, -1).join(', ')} und ${namen[namen.length - 1]}`
}

/**
 * Der Satz des Boards zu entfernten Produkten. Das Pronomen ist neutral („es“, Liste Lauf 32: Genus über „es“ neutral),
 * bei mehreren „sie“ — so braucht kein Produktname ein Geschlecht.
 */
export function ausverkauftHinweis(namen: readonly string[]): string {
  if (namen.length === 1) return `${namen[0]} ist gerade ausverkauft – wir haben es herausgenommen.`
  return `${aufzaehlung(namen)} sind gerade ausverkauft – wir haben sie herausgenommen.`
}

/**
 * Die Namen der Positionen, die zwischen dem Korb vorher und dem berichtigten Korb weggefallen sind — in der
 * Reihenfolge des Korbs. null, wenn sich ein Name nicht sicher zuordnen lässt: mehrere Positionen desselben Produkts
 * im Korb vorher, ein leerer Name, oder gar keine entfernte Position (dann gibt es nichts zu ersetzen).
 */
export function entfernteNamen(
  vorher: readonly KorbPositionMitName[],
  nachher: readonly Pick<KorbPositionMitName, 'productId'>[]
): string[] | null {
  const ids = vorher.map((p) => p.productId)
  if (new Set(ids).size !== ids.length) return null
  const bleiben = new Set(nachher.map((p) => p.productId))
  const weg = vorher.filter((p) => !bleiben.has(p.productId))
  if (weg.length === 0) return null
  const namen = weg.map((p) => p.name.trim())
  if (namen.some((n) => n === '')) return null
  return namen
}

/**
 * Ersetzt im Satz der Quelle nur den Satz zu entfernten Positionen durch den Board-Satz mit Namen. Alles andere —
 * „Reservierung abgelaufen“, gekürzte Mengen, `KORB_PREIS_GEAENDERT` — bleibt wörtlich, an seiner Stelle.
 *
 * Bleibt unverändert, wenn keine Namen da sind (`entfernteNamen` gab null) oder der zu ersetzende Satz für genau
 * diese Anzahl im Satz der Quelle nicht vorkommt (z. B. die Quelle zählt anders als der Korb im Browser).
 */
export function korbHinweisMitNamen(satzDerQuelle: string, namen: readonly string[] | null): string {
  if (!namen || namen.length === 0) return satzDerQuelle
  const alt = quellSatzEntfernt(namen.length)
  if (!alt || !satzDerQuelle.includes(alt)) return satzDerQuelle
  return satzDerQuelle.replace(alt, () => ausverkauftHinweis(namen))
}
