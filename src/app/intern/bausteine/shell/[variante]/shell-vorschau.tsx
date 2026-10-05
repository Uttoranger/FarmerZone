'use client'

import Link from 'next/link'
import { CalendarCheck, Package, Share2 } from 'lucide-react'
import { HofShell } from '@/components/shells/hof-shell'
import { KundeFokusShell, KundeShell } from '@/components/shells/kunde-shell'
import { AdminShell } from '@/components/shells/admin-shell'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { ListGruppe, ListRow } from '@/components/ui/list-row'
import { ProgressBar } from '@/components/ui/progress-bar'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'
import type { ShellVariante } from './varianten'

/*
 * Erfundener Inhalt für die Shell-Vorschau — nur so viel, dass man sieht, wie
 * eine Seite in der Shell sitzt (Abstände, Scrollen hinter Kopf und Leiste).
 * Alle Namen sind Platzhalter (TESTING_GUIDELINES §5).
 */

function ZurueckZurVorschau() {
  return (
    <Link
      href="/intern/bausteine"
      className={cn('inline-flex min-h-11 items-center rounded-full px-1 text-sm font-semibold text-brand-text underline-offset-4 hover:underline', FOKUS_RAHMEN)}
    >
      ‹ Zurück zu den Bausteinen
    </Link>
  )
}

/** In der Fokus-Shell ist der Kopftitel das h1 — dort steht der Seitentitel als h2. */
function Beispielinhalt({ titel, welt, unter = false }: { titel: string; welt: 'kunde' | 'hof' | 'admin'; unter?: boolean }) {
  const Titel = unter ? 'h2' : 'h1'
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-5 md:px-8 md:py-7">
      <ZurueckZurVorschau />
      <Titel className="font-heading text-2xl font-semibold md:text-[28px]">{titel}</Titel>
      {welt === 'hof' ? (
        <Hinweiskarte ton="orange" symbol={Share2} titel="Heute keine Abholung">
          Ein guter Tag, um deinen Hof zu teilen.
        </Hinweiskarte>
      ) : (
        <Hinweiskarte ton="gruen" titel="Beispielinhalt">
          Hier steht später der Inhalt der Seite. Kopf und Leisten gehören der Shell.
        </Hinweiskarte>
      )}
      <ListGruppe beschriftung="Beispielzeilen">
        {Array.from({ length: 8 }, (_, i) => (
          <ListRow
            key={i}
            titel={`Beispielzeile ${i + 1}`}
            untertitel="Erfundener Inhalt zum Scrollen"
            symbol={welt === 'hof' ? CalendarCheck : Package}
            ende={<StatusBadge status={i % 3 === 0 ? 'offen' : i % 3 === 1 ? 'fertig' : 'neutral'}>{i % 3 === 0 ? 'Offen' : i % 3 === 1 ? 'Gepackt' : 'Pausiert'}</StatusBadge>}
          />
        ))}
      </ListGruppe>
      <div className="rounded-2xl border border-border bg-card p-4">
        <ProgressBar beschriftung="Deine Hofseite" wert={64} />
      </div>
    </div>
  )
}

export function ShellVorschau({ variante }: { variante: ShellVariante }): React.JSX.Element {
  switch (variante) {
    case 'kunde':
      return (
        <KundeShell angemeldet={false}>
          <Beispielinhalt titel="Höfe in deiner Nähe" welt="kunde" />
        </KundeShell>
      )
    case 'kunde-angemeldet':
      return (
        <KundeShell angemeldet>
          <Beispielinhalt titel="Höfe in deiner Nähe" welt="kunde" />
        </KundeShell>
      )
    case 'kunde-fokus':
      return (
        <KundeFokusShell
          titel="Warenkorb"
          zurueck={{ href: '/intern/bausteine', label: 'Zurück zu den Bausteinen' }}
          rechts="Hof Beispiel"
          aktion={
            <button
              type="button"
              className={cn('h-[50px] w-full rounded-full bg-accent text-[15px] font-semibold text-accent-foreground hover:bg-accent-hover md:w-auto md:px-8', FOKUS_RAHMEN)}
            >
              Bestellen · € 12,40
            </button>
          }
        >
          <Beispielinhalt titel="Dein Korb bei Hof Beispiel" welt="kunde" unter />
        </KundeFokusShell>
      )
    case 'hof':
      return (
        <HofShell hofName="Hof Beispiel" hofSlug="hof-beispiel" personName="Max Mustermann" isAdmin zahlen={{ bestellungen: 3, admin: 5 }}>
          <Beispielinhalt titel="Heute" welt="hof" />
        </HofShell>
      )
    case 'admin':
      return (
        <AdminShell personName="Max Mustermann" zahlen={{ hoefe: 2, briefkasten: 3 }}>
          <Beispielinhalt titel="Höfe" welt="admin" />
        </AdminShell>
      )
  }
}
