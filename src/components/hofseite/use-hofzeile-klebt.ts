import { useSyncExternalStore } from 'react'
import { hofzeileSteht } from '@/lib/hofseite-orientierung'

/** Abonnement für useSyncExternalStore: Scrollen und Größenänderung des Fensters. */
function beiScrollen(melde: () => void): () => void {
  window.addEventListener('scroll', melde, { passive: true })
  window.addEventListener('resize', melde)
  return () => {
    window.removeEventListener('scroll', melde)
    window.removeEventListener('resize', melde)
  }
}

/**
 * Klebt der Block der Hofzeile schon unter dem Seitenkopf (Nr. 195)? Dann ist
 * das Zurück der Hofzeile da, und der Knopf im Titelbild geht weg. Gelesen wird
 * die Lage im Fenster; auf dem Server, beim Hydrieren und vor der Messung des
 * Blocks (`null`) gilt „klebt noch nicht“ — der Knopf steht im Server-HTML.
 */
export function useHofzeileKlebt(block: HTMLElement | null): boolean {
  return useSyncExternalStore(
    beiScrollen,
    () => (block ? hofzeileSteht(block.getBoundingClientRect().top, document.querySelector('header')?.getBoundingClientRect().height ?? 0) : false),
    () => false
  )
}
