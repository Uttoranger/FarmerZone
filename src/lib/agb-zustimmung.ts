/**
 * Zustimmung der Höfe zu den AGB (§ 104 JN, P2B-Verordnung; Nachtlauf Nr. 207,
 * Auftrag Punkt 4): die Regel, wann ein Hof zustimmen soll, die Sätze der
 * Karte (Heute, Hof einrichten) und die Zeile der Admin-Hof-Akte. Rein und
 * ohne Datenbank (tests/agb-zustimmung.test.ts).
 *
 * Gespeichert werden nur die Fassung (AGB_NEUESTE aus
 * src/lib/rechtstexte/agb-fassung.ts, seit N45 '1.0') und der Zeitpunkt —
 * durch den Knopf, nie durch den Code: keine Zustimmungsfiktion. Ohne
 * Zustimmung bleibt der Hofbereich nutzbar (kein Lockout); es steht nur die
 * Karte da.
 *
 * Farm.agbFassung '1.0' mit agbZugestimmtAm vor dem Stichtag = Zustimmung
 * vorab nach der Ankündigung, samt Verzicht auf den Rest der Frist (AGB 32.4).
 * Eine neue Spalte gibt es dafür nicht (N45).
 */
import { AGB_LINK_TEXT, AGB_PFAD } from '@/lib/rechtstexte/agb-einbindung'
import { AGB_BISHER, AGB_NEUESTE, agbFassungPfad, type AgbKennung } from '@/lib/rechtstexte/agb-fassung'
import { formatDatumLang } from '@/lib/format'
import { uhrzeitInWien } from '@/lib/fristen'

/** Die Sätze der Karte „AGB bestätigen“ — Hofsprache, geduzt. */
export const AGB_ZUSTIMMUNG_TEXT = {
  titel: 'AGB bestätigen',
  satzNeu: (fassung: string) => `Bitte lies die AGB (Fassung ${fassung}) und stimm ihnen zu. Dein Hof bleibt in der Zwischenzeit wie gewohnt nutzbar.`,
  satzGeaendert: (fassung: string) => `Die AGB haben sich geändert (jetzt Fassung ${fassung}). Bitte lies sie und stimm ihnen zu. Dein Hof bleibt in der Zwischenzeit wie gewohnt nutzbar.`,
  // N45: vor dem Stichtag — „<Tag>“ ist der Stichtag, ohne geladenen Stichtag „dem Stichtag auf /konditionen“.
  satzVorStichtag: (tag: string | null) =>
    tag
      ? `Ab ${tag} gilt Fassung ${AGB_NEUESTE}. Bitte lies sie und stimm ihr zu – bis dahin gilt für dich Fassung ${AGB_BISHER}. Mit deiner Zustimmung gilt Fassung ${AGB_NEUESTE} für dich ab ${tag}, ohne weitere Ankündigungsfrist (Punkt 32.4).`
      : `Ab dem Stichtag auf /konditionen gilt Fassung ${AGB_NEUESTE}. Bitte lies sie und stimm ihr zu – bis dahin gilt für dich Fassung ${AGB_BISHER}. Mit deiner Zustimmung gilt Fassung ${AGB_NEUESTE} für dich ab dem Stichtag, ohne weitere Ankündigungsfrist (Punkt 32.4).`,
  neuesteLesen: `Fassung ${AGB_NEUESTE} lesen`,
  neuestePfad: agbFassungPfad(AGB_NEUESTE),
  bisher: `Fassung ${AGB_BISHER}`,
  bisherPfad: agbFassungPfad(AGB_BISHER),
  lesen: `${AGB_LINK_TEXT} lesen`,
  pfad: AGB_PFAD,
  knopf: 'Ich stimme den AGB zu',
  gespeichert: 'Danke – deine Zustimmung ist gespeichert.',
  abgemeldet: 'Bitte melde dich neu an.',
  veraltet: 'Die AGB haben sich gerade geändert. Lade die Seite neu und lies die neue Fassung.',
  fehler: 'Wir konnten deine Zustimmung nicht speichern. Versuch es bitte gleich noch einmal.',
} as const

/**
 * Was die Karte über den Stichtag weiß: `tag` ist der Stichtag als Text, null
 * wenn er nicht zu laden war; `erreicht` = die neueste Fassung gilt schon.
 * Ohne geladenen Stichtag steht der Satz „vor dem Stichtag“ ohne Datum da —
 * nie das Datum der Vorgabe (BAR_SERVICEGEBUEHR_AB), das vielleicht nicht gilt.
 */
export type AgbKartenStichtag = { tag: string | null; erreicht: boolean }

/** Aus dem geladenen Stichtag (oder null bei einem Ladefehler) und der Uhr. */
export function agbKartenStichtag(stichtag: Date | null, jetzt: Date): AgbKartenStichtag {
  if (!stichtag) return { tag: null, erreicht: false }
  return { tag: formatDatumLang(stichtag), erreicht: jetzt.getTime() >= stichtag.getTime() }
}

/** Der Satz der Karte: vor dem Stichtag mit Tag, beiden Fassungen und dem Verzicht (32.4), ab dem Stichtag wie seit Nr. 207. */
export function agbKartenSatz(lage: { fassung: AgbKennung; geaendert: boolean; stichtag: AgbKartenStichtag }): string {
  if (!lage.stichtag.erreicht) return AGB_ZUSTIMMUNG_TEXT.satzVorStichtag(lage.stichtag.tag)
  return lage.geaendert ? AGB_ZUSTIMMUNG_TEXT.satzGeaendert(lage.fassung) : AGB_ZUSTIMMUNG_TEXT.satzNeu(lage.fassung)
}

/** Soll der Hof zustimmen? Ja, solange er der aktuellen Fassung nicht zugestimmt hat (auch nach einer neuen Fassung). */
export function brauchtAgbZustimmung(hof: { agbFassung: string | null }, aktuell: AgbKennung = AGB_NEUESTE): boolean {
  return hof.agbFassung !== aktuell
}

/** Die Zeile der Admin-Hof-Akte: „Fassung 0.9 · 31.10.2026, 14:05 Uhr“ (Wiener Zeit) oder „noch nicht zugestimmt“. */
export function agbAkteText(hof: { agbFassung: string | null; agbZugestimmtAm: Date | null }): string {
  if (!hof.agbFassung || !hof.agbZugestimmtAm) return 'noch nicht zugestimmt'
  const datum = hof.agbZugestimmtAm.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Vienna' })
  return `Fassung ${hof.agbFassung} · ${datum}, ${uhrzeitInWien(hof.agbZugestimmtAm)} Uhr`
}
