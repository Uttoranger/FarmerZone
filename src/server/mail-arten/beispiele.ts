import { z } from 'zod'
import { MAIL_BEISPIEL_IDS, entschaerfeLinks, type MailBeispielId } from '@/lib/betrieb-mails'
import { satzHundertstel, satzText, monatText } from '@/lib/plattformgebuehr'
import { ankuendigungText, lastschriftGescheitertText } from '@/lib/konditionen'
import { APP_URL } from '@/lib/umgebung-server'

/*
 * Die Beispiele in Admin › Betrieb › Mails (Register N48, Nr. 270): jede Mail
 * der sechs Mail-Boards mit erfundenen, festen Daten — Adressen auf
 * @example.com, jeder Code als Nullen, jeder Token als Platzhalter, jede
 * Kennung „beispiel-…“ (kann keine cuid sein, trifft also nie eine Zeile).
 * Danach macht `entschaerfeLinks` jeden Link unkenntlich, wie in der
 * Vorschau echter Mails (N27).
 *
 * Gebaut wird nur über reine Funktionen aus src/lib/email.ts: für Sofort-Arten
 * die Inhalts-Funktion (`…Inhalt`), für Wichtig und Kann warten die
 * Baufunktion (`baue…`) — nie ein Renderer aus src/server/mail-arten mit
 * DB-Lader, nie ein Versand, nie ein MailAuftrag, nie ein Protokolleintrag.
 * Die Adresse, die eine Baufunktion verlangt, ist fest erfunden und verlässt
 * diese Datei nicht. Das HTML wird nie geloggt. Was diese Datei einbinden darf,
 * hält tests/mail-beispiele-wache.test.ts fest.
 */

/** Der feste Platzhalter für jeden Code: nur Nullen — kein echter Code sieht so aus, die Zeile ist sofort als Beispiel erkennbar. */
export const BEISPIEL_CODE = '000000'

/** Der Platzhalter statt Token (wie VORSCHAU_TOKEN in vorschau.ts): zu ihm gibt es keinen Hash und keine Signatur; lang genug, dass `entschaerfeLinks` den Link als „[Link]“ zeigt. */
export const BEISPIEL_TOKEN = 'beispiel-platzhalter-ohne-token'

/** Die eine erfundene Empfänger-Adresse, die eine Baufunktion verlangt — sie steht nie im Ergebnis. */
const BEISPIEL_AN = 'beispiel@example.com'

/** Feste Zeitpunkte, damit jedes Beispiel bei jedem Aufruf gleich aussieht (Wiener Zeit). */
const ZEITPUNKT = new Date('2027-03-02T20:14:00Z')
const PAUSE_BIS = new Date('2027-03-03T08:15:00Z')

const HOF = { name: 'Hof Müller', slug: 'beispiel-hof-mueller' } as const
const NEUER_HOF = { id: 'beispiel-hof-am-moos', name: 'Hof am Moos', slug: 'beispiel-hof-am-moos' } as const

/** Eingabe der Action: nur eine Kennung aus der festen Liste (src/schemas liegt außerhalb der Dateigrenze von Nr. 270). */
export const mailBeispielEingabeSchema = z.object({ beispiel: z.enum(MAIL_BEISPIEL_IDS) })

type Gebaut = { betreff: string; html: string }

