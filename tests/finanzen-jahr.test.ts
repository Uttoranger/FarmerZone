/**
 * Admin › Finanzen im Jahr (Register N15, Ergänzung Nr. 100) — das Jahr ist die
 * SUMME SEINER MONATE aus denselben Funktionen wie der Monat; gerechnet wird
 * nichts Neues. Beweist, an den echten Abfragen (nur Prisma ersetzt, mit
 * erfundenen Zeilen und Wiener Monatsgrenzen):
 *  - `getFinanzenJahr` = Summe der Monate aus `getFinanzen`, Monat für Monat und
 *    im Ganzen — für ein Jahr mit monatlichen, jährlichen (über den Jahreswechsel
 *    umgelegten), einmaligen und beendeten Posten und mit Bestellungen um Mitternacht
 *    in Wien (Jahreswechsel, Monatswechsel).
 *  - Das laufende Jahr zählt bis heute: Monate danach sind „offen" (null), nicht 0.
 *  - Testzahlungen zählen nicht (Z4), stornierte und erstattete Bestellungen auch nicht.
 *  - Es bleiben drei Abfragen, egal wie viele Monate.
 *  - Die Hochrechnung steht nur im laufenden Jahr, nur mit vollen Monaten, nie in einer Summe.
 *  - Ein Jahr außerhalb der Daten ist das laufende; das Vorjahr zum Vergleich gibt es nur mit Daten.
 *  - Die Bausteine der CSV: Euro mit Komma, Formelzeichen entschärft, BOM, zwei Kopfzeilen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', async () => ({ prisma: (await import('./finanzen-jahr-daten')).prismaAttrappe }))

import { getFinanzen, getFinanzenJahr } from '@/server/queries/finanzen'
import {
  ausreisserImMonat,
  csvBetrag,
  csvFeld,
  ersteDatenJahr,
  jahrAlsCsv,
  jahrImBereich,
  jahrKennzahlen,
  rechneJahr,
  type JahrMonatZahlen,
} from '@/lib/finanzen'
import { monatsschluessel } from '@/lib/servicegebuehr'
import { JETZT, POSTEN, STICHTAG, prismaAttrappe } from './finanzen-jahr-daten'

beforeEach(() => vi.clearAllMocks())

const monateVon = (jahr: number): string[] => Array.from({ length: 12 }, (_, i) => monatsschluessel(jahr, i + 1))

describe('getFinanzenJahr = Summe der Monate aus getFinanzen', () => {
  it('2026 (laufendes Jahr, bis heute): jeder gezählte Monat und die Summe stimmen mit der Monatsansicht überein', async () => {
    const jahr = await getFinanzenJahr(2026, JETZT, STICHTAG)
    let servicegebuehren = 0
    let kosten = 0
    let bestellungen = 0
    for (const m of jahr.rechnung.monate.filter((x) => x.zahlen !== null)) {
      const monat = await getFinanzen(m.monat, JETZT, STICHTAG)
      expect(m.zahlen?.servicegebuehrCents, m.monat).toBe(monat.einnahmen.gezaehltCents)
      expect(m.zahlen?.kostenCents, m.monat).toBe(monat.kosten.cents)
      expect(m.zahlen?.bestellungen, m.monat).toBe(monat.einnahmen.bestellungen)
      servicegebuehren += monat.einnahmen.gezaehltCents
      kosten += monat.kosten.cents
      bestellungen += monat.einnahmen.bestellungen
    }
    expect(jahr.rechnung.servicegebuehrenCents).toBe(servicegebuehren)
    expect(jahr.rechnung.kostenCents).toBe(kosten)
    expect(jahr.rechnung.bestellungen).toBe(bestellungen)
    expect(jahr.rechnung.ergebnisCents).toBe(servicegebuehren - kosten)
    // Zehn gezählte Monate, zwei offene — und die Summe war nicht leer.
    expect(jahr.rechnung.monate.filter((m) => m.zahlen !== null)).toHaveLength(10)
    expect(servicegebuehren).toBeGreaterThan(0)
  })

  it('2025 (volles Vorjahr): alle zwölf Monate wie die Monatsansicht, auch Mai ohne die Testzahlung', async () => {
    const jahr = await getFinanzenJahr(2025, JETZT, STICHTAG)
    let servicegebuehren = 0
    for (const m of monateVon(2025)) {
      const monat = await getFinanzen(m, JETZT, STICHTAG)
      const zeile = jahr.rechnung.monate.find((x) => x.monat === m)
      expect(zeile?.zahlen?.servicegebuehrCents, m).toBe(monat.einnahmen.gezaehltCents)
      expect(zeile?.zahlen?.kostenCents, m).toBe(monat.kosten.cents)
      servicegebuehren += monat.einnahmen.gezaehltCents
    }
    expect(jahr.rechnung.servicegebuehrenCents).toBe(servicegebuehren)
    // Die Testzahlung vom Mai (999 Cent) steht in keiner Zahl (Z4).
    expect(jahr.rechnung.monate[4]?.zahlen?.servicegebuehrCents).toBe(0)
    expect(jahr.rechnung.monate[4]?.zahlen?.bestellungen).toBe(0)
  })

  it('Gegenprobe: ohne Stichtag der Live-Schaltung zählt dieselbe Bestellung vom Mai mit', async () => {
    const jahr = await getFinanzenJahr(2025, JETZT, null)
    expect(jahr.rechnung.monate[4]?.zahlen?.servicegebuehrCents).toBe(999)
  })

  it('Wiener Monatsgrenzen: 23:30 am 31.12. ist noch 2025, 00:30 am 1.1. schon 2026; 30.9. und 1.10. ebenso', async () => {
    const j2026 = await getFinanzenJahr(2026, JETZT, STICHTAG)
    const j2025 = await getFinanzenJahr(2025, JETZT, STICHTAG)
    // Dezember 2025: 111 liegt drin (und Dezember hat sonst keine Bestellung), 222 nicht.
    expect(j2025.rechnung.monate[11]?.zahlen?.servicegebuehrCents).toBe(111)
    // Jänner 2026: die 222 aus der Silvesternacht plus die drei regulären Bestellungen zu 141.
    expect(j2026.rechnung.monate[0]?.zahlen?.servicegebuehrCents).toBe(222 + 3 * 141)
    // September 2026: neun Bestellungen zu 149 plus die 333 von 23:30 Wien.
    expect(j2026.rechnung.monate[8]?.zahlen?.servicegebuehrCents).toBe(11 * 149 + 333)
    // Oktober 2026: zwölf zu 150 plus die 444 von 00:30 Wien.
    expect(j2026.rechnung.monate[9]?.zahlen?.servicegebuehrCents).toBe(12 * 150 + 444)
    // Nichts doppelt, nichts verloren — von Hand gezählt (Fixture): 2025 sind es 2+3+4+5+6+7 und die Silvesterbestellung,
    // 2026 die Monate 4, 4, 5, 6, 7, 8, 9, 10, 12, 13; die Testzahlung, die stornierte und die erstattete Bestellung fehlen.
    expect(j2025.rechnung.bestellungen).toBe(28)
    expect(j2026.rechnung.bestellungen).toBe(78)
  })

  it('das laufende Jahr zählt bis heute: Monate danach sind offen (null), nicht 0 — auch bei den Kosten', async () => {
    const jahr = await getFinanzenJahr(2026, JETZT, STICHTAG)
    expect(jahr.rechnung.monate[10]?.zahlen).toBeNull()
    expect(jahr.rechnung.monate[11]?.zahlen).toBeNull()
    expect(jahr.rechnung.zaehltBis).toBe('2026-10')
    // Die Monatsansicht von November kennt Kosten (der Posten läuft weiter) — im Jahr stehen sie noch nicht.
    const november = await getFinanzen('2026-11', JETZT, STICHTAG)
    expect(november.kosten.cents).toBeGreaterThan(0)
    const nachRhythmus = jahr.rechnung.kostenNachRhythmus
    expect(nachRhythmus.MONATLICH + nachRhythmus.JAEHRLICH + nachRhythmus.EINMALIG).toBe(jahr.rechnung.kostenCents)
  })

  it('die Posten: monatlich, beendet, einmalig und der Jahresposten über den Jahreswechsel — von Hand nachgerechnet', async () => {
    const j2026 = (await getFinanzenJahr(2026, JETZT, STICHTAG)).rechnung
    const nach = (id: string) => j2026.posten.find((p) => p.id === id)
    // Hosting: 10 Monate mal 18,50 €.
    expect(nach('p1')?.imJahrCents).toBe(10 * 1850)
    expect(nach('p1')?.monate).toBe(10)
    // Werkzeug: nur Jänner bis Juni (bis zählt einschließlich) = 6 mal 5 €.
    expect(nach('p4')?.imJahrCents).toBe(6 * 500)
    // Marke: einmalig im Mai.
    expect(nach('p3')?.imJahrCents).toBe(28000)
    expect(nach('p3')?.einmaligImMonat).toBe('2026-05')
    // Domain, 100 € im Jahr ab September 2025: Jänner bis August 2026 achtmal 833, September und Oktober je 834 (2. Abo-Jahr).
    expect(nach('p2')?.imJahrCents).toBe(8 * 833 + 2 * 834)
    const j2025 = (await getFinanzenJahr(2025, JETZT, STICHTAG)).rechnung
    // Im Vorjahr: September bis Dezember je 834 — zusammen mit Jänner bis August 2026 genau das erste Abo-Jahr (100 €).
    expect(j2025.posten.find((p) => p.id === 'p2')?.imJahrCents).toBe(4 * 834)
    expect(4 * 834 + 8 * 833).toBe(10000)
    // Summe der Posten = Kosten des Jahres, Anteile zeigen auf 100 %.
    expect(j2026.posten.reduce((s, p) => s + p.imJahrCents, 0)).toBe(j2026.kostenCents)
    expect(j2026.kostenCents).toBe(10 * 1850 + 3000 + 28000 + 8 * 833 + 2 * 834)
  })

  it('immer drei Abfragen — für das Jahr wie für den Monat, egal wie viele Monate', async () => {
    await getFinanzenJahr(2026, JETZT, STICHTAG)
    expect(prismaAttrappe.kostenposten.findMany).toHaveBeenCalledTimes(1)
    expect(prismaAttrappe.order.findFirst).toHaveBeenCalledTimes(1)
    expect(prismaAttrappe.order.findMany).toHaveBeenCalledTimes(1)
  })

  it('das Fenster der Bestellungen reicht vom Jänner des Vorjahrs bis zum Ende des heutigen Monats (Wiener Zeit)', async () => {
    await getFinanzenJahr(2026, JETZT, STICHTAG)
    const where = (prismaAttrappe.order.findMany.mock.calls[0] as unknown as [{ where: { createdAt: { gte: Date; lt: Date } } }])[0].where
    expect(where.createdAt.gte.toISOString()).toBe('2024-12-31T23:00:00.000Z')
    expect(where.createdAt.lt.toISOString()).toBe('2026-10-31T23:00:00.000Z')
  })
})

describe('welches Jahr, welches Vorjahr', () => {
  it('ein Jahr vor den ersten Daten, nach dem laufenden oder Unsinn ist das laufende', async () => {
    expect((await getFinanzenJahr(2020, JETZT, STICHTAG)).jahr).toBe(2026)
    expect((await getFinanzenJahr(2024, JETZT, STICHTAG)).jahr).toBe(2026)
    expect((await getFinanzenJahr(2027, JETZT, STICHTAG)).jahr).toBe(2026)
    expect((await getFinanzenJahr(2025, JETZT, STICHTAG)).jahr).toBe(2025)
    expect(jahrImBereich(2025, 2025, 2026)).toBe(2025)
    expect(jahrImBereich(2024, 2025, 2026)).toBe(2026)
    expect(jahrImBereich(2027, 2025, 2026)).toBe(2026)
  })

  it('das erste Jahr mit Daten: das früheste von Bestellung und Kostenposten, ohne beides das laufende', () => {
    expect(ersteDatenJahr('2026-02', ['2025-03', '2027-01'], '2026-10')).toBe(2025)
    expect(ersteDatenJahr(null, ['2026-05'], '2026-10')).toBe(2026)
    expect(ersteDatenJahr(null, [], '2026-10')).toBe(2026)
  })

  it('Blättern: zurück nur bis zum ersten Jahr, vor nur bis zum laufenden', async () => {
    const jetzt = await getFinanzenJahr(2026, JETZT, STICHTAG)
    expect(jetzt.vorigesJahr).toBe(2025)
    expect(jetzt.naechstesJahr).toBeNull()
    const erstes = await getFinanzenJahr(2025, JETZT, STICHTAG)
    expect(erstes.vorigesJahr).toBeNull()
    expect(erstes.naechstesJahr).toBe(2026)
  })

  it('der Vergleich: das Vorjahr hat Daten ab 2026; im ersten Jahr nicht, mit „ab 2026 + 1“', async () => {
    const j2026 = await getFinanzenJahr(2026, JETZT, STICHTAG)
    expect(j2026.vorjahr?.jahr).toBe(2025)
    expect(j2026.vorjahr?.servicegebuehrenCents).toBe((await getFinanzenJahr(2025, JETZT, STICHTAG)).rechnung.servicegebuehrenCents)
    const j2025 = await getFinanzenJahr(2025, JETZT, STICHTAG)
    expect(j2025.vorjahr).toBeNull()
    expect(j2025.vergleichAb).toBe(2026)
  })

  it('der Hinweis auf Testzahlungen steht, wenn eine gezeigte Zahl eine auslässt — sonst nicht', async () => {
    expect((await getFinanzenJahr(2025, JETZT, STICHTAG)).testzahlungenHinweis).not.toBeNull()
    // Stichtag vor allen Bestellungen: keine Testzahlung, kein Hinweis.
    expect((await getFinanzenJahr(2025, JETZT, new Date('2025-01-01T00:00:00Z'))).testzahlungenHinweis).toBeNull()
    expect((await getFinanzenJahr(2025, JETZT, null)).testzahlungenHinweis).toBeNull()
  })
})

describe('die Hochrechnung „Bis Jahresende ≈“', () => {
  const posten = POSTEN.map((p) => ({
    id: p.id,
    name: p.name,
    kategorie: p.kategorie as 'HOSTING',
    betragCents: Math.round(p.betrag.toNumber() * 100),
    rhythmus: p.rhythmus as 'MONATLICH',
    ab: monatsschluessel(p.ab.getUTCFullYear(), p.ab.getUTCMonth() + 1),
    bis: p.bis === null ? null : monatsschluessel(p.bis.getUTCFullYear(), p.bis.getUTCMonth() + 1),
  }))

  it('im laufenden Jahr: Schnitt der letzten drei vollen Monate (Jul–Sep) mal die zwei offenen Monate, auf das Ergebnis bis heute', async () => {
    const r = (await getFinanzenJahr(2026, JETZT, STICHTAG)).rechnung
    const volle = r.monate.slice(6, 9).map((m) => m.zahlen?.ergebnisCents ?? NaN)
    const schnitt = Math.round(volle.reduce((a, b) => a + b, 0) / 3)
    expect(r.hochrechnung).toEqual({
      ergebnisCents: r.ergebnisCents + 2 * schnitt,
      schnittCents: schnitt,
      offeneMonate: 2,
      von: '2026-07',
      bis: '2026-09',
    })
    // Nur ein Hinweis: Das Ergebnis des Jahres bleibt Summe der Monate.
    expect(r.ergebnisCents).toBe(r.servicegebuehrenCents - r.kostenCents)
  })

  it('Gegenprobe: im vergangenen Jahr keine; im Dezember (keine offenen Monate) keine; im Jänner (kein voller Monat) keine', async () => {
    expect((await getFinanzenJahr(2025, JETZT, STICHTAG)).rechnung.hochrechnung).toBeNull()
    const eingabe = { jahr: 2026, bestellungen: [], posten, stripeLiveAb: STICHTAG }
    expect(rechneJahr({ ...eingabe, heute: '2026-12' }).hochrechnung).toBeNull()
    expect(rechneJahr({ ...eingabe, heute: '2026-01' }).hochrechnung).toBeNull()
    // Kontrolle: im Februar gibt es einen vollen Monat (Jänner) und zehn offene.
    const februar = rechneJahr({ ...eingabe, heute: '2026-02' }).hochrechnung
    expect(februar?.von).toBe('2026-01')
    expect(februar?.bis).toBe('2026-01')
    expect(februar?.offeneMonate).toBe(10)
  })

  it('in den Kennzahlen: die Kachel „Bis Jahresende“ nur im laufenden Jahr, nie in den Summen der anderen', async () => {
    const heute = (await getFinanzenJahr(2026, JETZT, STICHTAG)).rechnung
    const vorjahr = (await getFinanzenJahr(2025, JETZT, STICHTAG)).rechnung
    expect(jahrKennzahlen(heute, 2026).map((k) => k.id)).toEqual(['servicegebuehren', 'kosten', 'ergebnis', 'jahresende'])
    expect(jahrKennzahlen(vorjahr, 2026).map((k) => k.id)).toEqual(['servicegebuehren', 'kosten', 'ergebnis'])
    const jahresende = jahrKennzahlen(heute, 2026).find((k) => k.id === 'jahresende')
    expect(jahresende?.wert.startsWith('≈')).toBe(true)
    expect(jahresende?.satz).toContain('nur als Hinweis')
    // Der Ton des Ergebnisses: grün nur bei einem Plus, orange bei einem Minus.
    const ergebnis = (r: typeof heute) => jahrKennzahlen(r, 2026).find((k) => k.id === 'ergebnis')?.ton
    expect(ergebnis({ ...heute, ergebnisCents: 100 })).toBe('laeuft')
    expect(ergebnis({ ...heute, ergebnisCents: 0 })).toBe('neutral')
    expect(ergebnis({ ...heute, ergebnisCents: -100 })).toBe('tun')
  })
})

describe('Ausreißer am Balken', () => {
  const zahlen = (kosten: number, einmalig: JahrMonatZahlen['einmalig']): JahrMonatZahlen => ({
    servicegebuehrCents: 0,
    kostenCents: kosten,
    ergebnisCents: -kosten,
    bestellungen: 0,
    einmalig,
  })

  it('ein einmaliger Posten, der mehr als die Hälfte der Kosten des Monats ausmacht, trägt seinen Namen', () => {
    expect(ausreisserImMonat(zahlen(32160, { name: 'Marke Beispiel', cents: 28000 }))).toBe('Marke Beispiel')
  })

  it('Gegenprobe: ein kleiner einmaliger Posten neben vielen laufenden und ein Monat ohne einmaligen Posten sind keine Ausreißer', () => {
    expect(ausreisserImMonat(zahlen(6300, { name: 'Domain Beispiel', cents: 1490 }))).toBeNull()
    expect(ausreisserImMonat(zahlen(4160, null))).toBeNull()
  })

  it('die Jahresrechnung benennt ihn im Mai, sonst in keinem Monat', async () => {
    const monate = (await getFinanzenJahr(2026, JETZT, STICHTAG)).rechnung.monate
    const mitAusreisser = monate.filter((m) => m.zahlen && ausreisserImMonat(m.zahlen) !== null).map((m) => m.monat)
    expect(mitAusreisser).toEqual(['2026-05'])
  })
})

describe('die CSV für die Steuerberatung', () => {
  it('Euro mit Komma, ohne Tausenderpunkt; negativ mit Minus; ganze Cent, nie eine Gleitkommazahl', () => {
    expect(csvBetrag(128450)).toBe('1284,50')
    expect(csvBetrag(5)).toBe('0,05')
    expect(csvBetrag(0)).toBe('0,00')
    expect(csvBetrag(-10)).toBe('-0,10')
    expect(csvBetrag(-20310)).toBe('-203,10')
  })

  it('Felder: Semikolon und Anführungszeichen werden eingefasst, Formelzeichen entschärft, Umlaute bleiben', () => {
    expect(csvFeld('Hosting')).toBe('Hosting')
    expect(csvFeld('Werkzeug; groß')).toBe('"Werkzeug; groß"')
    expect(csvFeld('Das "beste" Paket')).toBe('"Das ""beste"" Paket"')
    expect(csvFeld('=SUMME(A1:A9)')).toBe("'=SUMME(A1:A9)")
    expect(csvFeld('+43 Beispiel')).toBe("'+43 Beispiel")
    expect(csvFeld('@Beispiel')).toBe("'@Beispiel")
    expect(csvFeld('Übung März')).toBe('Übung März')
  })

  it('das Jahr: BOM, Semikolon, zwei Kopfzeilen, zwölf Monate (offene leer), Summenzeilen = die Zahlen der Ansicht', async () => {
    const r = (await getFinanzenJahr(2026, JETZT, STICHTAG)).rechnung
    const csv = jahrAlsCsv(r)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const zeilen = csv.slice(1).split('\r\n')
    expect(zeilen[0]).toBe('Monat;Servicegebühren (€);Kosten (€);Ergebnis (€);Bestellungen')
    // Zeilen 1–12: die Monate; offene Monate mit leeren Zahlen, nicht mit 0.
    expect(zeilen.slice(1, 13).map((z) => z.split(';')[0])).toEqual([
      'Jänner 2026', 'Februar 2026', 'März 2026', 'April 2026', 'Mai 2026', 'Juni 2026',
      'Juli 2026', 'August 2026', 'September 2026', 'Oktober 2026', 'November 2026', 'Dezember 2026',
    ])
    expect(zeilen[11]).toBe('November 2026;;;;')
    expect(zeilen[12]).toBe('Dezember 2026;;;;')
    expect(zeilen[13]).toBe(
      `Summe 2026;${csvBetrag(r.servicegebuehrenCents)};${csvBetrag(r.kostenCents)};${csvBetrag(r.ergebnisCents)};${r.bestellungen}`
    )
    // Summe der Monatszeilen = Summenzeile (von Hand aus dem Text gerechnet, nicht aus der Rechnung).
    const zahl = (text: string) => Math.round(Number((text ?? '').replace(',', '.')) * 100)
    const monatsZeilen = zeilen.slice(1, 11).map((z) => z.split(';'))
    expect(monatsZeilen.reduce((s, z) => s + zahl(z[1]!), 0)).toBe(r.servicegebuehrenCents)
    expect(monatsZeilen.reduce((s, z) => s + zahl(z[2]!), 0)).toBe(r.kostenCents)
    expect(monatsZeilen.reduce((s, z) => s + Number(z[4]), 0)).toBe(r.bestellungen)
    // Zweiter Block: Leerzeile, Kopfzeile, ein Posten je Zeile, Summe.
    expect(zeilen[14]).toBe('')
    expect(zeilen[15]).toBe('Kostenposten;Rhythmus;Betrag (€);Monate im Jahr;Im Jahr (€)')
    expect(zeilen).toContain('Hosting Beispiel;monatlich;18,50;10;185,00')
    expect(zeilen).toContain('Marke Beispiel;einmalig;280,00;Mai 2026;280,00')
    expect(zeilen).toContain(`Summe 2026;;;;${csvBetrag(r.kostenCents)}`)
    expect(zeilen[zeilen.length - 1]).toBe('')
  })

  it('keine Personendaten: weder Namen noch Adressen noch Kennungen der Bestellungen', async () => {
    const csv = jahrAlsCsv((await getFinanzenJahr(2026, JETZT, STICHTAG)).rechnung)
    expect(csv).not.toMatch(/@|https?:|\bcm[a-z0-9]{20,}\b/i)
  })
})
