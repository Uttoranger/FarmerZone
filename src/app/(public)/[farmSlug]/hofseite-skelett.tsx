import { stehtNurAmHandy } from '@/lib/hofseite-kunde'
import { cn } from '@/lib/utils'

/**
 * Skelett der Hofseite (neues Design seit Nr. 10, Aufbau seit Nr. 235 nach den
 * Boards w1-/s1-hofseite) — Platzhalter in der Form des fertigen Inhalts
 * (DESIGN_SYSTEM, „Zustände": Skeleton in Kartenform, kein Spinner). Maße von der
 * KundeShell und src/components/hofseite/hofseite-kunde.tsx abgenommen: Kopfzeile
 * 56/64 px, am Handy die Hofzeile 48 px; Inhalt höchstens 1 152 px, ab 1024 px zwei
 * Spalten von oben an (rechts 360 px, Abstand 64 px). Links das Titelbild als
 * gerundete Fläche (98 px, ab md 170 px — die Höhe ohne Foto; ein Foto wächst in der
 * Seite auf die Höhen aus Register N13), Logo, Name, Anschrift, drei Knöpfe, Reiter
 * und die Produkte (am Handy eine Karte mit Zeilen, ab md drei Kacheln); unter lg
 * danach Spalte und Über uns (Register N5), ab lg die Spalte rechts.
 *
 * Seit Nr. 117 keine `loading.tsx` mehr, sondern die Suspense-Grenze IN der
 * Seite, NACH der Prüfung des Hofs: Mit einer Ladeansicht davor streamte Next
 * das Skelett zuerst, und ein `notFound()` kam mit Status 200 hinterher. Jetzt
 * antwortet eine unbekannte Adresse mit 404, bevor das Skelett hinausgeht.
 *
 * Die Seite steht in der KundeShell und damit im Geltungsbereich
 * data-design="neu" — dieses Skelett steht vor der Shell und setzt den Marker
 * deshalb selbst, sonst blitzten beim Umschalten die alten Farben auf.
 *
 * BEWUSST OHNE Pausen-Hinweis, Fotos, „Aktuell vom Hof“ und Mini-Warenkorb: Ob es
 * sie gibt, entscheiden die Daten; Platz, in den nichts einrückt, ließe die Seite
 * springen.
 */
export function HofseiteSkelett(): React.JSX.Element {
  return (
    <div data-design="neu" className="min-h-dvh animate-pulse bg-background" aria-busy="true" aria-label="Hofseite wird geladen">
      <div className="h-14 border-b border-border bg-background md:h-16" />
      {/* Die Hofzeile am Handy */}
      <div className="flex h-12 items-center gap-2 px-4 md:hidden">
        <div className="h-4 w-40 rounded bg-border" />
      </div>

      <div className="mx-auto flex max-w-[1152px] flex-col gap-3 px-4 pt-4 pb-28 md:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-x-16">
        <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
          <div className="h-[98px] rounded-2xl border border-border bg-muted md:h-[170px]" />
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="size-14 shrink-0 rounded-full bg-border" />
                <div className="h-8 w-48 rounded-lg bg-border" />
              </div>
              <div className="h-4 w-56 rounded bg-app-chip" />
            </div>
            <div className="flex gap-2">
              <div className="h-11 w-24 rounded-xl border border-border" />
              <div className="h-11 w-24 rounded-xl border border-border" />
              <div className="h-11 w-28 rounded-xl border border-border" />
            </div>
          </div>
          <div className="flex h-11 border-b border-border">
            <div className="flex flex-1 items-center justify-center">
              <div className="h-4 w-20 rounded bg-border" />
            </div>
            <div className="flex flex-1 items-center justify-center">
              <div className="h-4 w-24 rounded bg-app-chip" />
            </div>
          </div>
          <div className="mt-1 h-4 w-24 rounded bg-app-chip" />
          {/* Am Handy vier Zeilen in einer Karte, ab md drei Kacheln (stehtNurAmHandy). */}
          <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card md:grid md:grid-cols-3 md:gap-3 md:divide-y-0 md:border-0 md:bg-transparent">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn('flex items-center gap-3 px-2.5 py-2 md:flex-col md:items-stretch md:gap-1.5 md:rounded-2xl md:border md:border-border md:bg-card md:p-2.5', stehtNurAmHandy(i) && 'md:hidden')}>
                <div className="size-14 shrink-0 rounded-xl bg-muted md:h-24 md:w-full md:rounded-[10px]" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-3/4 rounded bg-app-trough" />
                  <div className="mt-2 h-4 w-1/3 rounded bg-app-chip" />
                </div>
                <div className="size-11 shrink-0 rounded-full border border-border md:h-11 md:w-full md:rounded-xl" />
              </div>
            ))}
          </div>
          {/* „Alle Produkte (n)" — nur unter lg. */}
          <div className="h-11 rounded-[14px] border border-border lg:hidden" />
        </div>

        {/* Die Spalte: Nächste Abholung und Zahlung & Kontakt als Karten mit Überzeile. */}
        <div className="flex flex-col gap-3 lg:col-start-2 lg:row-start-1">
          {[0, 1].map((karte) => (
            <div key={karte} className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-3.5 py-3">
              <div className="h-3.5 w-32 rounded bg-app-trough" />
              <div className="h-4 w-48 rounded bg-app-chip" />
              <div className="h-4 w-40 rounded bg-app-chip" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
