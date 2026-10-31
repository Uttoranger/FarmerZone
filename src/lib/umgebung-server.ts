import * as Sentry from '@sentry/nextjs'
import { env } from '@/lib/env'
import { STICHTAG_ZUKUNFT_WARNUNG, bestimmeUmgebung, stichtagWeitInDerZukunft, type Umgebung } from '@/lib/umgebung'
import { istTestbetrieb } from '@/lib/stripe-modus'
import { stripeMarke, type StripeMarke } from '@/lib/testumgebung'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { einmalJeTag, utcTagVon } from '@/lib/einmal-je-tag'

/**
 * Die Umgebung, einmal je Prozess berechnet — der Serverzweig zu umgebung.ts.
 *
 * Hier und nur hier treffen die Rohwerte aus env auf die reine Entscheidung.
 * Alles, was die Adresse der App braucht (Auth, E-Mail-Links, Stripe-Rücksprung,
 * Kalender), liest APP_URL von hier statt NEXT_PUBLIC_APP_URL selbst — sonst
 * fällt jede Stelle in Previews wieder einzeln auf localhost zurück.
 *
 * Kein `server-only`-Import, obwohl es ein Servermodul ist: Der Seed lädt
 * auth.ts über tsx, und die E-Mail-Tests laden email.ts in Vitest — beides
 * außerhalb von Next, dort würfe `server-only` beim Laden.
 */

// NODE_ENV ist die eine Variable, die laut TECH_STACK direkt gelesen werden darf.
export const UMGEBUNG: Umgebung = bestimmeUmgebung({
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: env.VERCEL_ENV,
  VERCEL_URL: env.VERCEL_URL,
  VERCEL_BRANCH_URL: env.VERCEL_BRANCH_URL,
  VERCEL_GIT_COMMIT_REF: env.VERCEL_GIT_COMMIT_REF,
  NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_TESTUMGEBUNG_URL: env.NEXT_PUBLIC_TESTUMGEBUNG_URL,
  DATABASE_URL: env.DATABASE_URL,
  STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
  STRIPE_CONNECT_WEBHOOK_SECRET: env.STRIPE_CONNECT_WEBHOOK_SECRET,
  STRIPE_LIVE_AB: env.STRIPE_LIVE_AB,
})

/**
 * Die Adresse für Links, die die App verlassen (E-Mails, Stripe, ICS).
 * Fällt auf localhost zurück, wie die Aufrufer es bisher einzeln taten — für
 * die vertrauten Herkünfte von Better Auth gilt das NICHT, dort bleibt eine
 * fehlende Adresse leer (siehe umgebung.ts).
 */
export const APP_URL: string = UMGEBUNG.appUrl ?? 'http://localhost:3000'

/** Ob das Banner überhaupt gezeigt wird: nur, wenn die Testumgebung eindeutig erkannt ist. */
export const ZEIGE_UMGEBUNGSBANNER = UMGEBUNG.art !== 'produktion'

/**
 * Testbetrieb (Register Z2, Nr. 42): Die Produktion läuft mit Test-Schlüssel.
 * Kasse, AdminShell und Zahlungs-Einstellungen lesen nur diesen Wahrheitswert
 * — an Client-Komponenten geht er als Prop, nie der Modus oder der Schlüssel.
 * Mit Live-Schlüssel ist er false, und die Hinweise verschwinden von selbst.
 */
export const TESTBETRIEB: boolean = istTestbetrieb(UMGEBUNG)

/**
 * Admin-Kopf (Register Z3, Nr. 43): „Stripe Live" bzw. „Stripe Test" — an die
 * AdminShell gehen nur Text und Ton, nie der Modus-Rohwert oder der Schlüssel.
 */
export const STRIPE_MARKE: StripeMarke | null = stripeMarke(UMGEBUNG)

/** Ziel von „Zur Testumgebung" im Admin — null ohne gültige Variable, dann kein Link. */
export const TESTUMGEBUNG_URL: string | null = UMGEBUNG.testumgebungUrl

/**
 * Stichtag der Live-Schaltung (Register Z4, Nr. 55) — die EINE Stelle, an der
 * STRIPE_LIVE_AB gelesen wird. Null ohne gültige Variable: Dann zählen
 * Testzahlungen mit wie vor Nr. 55. Die Abfragen in src/server/queries geben
 * ihn als Parameter an die reinen Regeln (src/lib/testzahlung.ts); an den
 * Browser geht er nie, nur der fertige Hinweis-Satz.
 */
export const STRIPE_LIVE_AB: Date | null = UMGEBUNG.stripeLiveAb

/**
 * Der Deploy, an dem „einmal je Tag und Deploy“ hängt (Nr. 184): die ersten
 * zwölf Zeichen des Commits, den Vercel mitgibt; lokal und in Tests „lokal“.
 */
