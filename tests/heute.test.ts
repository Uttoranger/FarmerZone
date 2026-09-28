/**
 * Tests für den Heute-Bildschirm (src/lib/heute.ts) und die Wiener
 * Wochenhelfer (src/lib/kalender.ts).
 *
 * Beweist:
 *  - „Heute" ist der Wiener Tag: um 0:30 Uhr Wiener Zeit (22:30 UTC) zählt
 *    schon der neue Tag, obwohl UTC noch im alten steht.
 *  - Packliste und „Heute abholen" teilen EINE Bedingung — ohne abgeholte,
 *    stornierte und nicht abgeholte Bestellungen.
 *  - Woche ab Montag 0 Uhr Wien, auch über die Zeitumstellung; die Vorwoche
 *    zählt bis zum selben Wochentag und zur selben Uhrzeit.
 *  - Braucht dich: jede Art mit ihrem Ziel, leer bleibt leer.
 *  - Wochenvergleich in Cent, ohne Vorwochenumsatz kein Prozent.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ABHOLUNG_ERLEDIGT,
  abholChip,
  abholtage,
  abholWhere,
  abholZeilen,
  begruessung,
  brauchtDich,
  datumLang,
  kurzname,
  positionenKurz,
  ueberfaelligWhere,
  vergleichText,
  vorwocheBis,
  wochenfenster,
  wochenvergleich,
  type BrauchtDichDaten,
  type HeutigeAbholung,
} from '@/lib/heute'
import { tagVersetzt, wienWochenbeginn, wienWochenMontag } from '@/lib/kalender'

const iso = (d: Date) => d.toISOString()

/** pickupDate steht um 12:00 Serverzeit des Abholtags (Vercel = UTC). */
const abholtag = (kalendertag: string) => new Date(`${kalendertag}T12:00:00Z`)

const imZeitraum = (d: Date, z: { von: Date; bis: Date }) => d >= z.von && d <= z.bis

describe('abholtage — Tageswechsel in Wiener Zeit', () => {
  it('um 0:30 Uhr in Wien (22:30 UTC) ist schon morgen', () => {
    const { heute, morgen } = abholtage(new Date('2026-09-28T22:30:00Z'))
    expect(iso(heute.von)).toBe('2026-09-28T22:00:00.000Z')
    expect(iso(heute.bis)).toBe('2026-09-29T21:59:59.999Z')
    expect(iso(morgen.von)).toBe('2026-09-29T22:00:00.000Z')
    // Die Abholung am 29. gehört dazu, die vom 28. (in UTC noch „heute") nicht.
    expect(imZeitraum(abholtag('2026-09-29'), heute)).toBe(true)
    expect(imZeitraum(abholtag('2026-09-28'), heute)).toBe(false)
    expect(imZeitraum(abholtag('2026-09-30'), morgen)).toBe(true)
  })

  it('um 23:59 Uhr in Wien ist noch derselbe Tag', () => {
    const { heute } = abholtage(new Date('2026-09-28T21:59:00Z'))
    expect(imZeitraum(abholtag('2026-09-28'), heute)).toBe(true)
    expect(imZeitraum(abholtag('2026-09-29'), heute)).toBe(false)
  })

  it('im Winter (UTC+1) verschiebt sich die Grenze um eine Stunde', () => {
    const { heute } = abholtage(new Date('2026-12-01T23:30:00Z'))
    expect(iso(heute.von)).toBe('2026-12-01T23:00:00.000Z')
    expect(imZeitraum(abholtag('2026-12-02'), heute)).toBe(true)
  })
})

