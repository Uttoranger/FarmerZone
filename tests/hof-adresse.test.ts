/**
 * Die Frei-Prüfung unter dem Hofnamen (HofAdresseVorschau, Registrieren und
 * Einrichten, Nr. 15 Nachbesserung 1): Ein Netzfehler darf nie als
 * unbehandelter Promise-Fehler im Browser enden — die Vorschau bleibt dann
 * neutral („Wird zu deiner Adresse: …"), statt „vergeben" oder „frei" zu
 * behaupten.
 */
import { describe, expect, it, vi } from 'vitest'
import { frageAdresseAb } from '@/lib/hof-adresse'

describe('frageAdresseAb', () => {
  it('gibt Adresse und Frei-Stand der Prüfung weiter', async () => {
    const pruefe = vi.fn().mockResolvedValue({ slug: 'hof-test', available: false })
    await expect(frageAdresseAb('Hof Test', pruefe)).resolves.toEqual({ slug: 'hof-test', frei: false })
    expect(pruefe).toHaveBeenCalledWith('Hof Test')
  })

  it('bei einem Netzfehler: kein Stand (neutral), kein Fehler nach außen', async () => {
    const pruefe = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(frageAdresseAb('Hof Test', pruefe)).resolves.toBeNull()
  })

  it('auch ein synchron geworfener Fehler bleibt drinnen', async () => {
    const pruefe = vi.fn(() => {
      throw new Error('kaputt')
    })
    await expect(frageAdresseAb('Hof Test', pruefe)).resolves.toBeNull()
  })
})
