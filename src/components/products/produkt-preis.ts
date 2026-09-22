/**
 * Preis-Semantik im Produktformular — die Entscheidungen, ohne React.
 *
 * `price` ist der Preis je Gebinde, `unitSize` die Gebindegröße (siehe
 * src/lib/format.ts). Das Formular sagte das nirgends; ein Hof trug den
 * Kilopreis ein und speicherte ihn als Preis für ein 2-kg-Paket. Hier steht,
 * wie das Preisfeld heißt, was Kundinnen sehen werden und wann eine Rückfrage
 * angebracht ist — alles rein, damit es ohne Browser prüfbar bleibt.
 */
import {
  einheitLabel,
  formatEuro,
  formatGrundpreis,
  formatGrundpreisZeile,
  formatZahl,
  gebindeGroesse,
  istMassEinheit,
} from '@/lib/format'

/** „Preis je kg" ohne Gebinde, „Preis für das 2-kg-Paket" mit, „Preis für 6 Pakete" bei Stück/Paket. */
export function preisFeldLabel(unit: string, unitSize?: number | null): string {
  const size = gebindeGroesse(unitSize)
  if (size == null || size === 1) return `Preis je ${einheitLabel(unit)}`
  if (istMassEinheit(unit)) return `Preis für das ${formatZahl(size)}-${einheitLabel(unit)}-Paket`
  return `Preis für ${formatZahl(size)} ${einheitLabel(unit, size)}`
}

/**
 * Die Vorschau unter dem Preisfeld: „Kunden sehen: € 50,00 für 2 kg · € 25,00 / kg".
 * null, solange kein brauchbarer Preis eingetragen ist.
 */
export function kundenVorschau(price: number, unit: string, unitSize?: number | null): string | null {
  if (!Number.isFinite(price) || price <= 0) return null
  const teile = [formatGrundpreis(price, unit, unitSize)]
  const zeile = formatGrundpreisZeile(price, unit, unitSize)
  if (zeile) teile.push(zeile)
  return `Kunden sehen: ${teile.join(' · ')}`
}

/**
 * Plausibilität, kein Fehler: Hat der Hof vermutlich den Kilopreis stehen
 * lassen und nur die Gebindegröße ergänzt?
 *
 * `referenzPreis` ist der Preis, der im Feld stand, BEVOR die Gebindegröße
 * über 1 gesetzt wurde — also mutmaßlich ein Preis je Einheit. Bleibt der
 * Preis danach in dessen Nähe (bis 20 % darüber), passt er nicht zu einem
 * ganzen Paket. Ohne Referenz (Bestandsprodukt mit Gebinde) gibt es keine
 * Rückfrage: Was der Hof damals meinte, wissen wir nicht.
 */
export function paketpreisFraglich(input: {
  price: number
  unitSize?: number | null
  referenzPreis: number | null
}): boolean {
  const size = gebindeGroesse(input.unitSize)
  if (size == null || size <= 1) return false
  const referenz = input.referenzPreis
  if (referenz == null || !Number.isFinite(referenz) || referenz <= 0) return false
  if (!Number.isFinite(input.price) || input.price <= 0) return false
  return input.price <= referenz * 1.2
}

/** Die Rückfrage — nur die Frage; die Rechnung steht schon in „Kunden sehen". */
export const PAKETPREIS_FRAGE = 'Ist das der Preis für das ganze Paket?'

/**
 * Die zwei Antworten auf die Rückfrage, mit Beträgen im Wortlaut:
 *   ja:   „Ja, das Paket kostet € 50,00"        → Preis bleibt
 *   nein: „Nein, € 50,00 ist der Preis je kg"   → Preis wird Gebindepreis
 * `paketpreis` ist der Betrag, den „Nein" einträgt: Einheitspreis × Gebinde,
 * auf Cent gerundet.
 */
export function paketpreisAntworten(
  price: number,
  unit: string,
  unitSize?: number | null
): { ja: string; nein: string; paketpreis: number } {
  const size = gebindeGroesse(unitSize) ?? 1
  return {
    ja: `Ja, das Paket kostet ${formatEuro(price)}`,
    nein: `Nein, ${formatEuro(price)} ist der Preis je ${einheitLabel(unit)}`,
    paketpreis: Math.round(price * size * 100) / 100,
  }
}
