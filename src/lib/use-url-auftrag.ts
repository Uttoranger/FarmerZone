'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { auftragsSchluessel, auftragsSchritt, leseAuftrag, ohneAuftrag, type UrlAuftrag } from '@/lib/url-auftrag'

/**
 * Führt einen Auftrag aus der Adresse genau einmal aus (src/lib/url-auftrag.ts)
 * und nimmt ihn danach aus der Adresse.
 *
 * Gelesen wird über useSearchParams, nicht über die searchParams der Seite:
 * Steht der Bauer schon auf /products und tippt „Produkt anlegen", bleibt die
 * Liste stehen, und nur die Adresse ändert sich — ein Startwert allein sähe
 * den zweiten Auftrag nie. Ausgeführt wird beim Rendern (Zustand an eine
 * geänderte Eingabe anpassen, ohne Effekt), entfernt im Effekt danach.
 */
export function useUrlAuftrag(ausfuehren: (auftrag: UrlAuftrag) => void): void {
  const auftrag = leseAuftrag(useSearchParams())
  const schluessel = auftragsSchluessel(auftrag)
  const [erledigt, setErledigt] = useState<string | null>(null)

  if (schluessel !== erledigt) {
    const schritt = auftragsSchritt(schluessel, erledigt)
    setErledigt(schritt.erledigt)
    if (schritt.ausfuehren && auftrag) ausfuehren(auftrag)
  }

  useEffect(() => {
    if (!schluessel) return
    const { pathname, search, hash } = window.location
    window.history.replaceState(null, '', ohneAuftrag(pathname, search, hash))
  }, [schluessel])
}
