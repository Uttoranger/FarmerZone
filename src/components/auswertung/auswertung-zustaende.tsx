import { LadeFehlerKasten } from '@/components/ui/lade-fehler-kasten'

/*
 * Rahmen und Ladefehler der Auswertung (Nachtlauf Nr. 22c). Ein Skelett gibt
 * es seit Nr. 121 nicht mehr: Zeitraum und Pfeile zeigen einen Ladepunkt, die
 * alte Auswertung bleibt stehen (LadeRahmen in der Seite).
 */
// Im Web höchstens 900 px breit (Liste Lauf 32 auswertung „Inhalt bis zum Rand“, Board w2-auswertung).
export const AUSWERTUNG_RAHMEN = 'w-full max-w-[900px] px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10'

/** Ladefehler inline statt der ganzseitigen 500 (G6, Board s2-/w2-auswertung Bild 5); der Weg zurück ist dieselbe Adresse. */
export function AuswertungFehler({ nochmal }: { nochmal: string }): React.JSX.Element {
  return <LadeFehlerKasten titel="Wir konnten deine Zahlen gerade nicht laden." nochmal={nochmal} />
}
