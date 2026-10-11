/**
 * Ladeansicht der Bestellseite („Wo ist meine Bestellung?"). Maße aus
 * src/app/(public)/[farmSlug]/bestellung/[orderId]/page.tsx: Kopf der
 * KundeShell (56 px, ab md 64 px), Spalte max. 640 px (px-4 pt-8, ab md
 * pt-10), darin Kopf mit Bestellnummer, Abholkarte und Positionen. Die
 * Seite steht im Geltungsbereich data-design="neu"; diese Ansicht kommt vor
 * der Shell und setzt den Marker selbst (wie „Meine Bestellungen").
 *
 * Diese Seite erreicht man über einen signierten Link aus der E-Mail, oft am
 * Handy und oft unterwegs — also genau dort, wo das Warten am längsten
 * dauert und ein leerer Bildschirm wie ein toter Link aussieht.
 *
 * Maßstab ist der gültige Link: Nur er wartet auf die Datenbank. Eine
 * ungültige Signatur antwortet ohne Abfrage, also sofort, und zeigt dieses
 * Skeleton kaum.
 */
export default function BestellungLaden() {
  return (
    <div
      data-design="neu"
      className="min-h-dvh animate-pulse bg-background"
      aria-busy="true"
      aria-label="Bestellung wird geladen"
    >
      <div className="h-14 border-b border-border bg-background md:h-16" />

      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 pt-8 pb-12 md:pt-10">
        {/* Kopf: Hof, Bestellnummer mit Marke, Satz */}
        <div className="flex flex-col gap-2">
          <div className="h-4 w-48 rounded bg-app-chip" />
          <div className="flex items-center justify-between gap-2">
            <div className="h-8 w-40 rounded-lg bg-border" />
            <div className="h-6 w-24 rounded-full bg-muted" />
          </div>
          <div className="h-4 w-full max-w-md rounded bg-app-trough" />
        </div>

        {/* Abholung */}
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px]">
          <div className="h-3 w-20 rounded bg-app-chip" />
          <div className="h-6 w-56 max-w-full rounded bg-app-trough" />
          <div className="h-4 w-32 rounded bg-app-chip" />
          <div className="h-4 w-60 max-w-full rounded bg-app-chip" />
          <div className="mt-2 h-11 w-52 rounded-full bg-muted" />
        </div>

        {/* Positionen */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px]">
          <div className="flex justify-between">
            <div className="h-4 w-36 rounded bg-app-chip" />
            <div className="h-4 w-14 rounded bg-app-chip" />
          </div>
          <div className="flex justify-between">
            <div className="h-4 w-28 rounded bg-app-chip" />
            <div className="h-4 w-14 rounded bg-app-chip" />
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between">
            <div className="h-5 w-32 rounded bg-app-trough" />
            <div className="h-5 w-16 rounded bg-app-trough" />
          </div>
        </div>
      </main>
    </div>
  )
}
