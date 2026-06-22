import Stripe from 'stripe'

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {} as never)

  // Check the specific PI for HM-2206-E3CC
  const piId = 'pi_3TlDus2UFn5s7vSv1ki9mQU8'
  try {
    const pi = await stripe.paymentIntents.retrieve(piId)
    console.log(`\nPaymentIntent ${piId}:`)
    console.log(`  status: ${pi.status}`)
    console.log(`  amount: ${pi.amount / 100} EUR`)
    console.log(`  created: ${new Date(pi.created * 1000).toISOString()}`)
    console.log(`  cancelled_at: ${pi.canceled_at ? new Date(pi.canceled_at * 1000).toISOString() : 'none'}`)
  } catch (e) {
    console.error('Could not fetch PI:', e)
  }

  // Also list recent webhook events to diagnose
  const events = await stripe.events.list({ limit: 10, type: 'payment_intent.succeeded' })
  console.log(`\n=== Letzte payment_intent.succeeded Events ===`)
  for (const ev of events.data) {
    const obj = ev.data.object as Stripe.PaymentIntent
    console.log(`  ${ev.id} | pi=${obj.id} | ${new Date(ev.created * 1000).toISOString()}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
