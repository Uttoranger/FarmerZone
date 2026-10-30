import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, BetragsZeile, Knopf, KnopfReihe, Trenner, h1, bodyText, kleinText, highlightBox, highlightLabel, highlightValue } from './_layout'
import { formatEuro } from '@/lib/format'

/*
 * Die Mails des Widerrufs (Nr. 200, Register N39). Sätze kurz, geduzt, ohne
 * Fachwörter. Name, Adresse und Nachricht der Kundin stehen NIE im Betreff
 * (sendRaw schreibt den Betreff ins Log).
 */

export interface WiderrufEingangProps {
  /** Die Bestellnummer, wie die Kundin sie eingegeben hat bzw. aus dem Link. */
  bestellnummer: string | null
  /** „Die ganze Bestellung“ oder die gewählten Artikel bzw. der Freitext. */
  umfang: string[]
  /** Datum und Uhrzeit des Eingangs (Wien). */
  eingegangenAm: string
  naechsteSchritte: readonly string[]
  /** Der Hof als Vertragspartner, nur wenn der Widerruf über den signierten Link kam. */
  hofName: string | null
  marke: string
}

/** Eingangsbestätigung (§ 13a FAGG): Inhalt, Datum und Uhrzeit, die nächsten Schritte. */
export function WiderrufEingangEmail(p: WiderrufEingangProps) {
  return (
    <EmailLayout previewText="Dein Widerruf ist eingegangen" fusszeile={`Versandt von ${p.marke}.`}>
      <Text style={h1}>Dein Widerruf ist eingegangen</Text>
      <Text style={bodyText}>Wir haben deinen Widerruf am {p.eingegangenAm} erhalten. Diese E-Mail ist deine Eingangsbestätigung.</Text>
      {p.bestellnummer && <BetragsZeile links="Bestellnummer" rechts={p.bestellnummer} />}
      {p.hofName && <BetragsZeile umbrechen links="Vertragspartner" rechts={p.hofName} />}
      <BetragsZeile umbrechen links="Eingegangen" rechts={p.eingegangenAm} />
      <Trenner />
      <Text style={bodyText}>
        <strong>Widerrufen:</strong>
      </Text>
      {p.umfang.map((zeile, i) => (
        <Text key={i} style={kleinText}>
          {zeile}
        </Text>
      ))}
      <Trenner />
      <Text style={bodyText}>
        <strong>So geht es weiter</strong>
      </Text>
      {p.naechsteSchritte.map((satz, i) => (
        <Text key={i} style={kleinText}>
          {satz}
        </Text>
      ))}
    </EmailLayout>
  )
}

export interface WiderrufHofProps {
  bestellnummer: string
  /** Die widerrufenen Artikel bzw. „Die ganze Bestellung“. */
  umfang: string[]
  eingegangenAm: string
  bestellungUrl: string
  ausnahmeSatz: string
}

/** An den Hof: ein Widerruf nach der Abholung — prüfen, erstatten oder mit Grund ablehnen. */
export function WiderrufHofEmail(p: WiderrufHofProps) {
  return (
    <EmailLayout previewText={`Widerruf zu Bestellung ${p.bestellnummer}`}>
      <Text style={h1}>Eine Kundin hat widerrufen</Text>
      <Text style={bodyText}>
        Zur Bestellung <strong>{p.bestellnummer}</strong> ist am {p.eingegangenAm} ein Widerruf eingegangen. Bitte prüf die Rückgabe und erstatte –
        oder lehne mit Grund ab.
      </Text>
      {p.umfang.map((zeile, i) => (
        <Text key={i} style={kleinText}>
          {zeile}
        </Text>
      ))}
      <Text style={kleinText}>{p.ausnahmeSatz}</Text>
      <KnopfReihe>
        <Knopf href={p.bestellungUrl}>Bestellung öffnen</Knopf>
      </KnopfReihe>
    </EmailLayout>
  )
}

export interface WiderrufErgebnisProps {
  bestellnummer: string
  hofName: string
  /** Erstattet: Betrag in Euro (online) oder null (bar, der Hof gibt ihn zurück). */
  erstattet: number | null
  /** Abgelehnt: der Grund des Hofs. */
  grund: string | null
}

/** Das Ergebnis an die Kundin: erstattet (mit Betrag) oder abgelehnt (mit Grund). */
export function WiderrufErgebnisEmail(p: WiderrufErgebnisProps) {
  const abgelehnt = p.grund !== null
  return (
    <EmailLayout previewText={abgelehnt ? 'Dein Widerruf wurde abgelehnt' : 'Dein Widerruf ist erledigt'}>
      <Text style={h1}>{abgelehnt ? 'Dein Widerruf wurde abgelehnt' : 'Dein Widerruf ist erledigt'}</Text>
      {abgelehnt ? (
        <>
          <Text style={bodyText}>
            {p.hofName} hat deinen Widerruf zur Bestellung <strong>{p.bestellnummer}</strong> abgelehnt. Der Grund:
          </Text>
          <Text style={bodyText}>{p.grund}</Text>
          <Text style={kleinText}>Bist du nicht einverstanden? Wende dich direkt an den Hof oder antworte über „Problem melden“.</Text>
        </>
      ) : (
        <>
          <Text style={bodyText}>
            {p.hofName} hat die Rückgabe zur Bestellung <strong>{p.bestellnummer}</strong> bestätigt.
          </Text>
          {p.erstattet !== null ? (
            <div style={highlightBox}>
              <Text style={highlightLabel}>Zurück an dich</Text>
              <Text style={highlightValue}>{formatEuro(p.erstattet)}</Text>
              <Text style={{ ...kleinText, margin: 0 }}>Das Geld ist in 5–10 Werktagen wieder auf deinem Konto.</Text>
            </div>
          ) : (
            <Text style={bodyText}>Der Hof hat dir den Betrag bar zurückgegeben.</Text>
          )}
        </>
      )}
    </EmailLayout>
  )
}
