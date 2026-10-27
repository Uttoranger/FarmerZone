'use server'

import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { LASTSCHRIFT_TEXT } from '@/lib/konditionen'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { stelleStripeKundeSicher } from '@/server/plattformgebuehr-abrechnung'

/*
 * Lastschrift und Monatsrechnungen des Hofs (Register N38, Nr. 198). Nur für
 * den Hof der Sitzung (verlangeHofDerSitzung) — eine Kennung aus dem Browser
 * sichert nichts, jede Abfrage nimmt die farmId der Sitzung mit.
 *
 * „Lastschrift einrichten“ und „Lastschrift ändern“ legen je einen NEUEN
 * SetupIntent an (sepa_debit, off_session). GÜLTIG wird das Mandat nur über
 * den Webhook `setup_intent.succeeded` — was der Browser nach dem Bestätigen
 * meldet, schreibt hier nichts.
 */

export type LastschriftStart = { clientSecret: string } | { error: string }

export async function starteLastschrift(): Promise<LastschriftStart> {
  const { farmId } = await verlangeHofDerSitzung()
  try {
    const kunde = await stelleStripeKundeSicher(farmId)
    const si = await stripe.setupIntents.create({
      customer: kunde,
      payment_method_types: ['sepa_debit'],
      usage: 'off_session',
      metadata: { farmId },
    })
    if (!si.client_secret) return { error: LASTSCHRIFT_TEXT.fehler }
    return { clientSecret: si.client_secret }
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'lastschrift', aufgabe: 'setup-intent' }, extra: { farmId } })
    return { error: LASTSCHRIFT_TEXT.fehler }
  }
}

const rechnungSchema = z.object({
  abrechnungId: z.string().regex(/^[\w-]{1,64}$/),
  art: z.enum(['bar', 'online']),
  ziel: z.enum(['pdf', 'bezahlen']),
})

/**
 * Die Rechnung als PDF bzw. die gehostete Seite „Jetzt bezahlen“ — erst beim
 * Klick bei Stripe gelesen, nie gespeichert. Nur eine Abrechnung des eigenen
 * Hofs; eine fremde Kennung sieht aus wie eine fehlende.
 */
export async function oeffneRechnung(eingabe: unknown): Promise<{ url: string } | { error: string }> {
  const { farmId } = await verlangeHofDerSitzung()
  const geprueft = rechnungSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: LASTSCHRIFT_TEXT.rechnungFehlt }
  const { abrechnungId, art, ziel } = geprueft.data
  const abr = await prisma.monatsabrechnung.findFirst({ where: { id: abrechnungId, farmId }, select: { rechnungBarId: true, rechnungOnlineId: true } })
  const rechnungId = art === 'bar' ? abr?.rechnungBarId : abr?.rechnungOnlineId
  if (!rechnungId) return { error: LASTSCHRIFT_TEXT.rechnungFehlt }
  try {
    const rechnung = await stripe.invoices.retrieve(rechnungId)
    const url = ziel === 'pdf' ? rechnung.invoice_pdf : rechnung.hosted_invoice_url
    return url ? { url } : { error: LASTSCHRIFT_TEXT.rechnungFehlt }
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'lastschrift', aufgabe: 'rechnung' }, extra: { farmId } })
    return { error: LASTSCHRIFT_TEXT.rechnungFehlt }
  }
}
