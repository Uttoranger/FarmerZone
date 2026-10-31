/**
 * Die Akte eines Hofs und die Admin-Sperre in der Anzeige (Register N32, N33,
 * N34; Nachtlauf Nr. 187) — rein und gerendert ohne Browser.
 *
 * Beweist:
 *  - Antwortzeit, Abholtage, Zustandszeilen (Wort, nie nur Farbe), Wer im
 *    Protokoll („Du“, „Team“, „System“ — nie ein Name);
 *  - hofAkteAnsicht gibt kein Date und keine volle Anmelde-E-Mail weiter;
 *  - kaufSperre: die Sperre des Teams sticht die Pause, mit dem neutralen Satz;
 *  - die Akte zeigt „Vorübergehend sperren …“ bzw. „Sperre aufheben“ mit Grund,
 *    die Konto-Anfragen (Nr. 190) noch nicht;
 *  - der Dialog nennt den festen Satz für die Kundschaft;
 *  - Heute des Hofs: die Karte „Dein Hof ist vom Team gesperrt: <Grund>.“
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) =>
    createElement('a', { href, ...Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'onNavigate' && k !== 'prefetch')) }, children),
}))
vi.mock('@/server/actions/admin', () => ({ approveFarmAction: vi.fn(), revokeFarmApprovalAction: vi.fn(), rejectFarmAction: vi.fn(), setServiceFeeAction: vi.fn(), setzeGruendungBisAction: vi.fn() }))
vi.mock('@/server/actions/gruendung', () => ({ nimmAusGruendung: vi.fn(), nimmWiederAuf: vi.fn(), markiereAlsTesthof: vi.fn(), nimmTesthofZurueck: vi.fn() }))
vi.mock('@/server/actions/admin-hof', () => ({ sperreHof: vi.fn(), hebeHofSperreAuf: vi.fn() }))
vi.mock('@/server/actions/postfach', () => ({ markiereGelesenFormular: vi.fn() }))
vi.mock('@/components/hof-bestellungen/bestell-dialog', () => ({
  BestellDialog: ({ offen, titel, children }: { offen: boolean; titel: string; children?: ReactNode }) =>
    offen ? createElement('section', { 'aria-label': titel }, createElement('h2', null, titel), children) : null,
  DialogFehler: ({ text }: { text: string | null }) => (text ? createElement('p', null, text) : null),
}))

import {
  abholTageText,
  antwortzeitStunden,
  antwortzeitText,
  hofAkteAnsicht,
  protokollArtText,
  protokollWer,
  sperreKarteSatz,
  zustandZeilen,
  type HofAkteEingabe,
} from '@/lib/admin-hof-akte'
import { HOF_GESPERRT_SATZ, kaufSperre, kaufSperreHinweis } from '@/lib/bereiche-anzeige'
import { adminHofZeile } from '@/lib/admin-hoefe'
import { HofAkteAnsicht } from '@/components/admin/hof-akte-ansicht'
import { HofSperreDialog } from '@/components/admin/hof-akte-sperre-dialog'
import { TeamSperreKarte } from '@/components/heute/heute-teile'
import type { AdminHof } from '@/components/admin/hoefe-ansicht'
import { hofRohdaten } from './fabrik/hof-rohdaten'

const JETZT = new Date('2026-10-26T10:00:00.000Z')
const STD = 3_600_000
const MITTWOCH = { dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }

describe('Aktivität und Zustand', () => {
  it('Antwortzeit: Mittel aus Team-Nachricht → nächste Antwort des Hofs; SYSTEM zählt nicht', () => {
    const n = (faden: string, vonHof: boolean, stunden: number, system = false) => ({ unterhaltungId: faden, vonHof, system, am: new Date(JETZT.getTime() + stunden * STD) })
    expect(antwortzeitStunden([n('a', false, 0), n('a', true, 4), n('b', false, 0), n('b', false, 1), n('b', true, 6), n('c', false, 0, true), n('c', true, 50)])).toBe(5)
    expect(antwortzeitStunden([n('a', true, 1)])).toBeNull()
    expect(antwortzeitText(5)).toBe('≈ 5 h')
    expect(antwortzeitText(72)).toBe('≈ 3 Tage')
    expect(antwortzeitText(null)).toBe('bisher ohne Antwort')
  })

  it('Abholtage: Montag zuerst, ohne Doppelte', () => {
    expect(abholTageText([5, 2, 2])).toBe('Di und Fr')
    expect(abholTageText([0, 1, 3])).toBe('Mo, Mi und So')
    expect(abholTageText([])).toBe('')
  })

  it('Zustandszeilen tragen immer ein Wort; die Sperre steht bei der Pause', () => {
    const z = zustandZeilen({ abholTage: [], produkteImShop: 3, ausverkauft: 1, isPaused: false, gesperrt: true, stripeBereit: false, onlineAn: true, erstattungenOffen: 1 })
    expect(z.map((x) => [x.titel, x.text, x.wort])).toEqual([
      ['Abholzeiten', 'keine aktive Abholzeit', 'Achtung'],
      ['Produkte', '3 im Shop · 1 ausverkauft', 'ok'],
      ['Pause', 'nein · vom Team gesperrt', 'Achtung'],
      ['Online-Zahlung', 'Stripe fehlt', 'Achtung'],
      ['Offene Fragen', '1 Erstattung offen', 'Achtung'],
    ])
  })

  it('Protokoll: „Du“, „Team“, „System“ — und ein lesbarer Text auch für unbekannte Arten', () => {
    expect(protokollWer('u1', 'u1')).toBe('Du')
    expect(protokollWer('u2', 'u1')).toBe('Team')
    expect(protokollWer(null, 'u1')).toBe('System')
    expect(protokollArtText('hof_gesperrt')).toBe('Vorübergehend gesperrt')
    expect(protokollArtText('neue_art_spaeter')).toBe('neue art spaeter')
  })
})

describe('hofAkteAnsicht — kein Date, keine volle Anmelde-E-Mail', () => {
  const roh: HofAkteEingabe = {
    hof: {
      phone: '+43 000 000000',
      email: '',
      postalCode: '1234',
      city: 'Musterort',
      landText: 'Österreich',
      isPaused: false,
      adminGesperrtAm: new Date(JETZT.getTime() - 2 * STD),
      adminSperrGrund: 'Beschwerden klären',
      agbFassung: '0.9',
      agbZugestimmtAm: new Date('2026-10-31T13:05:00Z'),
      owner: { email: 'hof.inhaber@example.com', sessions: [{ createdAt: new Date(JETZT.getTime() - 3 * STD), userAgent: 'Mozilla/5.0 (iPhone)', anmeldeart: 'passwort' }] },
      pickupSlots: [{ dayOfWeek: 2 }],
      products: [{ stock: 0 }, { stock: 4 }],
    },
    zahlen: { bestellungen: 41, storniert: 2, nichtAbgeholt: 0, umsatzCents: 123_000, servicegebuehrCents: 6_150 },
    erstattungenOffen: 0,
    nachrichten: [],
    protokoll: [{ id: 'p1', wann: JETZT, wer: null, art: 'hof_gesperrt', grund: 'Beschwerden klären', mitPasskey: true }],
  }
  const ansicht = hofAkteAnsicht(roh, { anmeldungGekuerzt: 'h•••@example.com', emailBestaetigt: 'ja', stripeBereit: true, onlineAn: true, ich: 'u1' }, JETZT)

  it('Werte als Text und Cent; „wie Anmeldung“ bei leerer Hof-E-Mail; Gerät gekürzt', () => {
    expect(ansicht.kontakt).toMatchObject({ anmeldung: 'h•••@example.com', hofEmail: 'wie Anmeldung', ort: '1234 Musterort · Österreich' })
    // Nr. 207: Fassung und Zeitpunkt der AGB-Zustimmung in Wiener Zeit (13:05 UTC = 14:05 MEZ).
    expect(ansicht.kontakt.agb).toBe('Fassung 0.9 · 31.10.2026, 14:05 Uhr')
    expect(ansicht.aktivitaet).toMatchObject({ bestellungen: 41, bestellungenZeile: '2 storniert · 0 nicht abgeholt', umsatzCents: 123_000, anmeldung: 'Handy · Passwort' })
    expect(ansicht.sperre).toMatchObject({ gesperrt: true, grund: 'Beschwerden klären' })
    expect(ansicht.protokoll[0]).toMatchObject({ wer: 'System', text: 'Vorübergehend gesperrt' })
  })

  it('nichts davon ist ein Date oder die volle Adresse', () => {
    const text = JSON.stringify(ansicht)
    expect(text).not.toContain('hof.inhaber@example.com')
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
    expect(text).not.toContain('iPhone')
  })
})

describe('kaufSperre — die Sperre des Teams (N34)', () => {
  it('sticht die Pause und hat den neutralen Satz', () => {
    expect(kaufSperre({ isPaused: true, adminGesperrt: true, pickupSlots: [MITTWOCH] }, JETZT)).toBe('gesperrt')
    expect(kaufSperreHinweis('gesperrt', 'Hof am Bach')).toEqual({ titel: HOF_GESPERRT_SATZ, satz: 'Schau bald wieder vorbei.' })
    expect(HOF_GESPERRT_SATZ).toBe('Bestellen ist bei diesem Hof gerade nicht möglich.')
  })

  it('Gegenprobe: ohne Sperre gilt die Pause; ohne Feld gilt „nicht gesperrt“', () => {
    expect(kaufSperre({ isPaused: true, adminGesperrt: false, pickupSlots: [MITTWOCH] }, JETZT)).toBe('pause')
    expect(kaufSperre({ isPaused: false, pickupSlots: [MITTWOCH] }, JETZT)).toBeNull()
  })
})

describe('Akte und Dialog', () => {
  const hof: AdminHof = {
    ...adminHofZeile(hofRohdaten({ approvedAt: new Date('2026-08-01T00:00:00Z'), stripeBereit: true }), { gruendungsplatz: null, maxPlaetze: 12 }, JETZT),
    aktivitaet: { produkte: 2, fotos: 0, abholzeiten: 1, hatBeschreibung: true, hatLogo: false },
    gruendung: null,
    platzBeiFreischaltung: null,
    gruendungAenderung: null,
    gruendungZuletzt: null,
    testhofAenderung: null,
  }
  const akte = (gesperrt: boolean) =>
    renderToStaticMarkup(
      createElement(HofAkteAnsicht, {
        hof,
        zustand: gesperrt ? { id: 'gesperrt', text: 'Gesperrt', ton: 'offen' } : { id: 'verkauft', text: 'Verkauft', ton: 'fertig' },
        akte: {
          kontakt: { telefon: '–', anmeldung: 'h•••@example.com', emailBestaetigt: 'ja', hofEmail: 'wie Anmeldung', ort: '1234 Musterort · Österreich', agb: 'Fassung 0.9 · 31.10.2026, 14:05 Uhr' },
          aktivitaet: { bestellungen: 0, bestellungenZeile: '', umsatzCents: 0, servicegebuehrCents: 0, zuletztAngemeldet: 'noch nie', anmeldung: null, antwortzeit: '' },
          zustand: [],
          sperre: { gesperrt, grund: gesperrt ? 'Beschwerden klären' : null, seit: gesperrt ? 'heute 08:00' : null },
          protokoll: [{ id: 'p1', wann: 'heute 08:00', wer: 'Du', text: 'Vorübergehend gesperrt', grund: 'Beschwerden klären', mitPasskey: true }],
        },
      })
    )

  it('nicht gesperrt: „Vorübergehend sperren …“; gesperrt: „Sperre aufheben“ und der Grund', () => {
    expect(akte(false)).toContain('>Vorübergehend sperren …</button>')
    expect(akte(false)).not.toContain('Sperre aufheben')
    const gesperrt = akte(true)
    expect(gesperrt).toContain('>Sperre aufheben</button>')
    expect(gesperrt).toContain('Grund: Beschwerden klären')
    expect(gesperrt).toContain('>Gesperrt<')
  })

  it('die Akte aus dem Protokoll und die vier Abschnitte stehen da; die Konto-Anfragen (Nr. 190) noch nicht', () => {
    const html = akte(false)
    for (const t of ['Kontakt', 'Aktivität', 'Zustand', 'Eingreifen', 'Akte']) expect(html).toContain(`>${t}</h2>`)
    expect(html).toContain('Vorübergehend gesperrt')
    expect(html).not.toMatch(/Anmelde-E-Mail ändern|Auskunft exportieren|Konto schließen/)
  })

  it('der Dialog fragt den Grund und zeigt den festen, neutralen Satz für die Kundschaft', () => {
    const html = renderToStaticMarkup(createElement(HofSperreDialog, { wahl: { farmId: 'h1', name: 'Hof am Bach', richtung: 'sperren' }, onClose: () => {} }))
    expect(html).toContain('Hof vorübergehend sperren?')
    expect(html).toContain('<textarea')
    expect(html).toContain(HOF_GESPERRT_SATZ)
    expect(html).toContain('Anders als die Pause kann der Hof sie nicht selbst aufheben.')
  })
})

describe('Heute des Hofs', () => {
  it('die Karte nennt den Grund und führt ins Postfach', () => {
    const html = renderToStaticMarkup(createElement(TeamSperreKarte, { grund: 'Beschwerden klären' }))
    expect(html).toContain('Dein Hof ist vom Team gesperrt: Beschwerden klären. Antworte im Postfach.')
    expect(html).toContain('href="/postfach"')
    expect(sperreKarteSatz(null)).toBe('Dein Hof ist vom Team gesperrt. Antworte im Postfach.')
  })
})
