/**
 * Ladeansicht der öffentlichen Infoseiten — Impressum, Konditionen,
 * Datenschutz. Sie teilen eine Form: Kopfleiste (56 px, ab md 64 px), Spalte
 * max. 672 px (px-4, oben 32 px, ab md 40 px), Überschrift, ein Absatz, Text.
 *
 * Warum ein gemeinsamer Fallback und keine Datei je Seite: Next.js nimmt
 * diese Ansicht nur dort, wo kein näheres `loading.tsx` liegt — Hofseite,
 * Hofübersicht, Kasse, Bestätigung und Bestellverfolgung bringen ihre eigene
 * mit. Übrig bleiben die Seiten, die sich im Aufbau gleichen, und eine
 * künftige Infoseite ist damit von Anfang an abgedeckt.
 *
 * Seit Nr. 54 stehen Impressum und Konditionen in der KundeShell — die
 * Ansicht setzt deshalb den Marker data-design="neu" selbst
 * (sie kommt vor der Shell) und nimmt deren Kopf (Fläche wie der Seitengrund).
 * Der Datenschutz folgt mit Nr. 57.
 *
 * „Problem melden" wartet als einzige wirklich auf den Server (sie prüft die
 * Sitzung, um einen eingeloggten Hof zu erkennen) und bringt seit Nr. 54 eine
 * eigene Ansicht in der Form ihrer Karte mit; die übrigen sind statisch und
 * zeigen diese Ansicht höchstens beim Wechsel.
 */
export default function InfoseiteLaden() {
  return (
    <div data-design="neu" className="min-h-dvh animate-pulse bg-background" aria-busy="true" aria-label="Seite wird geladen">
      <div className="h-14 border-b border-border bg-background md:h-16" />

      <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-12 md:pt-10">
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
