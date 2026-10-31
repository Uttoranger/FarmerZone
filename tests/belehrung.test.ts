/**
 * Belehrung nach Anhang I FAGG (Nr. 207, Auftrag Punkt 0) — der Wortlaut in
 * src/lib/widerruf.ts, die Füllung mit den Angaben des Hofs und die Seite
 * /widerruf mit und ohne signierten Link.
 *
 * Beweist:
 *  - Teil A und Teil B stehen im Wortlaut des Auftrags (Stichsätze), ohne den
 *    Platzhalter-Vermerk aus Nr. 200 und ohne Hinweis auf AGB Punkt 12;
 *  - mit Hof stehen Name (Hof und Inhaber), Anschrift, Telefon und E-Mail an
 *    der Stelle in Teil A, im Formular (Teil B) Name, Anschrift und E-Mail —
 *    keine eckige Klammer bleibt; ohne Hof der Satz „… – stehen in deiner
 *    Bestellung“; eine fehlende Angabe fällt weg, statt einen Platzhalter zu
 *    erfinden;
 *  - /widerruf mit gültigem Link: die vier Angaben des Hofs DIESER Bestellung
 *    (E-Mail über hofKontaktEmail, ohne Hof-E-Mail die Anmelde-Adresse); ohne
 *    Link: keine Abfrage, der Hinweis auf die Bestellung.
 * Gegenprobe jeweils mit dem anderen Fall.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findUnique: vi.fn() } } }))
vi.mock('@/server/actions/widerruf', () => ({ reicheWiderrufMitLinkEin: vi.fn(), reicheWiderrufOhneLinkEin: vi.fn() }))
// Die Shell liest die Sitzung im Browser — hier zählt nur der Inhalt der Seite.
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({ KundeShellMitSitzung: ({ children }: { children: ReactNode }) => children }))

import { prisma } from '@/lib/prisma'
import { widerrufSignatur } from '@/lib/bestell-link'
import { BELEHRUNG, HOF_ANGABEN_OHNE_LINK, belehrungHof, belehrungMitHof, belehrungMitKostenschaetzung, type Belehrung } from '@/lib/widerruf'
import { PRODUKTION_HOST } from '@/lib/umgebung'
import WiderrufPage from '@/app/(public)/widerruf/page'

const db = vi.mocked(prisma, true)

const HOF = { name: 'Hof Beispiel', ownerName: 'Max Muster', address: 'Feldweg 1', postalCode: '4910', city: 'Beispieldorf', phone: '+43 664 0000000' }

/** Alle Texte der Belehrung in Lesereihenfolge. */
function texte(b: Belehrung): string[] {
  return [
    b.teilA.titel,
    ...b.teilA.abschnitte.flatMap((a) => [a.titel, ...a.absaetze]),
    b.teilB.titel,
    b.teilB.einleitung,
    ...b.teilB.zeilen,
    b.teilB.fussnote,
    b.hinweis,
  ]
}

/** React maskiert Anführungen und Apostrophe — für den Vergleich mit dem Text zurück. */
function klartext(html: string): string {
  return html.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
}

describe('Wortlaut Anhang I FAGG (Auftrag 207)', () => {
  it('Teil A und Teil B stehen wörtlich da — Stichsätze aus dem Auftrag', () => {
    const alle = texte(BELEHRUNG).join('\n')
    expect(BELEHRUNG.teilA.titel).toBe('Teil A – Widerrufsbelehrung')
    expect(BELEHRUNG.teilA.abschnitte.map((a) => a.titel)).toEqual(['Widerrufsrecht', 'Folgen des Widerrufs'])
    expect(alle).toContain('Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.')
    expect(alle).toContain(`Sie können Ihr Widerrufsrecht auch online unter ${PRODUKTION_HOST}/widerruf ausüben.`)
    expect(alle).toContain('Sie tragen die unmittelbaren Kosten der Rücksendung der Waren.')
    expect(BELEHRUNG.teilB.titel).toBe('Teil B – Muster-Widerrufsformular')
    expect(BELEHRUNG.teilB.zeilen).toHaveLength(7)
    expect(BELEHRUNG.teilB.zeilen[0]).toBe('– An [Name, Anschrift und E-Mail-Adresse des Hofs]:')
    expect(BELEHRUNG.teilB.fussnote).toBe('(*) Unzutreffendes streichen.')
    expect(BELEHRUNG.hinweis).toBe('Waren, die du am Hof abgeholt hast, kannst du dort auch zurückgeben; dann entstehen dir keine Rücksendekosten.')
  })

  it('kein Platzhalter-Vermerk aus Nr. 200 und kein Verweis auf AGB Punkt 12; die Ausnahmen (§ 18) stehen nicht im Muster', () => {
    const alle = texte(BELEHRUNG).join('\n')
    expect(alle).not.toContain('wird nach Prüfung hier eingefügt')
    expect(alle).not.toContain('Punkt 12')
    expect(alle).not.toContain('§ 18')
    // Gegenprobe: Der Platzhalter für die Hofangaben steht roh im Text — er ist Daten, kein Wortlaut.
    expect(alle).toContain('[Name, Anschrift, Telefonnummer und E-Mail-Adresse des Hofs]')
  })
})

