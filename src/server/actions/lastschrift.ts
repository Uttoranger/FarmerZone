'use server'

import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LASTSCHRIFT_TEXT } from '@/lib/konditionen'

/*
 * Lastschrift und Monatsrechnungen des Hofs (Register N38, Nr. 198). Nur für
 * den Hof der Sitzung (`hofDerSitzung`) — eine Kennung aus dem Browser
 * sichert nichts, jede Abfrage nimmt die farmId der Sitzung mit. Stripe kommt
 * erst beim Aufruf (`await import`): Die Seiten, die diese Actions einbinden,
 * ziehen das SDK nicht statisch mit (tests/schwere-module.test.ts).
 *
 * „Lastschrift einrichten“ und „Lastschrift ändern“ legen je einen NEUEN
 * SetupIntent an (sepa_debit, off_session). GÜLTIG wird das Mandat nur über
 * den Webhook `setup_intent.succeeded` — was der Browser nach dem Bestätigen
 * meldet, schreibt hier nichts.
 */

/** Der Hof der angemeldeten Person — null ohne Sitzung oder ohne Hof. */
async function hofDerSitzung(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const hof = await prisma.farm.findUnique({ where: { ownerId: session.user.id }, select: { id: true } })
  return hof?.id ?? null
}

const ABGEMELDET = 'Bitte melde dich neu an.'

export type LastschriftStart = { clientSecret: string } | { error: string }

export async function starteLastschrift(): Promise<LastschriftStart> {
  const farmId = await hofDerSitzung()
  if (!farmId) return { error: ABGEMELDET }
  try {
    const { stelleStripeKundeSicher } = await import('@/server/plattformgebuehr-abrechnung')
    const { stripe } = await import('@/lib/stripe')
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
  const farmId = await hofDerSitzung()
  if (!farmId) return { error: ABGEMELDET }
  const geprueft = rechnungSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: LASTSCHRIFT_TEXT.rechnungFehlt }
  const { abrechnungId, art, ziel } = geprueft.data
  const abr = await prisma.monatsabrechnung.findFirst({ where: { id: abrechnungId, farmId }, select: { rechnungBarId: true, rechnungOnlineId: true } })
  const rechnungId = art === 'bar' ? abr?.rechnungBarId : abr?.rechnungOnlineId
  if (!rechnungId) return { error: LASTSCHRIFT_TEXT.rechnungFehlt }
  try {
    const { stripe } = await import('@/lib/stripe')
    const rechnung = await stripe.invoices.retrieve(rechnungId)
    const url = ziel === 'pdf' ? rechnung.invoice_pdf : rechnung.hosted_invoice_url
    return url ? { url } : { error: LASTSCHRIFT_TEXT.rechnungFehlt }
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'lastschrift', aufgabe: 'rechnung' }, extra: { farmId } })
    return { error: LASTSCHRIFT_TEXT.rechnungFehlt }
  }
}
