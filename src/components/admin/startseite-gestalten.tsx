'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarDays, ChevronDown, ChevronUp, Eye, EyeOff, Info, Plus, Send } from 'lucide-react'
import type { StartseiteVorlage } from '@prisma/client'
import {
  ABSCHNITT_TEXT,
  ADMIN_STARTSEITE_TEXT as T,
  BLOCK_ZUSTAND_TEXT,
  NEUER_ABSCHNITT,
  NEUER_BLOCK,
  ZUSATZ_ARTEN,
  blockZustand,
  darfVerschieben,
  istFest,
  standZeitpunkt,
  verschiebe,
  type ZusatzArt,
} from '@/lib/startseite-gestalten'
import {
  ENTWURF_TEXT as E,
  VORLAGE_KURZ,
  aenderungenText,
  liveText,
  standardFassung,
  terminText,
  zeilenMarken,
} from '@/lib/startseite-fassung'
import type { FassungInhalt, VeroeffentlichenEingabe } from '@/schemas/startseite-fassung'
import { cn } from '@/lib/utils'
import type { AdminStartseite } from '@/server/queries/startseite'
import {
  loescheStartseitenBlock,
  speichereEntwurf,
  uebernehmeFassungAlsEntwurf,
  veroeffentlicheStartseite,
  zieheFassungZurueck,
} from '@/server/actions/startseite'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Marke } from '@/components/ui/marke'
import { StatusBadge } from '@/components/ui/status-badge'
import { Segment } from '@/components/ui/segment'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { KARTE, KNOPF_GRUEN, KNOPF_ORANGE_RAHMEN, KNOPF_RAHMEN, LEISE, TEXT_GRUEN } from '@/components/hof-bestellungen/stil'
import { Seitenkopf } from './seitenkopf'
import { StartseiteVorschau, VorschauFenster } from './startseite-vorschau'
import { BlockFormular, Bibliothek, UEBERSCHRIFT, VORLAGE_SYMBOL, ZUSTAND_MARKE, titelVon } from './startseite-block-formular'
import { AenderungsListe, VeroeffentlichenDialog } from './startseite-veroeffentlichen'
import { useFrischBestaetigt } from './frisch-bestaetigen'
import { StartseiteZeitplan, type ZeitplanAktion } from './startseite-zeitplan'
import {
  blockWerteAus,
  entwurfInhalt,
  mitOffenemBlock,
  neueBlockWerte,
  useStartseitenEntwurf,
  type SpeicherStand,
  type Zeile,
} from './startseite-entwurf'

/*
 * Admin › Startseite (Register N16, Nr. 96; seit Nr. 99 Entwurf und Fassung,
 * Mockups admin-startseite-entwurf, -veroeffentlichen, -zeitplan und
 * mobil-admin-startseite-entwurf). Seitenkopf mit Bearbeiten · Zeitplan ·
 * Verlauf. Bearbeiten: oben die Statusleiste (Entwurf, Änderungen gegenüber
 * live, gespeichert, Live und Geplant, „Entwurf verwerfen“, „Veröffentlichen
 * …“), links die Abschnittsliste mit Marken je Zeile, rechts die Vorschau
 * oder — solange ein Block offen ist — sein Formular. Am Handy die
 * Statuskarte oben und unten eine feste Leiste Vorschau · Veröffentlichen …,
 * Vorschau und Dialog als Blatt.
 *
 * Jede Änderung speichert sich nach kurzer Ruhe selbst in den Entwurf
 * (useStartseitenEntwurf); die öffentliche Startseite ändert erst
 * „Veröffentlichen …“. Welche Bewegung erlaubt ist, entscheidet dieselbe Regel
 * wie am Server (darfVerschieben).
 */

const SYMBOL_KNOPF = cn(
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-[250ms] hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent',
  FOKUS_RAHMEN
)

type Ansicht = 'bearbeiten' | 'zeitplan' | 'verlauf'