export const DEPLOY_KENNUNG: string = env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 12) || 'lokal'

/** Die bekannten Zustände, die Sentry je Tag und Deploy höchstens einmal hört. */
export type BekannterZustand = 'umgebung' | 'stichtag'

/**
 * Bekannte Zustände (Register N18, Ergänzung 26.10.2026; Nr. 184): Testmodus
 * in Produktion, fehlendes Connect-Secret, ein Stichtag weit in der Zukunft.
 * Bis Nr. 184 ging die Meldung „einmal je Instanz“ — aber das Umgebungsbanner
 * im Root-Layout ruft bei jedem Seitenaufbau, und jede neue Instanz (Kaltstart,
 * Deploy, Skalierung) meldete von vorn: JAVASCRIPT-NEXTJS-7 kam so in 24
 * Tagen auf über 1 500 Ereignisse, ohne dass sich etwas änderte.
 *
 * Jetzt zwei Stufen: Je Instanz merkt sich der Speicher den UTC-Tag (kein
 * zweiter Versuch am selben Tag); über alle Instanzen entscheidet EINE
 * Anweisung auf BetriebMessung (Art `sentry:<zustand>:<deploy>`, Zeile je
 * Tag) — nur wer sie anlegt, meldet. Die Betriebsleiste und Admin › Betrieb
 * zeigen den Zustand weiter bei jedem Aufbau, sie hängen nicht an Sentry.
 */
const gemerktAm = new Map<BekannterZustand, string>()

/** Ob diese Instanz den Zustand heute schon angefragt hat; merkt ihn sonst. */
function heuteNeu(zustand: BekannterZustand, jetzt: Date): boolean {
  const tag = utcTagVon(jetzt)
  if (gemerktAm.get(zustand) === tag) return false
  gemerktAm.set(zustand, tag)
  return true
}

/**
 * Legt die Zeile des Tages für Zustand und Deploy an — true nur für die
 * Anfrage, die sie anlegt. Die Anweisung steht im Helfer (src/lib/einmal-je-tag.ts,
 * Nr. 213.3); scheitert die Datenbank, wird nicht gemeldet — der Zustand
 * steht weiter in der Betriebsleiste, und eine fehlende Datenbank meldet sich selbst.
 */
export async function erstmalsHeute(zustand: BekannterZustand, jetzt: Date): Promise<boolean> {
  return einmalJeTag(`sentry:${zustand}:${DEPLOY_KENNUNG}`, jetzt)
}

async function meldeEinmal(zustand: BekannterZustand, satz: string, jetzt: Date): Promise<void> {
  if (!(await erstmalsHeute(zustand, jetzt))) return
  try {
    Sentry.captureMessage(`Umgebung widersprüchlich: ${satz}`, 'warning')
  } catch {
    // Telemetrie scheitert leise.
  }
}

/**
 * Widersprüche in Produktion (Dev-Datenbank, Stripe test, seit Register S16
 * auch ein fremder Host oder ein Muster in NEXT_PUBLIC_APP_URL) gehen nicht ins
 * Banner — Kundinnen sehen nie eines — sondern als Warnung an Sentry, ohne den
 * Wert. Dazu, zur Laufzeit gemessen (`jetzt`), ein Stichtag mehr als 24
 * Stunden in der Zukunft (Register Z4, `stichtagWeitInDerZukunft`): Er gilt,
 * nähme aber still alle Online-Umsätze heraus — in jeder Umgebung, weil ihn
 * kein Banner zeigt.
 *
 * Beides höchstens einmal je Tag und Deploy (siehe oben); gemeldet wird nach
 * der Antwort (`nachDerAntwort`), damit kein Seitenaufbau auf die Datenbank
 * wartet. Ohne DSN ist Sentry nicht initialisiert und der Aufruf ein No-op.
 * Die Seiten rufen diese Funktion über das Umgebungsbanner bei jedem Aufbau;
 * nach dem ersten Aufruf des Tages kostet sie je Instanz nur einen Blick in
 * den Speicher.
 */
export function meldeUmgebungsWarnungen(jetzt: Date = new Date()): void {
  const offen: Array<[BekannterZustand, string]> = []
  if (stichtagWeitInDerZukunft(STRIPE_LIVE_AB, jetzt) && heuteNeu('stichtag', jetzt)) offen.push(['stichtag', STICHTAG_ZUKUNFT_WARNUNG])
  if (UMGEBUNG.art === 'produktion' && UMGEBUNG.warnungen.length > 0 && heuteNeu('umgebung', jetzt)) offen.push(['umgebung', UMGEBUNG.warnungen.join(' ')])
  if (offen.length === 0) return
  nachDerAntwort(async () => {
    for (const [zustand, satz] of offen) await meldeEinmal(zustand, satz, jetzt)
  })
}
