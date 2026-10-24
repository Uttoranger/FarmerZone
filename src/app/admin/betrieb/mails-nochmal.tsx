'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { CircleCheck, Info } from 'lucide-react'
import { schickeArtNochmalAction, schickeMailNochmalAction, zeigeMailVorschauAction } from '@/server/actions/betrieb'
import { istNetzfehler } from '@/lib/upload-diagnose'
import { useSchmalerAls } from '@/lib/use-mindestbreite'
import { cn } from '@/lib/utils'
import type { MailArt } from '@/schemas/mail-auftrag'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'
import { Sheet, SheetBlatt, SheetClose, SheetTitle } from '@/components/ui/sheet'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/*
 * „Nochmal schicken“, die Vorschau und das Blatt des Details in Admin ›
 * Betrieb › Alle Mails (Register N27, N20; Nr. 167; Mockups
 * admin-betrieb-mails-alle, mobil-admin-betrieb-mails-nochmal). Die Sätze
 * kommen vom Server (ALLE_MAILS_TEXT), entschieden wird nichts hier: Ob der
 * Knopf da ist, entscheidet `mailDetail`, ob die Mail geht, die Action.
 */

/** Fremde Fehler nach Sentry: nur die Klasse unter festem Satz, ein Netzabbruch nur als Brotkrume (Muster MailKnoepfe). */
function meldeGescheitert(fehler: unknown): void {
  try {
    const klasse = fehler instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(fehler.name) ? fehler.name : 'Unbekannt'
    if (istNetzfehler(fehler)) {
      Sentry.addBreadcrumb({ category: 'betrieb', level: 'warning', message: 'Alle Mails: Verbindung abgebrochen', data: { klasse } })
    } else {
      const ereignis = new Error('Betrieb: Nochmal schicken oder Vorschau gescheitert')
      ereignis.name = klasse
      Sentry.captureException(ereignis, { level: 'error', tags: { bereich: 'betrieb', klasse } })
    }
  } catch {
    // Telemetrie scheitert leise.
  }
}

export type NochmalTexte = {
  knopf: string
  heute: string
  dialogTitel: string
  punkte: readonly string[]
  spam: string | null
  bestaetigen: string
  fehler: string
}

/**
 * Der Knopf „Nochmal schicken“ und sein Bestätigungsschritt (am Bildschirm
 * Dialog, am Handy Blatt; `BestellDialog`, role="dialog", Fokus im Dialog):
 * an wen (gekürzt), was mit dem alten Link geschieht (nur Bar-Link), die
 * Frist, der Vermerk „vom Support“, die Spam-Frage, wenn zugestellt, und
 * „Heute n von 3“. Erst „Mit Passkey bestätigen und schicken“ ruft die
 * Action; ohne frische Bestätigung fragt der Passkey-Dialog (N20).
 */
