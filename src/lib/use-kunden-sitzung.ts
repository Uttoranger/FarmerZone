'use client'

import { useSession } from '@/lib/auth-client'
import { kundenSitzung, type KundenSitzung } from '@/lib/kunden-navigation'

/**
 * Die Sitzung, wie öffentliche Seiten sie sehen (kundenSitzung) — für die
 * KundeShell (über KundeShellMitSitzung) und für KundenKopf.
 *
 * Gelesen im Browser (useSession), nie auf dem Server: headers(), cookies()
 * oder auth.api machten eine statische Seite wie die Startseite dynamisch.
 * Solange die Sitzung lädt, gilt `gast` — genau das HTML, das der Server
 * ausliefert; „Mein Konto" bzw. „Mein Hof" erscheint einen Augenblick später.
 */
export function useKundenSitzung(): KundenSitzung {
  const { data } = useSession()
  // Die Rolle ist ein Zusatzfeld (src/lib/auth.ts), das der Sitzungs-Client
  // nicht im Typ kennt — sie steht aber in der Antwort.
  const nutzer = data?.user
  const rolle = nutzer && 'role' in nutzer && typeof nutzer.role === 'string' ? nutzer.role : null
  return kundenSitzung({ role: rolle })
}
