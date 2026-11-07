import { WerkzeugKopfLaden } from '@/components/ui/werkzeug-kopf'
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'

/** Ladeansicht des QR-Plakats: Werkzeug-Kopf (G1, seit Nr. 250), Satz und ein A4-Blatt in Kartenform (DESIGN_SYSTEM „Ladeansicht"). */
export default function PlakatLaden(): React.JSX.Element {
  return (
    <div aria-busy="true" className="w-full max-w-4xl animate-pulse px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10">
      <WerkzeugKopfLaden />
      <div className="mb-5 h-4 w-72 max-w-full rounded bg-app-trough" />
      <div className={cn('mx-auto aspect-[210/297] w-full max-w-[420px] bg-muted md:mx-0', RUNDUNG.karte)} />
    </div>
  )
}
