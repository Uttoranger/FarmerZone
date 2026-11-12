/**
 * Jede Mail einmal gerendert — Fuß, Knöpfe, „Antwort an“ und die Vorschau
 * (Lauf 30, Nr. 232; V68, V78, V79, V86, V87; Register N26, N42 c, N43).
 *
 * Gerendert wird über denselben Weg wie im Versand: die Mails der
 * Warteschlange über ihren Renderer aus RENDERER (src/server/mail-arten), die
 * Sofort-Mails über ihre Versandfunktion in src/lib/email.ts — keine zweite
 * Render-Kette. Gemockt sind nur Datenbank, Resend-SDK und das Protokoll; die
 * Daten sind erfunden (Beispielwelt der Boards, Adressen unter example.org).
 * Kein Test verschickt eine Mail.
 *
 * Beweist je Mail:
 *  - den Fuß ihrer Art: „im Auftrag eines Hofes“ nur in Bestellmails an die
 *    Kundin, „Versandt von <Marke>.“ bei Konto, Code, Sicherheit, Team und allen
 *    Mails an den Hof, Betriebs-Mails und Postfach ihren eigenen Satz, Beiträge
 *    „Im Auftrag von <Hof> · versandt von <Marke>“; die Anbieterzeile mit dem
 *    Link auf das Impressum überall außer in Betriebs-Mails;
 *  - jeder Knopf ist mindestens 44 px hoch (Rand + Abstand + Zeilenhöhe);
 *  - kein „zwei Stunden“, kein „Dashboard“, kein „Vor-Ort“; nach dem Stichtag
 *    kein „Servicegebühr“ (Gegenprobe: Bestellung im Modell „bisher“);
 *  - „Antwort an“ nur bei Bestellmails an die Kundin, nur mit der Hof-E-Mail
 *    aus dem Profil — ohne sie keine, nie die Anmelde-Adresse; der Stapel und
 *    die Mail mit Anhang geben sie als `replyTo` an Resend weiter;
 *  - die Beitrags-Mail trägt Abmelde-Link und die Kopfzeilen List-Unsubscribe
 *    und List-Unsubscribe-Post (unverändert).
 * Dazu am Quelltext: Jede Vorlage unter src/emails wählt ihre Fuß-Art selbst,
 * und zwar die aus FUSS_JE_VORLAGE.
 *
 * Vorschau: Mit MAIL_VORSCHAU=1 (nur hier, keine Variable der App) legt der
 * Lauf jede Mail als .nachtlauf/mails/<name>.html ab (nicht committet), zum
 * Ansehen bei 390 und 600 px:
 *   MAIL_VORSCHAU=1 pnpm vitest run tests/mail-vorschau.test.ts
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const { sendMock, batchMock, db } = vi.hoisted(() => {
  // Vor jedem Import: src/lib/email.ts liest Schlüssel und Umgebung beim Laden, und die Renderer ziehen es mit.
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  // Wie im Produktions-Deployment: Nur dort ist die Post frei (Register Z3) — die Adressen unter example.org kämen sonst nicht bis zur Attrappe.
  vi.stubEnv('VERCEL_ENV', 'production')
  return {
  sendMock: vi.fn(),
  batchMock: vi.fn(),
  db: {
    order: { findUnique: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
    farm: { findUnique: vi.fn(), count: vi.fn() },
    meldung: { findUnique: vi.fn(), count: vi.fn() },
    kostenposten: { findMany: vi.fn() },
    nachricht: { findUnique: vi.fn() },
    unterhaltung: { findUnique: vi.fn() },
    customerFarmSubscription: { findUnique: vi.fn(), findFirst: vi.fn() },
    statusPost: { findFirst: vi.fn() },
    betreiberEmpfaenger: { findMany: vi.fn(), findFirst: vi.fn() },
    monatsabrechnung: { findUnique: vi.fn() },
    widerruf: { findUnique: vi.fn() },
  },
  }
})

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
// Das Mail-Protokoll (Nr. 158) bindet Prisma; hier geht es nur um die Mail selbst.
vi.mock('@/server/mail-warteschlange', () => ({ protokolliereSofortMail: vi.fn() }))
vi.mock('@/server/betrieb-zaehler', () => ({ zaehleMail: vi.fn() }))
vi.mock('@/server/queries/postfach', () => ({ ladeBetreiberEmpfaenger: vi.fn(), zaehleOffenImEingang: vi.fn() }))
vi.mock('@/server/queries/meldung', () => ({ zaehleFuerWochenlauf: vi.fn() }))
vi.mock('@/server/beitrag-vorname', () => ({ vornamenAusBestellungen: vi.fn(async () => new Map()), vornameFuer: () => 'Maria', setzeVorname: (t: string) => t }))
vi.mock('@/server/plattformgebuehr-abrechnung', () => ({ ankuendigungDaten: vi.fn() }))
// Die Beispielwelt liegt nach dem Stichtag „Hofpreis-Modell ab“ (Mi, 3. März 2027).
vi.mock('@/server/queries/plattform-einstellung', () => ({ ladeHofpreisEinstellung: vi.fn(async () => ({ hofpreisModellAb: new Date('2027-02-01T00:00:00.000Z') })) }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
    batch = { send: batchMock }
  },
}))

import { MAIL_ARTEN, bezugSchemaFuer, type MailArt } from '@/schemas/mail-auftrag'
import { RENDERER } from '@/server/mail-arten'
import { MAIL_FUSS_TEXT, type MailFussArt } from '@/emails/_layout'
import { PRODUKTION_ADRESSE } from '@/lib/umgebung'
import { ankuendigungText } from '@/lib/konditionen'
import { BELEHRUNG, WIDERRUF_TEXT } from '@/lib/widerruf'
import { zaehleOffenImEingang } from '@/server/queries/postfach'
import { zaehleFuerWochenlauf } from '@/server/queries/meldung'
import { ankuendigungDaten } from '@/server/plattformgebuehr-abrechnung'
import type { OrderForEmail, StapelMail } from '@/lib/email'
import { NOCHMAL_ERLAUBT, NOCHMAL_NIE } from '@/lib/betrieb-mails'

let email: typeof import('@/lib/email')

beforeAll(async () => {
  email = await import('@/lib/email')
}, 30_000)

afterAll(() => {
  vi.unstubAllEnvs()
})

/** Mi, 3. März 2027, 07:40 in Wien — der Tag der Beispielwelt. */
const JETZT = new Date('2027-03-03T06:40:00.000Z')

/** Ein Foto für den Beitrag, ohne Netz: eine leere Fläche im Format des Boards (nur Vorschau, nie in der App). */
const BEISPIEL_FOTO = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320"><rect width="600" height="320" fill="#E8E4D8"/></svg>')}`

/** Ein Code für die Vorschau entsteht erst zur Laufzeit — nie als Ziffernfolge im Test (tests/code-testwerte-wache.test.ts). */
const beispielCode = (ziffern: readonly number[]): string => ziffern.join('')

