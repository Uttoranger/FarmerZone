'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe'
import { bestaetigteAdresse } from '@/server/kunden-adresse'
import { aboAenderungSchema, aboBestaetigenSchema } from '@/schemas/abo'
import { ABO_TEXT } from '@/lib/abo-bestaetigung'
import { EMAIL_ABO_STAND, bestaetigeEmailAbo, meldeEmailAboAn } from '@/server/abo-anmeldung'

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
  const abo = await prisma.customerFarmSubscription.upsert({
    where: { customerEmail_farmId: { customerEmail, farmId: geprueft.farmId } },
    create: {
      customerEmail,
      farmId: geprueft.farmId,
      optInEmail: false,
      optInWhatsApp: geprueft.optInWhatsApp,
      customerPhone: null,
    },
    update: { optInWhatsApp: geprueft.optInWhatsApp, ...(geprueft.optInEmail ? {} : { optInEmail: false }) },
    select: EMAIL_ABO_STAND,
  })
  if (!geprueft.optInEmail) return { email: 'aus' }

  const schritt = await meldeEmailAboAn(abo, new Date())
  return { email: schritt === 'schon-aktiv' ? 'an' : 'wartet' }
}

/**
 * Der Knopf hinter dem Link aus der Bestätigungsmail (POST, S11/S2). Ohne
 * Anmeldung: Der signierte Token beweist das Postfach. Antwort nur mit
 * festen Sätzen.
 */
export async function bestaetigeNeuigkeiten(input: unknown): Promise<{ ok: true; hofName: string } | { error: string }> {
  const eingabe = aboBestaetigenSchema.safeParse(input)
  if (!eingabe.success) return { error: `${ABO_TEXT.ungueltig} ${ABO_TEXT.ausweg}` }

  const stand = await bestaetigeEmailAbo(eingabe.data.token, new Date())
  switch (stand.zustand) {
    case 'offen':
      // Nach dem Schreiben noch offen: nur möglich, wenn das Abo zwischendurch
      // neu angefragt wurde — dann gilt der neuere Link.
      return { error: ABO_TEXT.unerwartet }
    case 'bestaetigt':
      return { ok: true, hofName: stand.hofName }
    case 'abgelaufen':
      return { error: `${ABO_TEXT.abgelaufen} ${ABO_TEXT.ausweg}` }
    case 'abo_weg':
      return { error: ABO_TEXT.abo_weg }
    case 'ungueltig':
      return { error: `${ABO_TEXT.ungueltig} ${ABO_TEXT.ausweg}` }
  }
}

export async function unsubscribeWithToken(token: string): Promise<ActionResult> {
  const data = verifyUnsubscribeToken(token)
  if (!data) return { error: 'Ungültiger oder abgelaufener Link' }

  await prisma.customerFarmSubscription.updateMany({
    where: { customerEmail: data.email.toLowerCase(), farmId: data.farmId },
    data: { optInEmail: false, optInWhatsApp: false },
  })

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
