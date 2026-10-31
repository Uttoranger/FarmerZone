import type { StapelMail } from '@/lib/email'
import type { MailArt } from '@/schemas/mail-auftrag'
import { rendereBeitrag } from '@/server/mail-arten/beitrag'
import {
  rendereAbholbereit,
  rendereArtikelFehlt,
  rendereBarBestaetigtHof,
  rendereBestellungBestaetigung,
  rendereBestellungBezahltHof,
  rendereNichtAbholbereit,
  rendereStorniert,
  rendereVerfallen,
  rendereZahlungZuSpaet,
} from '@/server/mail-arten/bestellung'
import {
  rendereAntwortAnTeam,
  rendereBetreiberTestmail,
  rendereErstattungOffen,
  rendereMeldung,
  rendereNeuerHof,
  rendereWochenbericht,
} from '@/server/mail-arten/betreiber'
import { rendereFreischaltung, rendereLastschriftGescheitert, renderePlattformgebuehrAnkuendigung, renderePostfachAntwort, rendereRundschreiben } from '@/server/mail-arten/hof'
import { rendereAboBestaetigung, rendereBescheid } from '@/server/mail-arten/kundin'
import { rendereWiderrufAbgelehnt, rendereWiderrufErstattet, rendereWiderrufHof } from '@/server/mail-arten/widerruf'

/*
 * Die Renderer der Mail-Warteschlange (Register N26, Nr. 158/159): je Art eine
 * Funktion, die aus dem Bezug (vom Worker schon mit `bezugSchemaFuer`
 * geprüft) Adresse und Inhalt FRISCH aus der Datenbank lädt und die Mail mit
 * der bestehenden Vorlage aus src/lib/email.ts baut — keine zweite Vorlage.
 * Darf die Mail nicht mehr hinaus (Abo abgemeldet, Double-Opt-in fehlt,
 * Bezug gelöscht, Empfänger entfernt), liefert der Renderer `{ verworfen }`
 * mit einem kurzen Code; der Worker setzt den Auftrag auf „verworfen“.
 *
 * Die Post-Sperre (Z3) prüft nicht der Renderer, sondern der Worker über
 * `postSperreLaesstDurch` — dieselbe Stelle wie sendRaw.
 *
 * Jede Art mit Weg Wichtig oder Kann warten (`MAIL_WEG`) hat hier genau
 * einen Eintrag, keine Sofort-Art hat einen (Wache
 * tests/mail-wege-wache.test.ts).
 */

export type Verworfen = { verworfen: string }
export type MailRenderer = (bezug: Record<string, string>) => Promise<StapelMail | Verworfen>
export type RendererTabelle = Partial<Record<MailArt, MailRenderer>>

export const RENDERER: RendererTabelle = {
  'bestellung-bestaetigung': rendereBestellungBestaetigung,
  'bestellung-bezahlt-hof': rendereBestellungBezahltHof,
  'bar-bestaetigt-hof': rendereBarBestaetigtHof,
  abholbereit: rendereAbholbereit,
  'nicht-abholbereit': rendereNichtAbholbereit,
  storniert: rendereStorniert,
  'artikel-fehlt': rendereArtikelFehlt,
  verfallen: rendereVerfallen,
  'zahlung-zu-spaet': rendereZahlungZuSpaet,
  'erstattung-offen': rendereErstattungOffen,
  'neuer-hof': rendereNeuerHof,
  freischaltung: rendereFreischaltung,
  meldung: rendereMeldung,
  wochenbericht: rendereWochenbericht,
  postfach: renderePostfachAntwort,
  'antwort-an-team': rendereAntwortAnTeam,
  'betreiber-testmail': rendereBetreiberTestmail,
  'abo-bestaetigung': rendereAboBestaetigung,
  'plattformgebuehr-ankuendigung': renderePlattformgebuehrAnkuendigung,
  'lastschrift-gescheitert': rendereLastschriftGescheitert,
  beitrag: rendereBeitrag,
  rundschreiben: rendereRundschreiben,
  bescheid: rendereBescheid,
  'widerruf-hof': rendereWiderrufHof,
  'widerruf-erstattet': rendereWiderrufErstattet,
  'widerruf-abgelehnt': rendereWiderrufAbgelehnt,
}
