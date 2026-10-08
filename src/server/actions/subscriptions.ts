'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bestaetigteAdresse } from '@/server/kunden-adresse'
import { aboAenderungSchema, aboBestaetigenSchema } from '@/schemas/abo'
import { abmeldeTokenSchema } from '@/schemas/abmelden'
import { ABMELDE_LINK_UNGUELTIG } from '@/lib/abmelde-link'
import { ABO_TEXT, aboFehlerSatz, wartetAufBestaetigung } from '@/lib/abo-bestaetigung'
import { EMAIL_ABO_STAND, bestaetigeEmailAbo, loeseOffeneAnfrageAuf, meldeAboMitTokenAb, meldeEmailAboAn } from '@/server/abo-anmeldung'

// Abos hängen an der Adresse, nicht an einem Konto. Ändern oder löschen darf
// sie nur, wer die Adresse mit Code bewiesen hat (E8, Nr. 17a) — frisch aus
// der Datenbank geprüft, nie aus der Sitzung (bestaetigteAdresse).
const ADRESSE_UNBESTAETIGT = 'Melde dich bitte mit dem Code aus deiner E-Mail an, dann kannst du deine Abos ändern.'
const KONTO_ADRESSE_UNBESTAETIGT = 'Melde dich bitte mit dem Code aus deiner E-Mail an, dann kannst du dein Konto löschen.'
const KONTO_NUR_KUNDIN = 'Ein Hof-Konto lässt sich hier nicht löschen. Schreib uns, wir helfen dir weiter.'

export type ActionResult = { error?: string }

/**
 * Was der E-Mail-Schalter auf /account danach zeigt (Double-Opt-in, S11):
 * `an` (Bestand oder bestätigt), `aus`, oder `wartet` — der Link ist
 * unterwegs. Die Kundin ist hier mit Code angemeldet, ihr Abo-Stand ist
 * keine fremde Auskunft.
 */
export type AboAenderungErgebnis = { error?: string; email?: 'an' | 'aus' | 'wartet' }

export async function updateSubscription(
  farmId: string,
  optInEmail: boolean,
  optInWhatsApp: boolean,
): Promise<AboAenderungErgebnis> {
  // Die Argumente kommen aus dem Browser — erst prüfen, dann lesen (Nr. 19b).
  const eingabe = aboAenderungSchema.safeParse({ farmId, optInEmail, optInWhatsApp })
  if (!eingabe.success) return { error: 'Das hat nicht geklappt. Bitte lade die Seite neu und versuch es noch einmal.' }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }
  const customerEmail = await bestaetigteAdresse(session.user.id)
  if (!customerEmail) return { error: ADRESSE_UNBESTAETIGT }

  // Keine Telefonnummer aus dem Konto: Sie kann aus einer Registrierung mit
  // Passwort stammen, die die Adresse nie bewiesen hat — Better Auth behält
  // sie beim ersten Code. Die Nummer eines Abos kommt nur aus dem Checkout.
  //
  // E-Mail an schaltet NICHT direkt an (Double-Opt-in, S11, Nr. 38): Neue und
  // abgemeldete Abos bekommen einen Bestätigungslink, auch hier — der
  // Auftrag verlangt den Klick auf den Link für jede neue Anmeldung.
  // Ausschalten wirkt sofort.
  const geprueft = eingabe.data
  const wo = { customerEmail_farmId: { customerEmail, farmId: geprueft.farmId } }
  const speichern = prisma.customerFarmSubscription.upsert({
    where: wo,
    create: {
      customerEmail,
      farmId: geprueft.farmId,
      optInEmail: false,
      optInWhatsApp: geprueft.optInWhatsApp,
      customerPhone: null,
    },
    // Aus setzt optInEmail immer false — auch bei einem bestätigten Abo.
    update: { optInWhatsApp: geprueft.optInWhatsApp, ...(geprueft.optInEmail ? {} : { optInEmail: false }) },
    select: EMAIL_ABO_STAND,
  })
  if (!geprueft.optInEmail) {
    // ERST die offene Anfrage auflösen, DANN ausschalten, in einer
    // Transaktion (Nachbesserung Runde 1/2): Sonst stünde der Schalter nach
    // dem Neuladen wieder auf „wartet", der alte Link bestätigte weiter — und
    // eine Bestätigung genau zwischen beiden Schritten ließe das Abo trotz
    // „aus" bestätigt und an. In dieser Reihenfolge findet eine spätere
    // Bestätigung ihre Anfrage nicht mehr, eine frühere schaltet das
    // upsert wieder aus.
    await prisma.$transaction([
      loeseOffeneAnfrageAuf({ customerEmail, farmId: geprueft.farmId }),
      speichern,
    ])
    return { email: 'aus' }
  }
  const abo = await speichern

  const jetzt = new Date()
  // Wartet die Anmeldung schon auf einen gültigen Link, ist „E-Mail an" nichts
  // Neues — etwa wenn der WhatsApp-Schalter den E-Mail-Stand mitschickt. Kein
  // zweiter Link; einen neuen gibt es über Aus und wieder An.
  if (wartetAufBestaetigung(abo, jetzt)) return { email: 'wartet' }
  const schritt = await meldeEmailAboAn(abo, jetzt)
  return { email: schritt === 'schon-aktiv' ? 'an' : 'wartet' }
}

