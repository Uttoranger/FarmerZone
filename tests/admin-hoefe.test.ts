/**
 * Höfe und Freischaltung im Admin (Nachtlauf Nr. 22f) — die reinen Regeln aus
 * src/lib/admin-hoefe.ts und das Schema der Adresse (src/schemas/admin-hoefe.ts).
 *
 * Die Aussagen, die zählen:
 *  - Freischalten ist gesperrt ohne bestätigte E-Mail (S3) und ohne fertiges
 *    Stripe-Konto (Register Z1) — für jeden Hof, auch einen, der früher „nur
 *    bar" gewählt hat; in derselben Reihenfolge wie approveFarmAction.
 *  - Freigeschaltete Höfe ohne Stripe tragen „Stripe fehlt" (Liste, Filter).
 *  - Der Satz der Servicegebühr sagt „gilt nur für neue Bestellungen" und
 *    nimmt den Standard aus konditionen.ts.
 *  - Die Betriebsnummer wird nur angezeigt (E9) — nirgends steht „geprüft".
 *  - Was an den Browser geht, enthält kein Date.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  FREISCHALTUNG_STRIPE_OFFEN_TEXT,
  HOF_FILTER_LABEL,
  SERVICEGEBUEHR_NUR_NEUE,
  adminHofZeile,
  filtereHoefe,
  freischaltSperre,
  hofStatus,
  hoefeAdresse,
  nummerAnzeige,
  registriertText,
  satzKurz,
  stripeFehlt,
  zaehleHofFilter,
  type HofRohdaten,
} from '@/lib/admin-hoefe'
import { hoefeAnsichtAus } from '@/schemas/admin-hoefe'
import { FREISCHALTUNG_EMAIL_OFFEN_TEXT } from '@/lib/email-bestaetigung'
import { SERVICEGEBUEHR_STANDARD_PROZENT } from '@/lib/konditionen'

const JETZT = new Date('2026-10-07T10:00:00+02:00')

function roh(ueber: Partial<HofRohdaten> = {}): HofRohdaten {
  return {
    id: 'farm_1',
    name: 'Hof Test',
    slug: 'hof-test',
    ownerEmail: 'max@example.com',
    emailBestaetigt: true,
    emailBestaetigungOffen: false,
    createdAt: new Date('2026-10-05T09:00:00+02:00'),
    approvedAt: new Date('2026-10-06T09:00:00+02:00'),
    archivedAt: null,
    land: 'AT',
    serviceFeePercent: 5,
    serviceFeeMinCents: 50,
    serviceFeeActiveFrom: new Date('2026-10-01T00:00:00+02:00'),
    monat: { bestellungen: 4, gebuehrOnlineCents: 120, gebuehrBarCents: 0, gebuehrEntfallenCents: 0 },
    monatBezeichnung: 'Oktober 2026',
    stripeBereit: true,
    isPaused: false,
    betriebsnummer: '1234567',
    sepaErteilt: false,
    ...ueber,
  }
}

describe('freischaltSperre', () => {
  it('ohne bestätigte E-Mail: der Satz aus S3 — vor Stripe, wie der Server', () => {
    expect(freischaltSperre({ emailBestaetigungOffen: true, stripeBereit: false })).toBe(FREISCHALTUNG_EMAIL_OFFEN_TEXT)
  })
  it('ohne fertiges Stripe-Konto: gesperrt mit Grund (Register Z1)', () => {
    expect(freischaltSperre({ emailBestaetigungOffen: false, stripeBereit: false })).toBe(FREISCHALTUNG_STRIPE_OFFEN_TEXT)
  })
  it('mit Stripe und bestätigter E-Mail: nichts im Weg', () => {
    expect(freischaltSperre({ emailBestaetigungOffen: false, stripeBereit: true })).toBeNull()
  })
  it('ein Hof, der früher „nur bar" wählen konnte, ist ohne Stripe gesperrt — die Wahl zählt nicht mehr (Z1)', () => {
    // Die Regel kennt acceptsOnline nicht: Auch ein Bestandshof mit
    // acceptsOnline=false bekommt ohne Stripe keine Freischaltung.
    const hof = { emailBestaetigungOffen: false, stripeBereit: false, acceptsOnline: false }
    expect(freischaltSperre(hof)).toBe(FREISCHALTUNG_STRIPE_OFFEN_TEXT)
  })
})

describe('hofStatus', () => {
  const basis = { approvedAt: JETZT, archivedAt: null, isPaused: false, stripeBereit: true }
  it('stillgelegt sticht alles', () => {
    expect(hofStatus({ ...basis, archivedAt: JETZT, approvedAt: null, isPaused: true }).id).toBe('stillgelegt')
  })
  it('ohne Freischaltung: wartet (orange)', () => {
    expect(hofStatus({ ...basis, approvedAt: null })).toEqual({ id: 'wartet', text: 'Wartet', ton: 'offen' })
  })
  it('pausiert vor „Stripe fehlt"', () => {
    expect(hofStatus({ ...basis, isPaused: true, stripeBereit: false }).id).toBe('pausiert')
  })
  it('freigeschaltet ohne Stripe: „Stripe fehlt" (orange, kein Rot), sonst online (grün)', () => {
    expect(hofStatus({ ...basis, stripeBereit: false })).toEqual({ id: 'stripe-fehlt', text: 'Stripe fehlt', ton: 'offen' })
    expect(hofStatus(basis)).toEqual({ id: 'online', text: 'Online', ton: 'fertig' })
  })
  it('es gibt kein „Nur bar" mehr', () => {
    expect(JSON.stringify(HOF_FILTER_LABEL)).not.toMatch(/bar/i)
    expect(hofStatus({ ...basis, stripeBereit: false }).text).not.toMatch(/bar/i)
  })
})

describe('stripeFehlt', () => {
  const basis = { approvedAt: JETZT, archivedAt: null, stripeBereit: false }
  it('nur freigeschaltete, nicht stillgelegte Höfe ohne Stripe', () => {
    expect(stripeFehlt(basis)).toBe(true)
    expect(stripeFehlt({ ...basis, stripeBereit: true })).toBe(false)
    // Wartende haben ihre eigene Sperre (freischaltSperre), Stillgelegte sind vom Netz.
    expect(stripeFehlt({ ...basis, approvedAt: null })).toBe(false)
    expect(stripeFehlt({ ...basis, archivedAt: JETZT })).toBe(false)
  })
})

describe('Filter und Suche', () => {
  const zeile = (name: string, id: ReturnType<typeof hofStatus>['id'], stripeFehlt = false) => ({
    name,
    slug: name.toLowerCase(),
    status: { id, text: '', ton: 'neutral' as const },
    stripeFehlt,
  })
  const hoefe = [
    zeile('Lindenhof', 'online'),
    zeile('Bergbauernhof', 'pausiert'),
    zeile('Waldhof', 'stripe-fehlt', true),
    // Pausiert und ohne Stripe: Der Filter „Stripe fehlt" findet ihn trotzdem.
    zeile('Wiesenhof', 'pausiert', true),
    zeile('Neuhof', 'wartet'),
    zeile('Althof', 'stillgelegt'),
  ]

  it('wartende Höfe stehen nie in der Liste (sie haben oben eigene Karten)', () => {
    expect(filtereHoefe(hoefe, { filter: 'alle', suche: '' }).map((h) => h.name)).not.toContain('Neuhof')
  })
  it('filtert nach Status und sucht ohne Groß/klein in Name und Adresse', () => {
    expect(filtereHoefe(hoefe, { filter: 'stripe-fehlt', suche: '' }).map((h) => h.name)).toEqual(['Waldhof', 'Wiesenhof'])
    expect(filtereHoefe(hoefe, { filter: 'alle', suche: '  LINDEN ' }).map((h) => h.name)).toEqual(['Lindenhof'])
    expect(filtereHoefe(hoefe, { filter: 'pausiert', suche: 'linden' })).toEqual([])
  })
  it('zählt je Filter ohne die wartenden', () => {
    expect(zaehleHofFilter(hoefe)).toEqual({ alle: 5, online: 1, pausiert: 2, 'stripe-fehlt': 2, stillgelegt: 1 })
  })
  it('die Adresse lässt Standardwerte weg', () => {
    expect(hoefeAdresse({ filter: 'alle', suche: '  ' })).toBe('/admin')
    expect(hoefeAdresse({ filter: 'pausiert', suche: 'berg hof' })).toBe('/admin?filter=pausiert&suche=berg+hof')
  })
  it('das Schema verwirft Unbekanntes still und kürzt nichts heimlich', () => {
    const p = (q: string) => hoefeAnsichtAus(new URLSearchParams(q))
    expect(p('filter=quatsch&suche=x')).toEqual({ filter: 'alle', suche: 'x' })
    expect(p(`suche=${'a'.repeat(81)}`)).toEqual({ filter: 'alle', suche: '' })
    expect(p('filter=stillgelegt')).toEqual({ filter: 'stillgelegt', suche: '' })
  })
  it('alte Links: „ohne-zahlung" zeigt „Stripe fehlt", „nur-bar" fällt auf alle', () => {
    const p = (q: string) => hoefeAnsichtAus(new URLSearchParams(q))
    expect(p('filter=ohne-zahlung')).toEqual({ filter: 'stripe-fehlt', suche: '' })
    expect(p('filter=nur-bar')).toEqual({ filter: 'alle', suche: '' })
  })
})

describe('Texte der Zeile', () => {
  it('registriert heute, gestern, sonst Wochentag und Tag — Wiener Tag', () => {
    expect(registriertText(new Date('2026-10-07T00:30:00+02:00'), JETZT)).toBe('registriert heute')
    // 23:30 Uhr UTC am 6.10. ist in Wien schon der 7.10.
    expect(registriertText(new Date('2026-10-06T23:30:00Z'), JETZT)).toBe('registriert heute')
    expect(registriertText(new Date('2026-10-06T12:00:00+02:00'), JETZT)).toBe('registriert gestern')
    expect(registriertText(new Date('2026-10-02T12:00:00+02:00'), JETZT)).toBe('registriert Fr, 2. Okt')
  })

  it('der Satz der Servicegebühr: gebührenfrei, gültig, oder ab einem künftigen Tag', () => {
    expect(satzKurz({ prozent: 5, giltAb: null }, JETZT)).toBe('gebührenfrei')
    expect(satzKurz({ prozent: 4.9, giltAb: new Date('2026-09-01T00:00:00+02:00') }, JETZT)).toBe('4,9 %')
    expect(satzKurz({ prozent: 5, giltAb: new Date('2026-11-01T00:00:00+01:00') }, JETZT)).toBe('5 % ab 01.11.2026')
  })

  it('der Hinweis sagt „nur für neue Bestellungen" und nimmt den Standard aus konditionen.ts', () => {
    expect(SERVICEGEBUEHR_NUR_NEUE).toContain('Gilt nur für neue Bestellungen')
    expect(SERVICEGEBUEHR_NUR_NEUE).toContain(`Standard ${SERVICEGEBUEHR_STANDARD_PROZENT} %`)
  })

  it('die Betriebsnummer bleibt, wie der Hof sie angibt — leer heißt keine', () => {
    expect(nummerAnzeige('  1234567 ')).toBe('1234567')
    expect(nummerAnzeige('   ')).toBeNull()
    expect(nummerAnzeige(null)).toBeNull()
  })
})

describe('adminHofZeile', () => {
  it('gibt nur Text, Zahlen und Wahrheitswerte an den Browser — kein Date', () => {
    const zeile = adminHofZeile(roh(), { gruendungsplatz: 1, maxPlaetze: 12 }, JETZT)
    expect(JSON.parse(JSON.stringify(zeile))).toEqual(zeile)
  })

  it('ein freigeschalteter Hof ohne Stripe: Kennzeichen „Stripe fehlt", keine Sperre (bleibt online)', () => {
    const zeile = adminHofZeile(roh({ stripeBereit: false }), { gruendungsplatz: null, maxPlaetze: 12 }, JETZT)
    expect(zeile.stripeFehlt).toBe(true)
    expect(zeile.status.text).toBe('Stripe fehlt')
    expect(zeile.sperre).toBeNull()
  })

  it('ein wartender Hof ohne Stripe: Sperre mit Grund, kein Platz', () => {
    const zeile = adminHofZeile(roh({ approvedAt: null, stripeBereit: false }), { gruendungsplatz: null, maxPlaetze: 12 }, JETZT)
    expect(zeile.status.id).toBe('wartet')
    expect(zeile.sperre).toBe(FREISCHALTUNG_STRIPE_OFFEN_TEXT)
    expect(zeile.gruendungsplatz).toBeNull()
  })

  it('ein freigeschalteter Hof hat keine Sperre; Platz nur bis zur Obergrenze, stillgelegt keinen', () => {
    expect(adminHofZeile(roh(), { gruendungsplatz: 3, maxPlaetze: 12 }, JETZT)).toMatchObject({ sperre: null, gruendungsplatz: 3 })
    expect(adminHofZeile(roh(), { gruendungsplatz: 13, maxPlaetze: 12 }, JETZT).gruendungsplatz).toBeNull()
    expect(adminHofZeile(roh({ archivedAt: JETZT }), { gruendungsplatz: 3, maxPlaetze: 12 }, JETZT).gruendungsplatz).toBeNull()
  })

  it('E-Mail bestätigt: ja, nein oder „nein (Konto vor der Pflicht)" (S3)', () => {
    const text = (ueber: Partial<HofRohdaten>) => adminHofZeile(roh(ueber), { gruendungsplatz: null, maxPlaetze: 12 }, JETZT).emailBestaetigtText
    expect(text({})).toBe('ja')
    expect(text({ emailBestaetigt: false, emailBestaetigungOffen: true })).toBe('nein')
    expect(text({ emailBestaetigt: false, emailBestaetigungOffen: false })).toBe('nein (Konto vor der Pflicht)')
  })

  it('belegt das Gebühren-Formular mit dem Wiener Tag vor', () => {
    expect(adminHofZeile(roh(), { gruendungsplatz: null, maxPlaetze: 12 }, JETZT).gebuehr).toEqual({ prozent: '5', mindestCents: 50, giltAbTag: '2026-10-01' })
    expect(adminHofZeile(roh({ serviceFeeActiveFrom: null }), { gruendungsplatz: null, maxPlaetze: 12 }, JETZT).gebuehr.giltAbTag).toBe('')
  })
})

describe('E9 — die Nummer wird nur angezeigt', () => {
  const PRUEFVERMERK = /gepr(ü|ue)ft|verifiziert|bestätigt durch/i
  const dateien = ['src/lib/admin-hoefe.ts', 'src/components/admin/hoefe-ansicht.tsx', 'src/components/admin/hof-aktion-dialog.tsx']

  it('kein „geprüft" in Höfe-Liste, Regeln und Freischalt-Dialog', () => {
    for (const d of dateien) {
      // Kommentare dürfen erklären, dass es keinen Haken gibt — geprüft wird, was gezeigt wird.
      const ohneKommentare = readFileSync(join(process.cwd(), d), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      expect(ohneKommentare, d).not.toMatch(PRUEFVERMERK)
    }
  })

  it('Gegenprobe: die Suche schlägt an', () => {
    expect('LFBIS 123 · geprüft').toMatch(PRUEFVERMERK)
    expect('Nummer geprueft').toMatch(PRUEFVERMERK)
  })
})
