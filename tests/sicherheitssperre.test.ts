/**
 * Tests der Sicherheitssperre der Integrationsschicht.
 *
 * Sie liegt bewusst in der SCHNELLEN Suite (`pnpm test`, also im Stop-Hook):
 * Die Sperre braucht keine Datenbank, um beweisbar zu sein — und sie muss
 * beweisbar sein, bevor jemand sie benutzt. Wer sie später aufweicht, sieht es
 * hier sofort.
 */
import { describe, it, expect } from 'vitest'
import { pruefeTestDatenbank, verlangeTestDatenbank } from './integration/setup/sicherheitssperre'

// Kein Geheimnis: Projektreferenzen stehen in jedem Hostnamen des Projekts.
const PROD_REF = 'zxwkhizjvpyporjteylr'
const DEV_REF = 'pmshaubwpxzdupwhyvjj'
const LOKAL = 'postgresql://postgres:postgres@localhost:5432/farmerzone_test'

describe('pruefeTestDatenbank', () => {
  it('lässt eine lokale Testdatenbank durch', () => {
    expect(pruefeTestDatenbank(LOKAL)).toBeNull()
    expect(pruefeTestDatenbank('postgresql://postgres:postgres@127.0.0.1:5432/fz_test')).toBeNull()
    expect(pruefeTestDatenbank('postgresql://postgres:postgres@postgres:5432/fz_test')).toBeNull()
  })

  it('bricht bei fehlender Variable ab und verweist auf die Beispieldatei — kein stilles Überspringen', () => {
    const fehler = pruefeTestDatenbank(undefined)
    expect(fehler).toContain('TEST_DATABASE_URL ist nicht gesetzt')
    expect(fehler).toContain('.env.test.example')
  })

  it('behandelt eine leere Variable wie eine fehlende', () => {
    expect(pruefeTestDatenbank('')).toContain('nicht gesetzt')
    expect(pruefeTestDatenbank('   ')).toContain('nicht gesetzt')
  })

  it('bricht bei der Produktions-Datenbank ab und sagt, dass es die Produktion ist', () => {
    const direkt = `postgresql://postgres:geheim@db.${PROD_REF}.supabase.co:5432/postgres`
    const pooler = `postgresql://postgres.${PROD_REF}:geheim@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
    expect(pruefeTestDatenbank(direkt)).toContain('PRODUKTIONS-Datenbank')
    expect(pruefeTestDatenbank(pooler)).toContain('PRODUKTIONS-Datenbank')
  })

  it('bricht auch bei der Dev-Datenbank ab', () => {
    const pooler = `postgresql://postgres.${DEV_REF}:geheim@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
    expect(pruefeTestDatenbank(pooler)).toContain('DEV-Datenbank')
  })

  it('bricht bei einem Tunnel auf localhost ab, dessen Benutzername auf Produktion zeigt', () => {
    const tunnel = `postgresql://postgres.${PROD_REF}:geheim@localhost:6543/postgres`
    expect(pruefeTestDatenbank(tunnel)).toContain('PRODUKTIONS-Datenbank')
  })

  it('bricht bei einem Tunnel auch dann ab, wenn das Projekt hier nicht notiert ist', () => {
    // Die generische Pooler-Regel: Punkt im Benutzernamen, Host lokal.
    const fehler = pruefeTestDatenbank('postgresql://postgres.fremdesprojekt:geheim@localhost:6543/postgres')
    expect(fehler).toContain('postgres.<projekt>')
  })

  it('bricht bei jedem fremden Host ab und nennt ihn', () => {
    const fehler = pruefeTestDatenbank('postgresql://u:geheim@db.fremd.example.com:5432/postgres')
    expect(fehler).toContain('db.fremd.example.com')
  })

  it('verrät in keiner Meldung das Passwort oder die ganze Adresse', () => {
    const adressen = [
      `postgresql://postgres:sehr-geheimes-passwort@db.${PROD_REF}.supabase.co:5432/postgres`,
      'postgresql://u:sehr-geheimes-passwort@db.fremd.example.com:5432/postgres',
      'keine-adresse-mit-sehr-geheimes-passwort',
    ]
    for (const adresse of adressen) {
      const fehler = pruefeTestDatenbank(adresse)
      expect(fehler).not.toBeNull()
      expect(fehler).not.toContain('sehr-geheimes-passwort')
      expect(fehler).not.toContain(adresse)
    }
  })
})

describe('verlangeTestDatenbank', () => {
  it('gibt die geprüfte Adresse zurück', () => {
    expect(verlangeTestDatenbank(` ${LOKAL} `)).toBe(LOKAL)
  })

  it('wirft, wenn die Adresse nicht durch die Prüfung kommt', () => {
    expect(() => verlangeTestDatenbank(undefined)).toThrow(/Integrationstests abgebrochen/)
    expect(() =>
      verlangeTestDatenbank(`postgresql://postgres:geheim@db.${PROD_REF}.supabase.co:5432/postgres`)
    ).toThrow(/PRODUKTIONS-Datenbank/)
  })
})
