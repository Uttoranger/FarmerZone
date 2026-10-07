/*
 * Ladeansichten im Hofbereich für Routen ohne eigenes Bauteil (Nachtlauf
 * Nr. 31): der Rückfall der Routengruppe (hof) und die beiden Unterseiten der
 * Beiträge. Die HofShell steht durch das Layout, gewartet wird nur auf den
 * Inhalt. Gleiche Maße wie die fertigen Seiten; nur, was sicher kommt.
 * Farbstaffelung im neuen Design: bg-border für Überschriften, bg-muted für
 * Zweitzeilen und Flächen (DESIGN_SYSTEM „Ladeansicht einer Route").
 */

/** Der Rückweg „‹ …" (ZurueckLink): 44 px hoch, 8 px Abstand darunter. */
function ZurueckPlatzhalter({ breite }: { breite: string }): React.JSX.Element {
  return (
    <div className="mb-2 flex min-h-11 items-center">
      <div className={`h-4 rounded bg-muted ${breite}`} />
    </div>
  )
}

/**
 * Rückfall der Gruppe (hof) — für eine Route, die (noch) keine eigene
 * Ladeansicht hat. Die Form der meisten Hof-Seiten: Kopf (h1 und eine Zeile),
 * darunter drei Karten in der Breite der Seiten (max-w-6xl).
 */
export function HofSeiteLaden(): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10" aria-busy="true">
      <div className="flex flex-col gap-4 md:gap-5">
        <div>
          <div className="h-8 w-40 rounded-lg bg-border md:h-9" />
          <div className="mt-2 h-4 w-60 rounded bg-muted" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 md:p-5">
            <div className="h-4 w-40 rounded bg-border" />
            <div className="mt-3 h-3 w-full rounded bg-muted" />
            <div className="mt-2 h-3 w-2/3 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * „Neuer Beitrag" (/status/new): Rückweg, darunter die Karte des ersten
 * Schritts — Stepper, Überschrift, vier Anlässe (2 × 2), Titel, Nachricht
 * (fünf Zeilen), Foto-Knopf und „Weiter zu Empfängern".
 */
export function BeitragNeuLaden(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-5 pb-12 md:px-8 md:pt-7">
      <div className="animate-pulse" aria-busy="true">
        <ZurueckPlatzhalter breite="w-20" />
        <div className="rounded-2xl border border-border bg-card p-5 md:p-8">
          <div className="mb-7 flex items-start">
            {[0, 1, 2].map((i) => (
              <div key={i} className="contents">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="size-7 rounded-full bg-muted" />
                  <div className="h-[11px] w-12 rounded bg-muted" />
                </div>
                {i < 2 && <div className="mx-1 mt-3.5 h-0.5 flex-1 bg-border" />}
              </div>
            ))}
          </div>
          <div className="mb-6">
            <div className="h-7 w-40 rounded-lg bg-border" />
            <div className="mt-1 h-4 w-28 rounded bg-muted" />
          </div>
          <div className="mb-5">
            <div className="mb-2 h-4 w-16 rounded bg-muted" />
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-muted" />
              ))}
            </div>
          </div>
          <div className="mb-4">
            <div className="mb-1.5 h-4 w-14 rounded bg-muted" />
            <div className="h-11 rounded-xl bg-muted" />
          </div>
          <div className="mb-4">
            <div className="mb-1.5 h-4 w-20 rounded bg-muted" />
            <div className="h-[122px] rounded-xl bg-muted" />
            <div className="mt-1 h-3 w-3/4 rounded bg-muted" />
          </div>
          <div className="mb-5 h-11 w-36 rounded-lg bg-muted" />
          <div className="h-12 rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  )
}

/**
 * „WhatsApp versenden" (/status/[id]/send-whatsapp): Rückweg, Überschrift,
 * der Beitrag als Vorschau, der Fortschritt und drei Zeilen der Abonnentinnen.
 */
export function WhatsAppVersandLaden(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-xl px-4 pt-5 pb-12 md:px-8 md:pt-7">
      <div className="animate-pulse" aria-busy="true">
        <ZurueckPlatzhalter breite="w-32" />
        <div className="mb-5">
          <div className="h-8 w-52 rounded-lg bg-border" />
          <div className="mt-1 h-4 w-full max-w-sm rounded bg-muted" />
        </div>
        <div className="mb-4 h-[76px] rounded-xl bg-muted" />
        <div className="mb-5">
          <div className="mb-2 flex justify-between">
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
          <div className="h-2 rounded-full bg-muted" />
        </div>
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="size-9 shrink-0 rounded-full bg-muted" />
              <div className="min-w-0 flex-1">
                <div className="h-4 w-32 rounded bg-border" />
                <div className="mt-1.5 h-3 w-24 rounded bg-muted" />
              </div>
              <div className="h-11 w-24 shrink-0 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
