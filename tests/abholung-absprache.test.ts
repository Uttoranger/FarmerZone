/**
 * Abholung nach Absprache (Register N47, Nr. 257) — die reine Regel und ihre
 * Orte, soweit ohne Datenbank prüfbar:
 *  - brauchtAbsprache / korbBrauchtAbsprache / abspracheOffen / abspracheMailSatz
 *    (src/lib/abholhinweise.ts) und abspracheKontakt (src/lib/heute.ts): rein, ohne Mock.
 *  - Bestätigungsmail (baueOrderConfirmation): der Satz je Fall von „Antwort an“,
 *    ohne Absprache kein Satz; die Mail mit dem Bestätigungslink bleibt ohne Satz.
 *  - Packliste: Kontakt nur an Zeilen mit Absprache.
 *  - Hof-Bauteile: Marke und Knöpfe; ohne lesbare Nummer kein „Anrufen“.
 * Kasse und Datenbank: tests/abholung-absprache-kasse.test.ts und
 * tests/integration/abholung-absprache.int.test.ts.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('server-only', () => ({}))
vi.mock('@/server/mail-warteschlange', () => ({ protokolliereSofortMail: vi.fn() }))

import { ABSPRACHE_TEXT, abspracheMailSatz, abspracheOffen, brauchtAbsprache, korbBrauchtAbsprache } from '@/lib/abholhinweise'
import { abspracheKontakt, packliste, type PacklistenBestellung } from '@/lib/heute'
import { AbspracheKnoepfe, AbspracheMarke } from '@/components/heute/absprache'
import type { OrderForHofMail } from '@/lib/email'

let email: typeof import('@/lib/email')

beforeAll(async () => {
  email = await import('@/lib/email')
}, 30_000)

describe('brauchtAbsprache: mindestens eine Position mit „Abholung nach Absprache“', () => {
  it('ja, sobald eine Position den Hinweis trägt — auch neben anderen Hinweisen', () => {
    expect(brauchtAbsprache([[], ['ANHAENGER_NOETIG', 'NACH_ABSPRACHE']])).toBe(true)
  })

  it('nein ohne Position, mit leeren oder fehlenden Hinweisen und mit nur anderen Hinweisen', () => {
    expect(brauchtAbsprache([])).toBe(false)
    expect(brauchtAbsprache([[], null, undefined])).toBe(false)
    expect(brauchtAbsprache([['ANHAENGER_NOETIG', 'FRONTLADER']])).toBe(false)
  })
})

describe('korbBrauchtAbsprache: der Korb der Kasse gegen die IDs vom Server', () => {
  it('ja, wenn eine Korb-Position zu den Absprache-Produkten gehört', () => {
    expect(korbBrauchtAbsprache([{ productId: 'heu' }, { productId: 'stroh' }], ['stroh'])).toBe(true)
  })

  it('nein bei leerem Korb, leerer Liste oder fremden IDs', () => {
    expect(korbBrauchtAbsprache([], ['stroh'])).toBe(false)
    expect(korbBrauchtAbsprache([{ productId: 'heu' }], [])).toBe(false)
    expect(korbBrauchtAbsprache([{ productId: 'heu' }], ['stroh'])).toBe(false)
  })
})

describe('abspracheOffen: nur offene Bestellungen', () => {
  it.each(['PENDING_CONFIRMATION', 'PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY'])('%s mit Absprache: ja', (status) => {
    expect(abspracheOffen(status, true)).toBe(true)
  })

  it.each(['PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP'])('%s: nein, auch mit Absprache', (status) => {
    expect(abspracheOffen(status, true)).toBe(false)
  })

  it('ohne Absprache nie', () => {
    expect(abspracheOffen('PAID', false)).toBe(false)
  })
})

describe('abspracheMailSatz: der Satz folgt „Antwort an“', () => {
  it('mit Antwort-Adresse: „einfach antworten“', () => {
    expect(abspracheMailSatz(true)).toBe('Der Hof stimmt die Abholung mit dir ab. Du kannst einfach auf diese Mail antworten.')
  })

  it('ohne: „meldet sich bei dir“', () => {
    expect(abspracheMailSatz(false)).toBe('Der Hof stimmt die Abholung mit dir ab und meldet sich bei dir.')
  })
})

describe('abspracheKontakt: Kontakt nur bei offener Bestellung mit Absprache', () => {
  const basis = { status: 'PAID', customerPhone: '+43 660 0000000', customerEmail: 'erika@example.org' }

  it('mit Absprache: tel:-Link und E-Mail als Ziele', () => {
    expect(abspracheKontakt({ ...basis, hinweiseJePosition: [['NACH_ABSPRACHE']] })).toEqual({ anrufen: 'tel:+436600000000', email: 'erika@example.org' })
  })

  it('ohne lesbare Nummer: kein tel:-Link, die E-Mail bleibt', () => {
    expect(abspracheKontakt({ ...basis, customerPhone: 'ab 18 Uhr', hinweiseJePosition: [['NACH_ABSPRACHE']] })).toEqual({ anrufen: null, email: 'erika@example.org' })
  })

  it('ohne Absprache oder bei erledigter Bestellung: null', () => {
    expect(abspracheKontakt({ ...basis, hinweiseJePosition: [['FRONTLADER']] })).toBeNull()
    expect(abspracheKontakt({ ...basis, status: 'PICKED_UP', hinweiseJePosition: [['NACH_ABSPRACHE']] })).toBeNull()
  })
})

describe('packliste: Kontakt nur an der Zeile mit Absprache', () => {
  const zeile = (id: string, absprache: PacklistenBestellung['absprache']): PacklistenBestellung => ({
    id,
    customerName: `Kundin ${id}`,
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    paymentMethod: 'ONLINE',
    status: 'PAID',
    items: [{ productName: 'Heu', quantity: 1 }],
    gesamtCents: 1000,
    absprache,
  })

  it('die Zeile ohne Absprache trägt das Feld gar nicht', () => {
    const [mit, ohne] = packliste([zeile('a', { anrufen: 'tel:+436600000000', email: 'a@example.org' }), zeile('b', null)])
    expect(mit.absprache).toEqual({ anrufen: 'tel:+436600000000', email: 'a@example.org' })
    expect('absprache' in ohne).toBe(false)
    expect(JSON.stringify(ohne)).not.toContain('@')
  })
})

describe('Hof-Bauteile: Marke und Knöpfe', () => {
  it('Marke „Abholung absprechen“', () => {
    expect(renderToStaticMarkup(createElement(AbspracheMarke))).toContain(ABSPRACHE_TEXT.marke)
  })

  it('beide Knöpfe mit tel: und mailto:, ohne die Nummer als sichtbaren Text', () => {
    const html = renderToStaticMarkup(createElement(AbspracheKnoepfe, { anrufen: 'tel:+436600000000', email: 'erika@example.org', name: 'Erika B.' }))
    expect(html).toContain('href="tel:+436600000000"')
    expect(html).toContain('href="mailto:erika@example.org"')
    expect(html).toContain('>Anrufen<')
    expect(html).toContain('>Mail schreiben<')
    expect(html.replace(/<[^>]+>/g, ' ')).not.toMatch(/0000000|erika@example\.org/)
  })

  it('ohne lesbare Nummer kein „Anrufen“', () => {
    const html = renderToStaticMarkup(createElement(AbspracheKnoepfe, { anrufen: null, email: 'erika@example.org', name: 'Erika B.' }))
    expect(html).not.toContain('tel:')
    expect(html).not.toContain('Anrufen')
    expect(html).toContain('mailto:erika@example.org')
  })
})

/** Eine Bestellung mit erfundenen Daten; `hinweise` je Position. */
function bestellung(hinweise: string[][], hofEmail = 'hof@example.org', paymentMethod = 'ONLINE'): OrderForHofMail {
  return {
    id: 'order-1',
    orderNumber: 'HT-0210-A4F2',
    customerName: 'Erika Beispiel',
    customerEmail: 'erika@example.org',
    customerPhone: '+43 660 0000000',
    totalAmount: '10.00',
    serviceFeeCents: 0,
    createdAt: new Date('2026-10-05T08:12:00Z'),
    pickupDate: new Date('2026-10-05T12:00:00Z'),
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    paymentMethod,
    farm: {
      id: 'farm-1',
      name: 'Hof Beispiel',
      email: hofEmail,
      ownerName: 'Max Muster',
      address: 'Feldweg 1',
      city: 'Beispieldorf',
      postalCode: '4910',
      phone: '+43 664 0000000',
      slug: 'hof-beispiel',
      owner: { email: 'inhaber@example.org' },
    },
    items: hinweise.map((h, i) => ({
      productName: `Ballen ${i + 1}`,
      quantity: 1,
      unitPrice: '5.00',
      totalPrice: '5.00',
      gebuehrCents: 0,
      product: { unit: 'STUECK', unitSize: null, abholhinweise: h },
    })),
  }
}

