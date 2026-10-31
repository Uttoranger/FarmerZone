/**
 * Zustimmung der Höfe zu den AGB (§ 104 JN, P2B-Verordnung; Nachtlauf Nr. 207,
 * Auftrag Punkt 4): die Regel, wann ein Hof zustimmen soll, die Sätze der
 * Karte (Heute, Hof einrichten) und die Zeile der Admin-Hof-Akte. Rein und
 * ohne Datenbank (tests/agb-zustimmung.test.ts).
 *
 * Gespeichert werden nur die Fassung (Kennung aus AGB_STAND_VERMERK, gelesen
 * von agbFassung in src/lib/rechtstexte/agb-datei.ts) und der Zeitpunkt —
 * durch den Knopf, nie durch den Code: keine Zustimmungsfiktion. Ohne
 * Zustimmung bleibt der Hofbereich nutzbar (kein Lockout); es steht nur die
 * Karte da.
 */
import { AGB_LINK_TEXT, AGB_PFAD } from '@/lib/rechtstexte/agb-einbindung'

/** Die Sätze der Karte „AGB bestätigen“ — Hofsprache, geduzt. */
export const AGB_ZUSTIMMUNG_TEXT = {
  titel: 'AGB bestätigen',
  satzNeu: (fassung: string) => `Bitte lies die AGB (Fassung ${fassung}) und stimm ihnen zu. Dein Hof bleibt in der Zwischenzeit wie gewohnt nutzbar.`,
  satzGeaendert: (fassung: string) => `Die AGB haben sich geändert (jetzt Fassung ${fassung}). Bitte lies sie und stimm ihnen zu. Dein Hof bleibt in der Zwischenzeit wie gewohnt nutzbar.`,
  lesen: `${AGB_LINK_TEXT} lesen`,
  pfad: AGB_PFAD,
  knopf: 'Ich stimme den AGB zu',
  gespeichert: 'Danke – deine Zustimmung ist gespeichert.',
  abgemeldet: 'Bitte melde dich neu an.',
  veraltet: 'Die AGB haben sich gerade geändert. Lade die Seite neu und lies die neue Fassung.',
  fehler: 'Wir konnten deine Zustimmung nicht speichern. Versuch es bitte gleich noch einmal.',
} as const

/** Soll der Hof zustimmen? Ja, solange er der aktuellen Fassung nicht zugestimmt hat (auch nach einer neuen Fassung). */
export function brauchtAgbZustimmung(hof: { agbFassung: string | null }, aktuell: string): boolean {
  return hof.agbFassung !== aktuell
}

/** Die Zeile der Admin-Hof-Akte: „Fassung 0.9 · 31.10.2026, 14:05 Uhr“ (Wiener Zeit) oder „noch nicht zugestimmt“. */
export function agbAkteText(hof: { agbFassung: string | null; agbZugestimmtAm: Date | null }): string {
  if (!hof.agbFassung || !hof.agbZugestimmtAm) return 'noch nicht zugestimmt'
  const datum = hof.agbZugestimmtAm.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Vienna' })
  const zeit = hof.agbZugestimmtAm.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' })
  return `Fassung ${hof.agbFassung} · ${datum}, ${zeit} Uhr`
}