/** Der Schlüssel einer Zeile der Liste — derselbe wie im Vergleich (zeilenSchluessel). */
function schluesselVon(zeile: Zeile): string {
  return zeile.art === 'BLOCK' ? `block:${zeile.block?.id ?? NEUER_BLOCK}` : zeile.art
}

// ─── Die Liste ──────────────────────────────────────────────────────────────

const EINFUEGEN_KNOPF = cn(
  'flex min-h-11 w-full items-center gap-2 px-4 text-[13.5px] font-semibold text-status-fertig transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
  FOKUS_RAHMEN
)

/**
 * Das Menü zum Hinzufügen: „Block einfügen“ und — solange es ihn im Entwurf
 * nicht gibt — je Zusatz-Abschnitt eine Zeile (Nr. 129, „Neu bei den Höfen“).
 * Hinzugefügt wird er wie ein neuer Block: Die Zeile steht sofort im Entwurf,
 * gespeichert wird mit der nächsten Speicherung.
 */
function EinfuegePunkt({
  onEinfuegen,
  zusatz,
  onZusatz,
  gesperrt,
}: {
  onEinfuegen: () => void
  zusatz: readonly ZusatzArt[]
  onZusatz: (art: ZusatzArt) => void
  gesperrt: boolean
}): React.JSX.Element {
  return (
    <li className="border-t border-border">
      <button type="button" onClick={onEinfuegen} disabled={gesperrt} className={EINFUEGEN_KNOPF}>
        <Plus className="size-4" strokeWidth={1.8} aria-hidden="true" />
        {T.einfuegen}
      </button>
      {zusatz.map((art) => (
        <button key={art} type="button" onClick={() => onZusatz(art)} disabled={gesperrt} className={EINFUEGEN_KNOPF}>
          <Plus className="size-4" strokeWidth={1.8} aria-hidden="true" />
          {T.abschnittEinfuegen(ABSCHNITT_TEXT[art].titel)}
        </button>
      ))}
    </li>
  )
}

