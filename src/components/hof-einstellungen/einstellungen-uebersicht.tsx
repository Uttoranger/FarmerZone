import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { HofUnterzeile } from '@/components/mein-hof/hof-unterzeile'
import { EINSTELLUNGEN_SATZ, EINSTELLUNGEN_TITEL, TON_TEXT, einstellungenGruppen, type EinstellungBereich, type EinstellungTon } from '@/lib/hof-einstellungen'
import { cn } from '@/lib/utils'
import { PROBLEM_MELDEN } from '@/lib/fehlerseite'

/** „Problem melden“ als Umriss über die volle Spalte, 52 px, 14 px rund (Board; volle Breite → kein Pill). */
const PROBLEM_MELDEN_KNOPF = cn(
  'mt-1 flex min-h-[52px] w-full items-center justify-center rounded-[14px] border-[1.5px] border-foreground bg-card px-4 text-[16px] font-bold text-foreground transition-colors duration-[250ms] hover:bg-muted',
  FOKUS_RAHMEN
)

/** Der Punkt neben dem Titel: Zustandsfarbe des Themes, grau = nur zur Info. */
const PUNKT: Record<EinstellungTon, string> = {
  fertig: 'bg-status-fertig',
  offen: 'bg-status-offen',
  neutral: 'bg-muted-foreground',
}

/**
 * Übersicht der Einstellungen (seit Nr. 224 nach den Boards s1-/w1-einstellungen;
 * vorher web-h1-einstellungen-uebersicht und mobil-h5-einstellungen). Was in
 * einem Bereich steht und welche Farbe sein Punkt hat, entscheidet
 * einstellungenBereiche (src/lib/hof-einstellungen.ts), die Gruppen „Dein Hof“
 * und „Konto“ einstellungenGruppen — hier nur die Gestalt.
 *
 * Je Gruppe eine Karte mit feinen Linien zwischen den Zeilen; ab 1024 px die
 * beiden Gruppen nebeneinander. Jede Zeile ist ganz ein Link (mindestens
 * 56 px); der Punkt (12 px) steht vor dem Titel, ist nur Farbe und deshalb
 * aria-hidden, seine Bedeutung steht als sr-only-Text dabei.
 */
export function EinstellungenUebersicht({
  bereiche,
  hofName,
  jetzt,
}: {
  bereiche: readonly EinstellungBereich[]
  /** Für die Zeile „<Hof> · Stand …“ unter der Überschrift (Board s1-/w1-einstellungen). */
  hofName: string
  jetzt: Date
}): React.JSX.Element {
  return (
    <div className="flex max-w-[1000px] flex-col gap-2.5">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[28px]">{EINSTELLUNGEN_TITEL}</h1>
        <HofUnterzeile hofName={hofName} jetzt={jetzt} />
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground md:text-base">{EINSTELLUNGEN_SATZ}</p>

      <div className="mt-1.5 grid items-start gap-4 lg:grid-cols-2">
        {einstellungenGruppen(bereiche).map((gruppe) => (
          <section key={gruppe.id} aria-labelledby={`einstellungen-${gruppe.id}`} className="flex min-w-0 flex-col gap-2.5">
            <h2 id={`einstellungen-${gruppe.id}`} className="mt-1 text-[13px] font-bold tracking-[0.04em] text-muted-foreground uppercase">
              {gruppe.titel}
            </h2>
            {/* 14 px rund wie das Board — `rounded-2xl` wüchse im neuen Design mit --radius. */}
            <ul className="overflow-hidden rounded-[14px] border border-border bg-card [&>li+li]:border-t [&>li+li]:border-border">
              {gruppe.bereiche.map((b) => (
                <li key={b.id}>
                  <Link
                    href={b.href}
                    className={cn(
                      'flex min-h-14 items-center gap-3 px-3 py-1.5 transition-colors duration-[250ms] hover:bg-muted',
                      FOKUS_RAHMEN_INNEN
                    )}
                  >
                    <span data-ton={b.ton} className={cn('size-3 shrink-0 rounded-full', PUNKT[b.ton])} aria-hidden="true" />
                    <span className="sr-only">{TON_TEXT[b.ton]}:</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-1.5">
                      <span className="text-[15px] font-semibold text-foreground">{b.titel}</span>
                      <span className="line-clamp-2 text-[13px] leading-normal break-words text-muted-foreground" title={b.zeile}>
                        {b.zeile}
                      </span>
                    </span>
                    <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            {/* Unter der Karte „Konto“ über die volle Spalte (Board s1-/w1-einstellungen); Abmelden steht in
                der Seitenleiste bzw. im Mehr-Blatt — hier nur der Weg zur Hilfe. */}
            {gruppe.id === 'konto' && (
              <Link href="/meldungen" className={PROBLEM_MELDEN_KNOPF}>
                {PROBLEM_MELDEN}
              </Link>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
