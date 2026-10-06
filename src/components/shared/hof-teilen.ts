'use client'

import { toast } from 'sonner'
import { buildShareData } from '@/lib/customer-links'
import { browserTeilen, teileOderKopiere } from '@/lib/teilen'

/**
 * Die Hofseite teilen — EIN Weg für die Knöpfe der Kopfzeile und der
 * Aktionsleiste. Geteilt wird immer die nackte Hofseite, ohne Bereich:
 * Wer den Link bekommt, soll den ganzen Hof sehen.
 */
export async function teileHof(
  hof: { name: string; slug: string },
  /** Ein eigener Satz statt des Standardtexts (Moment „wieder da", Nr. 18) — der Link bleibt die Hofseite. */
  optionen: { text?: string } = {}
): Promise<void> {
  const url = `${window.location.origin}/${hof.slug}`
  const daten = buildShareData(hof.name, url)
  const ausgang = await teileOderKopiere(optionen.text ? { ...daten, text: optionen.text } : daten, browserTeilen())
  if (ausgang === 'kopiert') toast.success('Link kopiert')
  if (ausgang === 'fehlgeschlagen') toast.error('Link konnte nicht kopiert werden')
}
