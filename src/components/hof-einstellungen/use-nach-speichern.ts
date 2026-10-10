'use client'

import { useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { GESPEICHERT_TEXT, zielNachSpeichern } from '@/lib/bauern-navigation'

/**
 * Was nach erfolgreichem Speichern passiert (Nachtlauf Nr. 44, Register N1):
 * Auf einer Einstellungs-Unterseite der Toast „Gespeichert" und zurück zur
 * Übersicht — der Hof steht nach dem Speichern sonst am Ende eines langen
 * Formulars, und der Weg zurück ist weggescrollt. Wohin, entscheidet
 * `zielNachSpeichern` aus dem Pfad: Abholzeiten bleibt, und derselbe Baustein
 * im Hofseiten-Editor (/farm-page) bleibt mit seiner bisherigen Meldung.
 *
 * Nur im Erfolgsfall aufrufen — bei einem Fehler bleibt die Seite mit der
 * Meldung stehen, die Eingaben sind noch da.
 */
export function useNachSpeichern(): (sonst: string, zusatz?: string) => void {
  const pfad = usePathname()
  const router = useRouter()
  return useCallback(
    (sonst: string, zusatz?: string) => {
      const ziel = zielNachSpeichern(pfad)
      const optionen = zusatz ? { description: zusatz } : undefined
      if (!ziel) {
        toast.success(sonst, optionen)
        return
      }
      toast.success(GESPEICHERT_TEXT, optionen)
      router.push(ziel)
    },
    [pfad, router]
  )
}
