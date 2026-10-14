import { UnterseitenKopfLaden } from '@/components/hofbereich/hof-laden'
import { POSTFACH_RAHMEN } from '../teile'

/** Ladeansicht eines Fadens (Nachtlauf Nr. 87) — Kopf, drei Blasen, das Antwortfeld. */
export default function FadenLaden(): React.JSX.Element {
  return (
    <div className={POSTFACH_RAHMEN}>
      <UnterseitenKopfLaden mitTitel={false} />
      <div className="flex animate-pulse flex-col gap-3" aria-busy="true">
        <div className="mb-2 flex items-start gap-3">
          <div className="size-10 shrink-0 rounded-full bg-muted" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-7 w-3/4 max-w-sm rounded-lg bg-border" />
            <div className="h-3.5 w-48 rounded bg-app-chip" />
          </div>
        </div>
        <div className="h-32 w-[85%] max-w-[34rem] self-start rounded-2xl bg-muted" />
        <div className="h-14 w-2/3 max-w-[26rem] self-end rounded-2xl bg-app-trough" />
        <div className="h-[46px] rounded-[14px] bg-muted" />
      </div>
    </div>
  )
}