beforeEach(() => {
  vi.clearAllMocks()
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
  batchMock.mockResolvedValue({ data: { data: [{ id: 'email_1' }] }, error: null })
  vi.useFakeTimers({ toFake: ['Date'], now: JETZT })
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── Beispieldaten (erfunden) ───────────────────────────────────────────────

const HOF_EMAIL = 'hof-mueller@example.org'
const ANMELDE_ADRESSE = 'franz.mueller@example.org'

const HOF = {
  id: 'chofmueller0000000000001',
  name: 'Hof Müller',
  slug: 'hof-mueller',
  ownerName: 'Franz Müller',
  address: 'Dorfstraße 12',
  postalCode: '5280',
  city: 'Braunau am Inn',
  phone: '+43 664 0000000',
  email: HOF_EMAIL,
  owner: { email: ANMELDE_ADRESSE },
}

/** Eine Bestellung im Hofpreis-Modell (N38): Endpreise inkl. Plattformgebühr, wie die Boards. */
const BESTELLUNG = {
  id: 'cbestellung0000000000001',
  farmId: HOF.id,
  orderNumber: 'HM-0303-2C91',
  customerName: 'Maria Huber',
  customerEmail: 'maria.huber@example.org',
  customerPhone: '+43 660 0000000',
  totalAmount: '18.00',
  serviceFeeCents: 112,
  gebuehrModell: 'hofpreis' as string | null,
  gebuehrEinzug: null as string | null,
  createdAt: JETZT,
  pickupDate: new Date('2027-03-03T12:00:00.000Z'),
  pickupTimeStart: '15:00',
  pickupTimeEnd: '18:00',
  paymentMethod: 'ONLINE',
  stripePaymentIntentId: 'pi_beispiel',
  cancelReason: 'Der Hof kann die Bestellung wegen eines Unwetters leider nicht übergeben.',
  status: 'READY',
  kaeuferArt: 'PRIVAT',
  farm: HOF,
  items: [
    { id: 'cposition000000000000001', productName: 'Bergkäse', quantity: 2, unitPrice: '6.20', totalPrice: '12.40', gebuehrCents: 76, fehltSeit: null, product: { unit: 'G', unitSize: '250', ruecksendekostenCents: null } },
    { id: 'cposition000000000000002', productName: 'Heumilch frisch', quantity: 4, unitPrice: '1.40', totalPrice: '5.60', gebuehrCents: 36, fehltSeit: null, product: { unit: 'LITER', unitSize: '1', ruecksendekostenCents: null } },
  ],
}

const BAR = { ...BESTELLUNG, orderNumber: 'HM-0303-7E15', paymentMethod: 'ONSITE_CASH', customerName: 'Eva Steiner', customerEmail: 'eva.steiner@example.org', status: 'CONFIRMED', pickupDate: new Date('2027-03-06T12:00:00.000Z'), pickupTimeStart: '09:00', pickupTimeEnd: '12:00' }

/** Die Bestellung in der Form der Vorlagen (für die Sofort-Mail „Bitte bestätige“). */
function alsMailBestellung(b: typeof BESTELLUNG): OrderForEmail {
  return {
    ...b,
    items: b.items.map((i) => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice, gebuehrCents: i.gebuehrCents, product: i.product })),
  }
}

const WIDERRUF = { id: 'cwiderruf000000000000001', orderId: BESTELLUNG.id, eingegangenAm: JETZT, email: BESTELLUNG.customerEmail, umfang: 'ganz', positionen: null, grund: null }

// ─── Die Fälle ──────────────────────────────────────────────────────────────

type Gerendert = { betreff: string; html: string; antwortAn?: string; headers?: Record<string, string> }

type Fall = {
  /** Dateiname der Vorschau. */
  name: string
  art: MailArt
  /** null: Die Mail hat kein EmailLayout (siehe ohne Layout unten). */
  fuss: MailFussArt | null
  rendere: () => Promise<Gerendert>
}

/** Ein sichtbarer Hof, der online kassieren will — der Stand des Stripe-Kontos kommt je Fall dazu. */
const ONLINE_ZAHLUNG_HOF = {
  archivedAt: null,
  geschlossenAm: null,
  acceptsOnline: true,
  isActive: true,
  isPaused: false,
  approvedAt: JETZT,
  adminGesperrtAm: null,
  owner: { email: ANMELDE_ADRESSE },
}

async function ausRenderer(art: MailArt, bezug: Record<string, string>): Promise<Gerendert> {
  const renderer = RENDERER[art]
  if (!renderer) throw new Error(`kein Renderer für ${art}`)
  const mail = await renderer(bezugSchemaFuer(art).parse(bezug))
  if ('verworfen' in mail) throw new Error(`${art} verworfen: ${mail.verworfen}`)
  return { betreff: mail.betreff, html: mail.html, antwortAn: mail.antwortAn, headers: mail.headers }
}

/** Der letzte Aufruf an Resend — so, wie eine Sofort-Mail hinausginge. */
function ausResend(): Gerendert {
  const aufruf = sendMock.mock.calls.at(-1)?.[0] as { subject: string; html: string; replyTo?: string } | undefined
  if (!aufruf) throw new Error('keine Mail an Resend')
  return { betreff: aufruf.subject, html: aufruf.html, antwortAn: aufruf.replyTo }
}

function bestellung(b: typeof BESTELLUNG = BESTELLUNG) {
  db.order.findUnique.mockResolvedValue(b)
}

