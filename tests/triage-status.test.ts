/**
 * Tests für die reinen Regeln der Schreibroute (src/lib/triage-status.ts) und
 * ihr Body-Schema (triageStatusSchema) — Sprint Briefkasten-Rückkopplung, Teil B.
 *
 * Beweist: Token → Rolle fail-closed und nur bei getrennten Tokens; jeder
 * Übergang aus dem Auftrag erlaubt bzw. verboten; GEPLANT/VERMUTLICH_WUNSCH
 * nur für Fehler, ERLEDIGT auch für einen geplanten Wunsch; die festen Sätze
 * je Art und Quelle; Wiederöffnen nimmt nur den festen Satz zurück; die Art
 * wird nie geschrieben; die Notiz bleibt unter der Grenze des Admin-Formulars.
 */
import { describe, expect, it } from 'vitest'
import {
  ERLAUBT_AUS,
  automatischeAntwort,
  auditZeile,
  begrenzeNotiz,
  entscheideUebergang,
  istAutomatischeAntwort,
  rolleAusToken,
  type GeleseneMeldung,
} from '@/lib/triage-status'
import { MELDUNG_STATUS, TRIAGE_NOTIZ_MAX, ZIEL_STATUS, type MeldungStatus, type ZielStatus } from '@/lib/meldung'
import { triageStatusSchema } from '@/schemas/meldung'

const JETZT = new Date('2026-09-24T10:00:00Z')

const FEHLER: GeleseneMeldung = { status: 'NEU', art: 'FEHLER', triageNotiz: null, antwortAnMelder: null, sprintName: null }

function aenderung(ziel: ZielStatus, extra: Partial<{ prNummer: number | null; grund: string | null; quelle: 'deployment' | 'merge' }> = {}) {
  return { ziel, prNummer: 7, grund: 'Wünscht eine Sortierung nach Preis.', quelle: 'deployment' as const, ...extra }
}

describe('rolleAusToken', () => {
  const tokens = { lesen: 'lese-token', write: 'write-token', merge: 'merge-token' }

  it('erkennt Write und Merge am Bearer', () => {
    expect(rolleAusToken('Bearer write-token', tokens)).toBe('WRITE')
    expect(rolleAusToken('Bearer merge-token', tokens)).toBe('MERGE')
  })

  it('der Lese-Token schreibt nie; Unbekanntes und Varianten sind unbekannt', () => {
    for (const auth of ['Bearer lese-token', 'Bearer write-tokenx', 'write-token', 'Bearer ', '', 'Bearer undefined']) {
      expect(rolleAusToken(auth, tokens), auth).toBe('unbekannt')
    }
  })

  it('fail-closed: ein fehlender Token passt nie — auch nicht auf „Bearer undefined"', () => {
    expect(rolleAusToken('Bearer undefined', { lesen: 'x' })).toBe('unbekannt')
    expect(rolleAusToken('Bearer ', { write: '', merge: '' })).toBe('unbekannt')
  })

  it('sind zwei Tokens gleich, gilt keiner', () => {
    expect(rolleAusToken('Bearer gleich', { write: 'gleich', merge: 'gleich' })).toBe('nicht-getrennt')
    expect(rolleAusToken('Bearer gleich', { lesen: 'gleich', write: 'gleich', merge: 'm' })).toBe('nicht-getrennt')
    expect(rolleAusToken('Bearer gleich', { lesen: 'gleich', merge: 'gleich' })).toBe('nicht-getrennt')
  })
})

