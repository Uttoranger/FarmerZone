import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { RechtstextVorlage } from '@/components/shared/rechtstext-vorlage'
import { INFOSEITE_LINK } from '@/components/shared/infoseite-stil'
import { AgbStuecke } from '@/components/rechtstexte/agb-stuecke'
import { AgbText, agbVerzeichnis } from '@/components/rechtstexte/agb-ansicht'
import { AGB_TEXTE } from '@/lib/rechtstexte/agb-texte'
import { AGB_FASSUNGEN, AGB_NEUESTE, agbFassungPfad, istAgbKennung } from '@/lib/rechtstexte/agb-fassung'
import { AGB_SEITE_TEXT } from '@/lib/rechtstexte/agb-einbindung'
import { OHNE_STICHTAG } from '@/lib/rechtstexte/stuecke'
import { hofpreisEinstellungAus } from '@/lib/plattform-einstellung'
import { hofpreisModellAb } from '@/lib/plattformgebuehr'
import { ladePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { MARKE } from '@/lib/marke'

/*
 * Genau eine Fassung der AGB (N45): /agb/0.9 für alle Bestellungen im Modell
 * „bisher“, /agb/1.0 für das Hofpreis-Modell. Mail-Zeile und Kassensatz einer
 * bestehenden Bestellung verlinken hierher. Nur die Kennungen aus
 * AGB_FASSUNGEN gibt es (dynamicParams = false, dazu notFound()) — kein Pfad
 * und kein Import entsteht aus dem Parameter.
 *
 * Kein Satz hängt von der Uhr ab; nur der Vermerk von 1.0 nennt den Stichtag.
 * Darum statisch mit Stundentakt; speichert der Admin einen neuen Stichtag,
 * baut speichereHofpreisStichtag beide Seiten neu. Den Stichtag liest die Seite
 * ohne catch: Scheitert das, greift die Fehlerseite von /agb.
 */
export const dynamicParams = false
export const revalidate = 3600

export function generateStaticParams(): { fassung: string }[] {
  return AGB_FASSUNGEN.map((fassung) => ({ fassung }))
}

type Props = { params: Promise<{ fassung: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { fassung } = await params
  if (!istAgbKennung(fassung)) return {}
  // Canonical auf sich selbst: /agb bleibt die Seite der geltenden Fassung.
  return { title: `AGB ${AGB_SEITE_TEXT.fassung(fassung)} — ${MARKE}`, alternates: { canonical: agbFassungPfad(fassung) } }
}

export default async function AgbFassungPage({ params }: Props): Promise<React.JSX.Element> {
  const { fassung: kennung } = await params
  if (!istAgbKennung(kennung)) notFound()
  const kontext = kennung === AGB_NEUESTE ? { inkrafttreten: hofpreisModellAb(hofpreisEinstellungAus(await ladePlattformEinstellung())) } : OHNE_STICHTAG
  const fassung = AGB_TEXTE[kennung]
  return (
    <KundeShellMitSitzung>
      <RechtstextVorlage titel={fassung.titel} stand={fassung.vermerk(kontext)} drucken verzeichnis={agbVerzeichnis(fassung)}>
        <p className="font-semibold text-foreground print:hidden">
          <AgbStuecke stuecke={AGB_SEITE_TEXT.welcheGilt} linkKlasse={INFOSEITE_LINK} />
        </p>
        <AgbText fassung={fassung} kontext={kontext} />
      </RechtstextVorlage>
    </KundeShellMitSitzung>
  )
}
