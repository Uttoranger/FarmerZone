import { qrPfad } from '@/lib/qr-code'
import type { PlakatDaten } from '@/server/queries/teilen-bild'

/*
 * Das QR-Plakat (Gate 7 Aufgabe 3; Mockup web-h4-qr-plakat-zum-drucken):
 * ein A4-Blatt zum Aushängen. Papier hat kein Theme — das Blatt nimmt nur die
 * Farben, die in beiden Themes gleich sind (DESIGN_SYSTEM „Farbtokens":
 * `accent-foreground` Crème als Papier, `primary-foreground` fast schwarz als
 * Schrift, `accent` Grün), so sieht es am Bildschirm aus wie gedruckt und
 * druckt nie hell auf weiß. Maße in Prozent der Blattbreite (cqw): dieselbe
 * Gestalt am Handy, am Bildschirm und auf 210 mm Papier.
 *
 * Hofname und Ort sind Fremdtext (gereinigt in getPlakatDaten) und stehen nur
 * als Text da.
 */
const SCHRITTE = ['Code scannen', 'Ware auswählen', 'Zur Abholzeit vorbeikommen'] as const

export function QrPlakat({ daten }: { daten: PlakatDaten }): React.JSX.Element {
  const qr = qrPfad(daten.link)
  return (
    <article
      aria-label={`Plakat von ${daten.hofName}`}
      className="@container mx-auto aspect-[210/297] w-full max-w-[794px] overflow-hidden rounded-2xl border border-border bg-accent-foreground text-primary-foreground [print-color-adjust:exact] print:aspect-auto print:h-[297mm] print:w-[210mm] print:max-w-none print:rounded-none print:border-0"
    >
      <div className="flex h-full flex-col gap-[3.3cqw] px-[8.8cqw] py-[8cqw]">
        <p className="line-clamp-2 text-[1.9cqw] font-bold tracking-[0.25cqw] break-words text-accent uppercase">
          {daten.ort ? `${daten.hofName} · ${daten.ort}` : daten.hofName}
        </p>
        <h2 className="font-heading text-[8cqw] leading-[1.02] font-semibold">
          Frisch vom Hof.
          <br />
          Online vorbestellen.
        </h2>
        <p className="text-[2.8cqw] leading-[1.45] text-primary-foreground/80">
          Handy-Kamera auf den Code halten, aussuchen, bestellen – und zur Abholzeit einfach mitnehmen.
        </p>
        <div className="mt-[1.3cqw] flex items-center gap-[4.3cqw]">
          {/* Heller Rand rund um den Code: Die Norm will vier Module Ruhezone, sonst lesen manche Kameras ihn nicht. */}
          <svg
            role="img"
            aria-label={`QR-Code zur Hofseite ${daten.adresse}`}
            viewBox={`-4 -4 ${qr.groesse + 8} ${qr.groesse + 8}`}
            className="size-[33cqw] shrink-0 rounded-[1cqw] bg-accent-foreground"
          >
            <path d={qr.pfad} className="fill-primary-foreground" />
          </svg>
          <ol className="flex flex-col gap-[2.3cqw]">
            {SCHRITTE.map((schritt, i) => (
              <li key={schritt} className="flex items-center gap-[1.8cqw] text-[2.65cqw]">
                <span
                  aria-hidden="true"
                  className="flex size-[5cqw] shrink-0 items-center justify-center rounded-full bg-accent text-[2.4cqw] font-bold text-accent-foreground"
                >
                  {i + 1}
                </span>
                {schritt}
              </li>
            ))}
          </ol>
        </div>
        <div className="flex-grow" />
        <div className="flex gap-[3cqw] border-t-[0.25cqw] border-primary-foreground/15 pt-[2.8cqw] text-[2.4cqw]">
          {daten.abholzeiten && (
            <p className="min-w-0">
              <b>Abholung</b>
              <br />
              {daten.abholzeiten}
            </p>
          )}
          <div className="flex-grow" />
          <p className="min-w-0 text-right break-words">
            <b>{daten.adresse}</b>
            {daten.bezahlen && (
              <>
                <br />
                <span className="text-primary-foreground/70">{daten.bezahlen}</span>
              </>
            )}
          </p>
        </div>
      </div>
    </article>
  )
}