describe('abholWhere — eine Bedingung für Heute und Packliste', () => {
  it('Wiener Tag, ohne abgeholte, stornierte und nicht abgeholte', () => {
    const { heute } = abholtage(new Date('2026-09-28T22:30:00Z'))
    expect(abholWhere('hof-1', heute)).toEqual({
      farmId: 'hof-1',
      pickupDate: { gte: heute.von, lte: heute.bis },
      status: { notIn: ['PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP'] },
    })
  })

  it('überfällig: Abholtag vor dem Wiener Heute, dieselben Status fallen weg', () => {
    const jetzt = new Date('2026-09-28T22:30:00Z')
    expect(ueberfaelligWhere('hof-1', jetzt)).toEqual({
      farmId: 'hof-1',
      pickupDate: { lt: new Date('2026-09-28T22:00:00.000Z') },
      status: { notIn: [...ABHOLUNG_ERLEDIGT] },
    })
    // Die Abholung vom 28. ist um 0:30 Uhr am 29. vorbei.
    expect(abholtag('2026-09-28') < new Date('2026-09-28T22:00:00.000Z')).toBe(true)
  })
})

describe('Wiener Woche (kalender.ts)', () => {
  it('tagVersetzt rechnet über Monats- und Jahresgrenzen', () => {
    expect(tagVersetzt('2026-09-30', 1)).toBe('2026-10-01')
    expect(tagVersetzt('2026-01-01', -1)).toBe('2025-12-31')
    expect(tagVersetzt('2026-03-01', -7)).toBe('2026-02-22')
  })

  it('der Montag der Woche — Sonntagnacht gehört noch zur alten Woche', () => {
    expect(wienWochenMontag(new Date('2026-09-28T10:00:00Z'))).toBe('2026-09-28')
    expect(wienWochenMontag(new Date('2026-10-01T10:00:00Z'))).toBe('2026-09-28')
    // Sonntag 23:30 Wien
    expect(wienWochenMontag(new Date('2026-10-04T21:30:00Z'))).toBe('2026-09-28')
    // Montag 0:30 Wien, in UTC noch Sonntag
    expect(wienWochenMontag(new Date('2026-10-04T22:30:00Z'))).toBe('2026-10-05')
  })

  it('Wochenbeginn ist Montag 0 Uhr Wien — Sommer und Winter', () => {
    expect(iso(wienWochenbeginn(new Date('2026-09-30T12:00:00Z')))).toBe('2026-09-27T22:00:00.000Z')
    // Woche nach der Umstellung auf Winterzeit (25.10.2026)
    expect(iso(wienWochenbeginn(new Date('2026-10-28T12:00:00Z')))).toBe('2026-10-25T23:00:00.000Z')
    // Umstellungssonntag auf Sommerzeit (29.3.2026) gehört zur Woche davor
    expect(iso(wienWochenbeginn(new Date('2026-03-29T12:00:00Z')))).toBe('2026-03-22T23:00:00.000Z')
    expect(iso(wienWochenbeginn(new Date('2026-03-30T12:00:00Z')))).toBe('2026-03-29T22:00:00.000Z')
  })
})

describe('wochenfenster — Vorwoche bis zum selben Wochentag und zur selben Uhrzeit', () => {
  it('Mittwoch 14:30 gegen den Mittwoch davor, 14:30', () => {
    const jetzt = new Date('2026-09-30T12:30:00Z')
    const { dieseWoche, vorwoche } = wochenfenster(jetzt)
    expect(iso(dieseWoche.von)).toBe('2026-09-27T22:00:00.000Z')
    expect(dieseWoche.bis).toBe(jetzt)
    expect(iso(vorwoche.von)).toBe('2026-09-20T22:00:00.000Z')
    expect(iso(vorwoche.bis)).toBe('2026-09-23T12:30:00.000Z')
  })

  it('über die Zeitumstellung bleibt es 14:30 Wiener Zeit', () => {
    // Mittwoch 28.10. 14:30 Winterzeit gegen Mittwoch 21.10. 14:30 Sommerzeit
    const { dieseWoche, vorwoche } = wochenfenster(new Date('2026-10-28T13:30:00Z'))
    expect(iso(dieseWoche.von)).toBe('2026-10-25T23:00:00.000Z')
    expect(iso(vorwoche.von)).toBe('2026-10-18T22:00:00.000Z')
    expect(iso(vorwoche.bis)).toBe('2026-10-21T12:30:00.000Z')
  })

  it('Montag 0:30 Wien: die Woche hat eben erst begonnen', () => {
    const { dieseWoche, vorwoche } = wochenfenster(new Date('2026-10-04T22:30:00Z'))
    expect(iso(dieseWoche.von)).toBe('2026-10-04T22:00:00.000Z')
    expect(iso(vorwoche.von)).toBe('2026-09-27T22:00:00.000Z')
    expect(iso(vorwoche.bis)).toBe('2026-09-27T22:30:00.000Z')
  })
})

