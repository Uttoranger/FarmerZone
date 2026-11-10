/**
 * Ladeansicht der Bestellseite („Wo ist meine Bestellung?"). Maße aus
 * src/app/(public)/[farmSlug]/bestellung/[orderId]/page.tsx (seit Nr. 227 nach
 * Board s1-/w1-bestellung-link): Kopf der KundeShell (56 px, ab md 64 px),
 * Spalte max. 896 px (px-4 pt-6, ab md pt-8), darin der Kopf ohne Karte
 * (Link zum Hof, Bestellnummer mit Schild, Satz), ab 768 px Abholung und „Hof
 * erreichen“ nebeneinander, die Positionen und „Zum Hof“ — dieselbe Klasse
 * `KARTE`, damit beim Umschalten nichts springt. Die Seite steht im
 * Geltungsbereich data-design="neu"; diese Ansicht kommt vor der Shell und
 * setzt den Marker selbst (wie „Meine Bestellungen").
 *
 * Diese Seite erreicht man über einen signierten Link aus der E-Mail, oft am
 * Handy und oft unterwegs — also genau dort, wo das Warten am längsten
 * dauert und ein leerer Bildschirm wie ein toter Link aussieht.
 *
 * Maßstab ist der gültige Link: Nur er wartet auf die Datenbank. Eine
 * ungültige Signatur antwortet ohne Abfrage, also sofort, und zeigt dieses
 * Skeleton kaum.
 */
import { cn } from '@/lib/utils'
import { KARTE } from '@/components/bestaetigung/bestaetigung-teile'

export default function BestellungLaden() {
  return (
    <div
      data-design="neu"
      className="min-h-dvh animate-pulse bg-background"
      aria-busy="true"
      aria-label="Bestellung wird geladen"
    >
      <div className="h-14 border-b border-border bg-background md:h-16" />

      <main className="mx-auto flex w-full max-w-[928px] flex-col gap-4 px-4 pt-6 pb-12 md:pt-8">
        {/* Kopf wie auf der Seite, ohne Karte: Link zum Hof, Bestellnummer mit Schild, Satz */}
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-48 rounded bg-app-chip" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-40 rounded-lg bg-border" />
            <div className="h-[22px] w-16 rounded-full bg-muted" />
          </div>
          <div className="h-4 w-full max-w-md rounded bg-app-trough" />
        </div>

        <div className="grid items-start gap-4 md:grid-cols-2">
          {/* Abholung */}
          <div className={cn(KARTE, 'flex flex-col gap-2')}>
            <div className="h-3 w-20 rounded bg-app-chip" />
            <div className="h-6 w-56 max-w-full rounded bg-app-trough" />
            <div className="h-4 w-60 max-w-full rounded bg-app-chip" />
            <div className="h-7 w-48 rounded-lg bg-muted" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="h-[52px] rounded-[14px] bg-muted" />
              <div className="h-[52px] rounded-[14px] bg-muted" />
            </div>
          </div>
          {/* Hof erreichen */}
          <div className={cn(KARTE, 'flex flex-col gap-3')}>
            <div className="h-3 w-28 rounded bg-app-chip" />
            <div className="h-5 w-44 rounded bg-app-trough" />
            <div className="h-5 w-40 rounded bg-app-trough" />
          </div>
        </div>

        {/* Positionen */}
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 rounded bg-app-chip" />
          <div className={cn(KARTE, 'flex flex-col gap-2.5')}>
            <div className="flex justify-between">
              <div className="h-4 w-36 rounded bg-app-chip" />
              <div className="h-4 w-14 rounded bg-app-chip" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-28 rounded bg-app-chip" />
              <div className="h-4 w-14 rounded bg-app-chip" />
            </div>
            <div className="flex justify-between">
              <div className="h-5 w-24 rounded bg-app-trough" />
              <div className="h-5 w-16 rounded bg-app-trough" />
            </div>
          </div>
        </div>
        <div className="h-[52px] rounded-[14px] bg-muted" />
      </main>
    </div>
  )
}