const FAELLE: Fall[] = [
  // Kauf und Storno an die Kundin (s3/w3-mail-kauf, -storno)
  { name: 'bestellung-bestaetigung-online', art: 'bestellung-bestaetigung', fuss: 'hof', rendere: () => (bestellung(), ausRenderer('bestellung-bestaetigung', { orderId: BESTELLUNG.id })) },
  { name: 'bestellung-bestaetigung-bar', art: 'bestellung-bestaetigung', fuss: 'hof', rendere: () => (bestellung(BAR), ausRenderer('bestellung-bestaetigung', { orderId: BAR.id })) },
  {
    name: 'bar-bestaetigungslink',
    art: 'bar-bestaetigungslink',
    fuss: 'hof',
    rendere: async () => {
      await email.sendOnsiteConfirmation(alsMailBestellung(BAR), 'platzhalter-ohne-token')
      return ausResend()
    },
  },
  { name: 'abholbereit', art: 'abholbereit', fuss: 'hof', rendere: () => (bestellung(), ausRenderer('abholbereit', { orderId: BESTELLUNG.id })) },
  { name: 'nicht-abholbereit', art: 'nicht-abholbereit', fuss: 'hof', rendere: () => (bestellung(), ausRenderer('nicht-abholbereit', { orderId: BESTELLUNG.id })) },
  { name: 'artikel-fehlt', art: 'artikel-fehlt', fuss: 'hof', rendere: () => (bestellung(BAR), ausRenderer('artikel-fehlt', { orderId: BAR.id, itemId: BAR.items[1].id, bisherCents: '1912', neuCents: '1312' })) },
  { name: 'storniert-online', art: 'storniert', fuss: 'hof', rendere: () => (bestellung(), ausRenderer('storniert', { orderId: BESTELLUNG.id, erstattetCents: '1912' })) },
  { name: 'storniert-bar', art: 'storniert', fuss: 'hof', rendere: () => (bestellung(BAR), ausRenderer('storniert', { orderId: BAR.id })) },
  { name: 'verfallen', art: 'verfallen', fuss: 'hof', rendere: () => (bestellung(BAR), ausRenderer('verfallen', { orderId: BAR.id })) },
  { name: 'zahlung-zu-spaet', art: 'zahlung-zu-spaet', fuss: 'hof', rendere: () => (bestellung(), ausRenderer('zahlung-zu-spaet', { orderId: BESTELLUNG.id, erstattetCents: '1912' })) },
  {
    name: 'widerruf-eingang',
    art: 'widerruf-eingang',
    fuss: 'plattform',
    rendere: async () => {
      await email.sendWiderrufEingang(BESTELLUNG.customerEmail, {
        bestellnummer: BESTELLUNG.orderNumber,
        umfang: ['Die ganze Bestellung'],
        eingegangenAm: 'Mittwoch, 3. März 2027, 19:40 Uhr',
        naechsteSchritte: ['Hof Müller prüft deinen Rücktritt und meldet sich.'],
        hofName: HOF.name,
      })
      return ausResend()
    },
  },
  {
    name: 'widerruf-erstattet',
    art: 'widerruf-erstattet',
    fuss: 'hof',
    rendere: () => {
      db.widerruf.findUnique.mockResolvedValue(WIDERRUF)
      bestellung()
      return ausRenderer('widerruf-erstattet', { widerrufId: WIDERRUF.id, erstattetCents: '1912' })
    },
  },
  {
    name: 'widerruf-abgelehnt',
    art: 'widerruf-abgelehnt',
    fuss: 'hof',
    rendere: () => {
      db.widerruf.findUnique.mockResolvedValue({ ...WIDERRUF, grund: 'Die Heumilch war schon geöffnet.' })
      bestellung()
      return ausRenderer('widerruf-abgelehnt', { widerrufId: WIDERRUF.id })
    },
  },
  // Codes und Links (s3/w3-mail-zugang)
  { name: 'anmeldecode', art: 'anmeldecode', fuss: 'plattform', rendere: async () => (await email.sendAnmeldeCodeEmail('maria.huber@example.org', beispielCode([6, 1, 5, 2, 0, 4])), ausResend()) },
  { name: 'bestellcode', art: 'bestellcode', fuss: 'plattform', rendere: async () => (await email.sendBestellCodeEmail('anna.berger@example.org', beispielCode([7, 3, 0, 2, 5, 4])), ausResend()) },
  { name: 'passwort-link', art: 'passwort-link', fuss: 'plattform', rendere: async () => (await email.sendPasswordResetEmail(ANMELDE_ADRESSE, `${PRODUKTION_ADRESSE}/reset-password?token=platzhalter`), ausResend()) },
  { name: 'email-bestaetigung', art: 'email-bestaetigung', fuss: 'plattform', rendere: async () => (await email.sendEmailBestaetigung('kontakt@hof-am-moos.example.org', `${PRODUKTION_ADRESSE}/verify?token=platzhalter`), ausResend()) },
  // Sicherheit (s3/w3-mail-sicherheit)
  {
    name: 'neue-anmeldung',
    art: 'neue-anmeldung',
    fuss: 'plattform',
    rendere: async () => {
      await email.sendNeueAnmeldungEmail(ANMELDE_ADRESSE, { hof: true, name: 'Franz Müller', geraet: 'Windows · Edge', zeitpunkt: new Date('2027-03-02T20:14:00.000Z'), link: `${PRODUKTION_ADRESSE}/sicherheit/nicht-ich?t=platzhalter` })
      return ausResend()
    },
  },
  { name: 'zu-viele-versuche-code', art: 'zu-viele-versuche', fuss: 'plattform', rendere: async () => (await email.sendZuVieleVersucheEmail('anna.berger@example.org', 'code', new Date('2027-03-03T08:15:00.000Z')), ausResend()) },
  { name: 'zu-viele-versuche-passwort', art: 'zu-viele-versuche', fuss: 'plattform', rendere: async () => (await email.sendZuVieleVersucheEmail(ANMELDE_ADRESSE, 'passwort', new Date('2027-03-03T08:15:00.000Z')), ausResend()) },
  { name: 'email-aendern-link', art: 'email-aendern-link', fuss: 'plattform', rendere: async () => (await email.sendEmailAendernLink('franz.mueller@neu.example.org', { hof: HOF.name, link: `${PRODUKTION_ADRESSE}/konto/adresse?t=platzhalter` }), ausResend()) },
  {
    name: 'email-geaendert-hinweis',
    art: 'email-geaendert-hinweis',
    fuss: 'plattform',
    rendere: async () => (await email.sendEmailGeaendertHinweis(ANMELDE_ADRESSE, { hof: HOF.name, zeitpunkt: JETZT, link: `${PRODUKTION_ADRESSE}/sicherheit/nicht-ich?t=platzhalter` }), ausResend()),
  },
  {
    name: 'registrierungs-hinweis',
    art: 'registrierungs-hinweis',
    fuss: 'plattform',
    rendere: async () => (await email.sendRegistrierungsHinweis(ANMELDE_ADRESSE, { weg: 'passwort', anmelden: `${PRODUKTION_ADRESSE}/login`, passwortZuruecksetzen: `${PRODUKTION_ADRESSE}/forgot-password` }), ausResend()),
  },
  // Admin-Konto und Team (s3/w3-mail-team)
  { name: 'admin-sicherheit-einrichtungscode', art: 'admin-sicherheit', fuss: 'plattform', rendere: async () => (await email.sendAdminSicherheitEmail('jonas.pichler@example.org', 'einrichtungscode', { geraet: 'Laptop · Chrome', zeitpunkt: JETZT, code: beispielCode([4, 8, 2, 9, 1, 7]) }), ausResend()) },
  { name: 'admin-sicherheit-passkey', art: 'admin-sicherheit', fuss: 'plattform', rendere: async () => (await email.sendAdminSicherheitEmail('clara.wimmer@example.org', 'passkey-hinzugefuegt', { geraet: 'Laptop · Chrome', zeitpunkt: JETZT }), ausResend()) },
  {
    name: 'team-recht-geaendert',
    art: 'team-recht-geaendert',
    fuss: 'plattform',
    rendere: async () => (await email.sendTeamRechtGeaendert('jonas.pichler@example.org', { anlass: 'eingeladen', name: 'Jonas Pichler', rechte: ['Höfe freischalten und betreuen', 'Bestellungen und Erstattungen', 'Startseite'] }), ausResend()),
  },
  { name: 'betreiber-bestaetigung', art: 'betreiber-bestaetigung', fuss: 'plattform', rendere: async () => (await email.sendBetreiberBestaetigung('jonas.pichler@example.org', 'platzhalter'), ausResend()) },
  { name: 'betreiber-testmail', art: 'betreiber-testmail', fuss: 'betrieb', rendere: () => ausRenderer('betreiber-testmail', { empfaengerId: 'support' }) },
  // Neuigkeiten (s3/w3-mail-neuigkeiten)
  {
    name: 'abo-bestaetigung',
    art: 'abo-bestaetigung',
    fuss: 'plattform',
    rendere: () => {
      db.customerFarmSubscription.findUnique.mockResolvedValue({ customerEmail: 'maria.huber@example.org', emailOptInAngefragtAm: JETZT, emailOptInBestaetigtAm: null, farm: { name: HOF.name } })
      return ausRenderer('abo-bestaetigung', { aboId: 'cabo00000000000000000001' })
    },
  },
  {
    // Board Bild 2: Beitrag mit Foto (die Adresse lädt in der Vorschau nicht — es zählt die Stelle im Aufbau).
    name: 'beitrag',
    art: 'beitrag',
    fuss: 'beitrag',
    rendere: () => {
      db.customerFarmSubscription.findFirst.mockResolvedValue({ customerEmail: 'maria.huber@example.org', farmId: HOF.id })
      db.statusPost.findFirst.mockResolvedValue({
        title: 'Frischer Bergkäse ab Samstag',
        body: 'Hallo Maria! Unser Bergkäse hat jetzt 8 Monate gereift. Ab Samstag, 6. März, holst du ihn bei uns ab – solange der Laib reicht.',
        anlass: 'FRESH_PRODUCT',
        photoUrl: BEISPIEL_FOTO,
        showOnFarmPage: true,
        farm: { name: HOF.name, slug: HOF.slug },
      })
      return ausRenderer('beitrag', { postId: 'cbeitrag0000000000000001', aboId: 'cabo00000000000000000001' })
    },
  },
  {
    // Board Bild 3: Beitrag ohne Foto, Anlass Hinweis (Lauf 31, Nr. 241 — vorher nicht prüfbar).
    name: 'beitrag-ohne-foto',
    art: 'beitrag',
    fuss: 'beitrag',
    rendere: () => {
      db.customerFarmSubscription.findFirst.mockResolvedValue({ customerEmail: 'maria.huber@example.org', farmId: HOF.id })
      db.statusPost.findFirst.mockResolvedValue({
        title: 'Am Samstag Hoffest',
        body: 'Am Sa, 13. März feiern wir von 10 bis 16 Uhr am Hof: Stallführung, Käseverkostung und Kaffee. Abholung wie immer 9–12 Uhr.',
        anlass: 'ANNOUNCEMENT',
        photoUrl: null,
        showOnFarmPage: true,
        farm: { name: HOF.name, slug: HOF.slug },
      })
      return ausRenderer('beitrag', { postId: 'cbeitrag0000000000000002', aboId: 'cabo00000000000000000001' })
    },
  },
  {
    name: 'bescheid',
    art: 'bescheid',
    fuss: 'postfach',
    rendere: () => {
      db.meldung.findUnique.mockResolvedValue({
        customerEmail: 'maria.huber@example.org',
        farmId: null,
        antwortAnMelder:
          'Du hast dir Abholzeiten am Sonntag gewünscht. Wir haben das mit den Höfen besprochen: Ab April können Höfe auch Sonntage als Abholzeit anbieten. Ob dein Hof mitmacht, siehst du auf seiner Seite.\n\nMehrere Kundinnen haben sich das gewünscht – darum diese eine Antwort an alle.',
      })
      return ausRenderer('bescheid', { meldungId: 'cmeldung0000000000000001' })
    },
  },
  // Bestellungen an den Hof (s3/w3-mail-hof-bestellung)
  { name: 'bestellung-bezahlt-hof', art: 'bestellung-bezahlt-hof', fuss: 'plattform', rendere: () => (bestellung(), ausRenderer('bestellung-bezahlt-hof', { orderId: BESTELLUNG.id })) },
  // Board Bild 2 „Neue Bestellung, Bar bei Abholung“ (Nr. 256): über den Renderer, solange die Kundin noch bestätigen kann.
  {
    name: 'bestellung-neu-bar-hof',
    art: 'bestellung-bar-hof',
    fuss: 'plattform',
    rendere: () => (bestellung({ ...BAR, status: 'PENDING_CONFIRMATION' }), ausRenderer('bestellung-bar-hof', { orderId: BAR.id })),
  },
  { name: 'bar-bestaetigt-hof', art: 'bar-bestaetigt-hof', fuss: 'plattform', rendere: () => (bestellung({ ...BAR, gebuehrEinzug: 'erlassen' }), ausRenderer('bar-bestaetigt-hof', { orderId: BAR.id })) },
  {
    name: 'widerruf-hof',
    art: 'widerruf-hof',
    fuss: 'plattform',
    rendere: () => {
      db.widerruf.findUnique.mockResolvedValue(WIDERRUF)
      bestellung()
      return ausRenderer('widerruf-hof', { widerrufId: WIDERRUF.id })
    },
  },
  // Konto und Geld an den Hof (s3/w3-mail-hof-konto)
  {
    name: 'freischaltung',
    art: 'freischaltung',
    fuss: 'plattform',
    rendere: () => {
      db.farm.findUnique.mockResolvedValue({ name: 'Hof am Moos', slug: 'hof-am-moos', approvedAt: JETZT, owner: { email: 'kontakt@hof-am-moos.example.org' } })
      return ausRenderer('freischaltung', { farmId: 'chofammoos00000000000001' })
    },
  },
  {
    name: 'plattformgebuehr-ankuendigung',
    art: 'plattformgebuehr-ankuendigung',
    fuss: 'plattform',
    rendere: () => {
      vi.mocked(ankuendigungDaten).mockResolvedValue({ an: ANMELDE_ADRESSE, datum: '1. Februar 2028', text: ankuendigungText({ datum: '1. Februar 2028', satz: '6', mandatNoetig: true }), archiviert: false })
      return ausRenderer('plattformgebuehr-ankuendigung', { farmId: HOF.id })
    },
  },
  // Register N49 (A012): Online-Zahlung aktiv bzw. Stripe braucht noch Angaben (W-A).
  {
    name: 'online-zahlung-aktiv',
    art: 'online-zahlung',
    fuss: 'plattform',
    rendere: () => {
      db.farm.findUnique.mockResolvedValue({ ...ONLINE_ZAHLUNG_HOF, stripeAccountReady: true, stripeKontoStand: 'bereit' })
      return ausRenderer('online-zahlung', { farmId: HOF.id, anlass: 'aktiv' })
    },
  },
  {
    name: 'online-zahlung-angaben',
    art: 'online-zahlung',
    fuss: 'plattform',
    rendere: () => {
      db.farm.findUnique.mockResolvedValue({ ...ONLINE_ZAHLUNG_HOF, stripeAccountReady: false, stripeKontoStand: 'angaben_fehlen' })
      return ausRenderer('online-zahlung', { farmId: HOF.id, anlass: 'angaben' })
    },
  },
  {
    name: 'lastschrift-gescheitert',
    art: 'lastschrift-gescheitert',
    fuss: 'plattform',
    rendere: () => {
      db.monatsabrechnung.findUnique.mockResolvedValue({ stand: 'gescheitert', monat: new Date('2028-04-01T00:00:00.000Z'), farm: { archivedAt: null, geschlossenAm: null, barSperreNachTagen: 14, owner: { email: 'kontakt@hof-am-moos.example.org' } } })
      return ausRenderer('lastschrift-gescheitert', { monatsabrechnungId: 'cabrechnung0000000000001' })
    },
  },
  {
    name: 'rundschreiben',
    art: 'rundschreiben',
    fuss: 'postfach',
    rendere: () => {
      db.unterhaltung.findUnique.mockResolvedValue({
        rundschreiben: { titel: 'Abholzeiten zu Ostern schon eingetragen?', text: 'Hallo Franz! Ostern ist am 28. März. Wenn du am Karsamstag offen hast, trag die Abholzeit bitte bis 20. März ein.', linkUrl: '/settings/abholzeiten' },
        farm: { archivedAt: null, geschlossenAm: null, owner: { email: ANMELDE_ADRESSE } },
      })
      return ausRenderer('rundschreiben', { unterhaltungId: 'cfaden000000000000000001' })
    },
  },
  {
    name: 'postfach-antwort',
    art: 'postfach',
    fuss: 'postfach',
    rendere: () => {
      db.nachricht.findUnique.mockResolvedValue({
        text: 'Hallo, das ist schon erledigt: Online behält Stripe die Gebühr gleich ein, du musst nichts überweisen.',
        linkUrl: null,
        unterhaltungId: 'cfaden000000000000000001',
        unterhaltung: { rundschreiben: { titel: 'Plattformgebühr ab 1. Februar' }, farm: { archivedAt: null, geschlossenAm: null, owner: { email: 'kontakt@hof-am-bach.example.org' } } },
      })
      return ausRenderer('postfach', { nachrichtId: 'cnachricht00000000000001' })
    },
  },
  // Betrieb (s3/w3-mail-betrieb)
  {
    name: 'neuer-hof',
    art: 'neuer-hof',
    fuss: 'betrieb',
    rendere: () => {
      db.farm.findUnique.mockResolvedValue({ id: 'chofammoos00000000000001', name: 'Hof am Moos', slug: 'hof-am-moos', createdAt: new Date('2027-02-22T17:40:00.000Z'), postalCode: '5230', city: 'Mattighofen', stripeAccountReady: false, _count: { products: 0, pickupSlots: 0 }, owner: { email: 'kontakt@hof-am-moos.example.org' } })
      return ausRenderer('neuer-hof', { farmId: 'chofammoos00000000000001', empfaengerId: 'support' })
    },
  },
  {
    name: 'meldung',
    art: 'meldung',
    fuss: 'betrieb',
    rendere: () => {
      db.meldung.findUnique.mockResolvedValue({ id: 'cmeldung0000000000000001', text: 'Die Packliste druckt die Abholzeit doppelt.', seiteUrl: '/orders/today/print', userAgent: 'Handy', viewport: '390x844', diagKennung: null, screenshotUrl: null, createdAt: JETZT, farm: { name: HOF.name } })
      return ausRenderer('meldung', { meldungId: 'cmeldung0000000000000001', empfaengerId: 'support' })
    },
  },
  {
    name: 'erstattung-offen',
    art: 'erstattung-offen',
    fuss: 'betrieb',
    rendere: () => {
      db.order.findUnique.mockResolvedValue({ orderNumber: 'HM-2702-5D20', farm: { name: HOF.name } })
      return ausRenderer('erstattung-offen', { empfaengerId: 'support', fall: 'storno_voll', orderId: BESTELLUNG.id, refundId: 're_beispiel', kundinCents: '2862' })
    },
  },
  {
    // Nr. 288 (M2): Die Gebühr nach „Nicht abgeholt“ ist nicht zurück — nur die Gebühr, nie der Warenpreis.
    name: 'erstattung-offen-gebuehr',
    art: 'erstattung-offen',
    fuss: 'betrieb',
    rendere: () => {
      db.order.findUnique.mockResolvedValue({ orderNumber: 'HM-2702-5D20', farm: { name: HOF.name } })
      return ausRenderer('erstattung-offen', { empfaengerId: 'support', fall: 'gebuehr_nicht_abgeholt', orderId: BESTELLUNG.id, kundinCents: '162' })
    },
  },
  {
    name: 'wochenbericht',
    art: 'wochenbericht',
    fuss: 'betrieb',
    rendere: () => {
      vi.mocked(zaehleFuerWochenlauf).mockResolvedValue({ neu: 1, liegenGeblieben: 0, offen: 2, neueste: [] })
      vi.mocked(zaehleOffenImEingang).mockResolvedValue({ antworten: 1, meldungen: 1, hoefe: 0, erstattungen: 0, gesamt: 2 })
      db.order.aggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { totalAmount: null } })
      db.order.findMany.mockResolvedValue([])
      db.farm.count.mockResolvedValue(0)
      db.meldung.count.mockResolvedValue(1)
      db.kostenposten.findMany.mockResolvedValue([])
      return ausRenderer('wochenbericht', { empfaengerId: 'support', geloeschtAnzahl: '0' })
    },
  },
  {
    name: 'antwort-an-team',
    art: 'antwort-an-team',
    fuss: 'betrieb',
    rendere: () => {
      db.nachricht.findUnique.mockResolvedValue({ text: 'Hallo, ich seh in der Abrechnung „online € 4,20“ für Februar. Zahl ich das extra?', unterhaltungId: 'cfaden000000000000000001', unterhaltung: { farm: { name: 'Hof am Bach' }, rundschreiben: { titel: 'Plattformgebühr ab 1. Februar' } } })
      return ausRenderer('antwort-an-team', { nachrichtId: 'cnachricht00000000000001', empfaengerId: 'support' })
    },
  },
  {
    name: 'betrieb-warnung',
    art: 'betrieb-warnung',
    fuss: 'betrieb',
    rendere: async () => {
      await email.sendBetriebWarnung({ art: 'grenze', wert: 'datenbank', anteil: 82, stand: '410 MB von 500 MB', trend: null, ohneVerwendungBytes: null }, ['betrieb@example.org'])
      return ausResend()
    },
  },
]