describe('entscheideUebergang — erlaubte und verbotene Übergänge', () => {
  const erwartet: Record<ZielStatus, readonly MeldungStatus[]> = {
    VERMUTLICH_WUNSCH: ['NEU', 'GEPRUEFT'],
    GEPLANT: ['NEU', 'GEPRUEFT', 'VERMUTLICH_WUNSCH', 'GEPLANT'],
    ERLEDIGT: ['GEPLANT', 'ERLEDIGT'],
    GEPRUEFT: ['ERLEDIGT'],
  }

  it('die Tabelle ist genau die aus dem Auftrag', () => {
    expect(ERLAUBT_AUS).toEqual(erwartet)
  })

  for (const ziel of ZIEL_STATUS) {
    for (const von of MELDUNG_STATUS) {
      const erlaubt = erwartet[ziel].includes(von)
      it(`${von} → ${ziel}: ${erlaubt ? 'erlaubt' : '409'}`, () => {
        const e = entscheideUebergang({ ...FEHLER, status: von }, aenderung(ziel), JETZT)
        if (erlaubt) expect(e.art).not.toBe('abgelehnt')
        else expect(e).toMatchObject({ art: 'abgelehnt', code: 'UEBERGANG' })
      })
    }
  }

  it('die Ablehnung nennt Stand und erlaubte Ausgänge ohne Fachsprache', () => {
    const e = entscheideUebergang({ ...FEHLER, status: 'KEIN_FEHLER' }, aenderung('GEPLANT'), JETZT)
    expect(e).toMatchObject({ grund: 'Die Meldung steht auf „Kein Fehler". „Geplant" geht nur aus: Neu, Geprüft, Vermutlich Wunsch, Geplant.' })
  })
})

describe('entscheideUebergang — nur Fehler, außer ERLEDIGT', () => {
  for (const art of ['WUNSCH', 'FRAGE'] as const) {
    it(`GEPLANT und VERMUTLICH_WUNSCH bei ${art} → 409 FALSCHE_ART`, () => {
      for (const ziel of ['GEPLANT', 'VERMUTLICH_WUNSCH'] as const) {
        expect(entscheideUebergang({ ...FEHLER, art }, aenderung(ziel), JETZT)).toMatchObject({ art: 'abgelehnt', code: 'FALSCHE_ART' })
      }
    })
  }

  it('ein Wunsch, den der Mensch auf GEPLANT gesetzt hat, schließt das Deployment mit „Umgesetzt"', () => {
    const e = entscheideUebergang({ ...FEHLER, art: 'WUNSCH', status: 'GEPLANT' }, aenderung('ERLEDIGT'), JETZT)
    expect(e).toMatchObject({ art: 'schreiben', daten: { status: 'ERLEDIGT', antwortAnMelder: 'Umgesetzt — seit 24.09.2026 online.' } })
  })
})

