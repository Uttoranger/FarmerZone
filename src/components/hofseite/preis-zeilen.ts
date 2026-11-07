import { einheitLabel, formatEuro, formatGrundpreisZeile, formatZahl, gebindeGroesse, grundpreisJeEinheit } from '@/lib/format'
import { zweitePreiszeile } from '@/lib/produktdetail'
import type { PublicProduct } from '@/server/queries/farm'

/** Was die Preiszeilen brauchen — der Preis ist schon der Anzeigepreis (mitEndpreis, N38). */
export type PreisZeilenAngabe = Pick<PublicProduct, 'price' | 'unit' | 'unitSize' | 'futter'>

/**
 * Preis und Grundpreis in zwei Zeilen (Liste Lauf 32, hofseite: „Preis fett,
 * Grundpreis grau darunter“, eine Hilfe für Hofseite und Produktseite, Nr. 252):
 * oben „€ 1,49“, darunter „€ 1,49 / L“ bzw. „€ 0,48 / Stück“. Bei Futter der
 * Kilopreis aus der Nettomenge, bei Maß-Gebinden derselbe Grundpreis wie
 * bisher (formatGrundpreisZeile); ohne Gebinde ist der Grundpreis der Preis je
 * Einheit. Nur Anzeige — gerechnet wird in format.ts.
 */
export function preisZeilen(p: PreisZeilenAngabe): { preis: string; grundpreis: string | null } {
  const preis = formatEuro(p.price)
  const zweite = zweitePreiszeile(p) ?? formatGrundpreisZeile(p.price, p.unit, p.unitSize)
  if (zweite) return { preis, grundpreis: zweite }
  // Futter ohne verwertbare Nettomenge: kein erfundener Grundpreis.
  if (p.futter) return { preis, grundpreis: null }
  const groesse = gebindeGroesse(p.unitSize)
  const je = grundpreisJeEinheit(p.price, groesse ?? 1)
  if (je === null) return { preis, grundpreis: null }
  return { preis, grundpreis: `${formatEuro(je)} / ${einheitLabel(p.unit)}` }
}

/**
 * „Bergkäse, 250 g“ — der Name mit dem Gebinde (Board s1-/w1-hofseite): Seit der
 * Preis allein oben steht („€ 6,58“), sagt der Name, wofür er gilt. Ohne
 * Gebinde (Größe 1 oder keine) bleibt der Name; steht die Menge schon darin,
 * wird sie nicht doppelt angehängt.
 */
export function nameMitGebinde(name: string, p: Pick<PublicProduct, 'unit' | 'unitSize'>): string {
  const groesse = gebindeGroesse(p.unitSize)
  if (groesse === null || groesse === 1) return name
  const menge = `${formatZahl(groesse)} ${einheitLabel(p.unit, groesse)}`
  return name.includes(menge) ? name : `${name}, ${menge}`
}
