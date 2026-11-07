import type { Metadata } from 'next'
import Link from 'next/link'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { RechtstextVorlage } from '@/components/shared/rechtstext-vorlage'
import { INFOSEITE_LINK } from '@/components/shared/infoseite-stil'
import { AgbText, agbVerzeichnis } from '@/components/rechtstexte/agb-ansicht'
import { AGB_TEXTE } from '@/lib/rechtstexte/agb-texte'
import { AGB_BISHER, AGB_NEUESTE, agbFassungPfad, geltendeAgbFassung } from '@/lib/rechtstexte/agb-fassung'
import { AGB_SEITE_TEXT } from '@/lib/rechtstexte/agb-einbindung'
import { hofpreisEinstellungAus } from '@/lib/plattform-einstellung'
import { hofpreisModellAb } from '@/lib/plattformgebuehr'
import { formatDatumLang } from '@/lib/format'
import { ladePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `AGB — ${MARKE}`, alternates: { canonical: '/agb' } }

// Bei jedem Aufruf frisch gebaut (N45, A005 4a): Welche Fassung gilt, hängt am
// Stichtag „Hofpreis-Modell ab“ und an der Uhr — ein Bau oder ein Stundentakt
// zeigte nach dem Stichtag noch 0.9. Den Stichtag liest die Seite aus dem Data
// Cache mit Etikett (ladePlattformEinstellung), nicht je Aufruf aus der Datenbank.
export const dynamic = 'force-dynamic'

/**
 * Die geltenden AGB (Register O4, N45) in der KundeShell — die Sitzung für
 * den Kopf liest der Browser (KundeShellMitSitzung). Vor dem Stichtag
 * Fassung 0.9 mit dem Hinweis auf 1.0, ab dem Stichtag 1.0 mit dem Link auf
 * 0.9; jede Fassung steht außerdem dauerhaft auf /agb/<Fassung>.
 *
 * Der Stichtag wird OHNE catch geladen: Scheitert das, zeigt agb/error.tsx die
 * Fehlerseite mit beiden Fassungen — nie eine Fassung ohne geprüften Stichtag
 * und nie die stille Vorgabe (ladeHofpreisEinstellung ist für Rechtstexte tabu).
 * Abrufen, speichern und ausdrucken muss man die AGB jederzeit können (§ 11
 * ECG): daher der Knopf, der den Druckdialog öffnet.
 */
export default async function AgbPage(): Promise<React.JSX.Element> {
  const einstellung = hofpreisEinstellungAus(await ladePlattformEinstellung())
  const jetzt = new Date()
  const kennung = geltendeAgbFassung(einstellung, jetzt)
  const stichtag = hofpreisModellAb(einstellung)
  const kontext = { inkrafttreten: stichtag }
  const fassung = AGB_TEXTE[kennung]
  return (
    <KundeShellMitSitzung>
      <RechtstextVorlage titel={fassung.titel} stand={fassung.vermerk(kontext)} drucken verzeichnis={agbVerzeichnis(fassung)}>
        {kennung === AGB_BISHER && (
          <p className="font-semibold text-foreground">
            {AGB_SEITE_TEXT.abStichtag(formatDatumLang(stichtag))}{' '}
            <Link href={agbFassungPfad(AGB_NEUESTE)} className={INFOSEITE_LINK}>
              {AGB_SEITE_TEXT.fassung10Lesen}
            </Link>
          </p>
        )}
        <AgbText fassung={fassung} kontext={kontext} />
        {kennung === AGB_NEUESTE && (
          <p className="border-t border-border pt-8 print:hidden">
            {/* Der Vortag: die letzte Millisekunde vor dem Stichtag, als Wiener Kalendertag. */}
            <Link href={agbFassungPfad(AGB_BISHER)} className={INFOSEITE_LINK}>
              {AGB_SEITE_TEXT.frueher(formatDatumLang(new Date(stichtag.getTime() - 1)))}
            </Link>
          </p>
        )}
      </RechtstextVorlage>
    </KundeShellMitSitzung>
  )
}
