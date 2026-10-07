import type { Metadata } from 'next'
import Link from 'next/link'
import { KundenKopf } from '@/components/shared/kunden-kopf'
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

export const metadata: Metadata = {
  title: 'Konditionen für Höfe — FarmerZone',
  description:
    `Was FarmerZone kostet: ${STARTPHASE_SATZ} ${TARIFE_AB_SATZ} ` +
    `${TARIFE.map((t) => `${t.name} ${t.preis} ${PRO_MONAT}`).join(', ')}. ` +
    `Die Servicegebühr von ${SERVICEGEBUEHR_SATZ_TEXT} zahlt der Kunde.`,
}

// Statisch, aber stündlich neu gebaut (Register F6, 19a): Ob die Bar-Ausnahme
// bis zum Stichtag (B1) dasteht, entscheidet sich je Bau. Ohne revalidate
// stünde der Satz nach dem Stichtag bis zum nächsten Deploy da.
export const revalidate = 3600

const CTA_MAILTO = `mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent('Mein Hof auf FarmerZone')}`

// Der Startseiten-CTA verspricht das Gründungshof-Angebot — bisher konnte man
// es nirgends nachlesen. Diese Seite ist die Nachlese-Stelle.
//
// Aufbau und Klassen bewusst wie Impressum und Datenschutz (gleicher Container,
// gleiche Zurück-Navigation, gleiche Abschnitts-Typografie): eine Seite über
// Geld soll aussehen wie die anderen verbindlichen Seiten, nicht wie Werbung.
//
// ALLE Preise kommen aus src/lib/konditionen.ts — derselben Quelle wie
// /fuer-hoefe (Nr. 15, E6 = Tarife: „damit nichts Widersprüchliches live
// geht"). Steht hier eine Zahl im Text, ist das ein Fehler
// (tests/konditionen-seiten.test.ts). Bis Nr. 15 stand hier das
// Gründungshof-Angebot; den Umbau der Seite ins neue Design macht Gate 8.
export default function KonditionenPage() {
  // Je Bau bzw. stündlicher Revalidierung (oben): Danach entscheidet sich, ob die Bar-Ausnahme bis zum Stichtag (B1) dasteht.
  const jetzt = new Date()
  return (
    <div className="min-h-screen bg-background">
      <KundenKopf seite={{ art: 'info' }} />
      {/* Landmarke für Axe (landmark-one-main, region) — sonst stand der Inhalt außerhalb jeder Region. */}
      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* Kicker im Stil der Startseite */}
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Was es kostet
        </p>
        <h1 className="text-2xl font-semibold text-foreground mb-8">Konditionen für Höfe</h1>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">

          <section>
            <h2 className="font-semibold text-foreground text-base mb-3">Tarife</h2>
            {/* Vor den Preisen, damit keiner als heute fällig gelesen wird (Register K1). */}
            <p className="mb-3 font-medium text-foreground">{KONDITIONEN_UEBERGANG}</p>
            <ul className="space-y-3">
              {TARIFE.map((tarif) => (
                <li key={tarif.id} className="rounded-lg border border-border px-4 py-3">
                  <p className="text-foreground">
                    <strong className="font-semibold">{tarif.name}</strong> · {tarif.preis} {PRO_MONAT}
                  </p>
                  <p>{tarif.zusatz}</p>
                  <p>{tarif.leistungen.join(' · ')}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-foreground text-base mb-3">Servicegebühr und Abrechnung</h2>
            <p>{servicegebuehrZahltKunde(jetzt)}</p>
            <p className="mt-3">{MONATSABRECHNUNG_TEXT}</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground text-base mb-3">So läuft die Aufnahme</h2>
            <ol className="space-y-3">
              {GRUENDUNGS_AUFNAHME_SCHRITTE.map((schritt, i) => (
                <li key={schritt.titel} className="flex gap-3">
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-brand-text"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <strong className="font-semibold text-foreground">{schritt.titel}</strong>
                    <span className="block text-muted-foreground">{schritt.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="font-semibold text-foreground text-base mb-3">Loslegen</h2>
            {/* Kein Orange: der eine Akzent der Startseite bleibt dort. Hier
                genügt der Primärton der Rechtsseiten. Die Registrierung ist
                offen — der Weg führt direkt in die App, nicht mehr ins
                Mail-Programm (Muster wie der Startseiten-CTA seit #70). */}
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Hof registrieren
            </Link>
            <p className="mt-3">
              <a
                href={CTA_MAILTO}
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4 hover:opacity-80"
              >
                Fragen vorab? Schreib uns.
              </a>
            </p>
          </section>

          <p className="text-xs text-muted-foreground pt-4 border-t border-border">
            Stand: {KONDITIONEN_STAND}
          </p>
        </div>
      </main>
    </div>
  )
}
