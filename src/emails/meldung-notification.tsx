import * as React from 'react'
import { Text, Link } from '@react-email/components'
import { EmailLayout, BetragsZeile, Knopf, KnopfReihe, h1, bodyText, leiseZeile, textLink } from './_layout'

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

/**
 * Nachricht an den Betreiber: eine neue FEHLER-Meldung im Postfach (Board
 * s3/w3-mail-betrieb Bild 2): Von, Seite, die Meldung als Zitat, der Knopf.
 * Text, Seite und Gerät sind Fremdtext — React escaped sie.
 */
export function MeldungNotificationEmail(p: MeldungNotificationProps) {
  const seite = [p.seiteUrl || '–', p.userAgent || p.viewport].filter(Boolean).join(' · ')
  return (
    <EmailLayout fuss={{ art: 'betrieb' }} previewText={`Fehlermeldung ${p.kurznummer}${p.farmName ? ` von ${p.farmName}` : ''}`}>
      <Text style={h1}>Neue Fehlermeldung {p.kurznummer}</Text>
      <BetragsZeile umbrechen links="Von" rechts={p.farmName ?? 'Kundin'} />
      <BetragsZeile umbrechen links="Seite" rechts={seite} />
      <Text style={{ ...bodyText, marginTop: '12px', whiteSpace: 'pre-wrap' }}>{`„${p.text}“`}</Text>
      {p.diagKennung && <Text style={leiseZeile}>{`Kennung: ${p.diagKennung}`}</Text>}
      {p.screenshotUrl && (
        <Text style={leiseZeile}>
          <Link href={p.screenshotUrl} style={textLink}>
            Screenshot öffnen
          </Link>
        </Text>
      )}
      <KnopfReihe>
        <Knopf href={p.adminUrl}>Im Postfach ansehen →</Knopf>
      </KnopfReihe>
    </EmailLayout>
  )
}
