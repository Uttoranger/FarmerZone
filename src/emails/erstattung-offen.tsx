import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, BetragsZeile, HinweisKasten, Knopf, KnopfReihe, h1 } from './_layout'

export interface ErstattungOffenProps {
  /** Was passiert ist — ein Satz. */
  was: string
  bestellnummer: string | null
  bestellId: string | null
  hofName: string | null
  /** Schon formatierte Beträge („€ 5,00"). */
  betraege: Array<{ label: string; wert: string }>
  handanweisung: string
  /** Die Kennung der Erstattung bei Stripe (re_…), falls bekannt. */
  stripeKennung: string | null
  /** Admin › Bestellungen — dort wird die Erstattung abgeschlossen. Fehlt sie, bleibt der Knopf weg. */
  bestellungenUrl?: string
}

/**
 * Betreiber-Meldung: Geld an eine Kundin steht aus (Storno ohne Erstattung,
 * später gescheiterte Erstattung; Board s3/w3-mail-betrieb Bild 3). Bewusst
 * ohne Name und Adresse der Kundin — die Bestellnummer genügt zum Wiederfinden.
 * Was zu tun ist, steht in der orangen Karte: Erstatten kann nur das Plattformkonto.
 */
export function ErstattungOffenEmail(p: ErstattungOffenProps) {
  const bestellung = [p.bestellnummer ?? 'unbekannt', p.hofName].filter(Boolean).join(' · ')
  return (
    <EmailLayout fuss={{ art: 'betrieb' }} previewText={`Erstattung offen${p.bestellnummer ? ` – Bestellung ${p.bestellnummer}` : ''}`}>
      <Text style={h1}>Erstattung offen</Text>
      <BetragsZeile umbrechen links="Bestellung" rechts={bestellung} />
      {p.betraege.map((b) => (
        <BetragsZeile key={b.label} links={b.label} rechts={b.wert} />
      ))}
      {p.stripeKennung && <BetragsZeile umbrechen links="Bei Stripe" rechts={p.stripeKennung} />}
      <HinweisKasten art="orange">{`${p.was} ${p.handanweisung}`}</HinweisKasten>
      {p.bestellungenUrl && (
        <KnopfReihe>
          <Knopf href={p.bestellungenUrl}>In Bestellungen öffnen →</Knopf>
        </KnopfReihe>
      )}
    </EmailLayout>
  )
}
