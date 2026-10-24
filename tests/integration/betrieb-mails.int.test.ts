/**
 * Admin › Betrieb › E-Mails gegen ein ECHTES Postgres (Nr. 161; Register N26,
 * N27; src/server/queries/mails.ts).
 *
 * Beweist, je mit Gegenprobe:
 *  - Suche per Bestellnummer: die Bestellung und alle Aufträge mit ihrer
 *    `bestellungId` — eine andere Nummer findet nichts;
 *  - Suche per Adresse: exakt über `customerEmail` und den Fingerabdruck,
 *    auch eine Mail ohne Bestellung (Anmeldecode); andere Groß/Kleinschreibung
 *    trifft (das Schema schreibt klein), eine Teiladresse nie (das Schema
 *    lässt sie gar nicht durch), eine Adresse mit „_“ als Platzhalter nie;
 *  - die Rohabfragen laufen auf Postgres: Zahlen je Art (FILTER, AVG als
 *    Zahl), Verlauf je UTC-Tag (to_char), Warteschlange (ältester fälliger
 *    Auftrag), Probleme;
 *  - „Alle n jetzt schicken“ und „Alle n verwerfen“ treffen nur, was in
 *    „Braucht dich“ steht — ein frischer offener Auftrag derselben Art und
 *    einer, der vor mehr als 24 Stunden gescheitert ist, bleiben unverändert
 *    (Nachbesserung Runde 1).
 *
 * Daten: Höfe, Bestellungen und Aufträge mit `int-`, Adressen @example.com
 * (erfunden); eigene Art `int-161-…` für die Zählung je Art, damit fremde
 * Zeilen der geteilten Test-Datenbank nicht mitzählen. Danach weg.
 */
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { empfaengerFingerabdruck } from '@/lib/mail-empfaenger'
import { mailSucheAus } from '@/schemas/betrieb-mails'
import { MAIL_TEXT } from '@/lib/betrieb-mails'
import { ladeArtZahlen, ladeMailVerlauf, ladeProbleme, ladeWarteschlange, problemBedingung, sucheMails, zaehleProbleme } from '@/server/queries/mails'
import { schickeMailJetztAction, verwirfMailAction } from '@/server/actions/betrieb'
import { erstelleHof, intKennung, raeumeAuf } from './setup/basis'

