/**
 * Eine Zeile PlattformEinstellung, wie Prisma sie mit PLATTFORM_EINSTELLUNG_SELECT
 * liefert — für Tests, die den Stichtag „Hofpreis-Modell ab“ (Register N38,
 * Nr. 197) setzen. Alle übrigen Werte sind erfundene Vorgaben.
 */
export function einstellungsZeile(hofpreisModellAb: Date | null): {
  gruendungPlaetze: number
  gruendungBisStandard: Date
  gruendungAnzeige: boolean
  gruendungMonate: number
  gruendungAktionBis: Date | null
  gruendungFestAm: Date | null
  hofpreisModellAb: Date | null
  geaendertVonUserId: string | null
  updatedAt: Date
} {
  return {
    gruendungPlaetze: 50,
    gruendungBisStandard: new Date('2027-12-31T12:00:00.000Z'),
    gruendungAnzeige: true,
    gruendungMonate: 12,
    gruendungAktionBis: null,
    gruendungFestAm: null,
    hofpreisModellAb,
    geaendertVonUserId: null,
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  }
}