/**
 * Der Knopf hinter dem Link aus der Bestätigungsmail (POST, S11/S2). Ohne
 * Anmeldung: Der signierte Token beweist das Postfach. Antwort nur mit
 * festen Sätzen.
 */
export async function bestaetigeNeuigkeiten(input: unknown): Promise<{ ok: true; hofName: string } | { error: string }> {
  const eingabe = aboBestaetigenSchema.safeParse(input)
  if (!eingabe.success) return { error: aboFehlerSatz('ungueltig') }

  const stand = await bestaetigeEmailAbo(eingabe.data.token, new Date())
  switch (stand.zustand) {
    case 'bestaetigt':
      return { ok: true, hofName: stand.hofName }
    case 'offen':
      // Nach dem Schreiben noch offen: nur möglich, wenn das Abo zwischendurch
      // geändert wurde — dann lieber noch einmal versuchen lassen.
      return { error: ABO_TEXT.unerwartet }
    default:
      return { error: aboFehlerSatz(stand.zustand) }
  }
}

export async function unsubscribeWithToken(token: unknown): Promise<ActionResult> {
  // Das Argument kommt aus dem Browser — erst die Gestalt prüfen (Nr. 47).
  const eingabe = abmeldeTokenSchema.safeParse(token)
  // Derselbe Satz wie beim Ein-Klick-Endpunkt — der Token läuft nicht ab, und der Satz nennt den Ausweg.
  if (!eingabe.success) return { error: ABMELDE_LINK_UNGUELTIG }

  // Derselbe Weg wie die Ein-Klick-Abmeldung des Mailprogramms (/api/abmelden):
  // offene Anfrage auflösen, dann E-Mail und WhatsApp aus (abo-anmeldung.ts).
  const { gueltig } = await meldeAboMitTokenAb(eingabe.data)
  if (!gueltig) return { error: ABMELDE_LINK_UNGUELTIG }

  return {}
}

export async function deleteCustomerAccount(): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }

  // Wie vor 17a: Konto und Abos der Adresse gehen zusammen. Ohne bewiesene
  // Adresse gehören die Abos womöglich jemand anderem — dann wird gar nichts
  // gelöscht, statt das Konto zu löschen und die Abos stehen zu lassen.
  const email = await bestaetigteAdresse(session.user.id)
  if (!email) return { error: KONTO_ADRESSE_UNBESTAETIGT }

  // Nur Kundinnen-Konten (Nr. 17b). Seit neue Höfe ihre E-Mail bestätigen,
  // reicht die bestätigte Adresse als Schutz nicht mehr: Ein Hof löschte
  // sonst die Abos zu seiner Adresse und scheiterte danach am Konto
  // (Farm.ownerId ist RESTRICT); ein Betreiber-Konto (isAdmin) gehört nie
  // hierher. Frisch aus der Datenbank, nie aus der Sitzung.
  const konto = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, isAdmin: true } })
  if (konto?.role !== 'CUSTOMER' || konto.isAdmin) return { error: KONTO_NUR_KUNDIN }

  // Zusammen oder gar nicht — nie Abos weg und Konto noch da (oder umgekehrt).
  await prisma.$transaction([
    prisma.customerFarmSubscription.deleteMany({ where: { customerEmail: email } }),
    prisma.user.delete({ where: { id: session.user.id } }),
  ])

  return {}
}