const MIT = 'Du kannst einfach auf diese Mail antworten.'
const OHNE = 'und meldet sich bei dir.'

describe('Bestätigungsmail (baueOrderConfirmation): Satz und „Antwort an“ aus einer Stelle', () => {
  it('mit Absprache und Hof-E-Mail: „einfach antworten“ und Antwort an den Hof', async () => {
    const mail = await email.baueOrderConfirmation(bestellung([[], ['NACH_ABSPRACHE']]))
    expect(mail.antwortAn).toBe('hof@example.org')
    expect(mail.html).toContain(MIT)
    expect(mail.html).not.toContain(OHNE)
  })

  it('mit Absprache ohne Hof-E-Mail: „meldet sich bei dir“ und keine Antwort-Adresse', async () => {
    const mail = await email.baueOrderConfirmation(bestellung([['NACH_ABSPRACHE']], '  '))
    expect(mail.antwortAn).toBeUndefined()
    expect(mail.html).toContain(OHNE)
    expect(mail.html).not.toContain(MIT)
  })

  it('auch bar nach der Bestätigung', async () => {
    const mail = await email.baueOrderConfirmation(bestellung([['NACH_ABSPRACHE']], 'hof@example.org', 'ONSITE_CASH'))
    expect(mail.html).toContain(MIT)
  })

  it('Gegenprobe ohne Absprache: kein Satz, „Antwort an“ wie bisher', async () => {
    const mail = await email.baueOrderConfirmation(bestellung([['FRONTLADER'], []]))
    expect(mail.antwortAn).toBe('hof@example.org')
    expect(mail.html).not.toContain('stimmt die Abholung mit dir ab')
  })

  it('die Mail mit dem Bestätigungslink bleibt ohne Satz', async () => {
    const mail = await email.onsiteConfirmationInhalt(bestellung([['NACH_ABSPRACHE']], 'hof@example.org', 'ONSITE_CASH'), 'tokenabc')
    expect(mail.html).not.toContain('stimmt die Abholung mit dir ab')
  })
})
