'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrationSchema } from '@/schemas/register'
import { checkFormToken, FORM_EXPIRED_MESSAGE } from '@/lib/form-token'

// Single server action for the full registration flow:
// Zod validation → auth.api.signUpEmail (sets cookie via nextCookies()) → FARMER role
//
// Die Registrierung ist OFFEN — kein Einladungscode mehr. Der Schutz sitzt
// nicht mehr am Eingang, sondern an der Freigabe: Ein neu angelegter Hof
// entsteht mit approvedAt = null und ist öffentlich unsichtbar, bis der
// Betreiber ihn im Admin-Bereich freischaltet (src/lib/farm-approval.ts).
// Das Rate-Limit (10/min/IP aus src/lib/auth.ts) gilt unverändert weiter.
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
  const name = `${data.firstName.trim()} ${data.lastName.trim()}`
  const validated = registrationSchema.safeParse({ email: data.email, password: data.password, name })
  if (!validated.success) {
    return { error: validated.error.issues[0].message }
  }

  // 2. Create user record (no cookie set here — client calls signIn.email afterwards)
  let userId: string
  try {
    const result = await auth.api.signUpEmail({
      body: { email: data.email, password: data.password, name },
    })
    userId = result.user.id
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const lower = message.toLowerCase()
    if (lower.includes('already') || lower.includes('exist') || lower.includes('duplicate') || lower.includes('unique')) {
      return { error: 'Diese E-Mail-Adresse ist bereits registriert.' }
    }
    console.error('[registerFarmer] signUpEmail error:', err)
    return { error: 'Registrierung fehlgeschlagen. Bitte versuche es erneut.' }
  }

  // 3. Set FARMER role (role.input = false prevents setting it via Better Auth client)
  try {
    await prisma.user.update({ where: { id: userId }, data: { role: 'FARMER' } })
  } catch (err) {
    console.error('[registerFarmer] role update error:', err)
    // Non-fatal: user is created and logged in; role can be fixed manually
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
