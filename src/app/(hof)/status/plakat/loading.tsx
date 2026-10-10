import { UnterseitenKopfLaden } from '@/components/hofbereich/hof-laden'

/** Ladeansicht des QR-Plakats: Unterseiten-Kopf, Titel und ein A4-Blatt in Kartenform (DESIGN_SYSTEM „Ladeansicht"). */
export default function PlakatLaden(): React.JSX.Element {
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-4xl animate-pulse px-4 pt-5 pb-12 md:px-8 md:pt-8">
      <UnterseitenKopfLaden mitTitel={false} />
      <div className="mb-2 h-8 w-40 rounded-lg bg-border" />
      <div className="mb-5 h-4 w-72 max-w-full rounded bg-app-trough" />
      <div className="mx-auto aspect-[210/297] w-full max-w-[794px] rounded-2xl bg-muted" />
    </div>
  )
}
