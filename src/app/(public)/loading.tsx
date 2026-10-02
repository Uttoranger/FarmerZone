/**
 * Ladeansicht der öffentlichen Infoseiten — Impressum, Konditionen,
 * Datenschutz, „Problem melden". Sie teilen eine Form: Kopfleiste,
 * Spalte max. 672 px (px-4 py-10), Überschrift, ein Absatz, Text.
 *
 * Warum ein gemeinsamer Fallback und keine Datei je Seite: Next.js nimmt
 * diese Ansicht nur dort, wo kein näheres `loading.tsx` liegt — Hofseite,
 * Hofübersicht, Kasse, Bestätigung und Bestellverfolgung bringen ihre eigene
 * mit. Übrig bleiben die Seiten, die sich im Aufbau gleichen, und eine
 * künftige Infoseite ist damit von Anfang an abgedeckt.
 *
 * Von diesen Seiten wartet heute nur „Problem melden" wirklich auf den Server
 * (sie prüft die Sitzung, um einen eingeloggten Hof zu erkennen); die
 * übrigen sind statisch und zeigen die Ansicht höchstens beim Wechsel.
 */
export default function InfoseiteLaden() {
  return (
    <div className="min-h-screen animate-pulse bg-background" aria-busy="true" aria-label="Seite wird geladen">
      <div className="h-14 border-b border-border bg-card md:h-16" />

      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="h-8 w-56 rounded-lg bg-border" />
        <div className="mt-2 h-4 w-full max-w-md rounded bg-app-trough" />

        <div className="mt-8 space-y-3">
          <div className="h-4 w-full rounded bg-app-chip" />
          <div className="h-4 w-full rounded bg-app-chip" />
          <div className="h-4 w-4/5 rounded bg-app-chip" />
        </div>

        <div className="mt-8 space-y-3">
          <div className="h-4 w-full rounded bg-app-chip" />
          <div className="h-4 w-3/4 rounded bg-app-chip" />
        </div>
      </main>
    </div>
  )
}
