/**
 * Beitrag teilen = ein Fenster (Register T5, Nachtlauf Nr. 67).
 *
 * Beweist:
 *  - Daten im Beitrag-Modus: die verknüpften Produkte sind vorbelegt (eine
 *    Familie zählt, ausverkauft nie, höchstens drei), der Link führt auf den
 *    Reiter „Beiträge" und zählt mit denselben `?k=`-Kürzeln, es gibt kein
 *    Plakat, ohne Abonnentinnen weder Karte noch versandPfad, der Text ist
 *    „Titel – Text" mit Abholung, höchstens ein Knopf ist orange.
 *  - Die Action gibt nur Beiträge des Hofs der Sitzung heraus (Besitz in der
 *    WHERE-Klausel); fremd, nicht auf der Hofseite, abgelaufen, ungültig oder
 *    ohne Anmeldung → ein Satz, keine Daten.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Decimal } from '@prisma/client/runtime/index-browser'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))
// „n per E-Mail" zählt seit Nr. 159 die Warteschlange (tests/mail-auftraege.test.ts); hier gilt die Zahl am Beitrag.
vi.mock('@/server/mail-arten/beitrag', () => ({
  gesendeteBeitragsMails: vi.fn(async (beitraege: Array<{ id: string; emailRecipientCount: number }>) => new Map(beitraege.map((b) => [b.id, b.emailRecipientCount]))),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findFirst: vi.fn() },
    statusPost: { findFirst: vi.fn() },
    customerFarmSubscription: { count: vi.fn() },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'
import { ladeTeilenFensterBeitragAction } from '@/server/actions/teilen-fenster'
import {
  anfangsAuswahl,
  BEITRAG_TEILEN_TEXT,
  beitragTextVorschlag,
  beitragVorbelegung,
  beitragWhatsApp,
  fensterFussnote,
  kanalZiel,
  orangerKnopf,
  plakatPfad,
  PLAKAT_PFAD,
  type TeilenFensterBeitrag,
  type TeilenFensterHof,
} from '@/lib/teilen-fenster'
import { TEILEN_ZAEHLUNG_HINWEIS } from '@/lib/teilen-kanal'
import { teilenBesuchAusAdresse } from '@/lib/teilen-besuch'
import { hofAdresse } from '@/lib/mein-hof'
import { APP_URL } from '@/lib/umgebung-server'
import type { TeilenAuswahlEintrag } from '@/lib/teilen-bild'

const JETZT = new Date('2026-10-12T10:00:00Z')
const BEITRAG_ID = 'cbeitrag0000000000000001'
const EIGENES_FOTO = 'https://testspeicher.public.blob.vercel-storage.com/farms/farm-1/product/1.webp'

const produkt = (id: string, mehr: Record<string, unknown> = {}) => ({
  id,
  name: `Produkt ${id}`,
  price: new Decimal('4.50'),
  isAvailable: true,
  stock: 3,
  familieId: null,
  category: null,
  verpackung: null,
  imageUrl: null,
  ...mehr,
})

const HOF_ROH = {
  id: 'farm-1',
  name: 'Hof Test',
  slug: 'hof-test',
  city: 'Teststadt',
  isPaused: false,
  betriebsnummer: null,
  betriebsstatus: null,
  products: [
    produkt('eier'),
    // Eine Familie: die kleine Größe ausverkauft, die große kaufbar und mit eigenem Foto.
    produkt('honig-klein', { familieId: 'fam-honig', stock: 0 }),
    produkt('honig-gross', { familieId: 'fam-honig', imageUrl: EIGENES_FOTO }),
    produkt('heu', { stock: 0 }),
  ],
  // Ohne Abholfenster hängt der Text nicht an der Uhr.
  pickupSlots: [],
}

const beitragRoh = (mehr: Record<string, unknown> = {}) => ({
  id: BEITRAG_ID,
  farmId: 'farm-1',
  title: 'Frischer Honig',
  body: 'Hallo {Vorname}, der Honig ist da',
  linkedProductIds: ['honig-klein', 'heu'],
  publishedAt: new Date('2026-10-12T08:00:00Z'),
  expiresAt: new Date('2026-10-19T08:00:00Z'),
  showOnFarmPage: true,
  sentViaEmail: true,
  emailRecipientCount: 12,
  whatsappGetippt: ['abo-1'],
  ...mehr,
})

/** Die Datenbank-Attrappe achtet auf den Hof in der WHERE-Klausel — wie Postgres. */
function stelleBeitrag(roh: ReturnType<typeof beitragRoh> | null) {
  vi.mocked(prisma.statusPost.findFirst).mockImplementation((async (args: { where: { id: string; farmId: string } }) =>
    roh && args.where.id === roh.id && args.where.farmId === roh.farmId ? roh : null) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(JETZT)
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_testspeicher_geheim')
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user-1' } } as never)
  vi.mocked(getFarmForUser).mockResolvedValue({ id: 'farm-1' } as never)
  vi.mocked(prisma.farm.findFirst).mockResolvedValue(HOF_ROH as never)
  vi.mocked(prisma.customerFarmSubscription.count).mockResolvedValue(3 as never)
  stelleBeitrag(beitragRoh())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function ladeDaten(): Promise<TeilenFensterBeitrag> {
  const antwort = await ladeTeilenFensterBeitragAction(BEITRAG_ID)
  if ('error' in antwort) throw new Error(`erwartet Daten, bekam: ${antwort.error}`)
  return antwort.daten
}

describe('ladeTeilenFensterBeitragAction — Daten im Beitrag-Modus', () => {
  it('eigener Beitrag: Link auf genau diesen Beitrag (?beitrag=, T5 seit Nr. 128), Produkte vorbelegt, Text aus dem Beitrag', async () => {
    const daten = await ladeDaten()
    const hof = hofAdresse(APP_URL, 'hof-test')
    expect(daten).toMatchObject({
      art: 'beitrag',
      beitragId: BEITRAG_ID,
      titel: 'Frischer Honig',
      slug: 'hof-test',
      link: `${hof.url}?beitrag=${BEITRAG_ID}`,
      adresse: `${hof.anzeige}?beitrag=${BEITRAG_ID}`,
      // honig-klein ist verknüpft und ausverkauft — seine Familie zählt mit der kaufbaren Größe; heu ist ausverkauft.
      vorbelegt: ['honig-gross'],
      textVorschlag: 'Frischer Honig – Hallo, der Honig ist da. Jetzt online bestellen.',
      email: { anzahl: 12 },
    })
    // Nur das Foto aus dem eigenen Speicher zählt; die anderen Einträge zeigen im Bild die Illustration.
    expect(daten.ohneFoto).toEqual(['eier', 'heu'])
  })

  it('Besitz in der WHERE-Klausel: der Hof aus der Sitzung, nie aus der Eingabe', async () => {
    await ladeDaten()
    expect(vi.mocked(prisma.statusPost.findFirst).mock.calls[0][0]).toMatchObject({ where: { id: BEITRAG_ID, farmId: 'farm-1' } })
  })

  it('WhatsApp-Abonnentinnen: n von m live, mit Weg zur Tipp-Liste; ohne Abonnentinnen keine Karte und kein versandPfad', async () => {
    expect(await ladeDaten()).toMatchObject({
      abonnentinnen: { anzahl: 3, geoeffnet: 1 },
      versandPfad: `/status/${BEITRAG_ID}/send-whatsapp`,
    })
    vi.mocked(prisma.customerFarmSubscription.count).mockResolvedValue(0 as never)
    expect(await ladeDaten()).toMatchObject({ abonnentinnen: null, versandPfad: null })
  })

  it('ohne Mail beim Veröffentlichen: kein E-Mail-Teil', async () => {
    stelleBeitrag(beitragRoh({ sentViaEmail: false, emailRecipientCount: 0 }))
    expect((await ladeDaten()).email).toBeNull()
  })

  it.each([
    ['fremder Beitrag (anderer Hof in der Sitzung)', () => vi.mocked(getFarmForUser).mockResolvedValue({ id: 'farm-2' } as never)],
    ['nicht auf der Hofseite', () => stelleBeitrag(beitragRoh({ showOnFarmPage: false }))],
    ['abgelaufen', () => stelleBeitrag(beitragRoh({ expiresAt: new Date('2026-10-12T09:59:59Z') }))],
    ['unbekannt', () => stelleBeitrag(null)],
    ['Hof nicht öffentlich', () => vi.mocked(prisma.farm.findFirst).mockResolvedValue(null as never)],
  ])('%s → Satz, keine Daten', async (_fall, vorbereiten) => {
    vorbereiten()
    expect(await ladeTeilenFensterBeitragAction(BEITRAG_ID)).toEqual({ error: BEITRAG_TEILEN_TEXT.nichtTeilbar })
  })

  it.each([[''], ['x'.repeat(65)], [42], [null], [{ id: BEITRAG_ID }]])('ungültige Kennung %j → Satz, keine Abfrage', async (id) => {
    expect(await ladeTeilenFensterBeitragAction(id)).toEqual({ error: BEITRAG_TEILEN_TEXT.nichtTeilbar })
    expect(prisma.statusPost.findFirst).not.toHaveBeenCalled()
  })

  it('ohne Anmeldung → Satz zum Neu-Anmelden, keine Abfrage', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    expect(await ladeTeilenFensterBeitragAction(BEITRAG_ID)).toEqual({ error: 'Bitte melde dich neu an.' })
    expect(prisma.statusPost.findFirst).not.toHaveBeenCalled()
  })
})

const eintrag = (id: string, ausverkauft = false): TeilenAuswahlEintrag => ({ id, name: `Produkt ${id}`, preis: '€ 1,00', ausverkauft })

const HOF_DATEN: TeilenFensterHof = {
  art: 'hof',
  hofName: 'Hof Test',
  slug: 'hof-test',
  link: 'https://agrilo.at/hof-test',
  adresse: 'agrilo.at/hof-test',
  auswahl: [eintrag('a'), eintrag('b', true), eintrag('c'), eintrag('d'), eintrag('e')],
  textVorschlag: '',
}
const BEITRAG_DATEN: TeilenFensterBeitrag = {
  ...HOF_DATEN,
  art: 'beitrag',
  link: `https://agrilo.at/hof-test?beitrag=${BEITRAG_ID}`,
  adresse: `agrilo.at/hof-test?beitrag=${BEITRAG_ID}`,
  beitragId: BEITRAG_ID,
  titel: 'Frischer Honig',
  vorbelegt: ['d', 'e'],
  ohneFoto: [],
  abonnentinnen: { anzahl: 3, geoeffnet: 1 },
  versandPfad: `/status/${BEITRAG_ID}/send-whatsapp`,
  email: null,
}

describe('Beitrag-Modus: die reinen Regeln', () => {
  it('Vorbelegung: die verknüpften Produkte, in der Reihenfolge des Hofs, höchstens drei, nie ausverkauft', () => {
    const auswahl = [eintrag('a'), eintrag('b', true), eintrag('c'), eintrag('d'), eintrag('e')]
    const produkte = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, familieId: null }))
    expect(beitragVorbelegung(auswahl, produkte, ['e', 'b', 'a', 'c', 'd'])).toEqual(['a', 'c', 'd'])
    expect(beitragVorbelegung(auswahl, produkte, [])).toEqual([])
  })

  it('anfangs im Bild: im Beitrag-Modus die Vorbelegung, ohne verknüpfte Produkte und beim Hof die ersten drei', () => {
    expect(anfangsAuswahl(BEITRAG_DATEN)).toEqual(['d', 'e'])
    expect(anfangsAuswahl({ ...BEITRAG_DATEN, vorbelegt: [] })).toEqual(['a', 'c', 'd'])
    expect(anfangsAuswahl(HOF_DATEN)).toEqual(['a', 'c', 'd'])
  })

  it('der Link zählt mit denselben Kürzeln — und die Hofseite behält dabei den Beitrag', () => {
    const ziel = { link: BEITRAG_DATEN.link, text: 'Frischer Honig', hofName: 'Hof Test' }
    expect(kanalZiel('wa', ziel)).toEqual({
      art: 'oeffnen',
      href: `https://wa.me/?text=${encodeURIComponent(`Frischer Honig\nhttps://agrilo.at/hof-test?beitrag=${BEITRAG_ID}&k=wa`)}`,
    })
    expect(kanalZiel('fb', ziel)).toEqual({
      art: 'oeffnen',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://agrilo.at/hof-test?beitrag=${BEITRAG_ID}&k=fb`)}`,
    })
    expect(kanalZiel('ig', ziel)).toMatchObject({ art: 'bild', link: `https://agrilo.at/hof-test?beitrag=${BEITRAG_ID}&k=ig` })
    expect(teilenBesuchAusAdresse(`https://agrilo.at/hof-test?beitrag=${BEITRAG_ID}&k=wa`)).toEqual({ kanal: 'wa', ohne: `/hof-test?beitrag=${BEITRAG_ID}` })
  })

  it('kein Plakat im Beitrag-Modus — das Plakat trägt die feste Hofseite', () => {
    expect(plakatPfad(BEITRAG_DATEN)).toBeNull()
    expect(plakatPfad(HOF_DATEN)).toBe(PLAKAT_PFAD)
  })

  it('WhatsApp-Karte: ohne Abonnentinnen nichts; n nie über m', () => {
    expect(beitragWhatsApp(BEITRAG_ID, 0, 0)).toEqual({ abonnentinnen: null, versandPfad: null })
    expect(beitragWhatsApp(BEITRAG_ID, 3, 5)).toEqual({ abonnentinnen: { anzahl: 3, geoeffnet: 3 }, versandPfad: `/status/${BEITRAG_ID}/send-whatsapp` })
  })

  it('Text: „Titel – Text", dann die Abholung; ohne Abholung „Jetzt online bestellen."', () => {
    expect(beitragTextVorschlag('Frische Eier', 'Frisch gelegt!', 'Abholung Samstag, 9–12 Uhr')).toBe(
      'Frische Eier – Frisch gelegt! Online bestellen, Abholung Samstag, 9–12 Uhr.'
    )
    expect(beitragTextVorschlag('Frische Eier', 'Zwei Zeilen\n\nText', null)).toBe('Frische Eier – Zwei Zeilen Text. Jetzt online bestellen.')
  })

  it('Unterzeile: der Teil mit der Mail entfällt ohne Mail; am Handy kurz', () => {
    expect(BEITRAG_TEILEN_TEXT.unterzeile(34, false)).toBe('Veröffentlicht · auf deiner Hofseite · 34 per E-Mail verschickt')
    expect(BEITRAG_TEILEN_TEXT.unterzeile(null, false)).toBe('Veröffentlicht · auf deiner Hofseite')
    expect(BEITRAG_TEILEN_TEXT.unterzeile(34, true)).toBe('Veröffentlicht · auf der Hofseite · 34 per E-Mail')
  })

  it('höchstens ein Knopf orange: mit Abonnentinnen „Nachrichten verschicken", sonst WhatsApp bzw. das Teilen-Menü', () => {
    expect(orangerKnopf(BEITRAG_DATEN, true)).toBe('abonnentinnen')
    expect(orangerKnopf(BEITRAG_DATEN, false)).toBe('abonnentinnen')
    const ohne = { ...BEITRAG_DATEN, abonnentinnen: null, versandPfad: null }
    expect(orangerKnopf(ohne, true)).toBe('whatsapp')
    expect(orangerKnopf(ohne, false)).toBe('telefon')
    expect(orangerKnopf(HOF_DATEN, true)).toBe('whatsapp')
  })

  it('Fußnote: Zählhinweis, im Beitrag-Modus dazu der Satz zur Mail', () => {
    expect(fensterFussnote(HOF_DATEN)).toBe(TEILEN_ZAEHLUNG_HINWEIS)
    expect(fensterFussnote(BEITRAG_DATEN)).toBe(`${TEILEN_ZAEHLUNG_HINWEIS} ${BEITRAG_TEILEN_TEXT.emailHinweis}`)
  })
})