describe('belehrungMitKostenschaetzung — der eine erlaubte Satz (Gestaltungshinweis 5 b, Nr. 214)', () => {
  const KOSTEN = 'Sie tragen die unmittelbaren Kosten der Rücksendung der Waren.'

  it('ohne Schätzung bleibt die Belehrung Wort für Wort, wie sie ist', () => {
    const b = belehrungMitHof(null)
    expect(belehrungMitKostenschaetzung(b, null)).toBe(b)
    expect(texte(belehrungMitKostenschaetzung(b, null)).join('\n')).not.toContain('geschätzt')
  })

  it('mit Schätzung steht der Satz direkt nach „Sie tragen …“ im selben Absatz — sonst ändert sich kein Wort', () => {
    const b = belehrungMitHof(null)
    const mit = belehrungMitKostenschaetzung(b, 31)
    const folgen = mit.teilA.abschnitte[1]!.absaetze
    expect(folgen).toContain(`${KOSTEN} Die Kosten werden auf höchstens etwa 31 EUR geschätzt.`)
    expect(folgen).not.toContain(KOSTEN)
    const roh = texte(b)
    const unterschiede = texte(mit).filter((t, i) => t !== roh[i])
    expect(unterschiede).toEqual([`${KOSTEN} Die Kosten werden auf höchstens etwa 31 EUR geschätzt.`])
  })
})

describe('belehrungMitHof — die Angaben des Hofs an den Platzhaltern', () => {
  const angaben = belehrungHof(HOF, 'hof@example.org')

  it('mit Hof: Teil A nennt Name, Inhaber, Anschrift, Telefon und E-Mail; Teil B ohne Telefon; keine eckige Klammer bleibt', () => {
    const b = belehrungMitHof(angaben)
    const absatz = b.teilA.abschnitte[0]!.absaetze[2]!
    expect(absatz).toContain('müssen Sie uns (Hof Beispiel, Max Muster, Feldweg 1, 4910 Beispieldorf, Telefon +43 664 000 0000, E-Mail hof@example.org) mittels')
    expect(b.teilB.zeilen[0]).toBe('– An Hof Beispiel, Max Muster, Feldweg 1, 4910 Beispieldorf, E-Mail hof@example.org:')
    expect(texte(b).join('\n')).not.toMatch(/\[[^\]]*des Hofs/)
  })

  it('ohne Hof: der Satz „… – stehen in deiner Bestellung“ an beiden Stellen', () => {
    const b = belehrungMitHof(null)
    expect(b.teilA.abschnitte[0]!.absaetze[2]).toContain(`(${HOF_ANGABEN_OHNE_LINK.voll})`)
    expect(HOF_ANGABEN_OHNE_LINK.voll).toBe('[Name, Anschrift, Telefonnummer und E-Mail-Adresse des Hofs – stehen in deiner Bestellung]')
    expect(b.teilB.zeilen[0]).toBe(`– An ${HOF_ANGABEN_OHNE_LINK.formular}:`)
    // Gegenprobe: Keine Hofangabe steht drin.
    expect(texte(b).join('\n')).not.toContain('Hof Beispiel')
  })

  it('fehlende Angaben fallen weg — kein erfundener Platzhalter; der Wortlaut ändert sich sonst nicht', () => {
    const ohne = belehrungMitHof(belehrungHof({ ...HOF, phone: ' ', ownerName: '' }, ''))
    expect(ohne.teilA.abschnitte[0]!.absaetze[2]).toContain('müssen Sie uns (Hof Beispiel, Feldweg 1, 4910 Beispieldorf) mittels')
    expect(texte(ohne).join('\n')).not.toContain('Telefon')
    // Nur die zwei Stellen mit Platzhaltern unterscheiden sich vom Wortlaut.
    const roh = texte(BELEHRUNG)
    const unterschiede = texte(ohne).filter((t, i) => t !== roh[i])
    expect(unterschiede).toHaveLength(2)
  })

  it('ein „$“ in den Angaben bleibt ein Zeichen (keine Ersetzungsmuster)', () => {
    const b = belehrungMitHof(belehrungHof({ ...HOF, name: "Hof $& $'" }, ''))
    expect(b.teilB.zeilen[0]).toContain("Hof $& $'")
  })

  it('ein stillgelegter Hof (nicht sichtbar): nur der Name, wie bisher auf /widerruf', () => {
    expect(belehrungHof(HOF, 'hof@example.org', false)).toEqual({ name: 'Hof Beispiel, Max Muster', anschrift: '', telefon: '', email: '' })
  })
})

