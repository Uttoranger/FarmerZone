import * as React from 'react'
import { Text, Link, Img } from '@react-email/components'
import { EmailLayout, h1, bodyText, ctaButton, MAIL_FARBE } from './_layout'
import { PRODUKTION_ADRESSE } from '@/lib/umgebung'
import { beitragLink } from '@/lib/teilen-fenster'

const ANLASS_LABEL: Record<string, string> = {
  FRESH_PRODUCT: 'Frisches Produkt',
  NEW_SEASON: 'Neue Saison',
  PROMOTION: 'Aktion',
  ANNOUNCEMENT: 'Mitteilung',
}

// Farben aus der Mail-Palette (_layout.tsx): Grün für Frisches und Saison,
// Orange für Aktionen, neutral für Mitteilungen — Schrift und Fläche je Anlass.
const ANLASS_FARBE: Record<string, { schrift: string; flaeche: string }> = {
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
  const anlassLabel = ANLASS_LABEL[anlass] ?? 'Mitteilung'
  const anlassFarbe = ANLASS_FARBE[anlass] ?? ANLASS_FARBE.ANNOUNCEMENT

  return (
    <EmailLayout
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
          padding: '4px 12px',
          fontSize: '12px',
          fontWeight: '600',
          marginBottom: '16px',
        }}
      >
        {anlassLabel}
      </div>

      {/* Farm name */}
      <Text style={{ ...bodyText, color: MAIL_FARBE.textLeise, marginBottom: '4px' }}>
        Neuer Beitrag von {farmName}
      </Text>

      {/* Title */}
      <Text style={h1}>{title}</Text>

      {/* Photo */}
      {photoUrl && (
        <Img
          src={photoUrl}
          alt={title}
          style={{ width: '100%', borderRadius: '12px', margin: '16px 0', objectFit: 'cover' }}
        />
      )}

      {/* Body */}
      {body.split('\n').map((line, i) => (
        <Text key={i} style={{ ...bodyText, marginBottom: line ? '8px' : '4px' }}>
          {line || ' '}
        </Text>
      ))}

      {/* CTA */}
      <div style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Link href={farmUrl} style={ctaButton}>
          Mehr ansehen beim {farmName}
        </Link>
      </div>

      {/* Unsubscribe */}
      <Text style={{ color: MAIL_FARBE.textLeise, fontSize: '11px', textAlign: 'center', marginTop: '16px' }}>
        Du erhältst diese E-Mail, weil du E-Mail-Updates für {farmName} aktiviert hast.{' '}
        <Link href={unsubscribeUrl} style={{ color: MAIL_FARBE.textLeise }}>
          Abmelden
        </Link>
      </Text>
    </EmailLayout>
  )
}
