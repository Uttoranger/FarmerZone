import { createHmac } from 'crypto'
import { draftMode, headers } from 'next/headers'
import { env } from '@/lib/env'
import { geheimnisGleich } from '@/lib/geheimnis'
import { vorschauParameterSchema } from '@/schemas/startseite'

/*
 * Der Vorschau-Link der Startseite (Register N16, Nr. 96): `/?vorschau=…&sig=…`
 * zeigt die Startseite mit dem „Stand am" eines Tages und dem Block in
 * Bearbeitung — nur mit gültiger Admin-Sitzung, eine Stunde lang.
 *
 * Dasselbe HMAC-Muster wie abo-bestaetigung-token.ts (Geheimnis aus dem
 * validierten env-Modul, Zweck im Inhalt, Vergleich in konstanter Zeit).
 *
 * INHALT UND SIGNATUR GETRENNT: `vorschau` trägt nur Datum, Block und
 * Ausstellzeit (nichts Geheimes), `sig` die Signatur. Den Parameter `sig`
 * entfernt die Sentry-Hygiene schon nach seinem Namen (HEIKLE_PARAMETER in
 * src/lib/sentry-hygiene.ts) — so steht die Signatur in keinem Sentry-
 * Ereignis, auch wenn die Seite einmal einen Fehler meldet. Geloggt wird sie
 * hier nie.
 *
 * Der Link allein öffnet nichts: Die Seite verlangt zusätzlich die Admin-
 * Sitzung (frisch aus der Datenbank, wie verlangeAdminSeite) und den Draft
 * Mode, den nur die Admin-Action einschaltet.
 */

const ZWECK = 'startseite-vorschau'

/** Eine Stunde ab dem Ausstellen. */
export const VORSCHAU_GUELTIG_MS = 60 * 60 * 1000

/** Spielraum für Uhren, die zwischen Instanzen nicht ganz gleich gehen. */
const UHR_SPIELRAUM_MS = 5 * 60 * 1000

function signiere(inhalt: string): string {
  return createHmac('sha256', env.BETTER_AUTH_SECRET).update(inhalt).digest('hex')
}

export type VorschauInhalt = { datum: Date; blockEntwurfId: string | null }

/** Der Pfad des Vorschau-Links — nur der Server baut ihn (Action „Vorschau öffnen"). */
export function erzeugeVorschauPfad(inhalt: VorschauInhalt, jetzt: Date): string {
  const roh = `${ZWECK}:${jetzt.getTime()}:${inhalt.datum.getTime()}:${inhalt.blockEntwurfId ?? ''}`
  const vorschau = Buffer.from(roh).toString('base64url')
  return `/?vorschau=${vorschau}&sig=${signiere(roh)}`
}

export type VorschauErgebnis = ({ ok: true } & VorschauInhalt) | { ok: false; grund: 'abgelaufen' | 'ungueltig' }

/** Prüft Signatur, Zweck und Ablauf. „abgelaufen" nur bei gültiger Signatur. */
export function pruefeVorschau(vorschau: string, sig: string, jetzt: Date): VorschauErgebnis {
  const roh = Buffer.from(vorschau, 'base64url').toString()
  if (!geheimnisGleich(sig, signiere(roh))) return { ok: false, grund: 'ungueltig' }
  const teile = roh.split(':')
  if (teile.length !== 4 || teile[0] !== ZWECK) return { ok: false, grund: 'ungueltig' }
  const ausgestellt = Number(teile[1])
  const datum = Number(teile[2])
  if (!Number.isSafeInteger(ausgestellt) || !Number.isSafeInteger(datum) || datum <= 0) return { ok: false, grund: 'ungueltig' }
  if (ausgestellt > jetzt.getTime() + UHR_SPIELRAUM_MS) return { ok: false, grund: 'ungueltig' }
  if (jetzt.getTime() >= ausgestellt + VORSCHAU_GUELTIG_MS) return { ok: false, grund: 'abgelaufen' }
  return { ok: true, datum: new Date(datum), blockEntwurfId: teile[3] === '' ? null : teile[3] }
}

/**
 * Die Vorschau dieser Anfrage — oder null (dann die normale Startseite).
 *
 * ZUERST der Draft Mode: Nur wenn ihn „Vorschau öffnen" für diesen Browser
 * eingeschaltet hat, rendert Next die Seite je Anfrage; dann erst werden die
 * Parameter der Adresse und die Sitzung gelesen. Ohne Draft Mode (jeder Besuch
 * und jeder Bau) liest diese Funktion nichts aus der Anfrage — die Startseite
 * bleibt statisch (revalidate 300). Danach: gültiger, nicht abgelaufener
 * Link und Admin-Sitzung, sonst null.
 */
export async function vorschauDieserAnfrage(
  parameter: Promise<Record<string, string | string[] | undefined>>,
  jetzt: Date
): Promise<VorschauInhalt | null> {
  if (!(await draftMode()).isEnabled) return null
  const gelesen = vorschauParameterSchema.safeParse(await parameter)
  if (!gelesen.success) return null
  const ergebnis = pruefeVorschau(gelesen.data.vorschau, gelesen.data.sig, jetzt)
  if (!ergebnis.ok) return null
  // Sitzung und Admin-Recht erst hier und dynamisch geladen: Der statische
  // Weg der Startseite braucht Better Auth nie (ARCHITECTURE §4).
  const [{ auth }, { isAdminUser }] = await Promise.all([import('@/lib/auth'), import('@/server/queries/admin')])
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user || !(await isAdminUser(session.user.id))) return null
  return { datum: ergebnis.datum, blockEntwurfId: ergebnis.blockEntwurfId }
}