vi.mock('server-only', () => ({}))
// Die Aktionen: Wache bestätigt frisch, der Worker nach der Antwort läuft hier nicht — geprüft wird nur die eine Anweisung.
vi.mock('@/server/admin-wache', () => ({
  verlangeAdminAktion: vi.fn(async () => ({ ok: true, userId: 'int-admin' })),
  verlangeFrischeBestaetigung: vi.fn(async () => ({ ok: true, userId: 'int-admin', sitzungId: 'int-sitzung' })),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))

async function raeumeMailsAuf(): Promise<void> {
  await prisma.mailAuftrag.deleteMany({ where: { OR: [{ schluessel: { startsWith: 'int-' } }, { bestellungId: { startsWith: 'int-' } }, { art: { startsWith: 'int-161-' } }] } })
}

afterEach(async () => {
  await raeumeMailsAuf()
  await raeumeAuf()
})

afterAll(async () => {
  await raeumeMailsAuf()
})

async function bestellung(farmId: string, email: string, nummer: string) {
  return prisma.order.create({
    data: {
      id: intKennung('bestellung'),
      orderNumber: nummer,
      farmId,
      customerEmail: email,
      customerName: 'Erika Musterfrau',
      customerPhone: '+43 660 0000000',
      totalAmount: '20.00',
      pickupDate: new Date(Date.now() + 86_400_000),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      status: 'PAID',
    },
  })
}

async function auftrag(daten: { art: string; vorrang?: number; status?: string; bestellungId?: string | null; empfaengerHash?: string | null; versuche?: number; fehlerCode?: string | null; gesendet?: boolean; zugestellt?: boolean; abgelehnt?: boolean; naechsterVersuchAm?: Date }) {
  const jetzt = new Date()
  return prisma.mailAuftrag.create({
    data: {
      art: daten.art,
      vorrang: daten.vorrang ?? 1,
      schluessel: intKennung('mail'),
      status: daten.status ?? (daten.gesendet ? 'gesendet' : 'offen'),
      bestellungId: daten.bestellungId ?? null,
      empfaengerHash: daten.empfaengerHash ?? null,
      versuche: daten.versuche ?? 0,
      fehlerCode: daten.fehlerCode ?? null,
      erstelltAm: new Date(jetzt.getTime() - 20_000),
      gesendetAm: daten.gesendet ? jetzt : null,
      zugestelltAm: daten.zugestellt ? jetzt : null,
      bounceAm: daten.abgelehnt ? jetzt : null,
      naechsterVersuchAm: daten.naechsterVersuchAm ?? jetzt,
    },
  })
}

describe('Suche', () => {
  it('Bestellnummer: die Bestellung und alle ihre Aufträge — eine andere Nummer nichts', async () => {
    const { farm } = await erstelleHof()
    const email = `${intKennung('kundin')}@example.com`
    const nummer = `I${process.pid % 100_000}-1611-A4F2`
    const b = await bestellung(farm.id, email, nummer)
    await auftrag({ art: 'bestellung-bestaetigung', bestellungId: b.id, gesendet: true, zugestellt: true, empfaengerHash: empfaengerFingerabdruck(email) })
    await auftrag({ art: 'bestellung-bezahlt-hof', bestellungId: b.id, gesendet: true })

    const suche = mailSucheAus(nummer.toLowerCase())
    if (suche.art !== 'bestellung') throw new Error('Bestellnummer erwartet')
    const treffer = await sucheMails(suche, new Date())
    expect(treffer.bestellungen.map((x) => x.id)).toEqual([b.id])
    expect(treffer.mails.map((m) => m.art).sort()).toEqual(['bestellung-bestaetigung', 'bestellung-bezahlt-hof'])
    // Bezug und Fingerabdruck verlassen die Abfrage nie.
    expect(Object.keys(treffer.mails[0])).not.toContain('empfaengerHash')

    expect(await sucheMails({ art: 'bestellung', nummer: 'ZZ-0000-0000' }, new Date())).toEqual({ bestellungen: [], mails: [] })
  })

  it('Adresse: exakt über Bestellung und Fingerabdruck, auch ohne Bestellung; Groß/Klein trifft, Teil und Platzhalter nie', async () => {
    const { farm } = await erstelleHof()
    const email = `${intKennung('kundin')}@example.com`
    const b = await bestellung(farm.id, email, `J${process.pid % 100_000}-1611-B4F2`)
    await auftrag({ art: 'bestellung-bestaetigung', bestellungId: b.id, gesendet: true, empfaengerHash: empfaengerFingerabdruck(email) })
    await auftrag({ art: 'anmeldecode', vorrang: 0, gesendet: true, empfaengerHash: empfaengerFingerabdruck(email) })

    const gross = mailSucheAus(email.toUpperCase())
    if (gross.art !== 'adresse') throw new Error('Adresse erwartet')
    const treffer = await sucheMails(gross, new Date())
    expect(treffer.bestellungen.map((x) => x.id)).toEqual([b.id])
    expect(treffer.mails.map((m) => [m.art, m.bestellungId])).toEqual([
      ['bestellung-bestaetigung', b.id],
      ['anmeldecode', null],
    ])

    // Teiladresse: das Schema lässt sie nicht durch.
    expect(mailSucheAus(email.slice(0, email.indexOf('@') + 1)).art).toBe('ungueltig')
    // „_“ ist in LIKE ein Platzhalter — hier eine eigene Adresse ohne Treffer.
    const platzhalter = email.replace(/^int-/, 'int_')
    expect(await sucheMails({ art: 'adresse', adresse: platzhalter }, new Date())).toEqual({ bestellungen: [], mails: [] })
  })
})

describe('Rohabfragen auf Postgres', () => {
  it('Zahlen je Art: gesendet, zugestellt, gescheitert, abgelehnt, Wartezeit als Zahl', async () => {
    const art = `int-161-${process.pid}`
    await auftrag({ art, gesendet: true, zugestellt: true })
    await auftrag({ art, gesendet: true, abgelehnt: true })
    await auftrag({ art, status: 'gescheitert', fehlerCode: 'validation_error' })

    const zeile = (await ladeArtZahlen(new Date())).find((z) => z.art === art)
    expect(zeile).toMatchObject({ vorrang: 1, gesendet: 2, zugestellt: 1, gescheitert: 1, abgelehnt: 1, spam: 0 })
    expect(typeof zeile?.wartezeitMs).toBe('number')
    expect(zeile!.wartezeitMs!).toBeGreaterThan(10_000)
  })

  it('Verlauf je UTC-Tag, Probleme und Warteschlange laufen — mit den eigenen Zeilen darin', async () => {
    const art = `int-161-${process.pid}`
    const vor20Min = new Date(Date.now() - 20 * 60_000)
    await auftrag({ art, gesendet: true })
    const wartet = await auftrag({ art, versuche: 2, fehlerCode: 'rate_limit_exceeded', naechsterVersuchAm: vor20Min })
    const jetzt = new Date()

    const heute = jetzt.toISOString().slice(0, 10)
    const tag = (await ladeMailVerlauf(jetzt)).find((t) => t.tag === heute)
    expect(tag?.gesendet).toBeGreaterThanOrEqual(1)

    expect((await ladeProbleme(jetzt)).map((p) => p.id)).toContain(wartet.id)

    const schlange = await ladeWarteschlange(jetzt, { heute: 0, imZeitraum: 0 })
    expect(schlange.wichtig).toBeGreaterThanOrEqual(1)
    expect(schlange.faelligSeit).toBeInstanceOf(Date)
    expect(schlange.faelligSeit!.getTime()).toBeLessThanOrEqual(vor20Min.getTime())
  })
})

describe('Alle einer Art: nur, was in „Braucht dich“ steht', () => {
  const vor2Tagen = (): Date => new Date(Date.now() - 2 * 86_400_000)

  /** Je ein Auftrag in „Braucht dich“ (gescheitert vor 1 h, wartet nach Fehler) und zwei Gegenproben derselben Art. */
  async function lage(art: string) {
    const gescheitert = await auftrag({ art, status: 'gescheitert', versuche: 5, fehlerCode: 'rate_limit_exceeded', naechsterVersuchAm: new Date(Date.now() - 3_600_000) })
    const wartetNachFehler = await auftrag({ art, versuche: 1, fehlerCode: 'rate_limit_exceeded', naechsterVersuchAm: new Date(Date.now() + 60_000) })
    const frisch = await auftrag({ art })
    const alt = await auftrag({ art, status: 'gescheitert', versuche: 5, fehlerCode: 'rate_limit_exceeded', naechsterVersuchAm: vor2Tagen() })
    return { gescheitert, wartetNachFehler, frisch, alt }
  }

  /** Was in der geteilten Test-Datenbank schon von dieser Art in „Braucht dich“ liegt (sollte 0 sein) — die Zahl im Satz zählt es mit. */
  async function schonDa(art: string): Promise<number> {
    return prisma.mailAuftrag.count({ where: { AND: [{ art }, problemBedingung(new Date())], status: { in: ['offen', 'gescheitert'] } } })
  }

  async function stand(id: string) {
    return prisma.mailAuftrag.findUniqueOrThrow({ where: { id }, select: { status: true, versuche: true, naechsterVersuchAm: true } })
  }

  it('Jetzt schicken: die zwei aus „Braucht dich“ — der frische und der alte bleiben, wie sie sind', async () => {
    // Eine echte Art (das Schema lässt nur MAIL_ARTEN durch), die sonst kein Integrationstest einstellt.
    const art = 'erstattung-offen'
    const vorherZahl = await schonDa(art)
    const l = await lage(art)
    const vorherFrisch = await stand(l.frisch.id)
    const vorherAlt = await stand(l.alt.id)

    expect(await schickeMailJetztAction({ art })).toEqual({ ok: true, satz: MAIL_TEXT.geschickt(2 + vorherZahl) })
    expect(await stand(l.gescheitert.id)).toMatchObject({ status: 'offen', versuche: 0 })
    expect(await stand(l.wartetNachFehler.id)).toMatchObject({ status: 'offen', versuche: 0 })
    // Gegenproben: unverändert.
    expect(await stand(l.frisch.id)).toEqual(vorherFrisch)
    expect(await stand(l.alt.id)).toEqual(vorherAlt)
  })

  it('Verwerfen: die zwei aus „Braucht dich“ — der frische und der alte bleiben, wie sie sind', async () => {
    const art = 'zahlung-zu-spaet'
    const vorherZahl = await schonDa(art)
    const l = await lage(art)

    expect(await verwirfMailAction({ art })).toEqual({ ok: true, satz: MAIL_TEXT.verworfen(2 + vorherZahl) })
    expect((await stand(l.gescheitert.id)).status).toBe('verworfen')
    expect((await stand(l.wartetNachFehler.id)).status).toBe('verworfen')
    // Gegenproben: der frische wartet weiter, der alte bleibt gescheitert.
    expect((await stand(l.frisch.id)).status).toBe('offen')
    expect((await stand(l.alt.id)).status).toBe('gescheitert')
  })

  it('zaehleProbleme zählt mit derselben Bedingung, ohne Obergrenze', async () => {
    const art = `int-161-${process.pid}-zahl`
    const l = await lage(art)
    const jetzt = new Date()
    const ids = (await ladeProbleme(jetzt)).map((p) => p.id)
    expect(ids).toEqual(expect.arrayContaining([l.gescheitert.id, l.wartetNachFehler.id]))
    expect(ids).not.toContain(l.frisch.id)
    expect(ids).not.toContain(l.alt.id)
    expect(await zaehleProbleme(jetzt)).toBeGreaterThanOrEqual(2)
  })
})
