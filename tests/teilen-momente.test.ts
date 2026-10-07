/**
 * Teilen-Momente (Gate 7 Aufgabe 5, Nachtlauf Nr. 30): der neue Moment
 * „gespeichert" und der Schalter in den Einstellungen.
 *
 * Beweist:
 *  1. Einmal-Regel „gespeichert": höchstens einmal je Anlass (Produkt bzw.
 *     Familie) und Gerät; ohne lesbaren Speicher nie; ein anderer Anlass fragt
 *     neu. Dieselbe Regel wie „freigeschaltet" und „wieder da".
 *  2. Abschaltung wirkt auf ALLE DREI Momente: Jede „…Moeglich"-Regel sagt
 *     nein, sobald teilenMomenteAus true ist — und jeder Aufruf im Code reicht
 *     den Schalter vom Server weiter (Heute, Produkte).
 *  3. setzeTeilenMomente: Zod (strikt), Besitz über die Sitzung, farmId UND
 *     ownerId in der WHERE-Klausel, schreibt nur den Schalter.
 *  4. Texte des Moments und die Zeile in den Einstellungen.
 *
 * Prisma, Auth und Next sind gemockt — kein Datenbankzugriff. Die
 * Datenbank-Seite prüft tests/integration/teilen-momente.int.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { farm: { updateMany: vi.fn() } } }))

import { setzeTeilenMomente } from '@/server/actions/teilen-momente'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'
import { revalidatePath } from 'next/cache'
import {
  gespeichertOeffnen,
  gespeichertSchluessel,
  leseGespeichertGezeigt,
  merkeGespeichertGezeigt,
} from '@/lib/gespeichert-moment'
import { freischaltMomentMoeglich } from '@/lib/freischalt-moment'
import { gespeichertMomentMoeglich, gespeichertTexte, wiederDaMomentMoeglich } from '@/lib/produkte-hof'
import { TeilenMomenteSchalter } from '@/components/hof-einstellungen/teilen-momente-schalter'
import {
  GESPEICHERT_HINWEIS,
  TEILEN_MOMENTE_PFAD,
  teilenMomenteAn,
  teilenMomenteMeldung,
  teilenMomenteZeile,
} from '@/lib/teilen-momente'

const getSession = vi.mocked(auth.api.getSession)
const farmForUser = vi.mocked(getFarmForUser)
const updateMany = vi.mocked(prisma.farm.updateMany)

/** Ein Speicher wie localStorage, im Arbeitsspeicher. */
function speicher(start: Record<string, string> = {}) {
  const daten = new Map(Object.entries(start))
  return {
    daten,
    getItem: (k: string) => daten.get(k) ?? null,
    setItem: (k: string, v: string) => void daten.set(k, v),
  }
}

const wirft = {
  getItem: () => {
    throw new Error('gesperrt')
  },
  setItem: () => {
    throw new Error('gesperrt')
  },
}

// ─── 1. Einmal-Regel „gespeichert" ──────────────────────────────────────────

