import { createHmac } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { geheimnisGleich } from '@/lib/geheimnis'
import { RESEND_EREIGNIS_MAX_BYTES, RESEND_ZUSTELL_EREIGNISSE, resendEreignisArtSchema, resendZustellSchema } from '@/schemas/resend-ereignis'
import { vermerkeZustellung } from '@/server/mail-warteschlange'

/*
 * Zustellmeldungen von Resend (Register N26, Nr. 160): Resend meldet
 * `email.delivered`, `email.bounced` und `email.complained` an diese Adresse;
 * vermerkt wird am Auftrag mit derselben `resendId` (`vermerkeZustellung`),
 * ein Bounce oder eine Spam-Meldung zu einem Beitrag meldet das Abo ab.
 *
 * Reihenfolge wie bei den anderen Webhooks: Geheimnis da? → Größe → Rohtext
 * lesen → Signatur in konstanter Zeit → erst danach JSON, Zod und Wirkung.
 *  - Ohne `RESEND_WEBHOOK_SECRET` (oder mit leerem Base64-Teil) 503, nie 200
 *    (fail-closed wie /api/lebenszeichen). Ein leerer Schlüssel ließe jeden
 *    eine gültige Signatur bauen.
 *  - Signatur nach Svix: Kopfzeilen `svix-id`, `svix-timestamp`,
 *    `svix-signature`; HMAC-SHA256 über `<id>.<timestamp>.<Rohtext>` mit dem
 *    Base64-Teil des Geheimnisses nach `whsec_`, Base64 kodiert. Die Kopfzeile
 *    kann mehrere `v1,<signatur>` durch Leerzeichen getrennt tragen (Wechsel
 *    des Geheimnisses) — eine passende reicht. Zeitstempel höchstens
 *    5 Minuten alt oder in der Zukunft (gegen Wiederholen alter Meldungen).
 *    Sonst 401.
 *  - Größe begrenzt wie /api/csp-bericht: erst die Angabe, dann begrenzt
 *    gelesen (413).
 *  - Gelesen werden nur `type`, `created_at` und `data.email_id`, nie eine
 *    Adresse (src/schemas/resend-ereignis.ts). Andere Ereignisse und
 *    unbekannte `resendId` → 200 ohne Wirkung, damit Resend nicht wiederholt.
 *  - Scheitert die Datenbank, wirft die Route (500): Resend wiederholt, und
 *    `vermerkeZustellung` ist so gebaut, dass eine Wiederholung nichts doppelt tut.
 */

const PRAEFIX = 'whsec_'
const HOECHSTENS_ALT_S = 5 * 60

export async function POST(request: NextRequest): Promise<NextResponse> {
  const schluessel = signaturSchluessel(env.RESEND_WEBHOOK_SECRET)
  if (!schluessel) return NextResponse.json({ error: 'Nicht eingerichtet.' }, { status: 503 })

  if (Number(request.headers.get('content-length') ?? 0) > RESEND_EREIGNIS_MAX_BYTES) return zuGross()
  let roh: string | null
  try {
    roh = await leseBegrenzt(request, RESEND_EREIGNIS_MAX_BYTES)
  } catch {
    // Der Absender hat den Datenstrom abgebrochen — kein Fehler dieser Seite.
    return NextResponse.json({ error: 'Ungültige Eingabe.', code: 'EINGABE' }, { status: 400 })
  }
  if (roh === null) return zuGross()

  if (!signaturGilt(request.headers, roh, schluessel, Math.floor(Date.now() / 1000))) {
    return NextResponse.json({ error: 'Signatur ungültig.', code: 'SIGNATUR' }, { status: 401 })
  }

  let json: unknown
  try {
    json = JSON.parse(roh)
  } catch {
    return eingabeUngueltig()
  }
  const art = resendEreignisArtSchema.safeParse(json)
  if (!art.success) return eingabeUngueltig()
  if (!Object.hasOwn(RESEND_ZUSTELL_EREIGNISSE, art.data.type)) return NextResponse.json({ ok: true })

  const meldung = resendZustellSchema.safeParse(json)
  if (!meldung.success) return eingabeUngueltig()

  // Der Zeitpunkt des Ereignisses bei Resend; ist er unlesbar, der Eingang hier (Minuten Unterschied).
  const gemeldet = new Date(meldung.data.created_at)
  const am = Number.isNaN(gemeldet.getTime()) ? new Date() : gemeldet
  await vermerkeZustellung(meldung.data.data.email_id, RESEND_ZUSTELL_EREIGNISSE[meldung.data.type], am)
  return NextResponse.json({ ok: true })
}

/** Der Schlüssel aus `whsec_<Base64>`; null = nicht eingerichtet (fehlt oder leer). */
function signaturSchluessel(geheimnis: string | undefined): Buffer | null {
  if (!geheimnis) return null
  const teil = geheimnis.startsWith(PRAEFIX) ? geheimnis.slice(PRAEFIX.length) : geheimnis
  const schluessel = Buffer.from(teil, 'base64')
  return schluessel.length > 0 ? schluessel : null
}

function signaturGilt(kopf: Headers, roh: string, schluessel: Buffer, jetztS: number): boolean {
  const id = kopf.get('svix-id')
  const zeit = kopf.get('svix-timestamp')
  const signaturen = kopf.get('svix-signature')
  if (!id || !zeit || !signaturen || !/^\d{1,12}$/.test(zeit)) return false
  if (Math.abs(jetztS - Number(zeit)) > HOECHSTENS_ALT_S) return false
  const erwartet = createHmac('sha256', schluessel).update(`${id}.${zeit}.${roh}`, 'utf8').digest('base64')
  return signaturen.split(' ').some((eintrag) => {
    const komma = eintrag.indexOf(',')
    return komma > 0 && eintrag.slice(0, komma) === 'v1' && geheimnisGleich(eintrag.slice(komma + 1), erwartet)
  })
}

/** Liest höchstens `max` Bytes; null = mehr geschickt (dann wird nicht weitergelesen). Wie in /api/csp-bericht. */
async function leseBegrenzt(request: NextRequest, max: number): Promise<string | null> {
  if (!request.body) return ''
  const leser = request.body.getReader()
  const teile: Uint8Array[] = []
  let laenge = 0
  for (;;) {
    const { done, value } = await leser.read()
    if (done) break
    laenge += value.byteLength
    if (laenge > max) {
      await leser.cancel()
      return null
    }
    teile.push(value)
  }
  return Buffer.concat(teile).toString('utf8')
}

function zuGross(): NextResponse {
  return NextResponse.json({ error: 'Zu groß.', code: 'ZU_GROSS' }, { status: 413 })
}

function eingabeUngueltig(): NextResponse {
  return NextResponse.json({ error: 'Ungültige Eingabe.', code: 'EINGABE' }, { status: 400 })
}
