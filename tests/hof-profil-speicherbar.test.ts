/**
 * Das Hofprofil bleibt speicherbar (Nr. 174, CODING_STANDARDS „Bestand bleibt
 * speicherbar"): Beschreibung und Hof-E-Mail sind freiwillig – beim Anlegen
 * sind sie es schon, ein Hof mit leeren Feldern konnte sein Profil bisher
 * nicht speichern. Die Meldungen sagen, was fehlt und wozu (Muster
 * hofAnlegenFormularSchema), keine „Pflichtfeld"-Sätze.
 *
 * Leser der Hof-E-Mail (geprüft, siehe Bericht 174): Bestellseite und
 * Bestätigung (HofErreichen) und die Angaben zum Hof (AngabenZumHof) blenden
 * eine leere Adresse aus; hofseite-fortschritt zählt Kontakt nur mit beiden.
 */
import { describe, expect, it } from 'vitest'
import { hofAnlegenFormularSchema, profilBearbeitenSchema, profileSchema } from '@/schemas/hofprofil'
import { PROFIL_MELDUNG } from '@/lib/profil-meldungen'

const BASIS = {
  name: 'Hof Beispiel',
  ownerName: 'Maria Beispiel',
  description: 'Ein Hof mit Eiern und Heu.',
  address: 'Dorfstraße 12',
  postalCode: '3400',
  city: 'Klosterneuburg',
  country: 'AT',
  phone: '+43 660 000 0000',
  email: 'hof@beispiel.at',
  latitude: null,
  longitude: null,
  betriebsnummer: '',
  betriebsstatus: null,
}
const BESTAND = { name: BASIS.name, ownerName: BASIS.ownerName, phone: BASIS.phone }
const meldungen = (daten: unknown, schema: { safeParse: (d: unknown) => { success: boolean; error?: { issues: { message: string }[] } } } = profileSchema) => {
  const r = schema.safeParse(daten)
  return r.success ? [] : (r.error?.issues ?? []).map((i) => i.message)
}

describe('Bestandsdaten sind speicherbar', () => {
  it('leere Beschreibung und leere Hof-E-Mail gehen durch (Anlegen und Bearbeiten)', () => {
    const leer = { ...BASIS, description: '', email: '' }
    expect(profileSchema.safeParse(leer).success).toBe(true)
    expect(profilBearbeitenSchema(BESTAND).safeParse(leer).success).toBe(true)
    expect(profileSchema.parse(leer).email).toBe('')
  })

  it('eine kurze Beschreibung geht ebenfalls durch (früher mindestens 10 Zeichen)', () => {
    expect(profileSchema.safeParse({ ...BASIS, description: 'Eier.' }).success).toBe(true)
  })

  it('Gegenprobe: Randlose Leerzeichen in der E-Mail gelten als leer, eine kaputte Adresse bleibt abgelehnt', () => {
    expect(profileSchema.parse({ ...BASIS, email: '   ' }).email).toBe('')
    expect(meldungen({ ...BASIS, email: 'kein-at-zeichen' })).toEqual([PROFIL_MELDUNG.email])
  })

  it('Gegenprobe: Die Pflichtfelder bleiben Pflicht', () => {
    for (const feld of ['name', 'ownerName', 'address', 'postalCode', 'city', 'phone'] as const) {
      expect(profileSchema.safeParse({ ...BASIS, [feld]: '' }).success, feld).toBe(false)
    }
  })
})

describe('Meldungen sagen, was fehlt und wozu', () => {
  it.each([
    ['name', PROFIL_MELDUNG.name],
    ['ownerName', PROFIL_MELDUNG.ownerName],
    ['address', PROFIL_MELDUNG.address],
    ['postalCode', PROFIL_MELDUNG.postalCode],
    ['city', PROFIL_MELDUNG.city],
  ] as const)('%s leer → eigener Satz', (feld, satz) => {
    expect(meldungen({ ...BASIS, [feld]: '' })).toEqual([satz])
  })

  it('Telefon: leer und zu kurz haben je einen eigenen Satz', () => {
    expect(meldungen({ ...BASIS, phone: '' })[0]).toBe(PROFIL_MELDUNG.phoneFehlt)
    expect(meldungen({ ...BASIS, phone: '123' })).toEqual([PROFIL_MELDUNG.phoneKurz])
  })

  it('kein Satz ist „Pflichtfeld" oder ein Zod-Satz, jeder nennt den Grund und ist per Du', () => {
    for (const satz of Object.values(PROFIL_MELDUNG)) {
      expect(satz).not.toMatch(/Pflichtfeld|Ungültige|Invalid|Required/)
      expect(satz).toMatch(/^(Bitte|Die)/)
      expect(satz.length).toBeGreaterThan(40)
    }
  })

  it('das Anlegen-Formular nutzt für die Hof-E-Mail denselben Satz', () => {
    const r = hofAnlegenFormularSchema.safeParse({ ...BASIS, email: 'kaputt' })
    expect(r.success ? [] : r.error.issues.map((i) => i.message)).toContain(PROFIL_MELDUNG.email)
  })
})
