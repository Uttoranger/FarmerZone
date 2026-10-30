import { z } from 'zod'

/*
 * Stripe-Ereignisse, die der Webhook (POST /api/stripe/webhook) verarbeitet
 * (Nachtlauf Nr. 203): je Typ die Felder, die die Behandlung liest — nicht
 * mehr. Die Signatur beweist nur, dass das Ereignis von Stripe kommt, nicht,
 * dass es die Form hat, die der Code erwartet (neue API-Version, Testereignis
 * aus dem Dashboard). Ohne Prüfung liefe ein fehlendes Feld als `undefined`
 * in eine Abfrage oder eine Erstattung. Unbekannte Felder lässt Zod durch —
 * Stripe ergänzt laufend welche, das ist kein Fehler.
 */

/** Längste angenommene Kennung — Stripe-Kennungen sind kurz; mehr ist kein Stripe-Objekt. */
const KENNUNG_MAX = 255

const kennungSchema = z.string().min(1).max(KENNUNG_MAX)
/** Ein Verweis: Kennung oder, ausgeklappt (`expand`), das Objekt mit Kennung. */
const verweisSchema = z.union([kennungSchema, z.object({ id: kennungSchema })])
const metadataSchema = z.record(z.string(), z.string())
const centSchema = z.number().int().nonnegative()

/** payment_intent.* — Kennung; die Gebühr nur für die Erstattung einer verspäteten Zahlung. */
const zahlungSchema = z.object({ id: kennungSchema, application_fee_amount: centSchema.nullish() })

/** account.updated — der Stand selbst wird bei Stripe nachgelesen, gebraucht wird nur die Kennung. */
const kontoSchema = z.object({ id: kennungSchema })

/** refund.failed, charge.refund.updated — src/server/erstattung-gescheitert.ts und das Löschen von „Erstattung offen“. */
const erstattungSchema = z.object({
  id: kennungSchema,
  amount: centSchema,
  status: z.string().max(50).nullable(),
  payment_intent: verweisSchema.nullish(),
  metadata: metadataSchema.nullish(),
  failure_reason: z.string().max(100).nullish(),
  // Fehlt der Zeitpunkt, löscht die Behandlung keine offene Erstattung (sie prüft ihn selbst).
  created: z.number().int().optional(),
})

/** invoice.paid, invoice.payment_failed — Monatsabrechnung (N38). */
const rechnungSchema = z.object({ id: kennungSchema, attempt_count: z.number().int().nonnegative().nullish() })

/** charge.dispute.created — die Zahlung führt zur Rechnung. */
const rueckbuchungSchema = z.object({ id: kennungSchema, payment_intent: verweisSchema.nullable() })

/** setup_intent.succeeded — Lastschrift-Mandat des Hofs. */
const einrichtungSchema = z.object({
  id: kennungSchema,
  payment_method_types: z.array(z.string().max(50)),
  customer: verweisSchema.nullable(),
  payment_method: verweisSchema.nullable(),
  metadata: metadataSchema.nullish(),
})

/** mandate.updated — nur „inactive“ ändert etwas. */
const mandatSchema = z.object({ id: kennungSchema, status: z.string().max(50), payment_method: verweisSchema })

/**
 * Die verarbeiteten Typen (Liste aus Nachtlauf 26 plus `account.updated`) und
 * ihr Schema für `event.data.object`. Ein Typ, der hier fehlt, wird nicht
 * verarbeitet — wie bisher, 200 ohne Wirkung.
 */
export const STRIPE_EREIGNIS_SCHEMAS = {
  'payment_intent.succeeded': zahlungSchema,
  'payment_intent.payment_failed': zahlungSchema,
  'payment_intent.canceled': zahlungSchema,
  'account.updated': kontoSchema,
  'refund.failed': erstattungSchema,
  'charge.refund.updated': erstattungSchema,
  'invoice.paid': rechnungSchema,
  'invoice.payment_failed': rechnungSchema,
  'charge.dispute.created': rueckbuchungSchema,
  'setup_intent.succeeded': einrichtungSchema,
  'mandate.updated': mandatSchema,
} as const

export type VerarbeiteterStripeTyp = keyof typeof STRIPE_EREIGNIS_SCHEMAS

export function istVerarbeiteterStripeTyp(typ: string): typ is VerarbeiteterStripeTyp {
  return Object.hasOwn(STRIPE_EREIGNIS_SCHEMAS, typ)
}

export type StripeObjektPruefung = { ok: true } | { ok: false; felder: string[] }

/**
 * Prüft `event.data.object` gegen das Schema des Typs. Bei einem Fehler nur
 * die Pfade der Felder (z. B. `amount`, `payment_intent`) — nie Werte und nie
 * Zods Meldungstext, denn das Ergebnis geht an Sentry und ins Protokoll, und
 * Metadaten oder Kennungen gehören dort nicht hin.
 */
export function pruefeStripeObjekt(typ: VerarbeiteterStripeTyp, objekt: unknown): StripeObjektPruefung {
  const ergebnis = STRIPE_EREIGNIS_SCHEMAS[typ].safeParse(objekt)
  if (ergebnis.success) return { ok: true }
  const felder = ergebnis.error.issues.map((f) => (f.path.length > 0 ? f.path.map(String).join('.') : '(Objekt)'))
  return { ok: false, felder: [...new Set(felder)].slice(0, 10) }
}
