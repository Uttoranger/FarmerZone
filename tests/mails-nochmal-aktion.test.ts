/**
 * „Nochmal schicken“, „Alle nochmal schicken“ und die Vorschau (Register N27,
 * N20, S17, E7; Nr. 167; src/server/actions/betrieb.ts,
 * src/server/mail-arten/vorschau.ts).
 *
 * Beweist mit gemockter Datenbank, je mit Gegenprobe:
 *  - ohne frische Bestätigung geschieht nichts (kein Lesen, kein Einstellen);
 *  - erlaubte Art → EIN neuer Auftrag mit derselben Art und demselben Bezug,
 *    Weg Wichtig, `ausloeser: 'support'`, `nochmalVon` auf die ursprüngliche,
 *    Schlüssel `nochmal:<id>:<n>`; auf eine Nochmal-Zeile zeigt er auf die
 *    ursprüngliche;
 *  - Art aus NOCHMAL_NIE → abgelehnt, auch per direktem Aufruf; das 4. Mal in
 *    24 Stunden → abgelehnt; unpassender Stand → abgelehnt; eine wartende Mail
 *    → abgelehnt; eine Adresse in der Eingabe → ungültig (kein Feld dafür);
 *  - Bar-Link: neuer Hash nur, wenn der gelesene noch steht und die Bestellung
 *    unbestätigt ist; die Mail bekommt den Token, dessen Hash gespeichert ist;
 *    kein Auftrag in der Warteschlange (der Token steht nie in MailAuftrag);
 *  - „Alle nochmal schicken“: je Mail dieselben Regeln, ein Einstellen, nie der
 *    Bar-Link;
 *  - Vorschau: Admin-Recht, nur erlaubte Arten, Links unkenntlich, nichts
 *    eingestellt oder verschickt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const db = vi.hoisted(() => ({
  mailAuftrag: { findUnique: vi.fn(), count: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  order: { findUnique: vi.fn(), updateMany: vi.fn() },
  farm: { findUnique: vi.fn() },
}))
const wache = vi.hoisted(() => ({ verlangeAdminAktion: vi.fn(), verlangeFrischeBestaetigung: vi.fn() }))
const schlange = vi.hoisted(() => ({ stelleMailEin: vi.fn(async () => 1), arbeiteWarteschlange: vi.fn() }))
const email = vi.hoisted(() => ({ sendOnsiteConfirmation: vi.fn(async () => undefined), onsiteConfirmationInhalt: vi.fn() }))
const mailBestellung = vi.hoisted(() => ({ ladeBestellungFuerMail: vi.fn(async () => ({ id: 'bestellung_1', orderNumber: 'HM-2611-A4F2' })) }))

vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/server/admin-wache', () => wache)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/server/betrieb', () => ({ beginneMessung: vi.fn(), messeUndPruefe: vi.fn() }))
vi.mock('@/server/mail-warteschlange', () => schlange)
vi.mock('@/lib/email', () => email)
vi.mock('@/server/mail-arten/bestellung', async (original) => ({ ...(await original<typeof import('@/server/mail-arten/bestellung')>()), ...mailBestellung }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))

import { FRISCH_FEHLER } from '@/lib/admin-anmeldung'
import { ALLE_MAILS_TEXT, MAIL_TEXT } from '@/lib/betrieb-mails'
import { barTokenHash } from '@/lib/bar-bestaetigung'
import { schickeArtNochmalAction, schickeMailNochmalAction, zeigeMailVorschauAction } from '@/server/actions/betrieb'
import { baueMailVorschau } from '@/server/mail-arten/vorschau'

const ID = 'cmfauftrag0000000000001a'
const ADRESSE = 'erfundene.kundin@example.at'

const zeile = (teil: Record<string, unknown> = {}) => ({
  id: ID,
  art: 'abholbereit',
  status: 'gesendet',
  bestellungId: 'bestellung_1',
  farmId: 'hof_1',
  nochmalVon: null,
  bezug: { orderId: 'bestellung_1' },
  ...teil,
})
const bestellung = (teil: Record<string, unknown> = {}) => ({
  id: 'bestellung_1',
  orderNumber: 'HM-2611-A4F2',
  status: 'READY',
  paymentMethod: 'ONLINE',
  paymentStatus: 'PAID',
  cancelReason: null,
  createdAt: new Date(Date.now() - 3_600_000),
  pickupDate: new Date(Date.now() + 86_400_000),
  pickupTimeStart: '15:00',
  customerEmail: ADRESSE,
  farm: { name: 'Testhof A', email: 'hof@example.at', archivedAt: null },
  confirmationToken: barTokenHash('alterTokenAlterTokenAlterToken12'),
  ...teil,
})

beforeEach(() => {
  vi.clearAllMocks()
  wache.verlangeFrischeBestaetigung.mockResolvedValue({ ok: true, userId: 'admin_1', sitzungId: 's' })
  wache.verlangeAdminAktion.mockResolvedValue({ ok: true, userId: 'admin_1' })
  db.mailAuftrag.findUnique.mockResolvedValue(zeile())
  db.mailAuftrag.count.mockResolvedValue(0)
  db.order.findUnique.mockResolvedValue(bestellung())
  db.order.updateMany.mockResolvedValue({ count: 1 })
  schlange.stelleMailEin.mockResolvedValue(1)
})

describe('Nochmal schicken', () => {
  it('ohne frische Bestätigung: der Satz der Wache, nichts gelesen, nichts eingestellt', async () => {
    wache.verlangeFrischeBestaetigung.mockResolvedValue({ error: FRISCH_FEHLER })
    expect(await schickeMailNochmalAction({ id: ID })).toEqual({ error: FRISCH_FEHLER })
    expect(db.mailAuftrag.findUnique).not.toHaveBeenCalled()
    expect(schlange.stelleMailEin).not.toHaveBeenCalled()
  })

  it('erlaubte Art: ein neuer Auftrag — dieselbe Art, derselbe Bezug, Wichtig, vom Support, nochmalVon, Schlüssel nochmal:<id>:1', async () => {
    expect(await schickeMailNochmalAction({ id: ID })).toEqual({ ok: true, satz: ALLE_MAILS_TEXT.unterwegs })
    expect(schlange.stelleMailEin).toHaveBeenCalledTimes(1)
    expect(schlange.stelleMailEin).toHaveBeenCalledWith({
      art: 'abholbereit',
      vorrang: 1,
      schluessel: `nochmal:${ID}:1`,
      bezug: { orderId: 'bestellung_1' },
      bestellungId: 'bestellung_1',
      farmId: 'hof_1',
      ausloeser: 'support',
      nochmalVon: ID,
    })
    // Gezählt wird über nochmalVon in 24 Stunden.
    expect(db.mailAuftrag.count.mock.calls[0][0].where).toMatchObject({ nochmalVon: ID })
  })

  it('auf eine Nochmal-Zeile: zählt und verweist auf die ursprüngliche Mail', async () => {
    db.mailAuftrag.findUnique.mockResolvedValue(zeile({ id: 'cmfauftrag0000000000002b', nochmalVon: ID }))
    db.mailAuftrag.count.mockResolvedValue(1)
    await schickeMailNochmalAction({ id: 'cmfauftrag0000000000002b' })
    expect(schlange.stelleMailEin).toHaveBeenCalledWith(expect.objectContaining({ nochmalVon: ID, schluessel: `nochmal:${ID}:2` }))
  })

  it('Art aus NOCHMAL_NIE: abgelehnt, auch per direktem Aufruf — Codes, Beiträge, Betreiber', async () => {
    for (const [art, satz] of [
      ['anmeldecode', ALLE_MAILS_TEXT.nieCode],
      ['passwort-link', ALLE_MAILS_TEXT.nieCode],
      ['beitrag', ALLE_MAILS_TEXT.nieEinwilligung],
      ['admin-sicherheit', ALLE_MAILS_TEXT.nieSonst],
    ] as const) {
      db.mailAuftrag.findUnique.mockResolvedValue(zeile({ art }))
      expect(await schickeMailNochmalAction({ id: ID })).toEqual({ error: satz })
    }
    expect(schlange.stelleMailEin).not.toHaveBeenCalled()
  })

  it('das 4. Mal in 24 Stunden: abgelehnt — Gegenprobe das 3. geht', async () => {
    db.mailAuftrag.count.mockResolvedValue(3)
    expect(await schickeMailNochmalAction({ id: ID })).toEqual({ error: ALLE_MAILS_TEXT.grenze })
    expect(schlange.stelleMailEin).not.toHaveBeenCalled()
    db.mailAuftrag.count.mockResolvedValue(2)
    expect(await schickeMailNochmalAction({ id: ID })).toMatchObject({ ok: true })
    expect(schlange.stelleMailEin).toHaveBeenCalledWith(expect.objectContaining({ schluessel: `nochmal:${ID}:3` }))
  })

  it('unpassender Stand (abholbereit, aber storniert), wartende Mail, gelöschte Bestellung: abgelehnt', async () => {
    db.order.findUnique.mockResolvedValue(bestellung({ status: 'CANCELLED' }))
    expect(await schickeMailNochmalAction({ id: ID })).toMatchObject({ error: expect.stringContaining('Passt nicht mehr') })
    db.order.findUnique.mockResolvedValue(null)
    expect(await schickeMailNochmalAction({ id: ID })).toEqual({ error: 'Die Bestellung gibt es nicht mehr.' })
    db.order.findUnique.mockResolvedValue(bestellung())
    db.mailAuftrag.findUnique.mockResolvedValue(zeile({ status: 'offen' }))
    expect(await schickeMailNochmalAction({ id: ID })).toEqual({ error: ALLE_MAILS_TEXT.standPasstNicht })
    expect(schlange.stelleMailEin).not.toHaveBeenCalled()
  })

  it('keine andere Adresse: eine Eingabe mit Adresse oder Zusatzfeld ist ungültig', async () => {
    for (const eingabe of [{ id: ID, an: 'fremd@example.at' }, { id: ADRESSE }, { art: 'abholbereit' }, null]) {
      expect(await schickeMailNochmalAction(eingabe)).toEqual({ error: MAIL_TEXT.eingabeUngueltig })
    }
    expect(db.mailAuftrag.findUnique).not.toHaveBeenCalled()
  })

  it('zwei Klicks zugleich: derselbe Schlüssel, der zweite fällt weg — kein zweiter Versand', async () => {
    schlange.stelleMailEin.mockResolvedValue(0)
    expect(await schickeMailNochmalAction({ id: ID })).toEqual({ ok: true, satz: MAIL_TEXT.nichtsGeaendert })
  })
})

describe('Bar-Link nochmal (S17, E7)', () => {
  const offen = bestellung({ status: 'PENDING_CONFIRMATION', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING' })

  beforeEach(() => {
    db.mailAuftrag.findUnique.mockResolvedValue(zeile({ art: 'bar-bestaetigungslink', bezug: null, farmId: null }))
    db.order.findUnique.mockResolvedValue(offen)
  })

  it('neuer Hash nur bei gelesenem Wert und unbestätigt; die Mail trägt den Token zu genau diesem Hash; nichts in der Warteschlange', async () => {
    expect(await schickeMailNochmalAction({ id: ID })).toEqual({ ok: true, satz: ALLE_MAILS_TEXT.unterwegs })
    const { where, data } = db.order.updateMany.mock.calls[0][0]
    expect(where).toEqual({ id: 'bestellung_1', status: 'PENDING_CONFIRMATION', paymentMethod: { not: 'ONLINE' }, confirmationToken: offen.confirmationToken })
    expect(Object.keys(data)).toEqual(['confirmationToken'])
    const [, token, protokoll] = email.sendOnsiteConfirmation.mock.calls[0] as unknown as [unknown, string, { nochmalVon: string }]
    expect(data.confirmationToken).toBe(barTokenHash(token))
    expect(data.confirmationToken).not.toBe(offen.confirmationToken)
    expect(protokoll).toEqual({ nochmalVon: ID })
    expect(schlange.stelleMailEin).not.toHaveBeenCalled()
  })

  it('Gegenprobe: parallel bestätigt (kein Treffer beim Wechsel) → keine Mail', async () => {
    db.order.updateMany.mockResolvedValue({ count: 0 })
    expect(await schickeMailNochmalAction({ id: ID })).toEqual({ ok: true, satz: MAIL_TEXT.nichtsGeaendert })
    expect(email.sendOnsiteConfirmation).not.toHaveBeenCalled()
  })

  it('bestätigte oder verfallene Barbestellung: abgelehnt, kein neuer Token', async () => {
    db.order.findUnique.mockResolvedValue({ ...offen, status: 'CONFIRMED' })
    expect(await schickeMailNochmalAction({ id: ID })).toMatchObject({ error: expect.any(String) })
    db.order.findUnique.mockResolvedValue({ ...offen, createdAt: new Date(Date.now() - 5 * 86_400_000), pickupDate: new Date(Date.now() - 3 * 86_400_000) })
    expect(await schickeMailNochmalAction({ id: ID })).toEqual({ error: 'Die Frist zum Bestätigen ist vorbei.' })
    expect(db.order.updateMany).not.toHaveBeenCalled()
    expect(email.sendOnsiteConfirmation).not.toHaveBeenCalled()
  })
})

describe('Alle nochmal schicken', () => {
  it('je Mail dieselben Regeln, EIN Einstellen; gesperrte (Grenze) fallen weg', async () => {
    db.mailAuftrag.findMany.mockResolvedValue([zeile({ status: 'gescheitert' }), zeile({ id: 'cmfauftrag0000000000003c', status: 'gescheitert' })])
    db.mailAuftrag.count.mockResolvedValueOnce(0).mockResolvedValueOnce(3)
    expect(await schickeArtNochmalAction({ art: 'abholbereit' })).toEqual({ ok: true, satz: ALLE_MAILS_TEXT.unterwegs })
    expect(schlange.stelleMailEin).toHaveBeenCalledTimes(1)
    const auftraege = (schlange.stelleMailEin.mock.calls[0] as unknown as [Array<{ nochmalVon: string }>])[0]
    expect(auftraege.map((a) => a.nochmalVon)).toEqual([ID])
    // Nur gescheiterte, wichtige Mails dieser Art aus „Braucht dich“.
    expect(JSON.stringify(db.mailAuftrag.findMany.mock.calls[0][0].where)).toContain('"status":"gescheitert"')
  })

  it('Gegenprobe: Codes, Beiträge und der Bar-Link gehen nie auf einmal', async () => {
    for (const art of ['anmeldecode', 'beitrag', 'bar-bestaetigungslink']) expect(await schickeArtNochmalAction({ art })).toMatchObject({ error: expect.any(String) })
    expect(db.mailAuftrag.findMany).not.toHaveBeenCalled()
  })
})

describe('Vorschau', () => {
  it('nur mit Admin-Recht; Codes nie; nichts eingestellt oder verschickt', async () => {
    wache.verlangeAdminAktion.mockResolvedValue({ error: 'Nur für den Betreiber.' })
    expect(await zeigeMailVorschauAction({ id: ID })).toEqual({ error: 'Nur für den Betreiber.' })
    wache.verlangeAdminAktion.mockResolvedValue({ ok: true, userId: 'admin_1' })
    db.mailAuftrag.findUnique.mockResolvedValue({ art: 'anmeldecode', bezug: null, bestellungId: null })
    expect(await zeigeMailVorschauAction({ id: ID })).toEqual({ error: ALLE_MAILS_TEXT.vorschauNie })
    expect(schlange.stelleMailEin).not.toHaveBeenCalled()
    expect(email.sendOnsiteConfirmation).not.toHaveBeenCalled()
  })

  it('baueMailVorschau: der Renderer mit heutigem Stand — kein Link mit Signatur oder Token, keine Adresse im Ergebnis', async () => {
    const renderer = {
      abholbereit: vi.fn(async () => ({
        an: ADRESSE,
        betreff: 'Deine Bestellung ist bereit',
        html: `<p>Hallo</p><a href="https://agrilo.at/orders/bestellung_1?sig=abcdef0123456789">Ansehen</a><p>${ADRESSE}</p>`,
      })),
    }
    const v = await baueMailVorschau({ art: 'abholbereit', bezug: { orderId: 'bestellung_1' }, bestellungId: 'bestellung_1' }, renderer)
    expect(v).toEqual({ betreff: 'Deine Bestellung ist bereit', html: '<p>Hallo</p><span>[Link]</span><p>e•••@example.at</p>' })
    expect(JSON.stringify(v)).not.toContain('sig=')
    expect(JSON.stringify(v)).not.toContain(ADRESSE)
  })

  it('Gegenprobe: verworfen bleibt verworfen, eine Art aus NOCHMAL_NIE wird gar nicht erst gebaut', async () => {
    const renderer = { abholbereit: vi.fn(async () => ({ verworfen: 'bestellung_fehlt' })), beitrag: vi.fn() }
    expect(await baueMailVorschau({ art: 'abholbereit', bezug: { orderId: 'b' }, bestellungId: 'b' }, renderer)).toEqual({ verworfen: 'bestellung_fehlt' })
    expect(await baueMailVorschau({ art: 'beitrag', bezug: { postId: 'p', aboId: 'a' }, bestellungId: null }, renderer)).toEqual({ nie: true })
    expect(renderer.beitrag).not.toHaveBeenCalled()
  })
})
