/**
 * „Aktuell vom Hof“ auf der Hofseite (Register F8, N5, T5; Nr. 128) — die
 * Regeln, rein und ohne Browser:
 *  - `?beitrag=` ist eine Systemgrenze: nur Kleinbuchstaben und Ziffern,
 *    höchstens 40 Zeichen, sonst verworfen (Zod).
 *  - Welcher Beitrag die Karte ist, welche als Zeilen folgen, wann „Neuester: …“
 *    steht und wann „Dieser Beitrag ist nicht mehr aktuell.“ — höchstens fünf
 *    Beiträge, der neueste trägt „Aktuell“.
 *  - „Dazu im Hofladen“: nur Produkte der Produktliste, kaufbare zuerst in der
 *    Reihenfolge des Beitrags, danach ausverkaufte, höchstens drei.
 *  - Ein alter Link `?reiter=beitraege` springt zu „Aktuell vom Hof“, nur wenn
 *    der Abschnitt da ist; reduzierte Bewegung springt ohne Animation.
 *  - Links eines Beitrags (T5): `<hof>?beitrag=<id>`, mit Kanal `&k=`; der
 *    Teilen-Besuch entfernt nur `k`, `beitrag` bleibt.
 */
import { describe, it, expect } from 'vitest'
import {
  AKTUELL_PRODUKTE_MAX,
  AKTUELL_VOM_HOF_TEXT,
  HOFSEITE_BEITRAEGE_MAX,
  adresseOhneBeitrag,
  beitragProdukte,
  ordneBeitraege,
  scrollVerhalten,
  springeZuAktuell,
} from '@/lib/hofseite-kunde'
import { ALTER_REITER_BEITRAEGE, BEITRAG_PARAMETER, beitragKennungSchema } from '@/schemas/hofseite-reiter'
import { beitragLink, linkMitKanal } from '@/lib/teilen-fenster'
import { teilenBesuchAusAdresse } from '@/lib/teilen-besuch'

describe('?beitrag= — die Adresse ist eine Systemgrenze (Zod)', () => {
  it('nimmt eine Kennung aus Kleinbuchstaben und Ziffern bis 40 Zeichen', () => {
    expect(beitragKennungSchema.parse('cbeitragaaaaaaaaaaaaaaaaa')).toBe('cbeitragaaaaaaaaaaaaaaaaa')
    expect(beitragKennungSchema.parse('a'.repeat(40))).toBe('a'.repeat(40))
    expect(beitragKennungSchema.parse('b7')).toBe('b7')
  })

  it('verwirft alles andere still — Großbuchstaben, Zeichen, zu lang, leer, Liste, fehlend', () => {
    for (const wert of ['Cbeitrag', 'beitrag-1', 'beitrag 1', '<script>', 'a'.repeat(41), '', ['abc', 'def'], undefined, null, 7]) {
      expect(beitragKennungSchema.parse(wert), String(wert)).toBeNull()
    }
  })

  it('heißt `beitrag` in der Adresse; der alte Reiter heißt weiter `beitraege`', () => {
    expect(BEITRAG_PARAMETER).toBe('beitrag')
    expect(ALTER_REITER_BEITRAEGE).toBe('beitraege')
  })
})

type B = { id: string; title: string }
const b = (id: string): B => ({ id, title: `Titel ${id}` })
/** Die Liste, wie page.tsx sie lädt: die fünf neuesten, der neueste zuerst. */
const FUENF = ['n1', 'n2', 'n3', 'n4', 'n5'].map(b)

