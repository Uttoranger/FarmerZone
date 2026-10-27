/**
 * Auskunft als Export (Register N36, Nachtlauf Nr. 190) — die reinen
 * Funktionen je Art (src/lib/auskunft.ts).
 *
 * Beweist:
 *  - Hof: alle Teile der Freigabe stehen in der Datei, die Bestellungen als
 *    Verkäufer tragen KEINE Daten der Kundschaft (Name, Adresse, Telefon,
 *    Notiz) — Gegenprobe: die erfundene Kundin steht in der Eingabe;
 *  - Kundschaft: nur Zeilen genau dieser Adresse (Groß-/Kleinschreibung egal);
 *    eine erfundene zweite Kundin taucht nicht auf, auch wenn die Abfrage sie
 *    fälschlich lieferte; Sitzungen ohne IP;
 *  - Geld als Text mit zwei Stellen, Datum als ISO-Text; Dateiname ohne
 *    Adresse und ohne Namen.
 */
import { describe, expect, it } from 'vitest'
import { Decimal } from '@prisma/client/runtime/index-browser'
import { auskunftDateiname, auskunftHof, auskunftKundin, type AuskunftHofEingabe, type AuskunftKundinEingabe } from '@/lib/auskunft'

const JETZT = new Date('2026-10-27T10:00:00.000Z')
const T = new Date('2026-10-01T08:00:00.000Z')

const hofEingabe = (): AuskunftHofEingabe => ({
  konto: { id: 'u1', email: 'hof-am-bach@example.com', name: 'Erika Musterfrau', phone: '+43 660 0000000', emailVerified: true, createdAt: T },
  hof: {
    id: 'f1', slug: 'hof-am-bach', name: 'Hof am Bach', ownerName: 'Erika Musterfrau', description: 'Eier und Honig', tagline: null, aboutText: null,
    address: 'Teststraße 1', postalCode: '8700', city: 'Teststadt', country: 'AT', phone: '+43 660 0000000', email: 'hof-am-bach@example.com',
    betriebsnummer: null, createdAt: T, approvedAt: T, archivedAt: null, geschlossenAm: null,
  },
  produkte: [{ id: 'p1', name: 'Eier', description: null, price: new Decimal('3.5'), unit: 'STUECK', stock: 10, isAvailable: true, createdAt: T }],
  abholzeiten: [{ dayOfWeek: 5, startTime: '15:00', endTime: '18:00', isActive: true }],
  beitraege: [{ id: 'b1', title: 'Frische Eier', body: 'Heute frisch', publishedAt: T, createdAt: T }],
  postfach: [{ id: 'u-1', createdAt: T, nachrichten: [{ vonFarmId: 'f1', text: 'Hallo Team', art: 'NORMAL', createdAt: T }, { vonFarmId: null, text: 'Hallo Hof', art: 'NORMAL', createdAt: T }] }],
  meldungen: [{ id: 'm1', art: 'FEHLER', text: 'Knopf geht nicht', status: 'NEU', createdAt: T }],
  bestellungen: [
    {
      id: 'o1', orderNumber: 'HB-2610-A1B2', status: 'PICKED_UP', paymentMethod: 'ONLINE', paymentStatus: 'PAID', totalAmount: new Decimal('7'), createdAt: T, pickupDate: T,
      items: [{ productName: 'Eier', quantity: 2, unitPrice: new Decimal('3.5'), totalPrice: new Decimal('7') }],
      // Was die Abfrage NIE liefern soll — hier trotzdem, als Gegenprobe für die Funktion.
      ...({ customerName: 'Mia Musterkundin', customerEmail: 'mia@example.com', customerPhone: '+43 664 0000000', customerNote: 'Bitte klingeln' } as object),
    },
  ],
})

