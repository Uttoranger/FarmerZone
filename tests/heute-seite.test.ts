/**
 * „Heute" (/dashboard) in der HofShell (Gate 5, Nachtlauf Nr. 17; Mockups
 * web-h3-heute-mit-teilen-karte, web-h3-heute-online-zahlung-pausiert,
 * mobil-h3-heute-mit-teilen-karte, mobil-h3-heute-online-zahlung-pausiert,
 * web-h1-freigeschaltet-jetzt-teilen; hell: system-heute-hell).
 *
 * Beweist:
 *  - Packliste: offen zuerst, dann „wartet auf Kunde", dann gepackt — je
 *    Gruppe nach Uhrzeit; Erledigtes fällt weg; Betrag in Cent mitgeführt.
 *  - Die Seite stellt die Packliste an den Anfang der Hauptspalte; oben
 *    stehen nur Stripe-Hinweis und die schmale Teilen-Zeile.
 *  - Stripe-Hinweis: nur bei acceptsOnline && !stripeAccountReady (mit
 *    Konto) — alle vier Kombinationen, dazu der Fall ohne Konto.
 *  - Teilen-Karte: schmal an Abholtagen, groß sonst, gar nicht, solange der
 *    Hof nicht öffentlich ist. Abholtag = aktives Abholfenster am Wiener
 *    Wochentag.
 *  - Freischaltungs-Moment: nur im Zeitfenster nach approvedAt, nur
 *    öffentlich, nur wenn das Gerät ihn sicher noch nicht gezeigt hat —
 *    fehlender oder werfender Speicher zeigt ihn nie (höchstens einmal).
 *  - /dashboard liegt in (hof), der Bestand (farmer) hat es nicht mehr.
 *  - Die Bausteine rendern mit Tokens (beide Themes), Symbole aria-hidden,
 *    Beträge über formatEuro, lange Namen gekürzt mit title.
 */
import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))

import {
  PACK_MARKE,
  abholfensterHeute,
  fensterAnzahl,
  fensterText,
  heuteAufbau,
  heuteHofSichtbar,
  naechstesAbholfenster,
  stripeEinrichtenHinweis,
  packliste,
  packlistenZahlen,
  teilenKarte,
  teilenSatz,
  umsatzHeuteCent,
  wochenBalken,
  type PacklistenBestellung,
  type PacklistenZeile,
} from '@/lib/heute'
import { onlinePausiertHinweis, onlineZahlungPausiert } from '@/lib/stripe-konto'
import { umsatzBestellungWhere } from '@/lib/umsatz'
import {
  FREISCHALT_MOMENT_TAGE,
  freischaltMomentMoeglich,
  freischaltMomentOeffnen,
  freischaltSchluessel,
  leseFreischaltGesehen,
  merkeFreischaltGesehen,
} from '@/lib/freischalt-moment'
import {
  BrauchtDichKarte,
  HeuteKopf,
  HofseiteKarte,
  Kennzahlen,
  NaechsteAbholungKarte,
  Packliste,
  StripeEinrichtenHinweis,
  StripeHinweis,
  TeilenKarte,
  WocheKarte,
} from '@/components/heute/heute-teile'
import { ONLINE_ZAHLUNG_EINRICHTEN_SATZ, ONLINE_ZAHLUNG_EINRICHTEN_TITEL } from '@/lib/konditionen'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')
const html = (el: React.ReactElement) => renderToStaticMarkup(el)

// ─── Packliste ──────────────────────────────────────────────────────────────

describe('Packliste — Reihenfolge und Zahlen', () => {
  const basis: Omit<PacklistenBestellung, 'id' | 'status' | 'pickupTimeStart' | 'customerName'> = {
    pickupTimeEnd: '18:00',
    paymentMethod: 'ONSITE_CASH',
    items: [{ productName: 'Eier', quantity: 10 }],
    gesamtCents: 1030,
  }
  const bestellungen: PacklistenBestellung[] = [
    { ...basis, id: 'gepackt-frueh', status: 'READY', pickupTimeStart: '09:00', customerName: 'Anna Test' },
    { ...basis, id: 'offen-spaet', status: 'CONFIRMED', pickupTimeStart: '16:00', customerName: 'Berta Test' },
    { ...basis, id: 'wartet', status: 'PENDING_CONFIRMATION', pickupTimeStart: '08:00', customerName: 'Carl Test' },
    { ...basis, id: 'abgeholt', status: 'PICKED_UP', pickupTimeStart: '07:00', customerName: 'Dora Test' },
    { ...basis, id: 'offen-frueh', status: 'PAID', pickupTimeStart: '10:00', customerName: 'Emil Test', gesamtCents: 2160 },
    { ...basis, id: 'storniert', status: 'CANCELLED', pickupTimeStart: '10:00', customerName: 'Frida Test' },
  ]

  it('offen zuerst, dann „wartet auf Kunde", dann gepackt — je Gruppe nach Uhrzeit', () => {
    expect(packliste(bestellungen).map((z) => z.id)).toEqual(['offen-frueh', 'offen-spaet', 'wartet', 'gepackt-frueh'])
  })

  it('führt den Betrag der Bestellung in Cent mit', () => {
    const zeilen = packliste(bestellungen)
    expect(zeilen[0].gesamtCents).toBe(2160)
    expect(zeilen[1].gesamtCents).toBe(1030)
  })

  it('zählt Bestellungen heute und noch zu packen', () => {
    expect(packlistenZahlen(packliste(bestellungen))).toEqual({ bestellungen: 4, zuPacken: 2 })
    expect(packlistenZahlen([])).toEqual({ bestellungen: 0, zuPacken: 0 })
  })

  it('Marken: zum Packen orange, wartet neutral, gepackt grün', () => {
    expect(PACK_MARKE.vorbereiten).toEqual({ text: 'Zum Packen', ton: 'offen' })
    expect(PACK_MARKE.wartet).toEqual({ text: 'Wartet auf Kunde', ton: 'neutral' })
    expect(PACK_MARKE.bereit).toEqual({ text: 'Gepackt', ton: 'fertig' })
  })
})

