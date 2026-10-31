/**
 * Widerruf online (§ 13a FAGG, Register N39, Nr. 200) — die reinen Regeln
 * (src/lib/widerruf.ts), der signierte Link (Zweck `widerruf`) und die Quelle
 * „Widerruf offen“ in Admin › Heute.
 *
 * Beweist:
 *  - `widerrufMoeglich`: nur PRIVAT, nie storniert, vor der Abholung immer,
 *    danach bis einschließlich Tag 14 (Wiener Kalendertag), Tag 15 nicht.
 *  - Der Hinweis je Kategorie deckt jede Kategorie aus `ProductCategory`.
 *  - Positionen fremder Bestellungen, doppelte und schon fehlende lehnt die
 *    Auswahl ab; gewählt wird immer die ganze Menge.
 *  - Die Signatur der Bestellseite gilt nicht als Widerruf-Link (und umgekehrt).
 *  - Knöpfe und Kassensatz wörtlich nach der Freigabe.
 *  - „Widerruf offen“: zugeordnet Frist 14 Tage, nicht zugeordnet 2 Tage, ohne Personendaten.
 */
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WiderrufErgebnisEmail } from '@/emails/widerruf'
import {
  WIDERRUF_TEXT,
  ausnahmeHinweis,
  deckungGanz,
  lesePositionen,
  normalisiereBestellnummer,
  waehlePositionen,
  widerrufFristEnde,
  widerrufMoeglich,
  offenePositionen,
  teilweiseGestrichen,
} from '@/lib/widerruf'
import { PRODUCT_CATEGORY_VALUES } from '@/lib/taxonomie'
import { bestellSignatur, widerrufLinkGilt, widerrufPfad, widerrufSignatur, bestellLinkGilt } from '@/lib/bestell-link'
import { LEERER_STAND, sammleAufgaben } from '@/lib/admin-aufgaben'

const TAG = 24 * 60 * 60 * 1000
// Abgeholt am Montag, 2.11.2026, 16:00 Wiener Zeit (15:00 UTC).
const ABGEHOLT = new Date('2026-11-02T15:00:00Z')

describe('widerrufMoeglich', () => {
  const privat = { kaeuferArt: 'PRIVAT', status: 'PICKED_UP', pickedUpAt: ABGEHOLT }

  it('PRIVAT nach der Abholung: Tag 14 ja (bis 23:59 Wien), Tag 15 nein', () => {
    expect(widerrufFristEnde(ABGEHOLT)).toBe('2026-11-16')
    expect(widerrufMoeglich(privat, new Date('2026-11-16T22:59:00Z'))).toBe(true)
    // Gegenprobe: eine Minute nach Mitternacht in Wien ist Tag 15.
    expect(widerrufMoeglich(privat, new Date('2026-11-16T23:01:00Z'))).toBe(false)
    expect(widerrufMoeglich(privat, new Date(ABGEHOLT.getTime() + 15 * TAG))).toBe(false)
  })

  it('BETRIEB nie, auch am Tag der Abholung nicht', () => {
    expect(widerrufMoeglich({ ...privat, kaeuferArt: 'BETRIEB' }, ABGEHOLT)).toBe(false)
    expect(widerrufMoeglich(privat, ABGEHOLT)).toBe(true)
  })

  it('storniert nie; vor der Abholung immer', () => {
    expect(widerrufMoeglich({ kaeuferArt: 'PRIVAT', status: 'CANCELLED', pickedUpAt: null }, ABGEHOLT)).toBe(false)
    expect(widerrufMoeglich({ kaeuferArt: 'PRIVAT', status: 'PAID', pickedUpAt: null }, new Date(ABGEHOLT.getTime() + 60 * TAG))).toBe(true)
  })
})

describe('ausnahmeHinweis', () => {
  it('ein Satz für jede Kategorie aus ProductCategory — frische Lebensmittel mit § 18 Abs. 1 Z 4', () => {
    for (const k of PRODUCT_CATEGORY_VALUES) expect(ausnahmeHinweis(k).length).toBeGreaterThan(20)
    expect(ausnahmeHinweis('MILCH')).toContain('§ 18 Abs. 1 Z 4 FAGG')
    expect(ausnahmeHinweis('HONIG')).toContain('wahrscheinlich möglich')
    // Nur ein Hinweis — entscheiden tut der Hof.
    for (const k of PRODUCT_CATEGORY_VALUES) expect(ausnahmeHinweis(k)).toContain('Der Hof prüft das im Einzelfall.')
  })
})

