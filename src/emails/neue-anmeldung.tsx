import * as React from 'react'
import { Link, Section, Text } from '@react-email/components'
import { EmailLayout, MAIL_FARBE, bodyText, ctaButton, h1, highlightBox, kleinText, mutedText } from './_layout'
import { NEUE_ANMELDUNG_MAIL } from '@/lib/geraete'

export interface NeueAnmeldungProps {
  /** Hof-Konto oder Konto ohne Hof (Betrieb) — nur für Betreff und Überschrift. */
  hof: boolean
  /** Der Hofname für die Anrede, sonst null („Hallo,"). */
  name: string | null
  /** Gerät und Browser in festen Wörtern („Windows · Chrome", src/lib/geraete.ts). */
  geraet: string
  /** „19.10. um 14:32" — Wiener Zeit (anmeldeZeitpunkt). */
  wann: string
  /** /sicherheit/nicht-ich?t=… — öffnet nur eine Seite mit Knopf. */
  link: string
}

/** Der Knopf in Orange: Er meldet (über die Seite) alles ab — keine grüne Hauptaktion. */
const knopfOrange: React.CSSProperties = {
  ...ctaButton,
  backgroundColor: MAIL_FARBE.orangeText,
  border: `1px solid ${MAIL_FARBE.orangeText}`,
}

/**
 * „Neue Anmeldung bei deinem Hof-Konto" (Register E7, Ergänzung; Nr. 114;
 * Mockup system-h1-angemeldete-geraete, Schritt 4). Nur an Hof- und
 * Admin-Konten, nur bei einem Gerät, das das Konto noch nicht kannte. Gerät
 * und Uhrzeit, nie Ort oder IP-Adresse; hell wie alle Mails, ohne Emojis.
 *
 * Der Knopf öffnet nur eine Seite — abgemeldet wird erst dort per Knopf
 * (POST): Programme, die Links in Mails vorab öffnen, lösen nichts aus.
 */
export function NeueAnmeldungEmail({ hof, name, geraet, wann, link }: NeueAnmeldungProps): React.JSX.Element {
  const text = NEUE_ANMELDUNG_MAIL
  return (
    <EmailLayout previewText={`${text.betreff(hof)} · ${geraet}`}>
      <Text style={h1}>{text.betreff(hof)}</Text>
      <Text style={bodyText}>
        {text.anrede(name)}
        <br />
        {text.vorher} <strong>{wann}</strong> {text.nachher}
      </Text>
      <Section style={{ ...highlightBox, padding: '12px 16px' }}>
        <Text style={{ ...bodyText, fontWeight: '600', margin: 0 }}>{geraet}</Text>
        <Text style={{ ...kleinText, margin: 0 }}>{text.neuesGeraet}</Text>
      </Section>
      <Text style={bodyText}>{text.warstDu}</Text>
      <Link href={link} style={knopfOrange}>
        {text.knopf}
      </Link>
      <Text style={mutedText}>{text.fuss}</Text>
    </EmailLayout>
  )
}
