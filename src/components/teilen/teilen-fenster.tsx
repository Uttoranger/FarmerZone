'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Camera,
  Check,
  CircleCheck,
  CircleFadingPlus,
  Copy,
  Download,
  Mail,
  MessageCircle,
  Printer,
  Send,
  Share2,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetBlatt, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Segment } from '@/components/ui/segment'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { teilenBildPfad, type TeilenBildFormat } from '@/lib/teilen-kanal'
import { TEILEN_BILD_PRODUKTE_MAX } from '@/lib/teilen-bild'
import { WHATSAPP_VERSAND_TEXT } from '@/lib/whatsapp-versand'
import {
  anfangsAuswahl,
  BEITRAG_TEILEN_TEXT,
  FENSTER_KANAELE,
  fensterFussnote,
  kanalZiel,
  linkMitKanal,
  orangerKnopf,
  plakatPfad,
  schalteAuswahl,
  type TeilenFensterDaten,
} from '@/lib/teilen-fenster'
import { cn } from '@/lib/utils'

/*
 * Das Teilen-Fenster (Gate 7 Aufgabe 2, Nachtlauf Nr. 21; Mockups
 * web-h4-teilen-fenster-mit-bild, mobil-h4-teilen-ueber-das-telefon).
 * Ab 768 px Dialog mit Bild links und Text, Auswahl, Link und Kanälen rechts
 * (darunter bis 1024 px untereinander), am Handy ein Blatt mit dem
 * Teilen-Menü des Telefons als Hauptknopf.
 *
 * Seit Nr. 67 mit Beitrag-Modus (Register T5; Mockups web-h4-beitrag-teilen,
 * mobil-h4-beitrag-teilen): Titel „Beitrag teilen" mit Unterzeile, als erste
 * Karte die WhatsApp-Abonnentinnen (W1) mit dem einzigen orangen Knopf, Link
 * auf den Reiter „Beiträge", die Produkte des Beitrags vorbelegt, kein Plakat.
 * Am Handy zeigt das Blatt wie im Mockup keine Auswahl „Im Bild" — das Bild
 * zeigt die Produkte des Beitrags.
 *
 * Das Bild ist das echte Teilen-Bild (/[farmSlug]/opengraph-image) — dieselbe
 * Grafik wie die Vorschau im Chat. Was ins Bild darf, entscheidet der Server
 * (nie ausverkauft, nie gesperrt); die Auswahl hier schickt nur Kennungen.
 * Jeder Kanal trägt sein Kürzel `?k=` für die Zählung der Besuche, ohne Cookie
 * und ohne Speicher im Browser (S8, Register T1).
 */

const KNOPF_RAHMEN = cn(
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3.5 text-[13.5px] font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted',
  FOKUS_RAHMEN
)
const KNOPF_ORANGE = cn(
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary-foreground/25 bg-primary px-3.5 text-[13.5px] font-semibold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90',
  FOKUS_RAHMEN
)
const UEBERSCHRIFT = 'text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase'
const TEXT_LINK = 'font-semibold text-status-fertig underline-offset-2 hover:underline'

const KANAL_SYMBOL: Record<(typeof FENSTER_KANAELE)[number]['kanal'], LucideIcon> = {
  wa: MessageCircle,
  'wa-status': CircleFadingPlus,
  fb: Users,
  ig: Camera,
  mail: Mail,
}

const FORMATE = [
  { wert: 'quadrat', label: 'Beitrag 1:1' },
  { wert: 'story', label: 'Status 9:16' },
] as const

async function kopiere(text: string, erfolg: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(erfolg)
  } catch {
    toast.error('Konnte nicht kopiert werden. Markiere den Text und kopiere ihn selbst.')
  }
}

/** Der Knopf, der das Fenster öffnet — er ersetzt dort, wo der Hof teilt, das einfache Teilen. */
export function TeilenFensterKnopf({
  daten,
  label,
  className,
}: {
  daten: TeilenFensterDaten
  label: string
  className?: string
}): React.JSX.Element {
  const [offen, setOffen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOffen(true)} className={className}>
        <Share2 className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
        {label}
      </button>
      {offen && <TeilenFenster daten={daten} offen={offen} onOffenChange={setOffen} />}
    </>
  )
}

