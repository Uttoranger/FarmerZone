/**
 * Teilen oder kopieren (src/lib/teilen.ts). Der Anlass: Schloss der Kunde
 * das Teilen-Menü, wurde der Link trotzdem kopiert und „Link kopiert"
 * gemeldet.
 */
import { describe, expect, it, vi } from 'vitest'
import { teileOderKopiere, type TeilenUmgebung } from '@/lib/teilen'

const DATEN = { title: 'Testhof', text: 'Testhof auf FarmerZone', url: 'https://beispiel.test/testhof' }

function umgebung(teilen?: () => Promise<void>, kopierenWirft = false) {
  const kopieren = vi.fn(async () => {
    if (kopierenWirft) throw new DOMException('verweigert', 'NotAllowedError')
  })
  const u: TeilenUmgebung = { teilen: teilen && vi.fn(teilen), kopieren }
  return { u, kopieren }
}

describe('teileOderKopiere', () => {
  it('teilt über das Teilen-Menü, wo es eins gibt — und kopiert dann nicht', async () => {
    const { u, kopieren } = umgebung(async () => {})
    expect(await teileOderKopiere(DATEN, u)).toBe('geteilt')
    expect(u.teilen).toHaveBeenCalledWith(DATEN)
    expect(kopieren).not.toHaveBeenCalled()
  })

  it('schließt der Kunde das Menü, passiert nichts — kein Kopieren, keine Meldung', async () => {
    const { u, kopieren } = umgebung(async () => {
      throw new DOMException('Share canceled', 'AbortError')
    })
    expect(await teileOderKopiere(DATEN, u)).toBe('abgebrochen')
    expect(kopieren).not.toHaveBeenCalled()
  })

  it('verweigert der Browser das Teilen, kommt der Link in die Zwischenablage', async () => {
    const { u, kopieren } = umgebung(async () => {
      throw new DOMException('Must be handling a user gesture', 'NotAllowedError')
    })
    expect(await teileOderKopiere(DATEN, u)).toBe('kopiert')
    expect(kopieren).toHaveBeenCalledWith(DATEN.url)
  })

  it('ohne Teilen-Menü wird kopiert', async () => {
    const { u, kopieren } = umgebung()
    expect(await teileOderKopiere(DATEN, u)).toBe('kopiert')
    expect(kopieren).toHaveBeenCalledWith(DATEN.url)
  })

  it('geht auch das Kopieren nicht, sagt der Ausgang es', async () => {
    const { u } = umgebung(undefined, true)
    expect(await teileOderKopiere(DATEN, u)).toBe('fehlgeschlagen')
  })
})
