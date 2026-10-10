/**
 * Wache am Quelltext: Wo die zweite Stufe der Bremse (Register R1, Nr. 40)
 * hängt und in welcher Reihenfolge.
 *
 * Better Auth und der Checkout-Handler lassen sich im Unit-Test nicht ohne
 * Datenbank durchlaufen; ihr Verhalten prüfen tests/bremse-datenbank.test.ts
 * (anmeldecodeGebremst, bremseCheckout) und die Integrationsschicht. Hier
 * steht nur, DASS und WO die Aufrufe sitzen:
 *  - Anmeldecode: im before-Hook von auth.ts, auf beiden Pfaden — beim
 *    Anfordern NACH der Speicher-Bremse je Adresse und VOR der Rollenprüfung,
 *    beim Anmelden VOR der Rollenprüfung.
 *  - Checkout: NACH enforceRateLimit mit Sitzung, VOR der Fristfreigabe und
 *    jedem Schreiben.
 *  - Gegenprobe: Die Muster schlagen an einer vertauschten Reihenfolge an.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const quelle = (...teile: string[]) => readFileSync(join(process.cwd(), ...teile), 'utf8')

/** Liegen die Stellen in genau dieser Reihenfolge im Text (jede vorhanden)? */
function inReihenfolge(text: string, stellen: string[]): boolean {
  let ab = 0
  for (const stelle of stellen) {
    const i = text.indexOf(stelle, ab)
    if (i < 0) return false
    ab = i + stelle.length
  }
  return true
}

/** Der Teil des Hooks für einen Pfad: von `ctx.path === '<pfad>'` bzw. `!== '<pfad>'` bis zum nächsten `ctx.path`. */
function hookAbschnitt(text: string, pfad: string): string {
  const start = text.search(new RegExp(`ctx\\.path [!=]== '${pfad.replace(/\//g, '\\/')}'`))
  if (start < 0) return ''
  const rest = text.slice(start + 1)
  const ende = rest.search(/ctx\.path [!=]== '/)
  return ende < 0 ? rest : rest.slice(0, ende)
}

describe('Anmeldecode — zweite Stufe im Hook von auth.ts', () => {
  const auth = quelle('src', 'lib', 'auth.ts')

  it('Anfordern: erst die Speicher-Bremse je Adresse, dann die Datenbank, dann die Rolle', () => {
    const abschnitt = hookAbschnitt(auth, '/email-otp/send-verification-otp')
    expect(
      inReihenfolge(abschnitt, [
        "body?.type !== 'sign-in'",
        'codeAnforderungen.erlaubt(body.email)',
        "anmeldecodeGebremst('anfordern', ctx.headers, body.email)",
        "throw new APIError('TOO_MANY_REQUESTS'",
        'rolleZurAdresse(email)',
      ])
    ).toBe(true)
  })

  it('Anmelden mit Code: die Datenbank je IP vor der Rollenprüfung', () => {
    const abschnitt = hookAbschnitt(auth, '/sign-in/email-otp')
    expect(
      inReihenfolge(abschnitt, [
        "anmeldecodeGebremst('pruefen', ctx.headers, null)",
        "throw new APIError('TOO_MANY_REQUESTS'",
        'rolleZurAdresse(adresseWieDasPlugin(body.email))',
      ])
    ).toBe(true)
  })

  it('Gegenprobe: eine vertauschte Reihenfolge fällt auf', () => {
    const abschnitt = hookAbschnitt(auth, '/email-otp/send-verification-otp')
    expect(
      inReihenfolge(abschnitt, ["anmeldecodeGebremst('anfordern'", 'codeAnforderungen.erlaubt(body.email)'])
    ).toBe(false)
  })
})

describe('Checkout — zweite Stufe in /api/checkout', () => {
  const route = quelle('src', 'app', 'api', 'checkout', 'route.ts')
  const post = route.slice(route.indexOf('export async function POST'))

  it('nach der Speicher-Bremse mit Sitzung, vor Fristfreigabe, Idempotenz und Hof-Lesen', () => {
    expect(
      inReihenfolge(post, [
        "enforceRateLimit('checkout', request)",
        'checkoutRequestSchema.safeParse(body)',
        "enforceRateLimit('checkout', request, data.sessionId)",
        'await bremseCheckout(request, data.sessionId)',
        'if (ueberAlleInstanzen) return ueberAlleInstanzen',
        'gibVerwaisteFreiOhneRisiko(data.farmId)',
        'antwortFuerBestehendeBestellung(data.idempotencyKey',
        'prisma.farm.findUnique',
      ])
    ).toBe(true)
  })

  it('Gegenprobe: vor der Speicher-Bremse stünde sie falsch', () => {
    expect(inReihenfolge(post, ['await bremseCheckout(', "enforceRateLimit('checkout', request, data.sessionId)"])).toBe(
      false
    )
  })
})
