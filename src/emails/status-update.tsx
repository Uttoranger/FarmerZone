import * as React from 'react'
import { Text, Link, Img } from '@react-email/components'
import { EmailLayout, Knopf, KnopfReihe, h1, bodyText, kleinText, MAIL_FARBE } from './_layout'
import { PRODUKTION_ADRESSE } from '@/lib/umgebung'
import { beitragLink } from '@/lib/teilen-fenster'
import { BEITRAG_ANLAESSE, BEITRAG_ANLASS, type BeitragAnlass } from '@/lib/beitrag-anlass'

// Farben aus der Mail-Palette (_layout.tsx): Grün für Frisches und Saison,
// Orange für Aktionen, neutral für Hinweise — Schrift und Fläche je Anlass.
const ANLASS_FARBE: Record<BeitragAnlass, { schrift: string; flaeche: string }> = {
  FRESH_PRODUCT: { schrift: MAIL_FARBE.gruen, flaeche: MAIL_FARBE.gruenFlaeche },
  NEW_SEASON: { schrift: MAIL_FARBE.gruen, flaeche: MAIL_FARBE.gruenFlaeche },
  PROMOTION: { schrift: MAIL_FARBE.orangeText, flaeche: MAIL_FARBE.orangeFlaeche },
  ANNOUNCEMENT: { schrift: MAIL_FARBE.text, flaeche: MAIL_FARBE.seite },
}

interface StatusUpdateEmailProps {
  farmName: string
  farmSlug: string
  title: string
  body: string
  anlass: string
  photoUrl?: string
  /**
   * Die Kennung des Beitrags (Register T5, Ergänzung Nr. 128): Der Knopf führt
   * dann zur Übersicht mit genau diesem Beitrag oben (`?beitrag=<id>`). Ohne
   * Kennung — der Beitrag steht nicht auf der Hofseite — die Hofseite selbst.
   */
  beitragId?: string
  unsubscribeUrl: string
  appUrl?: string
}

export function StatusUpdateEmail({
  farmName,
  farmSlug,
  title,
  body,
  anlass,
  photoUrl,
  beitragId,
  unsubscribeUrl,
  appUrl = PRODUKTION_ADRESSE,
}: StatusUpdateEmailProps) {
  const hofUrl = `${appUrl}/${farmSlug}`
  const farmUrl = beitragId ? beitragLink(hofUrl, beitragId) : hofUrl
  // Die Mail nimmt den Anlass als Text (opts.anlass in lib/email.ts); ein unbekannter gilt als Hinweis.
  const anlassArt: BeitragAnlass = BEITRAG_ANLAESSE.find((a) => a === anlass) ?? 'ANNOUNCEMENT'
  const anlassLabel = BEITRAG_ANLASS[anlassArt].wort
  const anlassFarbe = ANLASS_FARBE[anlassArt]

  return (
    <EmailLayout fuss={{ art: 'beitrag', hof: farmName }}
      previewText={`${farmName}: ${title}`}
      manageUrl={unsubscribeUrl}
    >
      {/* Anlass badge */}
      <div
        style={{
          display: 'inline-block',
          backgroundColor: anlassFarbe.flaeche,
          color: anlassFarbe.schrift,
          borderRadius: '100px',
          padding: '3px 10px',
          fontSize: '12px',
          fontWeight: '600',
          marginBottom: '8px',
        }}
      >
        {anlassLabel}
      </div>

      {/* Board s3/w3-mail-neuigkeiten Bild 2 und 3: Absender, dann das Foto (falls da), Titel, Text, Knopf links. */}
      <Text style={{ ...bodyText, color: MAIL_FARBE.textLeise, fontSize: '13px', margin: '0 0 10px' }}>Neuer Beitrag von {farmName}</Text>

      {/* Board Bild 2 (1440): Fotofläche 180 px hoch, der Ausschnitt per object-fit (Nr. 255). */}
      {photoUrl && <Img src={photoUrl} alt={title} style={{ width: '100%', height: '180px', borderRadius: '12px', margin: '0 0 16px', objectFit: 'cover' }} />}

      <Text style={h1}>{title}</Text>

      {body.split('\n').map((line, i) => (
        <Text key={i} style={{ ...bodyText, marginBottom: line ? '8px' : '4px' }}>
          {line || ' '}
        </Text>
      ))}

      <KnopfReihe>
        <Knopf href={farmUrl}>{`Zu ${farmName}`}</Knopf>
      </KnopfReihe>

      {/* Abmelden im Text (S11, unverändert): derselbe signierte Link wie unter dem Fuß und in List-Unsubscribe. */}
      <Text style={{ ...kleinText, marginTop: '8px' }}>
        {`Du bekommst diese E-Mail, weil du Neuigkeiten von ${farmName} per E-Mail bestellt hast. `}
        <Link href={unsubscribeUrl} style={{ color: MAIL_FARBE.textLeise, textDecoration: 'underline' }}>
          Abmelden
        </Link>
      </Text>
    </EmailLayout>
  )
}
