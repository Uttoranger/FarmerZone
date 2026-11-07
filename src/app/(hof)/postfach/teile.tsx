import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, Sprout } from 'lucide-react'
import { Marke } from '@/components/ui/marke'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { ADMIN_POSTFACH_TEXT, POSTFACH_TEXT, type FadenEintrag, type FadenZeile, type Seite } from '@/lib/postfach'
import { seiteName } from '@/lib/hof-hilfe'
import { RUNDUNG } from '@/components/ui/rundung'
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
export const POSTFACH_RAHMEN = 'w-full max-w-[760px] px-4 pt-5 pb-12 md:px-8 md:pt-7'

/** Das Zeichen des Teams: ein grünes Quadrat mit Keimling (Liste Lauf 32 postfach: „Grünes Quadrat“ statt rund). */
export function TeamZeichen({ groesse = 'mittel' }: { groesse?: 'klein' | 'mittel' }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center rounded-[10px] bg-accent', groesse === 'klein' ? 'size-8' : 'size-10')}
    >
      <Sprout className={cn('text-accent-foreground', groesse === 'klein' ? 'size-4' : 'size-5')} strokeWidth={1.9} />
    </span>
  )
}

/**
 * Eine Zeile der Liste beim Hof (Board s2-/w2-postfach Bild 1): Kopfzeile „Absender · wann (· Wichtig)“,
 * darunter der Betreff fett und mehrzeilig, „Du hast geantwortet · …“ als graue Unterzeile, Punkt bei
 * Ungelesenem und „›“.
 */
export function PostfachZeile({ zeile }: { zeile: FadenZeile }): React.JSX.Element {
  return (
    <Link
      href={zeile.href}
      className={cn('flex min-h-11 items-center gap-3 px-4 py-3 transition-colors duration-[250ms] hover:bg-muted', FOKUS_RAHMEN)}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted-foreground">
          <span>
            {POSTFACH_TEXT.absender} · {zeile.wann}
          </span>
          {zeile.wichtig && (
            <>
              <span aria-hidden="true">·</span>
              <Marke art="tun" className="shrink-0">
                {POSTFACH_TEXT.wichtig}
              </Marke>
            </>
          )}
        </span>
        <span className={cn('text-[15px] leading-snug break-words text-foreground', zeile.ungelesen ? 'font-bold' : 'font-semibold')}>
          {zeile.titel}
        </span>
        {zeile.eigeneAntwort && (
          <span className="truncate text-[13px] text-muted-foreground">
            {POSTFACH_TEXT.duHastGeantwortet} · {zeile.eigeneAntwort}
          </span>
        )}
      </span>
      {zeile.ungelesen && (
        <span className="size-[9px] shrink-0 rounded-full bg-primary">
          <span className="sr-only">{POSTFACH_TEXT.ungelesenSr}</span>
        </span>
      )}
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
    </Link>
  )
}

/**
 * Der Text des Knopfs zum Link einer Nachricht: das Ziel beim Namen („Verkäufe ansehen“, Liste Lauf 32
 * postfach), aus derselben Zuordnung Route → Name wie „Das schicken wir automatisch mit“ (`seiteName`).
 * Ohne Treffer bleibt „Ansehen“.
 */
export function linkKnopfText(href: string): string {
  const name = seiteName(href)
  return name.startsWith('/') || name === '–' ? POSTFACH_TEXT.linkKnopf : `${name} ansehen`
}

/** Der Knopf zum Link einer Nachricht — 44 px, Umriss-Pille wie im Board s2/w2-postfach (V51: im Hofbereich kein grüner Knopf). */
function LinkKnopf({ href }: { href: string }): React.JSX.Element {
  return (
    <Link
      href={href}
      className={cn(
        'mt-2 inline-flex min-h-11 items-center rounded-full border border-input bg-card px-4 text-[14px] font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted',
        FOKUS_RAHMEN
      )}
    >
      {linkKnopfText(href)}
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
            <li key={e.schluessel} className="self-center pt-1 text-xs text-muted-foreground">
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
        // Beim Hof steht die Uhrzeit in der Blase („8:10 · auch per E-Mail“, Board s2-/w2-postfach); der Admin wie bisher darunter.
        const fussInBlase = seite === 'HOF'
        const fussText = istErste && fussErste && fussInBlase ? [...fuss, fussErste].join(' · ') : fuss.join(' · ')
        return (
          <li key={e.id} className={cn('flex max-w-[min(100%,34rem)] flex-col', eigene ? 'self-end' : 'self-start')}>
            <div
              className={cn(
                'px-3 py-2.5',
                RUNDUNG.karte,
                istErste
                  ? 'border border-accent/60 bg-card text-foreground'
                  : eigene && seite === 'HOF'
                    ? // Zart grün getönt, dunkle Schrift (Liste Lauf 32 postfach).
                      'bg-zustand-laeuft-grund text-foreground'
                    : 'border border-border bg-card text-foreground'
              )}
            >
              {(istErste || e.wichtig) && (
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  {istErste && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-text">
                      <Sprout className="size-3.5" strokeWidth={2} aria-hidden="true" />
                      {POSTFACH_TEXT.absender}
                    </span>
                  )}
                  {e.wichtig && <Marke art="tun">{POSTFACH_TEXT.wichtig}</Marke>}
                </div>
              )}
              <p className="text-sm leading-relaxed break-words whitespace-pre-line">{e.text}</p>
              {e.link && <LinkKnopf href={e.link} />}
              {!fussInBlase && istErste && fussErste && <p className="mt-1.5 text-xs text-muted-foreground">{fussErste}</p>}
              {fussInBlase && <p className="mt-1.5 text-xs text-muted-foreground">{fussText}</p>}
            </div>
            {!fussInBlase && (
              <p className={cn('mt-1 px-1 text-xs text-muted-foreground', eigene ? 'text-right' : 'text-left')}>{fussText}</p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
