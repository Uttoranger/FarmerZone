import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { INFOSEITE_ABSCHNITT, INFOSEITE_LINK } from '@/components/shared/infoseite-stil'
import { AgbStuecke } from '@/components/rechtstexte/agb-stuecke'
import {
  agbAnker,
  agbPunktZahl,
  agbTeilAnker,
  type AgbAnhang,
  type AgbBlock,
  type AgbFassungDaten,
  type AgbKurzErklaert,
  type AgbPunkt,
  type AgbTeil,
} from '@/lib/rechtstexte/agb-bloecke'
import type { AgbKontext } from '@/lib/rechtstexte/stuecke'
import { BELEHRUNG } from '@/lib/widerruf'
import { RECHTSTEXT_TEXT, type RechtstextVerzeichnisDaten } from '@/components/shared/rechtstext-vorlage'

/*
 * Die Teile der Seiten /agb und /agb/<Fassung> (Register O4, N45), gezeichnet
 * aus den Daten der Fassung, die die Seite als Prop gibt (agb-0-9.ts bzw.
 * agb.ts) — samt `kontext` für den Tag des Inkrafttretens. Formen der Infoseiten (infoseite-stil.ts):
 * Fließtext leise, Überschriften in Fraunces, Links grün und unterstrichen.
 * Jede Überschrift trägt eine Sprungmarke und einen Abstand nach oben
 * (scroll-mt), damit die klebende Kopfzeile sie beim Springen nicht verdeckt.
 * Seit Nr. 231 steht die Seite in der Vorlage der Rechtsseiten
 * (src/components/shared/rechtstext-vorlage.tsx); das Verzeichnis zeichnet
 * die Vorlage, hier stehen nur seine Sprünge (`agbVerzeichnis`).
 */

// Links im AGB-Text: die Form der Infoseiten (infoseite-stil bleibt unverändert, A001). Links im Fließtext brauchen keine
// 44-px-Fläche (WCAG 2.5.8, Ausnahme für Inline-Links); eine ::after-Fläche würde in dichten Absätzen mit den Nachbarzeilen überlappen.
const STUECKE = { linkKlasse: INFOSEITE_LINK } as const

/** Die Sprungmarke von „Kurz erklärt“ — Überschrift und Verzeichnis nehmen dieselbe. */
const KURZ_ERKLAERT_ANKER = 'kurz-erklaert'

