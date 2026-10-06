import { createAuthClient } from 'better-auth/react'
import { emailOTPClient } from 'better-auth/client/plugins'

// Bewusst OHNE baseURL: Auth-Server und Seite laufen immer unter derselben
// Adresse, und genau dann darf sie laut Better-Auth-Doku („If the auth server
// is running on the same domain as your client, you can skip this step")
// entfallen — der Client nimmt die Adresse, unter der die Seite gerade läuft.
// Vorher stand hier NEXT_PUBLIC_APP_URL mit localhost-Ersatz: In Previews, wo
// die Variable fehlt, rief der Browser damit einen fremden Rechner an.
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
})

// Kein signUp: Passwort-Konten entstehen nur über registerFarmer (Server),
// /sign-up/email ist über HTTP zu — ein Export hier wäre ein toter Weg.
export const { signIn, signOut, useSession } = authClient
