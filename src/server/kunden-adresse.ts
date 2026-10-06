import { prisma } from '@/lib/prisma'
import { adresseBestaetigt } from '@/lib/anmeldecode'

/**
 * Die bewiesene Adresse des angemeldeten Kontos — klein geschrieben — oder
 * null (E8, Nr. 17a). Gelesen wird FRISCH aus der Datenbank, nie aus dem
 * Sitzungsobjekt: Better Auth legt nach der Code-Anmeldung eines vorher
 * unbestätigten Kontos (alle ruhenden Altkonten aus dem Checkout) den alten
 * Stand `emailVerified: false` für die Dauer des Cookie-Caches (5 Minuten,
 * src/lib/auth.ts) in die Sitzung — erst updateUser, dann setSessionCookie
 * mit dem vorher gelesenen Nutzer (better-auth email-otp/routes.mjs).
 * Umgekehrt gilt eine zurückgenommene Bestätigung sofort.
 */
export async function bestaetigteAdresse(userId: string): Promise<string | null> {
  const nutzer = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  })
  if (!nutzer || !adresseBestaetigt(nutzer)) return null
  return nutzer.email.toLowerCase()
}
