import { prisma } from '@/lib/prisma'
import { adresseBestaetigt, kundinnenKonto } from '@/lib/anmeldecode'

/**
 * Die bewiesene Adresse des angemeldeten Kontos — klein geschrieben — oder
 * null (E8, Nr. 17a). Gelesen wird FRISCH aus der Datenbank, nicht aus dem
 * Sitzungsobjekt. Den Grund gab es bis Nr. 114: Better Auth legte nach der
 * Code-Anmeldung eines vorher unbestätigten Kontos (alle ruhenden Altkonten
 * aus dem Checkout) den alten Stand `emailVerified: false` für die Dauer des
 * Cookie-Caches (5 Minuten) in die Sitzung. Seit Nr. 114 ist der Cache aus
 * (ARCHITECTURE §5 „Sitzung frisch"), die Sitzung liest das Konto selbst
 * frisch; dieses zweite Lesen bleibt vorerst bestehen. Eine zurückgenommene
 * Bestätigung gilt sofort. Nur für
 * Kundinnen-Konten (CUSTOMER ohne isAdmin) — Höfe und Betreiber bekommen
 * null, auch bestätigt (Nr. 17b).
 */
export async function bestaetigteAdresse(userId: string): Promise<string | null> {
  const nutzer = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true, role: true, isAdmin: true },
  })
  // Nur Kundinnen (Nr. 17b, Nachbesserung Runde 1): Ein Hof bestätigt seine
  // Adresse per Link — das beweist nichts über fremde Abos zu dieser Adresse.
  if (!nutzer || !kundinnenKonto(nutzer) || !adresseBestaetigt(nutzer)) return null
  return nutzer.email.toLowerCase()
}
