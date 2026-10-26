/**
 * „Angemeldete Geräte" für Kundinnen und der Satz zur Höchstdauer (Register
 * S18, Nr. 178; Board SterneSicherheit).
 *
 * Beweist:
 *  - Unter /account zeigt der Baustein mit `fuerKundin` „Überall abmelden"
 *    (auch wenn nur dieses Gerät angemeldet ist), den Satz zum Abmelden und den
 *    Weg zu „Was wir speichern" — Gegenprobe: für Höfe bleibt „Alle anderen
 *    abmelden" ohne diese Teile.
 *  - „Mein Konto" rendert den Baustein mit den Zeilen der Seite; ohne Zeilen
 *    keine Karte. Die Seite lädt nur die Sitzungen des eigenen Kontos.
 *  - Konto und Sicherheit gibt den Satz „Du bleibst 30 Tage angemeldet …" mit.
 *  - Die Actions: „Überall abmelden" löscht alle Sitzungen NUR des eigenen
 *    Kontos und nur für eine Kundin; ein Gerät abmelden trägt das eigene Konto
 *    in der WHERE (eine fremde Kennung trifft nichts — gegen die echte
 *    Datenbank in tests/integration/sitzung-dauer.int.test.ts); die Liste
 *    lädt auf der Seite der Rolle neu.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(), requestPasswordReset: vi.fn() } } }))
vi.mock('@/lib/auth-client', () => ({ authClient: { signOut: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: { session: { deleteMany: vi.fn(async () => ({ count: 2 })) } } }))
vi.mock('@/server/geraete', () => ({ loeseEinmalLinkEin: vi.fn() }))
vi.mock('@/server/actions/subscriptions', () => ({ updateSubscription: vi.fn(), deleteCustomerAccount: vi.fn() }))

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AngemeldeteGeraete } from '@/components/konto/angemeldete-geraete'
import { ProfileClient } from '@/app/account/profile/profile-client'
import { GERAETE_TEXT, type GeraeteZeile } from '@/lib/geraete'
import { KUNDIN_GERAETE_TEXT } from '@/lib/sitzung-dauer'
import { meldeGeraetAb, meldeUeberallAb } from '@/server/actions/geraete'

const DIESES: GeraeteZeile = { id: 'a', name: 'iPhone · Safari', art: 'handy', dieses: true, unterzeile: 'dieses Gerät · angemeldet seit 20.10.' }
const ANDERES: GeraeteZeile = { id: 'b', name: 'Windows · Firefox', art: 'computer', dieses: false, unterzeile: 'zuletzt vor 5 Tagen · angemeldet seit 19.10.' }

/** Text ohne die Zeichenreferenzen, mit denen React Anführungszeichen schreibt. */
const klartext = (html: string): string => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"')

const getSession = vi.mocked(auth.api.getSession)
const deleteMany = vi.mocked(prisma.session.deleteMany)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Baustein für Kundinnen', () => {
  it('„Überall abmelden", der Satz und „Was wir speichern" — auch mit nur diesem Gerät', () => {
    for (const zeilen of [[DIESES, ANDERES], [DIESES]]) {
      const html = klartext(renderToStaticMarkup(createElement(AngemeldeteGeraete, { zeilen, fuerKundin: true })))
      expect(html).toContain(KUNDIN_GERAETE_TEXT.ueberallAbmelden)
      expect(html).toContain(KUNDIN_GERAETE_TEXT.hinweis)
      expect(html).toContain('href="/datenschutz"')
      expect(html).not.toContain(GERAETE_TEXT.alleAnderenAbmelden)
    }
  })

  it('Gegenprobe Hof: „Alle anderen abmelden", ohne die Teile der Kundin; mit nur diesem Gerät kein Knopf', () => {
    const html = klartext(renderToStaticMarkup(createElement(AngemeldeteGeraete, { zeilen: [DIESES, ANDERES] })))
    expect(html).toContain(GERAETE_TEXT.alleAnderenAbmelden)
    expect(html).not.toContain(KUNDIN_GERAETE_TEXT.ueberallAbmelden)
    expect(html).not.toContain('href="/datenschutz"')
    const allein = klartext(renderToStaticMarkup(createElement(AngemeldeteGeraete, { zeilen: [DIESES] })))
    expect(allein).not.toContain(GERAETE_TEXT.alleAnderenAbmelden)
  })

  it('ein mitgegebener Satz steht in der Karte, ohne Satz keiner', () => {
    const mit = renderToStaticMarkup(createElement(AngemeldeteGeraete, { zeilen: [DIESES], satz: 'Ein erfundener Satz.' }))
    expect(mit).toContain('Ein erfundener Satz.')
    expect(renderToStaticMarkup(createElement(AngemeldeteGeraete, { zeilen: [DIESES] }))).not.toContain('Ein erfundener Satz.')
  })
})

