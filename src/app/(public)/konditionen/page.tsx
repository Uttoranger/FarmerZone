import type { Metadata } from 'next'
import Link from 'next/link'
import { KONTAKT_EMAIL } from '@/lib/support'
import { GRUENDUNGS_AUFNAHME_SCHRITTE } from '@/lib/gruendungshof'
import {
  KONDITIONEN_STAND,
  KONDITIONEN_UEBERGANG,
  MONATSABRECHNUNG_TEXT,
  PRO_MONAT,
  SERVICEGEBUEHR_SATZ_TEXT,
  STARTPHASE_SATZ,
  TARIFE,
  TARIFE_AB_SATZ,
  servicegebuehrZahltKunde,
} from '@/lib/konditionen'
import { cn } from '@/lib/utils'
import { KARTE, KNOPF_ORANGE } from '@/components/hof-bestellungen/stil'
import { StartSchritte } from '@/components/fuer-hoefe/start-schritte'
import {
  INFOSEITE_ABSCHNITT,
  INFOSEITE_KICKER,
  INFOSEITE_LINK,
  INFOSEITE_SPALTE,
  INFOSEITE_STAND,
  INFOSEITE_TEXT,
  INFOSEITE_TITEL,
} from '@/components/shared/infoseite-stil'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = {
  title: `Konditionen für Höfe — ${MARKE}`,
  alternates: { canonical: '/konditionen' },
  description:
    `Was ${MARKE} kostet: ${STARTPHASE_SATZ} ${TARIFE_AB_SATZ} ` +
    `${TARIFE.map((t) => `${t.name} ${t.preis} ${PRO_MONAT}`).join(', ')}. ` +
    `Die Servicegebühr von ${SERVICEGEBUEHR_SATZ_TEXT} zahlt der Kunde.`,
}

// Statisch, aber stündlich neu gebaut (Register F6, 19a): Ob die Bar-Ausnahme
// bis zum Stichtag (B1) dasteht, entscheidet sich je Bau. Ohne revalidate
// stünde der Satz nach dem Stichtag bis zum nächsten Deploy da.
export const revalidate = 3600

const CTA_MAILTO = `mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent(`Mein Hof auf ${MARKE}`)}`

// Der Startseiten-CTA verspricht das Gründungshof-Angebot — bisher konnte man
// es nirgends nachlesen. Diese Seite ist die Nachlese-Stelle.
//
// Aufbau bewusst wie das Impressum (gleiche Spalte, gleiche Abschnitts-
// Typografie aus infoseite-stil.ts): eine Seite über Geld soll aussehen wie
// die anderen verbindlichen Seiten, nicht wie Werbung. Seit Nr. 54 in der
// KundeShell (KundeShellMitSitzung: die Seite bleibt statisch).
//
// ALLE Preise kommen aus src/lib/konditionen.ts — derselben Quelle wie
// /fuer-hoefe (Nr. 15, E6 = Tarife: „damit nichts Widersprüchliches live
// geht"). Steht hier eine Zahl im Text, ist das ein Fehler
// (tests/konditionen-seiten.test.ts). Bis Nr. 15 stand hier das
// Gründungshof-Angebot.
export default function KonditionenPage() {
  // Je Bau bzw. stündlicher Revalidierung (oben): Danach entscheidet sich, ob die Bar-Ausnahme bis zum Stichtag (B1) dasteht.
  const jetzt = new Date()
  return (
    <KundeShellMitSitzung>
      <div className={INFOSEITE_SPALTE}>
        <p className={INFOSEITE_KICKER}>Was es kostet</p>
        <h1 className={cn(INFOSEITE_TITEL, 'mb-8')}>Konditionen für Höfe</h1>

        <div className={INFOSEITE_TEXT}>
          <section>
            <h2 className={INFOSEITE_ABSCHNITT}>Tarife</h2>
            {/* Vor den Preisen, damit keiner als heute fällig gelesen wird (Register K1). */}
            <p className="mb-3 font-semibold text-foreground">{KONDITIONEN_UEBERGANG}</p>
            <ul className="flex flex-col gap-3">
              {TARIFE.map((tarif) => (
                <li key={tarif.id} className={cn(KARTE, 'px-4 py-3.5')}>
                  <p className="text-foreground">
                    <strong className="font-heading text-[16px] font-semibold">{tarif.name}</strong> · {tarif.preis} {PRO_MONAT}
                  </p>
                  <p>{tarif.zusatz}</p>
                  <p>{tarif.leistungen.join(' · ')}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className={INFOSEITE_ABSCHNITT}>Servicegebühr und Abrechnung</h2>
            <p>{servicegebuehrZahltKunde(jetzt)}</p>
            <p className="mt-3">{MONATSABRECHNUNG_TEXT}</p>
          </section>

          <section>
            <h2 className={INFOSEITE_ABSCHNITT}>So läuft die Aufnahme</h2>
            {/* Dieselben orangen Ringe wie auf /fuer-hoefe — Schritte der Hofwelt. */}
            <div className="text-foreground">
              <StartSchritte schritte={GRUENDUNGS_AUFNAHME_SCHRITTE} />
            </div>
          </section>

          <section>
            <h2 className={INFOSEITE_ABSCHNITT}>Loslegen</h2>
            {/* Orange: Registrieren ist eine Hof-Aktion (DESIGN_SYSTEM „Farbrollen"),
                der eine Hauptknopf dieser Seite. Die Registrierung ist offen —
                der Weg führt direkt in die App, nicht ins Mail-Programm. */}
            <Link href="/register" className={KNOPF_ORANGE}>
              Hof registrieren
            </Link>
            <p className="mt-3">
              <a href={CTA_MAILTO} className={cn(INFOSEITE_LINK, 'inline-flex min-h-11 items-center')}>
                Fragen vorab? Schreib uns.
              </a>
            </p>
          </section>

          <p className={INFOSEITE_STAND}>Stand: {KONDITIONEN_STAND}</p>
        </div>
      </div>
    </KundeShellMitSitzung>
  )
}
