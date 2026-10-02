import { z } from 'zod'
import { EMAIL_MAX, ZU_LANG } from '@/lib/eingabegrenzen'

/**
 * Eine E-Mail-Adresse, wie sie gespeichert wird: ohne Ränder, klein
 * geschrieben, höchstens 254 Zeichen. Klein, weil Postgres genau vergleicht —
 * „Max@…" und „max@…" wären sonst zwei Kunden — und weil Better Auth
 * (Anmeldelink, Registrierung) Adressen ohnehin klein speichert. Die Meldung
 * für ein ungültiges Format bringt jedes Formular selbst mit.
 */
export function emailSchema(meldung?: string): z.ZodString {
  return z.string().trim().toLowerCase().max(EMAIL_MAX, ZU_LANG.email).email(meldung)
}
