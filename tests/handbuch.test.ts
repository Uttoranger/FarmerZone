/**
 * Betriebshandbuch (Register N32, Nr. 192): Das Gerüst aus der Freigabe muss
 * gefüllt bleiben. Beweist am Quelltext von docs/betrieb/handbuch.md:
 *  - die drei Routinen und die zehn Notfälle stehen da, jeder Notfall mit
 *    „Erkennen · Sofort · Danach", gefüllt, und verweist auf die Alarm-Matrix;
 *  - Restore-Probe und Uptime-Dienst haben Schritte;
 *  - Gegenprobe: keine E-Mail-Adresse, keine IBAN, kein Schlüssel und kein
 *    lokaler Pfad im Text (das Repository ist öffentlich).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const TEXT = readFileSync(join(process.cwd(), 'docs/betrieb/handbuch.md'), 'utf8')

/** Der Text unter einer Überschrift bis zur nächsten gleicher oder höherer Ebene. */
function abschnitt(titel: string, ebene: number): string {
  const zeilen = TEXT.split('\n')
  const start = zeilen.findIndex((z) => z === `${'#'.repeat(ebene)} ${titel}`)
  expect(start, `Überschrift fehlt: ${titel}`).toBeGreaterThanOrEqual(0)
  const ende = zeilen.findIndex((z, i) => i > start && new RegExp(`^#{1,${ebene}} `).test(z))
  return zeilen.slice(start + 1, ende === -1 ? undefined : ende).join('\n')
}

const NOTFAELLE = [
  '1. Seite nicht erreichbar',
  '2. Stripe gestört (Notbremse)',
  '3. Resend gestört',
  '4. Fehlerhafter Deploy (Instant Rollback)',
  '5. Supabase gestört',
  '6. Datenpanne (72 Stunden, Meldung an die Datenschutzbehörde)',
  '7. Passkey verloren (Ersatzcodes)',
  '8. Falsche Abbuchung bei einer Kundin',
  '9. Vertretung und Notfallzugang',
  '10. Hof missbraucht die Plattform (Sperre)',
]

describe('Betriebshandbuch', () => {
  it('die drei Routinen sind gefüllt', () => {
    expect(abschnitt('Täglich (2 Minuten, Heute)', 3)).toContain('Braucht dich')
    const montag = abschnitt('Montag (10 Minuten)', 3)
    for (const punkt of ['Braucht dich leer oder geplant', 'Höfe ohne Abholzeit angeschrieben', 'Sentry: neue Fehler angesehen', 'Geld: Woche mit der Stripe-Auszahlung abgeglichen', 'Betriebshandbuch: ein Notfall gelesen']) {
      expect(montag).toContain(punkt)
    }
    expect(montag).toContain('Wochenlage')
    expect(abschnitt('Monatsende (Geld)', 3)).toContain('Stripe')
  })

  it.each(NOTFAELLE)('Notfall %s: Erkennen · Sofort · Danach, gefüllt, mit Verweis auf die Alarm-Matrix', (titel) => {
    const notfall = abschnitt(titel, 3)
    const teile = notfall.split(/^#### /m).slice(1)
    expect(teile.map((t) => t.split('\n')[0])).toEqual(['Erkennen', 'Sofort', 'Danach'])
    for (const t of teile) expect(t.split('\n').slice(1).join('').trim().length).toBeGreaterThan(40)
    expect(teile[0]).toContain('Alarm-Matrix')
  })

  it('Datenpanne nennt die 72 Stunden und ist keine Rechtsauskunft', () => {
    const panne = abschnitt('6. Datenpanne (72 Stunden, Meldung an die Datenschutzbehörde)', 3)
    expect(panne).toContain('72 Stunden')
    expect(panne).toContain('keine Rechtsauskunft')
  })

  it('Restore-Probe und Uptime-Dienst haben nummerierte Schritte', () => {
    const restore = abschnitt('Restore-Probe (vierteljährlich, Supabase Pro, tägliche Sicherung)', 2)
    expect(restore).toMatch(/^1\. /m)
    expect(restore).toContain('neues Projekt')
    const uptime = abschnitt('Uptime-Dienst einrichten', 2)
    expect(uptime).toMatch(/^1\. /m)
    expect(uptime).toContain('UptimeRobot')
    expect(uptime).toContain('Better Stack')
    expect(uptime).toContain('/api/gesund')
  })

  it('gibt jedem der zehn Notfälle genau eine Überschrift', () => {
    const ueberschriften = TEXT.split('\n').filter((z) => /^### \d+\. /.test(z))
    expect(ueberschriften.map((z) => z.slice(4))).toEqual(NOTFAELLE)
  })

  it('Gegenprobe: keine Adresse, keine IBAN, kein Schlüssel, kein lokaler Pfad', () => {
    expect(TEXT).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i)
    expect(TEXT).not.toMatch(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,}/)
    expect(TEXT).not.toMatch(/\b(?:sk|rk|pk|whsec|re)_(?:live|test)?_?[A-Za-z0-9]{8,}/)
    expect(TEXT).not.toMatch(/\/(?:home|root|tmp|Users)\//)
  })
})
