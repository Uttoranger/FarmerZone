import { z } from 'zod'

/**
 * Der Bestätigungs-Token einer Barbestellung — aus der Adresse
 * (/{hof}/bestaetigen/{token}, /api/orders/confirm/{token}) und aus dem
 * Formular der Knöpfe (CODING_STANDARDS §3: URL-Parameter und Formulardaten
 * durch Zod). Der Checkout erzeugt ihn mit nanoid(32); das Schema prüft nur
 * die Form, damit offensichtlich Kaputtes nie die Datenbank erreicht. Ob er
 * gilt, sagt allein die Datenbank.
 */
export const barBestaetigungsTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/)

export type BarBestaetigungsToken = z.infer<typeof barBestaetigungsTokenSchema>
