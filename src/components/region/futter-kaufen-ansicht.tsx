'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronRight, Clock, Plus, Wheat } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { LadePunkt } from '@/components/ui/lade-punkt'
import { Segment } from '@/components/ui/segment'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { KmWahl } from '@/components/region/km-wahl'
import { ErklaerKnopf } from '@/components/region/erklaer-knopf'
import { FutterKarte } from '@/components/region/futter-karte'
import { FUTTER_ANLEGEN_HREF } from '@/lib/bauern-navigation'
import { ABHOLUNG_TEXT } from '@/lib/hoefe-entdecken'
import {
  FUTTER_ERKLAERUNG,
  FUTTER_KARTE_TEXT,
  FUTTER_KAUFEN_HINWEIS,
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
  loading: () => <div className="h-[60vh] min-h-[320px] animate-pulse rounded-2xl bg-muted" aria-hidden="true" />,
})

const ANSICHTEN = [
  { wert: 'liste', label: 'Liste' },
  { wert: 'karte', label: 'Karte' },
] as const

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
  const link = (teil: Partial<FutterKaufenFilter>): string => futterKaufenLink({ ...filter, ...teil }, wahl)

  function waehle(neu: FutterAnsichtWahl): void {
    const ziel = futterKaufenLink(filter, neu)
    window.history.replaceState(null, '', `${pfad}${ziel.slice(ziel.indexOf('?'))}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <KmWahl
          stufen={UMFELD_KM.map((km) => ({ km, href: link({ km }), aktiv: km === filter.km }))}
          zahlen={ansicht.zahlenJeStufe}
          zahlLabel={FUTTER_KARTE_TEXT.umkreisZahl}
        />
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
        <div className="flex items-center gap-2">
          <Clock className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
          <FilterChipReihe beschriftung={ABHOLUNG_TEXT.beschriftung} className="min-w-0 flex-1">
            {ansicht.abholungChips.map((chip) => (
              <FilterChip key={chip.wert ?? 'alle'} href={link({ abholung: chip.wert })} aktiv={chip.aktiv} ladePunkt>
                {chip.label}
              </FilterChip>
            ))}
          </FilterChipReihe>
        </div>
      </div>

      {/* Liste | Karte ist Zustand der Seite (replaceState), kein Filter — deshalb Segment, nicht FilterChips. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex items-center gap-2 text-[12.5px] leading-normal text-muted-foreground">
            {/* Am Handy die Zeile mit der Zahl (Board v2, Handy 3), am Computer der Satz (Board v3) — beide mit (i). */}
            <span className="min-w-0 md:hidden">{ansicht.zahlZeile}</span>
            <span className="hidden min-w-0 md:inline">{FUTTER_KAUFEN_HINWEIS}</span>
            <ErklaerKnopf titel={FUTTER_ERKLAERUNG.titel} punkte={FUTTER_ERKLAERUNG.punkte} />
          </p>
          {ansicht.hinweise.map((hinweis) => (
            <p key={hinweis} className="text-[12.5px] leading-normal text-muted-foreground">
              {hinweis}
            </p>
          ))}
        </div>
        <Segment
          beschriftung="Ansicht wählen"
          optionen={ANSICHTEN}
          wert={wahl}
          onWertChange={(neu) => waehle(neu === 'karte' ? 'karte' : 'liste')}
        />
      </div>

      {ansicht.leer && <FutterLeerzustand leer={ansicht.leer} filter={filter} link={link} />}

      {wahl === 'karte' ? (
        <FutterKarteAnsicht karte={ansicht.karte} jetzt={jetzt} />
      ) : (
        !ansicht.leer && (
          <ul className="flex flex-col gap-2.5">
            {ansicht.angebote.map((angebot) => (
              <li key={angebot.schluessel}>
                <FutterKarte angebot={angebot} jetzt={jetzt} />
              </li>
            ))}
          </ul>
        )
      )}

      {ansicht.selbst?.art === 'anlegen' && (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border px-4 py-3.5">
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
      {ansicht.selbst?.art === 'zeile' && (
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
      symbol={Wheat}
      titel={leer.titel}
      satz={leer.satz}
      ausweg={
        ausweg && ziel ? (
          <Link href={ziel} className={KNOPF_RAHMEN}>
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
