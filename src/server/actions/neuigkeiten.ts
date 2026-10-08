'use server'

import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { bestellLinkGilt } from '@/lib/bestell-link'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { NEUIGKEITEN_PRO_MINUTE, NEUIGKEITEN_TEXT } from '@/lib/abo-bestaetigung'
import { neuigkeitenAnmeldenSchema } from '@/schemas/abo'
import { EMAIL_ABO_STAND, meldeEmailAboAn } from '@/server/abo-anmeldung'

/*
 * „Neuigkeiten vom Hof per E-Mail" auf der Bestätigungsseite (Register N2,
 * Nachtlauf Nr. 46) — vorher ein Haken in der Kasse, den /api/checkout
 * mitten in der Bestellung verarbeitete.
 *
 * BERECHTIGUNG: Es gibt kein Konto (E8). Die Signatur der Bestätigungsseite
 * ist der Zugang, wie auf der Seite selbst — geprüft VOR jeder
 * Datenbankabfrage. Die Bestell-ID allein ist ratbar.
 *
 * DIE ADRESSE KOMMT AUS DER BESTELLUNG, nie aus dem Browser: Wer den Link hat,
 * kann nur die Adresse anmelden, an die die Bestellung ging — und auch die
 * erst nach dem Klick in der Mail (Double-Opt-in, S11, über die bestehende
 * Logik `meldeEmailAboAn`, keine zweite). Der Hof bekommt so nur bestätigte
 * Abos.
 *
 * GETRENNT VON DER BESTELLUNG: Die Action liest die Bestellung nur und
 * schreibt nie an ihr. Ein Fehler hier endet in einem Satz an der Karte und
 * einer Meldung an Sentry — die Bestellung bleibt, wie sie ist.
 *
 * KEINE AUSKUNFT: Neu, schon angemeldet, gebremst — die Antwort ist immer
 * dieselbe `{ ok: true }`.
 */

// Modul-Zustand: eine Bremse je Instanz (Hausmuster öffentlicher Actions,
// ARCHITECTURE §3). Die zweite Bremse sitzt im Abo: ein Link je zehn Minuten.
const jeIp = createRateLimiter({ max: NEUIGKEITEN_PRO_MINUTE })

export type NeuigkeitenErgebnis = { ok: true } | { error: string; code?: 'ZU_VIELE' }

function meldeFehler(err: unknown, orderId: string): void {
  // Fester Text und Art, nie Adresse oder Hofname (sentry-hygiene).
  const meldung = new Error('Neuigkeiten nicht angemeldet')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, { tags: { aufgabe: 'neuigkeiten', grund: 'abo_nicht_gespeichert' }, extra: { orderId } })
}

export async function meldeNeuigkeitenAn(eingabe: unknown): Promise<NeuigkeitenErgebnis> {
  const geprueft = neuigkeitenAnmeldenSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: NEUIGKEITEN_TEXT.linkUngueltig }
  const { orderId, sig } = geprueft.data
  if (!bestellLinkGilt(orderId, sig)) return { error: NEUIGKEITEN_TEXT.linkUngueltig }

  // Wie enforceRateLimit nur in Produktion — lokal und in Tests bleibt sie aus.
  if (process.env.NODE_ENV === 'production') {
    const ip = getClientIp(await headers())
    if (!jeIp.check(`neuigkeiten:${ip}`)) return { error: NEUIGKEITEN_TEXT.zuViele, code: 'ZU_VIELE' }
  }

  try {
    const bestellung = await prisma.order.findUnique({
      where: { id: orderId },
      select: { customerEmail: true, farmId: true, farm: { select: { archivedAt: true } } },
    })
    // Stillgelegter Hof: wie die Seite selbst (notFound) — keine Anmeldung.
    if (!bestellung || bestellung.farm.archivedAt) return { error: NEUIGKEITEN_TEXT.linkUngueltig }

    // Die Bestellung trägt die Adresse schon bereinigt und klein (emailSchema);
    // das Abo hängt an genau dieser Schreibweise wie /account und der Abmeldelink.
    const customerEmail = bestellung.customerEmail.toLowerCase()
    const abo = await prisma.customerFarmSubscription.upsert({
      where: { customerEmail_farmId: { customerEmail, farmId: bestellung.farmId } },
      // optInEmail erst mit dem Klick in der Mail (bestaetigeEmailAbo).
      create: { customerEmail, farmId: bestellung.farmId, optInEmail: false, optInWhatsApp: false },
      // Ein bestehendes Abo bleibt, wie es ist — meldeEmailAboAn entscheidet.
      update: {},
      select: EMAIL_ABO_STAND,
    })
    await meldeEmailAboAn(abo, new Date())
  } catch (err) {
    meldeFehler(err, orderId)
    return { error: NEUIGKEITEN_TEXT.fehler }
  }
  return { ok: true }
}
