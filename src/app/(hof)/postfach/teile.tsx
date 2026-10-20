import type { ReactNode } from 'react'
import Link from 'next/link'
import { Sprout } from 'lucide-react'
import { Marke } from '@/components/ui/marke'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { ADMIN_POSTFACH_TEXT, POSTFACH_TEXT, type FadenEintrag, type FadenZeile, type Seite } from '@/lib/postfach'
import { cn } from '@/lib/utils'

/*
 * Die Bausteine des Postfachs (Register N12, Nachtlauf Nr. 87; Mockups
 * mobil-h6-postfach, mobil-h6-unterhaltung, admin-postfach): Rahmen, das
 * Zeichen des Teams, eine Zeile der Liste und der Faden als Blasen. Nur
 * Anzeige — was ungelesen, wichtig oder gelesen ist, entscheiden die Regeln
 * in src/lib/postfach.ts. Nachrichtentexte stehen nur als Text-Kinder da,
 * nie als Markup; lange Wörter brechen um (break-words).
 *
 * Der Faden (FadenVerlauf) gilt für Hof und Admin: Die eigene Seite steht
 * rechts. Er liegt hier, weil Nr. 87 nur unter src/app/(hof)/postfach und
 * src/app/admin/postfach neue Dateien anlegt; das Admin-Postfach bindet ihn
 * von hier ein (Bericht 87, Nacharbeit: nach src/components ziehen).
 */

/** Liste und Faden: eine Spalte bis 760 px (Mockups mobil-h6-*), am Handy 16 px Rand. */
export const POSTFACH_RAHMEN = 'mx-auto w-full max-w-[760px] px-4 pt-5 pb-12 md:px-8 md:pt-7'

/** Das Zeichen des Teams: ein Keimling auf heller Fläche (die Bildmarke steht für die Plattform). */
export function TeamZeichen({ groesse = 'mittel' }: { groesse?: 'klein' | 'mittel' }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/12',
        groesse === 'klein' ? 'size-8' : 'size-10'
      )}
    >
      <Sprout className={cn('text-brand-text', groesse === 'klein' ? 'size-4' : 'size-5')} strokeWidth={1.9} />
    </span>
  )
}

/** Eine Zeile der Liste beim Hof: Absender, wann, Marke Wichtig und Titel, „Du hast geantwortet · …", Punkt bei Ungelesenem. */
export function PostfachZeile({ zeile }: { zeile: FadenZeile }): React.JSX.Element {
  return (
    <Link
      href={zeile.href}
      className={cn('flex min-h-11 items-start gap-3 px-4 py-3 transition-colors duration-[250ms] hover:bg-muted', FOKUS_RAHMEN)}
    >
      <TeamZeichen />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn('truncate text-[15px] text-foreground', zeile.ungelesen ? 'font-semibold' : 'font-medium')}>{POSTFACH_TEXT.absender}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{zeile.wann}</span>
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
          {zeile.wichtig && (
            <Marke art="tun" className="shrink-0">
              {POSTFACH_TEXT.wichtig}
            </Marke>
          )}
          <span
            className={cn('truncate text-[13.5px]', zeile.ungelesen ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}
            title={zeile.titel}
          >
            {zeile.titel}
          </span>
        </span>
        {zeile.eigeneAntwort && (
          <span className="mt-1.5 flex max-w-full">
            <span className="truncate rounded-full border border-border bg-muted px-2 py-0.5 text-[11.5px] text-foreground">
              {POSTFACH_TEXT.duHastGeantwortet} · {zeile.eigeneAntwort}
            </span>
          </span>
        )}
      </span>
      {zeile.ungelesen ? (
        <span className="mt-1.5 size-[9px] shrink-0 rounded-full bg-primary">
          <span className="sr-only">{POSTFACH_TEXT.ungelesenSr}</span>
        </span>
      ) : (
        <span aria-hidden="true" className="w-[9px] shrink-0" />
      )}
    </Link>
  )
}