/** Baut ein Beispiel roh (vor `entschaerfeLinks`). Jede Art aus MAIL_BEISPIELE hat genau einen Eintrag — der Typ erzwingt es. */
const BAUE: Record<MailBeispielId, () => Promise<Gebaut>> = {
  anmeldecode: async () => {
    const { anmeldecodeInhalt } = await import('@/lib/email')
    return anmeldecodeInhalt({ code: BEISPIEL_CODE })
  },
  bestellcode: async () => {
    const { bestellcodeInhalt } = await import('@/lib/email')
    return bestellcodeInhalt({ code: BEISPIEL_CODE })
  },
  'passwort-link': async () => {
    const { passwortLinkInhalt } = await import('@/lib/email')
    return passwortLinkInhalt({ url: `${APP_URL}/reset-password?token=${BEISPIEL_TOKEN}` })
  },
  'email-bestaetigung': async () => {
    const { emailBestaetigungInhalt } = await import('@/lib/email')
    return emailBestaetigungInhalt({ url: `${APP_URL}/verify?token=${BEISPIEL_TOKEN}` })
  },
  'neue-anmeldung': async () => {
    const { neueAnmeldungInhalt } = await import('@/lib/email')
    return neueAnmeldungInhalt({ hof: true, name: 'Franz Müller', geraet: 'Windows · Edge', zeitpunkt: ZEITPUNKT, link: `${APP_URL}/sicherheit?token=${BEISPIEL_TOKEN}` })
  },
  'zu-viele-codes': async () => {
    const { zuVieleVersucheInhalt } = await import('@/lib/email')
    return zuVieleVersucheInhalt({ art: 'code', bis: PAUSE_BIS })
  },
  'zu-viele-passwoerter': async () => {
    const { zuVieleVersucheInhalt } = await import('@/lib/email')
    return zuVieleVersucheInhalt({ art: 'passwort', bis: PAUSE_BIS })
  },
  'email-aendern-link': async () => {
    const { emailAendernLinkInhalt } = await import('@/lib/email')
    return emailAendernLinkInhalt({ hof: HOF.name, link: `${APP_URL}/konto/email?token=${BEISPIEL_TOKEN}` })
  },
  'email-geaendert-hinweis': async () => {
    const { emailGeaendertHinweisInhalt } = await import('@/lib/email')
    return emailGeaendertHinweisInhalt({ hof: HOF.name, zeitpunkt: ZEITPUNKT, link: `${APP_URL}/sicherheit?token=${BEISPIEL_TOKEN}` })
  },
  'registrierungs-hinweis': async () => {
    const { registrierungsHinweisInhalt } = await import('@/lib/email')
    return registrierungsHinweisInhalt({ weg: 'passwort', anmelden: `${APP_URL}/login`, passwortZuruecksetzen: `${APP_URL}/forgot-password` })
  },
  einrichtungscode: async () => {
    const { adminSicherheitInhalt } = await import('@/lib/email')
    return adminSicherheitInhalt({ anlass: 'einrichtungscode', geraet: 'Laptop · Chrome', zeitpunkt: ZEITPUNKT, code: BEISPIEL_CODE })
  },
  'passkey-hinzugefuegt': async () => {
    const { adminSicherheitInhalt } = await import('@/lib/email')
    return adminSicherheitInhalt({ anlass: 'passkey-hinzugefuegt', geraet: 'Laptop · Chrome', zeitpunkt: ZEITPUNKT })
  },
  'team-recht-geaendert': async () => {
    const { teamRechtGeaendertInhalt } = await import('@/lib/email')
    return teamRechtGeaendertInhalt({ anlass: 'eingeladen', name: 'Jonas Pichler', rechte: ['Höfe freischalten und betreuen', 'Bestellungen und Erstattungen'] })
  },
  'betreiber-bestaetigung': async () => {
    const { betreiberBestaetigungInhalt } = await import('@/lib/email')
    return betreiberBestaetigungInhalt({ token: BEISPIEL_TOKEN })
  },
  'betreiber-testmail': async () => {
    const { baueBetreiberTestmail } = await import('@/lib/email')
    return baueBetreiberTestmail(BEISPIEL_AN)
  },
  'neuer-hof': async () => {
    const { baueNewFarmNotification } = await import('@/lib/email')
    return baueNewFarmNotification(
      { id: NEUER_HOF.id, name: NEUER_HOF.name, slug: NEUER_HOF.slug, ownerEmail: 'kontakt@example.com', createdAt: ZEITPUNKT, postalCode: '5230', city: 'Mattighofen', fehlt: ['Stripe', 'Produkte', 'Abholzeit'] },
      BEISPIEL_AN
    )
  },
  meldung: async () => {
    const { baueMeldungNotification } = await import('@/lib/email')
    return baueMeldungNotification(
      {
        id: 'beispiel-meldung',
        kurznummer: '7K2Q00',
        text: 'Die Packliste druckt die Abholzeit doppelt.',
        seiteUrl: '/orders/today/print',
        userAgent: 'Beispiel-Browser',
        viewport: '390x844',
        diagKennung: null,
        farmName: HOF.name,
        screenshotUrl: null,
        createdAt: ZEITPUNKT,
      },
      BEISPIEL_AN
    )
  },
  'erstattung-offen': async () => {
    const { baueErstattungOffen } = await import('@/lib/email')
    return baueErstattungOffen(
      {
        was: 'Die Erstattung nach dem Storno ist noch nicht bestätigt.',
        bestellId: 'beispiel-bestellung',
        bestellnummer: 'HM-0000-0000',
        hofName: HOF.name,
        betraege: [{ label: 'Betrag', cents: 2862 }],
        handanweisung: 'Prüf die Erstattung in Stripe und schließ sie in Bestellungen ab.',
        stripeKennung: null,
      },
      BEISPIEL_AN
    )
  },
  wochenbericht: async () => {
    const { baueBriefkastenZusammenfassung } = await import('@/lib/email')
    return baueBriefkastenZusammenfassung(
      {
        neu: 1,
        liegenGeblieben: 0,
        offen: 2,
        neueste: [{ kurznummer: '7K2Q00', art: 'FEHLER', ersteZeile: 'Die Packliste druckt die Abholzeit doppelt.', hofName: HOF.name }],
        geloescht: 0,
        eingang: { antworten: 1, meldungen: 1, hoefe: 0, erstattungen: 0 },
        lage: [
          { label: 'Neue Meldungen', wert: '1' },
          { label: 'Beantwortet in 7 Tagen', wert: '6' },
        ],
      },
      BEISPIEL_AN
    )
  },
  'antwort-an-team': async () => {
    const { baueHofAntwortAnTeam } = await import('@/lib/email')
    return baueHofAntwortAnTeam(BEISPIEL_AN, { hofName: 'Hof am Bach', titel: 'Plattformgebühr ab 1. Februar', text: 'Danke, ist angekommen. Wo sehe ich den Betrag?', unterhaltungId: 'beispiel-faden' })
  },
  'betrieb-warnung': async () => {
    const { betriebWarnungInhalt } = await import('@/lib/email')
    return betriebWarnungInhalt({ art: 'grenze', wert: 'datenbank', anteil: 82, stand: '410 MB von 500 MB', trend: null, ohneVerwendungBytes: null })
  },
  freischaltung: async () => {
    const { baueFreischaltungEmail } = await import('@/lib/email')
    return baueFreischaltungEmail({ name: NEUER_HOF.name, slug: NEUER_HOF.slug, ownerEmail: BEISPIEL_AN })
  },
  'plattformgebuehr-ankuendigung': async () => {
    const { bauePlattformgebuehrAnkuendigung } = await import('@/lib/email')
    const datum = '1. Februar 2028'
    // Der Satz eines Hofs ohne eigenen Wert — derselbe Weg wie ankuendigungDaten.
    const text = ankuendigungText({ datum, satz: satzText(satzHundertstel({ plattformgebuehrProzent: null })), mandatNoetig: true })
    return bauePlattformgebuehrAnkuendigung({ an: BEISPIEL_AN, text, datum })
  },
  'online-zahlung': async () => {
    const { baueOnlineZahlungEmail } = await import('@/lib/email')
    return baueOnlineZahlungEmail({ an: BEISPIEL_AN, anlass: 'aktiv', hofSichtbar: true })
  },
  'lastschrift-gescheitert': async () => {
    const { baueLastschriftGescheitert } = await import('@/lib/email')
    const monat = monatText('2028-04')
    return baueLastschriftGescheitert({ an: BEISPIEL_AN, text: lastschriftGescheitertText({ monat, tage: 14 }), monat })
  },
  rundschreiben: async () => {
    const { bauePostfachMail } = await import('@/lib/email')
    return bauePostfachMail({
      art: 'rundschreiben',
      an: BEISPIEL_AN,
      titel: 'Abholzeiten zu Ostern schon eingetragen?',
      text: 'Hallo! Ostern kommt bald. Trag deine Abholzeiten für die Feiertage rechtzeitig ein, dann sieht deine Kundschaft sie schon jetzt.',
      link: '/settings',
      unterhaltungId: 'beispiel-faden',
    })
  },
  'postfach-antwort': async () => {
    const { bauePostfachMail } = await import('@/lib/email')
    return bauePostfachMail({
      art: 'antwort',
      an: BEISPIEL_AN,
      titel: 'Plattformgebühr ab 1. Februar: so steht sie in deiner Abrechnung',
      text: 'Den Betrag siehst du in Einstellungen › Konditionen, sobald der Monat abgerechnet ist.',
      link: null,
      unterhaltungId: 'beispiel-faden',
    })
  },
  'abo-bestaetigung': async () => {
    const { baueAboBestaetigung } = await import('@/lib/email')
    return baueAboBestaetigung(BEISPIEL_AN, { hofName: HOF.name, url: `${APP_URL}/account/neuigkeiten-bestaetigen?token=${BEISPIEL_TOKEN}` })
  },
  'beitrag-mit-foto': async () => {
    const { baueBeitragMail } = await import('@/lib/email')
    return baueBeitragMail({
      to: BEISPIEL_AN,
      farmName: HOF.name,
      farmSlug: HOF.slug,
      title: 'Frischer Bergkäse ab Samstag',
      body: 'Hallo Maria! Unser Bergkäse hat jetzt 8 Monate gereift. Ab Samstag holst du ihn bei uns ab – solange der Laib reicht.',
      anlass: 'FRESH_PRODUCT',
      // Eine Illustration der App statt eines hochgeladenen Fotos — kein Bild eines echten Hofs.
      photoUrl: `${APP_URL}/categories/milch.webp`,
      beitragId: 'beispiel-beitrag',
      abmeldeToken: BEISPIEL_TOKEN,
    })
  },
  'beitrag-ohne-foto': async () => {
    const { baueBeitragMail } = await import('@/lib/email')
    return baueBeitragMail({
      to: BEISPIEL_AN,
      farmName: HOF.name,
      farmSlug: HOF.slug,
      title: 'Am Samstag Hoffest',
      body: 'Am Samstag feiern wir ab 14 Uhr am Hof. Komm vorbei!',
      anlass: 'ANNOUNCEMENT',
      abmeldeToken: BEISPIEL_TOKEN,
    })
  },
  bescheid: async () => {
    const { baueBescheidMail } = await import('@/lib/email')
    return baueBescheidMail(BEISPIEL_AN, 'Danke für deinen Wunsch! Abholzeiten am Sonntag kann jeder Hof jetzt selbst eintragen.')
  },
}

/**
 * Ein Beispiel für die Ansicht: nur Betreff und HTML, beides durch
 * `entschaerfeLinks`. Gespeichert, protokolliert, geloggt oder verschickt
 * wird nichts; die erfundene Adresse der Baufunktion fällt hier weg.
 */
export async function baueMailBeispiel(id: MailBeispielId): Promise<{ betreff: string; html: string }> {
  const mail = await BAUE[id]()
  return { betreff: entschaerfeLinks(mail.betreff), html: entschaerfeLinks(mail.html) }
}
