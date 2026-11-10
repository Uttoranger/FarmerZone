import { cn } from '@/lib/utils'
import { WerkzeugKopfLaden } from '@/components/ui/werkzeug-kopf'
import { RUNDUNG } from '@/components/ui/rundung'

/*
 * Rahmen und Ladeansichten der Einstellungen (Nachtlauf Nr. 22d) — dieselben
 * Maße wie die fertigen Seiten, nur was sicher kommt. Farbstaffelung wie die
 * anderen Hof-Routen im neuen Design: bg-border für Überschriften, bg-muted
 * für Zweitzeilen und Flächen.
 */

/** Konditionen: bis 1000 px wie im Mockup, ab 1024 px zwei Spalten. */
export const EINSTELLUNGEN_RAHMEN = 'w-full max-w-[1000px] px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10'

/**
 * Übersicht: der Inhalt selbst 1000 px breit, das Polster kommt dazu (Board w1-einstellungen: `main` 1000 px
 * plus 40 px je Seite; Liste Lauf 32, einstellungen „Spalten schmaler“, Nr. 250) — vorher zählte das Polster
 * in die 1000 px, und die Spalten endeten 80 px zu früh.
 */
export const UEBERSICHT_RAHMEN = 'w-full max-w-[1064px] px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:max-w-[1080px] xl:px-10'

/**
 * Unterseiten: eine Spalte mit Formularen, der Inhalt selbst 672 px breit, das Polster kommt dazu (Boards
 * w2-konto-hof, -hofdaten-zahlung: `main` 672 px plus 40 px je Seite; Abnahme Lauf 32 „Spalte 605 px statt 671“,
 * Nr. 269) — vorher zählte das Polster in die 672 px (`max-w-2xl`). Die EINE Stelle der Spaltenbreite aller
 * Einstellungs-Unterseiten; 736 = 672 + 2 × 32 (md:px-8), 752 = 672 + 2 × 40 (xl:px-10).
 */
export const UNTERSEITE_RAHMEN = 'w-full max-w-[736px] px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:max-w-[752px] xl:px-10'

/** Der Satz unter dem Werkzeug-Kopf einer Unterseite (Boards s2-/w2-konto-hof, -hofdaten-zahlung; Nr. 250). */
export const UNTERSEITE_SATZ = 'mb-5 text-[15px] leading-relaxed text-muted-foreground md:mb-6 md:text-base'

export function EinstellungenLaden(): React.JSX.Element {
  return (
    <div className={cn(UEBERSICHT_RAHMEN, 'animate-pulse')} aria-busy="true">
      {/* Derselbe Kopf wie die fertige Übersicht (Werkzeug-Kopf, Nr. 245) — nichts springt beim Umschalten. */}
      <WerkzeugKopfLaden />
      <div className="h-4 w-64 max-w-full rounded bg-muted" />
      <div className="mt-4 flex flex-col md:grid md:gap-3 lg:grid-cols-2">
        {/* So viele Zeilen wie Bereiche (einstellungenBereiche, seit Nr. 30 neun). */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="flex h-[66px] items-center gap-3 border-t border-border md:h-[78px] md:rounded-2xl md:border md:bg-card md:px-[18px]"
          >
            <div className="flex-1">
              <div className="h-4 w-40 rounded bg-border" />
              <div className="mt-2 h-3 w-56 max-w-full rounded bg-muted" />
            </div>
            <div className="size-4 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function EinstellungenUnterseiteLaden(): React.JSX.Element {
  return (
    <div className={cn(UNTERSEITE_RAHMEN, 'animate-pulse')} aria-busy="true">
      {/* Derselbe Werkzeug-Kopf wie die fertigen Unterseiten (G1, Nr. 250), darunter der Satz. */}
      <WerkzeugKopfLaden />
      <div className="mb-5 h-4 w-72 max-w-full rounded bg-muted md:mb-6" />
      <div className="flex flex-col gap-4">
        <div className={cn('h-40 border border-border bg-card', RUNDUNG.karte)} />
        <div className={cn('h-56 border border-border bg-card', RUNDUNG.karte)} />
      </div>
    </div>
  )
}

export function KonditionenLaden(): React.JSX.Element {
  return (
    <div className={cn(EINSTELLUNGEN_RAHMEN, 'animate-pulse')} aria-busy="true">
      {/* Derselbe Werkzeug-Kopf wie die fertige Seite (G1, Nr. 278), darunter der Satz. */}
      <WerkzeugKopfLaden />
      <div className="mb-5 h-4 w-80 max-w-full rounded bg-muted md:mb-6" />
      <div className="h-16 rounded-2xl border border-border bg-card" />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="h-52 rounded-2xl border border-border bg-card" />
        <div className="h-52 rounded-2xl border border-border bg-card" />
      </div>
      <div className="mt-4 h-72 rounded-2xl border border-border bg-card" />
    </div>
  )
}
