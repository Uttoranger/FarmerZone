/**
 * Einmalig: die Fähigkeit `eps_payments` für die bestehenden Stripe-Konten der
 * Höfe nachfordern (Fix Kasse-Zahlarten, 30.10.2026).
 *
 * Warum: Die Kasse bietet fest Karte und EPS an (KASSE_ZAHLARTEN). Im
 * Hofpreis-Modell (on_behalf_of, ab dem Stichtag) ist das Hofkonto Händler
 * und braucht die Fähigkeit selbst. Neue Konten fordern sie beim Anlegen an
 * (src/server/actions/stripe-connect.ts), alte nicht.
 *
 * Idempotent: Ein Konto, das die Fähigkeit schon angefordert hat, wird nicht
 * erneut angefordert. Jedes Konto ohne AKTIVE Fähigkeit meldet das Skript
 * sichtbar und endet mit Exit-Code 1: Im Hofpreis-Modell scheitert dort die
 * ganze Online-Zahlung, nicht nur EPS. Erneut starten, bis alles aktiv ist.
 * Startet NUR die Projektleitung, nie automatisch. Ohne `--ausfuehren` liest
 * das Skript nur und zeigt, was es täte.
 *
 *   pnpm dotenv -e .env.local -- tsx scripts/eps-faehigkeit-nachfordern.ts
 *   pnpm dotenv -e .env.local -- tsx scripts/eps-faehigkeit-nachfordern.ts --ausfuehren
 *
 * Ausgabe nur Hof-Kennung und Stand — keine Namen, Adressen oder Konto-Daten.
 */
import Stripe from 'stripe'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/** Stand der Fähigkeit, wie Stripe ihn im Konto führt; fehlt sie, ist sie nie angefordert. */
export type EpsStand = 'active' | 'inactive' | 'pending' | 'unrequested' | undefined

/** Braucht dieses Konto die Nachforderung? Nur, wenn EPS nie angefordert wurde. */
export function brauchtEpsNachforderung(stand: EpsStand): boolean {
  return stand === undefined || stand === 'unrequested'
}

/**
 * Kann die Kasse im Hofpreis-Modell (on_behalf_of) bei diesem Hof online
 * kassieren? Nur mit AKTIVER Fähigkeit — angefordert, aber `pending` oder
 * `inactive`, lehnt Stripe den PaymentIntent mit EPS ab, und die Bestellung
 * scheitert ganz (nicht nur EPS).
 */
export function epsKasseBereit(stand: EpsStand): boolean {
  return stand === 'active'
}

async function main(): Promise<void> {
  const ausfuehren = process.argv.includes('--ausfuehren')
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {} as never)
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

  const hoefe = await prisma.farm.findMany({ where: { stripeAccountId: { not: null } }, select: { id: true, stripeAccountId: true } })
  let nachgefordert = 0
  let nichtBereit = 0
  for (const hof of hoefe) {
    try {
      const konto = await stripe.accounts.retrieve(hof.stripeAccountId!)
      const stand = konto.capabilities?.eps_payments as EpsStand
      if (!brauchtEpsNachforderung(stand)) {
        if (epsKasseBereit(stand)) {
          console.log(`${hof.id}: EPS aktiv`)
        } else {
          nichtBereit += 1
          console.log(`${hof.id}: EPS nicht aktiv (${stand}) – Kasse im Hofpreis-Modell scheitert; Hof muss im Stripe-Konto Angaben nachreichen`)
        }
        continue
      }
      nichtBereit += 1
      if (!ausfuehren) {
        console.log(`${hof.id}: würde nachfordern`)
        continue
      }
      // Idempotenzschlüssel je Konto: Ein Neustart des Skripts fordert nicht doppelt an.
      await stripe.accounts.update(hof.stripeAccountId!, { capabilities: { eps_payments: { requested: true } } }, { idempotencyKey: `eps-nachfordern-${hof.id}` })
      nachgefordert += 1
      console.log(`${hof.id}: nachgefordert`)
    } catch (err) {
      nichtBereit += 1
      console.log(`${hof.id}: nicht möglich (${err instanceof Error ? err.name : 'Fehler'})`)
    }
  }
  console.log(ausfuehren ? `Fertig: ${nachgefordert} von ${hoefe.length} Konten nachgefordert.` : `Nur gelesen: ${hoefe.length} Konten. Mit --ausfuehren nachfordern.`)
  // Ein frisch angeforderter Stand ist meist noch nicht aktiv — erneut starten, bis alles „EPS aktiv“ zeigt.
  console.log(nichtBereit === 0 ? 'Alle Konten: EPS aktiv.' : `${nichtBereit} Konten noch nicht bereit für EPS im Hofpreis-Modell.`)
  await prisma.$disconnect()
  if (nichtBereit > 0) process.exitCode = 1
}

// Nur beim direkten Start laufen — der Test liest die reine Regel oben.
if (process.argv[1]?.endsWith('eps-faehigkeit-nachfordern.ts')) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.name : 'Fehler')
    process.exit(1)
  })
}