describe('wochenvergleich', () => {
  it('rechnet in Cent und rundet das Prozent', () => {
    expect(wochenvergleich(12000, 10000)).toEqual({ dieseWocheCent: 12000, vorwocheCent: 10000, prozent: 20 })
    expect(wochenvergleich(8000, 10000).prozent).toBe(-20)
    expect(wochenvergleich(1001, 3000).prozent).toBe(-67)
    expect(wochenvergleich(10000, 10000).prozent).toBe(0)
  })

  it('ohne Umsatz in der Vorwoche gibt es kein Prozent', () => {
    expect(wochenvergleich(5000, 0).prozent).toBeNull()
    expect(wochenvergleich(0, 0).prozent).toBeNull()
  })
})

describe('Heute abholen — Zeilen', () => {
  it('kurzname: Vorname und Initial', () => {
    expect(kurzname('Anna Beispiel')).toBe('Anna B.')
    expect(kurzname('  Bert  van  muster ')).toBe('Bert M.')
    expect(kurzname('Clara')).toBe('Clara')
    expect(kurzname('   ')).toBe('Kunde')
  })

  it('positionenKurz: zwei Positionen, der Rest als Zahl', () => {
    const items = [
      { productName: 'Eier', quantity: 2 },
      { productName: 'Bauernbrot', quantity: 1 },
      { productName: 'Butter', quantity: 1 },
      { productName: 'Honig', quantity: 3 },
    ]
    expect(positionenKurz(items)).toBe('2× Eier, 1× Bauernbrot +2')
    expect(positionenKurz(items.slice(0, 2))).toBe('2× Eier, 1× Bauernbrot')
    expect(positionenKurz([])).toBe('')
  })

  it('drei Chips: bereit, vorbereiten, wartet auf Kunde', () => {
    expect(abholChip('READY')).toBe('bereit')
    expect(abholChip('PENDING_CONFIRMATION')).toBe('wartet')
    expect(abholChip('CONFIRMED')).toBe('vorbereiten')
    expect(abholChip('PAID')).toBe('vorbereiten')
    expect(abholChip('IN_PREPARATION')).toBe('vorbereiten')
  })

  it('erledigte fallen weg, der Rest nach Uhrzeit', () => {
    const basis: Omit<HeutigeAbholung, 'id' | 'status' | 'pickupTimeStart' | 'customerName'> = {
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONSITE_CASH',
      items: [{ productName: 'Eier', quantity: 10 }],
    }
    const zeilen = abholZeilen([
      { ...basis, id: 'a', status: 'READY', pickupTimeStart: '16:00', customerName: 'Dora Test' },
      { ...basis, id: 'b', status: 'PICKED_UP', pickupTimeStart: '09:00', customerName: 'Emil Test' },
      { ...basis, id: 'c', status: 'CONFIRMED', pickupTimeStart: '09:00', customerName: 'Frida Test' },
      { ...basis, id: 'd', status: 'CANCELLED', pickupTimeStart: '10:00', customerName: 'Gerd Test' },
      { ...basis, id: 'e', status: 'NOT_PICKED_UP', pickupTimeStart: '11:00', customerName: 'Hanna Test' },
      {
        ...basis,
        id: 'f',
        status: 'PENDING_CONFIRMATION',
        pickupTimeStart: '12:00',
        customerName: 'Ida Test',
        paymentMethod: 'ONLINE',
      },
    ])
    expect(zeilen.map((z) => z.id)).toEqual(['c', 'f', 'a'])
    expect(zeilen[0]).toEqual({
      id: 'c',
      uhrzeit: '09:00–18:00',
      kunde: 'Frida T.',
      positionen: '10× Eier',
      zahlart: 'Bar vor Ort',
      chip: 'vorbereiten',
    })
    expect(zeilen[1].zahlart).toBe('Online')
    expect(zeilen[1].chip).toBe('wartet')
    expect(zeilen[2].chip).toBe('bereit')
  })
})

