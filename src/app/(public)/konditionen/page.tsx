import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { KONTAKT_EMAIL } from '@/lib/support'
import { GRUENDUNGS_AUFNAHME_SCHRITTE, GRUENDUNG_TEXT } from '@/lib/gruendungshof'
import { gruendungFuerSeiten, ladePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { PRO_MONAT, TARIFE, TARIFE_AB_SATZ, konditionenGebuehrAbschnitt, konditionenStand, konditionenStichtagZeile } from '@/lib/konditionen'
import { hofpreisEinstellungAus } from '@/lib/plattform-einstellung'
import { formatDatumLang } from '@/lib/format'
import { gebuehrModellFuer, hofpreisModellAb } from '@/lib/plattformgebuehr'
import { cn } from '@/lib/utils'
import { KARTE, KNOPF_ORANGE } from '@/components/hof-bestellungen/stil'
import { INFOSEITE_ABSCHNITT, INFOSEITE_LINK } from '@/components/shared/infoseite-stil'
import { EntwurfMarke, RechtstextVorlage } from '@/components/shared/rechtstext-vorlage'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { MARKE } from '@/lib/marke'

// Ohne Gebühren-Satz (Nr. 231): Welche Gebühr gilt, hängt vom Stichtag „Hofpreis-Modell ab“
// ab — die Beschreibung entsteht beim Bauen und stünde danach falsch in Suchmaschinen.
export const metadata: Metadata = {
  title: `Konditionen für Höfe — ${MARKE}`,
  alternates: { canonical: '/konditionen' },
  description:
    `Was ${MARKE} kostet: ${TARIFE_AB_SATZ} ` +
    `${TARIFE.map((t) => `${t.name} ${t.preis} ${PRO_MONAT}`).join(', ')}. ` +
    'Gebühr, Abrechnung und Aufnahme für Höfe.',
}

// Bei jedem Aufruf frisch gebaut (N45, A005 4e): Welche Fassung dasteht (bis
// zum Stichtag „Hofpreis-Modell ab“ die Servicegebühr, ab dann die
// Plattformgebühr; davor auch die Bar-Ausnahme B1), hängt an Stichtag und Uhr —
// mit einem Stundentakt stünde nach dem Stichtag bis zu einer Stunde die alte
// Fassung da. Den Stichtag liest die Seite aus dem Data Cache mit Etikett
// (ladePlattformEinstellung), ohne catch: Scheitert das, zeigt
// konditionen/error.tsx die Fehlerseite statt der stillen Vorgabe.
export const dynamic = 'force-dynamic'

const CTA_MAILTO = `mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent(`Mein Hof auf ${MARKE}`)}`

/**
 * Abschnitt „Aktion“ (Register K2, Nr. 116): nur, solange die Aktion läuft —
 * auch bei Anzeige aus, Konditionen sind keine Werbung; Zahlen und Sätze aus
 * derselben Quelle wie Startseite und /fuer-hoefe. Eigene Komponente hinter
 * Suspense, damit der Rest der Seite nicht auf die Datenbank wartet.
 */
async function AktionAbschnitt({ jetzt }: { jetzt: Date }): Promise<React.JSX.Element | null> {
  const gruendung = await gruendungFuerSeiten(jetzt)
  if (!gruendung.aktionLaeuft) return null
  const aktion = GRUENDUNG_TEXT.aktion(gruendung)
  return (
    <section className={cn(KARTE, 'px-4 py-3.5 text-foreground')}>
      <h2 className={cn(INFOSEITE_ABSCHNITT, 'mb-2 text-[16px]')}>{aktion.titel}</h2>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[14px]">
        {aktion.saetze.map((satz) => (
          <li key={satz}>{satz}</li>
        ))}
      </ul>
    </section>
  )
}

// Der Startseiten-CTA verspricht das Gründungshof-Angebot — bisher konnte man
// es nirgends nachlesen. Diese Seite ist die Nachlese-Stelle.
//
// Seit Nr. 231 in der Vorlage der Rechtsseiten (V62, Boards s3/w3-rechtstexte
// Bild 5 und 6): Kicker, Titel, Stand-Zeile, Tarife als zwei Karten, Aktion,
// Gebühr, Aufnahme, Fuß „Stand: …“ — ohne Verzeichnis und ohne Druckknopf,
// wie das Board. Eine Seite über Geld soll aussehen wie die anderen
// verbindlichen Seiten, nicht wie Werbung.
//
// Die Gebühr je Modell (N38, V62): bis zum Stichtag „Hofpreis-Modell ab“ der
// Abschnitt „Servicegebühr und Abrechnung“ (Fassung „bisher“), ab dann
// „Plattformgebühr und Abrechnung“ — seit N45 ohne die Kennzeichnung
// „Entwurf“; beides aus konditionenGebuehrAbschnitt. Der Übergang (K1,
// KONDITIONEN_UEBERGANG) steht nur im Modell „bisher“: Ab dem Stichtag wäre er
// falsch (Board-Notiz w3-rechtstexte, Go-live-Risiko); dann steht dort der
// Satz „Seit <Tag> …“ (konditionenStichtagZeile).
//
// ALLE Preise kommen aus src/lib/konditionen.ts — derselben Quelle wie
// /fuer-hoefe (Nr. 15, E6 = Tarife: „damit nichts Widersprüchliches live
// geht"). Steht hier eine Zahl im Text, ist das ein Fehler
// (tests/konditionen-seiten.test.ts).
export default async function KonditionenPage(): Promise<React.JSX.Element> {
  // Je Aufruf (oben): Danach entscheiden sich Modell und Bar-Ausnahme.
  const jetzt = new Date()
  const einstellung = hofpreisEinstellungAus(await ladePlattformEinstellung())
  const modell = gebuehrModellFuer(einstellung, jetzt)
  const gebuehr = konditionenGebuehrAbschnitt(modell, jetzt)
  const stichtag = hofpreisModellAb(einstellung)
  const stand = konditionenStand(modell, stichtag)
  return (
    <KundeShellMitSitzung>
      <RechtstextVorlage kicker="Was es kostet" titel="Konditionen für Höfe" stand={`Stand ${stand}`} fussStand={stand}>
        <section aria-labelledby="tarife">
          <h2 id="tarife" className="sr-only">
            Tarife
          </h2>
          {/* Vor den Preisen, damit keiner als heute fällig gelesen wird (Register K1). Seit N45 mit dem Stichtag:
              vor dem Stichtag K1 wörtlich und der Satz zum Stichtag, ab dann der Stichtag und – solange er in der
              Zukunft liegt – der Tarifstart. */}
          <p className="mb-3 font-semibold text-foreground">{konditionenStichtagZeile(modell, formatDatumLang(stichtag), jetzt)}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {TARIFE.map((tarif) => (
              <li key={tarif.id} className={cn(KARTE, 'rounded-[14px] px-4 py-3.5 text-foreground')}>
                {/* Name und Preis 20 px, Ecken 14 px (Board s3-/w3-rechtstexte, Bild 5) — nur der Rahmen. */}
                <p className="flex items-baseline justify-between gap-3">
                  <strong className="font-heading text-[20px] font-semibold">{tarif.name}</strong>
                  <span className="text-[20px] font-semibold whitespace-nowrap">
                    {tarif.grundgebuehrCents > 0 ? `${tarif.preis} ${PRO_MONAT}` : tarif.preis}
                  </span>
                </p>
                <p className="text-[13px] text-muted-foreground">{tarif.zusatz}</p>
                <ul className="mt-1.5 flex list-disc flex-col gap-0.5 pl-5 text-[13.5px]">
                  {tarif.leistungen.map((leistung) => (
                    <li key={leistung}>{leistung}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <Suspense fallback={null}>
          <AktionAbschnitt jetzt={jetzt} />
        </Suspense>

        <section aria-labelledby="gebuehr">
          {gebuehr.entwurf && <EntwurfMarke className="mb-1.5 block">{gebuehr.entwurf}</EntwurfMarke>}
          <h2 id="gebuehr" className={INFOSEITE_ABSCHNITT}>
            {gebuehr.titel}
          </h2>
          <div className="flex flex-col gap-3">
            {gebuehr.absaetze.map((absatz) => (
              <p key={absatz}>{absatz}</p>
            ))}
          </div>
        </section>

        <section aria-labelledby="aufnahme">
          <h2 id="aufnahme" className={INFOSEITE_ABSCHNITT}>
            So läuft die Aufnahme
          </h2>
          {/* Eine schlichte nummerierte Liste (Board s3-/w3-rechtstexte, Bild 6); Wortlaut aus derselben Quelle. */}
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-foreground">
            {GRUENDUNGS_AUFNAHME_SCHRITTE.map((schritt) => (
              <li key={schritt.titel}>
                <strong className="block font-semibold">{schritt.titel}</strong>
                {schritt.text}
              </li>
            ))}
          </ol>
          {/* Orange: Registrieren ist eine Hof-Aktion (DESIGN_SYSTEM „Farbrollen"),
              der eine Hauptknopf dieser Seite. Die Registrierung ist offen —
              der Weg führt direkt in die App, nicht ins Mail-Programm. */}
          <div className="mt-5 flex flex-col items-start gap-2">
            <Link href="/register" className={cn(KNOPF_ORANGE, 'h-[50px] w-full rounded-[14px] text-[16px] font-bold sm:w-auto md:h-14 md:px-8')}>
              Hof registrieren
            </Link>
            <a href={CTA_MAILTO} className={cn(INFOSEITE_LINK, 'inline-flex min-h-11 items-center')}>
              Fragen vorab? Schreib uns.
            </a>
          </div>
        </section>
      </RechtstextVorlage>
    </KundeShellMitSitzung>
  )
}
