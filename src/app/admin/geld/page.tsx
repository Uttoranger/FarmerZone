import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { aktuellerFinanzMonat, getFinanzen, type FinanzenDaten } from '@/server/queries/finanzen'
import { ladeAbgeschlosseneMonate, ladeGeldMonat, type GeldMonat } from '@/server/queries/geld'
import { centsAlsEuro, istMonatsschluessel, monatsAbstand } from '@/lib/servicegebuehr'
import { formatEuro, formatTagKurz, mitAnzahl } from '@/lib/format'
import {
  ergebnisText,
  finanzenExportAdresse,
  geldErgebnisCents,
  geldKosten,
  monatsabschlussMoeglich,
  monatsabschlussPruefliste,
  monatsabschlussZeile,
} from '@/lib/finanzen'
import { SERVICEGEBUEHR_BEZEICHNUNG } from '@/lib/servicegebuehr'
import { ABLAEUFE, wannText, zuletztText } from '@/lib/betrieb'
import { kalendertagInWien } from '@/lib/wiener-tag'
import type { KennzahlDaten } from '@/lib/admin-seiten'
import { finanzenReiterAus, finanzenZeitraumAus } from '@/schemas/admin-reiter'
import { cn } from '@/lib/utils'
import { StatusBadge, type StatusTon } from '@/components/ui/status-badge'
import { KARTE, LEISE } from '@/components/hof-bestellungen/stil'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'
import { Kennzahlen } from '@/components/admin/kennzahlen'
import { Seitenkopf } from '@/components/admin/seitenkopf'
import { LadeInhalt, LadeRahmen } from '@/components/ui/lade-punkt'
import { KostenListe } from '../finanzen/kosten-liste'
import { ladeJahrSeite } from '../finanzen/jahr-seite'
import { ZeitraumPfeil, ZeitraumUmschalter } from '../finanzen/zeitraum-wahl'
import { Monatsabschluss } from './monatsabschluss'
import { GELD_TEXT, geldAdresse, geldJahrAdresse } from './texte'
import { MARKE } from '@/lib/marke'
import { ladePlattformgebuehrGeld } from '@/server/queries/plattformgebuehr'
import { PLATTFORMGEBUEHR_BEZEICHNUNG } from '@/lib/konditionen'

export const metadata: Metadata = { title: `Geld — Admin — ${MARKE}` }
// Geld gehört in keinen Zwischenspeicher.
export const dynamic = 'force-dynamic'

/**
 * /admin/geld (Register N32, N37; Nr. 191; Mockup admin-geld): Was durch die
 * Plattform fließt, ob es mit Stripe übereinstimmt, und der Monatsabschluss.
 * Ersetzt /admin/finanzen (308) und nimmt dessen Teile weiter: Monatswahl,
 * Kostenliste mit Blatt, Jahresansicht und CSV.
 *
 * Gerechnet wird hier nichts: Jede Summe kommt aus src/lib/finanzen.ts
 * (Einnahmen, Kosten, Ergebnis, Erstattungen, Prüfliste), jeder Betrag in
 * ganzen Cent; die Seite schreibt nur hin (CODING_STANDARDS §2).
 */
