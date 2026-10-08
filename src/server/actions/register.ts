'use server'

import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrationSchema, vollerName } from '@/schemas/register'
import { checkFormToken, FORM_EXPIRED_MESSAGE } from '@/lib/form-token'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { DB_BREMSEN, REGISTRIERUNG_JE_IP, REGISTRIERUNG_ZU_VIELE } from '@/lib/bremse-datenbank'
import { bremseUeberAlleInstanzen } from '@/server/bremse-datenbank'

// Erste Stufe: je Instanz im Speicher (SERVERLESS-KAVEAT in rate-limit.ts).
const registrierungJeIp = createRateLimiter({ max: REGISTRIERUNG_JE_IP.max, windowMs: REGISTRIERUNG_JE_IP.fensterMs })

// Ablauf: Zod → auth.api.signUpEmail (legt das Konto an, meldet NICHT an) →
// Rolle FARMER → Bestätigungs-Mail. Angemeldet wird erst nach der Bestätigung.
//
// EINE Antwort für neue und vergebene Adressen (Register F6 „19b", Nr. 27):
// Bei einer vergebenen Adresse liefert Better Auth (`autoSignIn: false`,
// src/lib/auth.ts) ein Scheinkonto ohne Datenbankzeile und schickt dem
// bestehenden Konto einen Hinweis — hier bleibt nur, an diesem Konto nichts
// zu tun und trotzdem { ok: true } zu antworten.
//
// Die Registrierung ist OFFEN — kein Einladungscode mehr. Der Schutz sitzt
// nicht mehr am Eingang, sondern an der Freigabe: Ein neu angelegter Hof
// entsteht mit approvedAt = null und ist öffentlich unsichtbar, bis der
// Betreiber ihn im Admin-Bereich freischaltet (src/lib/farm-approval.ts).
//
// BREMSE JE IP (Register R1, Nr. 40), nur in Produktion, zweistufig: erst der
// Speicher dieser Instanz, dann dieselbe Grenze über alle Instanzen in der
// Datenbank (src/server/bremse-datenbank.ts, fail-open). 10 je Minute — die
// Zahl des Better-Auth-Limits. Das greift hier NICHT: Better Auth bremst nur
// Anfragen über seinen HTTP-Weg, `auth.api.signUpEmail` vom Server läuft an
// ihm vorbei (better-auth/dist/api/index.mjs, onRequestRateLimit nur im
// Router), und `/sign-up/email` ist über HTTP gesperrt.
//
// Davor sitzen seit dem Spam-Sprint zwei Schranken gegen naive Bots — beide
// kosten echte Höfe nichts, weil sie an Dingen hängen, die ein Browser
// ohnehin mitbringt:
//   Honigtopf   ein für Menschen unsichtbares Feld, das leer bleiben muss.
//   Zeitschranke  ein signierter Zeitstempel aus dem Seitenaufbau; unter drei
//                 Sekunden zwischen Aufruf und Absenden füllt niemand aus.
// Beide lehnen STILL ab: Der Aufrufer bekommt dieselbe Erfolgsmeldung wie bei
// einer echten Registrierung, angelegt wird nichts. Ein Bot soll nicht lernen,
// woran er gescheitert ist — sonst probiert er die nächste Variante.
export async function registerFarmer(data: {
  firstName: string
  lastName: string
  email: string
  password: string
  /** Honigtopf aus dem Formular — für Menschen unsichtbar, muss leer bleiben. */
  website: string
  /** Signierter Zeitstempel aus dem Seitenaufbau (src/lib/form-token.ts). */
  formToken: string
}): Promise<{ ok: true } | { error: string }> {
  // 0. Bot-Abwehr — VOR jeder Validierung und jedem Schreibzugriff.
  //    Beide Prüfungen sind bewusst unabhängig von den Eingabefeldern: ein Bot
  //    mit sauberer E-Mail und starkem Passwort scheitert hier genauso.
  const honigtopfGefuellt =
    typeof data.website === 'string' && data.website.trim().length > 0
  const zeitschranke = checkFormToken(typeof data.formToken === 'string' ? data.formToken : '')

  if (!honigtopfGefuellt && zeitschranke === 'abgelaufen') {
    // Der einzige sichtbare Fall: ein Mensch hat das Formular zu lange offen
    // liegen lassen. Eine stille Erfolgsmeldung würde ihn im Glauben lassen,
    // sein Konto sei angelegt.
    return { error: FORM_EXPIRED_MESSAGE }
  }

  if (honigtopfGefuellt || zeitschranke !== 'ok') {
    // Log-Hygiene wie in src/lib/auth.ts: die Adresse gehört nicht in die
    // Produktions-Logs (Vercel), lokal hilft sie beim Nachvollziehen.
    if (process.env.NODE_ENV !== 'production') {
      const grund = honigtopfGefuellt ? 'Honigtopf' : `Zeitschranke/${zeitschranke}`
      console.log(`[DEV] Registrierung still abgewiesen (${grund}): ${data.email}`)
    }
    // Erfolgsmeldung ohne Wirkung: kein User, kein Hof, keine Benachrichtigung.
    return { ok: true }
  }

  // 1. Zod validation (defense-in-depth, same rules as client checklist)
  const validated = registrationSchema.safeParse({
    email: data.email,
    password: data.password,
    name: vollerName(data.firstName, data.lastName),
  })
  if (!validated.success) {
    return { error: validated.error.issues[0].message }
  }

  // 1b. Bremse je IP (siehe Kopf) — vor dem teuren Teil (Passwort-Hash,
  //     Konto anlegen, Mail).
  if (process.env.NODE_ENV === 'production') {
    const ip = getClientIp(await headers())
    if (!registrierungJeIp.check(ip)) return { error: REGISTRIERUNG_ZU_VIELE }
    if (!(await bremseUeberAlleInstanzen([{ bremse: DB_BREMSEN.registrierungIp, merkmal: ip }]))) {
      return { error: REGISTRIERUNG_ZU_VIELE }
    }
  }

  // 2. Konto anlegen — ohne Sitzung (autoSignIn: false); das Formular meldet nicht an.
  // Mit den GEPRÜFTEN Werten: Das Schema schneidet die Ränder der E-Mail ab —
  // die rohe Eingabe mit Leerzeichen lehnte Better Auth als ungültig ab.
  let userId: string
  try {
    const result = await auth.api.signUpEmail({
      body: { email: validated.data.email, password: data.password, name: validated.data.name },
    })
    userId = result.user.id
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const lower = message.toLowerCase()
    if (lower.includes('already') || lower.includes('exist') || lower.includes('duplicate') || lower.includes('unique')) {
      // Darf mit `autoSignIn: false` nicht mehr vorkommen. Kommt es doch
      // (Einstellung verloren, anderes Verhalten nach einem Update), bleibt
      // die Antwort trotzdem dieselbe wie bei Erfolg — der Betreiber erfährt
      // es über Sentry, ohne Adresse. Den Hinweis an das Konto gibt es dann nicht.
      Sentry.captureMessage('Registrierung: vergebene Adresse als Fehler statt neutral beantwortet', {
        level: 'warning',
        tags: { aktion: 'registerFarmer', grund: 'vergeben_als_fehler' },
      })
      return { ok: true }
    }
    console.error('[registerFarmer] signUpEmail error:', err)
    return { error: 'Registrierung fehlgeschlagen. Bitte versuche es erneut.' }
  }

  // 3. Set FARMER role (role.input = false prevents setting it via Better Auth client)
  try {
    await prisma.user.update({ where: { id: userId }, data: { role: 'FARMER' } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      // Kein Konto mit dieser ID: das Scheinkonto einer vergebenen Adresse.
      // Nichts weiter tun — vor allem keine Bestätigungs-Mail an das
      // bestehende Konto (dessen Hinweis schickt Better Auth) — und dieselbe
      // Antwort wie bei Erfolg geben.
      return { ok: true }
    }
    console.error('[registerFarmer] role update error:', err)
    // Non-fatal: user is created; role can be fixed manually
  }

  // 4. Bestätigungs-Mail (S3, Nr. 17b) — erst JETZT, mit Rolle FARMER: Der
  //    Versand geht nur an Höfe (auth.ts prüft die Rolle frisch). Ohne
  //    Sitzung findet Better Auth das Konto über die Adresse und schickt nur,
  //    solange es unbestätigt ist; die Mail selbst geht nach der Antwort raus.
  //    Ein Fehler hier lässt die Registrierung nicht scheitern — der Hof kann
  //    die Mail auf /verify neu anfordern.
  try {
    await auth.api.sendVerificationEmail({ body: { email: validated.data.email } })
  } catch (err) {
    console.error('[registerFarmer] Bestätigungs-Mail nicht angestoßen:', err instanceof Error ? err.name : 'unbekannt')
  }

  return { ok: true }
}

// Kept for potential future use (e.g. admin flow)
export async function setFarmerRole(): Promise<{ ok: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Keine aktive Session gefunden.' }

  try {
    await prisma.user.update({ where: { id: session.user.id }, data: { role: 'FARMER' } })
    return { ok: true }
  } catch (err) {
    console.error('[setFarmerRole] error:', err)
    return { error: 'Rollen-Update fehlgeschlagen.' }
  }
}
