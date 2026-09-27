import { z } from 'zod'

/**
 * Die Verlaufseinträge dieses Tabs, die durch Hinaufsteigen erreicht wurden
 * (Schlüssel der Navigation API, src/components/shared/rueckweg-merker.tsx).
 * Liegt im sessionStorage — Fremddaten wie jeder Browser-Speicher: Was nicht
 * passt, gilt als leer.
 */
export const hinaufEintraegeSchema = z.array(z.string().min(1).max(100)).max(50).catch([])
