/**
 * Ein Auftrag in der Adresse — damit das Plus der Navigation und die Links
 * aus „Braucht dich" direkt in einen VORHANDENEN Dialog führen:
 *   /sales?neu=1         → „Verkauf eintragen"
 *   /products?neu=1      → „Produkt anlegen"
 *   /products?neu=1&bereich=futter → „Produkt anlegen" im Bereich (Neu-Menü, Nr. 18)
 *   /products?edit=<id>  → Produkt bearbeiten
 *
 * Der Dialog öffnet einmal, danach nimmt die Seite den Parameter per
 * replaceState wieder aus der Adresse (src/lib/use-url-auftrag.ts) —
 * Neuladen öffnet ihn nicht noch einmal. Rein und ohne Browser prüfbar
 * (tests/url-auftrag.test.ts).
 */
import { urlAuftragSchema, type NeuBereich } from '@/schemas/url-auftrag'

/** `bereich` fehlt, wenn keiner (oder ein unbekannter) in der Adresse stand. */
export type UrlAuftrag = { art: 'neu'; bereich?: NeuBereich } | { art: 'bearbeiten'; id: string }

/** Die Parameter einer Adresse lesen — `edit` sticht `neu`, Unpassendes ist kein Auftrag. */
export function leseAuftrag(parameter: { get(name: string): string | null }): UrlAuftrag | null {
  const { neu, bereich, edit } = urlAuftragSchema.parse({
    neu: parameter.get('neu'),
    bereich: parameter.get('bereich'),
    edit: parameter.get('edit'),
  })
  if (edit) return { art: 'bearbeiten', id: edit }
  if (neu) return bereich ? { art: 'neu', bereich } : { art: 'neu' }
  return null
}

/** Ein Schlüssel je Auftrag — ändert er sich, ist es ein neuer Auftrag (auch ein anderer Bereich). */
export function auftragsSchluessel(auftrag: UrlAuftrag | null): string | null {
  if (!auftrag) return null
  if (auftrag.art === 'bearbeiten') return `bearbeiten:${auftrag.id}`
  return auftrag.bereich ? `neu:${auftrag.bereich}` : 'neu'
}

/**
 * Ein Schritt des Hooks: Ist `schluessel` ein Auftrag, der noch nicht
 * ausgeführt wurde? Danach gilt `schluessel` als erledigt — auch null, damit
 * derselbe Auftrag später (Plus bei schon offener Seite) wieder ankommt.
 */
export function auftragsSchritt(
  schluessel: string | null,
  erledigt: string | null
): { ausfuehren: boolean; erledigt: string | null } {
  return { ausfuehren: schluessel !== null && schluessel !== erledigt, erledigt: schluessel }
}

/** Die Adresse ohne Auftrag; andere Parameter und der Anker bleiben stehen. */
export function ohneAuftrag(pfad: string, suche: string, anker = ''): string {
  const parameter = new URLSearchParams(suche)
  parameter.delete('neu')
  parameter.delete('bereich')
  parameter.delete('edit')
  const rest = parameter.toString()
  return `${pfad}${rest ? `?${rest}` : ''}${anker}`
}