describe('Seiten', () => {
  const lies = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')
  const props = { user: { id: 'u1', email: 'erika@example.com' }, subscriptions: [] }

  it('„Mein Konto" zeigt die Geräte mit „Überall abmelden" — ohne Zeilen keine Karte', () => {
    const mit = klartext(renderToStaticMarkup(createElement(ProfileClient, { ...props, geraete: [DIESES, ANDERES] })))
    expect(mit).toContain(GERAETE_TEXT.titel)
    expect(mit).toContain('Windows · Firefox')
    expect(mit).toContain(KUNDIN_GERAETE_TEXT.ueberallAbmelden)
    expect(klartext(renderToStaticMarkup(createElement(ProfileClient, props)))).not.toContain(KUNDIN_GERAETE_TEXT.ueberallAbmelden)
  })

  it('die Seite lädt nur die Sitzungen des eigenen Kontos und reicht sie durch', () => {
    const seite = lies('src/app/account/profile/page.tsx')
    expect(seite).toMatch(/ladeAngemeldeteGeraete\(session\.user\.id, session\.session\.id, jetzt\)/)
    expect(seite).toMatch(/geraete=\{geraete\}/)
    expect(lies('src/app/account/profile/profile-client.tsx')).toMatch(/<AngemeldeteGeraete zeilen=\{geraete\} fuerKundin \/>/)
  })

  it('Konto und Sicherheit gibt den Satz zur Höchstdauer mit — Admin-Einstellungen nicht', () => {
    expect(lies('src/app/(hof)/settings/account/page.tsx')).toMatch(/<AngemeldeteGeraete zeilen=\{geraete\} satz=\{SITZUNG_DAUER_SATZ\} \/>/)
    expect(lies('src/app/admin/einstellungen/anmeldung/page.tsx')).not.toContain('SITZUNG_DAUER_SATZ')
  })
})

describe('Actions', () => {
  const sitzung = (role: string) =>
    getSession.mockResolvedValue({ user: { id: 'konto_1', role }, session: { id: 'sitzung_1' } } as never)

  it('„Überall abmelden": alle Sitzungen des eigenen Kontos, auch diese', async () => {
    sitzung('CUSTOMER')
    expect(await meldeUeberallAb()).toEqual({ ok: true, abgemeldet: 2 })
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'konto_1' } })
  })

  it('Gegenprobe: ein Hof, ein Admin-Konto und ohne Sitzung löschen nichts', async () => {
    for (const role of ['FARMER', 'ADMIN']) {
      sitzung(role)
      expect(await meldeUeberallAb()).toHaveProperty('error')
    }
    getSession.mockResolvedValue(null as never)
    expect(await meldeUeberallAb()).toHaveProperty('error')
    expect(deleteMany).not.toHaveBeenCalled()
  })

  it('ein Gerät abmelden: Besitz in der WHERE, die Liste lädt auf der Seite der Rolle neu', async () => {
    sitzung('CUSTOMER')
    await meldeGeraetAb({ sitzungId: 'fremde_sitzung' })
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'fremde_sitzung', userId: 'konto_1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/account/profile')

    sitzung('FARMER')
    await meldeGeraetAb({ sitzungId: 'b' })
    expect(revalidatePath).toHaveBeenLastCalledWith('/settings/account')
  })
})
