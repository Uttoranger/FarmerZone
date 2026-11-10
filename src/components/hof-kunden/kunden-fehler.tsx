import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { LadeFehlerKasten } from '@/components/ui/lade-fehler-kasten'

/**
 * Fehler beim Laden der Kunden — inline statt der ganzseitigen 500 (DESIGN_SYSTEM „Zustände"),
 * mit dem Werkzeug-Kopf samt Unterzeile (G1) und dem orangen Kasten mit Fokus auf dem Ausweg
 * (G6, Liste Lauf 32 kunden Bild 6). Der Weg zurück ist ein gewöhnlicher Link auf dieselbe Seite:
 * Neu laden heißt neu abfragen.
 */
export function KundenFehler({ titel, nochmal, unterzeile }: { titel: string; nochmal: string; unterzeile?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 md:gap-[18px]">
      <WerkzeugKopf titel={titel} unterzeile={unterzeile} />
      <LadeFehlerKasten titel="Wir konnten deine Kunden gerade nicht laden." nochmal={nochmal} />
    </div>
  )
}
