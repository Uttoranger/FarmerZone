import * as React from 'react'
import { Section, Text } from '@react-email/components'
import { EmailLayout, bodyText, h1, highlightBox, kleinText, mutedText } from './_layout'
import { TEAM_MAIL, type TeamAnlass } from '@/lib/admin-team'

/**
 * Sicherheitsmail an eine Person im Admin-Team (Register N35, Nr. 190):
 * eingeladen, Rechte geändert, Inhaber geworden bzw. nicht mehr, entfernt —
 * mit der Liste ihrer Rechte danach. Ohne Link zum Anmelden (wie
 * „Admin-Sicherheit“): Eine Mail, die zum Anmelden führt, wäre das Muster
 * jeder gefälschten Mail.
 */
export function TeamRechtGeaendertEmail({ anlass, name, rechte }: { anlass: TeamAnlass; name: string | null; rechte: string[] }): React.JSX.Element {
  const t = TEAM_MAIL
  return (
    <EmailLayout previewText={t.betreff[anlass]}>
      <Text style={h1}>{t.betreff[anlass]}</Text>
      <Text style={bodyText}>
        {t.anrede(name)}
        <br />
        {t.satz[anlass]}
      </Text>
      {anlass !== 'entfernt' && rechte.length > 0 && (
        <Section style={{ ...highlightBox, padding: '12px 16px' }}>
          <Text style={{ ...kleinText, margin: '0 0 4px' }}>{t.rechteTitel}</Text>
          {rechte.map((r) => (
            <Text key={r} style={{ ...bodyText, margin: 0 }}>
              {r}
            </Text>
          ))}
        </Section>
      )}
      <Text style={mutedText}>{t.nichtDu}</Text>
    </EmailLayout>
  )
}