export default async function AdminGeldPage({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string; zeitraum?: string; jahr?: string; reiter?: string }>
}): Promise<React.JSX.Element> {
  await verlangeAdminSeite({ recht: 'geld' })

  const { monat: gewuenscht, zeitraum, jahr, reiter } = await searchParams
  const jetzt = new Date()
  // Das Jahr bleibt die Seite von bisher (Nr. 100) — mit Übersicht, Kosten und CSV.
  if (finanzenZeitraumAus(zeitraum) === 'jahr') return ladeJahrSeite({ jahrParameter: jahr, reiter: finanzenReiterAus(reiter), jetzt })
  // Ungültiges still verwerfen (ARCHITECTURE §4): eine Adresszeile ist Fremdtext.
  const monat = typeof gewuenscht === 'string' && istMonatsschluessel(gewuenscht) ? gewuenscht : aktuellerFinanzMonat(jetzt)

  let daten: FinanzenDaten | null = null
  let geld: GeldMonat | null = null
  let abgeschlossene: string[] = []
  try {
    const [finanzen, monatGeld, abgeschlossen] = await Promise.all([getFinanzen(monat, jetzt), ladeGeldMonat(monat), ladeAbgeschlosseneMonate()])
    daten = finanzen
    geld = monatGeld
    abgeschlossene = [...abgeschlossen.keys()]
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'geld' } })
  }
  // Plattformgebühr (N38, Nr. 198): ein eigener Teil — scheitert er, bleibt die Seite.
  let plattformgebuehr: Awaited<ReturnType<typeof ladePlattformgebuehrGeld>> | null = null
  try {
    plattformgebuehr = await ladePlattformgebuehrGeld(monat)
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'geld', teil: 'plattformgebuehr' } })
  }
  if (!daten || !geld) {
    return (
      <div className={ADMIN_RAHMEN}>
        <AdminFehler titel={GELD_TEXT.titel} satz={GELD_TEXT.fehler} nochmal={geldAdresse(monat)} />
      </div>
    )
  }

  const { einnahmen } = daten
  const kosten = geldKosten(geld.stripeGebuehrCents, daten.kosten.cents)
  const ergebnisCents = geldErgebnisCents(einnahmen.gezaehltCents, kosten)
  const monatName = daten.bezeichnung.split(' ')[0] ?? daten.bezeichnung
  const laufend = monatsAbstand(monat, aktuellerFinanzMonat(jetzt)) <= 0
  const abgleichOk = geld.lauf !== null && geld.lauf.ok && geld.lauf.beendetAm !== null

  const kennzahlen: KennzahlDaten[] = [
    {
      id: 'umsatz',
      titel: 'Umsatz der Höfe',
      titelKurz: 'Umsatz',
      wert: formatEuro(centsAlsEuro(geld.umsatz.cents), 0),
      satz: `${mitAnzahl(geld.umsatz.anzahl, 'Bestellung', 'Bestellungen')} · ${geld.umsatz.bar} bar · geht direkt an die Höfe`,
    },
    {
      id: 'servicegebuehr',
      titel: SERVICEGEBUEHR_BEZEICHNUNG,
      titelKurz: 'Gebühr',
      wert: formatEuro(centsAlsEuro(einnahmen.gezaehltCents)),
      satz: `online ${formatEuro(centsAlsEuro(einnahmen.eingezogenCents))} · vor Ort ${formatEuro(centsAlsEuro(einnahmen.geschuldetCents))}`,
    },
    {
      id: 'erstattungen',
      titel: 'Erstattungen',
      wert: formatEuro(centsAlsEuro(geld.erstattungen.cents)),
      satz: `${mitAnzahl(geld.erstattungen.anzahl, 'Bestellung', 'Bestellungen')}${geld.erstattungen.offen > 0 ? ` · ${geld.erstattungen.offen} offen` : ''}`,
      ...(geld.erstattungen.offen > 0 ? { ton: 'tun' as const } : {}),
      amHandy: false,
    },
    {
      id: 'kosten',
      titel: 'Kosten',
      wert: formatEuro(centsAlsEuro(kosten.cents)),
      satz: `Stripe-Gebühren ${formatEuro(centsAlsEuro(kosten.stripeCents))} · Betrieb ${formatEuro(centsAlsEuro(kosten.betriebCents))}`,
      amHandy: false,
    },
    {
      id: 'ergebnis',
      titel: 'Ergebnis',
      wert: ergebnisText(ergebnisCents),
      satz: ergebnisCents < 0 ? 'noch nicht gedeckt' : 'trägt sich',
      // Grün = trägt sich, Orange = noch nicht (kein Rot, Register O1).
      ton: ergebnisCents < 0 ? 'tun' : 'laeuft',
    },
  ]

  const punkte = monatsabschlussPruefliste({
    abgleichNachMonatsende: geld.abgleichNachMonatsende,
    abweichungen: geld.abweichungen.length,
    erstattungenOffen: geld.erstattungen.offen,
    kostenPosten: daten.kosten.anzahl,
    csvGeladen: geld.csvGeladen,
  })
  const moeglich = monatsabschlussMoeglich(punkte)
  const gesperrt = laufend ? GELD_TEXT.laufendGrund : moeglich.moeglich ? null : moeglich.grund
  const jahrZahl = Number(monat.slice(0, 4))
  const ablauf = ABLAEUFE.find((a) => a.name === 'geld-abgleich')
  const ablaufWann = ablauf ? wannText(ablauf, jetzt) : ''

  const abgleichZeilen: Array<{ titel: string; satz: string; wort: string; ton: StatusTon }> = [
    {
      titel: 'Zahlungen',
      satz: !abgleichOk
        ? 'Der Abgleich ist noch nicht gelaufen.'
        : geld.abweichungen.length === 0
          ? 'Betrag, Servicegebühr und Erstattung gleich'
          : `${mitAnzahl(geld.abweichungen.length, 'Abweichung', 'Abweichungen')} – steht in Heute`,
      wort: !abgleichOk ? 'offen' : geld.abweichungen.length === 0 ? 'stimmt' : 'abweichend',
      ton: abgleichOk && geld.abweichungen.length === 0 ? 'fertig' : 'offen',
    },
    {
      titel: 'Stripe-Gebühren',
      satz: `${formatEuro(centsAlsEuro(geld.stripeGebuehrCents))} · ${GELD_TEXT.stripeGebuehrTraeger}`,
      wort: 'gebucht',
      ton: 'neutral',
    },
    {
      titel: 'Erstattungen',
      satz: `${mitAnzahl(geld.erstattungen.anzahl, 'Bestellung', 'Bestellungen')}${geld.erstattungen.offen > 0 ? ` · ${geld.erstattungen.offen} offen (steht in Heute)` : ''}`,
      wort: geld.erstattungen.offen > 0 ? 'offen' : 'erledigt',
      ton: geld.erstattungen.offen > 0 ? 'offen' : 'fertig',
    },
    {
      titel: 'Letzter Lauf',
      satz: geld.lauf === null ? `noch kein Lauf · ${ablaufWann}` : zuletztText(geld.lauf.gestartetAm, jetzt),
      wort: geld.lauf === null ? 'noch keiner' : abgleichOk ? 'ok' : 'gescheitert',
      ton: abgleichOk ? 'fertig' : 'offen',
    },
  ]

  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-5')}>
      <LadeRahmen>
        <Seitenkopf
          titel={GELD_TEXT.titel}
          satz={GELD_TEXT.satz}
          hinweis={daten.testzahlungenHinweis}
          rechts={
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <ZeitraumUmschalter aktiv="monat" monatHref={geldAdresse(monat)} jahrHref={geldJahrAdresse(jahrZahl)} />
              <nav aria-label="Monat wählen" className="flex items-center gap-1.5">
                <ZeitraumPfeil href={daten.vorigerMonat === null ? null : geldAdresse(daten.vorigerMonat)} beschriftung="Vorheriger Monat" richtung="zurueck" />
                <span className="min-w-[9.5rem] text-center text-[15px] font-semibold text-foreground" aria-current="page">
                  {daten.bezeichnung}
                </span>
                <ZeitraumPfeil href={daten.naechsterMonat === null ? null : geldAdresse(daten.naechsterMonat)} beschriftung="Nächster Monat" richtung="vor" />
              </nav>
            </div>
          }
        />

        <LadeInhalt className="flex flex-col gap-5">
          <Kennzahlen beschriftung={GELD_TEXT.kennzahlen} eintraege={kennzahlen} />

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <section aria-labelledby="abgleich-titel" className={cn(KARTE, 'flex flex-col gap-2 p-4 md:p-[18px]')}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="abgleich-titel" className="font-heading text-[17px] font-semibold text-foreground">
                  {GELD_TEXT.abgleich}
                </h2>
                <span className={cn('text-[13px]', LEISE)}>{GELD_TEXT.abgleichZusatz}</span>
              </div>
              <ul className="[&>li]:border-t [&>li]:border-border">
                {abgleichZeilen.map((z) => (
                  <li key={z.titel} className="flex min-h-11 items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-foreground">{z.titel}</span>
                      <span className={cn('block text-[13px]', LEISE)}>{z.satz}</span>
                    </span>
                    <StatusBadge status={z.ton} className="shrink-0">
                      {z.wort}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            </section>

            <Monatsabschluss
              monat={monat}
              bezeichnung={daten.bezeichnung}
              monatName={monatName}
              punkte={punkte}
              zeile={monatsabschlussZeile(punkte)}
              gesperrt={gesperrt}
              abgeschlossen={geld.abgeschlossenAm ? `am ${formatTagKurz(kalendertagInWien(geld.abgeschlossenAm))}` : null}
              csvHref={finanzenExportAdresse(jahrZahl)}
              csvText={`CSV ${jahrZahl} laden`}
            />
          </div>

          {plattformgebuehr && (
            <section aria-labelledby="plattformgebuehr-titel" className={cn(KARTE, 'flex max-w-[560px] flex-col gap-2 p-4 md:p-[18px]')}>
              <h2 id="plattformgebuehr-titel" className="font-heading text-[17px] font-semibold text-foreground">
                {PLATTFORMGEBUEHR_BEZEICHNUNG} · Monatsabrechnung {daten.bezeichnung}
              </h2>
              <ul className="[&>li]:border-t [&>li]:border-border">
                <li className="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
                  <span className="text-foreground">bar (Lastschrift oder Überweisung)</span>
                  <span className="tabular-nums text-foreground">{formatEuro(centsAlsEuro(plattformgebuehr.barCents))}</span>
                </li>
                <li className="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
                  <span className="text-foreground">online (von Stripe einbehalten)</span>
                  <span className="tabular-nums text-foreground">{formatEuro(centsAlsEuro(plattformgebuehr.onlineCents))}</span>
                </li>
                <li className="flex min-h-11 flex-wrap items-center gap-2 py-2 text-[14px]">
                  <StatusBadge status={plattformgebuehr.gescheitert + plattformgebuehr.zurueckgebucht > 0 ? 'offen' : 'neutral'}>
                    {`${plattformgebuehr.offen} offen · ${plattformgebuehr.gescheitert} gescheitert · ${plattformgebuehr.zurueckgebucht} zurückgebucht`}
                  </StatusBadge>
                  <span className={cn('text-[13px]', LEISE)}>Einzüge aller Monate</span>
                </li>
              </ul>
            </section>
          )}

          <div className="max-w-[560px]">
            <KostenListe
              monat={monat}
              bezeichnung={daten.bezeichnung}
              posten={daten.posten}
              summeCents={kosten.cents}
              stripeGebuehrCents={kosten.stripeCents}
              grundFuer={abgeschlossene}
            />
          </div>

          <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>{GELD_TEXT.regel}</p>
        </LadeInhalt>
      </LadeRahmen>
    </div>
  )
}
