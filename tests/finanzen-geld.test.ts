/**
 * Die Summen von Admin › Geld in src/lib/finanzen.ts (Register N37, Nr. 191) —
 * rein, in ganzen Cent. Beweist:
 *  - Stripe-Gebühren des Monats aus den Tageszeilen (nur Tage des Monats).
 *  - Kosten = Stripe-Gebühren + Betrieb; Ergebnis = Servicegebühr − Kosten.
 *  - Erstattungen: Summe, Zahl der Bestellungen, offene.
 *  - Prüfliste des Monatsabschlusses und der Grund, wenn etwas offen ist.
 *  - Welche abgeschlossenen Monate eine Kostenänderung berührt.
 */
import { describe, it, expect } from 'vitest'
import {
  abgeschlosseneMonateBetroffen,
  erstattungenImMonat,
  geldErgebnisCents,
  geldKosten,
  kostenGrundFehlt,
  monateZwischenEnden,
  monatsabschlussMoeglich,
  monatsabschlussPruefliste,
  monatsabschlussZeile,
  stripeGebuehrenImMonat,
} from '@/lib/finanzen'

const ALLES_ERLEDIGT = { abgleichNachMonatsende: true, abweichungen: 0, erstattungenOffen: 0, kostenPosten: 3, csvGeladen: true }

describe('Summen', () => {
  it('Stripe-Gebühren des Monats: nur die Tage des Monats, ganze Cent', () => {
    const tage = [
      { tag: '2026-09-30', cents: 61 },
      { tag: '2026-10-01', cents: 52 },
      { tag: '2026-10-31', cents: 48 },
      { tag: '2026-11-01', cents: 70 },
    ]
    expect(stripeGebuehrenImMonat(tage, '2026-10')).toBe(100)
    expect(stripeGebuehrenImMonat([], '2026-10')).toBe(0)
  })

  it('Kosten = Stripe + Betrieb; Ergebnis = Servicegebühr − Kosten (Mockup: 189,00 + 46,50; 321,40 → 85,90)', () => {
    const kosten = geldKosten(18_900, 4_650)
    expect(kosten).toEqual({ stripeCents: 18_900, betriebCents: 4_650, cents: 23_550 })
    expect(geldErgebnisCents(32_140, kosten)).toBe(8_590)
  })

  it('Erstattungen: Summe, Bestellungen mit Erstattung (auch offene), offene', () => {
    expect(
      erstattungenImMonat([
        { erstattetCents: 2573, erstattungOffen: false },
        { erstattetCents: 420, erstattungOffen: false },
        { erstattetCents: 0, erstattungOffen: true },
        { erstattetCents: 0, erstattungOffen: false },
      ])
    ).toEqual({ cents: 2993, anzahl: 3, offen: 1 })
  })
})

describe('Monatsabschluss', () => {
  it('alles erledigt → möglich, „4 von 4 erledigt“', () => {
    const punkte = monatsabschlussPruefliste(ALLES_ERLEDIGT)
    expect(punkte.map((p) => p.erledigt)).toEqual([true, true, true, true])
    expect(monatsabschlussMoeglich(punkte)).toEqual({ moeglich: true })
    expect(monatsabschlussZeile(punkte)).toBe('4 von 4 erledigt')
  })

  it('je offener Punkt ein Grund; der Abgleich zählt erst nach einem Lauf nach dem Monatsende', () => {
    expect(monatsabschlussMoeglich(monatsabschlussPruefliste({ ...ALLES_ERLEDIGT, abweichungen: 2, csvGeladen: false }))).toEqual({
      moeglich: false,
      grund: 'Geht erst, wenn alles erledigt ist: 2 Abweichungen ungeklärt, die CSV ist nach dem Monatsende noch nicht geladen.',
    })
    const ungeprueft = monatsabschlussPruefliste({ ...ALLES_ERLEDIGT, abgleichNachMonatsende: false })
    expect(ungeprueft[0]).toMatchObject({ erledigt: false, offen: 'der Abgleich ist nach dem Monatsende noch nicht gelaufen' })
    expect(monatsabschlussPruefliste({ ...ALLES_ERLEDIGT, kostenPosten: 0 })[2]?.erledigt).toBe(false)
    expect(monatsabschlussPruefliste({ ...ALLES_ERLEDIGT, erstattungenOffen: 1 })[1]?.offen).toBe('1 Erstattung offen')
  })
})

describe('Kosten nach dem Abschluss: welche Monate berührt sind', () => {
  const ABGESCHLOSSEN = ['2026-08', '2026-09']

  it('[von, bis] und ohne Ende', () => {
    expect(abgeschlosseneMonateBetroffen(ABGESCHLOSSEN, '2026-09', null)).toEqual(['2026-09'])
    expect(abgeschlosseneMonateBetroffen(ABGESCHLOSSEN, '2026-01', '2026-08')).toEqual(['2026-08'])
    expect(abgeschlosseneMonateBetroffen(ABGESCHLOSSEN, '2026-10', null)).toEqual([])
  })

  it('zwischen altem und neuem Ende: nur die Monate dazwischen', () => {
    expect(monateZwischenEnden(null, '2026-08')).toEqual({ von: '2026-09', bis: null })
    expect(monateZwischenEnden('2026-12', '2026-08')).toEqual({ von: '2026-09', bis: '2026-12' })
    expect(monateZwischenEnden('2026-08', '2026-10')).toEqual({ von: '2026-09', bis: '2026-10' })
    expect(monateZwischenEnden('2026-09', null)).toEqual({ von: '2026-10', bis: null })
    expect(monateZwischenEnden('2026-09', '2026-09')).toBeNull()
    expect(monateZwischenEnden(null, null)).toBeNull()
  })

  it('der Satz nennt die Monate', () => {
    expect(kostenGrundFehlt(['2026-09'])).toBe('September 2026 ist abgeschlossen. Schreib dazu, warum du die Kosten änderst.')
    expect(kostenGrundFehlt(['2026-08', '2026-09'])).toBe('August 2026, September 2026 sind abgeschlossen. Schreib dazu, warum du die Kosten änderst.')
  })
})
