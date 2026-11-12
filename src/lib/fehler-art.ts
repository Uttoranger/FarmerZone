/** Ein kurzes Kennwort: Buchstaben, Ziffern, Punkt, Strich, Unterstrich — keine Adresse, kein Leerzeichen. */
const KENNWORT = /^[A-Za-z0-9._-]{1,40}$/

/**
 * Die Art eines Fehlers für das Log (Nr. 288) — Name der Klasse, dazu der
 * `code`, wenn er ein kurzes Kennwort ist (z. B. „PrismaClientKnownRequestError
 * P2002“, „StripeCardError card_declined“). Nie die Meldung: Prisma- und
 * Stripe-Meldungen können Adressen, Werte aus der Anfrage oder Teile von SQL
 * tragen, und das Log liest jeder mit Zugang zu Vercel. Den ganzen Fehler
 * bekommt Sentry (dort filtert `bereinigeFehlerEreignis`). Muster wie das Log
 * „nur die Art des Fehlers“ in src/lib/auth.ts.
 */
export function fehlerArt(err: unknown): string {
  if (!(err instanceof Error)) return 'Unbekannt'
  // Manche SDKs (Stripe) lassen `name` auf „Error“; die Klasse nennt dann der Konstruktor.
  const klasse = err.name === 'Error' ? err.constructor.name : err.name
  const name = KENNWORT.test(klasse) ? klasse : 'Error'
  const code: unknown = (err as { code?: unknown }).code
  return typeof code === 'string' && KENNWORT.test(code) ? `${name} ${code}` : name
}

