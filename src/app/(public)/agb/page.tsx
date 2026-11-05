import type { Metadata } from 'next'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { RechtstextVorlage } from '@/components/shared/rechtstext-vorlage'
import { AnhangAbschnitt, KurzErklaert, TeilAbschnitt, agbVerzeichnis } from '@/components/rechtstexte/agb-ansicht'
import { AGB_STAND_VERMERK, AGB_TEILE, AGB_TITEL } from '@/lib/rechtstexte/agb'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `AGB — ${MARKE}`, alternates: { canonical: '/agb' } }

/**
 * Die AGB (Register O4, Nr. 90) in der KundeShell, statisch — die Sitzung
 * für den Kopf liest der Browser (KundeShellMitSitzung), die Seite liest keine
 * Anfrage. Der Text kommt aus src/lib/rechtstexte/agb.ts (Quelle:
 * docs/recht/agb.md); die Seite trägt bis zur Freigabe der Fassung 1.0 den
 * Stand-Vermerk „Entwurf". Abrufen, speichern und ausdrucken muss man sie
 * jederzeit können (§ 11 ECG): daher der Knopf, der den Druckdialog öffnet.
 * Seit Nr. 231 in der Vorlage der Rechtsseiten (V62, Boards s3/w3-rechtstexte):
 * nur der Rahmen ist neu, der Wortlaut unverändert.
 */
export default function AgbPage(): React.JSX.Element {
  return (
    <KundeShellMitSitzung>
      <RechtstextVorlage titel={AGB_TITEL} stand={AGB_STAND_VERMERK} drucken verzeichnis={agbVerzeichnis()}>
        <KurzErklaert />
        {AGB_TEILE.map((teil) => (
          <TeilAbschnitt key={teil.id} teil={teil} />
        ))}
        <AnhangAbschnitt />
      </RechtstextVorlage>
    </KundeShellMitSitzung>
  )
}