function Block({ block, kontext }: { block: AgbBlock; kontext: AgbKontext }): React.JSX.Element {
  const stuecke = { ...STUECKE, kontext }
  switch (block.art) {
    case 'absatz':
      return (
        <p>
          {block.nummer && (
            <>
              <span className="font-semibold text-foreground tabular-nums">{block.nummer}</span>{' '}
            </>
          )}
          <AgbStuecke stuecke={block.stuecke} {...stuecke} />
        </p>
      )
    case 'liste':
      return (
        <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
          {block.eintraege.map((eintrag, i) => (
            <li key={i}>
              <AgbStuecke stuecke={eintrag} {...stuecke} />
            </li>
          ))}
        </ul>
      )
    case 'tabelle':
      return (
        <Table className="text-[14px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {block.kopf.map((spalte, i) => (
                <TableHead key={i} className="h-auto px-0 py-2 pr-4 align-bottom whitespace-normal">
                  {spalte}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {block.zeilen.map((zeile, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                {zeile.map((zelle, j) => (
                  <TableCell key={j} className="px-0 py-2.5 pr-4 align-top whitespace-normal">
                    {zelle}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )
    case 'zeilen':
      return (
        <p>
          {block.zeilen.map((zeile, i) => (
            <span key={i} className="block">
              <AgbStuecke stuecke={zeile} {...stuecke} />
            </span>
          ))}
        </p>
      )
    case 'hinweis':
      return (
        <p className={block.kursiv ? 'italic' : undefined}>
          <AgbStuecke stuecke={block.stuecke} {...stuecke} />
        </p>
      )
    case 'belehrung':
      // Das gesetzliche Muster wörtlich aus src/lib/widerruf.ts (Anhang I Teil A FAGG), mit dessen Platzhaltern.
      return (
        <div className="flex flex-col gap-3 border-l-2 border-border pl-4">
          {BELEHRUNG.teilA.abschnitte.map((abschnitt) => (
            <div key={abschnitt.titel} className="flex flex-col gap-2">
              <h4 className="font-semibold text-foreground">{abschnitt.titel}</h4>
              {abschnitt.absaetze.map((text) => (
                <p key={text}>{text}</p>
              ))}
            </div>
          ))}
        </div>
      )
    case 'formular':
      // Das Muster-Widerrufsformular (Anhang I Teil B FAGG) — Zeilen untereinander wie im Gesetz.
      return (
        <div className="flex flex-col gap-3 border-l-2 border-border pl-4">
          <p>{BELEHRUNG.teilB.einleitung}</p>
          <p>
            {BELEHRUNG.teilB.zeilen.map((zeile) => (
              <span key={zeile} className="block">
                {zeile}
              </span>
            ))}
          </p>
          <p>{BELEHRUNG.teilB.fussnote}</p>
        </div>
      )
  }
}

function Punkt({ punkt, kontext }: { punkt: AgbPunkt; kontext: AgbKontext }): React.JSX.Element {
  const anker = agbAnker(punkt.nummer)
  return (
    <section aria-labelledby={anker}>
      <h3 id={anker} className="mb-2 scroll-mt-20 font-heading text-[16px] leading-snug font-semibold text-foreground">
        {punkt.nummer}. {punkt.titel}
      </h3>
      <div className="flex flex-col gap-3">
        {punkt.bloecke.map((block, i) => (
          <Block key={i} block={block} kontext={kontext} />
        ))}
      </div>
    </section>
  )
}

/** Ein Teil (A bis D) mit seinen Punkten. */
export function TeilAbschnitt({ teil, kontext }: { teil: AgbTeil; kontext: AgbKontext }): React.JSX.Element {
  const anker = agbTeilAnker(teil.id)
  return (
    <section aria-labelledby={anker} className="border-t border-border pt-8">
      <h2 id={anker} className={cn(INFOSEITE_ABSCHNITT, 'scroll-mt-20 text-[20px]')}>
        {teil.titel}
      </h2>
      <div className="flex flex-col gap-8">
        {teil.punkte.map((punkt) => (
          <Punkt key={punkt.nummer} punkt={punkt} kontext={kontext} />
        ))}
      </div>
    </section>
  )
}

/** Ein Anhang (0.9: das Muster-Rücktrittsformular; 1.0: Belehrung, Formular, Auftragsverarbeitung), beim Drucken auf einer eigenen Seite. */
export function AnhangAbschnitt({ anhang, kontext }: { anhang: AgbAnhang; kontext: AgbKontext }): React.JSX.Element {
  return (
    <section aria-labelledby={anhang.anker} className="border-t border-border pt-8 print:break-before-page">
      <h2 id={anhang.anker} className={cn(INFOSEITE_ABSCHNITT, 'scroll-mt-20 text-[20px]')}>
        {anhang.titel}
      </h2>
      <div className="flex flex-col gap-3">
        {anhang.bloecke.map((block, i) => (
          <Block key={i} block={block} kontext={kontext} />
        ))}
      </div>
    </section>
  )
}

/**
 * „Kurz erklärt": die Einleitung über den AGB, ausdrücklich kein Teil von
 * ihnen. Eine Karte auf der Fläche, damit sie sich vom Vertragstext abhebt
 * (seit Nr. 231 nach Board w3-rechtstexte Bild 1 statt der grünen Hinweiskarte).
 */
export function KurzErklaert({ kurzErklaert, kontext }: { kurzErklaert: AgbKurzErklaert; kontext: AgbKontext }): React.JSX.Element {
  return (
    <section aria-labelledby={KURZ_ERKLAERT_ANKER} className="rounded-2xl border border-border bg-card px-4 py-3.5 text-[14px] text-foreground">
        <h2 id={KURZ_ERKLAERT_ANKER} className="scroll-mt-20 font-heading text-[16px] font-semibold text-foreground">
          {kurzErklaert.titel} <span className="font-sans text-[12.5px] font-normal text-muted-foreground">({kurzErklaert.zusatz})</span>
        </h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
          {kurzErklaert.punkte.map((stuecke, i) => (
            <li key={i}>
              <AgbStuecke stuecke={stuecke} {...STUECKE} kontext={kontext} />
            </li>
          ))}
        </ul>
    </section>
  )
}

/**
 * Das Inhaltsverzeichnis der AGB für die Vorlage der Rechtsseiten
 * (`RechtstextVorlage`, Nr. 231): zuerst „Kurz erklärt“, dann ein Sprung je
 * Punkt, nach Teilen gruppiert, zuletzt die Anhänge. Nur der Rahmen — Titel
 * und Nummern kommen unverändert aus den Daten der Fassung.
 */
export function agbVerzeichnis(fassung: AgbFassungDaten): RechtstextVerzeichnisDaten {
  return {
    kennung: 'agb-inhalt',
    zusammenfassung: RECHTSTEXT_TEXT.teileUndPunkte(fassung.teile.length, agbPunktZahl(fassung), fassung.anhaenge.length > 0),
    gruppen: [
      { eintraege: [{ anker: KURZ_ERKLAERT_ANKER, text: fassung.kurzErklaert.titel }] },
      ...fassung.teile.map((teil) => ({
        titel: teil.titel,
        eintraege: teil.punkte.map((punkt) => ({ anker: agbAnker(punkt.nummer), text: punkt.titel, nummer: punkt.nummer })),
      })),
      { eintraege: fassung.anhaenge.map((anhang) => ({ anker: anhang.anker, text: anhang.titel })), betont: true },
    ],
  }
}

/** Der ganze Text einer Fassung, wie /agb und /agb/<Fassung> ihn zeigen: Kurz erklärt, Teil A bis D, die Anhänge. */
export function AgbText({ fassung, kontext }: { fassung: AgbFassungDaten; kontext: AgbKontext }): React.JSX.Element {
  return (
    <>
      <KurzErklaert kurzErklaert={fassung.kurzErklaert} kontext={kontext} />
      {fassung.teile.map((teil) => (
        <TeilAbschnitt key={teil.id} teil={teil} kontext={kontext} />
      ))}
      {fassung.anhaenge.map((anhang) => (
        <AnhangAbschnitt key={anhang.anker} anhang={anhang} kontext={kontext} />
      ))}
    </>
  )
}
