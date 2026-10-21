/**
 * Fabrik für `HofRohdaten` (Nr. 127, Regelvorschlag 119): eine Hofzeile, wie `getAdminFarms` sie liefert.
 * Testdateien überschreiben nur, was sie prüfen: `hofRohdaten({ stripeBereit: true })`. Kommt dem Typ ein
 * Pflichtfeld dazu, ergänzt man es HIER — und nur hier (Wache `tests/fabrik-wache.test.ts`).
 *
 * Jeder Aufruf baut ein frisches Objekt, auch die Daten. Personendaten sind erfunden (`@example.com`).
 */
import type { HofRohdaten } from '@/lib/admin-hoefe'

export function hofRohdaten(teil: Partial<HofRohdaten> = {}): HofRohdaten {
  return {
    id: 'farm_1',
    name: 'Hof Test',
    slug: 'hof-test',
    ownerEmail: 'max@example.com',
    emailBestaetigt: true,
    emailBestaetigungOffen: false,
    createdAt: new Date('2026-10-06T09:00:00+02:00'),
    approvedAt: null,
    archivedAt: null,
    land: 'AT',
    serviceFeePercent: 5,
    serviceFeeMinCents: 50,
    serviceFeeActiveFrom: null,
    monat: { bestellungen: 0, gebuehrOnlineCents: 0, gebuehrBarCents: 0, gebuehrEntfallenCents: 0 },
    monatBezeichnung: 'Oktober 2026',
    stripeBereit: false,
    onlineAn: true,
    isPaused: false,
    betriebsnummer: null,
    sepaErteilt: false,
    gruendungAusgenommen: false,
    istTesthof: false,
    hatKartenpunkt: true,
    produktImShop: true,
    ...teil,
  }
}
