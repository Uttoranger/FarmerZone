/*
 * Rechnet Preise in ganzen Cent.
 */
export const PREIS_FAKTOR = 100

export function inCent(euro: string): number {
  return Math.round(Number(euro.replace(',', '.')) * PREIS_FAKTOR)
}
