import { MEIN_HOF_KOPF_HUELLE } from '@/components/mein-hof/mein-hof-kopf'
import { cn } from '@/lib/utils'

/**
 * Der Kopf von Mein Hof am Handy als Skelett (Nr. 143) — dieselben Maße wie
 * MeinHofKopf: Streifen 76 px, Zustandszeile mit Platz für zwei Satzzeilen
 * (70 px), Reiter 48 px. Für /farm-page (hier) und /products/loading.tsx, damit
 * die Reiter beim Laden dort stehen, wo sie danach stehen.
 */
export function MeinHofKopfLaden({ aktiv }: { aktiv: 'produkte' | 'hofseite' }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="h-[76px] rounded-2xl bg-muted" />
      <div className="flex min-h-[70px] items-center gap-3 rounded-[14px] border border-border bg-card py-2 pr-2 pl-3.5">
        <div className="size-[9px] shrink-0 rounded-full bg-border" />
        <div className="flex-1">
          <div className="h-4 w-40 rounded bg-border" />
          <div className="mt-2 h-3 w-48 rounded bg-muted" />
        </div>
        <div className="h-11 w-28 rounded-full bg-muted" />
      </div>
      {/* Reiter — „Produkte" nur unter md */}
      <div className="mt-1 flex h-12 items-center gap-7 border-b border-border">
        <div className={cn('h-4 w-16 rounded md:hidden', aktiv === 'produkte' ? 'bg-border' : 'bg-muted')} />
        <div className={cn('h-4 w-16 rounded', aktiv === 'hofseite' ? 'bg-border' : 'bg-muted')} />
        <div className="h-4 w-20 rounded bg-muted" />
      </div>
    </div>
  )
}

/*
 * Ladeansicht von „Mein Hof" (Nachtlauf Nr. 16). Seit Nr. 127 hat /farm-page keine
 * eigene loading.tsx mehr (Ladepunkt statt Skelett beim Wechsel der Reiter, wie
 * Postfach und Bestellungen); das Skelett lebt hier weiter für die Routen, die nur
 * in Mein Hof umleiten (/status, /settings/appearance), und steht dort für die Form
 * des Ziels (ARCHITECTURE §4). Die HofShell steht durch
 * das Layout, gewartet wird nur auf den Inhalt. Gleiche Maße wie die
 * fertige Seite: Kopf (unter lg der Kopf am Handy aus Nr. 143, ab lg Zeile
 * 80 px mit Reitern 48 px), unter lg direkt darunter die Liste „Bearbeiten"
 * (Nr. 143: Stand als Zeile, dann Gruppen nach dem Ort auf der Seite — die
 * Zahl der offenen Punkte hängt von den Daten ab, darum die Form bei 100 %),
 * ab lg Liste links (Gruppen mit sieben und vier Zeilen) und Vorschau rechts
 * (320 px, ab xl 360 px). Nur, was sicher kommt — die Balken (Freigabe,
 * stillgelegt) stehen im Layout.
 *
 * Farbstaffelung im neuen Design: bg-border für Überschriften, bg-muted für
 * Zweitzeilen und Flächen (die Bestandspalette --app-* gilt hier nicht).
 */
export function MeinHofLaden(): React.JSX.Element {
  return (
    <div className="animate-pulse" aria-busy="true">
      <div className={MEIN_HOF_KOPF_HUELLE}>
        {/* Kopf: unter lg der Kopf am Handy */}
        <div className="lg:hidden">
          <MeinHofKopfLaden aktiv="hofseite" />
        </div>
        {/* Kopf: ab lg Zeile, darunter die Reiter */}
        <div className="hidden lg:mb-6 lg:block">
          <div className="flex h-20 items-center gap-4 rounded-2xl border border-border bg-card px-5">
            <div className="size-12 rounded-full bg-border" />
            <div className="flex-1">
              <div className="h-5 w-48 rounded bg-border" />
              <div className="mt-2 h-3.5 w-56 rounded bg-muted" />
            </div>
            <div className="h-11 w-28 rounded-full bg-muted" />
            <div className="h-11 w-36 rounded-full bg-muted" />
          </div>
          <div className="mt-4 flex h-12 items-center gap-7 border-b border-border">
            <div className="h-4 w-16 rounded bg-border" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
        </div>
      </div>

      {/* Unter lg: Liste „Bearbeiten" — Stand, dann die Gruppen nach dem Ort auf der Seite */}
      <div className="mx-auto flex max-w-3xl flex-col gap-2.5 px-4 pt-5 pb-12 md:px-8 lg:hidden">
        <div className="h-12 rounded-[14px] border border-border bg-card" />
        {[5, 2, 3, 2].map((zeilen, gruppe) => (
          <div key={gruppe}>
            <div className="mx-1 mt-3.5 mb-2 h-3 w-36 rounded bg-muted" />
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {Array.from({ length: zeilen }, (_, i) => (
                <div key={i} className="flex min-h-14 items-center gap-2.5 border-t border-border py-2 pr-2.5 pl-3.5 first:border-t-0">
                  <div className="flex-1">
                    <div className="h-3.5 w-32 rounded bg-border" />
                    <div className="mt-2 h-3 w-48 rounded bg-muted" />
                  </div>
                  <div className="size-4 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Ab lg: Liste und Vorschau */}
      <div className="hidden gap-6 px-8 pb-12 lg:flex xl:gap-8">
        <div className="min-w-0 flex-1 space-y-6">
          <div className="h-[116px] rounded-2xl border border-border bg-card p-5">
            <div className="h-5 w-72 rounded bg-border" />
            <div className="mt-4 h-2 w-full rounded-full bg-muted" />
            <div className="mt-4 h-3.5 w-56 rounded bg-muted" />
          </div>
          {[7, 4].map((zeilen, gruppe) => (
            <div key={gruppe}>
              <div className="h-3 w-28 rounded bg-muted" />
              <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
                {Array.from({ length: zeilen }, (_, i) => (
                  <div key={i} className="flex min-h-14 items-center gap-3 border-t border-border px-4 py-3 first:border-t-0">
                    <div className="size-9 rounded-[10px] bg-muted" />
                    <div className="flex-1">
                      <div className="h-3.5 w-32 rounded bg-border" />
                      <div className="mt-1.5 h-3 w-48 rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="w-[320px] shrink-0 xl:w-[360px]">
          <div className="flex h-11 items-center justify-between">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-11 w-36 rounded-full bg-muted" />
          </div>
          <div className="mx-auto mt-2 h-[680px] w-[320px] rounded-[2.4rem] bg-muted" />
        </div>
      </div>
    </div>
  )
}
