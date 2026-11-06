import * as React from 'react'
import { Html, Head, Body, Container, Section, Text, Hr, Preview, Row, Column, Link } from '@react-email/components'
import { MARKE } from '@/lib/marke'
import { PRODUKTION_ADRESSE, PRODUKTION_HOST } from '@/lib/umgebung'
import { POSTFACH_MAIL_TEXT } from '@/lib/postfach'
import { ZUSTELLUNG_MAIL_TEXT } from '@/lib/zustellung'

/**
 * Die Mail-Palette — die EINZIGE Stelle mit Farbwerten unter src/emails/
 * (tests/mail-vorlagen.test.ts). Mailprogramme kennen keine CSS-Variablen,
 * deshalb stehen hier die Hexwerte des HELLEN Themes aus
 * docs/ai/DESIGN_SYSTEM.md („Farbtokens"). Mails sind die einzige Ausnahme
 * vom Dunkel-Standard: Viele Mailprogramme stellen dunkle Mails
 * unzuverlässig dar (Mockup web-k3-e-mails-web-mobil). Getönte Flächen und
 * Ränder sind die Hinweiskarte (12 % Fläche, 45 % Rand) auf `flaeche`
 * vorgerechnet — Mails kennen keine Transparenz über einer Fläche zuverlässig.
 */
export const MAIL_FARBE = {
  /** --bg hell: Grund außerhalb der Karte */
  seite: '#F4F1E7',
  /** --surface hell: die Karte */
  flaeche: '#FBF9F2',
  /** --border hell */
  rand: '#E2DDC9',
  /** --text hell */
  text: '#1C241D',
  /** --text-muted hell — leiser Text, nie dunkler (DESIGN_SYSTEM, „Lesbarkeit") */
  textLeise: '#5D6A5C',
  /** --accent: Knopf und grüner Text (am Tag dasselbe Grün wie --status-fertig) */
  gruen: '#2E6B45',
  /** --on-accent */
  aufGruen: '#F6F4EA',
  /** Hinweiskarte grün: --accent 12 % auf --surface */
  gruenFlaeche: '#E2E8DD',
  /** Hinweiskarte grün: --accent 45 % auf --surface */
  gruenRand: '#9FB9A4',
  /** --status-offen hell: oranger Text */
  orangeText: '#9C4D20',
  /** Hinweiskarte orange: --primary 12 % auf --surface */
  orangeFlaeche: '#F8EADE',
  /** Hinweiskarte orange: --primary 45 % auf --surface */
  orangeRand: '#EFC0A6',
} as const

/** Schriften: Fraunces/Instrument Sans, wo installiert — Mails laden keine Webfonts (kein CDN). */
const SCHRIFT = "'Instrument Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
export const SCHRIFT_UEBERSCHRIFT = "Fraunces,Georgia,'Times New Roman',serif"

/**
 * Am Handy (Board s3-mail-*) steht die Karte mit 10 px Rand und 18 px Innenabstand,
 * im Web (w3-mail-*, Karte bis 600 px) mit 12 px und 26 px. Inline steht die Web-Fassung —
 * Mailprogramme ohne Media Queries zeigen sie; die übrigen nehmen am Handy die schmale.
 */
const SCHMAL_CSS = `@media only screen and (max-width:480px){.fz-grund>table>tbody>tr>td{padding:16px 10px !important}.fz-kopf{padding:20px 18px 0 !important}.fz-inhalt{padding:18px 18px 22px !important}}`

const body: React.CSSProperties = {
  backgroundColor: MAIL_FARBE.seite,
  color: MAIL_FARBE.text,
  fontFamily: SCHRIFT,
  margin: 0,
  padding: '24px 12px',
}

const container: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
}

const karte: React.CSSProperties = {
  backgroundColor: MAIL_FARBE.flaeche,
  border: `1px solid ${MAIL_FARBE.rand}`,
  borderRadius: '14px',
}

const kopf: React.CSSProperties = {
  padding: '20px 26px 0',
}

const wortmarke: React.CSSProperties = {
  color: MAIL_FARBE.gruen,
  fontFamily: SCHRIFT_UEBERSCHRIFT,
  fontSize: '17px',
  fontWeight: '600',
  lineHeight: '1.2',
  margin: 0,
}

const content: React.CSSProperties = {
  padding: '18px 26px 26px',
}

