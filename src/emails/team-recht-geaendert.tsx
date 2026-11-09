import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, Knopf, KnopfReihe, bodyText, h1, leiseZeile, zwischenTitel } from './_layout'
import { TEAM_MAIL, type TeamAnlass } from '@/lib/admin-team'
import { EINRICHTEN_TEXT } from '@/lib/admin-anmeldung'

/**
 * Sicherheitsmail an eine Person im Admin-Team (Register N35, Nr. 190):
 * eingeladen, Rechte geändert, Inhaber geworden bzw. nicht mehr, entfernt —
 * mit der Liste ihrer Rechte danach. Ohne Link zum Anmelden (wie
 * „Admin-Sicherheit“): Eine Mail, die zum Anmelden führt, wäre das Muster
 * jeder gefälschten Mail.
 */
export function TeamRechtGeaendertEmail({
  anlass,
  name,
  rechte,
  einrichten,
}: {
  anlass: TeamAnlass
  name: string | null
  rechte: string[]
  /** Nur bei der Einladung: die Seite „Admin-Zugang absichern“ (ohne Token; davor steht die Anmeldung). */
  einrichten?: string
}): React.JSX.Element {
  const t = TEAM_MAIL
  return (
    <EmailLayout fuss={{ art: 'plattform' }} previewText={t.betreff[anlass]}>
      <Text style={h1}>{t.betreff[anlass]}</Text>
      {/* Board s3/w3-mail-team Bild 3: Anrede im Satz, die Rechte als Liste unter einer fetten Zeile. */}
      <Text style={bodyText}>{`${t.anrede(name)} ${t.satz[anlass]}`}</Text>
      {anlass !== 'entfernt' && rechte.length > 0 && (
        <>
          <Text style={zwischenTitel}>{t.rechteTitel}</Text>
          {/* Board Bild 3 (B-Zeile „Rechte-Liste Einzug“, Nr. 255): eine echte Liste mit Einzug 18 px. */}
          <ul style={{ margin: '0 0 14px', paddingLeft: '18px' }}>
            {rechte.map((r) => (
              <li key={r} style={{ ...bodyText, margin: '0 0 2px' }}>
                {r}
              </li>
            ))}
          </ul>
        </>
      )}
      {/* Board s3/w3-mail-team Bild 3 (Nr. 280): die Hauptaktion der Einladung als Knopf. */}
      {anlass === 'eingeladen' && einrichten && (
        <KnopfReihe>
          <Knopf href={einrichten}>{EINRICHTEN_TEXT.titel}</Knopf>
        </KnopfReihe>
      )}
      <Text style={{ ...leiseZeile, marginTop: '14px' }}>{t.nichtDu}</Text>
    </EmailLayout>
  )
}
