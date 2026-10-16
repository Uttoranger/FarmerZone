'use client'

import { createContext, useContext, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowUpDown, MoreHorizontal } from 'lucide-react'
import { fasseZusammenAction, trenneDuplikatAction, triageMeldungAction } from '@/server/actions/admin'
import {
  ERLEDIGT_OEFFENTLICH,
  MELDUNGEN_TEXT,
  MELDUNG_ART_LABEL,
  MELDUNG_ART_MARKE,
  MELDUNG_KLICK_TEXT,
  STATUS_INTERN,
  WUENSCHE_TEXT,
  kannHauptmeldungSein,
  sucheMeldungen,
  triageAufruf,
  type SuchMeldung,
  type TriageStand,
} from '@/lib/meldung'
import { eingangMeldungAdresse } from '@/lib/postfach'
import { cn } from '@/lib/utils'
import { Marke } from '@/components/ui/marke'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLinkItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FELD, FELD_LABEL, KICKER, KNOPF_RAHMEN, LEISE, TEXT_GRUEN } from '@/components/hof-bestellungen/stil'

/*
 * Die Werkzeuge des Reiters „Meldungen" (Register N14, Ergänzung; Nr. 101;
 * Mockups admin-postfach-meldungen-ablauf, admin-postfach-zusammenfassen,
 * admin-postfach-wuensche): EIN Ort für die Dialoge Zusammenfassen, Ablegen,
 * Ins Bündel und Dazunehmen. Er sitzt über dem ganzen Reiter, damit ein
 * Dialog, den ein Toast öffnet („Ins Bündel …"), stehen bleibt, wenn die Karte
 * nach dem Klick in einen anderen Teil wandert. Jeder Klick schreibt über
 * triageMeldungAction mit gespeichertem Stand und Ausgangsstand — ändert
 * inzwischen jemand anderes die Meldung, sagt die Action es, statt es zu
 * überschreiben. Meldungstexte stehen nur als Text da.
 */

type Werkzeug = {
  zusammenfassen: (duplikat: SuchMeldung) => void
  ablegen: (meldung: SuchMeldung) => void
  insBuendel: (meldungId: string, stand: TriageStand) => void
  dazunehmen: (clusterKey: string) => void
}

const WerkzeugKontext = createContext<Werkzeug | null>(null)

export function useMeldungenWerkzeug(): Werkzeug | null {
  return useContext(WerkzeugKontext)
}

type Offen =
  | { art: 'zusammenfassen'; duplikat: SuchMeldung | null; haupt: SuchMeldung | null }
  | { art: 'ablegen'; meldung: SuchMeldung }
  | { art: 'buendel'; meldungId: string; stand: TriageStand }
  | { art: 'dazunehmen'; clusterKey: string }
  | null

/** Ein Aufruf, der nach Erfolg neu lädt und den Toast setzt; der Fehler bleibt im Dialog. */
function useSchreiben(): { laeuft: boolean; fehler: string | null; setFehler: (f: string | null) => void; schreibe: (aufruf: () => Promise<{ error?: string }>, erfolg: string, danach: () => void) => void } {
  const router = useRouter()
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  function schreibe(aufruf: () => Promise<{ error?: string }>, erfolg: string, danach: () => void): void {
    setFehler(null)
    starte(async () => {
      const ergebnis = await aufruf()
      if (ergebnis.error) {
        setFehler(ergebnis.error)
        return
      }
      toast.success(erfolg)
      danach()
      router.refresh()
    })
  }
  return { laeuft, fehler, setFehler, schreibe }
}

export function MeldungenWerkzeug({ kandidaten, stichwoerter, children }: { kandidaten: SuchMeldung[]; stichwoerter: string[]; children: ReactNode }): React.JSX.Element {
  const [offen, setOffen] = useState<Offen>(null)
  const werkzeug: Werkzeug = {
    zusammenfassen: (duplikat) => setOffen({ art: 'zusammenfassen', duplikat, haupt: null }),
    ablegen: (meldung) => setOffen({ art: 'ablegen', meldung }),
    insBuendel: (meldungId, stand) => setOffen({ art: 'buendel', meldungId, stand }),
    dazunehmen: (clusterKey) => setOffen({ art: 'dazunehmen', clusterKey }),
  }
  const zu = (): void => setOffen(null)
  return (
    <WerkzeugKontext.Provider value={werkzeug}>
      {children}
      {offen?.art === 'zusammenfassen' && <ZusammenfassenDialog key="zusammen" start={offen} kandidaten={kandidaten} onZu={zu} />}
      {offen?.art === 'ablegen' && <AblegenDialog key={`ablegen-${offen.meldung.id}`} meldung={offen.meldung} onZu={zu} />}
      {offen?.art === 'buendel' && <BuendelDialog key={`buendel-${offen.meldungId}`} meldungId={offen.meldungId} stand={offen.stand} stichwoerter={stichwoerter} onZu={zu} />}
      {offen?.art === 'dazunehmen' && <DazunehmenDialog key={`dazu-${offen.clusterKey}`} clusterKey={offen.clusterKey} kandidaten={kandidaten} onZu={zu} />}
    </WerkzeugKontext.Provider>
  )
}