/** Der Knopf zum Link einer Nachricht — 44 px Trefferfläche (Mockup 36 px, Regel „Tippflächen ≥ 44 px"). */
function LinkKnopf({ href }: { href: string }): React.JSX.Element {
  return (
    <Link
      href={href}
      className={cn(
        'mt-2 inline-flex min-h-11 items-center rounded-xl bg-accent px-3.5 text-[13.5px] font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90',
        FOKUS_RAHMEN
      )}
    >
      {POSTFACH_TEXT.linkKnopf}
    </Link>
  )
}

/**
 * Der Faden als Blasen, älteste zuerst, mit Tageszeilen. Die eigene Seite
 * (`seite`) steht rechts: beim Hof seine Antworten (gefüllt, „· gelesen", wenn
 * das Team sie gelesen hat), beim Admin die des Teams („· du"). Die erste
 * Nachricht vom Team (das Rundschreiben) trägt Absender, Marke und `fussErste`.
 */
export function FadenVerlauf({
  eintraege,
  seite,
  fussErste,
  nameAndereSeite,
}: {
  eintraege: readonly FadenEintrag[]
  seite: Seite
  /** Unter der ersten Nachricht vom Team, z. B. „Wichtig · auch per E-Mail". */
  fussErste: string | null
  /** Unter den Nachrichten der anderen Seite neben der Uhrzeit (Hof: das Team; Admin: nichts). */
  nameAndereSeite: string | null
}): React.JSX.Element {
  const ersteVomTeam = eintraege.find((e) => e.art === 'nachricht' && e.vomTeam)
  return (
    <ol className="flex flex-col gap-2.5">
      {eintraege.map((e) => {
        if (e.art === 'tag') {
          return (
            <li key={e.schluessel} className="self-center pt-1 text-[11.5px] text-muted-foreground">
              {e.text}
            </li>
          )
        }
        const eigene = seite === 'TEAM' ? e.vomTeam : !e.vomTeam
        const istErste = ersteVomTeam !== undefined && ersteVomTeam.art === 'nachricht' && e.id === ersteVomTeam.id
        const fuss: ReactNode[] = [e.uhrzeit]
        if (eigene) {
          if (seite === 'TEAM') fuss.push(ADMIN_POSTFACH_TEXT.du)
          // Die erste Nachricht sagt „gelesen" schon in ihrer Fußzeile (fussErste) — nicht zweimal.
          if (e.gelesen && !(istErste && fussErste)) fuss.push(POSTFACH_TEXT.gelesenVomTeam)
        } else if (nameAndereSeite && !istErste) {
          fuss.push(nameAndereSeite)
        }
        return (
          <li key={e.id} className={cn('flex max-w-[min(100%,34rem)] flex-col', eigene ? 'self-end' : 'self-start')}>
            <div
              className={cn(
                'rounded-2xl px-3 py-2.5',
                istErste
                  ? 'border border-accent/60 bg-card text-foreground'
                  : eigene && seite === 'HOF'
                    ? 'bg-accent text-accent-foreground'
                    : 'border border-border bg-card text-foreground'
              )}
            >
              {(istErste || e.wichtig) && (
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  {istErste && (
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-brand-text">
                      <Sprout className="size-3.5" strokeWidth={2} aria-hidden="true" />
                      {POSTFACH_TEXT.absender}
                    </span>
                  )}
                  {e.wichtig && <Marke art="tun">{POSTFACH_TEXT.wichtig}</Marke>}
                </div>
              )}
              <p className="text-sm leading-relaxed break-words whitespace-pre-line">{e.text}</p>
              {e.link && <LinkKnopf href={e.link} />}
              {istErste && fussErste && <p className="mt-1.5 text-[11px] text-muted-foreground">{fussErste}</p>}
            </div>
            <p
              className={cn(
                'mt-1 px-1 text-[11px] text-muted-foreground',
                eigene ? 'text-right' : 'text-left'
              )}
            >
              {fuss.join(' · ')}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
