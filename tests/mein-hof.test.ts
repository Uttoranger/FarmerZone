/**
 * Tests für den Kopf von „Mein Hof" (src/lib/mein-hof.ts).
 *
 * Beweist:
 *  - Der Zustand folgt der Reihenfolge aus farm-approval.ts: stillgelegt →
 *    nicht öffentlich → nicht freigeschaltet → pausiert → öffentlich.
 *  - Das Schild: grün „Öffentlich", bernstein „Pausiert", grau „Noch nicht
 *    freigegeben"; ein stillgelegter Hof trägt keins.
 *  - Foto oder Verlauf entscheidet titelbildFoto, für Hofseite und Streifen.
 *  - Link, Kopieren, Kundenansicht und Teilen gibt es nur, wenn die Hofseite
 *    öffentlich ist — ein pausierter Hof bleibt öffentlich.
 *  - Die Adresse zeigt Host und Slug ohne Protokoll; kopiert wird die ganze.
 *  - Der Titelbild-Verlauf fällt bei Unbekanntem auf Tannengrün.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TITELBILD_VERLAEUFE, hofAdresse, hofZustand, titelbildFoto, titelbildVerlauf } from '@/lib/mein-hof'

const FREIGEGEBEN = new Date('2026-09-01T10:00:00Z')
const OFFEN = { isActive: true, isPaused: false, approvedAt: FREIGEGEBEN, archivedAt: null }

describe('hofZustand', () => {
  it('freigegeben und nicht pausiert: öffentlich, grünes Schild', () => {
    expect(hofZustand(OFFEN)).toEqual({
      art: 'sichtbar',
      schild: { text: 'Öffentlich', farbe: 'gruen' },
      oeffentlich: true,
    })
  })

  it('pausiert: bleibt öffentlich, bernsteinfarben „Pausiert"', () => {
    expect(hofZustand({ ...OFFEN, isPaused: true })).toEqual({
      art: 'pausiert',
      schild: { text: 'Pausiert', farbe: 'bernstein' },
      oeffentlich: true,
    })
  })

  it('noch nicht freigeschaltet: nicht öffentlich, grau „Noch nicht freigegeben" — auch wenn zusätzlich pausiert', () => {
    expect(hofZustand({ ...OFFEN, approvedAt: null, isPaused: true })).toEqual({
      art: 'wartet',
      schild: { text: 'Noch nicht freigegeben', farbe: 'grau' },
      oeffentlich: false,
    })
  })

  it('stillgelegt sticht alles — und trägt kein Schild', () => {
    expect(hofZustand({ ...OFFEN, approvedAt: null, isPaused: true, archivedAt: new Date() })).toEqual({
      art: 'stillgelegt',
      schild: null,
      oeffentlich: false,
    })
  })

  it('abgeschaltet (isActive false): nicht öffentlich, dasselbe graue Schild', () => {
    expect(hofZustand({ ...OFFEN, isActive: false })).toEqual({
      art: 'aus',
      schild: { text: 'Noch nicht freigegeben', farbe: 'grau' },
      oeffentlich: false,
    })
  })

  it('stillgelegt und abgeschaltet: stillgelegt', () => {
    expect(hofZustand({ ...OFFEN, isActive: false, archivedAt: new Date() }).art).toBe('stillgelegt')
  })

  it('kein Schild sagt „Shop": Der Hof hat eine Hofseite, keinen Shop', () => {
    for (const hof of [OFFEN, { ...OFFEN, isPaused: true }, { ...OFFEN, approvedAt: null }]) {
      expect(hofZustand(hof).schild?.text ?? '').not.toMatch(/shop/i)
    }
  })
})

describe('hofAdresse', () => {
  it('zeigt Host und Slug ohne Protokoll, kopiert wird die ganze Adresse', () => {
    expect(hofAdresse('https://farmerzone.at', 'muellerhof')).toEqual({
      anzeige: 'farmerzone.at/muellerhof',
      url: 'https://farmerzone.at/muellerhof',
    })
  })

  it('verträgt einen Schrägstrich am Ende und localhost mit Port', () => {
    expect(hofAdresse('http://localhost:3000/', 'muellerhof')).toEqual({
      anzeige: 'localhost:3000/muellerhof',
      url: 'http://localhost:3000/muellerhof',
    })
  })

  it('ein unbrauchbarer Ursprung bleibt roh stehen statt zu werfen', () => {
    expect(hofAdresse('', 'muellerhof').anzeige).toBe('/muellerhof')
  })
})

describe('im Kopf (components/mein-hof/seitenkopf.tsx, seit Nr. 22e der einzige)', () => {
  const kopf = readFileSync(join(process.cwd(), 'src/components/mein-hof/seitenkopf.tsx'), 'utf8')

  it('Link und Kopieren nur, wenn öffentlich; sonst die Adresse als reiner Text', () => {
    expect(kopf).toMatch(/if \(!hof\.zustand\.oeffentlich\) \{\s*return <span[^>]*>\{hof\.adresse\.anzeige\}<\/span>/)
    expect(kopf).toMatch(/<a\s+href=\{hof\.adresse\.url\}/)
    expect(kopf).toContain('<AdresseKopierenKnopf url={hof.adresse.url}')
  })

  it('das Schild kommt aus dem Zustand und fehlt, wenn er keins hat', () => {
    expect(kopf).toContain('if (!hof.zustand.schild) return null')
    expect(kopf).toContain('{hof.zustand.schild.text}')
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
