import type { StapelMail } from '@/lib/email'
import type { MailArt } from '@/schemas/mail-auftrag'
import { rendereBeitrag } from '@/server/mail-arten/beitrag'

/*
 * Die Renderer der Mail-Warteschlange (Register N26, Nr. 158): je Art eine
 * Funktion, die aus dem Bezug (nur Kennungen, vom Worker schon mit
 * `bezugSchemaFuer` geprüft) Adresse und Inhalt FRISCH aus der Datenbank lädt
 * und die Mail mit der bestehenden Vorlage aus src/lib/email.ts baut — keine
 * zweite Vorlage. Darf die Mail nicht mehr hinaus (Abo abgemeldet,
 * Double-Opt-in fehlt, Bezug gelöscht), liefert der Renderer `{ verworfen }`
 * mit einem kurzen Code; der Worker setzt den Auftrag auf „verworfen“.
 *
 * Die Post-Sperre (Z3) prüft nicht der Renderer, sondern der Worker über
 * `postSperreLaesstDurch` — dieselbe Stelle wie sendRaw.
 *
 * Nr. 158 bringt den Renderer für Beiträge; die Arten, die Nr. 159 auf die
 * Warteschlange stellt, bekommen hier ihren Eintrag. Eine Art ohne Renderer
 * verwirft der Worker mit `kein_renderer`.
 */

export type Verworfen = { verworfen: string }
export type MailRenderer = (bezug: Record<string, string>) => Promise<StapelMail | Verworfen>
export type RendererTabelle = Partial<Record<MailArt, MailRenderer>>

export const RENDERER: RendererTabelle = {
  beitrag: rendereBeitrag,
}