describe('brauchtDich', () => {
  const LEER: BrauchtDichDaten = {
    ueberfaellig: { anzahl: 0, juengste: [] },
    ausverkauft: [],
    ohneKategorie: [],
    statusErinnerung: null,
  }

  it('nichts zu tun → leer („Alles erledigt.")', () => {
    expect(brauchtDich(LEER)).toEqual([])
  })

  it('eine überfällige Abholung führt direkt zur Bestellung', () => {
    const [eintrag] = brauchtDich({
      ...LEER,
      ueberfaellig: { anzahl: 1, juengste: [{ id: 'o1', customerName: 'Anna Beispiel', pickupDate: abholtag('2026-09-23') }] },
    })
    expect(eintrag.art).toBe('ueberfaellig')
    expect(eintrag.text).toBe('1 Abholung vorbei, noch offen — als abgeholt oder nicht abgeholt markieren')
    expect(eintrag.href).toBe('/orders/o1')
    expect(eintrag.unterpunkte).toEqual([{ text: 'Anna B. · Mi., 23.9.', href: '/orders/o1' }])
  })

  it('mehrere überfällige: die jüngsten fünf mit Link, der Rest als „und n weitere"', () => {
    const juengste = Array.from({ length: 5 }, (_, i) => ({
      id: `o${i}`,
      customerName: `Kunde ${i}`,
      pickupDate: abholtag(`2026-09-2${i}`),
    }))
    const [eintrag] = brauchtDich({ ...LEER, ueberfaellig: { anzahl: 7, juengste } })
    expect(eintrag.text.startsWith('7 Abholungen vorbei, noch offen')).toBe(true)
    expect(eintrag.href).toBe('/orders')
    expect(eintrag.unterpunkte).toHaveLength(6)
    expect(eintrag.unterpunkte?.slice(0, 5).map((u) => u.href)).toEqual([
      '/orders/o0',
      '/orders/o1',
      '/orders/o2',
      '/orders/o3',
      '/orders/o4',
    ])
    expect(eintrag.unterpunkte?.[5]).toEqual({ text: 'und 2 weitere', href: '/orders' })
  })

  it('ausverkauft: bis drei einzeln zum Bearbeiten, der Rest gesammelt', () => {
    const ausverkauft = ['Eier', 'Milch', 'Butter', 'Honig', 'Speck'].map((name, i) => ({ id: `p${i}`, name }))
    const eintraege = brauchtDich({ ...LEER, ausverkauft })
    expect(eintraege.map((e) => [e.text, e.href])).toEqual([
      ['Eier ist ausverkauft', '/products?edit=p0'],
      ['Milch ist ausverkauft', '/products?edit=p1'],
      ['Butter ist ausverkauft', '/products?edit=p2'],
      ['und 2 weitere ausverkauft', '/products'],
    ])
  })

  it('ohne Kategorie: eines direkt, mehrere zur Liste', () => {
    expect(brauchtDich({ ...LEER, ohneKategorie: [{ id: 'p9', name: 'Kürbis' }] })).toEqual([
      { art: 'ohne-kategorie', text: 'Kürbis hat keine Kategorie', href: '/products?edit=p9' },
    ])
    expect(
      brauchtDich({
        ...LEER,
        ohneKategorie: [
          { id: 'p1', name: 'A' },
          { id: 'p2', name: 'B' },
        ],
      })
    ).toEqual([{ art: 'ohne-kategorie', text: '2 Produkte ohne Kategorie', href: '/products' }])
  })

  it('Status-Erinnerung nur, wenn fällig', () => {
    expect(brauchtDich({ ...LEER, statusErinnerung: null })).toEqual([])
    expect(brauchtDich({ ...LEER, statusErinnerung: 9 })).toEqual([
      { art: 'status', text: 'Seit 9 Tagen kein neuer Status', href: '/status/new' },
    ])
    expect(brauchtDich({ ...LEER, statusErinnerung: 'never' })[0].text).toBe(
      'Noch kein Status — erzähl deinen Kunden, was es gibt'
    )
  })

  it('Reihenfolge: Bestellungen zuerst, dann Produkte, zuletzt der Status', () => {
    const eintraege = brauchtDich({
      ueberfaellig: { anzahl: 1, juengste: [{ id: 'o1', customerName: 'Anna Beispiel', pickupDate: abholtag('2026-09-23') }] },
      ausverkauft: [{ id: 'p1', name: 'Eier' }],
      ohneKategorie: [{ id: 'p2', name: 'Kürbis' }],
      statusErinnerung: 7,
    })
    expect(eintraege.map((e) => e.art)).toEqual(['ueberfaellig', 'ausverkauft', 'ohne-kategorie', 'status'])
  })
})

