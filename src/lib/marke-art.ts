/**
 * Die vier Bedeutungen einer Marke (Register G5): tun — die Kundin oder der
 * Hof muss etwas tun · läuft · erledigt · abgebrochen.
 *
 * Hier steht nur die Bedeutung, nie eine Farbe: Text und Fläche je Art sind
 * Tokens in beiden Modi (`--fz-zustand-<art>`, `--fz-zustand-<art>-grund` in
 * src/app/globals.css), gezeichnet nur vom Baustein `Marke`
 * (src/components/ui/marke.tsx). Der Typ liegt in src/lib, weil die
 * Fachregeln (bestellstatus.ts, meldung.ts) ihn liefern und lib nicht aus
 * components liest.
 */
export const MARKE_ARTEN = ['tun', 'laeuft', 'erledigt', 'abgebrochen'] as const

export type MarkeArt = (typeof MARKE_ARTEN)[number]
