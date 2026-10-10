/**
 * Konditionen-Übergang (Register K1, Nachtlauf 17d): „In der Startphase
 * kostenlos. Die Tarife gelten ab 1. Februar 2027. Bereits freigeschaltete
 * Höfe behalten ihre zugesagten Konditionen."
 *
 * Beweis in drei Schritten:
 *  1. Die Quelle: Satz und Datum stehen in src/lib/konditionen.ts, das Datum
 *     als EINE Konstante, angezeigt über den gemeinsamen Formatierer.
 *  2. Kein zweites Exemplar: Außer konditionen.ts nennt keine Datei unter
 *     src/ das Jahr oder einen Teil des Satzes (mit Gegenprobe).
 *  3. Die Seiten zeigen ihn: /fuer-hoefe, /konditionen, Registrieren,
 *     Einrichten — gerendert; die Admin-Freischaltung über den Quelltext
 *     (der Dialog öffnet erst im Browser).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => createElement('img', { alt }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/register' }))
vi.mock('@/components/shared/kunden-kopf', () => ({ KundenKopf: () => null }))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))
vi.mock('@/server/actions/register', () => ({ registerFarmer: vi.fn() }))
vi.mock('@/server/actions/onboarding', () => ({ checkSlugAvailability: vi.fn(), createFarm: vi.fn() }))
vi.mock('@/server/actions/email-bestaetigung', () => ({ sendeBestaetigungErneut: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ signIn: { email: vi.fn() } }))

import KonditionenPage, { metadata as konditionenMeta } from '@/app/(public)/konditionen/page'
import FuerHoefePage, { metadata as fuerHoefeMeta } from '@/app/(public)/fuer-hoefe/page'
import { RegisterForm } from '@/app/(auth)/register/register-form'
import { EinrichtenSeite } from '@/components/einrichten/einrichten-seite'
import { einrichtenStand } from '@/lib/einrichten'
import { formatDatumLang } from '@/lib/format'
import {
  KONDITIONEN_DERZEIT,
  KONDITIONEN_UEBERGANG,
  MONATSABRECHNUNG_TEXT,
  TARIFE_AB,
  TARIFE_AB_TAG,
  TARIFE_AB_TEXT,
} from '@/lib/konditionen'
import { FUER_HOEFE_SCHRITTE, REGISTRIEREN_SCHRITTE } from '@/lib/fuer-hoefe'

const WORTLAUT =
  'In der Startphase kostenlos. Die Tarife gelten ab 1. Februar 2027. ' +
  'Bereits freigeschaltete Höfe behalten ihre zugesagten Konditionen.'

/** Das geschützte Leerzeichen nach dem Tag ist Satz, nicht Wortlaut — für den Vergleich mit dem Register. */
const normal = (text: string): string => text.replace(/\u00a0/g, ' ')
const lies = (datei: string): string => readFileSync(join(process.cwd(), datei), 'utf8')
const entschaerft = (text: string): string => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

describe('Quelle — src/lib/konditionen.ts', () => {
  it('der Satz steht wörtlich so da, wie das Register K1 ihn festlegt', () => {
    expect(normal(KONDITIONEN_UEBERGANG)).toBe(WORTLAUT)
  })

  it('das Datum ist EIN Kalendertag, Mitternacht in Wien', () => {
    expect(TARIFE_AB_TAG).toBe('2027-02-01')
    // Winterzeit: Wiener Mitternacht ist 23:00 UTC des Vortags.
    expect(TARIFE_AB.toISOString()).toBe('2027-01-31T23:00:00.000Z')
  })

  it('angezeigt über den gemeinsamen Formatierer, nicht als freier Text', () => {
    expect(TARIFE_AB_TEXT).toBe(formatDatumLang(TARIFE_AB))
    expect(normal(TARIFE_AB_TEXT)).toBe('1. Februar 2027')
    // „1." bleibt am Handy beim Monat, statt allein am Zeilenende zu stehen.
    expect(TARIFE_AB_TEXT).toBe('1.\u00a0Februar 2027')
    expect(KONDITIONEN_UEBERGANG).toContain(TARIFE_AB_TEXT)
  })

  it('der Admin-Hinweis sagt dasselbe, mit „Derzeit gilt"', () => {
    expect(normal(KONDITIONEN_DERZEIT)).toBe(`Derzeit gilt: ${WORTLAUT}`)
  })

  it('die Monatsabrechnung beginnt erst am Stichtag — kein Einzug im Präsens', () => {
    expect(MONATSABRECHNUNG_TEXT.startsWith(`Ab dem ${TARIFE_AB_TEXT} rechnen wir einmal im Monat per SEPA-Lastschrift ab:`)).toBe(true)
    expect(MONATSABRECHNUNG_TEXT).not.toMatch(/Die Monatsabrechnung .* umfasst/)
  })
})

/** Alle Quelldateien unter src/ (rekursiv). */
function quelldateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return quelldateien(pfad)
    return /\.(ts|tsx)$/.test(name) ? [pfad] : []
  })
}

