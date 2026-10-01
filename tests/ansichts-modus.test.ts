/**
 * Tests für ansichtsModus (src/lib/ansichts-modus.ts) — die eine Funktion, die
 * entscheidet, was die Vorschau der Hofseite von der Seite für Kundinnen
 * unterscheidet.
 *
 * Beweist, mit nachgebildeten Quellen statt Sitzung und Datenbank:
 *  - Die Vorschau bekommt nur der angemeldete Besitzer genau dieses Hofs mit
 *    ?vorschau=1 — und nur er sieht den Hof vor der Freigabe, nur bei ihm ist
 *    Kaufen wirkungslos.
 *  - Abgemeldet, fremder Nutzer, unbekannter Hof, anderer Wert: die Seite wie
 *    für alle, Kaufen wirkt.
 *  - noindex, sobald der Parameter dasteht — mit jedem Wert, mit und ohne Recht.
 *  - Mehrfach in der Adresse: der letzte Wert zählt (wie die Header-Regel).
 *  - Die Sitzung wird nur mit ?vorschau=1 gefragt, der Besitzer nur, wenn
 *    jemand angemeldet ist.
 */
import { describe, it, expect, vi } from 'vitest'
import { ansichtsModus, type AnsichtsModus, type Suchparameter } from '@/lib/ansichts-modus'

const BESITZER = 'user_hof'

const KUNDIN: AnsichtsModus = { art: 'kundin', besitzerVorFreigabe: null, noindex: false, kaufen: true }
const KUNDIN_OHNE_INDEX: AnsichtsModus = { ...KUNDIN, noindex: true }
const VORSCHAU: AnsichtsModus = { art: 'vorschau', besitzerVorFreigabe: BESITZER, noindex: true, kaufen: false }

/** Quellen, die mitzählen, ob sie gefragt wurden. */
function quellen(angemeldet: string | null, besitzer: string | null = BESITZER) {
  return {
    angemeldeterNutzer: vi.fn(async () => angemeldet),
    besitzer: vi.fn(async () => besitzer),
  }
}

async function modus(suche: Suchparameter, q: ReturnType<typeof quellen>): Promise<AnsichtsModus> {
  return ansichtsModus(suche, q)
}

describe('ansichtsModus — wer die Vorschau bekommt', () => {
  it('der angemeldete Besitzer mit ?vorschau=1: Vorschau — vor der Freigabe sichtbar, noindex, Kaufen wirkungslos', async () => {
    expect(await modus({ vorschau: '1' }, quellen(BESITZER))).toEqual(VORSCHAU)
  })

  it('abgemeldet mit ?vorschau=1: die Seite für alle, aber noindex — der Besitzer wird gar nicht erst gefragt', async () => {
    const q = quellen(null)
    expect(await modus({ vorschau: '1' }, q)).toEqual(KUNDIN_OHNE_INDEX)
    expect(q.besitzer).not.toHaveBeenCalled()
  })

  it('ein fremder angemeldeter Nutzer mit ?vorschau=1: die Seite für alle, noindex', async () => {
    expect(await modus({ vorschau: '1' }, quellen('user_anderer'))).toEqual(KUNDIN_OHNE_INDEX)
  })

  it('kein Hof zu diesem Slug: die Seite für alle, noindex', async () => {
    expect(await modus({ vorschau: '1' }, quellen(BESITZER, null))).toEqual(KUNDIN_OHNE_INDEX)
  })
})

describe('ansichtsModus — der Parameter', () => {
  it('ohne Parameter: Kundin, ohne noindex — und weder Sitzung noch Besitzer werden gefragt', async () => {
    const q = quellen(BESITZER)
    expect(await modus({}, q)).toEqual(KUNDIN)
    expect(await modus({ reorder: 'token', bereich: 'futter' }, q)).toEqual(KUNDIN)
    expect(q.angemeldeterNutzer).not.toHaveBeenCalled()
    expect(q.besitzer).not.toHaveBeenCalled()
  })

  it('ein anderer Wert als „1": Kundin, aber noindex — auch für den Besitzer, ohne die Sitzung zu lesen', async () => {
    const q = quellen(BESITZER)
    for (const wert of ['0', '', 'ja', 'true', ' 1']) {
      expect(await modus({ vorschau: wert }, q), JSON.stringify(wert)).toEqual(KUNDIN_OHNE_INDEX)
    }
    expect(q.angemeldeterNutzer).not.toHaveBeenCalled()
  })

  it('mehrfach in der Adresse: der letzte Wert zählt', async () => {
    expect(await modus({ vorschau: ['0', '1'] }, quellen(BESITZER))).toEqual(VORSCHAU)
    expect(await modus({ vorschau: ['1', '0'] }, quellen(BESITZER))).toEqual(KUNDIN_OHNE_INDEX)
  })
})
