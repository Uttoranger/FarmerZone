import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { geheimnisGleich } from '@/lib/geheimnis'
import { vercelAusgabenSchema } from '@/schemas/betrieb-messung'
import { verbucheVercelAusgaben } from '@/server/betrieb'

/*
 * Vercel-Ausgaben (Register N18, Nr. 113): Spend Management schickt bei 50,
 * 75 und 100 % des Ausgabenlimits einen POST mit `{ budgetAmount,
 * currentSpend, teamId, thresholdPercent }` und dem Header
 * `x-vercel-signature` (HMAC-SHA1 des Rohtexts, hex, mit dem Geheimnis aus
 * dem Dashboard). Kein Abruf der Vercel-API — die Zahlen kommen nur so.
 *
 * Reihenfolge wie beim Stripe-Webhook: erst den Rohtext lesen (die Signatur
 * gilt dem Text, wie er ankam — nie einem neu geschriebenen JSON), dann die
 * Signatur in konstanter Zeit prüfen, erst danach JSON und Zod und jede
 * Wirkung. Fehlt das Geheimnis: 500, nichts gespeichert (fail-closed);
 * falsche oder fehlende Signatur: 400.
 *
 * Bei 100 % pausiert Vercel das Projekt — dann nimmt diese Route den Aufruf
 * womöglich schon nicht mehr an, und es bleibt nur Vercels eigene Mail.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const roh = await request.text()

  const geheimnis = env.VERCEL_AUSGABEN_SECRET
  if (!geheimnis) return NextResponse.json({ error: 'Nicht eingerichtet.' }, { status: 500 })

  const erwartet = createHmac('sha1', geheimnis).update(roh, 'utf8').digest('hex')
  if (!geheimnisGleich(request.headers.get('x-vercel-signature') ?? '', erwartet)) {
    return NextResponse.json({ error: 'Signatur ungültig.', code: 'SIGNATUR' }, { status: 400 })
  }

  let json: unknown
  try {
    json = JSON.parse(roh)
  } catch {
    return NextResponse.json({ error: 'Ungültige Eingabe.', code: 'EINGABE' }, { status: 400 })
  }
  const meldung = vercelAusgabenSchema.safeParse(json)
  if (!meldung.success) return NextResponse.json({ error: 'Ungültige Eingabe.', code: 'EINGABE' }, { status: 400 })

  // Die eine Umrechnung an der Systemgrenze: Vercel schickt Dollar als Zahl;
  // ab hier nur noch ganze Cent (gerundet, 19.99 → 1999). Geld wird nur angezeigt.
  await verbucheVercelAusgaben({
    ausgabenCent: Math.round(meldung.data.currentSpend * 100),
    limitCent: Math.round(meldung.data.budgetAmount * 100),
    schwelleProzent: meldung.data.thresholdPercent,
  })
  return NextResponse.json({ ok: true })
}