describe('Moment „gespeichert": einmal je Anlass und Gerät', () => {
  it('beim ersten Mal öffnen, nach dem Merken nie wieder', () => {
    const s = speicher()
    expect(gespeichertOeffnen(leseGespeichertGezeigt(s, 'p1'))).toBe(true)
    merkeGespeichertGezeigt(s, 'p1')
    expect(s.daten.get(gespeichertSchluessel('p1'))).toBe('1')
    expect(gespeichertOeffnen(leseGespeichertGezeigt(s, 'p1'))).toBe(false)
  })

  it('ein anderes Produkt (bzw. eine andere Familie) ist ein neuer Anlass', () => {
    const s = speicher()
    merkeGespeichertGezeigt(s, 'familie-a')
    expect(gespeichertOeffnen(leseGespeichertGezeigt(s, 'familie-b'))).toBe(true)
  })

  it('ohne Speicher oder bei gesperrtem Speicher nie (höchstens einmal lässt sich nicht halten)', () => {
    expect(leseGespeichertGezeigt(null, 'p1')).toBe('unbekannt')
    expect(gespeichertOeffnen(leseGespeichertGezeigt(null, 'p1'))).toBe(false)
    expect(leseGespeichertGezeigt(wirft, 'p1')).toBe('unbekannt')
    expect(gespeichertOeffnen(leseGespeichertGezeigt(wirft, 'p1'))).toBe(false)
    expect(() => merkeGespeichertGezeigt(wirft, 'p1')).not.toThrow()
  })

  it('ein fremder Wert im Speicher heißt „noch nicht gezeigt" (Zod), nie ein Fehler', () => {
    const s = speicher({ [gespeichertSchluessel('p1')]: 'irgendwas' })
    expect(leseGespeichertGezeigt(s, 'p1')).toBe('nein')
  })

  it('nur, wenn das Neue im Shop steht und der Hof sichtbar ist', () => {
    expect(gespeichertMomentMoeglich({ hofSichtbar: true, online: true, teilenMomenteAus: false })).toBe(true)
    expect(gespeichertMomentMoeglich({ hofSichtbar: false, online: true, teilenMomenteAus: false })).toBe(false)
    expect(gespeichertMomentMoeglich({ hofSichtbar: true, online: false, teilenMomenteAus: false })).toBe(false)
  })

  it('der Moment wird nur nach dem ANLEGEN ausgelöst — Bearbeiten liefert keinen Anlass', () => {
    const dialog = readFileSync(join(process.cwd(), 'src/components/products/product-dialog.tsx'), 'utf8')
    expect(dialog).toMatch(/if \(ergebnis\.angelegt\) onAngelegt\?\.\(/)
    const aktion = readFileSync(join(process.cwd(), 'src/server/actions/products.ts'), 'utf8')
    // updateProduct gibt nie `angelegt` zurück — nur createProduct.
    const update = aktion.slice(aktion.indexOf('export async function updateProduct'), aktion.indexOf('export async function setzeKategorie'))
    expect(update).not.toContain('angelegt')
    expect(aktion.slice(aktion.indexOf('export async function createProduct'), aktion.indexOf('export async function updateProduct'))).toContain(
      'angelegt: { id: neu.id, online: neu.isAvailable }'
    )
  })
})

// ─── 2. Abschaltung wirkt auf alle drei ─────────────────────────────────────

describe('Abschaltung: kein Moment, wenn der Hof sie abgeschaltet hat', () => {
  const freigabe = new Date('2026-10-01T09:00:00Z')

  it('teilenMomenteAn folgt dem Schalter', () => {
    expect(teilenMomenteAn({ teilenMomenteAus: false })).toBe(true)
    expect(teilenMomenteAn({ teilenMomenteAus: true })).toBe(false)
  })

  it.each([
    [
      'freigeschaltet',
      (aus: boolean) => freischaltMomentMoeglich({ approvedAt: freigabe, sichtbar: true, teilenMomenteAus: aus }, freigabe),
    ],
    [
      'wieder da',
      (aus: boolean) => wiederDaMomentMoeglich({ hofSichtbar: true, produktSichtbar: true, wiederDa: true, teilenMomenteAus: aus }),
    ],
    ['gespeichert', (aus: boolean) => gespeichertMomentMoeglich({ hofSichtbar: true, online: true, teilenMomenteAus: aus })],
  ])('„%s": an → ja, aus → nein', (_name, moeglich) => {
    expect(moeglich(false)).toBe(true)
    expect(moeglich(true)).toBe(false)
  })

  it('jeder Aufruf einer „…Moeglich"-Regel im Code reicht den Schalter vom Server weiter', () => {
    const dateien = [
      'src/app/(hof)/dashboard/page.tsx',
      'src/components/produkte/produkte-ansicht.tsx',
    ]
    const aufrufe = dateien.flatMap((pfad) => {
      const text = readFileSync(join(process.cwd(), pfad), 'utf8')
      return [...text.matchAll(/(freischalt|wiederDa|gespeichert)MomentMoeglich\(([\s\S]*?)\)\)?/g)].map((t) => ({ pfad, regel: t[1], argument: t[2] }))
    })
    // Gegenprobe gegen eine leere Suche: alle drei Momente kommen vor.
    expect(new Set(aufrufe.map((a) => a.regel))).toEqual(new Set(['freischalt', 'wiederDa', 'gespeichert']))
    for (const a of aufrufe) {
      // Heute reicht das ganze hof-Objekt aus getHeute weiter (es trägt teilenMomenteAus).
      expect(a.argument, `${a.pfad}: ${a.regel}`).toMatch(/teilenMomenteAus: hof\.teilenMomenteAus|^heute\.hof,/)
    }
  })

  it('die Lesepfade holen den Schalter aus der Datenbank, und ohne Hof gilt „aus"', () => {
    for (const pfad of ['src/server/queries/heute.ts', 'src/server/queries/products.ts']) {
      const text = readFileSync(join(process.cwd(), pfad), 'utf8')
      expect(text, pfad).toContain('teilenMomenteAus: true,')
      expect(text, pfad).toContain('teilenMomenteAus: hof?.teilenMomenteAus ?? true')
    }
    expect(readFileSync(join(process.cwd(), 'src/app/(hof)/products/page.tsx'), 'utf8')).toContain(
      'teilenMomenteAus: seite.teilenMomenteAus'
    )
  })
})

// ─── 3. Action ──────────────────────────────────────────────────────────────

