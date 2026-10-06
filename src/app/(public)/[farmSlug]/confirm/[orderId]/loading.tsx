/**
 * Ladeansicht der Bestellbestätigung (Nr. 13). Maße aus
 * src/app/(public)/[farmSlug]/confirm/[orderId]/page.tsx und der KundeShell:
 * Kopfzeile 56/64 px, Spalte max. 640 px, px-4, pt-8/pt-10, Abstand 16 px;
 * darin Zeichen und Überschrift, die Karte mit den Status-Schritten und die
 * Karte mit Positionen und Summe.
 *
 * Diese Wartezeit ist die heikelste der Kundenseiten: Wer gerade bezahlt hat,
 * schaut auf diese Seite und will wissen, ob es geklappt hat. Ein leerer
 * Bildschirm an dieser Stelle liest sich wie ein verlorener Auftrag — deshalb
 * stehen die Karten von Anfang an da, nur noch ohne Inhalt.
 *
 * BEWUSST OHNE Abholkarte, Frist-Hinweis und „Erzähl's weiter": Ob es sie
 * gibt, entscheidet der Zustand der Bestellung. Die Seite steht im
 * Geltungsbereich data-design="neu"; diese Ansicht kommt vor der Shell und
 * setzt den Marker selbst.
 */
export default function BestaetigungLaden() {
  return (
    <div
      data-design="neu"
      className="min-h-dvh animate-pulse bg-background"
      aria-busy="true"
      aria-label="Bestellbestätigung wird geladen"
    >
      <div className="h-14 border-b border-border bg-background md:h-16" />

      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 pt-8 pb-12 md:pt-10">
        {/* Zeichen, Überschrift, Satz */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="size-16 rounded-full bg-muted" />
          <div className="h-8 w-64 rounded-lg bg-border" />
          <div className="h-4 w-72 max-w-full rounded bg-app-chip" />
        </div>

        {/* Status-Schritte */}
        <div className="grid grid-cols-4 gap-1 rounded-2xl border border-border bg-card px-4 py-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="size-6 rounded-full bg-app-trough" />
              <div className="h-3.5 w-14 rounded bg-app-trough" />
              <div className="h-3 w-12 rounded bg-app-chip" />
            </div>
          ))}
        </div>

        {/* Positionen und Summe */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4">
          <div className="flex justify-between">
            <div className="h-4 w-40 rounded bg-app-chip" />
            <div className="h-4 w-14 rounded bg-app-chip" />
          </div>
          <div className="flex justify-between">
            <div className="h-4 w-32 rounded bg-app-chip" />
            <div className="h-4 w-14 rounded bg-app-chip" />
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between">
            <div className="h-5 w-36 rounded bg-app-trough" />
            <div className="h-5 w-20 rounded bg-app-trough" />
          </div>
        </div>

        <div className="mx-auto h-11 w-48 rounded-full bg-muted" />
      </main>
    </div>
  )
}
