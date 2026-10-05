import * as React from 'react'
import { Html, Head, Body, Container, Section, Text, Hr, Preview, Row, Column, Link } from '@react-email/components'

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

interface EmailLayoutProps {
  previewText: string
  children: React.ReactNode
  manageUrl?: string
}

export function EmailLayout({ previewText, children, manageUrl }: EmailLayoutProps) {
  return (
    <Html lang="de">
      <Head>
        {/* Bitte nicht automatisch abdunkeln — die Mail ist bewusst hell. */}
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={karte}>
            <Section style={kopf}>
              <Text style={wortmarke}>FarmerZone</Text>
            </Section>
            <Section style={content}>{children}</Section>
          </Section>
          <Section style={{ padding: '16px 24px 0' }}>
            <Text style={footerText}>Versandt von FarmerZone im Auftrag eines Hofes.</Text>
            {manageUrl && (
              <Text style={{ ...footerText, marginTop: '6px' }}>
                <a href={manageUrl} style={{ color: MAIL_FARBE.textLeise }}>
                  Benachrichtigungen verwalten
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
  textDecoration: 'underline',
}

export const highlightBox: React.CSSProperties = {
  backgroundColor: MAIL_FARBE.seite,
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '16px 0',
}

export const highlightLabel: React.CSSProperties = {
  color: MAIL_FARBE.textLeise,
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '1.2px',
  margin: '0 0 6px',
}

export const highlightValue: React.CSSProperties = {
  color: MAIL_FARBE.text,
  fontSize: '17px',
  fontWeight: '600',
  margin: '0 0 4px',
  lineHeight: '1.3',
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

/** Der grüne Knopf — die Hauptaktion einer Mail (Pille wie im Mockup). */
export const ctaButton: React.CSSProperties = {
  backgroundColor: MAIL_FARBE.gruen,
  border: `1px solid ${MAIL_FARBE.gruen}`,
  borderRadius: '999px',
  color: MAIL_FARBE.aufGruen,
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  padding: '11px 18px',
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
      <Column style={{ color: leise ? MAIL_FARBE.textLeise : MAIL_FARBE.text, fontSize: groesse, fontWeight: gewicht, lineHeight: '1.5', padding: '3px 12px 3px 0', verticalAlign: 'top' }}>
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
