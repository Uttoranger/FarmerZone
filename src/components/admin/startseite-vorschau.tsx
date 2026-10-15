'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, CalendarDays } from 'lucide-react'
import {
  ABSCHNITT_TEXT,
  ADMIN_STARTSEITE_TEXT as T,
  STAND_TEXT,
  standText,
  standZeitpunkt,
  zuRendern,
  type AbschnittArt,
  type StandWahl,
  type StartseitenZeile,
} from '@/lib/startseite-gestalten'
import { istBrennmaterialSaison } from '@/lib/brennmaterial-saison'
import { VORSCHAU_HANDY_HOEHE, VORSCHAU_SEITENBREITE, vorschauMassstab, type VorschauGeraet } from '@/lib/hofseite-vorschau'
import { useElementGroesse } from '@/lib/use-element-groesse'
import { cn } from '@/lib/utils'
import type { AdminStartseitenZeile } from '@/server/queries/startseite'
import { erzeugeStartseitenVorschau } from '@/server/actions/startseite'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Segment } from '@/components/ui/segment'
import { KARTE, LEISE } from '@/components/hof-bestellungen/stil'

/*
 * „So sieht’s die Kundin" in Admin › Startseite (Register N16, Nr. 96;
 * Mockup admin-startseite-vorschau): die ECHTE Startseite im Rahmen — Handy
 * 304 px (390 CSS-px verkleinert) oder Web (1 440 CSS-px auf die Breite des
 * Panels), dieselben Maße wie die Vorschau in Mein Hof (src/lib/hofseite-
 * vorschau.ts). Der Rahmen von Mein Hof (hofseite-vorschau-rahmen.tsx) hängt
 * an der Adresse einer Hofseite — darum ein eigener Rahmen hier.
 *
 * Die Adresse holt die Action (erzeugeStartseitenVorschau): signiert, eine
 * Stunde gültig, und sie schaltet für diesen Browser den Draft Mode ein. „Stand
 * am" wählt den Tag: heute, in einer Woche oder der Beginn des nächsten Blocks.
 */

const HANDY_SCHIRM = 304
const WEB_RAHMEN_HOEHE = 680

type Link = { pfad: string; stand: string } | { fehler: string }

/** Die Zeilen der Admin-Liste so, wie die Startseite sie bekommt. */
function alsStartseitenZeilen(zeilen: readonly AdminStartseitenZeile[]): StartseitenZeile[] {
  return zeilen.flatMap((z): StartseitenZeile[] => {
    if (z.art !== 'BLOCK') return [{ art: z.art as AbschnittArt, sichtbar: z.sichtbar }]
    return z.block ? [{ art: 'BLOCK', sichtbar: z.sichtbar, block: z.block }] : []
  })
}

/** Was am gewählten Tag anders ist als die bloße Liste: Blöcke, Automatik, Ausgeblendetes (Mockup, rechte Spalte). */
function amTag(zeilen: readonly AdminStartseitenZeile[], datum: Date, blockEntwurfId: string | null): { art: string; text: string }[] {
  const liste = alsStartseitenZeilen(zeilen)
  const saison = istBrennmaterialSaison(datum)
  const eintraege = zuRendern(liste, datum, { brennmaterialSaison: saison, blockEntwurfId })
  const zeilenTexte: { art: string; text: string }[] = []
  for (const e of eintraege) if (e.art === 'BLOCK') zeilenTexte.push({ art: 'Block', text: e.block.titel })
  if (!saison && liste.some((z) => z.art === 'BRENNMATERIAL' && z.sichtbar)) {
    zeilenTexte.push({ art: T.automatik, text: 'Brennmaterial aus (nur Okt.–März)' })
  }
  for (const z of liste) {
    if (!z.sichtbar && z.art !== 'BLOCK') zeilenTexte.push({ art: 'Aus', text: `${ABSCHNITT_TEXT[z.art].titel} ausgeblendet` })
  }
  return zeilenTexte
}

function Rahmen({ geraet, link }: { geraet: VorschauGeraet; link: Link | null }): React.JSX.Element {
  const { ref, breite } = useElementGroesse()
  const massstab = geraet === 'web' ? vorschauMassstab({ breite }, 'web') : vorschauMassstab({ breite: HANDY_SCHIRM }, 'handy')
  const hoehe = geraet === 'web' ? Math.round(WEB_RAHMEN_HOEHE / massstab) : VORSCHAU_HANDY_HOEHE
  const seite = VORSCHAU_SEITENBREITE[geraet]
  const pfad = link && 'pfad' in link ? link.pfad : null

  const innen = (
    <div className="relative overflow-hidden bg-background" style={{ width: Math.round(seite * massstab), height: Math.round(hoehe * massstab) }}>
      {pfad ? (
        <iframe
          key={pfad}
          title="Vorschau der Startseite"
          src={pfad}
          className="absolute top-0 left-0 border-0"
          style={{ width: seite, height: hoehe, transform: `scale(${massstab})`, transformOrigin: 'top left' }}
        />
      ) : (
        <div className="h-full animate-pulse bg-muted" aria-busy="true" />
      )}
    </div>
  )

  if (geraet === 'handy') {
    // Ein Gerät, kein Teil der Seite: fast schwarz in beiden Modi wie in Mein Hof (hofseite-vorschau-rahmen.tsx).
    return (
      <div className="mx-auto w-fit rounded-[2.4rem] border border-border bg-primary-foreground p-2 shadow-[0_12px_32px] shadow-primary-foreground/30">
        <div className="overflow-hidden rounded-[2rem]">{innen}</div>
      </div>
    )
  }
  return (
    <div ref={ref} className="w-full overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex h-9 items-center gap-3 border-b border-border bg-muted px-3" aria-hidden="true">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/50" />
          <span className="size-2.5 rounded-full bg-muted-foreground/50" />
          <span className="size-2.5 rounded-full bg-muted-foreground/50" />
        </span>
        <span className="mx-auto max-w-[70%] truncate rounded-full bg-card px-3 py-0.5 text-[11.5px] text-muted-foreground ring-1 ring-border">/</span>
        <span className="w-9" />
      </div>
      {breite > 0 && innen}
    </div>
  )
}

