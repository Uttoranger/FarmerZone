/**
 * Rücktritt je Produkt (Nr. 214, N39-Ergänzung 31.10.2026) — die reinen Regeln
 * aus src/lib/ruecktritt-angaben.ts, ohne Mock.
 *
 * Beweist:
 *  - die Vorbelegung des Hakens deckt sich genau mit den Kategorien, für die
 *    `ausnahmeHinweis` den Verderblich-Satz zeigt (eine Liste, kein Abdriften);
 *  - Hinweise nur mit Angabe; die Kasse zeigt sie nur bei Verbraucherinnen;
 *  - das getippte Feld wird über die Ziffern zu Cent, Unlesbares und
 *    Negatives werden NaN (das Schema lehnt ab), leer ist null;
 *  - die Schätzung für den 5-b-Satz ist die Summe Schätzung × Menge in Cent,
 *    auf ganze Euro aufgerundet; ohne Angabe null.
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import {
  RUECKTRITT_TEXT,
  keinRuecktrittVorbelegung,
  keinRuecktrittNachKategoriewechsel,
  kostenSchaetzungSatz,
  ruecksendekostenAlsEingabe,
  ruecksendekostenAusEingabe,
  ruecksendekostenSchaetzungEuro,
  ruecktrittFuerPosition,
  ruecktrittHinweise,
} from '@/lib/ruecktritt-angaben'
import { ausnahmeHinweis } from '@/lib/widerruf'
import { PRODUCT_CATEGORY_VALUES } from '@/lib/taxonomie'
import { formatEuro, formatZahl } from '@/lib/format'

const OHNE = { keinRuecktritt: false, ruecksendekostenCents: null }

describe('keinRuecktrittVorbelegung', () => {
  it('setzt den Haken genau bei den Kategorien, für die der Hinweis je Kategorie „verdirbt schnell“ sagt', () => {
    for (const k of PRODUCT_CATEGORY_VALUES) {
      expect(keinRuecktrittVorbelegung(k), k).toBe(ausnahmeHinweis(k).includes('§ 18 Abs. 1 Z 4 FAGG'))
    }
  })

  it('Gegenprobe: Milch ja, Brennholz und Heu nein, ohne Kategorie nein', () => {
    expect(keinRuecktrittVorbelegung('MILCH')).toBe(true)
    expect(keinRuecktrittVorbelegung('BRENNHOLZ')).toBe(false)
    expect(keinRuecktrittVorbelegung('HEU_STROH')).toBe(false)
    expect(keinRuecktrittVorbelegung(null)).toBe(false)
  })
})

describe('keinRuecktrittNachKategoriewechsel — Vorbelegung nur beim Anlegen', () => {
  it('Anlegen: ohne Kategorie → Fleisch setzt den Haken, Fleisch → Brennholz nimmt ihn wieder weg', () => {
    expect(keinRuecktrittNachKategoriewechsel({ anlegen: true, aktuell: false, alt: null, neu: 'FLEISCH' })).toBe(true)
    expect(keinRuecktrittNachKategoriewechsel({ anlegen: true, aktuell: true, alt: 'FLEISCH', neu: 'BRENNHOLZ' })).toBe(false)
  })

  it('Anlegen: einen selbst geänderten Haken fasst der Wechsel nicht an', () => {
    expect(keinRuecktrittNachKategoriewechsel({ anlegen: true, aktuell: true, alt: 'HONIG', neu: 'BRENNHOLZ' })).toBe(true)
    expect(keinRuecktrittNachKategoriewechsel({ anlegen: true, aktuell: false, alt: 'MILCH', neu: 'FLEISCH' })).toBe(false)
  })

  it('Bearbeiten: nie rückwirkend — der gespeicherte Wert bleibt bei jedem Wechsel', () => {
    expect(keinRuecktrittNachKategoriewechsel({ anlegen: false, aktuell: false, alt: 'HONIG', neu: 'MILCH' })).toBe(false)
    expect(keinRuecktrittNachKategoriewechsel({ anlegen: false, aktuell: true, alt: 'MILCH', neu: 'BRENNHOLZ' })).toBe(true)
  })

  it('der Dialog nimmt die Regel mit „anlegen“ = nicht bearbeiten; beim Bearbeiten startet er mit dem gespeicherten Wert', () => {
    const dialog = readFileSync('src/components/products/product-dialog.tsx', 'utf8')
    expect(dialog).toContain('keinRuecktrittNachKategoriewechsel({ anlegen: !isEdit, aktuell: haken, alt, neu })')
    expect(dialog).toContain('keinRuecktritt: p.keinRuecktritt,')
    expect(dialog).toContain('ruecksendekostenCents: p.ruecksendekostenCents,')
  })
})

describe('ruecktrittHinweise', () => {
  it('ohne Angabe steht nichts', () => {
    expect(ruecktrittHinweise(OHNE)).toEqual([])
  })

  it('nennt „kein Rücktritt“ und die Schätzung im Euro-Format der Seite', () => {
    expect(ruecktrittHinweise({ keinRuecktritt: true, ruecksendekostenCents: null })).toEqual(['Kein Rücktritt: verdirbt schnell'])
    expect(ruecktrittHinweise({ keinRuecktritt: false, ruecksendekostenCents: 2550 })).toEqual(['Rücksendung geschätzt ca. €\u00a025,50'])
    expect(ruecktrittHinweise({ keinRuecktritt: true, ruecksendekostenCents: 12000 })).toEqual([
      RUECKTRITT_TEXT.hinweisKeinRuecktritt,
      'Rücksendung geschätzt ca. €\u00a0120,00',
    ])
    // Tausender wie jeder Betrag der Seite (formatEuro, de-AT).
    expect(ruecktrittHinweise({ keinRuecktritt: false, ruecksendekostenCents: 120000 })).toEqual([`Rücksendung geschätzt ca. ${formatEuro(1200).replace('€ ', '€\u00a0')}`])
  })
})

describe('ruecktrittFuerPosition — Kasse', () => {
  const produkt = { id: 'p1', name: 'Brennholz', keinRuecktritt: true, ruecksendekostenCents: 4000 }

  it('bei Verbraucherinnen die zwei Werte, nie das ganze Produkt', () => {
    expect(ruecktrittFuerPosition(produkt, true)).toEqual({ keinRuecktritt: true, ruecksendekostenCents: 4000 })
  })

  it('bei „Betrieb“ kein Hinweis, auch mit Angabe', () => {
    expect(ruecktrittFuerPosition(produkt, false)).toBeNull()
  })

  it('ein Produkt, das die Seite nicht kennt, hat keinen Hinweis', () => {
    expect(ruecktrittFuerPosition(undefined, true)).toBeNull()
    expect(ruecktrittFuerPosition(null, true)).toBeNull()
  })
})

describe('ruecksendekostenAusEingabe / ruecksendekostenAlsEingabe', () => {
  it('leer ist keine Angabe (null)', () => {
    expect(ruecksendekostenAusEingabe('')).toBeNull()
    expect(ruecksendekostenAusEingabe('   ')).toBeNull()
  })

  it('rechnet über die Ziffern, nicht in Fließkomma', () => {
    expect(ruecksendekostenAusEingabe('25')).toBe(2500)
    expect(ruecksendekostenAusEingabe('25,5')).toBe(2550)
    expect(ruecksendekostenAusEingabe('0,29')).toBe(29)
    expect(ruecksendekostenAusEingabe('12.99')).toBe(1299)
  })

  it('Negatives und Unlesbares werden NaN — das Schema lehnt mit einem Satz ab', () => {
    expect(ruecksendekostenAusEingabe('-5')).toBeNaN()
    expect(ruecksendekostenAusEingabe('abc')).toBeNaN()
    expect(ruecksendekostenAusEingabe('1,234')).toBeNaN()
  })

  it('zeigt gespeicherte Cent beim Bearbeiten deutsch mit zwei Stellen', () => {
    expect(ruecksendekostenAlsEingabe(2550)).toBe('25,50')
    expect(ruecksendekostenAlsEingabe(null)).toBe('')
    expect(ruecksendekostenAlsEingabe(Number.NaN)).toBe('')
  })
})

describe('ruecksendekostenSchaetzungEuro — Summe für den 5-b-Satz', () => {
  it('ohne Position mit Schätzung: null, der Satz bleibt weg', () => {
    expect(ruecksendekostenSchaetzungEuro([])).toBeNull()
    expect(ruecksendekostenSchaetzungEuro([{ menge: 3, ruecksendekostenCents: null }])).toBeNull()
  })

  it('Schätzung × Menge der betroffenen Positionen in Cent, auf ganze Euro aufgerundet', () => {
    const euro = ruecksendekostenSchaetzungEuro([
      { menge: 2, ruecksendekostenCents: 1250 },
      { menge: 1, ruecksendekostenCents: null },
      { menge: 3, ruecksendekostenCents: 199 },
    ])
    // 2 × 12,50 + 3 × 1,99 = 30,97 € → 31 €
    expect(euro).toBe(31)
  })

  it('ein glatter Betrag bleibt, ein Cent darüber rundet auf', () => {
    expect(ruecksendekostenSchaetzungEuro([{ menge: 1, ruecksendekostenCents: 2500 }])).toBe(25)
    expect(ruecksendekostenSchaetzungEuro([{ menge: 1, ruecksendekostenCents: 2501 }])).toBe(26)
    expect(ruecksendekostenSchaetzungEuro([{ menge: 1, ruecksendekostenCents: 1 }])).toBe(1)
  })
})

describe('kostenSchaetzungSatz — Gestaltungshinweis 5 b', () => {
  it('Wortlaut des Musters mit dem Betrag in ganzen Euro', () => {
    expect(kostenSchaetzungSatz(31)).toBe('Die Kosten werden auf höchstens etwa 31 EUR geschätzt.')
    expect(kostenSchaetzungSatz(1200)).toBe(`Die Kosten werden auf höchstens etwa ${formatZahl(1200)} EUR geschätzt.`)
  })
})
