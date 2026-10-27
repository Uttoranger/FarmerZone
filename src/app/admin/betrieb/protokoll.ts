import { ADMIN_AKTIONEN, type AdminAktionArt } from '@/schemas/admin-aktion'
import { PROTOKOLL_TAGE, PROTOKOLL_WER, protokollFilterSuche, type ProtokollFilter, type ProtokollTage, type ProtokollWer } from '@/schemas/betrieb-mails'
import { PROTOKOLL_ART_TEXT, protokollWer } from '@/lib/admin-hof-akte'
import { formatTagKurz, formatZahl } from '@/lib/format'
import { kalendertagInWien } from '@/lib/wiener-tag'
import { uhrzeitInWien } from '@/lib/fristen'
import { csvFeld } from '@/lib/finanzen'
import type { ProtokollNamen, ProtokollRoh } from '@/server/queries/admin-protokoll'

/*
 * Admin › Betrieb › Protokoll (Register N33, Nr. 193; Mockup admin-protokoll):
 * die reinen Regeln der Ansicht und der CSV. Wer ist „System“, „Du“ oder
 * „Team“ — nie ein Name (protokollWer, dieselbe Regel wie die Akte eines
 * Hofs). Der Bezug ist der Name des Hofs, die Bestellnummer oder die Kennung —
 * nie eine Adresse. Der Grund steht so da, wie er geschrieben wurde
 * (protokolliere hat ihn schon ohne Adresse und Telefonnummer gespeichert).
 */

export const ADMIN_BETRIEB_PROTOKOLL_EXPORT = '/admin/betrieb/protokoll/export'

export const PROTOKOLL_TEXT = {
  satz: 'Technik im Detail. Was dich braucht, steht in Heute.',
  filterBeschriftung: 'Protokoll filtern',
  wer: 'Wer',
  art: 'Art',
  zeitraum: 'Zeitraum',
  nurPasskey: 'nur mit Passkey bestätigt',
  bezug: 'Bezug suchen',
  bezugHilfe: 'Bestellnummer oder Kennung, genau',
  anwenden: 'Anwenden',
  titel: (tage: ProtokollTage) => `Protokoll der letzten ${tage} Tage`,
  spalten: { wann: 'Wann', wer: 'Wer', was: 'Was', bezug: 'Bezug', grund: 'Grund', passkey: 'Passkey' },
  bestaetigt: 'bestätigt',
  ohne: '–',
  ohneSr: 'nicht bestätigt',
  zahl: (gezeigt: number, gesamt: number) => `${formatZahl(gezeigt)} von ${formatZahl(gesamt)} ${gesamt === 1 ? 'Eintrag' : 'Einträgen'} · neueste zuerst`,
  csv: 'CSV mit Passkey',
  leerTitel: 'Kein Eintrag in diesem Zeitraum',
  leerSatz: 'Was das Team und die Abläufe tun, steht hier, sobald es passiert.',
  leerFilter: 'Filter zurücksetzen',
  ladefehler: 'Wir konnten das Protokoll gerade nicht laden.',
  regel:
    'Ins Protokoll schreibt jede Admin-Aktion und jedes Ereignis, das Geld oder einen Hof betrifft – auch das Ansehen einer vollen Adresse. Gespeichert werden Kennungen, Art und Grund, nie Adresse oder Inhalt. Einträge lassen sich nicht ändern oder löschen; das Aufräumen entfernt sie nach 5 Jahren.',
  werLabel: { alle: 'alle', system: 'System', ich: 'du', team: 'Team' } satisfies Record<ProtokollWer, string>,
  tageLabel: (t: ProtokollTage) => `${t} Tage`,
  artAlle: 'alle',
} as const

/**
 * Wie eine Art im Protokoll heißt — die Texte der Akte (PROTOKOLL_ART_TEXT)
 * und hier die übrigen Arten, damit jede einen Satz hat (Wache im Test).
 */
