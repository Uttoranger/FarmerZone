/**
 * Teilen-Wirkung (Gate 7 Aufgabe 4, Auswertungs-Karte „Über deine geteilten
 * Links" in Nr. 22c) — die reine Zusammenfassung der Zählerzeilen.
 *
 * Eingabe sind nur Summen je Kanal und Tag (`TeilenAufruf`); heraus kommen
 * Summen je Kanal und gesamt. Personen kommen darin nicht vor (S8).
 */
import type { TeilenKanal } from '@prisma/client'
import { TEILEN_KANAL_NAME } from '@/lib/teilen-kanal'
import { kalendertagInWien } from '@/lib/wiener-tag'
import { tagVersetzt } from '@/lib/kalender'

export type TeilenZeile = { kanal: TeilenKanal; besuche: number; bestellungen: number }

export type TeilenKanalSumme = TeilenZeile & { name: string }

export type TeilenWirkung = {
  besuche: number
  bestellungen: number
  /** Kanäle mit mindestens einem Besuch oder einer Bestellung, die stärksten zuerst. */
  kanaele: TeilenKanalSumme[]
}

/** Summen je Kanal und gesamt — Reihenfolge: Besuche, dann Bestellungen, dann Name. */
export function fasseTeilenWirkungZusammen(zeilen: readonly TeilenZeile[]): TeilenWirkung {
  const jeKanal = new Map<TeilenKanal, TeilenZeile>()
  for (const z of zeilen) {
    const bisher = jeKanal.get(z.kanal) ?? { kanal: z.kanal, besuche: 0, bestellungen: 0 }
    jeKanal.set(z.kanal, {
      kanal: z.kanal,
      besuche: bisher.besuche + Math.max(0, z.besuche),
      bestellungen: bisher.bestellungen + Math.max(0, z.bestellungen),
    })
  }
  const kanaele = [...jeKanal.values()]
    .filter((k) => k.besuche > 0 || k.bestellungen > 0)
    .map((k) => ({ ...k, name: TEILEN_KANAL_NAME[k.kanal] }))
    .toSorted((a, b) => b.besuche - a.besuche || b.bestellungen - a.bestellungen || a.name.localeCompare(b.name, 'de'))
  return {
    besuche: kanaele.reduce((s, k) => s + k.besuche, 0),
    bestellungen: kanaele.reduce((s, k) => s + k.bestellungen, 0),
    kanaele,
  }
}

export type TeilenZeitraum = {
  /** Erster Tag (JJJJ-MM-TT, Wien), eingeschlossen. */
  von: string
  /** Letzter Tag (JJJJ-MM-TT, Wien), eingeschlossen. */
  bis: string
}

/** Die letzten `tage` Wiener Kalendertage bis einschließlich heute — für „letzte Woche" (7). */
export function letzteTage(jetzt: Date, tage: number): TeilenZeitraum {
  const bis = kalendertagInWien(jetzt)
  return { von: tagVersetzt(bis, -(Math.max(1, Math.floor(tage)) - 1)), bis }
}

/** Der laufende Monat in Wien bis heute — für die Auswertung (22c). */
export function diesenMonat(jetzt: Date): TeilenZeitraum {
  const bis = kalendertagInWien(jetzt)
  return { von: `${bis.slice(0, 8)}01`, bis }
}

/**
 * „14 Besuche, 3 Bestellungen über deine Links" — der Satz der Teilen-Zeile
 * (Mockup web-h3-heute-mit-teilen-karte). Ohne Besuch nichts: Eine Null wäre
 * keine Nachricht, nur ein Vorwurf.
 */
export function teilenWirkungSatz(wirkung: Pick<TeilenWirkung, 'besuche' | 'bestellungen'>): string | null {
  if (wirkung.besuche <= 0 && wirkung.bestellungen <= 0) return null
  const besuche = `${wirkung.besuche} ${wirkung.besuche === 1 ? 'Besuch' : 'Besuche'}`
  const bestellungen = `${wirkung.bestellungen} ${wirkung.bestellungen === 1 ? 'Bestellung' : 'Bestellungen'}`
  return `${besuche}, ${bestellungen} über deine Links`
}
