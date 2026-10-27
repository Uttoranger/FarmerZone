import { adminHofHref } from '@/lib/admin-hof-akte'
import { bestellungenHref } from '@/lib/admin-bestellung'
import type { EingangAuswahl } from '@/lib/postfach'

/**
 * Ein alter Link auf eine Aufgabe des Eingangs (`?id=hof-…`, `?id=erstattung-…`
 * aus Mails und Lesezeichen) führt seit Nr. 193 (N32) dorthin, wo die Aufgabe
 * jetzt erledigt wird: der wartende Hof in seine Akte (Freischalten), die
 * offene Erstattung in Admin › Bestellungen („Außerhalb erstattet“).
 */
export function alteAufgabeAdresse(auswahl: EingangAuswahl | null): string | null {
  if (auswahl?.art === 'hof') return adminHofHref(auswahl.id)
  if (auswahl?.art === 'erstattung') return bestellungenHref({}, { bestellung: auswahl.id })
  return null
}
