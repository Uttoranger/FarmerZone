import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { RechtstextVorlage } from '@/components/shared/rechtstext-vorlage'
import { INFOSEITE_LINK } from '@/components/shared/infoseite-stil'
import { AgbStuecke } from '@/components/rechtstexte/agb-stuecke'
import { AgbText, agbVerzeichnis } from '@/components/rechtstexte/agb-ansicht'
import { AGB_TEXTE } from '@/lib/rechtstexte/agb-texte'
import { AGB_FASSUNGEN, AGB_NEUESTE, agbFassungPfad, istAgbKennung, type AgbKennung } from '@/lib/rechtstexte/agb-fassung'
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
 * AGB_FASSUNGEN gibt es (istAgbKennung, sonst notFound()) — kein Pfad und kein
 * Import entsteht aus dem Parameter.
 *
 * Beide Kennungen stehen in generateStaticParams, jede andere ist mit
 * dynamicParams = false ein 404 (A005 4b) — der Parameter wählt nie etwas
 * außerhalb von AGB_FASSUNGEN. 0.9 liest nichts und entsteht beim Bau. 1.0
 * nennt im Vermerk den Stichtag und liest ihn ohne catch (scheitert das,
 * greift die Fehlerseite von /agb; ein catch mit Vorgabe ist bei Rechtstexten
 * verboten). Darum wartet 1.0 mit `connection()` auf eine echte Anfrage: Der
 * Bau der CI hat keine Datenbank und bräche sonst an /agb/1.0 ab. Den Stichtag
 * liest ladePlattformEinstellung aus dem Data Cache mit Etikett, nicht je
 * Aufruf aus der Datenbank; ein neuer Stichtag gilt damit sofort.
 */
export const revalidate = 3600
export const dynamicParams = false

export function generateStaticParams(): { fassung: AgbKennung }[] {
  return AGB_FASSUNGEN.map((fassung) => ({ fassung }))
}

type Props = { params: Promise<{ fassung: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { fassung } = await params
  if (!istAgbKennung(fassung)) return {}
  // Canonical auf sich selbst: /agb bleibt die Seite der geltenden Fassung.
  return { title: `AGB ${AGB_SEITE_TEXT.fassung(fassung)} — ${MARKE}`, alternates: { canonical: agbFassungPfad(fassung) } }
}

/** Der Stichtag für den Vermerk von 1.0 — erst zur Anfrage (`connection()`), nie beim Bau. */
async function stichtagJeAnfrage(): Promise<Date> {
  await connection()
  return hofpreisModellAb(hofpreisEinstellungAus(await ladePlattformEinstellung()))
}

export default async function AgbFassungPage({ params }: Props): Promise<React.JSX.Element> {
  const { fassung: kennung } = await params
  if (!istAgbKennung(kennung)) notFound()
  const kontext = kennung === AGB_NEUESTE ? { inkrafttreten: await stichtagJeAnfrage() } : OHNE_STICHTAG
  const fassung = AGB_TEXTE[kennung]
  return (
    <KundeShellMitSitzung>
      <RechtstextVorlage titel={fassung.titel} stand={fassung.vermerk(kontext)} drucken verzeichnis={agbVerzeichnis(fassung)}>
        <p className="font-semibold text-foreground print:hidden">
          <AgbStuecke stuecke={AGB_SEITE_TEXT.welcheGilt} linkKlasse={INFOSEITE_LINK} kontext={OHNE_STICHTAG} />
        </p>
        <AgbText fassung={fassung} kontext={kontext} />
      </RechtstextVorlage>
    </KundeShellMitSitzung>
  )
}
