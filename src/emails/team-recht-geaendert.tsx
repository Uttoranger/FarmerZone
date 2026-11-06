import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, bodyText, h1, leiseZeile, zwischenTitel } from './_layout'
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
    <EmailLayout fuss={{ art: 'plattform' }} previewText={t.betreff[anlass]}>
      <Text style={h1}>{t.betreff[anlass]}</Text>
      {/* Board s3/w3-mail-team Bild 3: Anrede im Satz, die Rechte als Liste unter einer fetten Zeile. */}
      <Text style={bodyText}>{`${t.anrede(name)} ${t.satz[anlass]}`}</Text>
      {anlass !== 'entfernt' && rechte.length > 0 && (
        <>
          <Text style={zwischenTitel}>{t.rechteTitel}</Text>
          {rechte.map((r) => (
            <Text key={r} style={{ ...bodyText, margin: '0 0 2px', paddingLeft: '4px' }}>
              {`• ${r}`}
            </Text>
          ))}
        </>
      )}
      <Text style={{ ...leiseZeile, marginTop: '14px' }}>{t.nichtDu}</Text>
    </EmailLayout>
  )
}
