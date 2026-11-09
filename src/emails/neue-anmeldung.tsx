import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, BetragsZeile, Knopf, KnopfReihe, bodyText, h1, kleinText } from './_layout'
import { NEUE_ANMELDUNG_MAIL } from '@/lib/geraete'

export interface NeueAnmeldungProps {
  /** Hof-Konto oder Konto ohne Hof (Betrieb) — nur für Betreff und Überschrift. */
  hof: boolean
  /** Der Hofname für die Anrede, sonst null („Hallo,"). */
  name: string | null
  /** Gerät und Browser in festen Wörtern („Windows · Chrome", src/lib/geraete.ts). */
  geraet: string
  /** „Di, 2. März 2027, 21:14 Uhr“ — Wiener Zeit, V9 (formatZeitpunktMitWochentag, Nr. 280). */
  wann: string
  /** „Di, 2. März 2027“ — der Tag für den Satz über den Zeilen (Board Bild 1). */
  tag: string
  /** /sicherheit/nicht-ich?t=… — öffnet nur eine Seite mit Knopf. */
  link: string
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
/** Die Überschrift nach Board s3/w3-mail-sicherheit Bild 1; der Betreff behält „… bei deinem Hof-Konto“ (Nr. 280). */
const UEBERSCHRIFT = 'Neue Anmeldung'

export function NeueAnmeldungEmail({ hof, name, geraet, wann, tag, link }: NeueAnmeldungProps): React.JSX.Element {
  const text = NEUE_ANMELDUNG_MAIL
  return (
    <EmailLayout fuss={{ art: 'plattform' }} previewText={`${text.betreff(hof)} · ${geraet}`}>
      <Text style={h1}>{UEBERSCHRIFT}</Text>
      {/* Board s3/w3-mail-sicherheit Bild 1: Anrede im Satz, Wann und Gerät als Zeilen, „Das war ich nicht“ als Rahmen-Knopf. */}
      <Text style={bodyText}>{`${text.anrede(name)} ${text.vorher} ${tag} ${text.nachher}`}</Text>
      <BetragsZeile umbrechen links="Wann" rechts={wann} />
      <BetragsZeile umbrechen links="Gerät" rechts={geraet} />
      {/* Board Bild 1: der Satz rückt nah an die Zeile „Gerät“ (B-Zeile „Abstand unter Gerät“, Nr. 280). */}
      <Text style={{ ...bodyText, marginTop: '4px' }}>{text.warstDu}</Text>
      <KnopfReihe>
        <Knopf href={link} art="rahmen">
          {text.knopf}
        </Knopf>
      </KnopfReihe>
      {/* Die Gültigkeit des Links bleibt stehen (Frist, nicht Optik). */}
      <Text style={kleinText}>{text.fuss}</Text>
    </EmailLayout>
  )
}
