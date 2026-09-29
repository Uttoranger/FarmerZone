/**
 * Preis und Gebindegröße eines Produkts für den Client: Decimal → Zahl.
 *
 * Nur für die Anzeige an der Servergrenze (Decimal darf nicht roh an eine
 * Client-Komponente). Gerechnet wird mit diesen Zahlen nichts, was auf einer
 * Rechnung landet — Warenkorb und Bestellung holen den Preis selbst aus der
 * Datenbank.
 *
 * Kennt Prisma nicht (src/lib darf es nicht importieren): Ein Decimal ist hier
 * alles, was sich als Zahl lesen lässt.
 */
type DezimalWert = { toString(): string }

type MitUnitSize = { unitSize: DezimalWert | null }

export type ProduktDto<T> = Omit<T, 'price' | 'unitSize'> & { price: number } & (T extends MitUnitSize
    ? { unitSize: number | null }
    : unknown)

export function zuProduktDto<T extends { price: DezimalWert }>(p: T): ProduktDto<T> {
  const dto: Record<string, unknown> = { ...p, price: Number(p.price) }
  // Nicht jede Abfrage liest die Gebindegröße (die Angebotszeilen auf /hoefe
  // nicht) — dann bleibt das Feld weg, statt als undefined dazuzukommen.
  if ('unitSize' in p) {
    const unitSize = (p as T & MitUnitSize).unitSize
    dto.unitSize = unitSize === null ? null : Number(unitSize)
  }
  return dto as ProduktDto<T>
}
