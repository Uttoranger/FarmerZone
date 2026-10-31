/**
 * Je verarbeitetem Stripe-Typ ein gültiges und ein ungültiges Objekt
 * (erfundene Kennungen) — geteilt von tests/stripe-ereignis.test.ts (Schema)
 * und tests/webhook-ereignis-schema.test.ts (Route).
 */
import type { VerarbeiteterStripeTyp } from '@/schemas/stripe-ereignis'

/** Je Typ ein gültiges und ein ungültiges Objekt samt dem Feld, das fehlt oder falsch ist. */
export const BEISPIELE: Record<VerarbeiteterStripeTyp, { gueltig: Record<string, unknown>; ungueltig: Record<string, unknown>; feld: string }> = {
  'payment_intent.succeeded': {
    gueltig: { id: 'pi_1', object: 'payment_intent', amount: 2100, application_fee_amount: 100 },
    ungueltig: { object: 'payment_intent', application_fee_amount: 100 },
    feld: 'id',
  },
  'payment_intent.payment_failed': { gueltig: { id: 'pi_1', application_fee_amount: null }, ungueltig: { id: 42 }, feld: 'id' },
  'payment_intent.canceled': { gueltig: { id: 'pi_1' }, ungueltig: { id: '' }, feld: 'id' },
  'account.updated': { gueltig: { id: 'acct_1', charges_enabled: true }, ungueltig: { charges_enabled: true }, feld: 'id' },
  'refund.failed': {
    gueltig: { id: 're_1', amount: 2100, status: 'failed', failure_reason: 'expired_or_canceled_card', payment_intent: 'pi_1', metadata: { orderId: 'o_1' } },
    ungueltig: { id: 're_1', amount: '2100', status: 'failed', payment_intent: 'pi_1' },
    feld: 'amount',
  },
  'charge.refund.updated': {
    gueltig: { id: 're_1', amount: 500, status: 'succeeded', payment_intent: { id: 'pi_1' }, metadata: {}, created: 1_790_000_000 },
    ungueltig: { id: 're_1', amount: 500, payment_intent: 'pi_1' },
    feld: 'status',
  },
  'invoice.paid': { gueltig: { id: 'in_1' }, ungueltig: { id: null }, feld: 'id' },
  'invoice.payment_failed': { gueltig: { id: 'in_1', attempt_count: 2 }, ungueltig: { id: 'in_1', attempt_count: -1 }, feld: 'attempt_count' },
  'charge.dispute.created': { gueltig: { id: 'dp_1', payment_intent: 'pi_1' }, ungueltig: { id: 'dp_1' }, feld: 'payment_intent' },
  'setup_intent.succeeded': {
    gueltig: { id: 'seti_1', customer: 'cus_1', payment_method: 'pm_1', payment_method_types: ['sepa_debit'], metadata: { farmId: 'hof_1' } },
    ungueltig: { id: 'seti_1', customer: 'cus_1', payment_method: 'pm_1', payment_method_types: 'sepa_debit' },
    feld: 'payment_method_types',
  },
  'mandate.updated': { gueltig: { id: 'mandate_1', status: 'inactive', payment_method: 'pm_1' }, ungueltig: { id: 'mandate_1', status: 'inactive' }, feld: 'payment_method' },
}

