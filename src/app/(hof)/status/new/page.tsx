import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getStatusTemplate } from '@/server/queries/status-posts'
import { prisma } from '@/lib/prisma'
import { WERBEMAIL_EMPFAENGER } from '@/server/abo-anmeldung'
import { mailSperreWo } from '@/lib/beitrag-mailabstand'
import { anlassParameterSchema } from '@/schemas/beitrag-anlass'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { StatusNewClient } from './status-new-client'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `Neuer Beitrag — ${MARKE}` }

export const dynamic = 'force-dynamic'

/*
 * „Neuer Beitrag" (Wizard Inhalt → Empfänger → Versand) in der HofShell
 * (Nachtlauf Nr. 22e): dieselbe Action publishStatusPost und derselbe Ablauf
 * wie bisher, nur in die Routengruppe (hof) gezogen und auf Tokens gestellt.
 * Nach dem Veröffentlichen öffnet sich das Teilen-Fenster im Beitrag-Modus
 * (Register T5, Nr. 67) mit den WhatsApp-Abonnentinnen als erster Karte —
 * ein WhatsApp-Häkchen gibt es hier nicht mehr, E-Mail bleibt eines.
 * Zurück führt in den Reiter „Beiträge" von Mein Hof
 * (UnterseitenKopf, seit Nr. 44 am Handy fest oben; die h1 trägt der
 * Assistent je Schritt selbst).
 */

export default async function StatusNewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; anlass?: string | string[] }>
}) {
  const { userId } = await verlangeHofDerSitzung()

  const farm = await getFarmForUser(userId)
  if (!farm) redirect('/onboarding')

  // Vorlage-Muster: ?from={id} lädt einen Alt-Status als Vorbefüllung —
  // serverseitig und farm-gescoped (Ownership); fremde/ungültige ID → null
  const { from, anlass: anlassRoh } = await searchParams
  const template = await getStatusTemplate(farm.id, from)
  // Vorgewählter Anlass aus dem Anstoß in Heute; kommen `from` und `anlass`, gelten beide (der Anlass sticht den der Vorlage).
  const anlass = anlassParameterSchema.parse(anlassRoh ?? null)

  // Ein Zeitpunkt für Abfrage und Anzeige (CODING_STANDARDS §2): Der Assistent
  // rechnet „vor n Tagen" mit demselben jetzt, nie mit der Uhr des Browsers.
  const jetzt = new Date()

  const [products, emailCount, recentEmail] = await Promise.all([
    prisma.product.findMany({
      where: { farmId: farm.id, isAvailable: true },
      select: { id: true, name: true, price: true },
      orderBy: { name: 'asc' },
    }),
    // Dieselben Empfänger wie beim Versand: Bestand und bestätigte Anmeldungen (S11).
    prisma.customerFarmSubscription.count({ where: { farmId: farm.id, ...WERBEMAIL_EMPFAENGER } }),
    // Dieselbe Sperre wie beim Versand (mailSperreWo, Nr. 149); der neueste Beitrag nennt die Tage.
    prisma.statusPost.findFirst({
      where: mailSperreWo(farm.id, jetzt),
      select: { publishedAt: true },
      orderBy: { publishedAt: 'desc' },
    }),
  ])

  return (
    <div className="mx-auto max-w-2xl px-4 pt-5 pb-12 md:px-8 md:pt-7">
      <UnterseitenKopf />
      <StatusNewClient
        products={products.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }))}
        emailCount={emailCount}
        recentEmailSentAt={recentEmail?.publishedAt?.toISOString() ?? null}
        jetzt={jetzt.toISOString()}
        farmSlug={farm.id}
        prefill={template}
        anlass={anlass}
      />
    </div>
  )
}
