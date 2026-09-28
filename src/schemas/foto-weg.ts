import { z } from 'zod'

/**
 * Der gemerkte Foto-Weg im localStorage (src/lib/foto-weg-speicher.ts). Er ist
 * Fremddaten (CODING_STANDARDS §3): Jeder kann ihn im Browser ändern, und ein
 * alter oder kaputter Stand darf die Fotoauswahl nie blockieren. Gemerkt
 * werden nur die zwei Auswahlwege — die Kamera ist keine Wahl zwischen Wegen.
 */
export const fotoWegSchema = z.enum(['galerie', 'dateien'])
