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
 *  - Reservieren und Halte erneuern (Nr. 150): in /api/reserve NACH beiden
 *    Speicher-Bremsen und dem Parsen, VOR Fristfreigabe, Aufräumen und den
 *    Hof-Prüfungen; in /api/warenkorb/pruefen NACH Speicher-Bremse und
 *    Parsen, VOR Fristfreigabe und Erneuern.
 *  - Prüfkette der Höfe (Nr. 165): eine Funktion in src/server/warenkorb.ts
 *    (Stilllegung → Freischaltung → Pause → Kaufsperre), in beiden Routen
 *    nach der Fristfreigabe und vor Bestand bzw. Abgleich.
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

describe('Reservieren — zweite Stufe in /api/reserve (Nr. 150)', () => {
  const route = quelle('src', 'app', 'api', 'reserve', 'route.ts')
  const post = route.slice(route.indexOf('export async function POST'))

  it('Speicher-Bremsen → Parsen → Datenbank → Fristfreigabe → Aufräumen → Stilllegung → Freischaltung → Pause → Kaufsperre → Bestand', () => {
    expect(
      inReihenfolge(post, [
        "enforceRateLimit('reserve', request)",
        'bodySchema.safeParse(body)',
        "enforceRateLimit('reserve', request, sessionId)",
        'await bremseReservieren(request)',
        'if (ueberAlleInstanzen) return ueberAlleInstanzen',
        'gibVerwaisteFreiFuerProdukte([productId], now)',
        'prisma.stockReservation.deleteMany',
        'pruefeKaufbarkeitHof(product.farm, now)',
        'prisma.stockReservation.aggregate',
        'prisma.stockReservation.upsert',
      ])
    ).toBe(true)
  })

  it('Gegenprobe: nach der Fristfreigabe stünde sie falsch', () => {
    expect(inReihenfolge(post, ['gibVerwaisteFreiFuerProdukte(', 'await bremseReservieren('])).toBe(false)
  })
})

describe('Halt freigeben — DELETE /api/reserve, gebremst wie Reservieren (Nr. 169)', () => {
  const route = quelle('src', 'app', 'api', 'reserve', 'route.ts')
  const loeschen = route.slice(route.indexOf('export async function DELETE'), route.indexOf('export async function POST'))

  it('steht vor POST — der Abschnitt von POST reicht bis zum Dateiende', () => {
    expect(route.indexOf('export async function DELETE')).toBeGreaterThan(-1)
    expect(route.indexOf('export async function DELETE')).toBeLessThan(route.indexOf('export async function POST'))
  })

  it('Speicher-Bremse je IP → Parsen → je Sitzung → Datenbank-Bremse → nur die Halte dieser Sitzung löschen', () => {
    expect(
      inReihenfolge(loeschen, [
        "enforceRateLimit('reserve', request)",
        'freigabeSchema.safeParse(body)',
        "enforceRateLimit('reserve', request, sessionId)",
        'await bremseReservieren(request)',
        'if (ueberAlleInstanzen) return ueberAlleInstanzen',
        'await loescheHalte([productId], sessionId)',
      ])
    ).toBe(true)
  })

  it('keine Fristfreigabe und keine Prüfkette beim Freigeben', () => {
    for (const fremd of ['gibVerwaisteFreiFuerProdukte', 'pruefeKaufbarkeitHof', 'stockReservation.']) {
      expect(loeschen).not.toContain(fremd)
    }
  })

  it('Gegenprobe: nach dem Löschen stünde die Bremse falsch', () => {
    expect(inReihenfolge(loeschen, ['loescheHalte(', 'await bremseReservieren('])).toBe(false)
  })
})

describe('Prüfkette des Hofs — EINE Funktion für beide Routen (Nr. 165)', () => {
  const server = quelle('src', 'server', 'warenkorb.ts')
  const kette = server.slice(server.indexOf('export async function pruefeKaufbarkeitHoefe'))

  it('Stilllegung → Freischaltung → Pause → Zählung der vollen Tage → Kaufsperre', () => {
    expect(
      inReihenfolge(kette, ['hof.archivedAt', '!hof.approvedAt', 'hof.isPaused', 'await ausgebuchteTage(', 'kaufSperre('])
    ).toBe(true)
  })

  it('Gegenprobe: Pause vor Stilllegung stünde falsch', () => {
    expect(inReihenfolge(kette, ['hof.isPaused', 'hof.archivedAt'])).toBe(false)
  })

  it('/api/reserve prüft den Hof nicht mehr selbst, nur über die gemeinsame Kette', () => {
    const route = quelle('src', 'app', 'api', 'reserve', 'route.ts')
    for (const eigen of ['farm.archivedAt', 'farm.approvedAt', 'farm.isPaused', 'kaufSperre(']) {
      expect(route).not.toContain(eigen)
    }
  })
})

describe('Reservieren — zweite Stufe in /api/warenkorb/pruefen (Nr. 150)', () => {
  const route = quelle('src', 'app', 'api', 'warenkorb', 'pruefen', 'route.ts')
  const post = route.slice(route.indexOf('export async function POST'))

  it('Speicher-Bremse → Parsen → Datenbank → Fristfreigabe → Prüfkette der Höfe → Abgleich → Erneuern', () => {
    expect(
      inReihenfolge(post, [
        "enforceRateLimit('warenkorb-pruefen', request)",
        'bodySchema.safeParse(body)',
        'await bremseReservieren(request)',
        'if (ueberAlleInstanzen) return ueberAlleInstanzen',
        'gibVerwaisteFreiFuerProdukte(',
        'hofSperrenFuerProdukte(',
        'pruefeSitzungsWarenkorb(',
        'erneuereHalte(',
      ])
    ).toBe(true)
  })

  it('Gegenprobe: vor dem Parsen stünde sie falsch', () => {
    expect(inReihenfolge(post, ['await bremseReservieren(', 'bodySchema.safeParse(body)'])).toBe(false)
  })
})