describe('auskunftHof', () => {
  it('enthält Konto, Hof, Produkte, Abholzeiten, Beiträge, Postfach, Meldungen und Bestellungen', () => {
    const d = auskunftHof(hofEingabe(), JETZT)
    expect(Object.keys(d)).toEqual(['art', 'version', 'erstelltAm', 'konto', 'hof', 'produkte', 'abholzeiten', 'beitraege', 'postfach', 'meldungen', 'bestellungen'])
    expect(d.produkte[0].price).toBe('3.50')
    expect(d.hof.createdAt).toBe(T.toISOString())
    expect(d.postfach[0].nachrichten.map((n) => n.von)).toEqual(['hof', 'team'])
    expect(d.bestellungen[0]).toMatchObject({ orderNumber: 'HB-2610-A1B2', totalAmount: '7.00', positionen: [{ productName: 'Eier', quantity: 2, unitPrice: '3.50', totalPrice: '7.00' }] })
  })

  it('die Bestellungen als Verkäufer tragen keine Daten der Kundschaft — auch wenn sie in der Eingabe stünden', () => {
    const text = JSON.stringify(auskunftHof(hofEingabe(), JETZT).bestellungen)
    for (const fremd of ['Mia Musterkundin', 'mia@example.com', '664', 'Bitte klingeln', 'customer']) expect(text).not.toContain(fremd)
    // Gegenprobe: in der Eingabe steht die Kundin wirklich.
    expect(JSON.stringify(hofEingabe().bestellungen)).toContain('mia@example.com')
  })
})

const kundinEingabe = (): AuskunftKundinEingabe => {
  const bestellung = (email: string, name: string, nummer: string) => ({
    id: nummer, orderNumber: nummer, customerEmail: email, customerName: name, customerPhone: '+43 660 0000000', status: 'PAID', paymentMethod: 'ONLINE',
    totalAmount: new Decimal('12.5'), createdAt: T, pickupDate: T, farm: { name: 'Hof am Bach' }, items: [],
  })
  return {
    bestellungen: [bestellung('Mia@Example.com', 'Mia Musterkundin', 'HB-1'), bestellung('lea@example.com', 'Lea Zweitkundin', 'HB-2')],
    abos: [
      { customerEmail: 'mia@example.com', optInEmail: true, optInWhatsApp: false, createdAt: T, farm: { name: 'Hof am Bach' } },
      { customerEmail: 'lea@example.com', optInEmail: true, optInWhatsApp: false, createdAt: T, farm: { name: 'Hof am Berg' } },
    ],
    konto: { email: 'mia@example.com', sitzungen: [{ createdAt: T, expiresAt: JETZT, userAgent: 'Firefox' }] },
  }
}

describe('auskunftKundin', () => {
  it('nur genau diese Adresse: Bestellungen, Abos, Sitzungen ohne IP', () => {
    const d = auskunftKundin('mia@example.com', kundinEingabe(), JETZT)
    expect(d.bestellungen.map((b) => b.orderNumber)).toEqual(['HB-1'])
    expect(d.bestellungen[0].totalAmount).toBe('12.50')
    expect(d.abos.map((a) => a.hof)).toEqual(['Hof am Bach'])
    expect(d.sitzungen).toEqual([{ createdAt: T.toISOString(), expiresAt: JETZT.toISOString(), userAgent: 'Firefox' }])
    expect(JSON.stringify(d)).not.toContain('ipAddress')
  })

  it('keine Daten der erfundenen zweiten Kundin — Gegenprobe: sie stand in der Eingabe', () => {
    const text = JSON.stringify(auskunftKundin('mia@example.com', kundinEingabe(), JETZT))
    for (const fremd of ['lea@example.com', 'Lea Zweitkundin', 'HB-2', 'Hof am Berg']) expect(text).not.toContain(fremd)
    expect(JSON.stringify(auskunftKundin('lea@example.com', kundinEingabe(), JETZT))).toContain('Lea Zweitkundin')
  })

  it('ein Konto mit anderer Adresse gibt keine Sitzungen her', () => {
    expect(auskunftKundin('lea@example.com', kundinEingabe(), JETZT).sitzungen).toEqual([])
  })
})

describe('auskunftDateiname', () => {
  it('ohne Adresse und ohne Namen', () => {
    expect(auskunftDateiname('hof', 'f1', JETZT)).toBe('auskunft-hof-f1-2026-10-27.json')
    expect(auskunftDateiname('kundschaft', null, JETZT)).toBe('auskunft-kundschaft-2026-10-27.json')
  })
})