/** Arten ohne Vorlage: der Anmeldelink wird nicht mehr verschickt, die Testmail von /api/test-email baut ihr HTML selbst (beide außerhalb von src/emails). */
const OHNE_VORLAGE: readonly MailArt[] = ['login-link', 'testmail']

/** Bestellmails an die Kundin — nur sie bekommen „Antwort an“ den Hof (V86). */
const KUNDIN_BESTELLMAIL: readonly MailArt[] = [
  'bestellung-bestaetigung',
  'bar-bestaetigungslink',
  'abholbereit',
  'nicht-abholbereit',
  'artikel-fehlt',
  'storniert',
  'verfallen',
  'zahlung-zu-spaet',
  'widerruf-erstattet',
  'widerruf-abgelehnt',
]

// ─── Hilfen ─────────────────────────────────────────────────────────────────

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;|&#xA0;/g, ' ')
    .replace(/\s+/g, ' ')
}

const ALLE_FUESSE = (hof: string): Record<MailFussArt, string> => ({
  hof: MAIL_FUSS_TEXT.hof,
  plattform: MAIL_FUSS_TEXT.plattform,
  betrieb: MAIL_FUSS_TEXT.betrieb,
  postfach: MAIL_FUSS_TEXT.postfach,
  beitrag: MAIL_FUSS_TEXT.beitrag(hof),
})

