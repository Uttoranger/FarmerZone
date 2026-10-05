'use client'

import type { ReactNode } from 'react'
import { useSession } from '@/lib/auth-client'
import { istKundensitzung } from '@/lib/kunden-navigation'
import { KundeShell } from '@/components/shells/kunde-shell'

/**
 * Die KundeShell für statische Seiten: Die Sitzung liest der Browser
 * (useSession), nicht der Server. Liest eine Seite die Sitzung auf dem Server
 * (headers()), wird sie dynamisch — jeder Besuch startet dann eine
 * Serverless-Funktion, und Kopf und Standbild warten darauf. Auf der
 * Startseite war das der Preis nur für „Anmelden" ↔ „Mein Konto".
 *
 * Solange die Sitzung lädt, steht die Shell abgemeldet da — genau das HTML,
 * das der Server statisch ausliefert; angemeldete Kundinnen sehen „Mein
 * Konto" einen Augenblick später. Als angemeldet zählt nur die
 * Kunden-Anmeldung (istKundensitzung).
 */
export function KundeShellMitSitzung({ children }: { children: ReactNode }): React.JSX.Element {
  const { data } = useSession()
  // Die Rolle ist ein Zusatzfeld (src/lib/auth.ts), das der Sitzungs-Client
  // nicht im Typ kennt — sie steht aber in der Antwort.
  const nutzer = data?.user
  const rolle = nutzer && 'role' in nutzer && typeof nutzer.role === 'string' ? nutzer.role : null
  return <KundeShell angemeldet={istKundensitzung({ role: rolle })}>{children}</KundeShell>
}