describe('Positionen', () => {
  const bestellung = [
    { id: 'pos-a', quantity: 2, fehlt: false },
    { id: 'pos-b', quantity: 1, fehlt: false },
    { id: 'pos-c', quantity: 1, fehlt: true },
  ]

  it('eigene Positionen mit ganzer Menge', () => {
    expect(waehlePositionen(['pos-a'], bestellung)).toEqual([{ orderItemId: 'pos-a', menge: 2 }])
  })

  it('fremde, doppelte, fehlende oder keine Position → abgelehnt', () => {
    expect(waehlePositionen(['fremd-1'], bestellung)).toBeNull()
    expect(waehlePositionen(['pos-a', 'pos-a'], bestellung)).toBeNull()
    expect(waehlePositionen(['pos-c'], bestellung)).toBeNull()
    expect(waehlePositionen([], bestellung)).toBeNull()
  })

  it('alle vorhandenen gewählt = ganze Bestellung', () => {
    expect(deckungGanz([{ orderItemId: 'pos-a', menge: 2 }, { orderItemId: 'pos-b', menge: 1 }], bestellung)).toBe(true)
    expect(deckungGanz([{ orderItemId: 'pos-a', menge: 2 }], bestellung)).toBe(false)
  })

  it('die JSON-Spalte wird beim Lesen geprüft', () => {
    expect(lesePositionen([{ orderItemId: 'x', menge: 1 }, { orderItemId: 3 }, null, 'kaputt'])).toEqual([{ orderItemId: 'x', menge: 1 }])
    expect(lesePositionen(null)).toEqual([])
  })

  it('Bestellnummer: ohne Ränder, groß', () => {
    expect(normalisiereBestellnummer('  hm-2611-a4f2 ')).toBe('HM-2611-A4F2')
  })
})

describe('signierter Link (Zweck widerruf)', () => {
  it('gilt nur für seine Bestellung und nur für diesen Zweck', () => {
    const sig = widerrufSignatur('bestellung-1')
    expect(widerrufLinkGilt('bestellung-1', sig)).toBe(true)
    expect(widerrufLinkGilt('bestellung-2', sig)).toBe(false)
    expect(widerrufLinkGilt('bestellung-1', 'falsch')).toBe(false)
    // Die Signatur der Bestellseite öffnet keinen Widerruf, und umgekehrt.
    expect(widerrufLinkGilt('bestellung-1', bestellSignatur('bestellung-1'))).toBe(false)
    expect(bestellLinkGilt('bestellung-1', sig)).toBe(false)
    expect(widerrufPfad('bestellung-1')).toBe(`/widerruf?bestellung=bestellung-1&sig=${sig}`)
  })
})

describe('Sätze', () => {
  it('Knöpfe wörtlich', () => {
    expect(WIDERRUF_TEXT.knopfWiderrufen).toBe('Vertrag widerrufen')
    expect(WIDERRUF_TEXT.knopfBestaetigen).toBe('Widerruf bestätigen')
  })

  it('Kasse: der Satz der Freigabe mit Link „Rücktritt“ auf /widerruf', () => {
    const [satz, link] = WIDERRUF_TEXT.kasseSatz
    expect(satz).toBe('Du kannst vom Kauf innerhalb von 14 Tagen nach der Abholung zurücktreten – außer bei schnell verderblicher Ware. So geht’s: ')
    expect(link).toEqual({ art: 'link', text: 'Rücktritt', ziel: '/widerruf' })
  })
})

describe('Admin › Heute: Widerruf offen', () => {
  const jetzt = new Date('2026-11-10T10:00:00Z')

  it('zugeordnet: Frist 14 Tage ab Eingang, Ziel die Bestellung; nicht zugeordnet: 2 Tage', () => {
    const eingang = new Date('2026-11-09T10:00:00Z')
    const aufgaben = sammleAufgaben(
      {
        ...LEERER_STAND,
        widerrufe: [
          { id: 'w-1', orderId: 'o-1', bestellnummer: 'HM-2611-AAAA', hofName: 'Hof am Bach', eingegangenAm: eingang },
          { id: 'w-2', orderId: null, bestellnummer: null, hofName: null, eingegangenAm: eingang },
        ],
      },
      jetzt
    ).filter((a) => a.quelle === 'widerruf_offen')
    expect(aufgaben).toHaveLength(2)
    const [zugeordnet, ohne] = aufgaben.toSorted((a, b) => Number(a.bezug.kennung === 'w-2') - Number(b.bezug.kennung === 'w-2'))
    expect(zugeordnet!.frist.ziel.getTime() - eingang.getTime()).toBe(14 * TAG)
    expect(zugeordnet!.ziel).toContain('o-1')
    expect(ohne!.frist.ziel.getTime() - eingang.getTime()).toBe(2 * TAG)
    expect(ohne!.bezug.text).toBe('nicht zugeordnet')
    // Nachbesserung Runde 2: Ziel ist die Liste „Widerrufe ohne Bestellung“ (Anker); der zugeordnete führt zur Bestellung, nicht dorthin.
    expect(ohne!.ziel).toBe('/admin/bestellungen#widerrufe-ohne-bestellung')
    expect(zugeordnet!.ziel).not.toContain('#')
    // Gegenprobe ohne Widerruf: keine Aufgabe.
    expect(sammleAufgaben(LEERER_STAND, jetzt).some((a) => a.quelle === 'widerruf_offen')).toBe(false)
  })
})

