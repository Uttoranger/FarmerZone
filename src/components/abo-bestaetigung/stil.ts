import { cn } from '@/lib/utils'
import { TEXTLINK } from '@/components/anmelden/stil'

/*
 * Formen der Seite „Anmeldung bestätigen“ (/account/neuigkeiten-bestaetigen), die Seite und Karte teilen. Eigene
 * Datei ohne 'use client': Ein Wert aus einer Client-Datei käme in der Server-Seite nur als Verweis an.
 */

/** „Zu <Hof>“ als Textlink in 15 px (Board s2-/w2-neuigkeiten Bild 2 und 3; Wortliste N42 c; Nr. 279). */
export const ZU_HOF_LINK = cn(TEXTLINK, 'text-[15px]')
