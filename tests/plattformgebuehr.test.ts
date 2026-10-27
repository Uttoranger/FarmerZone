/**
 * Plattformgebühr im Hofpreis (Register N38, Nr. 197) — die reinen Regeln aus
 * src/lib/plattformgebuehr.ts: Modell ab Stichtag, Satz, Rundung je Stück,
 * Bestellgebühr, Einzug, barMoeglich. Dazu zwei Wachen: online und bar ergeben
 * für denselben Korb denselben Gesamtbetrag (zufällige Körbe), und die Datei
 * rechnet ohne Gleitkomma.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  anzeigePreisCents,
  barMoeglich,
  bestellGebuehr,
  einzugAbFuer,
  einzugFuer,
  endpreisEuro,
  endpreisJeStueckCents,
  gebuehrJeStueckCents,
  gebuehrModellFuer,
  hofpreisModellAb,
  mindestbestellwertErreicht,
  satzHundertstel,
  satzText,
  type GebuehrLage,
} from '@/lib/plattformgebuehr'
import { BAR_SERVICEGEBUEHR_AB, MINDESTBESTELLWERT_SATZ, PLATTFORMGEBUEHR_PROZENT } from '@/lib/konditionen'
import { bildeGruendungBis } from '@/lib/gruendungshof'
import { wienerMitternacht } from '@/lib/wiener-tag'
import { kassenBetraege, type KassenHof } from '@/lib/kasse'
import { alsCents } from '@/lib/order-totals'

const tag = (t: string): Date => {
  const d = wienerMitternacht(t)
  if (!d) throw new Error(t)
  return d
}

describe('Modell und Stichtag', () => {
  it('ohne Admin-Einstellung gilt BAR_SERVICEGEBUEHR_AB, mit ihr ihr Tag', () => {
    expect(hofpreisModellAb(null)).toEqual(BAR_SERVICEGEBUEHR_AB)
    expect(hofpreisModellAb({ hofpreisModellAb: null })).toEqual(BAR_SERVICEGEBUEHR_AB)
    expect(hofpreisModellAb({ hofpreisModellAb: tag('2026-11-01') })).toEqual(tag('2026-11-01'))
  })

  it('genau am Stichtag schon hofpreis, eine Millisekunde davor bisher', () => {
    const ab = tag('2026-11-01')
    expect(gebuehrModellFuer({ hofpreisModellAb: ab }, ab)).toBe('hofpreis')
    expect(gebuehrModellFuer({ hofpreisModellAb: ab }, new Date(ab.getTime() - 1))).toBe('bisher')
    expect(gebuehrModellFuer(null, new Date(BAR_SERVICEGEBUEHR_AB.getTime() - 1))).toBe('bisher')
  })
})

describe('Satz und Rundung je Stück', () => {
  it('Vorgabe 6 %, eigener Satz aus dem Decimal über die Ziffern', () => {
    expect(PLATTFORMGEBUEHR_PROZENT).toBe(6)
    expect(satzHundertstel({ plattformgebuehrProzent: null })).toBe(600)
    expect(satzHundertstel({ plattformgebuehrProzent: { toString: () => '6.50' } })).toBe(650)
    expect(satzHundertstel({ plattformgebuehrProzent: '7' })).toBe(700)
    expect(satzText(600)).toBe('6')
    expect(satzText(650)).toBe('6,5')
    expect(satzText(625)).toBe('6,25')
  })

  it('3 × 4,00 € → Gebühr 3 × 24 Cent; angefangene Cent zählen voll', () => {
    expect(gebuehrJeStueckCents(400, 600)).toBe(24)
    expect(bestellGebuehr([{ preisCents: 400, menge: 3 }], 600)).toEqual({ warenCents: 1200, gebuehrCents: 72, gesamtCents: 1272, jePosition: [72] })
    // 2,49 € × 6 % = 14,94 Cent → 15
    expect(gebuehrJeStueckCents(249, 600)).toBe(15)
    // 0,50 € × 6 % = 3 Cent glatt — kein Cent zu viel
    expect(gebuehrJeStueckCents(50, 600)).toBe(3)
    expect(endpreisJeStueckCents(400, 600)).toBe(424)
  })

  it('je Stück gerundet, nicht auf die Summe: 10 × 1,01 € → 10 × 7 Cent', () => {
    expect(bestellGebuehr([{ preisCents: 101, menge: 10 }], 600).gebuehrCents).toBe(70) // 10 × 7; auf 10,10 € wären es 61
  })

  it('Endpreis für die Anzeige: ohne Hofpreis der Preis selbst', () => {
    expect(anzeigePreisCents(400, null)).toBe(400)
    expect(anzeigePreisCents(400, { hundertstel: 600 })).toBe(424)
    expect(endpreisEuro(4, { hundertstel: 600 })).toBe(4.24)
    expect(endpreisEuro(4, null)).toBe(4)
    expect(endpreisEuro(19.99, { hundertstel: 600 })).toBe(21.19)
  })
})

describe('Mindestbestellwert', () => {
  it('9,99 € reicht nicht, 10,00 € reicht', () => {
    expect(mindestbestellwertErreicht(999)).toBe(false)
    expect(mindestbestellwertErreicht(1000)).toBe(true)
    expect(MINDESTBESTELLWERT_SATZ).toBe('Mindestbestellwert 10 € bei diesem Hof')
  })
})

describe('Einzug ab und Einzug', () => {
  const stichtag = tag('2027-02-01')
  const einstellung = { hofpreisModellAb: stichtag }

  it('Farm.einzugAb geht vor; ohne Gründung der Stichtag', () => {
    expect(einzugAbFuer({ einzugAb: tag('2027-05-01') }, einstellung, bildeGruendungBis('2027-12-31'))).toEqual(tag('2027-05-01'))
    expect(einzugAbFuer({ einzugAb: null }, einstellung, null)).toEqual(stichtag)
  })

  it('Gründungshof: der Tag nach gruendungBis, wenn er später als der Stichtag ist, sonst der Stichtag', () => {
    expect(einzugAbFuer({ einzugAb: null }, einstellung, bildeGruendungBis('2027-12-31'))).toEqual(tag('2028-01-01'))
    expect(einzugAbFuer({ einzugAb: null }, einstellung, bildeGruendungBis('2026-12-31'))).toEqual(stichtag)
  })

  const jetzt = tag('2027-03-01')
  it('online stripe; bar vor Einzug erlassen; mit Mandat sepa; ohne Pflicht ueberweisung; sonst nicht möglich', () => {
    const hof = { einzugAb: stichtag, barMandatPflicht: true, sepaMandatAm: null }
    expect(einzugFuer(hof, 'ONLINE', jetzt)).toBe('stripe')
    expect(einzugFuer({ ...hof, einzugAb: tag('2028-01-01') }, 'ONSITE_CASH', jetzt)).toBe('erlassen')
    expect(einzugFuer({ ...hof, sepaMandatAm: tag('2027-01-10') }, 'ONSITE_CASH', jetzt)).toBe('sepa')
    expect(einzugFuer({ ...hof, barMandatPflicht: false }, 'ONSITE_CASH', jetzt)).toBe('ueberweisung')
    expect(einzugFuer(hof, 'ONSITE_CASH', jetzt)).toBeNull()
  })

  it('barMoeglich: bisher immer; hofpreis ohne Mandat bei Pflicht nach Einzugsbeginn nicht', () => {
    expect(barMoeglich({ modell: 'bisher' }, jetzt)).toBe(true)
    const lage: GebuehrLage = { modell: 'hofpreis', hundertstel: 600, einzugAb: stichtag, barMandatPflicht: true, sepaMandatAm: null }
    expect(barMoeglich(lage, jetzt)).toBe(false)
    expect(barMoeglich({ ...lage, einzugAb: tag('2028-01-01') }, jetzt)).toBe(true)
    expect(barMoeglich({ ...lage, barMandatPflicht: false }, jetzt)).toBe(true)
    expect(barMoeglich({ ...lage, sepaMandatAm: stichtag }, jetzt)).toBe(true)
  })
})

describe('Wache: derselbe Korb kostet online und bar dasselbe', () => {
  // Kleiner deterministischer Zufall (LCG) — jeder Lauf prüft dieselben 500 Körbe.
  let saat = 197
  const zufall = (bis: number): number => {
    saat = (saat * 1103515245 + 12345) % 2147483648
    return saat % bis
  }

  // Euro wie im Korb (CartItem.price): ganze Cent / 100 ist als Text genau der
  // Dezimalwert, alsCents in kassenBetraege liest ihn verlustfrei zurück.
  const zufallsKorb = () =>
    Array.from({ length: 1 + zufall(6) }, (_, j) => ({ productId: `p${j}`, price: (1 + zufall(9999)) / 100, quantity: 1 + zufall(9) }))

  /** Die Körbe, bei denen online und bar über den echten Kassenweg (kassenBetraege) verschieden kosten. */
  function abweichendeKoerbe(hofFuer: () => KassenHof, jetzt: Date): number {
    let abweichend = 0
    for (let i = 0; i < 500; i += 1) {
      const hof = hofFuer()
      const korb = zufallsKorb()
      const online = kassenBetraege(korb, hof, jetzt, 'ONLINE')
      const bar = kassenBetraege(korb, hof, jetzt, 'ONSITE_CASH')
      if (online.gesamtCents !== bar.gesamtCents || online.gebuehrCents !== bar.gebuehrCents) abweichend += 1
    }
    return abweichend
  }

  const HOF_BISHER_MIT_GEBUEHR = { serviceFeePercent: 5, serviceFeeMinCents: 50, serviceFeeActiveFrom: '2026-01-01T00:00:00.000Z' }
  // Vor dem Stichtag für Bar (Register B1): bar ohne Servicegebühr, online mit — die Rechnung weicht ab.
  const VOR_BAR_STICHTAG = new Date(BAR_SERVICEGEBUEHR_AB.getTime() - 24 * 60 * 60 * 1000)

  it('500 zufällige Körbe im Hofpreis-Modell: kassenBetraege ONLINE = ONSITE_CASH, Gesamt = Summe der Endpreise × Menge', () => {
    const hofpreisHof = (): KassenHof => ({ ...HOF_BISHER_MIT_GEBUEHR, preisAnzeige: { hundertstel: 100 + zufall(1400) } })
    // Auch vor dem Bar-Stichtag: Im Hofpreis-Modell gibt es keinen Bar-Rabatt.
    expect(abweichendeKoerbe(hofpreisHof, VOR_BAR_STICHTAG)).toBe(0)
    for (let i = 0; i < 100; i += 1) {
      const hundertstel = 100 + zufall(1400)
      const korb = zufallsKorb()
      const bar = kassenBetraege(korb, { ...HOF_BISHER_MIT_GEBUEHR, preisAnzeige: { hundertstel } }, VOR_BAR_STICHTAG, 'ONSITE_CASH')
      const ausEndpreisen = korb.reduce((s, p) => s + p.quantity * endpreisJeStueckCents(alsCents(String(p.price)), hundertstel), 0)
      expect(bar.gesamtCents).toBe(ausEndpreisen)
      expect(Number.isInteger(bar.gebuehrCents)).toBe(true)
    }
  })

  it('Gegenprobe: dieselbe Prüfung schlägt an, wenn bar anders rechnet (Modell bisher vor dem Bar-Stichtag)', () => {
    expect(abweichendeKoerbe(() => HOF_BISHER_MIT_GEBUEHR, VOR_BAR_STICHTAG)).toBeGreaterThan(0)
  })

  it('Gegenprobe: Prozent auf die Summe weicht bei manchen Körben ab — deshalb je Stück', () => {
    const korb = [{ preisCents: 101, menge: 10 }]
    expect(bestellGebuehr(korb, 600).gebuehrCents).not.toBe(gebuehrJeStueckCents(1010, 600))
  })
})

