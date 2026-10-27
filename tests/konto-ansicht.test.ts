/**
 * Oberflächen von Nr. 190 (Register N35, N36; Mockups admin-konto-anfrage,
 * admin-konto-schliessen, admin-einstellungen-team) — gerendert mit
 * renderToStaticMarkup, Actions gestellt.
 *
 * Beweist:
 *  - die Akte zeigt die drei Konto-Knöpfe; ein geschlossenes Konto zeigt
 *    „Wieder öffnen …“ statt „Konto schließen …“ und die Frist; nach Stufe 2
 *    nur noch die Auskunft;
 *  - Team: jede Person, Rechte als Schalter mit role="switch" und 44 px
 *    (min-h-11); „ansehen“ immer an und gesperrt, Team und Notfallzugang nur
 *    Inhaber; die eigene Zeile ist kein Knopf; die Vorlagen stehen da;
 *  - die Bestätigungsseite ohne gültigen Link: der neutrale Satz, kein Feld.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) =>
    createElement('a', { href, ...Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'onNavigate' && k !== 'prefetch')) }, children),
}))
vi.mock('@/server/actions/konto-anfragen', () => ({
  aendereAnmeldeEmail: vi.fn(),
  exportiereAuskunftHof: vi.fn(),
  exportiereAuskunftKundin: vi.fn(),
  schliesseKonto: vi.fn(),
  oeffneKontoWieder: vi.fn(),
  bestaetigeEmailAenderung: vi.fn(),
}))
vi.mock('@/server/actions/team', () => ({ ladePersonEin: vi.fn(), setzeTeamRechte: vi.fn(), setzeInhaber: vi.fn(), entfernePerson: vi.fn() }))

import { HofAkteKonto, type HofKontoDaten } from '@/components/admin/hof-akte-konto'
import { EinstellungenTeam } from '@/components/admin/einstellungen-team'
import { EmailBestaetigenKarte } from '@/app/konto/email-bestaetigen/email-bestaetigen-karte'
import { KONTO_ANFRAGE_TEXT as K, EMAIL_BESTAETIGEN_TEXT } from '@/lib/konto-anfragen'
import { ADMIN_RECHTE } from '@/lib/admin-rechte'
import { TEAM_TEXT } from '@/lib/admin-team'
import type { TeamDaten } from '@/server/queries/team'

const konto = (abweichung: Partial<HofKontoDaten> = {}): string =>
  renderToStaticMarkup(createElement(HofAkteKonto, { konto: { farmId: 'f1', name: 'Hof am Bach', anmeldungGekuerzt: 'h•••@example.com', geschlossen: null, schliessenSperre: null, ...abweichung } }))

describe('Konto-Knöpfe in der Akte', () => {
  it('offen: E-Mail ändern, Auskunft, Konto schließen', () => {
    const html = konto()
    for (const k of [K.knopfEmail, K.knopfAuskunft, K.knopfSchliessen]) expect(html).toContain(`>${k}</button>`)
    expect(html).not.toContain(K.knopfWiederOeffnen)
  })

  it('geschlossen: „Wieder öffnen …“ mit Frist statt „Konto schließen …“; nach Stufe 2 nur die Auskunft', () => {
    const zu = konto({ geschlossen: { bis: '26. Nov', wiederOeffnen: true, endgueltig: false } })
    expect(zu).toContain(`>${K.knopfWiederOeffnen}</button>`)
    expect(zu).toContain(K.geschlossenZeile('26. Nov'))
    expect(zu).not.toContain(K.knopfSchliessen)
    const endgueltig = konto({ geschlossen: { bis: null, wiederOeffnen: false, endgueltig: true } })
    expect(endgueltig).toContain(K.endgueltigZeile)
    expect(endgueltig).toContain(`>${K.knopfAuskunft}</button>`)
    for (const k of [K.knopfEmail, K.knopfSchliessen, K.knopfWiederOeffnen]) expect(endgueltig).not.toContain(k)
  })
})

const TEAM: TeamDaten = {
  personen: [
    { id: 'ich', name: 'Ich', du: true, inhaber: true, rechte: [...ADMIN_RECHTE], eingeladenAm: null, passkeys: 2, ersatzcodes: 8 },
    { id: 'p1', name: 'Vertretung', du: false, inhaber: false, rechte: ['mails_nochmal', 'adresse_anzeigen'], eingeladenAm: '26. Okt', passkeys: 0, ersatzcodes: 0 },
  ],
}

describe('Einstellungen › Team', () => {
  const html = renderToStaticMarkup(createElement(EinstellungenTeam, { daten: TEAM }))

  it('Personen: die eigene Zeile als „Du“ ohne Knopf, die andere wählbar mit Marke „eingeladen“', () => {
    expect(html).toContain(`>${TEAM_TEXT.du}<`)
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Vertretung')
    expect(html).toContain(`>${TEAM_TEXT.eingeladenMarke}<`)
    expect(html).toContain(TEAM_TEXT.passkeyFehlt)
    expect(html).toContain(`>${TEAM_TEXT.einladen}`)
  })

  it('Rechte als Schalter (role="switch", 44 px): ansehen + 8 einstellbare + 2 nur Inhaber', () => {
    const schalter = html.match(/role="switch"/g) ?? []
    expect(schalter).toHaveLength(1 + ADMIN_RECHTE.length + 2)
    expect(html.match(/role="switch"[^>]*aria-checked="true"/g)?.length).toBe(1 + 2)
    expect(html).toMatch(/role="switch" aria-checked="true" aria-disabled="true"[^>]*min-h-11/)
    for (const v of ['Nur helfen', 'Wie Inhaber, ohne Team']) expect(html).toContain(`>${v}</button>`)
    expect(html).toContain(TEAM_TEXT.notfallTitel)
  })
})

describe('Bestätigungsseite', () => {
  it('ohne gültigen Link: neutraler Satz, kein Feld', () => {
    const html = renderToStaticMarkup(createElement(EmailBestaetigenKarte, { token: null }))
    expect(html).toContain(EMAIL_BESTAETIGEN_TEXT.ungueltigTitel)
    expect(html).not.toContain('<input')
  })

  it('mit Link: Feld für die neue Adresse und Knopf (16 px über FELD)', () => {
    const html = renderToStaticMarkup(createElement(EmailBestaetigenKarte, { token: 'T'.repeat(43) }))
    expect(html).toContain('type="email"')
    expect(html).toContain(`>${EMAIL_BESTAETIGEN_TEXT.knopf}</button>`)
    expect(html).toContain(EMAIL_BESTAETIGEN_TEXT.vorab)
  })
})