describe('entscheideUebergang — Wirkung', () => {
  it('VERMUTLICH_WUNSCH: „[KI] <grund>" plus Audit-Zeile; die Notiz des Menschen bleibt; kein triagedAt', () => {
    const e = entscheideUebergang({ ...FEHLER, triageNotiz: 'Telefonat: nur am Handy.' }, aenderung('VERMUTLICH_WUNSCH', { prNummer: null }), JETZT)
    expect(e).toEqual({
      art: 'schreiben',
      daten: {
        status: 'VERMUTLICH_WUNSCH',
        triageNotiz: 'Telefonat: nur am Handy.\n[KI] Wünscht eine Sortierung nach Preis.\n[Auto · KI · 24.09.2026 · Vermutlich Wunsch]',
      },
    })
  })

  it('ein zweiter KI-Vorschlag ersetzt den ersten statt ihn zu stapeln', () => {
    const e = entscheideUebergang(
      { ...FEHLER, status: 'GEPRUEFT', triageNotiz: '[KI] alter Grund\n[Auto · KI · 20.09.2026 · Vermutlich Wunsch]' },
      aenderung('VERMUTLICH_WUNSCH', { prNummer: null, grund: 'neuer Grund' }),
      JETZT
    )
    expect(e.art === 'schreiben' && e.daten.triageNotiz.match(/^\[KI\] /gm)).toHaveLength(1)
    expect(e.art === 'schreiben' && e.daten.triageNotiz).toContain('[KI] neuer Grund')
  })

  it('GEPLANT: sprintName „PR #<nr>", triagedAt, Audit-Zeile', () => {
    const e = entscheideUebergang(FEHLER, aenderung('GEPLANT', { prNummer: 123 }), JETZT)
    expect(e).toEqual({
      art: 'schreiben',
      daten: { status: 'GEPLANT', sprintName: 'PR #123', triagedAt: JETZT, triageNotiz: '[Auto · PR #123 · 24.09.2026 · Geplant]' },
    })
  })

  it('GEPLANT → GEPLANT: der neue PR überschreibt sprintName, die Notiz hält beide fest', () => {
    const e = entscheideUebergang(
      { ...FEHLER, status: 'GEPLANT', triageNotiz: '[Auto · PR #120 · 20.09.2026 · Geplant]' },
      aenderung('GEPLANT', { prNummer: 125 }),
      JETZT
    )
    expect(e).toMatchObject({
      daten: { sprintName: 'PR #125', triageNotiz: '[Auto · PR #120 · 20.09.2026 · Geplant]\n[Auto · PR #125 · 24.09.2026 · Geplant]' },
    })
  })

  it('ERLEDIGT: fester Satz nur, wenn noch keine Antwort da ist; triagedAt für die 90 Tage', () => {
    const leer = entscheideUebergang({ ...FEHLER, status: 'GEPLANT' }, aenderung('ERLEDIGT'), JETZT)
    expect(leer).toMatchObject({ daten: { status: 'ERLEDIGT', triagedAt: JETZT, antwortAnMelder: 'Behoben — seit 24.09.2026 online.' } })
    const mitAntwort = entscheideUebergang({ ...FEHLER, status: 'GEPLANT', antwortAnMelder: 'Danke, war ein Tippfehler.' }, aenderung('ERLEDIGT'), JETZT)
    expect(mitAntwort.art).toBe('schreiben')
    expect(mitAntwort.art === 'schreiben' && mitAntwort.daten).not.toHaveProperty('antwortAnMelder')
  })

  it('ERLEDIGT über den Ersatzweg (Merge): „kommt mit dem nächsten Update online."', () => {
    const e = entscheideUebergang({ ...FEHLER, status: 'GEPLANT' }, aenderung('ERLEDIGT', { quelle: 'merge' }), JETZT)
    expect(e).toMatchObject({ daten: { antwortAnMelder: 'Behoben — kommt mit dem nächsten Update online.' } })
  })

  it('ERLEDIGT bei einer Frage: kein fester Satz — die Antwort schreibt der Mensch', () => {
    const e = entscheideUebergang({ ...FEHLER, art: 'FRAGE', status: 'GEPLANT' }, aenderung('ERLEDIGT'), JETZT)
    expect(e.art).toBe('schreiben')
    expect(e.art === 'schreiben' && e.daten).not.toHaveProperty('antwortAnMelder')
  })

  it('ERLEDIGT → ERLEDIGT schreibt nichts (zweites Deployment desselben Commits)', () => {
    expect(entscheideUebergang({ ...FEHLER, status: 'ERLEDIGT' }, aenderung('ERLEDIGT'), JETZT)).toEqual({ art: 'unveraendert' })
  })

  it('Wiederöffnen entfernt den festen Satz — alle drei Formen', () => {
    for (const satz of ['Behoben — seit 20.09.2026 online.', 'Umgesetzt — seit 01.10.2026 online.', 'Behoben — kommt mit dem nächsten Update online.']) {
      const e = entscheideUebergang({ ...FEHLER, status: 'ERLEDIGT', antwortAnMelder: satz }, aenderung('GEPRUEFT'), JETZT)
      expect(e, satz).toMatchObject({ art: 'schreiben', daten: { status: 'GEPRUEFT', antwortAnMelder: null } })
    }
  })

  it('Wiederöffnen lässt eine im Admin geschriebene Antwort stehen', () => {
    const e = entscheideUebergang(
      { ...FEHLER, status: 'ERLEDIGT', antwortAnMelder: 'Behoben — seit 20.09.2026 online. Danke fürs Melden!' },
      aenderung('GEPRUEFT'),
      JETZT
    )
    expect(e.art).toBe('schreiben')
    expect(e.art === 'schreiben' && e.daten).not.toHaveProperty('antwortAnMelder')
    expect(e).toMatchObject({ daten: { triageNotiz: '[Auto · PR #7 · 24.09.2026 · Wieder geöffnet]' } })
  })

  it('schreibt nie die Art', () => {
    for (const ziel of ZIEL_STATUS) {
      const von = ERLAUBT_AUS[ziel][0]
      const e = entscheideUebergang({ ...FEHLER, status: von }, aenderung(ziel), JETZT)
      expect(e.art, ziel).toBe('schreiben')
      expect(e.art === 'schreiben' && e.daten, ziel).not.toHaveProperty('art')
    }
  })

  it('ERLEDIGT nur durch den PR, für den die Meldung eingeplant ist — sonst 409 ANDERER_PR', () => {
    const geplant = { ...FEHLER, status: 'GEPLANT' as const, sprintName: 'PR #131' }
    expect(entscheideUebergang(geplant, aenderung('ERLEDIGT', { prNummer: 131 }), JETZT).art).toBe('schreiben')
    expect(entscheideUebergang(geplant, aenderung('ERLEDIGT', { prNummer: 140 }), JETZT)).toMatchObject({
      art: 'abgelehnt',
      code: 'ANDERER_PR',
      grund: 'Die Meldung ist für PR #131 eingeplant, nicht für PR #140.',
    })
  })

  it('hat der Mensch ohne PR-Nummer geplant (etwa einen Wunsch), schließt jeder PR, der sie nennt', () => {
    const imAdminGeplant = { ...FEHLER, art: 'WUNSCH' as const, status: 'GEPLANT' as const, sprintName: 'sortierung-v1' }
    expect(entscheideUebergang(imAdminGeplant, aenderung('ERLEDIGT', { prNummer: 140 }), JETZT).art).toBe('schreiben')
    expect(entscheideUebergang({ ...imAdminGeplant, sprintName: null }, aenderung('ERLEDIGT'), JETZT).art).toBe('schreiben')
  })

  it('ohne PR-Nummer lehnt schon die Regel ab — nicht erst das Schema', () => {
    for (const ziel of ['GEPLANT', 'ERLEDIGT', 'GEPRUEFT'] as const) {
      const von = ERLAUBT_AUS[ziel][0]
      expect(entscheideUebergang({ ...FEHLER, status: von }, aenderung(ziel, { prNummer: null }), JETZT), ziel).toMatchObject({
        art: 'abgelehnt',
        code: 'PR_FEHLT',
      })
    }
  })
})