/** Der Stichtag in jeder üblichen Schreibweise oder ein Teil des Satzes — außerhalb von konditionen.ts verboten. */
const ZWEITES_EXEMPLAR =
  /2027-02-01|Februar[\s\u00a0]+2027|\b0?1\.[\s\u00a0]*0?2\.[\s\u00a0]*2027|Startphase|Die Tarife gelten ab|zugesagten Konditionen/

describe('Kein zweites Exemplar unter src/', () => {
  const dateien = quelldateien(join(process.cwd(), 'src')).map((p) => relative(process.cwd(), p))

  it('nur src/lib/konditionen.ts nennt das Datum oder den Satz', () => {
    const treffer = dateien.filter((d) => ZWEITES_EXEMPLAR.test(lies(d)))
    expect(treffer).toEqual(['src/lib/konditionen.ts'])
  })

  it('Gegenprobe: die Suche schlägt bei Datum und Satzteilen an', () => {
    for (const text of [
      'ab 1.2.2027',
      'bis 01.02.2027',
      '2027-02-01',
      'ab 1. Februar 2027',
      'ab 1.\u00a0Februar 2027',
      'In der Startphase kostenlos',
      'ihre zugesagten Konditionen',
    ]) {
      expect(text).toMatch(ZWEITES_EXEMPLAR)
    }
    // Ein anderes Datum im selben Jahr ist kein zweites Exemplar.
    for (const text of ['Stand: 15.03.2027', '2027-03-01', 'Juni 2027']) expect(text).not.toMatch(ZWEITES_EXEMPLAR)
    expect(dateien.length).toBeGreaterThan(100)
  })

  it('die alten Sätze, die Tarife als sofort gültig darstellten, sind weg', () => {
    const alt = /Kostenlos starten mit dem Tarif|Mit dem Tarif Hoftor ab|SEPA-Mandat für die Monatsabrechnung\.|SEPA für die Monatsabrechnung'/
    expect(dateien.filter((d) => alt.test(lies(d)))).toEqual([])
  })
})

describe('Die Seiten zeigen den Satz', () => {
  const satz = entschaerft(KONDITIONEN_UEBERGANG)

  it('/fuer-hoefe — im Einstieg und bei den Preisen, Metadaten ohne sofortigen Tarif', () => {
    const html = renderToStaticMarkup(createElement(FuerHoefePage))
    expect(html.split(satz).length - 1).toBe(2)
    expect(fuerHoefeMeta.description).toContain(TARIFE_AB_TEXT)
    expect(fuerHoefeMeta.description).not.toMatch(/Start mit dem Tarif/)
  })

  it('/konditionen — über den Tarifen, Metadaten mit dem Datum', () => {
    const html = renderToStaticMarkup(createElement(KonditionenPage))
    expect(html).toContain(satz)
    expect(html.indexOf(satz)).toBeLessThan(html.indexOf('Hoftor'))
    expect(konditionenMeta.description).toContain(TARIFE_AB_TEXT)
  })

  it('/register — über dem Formular, statt „Kostenlos starten mit dem Tarif …"', () => {
    const html = renderToStaticMarkup(createElement(RegisterForm, { formToken: 'token' }))
    expect(html).toContain(satz)
    expect(html.indexOf(satz)).toBeLessThan(html.indexOf('<form'))
  })

  it('/onboarding — in der Tarif-Karte', () => {
    const html = renderToStaticMarkup(
      createElement(EinrichtenSeite, {
        stand: einrichtenStand({
          personName: 'Max Mustermann',
          email: 'max@example.com',
          hof: {
            name: 'Hof Test',
            hofseite: { erledigt: 7, gesamt: 11, fehlend: ['Logo'] },
            produkte: 0,
            stripeBereit: false,
            freigeschaltet: false,
          },
        }),
        vorname: 'Max',
        person: { name: 'Max Mustermann', email: 'max@example.com' },
        tarif: null,
        freigeschaltet: false,
      })
    )
    expect(html).toContain(satz)
  })

  it('Admin-Freischaltung — der Hinweis kommt aus konditionen.ts und steht im Freischalten-Dialog', () => {
    // Seit Nr. 22f steht die Rückfrage in der AdminShell in einer eigenen Datei.
    const quelle = lies('src/components/admin/hof-aktion-dialog.tsx')
    expect(quelle).toMatch(/import \{[^}]*KONDITIONEN_DERZEIT[^}]*\} from '@\/lib\/konditionen'/)
    // Zwischen dem Zweig „Freischalten" und dem Zweig „Zurücknehmen" des Dialogs.
    const hinweis = quelle.indexOf('{KONDITIONEN_DERZEIT}')
    expect(hinweis).toBeGreaterThan(quelle.indexOf("art === 'approve' ? ("))
    expect(hinweis).toBeLessThan(quelle.indexOf('Die Hofseite von'))
    // Verhalten unverändert: die Gründungsplatz-Zusage bleibt im Dialog.
    expect(quelle).toContain('{GRUENDUNGS_KONDITIONEN}')
  })

  it('„So startest du" und „So geht es weiter" verlangen kein SEPA-Mandat für heute', () => {
    for (const schritt of [...FUER_HOEFE_SCHRITTE, ...REGISTRIEREN_SCHRITTE]) {
      if (schritt.text.includes('SEPA')) expect(schritt.text, schritt.titel).toMatch(/jetzt nichts zu tun/)
    }
  })
})
