/**
 * Ladeansicht von „Das war ich nicht" (Nr. 114): Die Seite liest den Link aus
 * der Datenbank. Form der Seite in der KundeShell (Kopfleiste 56 px, ab md
 * 64 px), ohne Unterleiste.
 */
export default function NichtIchLaden(): React.JSX.Element {
  return (
    <div data-design="neu" className="min-h-dvh bg-background">
      <div className="h-14 border-b border-border bg-card md:h-16" />
      <div className="mx-auto w-full max-w-[480px] animate-pulse px-4 pt-6 pb-12 md:pt-12" aria-busy="true">
        <div className="mb-4 size-10 rounded-xl bg-muted" />
        <div className="mb-3 h-7 w-56 rounded-lg bg-border" />
        <div className="mb-2 h-4 w-full rounded bg-app-trough" />
        <div className="mb-6 h-4 w-2/3 rounded bg-app-trough" />
        <div className="h-12 rounded-full bg-muted" />
      </div>
    </div>
  )
}
