import { KasseSkelett } from '@/components/checkout/kasse-skelett'

/**
 * Ladeansicht der Kasse: Wartezeit auf die HOFDATEN (Abholzeiten,
 * Zahlungswege, Servicegebühr). Die Karten darunter sind dieselben, die das
 * Formular zeigt, während es im Browser auf den Warenkorb wartet — zwischen
 * den beiden Wartezeiten springt deshalb nichts (src/components/checkout/
 * kasse-skelett.tsx).
 *
 * Seit Nr. 12 steht die Kasse in der Fokus-Shell: deren Kopf (Zurück, Titel,
 * Hofname) ist 52 px hoch, ab md 64 px — der Platzhalter hat genau diese Maße
 * und den Marker des neuen Designs, damit die Tokens dieselben sind.
 */
export default function CheckoutLaden() {
  return (
    <div data-design="neu" className="min-h-dvh bg-background">
      <div className="h-[52px] border-b border-border bg-background md:h-16" aria-hidden="true">
        <div className="mx-auto flex h-full max-w-[1200px] animate-pulse items-center gap-3 px-3.5 md:px-8">
          <div className="size-6 rounded-full bg-app-chip" />
          <div className="h-5 w-28 rounded bg-border" />
        </div>
      </div>
      <KasseSkelett />
    </div>
  )
}