const footerText: React.CSSProperties = {
  color: MAIL_FARBE.textLeise,
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0',
  textAlign: 'center' as const,
}

/**
 * Wer die Mail schickt — der Satz unter der Karte (V68, V79; Auftrag Lauf 30,
 * „E-Mails“). Jede Vorlage wählt ihre Art selbst (Pflicht-Prop, Liste in
 * tests/mail-vorschau.test.ts):
 *  - `hof`: Bestellmails an die Kundin — der Vertrag besteht mit dem Hof.
 *  - `plattform`: Konto, Code, Passwort, Sicherheit, Freischaltung, Lastschrift,
 *    Team und alle Mails an den Hof — kein Hof löst sie aus.
 *  - `betrieb`: Mails an das Team (Betrieb), intern und ohne Anbieterzeile.
 *  - `postfach`: Nachrichten vom Team an einen Hof (Register N12).
 *  - `beitrag`: Neuigkeiten eines Hofs an seine Abonnentinnen.
 */
export type MailFuss = { art: 'hof' } | { art: 'plattform' } | { art: 'betrieb' } | { art: 'postfach' } | { art: 'beitrag'; hof: string }

export type MailFussArt = MailFuss['art']

/** Die Sätze des Fußes — eine Quelle für Vorlagen und Tests. Betrieb und Postfach behalten ihren Satz aus zustellung.ts bzw. postfach.ts. */
export const MAIL_FUSS_TEXT = {
  hof: `Versandt von ${MARKE} im Auftrag eines Hofes.`,
  plattform: `Versandt von ${MARKE}.`,
  betrieb: ZUSTELLUNG_MAIL_TEXT.fuss,
  postfach: POSTFACH_MAIL_TEXT.fuss,
  /** Ohne Anschrift des Hofs: Ob sie in den Fuß gehört, prüft das Recht (ECG § 6, MedienG § 24/25). */
  beitrag: (hof: string) => `Im Auftrag von ${hof} · versandt von ${MARKE}`,
  /** Der Link unter dem Fuß: in Beitrags-Mails die Neuigkeiten (Wortliste N42 c), sonst die Benachrichtigungen. */
  verwalten: 'Benachrichtigungen verwalten',
  verwaltenBeitrag: 'Neuigkeiten verwalten',
} as const

/** Der Satz unter der Karte für diese Art. */
export function fussSatz(fuss: MailFuss): string {
  if (fuss.art === 'beitrag') return MAIL_FUSS_TEXT.beitrag(fuss.hof)
  return MAIL_FUSS_TEXT[fuss.art]
}

/** Die Seite, auf die die Anbieterzeile zeigt. Betreiberdaten stehen nur dort (A001), nie im Code — das Repo ist öffentlich. */
const IMPRESSUM_PFAD = '/impressum'

/**
 * Die Anbieterzeile unter dem Fuß (V68): Name und Link auf das Impressum der
 * echten Seite — auch in Mails aus der Vorschau, denn gelesen wird die Mail
 * außerhalb unseres Servers. Betriebs-Mails tragen sie nicht (intern).
 */
export function Anbieterzeile(): React.JSX.Element {
  return (
    <Text style={{ ...footerText, marginTop: '4px' }}>
      {`${MARKE} · `}
      <a href={`${PRODUKTION_ADRESSE}${IMPRESSUM_PFAD}`} style={{ color: MAIL_FARBE.textLeise }}>
        {`${PRODUKTION_HOST}${IMPRESSUM_PFAD}`}
      </a>
    </Text>
  )
}

interface EmailLayoutProps {
  previewText: string
  children: React.ReactNode
  /** Der Link „… verwalten“ unter dem Fuß; in Beitrags-Mails der Abmelde-Link (Register S11, unverändert). */
  manageUrl?: string
  /** Wer die Mail schickt — Pflicht, damit jede Vorlage ihre Art selbst wählt. */
  fuss: MailFuss
}

