/**
 * Admin › Betrieb: Größe der Hofliste (src/lib/betrieb.ts; Register N19,
 * Ergänzung 24.10.2026, Nr. 163).
 *
 * Beweist rein, ohne Datenbank: Die Arten `hoflisteBytes` und `hoflisteHoefe`
 * stehen in der Liste (und im Schema); die Kachel „Hofliste“ zeigt „x MB von
 * 2 MB · n Höfe“ mit Trend; sie warnt ab 80 % von 2 MB nach der Regel
 * `speicher` (80/95/100 %, Entwarnung unter 75 %), mit dem Satz aus der
 * Freigabe in Kachel, Warnkarte und Mail. Gegenprobe: unter 80 % warnt nichts.
 */
import { describe, it, expect } from 'vitest'
import {
  BETRIEB_ARTEN,
  GRENZ_REGEL,
  GRENZ_TEXT,
  GRENZ_WERTE,
  HOFLISTE_GRENZE_BYTES,
  MESS_ARTEN,
  betriebKacheln,
  betriebMail,
  grenzSchritt,
  grenzStandText,
  grenzeVon,
  warnEintraege,
  type Messung,
} from '@/lib/betrieb'
import { betriebArtSchema } from '@/schemas/betrieb-messung'

const JETZT = new Date('2026-10-16T08:00:00Z')
const m = (tag: string, art: Messung['art'], wert: number): Messung => ({ tag, art, wert, gemessenAm: new Date(`${tag}T04:05:00Z`) })
const WARN_SATZ = 'Ab 2 MB speichert Vercel die Hofliste nicht mehr – jeder Aufruf von /hoefe und der Startseite lädt dann alle Höfe aus der Datenbank.'

function hofliste(messungen: readonly Messung[]) {
  const kachel = betriebKacheln(messungen, JETZT).find((k) => k.id === 'hofliste')
  if (!kachel) throw new Error('Kachel „Hofliste“ fehlt')
  return kachel
}

describe('Arten der Messung', () => {
  it('hoflisteBytes und hoflisteHoefe sind Messarten, das Schema kennt sie', () => {
    expect(BETRIEB_ARTEN).toEqual(expect.arrayContaining(['hoflisteBytes', 'hoflisteHoefe']))
    expect(MESS_ARTEN).toEqual(expect.arrayContaining(['hoflisteBytes', 'hoflisteHoefe']))
    expect(betriebArtSchema.safeParse('hoflisteBytes').success).toBe(true)
    expect(betriebArtSchema.safeParse('hoflisteHoefe').success).toBe(true)
    // Gegenprobe: eine fremde Art bleibt draußen.
    expect(betriebArtSchema.safeParse('hoflisteTeile').success).toBe(false)
  })
})

describe('Kachel „Hofliste“', () => {
  it('zeigt „x MB von 2 MB · n Höfe“ mit Trend, grün unter 80 %', () => {
    const k = hofliste([
      m('2026-10-06', 'hoflisteBytes', 400_000),
      m('2026-10-16', 'hoflisteBytes', 500_000),
      m('2026-10-16', 'hoflisteHoefe', 42),
    ])
    expect(HOFLISTE_GRENZE_BYTES).toBe(2_000_000)
    expect(k).toMatchObject({ titel: 'Hofliste', wert: '0,5 MB', von: 'von 2 MB', prozent: '25 %', warnt: false, hinweis: null, satz: WARN_SATZ })
    expect(k.zeile).toMatch(/^42 Höfe · \+ 0,1 MB in 10 Tagen · /)
  })

  it('ein Hof im Singular; ohne Messung leer mit Hinweis', () => {
    expect(hofliste([m('2026-10-16', 'hoflisteBytes', 30_000), m('2026-10-16', 'hoflisteHoefe', 1)]).zeile).toMatch(/^1 Hof · /)
    const leer = hofliste([])
    expect(leer.wert).toBeNull()
    expect(leer.hinweis).toBe('Noch nicht gemessen')
  })

  it('warnt ab 80 % von 2 MB (Stufen nach der Regel speicher), darunter nicht', () => {
    expect(hofliste([m('2026-10-16', 'hoflisteBytes', 1_600_000)]).warnt).toBe(true)
    expect(hofliste([m('2026-10-16', 'hoflisteBytes', 1_590_000)]).warnt).toBe(false)
  })
})

describe('Warnung „Hofliste“', () => {
  it('ist ein Grenzwert mit der Regel speicher und 2 MB als Grenze', () => {
    expect(GRENZ_WERTE).toContain('hofliste')
    expect(GRENZ_REGEL.hofliste).toBe('speicher')
    expect(grenzeVon('hofliste')).toBe(2_000_000)
    expect(GRENZ_TEXT.hofliste.voll).toBe(WARN_SATZ)
  })

  it('Stufen 80/95/100 %, Entwarnung erst unter 75 %', () => {
    const jetzt = JETZT
    expect(grenzSchritt('speicher', null, 79, jetzt)).toEqual({ tun: 'nichts' })
    expect(grenzSchritt('speicher', null, 80, jetzt)).toEqual({ tun: 'warnen', stufe: 1 })
    expect(grenzSchritt('speicher', { stufe: 1, gemeldetAm: jetzt }, 95, jetzt)).toEqual({ tun: 'warnen', stufe: 2 })
    expect(grenzSchritt('speicher', { stufe: 2, gemeldetAm: jetzt }, 100, jetzt)).toEqual({ tun: 'warnen', stufe: 3 })
    expect(grenzSchritt('speicher', { stufe: 1, gemeldetAm: jetzt }, 76, jetzt)).toEqual({ tun: 'nichts' })
    expect(grenzSchritt('speicher', { stufe: 1, gemeldetAm: jetzt }, 74, jetzt)).toEqual({ tun: 'entwarnen' })
  })

  it('Warnkarte und Mail nennen Anteil, Stand und den Satz', () => {
    const messungen = [m('2026-10-16', 'hoflisteBytes', 1_700_000), m('2026-10-16', 'hoflisteHoefe', 380)]
    const [eintrag] = warnEintraege([{ art: 'hofliste', stufe: 1, gemeldetAm: JETZT }], betriebKacheln(messungen, JETZT), [], messungen, JETZT, true)
    expect(eintrag.titel).toBe('Hofliste bei 85 %')
    expect(eintrag.saetze[0]).toBe(WARN_SATZ)

    expect(grenzStandText('hofliste', 1_700_000)).toBe('1,7 MB von 2 MB sind belegt')
    const mail = betriebMail({ art: 'grenze', wert: 'hofliste', anteil: 85, stand: grenzStandText('hofliste', 1_700_000), trend: null, ohneVerwendungBytes: null })
    expect(mail.betreff).toBe('Betrieb: Hofliste bei 85 %')
    expect(mail.absaetze[0]).toBe(`1,7 MB von 2 MB sind belegt. ${WARN_SATZ}`)
  })
})