const IMPRESSUM = `href="${PRODUKTION_ADRESSE}/impressum"`

/** Die Höhe eines Knopfs aus seinem Stil: Abstand oben und unten, Zeilenhöhe, Rand oben und unten. Ohne feste Zeilenhöhe NaN. */
function knopfHoehe(stil: string): number {
  const wert = (name: string) => new RegExp(`(?:^|;)\\s*${name}:([^;]+)`).exec(stil)?.[1].trim() ?? ''
  const px = (t: string | undefined) => (t && /^\d+(\.\d+)?px$/.test(t) ? Number.parseFloat(t) : t === '0' ? 0 : Number.NaN)
  const abstand = wert('padding').split(/\s+/)
  const oben = px(abstand[0])
  const unten = px(abstand[2] ?? abstand[0])
  const rand = px(/(\d+(?:\.\d+)?px)/.exec(wert('border'))?.[1] ?? '0')
  return oben + unten + px(wert('line-height')) + 2 * rand
}

/** Die Stile aller Knöpfe einer Mail: Links als Pille (border-radius 999px). */
function knopfStile(html: string): string[] {
  return [...html.matchAll(/<a\s[^>]*style="([^"]*)"/g)].map((m) => m[1]).filter((s) => /border-radius:999px/.test(s))
}

// ─── Prüfungen ──────────────────────────────────────────────────────────────

describe('jede Mail-Art hat hier einen Fall', () => {
  it('alle Arten aus MAIL_ARTEN außer denen ohne Vorlage', () => {
    const arten = new Set(FAELLE.map((f) => f.art))
    expect(MAIL_ARTEN.filter((a) => !arten.has(a) && !OHNE_VORLAGE.includes(a))).toEqual([])
    // Gegenprobe: Die Arten ohne Vorlage gibt es wirklich.
    for (const a of OHNE_VORLAGE) expect(MAIL_ARTEN).toContain(a)
  })
})

describe.each(FAELLE.map((f) => [f.name, f] as const))('Mail „%s“', (_name, fall) => {
  it('trägt den Fuß ihrer Art, die Anbieterzeile außer bei Betriebs-Mails — und nur einen Fuß', async () => {
    const mail = await fall.rendere()
    const t = text(mail.html)
    if (fall.fuss === null) {
      // Ohne EmailLayout: kein Fuß der Vorlagen (seit Nr. 241 hat jede Mail-Art ein Layout; der Zweig bleibt für künftige Arten).
      expect(Object.values(ALLE_FUESSE(HOF.name)).filter((s) => t.includes(s))).toEqual([])
      return
    }
    const fuesse = ALLE_FUESSE(HOF.name)
    expect(t).toContain(fuesse[fall.fuss])
    expect(Object.entries(fuesse).filter(([art, satz]) => art !== fall.fuss && t.includes(satz)).map(([art]) => art)).toEqual([])
    expect(mail.html.includes(IMPRESSUM)).toBe(fall.fuss !== 'betrieb')
  })

  it('jeder Knopf ist mindestens 44 px hoch (V78)', async () => {
    const mail = await fall.rendere()
    for (const stil of knopfStile(mail.html)) expect(knopfHoehe(stil), stil).toBeGreaterThanOrEqual(44)
  })

  it('kein „zwei Stunden“, kein „Dashboard“, kein „Vor-Ort“ — und nach dem Stichtag kein „Servicegebühr“', async () => {
    const mail = await fall.rendere()
    const t = `${mail.betreff} ${text(mail.html)}`
    expect(t).not.toMatch(/zwei Stunden|Dashboard|Vor-Ort|Servicegebühr/)
  })

  it('„Antwort an“ nur bei Bestellmails an die Kundin, dann die Hof-E-Mail aus dem Profil — nie die Anmelde-Adresse', async () => {
    const mail = await fall.rendere()
    expect(mail.antwortAn).toBe(KUNDIN_BESTELLMAIL.includes(fall.art) ? HOF_EMAIL : undefined)
    expect(mail.antwortAn).not.toBe(ANMELDE_ADRESSE)
  })

  it('Vorschau: mit MAIL_VORSCHAU=1 liegt die Mail unter .nachtlauf/mails (nur im Test)', async () => {
    const mail = await fall.rendere()
    if (fall.fuss !== null) expect(mail.html).toMatch(/^<!DOCTYPE html/)
    if (process.env.MAIL_VORSCHAU === '1') {
      const ordner = join(process.cwd(), '.nachtlauf', 'mails')
      mkdirSync(ordner, { recursive: true })
      writeFileSync(join(ordner, `${fall.name}.html`), mail.html)
    }
  })
})

