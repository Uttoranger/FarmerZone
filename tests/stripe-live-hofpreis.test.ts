/**
 * Signal „Stripe live ohne Hofpreis-Modell“ (Register N40, Nr. 201). Beweist:
 *  - die reine Regel `liveOhneHofpreisModell`: nur Produktion mit Live-Modus
 *    UND Stichtag in der Zukunft; Testmodus, Vorschau und lokal nie;
 *  - die Aufgabe in „Braucht dich“: ganz oben (nach der Notbremse), Frist
 *    sofort, Ziel die Karte „Hofpreis-Modell ab“; erreicht → weg;
 *  - die Betriebsleiste zeigt denselben Satz aus derselben Liste;
 *  - die Karte „Hofpreis-Modell ab“ zeigt im Testmodus den Hinweis vor dem
 *    Live-Gang, live oder mit erreichtem Stichtag nicht.
 */
import { createElement, type ComponentType, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/server/actions/plattform-einstellung', () => ({ speichereHofpreisStichtag: vi.fn() }))
vi.mock('@/components/admin/frisch-bestaetigen', () => ({ useFrischBestaetigt: () => ({ ausfuehren: vi.fn(), dialog: null }) }))

import { HOFPREIS_KARTE_ID, liveOhneHofpreisModell } from '@/lib/plattformgebuehr'
import { ADMIN_AUFGABEN, LEERER_STAND, liveSignalLeiste, sammleAufgaben, type AufgabenStand, type LiveSignalStand } from '@/lib/admin-aufgaben'
import { AdminShell, type AdminShellProps } from '@/components/shells/admin-shell'
import { HofpreisStichtag, VOR_LIVE_HINWEIS } from '@/app/admin/einstellungen/hofpreis-stichtag'

const JETZT = new Date('2026-10-30T09:00:00.000Z')
const STUNDE = 60 * 60_000
const STICHTAG = new Date('2027-02-01T00:00:00.000+01:00')
const ERREICHT = new Date(JETZT.getTime() - STUNDE)
const LIVE = { art: 'produktion', stripe: 'live' } as const
// formatDatumLang hält „1.“ und den Monat mit einem geschützten Leerzeichen zusammen.
const SATZ = 'Stripe ist live, aber das Hofpreis-Modell beginnt erst am 1.\u00a0Februar 2027 – Stichtag vorziehen'

const stand = (signal: Partial<LiveSignalStand> | null): AufgabenStand => ({
  ...LEERER_STAND,
  liveSignal: signal ? { umgebung: LIVE, einstellung: { hofpreisModellAb: STICHTAG }, liveSeit: null, ...signal } : null,
})

describe('liveOhneHofpreisModell — die reine Regel', () => {
  it('Produktion live und Stichtag in der Zukunft → wahr (auch ohne Admin-Einstellung: Vorgabe 1.2.2027)', () => {
    expect(liveOhneHofpreisModell(LIVE, { hofpreisModellAb: STICHTAG }, JETZT)).toBe(true)
    expect(liveOhneHofpreisModell(LIVE, null, JETZT)).toBe(true)
  })

  it('Stichtag erreicht (genau an der Grenze schon) → nichts', () => {
    expect(liveOhneHofpreisModell(LIVE, { hofpreisModellAb: ERREICHT }, JETZT)).toBe(false)
    expect(liveOhneHofpreisModell(LIVE, { hofpreisModellAb: JETZT }, JETZT)).toBe(false)
  })

  it('Testmodus, fehlender Schlüssel, Vorschau und lokal → nie', () => {
    const zukunft = { hofpreisModellAb: STICHTAG }
    expect(liveOhneHofpreisModell({ art: 'produktion', stripe: 'test' }, zukunft, JETZT)).toBe(false)
    expect(liveOhneHofpreisModell({ art: 'produktion', stripe: 'fehlt' }, zukunft, JETZT)).toBe(false)
    expect(liveOhneHofpreisModell({ art: 'preview', stripe: 'live' }, zukunft, JETZT)).toBe(false)
    expect(liveOhneHofpreisModell({ art: 'lokal', stripe: 'live' }, zukunft, JETZT)).toBe(false)
  })
})

describe('Admin › Heute: Aufgabe ganz oben, Frist sofort', () => {
  it('live und Stichtag in der Zukunft → eine Aufgabe mit dem Satz, Ziel die Karte, Frist 1 h ab der Live-Schaltung', () => {
    const [a] = ADMIN_AUFGABEN.stripe_live_ohne_hofpreis(stand({ liveSeit: new Date(JETZT.getTime() - 2 * STUNDE) }), JETZT)
    expect(a.titel).toBe(SATZ)
    expect(a.ziel).toBe(`/admin/einstellungen#${HOFPREIS_KARTE_ID}`)
    expect(a.frist.dauerMs).toBe(STUNDE)
    expect(a.frist.ueberfaellig).toBe(true)
    expect(a.bereich).toBe('Betrieb')
  })

  it('ohne Stichtag der Live-Schaltung (oder einer in der Zukunft) zählt die Frist ab jetzt', () => {
    expect(ADMIN_AUFGABEN.stripe_live_ohne_hofpreis(stand({}), JETZT)[0].seit).toEqual(JETZT)
    expect(ADMIN_AUFGABEN.stripe_live_ohne_hofpreis(stand({ liveSeit: new Date(JETZT.getTime() + STUNDE) }), JETZT)[0].seit).toEqual(JETZT)
  })

  it('ganz oben vor jeder anderen Frist — nur eine laufende Notbremse steht davor', () => {
    const mitErstattung: AufgabenStand = {
      ...stand({}),
      erstattungen: [{ id: 'b-1', bestellnummer: 'HM-2610-A1B2', hofName: 'Hof Test', bezahltCents: 1250, schonErstattetCents: 0, zahlungKennung: null, seit: new Date(JETZT.getTime() - 3 * 24 * STUNDE) }],
    }
    expect(sammleAufgaben(mitErstattung, JETZT).map((a) => a.quelle)).toEqual(['stripe_live_ohne_hofpreis', 'erstattung_offen'])
    const mitNotbremse: AufgabenStand = {
      ...mitErstattung,
      bestellstopp: { ab: new Date(JETZT.getTime() - STUNDE).toISOString(), bis: new Date(JETZT.getTime() + STUNDE).toISOString(), grund: 'wartung', satz: 'Gleich wieder da.' },
    }
    expect(sammleAufgaben(mitNotbremse, JETZT).map((a) => a.quelle)).toEqual(['notbremse_aktiv', 'stripe_live_ohne_hofpreis', 'erstattung_offen'])
  })

  it('Gegenproben: Stichtag erreicht, Testmodus, kein Signal geladen → keine Aufgabe', () => {
    expect(ADMIN_AUFGABEN.stripe_live_ohne_hofpreis(stand({ einstellung: { hofpreisModellAb: ERREICHT } }), JETZT)).toEqual([])
    expect(ADMIN_AUFGABEN.stripe_live_ohne_hofpreis(stand({ umgebung: { art: 'produktion', stripe: 'test' } }), JETZT)).toEqual([])
    expect(ADMIN_AUFGABEN.stripe_live_ohne_hofpreis(stand(null), JETZT)).toEqual([])
  })
})

describe('Betriebsleiste: derselbe Satz als Warnung', () => {
  const shell = (props: Partial<AdminShellProps>) =>
    renderToStaticMarkup(
      createElement(AdminShell as unknown as ComponentType<Omit<AdminShellProps, 'children'>>, { personName: 'Max Mustermann', hatHof: false, ...props }, createElement('p', null, 'Inhalt'))
    )

  it('aus derselben Liste wie „Braucht dich“; in der Shell als Link auf die Karte', () => {
    const warnung = liveSignalLeiste(sammleAufgaben(stand({}), JETZT))
    expect(warnung).toEqual({ text: SATZ, href: `/admin/einstellungen#${HOFPREIS_KARTE_ID}` })
    const html = shell({ stripeLiveWarnung: warnung })
    expect(html).toContain(SATZ)
    expect(html).toContain(`href="/admin/einstellungen#${HOFPREIS_KARTE_ID}"`)
  })

  it('Gegenproben: Stichtag erreicht oder Testmodus → keine Warnung, keine Zeile', () => {
    expect(liveSignalLeiste(sammleAufgaben(stand({ einstellung: { hofpreisModellAb: ERREICHT } }), JETZT))).toBeNull()
    expect(liveSignalLeiste(sammleAufgaben(stand({ umgebung: { art: 'produktion', stripe: 'test' } }), JETZT))).toBeNull()
    const html = shell({ stripeLiveWarnung: null })
    expect(html).not.toContain('Stripe ist live')
  })
})

describe('Karte „Hofpreis-Modell ab“: Hinweis im Testmodus', () => {
  const karte = (stripeTest: boolean, erreicht = false) =>
    renderToStaticMarkup(
      createElement(HofpreisStichtag, {
        daten: { tag: '2027-02-01', stichtagIso: null, erreicht, jetzt: JETZT.toISOString() },
        stripeTest,
      })
    )

  it('Testmodus, Stichtag noch offen → der Hinweis; die Karte trägt die Kennung des Ziels', () => {
    expect(VOR_LIVE_HINWEIS).toBe('Vor dem Live-Gang von Stripe auf den Live-Tag oder früher setzen.')
    const html = karte(true)
    expect(html).toContain(VOR_LIVE_HINWEIS)
    expect(html).toContain(`id="${HOFPREIS_KARTE_ID}"`)
  })

  it('Gegenproben: live oder Stichtag erreicht → kein Hinweis', () => {
    expect(karte(false)).not.toContain(VOR_LIVE_HINWEIS)
    expect(karte(true, true)).not.toContain(VOR_LIVE_HINWEIS)
  })
})
