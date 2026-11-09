'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronRight, Plus, Wheat } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { LadePunkt } from '@/components/ui/lade-punkt'
import { AnsichtChips } from '@/components/region/ansicht-chips'
import { REGION_KARTE_HOEHE, REGION_KARTE_MARKE, REGION_KARTEN_SPALTE, REGION_SPALTEN } from '@/components/region/region-spalten'
import { useRegionAnsicht } from '@/components/region/use-region-ansicht'
import { futterHinweisImUmkreis, futterZahlZeile } from '@/components/region/futter-hinweise'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { KmWahl } from '@/components/region/km-wahl'
import { ErklaerKnopf } from '@/components/region/erklaer-knopf'
import { FutterKarte } from '@/components/region/futter-karte'
import { FUTTER_ANLEGEN_HREF } from '@/lib/bauern-navigation'
import { ABHOLUNG_TEXT } from '@/lib/hoefe-entdecken'
import {
  FUTTER_ERKLAERUNG,
  FUTTER_KARTE_TEXT,
  FUTTER_SELBST_VERKAUFEN,
  type FutterKaufenAnsicht as Ansicht,
  type FutterLeer,
} from '@/lib/futter-kaufen'
import { UMFELD_KM } from '@/lib/umfeld'
import { cn } from '@/lib/utils'
import { futterKaufenLink, leseFutterAnsicht, type FutterAnsichtWahl, type FutterKaufenFilter } from '@/schemas/region'

// Erst beim Umschalten auf „Karte" geladen — mit ihr kommt Leaflet. Wer nur
// die Liste liest, lädt weder die Bibliothek noch eine Kachel
// (tests/futter-karte-import.test.ts prüft das am Import-Graph).
const FutterKarteAnsicht = dynamic(() => import('@/components/region/futter-karte-ansicht'), {
  ssr: false,
  loading: () => <div className={cn(REGION_KARTE_HOEHE, 'animate-pulse rounded-[12px] bg-muted')} aria-hidden="true" />,
})

/*
 * Region › Futter kaufen (Nachtlauf Nr. 22c; seit Nr. 123 nach Board
 * system-h5-region-v2 §3 und system-h5-region-eigene-teile §3/§4, N23): Kopf
 * mit Umkreis samt Zahl je Stufe, Futterart, Menge und Abholung — alles Links
 * in der Adresse, der Server rechnet; der gewählte Chip zeigt den Ladepunkt
 * (keine loading.tsx auf /region). Darunter der Hinweis mit (i), Liste | Karte
 * und die Futterkarten. Liste | Karte ist Zustand der Seite wie bei Preise
 * vergleichen (umfeld-anzeige.tsx): `?ansicht=karte` gilt beim Laden,
 * gewechselt wird mit history.replaceState, die Links tragen die Ansicht mit.
 * Alles hat src/lib/futter-kaufen.ts entschieden und formatiert; hier wird nur
 * angeordnet.
 *
 * Seit Nr. 272 (Board s1-/w1-region Bild 2 und 6): ab 1024 px Liste und Karte
 * nebeneinander, darüber der Satz „Höfe mit LFBIS-Nummer im Umkreis von 25 km –
 * du kaufst für deine Tiere.“; am Handy die Zeile „2 Höfe mit LFBIS-Nummer“
 * neben „Liste / Karte“, in der Kartenansicht nur Umkreis und „Liste / Karte“.
 */
