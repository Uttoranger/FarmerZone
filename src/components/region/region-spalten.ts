/*
 * Aufbau von /region ab 1024 px und die Kartenansicht am Handy (Nr. 272, Liste Lauf 32 region, Boards
 * s1-/w1-region Bild 1, 2 und 6) — für beide Reiter aus EINER Quelle:
 * - ab 1024 px Liste und Karte nebeneinander, ohne „Liste / Karte“ (die Karte steht immer da);
 * - darunter gilt die gewählte Ansicht; in der Kartenansicht stehen nur Umkreis und „Liste / Karte“ über
 *   der Karte, die übrigen Filter und Hinweise erst wieder in der Liste (die Karte rutscht nicht unter den
 *   Falz). Der Satz unter der Überschrift fällt dann über `REGION_SATZ_KARTE` weg.
 */

/** Ab dieser Breite stehen Liste und Karte nebeneinander. */
export const REGION_WEB_AB = 1024

/** Zwei Spalten ab 1024 px: links Hinweise und Liste, rechts die Karte (Board w1-region: etwa 620 zu 460 px). */
export const REGION_SPALTEN = 'flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.36fr)_minmax(0,1fr)] lg:items-start lg:gap-[18px]'

/** Die rechte Spalte klebt beim Scrollen der Liste oben. */
export const REGION_KARTEN_SPALTE = 'flex min-w-0 flex-col gap-3 lg:sticky lg:top-6'

/** Höhe der Karte: am Handy so, dass die Hofkarte darunter noch im Bild ist (Board s1-region Bild 6), im Web wie w1-region. */
export const REGION_KARTE_HOEHE = 'h-[300px] min-h-[260px] lg:h-[520px]'

/**
 * Markiert die Kartenansicht am Handy; der Satz unter der Überschrift (RegionKopf) blendet sich dann aus.
 * Der Rahmen der Seite trägt `group/region` (REGION_RAHMEN).
 */
export const REGION_KARTE_MARKE = { 'data-region-karte': '' } as const
export const REGION_SATZ_KARTE = 'group-has-[[data-region-karte]]/region:hidden'
