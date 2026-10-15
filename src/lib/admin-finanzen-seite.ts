/**
 * Admin › Finanzen im Seitenmuster (Register N15, Nr. 94; Mockup
 * admin-finanzen): Seitenkopf mit Monat, Kennzahlen, Unterreiter — Inhalt und
 * Beträge sind die von heute, nur neu geordnet. Geld wird hier nur
 * angezeigt, neu gerechnet wird nichts (die Rechnung steht in finanzen.ts).
 * Rein und ohne Datenbank (tests/admin-finanzen-seite.test.ts).
 */
import { formatEuro, mitAnzahl } from '@/lib/format'
import type { UnterreiterDaten } from '@/lib/admin-seiten'
import { TARIFE_AB, TARIF_ZEILE } from '@/lib/konditionen'
import type { Monatsschluessel } from '@/lib/servicegebuehr'

export const FINANZEN_SEITE = {
  titel: 'Finanzen',
  satz: 'Ein Überblick, keine Buchhaltung: was die Plattform einnimmt, was sie kostet, ob sie sich trägt.',
  kennzahlen: 'Finanzen in Zahlen',
  reiter: 'Ansicht der Finanzen',
} as const

// ─── Unterreiter ─────────────────────────────────────────────────────────────

export const FINANZEN_REITER_IDS = ['monat', 'kosten', 'auszahlungen', 'entfallen'] as const
export type FinanzenReiterId = (typeof FINANZEN_REITER_IDS)[number]

export const FINANZEN_REITER_STANDARD: FinanzenReiterId = 'monat'

const REITER_LABEL: Record<FinanzenReiterId, string> = {
  monat: 'Monat',
  kosten: 'Kosten',
  auszahlungen: 'Auszahlungen',
  entfallen: 'Entfallene Gebühren',
}

/**
 * Die Adresse der Finanzseite: der Monat steht immer drin (teilbar, der
 * Zurück-Pfeil des Browsers tut das Richtige), der Reiter nur, wenn er nicht
 * der Standard ist.
 */
export function finanzenAdresse(ansicht: { monat: Monatsschluessel; reiter: FinanzenReiterId }): string {
  const parameter = new URLSearchParams({ monat: ansicht.monat })
  if (ansicht.reiter !== FINANZEN_REITER_STANDARD) parameter.set('reiter', ansicht.reiter)
  return `/admin/finanzen?${parameter.toString()}`
}

/** Der Name eines Reiters — Titel des Leerzustands, wenn er keinen Inhalt hat. */
export const finanzenReiterLabel = (id: FinanzenReiterId): string => REITER_LABEL[id]

export function finanzenUnterreiter(monat: Monatsschluessel): UnterreiterDaten[] {
  return FINANZEN_REITER_IDS.map((id) => ({ id, label: REITER_LABEL[id], href: finanzenAdresse({ monat, reiter: id }) }))
}

/**
 * Für die Reiter ohne Inhalt: Auszahlungen und Entfallene Gebühren stehen im
 * Muster, aber die Finanzseite hat dazu keine Zahlen (getFinanzen liefert sie
 * nicht), und neue Zahlen gehören nicht in diesen Umbau. Die Seite sagt das,
 * statt etwas zu erfinden.
 */
export const FINANZEN_REITER_OHNE_INHALT = 'Dazu zeigt diese Seite noch nichts.'

// ─── Kennzahl „Grundgebühren“ ────────────────────────────────────────────────

/**
 * „Grundgebühren € 0,00 — <Zeile der Tarife in der Anfangszeit> · n
 * Gründungshöfe“. Es gibt die Kachel nur vor dem Stichtag der Tarife
 * (`TARIFE_AB`, Register K1): Bis dahin ist die Grundgebühr 0 € — eine Regel,
 * keine Rechnung. Ab dem Stichtag gelten die Tarife, und die Seite hätte eine
 * Summe zu zeigen, die sie nicht kennt; dann fehlt die Kachel, statt eine
 * falsche 0 € zu behaupten. Das Wort für die Anfangszeit steht nur in
 * konditionen.ts (tests/konditionen-uebergang.test.ts wacht darüber): Der
 * Wortlaut der Satzmitte ist der der Tarif-Zeile (`TARIF_ZEILE`).
 */
export function grundgebuehrenKachel(jetzt: Date, gruendungshoefe: number): { wert: string; satz: string } | null {
  if (jetzt.getTime() >= TARIFE_AB.getTime()) return null
  return { wert: formatEuro(0), satz: `${TARIF_ZEILE.startphase.titel} · ${mitAnzahl(gruendungshoefe, 'Gründungshof', 'Gründungshöfe')}` }
}

/** Kurztitel der Kennzahlen für das Handy, wo drei Kacheln nebeneinander stehen. */
export const FINANZEN_KENNZAHL_KURZ = { online: 'Online', vorOrt: 'Vor Ort', grundgebuehren: 'Grundgebühr', kosten: 'Kosten', ergebnis: 'Ergebnis' } as const