export function TeilenFenster({
  daten,
  offen,
  onOffenChange,
}: {
  daten: TeilenFensterDaten
  offen: boolean
  onOffenChange: (offen: boolean) => void
}): React.JSX.Element {
  const breit = useMindestbreite(768)
  const textId = useId()
  const kartenId = useId()
  const [format, setFormat] = useState<TeilenBildFormat>('quadrat')
  const [gewaehlt, setGewaehlt] = useState<string[]>(() => anfangsAuswahl(daten))
  const [text, setText] = useState(daten.textVorschlag)
  const [bildLaedt, setBildLaedt] = useState(true)
  const [bildFehler, setBildFehler] = useState(false)
  const bildDatei = useRef<File | null>(null)

  const beitrag = daten.art === 'beitrag' ? daten : null
  const orange = orangerKnopf(daten, breit)
  const plakat = plakatPfad(daten)
  // Ohne `version`, also nur kurz im Zwischenspeicher: Ein deaktivierter oder
  // abgelaufener Beitrag gibt so gleich „nicht gefunden", statt mit passender
  // Prüfsumme bis zu zwei Tage im CDN zu stehen.
  const bildUrl = teilenBildPfad(daten.slug, { format, auswahl: gewaehlt, beitrag: beitrag?.beitragId ?? null })
  const dateiName = `${daten.slug}-${format === 'story' ? 'status' : 'beitrag'}.png`

  // Das Bild für das Teilen-Menü schon jetzt holen: Das Menü des Telefons
  // geht nur direkt aus dem Tipp auf, ein Laden dazwischen verlöre ihn.
  useEffect(() => {
    let aktuell = true
    bildDatei.current = null
    fetch(bildUrl)
      .then((antwort) => (antwort.ok ? antwort.blob() : null))
      .then((blob) => {
        if (aktuell && blob) bildDatei.current = new File([blob], dateiName, { type: 'image/png' })
      })
      .catch(() => {
        // Ohne Datei teilt das Menü nur Text und Link — kein Fehler für den Hof.
      })
    return () => {
      aktuell = false
    }
  }, [bildUrl, dateiName])

  function schalte(id: string) {
    setGewaehlt((vorher) => {
      const neu = schalteAuswahl(vorher, id, daten.auswahl)
      if (neu.length === vorher.length && !vorher.includes(id)) {
        toast.info(`Höchstens ${TEILEN_BILD_PRODUKTE_MAX} Produkte passen ins Bild.`)
      }
      return neu
    })
    setBildLaedt(true)
    setBildFehler(false)
  }

  function waehleFormat(wert: string) {
    setFormat(wert === 'story' ? 'story' : 'quadrat')
    setBildLaedt(true)
    setBildFehler(false)
  }

  /** Bild und Text über das Teilen-Menü des Geräts; ohne Menü Bild speichern und Text kopieren. */
  async function teileMitBild(textMitLink: string, link: string): Promise<void> {
    const datei = bildDatei.current
    const mitDatei = datei ? { files: [datei], text: textMitLink } : null
    try {
      if (mitDatei && typeof navigator.canShare === 'function' && navigator.canShare(mitDatei)) {
        await navigator.share(mitDatei)
        return
      }
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: daten.hofName, text: textMitLink, url: link })
        return
      }
    } catch (fehler) {
      // Menü geschlossen: eine Entscheidung, kein Fehler.
      if (fehler instanceof DOMException && fehler.name === 'AbortError') return
    }
    const a = document.createElement('a')
    a.href = bildUrl
    a.download = dateiName
    a.click()
    await kopiere(textMitLink, 'Bild gespeichert und Text kopiert – jetzt in der App einfügen')
  }

  async function teileUeberKanal(kanal: (typeof FENSTER_KANAELE)[number]['kanal']): Promise<void> {
    const ziel = kanalZiel(kanal, { link: daten.link, text, hofName: daten.hofName })
    if (ziel.art === 'oeffnen') {
      window.open(ziel.href, '_blank', 'noopener,noreferrer')
      return
    }
    await teileMitBild(ziel.text, ziel.link)
  }

  const linkKopieren = () => void kopiere(linkMitKanal(daten.link, 'link'), 'Link kopiert')
  // Das Menü des Telefons kennt den gewählten Kanal nicht — der Link zählt als „Link".
  const telefonTeilen = () => {
    const link = linkMitKanal(daten.link, 'link')
    void teileMitBild(text.trim() ? `${text.trim()}\n${link}` : link, link)
  }

  const unterzeile = (kurz: boolean) =>
    beitrag && (
      <>
        <CircleCheck className="size-4 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
        <span className="min-w-0">{BEITRAG_TEILEN_TEXT.unterzeile(beitrag.email?.anzahl ?? null, kurz)}</span>
      </>
    )

  const vorschau = (
    <div className="flex flex-col items-center gap-3">
      <Segment beschriftung="Format des Bilds" optionen={FORMATE} wert={format} onWertChange={waehleFormat} />
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-border bg-muted',
          format === 'story' ? 'aspect-[9/16] h-[250px] md:h-[340px]' : 'aspect-square w-[250px] md:w-[340px]'
        )}
      >
        {bildLaedt && !bildFehler && <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-muted" />}
        {bildFehler ? (
          <p className="flex h-full items-center justify-center p-4 text-center text-[13px] text-status-offen">
            Das Bild konnte nicht geladen werden. Teilen geht trotzdem – mit Text und Link.
          </p>
        ) : (
          // Ein erzeugtes Bild vom eigenen Server; next/image brächte hier nichts außer einer zweiten Zwischenstufe.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={bildUrl}
            src={bildUrl}
            alt={beitrag ? `Teilen-Bild zum Beitrag „${beitrag.titel}"` : `Teilen-Bild von ${daten.hofName}`}
            className="size-full object-cover"
            onLoad={() => setBildLaedt(false)}
            onError={() => {
              setBildLaedt(false)
              setBildFehler(true)
            }}
          />
        )}
      </div>
      <a href={bildUrl} download={dateiName} className={KNOPF_RAHMEN}>
        <Download className="size-4" strokeWidth={1.7} aria-hidden="true" />
        Bild herunterladen
      </a>
    </div>
  )

  // Die erste Karte im Beitrag-Modus (W1): nur mit Abonnentinnen, mit dem einzigen orangen Knopf.
  const abonnentinnenKarte = beitrag?.abonnentinnen && beitrag.versandPfad && (
    <section aria-labelledby={kartenId} className="flex flex-col gap-2.5 rounded-2xl border border-accent bg-accent/12 p-3.5">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-accent/20 text-status-fertig">
          <MessageCircle className="size-[18px]" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={kartenId} className="text-[14.5px] font-semibold text-foreground">
            {BEITRAG_TEILEN_TEXT.abonnentinnen}
          </h3>
          <p className="text-[12.5px] text-muted-foreground">{BEITRAG_TEILEN_TEXT.abonnentinnenZeile(beitrag.abonnentinnen.anzahl)}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] text-muted-foreground">
          <span aria-hidden="true" className="h-[5px] flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-status-fertig"
              style={{ width: `${(beitrag.abonnentinnen.geoeffnet / beitrag.abonnentinnen.anzahl) * 100}%` }}
            />
          </span>
          <span className="whitespace-nowrap">{WHATSAPP_VERSAND_TEXT.stand(beitrag.abonnentinnen.geoeffnet, beitrag.abonnentinnen.anzahl)}</span>
        </div>
        <Link href={beitrag.versandPfad} className={cn(KNOPF_ORANGE, 'w-full md:w-auto')}>
          <Send className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          {BEITRAG_TEILEN_TEXT.verschicken}
        </Link>
      </div>
    </section>
  )

  const textFeld = (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={textId} className={UEBERSCHRIFT}>
        Text
      </label>
      <textarea
        id={textId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className={cn(
          'w-full resize-y rounded-xl border border-border bg-background px-3.5 py-3 text-base leading-normal md:text-sm',
          FOKUS_RAHMEN
        )}
      />
    </div>
  )

  const ohneFoto = new Set(beitrag?.ohneFoto ?? [])
  const imBild = (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={cn(UEBERSCHRIFT, 'mb-1.5')}>Im Bild</legend>
      {daten.auswahl.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          Noch keine Produkte im Shop – das Bild zeigt deinen Hof und die Abholzeit.{' '}
          <Link href="/products" className={TEXT_LINK}>
            Produkt anlegen
          </Link>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {daten.auswahl.map((e) => {
            const an = gewaehlt.includes(e.id)
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={an}
                disabled={e.ausverkauft}
                onClick={() => schalte(e.id)}
                title={e.name}
                className={cn(
                  "relative inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
                  an ? 'border-accent bg-accent/20 text-foreground' : 'border-border text-muted-foreground',
                  e.ausverkauft && 'border-dashed font-normal line-through',
                  FOKUS_RAHMEN
                )}
              >
                {an && <Check className="size-3.5 shrink-0 text-status-fertig" strokeWidth={2} aria-hidden="true" />}
                <span className="min-w-0 truncate">{e.ausverkauft ? `${e.name} – ausverkauft` : e.name}</span>
                {ohneFoto.has(e.id) && (
                  <>
                    <Camera className="size-3.5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                    <span className="sr-only">, {BEITRAG_TEILEN_TEXT.ohneFoto}</span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      )}
      {beitrag && beitrag.vorbelegt.length > 0 && <p className="text-xs text-muted-foreground">{BEITRAG_TEILEN_TEXT.vorbelegt}</p>}
      {ohneFoto.size > 0 && (
        <p className="text-xs text-muted-foreground">
          {BEITRAG_TEILEN_TEXT.mitFoto} –{' '}
          <Link href="/products" className={TEXT_LINK}>
            {BEITRAG_TEILEN_TEXT.fotoHinzufuegen}
          </Link>
        </p>
      )}
    </fieldset>
  )

  const linkZeile = (
    <div className="flex flex-col gap-1.5">
      <span className={UEBERSCHRIFT}>Link</span>
      <div className="flex gap-2">
        <span
          className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-border bg-background px-3.5 text-[13.5px]"
          title={daten.adresse}
        >
          <span className="min-w-0 truncate">{daten.adresse}</span>
        </span>
        <button type="button" onClick={linkKopieren} className={KNOPF_RAHMEN}>
          <Copy className="size-4" strokeWidth={1.7} aria-hidden="true" />
          Kopieren
        </button>
      </div>
    </div>
  )

  const kanaele = (
    <div className="flex flex-col gap-1.5">
      <span className={UEBERSCHRIFT}>Teilen über</span>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {FENSTER_KANAELE.map(({ kanal, label }) => {
          const Symbol = KANAL_SYMBOL[kanal]
          return (
            <button
              key={kanal}
              type="button"
              onClick={() => void teileUeberKanal(kanal)}
              // Ein Hauptknopf je Ansicht (orangerKnopf): im Web WhatsApp, außer die Abonnentinnen-Karte trägt ihn.
              className={cn(kanal === 'wa' && orange === 'whatsapp' ? KNOPF_ORANGE : KNOPF_RAHMEN, 'justify-start')}
            >
              <Symbol className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
              <span className="min-w-0 truncate">{label}</span>
            </button>
          )
        })}
        {plakat && (
          <Link href={plakat} className={cn(KNOPF_RAHMEN, 'justify-start')}>
            <Printer className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
            <span className="min-w-0 truncate">Plakat drucken</span>
          </Link>
        )}
      </div>
    </div>
  )

  const fussnote = <p className="text-xs leading-normal text-muted-foreground">{fensterFussnote(daten)}</p>

  if (breit) {
    return (
      <Dialog open={offen} onOpenChange={onOffenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-[26px] sm:max-w-[min(960px,calc(100%-2rem))]">
          <div className="flex flex-col gap-7 lg:flex-row">
            <div>{vorschau}</div>
            <div className="flex min-w-0 flex-1 flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <DialogTitle className="font-heading text-2xl font-semibold">{beitrag ? BEITRAG_TEILEN_TEXT.titel : 'Hof teilen'}</DialogTitle>
                {beitrag ? (
                  <DialogDescription className="flex items-center gap-1.5 text-[13px] text-muted-foreground">{unterzeile(false)}</DialogDescription>
                ) : (
                  <DialogDescription className="sr-only">
                    Bild und Text für deine Kunden – über WhatsApp, Facebook, Instagram, E-Mail oder als Plakat.
                  </DialogDescription>
                )}
              </div>
              {abonnentinnenKarte}
              {textFeld}
              {imBild}
              {linkZeile}
              {kanaele}
              {fussnote}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={offen} onOpenChange={onOffenChange}>
      <SheetBlatt>
        <div className="flex flex-col gap-1">
          <SheetTitle className="font-heading text-lg font-semibold">{beitrag ? BEITRAG_TEILEN_TEXT.titel : 'Teilen'}</SheetTitle>
          {beitrag ? (
            <SheetDescription className="flex items-center gap-1.5 text-[13px] text-muted-foreground">{unterzeile(true)}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">Bild und Text über das Teilen-Menü deines Telefons.</SheetDescription>
          )}
        </div>
        {vorschau}
        {abonnentinnenKarte}
        {textFeld}
        {!beitrag && imBild}
        <button type="button" onClick={telefonTeilen} className={cn(orange === 'telefon' ? KNOPF_ORANGE : KNOPF_RAHMEN, 'w-full')}>
          <Share2 className="size-4" strokeWidth={1.7} aria-hidden="true" />
          {beitrag ? BEITRAG_TEILEN_TEXT.telefon : 'Teilen'}
        </button>
        <p className="text-center text-xs text-muted-foreground">Das Teilen-Menü deines Telefons – WhatsApp und Co. sind schon drin.</p>
        {linkZeile}
        {kanaele}
        {fussnote}
      </SheetBlatt>
    </Sheet>
  )
}