describe('ordneBeitraege — Karte, Zeilen, „Neuester“ (Register F8)', () => {
  it('ohne Kennung: der neueste als Karte, die übrigen als Zeilen — höchstens fünf', () => {
    const { anordnung, nichtMehrAktuell } = ordneBeitraege(FUENF, null)
    expect(nichtMehrAktuell).toBe(false)
    expect(anordnung?.karte.id).toBe('n1')
    expect(anordnung?.karteIstNeuester).toBe(true)
    expect(anordnung?.neuester).toBeNull()
    expect(anordnung?.zeilen.map((z) => z.id)).toEqual(['n2', 'n3', 'n4', 'n5'])
    expect(anordnung?.anzahl).toBe(HOFSEITE_BEITRAEGE_MAX)
  })

  it('ein älterer Beitrag unter den fünf: er ist die Karte, „Neuester: …“ darunter, keiner doppelt', () => {
    const { anordnung, nichtMehrAktuell } = ordneBeitraege(FUENF, 'n3')
    expect(nichtMehrAktuell).toBe(false)
    expect(anordnung?.karte.id).toBe('n3')
    expect(anordnung?.karteIstNeuester).toBe(false)
    expect(anordnung?.neuester?.id).toBe('n1')
    expect(anordnung?.zeilen.map((z) => z.id)).toEqual(['n2', 'n4', 'n5'])
    expect(anordnung?.anzahl).toBe(5)
  })

  it('ein Beitrag älter als die fünf (page.tsx hängt ihn an): Karte oben, zusammen nie mehr als fünf', () => {
    const { anordnung } = ordneBeitraege([...FUENF, b('alt')], 'alt')
    expect(anordnung?.karte.id).toBe('alt')
    expect(anordnung?.neuester?.id).toBe('n1')
    expect(anordnung?.zeilen.map((z) => z.id)).toEqual(['n2', 'n3', 'n4'])
    expect(anordnung?.anzahl).toBe(5)
  })

  it('die Kennung des neuesten: alles wie ohne Kennung, kein „Neuester“', () => {
    expect(ordneBeitraege(FUENF, 'n1')).toEqual(ordneBeitraege(FUENF, null))
  })

  it('abgelaufen, gelöscht, fremder Hof, unbekannt — die normale Übersicht mit dem Satz, ohne Auskunft', () => {
    const { anordnung, nichtMehrAktuell } = ordneBeitraege(FUENF, 'weg')
    expect(nichtMehrAktuell).toBe(true)
    expect(anordnung).toEqual(ordneBeitraege(FUENF, null).anordnung)
  })

  it('ohne aktiven Beitrag kein Abschnitt — mit Kennung trotzdem der Satz', () => {
    expect(ordneBeitraege([], null)).toEqual({ anordnung: null, nichtMehrAktuell: false })
    expect(ordneBeitraege([], 'weg')).toEqual({ anordnung: null, nichtMehrAktuell: true })
  })

  it('ein einzelner Beitrag ist der neueste, ohne Zeilen', () => {
    const { anordnung } = ordneBeitraege([b('n1')], null)
    expect(anordnung).toMatchObject({ karteIstNeuester: true, neuester: null, zeilen: [], anzahl: 1 })
  })

  it('die Zahl über dem Abschnitt: „1 Beitrag“, „2 Beiträge“', () => {
    expect(AKTUELL_VOM_HOF_TEXT.anzahl(1)).toBe('1 Beitrag')
    expect(AKTUELL_VOM_HOF_TEXT.anzahl(2)).toBe('2 Beiträge')
  })
})

type P = { id: string; isAvailable: boolean; stock: number }
const p = (id: string, stock = 5): P => ({ id, isAvailable: true, stock })
/** Die Produktliste der Hofseite: nur, was im Shop ist (farm.products mit isAvailable). */
const LISTE = [p('eier'), p('honig', 0), p('brot'), p('heu'), p('kaese', 0)]