// ─── Abholfenster ───────────────────────────────────────────────────────────

describe('Abholfenster — Wiener Wochentag', () => {
  // 2026-10-06 ist ein Dienstag (dayOfWeek 2).
  const dienstag = { dayOfWeek: 2, startTime: '15:00', endTime: '18:00' }
  const dienstagFrueh = { dayOfWeek: 2, startTime: '09:00', endTime: '12:30' }
  const samstag = { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' }

  it('schreibt Zeiten wie die Hofseite: „15–18 Uhr", mehrere nach Beginn', () => {
    expect(fensterText([dienstag])).toBe('15–18 Uhr')
    expect(fensterText([dienstag, dienstagFrueh])).toBe('9–12:30 · 15–18 Uhr')
  })

  it('heute ist Abholtag, wenn ein aktives Fenster auf den Wiener Wochentag fällt', () => {
    const jetzt = new Date('2026-10-06T08:00:00Z')
    expect(abholfensterHeute([dienstag, samstag], jetzt)).toBe('15–18 Uhr')
    expect(abholfensterHeute([samstag], jetzt)).toBeNull()
    expect(abholfensterHeute([{ ...dienstag, isActive: false }], jetzt)).toBeNull()
    expect(abholfensterHeute([], jetzt)).toBeNull()
  })

  it('um 0:30 Uhr in Wien zählt schon der neue Tag (UTC steht noch im alten)', () => {
    // Montag 22:30 UTC = Dienstag 0:30 Wien.
    expect(abholfensterHeute([dienstag], new Date('2026-10-05T22:30:00Z'))).toBe('15–18 Uhr')
  })

  it('nächstes Fenster: heute, solange es nicht vorbei ist, sonst der nächste Tag mit Fenster', () => {
    const vorher = new Date('2026-10-06T12:00:00Z') // 14:00 Wien
    expect(naechstesAbholfenster([dienstag, samstag], vorher)).toEqual({ tag: '2026-10-06', name: 'Heute', zeit: '15–18 Uhr' })
    const danach = new Date('2026-10-06T16:30:00Z') // 18:30 Wien
    expect(naechstesAbholfenster([dienstag, samstag], danach)).toEqual({ tag: '2026-10-10', name: 'Samstag', zeit: '9–12 Uhr' })
    // Nur ein Fenster am Dienstag und schon vorbei: in einer Woche, mit Datum.
    expect(naechstesAbholfenster([dienstag], danach)).toEqual({ tag: '2026-10-13', name: 'Dienstag, 13. Oktober', zeit: '15–18 Uhr' })
    expect(naechstesAbholfenster([{ dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }], danach)?.name).toBe('Morgen')
    expect(naechstesAbholfenster([], vorher)).toBeNull()
  })
})

// ─── Teilen-Karte ───────────────────────────────────────────────────────────

describe('Teilen-Karte', () => {
  it('schmal an Abholtagen, groß sonst — nur wenn Kunden den Hof sehen und bei ihm bestellen können', () => {
    expect(teilenKarte({ sichtbar: true, abholtag: true })).toBe('schmal')
    expect(teilenKarte({ sichtbar: true, abholtag: false })).toBe('gross')
    expect(teilenKarte({ sichtbar: false, abholtag: true })).toBeNull()
    expect(teilenKarte({ sichtbar: false, abholtag: false })).toBeNull()
  })

  it('sichtbar heißt: freigegeben, aktiv, nicht stillgelegt und NICHT pausiert', () => {
    const freigabe = new Date('2026-10-01T09:00:00Z')
    const basis = { isActive: true, isPaused: false, approvedAt: freigabe, archivedAt: null }
    expect(heuteHofSichtbar(basis)).toBe(true)
    // Pausiert ist öffentlich (die Hofseite steht), aber Kunden können nicht bestellen —
    // „Ab jetzt können Kunden bei dir bestellen" und Teilen wären dort falsch.
    expect(heuteHofSichtbar({ ...basis, isPaused: true })).toBe(false)
    expect(heuteHofSichtbar({ ...basis, approvedAt: null })).toBe(false)
    expect(heuteHofSichtbar({ ...basis, isActive: false })).toBe(false)
    expect(heuteHofSichtbar({ ...basis, archivedAt: freigabe })).toBe(false)
  })

  it('Satz aus Angebot und nächster Abholung, ohne beides ein Aufruf', () => {
    const fenster = { tag: '2026-10-10', name: 'Samstag', zeit: '9–12 Uhr' }
    expect(teilenSatz(['Eier', 'Erdäpfel', 'Heu'], fenster)).toBe('Eier, Erdäpfel, Heu – Abholung Samstag, 9–12 Uhr')
    expect(teilenSatz([], fenster)).toBe('Abholung Samstag, 9–12 Uhr')
    expect(teilenSatz(['Eier'], null)).toBe('Eier')
    expect(teilenSatz([], null)).toBe('Erzähl deinen Kunden, was es bei dir gibt.')
  })

  it('„heute" und „morgen" mitten im Satz klein, Wochentage groß', () => {
    expect(teilenSatz(['Eier'], { tag: '2026-10-06', name: 'Heute', zeit: '15–18 Uhr' })).toBe('Eier – Abholung heute, 15–18 Uhr')
    expect(teilenSatz([], { tag: '2026-10-07', name: 'Morgen', zeit: '15–18 Uhr' })).toBe('Abholung morgen, 15–18 Uhr')
    expect(teilenSatz([], { tag: '2026-10-13', name: 'Dienstag, 13. Oktober', zeit: '15–18 Uhr' })).toBe('Abholung Dienstag, 13. Oktober, 15–18 Uhr')
  })
})

// ─── Aufbau ─────────────────────────────────────────────────────────────────

describe('Aufbau der Seite — Packliste zuerst', () => {
  it('die Hauptspalte beginnt immer mit der Packliste', () => {
    for (const teilen of ['schmal', 'gross', null] as const) {
      for (const stripeHinweis of [true, false]) {
        for (const ersteSchritte of [true, false]) {
          expect(heuteAufbau({ stripeHinweis, teilen, ersteSchritte }).haupt[0]).toBe('packliste')
        }
      }
    }
  })

  it('oben nur Stripe-Hinweis und schmale Teilen-Zeile; die große Karte steht in der Seitenspalte', () => {
    expect(heuteAufbau({ stripeHinweis: true, teilen: 'schmal', ersteSchritte: false }).oben).toEqual(['stripe', 'teilen-schmal'])
    const gross = heuteAufbau({ stripeHinweis: false, teilen: 'gross', ersteSchritte: true })
    expect(gross.oben).toEqual([])
    expect(gross.seite[0]).toBe('teilen-gross')
    expect(gross.seite).toContain('erste-schritte')
    const ohne = heuteAufbau({ stripeHinweis: false, teilen: null, ersteSchritte: false })
    expect([...ohne.oben, ...ohne.haupt, ...ohne.seite]).not.toContain('teilen-gross')
    expect(ohne.seite).not.toContain('erste-schritte')
    expect(ohne.haupt).toEqual(['packliste', 'braucht-dich'])
    expect(ohne.seite).toEqual(['naechste-abholung', 'woche', 'hofseite'])
  })
})

// ─── Stripe-Hinweis ─────────────────────────────────────────────────────────

describe('Stripe-Hinweis', () => {
  const konto = 'acct_test_platzhalter'

  it.each([
    [true, false, true],
    [true, true, false],
    [false, false, false],
    [false, true, false],
  ])('acceptsOnline=%s, stripeAccountReady=%s → Hinweis %s', (acceptsOnline, stripeAccountReady, erwartet) => {
    expect(onlineZahlungPausiert({ acceptsOnline, stripeAccountReady, stripeAccountId: konto })).toBe(erwartet)
  })

  it('ohne Stripe-Konto kein „pausiert" — dafür hat die Erste-Schritte-Karte ihren Schritt', () => {
    expect(onlineZahlungPausiert({ acceptsOnline: true, stripeAccountReady: false, stripeAccountId: null })).toBe(false)
  })

  it('Wortlaut nach Mockup, Satz nach Barzahlung', () => {
    expect(onlinePausiertHinweis(true)).toEqual({
      titel: 'Online-Zahlung ist pausiert',
      satz: 'Stripe braucht noch Angaben von dir. Bis dahin können Kunden nur bar bei Abholung bestellen.',
    })
    expect(onlinePausiertHinweis(false).satz).not.toContain('bar')
  })

  it('rendert Titel, Satz und den Link in die Zahlungs-Einstellungen — kein Stripe-Aufruf', () => {
    const h = html(createElement(StripeHinweis, { barMoeglich: true }))
    expect(h).toContain('Online-Zahlung ist pausiert')
    expect(h).toContain('nur bar bei Abholung')
    expect(h).toContain('href="/settings/payments"')
    expect(h).toContain('Bei Stripe ergänzen')
    expect(quelle('src/components/heute/heute-teile.tsx')).not.toContain('createOnboardingLink')
  })
})

// ─── Online-Zahlung einrichten (Register Z1) ────────────────────────────────

describe('Hinweis „Online-Zahlung einrichten" für freigeschaltete Höfe ohne Stripe (Z1)', () => {
  const FREI = new Date('2026-09-01T09:00:00Z')
  const basis = { approvedAt: FREI, archivedAt: null, stripeAccountReady: false, acceptsOnline: true, stripeAccountId: null }

  it('freigeschaltet, ohne Konto: Hinweis — auch bei Online aus (früher „nur bar")', () => {
    expect(stripeEinrichtenHinweis(basis)).toBe(true)
    expect(stripeEinrichtenHinweis({ ...basis, acceptsOnline: false })).toBe(true)
    // Konto da, aber Online aus: kein „pausiert", also der Einrichten-Hinweis.
    expect(stripeEinrichtenHinweis({ ...basis, acceptsOnline: false, stripeAccountId: 'acct_test_platzhalter' })).toBe(true)
  })

  it('kein Hinweis mit Stripe, vor der Freischaltung oder stillgelegt', () => {
    expect(stripeEinrichtenHinweis({ ...basis, stripeAccountReady: true })).toBe(false)
    expect(stripeEinrichtenHinweis({ ...basis, approvedAt: null })).toBe(false)
    expect(stripeEinrichtenHinweis({ ...basis, archivedAt: FREI })).toBe(false)
  })

  it('die Notbremse sticht: Konto da, Stripe lässt es nicht zu → „pausiert", nicht beide', () => {
    const gesperrt = { ...basis, stripeAccountId: 'acct_test_platzhalter' }
    expect(onlineZahlungPausiert(gesperrt)).toBe(true)
    expect(stripeEinrichtenHinweis(gesperrt)).toBe(false)
  })

  it('rendert Titel, den Satz aus konditionen.ts und den Weg in die Zahlungs-Einstellungen — kein Stripe-Aufruf', () => {
    const h = html(createElement(StripeEinrichtenHinweis))
    expect(h).toContain(ONLINE_ZAHLUNG_EINRICHTEN_TITEL)
    expect(h).toContain(ONLINE_ZAHLUNG_EINRICHTEN_SATZ)
    expect(h).toContain('href="/settings/payments"')
    expect(h).not.toMatch(/nur bar/i)
  })

  it('die Seite zeigt ihn oben, wo sonst „pausiert" steht — keine Abschaltung, nur ein Hinweis', () => {
    expect(heuteAufbau({ stripeHinweis: true, teilen: null, ersteSchritte: false }).oben).toEqual(['stripe'])
    const seite = quelle('src/app/(hof)/dashboard/page.tsx')
    expect(seite).toContain('<StripeEinrichtenHinweis')
    expect(seite).toContain('heute.stripeEinrichten')
  })
})

// ─── Freischaltungs-Moment ──────────────────────────────────────────────────

describe('Freischaltungs-Moment', () => {
  const freigabe = new Date('2026-10-01T09:00:00Z')
  const tag = 24 * 60 * 60 * 1000
  const oeffentlich = { approvedAt: freigabe, sichtbar: true, teilenMomenteAus: false }

  it('nur im Zeitfenster nach der Freigabe', () => {
    expect(FREISCHALT_MOMENT_TAGE).toBe(14)
    expect(freischaltMomentMoeglich(oeffentlich, freigabe)).toBe(true)
    expect(freischaltMomentMoeglich(oeffentlich, new Date(freigabe.getTime() + 14 * tag - 1))).toBe(true)
    expect(freischaltMomentMoeglich(oeffentlich, new Date(freigabe.getTime() + 14 * tag))).toBe(false)
    expect(freischaltMomentMoeglich(oeffentlich, new Date(freigabe.getTime() - 1))).toBe(false)
  })

  it('nicht ohne Freigabe und nicht, solange der Hof nicht sichtbar ist (auch nicht pausiert)', () => {
    expect(freischaltMomentMoeglich({ approvedAt: null, sichtbar: false, teilenMomenteAus: false }, freigabe)).toBe(false)
    expect(freischaltMomentMoeglich({ approvedAt: freigabe, sichtbar: false, teilenMomenteAus: false }, freigabe)).toBe(false)
    const pausiert = heuteHofSichtbar({ isActive: true, isPaused: true, approvedAt: freigabe, archivedAt: null })
    expect(freischaltMomentMoeglich({ approvedAt: freigabe, sichtbar: pausiert, teilenMomenteAus: false }, freigabe)).toBe(false)
  })

  type Speicher = Pick<Storage, 'getItem' | 'setItem'>
  const speicherMit = (werte: Record<string, string>): Speicher & { werte: Record<string, string> } => ({
    werte,
    getItem: (k) => werte[k] ?? null,
    setItem: (k, v) => {
      werte[k] = v
    },
  })
  const werfend: Speicher = {
    getItem: () => {
      throw new Error('SecurityError')
    },
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
  }

  it('liest den Merker je Hof: gesehen, noch nicht, unbekannt', () => {
    expect(leseFreischaltGesehen(speicherMit({ [freischaltSchluessel('hof-1')]: '1' }), 'hof-1')).toBe('ja')
    expect(leseFreischaltGesehen(speicherMit({ [freischaltSchluessel('hof-2')]: '1' }), 'hof-1')).toBe('nein')
    // Kaputter Wert = nicht gesehen (Fremddaten, Zod).
    expect(leseFreischaltGesehen(speicherMit({ [freischaltSchluessel('hof-1')]: 'ja bitte' }), 'hof-1')).toBe('nein')
    expect(leseFreischaltGesehen(null, 'hof-1')).toBe('unbekannt')
    expect(leseFreischaltGesehen(werfend, 'hof-1')).toBe('unbekannt')
  })

  it('öffnet nur bei „noch nicht gesehen" — fehlender oder werfender Speicher zeigt ihn nie', () => {
    expect(freischaltMomentOeffnen('nein')).toBe(true)
    expect(freischaltMomentOeffnen('ja')).toBe(false)
    expect(freischaltMomentOeffnen('unbekannt')).toBe(false)
  })

  it('ob er überhaupt kommen darf, entscheidet allein der Server: die Seite bindet ihn nur dann ein', () => {
    const seite = quelle('src/app/(hof)/dashboard/page.tsx')
    expect(seite).toMatch(/freischaltMomentMoeglich\([\s\S]*?\) && \(\s*<FreischaltMoment/)
  })

  it('merkt sich das Zeigen und wirft nie', () => {
    const s = speicherMit({})
    merkeFreischaltGesehen(s, 'hof-1')
    expect(leseFreischaltGesehen(s, 'hof-1')).toBe('ja')
    expect(() => merkeFreischaltGesehen(werfend, 'hof-1')).not.toThrow()
    expect(() => merkeFreischaltGesehen(null, 'hof-1')).not.toThrow()
  })

  it('der Moment teilt über teileHof und führt seit Nr. 21 zum QR-Plakat — keine eigenen Kanäle', () => {
    const moment = quelle('src/components/heute/freischalt-moment.tsx')
    expect(moment).toContain('HofTeilenKnopf')
    expect(moment).toContain('href={PLAKAT_PFAD}')
    expect(moment).not.toMatch(/wa\.me|qrcode|navigator\.share/i)
    expect(moment).toContain('Dein Hof ist online!')
    expect(moment).toContain('Später')
  })
})

// ─── Nächstes Fenster: Bestellungen ────────────────────────────────────────

describe('fensterAnzahl — wie viele Bestellungen auf das nächste Fenster warten', () => {
  const heute = '2026-10-06'
  const fenster = (tag: string) => ({ tag, name: 'x', zeit: '15–18 Uhr' })
  const zeilenAus = (status: string[]) =>
    packliste(
      status.map((s, i) => ({
        id: `b${i}`,
        status: s,
        customerName: 'Test Kunde',
        pickupTimeStart: '15:00',
        pickupTimeEnd: '18:00',
        paymentMethod: 'ONSITE_CASH',
        items: [],
        gesamtCents: 100,
      }))
    )

  it('heute: die Packliste — Abgeholte, Stornierte und Nicht-Abgeholte zählen nicht', () => {
    const zeilen = zeilenAus(['CONFIRMED', 'READY', 'PENDING_CONFIRMATION', 'PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP'])
    expect(fensterAnzahl(fenster(heute), heute, zeilen, null)).toBe(3)
  })

  it('ein späterer Tag: die Zahl des nächsten Abholtags, wenn er genau dieser Tag ist, sonst 0', () => {
    const naechste = { tag: '2026-10-08', name: 'Donnerstag', anzahl: 4 }
    expect(fensterAnzahl(fenster('2026-10-08'), heute, [], naechste)).toBe(4)
    // Das Fenster ist Mittwoch, die Bestellungen gelten erst Donnerstag.
    expect(fensterAnzahl(fenster('2026-10-07'), heute, [], naechste)).toBe(0)
    expect(fensterAnzahl(fenster('2026-10-07'), heute, [], null)).toBe(0)
  })

  it('heutige Bestellungen zählen nicht für ein Fenster an einem anderen Tag', () => {
    expect(fensterAnzahl(fenster('2026-10-07'), heute, zeilenAus(['CONFIRMED', 'READY']), null)).toBe(0)
  })

  it('ohne Fenster 0, leer 0', () => {
    expect(fensterAnzahl(null, heute, zeilenAus(['CONFIRMED']), null)).toBe(0)
    expect(fensterAnzahl(fenster(heute), heute, [], null)).toBe(0)
  })
})

// ─── Umsatz heute ───────────────────────────────────────────────────────────

describe('umsatzHeuteCent — vom Wiener Mitternacht bis jetzt', () => {
  // Dienstag 6.10.2026, 14:00 Wien (MESZ, UTC+2). Wiener Mitternacht = 5.10. 22:00 UTC.
  const jetzt = new Date('2026-10-06T12:00:00Z')
  const bestellung = (iso: string, cent: number) => ({ quelle: 'bestellung' as const, zeitpunkt: new Date(iso), cent })
  const verkauf = (iso: string, cent: number) => ({ quelle: 'verkauf' as const, zeitpunkt: new Date(iso), cent, kanal: 'HOFLADEN' })

  it('Abholungen zählen ab 0:00 Uhr Wien bis jetzt — genau an den Grenzen', () => {
    expect(umsatzHeuteCent([bestellung('2026-10-05T22:00:00.000Z', 500)], jetzt)).toBe(500) // 0:00 Wien
    expect(umsatzHeuteCent([bestellung('2026-10-05T21:59:59.999Z', 500)], jetzt)).toBe(0) // gestern 23:59
    expect(umsatzHeuteCent([bestellung('2026-10-06T12:00:00.000Z', 500)], jetzt)).toBe(500) // genau jetzt
    expect(umsatzHeuteCent([bestellung('2026-10-06T12:00:00.001Z', 500)], jetzt)).toBe(0) // nach jetzt
  })

  it('manuelle Verkäufe zählen mit ihrem ganzen Wiener Tag (gespeichert um 12:00)', () => {
    expect(umsatzHeuteCent([verkauf('2026-10-06T10:00:00Z', 1200)], new Date('2026-10-05T22:30:00Z'))).toBe(1200)
    expect(umsatzHeuteCent([verkauf('2026-10-05T10:00:00Z', 1200)], jetzt)).toBe(0)
  })

  it('summiert in Cent, leer ist 0', () => {
    expect(umsatzHeuteCent([bestellung('2026-10-06T08:00:00Z', 1030), verkauf('2026-10-06T10:00:00Z', 990)], jetzt)).toBe(2020)
    expect(umsatzHeuteCent([], jetzt)).toBe(0)
  })

  it('stornierte und nicht abgeholte Bestellungen sind keine Buchung: die Abfrage nimmt nur PICKED_UP', () => {
    // Die Regel der Datenbank-Bedingung ist dieselbe wie für Woche und Auswertung.
    expect(umsatzBestellungWhere('hof', { von: jetzt, bis: jetzt }).status).toBe('PICKED_UP')
    expect(quelle('src/server/queries/heute.ts')).toContain('umsatzHeuteCent(buchungen, jetzt)')
  })
})

// ─── Woche ──────────────────────────────────────────────────────────────────

describe('Wochenbalken', () => {
  it('markiert den Wiener Heute-Tag und rechnet Höhen relativ zum besten Tag', () => {
    const balken = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((label, i) => ({ label, cent: i === 1 ? 2000 : i === 0 ? 1000 : 0, vergleichCent: 0 }))
    // Dienstag 0:30 Wien.
    const w = wochenBalken(balken, new Date('2026-10-05T22:30:00Z'))
    expect(w.map((b) => b.heute)).toEqual([false, true, false, false, false, false, false])
    expect(w[0].hoeheProzent).toBe(50)
    expect(w[1].hoeheProzent).toBe(100)
    expect(w[2].hoeheProzent).toBe(0)
    expect(wochenBalken(balken.map((b) => ({ ...b, cent: 0 })), new Date('2026-10-06T08:00:00Z')).every((b) => b.hoeheProzent === 0)).toBe(true)
  })
})

// ─── Route ──────────────────────────────────────────────────────────────────

describe('/dashboard in der HofShell', () => {
  it('liegt in (hof), nicht mehr im Bestand (farmer)', () => {
    expect(existsSync(join(process.cwd(), 'src/app/(hof)/dashboard/page.tsx'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'src/app/(hof)/dashboard/loading.tsx'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'src/app/(farmer)/dashboard'))).toBe(false)
  })

  it('die Seite bindet keine Shell selbst ein — die kommt aus dem Layout der Gruppe', () => {
    const seite = quelle('src/app/(hof)/dashboard/page.tsx')
    expect(seite).not.toContain('@/components/shells/')
    expect(seite).toContain('getHeute(')
    expect(seite).toContain('heuteAufbau(')
    expect(seite).toContain('freischaltMomentMoeglich(')
  })

  it('kein Datum aus der Uhr des Browsers: der Zeitpunkt kommt einmal vom Server', () => {
    const moment = quelle('src/components/heute/freischalt-moment.tsx')
    expect(moment).not.toMatch(/Date\.now\(\)|new Date\(/)
  })
})

// ─── Render ─────────────────────────────────────────────────────────────────

const zeile = (z: Partial<PacklistenZeile> & Pick<PacklistenZeile, 'id' | 'chip'>): PacklistenZeile => ({
  uhrzeit: '15:00–18:00',
  kunde: 'Anna T.',
  positionen: '10× Eier, 1× Bauernbrot',
  zahlart: 'Bar vor Ort',
  gesamtCents: 1030,
  ...z,
})

describe('Bausteine — gefüllt, leer, lange Namen', () => {
  it('Packliste: Zeilen als Links auf die Bestellung, Marke, Betrag über formatEuro, drucken', () => {
    const h = html(
      createElement(Packliste, {
        zeilen: [zeile({ id: 'o1', chip: 'vorbereiten' }), zeile({ id: 'o2', chip: 'bereit', gesamtCents: 2190 })],
        zuPacken: 1,
        naechsteAbholung: null,
        leer: { abholfenster: null },
      })
    )
    expect(h).toContain('Packliste für heute')
    expect(h).toContain('1 offen')
    expect(h).toContain('href="/orders/o1"')
    expect(h).toContain('Zum Packen')
    expect(h).toContain('Gepackt')
    expect(h).toContain('€ 10,30')
    expect(h).toContain('€ 21,90')
    expect(h).toContain('href="/orders/today/print"')
    expect(h).toContain('Alle Bestellungen ansehen')
  })

  it('Packliste leer: Satz mit Ausweg, ohne Druckknopf', () => {
    const ohneFenster = html(createElement(Packliste, { zeilen: [], zuPacken: 0, naechsteAbholung: null, leer: { abholfenster: null } }))
    expect(ohneFenster).toContain('Heute holt niemand etwas ab.')
    expect(ohneFenster).toContain('href="/settings/pickup-slots"')
    expect(ohneFenster).not.toContain('/orders/today/print')
    const mitFenster = html(
      createElement(Packliste, {
        zeilen: [],
        zuPacken: 0,
        naechsteAbholung: { tag: '2026-10-08', name: 'Donnerstag', anzahl: 3 },
        leer: { abholfenster: { tag: '2026-10-08', name: 'Donnerstag', zeit: '15–18 Uhr' } },
      })
    )
    expect(mitFenster).toContain('Nächste Abholung: Donnerstag, 15–18 Uhr')
    expect(mitFenster).toContain('Donnerstag: 3 Bestellungen')
    expect(mitFenster).toContain('href="/orders"')
  })

  it('lange Namen: eine Zeile mit Auslassung, voller Text im title', () => {
    const lang = 'K'.repeat(80)
    const h = html(createElement(Packliste, { zeilen: [zeile({ id: 'o1', chip: 'vorbereiten', kunde: lang })], zuPacken: 1, naechsteAbholung: null, leer: { abholfenster: null } }))
    expect(h).toContain(`title="${lang}"`)
    expect(h).toContain('truncate')
  })

  it('Kopf und Kennzahlen: Abholung heute als Marke, Umsatz über formatEuro, offen orange', () => {
    const kopf = html(createElement(HeuteKopf, { datum: 'Dienstag, 6. Oktober 2026', abholungHeute: '15–18 Uhr' }))
    expect(kopf).toContain('<h1')
    expect(kopf).toContain('Abholung heute, 15–18 Uhr')
    expect(html(createElement(HeuteKopf, { datum: 'Dienstag', abholungHeute: null }))).not.toContain('Abholung heute')
    const zahlen = html(createElement(Kennzahlen, { bestellungen: 8, zuPacken: 5, umsatzHeuteCent: 18640 }))
    expect(zahlen).toContain('Bestellungen heute')
    expect(zahlen).toContain('Noch zu packen')
    expect(zahlen).toContain('€ 186,40')
    expect(zahlen).toContain('text-status-offen')
  })

  it('Teilen-Karte: schmal als Zeile, groß als Karte mit Hof-Link — beide mit „Teilen"', () => {
    const satz = 'Eier, Heu – Abholung Samstag, 9–12 Uhr'
    const schmal = html(createElement(TeilenKarte, { form: 'schmal', hofName: 'Hof Test', hofSlug: 'hof-test', satz, adresse: 'farmerzone.at/hof-test' }))
    expect(schmal).toContain('Diese Woche bei dir:')
    expect(schmal).toContain(satz)
    expect(schmal).toContain('Teilen')
    expect(schmal).not.toContain('Besuche')
    const gross = html(createElement(TeilenKarte, { form: 'gross', hofName: 'Hof Test', hofSlug: 'hof-test', satz, adresse: 'farmerzone.at/hof-test' }))
    expect(gross).toContain('<h2')
    expect(gross).toContain('href="/hof-test"')
    expect(gross).toContain('farmerzone.at/hof-test')
    expect(gross).not.toContain('Besuche')
    // Der Adress-Link hat 44 px Trefferfläche und kürzt trotzdem mit Auslassung.
    expect(gross).toMatch(/<a [^>]*class="[^"]*min-h-11[^"]*"[^>]*href="\/hof-test"|<a [^>]*href="\/hof-test"[^>]*class="[^"]*min-h-11/)
  })

  it('Seitenspalte: nächste Abholung, Woche mit Balken und Vergleich, Hofseite mit Fortschritt', () => {
    const abholung = html(createElement(NaechsteAbholungKarte, { fenster: { tag: '2026-10-06', name: 'Heute', zeit: '15–18 Uhr' }, anzahl: 8 }))
    expect(abholung).toMatch(/Heute, <span[^>]*>15–18 Uhr<\/span>/)
    expect(abholung).toContain('8 Bestellungen')
    expect(html(createElement(NaechsteAbholungKarte, { fenster: null, anzahl: 0 }))).toContain('href="/settings/pickup-slots"')

    const balken = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((label, i) => ({ label, cent: 1000 * i, heute: i === 1, hoeheProzent: Math.round((100 * i) / 6) }))
    const woche = html(createElement(WocheKarte, { summeCent: 61290, vergleich: '+20 % gegenüber der Vorwoche bis Dienstag, 14:30', balken }))
    expect(woche).toContain('Umsatz diese Woche')
    expect(woche).toContain('€ 612,90')
    expect(woche).toContain('+20 %')
    expect(woche).toContain('href="/analytics"')
    // Die Balken sind Bild; die Werte hört der Screenreader als Liste.
    expect(woche).toContain('sr-only')

    const hofseite = html(createElement(HofseiteKarte, { prozent: 64, satz: 'Es fehlen noch: Logo und Über uns.', fertig: false }))
    expect(hofseite).toContain('Deine Hofseite')
    expect(hofseite).toContain('64 %')
    expect(hofseite).toContain('href="/farm-page"')
  })

  it('Braucht dich: leer „Alles erledigt.", sonst Zeilen mit Ziel', () => {
    expect(html(createElement(BrauchtDichKarte, { eintraege: [] }))).toContain('Alles erledigt.')
    const h = html(createElement(BrauchtDichKarte, { eintraege: [{ art: 'ausverkauft', text: 'Eier ist ausverkauft', href: '/products?edit=p1' }] }))
    expect(h).toContain('href="/products?edit=p1"')
  })

  it('jedes Symbol ist aria-hidden', () => {
    const alle = [
      html(createElement(StripeHinweis, { barMoeglich: true })),
      html(createElement(TeilenKarte, { form: 'gross', hofName: 'Hof Test', hofSlug: 'hof-test', satz: 'x', adresse: 'a' })),
      html(createElement(HeuteKopf, { datum: 'x', abholungHeute: '15–18 Uhr' })),
      html(createElement(Packliste, { zeilen: [zeile({ id: 'o1', chip: 'vorbereiten' })], zuPacken: 1, naechsteAbholung: null, leer: { abholfenster: null } })),
    ].join('')
    const symbole = alle.match(/<svg[^>]*>/g) ?? []
    expect(symbole.length).toBeGreaterThan(0)
    for (const s of symbole) expect(s).toContain('aria-hidden="true"')
  })
})

describe('Tokens statt Farbwerte (beide Themes)', () => {
  const dateien = [
    'src/components/heute/heute-teile.tsx',
    'src/components/heute/freischalt-moment.tsx',
    'src/app/(hof)/dashboard/page.tsx',
    'src/app/(hof)/dashboard/loading.tsx',
  ]

  it.each(dateien)('%s: keine Farbliterale, kein black/white, keine Bestandspalette app-*', (datei) => {
    const text = quelle(datei)
    expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch)\(/)
    expect(text).not.toMatch(/\b(bg|text|border|ring|shadow|from|to|via|outline)-(black|white)\b/)
    expect(text).not.toMatch(/\bapp-(ink|page|chip|trough|bar|button|line)/)
    expect(text).not.toMatch(/style=\{\{\s*(color|background)/)
  })

  it('Gegenprobe: die Suche findet Farbliterale und die Bestandspalette', () => {
    expect('text-app-ink').toMatch(/\bapp-(ink|page|chip|trough|bar|button|line)/)
    expect('bg-white').toMatch(/\b(bg|text|border|ring|shadow|from|to|via|outline)-(black|white)\b/)
    expect("style={{ color: 'var(--brand-text)' }}").toMatch(/style=\{\{\s*(color|background)/)
  })
})
