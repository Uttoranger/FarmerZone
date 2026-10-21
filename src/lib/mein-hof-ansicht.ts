/**
 * Die Kundenansicht von „Mein Hof" unter lg (Nachtlauf Nr. 49, Register
 * N3/N4; seit Nr. 107 als Vollbild, N4 ergänzt): die Adresse `?ansicht=kundin`,
 * was der Rahmen zeigt, bis zu welcher Breite es das Vollbild gibt und
 * „Gespeichert · Ansehen". Rein und ohne Browser prüfbar
 * (tests/mein-hof-ansicht.test.ts); gezeichnet wird in
 * components/mein-hof/mein-hof-ansicht.tsx und kundenansicht-vollbild.tsx.
 *
 * Eine eigene Datei statt lib/mein-hof.ts: Die Hofseite für Kundinnen bindet
 * mein-hof.ts ein (Titelbild), und die Navigation des Hofbereichs gehört nicht
 * in ihr Bündel.
 */
import { BEITRAEGE_HREF, GESPEICHERT_TEXT, MEIN_HOF_REITER_HOFBEREICH, type MeinHofReiterAlleId } from '@/lib/bauern-navigation'
import { AKTUELL_VOM_HOF_TEXT } from '@/lib/hofseite-kunde'
import { NEUER_BEITRAG_HREF, laeuftNochText, type DeinBeitrag } from '@/lib/heute'
import { reiterAdresse } from '@/lib/hofseite-kunde'
import { vorschauLink } from '@/lib/hofseite-vorschau'
import { MEIN_HOF_ANSICHT_PARAMETER, meinHofAnsichtSchema, type MeinHofAnsichtId } from '@/schemas/mein-hof-ansicht'
import type { HofReiterId } from '@/schemas/hofseite-reiter'
import type { HofseiteZeileId } from '@/schemas/hofseite-vorschau'

export type { MeinHofAnsichtId }

/** Alle Wörter der Kundenansicht und von „Gespeichert · Ansehen" — EINE Quelle. */
export const MEIN_HOF_ANSICHT_TEXT = {
  /** Der Knopf im Kopf von Mein Hof und der Titel des Vollbilds (Wortliste: Kundenansicht). */
  kundenansicht: 'Kundenansicht',
  /** Die zweite Zeile im Band des Vollbilds (Register N4, Ergänzung Nr. 107). */
  kundschaft: 'So sieht dich die Kundschaft',
  /** Schließt das Vollbild. */
  fertig: 'Fertig',
  /**
   * Für Screenreader an Links, deren Text den neuen Tab nicht nennt (`sr-only`):
   * „Kundenansicht" ab lg, die Adresse im Kopf.
   */
  neuerTabHinweis: ' (öffnet in neuem Tab)',
  /** Titel des Rahmens mit der echten Hofseite (für Screenreader). */
  rahmenTitel: 'So sehen Kunden deine Hofseite',
  gespeichert: GESPEICHERT_TEXT,
  ansehen: 'Ansehen',
} as const

/** Die Ansicht aus der Adresse (`?ansicht=`) — was nicht passt, ist „Bearbeiten" (kein Vollbild). */
export function meinHofAnsichtAus(wert: string | null | undefined): MeinHofAnsichtId {
  return meinHofAnsichtSchema.parse(wert)
}

/**
 * Die aktuelle Adresse mit der gewählten Ansicht — die übrigen Parameter
 * (Reiter, Filter, Suche) bleiben, „Bearbeiten" trägt keinen Parameter.
 */
export function ansichtAdresse(pfad: string, suche: string, ansicht: MeinHofAnsichtId): string {
  const params = new URLSearchParams(suche)
  params.delete(MEIN_HOF_ANSICHT_PARAMETER)
  if (ansicht === 'kundin') params.set(MEIN_HOF_ANSICHT_PARAMETER, ansicht)
  const query = params.toString()
  return query ? `${pfad}?${query}` : pfad
}

function reiterHref(reiter: MeinHofReiterAlleId): string {
  const eintrag = MEIN_HOF_REITER_HOFBEREICH.find((r) => r.id === reiter)
  if (!eintrag) throw new Error(`Kein Reiter „${reiter}"`)
  return eintrag.href
}

/**
 * Ein Reiter von Mein Hof mit offener Kundenansicht — für „Ansehen" von
 * einer anderen Seite aus (nach dem Veröffentlichen eines Beitrags auf
 * /status/new). Die Adresse des Reiters kommt aus MEIN_HOF_REITER_HOFBEREICH.
 */