describe('beitragProdukte — „Dazu im Hofladen“ (Board §6, Abweichung 4)', () => {
  it('kaufbare zuerst in der Reihenfolge des Beitrags, danach ausverkaufte', () => {
    const zeilen = beitragProdukte(['honig', 'brot', 'eier'], LISTE)
    expect(zeilen.map((z) => [z.produkt.id, z.ausverkauft])).toEqual([
      ['brot', false],
      ['eier', false],
      ['honig', true],
    ])
  })

  it('höchstens drei', () => {
    expect(AKTUELL_PRODUKTE_MAX).toBe(3)
    expect(beitragProdukte(['eier', 'brot', 'heu', 'honig', 'kaese'], LISTE).map((z) => z.produkt.id)).toEqual(['eier', 'brot', 'heu'])
  })

  it('nur, was in der Produktliste der Hofseite steht: gelöscht, nicht im Shop oder fremd fällt weg', () => {
    // Die Liste hat nur Produkte dieses Hofs im Shop: „p_fremd“ (anderer Hof oder
    // gelöscht) und „lager“ (nicht im Shop) stehen nicht darin.
    expect(beitragProdukte(['p_fremd', 'lager', 'eier'], LISTE).map((z) => z.produkt.id)).toEqual(['eier'])
  })

  it('ohne Verknüpfung keine Zeile', () => {
    expect(beitragProdukte([], LISTE)).toEqual([])
  })

  it('gibt die Produkte der Liste selbst zurück — derselbe Gegenstand für den Weg in den Korb', () => {
    const [erste] = beitragProdukte(['brot'], LISTE)
    expect(erste?.produkt).toBe(LISTE[2])
  })
})

describe('Alter Link ?reiter=beitraege — Sprung zu „Aktuell vom Hof“', () => {
  it('springt nur mit altem Reiter UND Abschnitt', () => {
    expect(springeZuAktuell(ALTER_REITER_BEITRAEGE, true)).toBe(true)
    expect(springeZuAktuell(ALTER_REITER_BEITRAEGE, false)).toBe(false)
    expect(springeZuAktuell('produkte', true)).toBe(false)
    expect(springeZuAktuell(null, true)).toBe(false)
  })

  it('mit reduzierter Bewegung ohne Animation', () => {
    expect(scrollVerhalten(true)).toBe('auto')
    expect(scrollVerhalten(false)).toBe('smooth')
  })
})

describe('„Neuester: …“ — dieselbe Seite ohne ?beitrag=', () => {
  it('nimmt nur `beitrag` aus der Adresse, alles andere bleibt', () => {
    expect(adresseOhneBeitrag('/hof-test', 'beitrag=abc&bereich=futter')).toBe('/hof-test?bereich=futter')
    expect(adresseOhneBeitrag('/hof-test', '?beitrag=abc')).toBe('/hof-test')
    expect(adresseOhneBeitrag('/hof-test', 'vorschau=1&beitrag=abc')).toBe('/hof-test?vorschau=1')
  })
})

describe('Links eines Beitrags (Register T5, Ergänzung Nr. 128)', () => {
  it('beitragLink führt zur Übersicht mit genau diesem Beitrag, nicht mehr in einen Reiter', () => {
    expect(beitragLink('https://example.com/hof-test', 'cbeitragaaaa')).toBe('https://example.com/hof-test?beitrag=cbeitragaaaa')
    expect(beitragLink('example.com/hof-test', 'cbeitragaaaa')).toBe('example.com/hof-test?beitrag=cbeitragaaaa')
  })

  it('mit Kanal hängt `&k=` an — der Teilen-Besuch entfernt nur `k`, `beitrag` bleibt', () => {
    const geteilt = linkMitKanal(beitragLink('https://example.com/hof-test', 'cbeitragaaaa'), 'wa')
    expect(geteilt).toBe('https://example.com/hof-test?beitrag=cbeitragaaaa&k=wa')
    expect(teilenBesuchAusAdresse(geteilt)).toEqual({ kanal: 'wa', ohne: '/hof-test?beitrag=cbeitragaaaa' })
    // Gegenprobe: die Kennung kommt durch die Prüfung der Hofseite.
    expect(beitragKennungSchema.parse(new URL(geteilt).searchParams.get(BEITRAG_PARAMETER))).toBe('cbeitragaaaa')
  })
})