export function FutterKaufenAnsicht({
  ansicht,
  filter,
  ansichtBeimLaden,
  jetzt,
}: {
  ansicht: Ansicht
  filter: FutterKaufenFilter
  ansichtBeimLaden: FutterAnsichtWahl
  /** Der Zeitpunkt des Servers (ISO-Text) — für die Abholzeilen. */
  jetzt: string
}): React.JSX.Element {
  const pfad = usePathname()
  const suche = useSearchParams()
  const wahl = suche.has('ansicht') ? leseFutterAnsicht(suche.get('ansicht')) : ansichtBeimLaden
  const { zeigeKarte, zeigeListe, nurUmkreis } = useRegionAnsicht(wahl)
  const link = (teil: Partial<FutterKaufenFilter>): string => futterKaufenLink({ ...filter, ...teil }, wahl)

  function waehle(neu: FutterAnsichtWahl): void {
    const ziel = futterKaufenLink(filter, neu)
    window.history.replaceState(null, '', `${pfad}${ziel.slice(ziel.indexOf('?'))}`)
  }

  return (
    <div className="flex flex-col gap-4" {...(nurUmkreis ? REGION_KARTE_MARKE : {})}>
      <div className="flex flex-col gap-3">
        <KmWahl
          stufen={UMFELD_KM.map((km) => ({ km, href: link({ km }), aktiv: km === filter.km }))}
          zahlen={ansicht.zahlenJeStufe}
          zahlLabel={FUTTER_KARTE_TEXT.umkreisZahl}
        />
        {/* In der Kartenansicht am Handy nur der Umkreis (Liste Lauf 32 region, Board s1-region Bild 6). */}
        {!nurUmkreis && (
          <>
            <FilterChipReihe beschriftung="Futterart">
              {ansicht.artChips.map((chip) => (
                <FilterChip key={chip.wert ?? 'alle'} href={link({ art: chip.wert })} aktiv={chip.aktiv} ladePunkt>
                  {chip.label}
                </FilterChip>
              ))}
            </FilterChipReihe>
            {ansicht.mengeChips.length > 1 && (
              <FilterChipReihe beschriftung="Menge">
                {ansicht.mengeChips.map((chip) => (
                  <FilterChip key={chip.wert ?? 'alle'} href={link({ menge: chip.wert })} aktiv={chip.aktiv} ladePunkt>
                    {chip.label}
                  </FilterChip>
                ))}
              </FilterChipReihe>
            )}
            {/* Abholung wie auf /hoefe: eine Liste von Links mit aria-current, am Handy waagrecht wischbar. */}
            {/* Ohne Uhr-Symbol vor der Tage-Zeile (Liste Lauf 32 region). */}
            <FilterChipReihe beschriftung={ABHOLUNG_TEXT.beschriftung} className="min-w-0">
              {ansicht.abholungChips.map((chip) => (
                <FilterChip key={chip.wert ?? 'alle'} href={link({ abholung: chip.wert })} aktiv={chip.aktiv} ladePunkt>
                  {chip.label}
                </FilterChip>
              ))}
            </FilterChipReihe>
          </>
        )}
      </div>

      {/* Am Handy Zählzeile und „Liste / Karte“ in einer Zeile (Board s1-region Bild 2), im Web nur der Satz mit dem Umkreis. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!nurUmkreis && !ansicht.leer && (
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="flex items-center gap-2 text-[13px] leading-normal text-muted-foreground">
              <span className="min-w-0 lg:hidden">{futterZahlZeile(ansicht.karte.pins.length)}</span>
              <span className="hidden min-w-0 lg:inline">{futterHinweisImUmkreis(filter.km)}</span>
              <ErklaerKnopf titel={FUTTER_ERKLAERUNG.titel} punkte={FUTTER_ERKLAERUNG.punkte} />
            </p>
            {ansicht.hinweise.map((hinweis) => (
              <p key={hinweis} className="text-[13px] leading-normal text-muted-foreground">
                {hinweis}
              </p>
            ))}
          </div>
        )}
        {/* Leer ohne „Liste / Karte“ (Board Bild 5) — außer man steht schon in der Karte und braucht den Weg zurück. */}
        {(!ansicht.leer || wahl === 'karte') && <AnsichtChips wert={wahl} onWahl={waehle} className="lg:hidden" />}
      </div>

      <div className={REGION_SPALTEN}>
        {/* Leer: Sorten-Chips bleiben mit der gewählten Sorte, keine Zählzeile (Liste Lauf 32 region, Bild 5). */}
        {ansicht.leer ? (
          <div className="min-w-0">
            <FutterLeerzustand leer={ansicht.leer} filter={filter} link={link} />
          </div>
        ) : (
          zeigeListe && (
            <ul className="flex min-w-0 flex-col gap-2.5">
              {ansicht.angebote.map((angebot) => (
                <li key={angebot.schluessel}>
                  <FutterKarte angebot={angebot} jetzt={jetzt} />
                </li>
              ))}
            </ul>
          )
        )}
        {zeigeKarte && (
          <div className={REGION_KARTEN_SPALTE}>
            <FutterKarteAnsicht karte={ansicht.karte} jetzt={jetzt} />
          </div>
        )}
      </div>

      {/* „Selbst verkaufen“ gehört zur Liste — in der Kartenansicht am Handy steht nur die Karte (Board s1-region Bild 6). */}
      {!nurUmkreis && ansicht.selbst?.art === 'anlegen' && (
        <div className="flex items-start gap-3 rounded-[12px] border border-dashed border-border px-4 py-3.5">
          <Plus className="mt-0.5 size-[17px] shrink-0 text-status-offen" strokeWidth={2} aria-hidden="true" />
          <div className="min-w-0 text-[12.5px] leading-normal text-muted-foreground">
            <p>{FUTTER_SELBST_VERKAUFEN}</p>
            <Link
              href={FUTTER_ANLEGEN_HREF}
              className={cn('mt-1 inline-flex min-h-11 items-center font-semibold text-brand-text underline-offset-4 hover:underline', FOKUS_RAHMEN)}
            >
              Futtermittel anlegen
            </Link>
          </div>
        </div>
      )}
      {!nurUmkreis && ansicht.selbst?.art === 'zeile' && (
        <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] leading-normal text-muted-foreground">
          <Wheat className="size-4 shrink-0 text-status-fertig" strokeWidth={1.8} aria-hidden="true" />
          <span>{ansicht.selbst.satz}</span>
          <Link
            href={ansicht.selbst.href}
            className={cn('inline-flex min-h-11 items-center gap-0.5 font-semibold text-status-fertig underline-offset-4 hover:underline', FOKUS_RAHMEN)}
          >
            {FUTTER_KARTE_TEXT.ansehen}
            <ChevronRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
          </Link>
        </p>
      )}
    </div>
  )
}

/** Leer mit dem einen Ausweg, den die Regel nennt — „Morgen zeigen", „Alles Futter zeigen", „Umkreis auf … km" oder „Alle Tage". */
function FutterLeerzustand({
  leer,
  filter,
  link,
}: {
  leer: FutterLeer
  filter: FutterKaufenFilter
  link: (teil: Partial<FutterKaufenFilter>) => string
}): React.JSX.Element {
  const ausweg = leer.ausweg
  const ziel =
    ausweg === null
      ? null
      : ausweg.art === 'abholung'
        ? link({ abholung: ausweg.abholung })
        : ausweg.art === 'umkreis'
          ? link({ km: ausweg.km })
          : link({ km: filter.km, art: null, menge: null, abholung: null })
  return (
    <EmptyState
      titel={leer.titel}
      satz={leer.satz}
      ausweg={
        ausweg && ziel ? (
          <Link href={ziel} className={cn(KNOPF_RAHMEN, 'w-full justify-center rounded-[10px] border-primary text-status-offen')}>
            {ausweg.label}
            <LadePunkt />
          </Link>
        ) : (
          { ohne: 'Im größten Umkreis ohne Auswahl bleibt kein Ausweg — kein Hof mit LFBIS-Nummer verkauft gerade Futter' }
        )
      }
    />
  )
}