describe('feste Sätze', () => {
  it('je Art und Quelle', () => {
    expect(automatischeAntwort('FEHLER', 'deployment', JETZT)).toBe('Behoben — seit 24.09.2026 online.')
    expect(automatischeAntwort('WUNSCH', 'deployment', JETZT)).toBe('Umgesetzt — seit 24.09.2026 online.')
    expect(automatischeAntwort('WUNSCH', 'merge', JETZT)).toBe('Umgesetzt — kommt mit dem nächsten Update online.')
    expect(automatischeAntwort('FRAGE', 'deployment', JETZT)).toBeNull()
  })

  it('das Datum gilt in Wien — kurz vor Mitternacht UTC ist dort schon der nächste Tag', () => {
    expect(automatischeAntwort('FEHLER', 'deployment', new Date('2026-09-24T22:30:00Z'))).toBe('Behoben — seit 25.09.2026 online.')
  })

  it('erkennt nur den exakten Satz', () => {
    expect(istAutomatischeAntwort('Behoben — seit 24.09.2026 online.')).toBe(true)
    expect(istAutomatischeAntwort('Behoben — seit 24.09.2026 online. ')).toBe(false)
    expect(istAutomatischeAntwort('Behoben.')).toBe(false)
    expect(istAutomatischeAntwort('Beantwortet — seit 24.09.2026 online.')).toBe(false)
    expect(istAutomatischeAntwort(null)).toBe(false)
  })

  it('Audit-Zeile mit PR oder KI', () => {
    expect(auditZeile('ERLEDIGT', 42, JETZT)).toBe('[Auto · PR #42 · 24.09.2026 · Erledigt]')
    expect(auditZeile('VERMUTLICH_WUNSCH', null, JETZT)).toBe('[Auto · KI · 24.09.2026 · Vermutlich Wunsch]')
  })
})

