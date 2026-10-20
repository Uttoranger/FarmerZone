import { createAuthClient } from 'better-auth/react'
import { passkeyClient } from '@better-auth/passkey/client'
import { ERSATZCODE_ANMELDEN_PFAD } from '@/lib/admin-anmeldung'

/*
 * Der Passkey-Client NUR für die Admin-Seiten (Register N20; Nr. 115):
 * /login/admin, /admin/einrichten, /admin/einstellungen/anmeldung,
 * /admin/bestaetigen und den Dialog „Mit Passkey bestätigen". Getrennt von
 * src/lib/auth-client.ts, damit @simplewebauthn/browser nicht in jede Seite
 * der Kundschaft und der Höfe geladen wird. Ohne baseURL wie dort: Der Client
 * nimmt die Adresse, unter der die Seite läuft — Passkeys gelten genau unter
 * der Adresse, unter der sie eingerichtet wurden.
 */
const passkeyAuthClient = createAuthClient({
  plugins: [passkeyClient()],
})

/** Anmelden bzw. frisch bestätigen (`signIn.passkey()`) und einrichten (`passkey.addPasskey()`). */
export const { signIn: passkeySignIn, passkey: passkeyEinrichten } = passkeyAuthClient

/** Anmeldung mit Ersatzcode (eigener Endpunkt in src/lib/auth.ts); der Fehler wie bei jedem Better-Auth-Aufruf (Satz über passkeyFehlerText). */
export async function meldeMitErsatzcodeAn(email: string, code: string): Promise<{ error: { status: number } | null }> {
  const { error } = await passkeyAuthClient.$fetch(ERSATZCODE_ANMELDEN_PFAD, { method: 'POST', body: { email, code } })
  return { error: error ?? null }
}