describe('Online-Zahlung (Register N49, A012): Renderer verwirft, wenn der Anlass nicht mehr stimmt', () => {
  const rendere = async (anlass: 'aktiv' | 'angaben', hof: unknown) => {
    db.farm.findUnique.mockResolvedValue(hof)
    const renderer = RENDERER['online-zahlung']
    if (!renderer) throw new Error('kein Renderer für online-zahlung')
    return renderer({ farmId: HOF.id, anlass })
  }
  const bereit = { ...ONLINE_ZAHLUNG_HOF, stripeAccountReady: true, stripeKontoStand: 'bereit' }
  const angaben = { ...ONLINE_ZAHLUNG_HOF, stripeAccountReady: false, stripeKontoStand: 'angaben_fehlen' }

  it('Hof fehlt, stillgelegt, Online aus → verworfen', async () => {
    expect(await rendere('aktiv', null)).toEqual({ verworfen: 'hof_fehlt' })
    expect(await rendere('aktiv', { ...bereit, archivedAt: JETZT })).toEqual({ verworfen: 'hof_stillgelegt' })
    expect(await rendere('aktiv', { ...bereit, geschlossenAm: JETZT })).toEqual({ verworfen: 'hof_stillgelegt' })
    expect(await rendere('aktiv', { ...bereit, acceptsOnline: false })).toEqual({ verworfen: 'online_aus' })
    expect(await rendere('angaben', { ...angaben, acceptsOnline: false })).toEqual({ verworfen: 'online_aus' })
  })

  it('aktiv: nicht mehr bereit → verworfen; angaben: Stand nicht mehr „Angaben fehlen“ → verworfen', async () => {
    expect(await rendere('aktiv', { ...bereit, stripeAccountReady: false })).toEqual({ verworfen: 'nicht_mehr_bereit' })
    expect(await rendere('angaben', { ...angaben, stripeKontoStand: 'pruefung' })).toEqual({ verworfen: 'stand_geaendert' })
    expect(await rendere('angaben', { ...angaben, stripeAccountReady: true })).toEqual({ verworfen: 'stand_geaendert' })
  })

  it('Betreff = Überschrift, Text wie im Postfach, Knopf „Zahlung ansehen“ in die Zahlungs-Einstellungen', async () => {
    const aktiv = await rendere('aktiv', bereit)
    if ('verworfen' in aktiv) throw new Error('verworfen')
    expect(aktiv.betreff).toBe('Online-Zahlung ist aktiv')
    expect(aktiv.html).toContain('Ab sofort können Kunden bei dir online bezahlen.')
    expect(aktiv.html).toContain('/settings/payments')
    expect(aktiv.html).toContain('Zahlung ansehen')
    // Noch nicht freigeschaltet: der zweite Satz.
    const wartet = await rendere('aktiv', { ...bereit, approvedAt: null })
    if ('verworfen' in wartet) throw new Error('verworfen')
    expect(wartet.html).toContain('Sobald dein Hof online ist, können Kunden dort auch online bezahlen.')
    // Vom Team gesperrt: Bestellen geht gerade nicht — kein „ab sofort“ (E6 „nicht gesperrt“).
    const gesperrt = await rendere('aktiv', { ...bereit, adminGesperrtAm: JETZT })
    if ('verworfen' in gesperrt) throw new Error('verworfen')
    expect(gesperrt.html).toContain('Sobald dein Hof online ist, können Kunden dort auch online bezahlen.')
    expect(gesperrt.html).not.toContain('Ab sofort')
    const mehr = await rendere('angaben', angaben)
    if ('verworfen' in mehr) throw new Error('verworfen')
    expect(mehr.betreff).toBe('Stripe braucht noch Angaben von dir')
    expect(mehr.html).not.toMatch(/\bEPS\b/)
  })

  it('nie „nochmal schicken“ — die Nachricht steht im Postfach (Fund 14)', () => {
    expect(NOCHMAL_NIE).toContain('online-zahlung')
    expect((NOCHMAL_ERLAUBT as readonly string[]).includes('online-zahlung')).toBe(false)
  })
})

describe('Knopf-Höhe: die Rechnung', () => {
  it('Gegenprobe: der alte Knopf (11 px Abstand) ist zu klein, ohne feste Zeilenhöhe zählt er nicht', () => {
    expect(knopfHoehe('border:1px solid #2E6B45;line-height:16px;padding:11px 18px')).toBe(40)
    expect(knopfHoehe('border:1px solid #2E6B45;line-height:16px;padding:13px 18px')).toBe(44)
    expect(knopfHoehe('border:1px solid #2E6B45;padding:13px 18px')).toBeNaN()
    expect(knopfStile('<a href="x" style="border-radius:999px;padding:1px">K</a><a href="y" style="color:red">L</a>')).toHaveLength(1)
  })

  it('Gegenprobe: in den Mails mit Knopf wird wirklich gemessen', async () => {
    const mail = await FAELLE.find((f) => f.name === 'passwort-link')?.rendere()
    expect(knopfStile(mail?.html ?? '')).toHaveLength(1)
  })
})

describe('„Antwort an“ (V86)', () => {
  it('ohne Hof-E-Mail im Profil keine — auch nicht die Anmelde-Adresse; Leerzeichen zählen als leer', async () => {
    for (const leer of ['', '   ']) {
      bestellung({ ...BESTELLUNG, farm: { ...HOF, email: leer } })
      expect((await ausRenderer('bestellung-bestaetigung', { orderId: BESTELLUNG.id })).antwortAn).toBeUndefined()
      await email.sendOnsiteConfirmation(alsMailBestellung({ ...BAR, farm: { ...HOF, email: leer } }), 'platzhalter-ohne-token')
      const aufruf = sendMock.mock.calls.at(-1)?.[0] as Record<string, unknown>
      expect('replyTo' in aufruf).toBe(false)
    }
  })

  it('die Hof-E-Mail ohne Ränder', async () => {
    bestellung({ ...BESTELLUNG, farm: { ...HOF, email: `  ${HOF_EMAIL} ` } })
    expect((await ausRenderer('abholbereit', { orderId: BESTELLUNG.id })).antwortAn).toBe(HOF_EMAIL)
  })

  it('der Stapel gibt sie als replyTo an Resend weiter — eine Mail ohne bekommt keins', async () => {
    batchMock.mockResolvedValue({ data: { data: [{ id: 'email_1' }, { id: 'email_2' }] }, error: null })
    const mails: StapelMail[] = [
      { an: 'maria.huber@example.org', betreff: 'Erfunden', html: '<p>Erfunden</p>', antwortAn: HOF_EMAIL },
      { an: 'eva.steiner@example.org', betreff: 'Erfunden', html: '<p>Erfunden</p>' },
    ]
    expect(await email.versendeStapel(mails, 'stapel-beispiel')).toEqual({ ok: true, ids: ['email_1', 'email_2'] })
    const [nutzlast, optionen] = batchMock.mock.calls[0] as [Record<string, unknown>[], unknown]
    expect(nutzlast[0]).toMatchObject({ replyTo: HOF_EMAIL })
    expect('replyTo' in nutzlast[1]).toBe(false)
    // Idempotenz unverändert: der Schlüssel des Stapels.
    expect(optionen).toEqual({ idempotencyKey: 'stapel-beispiel' })
  })

  it('die Mail mit Anhang (AGB) gibt sie ebenso weiter', async () => {
    const mail: StapelMail = { an: 'maria.huber@example.org', betreff: 'Erfunden', html: '<p>Erfunden</p>', anhaenge: [{ dateiname: 'agb.html', inhalt: 'Erfunden' }], antwortAn: HOF_EMAIL }
    expect(await email.versendeStapel([mail], 'mail-beispiel')).toEqual({ ok: true, ids: ['email_1'] })
    expect(sendMock.mock.calls[0]?.[0]).toMatchObject({ replyTo: HOF_EMAIL })
    expect(sendMock.mock.calls[0]?.[1]).toEqual({ idempotencyKey: 'mail-beispiel' })
  })
})

