import type { Metadata } from 'next'
import { INFOSEITE_SPALTE, INFOSEITE_TEXT, INFOSEITE_TITEL } from '@/components/shared/infoseite-stil'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { SeiteDrucken } from '@/components/rechtstexte/seite-drucken'
import {
  AnhangAbschnitt,
  InhaltsVerzeichnis,
  KurzErklaert,
  TeilAbschnitt,
} from '@/components/rechtstexte/agb-ansicht'
import { AGB_SEITE_TEXT, AGB_STAND_VERMERK, AGB_TEILE, AGB_TITEL } from '@/lib/rechtstexte/agb'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `AGB — ${MARKE}` }

/**
 * Die AGB (Register O4, Nr. 90) in der KundeShell, gebaut wie das Impressum:
 * Spalte, Titel und Abschnitte aus infoseite-stil.ts, statisch — die Sitzung
 * für den Kopf liest der Browser (KundeShellMitSitzung), die Seite liest keine
 * Anfrage. Der Text kommt aus src/lib/rechtstexte/agb.ts (Quelle:
 * docs/recht/agb.md); die Seite trägt bis zur Freigabe der Fassung 1.0 den
 * Stand-Vermerk „Entwurf". Abrufen, speichern und ausdrucken muss man sie
 * jederzeit können (§ 11 ECG): daher der Knopf, der den Druckdialog öffnet.
 */
export default function AgbPage() {
  return (
    <KundeShellMitSitzung>
      <div className={INFOSEITE_SPALTE}>
        <h1 className={INFOSEITE_TITEL}>{AGB_TITEL}</h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground">{AGB_STAND_VERMERK}</p>
        <div className="mt-4 mb-8">
          <SeiteDrucken>{AGB_SEITE_TEXT.drucken}</SeiteDrucken>
        </div>

        <div className={INFOSEITE_TEXT}>
          <InhaltsVerzeichnis />
          <KurzErklaert />
          {AGB_TEILE.map((teil) => (
            <TeilAbschnitt key={teil.id} teil={teil} />
          ))}
          <AnhangAbschnitt />
        </div>
      </div>
    </KundeShellMitSitzung>
  )
}
