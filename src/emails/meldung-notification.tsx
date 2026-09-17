import * as React from 'react'
import { Text, Link } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, highlightBox, highlightLabel, highlightValue, ctaButton } from './_layout'

export interface MeldungNotificationProps {
  kurznummer: string
  text: string
  seiteUrl: string
  userAgent: string
  viewport: string
  diagKennung: string | null
  farmName: string | null
  screenshotUrl: string | null
  createdAt: string
  adminUrl: string
}

/** Betreiber-Benachrichtigung: eine neue FEHLER-Meldung im Briefkasten. */
export function MeldungNotificationEmail(p: MeldungNotificationProps) {
  return (
    <EmailLayout previewText={`Fehlermeldung ${p.kurznummer}${p.farmName ? ` von ${p.farmName}` : ''}`}>
      <Text style={h1}>Neue Fehlermeldung {p.kurznummer}</Text>
      <Text style={bodyText}>
        {p.farmName ? <><strong>{p.farmName}</strong> hat</> : 'Eine Kundin hat'} einen Fehler gemeldet.
        Eingang: {p.createdAt}.
      </Text>

      <div style={highlightBox}>
        <Text style={highlightLabel}>Meldung</Text>
        <Text style={{ ...highlightValue, whiteSpace: 'pre-wrap' }}>{p.text}</Text>

        <Text style={{ ...highlightLabel, marginTop: '14px' }}>Kontext</Text>
        <Text style={mutedText}>
          {p.seiteUrl || '–'}
          <br />
          {p.viewport || '–'} · {p.userAgent || '–'}
        </Text>

        {p.diagKennung && (
          <>
            <Text style={{ ...highlightLabel, marginTop: '14px' }}>Kennung</Text>
            <Text style={{ ...highlightValue, fontFamily: 'monospace' }}>{p.diagKennung}</Text>
          </>
        )}

        {p.screenshotUrl && (
          <Text style={{ ...mutedText, marginTop: '14px' }}>
            <Link href={p.screenshotUrl} style={{ color: '#15803d' }}>Screenshot öffnen</Link>
          </Text>
        )}
      </div>

      <Link href={p.adminUrl} style={ctaButton}>Im Briefkasten ansehen →</Link>

      <Text style={mutedText}>
        Wünsche und Fragen kommen nicht per Mail — sie stehen gesammelt im Briefkasten und in der
        Wochen-Zusammenfassung.
      </Text>
    </EmailLayout>
  )
}
