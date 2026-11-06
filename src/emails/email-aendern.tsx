import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, Knopf, KnopfReihe, bodyText, h1, leiseZeile } from './_layout'
import { EMAIL_AENDERN_MAIL, EMAIL_GEAENDERT_MAIL } from '@/lib/konto-anfragen'

/**
 * „Bestätige deine neue Anmelde-Adresse“ (Register N36, Nr. 190) → an die NEUE
 * Adresse. Der Link öffnet nur eine Seite; geändert wird erst dort per Knopf
 * (POST) — Programme, die Links vorab öffnen, lösen nichts aus. Der Link steht
 * nur hier, nie im Betreff oder Vorschautext.
 */
export function EmailAendernEmail({ hof, link }: { hof: string | null; link: string }): React.JSX.Element {
  const t = EMAIL_AENDERN_MAIL
  return (
    <EmailLayout fuss={{ art: 'plattform' }} previewText={t.betreff}>
      <Text style={h1}>{t.betreff}</Text>
      <Text style={bodyText}>{`${t.anrede(hof)} ${t.satz}`}</Text>
      <KnopfReihe>
        <Knopf href={link}>{t.knopf}</Knopf>
      </KnopfReihe>
      <Text style={leiseZeile}>{t.fuss}</Text>
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
    <EmailLayout fuss={{ art: 'plattform' }} previewText={t.betreff}>
      <Text style={h1}>{t.betreff}</Text>
      {/* Board s3/w3-mail-sicherheit Bild 5: ein Satz, dann „Das war ich nicht“ als Rahmen-Knopf. */}
      <Text style={bodyText}>{`${t.anrede(hof)} ${t.satz(wann)}`}</Text>
      <KnopfReihe>
        <Knopf href={link} art="rahmen">
          {t.knopf}
        </Knopf>
      </KnopfReihe>
    </EmailLayout>
  )
}