describe('begrenzeNotiz', () => {
  it('bleibt unter der Grenze des Admin-Formulars — zuerst fallen die ältesten Audit-Zeilen', () => {
    const mensch = 'm'.repeat(TRIAGE_NOTIZ_MAX - 100)
    const audits = Array.from({ length: 10 }, (_, i) => `[Auto · PR #${i} · 24.09.2026 · Geplant]`)
    const notiz = begrenzeNotiz([mensch, ...audits])
    expect(notiz.length).toBeLessThanOrEqual(TRIAGE_NOTIZ_MAX)
    expect(notiz.startsWith(mensch)).toBe(true)
    expect(notiz).toContain('[Auto · PR #9 ·')
    expect(notiz).not.toContain('[Auto · PR #0 ·')
  })

  it('reicht das nicht, behält sie das Ende', () => {
    const notiz = begrenzeNotiz(['x'.repeat(TRIAGE_NOTIZ_MAX), '[Auto · PR #1 · 24.09.2026 · Geplant]'])
    expect(notiz.length).toBe(TRIAGE_NOTIZ_MAX)
    expect(notiz.endsWith('[Auto · PR #1 · 24.09.2026 · Geplant]')).toBe(true)
  })
})

describe('triageStatusSchema', () => {
  it('nimmt Kurznummer oder volle ID', () => {
    expect(triageStatusSchema.safeParse({ meldungId: 'cmabcdef', status: 'GEPLANT', prNummer: 1 }).success).toBe(true)
    expect(triageStatusSchema.safeParse({ meldungId: 'cmabcdef1234567890abcdefg', status: 'GEPLANT', prNummer: 1 }).success).toBe(true)
    expect(triageStatusSchema.safeParse({ meldungId: 'cm; drop', status: 'GEPLANT', prNummer: 1 }).success).toBe(false)
  })

  it('grund fehlt bei VERMUTLICH_WUNSCH → Fehler mit Satz', () => {
    const r = triageStatusSchema.safeParse({ meldungId: 'cmabcdef', status: 'VERMUTLICH_WUNSCH' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toMatch(/^grund fehlt/)
  })

  it('prNummer fehlt bei GEPLANT, ERLEDIGT und Wiederöffnen', () => {
    for (const status of ['GEPLANT', 'ERLEDIGT', 'GEPRUEFT']) {
      const r = triageStatusSchema.safeParse({ meldungId: 'cmabcdef', status })
      expect(r.error?.issues[0]?.message, status).toMatch(/^prNummer fehlt/)
    }
  })

  it('ein unbekanntes Feld bekommt einen deutschen Satz, der die erlaubten Felder nennt', () => {
    const r = triageStatusSchema.safeParse({ meldungId: 'cmabcdef', status: 'GEPLANT', prNummer: 1, antwortAnMelder: 'x' })
    expect(r.error?.issues[0]?.message).toBe(
      'Unbekanntes Feld: antwortAnMelder — die Schreibroute nimmt nur meldungId, status, prNummer, grund, quelle.'
    )
  })

  it('lehnt antwortAnMelder und jedes andere unbekannte Feld ab', () => {
    for (const extra of [{ antwortAnMelder: 'Alles gut!' }, { art: 'WUNSCH' }, { triageNotiz: 'x' }]) {
      expect(triageStatusSchema.safeParse({ meldungId: 'cmabcdef', status: 'GEPLANT', prNummer: 1, ...extra }).success, JSON.stringify(extra)).toBe(false)
    }
  })

  it('grund: Steuer- und Richtungszeichen fallen weg, höchstens 300 Zeichen', () => {
    const r = triageStatusSchema.parse({ meldungId: 'cmabcdef', status: 'VERMUTLICH_WUNSCH', grund: 'Wunsch\u0007 nach\u202E\nSortierung' })
    expect(r.grund).toBe('Wunsch nach Sortierung')
    expect(triageStatusSchema.safeParse({ meldungId: 'cmabcdef', status: 'VERMUTLICH_WUNSCH', grund: 'x'.repeat(301) }).success).toBe(false)
    expect(triageStatusSchema.safeParse({ meldungId: 'cmabcdef', status: 'VERMUTLICH_WUNSCH', grund: '\u0007\u202E ' }).success).toBe(false)
  })

  it('Status außerhalb der vier Ziele → Fehler', () => {
    for (const status of ['NEU', 'KEIN_FEHLER', 'DUPLIKAT']) {
      expect(triageStatusSchema.safeParse({ meldungId: 'cmabcdef', status, prNummer: 1 }).success, status).toBe(false)
    }
  })

  it('quelle ist deployment, wenn nichts angegeben ist', () => {
    expect(triageStatusSchema.parse({ meldungId: 'cmabcdef', status: 'ERLEDIGT', prNummer: 3 }).quelle).toBe('deployment')
  })
})