export function NochmalKnopf({ id, texte }: { id: string; texte: NochmalTexte }): React.JSX.Element {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [satz, setSatz] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()
  const schicken = useFrischBestaetigt(schickeMailNochmalAction)

  const bestaetige = (): void => {
    starte(async () => {
      try {
        const antwort = await schicken.ausfuehren({ id })
        if ('error' in antwort) {
          setFehler(antwort.error)
          return
        }
        setOffen(false)
        setSatz(antwort.satz)
        router.refresh()
      } catch (err) {
        setFehler(texte.fehler)
        meldeGescheitert(err)
      }
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          type="button"
          onClick={() => {
            setFehler(null)
            setOffen(true)
          }}
          className={cn(KNOPF_RAHMEN, 'min-h-11 font-semibold')}
        >
          {texte.knopf}
        </button>
        <span className="text-[12.5px] leading-snug text-muted-foreground">{texte.heute}</span>
      </div>
      <p role="status" className="text-[12.5px] leading-snug text-foreground empty:sr-only">
        {satz}
      </p>
      <BestellDialog
        offen={offen}
        onOffenChange={setOffen}
        titel={texte.dialogTitel}
        hauptaktion={{ text: texte.bestaetigen, onClick: bestaetige, ton: 'gruen', laeuft }}
      >
        <div className="flex flex-col gap-3">
          {schicken.dialog}
          {texte.spam && (
            <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-[13px] leading-snug text-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
              {texte.spam}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {texte.punkte.map((p) => (
              <li key={p} className="flex items-start gap-2 text-[13.5px] leading-snug text-foreground">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-status-fertig" strokeWidth={1.8} aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] leading-snug text-muted-foreground">{texte.heute}</p>
          <DialogFehler text={fehler} />
        </div>
      </BestellDialog>
    </div>
  )
}

/** „Alle n nochmal schicken“ in „Braucht dich“ — dieselben Regeln je Mail, höchstens 100 je Klick (Action). */
export function NochmalAlleKnopf({ art, text, fehlerText }: { art: MailArt; text: string; fehlerText: string }): React.JSX.Element {
  const router = useRouter()
  const [satz, setSatz] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()
  const schicken = useFrischBestaetigt(schickeArtNochmalAction)
  const ausloesen = (): void => {
    starte(async () => {
      try {
        const antwort = await schicken.ausfuehren({ art })
        setSatz('error' in antwort ? antwort.error : antwort.satz)
        if (!('error' in antwort)) router.refresh()
      } catch (err) {
        setSatz(fehlerText)
        meldeGescheitert(err)
      }
    })
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {schicken.dialog}
      <button type="button" onClick={ausloesen} disabled={laeuft} aria-busy={laeuft} className={cn(KNOPF_RAHMEN, 'font-semibold')}>
        {text}
      </button>
      <p role="status" className="text-[12.5px] leading-snug text-muted-foreground empty:sr-only">
        {satz}
      </p>
    </div>
  )
}

/**
 * Die Mail in der Vorschau: `<iframe sandbox srcdoc>` ohne `allow-scripts`
 * und ohne `allow-same-origin` — die Mail kann nichts ausführen und nichts
 * von der Seite lesen. Die Links sind schon auf dem Server unkenntlich.
 */
export function VorschauRahmen({ titel, html }: { titel: string; html: string }): React.JSX.Element {
  return <iframe title={titel} sandbox="" srcDoc={html} referrerPolicy="no-referrer" className="h-[420px] w-full rounded-xl border border-border bg-background" />
}

export type VorschauTexte = { knopf: string; fehler: string }

/** „Vorschau zeigen“: baut die Mail erst auf Knopfdruck (Action, nur lesend) — nichts wird gespeichert oder protokolliert. */
export function VorschauKnopf({ id, texte }: { id: string; texte: VorschauTexte }): React.JSX.Element {
  const [inhalt, setInhalt] = useState<{ titel: string; betreff: string; html: string } | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()
  const zeige = (): void => {
    starte(async () => {
      try {
        const antwort = await zeigeMailVorschauAction({ id })
        if ('error' in antwort) setFehler(antwort.error)
        else {
          setFehler(null)
          setInhalt(antwort)
        }
      } catch (err) {
        setFehler(texte.fehler)
        meldeGescheitert(err)
      }
    })
  }
  if (inhalt) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] leading-snug font-semibold break-words text-foreground">{inhalt.betreff}</p>
        <VorschauRahmen titel={inhalt.titel} html={inhalt.html} />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={zeige} disabled={laeuft} aria-busy={laeuft} className={cn(KNOPF_RAHMEN, 'self-start font-semibold')}>
        {texte.knopf}
      </button>
      <p role="status" className="text-[12.5px] leading-snug text-foreground empty:sr-only">
        {fehler}
      </p>
    </div>
  )
}

/**
 * Das Detail am Handy als Blatt von unten (unter 1024 px; darüber steht es
 * als Seitenleiste). Schließen führt zur Liste ohne `mail=` zurück.
 */
export function DetailBlatt({ titel, zurueck, schliessen, children }: { titel: string; zurueck: string; schliessen: string; children: ReactNode }): React.JSX.Element {
  const router = useRouter()
  const schmal = useSchmalerAls(1024)
  return (
    <Sheet
      open={schmal}
      onOpenChange={(o: boolean) => {
        if (!o) router.push(zurueck, { scroll: false })
      }}
    >
      <SheetBlatt>
        <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-border" />
        <SheetTitle className="font-heading text-lg leading-tight font-semibold break-words">{titel}</SheetTitle>
        {children}
        <SheetClose className={cn('mx-auto min-h-11 rounded-full px-5 text-sm font-semibold text-status-fertig hover:bg-muted', FOKUS_RAHMEN)}>{schliessen}</SheetClose>
      </SheetBlatt>
    </Sheet>
  )
}
