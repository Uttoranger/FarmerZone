import { z } from 'zod'
import { STATUS_POST_ANLASS_VALUES } from '@/schemas/status-post'

/**
 * `?anlass=` für „Neuer Beitrag“ (Register E12, Nr. 129: der Anstoß in Heute
 * verlinkt `/status/new?anlass=<ANLASS>`). Systemgrenze: nur ein Anlass aus der
 * Liste der Beiträge (STATUS_POST_ANLASS_VALUES, dieselbe wie BEITRAG_ANLAESSE in
 * src/lib/beitrag-anlass.ts), alles andere wird still verworfen (`null`) — wie
 * ein unbekannter Reiter auf der Hofseite.
 */
export const anlassParameterSchema = z.enum(STATUS_POST_ANLASS_VALUES).nullable().catch(null)