describe('Mail „Dein Widerruf ist erledigt“', () => {
  const basis = { bestellnummer: 'HM-2611-TEST', hofName: 'Testhof', grund: null }
  const html = (p: { erstattet: number | null; vorAbholung?: boolean; teilweise?: boolean }) => renderToStaticMarkup(createElement(WiderrufErgebnisEmail, { ...basis, ...p }))

  it('vor der Abholung: keine Rückgabe, kein „bar zurückgegeben“ — online mit Betrag, vor Ort ohne', () => {
    const online = html({ erstattet: 4.95, vorAbholung: true })
    expect(online).toContain('gestrichen')
    expect(online).toContain('4,95')
    expect(online).not.toContain('Rückgabe')
    const vorOrt = html({ erstattet: null, vorAbholung: true })
    expect(vorOrt).toContain('nur noch die übrigen Artikel')
    expect(vorOrt).not.toContain('bar zurückgegeben')
  })

  it('Gegenprobe nach der Abholung: Rückgabe bestätigt, bar zurückgegeben', () => {
    const bar = html({ erstattet: null })
    expect(bar).toContain('Rückgabe')
    expect(bar).toContain('bar zurückgegeben')
    expect(bar).not.toContain('gestrichen')
  })

  it('vor der Abholung nur zum Teil gebucht (Nachbesserung Runde 2): „zum Teil erledigt“, der Rest beim Hof — Gegenprobe ganz gebucht ohne diesen Satz', () => {
    const teil = html({ erstattet: 4.95, vorAbholung: true, teilweise: true })
    expect(teil).toContain('Dein Widerruf ist zum Teil erledigt')
    expect(teil).toContain('Die übrigen prüft der Hof')
    expect(teil).toContain('4,95')
    const ganz = html({ erstattet: 4.95, vorAbholung: true })
    expect(ganz).not.toContain('zum Teil')
    expect(ganz).toContain('Dein Widerruf ist erledigt')
  })

  it('Ablehnung nach Teilbuchung (Nachbesserung Runde 3): „für die übrigen Artikel abgelehnt“ — Gegenprobe ohne Teilbuchung ohne Zusatz', () => {
    const abgelehnt = (teilweise?: boolean) => renderToStaticMarkup(createElement(WiderrufErgebnisEmail, { ...basis, erstattet: null, grund: 'Ware angebrochen', teilweise }))
    expect(abgelehnt(true)).toContain('für die übrigen Artikel')
    expect(abgelehnt(true)).toContain('Dein Widerruf wurde abgelehnt')
    expect(abgelehnt()).not.toContain('übrigen')
  })
})

describe('Rest eines Teilwiderrufs (Nachbesserung Runde 3)', () => {
  const pos = [
    { orderItemId: 'a', menge: 1 },
    { orderItemId: 'b', menge: 2 },
  ]
  it('offenePositionen: nur, was noch nicht gestrichen ist; teilweiseGestrichen erkennt die Teilbuchung', () => {
    const bestellung = [
      { id: 'a', fehlt: true },
      { id: 'b', fehlt: false },
      { id: 'c', fehlt: false },
    ]
    expect(offenePositionen(pos, bestellung)).toEqual([{ orderItemId: 'b', menge: 2 }])
    expect(teilweiseGestrichen(pos, bestellung)).toBe(true)
  })
  it('Gegenprobe: nichts gestrichen → alle bleiben, keine Teilbuchung; fremde Position fällt weg', () => {
    const bestellung = [
      { id: 'a', fehlt: false },
      { id: 'b', fehlt: false },
    ]
    expect(offenePositionen(pos, bestellung)).toEqual(pos)
    expect(teilweiseGestrichen(pos, bestellung)).toBe(false)
    expect(offenePositionen([{ orderItemId: 'x', menge: 1 }], bestellung)).toEqual([])
  })
})