describe('Seite /widerruf — Belehrung mit und ohne Link', () => {
  beforeEach(() => vi.clearAllMocks())

  const bestellung = (farm: Record<string, unknown>) => ({
    id: 'bestellung-1',
    orderNumber: 'HT-0210-A4F2',
    customerName: 'Erika Beispiel',
    kaeuferArt: 'PRIVAT',
    status: 'READY',
    pickedUpAt: null,
    farm: { ...HOF, archivedAt: null, geschlossenAm: null, email: '', owner: { email: 'inhaber@example.org' }, ...farm },
    items: [],
  })

  it('mit gültigem Link: die vier Angaben des Hofs der Bestellung — ohne Hof-E-Mail die Anmelde-Adresse (hofKontaktEmail)', async () => {
    db.order.findUnique.mockResolvedValue(bestellung({}) as never)
    const html = klartext(renderToStaticMarkup(await WiderrufPage({ searchParams: Promise.resolve({ bestellung: 'bestellung-1', sig: widerrufSignatur('bestellung-1') }) })))
    expect(html).toContain('Hof Beispiel, Max Muster, Feldweg 1, 4910 Beispieldorf, Telefon +43 664 000 0000, E-Mail inhaber@example.org')
    expect(html).toContain('Teil A – Widerrufsbelehrung')
    expect(html).toContain('Teil B – Muster-Widerrufsformular')
    expect(html).not.toContain(HOF_ANGABEN_OHNE_LINK.voll)
    expect(html).not.toContain('wird nach Prüfung hier eingefügt')
    // Die Abfrage holt die Felder für hofKontaktEmail.
    expect(db.order.findUnique.mock.calls[0]![0]).toMatchObject({ select: { farm: { select: { email: true, owner: { select: { email: true } }, phone: true, ownerName: true } } } })
  })

  it('mit eigener Hof-E-Mail steht sie statt der Anmelde-Adresse', async () => {
    db.order.findUnique.mockResolvedValue(bestellung({ email: 'hof@example.org' }) as never)
    const html = klartext(renderToStaticMarkup(await WiderrufPage({ searchParams: Promise.resolve({ bestellung: 'bestellung-1', sig: widerrufSignatur('bestellung-1') }) })))
    expect(html).toContain('E-Mail hof@example.org')
    expect(html).not.toContain('inhaber@example.org')
  })

  it('ohne Link: keine Abfrage, der Hinweis auf die Bestellung — kein Hof wird genannt', async () => {
    const html = klartext(renderToStaticMarkup(await WiderrufPage({ searchParams: Promise.resolve({}) })))
    expect(db.order.findUnique).not.toHaveBeenCalled()
    expect(html).toContain(HOF_ANGABEN_OHNE_LINK.voll)
    expect(html).toContain(HOF_ANGABEN_OHNE_LINK.formular)
    expect(html).toContain(BELEHRUNG.hinweis)
    expect(html).not.toContain('Hof Beispiel')
    expect(html).not.toContain('wird nach Prüfung hier eingefügt')
  })
})
