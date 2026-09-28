/**
 * Tests für den Kopf von „Mein Hof" (src/lib/mein-hof.ts).
 *
 * Beweist:
 *  - Der Zustand folgt der Reihenfolge aus farm-approval.ts: stillgelegt →
 *    nicht öffentlich → nicht freigeschaltet → pausiert → im Shop sichtbar.
 *  - Foto oder Verlauf entscheidet titelbildFoto, für Hofseite und Streifen.
 *  - Kundenansicht und Teilen gibt es nur, wenn die Hofseite öffentlich ist —
 *    ein pausierter Hof bleibt öffentlich.
 *  - Der Titelbild-Verlauf fällt bei Unbekanntem auf Tannengrün.
 */
import { describe, it, expect } from 'vitest'
import { TITELBILD_VERLAEUFE, hofZustand, titelbildFoto, titelbildVerlauf } from '@/lib/mein-hof'

const FREIGEGEBEN = new Date('2026-09-01T10:00:00Z')
const OFFEN = { isActive: true, isPaused: false, approvedAt: FREIGEGEBEN, archivedAt: null }

describe('hofZustand', () => {
  it('freigegeben und nicht pausiert: im Shop sichtbar', () => {
    expect(hofZustand(OFFEN)).toEqual({ art: 'sichtbar', text: 'Im Shop sichtbar', oeffentlich: true })
  })

  it('pausiert: bleibt öffentlich, heißt „Pausiert"', () => {
    expect(hofZustand({ ...OFFEN, isPaused: true })).toEqual({ art: 'pausiert', text: 'Pausiert', oeffentlich: true })
  })

  it('noch nicht freigeschaltet: nicht öffentlich — auch wenn zusätzlich pausiert', () => {
    expect(hofZustand({ ...OFFEN, approvedAt: null, isPaused: true })).toEqual({
      art: 'wartet',
      text: 'Wartet auf Freischaltung',
      oeffentlich: false,
    })
  })

  it('stillgelegt sticht alles', () => {
    expect(hofZustand({ ...OFFEN, approvedAt: null, isPaused: true, archivedAt: new Date() })).toEqual({
      art: 'aus',
      text: 'Stillgelegt',
      oeffentlich: false,
    })
  })

  it('abgeschaltet (isActive false): nicht öffentlich', () => {
    expect(hofZustand({ ...OFFEN, isActive: false })).toEqual({
      art: 'aus',
      text: 'Nicht öffentlich',
      oeffentlich: false,
    })
  })

  it('stillgelegt und abgeschaltet: „Stillgelegt" sagt dem Hof mehr', () => {
    expect(hofZustand({ ...OFFEN, isActive: false, archivedAt: new Date() }).text).toBe('Stillgelegt')
  })
})

describe('titelbildFoto', () => {
  it('nur PHOTO mit URL ist ein Foto', () => {
    expect(titelbildFoto({ bannerType: 'PHOTO', bannerUrl: 'https://bilder.example/titel.jpg' })).toBe(
      'https://bilder.example/titel.jpg'
    )
    expect(titelbildFoto({ bannerType: 'PHOTO', bannerUrl: null })).toBeNull()
    // Ein Verlauf bleibt ein Verlauf, auch wenn noch eine alte URL daneben steht.
    expect(titelbildFoto({ bannerType: 'GRADIENT', bannerUrl: 'https://bilder.example/alt.jpg' })).toBeNull()
  })
})

describe('titelbildVerlauf', () => {
  it('kennt die gespeicherten Werte und fällt sonst auf Tannengrün', () => {
    expect(titelbildVerlauf('erde')).toBe(TITELBILD_VERLAEUFE.erde)
    expect(titelbildVerlauf(null)).toBe(TITELBILD_VERLAEUFE.tannengruen)
    expect(titelbildVerlauf('https://bilder.example/titel.jpg')).toBe(TITELBILD_VERLAEUFE.tannengruen)
  })
})
