/**
 * Wo der Cookie-Hinweis steht (Nachtlauf Nr. 46) — rein, ohne DOM
 * (tests/cookie-hinweis.test.ts).
 *
 * Der Hinweis klebt unten rechts. Am Handy liegen dort feste Leisten: die
 * Unterleiste der Shells, der Kaufknopf der Kasse, „In den Korb" der
 * Produktseite, die Korb-Leiste der Hofseite. Vorher lag der Hinweis darüber
 * und verdeckte genau das, was die Kundin als Nächstes tippen will. Jetzt
 * steht er über der höchsten dieser Leisten. Welche Leiste dazugehört, sagt
 * das Merkmal `data-unten-fest` an der Leiste selbst — nicht eine Liste hier,
 * die beim nächsten neuen Knopf veraltet.
 */

/** Ohne feste Leiste: so weit vom unteren Rand wie bisher (`bottom-4`). */
export const COOKIE_HINWEIS_RAND_PX = 16

/** Luft zwischen der höchsten festen Leiste und dem Hinweis. */
export const COOKIE_HINWEIS_LUFT_PX = 12

/** Das Merkmal fester Leisten am unteren Rand (Unterleiste, Kaufknopf, Korb-Leiste). */
export const UNTEN_FEST_ATTRIBUT = 'data-unten-fest'

/** Lage einer Leiste im Fenster, wie getBoundingClientRect sie misst (px). */
export type LeistenMass = { oben: number; hoehe: number }

/** Was die Regel von einem gemessenen Rahmen (getBoundingClientRect) braucht. */
export type Rahmen = { top: number; bottom: number; height: number }

/**
 * Das Maß einer festen Leiste samt allem, was aus ihr herausragt: Der
 * erhobene Mittelknopf der Unterleiste steht 20 px über ihrer Oberkante
 * (`mittelknopfKlassen`, im Hofbereich 16 px) — der Rahmen der Leiste selbst
 * kennt ihn nicht, und ein Hinweis knapp über der Leiste läge auf dem Korb.
 * Inhalt ohne Höhe (ausgeblendet) zählt nicht.
 */
export function leistenMass(leiste: Rahmen, inhalt: readonly Rahmen[]): LeistenMass {
  let oben = leiste.top
  for (const teil of inhalt) {
    if (teil.height > 0 && Number.isFinite(teil.top) && teil.top < oben) oben = teil.top
  }
  return { oben, hoehe: leiste.bottom - oben }
}

/**
 * Abstand des Hinweises vom unteren Fensterrand in px: über der höchsten
 * sichtbaren Leiste plus Luft; ohne Leiste der gewohnte Rand. Eine Leiste
 * ohne Höhe ist ausgeblendet (`md:hidden`) und zählt nicht; eine, die unter
 * dem Fenster liegt, auch nicht. Mehr als das ganze Fenster belegt keine.
 */
export function cookieHinweisUnten(leisten: readonly LeistenMass[], fensterHoehe: number): number {
  let belegt = 0
  for (const leiste of leisten) {
    if (!(leiste.hoehe > 0) || !Number.isFinite(leiste.oben)) continue
    belegt = Math.max(belegt, Math.min(fensterHoehe, fensterHoehe - leiste.oben))
  }
  return belegt > 0 ? Math.ceil(belegt) + COOKIE_HINWEIS_LUFT_PX : COOKIE_HINWEIS_RAND_PX
}
