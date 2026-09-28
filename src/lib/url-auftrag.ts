/**
 * Ein Auftrag in der Adresse — damit das Plus der Navigation und die Links
 * aus „Braucht dich" direkt in einen VORHANDENEN Dialog führen:
 *   /sales?neu=1         → „Verkauf eintragen"
 *   /products?neu=1      → „Produkt anlegen"
 *   /products?edit=<id>  → Produkt bearbeiten
 *
 * Der Dialog öffnet einmal, danach nimmt die Seite den Parameter per
 * replaceState wieder aus der Adresse (src/lib/use-url-auftrag.ts) —
 * Neuladen öffnet ihn nicht noch einmal. Rein und ohne Browser prüfbar
 * (tests/url-auftrag.test.ts).
 */
import { urlAuftragSchema } from '@/schemas/url-auftrag'

export type UrlAuftrag = { art: 'neu' } | { art: 'bearbeiten'; id: string }

/** Die Parameter einer Adresse lesen — `edit` sticht `neu`, Unpassendes ist kein Auftrag. */
export function leseAuftrag(parameter: { get(name: string): string | null }): UrlAuftrag | null {
  const { neu, edit } = urlAuftragSchema.parse({ neu: parameter.get('neu'), edit: parameter.get('edit') })
  if (edit) return { art: 'bearbeiten', id: edit }
  if (neu) return { art: 'neu' }
  return null
}

/** Ein Schlüssel je Auftrag — ändert er sich, ist es ein neuer Auftrag. */
export function auftragsSchluessel(auftrag: UrlAuftrag | null): string | null {
  if (!auftrag) return null
  return auftrag.art === 'neu' ? 'neu' : `bearbeiten:${auftrag.id}`
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
  parameter.delete('edit')
  const rest = parameter.toString()
  return `${pfad}${rest ? `?${rest}` : ''}${anker}`
}
