'use client'

import { toast } from 'sonner'
import { buildShareData } from '@/lib/customer-links'
import { browserTeilen, teileOderKopiere } from '@/lib/teilen'

/**
 * Die Hofseite teilen — EIN Weg für die Knöpfe der Kopfzeile und der
 * Aktionsleiste. Geteilt wird immer die nackte Hofseite, ohne Bereich:
 * Wer den Link bekommt, soll den ganzen Hof sehen.
 */
export async function teileHof(hof: { name: string; slug: string }): Promise<void> {
  const url = `${window.location.origin}/${hof.slug}`
  const ausgang = await teileOderKopiere(buildShareData(hof.name, url), browserTeilen())
  if (ausgang === 'kopiert') toast.success('Link kopiert')
  if (ausgang === 'fehlgeschlagen') toast.error('Link konnte nicht kopiert werden')
}