describe('Beitrags-Mail: Abmeldung unverändert', () => {
  it('Abmelde-Link im Text und unter „Neuigkeiten verwalten“, dazu List-Unsubscribe und List-Unsubscribe-Post', async () => {
    const mail = await FAELLE.find((f) => f.name === 'beitrag')?.rendere()
    const html = mail?.html ?? ''
    const abmelden = [...html.matchAll(/href="([^"]*\/account\/unsubscribe\?token=[^"]+)"/g)].map((m) => m[1])
    expect(abmelden).toHaveLength(2)
    expect(new Set(abmelden).size).toBe(1)
    expect(text(html)).toContain('Abmelden')
    expect(text(html)).toContain(MAIL_FUSS_TEXT.verwaltenBeitrag)
    expect(mail?.headers?.['List-Unsubscribe']).toMatch(/^<.+\/api\/abmelden\?token=.+>$/)
    expect(mail?.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })
})

describe('Gebühren-Wort in den Kunden-Mails (V63)', () => {
  it('Gegenprobe: eine Bestellung im Modell „bisher“ zeigt ihre Servicegebühr als eigene Zeile', async () => {
    bestellung({ ...BESTELLUNG, gebuehrModell: null })
    const t = text((await ausRenderer('bestellung-bestaetigung', { orderId: BESTELLUNG.id })).html)
    expect(t).toContain('Servicegebühr')
    expect(t).not.toContain('Plattformgebühr')
  })

  it('im Hofpreis-Modell steckt sie in den Preisen — ohne eigene Zeile, mit dem Satz „inkl. Plattformgebühr“', async () => {
    bestellung()
    const t = text((await ausRenderer('bestellung-bestaetigung', { orderId: BESTELLUNG.id })).html)
    expect(t).toContain('inkl. Plattformgebühr (darin € 1,12)')
  })
})

/** Die Fuß-Art je Vorlage in der Reihenfolge ihrer EmailLayout-Aufrufe — die Liste aus dem Auftrag (Nr. 232, Punkt 1). */
const FUSS_JE_VORLAGE: Record<string, MailFussArt[]> = {
  'abo-bestaetigung.tsx': ['plattform'],
  'admin-sicherheit.tsx': ['plattform', 'plattform', 'plattform'],
  'anmeldecode.tsx': ['plattform'],
  'artikel-fehlt.tsx': ['hof'],
  'bescheid.tsx': ['postfach'],
  'bestellung-verfallen.tsx': ['hof'],
  'betreiber-antwort.tsx': ['betrieb'],
  'betreiber-bestaetigung.tsx': ['plattform'],
  'betreiber-testmail.tsx': ['betrieb'],
  'betrieb-warnung.tsx': ['betrieb'],
  'briefkasten-zusammenfassung.tsx': ['betrieb'],
  'email-aendern.tsx': ['plattform', 'plattform'],
  'email-bestaetigung.tsx': ['plattform'],
  'erstattung-offen.tsx': ['betrieb'],
  'freischaltung.tsx': ['plattform'],
  'lastschrift-gescheitert.tsx': ['plattform'],
  'meldung-notification.tsx': ['betrieb'],
  'neue-anmeldung.tsx': ['plattform'],
  'new-farm-notification.tsx': ['betrieb'],
  'new-order-notification.tsx': ['plattform'],
  'onsite-confirmation.tsx': ['hof'],
  'order-cancelled.tsx': ['hof'],
  'order-confirmation.tsx': ['hof'],
  'order-confirmed.tsx': ['plattform'],
  'order-not-ready.tsx': ['hof'],
  'password-reset.tsx': ['plattform'],
  'pickup-reminder.tsx': ['hof'],
  'plattformgebuehr-ankuendigung.tsx': ['plattform'],
  'online-zahlung.tsx': ['plattform'],
  'postfach-antwort.tsx': ['postfach'],
  'postfach-rundschreiben.tsx': ['postfach'],
  'registrierung-hinweis.tsx': ['plattform'],
  'status-update.tsx': ['beitrag'],
  'team-recht-geaendert.tsx': ['plattform'],
  // Eingangsbestätigung und Mail an den Hof: die Plattform; das Ergebnis an die Kundin gehört zur Bestellung.
  'widerruf.tsx': ['plattform', 'plattform', 'hof'],
  'zahlung-zu-spaet.tsx': ['hof'],
  'zu-viele-versuche.tsx': ['plattform'],
}

/** Ohne EmailLayout: das Layout selbst und ein Teil der Bestätigungsmails. */
const KEINE_VORLAGE = ['_layout.tsx', 'belehrung-teil.tsx']

const FUSS_IM_QUELLTEXT = /<EmailLayout\b[^>]*?\bfuss=\{\{\s*art:\s*'(\w+)'/g

describe('Fuß-Art je Vorlage (Quelltext von src/emails)', () => {
  const ORDNER = join(process.cwd(), 'src', 'emails')
  const vorlagen = readdirSync(ORDNER).filter((n) => n.endsWith('.tsx') && !KEINE_VORLAGE.includes(n))
  const arten = (quelle: string) => [...quelle.matchAll(FUSS_IM_QUELLTEXT)].map((m) => m[1])

  it('jede Vorlage wählt ihre Art selbst, und zwar die aus der Liste', () => {
    expect(vorlagen.sort()).toEqual(Object.keys(FUSS_JE_VORLAGE).sort())
    for (const n of vorlagen) {
      const quelle = readFileSync(join(ORDNER, n), 'utf8')
      // Jeder Aufruf des Layouts trägt eine Art — keiner bleibt ohne.
      expect((quelle.match(/<EmailLayout\b/g) ?? []).length, n).toBe(FUSS_JE_VORLAGE[n]?.length)
      expect(arten(quelle), n).toEqual(FUSS_JE_VORLAGE[n])
    }
  })

  it('Gegenprobe: die Suche findet die Art auch zwischen anderen Props und schlägt ohne Art nicht an', () => {
    expect(arten(`<EmailLayout previewText="x" fuss={{ art: 'hof' }}>`)).toEqual(['hof'])
    expect(arten(`<EmailLayout fuss={{ art: 'beitrag', hof: farmName }} manageUrl={u}>`)).toEqual(['beitrag'])
    expect(arten('<EmailLayout previewText="x">')).toEqual([])
  })
})

describe('Recht bleibt wörtlich (N43 (1) und (2), Lauf 30 — gleich dem Stand auf main, 056a321)', () => {
  it('die N39-Beschriftung: Einstieg und Knöpfe der Online-Funktion', () => {
    expect(WIDERRUF_TEXT.fussLink).toBe('Vertrag widerrufen')
    expect(WIDERRUF_TEXT.knopfWiderrufen).toBe('Vertrag widerrufen')
    expect(WIDERRUF_TEXT.knopfBestaetigen).toBe('Widerruf bestätigen')
  })

  it('die Belehrung nach Anhang I FAGG: Fingerabdruck des ganzen Texts unverändert', () => {
    // Eingefroren auf dem Stand von main (056a321): Die Freigabe (Lauf 30, „FERTIG, WENN“) verlangt den Beleg „bleibt gleich“.
    expect(createHash('sha256').update(JSON.stringify(BELEHRUNG)).digest('hex')).toBe('8c273980fa03877590037802a8b1e19e7edaccb105d0fe452c69ed8d20a0ec86')
  })

  it('der Einstieg „Vertrag widerrufen“ steht weiter in den Bestellmails an Verbraucherinnen', async () => {
    const mail = await FAELLE.find((f) => f.name === 'abholbereit')?.rendere()
    expect(text(mail?.html ?? '')).toContain(WIDERRUF_TEXT.fussLink)
    // Gegenprobe: ohne Käuferart PRIVAT kein Einstieg.
    bestellung({ ...BESTELLUNG, kaeuferArt: 'BETRIEB' })
    expect(text((await ausRenderer('abholbereit', { orderId: BESTELLUNG.id })).html)).not.toContain(WIDERRUF_TEXT.fussLink)
  })
})

describe('Storno ohne Erstattung: der Satz folgt der Zahlart (Nr. 241, Runde 1)', () => {
  const satz = async (zahlart?: 'online' | 'bar' | 'karte') => {
    const [{ OrderCancelledEmail }, { render }] = await Promise.all([import('@/emails/order-cancelled'), import('@react-email/render')])
    return text(await render(OrderCancelledEmail({ customerName: 'Eva Steiner', orderNumber: 'HM-0303-7E15', farmName: HOF.name, total: 18, refundAmount: null, zahlart })))
  }

  it('bar: der Satz des Boards', async () => {
    expect(await satz('bar')).toContain('Du hättest bar bezahlt – es ist nichts zu erstatten.')
  })

  it('Karte bei Abholung und ohne Zahlart: neutral, nie „bar“', async () => {
    for (const t of [await satz('karte'), await satz()]) {
      expect(t).toContain('Da du vor Ort bezahlst, entstehen dir keine Kosten.')
      expect(t).not.toContain('bar bezahlt')
    }
  })

  it('der Renderer gibt die Zahlart der Bestellung weiter (Karte → neutral)', async () => {
    bestellung({ ...BAR, paymentMethod: 'ONSITE_CARD' })
    expect(text((await ausRenderer('storniert', { orderId: BAR.id })).html)).not.toContain('bar bezahlt')
    bestellung(BAR)
    expect(text((await ausRenderer('storniert', { orderId: BAR.id })).html)).toContain('Du hättest bar bezahlt')
  })
})

describe('Bescheid: die Antwort des Teams steht nur als Text da (Nr. 241, Runde 1)', () => {
  it('<script> und Zeichen in der Antwort werden maskiert, nie als Markup ausgegeben', async () => {
    const mail = await email.baueBescheidMail('maria.huber@example.org', '<script>alert(1)</script>\n„Danke" & <b>gut</b>')
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).not.toContain('<b>gut</b>')
    expect(mail.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(mail.html).toContain('&amp; &lt;b&gt;gut&lt;/b&gt;')
  })
})

// ─── Rechtsblöcke byteweise gleich (Nr. 280, Auftrag 23.3) ──────────────────

/**
 * Weitere Fassungen derselben Beispielwelt, damit jeder Rechtsblock einmal
 * vorkommt: Modell „bisher“ (Servicegebühr), Käuferart BETRIEB (ohne Belehrung)
 * und Karte bei Abholung.
 */
const RECHT_FAELLE: Fall[] = [
  ...FAELLE,
  { name: 'bestellung-bestaetigung-online-bisher', art: 'bestellung-bestaetigung', fuss: 'hof', rendere: () => (bestellung({ ...BESTELLUNG, gebuehrModell: null }), ausRenderer('bestellung-bestaetigung', { orderId: BESTELLUNG.id })) },
  { name: 'bestellung-bestaetigung-bar-bisher', art: 'bestellung-bestaetigung', fuss: 'hof', rendere: () => (bestellung({ ...BAR, gebuehrModell: null }), ausRenderer('bestellung-bestaetigung', { orderId: BAR.id })) },
  { name: 'bestellung-bestaetigung-betrieb', art: 'bestellung-bestaetigung', fuss: 'hof', rendere: () => (bestellung({ ...BESTELLUNG, kaeuferArt: 'BETRIEB' }), ausRenderer('bestellung-bestaetigung', { orderId: BESTELLUNG.id })) },
  { name: 'bestellung-bestaetigung-karte', art: 'bestellung-bestaetigung', fuss: 'hof', rendere: () => (bestellung({ ...BAR, paymentMethod: 'ONSITE_CARD' }), ausRenderer('bestellung-bestaetigung', { orderId: BAR.id })) },
  {
    name: 'bar-bestaetigungslink-bisher',
    art: 'bar-bestaetigungslink',
    fuss: 'hof',
    rendere: async () => {
      await email.sendOnsiteConfirmation(alsMailBestellung({ ...BAR, gebuehrModell: null }), 'platzhalter-ohne-token')
      return ausResend()
    },
  },
  { name: 'abholbereit-betrieb', art: 'abholbereit', fuss: 'hof', rendere: () => (bestellung({ ...BESTELLUNG, kaeuferArt: 'BETRIEB' }), ausRenderer('abholbereit', { orderId: BESTELLUNG.id })) },
  { name: 'bestellung-bezahlt-hof-bisher', art: 'bestellung-bezahlt-hof', fuss: 'plattform', rendere: () => (bestellung({ ...BESTELLUNG, gebuehrModell: null }), ausRenderer('bestellung-bezahlt-hof', { orderId: BESTELLUNG.id })) },
  { name: 'bar-bestaetigt-hof-bisher', art: 'bar-bestaetigt-hof', fuss: 'plattform', rendere: () => (bestellung({ ...BAR, gebuehrModell: null }), ausRenderer('bar-bestaetigt-hof', { orderId: BAR.id })) },
]

/** Die „vorher“-Fassung: erzeugt aus dem Stand der Basis (acdd1ab6828f), bevor Nr. 280 eine Mail änderte. */
const RECHT_SCHNAPPSCHUSS = join(process.cwd(), 'tests', 'fixtures', 'mail-rechtsbloecke-280.json')

describe('Rechtsblöcke: byteweise wie vor Nr. 280 (Render-Vergleich, Auftrag 23.3)', () => {
  it('jede Mail der Vorschau und jedes Beispiel aus Admin › Betrieb › Mails', async () => {
    const { rechtsbloecke } = await import('./mail-rechtsbloecke')
    const { baueMailBeispiel } = await import('@/server/mail-arten/beispiele')
    const { MAIL_BEISPIEL_IDS } = await import('@/lib/betrieb-mails')
    const jetzt: Record<string, ReturnType<typeof rechtsbloecke>> = {}
    for (const fall of RECHT_FAELLE) {
      vi.clearAllMocks()
      sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
      jetzt[`vorschau:${fall.name}`] = rechtsbloecke((await fall.rendere()).html)
    }
    for (const id of MAIL_BEISPIEL_IDS) jetzt[`beispiel:${id}`] = rechtsbloecke((await baueMailBeispiel(id)).html)
    // Der Schalter schreibt die Vorher-Fassung neu und schlägt dann bewusst fehl: Ein Lauf mit gesetzter Variable ist nie grün.
    if (process.env.MAIL_RECHT_SCHNAPPSCHUSS === '1') {
      writeFileSync(RECHT_SCHNAPPSCHUSS, `${JSON.stringify(jetzt, null, 2)}\n`)
      throw new Error('Schnappschuss neu geschrieben – ohne MAIL_RECHT_SCHNAPPSCHUSS erneut laufen lassen und den Diff der Fixture begründen')
    }
    const vorher = JSON.parse(readFileSync(RECHT_SCHNAPPSCHUSS, 'utf8')) as typeof jetzt
    expect(jetzt).toEqual(vorher)
    // Gegenprobe: Der Vergleich greift wirklich — Belehrung, Anbieterzeile und Gebühren-Satz sind erkannt.
    expect(jetzt['vorschau:bestellung-bestaetigung-online'].length).toBeGreaterThanOrEqual(3)
    expect(Object.values(jetzt).filter((b) => b.length > 0).length).toBeGreaterThan(40)
  }, 60_000)
})