export function kundinAdresse(reiter: MeinHofReiterAlleId): string {
  const [pfad, suche = ''] = reiterHref(reiter).split('?')
  return ansichtAdresse(pfad, suche, 'kundin')
}

/** Welcher Reiter der Hofseite zu welchem Reiter von Mein Hof gehört. */
const HOFSEITEN_REITER: Record<MeinHofReiterAlleId, HofReiterId> = {
  produkte: 'produkte',
  hofseite: 'uebersicht',
  beitraege: 'beitraege',
}

/**
 * Was die Kundenansicht im Rahmen zeigt: die echte Hofseite in der
 * Vorschau (vorschauLink, ARCHITECTURE §4 „Die Hofseite gibt es genau
 * einmal"), geöffnet auf dem passenden Reiter — Produkte zeigt den Reiter
 * Produkte der Hofseite. Gibt es den Reiter dort nicht (kein Beitrag), zeigt
 * die Hofseite die Übersicht (aktiverReiter).
 */
export function kundenAnsichtAdresse(slug: string, reiter: MeinHofReiterAlleId): string {
  const [pfad, suche = ''] = vorschauLink(slug).split('?')
  return reiterAdresse(pfad, suche, HOFSEITEN_REITER[reiter])
}

/**
 * Bis zu welcher Breite die Kundenansicht als Vollbild öffnet (bis Nr. 107:
 * der Umschalter): Produkte gehört nur unter md zu Mein Hof (Register N3, ab
 * md ein eigener Punkt der Seitenleiste), Hofseite und Beiträge unter lg (N4,
 * ab lg steht die Vorschau neben der Liste bzw. öffnet der Kopf einen neuen
 * Tab).
 */
export function umschalterBis(reiter: MeinHofReiterAlleId): 'md' | 'lg' {
  return reiter === 'produkte' ? 'md' : 'lg'
}

/**
 * Ab diesen Breiten gibt es das Vollbild nicht mehr — die Grenzen md und lg
 * von Tailwind, für Abfragen im Browser (matchMedia), die keine Klasse kennen.
 */
export const UMSCHALTER_AB_PX = { md: 768, lg: 1024 } as const

/** Wo gespeichert wurde: ein Abschnitt der Hofseite (Markierung) oder ein Beitrag. */
export type GespeichertAbschnitt = HofseiteZeileId | 'beitraege'

/**
 * Die Kennung von „Gespeichert · Ansehen" je Abschnitt: Speichert man denselben
 * Abschnitt noch einmal (Fotos mehrmals umsortiert), ersetzt der neue Hinweis
 * den offenen und fängt neu an, statt sich darüberzulegen. Ohne Abschnitt
 * teilen sich alle Meldungen eine Kennung.
 */
export function gespeichertHinweisId(abschnitt: GespeichertAbschnitt | null): string {
  return abschnitt ? `gespeichert-ansehen-${abschnitt}` : 'gespeichert-ansehen'
}

// ─── „Aktuell vom Hof“ in Mein Hof › Hofseite (Register E12, Nr. 129) ───────

/** Die Zeile „Aktuell vom Hof“, wie Liste (unter lg) und Editor (ab lg) sie zeichnen. */
export type AktuellZeile = { titel: string; wert: string; link: { text: string; href: string } }

/**
 * Die erste Zeile der Teile der Hofseite: Die Hofseite zeigt den laufenden
 * Beitrag oben („Aktuell vom Hof“, F8), also steht er auch hier zuerst — mit
 * „läuft noch …“ und dem Weg zu Mein Hof › Beiträge, wo er verwaltet wird.
 * Ohne laufenden Beitrag „Kein Beitrag“ und „Neuer Beitrag ›“ (das „›“ zeichnet
 * die Liste als Symbol). Eine Zeile mit Link, kein Abschnitt zum Bearbeiten;
 * die Markierung in der Vorschau läuft über die Kennung `aktuell` in
 * hofseiteZeileIdSchema (Freigabe 129.4, Runde 2) — wie jede Zeile.
 */
export function aktuellZeile(beitrag: Pick<DeinBeitrag, 'titel' | 'endet'> | null, jetzt: Date): AktuellZeile {
  if (!beitrag) return { titel: AKTUELL_VOM_HOF_TEXT.titel, wert: 'Kein Beitrag', link: { text: 'Neuer Beitrag', href: NEUER_BEITRAG_HREF } }
  return {
    titel: AKTUELL_VOM_HOF_TEXT.titel,
    wert: `${beitrag.titel} · ${laeuftNochText(beitrag.endet, jetzt)}`,
    link: { text: 'Beiträge', href: BEITRAEGE_HREF },
  }
}
