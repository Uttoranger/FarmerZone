import * as React from 'react'
import { Link, Text } from '@react-email/components'
import { EmailLayout, MAIL_FARBE, bodyText, ctaButton, h1, mutedText } from './_layout'
import { EMAIL_AENDERN_MAIL, EMAIL_GEAENDERT_MAIL } from '@/lib/konto-anfragen'

/** Der Warnknopf in Orange wie bei „Neue Anmeldung“ — keine grüne Hauptaktion. */
const knopfOrange: React.CSSProperties = {
  ...ctaButton,
  backgroundColor: MAIL_FARBE.orangeText,
  border: `1px solid ${MAIL_FARBE.orangeText}`,
}

/**
 * „Bestätige deine neue Anmelde-Adresse“ (Register N36, Nr. 190) → an die NEUE
 * Adresse. Der Link öffnet nur eine Seite; geändert wird erst dort per Knopf
 * (POST) — Programme, die Links vorab öffnen, lösen nichts aus. Der Link steht
 * nur hier, nie im Betreff oder Vorschautext.
 */
export function EmailAendernEmail({ hof, link }: { hof: string | null; link: string }): React.JSX.Element {
  const t = EMAIL_AENDERN_MAIL
  return (
    <EmailLayout previewText={t.betreff}>
      <Text style={h1}>{t.betreff}</Text>
      <Text style={bodyText}>
        {t.anrede(hof)}
        <br />
        {t.satz}
      </Text>
      <Link href={link} style={ctaButton}>
        {t.knopf}
      </Link>
      <Text style={mutedText}>{t.fuss}</Text>
    </EmailLayout>
  )
}

/**
 * „Deine Anmelde-Adresse wurde geändert“ (Register N36, Nr. 190) → an die ALTE
 * Adresse, mit „Das war ich nicht“ (/sicherheit/nicht-ich). Nennt die neue
 * Adresse nicht — sie gehört womöglich gerade jemand anderem.
 */
export function EmailGeaendertEmail({ hof, wann, link }: { hof: string | null; wann: string; link: string }): React.JSX.Element {
  const t = EMAIL_GEAENDERT_MAIL
  return (
    <EmailLayout previewText={t.betreff}>
      <Text style={h1}>{t.betreff}</Text>
      <Text style={bodyText}>
        {t.anrede(hof)}
        <br />
        {t.satz(wann)}
      </Text>
      <Text style={bodyText}>{t.warstDu}</Text>
      <Link href={link} style={knopfOrange}>
        {t.knopf}
      </Link>
      <Text style={mutedText}>{t.fuss}</Text>
    </EmailLayout>
  )
}
