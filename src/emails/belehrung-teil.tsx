import * as React from 'react'
import { Link, Text } from '@react-email/components'
import { MAIL_FARBE, SCHRIFT_UEBERSCHRIFT, Trenner, bodyText, kleinText, textLink } from './_layout'
import { WIDERRUF_TEXT, type Belehrung } from '@/lib/widerruf'

const zwischentitel: React.CSSProperties = {
  color: MAIL_FARBE.text,
  fontFamily: SCHRIFT_UEBERSCHRIFT,
  fontSize: '17px',
  fontWeight: '600',
  margin: '18px 0 8px',
  lineHeight: '1.3',
}

const abschnittTitel: React.CSSProperties = { ...bodyText, fontWeight: '600', margin: '12px 0 6px' }
const absatz: React.CSSProperties = { ...bodyText, fontSize: '13px', margin: '0 0 8px' }
const formularZeile: React.CSSProperties = { ...absatz, margin: '0 0 4px' }

/**
 * Die Belehrung nach Anhang I FAGG in den Bestätigungsmails (Nr. 207, Auftrag
 * Punkt 1): Teil A mit den Angaben des Hofs dieser Bestellung, Teil B darunter,
 * dann der Hinweis zur Rückgabe am Hof und der Link zum Widerruf online. Der
 * Wortlaut kommt fertig gefüllt aus `belehrungMitHof` (src/lib/widerruf.ts) —
 * diese Vorlage zeichnet nur. Eine Webseite ist kein dauerhafter Datenträger
 * (EuGH C-49/11), darum steht der Text in der Mail selbst.
 */
export function BelehrungTeil({ belehrung, widerrufUrl }: { belehrung: Belehrung; widerrufUrl?: string }): React.JSX.Element {
  return (
    <>
      <Trenner />
      <Text style={zwischentitel}>{belehrung.teilA.titel}</Text>
      {belehrung.teilA.abschnitte.map((a) => (
        <React.Fragment key={a.titel}>
          <Text style={abschnittTitel}>{a.titel}</Text>
          {a.absaetze.map((t) => (
            <Text key={t} style={absatz}>
              {t}
            </Text>
          ))}
        </React.Fragment>
      ))}
      <Text style={zwischentitel}>{belehrung.teilB.titel}</Text>
      <Text style={absatz}>{belehrung.teilB.einleitung}</Text>
      {belehrung.teilB.zeilen.map((z) => (
        <Text key={z} style={formularZeile}>
          {z}
        </Text>
      ))}
      <Text style={absatz}>{belehrung.teilB.fussnote}</Text>
      <Text style={{ ...absatz, marginTop: '12px' }}>
        <strong>{`${belehrung.hinweisTitel}: `}</strong>
        {belehrung.hinweis}
      </Text>
      {widerrufUrl && (
        <Text style={kleinText}>
          <Link href={widerrufUrl} style={textLink}>
            {WIDERRUF_TEXT.knopfWiderrufen}
          </Link>
        </Text>
      )}
    </>
  )
}