describe('Kopf in Wiener Zeit', () => {
  it('Gruß nach der Wiener Stunde, nicht nach der Serverzeit', () => {
    expect(begruessung(new Date('2026-09-28T09:59:00Z'))).toBe('Guten Morgen') // 11:59
    expect(begruessung(new Date('2026-09-28T10:00:00Z'))).toBe('Guten Tag') // 12:00
    expect(begruessung(new Date('2026-09-28T16:00:00Z'))).toBe('Guten Abend') // 18:00
    expect(begruessung(new Date('2026-09-28T22:30:00Z'))).toBe('Guten Morgen') // 0:30
  })

  it('Datum ist der Wiener Tag', () => {
    expect(datumLang(new Date('2026-09-28T22:30:00Z'))).toBe('Dienstag, 29. September 2026')
  })

  it('vorwocheBis nennt Wochentag und Uhrzeit in Wien', () => {
    expect(vorwocheBis(new Date('2026-09-29T12:30:00Z'))).toBe('bis Dienstag, 14:30')
  })

  it('vergleichText: Vorzeichen, gleich, ohne Vorwoche', () => {
    const jetzt = new Date('2026-09-29T12:30:00Z')
    expect(vergleichText(20, jetzt)).toBe('+20 % gegenüber der Vorwoche bis Dienstag, 14:30')
    expect(vergleichText(-7, jetzt)).toBe('−7 % gegenüber der Vorwoche bis Dienstag, 14:30')
    expect(vergleichText(0, jetzt)).toBe('±0 % gegenüber der Vorwoche bis Dienstag, 14:30')
    expect(vergleichText(null, jetzt)).toBe('Vorwoche bis Dienstag, 14:30: noch kein Umsatz')
  })
})

describe('an den Seiten — Heute und Packliste teilen die Abfrage', () => {
  const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

  it('„Heute abholen" und „Morgen" fragen über abholWhere mit dem Wiener Tag', () => {
    const abfrage = quelle('src/server/queries/heute.ts')
    expect(abfrage).toContain('where: abholWhere(farmId, heute)')
    expect(abfrage).toContain('where: abholWhere(farmId, morgen)')
    expect(abfrage).toContain('ueberfaelligWhere(farmId, jetzt)')
  })

  it('die Packliste nimmt dieselbe Bedingung, keine eigene Tagesgrenze mehr', () => {
    const packliste = quelle('src/app/(farmer)/orders/today/print/page.tsx')
    expect(packliste).toContain('where: abholWhere(farm.id, abholtage(jetzt).heute)')
    expect(packliste).not.toContain('setHours')
    expect(packliste).toContain('datumLang(jetzt)')
  })

  it('/dashboard ist Heute: kein Produkt-Knopf, keine Kennzahlen, Leerzustand „Alles erledigt."', () => {
    const seite = quelle('src/app/(farmer)/dashboard/page.tsx')
    expect(seite).toContain('getHeute(')
    expect(seite).not.toContain('getDashboardStats')
    expect(seite).not.toContain('Produkt anlegen')
    expect(seite).not.toContain('Kunden gesamt')
    expect(seite).not.toContain('wa.me')
    expect(seite).toContain('Alles erledigt.')
    expect(seite).toContain('{morgenAnzahl > 0 && (')
    expect(seite).toContain('href="/orders/today/print"')
    expect(seite).not.toContain('getHours()')
  })
})