describe('setzeTeilenMomente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
    farmForUser.mockResolvedValue({ id: 'farm_1', slug: 'testhof', name: 'Hof Test' } as never)
    updateMany.mockResolvedValue({ count: 1 })
  })

  it('abschalten: schreibt nur teilenMomenteAus = true, Besitz und farmId in der WHERE-Klausel', async () => {
    expect(await setzeTeilenMomente({ an: false })).toEqual({ ok: true, an: false })
    expect(updateMany).toHaveBeenCalledTimes(1)
    expect(updateMany.mock.calls[0][0]).toEqual({ where: { id: 'farm_1', ownerId: 'user_1' }, data: { teilenMomenteAus: true } })
    expect(farmForUser).toHaveBeenCalledWith('user_1')
    for (const pfad of ['/settings', TEILEN_MOMENTE_PFAD, '/dashboard', '/products']) expect(revalidatePath).toHaveBeenCalledWith(pfad)
  })

  it('anschalten: teilenMomenteAus = false', async () => {
    expect(await setzeTeilenMomente({ an: true })).toEqual({ ok: true, an: true })
    expect(updateMany.mock.calls[0][0].data).toEqual({ teilenMomenteAus: false })
  })

  it.each([
    ['ohne Feld', {}],
    ['kein Wahrheitswert', { an: 'ja' }],
    ['fremde farmId dazu (strikt)', { an: false, farmId: 'fremd' }],
    ['null', null],
  ])('Zod lehnt ab (%s), ohne zu lesen oder zu schreiben', async (_fall, eingabe) => {
    const ergebnis = await setzeTeilenMomente(eingabe)
    expect(ergebnis).toHaveProperty('error')
    expect(getSession).not.toHaveBeenCalled()
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('ohne Anmeldung oder ohne Hof: nichts geschrieben', async () => {
    getSession.mockResolvedValueOnce(null as never)
    expect(await setzeTeilenMomente({ an: false })).toEqual({ error: 'Bitte melde dich neu an.' })
    farmForUser.mockResolvedValueOnce(null as never)
    expect(await setzeTeilenMomente({ an: false })).toEqual({ error: 'Kein Hof gefunden.' })
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('trifft die WHERE-Klausel keine Zeile, kommt ein Fehler und nichts wird neu geladen', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 })
    expect(await setzeTeilenMomente({ an: false })).toHaveProperty('error')
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

// ─── 4. Texte ───────────────────────────────────────────────────────────────

describe('Texte', () => {
  it('Moment „gespeichert" nach Mockup: „… ist online", „Neu bei uns: …", mit nächster Abholung', () => {
    const texte = gespeichertTexte('Bergwiesen-Heu', null)
    expect(texte.titel).toBe('Bergwiesen-Heu ist online')
    expect(texte.teilenText).toBe('Neu bei uns: Bergwiesen-Heu.')
    expect(GESPEICHERT_HINWEIS).toBe('Fragt nur einmal pro Produkt. Abschalten unter Einstellungen.')
  })

  it('Zeile und Meldung für an und aus', () => {
    expect(teilenMomenteZeile(false)).toMatch(/^An · /)
    expect(teilenMomenteZeile(true)).toMatch(/^Aus · /)
    expect(teilenMomenteMeldung(true)).toBe('Teilen-Hinweise sind an')
    expect(teilenMomenteMeldung(false)).toBe('Teilen-Hinweise sind aus')
  })
})

describe('Schalter auf /settings/teilen', () => {
  it('ein Schalter für alle drei: role="switch", Zustand in aria-checked, 44 px, sichtbarer Fokus', () => {
    const an = renderToStaticMarkup(createElement(TeilenMomenteSchalter, { anfangsAn: true }))
    expect(an.match(/role="switch"/g)).toHaveLength(1)
    expect(an).toContain('aria-checked="true"')
    expect(an).toContain('Teilen-Hinweise zeigen')
    expect(an).toContain('min-h-11')
    expect(an).toContain('focus-visible:outline-solid')
    // Alle drei Momente sind genannt.
    for (const wort of ['freigeschaltet', 'neues Produkt', 'wieder Vorrat']) expect(an).toContain(wort)
    const aus = renderToStaticMarkup(createElement(TeilenMomenteSchalter, { anfangsAn: false }))
    expect(aus).toContain('aria-checked="false"')
  })

  it('die Seite liest den Schalter des eigenen Hofs und hat eine Ladeansicht', () => {
    const seite = readFileSync(join(process.cwd(), 'src/app/(hof)/settings/teilen/page.tsx'), 'utf8')
    expect(seite).toContain('ladeTeilenMomente(session.user.id)')
    expect(seite).toContain('<TeilenMomenteSchalter anfangsAn={teilenMomenteAn(hof)} />')
    expect(readFileSync(join(process.cwd(), 'src/app/(hof)/settings/teilen/loading.tsx'), 'utf8')).toContain('aria-busy="true"')
  })
})