/** Eine Meldung im Dialog: Art, Kurznummer, Stand, Kurztitel, Wer. */
function MeldungKasten({ m }: { m: SuchMeldung }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        <Marke art={MELDUNG_ART_MARKE[m.art]}>{MELDUNG_ART_LABEL[m.art]}</Marke>
        <span className={cn('font-mono', LEISE)}>{m.kurznummer}</span>
        <span className={LEISE}>· {STATUS_INTERN[m.status]}</span>
      </div>
      <p className="text-[14px] font-semibold break-words text-foreground">{m.ersteZeile || '—'}</p>
      <p className={cn('text-[12.5px] break-words', LEISE)}>{m.wer}</p>
    </div>
  )
}

/** Suchfeld mit Trefferliste unter dem Feld (CODING_STANDARDS §8: Liste im Fluss, erst beim Tippen). */
function MeldungSuche({ beschriftung, liste, erlaubt, onWahl }: { beschriftung: string; liste: SuchMeldung[]; erlaubt: (m: SuchMeldung) => boolean; onWahl: (m: SuchMeldung) => void }): React.JSX.Element {
  const [wort, setWort] = useState('')
  const treffer = sucheMeldungen(liste, wort, erlaubt)
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="meldung-suche" className={FELD_LABEL}>
        {beschriftung}
      </label>
      <input id="meldung-suche" value={wort} onChange={(e) => setWort(e.target.value)} autoComplete="off" className={FELD} />
      {wort.trim() !== '' &&
        (treffer.length === 0 ? (
          <p className={cn('text-[13px]', LEISE)}>{MELDUNG_KLICK_TEXT.sucheKeinTreffer}</p>
        ) : (
          <ul className="flex flex-col rounded-xl border border-border [&>li+li]:border-t [&>li+li]:border-border">
            {treffer.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    onWahl(m)
                    setWort('')
                  }}
                  className={cn('flex min-h-11 w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-[13.5px] hover:bg-muted', FOKUS_RAHMEN)}
                >
                  <span className={cn('shrink-0 font-mono text-[12px]', LEISE)}>{m.kurznummer}</span>
                  <span className="min-w-0 flex-1 truncate text-foreground" title={m.ersteZeile}>
                    {m.ersteZeile || '—'}
                  </span>
                  <span className={cn('shrink-0 text-[12px]', LEISE)}>{m.wer}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}

function ZusammenfassenDialog({ start, kandidaten, onZu }: { start: { duplikat: SuchMeldung | null; haupt: SuchMeldung | null }; kandidaten: SuchMeldung[]; onZu: () => void }): React.JSX.Element {
  const [paar, setPaar] = useState(start)
  const { laeuft, fehler, schreibe } = useSchreiben()
  const { duplikat, haupt } = paar
  const text = MELDUNG_KLICK_TEXT
  const passiert =
    duplikat && haupt
      ? text.passiert({
          duplikat: duplikat.kurznummer,
          haupt: haupt.kurznummer,
          teil: MELDUNGEN_TEXT.spalte[duplikat.teil].titel,
          wer: duplikat.wer,
          behoben: ERLEDIGT_OEFFENTLICH[haupt.art],
        })
      : null
  return (
    <BestellDialog
      offen
      onOffenChange={(o) => !o && onZu()}
      titel={text.zusammenTitel}
      unterzeile={text.zusammenSatz}
      breite="breit"
      hauptaktion={{
        text: text.zusammenKnopf,
        ton: 'gruen',
        laeuft,
        gesperrt: !duplikat || !haupt,
        onClick: () => duplikat && haupt && schreibe(() => fasseZusammenAction({ duplikatId: duplikat.id, hauptmeldungId: haupt.id }), text.zusammengefasst, onZu),
      }}
    >
      <div className="flex flex-col gap-3">
        <section aria-label={text.bleibt} className="rounded-xl border border-border p-3">
          <p className={cn(KICKER, 'mb-1.5')}>{text.bleibt}</p>
          {haupt ? <MeldungKasten m={haupt} /> : <p className={cn('text-[13.5px]', LEISE)}>{text.hauptmeldungFehlt}</p>}
        </section>
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-[12.5px]', LEISE)}>{text.haengtSichAn}</span>
          <button
            type="button"
            disabled={!duplikat || !haupt || !kannHauptmeldungSein(duplikat.status)}
            onClick={() => setPaar({ duplikat: haupt, haupt: duplikat })}
            className={KNOPF_RAHMEN}
          >
            <ArrowUpDown className="size-4" strokeWidth={1.8} aria-hidden="true" />
            {text.tauschen}
          </button>
        </div>
        <section aria-label={text.wirdDuplikat} className="rounded-xl border border-dashed border-border p-3">
          <p className={cn(KICKER, 'mb-1.5')}>{text.wirdDuplikat}</p>
          {duplikat && <MeldungKasten m={duplikat} />}
        </section>
        <MeldungSuche
          beschriftung={text.suche}
          liste={kandidaten}
          erlaubt={(m) => kannHauptmeldungSein(m.status) && m.id !== duplikat?.id}
          onWahl={(m) => setPaar((p) => ({ ...p, haupt: m }))}
        />
        {passiert && (
          <section aria-label={text.wasPassiert} className="rounded-xl bg-muted px-3.5 py-3">
            <p className="mb-1.5 text-[13px] font-semibold text-foreground">{text.wasPassiert}</p>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] text-foreground">
              {passiert.map((satz) => (
                <li key={satz}>{satz}</li>
              ))}
            </ul>
          </section>
        )}
        <p className={cn('text-[12.5px]', LEISE)}>{text.keinMail}</p>
        <DialogFehler text={fehler} />
      </div>
    </BestellDialog>
  )
}

function AblegenDialog({ meldung, onZu }: { meldung: SuchMeldung; onZu: () => void }): React.JSX.Element {
  const [antwort, setAntwort] = useState(meldung.stand.antwortAnMelder ?? '')
  const { laeuft, fehler, setFehler, schreibe } = useSchreiben()
  const text = MELDUNG_KLICK_TEXT
  return (
    <BestellDialog
      offen
      onOffenChange={(o) => !o && onZu()}
      titel={text.ablegenTitel}
      unterzeile={text.ablegenSatz}
      hauptaktion={{
        text: text.ablegenKnopf,
        ton: 'orange',
        laeuft,
        onClick: () => {
          // Die Antwort ist Pflicht (Freigabe Nr. 101) — der Hof soll lesen, warum.
          if (antwort.trim() === '') return setFehler(text.ablegenPflicht)
          schreibe(() => triageMeldungAction(meldung.id, triageAufruf(meldung.stand, { status: 'KEIN_FEHLER', antwortAnMelder: antwort.trim() })), text.abgelegt, onZu)
        },
      }}
    >
      <MeldungKasten m={meldung} />
      <div>
        <label htmlFor="ablegen-antwort" className={FELD_LABEL}>
          {text.ablegenFeld} <span className="font-normal">· {text.ablegenHinweis}</span>
        </label>
        <textarea id="ablegen-antwort" value={antwort} onChange={(e) => setAntwort(e.target.value)} rows={4} aria-required="true" className={cn(FELD, 'resize-y')} />
      </div>
      <DialogFehler text={fehler} />
    </BestellDialog>
  )
}

function BuendelDialog({ meldungId, stand, stichwoerter, onZu }: { meldungId: string; stand: TriageStand; stichwoerter: string[]; onZu: () => void }): React.JSX.Element {
  const [wort, setWort] = useState(stand.clusterKey ?? '')
  const { laeuft, fehler, setFehler, schreibe } = useSchreiben()
  const text = MELDUNG_KLICK_TEXT
  return (
    <BestellDialog
      offen
      onOffenChange={(o) => !o && onZu()}
      titel={text.buendelTitel}
      unterzeile={text.buendelSatz}
      hauptaktion={{
        text: text.buendelKnopf,
        ton: 'gruen',
        laeuft,
        onClick: () => {
          if (wort.trim() === '') return setFehler(text.buendelLeer)
          schreibe(() => triageMeldungAction(meldungId, triageAufruf(stand, { clusterKey: wort.trim() })), text.buendelGespeichert, onZu)
        },
      }}
    >
      {stichwoerter.length > 0 && (
        <div>
          <p className={FELD_LABEL}>{text.buendelVorhanden}</p>
          <ul className="flex flex-wrap gap-2">
            {stichwoerter.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  aria-pressed={wort.trim() === s}
                  onClick={() => setWort(s)}
                  className={cn('inline-flex min-h-11 items-center rounded-full border px-4 text-[13.5px]', wort.trim() === s ? 'border-foreground bg-foreground font-semibold text-background' : 'border-border hover:bg-muted', FOKUS_RAHMEN)}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <label htmlFor="buendel-stichwort" className={FELD_LABEL}>
          {text.buendelFeld}
        </label>
        <input id="buendel-stichwort" value={wort} onChange={(e) => setWort(e.target.value)} autoComplete="off" className={FELD} />
      </div>
      <DialogFehler text={fehler} />
    </BestellDialog>
  )
}

function DazunehmenDialog({ clusterKey, kandidaten, onZu }: { clusterKey: string; kandidaten: SuchMeldung[]; onZu: () => void }): React.JSX.Element {
  const [gewaehlt, setGewaehlt] = useState<SuchMeldung | null>(null)
  const { laeuft, fehler, schreibe } = useSchreiben()
  return (
    <BestellDialog
      offen
      onOffenChange={(o) => !o && onZu()}
      titel={WUENSCHE_TEXT.dazunehmenTitel}
      unterzeile={WUENSCHE_TEXT.dazunehmenSatz}
      hauptaktion={{
        text: WUENSCHE_TEXT.dazunehmenKnopf,
        ton: 'gruen',
        laeuft,
        gesperrt: gewaehlt === null,
        onClick: () => gewaehlt && schreibe(() => triageMeldungAction(gewaehlt.id, triageAufruf(gewaehlt.stand, { clusterKey })), WUENSCHE_TEXT.dazugenommen, onZu),
      }}
    >
      {gewaehlt && <MeldungKasten m={gewaehlt} />}
      <MeldungSuche
        beschriftung={WUENSCHE_TEXT.dazunehmenSuche}
        liste={kandidaten}
        erlaubt={(m) => m.art === 'WUNSCH' && m.status !== 'DUPLIKAT' && m.clusterKey !== clusterKey}
        onWahl={setGewaehlt}
      />
      <DialogFehler text={fehler} />
    </BestellDialog>
  )
}

/** Das Menü „…" einer Karte: Öffnen · Zusammenfassen … · Ablegen … (Mockup admin-postfach-meldungen-ablauf). */
export function KartenMenue({ meldung, titel }: { meldung: SuchMeldung; titel: string }): React.JSX.Element {
  const werkzeug = useMeldungenWerkzeug()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={MELDUNGEN_TEXT.mehr(titel)} className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted', FOKUS_RAHMEN)}>
        <MoreHorizontal className="size-4" strokeWidth={1.8} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLinkItem render={<a href={eingangMeldungAdresse(meldung.id)} />}>{MELDUNGEN_TEXT.oeffnen}</DropdownMenuLinkItem>
        {werkzeug && meldung.status !== 'DUPLIKAT' && <DropdownMenuItem onClick={() => werkzeug.zusammenfassen(meldung)}>{MELDUNGEN_TEXT.zusammenfassenMenu}</DropdownMenuItem>}
        {werkzeug && meldung.status !== 'KEIN_FEHLER' && meldung.status !== 'DUPLIKAT' && (
          <DropdownMenuItem onClick={() => werkzeug.ablegen(meldung)}>{MELDUNGEN_TEXT.ablegenMenu}</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Ein Knopf, der einen Dialog des Werkzeugs öffnet — für Server-Komponenten (Woraus, Dazunehmen). */
export function WerkzeugKnopf({ aktion, meldung, clusterKey, children }: { aktion: 'zusammenfassen' | 'dazunehmen'; meldung?: SuchMeldung; clusterKey?: string; children: ReactNode }): React.JSX.Element | null {
  const werkzeug = useMeldungenWerkzeug()
  if (!werkzeug) return null
  const klick = (): void => {
    if (aktion === 'zusammenfassen' && meldung) werkzeug.zusammenfassen(meldung)
    if (aktion === 'dazunehmen' && clusterKey) werkzeug.dazunehmen(clusterKey)
  }
  return (
    <button type="button" onClick={klick} className={cn(TEXT_GRUEN, 'self-start')}>
      {children}
    </button>
  )
}

/** „Trennen" in „Woraus": aus dem Duplikat wird wieder eine eigene Meldung (trenneDuplikatAction). */
export function TrennenKnopf({ meldungId, titel }: { meldungId: string; titel: string }): React.JSX.Element {
  const { laeuft, fehler, schreibe } = useSchreiben()
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={laeuft}
        aria-label={`${WUENSCHE_TEXT.trennen}: ${titel}`}
        onClick={() => schreibe(() => trenneDuplikatAction({ meldungId }), MELDUNG_KLICK_TEXT.getrennt, () => undefined)}
        className={TEXT_GRUEN}
      >
        {WUENSCHE_TEXT.trennen}
      </button>
      {fehler && (
        <span role="alert" className="text-[12px] text-foreground">
          {fehler}
        </span>
      )}
    </span>
  )
}
