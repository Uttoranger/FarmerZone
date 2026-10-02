import { KasseSkelett } from '@/components/checkout/kasse-skelett'

/**
 * Ladeansicht der Kasse: Wartezeit auf die HOFDATEN (Abholzeiten,
 * Zahlungswege, Servicegebühr). Die Karten darunter sind dieselben, die das
 * Formular zeigt, während es im Browser auf den Warenkorb wartet — zwischen
 * den beiden Wartezeiten springt deshalb nichts (src/components/checkout/
 * kasse-skelett.tsx).
 *
 * Die Kopfleiste baut diese Datei selbst nach: Auf der Kasse rendert sie erst
 * die CheckoutForm, es gibt also kein Layout, das sie hielte. Ab md kommt die
 * Rückweg-Zeile („‹ Zum Hof") dazu — ohne sie rutschte der ganze Inhalt am
 * Browser um ihre Höhe nach oben.
 */
export default function CheckoutLaden() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-14 border-b border-border bg-card md:h-16" />
      <div className="hidden animate-pulse md:block" aria-hidden="true">
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <div className="h-5 w-24 rounded bg-app-chip" />
        </div>
      </div>

      <KasseSkelett />
    </div>
  )
}