function ListenZeile({
  zeile,
  index,
  zeilen,
  jetzt,
  aktiv,
  marke,
  onVerschieben,
  onAuge,
  onWaehlen,
}: {
  zeile: Zeile
  index: number
  zeilen: readonly Zeile[]
  jetzt: Date
  aktiv: boolean
  marke: { text: string; ton: 'tun' | 'laeuft' } | undefined
  onVerschieben: (richtung: -1 | 1) => void
  onAuge: () => void
  onWaehlen: () => void
}): React.JSX.Element {
  const fest = istFest(zeile.art)
  const block = zeile.art === 'BLOCK' ? zeile.block : null
  const titel = titelVon(zeile)
  const anzeige = block ? `${VORLAGE_KURZ[block.vorlage]} · ${block.titel}` : titel
  const zustand = block ? blockZustand({ liveAb: new Date(block.liveAb), liveBis: block.liveBis ? new Date(block.liveBis) : null }, jetzt) : null
  const Symbol = block ? VORLAGE_SYMBOL[block.vorlage] : null
  const titelKlasse = cn('block w-full truncate text-[14px] font-semibold', zeile.sichtbar ? 'text-foreground' : 'text-muted-foreground line-through')

  return (
    <li className={cn('flex min-h-11 items-center gap-1 border-t border-border px-1.5 py-0.5', aktiv && 'bg-accent/12')}>
      {fest ? (
        <span className="w-[88px] shrink-0" aria-hidden="true" />
      ) : (
        <span className="flex shrink-0">
          <button type="button" className={SYMBOL_KNOPF} aria-label={`„${titel}“ nach oben`} disabled={!darfVerschieben(zeilen, index, -1)} onClick={() => onVerschieben(-1)}>
            <ChevronUp className="size-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button type="button" className={SYMBOL_KNOPF} aria-label={`„${titel}“ nach unten`} disabled={!darfVerschieben(zeilen, index, 1)} onClick={() => onVerschieben(1)}>
            <ChevronDown className="size-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </span>
      )}
      {Symbol && <Symbol className="mr-1 hidden size-4 shrink-0 text-status-fertig sm:block" strokeWidth={1.8} aria-hidden="true" />}
      {block ? (
        <button
          type="button"
          onClick={onWaehlen}
          aria-current={aktiv ? 'true' : undefined}
          className={cn('group flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg text-left', FOKUS_RAHMEN)}
        >
          <span className={cn(titelKlasse, 'group-hover:underline')}>{anzeige}</span>
        </button>
      ) : (
        <span className="min-w-0 flex-1 py-1.5">
          <span className={titelKlasse}>{anzeige}</span>
        </span>
      )}
      <span className="flex shrink-0 items-center gap-1.5">
        {fest && <StatusBadge status="neutral">{T.fest}</StatusBadge>}
        {zeile.art === 'BRENNMATERIAL' && <StatusBadge status="neutral">{T.automatik}</StatusBadge>}
        {marke ? (
          <Marke art={marke.ton}>{marke.text}</Marke>
        ) : (
          zustand && <Marke art={ZUSTAND_MARKE[zustand]}>{BLOCK_ZUSTAND_TEXT[zustand]}</Marke>
        )}
        {!fest && (
          <button
            type="button"
            className={cn(SYMBOL_KNOPF, !zeile.sichtbar && 'text-status-offen')}
            aria-label={zeile.sichtbar ? `„${titel}“ ausblenden` : `„${titel}“ einblenden`}
            onClick={onAuge}
          >
            {zeile.sichtbar ? <Eye className="size-4" strokeWidth={1.8} aria-hidden="true" /> : <EyeOff className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          </button>
        )}
      </span>
    </li>
  )
}

function AbschnittsListe({
  zeilen,
  jetzt,
  aktivId,
  marken,
  onZeilen,
  onWaehlen,
  onEinfuegen,
}: {
  zeilen: readonly Zeile[]
  jetzt: Date
  aktivId: string | null
  marken: ReturnType<typeof zeilenMarken>
  onZeilen: (zeilen: Zeile[]) => void
  onWaehlen: (zeile: Zeile) => void
  onEinfuegen: (nachIndex: number) => void
}): React.JSX.Element {
  const hatNeuen = zeilen.some((z) => z.id === NEUER_BLOCK)
  // Jeder Zusatz-Abschnitt höchstens einmal: Steht er schon in der Liste, fehlt er im Menü.
  const zusatz = ZUSATZ_ARTEN.filter((art) => !zeilen.some((z) => z.art === art))
  function fuegeZusatzEin(nachIndex: number, art: ZusatzArt) {
    const neu: Zeile = { id: NEUER_ABSCHNITT[art], art, sichtbar: true, block: null }
    onZeilen([...zeilen.slice(0, nachIndex + 1), neu, ...zeilen.slice(nachIndex + 1)])
  }
  const hoefeIndex = zeilen.findIndex((z) => z.art === 'HOEFE')
  const fussIndex = zeilen.findIndex((z) => z.art === 'FUSS')
  return (
    <section aria-labelledby="abschnitte-titel" className={cn(KARTE, 'overflow-hidden')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        <h2 id="abschnitte-titel" className={UEBERSCHRIFT}>
          {T.liste}
        </h2>
        <span className="flex-1" />
        <span className={cn('text-[12px]', LEISE)}>{T.listeHinweis}</span>
      </div>
      <ul>
        {zeilen.map((zeile, index) => (
          <ListenEintrag
            key={zeile.id}
            zeile={zeile}
            index={index}
            zeilen={zeilen}
            jetzt={jetzt}
            aktiv={zeile.id === aktivId}
            marke={marken.get(schluesselVon(zeile))}
            punktDanach={index === hoefeIndex || index === fussIndex - 1}
            gesperrt={hatNeuen}
            zusatz={zusatz}
            onZeilen={onZeilen}
            onWaehlen={onWaehlen}
            onEinfuegen={onEinfuegen}
            onZusatz={(art) => fuegeZusatzEin(index, art)}
          />
        ))}
      </ul>
    </section>
  )
}

function ListenEintrag({
  zeile,
  index,
  zeilen,
  punktDanach,
  gesperrt,
  zusatz,
  onZeilen,
  onWaehlen,
  onEinfuegen,
  onZusatz,
  ...rest
}: {
  zeile: Zeile
  index: number
  zeilen: readonly Zeile[]
  jetzt: Date
  aktiv: boolean
  marke: { text: string; ton: 'tun' | 'laeuft' } | undefined
  punktDanach: boolean
  gesperrt: boolean
  zusatz: readonly ZusatzArt[]
  onZeilen: (zeilen: Zeile[]) => void
  onWaehlen: (zeile: Zeile) => void
  onEinfuegen: (nachIndex: number) => void
  onZusatz: (art: ZusatzArt) => void
}): React.JSX.Element {
  return (
    <>
      <ListenZeile
        zeile={zeile}
        index={index}
        zeilen={zeilen}
        {...rest}
        onVerschieben={(richtung) => onZeilen(verschiebe(zeilen, index, richtung))}
        onAuge={() => onZeilen(zeilen.map((z, i) => (i === index ? { ...z, sichtbar: !z.sichtbar } : z)))}
        onWaehlen={() => onWaehlen(zeile)}
      />
      {punktDanach && <EinfuegePunkt gesperrt={gesperrt} onEinfuegen={() => onEinfuegen(index)} zusatz={zusatz} onZusatz={onZusatz} />}
    </>
  )
}

// ─── Status ─────────────────────────────────────────────────────────────────

function SpeicherZeile({ stand }: { stand: SpeicherStand }): React.JSX.Element | null {
  if (stand.art === 'ruhe') return null
  if (stand.art === 'fehler') {
    return (
      <span role="alert" className="text-[12.5px] font-medium text-destructive">
        {stand.text}
      </span>
    )
  }
  return (
    <span role="status" className={cn('text-[12.5px]', LEISE)}>
      {stand.art === 'speichert' ? `· ${E.speichert}` : `· gespeichert ${stand.um}`}
    </span>
  )
}

function LiveUndGeplant({ daten, untereinander }: { daten: AdminStartseite; untereinander: boolean }): React.JSX.Element {
  const geplant = daten.geplant[0]
  return (
    <span className={cn('flex text-[13px]', untereinander ? 'flex-col gap-0.5' : 'flex-wrap items-center gap-x-4 gap-y-1', LEISE)}>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 shrink-0 rounded-full bg-status-fertig" aria-hidden="true" />
        <b className="font-semibold text-foreground">{E.live}:</b> {liveText(daten.live?.liveAb ?? null)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        {geplant ? (
          <>
            <b className="font-semibold text-foreground">{E.geplant}:</b> {terminText(new Date(geplant.liveAb))}
            {daten.geplant.length > 1 ? ` (+${daten.geplant.length - 1})` : ''}
          </>
        ) : (
          E.nichtsGeplant
        )}
      </span>
    </span>
  )
}

function VerwerfenFrage({ laeuft, onJa, onNein }: { laeuft: boolean; onJa: () => void; onNein: () => void }): React.JSX.Element {
  return (
    <span role="group" aria-label={E.verwerfenFrage} className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] font-medium text-foreground">{E.verwerfenFrage}</span>
      <button type="button" className={KNOPF_ORANGE_RAHMEN} disabled={laeuft} onClick={onJa}>
        {E.verwerfen}
      </button>
      <button type="button" className={KNOPF_RAHMEN} disabled={laeuft} onClick={onNein}>
        {E.abbrechen}
      </button>
    </span>
  )
}

// ─── Die Seite ──────────────────────────────────────────────────────────────

export function StartseiteGestalten({ daten, jetzt: jetztText }: { daten: AdminStartseite; jetzt: string }): React.JSX.Element {
  const router = useRouter()
  const jetzt = new Date(jetztText)
  const breit = useMindestbreite(1024)
  const liveInhalt: FassungInhalt = daten.live?.inhalt ?? standardFassung()
  const entwurf = useStartseitenEntwurf({ start: daten.zeilen, live: liveInhalt, speichere: speichereEntwurf })
  const [ansicht, setAnsicht] = useState<Ansicht>('bearbeiten')
  const [dialog, setDialog] = useState(false)
  const [dialogFehler, setDialogFehler] = useState<string | null>(null)
  const [vorschauOffen, setVorschauOffen] = useState(false)
  const [fassungVorschau, setFassungVorschau] = useState<Extract<ZeitplanAktion, { art: 'vorschau' }> | { art: 'ansehen-live' } | null>(null)
  const [verwerfen, setVerwerfen] = useState(false)
  const [aktionFehler, setAktionFehler] = useState<string | null>(null)
  const [laeuft, startTransition] = useTransition()

  const angezeigt = mitOffenemBlock(entwurf.zeilen, entwurf.block)
  const inhalt = entwurfInhalt(angezeigt)
  const anzahl = entwurf.aenderungen.length
  const marken = zeilenMarken(entwurf.aenderungen)
  const blockOffen = entwurf.block
  const blockFehler = entwurf.stand.art === 'fehler' && blockOffen ? entwurf.stand.text : null

  const bloeckeEntwurf = angezeigt.flatMap((z) => (z.block ? [{ liveAb: new Date(z.block.liveAb), liveBis: z.block.liveBis ? new Date(z.block.liveBis) : null }] : []))
  const bloeckeLive = liveInhalt.zeilen.flatMap((z) =>
    z.art === 'BLOCK' ? [{ liveAb: new Date(z.block.liveAb), liveBis: z.block.liveBis ? new Date(z.block.liveBis) : null }] : []
  )
  const blockMoeglich = {
    entwurf: standZeitpunkt('block', jetzt, bloeckeEntwurf) !== null,
    live: standZeitpunkt('block', jetzt, bloeckeLive) !== null,
  }
  const termin = daten.geplant[0]?.liveAb ?? null

  /** Was gerade wartet, erst in den Entwurf — dann `weiter` (Block wechseln, schließen, veröffentlichen). */
  function nachSpeichern(weiter: () => void): void {
    void entwurf.speichereSofort().then((ok) => {
      if (ok) weiter()
    })
  }

  function oeffne(zeile: Zeile) {
    if (zeile.id === NEUER_BLOCK || zeile.id === entwurf.block?.zeilenId) return
    nachSpeichern(() => entwurf.oeffneBlock(blockWerteAus(zeile)))
  }

  /** Ein neuer Block nach der Zeile `nachIndex` (Standard: nach „Höfe in deiner Nähe"). Gespeichert wird er mit der ersten Eingabe. */
  function fuegeEin(nachIndex: number, vorlage: StartseiteVorlage = 'SAISONKARTE') {
    if (entwurf.zeilen.some((z) => z.id === NEUER_BLOCK)) return
    nachSpeichern(() => {
      const neu: Zeile = { id: NEUER_BLOCK, art: 'BLOCK', sichtbar: true, block: null }
      const zeilen = entwurf.zeilen
      entwurf.oeffneBlock(neueBlockWerte(vorlage, jetzt), [...zeilen.slice(0, nachIndex + 1), neu, ...zeilen.slice(nachIndex + 1)])
    })
  }

  function waehleVorlage(vorlage: StartseiteVorlage) {
    if (entwurf.block) {
      entwurf.aendereBlock({ ...entwurf.block, vorlage })
      return
    }
    fuegeEin(entwurf.zeilen.findIndex((z) => z.art === 'HOEFE'), vorlage)
  }

  function loeschen() {
    const offen = entwurf.block
    if (!offen) return
    if (!offen.id) {
      // Ein neuer Block, der noch nie gespeichert war: nur die Zeile weg.
      entwurf.oeffneBlock(null, entwurf.zeilen.filter((z) => z.id !== NEUER_BLOCK))
      return
    }
    const blockId = offen.id
    startTransition(async () => {
      await entwurf.speichereSofort()
      const ergebnis = await loescheStartseitenBlock({ blockId })
      if ('error' in ergebnis) {
        toast.error(ergebnis.error)
        return
      }
      entwurf.blockGeloescht(blockId)
      toast.success(T.geloescht)
    })
  }

  // Veröffentlichen ist heikel (Register N20, Ergänzung 23.10.2026): frisch mit Passkey bestätigt.
  const frischVeroeffentlichen = useFrischBestaetigt(veroeffentlicheStartseite)

  function veroeffentlichen(eingabe: VeroeffentlichenEingabe) {
    setDialogFehler(null)
    startTransition(async () => {
      if (!(await entwurf.speichereSofort())) {
        setDialogFehler(entwurf.stand.art === 'fehler' ? entwurf.stand.text : E.nichtGespeichert)
        return
      }
      const ergebnis = await frischVeroeffentlichen.ausfuehren(eingabe)
      if ('error' in ergebnis) {
        setDialogFehler(ergebnis.error)
        return
      }
      setDialog(false)
      toast.success(ergebnis.text)
      router.refresh()
    })
  }

  function uebernimm(id: string | null, satz: string) {
    setAktionFehler(null)
    startTransition(async () => {
      const ergebnis = await uebernehmeFassungAlsEntwurf({ id })
      if ('error' in ergebnis) {
        setAktionFehler(ergebnis.error)
        return
      }
      entwurf.setzeZurueck(ergebnis.zeilen)
      setVerwerfen(false)
      setAnsicht('bearbeiten')
      toast.success(satz)
      router.refresh()
    })
  }

  function zeitplanAktion(aktion: ZeitplanAktion) {
    if (aktion.art === 'vorschau' || aktion.art === 'ansehen-live') {
      setFassungVorschau(aktion)
      return
    }
    if (aktion.art === 'uebernehmen') {
      uebernimm(aktion.id, E.uebernommen)
      return
    }
    setAktionFehler(null)
    startTransition(async () => {
      const ergebnis = await zieheFassungZurueck({ id: aktion.id })
      if ('error' in ergebnis) {
        setAktionFehler(ergebnis.error)
        return
      }
      toast.success(E.zurueckgezogen)
      router.refresh()
    })
  }

  const vorschau = (
    <StartseiteVorschau
      blockMoeglich={blockMoeglich}
      termin={termin}
      blockEntwurfId={entwurf.block?.id ?? null}
      neuLaden={entwurf.speicherungen}
      geraetStandard={breit ? 'web' : 'handy'}
    />
  )

  const knoepfe = (
    <>
      <button type="button" className={KNOPF_RAHMEN} disabled={anzahl === 0 || laeuft} onClick={() => setVerwerfen(true)}>
        {E.verwerfen}
      </button>
      <button type="button" className={KNOPF_GRUEN} disabled={anzahl === 0} onClick={() => setDialog(true)}>
        <Send className="size-4" strokeWidth={1.8} aria-hidden="true" />
        {E.veroeffentlichen}
      </button>
    </>
  )

  return (
    <div className={cn('flex flex-col gap-4', ansicht === 'bearbeiten' && 'pb-24 lg:pb-0')}>
      <Seitenkopf
        titel={T.titel}
        satz={ansicht === 'bearbeiten' ? E.satz : E.satzZeitplan}
        rechts={
          <Segment
            beschriftung="Ansicht"
            optionen={[
              { wert: 'bearbeiten', label: E.bearbeiten },
              { wert: 'zeitplan', label: daten.geplant.length > 0 ? `${E.zeitplan} · ${daten.geplant.length}` : E.zeitplan },
              { wert: 'verlauf', label: E.verlauf },
            ]}
            wert={ansicht}
            onWertChange={(w) => setAnsicht(w as Ansicht)}
          />
        }
      />

      {ansicht === 'bearbeiten' ? (
        <>
          {/* Statusleiste (ab 1024 px) bzw. Statuskarte (Handy) — dieselben Angaben. */}
          <section
            aria-label={E.entwurf}
            className={cn(KARTE, 'flex flex-col gap-2 border-primary/45 px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-[18px]')}
          >
            <span className="flex flex-wrap items-center gap-2.5">
              <Marke art="tun">{E.entwurf}</Marke>
              <span className="text-[14px] font-semibold text-foreground">{aenderungenText(anzahl, breit)}</span>
              <SpeicherZeile stand={entwurf.stand} />
            </span>
            <LiveUndGeplant daten={daten} untereinander={!breit} />
            <span className="hidden flex-1 lg:block" />
            {verwerfen ? (
              <VerwerfenFrage laeuft={laeuft} onJa={() => uebernimm(daten.live?.id ?? null, E.verworfen)} onNein={() => setVerwerfen(false)} />
            ) : (
              <span className="hidden flex-wrap items-center gap-2 lg:flex">{knoepfe}</span>
            )}
            {!verwerfen && anzahl > 0 && (
              <button type="button" className={cn(TEXT_GRUEN, 'self-start px-0 lg:hidden')} onClick={() => setVerwerfen(true)}>
                {E.verwerfen}
              </button>
            )}
            {aktionFehler && (
              <p role="alert" className="text-[13px] font-medium text-destructive lg:basis-full">
                {aktionFehler}
              </p>
            )}
          </section>

          <div className="flex flex-col gap-[22px] lg:flex-row lg:items-start">
            <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[480px]">
              <AbschnittsListe
                zeilen={angezeigt}
                jetzt={jetzt}
                aktivId={entwurf.block?.zeilenId ?? null}
                marken={marken}
                onZeilen={entwurf.aendereZeilen}
                onWaehlen={oeffne}
                onEinfuegen={(nachIndex) => fuegeEin(nachIndex)}
              />
              <p className={cn('text-[12.5px] lg:hidden', LEISE)}>{E.gespeichertHandy}</p>
              <div className={cn(KARTE, 'hidden items-center gap-3 px-4 py-3 lg:flex')}>
                <Info className="size-4 shrink-0 text-status-fertig" strokeWidth={1.8} aria-hidden="true" />
                <p className={cn('text-[12.5px] leading-snug', LEISE)}>
                  <b className="font-semibold text-foreground">{E.gespeichertTitel}</b> {E.gespeichertSatz}
                </p>
              </div>
              <div className="hidden lg:block">
                <AenderungsListe aenderungen={entwurf.aenderungen} />
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3.5">
              {blockOffen ? (
                <>
                  <BlockFormular
                    werte={blockOffen}
                    zeilen={angezeigt}
                    daten={daten}
                    jetzt={jetzt}
                    fehler={blockFehler}
                    loescht={laeuft}
                    onWerte={entwurf.aendereBlock}
                    onFertig={() => nachSpeichern(() => entwurf.oeffneBlock(null))}
                    onLoeschen={loeschen}
                  />
                  <Bibliothek onVorlage={waehleVorlage} />
                </>
              ) : (
                breit && vorschau
              )}
            </div>
          </div>

          {/* Am Handy: feste Leiste unten, 48 px, über der Safe-Area (Mockup mobil-admin-startseite-entwurf).
              data-unten-fest: Der Cookie-Hinweis steht über der Leiste (src/lib/cookie-hinweis.ts). */}
          <div data-unten-fest="" className="fixed inset-x-0 bottom-0 z-30 flex gap-2.5 border-t border-border bg-card px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
            <button type="button" className={cn(KNOPF_RAHMEN, 'h-12 flex-1')} onClick={() => setVorschauOffen(true)}>
              <Eye className="size-4" strokeWidth={1.8} aria-hidden="true" />
              {E.vorschauKnopf}
            </button>
            <button type="button" className={cn(KNOPF_GRUEN, 'h-12 flex-[1.3]')} disabled={anzahl === 0} onClick={() => setDialog(true)}>
              {E.veroeffentlichen}
            </button>
          </div>
          {!breit && (
            <VorschauFenster offen={vorschauOffen} onOffenChange={setVorschauOffen} titel={T.kundin}>
              {vorschauOffen && vorschau}
            </VorschauFenster>
          )}
        </>
      ) : (
        <StartseiteZeitplan
          daten={daten}
          jetzt={jetztText}
          nurVerlauf={ansicht === 'verlauf'}
          laeuft={laeuft}
          fehler={aktionFehler}
          onAktion={zeitplanAktion}
        />
      )}

      <VeroeffentlichenDialog
        key={dialog ? 'offen' : 'zu'}
        offen={dialog}
        onOffenChange={(offen) => {
          setDialog(offen)
          if (!offen) setDialogFehler(null)
        }}
        aenderungen={entwurf.aenderungen}
        entwurf={inhalt}
        jetzt={jetztText}
        laeuft={laeuft}
        fehler={dialogFehler}
        onVeroeffentlichen={veroeffentlichen}
      >
        {frischVeroeffentlichen.dialog}
      </VeroeffentlichenDialog>

      <VorschauFenster
        offen={fassungVorschau !== null}
        onOffenChange={(offen) => {
          if (!offen) setFassungVorschau(null)
        }}
        titel={fassungVorschau?.art === 'vorschau' && fassungVorschau.geplant ? `${E.geplant}: ${terminText(new Date(fassungVorschau.fassung.liveAb))}` : E.live}
      >
        {fassungVorschau && <FassungVorschau aktion={fassungVorschau} jetzt={jetzt} breit={breit} />}
      </VorschauFenster>
    </div>
  )
}

/** Die Vorschau einer Fassung aus dem Zeitplan — geplant am Termin, live heute. */
function FassungVorschau({
  aktion,
  jetzt,
  breit,
}: {
  aktion: Extract<ZeitplanAktion, { art: 'vorschau' }> | { art: 'ansehen-live' }
  jetzt: Date
  breit: boolean
}): React.JSX.Element {
  if (aktion.art === 'ansehen-live') {
    return <StartseiteVorschau quelle="live" band="live" blockMoeglich={{ entwurf: false, live: false }} termin={null} blockEntwurfId={null} geraetStandard={breit ? 'web' : 'handy'} />
  }
  const { fassung, geplant } = aktion
  const bloecke = fassung.inhalt.zeilen.flatMap((z) =>
    z.art === 'BLOCK' ? [{ liveAb: new Date(z.block.liveAb), liveBis: z.block.liveBis ? new Date(z.block.liveBis) : null }] : []
  )
  return (
    <StartseiteVorschau
      quelle={`fassung:${fassung.id}`}
      band={geplant ? 'geplant' : 'live'}
      blockMoeglich={{ entwurf: false, live: standZeitpunkt('block', jetzt, bloecke) !== null }}
      termin={geplant ? fassung.liveAb : null}
      standStandard={geplant ? 'termin' : 'heute'}
      blockEntwurfId={null}
      geraetStandard={breit ? 'web' : 'handy'}
    />
  )
}
