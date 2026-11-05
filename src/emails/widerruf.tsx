import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, BetragsZeile, Knopf, KnopfReihe, Trenner, h1, bodyText, kleinText, highlightBox, highlightLabel, highlightValue } from './_layout'
import { formatEuro } from '@/lib/format'
import { PROBLEM_MELDEN } from '@/lib/fehlerseite'

/*
 * Die Mails des Widerrufs (Nr. 200, Register N39). Sätze kurz, geduzt, ohne
 * Fachwörter; sie sagen „Rücktritt“ (Register N43, Wortliste). Wörtlich bleiben
 * bis zur Entscheidung der Anwältin nur der Betreff der Eingangsbestätigung samt
 * Vorschautext (§ 13a FAGG, N43 (1)) und „Vertrag widerrufen“ als Einstieg.
 * Name, Adresse und Nachricht der Kundin stehen NIE im Betreff (sendRaw
 * schreibt den Betreff ins Log).
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
}

/** Eingangsbestätigung (§ 13a FAGG): Inhalt, Datum und Uhrzeit, die nächsten Schritte. */
export function WiderrufEingangEmail(p: WiderrufEingangProps) {
  return (
    <EmailLayout fuss={{ art: 'plattform' }} previewText="Dein Widerruf ist eingegangen">
      <Text style={h1}>Dein Rücktritt ist eingegangen</Text>
      <Text style={bodyText}>{`Wir haben deinen Rücktritt am ${p.eingegangenAm} erhalten. Diese E-Mail ist deine Eingangsbestätigung.`}</Text>
      {p.bestellnummer && <BetragsZeile links="Bestellnummer" rechts={p.bestellnummer} />}
      {p.hofName && <BetragsZeile umbrechen links="Vertragspartner" rechts={p.hofName} />}
      <BetragsZeile umbrechen links="Eingegangen" rechts={p.eingegangenAm} />
      <Trenner />
      <Text style={bodyText}>
        <strong>Dein Rücktritt gilt für:</strong>
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
  /** Die Artikel des Rücktritts bzw. „Die ganze Bestellung“. */
  umfang: string[]
  eingegangenAm: string
  bestellungUrl: string
  ausnahmeSatz: string
}

/** An den Hof: ein Widerruf nach der Abholung — prüfen, erstatten oder mit Grund ablehnen. */
export function WiderrufHofEmail(p: WiderrufHofProps) {
  return (
    <EmailLayout fuss={{ art: 'plattform' }} previewText={`Rücktritt zu Bestellung ${p.bestellnummer}`}>
      <Text style={h1}>Eine Kundin ist zurückgetreten</Text>
      <Text style={bodyText}>
        Zur Bestellung <strong>{p.bestellnummer}</strong> ist am {p.eingegangenAm} ein Rücktritt eingegangen. Bitte prüf die Rückgabe und erstatte –
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
  /** Teilstorno vor der Abholung: keine Rückgabe; ohne Betrag (vor Ort) zahlt sie bei der Abholung weniger. */
  vorAbholung?: boolean
  /** Vor der Abholung nur zum Teil gebucht (eine spätere Position ging nicht): den Rest prüft der Hof; eine Ablehnung gilt dann nur den übrigen Artikeln. */
  teilweise?: boolean
}

/** Überschrift und Betreff des Ergebnisses — eine Quelle für Vorlage und src/lib/email.ts. */
export const WIDERRUF_ERGEBNIS_TITEL = {
  abgelehnt: 'Dein Rücktritt wurde abgelehnt',
  teilweise: 'Dein Rücktritt ist zum Teil erledigt',
  erledigt: 'Dein Rücktritt ist erledigt',
} as const

/** Das Ergebnis an die Kundin: erstattet (mit Betrag) oder abgelehnt (mit Grund). */
export function WiderrufErgebnisEmail(p: WiderrufErgebnisProps) {
  const abgelehnt = p.grund !== null
  const teilweise = !abgelehnt && p.vorAbholung === true && p.teilweise === true
  const titel = abgelehnt ? WIDERRUF_ERGEBNIS_TITEL.abgelehnt : teilweise ? WIDERRUF_ERGEBNIS_TITEL.teilweise : WIDERRUF_ERGEBNIS_TITEL.erledigt
  return (
    <EmailLayout fuss={{ art: 'hof' }} previewText={titel}>
      <Text style={h1}>{titel}</Text>
      {abgelehnt ? (
        <>
          <Text style={bodyText}>
            {p.hofName} hat deinen Rücktritt zur Bestellung <strong>{p.bestellnummer}</strong>
            {p.teilweise ? ' für die übrigen Artikel' : ''} abgelehnt. Der Grund:
          </Text>
          <Text style={bodyText}>{p.grund}</Text>
          <Text style={kleinText}>Bist du nicht einverstanden? Wende dich direkt an den Hof oder antworte über „{PROBLEM_MELDEN}“.</Text>
        </>
      ) : (
        <>
          {teilweise ? (
            <Text style={bodyText}>
              Einen Teil der Artikel, von denen du zurückgetreten bist, haben wir aus deiner Bestellung <strong>{p.bestellnummer}</strong> bei {p.hofName} gestrichen. Die übrigen prüft der Hof.
            </Text>
          ) : p.vorAbholung ? (
            <Text style={bodyText}>
              Die Artikel, von denen du zurückgetreten bist, sind aus deiner Bestellung <strong>{p.bestellnummer}</strong> bei {p.hofName} gestrichen.
            </Text>
          ) : (
            <Text style={bodyText}>
              {p.hofName} hat die Rückgabe zur Bestellung <strong>{p.bestellnummer}</strong> bestätigt.
            </Text>
          )}
          {p.erstattet !== null ? (
            <div style={highlightBox}>
              <Text style={highlightLabel}>Zurück an dich</Text>
              <Text style={highlightValue}>{formatEuro(p.erstattet)}</Text>
              <Text style={{ ...kleinText, margin: 0 }}>Das Geld ist in 5–10 Werktagen wieder auf deinem Konto.</Text>
            </div>
          ) : p.vorAbholung ? (
            <Text style={bodyText}>Bei der Abholung zahlst du nur noch die übrigen Artikel.</Text>
          ) : (
            <Text style={bodyText}>Der Hof hat dir den Betrag bar zurückgegeben.</Text>
          )}
        </>
      )}
    </EmailLayout>
  )
}