export function StartseiteVorschau({
  zeilen,
  jetzt,
  blockEntwurfId,
  ungespeichert,
}: {
  zeilen: readonly AdminStartseitenZeile[]
  /** Der Zeitpunkt der Seite (ISO) — kein Date.now() beim Rendern (CODING_STANDARDS §2). */
  jetzt: string
  blockEntwurfId: string | null
  ungespeichert: boolean
}): React.JSX.Element {
  const [geraet, setGeraet] = useState<VorschauGeraet>('handy')
  const [stand, setStand] = useState<StandWahl>('heute')
  const [link, setLink] = useState<Link | null>(null)

  const bloecke = zeilen.flatMap((z) => (z.block ? [{ liveAb: new Date(z.block.liveAb), liveBis: z.block.liveBis ? new Date(z.block.liveBis) : null }] : []))
  const datum = standZeitpunkt(stand, new Date(jetzt), bloecke)
  const optionen = (['heute', 'woche', 'block'] as const).filter((w) => w !== 'block' || standZeitpunkt('block', new Date(jetzt), bloecke) !== null)

  useEffect(() => {
    let gueltig = true
    void erzeugeStartseitenVorschau({ stand, blockEntwurfId }).then((ergebnis) => {
      if (!gueltig) return
      setLink('error' in ergebnis ? { fehler: ergebnis.error } : { pfad: ergebnis.pfad, stand: ergebnis.stand })
    })
    return () => {
      gueltig = false
    }
  }, [stand, blockEntwurfId])

  const pfad = link && 'pfad' in link ? link.pfad : null

  return (
    <section aria-labelledby="kundin-titel" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="kundin-titel" className="font-heading text-lg font-semibold text-foreground">
          {T.kundin}
        </h2>
        <Segment
          beschriftung="Gerät der Vorschau"
          optionen={[
            { wert: 'handy', label: 'Handy' },
            { wert: 'web', label: 'Web' },
          ]}
          wert={geraet}
          onWertChange={(w) => setGeraet(w as VorschauGeraet)}
        />
        <span className="flex-1" />
        <span className={cn('inline-flex items-center gap-1.5 text-[13px]', LEISE)}>
          <CalendarDays className="size-4" strokeWidth={1.8} aria-hidden="true" />
          Stand am <span className="font-semibold text-foreground">{datum ? standText(datum) : '–'}</span>
        </span>
        <Segment
          beschriftung="Stand am"
          optionen={optionen.map((w) => ({ wert: w, label: STAND_TEXT[w] }))}
          wert={stand}
          onWertChange={(w) => setStand(w as StandWahl)}
        />
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <Rahmen geraet={geraet} link={link} />
        </div>
        <aside className="flex w-full shrink-0 flex-col gap-3 xl:w-[280px]" aria-label="Zur Vorschau">
          <div className={cn(KARTE, 'px-4 py-3')}>
            <h3 className="text-[13.5px] font-semibold text-foreground">{T.vorschauTitel}</h3>
            <p className={cn('mt-1 text-[12.5px] leading-normal', LEISE)}>{T.vorschauSatz}</p>
            {ungespeichert && <p className="mt-1.5 text-[12.5px] font-medium text-status-offen">{T.vorschauUngespeichert}</p>}
          </div>
          {datum && (
            <div className={cn(KARTE, 'px-4 py-3')}>
              <h3 className="text-[13.5px] font-semibold text-foreground">Am {standText(datum)}</h3>
              <ul className="mt-1.5 flex flex-col gap-1">
                {amTag(zeilen, datum, blockEntwurfId).map((z) => (
                  <li key={`${z.art}-${z.text}`} className="flex gap-2 text-[12.5px]">
                    <span className="w-[72px] shrink-0 font-semibold text-muted-foreground">{z.art}</span>
                    <span className="min-w-0 text-foreground">{z.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className={cn(KARTE, 'flex flex-col gap-2 px-4 py-3')}>
            <h3 className="text-[13.5px] font-semibold text-foreground">{T.vorschauLinkTitel}</h3>
            <p className={cn('text-[12.5px] leading-normal', LEISE)}>{T.vorschauLinkSatz}</p>
            {link && 'fehler' in link && (
              <p role="alert" className="text-[12.5px] font-medium text-destructive">
                {link.fehler}
              </p>
            )}
            {pfad && (
              <a
                href={pfad}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted',
                  FOKUS_RAHMEN
                )}
              >
                {T.vorschauOeffnen}
                <ArrowUpRight className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                <span className="sr-only"> (öffnet in neuem Tab)</span>
              </a>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
