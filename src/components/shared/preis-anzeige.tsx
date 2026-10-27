'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { PreisAnzeige } from '@/lib/plattformgebuehr'

/**
 * Die Preisanzeige eines Hofs für alle Preise darunter (Register N38, Nr. 197):
 * im Hofpreis-Modell der Satz der Plattformgebühr — dann zeigen Karten, Korb
 * und Produktseite den Endpreis „inkl. Plattformgebühr“ (`mitEndpreis`) —,
 * sonst null und alles wie bisher. Gesetzt einmal je Hof (Hofseite,
 * Produktseite), damit nicht jede Karte den Satz als Eigenschaft durchreicht.
 * Ohne Rahmen gilt null: Die Vorschau im Produktdialog des Hofs zeigt den
 * Warenpreis, wie er eingetragen ist.
 */
const PreisAnzeigeKontext = createContext<PreisAnzeige>(null)

export function PreisAnzeigeRahmen({ anzeige, children }: { anzeige: PreisAnzeige; children: ReactNode }): React.JSX.Element {
  return <PreisAnzeigeKontext.Provider value={anzeige}>{children}</PreisAnzeigeKontext.Provider>
}

/** Der Satz der Plattformgebühr dieses Hofs oder null (Modell `bisher`). */
export function usePreisAnzeige(): PreisAnzeige {
  return useContext(PreisAnzeigeKontext)
}
