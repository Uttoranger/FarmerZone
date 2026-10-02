/**
 * Ladeansicht der Hofseite — Platzhalter in der Form des fertigen Inhalts
 * (DESIGN_SYSTEM, „Zustände": Skeleton in Kartenform, kein Spinner).
 *
 * Die Maße sind von der echten Seite abgenommen (src/components/farm/
 * farm-page-view.tsx), damit beim Umschalten nichts springt: Kopfleiste 56 px
 * (ab md 64), Titelbild-Band 260 px (ab md 33vw, ab lg 40vw, höchstens 420),
 * Aktionsleiste 68 px, Reiterleiste ~45 px, Inhaltsspalte max. 960 px,
 * Produktkacheln mit fester Bildfläche von 170 px.
 *
 * Die Kopfleiste ist hier ein Platzhalter, nicht die echte `KundenKopf`: Die
 * trägt den Hofnamen und die Rückweg-Logik und bräuchte Daten, die es in
 * diesem Moment noch nicht gibt. Gleiche Höhe, gleicher Rahmen, ruhig.
 */
export default function HofseiteLaden() {
  return (
    <div className="min-h-screen animate-pulse bg-app-page" aria-busy="true" aria-label="Hofseite wird geladen">
      {/* Kopfleiste; ab md darunter die Rückweg-Zeile („‹ Alle Höfe") */}
      <div className="h-14 border-b border-border bg-card md:h-16" />
      <div className="hidden md:block" aria-hidden="true">
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <div className="h-5 w-24 rounded bg-app-chip" />
        </div>
      </div>

      {/* Titelbild-Band mit Namensblock */}
      <div className="relative max-h-[420px] h-[260px] w-full bg-muted md:h-[33vw] lg:h-[40vw]">
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-[960px] px-4 pb-5 md:px-10">
            <div className="flex items-center gap-3">
              <div className="size-14 rounded-full bg-muted-foreground/20 md:size-[72px]" />
              <div className="h-8 w-52 rounded-lg bg-muted-foreground/20 md:h-9 md:w-72" />
            </div>
            <div className="mt-2 flex gap-2">
              <div className="h-[26px] w-20 rounded-2xl bg-muted-foreground/20" />
              <div className="h-[26px] w-24 rounded-2xl bg-muted-foreground/20" />
            </div>
            <div className="mt-1.5 h-4 w-44 rounded bg-muted-foreground/20" />
          </div>
        </div>
      </div>

      {/* Aktionsleiste: Anrufen · Anfahrt · Teilen */}
      <div className="border-b border-border bg-card px-4 py-3.5 md:px-10">
        <div className="mx-auto flex max-w-[960px] justify-end gap-2">
          <div className="h-10 w-24 rounded-lg bg-muted" />
          <div className="h-10 w-24 rounded-lg bg-muted" />
          <div className="h-10 w-10 rounded-lg bg-muted" />
        </div>
      </div>

      {/* Reiterleiste */}
      <div className="border-b border-border bg-card px-4 md:px-10">
        <div className="mx-auto flex max-w-[960px] gap-[26px] pt-[13px] pb-[14px]">
          <div className="h-4 w-20 rounded bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-4 w-20 rounded bg-muted" />
        </div>
      </div>

      <div className="mx-auto max-w-[960px] px-4 pt-[26px] pb-12 md:px-10">
        {/* Karte „Nächste Abholung" */}
        <div className="mb-[18px] rounded-[14px] bg-card dark:ring-1 dark:ring-border p-[18px]">
          <div className="mb-3 h-4 w-40 rounded bg-app-trough" />
          <div className="flex gap-2">
            <div className="h-14 flex-1 rounded-[10px] bg-muted" />
            <div className="h-14 flex-1 rounded-[10px] bg-muted" />
            <div className="h-14 flex-1 rounded-[10px] bg-muted" />
          </div>
        </div>

        {/* Karte „Zahlung & Kontakt" — oben die Holzleiste, 7 px */}
        <div className="overflow-hidden rounded-[14px] bg-card dark:ring-1 dark:ring-border">
          <div className="h-[7px] bg-app-trough" />
          <div className="px-5 pt-[18px] pb-5">
            <div className="h-4 w-44 rounded bg-app-trough" />
            <div className="mt-3.5 flex gap-2">
              <div className="h-8 w-28 rounded-full bg-app-chip" />
              <div className="h-8 w-24 rounded-full bg-app-chip" />
            </div>
            <div className="mt-4 h-4 w-40 rounded bg-app-chip" />
            <div className="mt-2 h-4 w-52 rounded bg-app-chip" />
          </div>
        </div>

        {/* Produktkopf */}
        <div className="mt-[34px] mb-[18px] flex items-baseline gap-3">
          <div className="h-7 w-48 rounded-lg bg-border" />
          <div className="h-4 w-20 rounded bg-app-chip" />
        </div>

        {/* Produktraster — Bildfläche 170 px wie im echten Raster */}
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="overflow-hidden rounded-[12px] bg-card dark:ring-1 dark:ring-border">
              {/* Bildfläche wie im echten Raster: feste 170 px auf --app-chip */}
              <div className="h-[170px] bg-app-chip" />
              <div className="p-3">
                <div className="h-4 w-3/4 rounded bg-app-trough" />
                <div className="mt-2 h-3 w-1/2 rounded bg-app-chip" />
                <div className="mt-3 h-9 w-full rounded-lg bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
