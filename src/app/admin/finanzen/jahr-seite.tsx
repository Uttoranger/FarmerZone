import * as Sentry from '@sentry/nextjs'
import { Download, Wallet } from 'lucide-react'
import { aktuellerFinanzMonat, getFinanzenJahr, type FinanzenJahrDaten } from '@/server/queries/finanzen'
import { monatsschluessel } from '@/lib/servicegebuehr'
import {
  FINANZEN_JAHR_TEXT,
  finanzenExportAdresse,
  finanzenJahrAdresse,
  finanzenJahrUnterreiter,
  jahrKennzahlen,
  jahrMonateFuerAnzeige,
  testzahlungenHinweisImJahr,
} from '@/lib/finanzen'
import { FINANZEN_REITER_OHNE_INHALT, FINANZEN_SEITE, finanzenAdresse, finanzenReiterLabel, type FinanzenReiterId } from '@/lib/admin-finanzen-seite'
import { finanzenJahrAus } from '@/schemas/admin-reiter'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'
import { Kennzahlen } from '@/components/admin/kennzahlen'
import { Seitenkopf } from '@/components/admin/seitenkopf'
import { LadeInhalt, LadeRahmen } from '@/components/ui/lade-punkt'
import { Unterreiter } from '@/components/admin/unterreiter'
import { JahrMonate } from './jahr-monate'
import { KostenJahr } from './kosten-jahr'
import { ZeitraumPfeil, ZeitraumUmschalter } from './zeitraum-wahl'

/**
 * Admin › Finanzen im Jahr (Register N15, Ergänzung Nr. 100; Mockup
 * admin-finanzen-jahr): dieselbe Seite wie der Monat, mit demselben Kopf,
 * denselben Kennzahlen und Unterreitern — das Jahr ist die Summe seiner Monate
 * (`getFinanzenJahr`), gerechnet wird hier nichts. Eine Funktion statt einer
 * eigenen Seite, weil die Adresse dieselbe bleibt (`?zeitraum=jahr&jahr=…`).
 */
export async function ladeJahrSeite({
  jahrParameter,
  reiter,
  jetzt,
}: {
  /** Das Jahr aus der Adresse, roh — Fremdtext, `finanzenJahrAus` macht daraus eine Zahl. */
  jahrParameter: string | undefined
  reiter: FinanzenReiterId
  jetzt: Date
}): Promise<React.JSX.Element> {
  const laufendesJahr = Number(aktuellerFinanzMonat(jetzt).slice(0, 4))

  let daten: FinanzenJahrDaten | null = null
  try {
    daten = await getFinanzenJahr(finanzenJahrAus(jahrParameter, laufendesJahr), jetzt)
  } catch (fehler) {
    Sentry.captureException(fehler, { tags: { bereich: 'admin', seite: 'finanzen-jahr' } })
  }
  if (!daten) {
    return (
      <div className={ADMIN_RAHMEN}>
        <AdminFehler titel="Geld" satz="Wir konnten die Zahlen gerade nicht laden." nochmal="/admin/geld?zeitraum=jahr" />
      </div>
    )
  }

  const { jahr, rechnung } = daten
  const text = FINANZEN_JAHR_TEXT
  // Zurück zum Monat: im laufenden Jahr der heutige, sonst der Dezember.
  const monat = jahr === laufendesJahr ? aktuellerFinanzMonat(jetzt) : monatsschluessel(jahr, 12)

  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-5')}>
      <LadeRahmen>
        <Seitenkopf
          titel={FINANZEN_SEITE.titel}
          satz={text.satz(jahr, jahr === laufendesJahr)}
          hinweis={testzahlungenHinweisImJahr(daten.testzahlungenHinweis, rechnung, daten.vorjahr, false)}
          rechts={
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <ZeitraumUmschalter
                aktiv="jahr"
                monatHref={finanzenAdresse({ monat, reiter })}
                jahrHref={finanzenJahrAdresse({ jahr, reiter })}
              />
              {/* Links statt Knöpfe: Das Jahr steht in der Adresse, teilbar, der Zurück-Pfeil tut das Richtige. */}
              <nav aria-label={text.jahrWaehlen} className="flex items-center gap-1.5">
                <ZeitraumPfeil
                  href={daten.vorigesJahr === null ? null : finanzenJahrAdresse({ jahr: daten.vorigesJahr, reiter })}
                  beschriftung={text.vorigesJahr}
                  richtung="zurueck"
                />
                <span className="min-w-[4.5rem] text-center text-[15px] font-semibold text-foreground" aria-current="page">
                  {jahr}
                </span>
                <ZeitraumPfeil
                  href={daten.naechstesJahr === null ? null : finanzenJahrAdresse({ jahr: daten.naechstesJahr, reiter })}
                  beschriftung={text.naechstesJahr}
                  richtung="vor"
                />
              </nav>
              {/* Eine Route, kein Seitenaufruf: eine Datei zum Speichern, kein Next-Link. */}
              <a href={finanzenExportAdresse(jahr)} download className={KNOPF_RAHMEN}>
                <Download className="size-4" strokeWidth={1.7} aria-hidden="true" />
                {text.csv(jahr)}
                <span className="sr-only"> {text.csvHerunterladen}</span>
              </a>
            </div>
          }
        />

        <LadeInhalt className="flex flex-col gap-5">
          <Kennzahlen beschriftung={FINANZEN_SEITE.kennzahlen} eintraege={jahrKennzahlen(rechnung, laufendesJahr)} />

          <Unterreiter beschriftung={FINANZEN_SEITE.reiter} eintraege={finanzenJahrUnterreiter(jahr, rechnung.posten.length)} aktiv={reiter} ladePunkt />

          {reiter === 'monat' && (
            <JahrMonate
              jahr={jahr}
              monate={jahrMonateFuerAnzeige(rechnung, daten.vorjahr)}
              vorjahr={daten.vorjahr === null ? null : daten.vorjahr.jahr}
              vergleichAb={daten.vergleichAb}
              hinweisImVergleich={rechnung.testzahlungAusgelassen ? null : testzahlungenHinweisImJahr(daten.testzahlungenHinweis, rechnung, daten.vorjahr, true)}
            />
          )}

          {reiter === 'kosten' && <KostenJahr rechnung={rechnung} kostenHref={finanzenAdresse({ monat, reiter: 'kosten' })} />}

          {(reiter === 'auszahlungen' || reiter === 'entfallen') && (
            <EmptyState
              symbol={Wallet}
              titel={finanzenReiterLabel(reiter)}
              satz={FINANZEN_REITER_OHNE_INHALT}
              ausweg={{ ohne: 'Zu diesem Reiter hat die Finanzseite keine Zahlen; es gibt nichts, wohin der Weg führen könnte' }}
            />
          )}

          <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>{text.regel}</p>
        </LadeInhalt>
      </LadeRahmen>
    </div>
  )
}
