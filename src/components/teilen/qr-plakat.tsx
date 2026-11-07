import { qrPfad } from '@/lib/qr-code'
import { Bildmarke } from '@/components/shared/bildmarke'
import type { PlakatDaten } from '@/server/queries/teilen-bild'
import { MARKE } from '@/lib/marke'
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'

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

/*
 * Seit Nr. 250 nach Board s2-/w2-whatsapp-plakat Bild 3 (Liste Lauf 32, whatsapp-plakat „Plakat anders
 * aufgebaut“): zentriert, oben die Marke, unter der Schlagzeile fett der Hof, der Code in der Mitte mit der
 * Adresse darunter, die drei Schritte nebeneinander; ohne den Satz „Handy-Kamera …“. Die Fußzeile mit
 * Abholzeiten und Bezahlen bleibt (C-Zeile „Hilft am Aushang“).
 */
export function QrPlakat({ daten }: { daten: PlakatDaten }): React.JSX.Element {
  const qr = qrPfad(daten.link)
  return (
    <article
      aria-label={`Plakat von ${daten.hofName}`}
      className={cn(
        '@container mx-auto aspect-[210/297] w-full max-w-[794px] overflow-hidden border border-border bg-accent-foreground text-primary-foreground [print-color-adjust:exact] print:aspect-auto print:h-[297mm] print:w-[210mm] print:max-w-none print:rounded-none print:border-0',
        RUNDUNG.karte
      )}
    >
      <div className="flex h-full flex-col items-center gap-[3cqw] px-[8.8cqw] py-[7cqw] text-center">
        {/* Die Bildmarke über der Wortmarke — die volle Fassung als Bild, Rundung per CSS (Register M1, Nr. 92;
            Mockup system-m1 „Marke – Entscheidung": das Plakat lädt die Marke, es zeichnet sie nicht). */}
        <div className="flex items-center gap-[1.8cqw]">
          <Bildmarke groesse={48} fassung="voll" className="size-[7cqw]" />
          <p className="font-heading text-[4.4cqw] font-semibold">{MARKE}</p>
        </div>
        <h2 className="mt-[2cqw] font-heading text-[8cqw] leading-[1.02] font-semibold">
          Frisch vom Hof.
          <br />
          Online vorbestellen.
        </h2>
        <p className="line-clamp-2 text-[3cqw] font-bold break-words">{daten.ort ? `${daten.hofName} · ${daten.ort}` : daten.hofName}</p>
        {/* Heller Rand rund um den Code: Die Norm will vier Module Ruhezone, sonst lesen manche Kameras ihn nicht. */}
        <svg
          role="img"
          aria-label={`QR-Code zur Hofseite ${daten.adresse}`}
          viewBox={`-4 -4 ${qr.groesse + 8} ${qr.groesse + 8}`}
          className="mt-[1cqw] size-[38cqw] shrink-0 rounded-[1cqw] bg-accent-foreground"
        >
          <path d={qr.pfad} className="fill-primary-foreground" />
        </svg>
        <p className="text-[2.8cqw] font-semibold break-all">{daten.adresse}</p>
        <ol className="mt-[1cqw] grid w-full grid-cols-3 gap-[3cqw]">
          {SCHRITTE.map((schritt, i) => (
            <li key={schritt} className="flex flex-col items-center gap-[1.4cqw] text-[2.5cqw] leading-snug">
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
        <div className="flex-grow" />
        {(daten.abholzeiten || daten.bezahlen) && (
          <div className="flex w-full gap-[3cqw] border-t-[0.25cqw] border-primary-foreground/15 pt-[2.8cqw] text-left text-[2.4cqw]">
            {daten.abholzeiten && (
              <p className="min-w-0">
                <b>Abholung</b>
                <br />
                {daten.abholzeiten}
              </p>
            )}
            <div className="flex-grow" />
            {daten.bezahlen && <p className="min-w-0 text-right break-words text-primary-foreground/70">{daten.bezahlen}</p>}
          </div>
        )}
      </div>
    </article>
  )
}
