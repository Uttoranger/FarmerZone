import { createHmac } from 'crypto'
import { env } from '@/lib/env'
import { geheimnisGleich } from '@/lib/geheimnis'
import { vorschauParameterSchema, vorschauQuelleSchema, type VorschauParameter, type VorschauQuelle } from '@/schemas/startseite'

/*
 * Der Vorschau-Link der Startseite (Register N16, Nr. 96; Route seit Nr. 182):
 * `/startseite-vorschau?vorschau=…&sig=…` zeigt die Startseite mit dem „Stand
 * am" eines Tages und dem Block in Bearbeitung — nur mit gültiger
 * Admin-Sitzung, eine Stunde lang. Seit Nr. 99
 * trägt der Inhalt auch die Quelle (`entwurf`, `live` oder `fassung:<id>`):
 * Sie steht im signierten Teil, ein geänderter Link zeigt also nie eine
 * andere Quelle.
 *
 * Dasselbe HMAC-Muster wie abo-bestaetigung-token.ts (Geheimnis aus dem
 * validierten env-Modul, Zweck im Inhalt, Vergleich in konstanter Zeit).
 *
 * INHALT UND SIGNATUR GETRENNT: `vorschau` trägt nur Datum, Block, Quelle und
 * Ausstellzeit (nichts Geheimes), `sig` die Signatur. Den Parameter `sig`
 * entfernt die Sentry-Hygiene schon nach seinem Namen (HEIKLE_PARAMETER in
 * src/lib/sentry-hygiene.ts) — so steht die Signatur in keinem Sentry-
 * Ereignis, auch wenn die Seite einmal einen Fehler meldet. Geloggt wird sie
 * hier nie.
 *
 * Der Link allein öffnet nichts: Die Seite verlangt zusätzlich die Admin-
 * Sitzung über die Admin-Wache (seit Nr. 188, Audit A2/B1: Recht frisch aus
 * der Datenbank, 12 Stunden, Passkey der Sitzung, Recht „Startseite
 * veröffentlichen“). Damit wirkt er auf jedem Gerät, auf dem der Admin mit
 * Passkey angemeldet ist.
 *
 * EIGENE DYNAMISCHE ROUTE, KEIN DRAFT MODE (Register N16, Ergänzung
 * 25.10.2026; Nr. 182): Bis dahin las die statische Startseite `/` den Link im
 * Draft Mode. Für eine Route mit `revalidate` gibt Vercel aber keinen
 * Query-Parameter an die Funktion weiter (`allowQuery: []`, auch im Draft
 * Mode) — in Produktion zeigte die Vorschau darum immer die Live-Seite, lokal
 * nie nachstellbar. Jetzt liest nur src/app/startseite-vorschau/page.tsx
 * (force-dynamic) den Link, über leseStartseitenVorschau.
 */

const ZWECK = 'startseite-vorschau'

/** Eine Stunde ab dem Ausstellen. */
export const VORSCHAU_GUELTIG_MS = 60 * 60 * 1000

/** Spielraum für Uhren, die zwischen Instanzen nicht ganz gleich gehen. */
const UHR_SPIELRAUM_MS = 5 * 60 * 1000

function signiere(inhalt: string): string {
  return createHmac('sha256', env.BETTER_AUTH_SECRET).update(inhalt).digest('hex')
}

export type VorschauInhalt = { datum: Date; blockEntwurfId: string | null; quelle: VorschauQuelle }

/** Die Abfrage `vorschau=…&sig=…` aus geprüften Werten (Base64url und Hex, nichts zu kodieren). */
function alsAbfrage({ vorschau, sig }: VorschauParameter): string {
  return `vorschau=${vorschau}&sig=${sig}`
}

/** Die Abfrage des Vorschau-Links — nur der Server baut sie (Action „Vorschau öffnen"). */
export function erzeugeVorschauAbfrage(inhalt: VorschauInhalt, jetzt: Date): string {
  // Die Quelle zuletzt: Sie darf selbst ein „:" tragen (`fassung:<id>`).
  const roh = `${ZWECK}:${jetzt.getTime()}:${inhalt.datum.getTime()}:${inhalt.blockEntwurfId ?? ''}:${inhalt.quelle}`
  return alsAbfrage({ vorschau: Buffer.from(roh).toString('base64url'), sig: signiere(roh) })
}

export type VorschauErgebnis = ({ ok: true } & VorschauInhalt) | { ok: false; grund: 'abgelaufen' | 'ungueltig' }

/** Prüft Signatur, Zweck und Ablauf. „abgelaufen" nur bei gültiger Signatur. */
export function pruefeVorschau(vorschau: string, sig: string, jetzt: Date): VorschauErgebnis {
  const roh = Buffer.from(vorschau, 'base64url').toString()
  if (!geheimnisGleich(sig, signiere(roh))) return { ok: false, grund: 'ungueltig' }
  const teile = roh.split(':')
  const quelle = vorschauQuelleSchema.safeParse(teile.slice(4).join(':'))
  if (teile.length < 5 || teile[0] !== ZWECK || !quelle.success) return { ok: false, grund: 'ungueltig' }
  const ausgestellt = Number(teile[1])
  const datum = Number(teile[2])
  if (!Number.isSafeInteger(ausgestellt) || !Number.isSafeInteger(datum) || datum <= 0) return { ok: false, grund: 'ungueltig' }
  if (ausgestellt > jetzt.getTime() + UHR_SPIELRAUM_MS) return { ok: false, grund: 'ungueltig' }
  if (jetzt.getTime() >= ausgestellt + VORSCHAU_GUELTIG_MS) return { ok: false, grund: 'abgelaufen' }
  return { ok: true, datum: new Date(datum), blockEntwurfId: teile[3] === '' ? null : teile[3], quelle: quelle.data }
}

/**
 * Gültiger, nicht abgelaufener Link UND Admin-Sitzung → der Inhalt; sonst
 * null. Die Sitzung wird erst nach einer gültigen Signatur gelesen.
 */
async function vorschauFuerAdmin({ vorschau, sig }: VorschauParameter, jetzt: Date): Promise<VorschauInhalt | null> {
  const ergebnis = pruefeVorschau(vorschau, sig, jetzt)
  if (!ergebnis.ok) return null
  // Die Admin-Wache erst hier und dynamisch geladen: Better Auth gehört nicht
  // in den statischen Import-Graphen einer Seite (ARCHITECTURE §4).
  const { verlangeAdminAktion } = await import('@/server/admin-wache')
  if (!('ok' in (await verlangeAdminAktion({ recht: 'startseite_veroeffentlichen' })))) return null
  return { datum: ergebnis.datum, blockEntwurfId: ergebnis.blockEntwurfId, quelle: ergebnis.quelle }
}

/**
 * Die Vorschau der Seite /startseite-vorschau aus den Parametern ihrer
 * Adresse — oder null (dann zeigt die Seite ihren Fehlerzustand, nie die
 * Startseite). Unsinnige Parameter sind Fremddaten: null, nie ein Fehler.
 * Gültiger, nicht abgelaufener Link UND Admin-Sitzung, die Sitzung erst nach
 * einer gültigen Signatur gelesen.
 */
export async function leseStartseitenVorschau(
  parameter: Record<string, string | string[] | undefined>,
  jetzt: Date
): Promise<VorschauInhalt | null> {
  const gelesen = vorschauParameterSchema.safeParse(parameter)
  return gelesen.success ? vorschauFuerAdmin(gelesen.data, jetzt) : null
}