describe('Wache: kein Float in plattformgebuehr.ts', () => {
  const quelle = readFileSync(join(process.cwd(), 'src/lib/plattformgebuehr.ts'), 'utf8')
  const code = quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const verboten = [/\bparseFloat\b/, /\.toFixed\(/, /Math\.(round|ceil)\(/, /\b\d+\.\d+\b/, /\bNumber\(/]

  it.each(verboten.map((m) => [m.source, m] as const))('kein %s', (_name, muster) => {
    expect(code).not.toMatch(muster)
  })

  it('Gegenprobe: das Muster findet eine Gleitkommarechnung', () => {
    expect('const x = preis * 0.06').toMatch(verboten[3])
    expect('Math.ceil(a)').toMatch(verboten[2])
  })
})

describe('Register N8: Hof-Bestelldetail nimmt die Gebührenwörter aus den Konstanten', () => {
  /** Die Stellen, an denen das Wort im Code selbst steht statt aus PLATTFORMGEBUEHR_BEZEICHNUNG/SERVICEGEBUEHR_BEZEICHNUNG. */
  const woerterImCode = (quelle: string): string[] =>
    quelle
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .match(/Plattformgebühr|Servicegebühr/g) ?? []

  it('bestell-detail.tsx schreibt „Plattformgebühr“/„Servicegebühr“ nirgends selbst', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/components/hof-bestellungen/bestell-detail.tsx'), 'utf8')
    expect(woerterImCode(quelle)).toEqual([])
    expect(quelle).toContain('PLATTFORMGEBUEHR_BEZEICHNUNG')
    expect(quelle).toContain('SERVICEGEBUEHR_BEZEICHNUNG')
  })

  it('Gegenprobe: ein selbst geschriebenes Wort fällt auf, ein Kommentar nicht', () => {
    expect(woerterImCode("const wort = betrag.hofpreis ? 'Plattformgebühr' : 'Servicegebühr'")).toHaveLength(2)
    expect(woerterImCode('// Die Plattformgebühr ist Teil des Preises')).toEqual([])
  })
})