const ART_TEXT_WEITERE: Partial<Record<AdminAktionArt, string>> = {
  gruendung_einstellung_geaendert: 'Gründungsaktion geändert',
  meldung_triagiert: 'Meldung entschieden',
  meldung_buendel_stand: 'Bündel geändert',
  meldung_abgelegt: 'Meldung abgelegt',
  mail_jetzt_geschickt: 'Mail jetzt geschickt',
  mail_verworfen: 'Mail verworfen',
  mail_nochmal: 'Mail nochmal geschickt',
  mail_art_nochmal: 'Mails einer Art nochmal geschickt',
  betrieb_gemessen: 'Betrieb gemessen',
  kostenposten_angelegt: 'Kostenposten angelegt',
  kostenposten_geaendert: 'Kostenposten geändert',
  kostenposten_beendet: 'Kostenposten beendet',
  kostenposten_geloescht: 'Kostenposten gelöscht',
  finanzen_export: 'Geld als CSV geladen',
  monat_abgeschlossen: 'Monat abgeschlossen',
  erstattung_erledigt: 'Außerhalb erstattet',
  adresse_angezeigt: 'Volle Adresse angezeigt',
  notfall_storno: 'Notfall-Storno',
  hofpreis_stichtag_geaendert: 'Stichtag Hofpreis-Modell geändert',
  empfaenger_hinzugefuegt: 'Empfänger hinzugefügt',
  empfaenger_entfernt: 'Empfänger entfernt',
  zustellregeln_geaendert: 'Benachrichtigungen geändert',
  testmail_gesendet: 'Testmail geschickt',
  startseite_block_geloescht: 'Block der Startseite gelöscht',
  startseite_veroeffentlicht: 'Startseite veröffentlicht',
  startseite_zurueckgezogen: 'Fassung zurückgezogen',
  startseite_uebernommen: 'Fassung als Entwurf übernommen',
  bestellungen_angehalten: 'Bestellungen angehalten',
  bestellungen_freigegeben: 'Bestellungen wieder frei',
  team_eingeladen: 'Person eingeladen',
  team_rechte_geaendert: 'Rechte geändert',
  team_inhaber_gesetzt: 'Zum Inhaber gemacht',
  team_inhaber_entzogen: 'Inhaber-Recht entzogen',
  team_entfernt: 'Aus dem Team entfernt',
  ersatzcodes_erstellt: 'Ersatzcodes erstellt',
  passkey_entfernt: 'Passkey entfernt',
}

export function protokollArtName(art: string): string {
  const bekannt = art as AdminAktionArt
  return PROTOKOLL_ART_TEXT[bekannt] ?? ART_TEXT_WEITERE[bekannt] ?? art.replaceAll('_', ' ')
}

/** Alle Arten mit Namen für den Filter, nach Namen sortiert. */
export function protokollArtWahl(): Array<{ wert: AdminAktionArt; text: string }> {
  return ADMIN_AKTIONEN.map((a) => ({ wert: a, text: protokollArtName(a) })).sort((a, b) => a.text.localeCompare(b.text, 'de'))
}

/** Der Bezug als Text: Hofname, Bestellnummer, sonst die Kennung (Plattform-Teile ohne Vorsatz). */
export function protokollBezug(zeile: Pick<ProtokollRoh, 'bezugArt' | 'bezugId'>, namen: ProtokollNamen): string {
  if (zeile.bezugArt === 'hof') return namen.hoefe.get(zeile.bezugId) ?? zeile.bezugId
  if (zeile.bezugArt === 'bestellung') return namen.bestellungen.get(zeile.bezugId) ?? zeile.bezugId
  if (zeile.bezugArt === 'person') return 'Person im Team'
  if (zeile.bezugArt === 'plattform') return zeile.bezugId === 'plattform' ? 'Plattform' : zeile.bezugId
  return zeile.bezugId
}

export type ProtokollZeile = { id: string; wann: string; wer: string; was: string; bezug: string; grund: string | null; mitPasskey: boolean }

/** „Mo, 26. Okt · 09:41“ in Wiener Zeit. */
function wannText(wann: Date): string {
  return `${formatTagKurz(kalendertagInWien(wann))} · ${uhrzeitInWien(wann)}`
}

export function protokollZeilen(zeilen: readonly ProtokollRoh[], namen: ProtokollNamen, ich: string): ProtokollZeile[] {
  return zeilen.map((z) => ({
    id: z.id,
    wann: wannText(z.wann),
    wer: protokollWer(z.wer, ich),
    was: protokollArtName(z.art),
    bezug: protokollBezug(z, namen),
    grund: z.grund,
    mitPasskey: z.mitPasskey,
  }))
}

/**
 * Das Protokoll als CSV (UTF-8 mit BOM, Semikolon, CRLF wie Geld und Betrieb):
 * Zeitpunkt (Wiener Zeit), Wer, Art (Name und Schlüssel), Bezug, Kennung,
 * Grund, Passkey. Jeder Text geht durch csvFeld (keine Formeln beim Öffnen).
 */
export function protokollAlsCsv(zeilen: readonly ProtokollRoh[], namen: ProtokollNamen, ich: string): string {
  const kopf = ['Tag', 'Uhrzeit', 'Wer', 'Was', 'Art', 'Bezug', 'Bezugsart', 'Kennung', 'Grund', 'Passkey']
  const reihen = zeilen.map((z) => [
    kalendertagInWien(z.wann),
    uhrzeitInWien(z.wann),
    protokollWer(z.wer, ich),
    protokollArtName(z.art),
    z.art,
    protokollBezug(z, namen),
    z.bezugArt,
    z.bezugId,
    z.grund ?? '',
    z.mitPasskey ? 'ja' : 'nein',
  ])
  return `\uFEFF${[kopf, ...reihen].map((r) => r.map(csvFeld).join(';')).join('\r\n')}\r\n`
}

/** Die Adresse der CSV mit demselben Filter wie die Seite. */
export function protokollExportAdresse(f: ProtokollFilter): string {
  const q = protokollFilterSuche(f).toString()
  return q ? `${ADMIN_BETRIEB_PROTOKOLL_EXPORT}?${q}` : ADMIN_BETRIEB_PROTOKOLL_EXPORT
}

export { PROTOKOLL_TAGE, PROTOKOLL_WER }