export function EmailLayout({ previewText, children, manageUrl, fuss }: EmailLayoutProps): React.JSX.Element {
  return (
    <Html lang="de">
      <Head>
        {/* Bitte nicht automatisch abdunkeln — die Mail ist bewusst hell. */}
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <style>{SCHMAL_CSS}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={body} className="fz-grund">
        <Container style={container}>
          <Section style={karte}>
            <Section style={kopf} className="fz-kopf">
              <Text style={wortmarke}>{MARKE}</Text>
            </Section>
            <Section style={content} className="fz-inhalt">{children}</Section>
          </Section>
          <Section style={{ padding: '16px 24px 0' }}>
            <Text style={footerText}>{fussSatz(fuss)}</Text>
            {fuss.art !== 'betrieb' && <Anbieterzeile />}
            {manageUrl && (
              <Text style={{ ...footerText, marginTop: '6px' }}>
                <a href={manageUrl} style={{ color: MAIL_FARBE.textLeise }}>
                  {fuss.art === 'beitrag' ? MAIL_FUSS_TEXT.verwaltenBeitrag : MAIL_FUSS_TEXT.verwalten}
                </a>
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ─── Gemeinsame Stile ────────────────────────────────────────────────────────
// Die Namen sind älter als das Redesign und bleiben, damit alle Mails (auch die
// an Höfe und Betreiber) denselben Stil tragen; die Werte kommen aus MAIL_FARBE.

export const h1: React.CSSProperties = {
  color: MAIL_FARBE.text,
  fontFamily: SCHRIFT_UEBERSCHRIFT,
  fontSize: '22px',
  fontWeight: '600',
  margin: '0 0 10px',
  lineHeight: '1.3',
}

export const bodyText: React.CSSProperties = {
  // Das Mockup tönt Fließtext zwischen text und textLeise; die Palette kennt
  // nur Tokens — text ist der nächste und liest sich am besten (15:1).
  color: MAIL_FARBE.text,
  fontSize: '14px',
  lineHeight: '1.55',
  margin: '0 0 14px',
}

export const mutedText: React.CSSProperties = {
  color: MAIL_FARBE.textLeise,
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '0 0 4px',
}

/** Kleiner Hinweis unter den Knöpfen (12 px, leise). */
export const kleinText: React.CSSProperties = {
  color: MAIL_FARBE.textLeise,
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 6px',
}

/** Links im Text: grün und unterstrichen, damit sie ohne Farbe erkennbar bleiben. */
export const textLink: React.CSSProperties = {
  color: MAIL_FARBE.gruen,
  fontWeight: '600',
  textDecoration: 'underline',
}

/** Die kleine Kennzeile in Großbuchstaben (wie im Board: 12 px, fett) — nie kleiner als 12 px (Lauf 31). */
export const highlightLabel: React.CSSProperties = {
  color: MAIL_FARBE.textLeise,
  fontSize: '12px',
  fontWeight: '700',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  margin: '0 0 6px',
}

export const tableRow: React.CSSProperties = {
  borderBottom: `1px solid ${MAIL_FARBE.rand}`,
  padding: '8px 0',
}

export const totalRow: React.CSSProperties = {
  borderTop: `1px solid ${MAIL_FARBE.rand}`,
  paddingTop: '12px',
  marginTop: '4px',
}

/**
 * Der grüne Knopf — die Hauptaktion einer Mail (Pille wie im Mockup). Mindestens
 * 44 px hoch (V78): 13 + 16 + 13 px und 1 px Rand oben und unten; die Zeilenhöhe
 * steht fest, damit kein Mailprogramm den Knopf mit seiner eigenen kleiner macht.
 */
export const ctaButton: React.CSSProperties = {
  backgroundColor: MAIL_FARBE.gruen,
  border: `1px solid ${MAIL_FARBE.gruen}`,
  borderRadius: '999px',
  color: MAIL_FARBE.aufGruen,
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  lineHeight: '16px',
  padding: '13px 18px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  margin: '16px 0',
}

/** Rahmen-Knopf — alles neben der Hauptaktion. */
export const rahmenButton: React.CSSProperties = {
  ...ctaButton,
  backgroundColor: 'transparent',
  // Wie der Rahmen-Knopf der Seite (border-border); lesbar macht ihn die Beschriftung (text, 15:1).
  border: `1px solid ${MAIL_FARBE.rand}`,
  color: MAIL_FARBE.text,
  fontWeight: '500',
}

/** Oranger Hinweis — „du musst etwas tun" (Bezahlen vor Ort, Frist). */
export const amberBox: React.CSSProperties = {
  backgroundColor: MAIL_FARBE.orangeFlaeche,
  border: `1px solid ${MAIL_FARBE.orangeRand}`,
  borderRadius: '12px',
  padding: '14px 18px',
  margin: '16px 0',
}

/** Grüner Hinweis — etwas Gutes (Erstattung, Code). */
export const gruenBox: React.CSSProperties = {
  backgroundColor: MAIL_FARBE.gruenFlaeche,
  border: `1px solid ${MAIL_FARBE.gruenRand}`,
  borderRadius: '12px',
  padding: '14px 18px',
  margin: '16px 0',
}

// ─── Gemeinsame Bausteine (Mockup web-k3-e-mails-web-mobil) ─────────────────

/** Eine Zeile „links … rechts" als Tabelle — Floats brechen in Outlook um. */
export function BetragsZeile({
  links,
  rechts,
  stark,
  leise = !stark,
  umbrechen = false,
}: {
  links: React.ReactNode
  rechts: React.ReactNode
  /** Gesamtzeile: 15 px, fett, Beschriftung in Textfarbe. */
  stark?: boolean
  /** Beschriftung leise (Positionen, Gebühr, „Abholung"). */
  leise?: boolean
  /** Rechts darf umbrechen (Datum, Adresse) — Beträge bleiben in einer Zeile. Am Handy sonst zu breit. */
  umbrechen?: boolean
}): React.JSX.Element {
  const groesse = stark ? '15px' : '13.5px'
  const gewicht = stark ? '600' : '400'
  return (
    <Row style={{ width: '100%' }}>
      {/* Bei Zeilen mit Datum oder Adresse ist die Beschriftung kurz („Wo“): Sie nimmt nur ihre Breite, der Wert den Rest (Board: eine Zeile bei 390 px). */}
      <Column style={{ color: leise ? MAIL_FARBE.textLeise : MAIL_FARBE.text, fontSize: groesse, fontWeight: gewicht, lineHeight: '1.5', padding: '3px 12px 3px 0', verticalAlign: 'top', ...(umbrechen ? { width: '1%', whiteSpace: 'nowrap' as const } : {}) }}>
        {links}
      </Column>
      <Column align="right" style={{ color: MAIL_FARBE.text, fontSize: groesse, fontWeight: gewicht, lineHeight: '1.5', padding: '3px 0', textAlign: 'right' as const, verticalAlign: 'top', whiteSpace: umbrechen ? ('normal' as const) : ('nowrap' as const) }}>
        {rechts}
      </Column>
    </Row>
  )
}

/** Trennlinie in der Randfarbe. */
export function Trenner(): React.JSX.Element {
  return <Hr style={{ borderColor: MAIL_FARBE.rand, borderTopWidth: '1px', margin: '10px 0' }} />
}

/**
 * Die Bestellnummer groß zum Nennen bei der Abholung — NUR Anzeige: Sie ist
 * nie Berechtigung und steht in keinem Link (S1). Einen eigenen Abholcode gibt
 * es nicht (Bericht Nr. 07).
 */
export function BestellnummerKasten({ nummer }: { nummer: string }): React.JSX.Element {
  return (
    <Section style={{ backgroundColor: MAIL_FARBE.seite, borderRadius: '12px', padding: '14px', margin: '4px 0 14px', textAlign: 'center' as const }}>
      <Text style={{ ...highlightLabel, margin: 0 }}>Bestellnummer</Text>
      <Text style={{ color: MAIL_FARBE.text, fontFamily: SCHRIFT_UEBERSCHRIFT, fontSize: '30px', fontWeight: '600', letterSpacing: '2px', lineHeight: '1.25', margin: '2px 0 0', wordBreak: 'break-all' as const }}>
        {nummer}
      </Text>
    </Section>
  )
}

/** Grüner bzw. Rahmen-Knopf als Link. */
export function Knopf({ href, art = 'gruen', children }: { href: string; art?: 'gruen' | 'rahmen'; children: React.ReactNode }): React.JSX.Element {
  return (
    <Link href={href} style={{ ...(art === 'gruen' ? ctaButton : rahmenButton), margin: '0 8px 8px 0' }}>
      {children}
    </Link>
  )
}

/** Knöpfe nebeneinander, am Handy umbrechend. */
export function KnopfReihe({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Section style={{ margin: '16px 0 6px' }}>{children}</Section>
}

/**
 * Hinweiskarte wie im Board: grün für Gutes (Erstattung, „Bring bitte … mit“),
 * orange für „du musst etwas tun“ (Frist, Warnung) — dann ist auch die Schrift
 * orange. 14 px, ein Absatz; Fettes setzt die Vorlage selbst.
 */
export function HinweisKasten({ art, children }: { art: 'gruen' | 'orange'; children: React.ReactNode }): React.JSX.Element {
  const kasten = art === 'gruen' ? gruenBox : amberBox
  return (
    <Section style={kasten}>
      <Text style={{ color: art === 'gruen' ? MAIL_FARBE.text : MAIL_FARBE.orangeText, fontSize: '14px', lineHeight: '1.5', margin: 0 }}>{children}</Text>
    </Section>
  )
}

/**
 * Sechs Ziffern in Dreiergruppen („615 204“, Board s3/w3-mail-zugang). Nur für Codes,
 * deren Feld beim Einfügen alles außer Ziffern entfernt (`codeAusEingabe` in
 * src/lib/anmeldecode.ts) — sonst bliebe das Leerzeichen im kopierten Code hängen.
 */
export function codeGruppiert(code: string): string {
  return /^\d{6}$/.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : code
}

/**
 * Der Code groß zum Abtippen (Boards s3/w3-mail-zugang, -team): Überschriften-Serife,
 * neutrale Fläche ohne Rand, in Dreiergruppen. Kein Link — der Code steht nie im Betreff.
 */
export function CodeKasten({ code, gruppiert = true }: { code: string; gruppiert?: boolean }): React.JSX.Element {
  return (
    <Text
      style={{
        backgroundColor: MAIL_FARBE.seite,
        borderRadius: '12px',
        color: MAIL_FARBE.text,
        fontFamily: SCHRIFT_UEBERSCHRIFT,
        fontSize: '34px',
        fontWeight: '600',
        letterSpacing: '6px',
        lineHeight: '1.3',
        margin: '6px 0 14px',
        padding: '12px',
        textAlign: 'center' as const,
      }}
    >
      {gruppiert ? codeGruppiert(code) : code}
    </Text>
  )
}

/**
 * Die Telefonnummer des Hofs wie im Board: fett in Textfarbe, als Anruf-Link
 * (tel:), damit sie am Handy mit einem Tippen wählt. Ohne gültige Nummer nur Text.
 */
export function TelefonFett({ href, nummer }: { href: string | null; nummer: string }): React.JSX.Element {
  const stil: React.CSSProperties = { color: MAIL_FARBE.text, fontWeight: '600', textDecoration: 'none' }
  return href ? (
    <Link href={href} style={stil}>
      {nummer}
    </Link>
  ) : (
    <strong style={{ color: MAIL_FARBE.text }}>{nummer}</strong>
  )
}

/** Leiser Satz wie im Board (13 px): Fristen, „Fragen? …“. */
export const leiseZeile: React.CSSProperties = { ...mutedText, margin: '0 0 6px' }

/** Zwischenüberschrift fett in Textfarbe (z. B. „Deine Rechte jetzt:“). */
export const zwischenTitel: React.CSSProperties = { ...bodyText, fontWeight: '600', margin: '0 0 6px' }

/** „Hof Müller, Dorfstraße 12, 5280 Braunau am Inn“ — die Zeile „Wo“ der Bestellmails. */
export function woZeile(hof: string, adresse: string, plz: string | undefined, ort: string): string {
  return `${hof}, ${adresse}, ${plz ? `${plz} ` : ''}${ort}`
}

/**
 * „Zurück an dich … € 19,12“ als grüne Karte (Board s3/w3-mail-storno Bild 4 und 6):
 * Beschriftung links, Betrag rechts in einer Zeile (15 px, fett), darunter ein leiser Satz.
 * Der Betrag kommt fertig gerechnet; die Vorlage formatiert ihn nur.
 */
export function ErstattungKasten({ betrag, zeile }: { betrag: string; zeile: string }): React.JSX.Element {
  return (
    <Section style={gruenBox}>
      <BetragsZeile stark links="Zurück an dich" rechts={betrag} />
      <Text style={{ color: MAIL_FARBE.textLeise, fontSize: '13px', lineHeight: '1.5', margin: 0 }}>{zeile}</Text>
    </Section>
  )
}
