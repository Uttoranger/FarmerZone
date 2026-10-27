/**
 * Ansichten der Monatsabrechnung (Register N38, Nr. 198) — gerendert mit
 * renderToStaticMarkup, ohne DOM, Stripe und Actions gemockt.
 *
 * Beweist: Hof › Deine Konditionen zeigt „Barzahlung“ (Satz, Einzug ab bzw.
 * erlassen, Mandat mit Bank und letzten 4 Stellen — nie mehr) und die
 * Monatsabrechnungen mit Stand als Wort; ohne Abrechnung der Leersatz. Die
 * Heute-Karte sagt „Barzahlung ist pausiert“ mit „Jetzt bezahlen“; nach einer
 * Rückbuchung ohne Knopf, mit dem Weg ins Postfach. Die Akte
 * zeigt Mandat, Quote und die Einstellungen. Der Einrichten-Schritt führt zu
 * „Lastschrift einrichten“ und zählt nicht mit.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/server/actions/lastschrift', () => ({ starteLastschrift: vi.fn(), oeffneRechnung: vi.fn() }))
vi.mock('@/server/actions/admin-plattformgebuehr', () => ({ speichereHofPlattformgebuehr: vi.fn() }))
vi.mock('@/lib/stripe-client', () => ({ getStripePromise: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/components/admin/frisch-bestaetigen', () => ({ useFrischBestaetigt: () => ({ ausfuehren: vi.fn(), dialog: null }) }))

import { Barzahlung, type BarzahlungAnzeige } from '@/components/hof-einstellungen/barzahlung'
import { LastschriftSperreKarte } from '@/components/heute/lastschrift-karte'
import { HofAktePlattformgebuehr } from '@/components/admin/hof-akte-plattformgebuehr'
import { einrichtenStand, type EinrichtenDaten } from '@/lib/einrichten'
import { LASTSCHRIFT_TEXT } from '@/lib/konditionen'

const html = (el: React.ReactElement): string => renderToStaticMarkup(el).replaceAll(' ', ' ')

const DATEN: BarzahlungAnzeige = {
  satzText: '6',
  einzugAbText: '1. Februar 2028',
  einzugBegonnen: true,
  mandat: true,
  mandatPflicht: true,
  bank: '12000',
  letzte4: '3000',
  abrechnungen: [
    { id: 'a2', monatText: 'März 2028', barCents: 342, onlineCents: 120, stand: 'gescheitert', rechnungBar: true, rechnungOnline: true },
    { id: 'a1', monatText: 'Februar 2028', barCents: 0, onlineCents: 300, stand: 'nichts', rechnungBar: false, rechnungOnline: true },
  ],
}

describe('Hof › Deine Konditionen: Barzahlung und Monatsabrechnungen', () => {
  it('Mandat mit Bank und letzten 4 Stellen, Einzug ab, Satz; Stand als Wort; PDF nur, wo es eine Rechnung gibt', () => {
    const h = html(createElement(Barzahlung, { daten: DATEN }))
    expect(h).toContain('id="barzahlung"')
    expect(h).toContain('Plattformgebühr 6 % vom Warenpreis')
    expect(h).toContain('Einzug ab 1. Februar 2028')
    expect(h).toContain('Lastschrift eingerichtet · 12000 · IBAN endet auf 3000')
    expect(h).toContain(LASTSCHRIFT_TEXT.aendern)
    expect(h).toContain('Lastschrift gescheitert')
    expect(h).toContain('nichts fällig')
    expect(h).toContain('bar € 3,42')
    expect((h.match(/Rechnung \(PDF\)/g) ?? []).length).toBe(3)
  })

  it('ohne Mandat, vor dem Einzug: „erlassen“, Pflicht-Satz und „Lastschrift einrichten“; ohne Abrechnung der Leersatz', () => {
    const h = html(createElement(Barzahlung, { daten: { ...DATEN, mandat: false, bank: null, letzte4: null, einzugBegonnen: false, abrechnungen: [] } }))
    expect(h).toContain(LASTSCHRIFT_TEXT.mandatFehlt)
    expect(h).toContain(LASTSCHRIFT_TEXT.mandatPflicht)
    expect(h).toContain(LASTSCHRIFT_TEXT.erlassen('1. Februar 2028'))
    expect(h).toContain('>Lastschrift einrichten<')
    expect(h).toContain(LASTSCHRIFT_TEXT.abrechnungenLeer)
    expect(h).toContain('data-slot="empty-state"')
    // Gegenprobe: ohne Pflicht der andere Satz.
    expect(html(createElement(Barzahlung, { daten: { ...DATEN, mandat: false, mandatPflicht: false } }))).toContain(LASTSCHRIFT_TEXT.mandatFrei)
  })
})

describe('Hof › Heute: Karte „Barzahlung ist pausiert“', () => {
  it('Titel, Satz mit dem Monat, Knopf „Jetzt bezahlen“ (≥ 44 px über die Pille)', () => {
    const h = html(createElement(LastschriftSperreKarte, { abrechnungId: 'a2', monatText: 'März 2028', stand: 'offen' }))
    expect(h).toContain(LASTSCHRIFT_TEXT.heuteTitel)
    expect(h).toContain(LASTSCHRIFT_TEXT.heuteSatz('März 2028'))
    expect(h).toContain('>Jetzt bezahlen<')
    expect(h).not.toContain(LASTSCHRIFT_TEXT.zurueckgebuchtSatz('März 2028'))
  })

  it('zurückgebucht: kein „Jetzt bezahlen“ auf die schon bezahlte Rechnung, sondern ein Satz ohne Fachbegriff und der Weg ins Postfach', () => {
    const h = html(createElement(LastschriftSperreKarte, { abrechnungId: 'a2', monatText: 'März 2028', stand: 'zurueckgebucht' }))
    expect(h).toContain(LASTSCHRIFT_TEXT.heuteTitel)
    expect(h).toContain('Die Lastschrift für März 2028 wurde zurückgebucht. Barzahlung ist pausiert – das Team meldet sich bei dir.')
    expect(h).not.toContain('Jetzt bezahlen')
    expect(h).not.toContain(LASTSCHRIFT_TEXT.heuteSatz('März 2028'))
    expect(h).toContain('href="/postfach"')
    expect(h).toContain(`>${LASTSCHRIFT_TEXT.zumPostfach}<`)
  })
})

describe('Admin › Hof-Akte: Abschnitt Plattformgebühr', () => {
  it('Mandat, Quote „nicht abgeholt bei bar, 90 Tage“, letzte Abrechnungen und Einstellungen mit Vorgabe', () => {
    const h = html(
      createElement(HofAktePlattformgebuehr, {
        daten: {
          farmId: 'hof_1',
          mandat: false,
          abrechnungen: [{ id: 'a1', monatText: 'März 2028', barCents: 342, onlineCents: 120, stand: 'bezahlt' }],
          nichtAbgeholt: { bar: 20, nicht: 3 },
          einstellungen: { satz: '6', mandatPflicht: true, sperreTage: 14, abrechnungsTag: 3, einzugAb: '', vorgabeEinzugAb: '2028-02-01' },
        },
      })
    )
    expect(h).toContain('Plattformgebühr')
    expect(h).toContain('3 von 20 (15 %)')
    expect(h).toContain('keine')
    expect(h).toContain('bar € 3,42 · online € 1,20')
    expect(h).toContain('Einzug ab (Vorgabe 2028-02-01)')
    expect(h).toContain('Mit Passkey speichern')
    expect(h).toContain('Satz und Einzug gelten nur für neue Bestellungen.')
  })
})

describe('Einrichten: Mandat-Schritt', () => {
  const daten = (sepaMandat?: boolean): EinrichtenDaten => ({
    personName: 'Probe',
    email: 'probe@example.com',
    hof: { name: 'Hof Probe', hofseite: { erledigt: 7, gesamt: 7, fehlend: [] }, produkte: 3, stripeBereit: true, abholzeitAktiv: true, freigeschaltet: true, sepaMandat },
  })

  it('ohne Mandat: Hinweis mit Link „Lastschrift einrichten“; mit Mandat: „eingerichtet“ ohne Link; zählt nie mit', () => {
    const ohne = einrichtenStand(daten(false)).schritte.find((s) => s.id === 'sepa')
    expect(ohne).toEqual(expect.objectContaining({ zustand: 'hinweis', aktion: { art: 'link', href: '/settings/konditionen#barzahlung', label: 'Lastschrift einrichten', primaer: false } }))
    const mit = einrichtenStand(daten(true))
    expect(mit.schritte.find((s) => s.id === 'sepa')).toEqual(expect.objectContaining({ zustand: 'hinweis', aktion: null, textKurz: 'eingerichtet' }))
    expect(mit.gesamt).toBe(einrichtenStand(daten(false)).gesamt)
  })
})
