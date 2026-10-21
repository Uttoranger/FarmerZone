/**
 * „Dein Beitrag“ in Heute (Register E12, Ergänzung Nr. 129; Board
 * system-k2-beitraege-v2, Abschnitt 5) und „Aktuell vom Hof“ in Mein Hof ›
 * Hofseite.
 *
 * Beweist:
 *  - Reihenfolge: der Block 'beitrag' nach Packliste und „Braucht dich“, vor
 *    der Teilen-Zeile, nie oben; ohne Beitrag bleibt alles wie bisher.
 *  - Die Karte: Anlass, seit wann und wie lange noch (bzw. „ohne Ende“), die
 *    E-Mail- und WhatsApp-Zahl nur über null, „Teilen“ (Teilen-Fenster im
 *    Beitrag-Modus), „Ansehen“ auf `?beitrag=`, „Neuer Beitrag“.
 *  - Der Anstoß nur ohne laufenden Beitrag, ohne Beitrag in 14 Tagen und mit
 *    Produkten im Shop — mit den vier Anlässen als Links mit `?anlass=`.
 *  - Mein Hof: die Zeile mit und ohne Beitrag.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) =>
    createElement('a', { href, ...rest }, children),
}))
// Die Grenze zum Server: Das Teilen-Fenster lädt seine Daten erst auf Wunsch.
vi.mock('@/server/actions/teilen-fenster', () => ({ ladeTeilenFensterBeitragAction: vi.fn() }))

import {
  ANSTOSS_NACH_TAGEN,
  anstossLinks,
  beitragBlock,
  deinBeitragZeile,
  heuteAufbau,
  laeuftNochText,
  seitWannText,
  versandZeilen,
  type DeinBeitrag,
} from '@/lib/heute'
import { BEITRAG_ANLAESSE } from '@/lib/beitrag-anlass'
import { aktuellZeile } from '@/lib/mein-hof-ansicht'
import { BEITRAEGE_HREF } from '@/lib/bauern-navigation'
import { BeitragAnstoss, DeinBeitragKarte } from '@/components/heute/dein-beitrag'

const STUNDE = 3_600_000
const JETZT = new Date('2026-10-20T10:00:00.000Z')
const vor = (ms: number): string => new Date(JETZT.getTime() - ms).toISOString()
const nach = (ms: number): string => new Date(JETZT.getTime() + ms).toISOString()

const BEITRAG: DeinBeitrag = {
  id: 'cbeitragkuerbis',
  titel: 'Die ersten Kürbisse sind da',
  anlass: 'NEW_SEASON',
  foto: null,
  veroeffentlicht: vor(2 * STUNDE),
  endet: nach(6 * 24 * STUNDE + 22 * STUNDE),
  emailAnzahl: 24,
  whatsappAnzahl: 9,
}

describe('heuteAufbau mit „Dein Beitrag“', () => {
  it('nach Packliste und „Braucht dich“, vor der Teilen-Zeile — nie oben', () => {
    for (const stripeHinweis of [true, false]) {
      const mit = heuteAufbau({ stripeHinweis, teilen: true, zuTun: false, postfach: false, beitrag: true })
      expect(mit.haupt).toEqual(['packliste', 'braucht-dich', 'beitrag', 'teilen'])
      expect(mit.oben).not.toContain('beitrag')
      expect(mit.seite).not.toContain('beitrag')
    }
    expect(heuteAufbau({ stripeHinweis: false, teilen: false, zuTun: false, postfach: true, beitrag: true }).haupt).toEqual([
      'postfach',
      'packliste',
      'braucht-dich',
      'beitrag',
    ])
  })

  it('Gegenprobe: ohne Beitrag-Block bleibt der Aufbau wie bisher', () => {
    expect(heuteAufbau({ stripeHinweis: false, teilen: true, zuTun: false, postfach: false }).haupt).toEqual(['packliste', 'braucht-dich', 'teilen'])
  })
})

describe('Die Zeile der Karte', () => {
  it('„Neue Saison · seit 2 Stunden · läuft noch 6 Tage“', () => {
    expect(deinBeitragZeile(BEITRAG, 'Neue Saison', JETZT)).toBe('Neue Saison · seit 2 Stunden · läuft noch 6 Tage')
  })

  it('ohne Ende „ohne Ende“; kurz vor dem Ende in Stunden, nie mehr versprochen, als bleibt', () => {
    expect(laeuftNochText(null, JETZT)).toBe('ohne Ende')
    expect(laeuftNochText(nach(24 * STUNDE - 1), JETZT)).toBe('läuft noch 23 Stunden')
    expect(laeuftNochText(nach(24 * STUNDE), JETZT)).toBe('läuft noch 1 Tag')
    expect(laeuftNochText(nach(STUNDE - 1), JETZT)).toBe('läuft noch unter 1 Stunde')
    // Einzahl und Mehrzahl (mitAnzahl, src/lib/format.ts): die Texte bleiben, wie sie waren.
    expect(laeuftNochText(nach(STUNDE), JETZT)).toBe('läuft noch 1 Stunde')
    expect(laeuftNochText(nach(2 * 24 * STUNDE), JETZT)).toBe('läuft noch 2 Tage')
  })

  it('seit wann: Minuten, Stunden, Tage', () => {
    expect(seitWannText(vor(STUNDE - 1), JETZT)).toBe('seit wenigen Minuten')
    expect(seitWannText(vor(STUNDE), JETZT)).toBe('seit 1 Stunde')
    expect(seitWannText(vor(3 * 24 * STUNDE), JETZT)).toBe('seit 3 Tagen')
    expect(seitWannText(vor(24 * STUNDE), JETZT)).toBe('seit 1 Tag')
    expect(seitWannText(vor(2 * STUNDE), JETZT)).toBe('seit 2 Stunden')
  })

  it('E-Mail- und WhatsApp-Zahl nur über null', () => {
    expect(versandZeilen(BEITRAG).map((z) => z.text)).toEqual(['per E-Mail an 24', 'per WhatsApp an 9 geschickt'])
    expect(versandZeilen({ emailAnzahl: 0, whatsappAnzahl: 3 }).map((z) => z.text)).toEqual(['per WhatsApp an 3 geschickt'])
    expect(versandZeilen({ emailAnzahl: 0, whatsappAnzahl: 0 })).toEqual([])
  })
})

describe('Karte oder Anstoß (beitragBlock)', () => {
  it('mit laufendem Beitrag immer die Karte', () => {
    expect(beitragBlock({ aktiv: BEITRAG, beitragInFrist: true, produkteImShop: false })).toBe('karte')
  })

  it('der Anstoß nur ohne Beitrag in 14 Tagen und mit Produkten im Shop — sonst nichts', () => {
    expect(ANSTOSS_NACH_TAGEN).toBe(14)
    expect(beitragBlock({ aktiv: null, beitragInFrist: false, produkteImShop: true })).toBe('anstoss')
    expect(beitragBlock({ aktiv: null, beitragInFrist: true, produkteImShop: true })).toBeNull()
    expect(beitragBlock({ aktiv: null, beitragInFrist: false, produkteImShop: false })).toBeNull()
  })

  it('die vier Anlässe als Links auf „Neuer Beitrag“ mit `?anlass=`', () => {
    expect(anstossLinks()).toEqual(BEITRAG_ANLAESSE.map((anlass) => ({ anlass, href: `/status/new?anlass=${anlass}` })))
    expect(anstossLinks()).toHaveLength(4)
  })
})

describe('Die Karte und der Anstoß, gerendert', () => {
  const html = (beitrag: DeinBeitrag) => renderToStaticMarkup(createElement(DeinBeitragKarte, { beitrag, hofSlug: 'testhof-a', jetzt: JETZT.toISOString() }))

  it('mit Ende: alle Angaben, Teilen, Ansehen auf ?beitrag=, Neuer Beitrag', () => {
    const karte = html(BEITRAG)
    expect(karte).toContain('Dein Beitrag')
    expect(karte).toContain('steht oben auf deiner Hofseite')
    expect(karte).toContain('Neue Saison · seit 2 Stunden · läuft noch 6 Tage')
    expect(karte).toContain('per E-Mail an 24')
    expect(karte).toContain('per WhatsApp an 9 geschickt')
    expect(karte).toContain('Teilen')
    expect(karte).toContain('href="/testhof-a?beitrag=cbeitragkuerbis"')
    expect(karte).toContain('href="/status/new"')
  })

  it('ohne Ende „ohne Ende“; ohne Versand keine Zahlen', () => {
    const karte = html({ ...BEITRAG, endet: null, emailAnzahl: 0, whatsappAnzahl: 0 })
    expect(karte).toContain('Neue Saison · seit 2 Stunden · ohne Ende')
    expect(karte).not.toContain('per E-Mail')
    expect(karte).not.toContain('per WhatsApp')
  })

  it('der Anstoß mit Titel, Satz aus dem Board und den vier Links', () => {
    const anstoss = renderToStaticMarkup(createElement(BeitragAnstoss))
    expect(anstoss).toContain('Was gibt’s Neues am Hof?')
    expect(anstoss).toContain('Ein kurzer Beitrag steht oben auf deiner Hofseite.')
    for (const anlass of BEITRAG_ANLAESSE) expect(anstoss).toContain(`href="/status/new?anlass=${anlass}"`)
    expect(anstoss).not.toContain('Nicht jetzt')
  })
})

describe('Mein Hof › Hofseite: die Zeile „Aktuell vom Hof“', () => {
  it('mit Beitrag: Titel, „läuft noch …“ und der Weg zu den Beiträgen', () => {
    expect(aktuellZeile({ titel: BEITRAG.titel, endet: BEITRAG.endet }, JETZT)).toEqual({
      titel: 'Aktuell vom Hof',
      wert: 'Die ersten Kürbisse sind da · läuft noch 6 Tage',
      link: { text: 'Beiträge', href: BEITRAEGE_HREF },
    })
  })

  it('ohne Beitrag: „Kein Beitrag“ und „Neuer Beitrag“', () => {
    expect(aktuellZeile(null, JETZT)).toEqual({ titel: 'Aktuell vom Hof', wert: 'Kein Beitrag', link: { text: 'Neuer Beitrag', href: '/status/new' } })
  })
})
