'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ShieldCheck } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { updateSubscription, deleteCustomerAccount } from '@/server/actions/subscriptions'
import { ABO_TEXT } from '@/lib/abo-bestaetigung'
import { ADMIN_ANMELDEN_TEXT, ADMIN_PFAD } from '@/lib/admin-anmeldung'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { EmptyState } from '@/components/ui/empty-state'
import { AngemeldeteGeraete, KONTO_ETIKETT } from '@/components/konto/angemeldete-geraete'
import type { GeraeteZeile } from '@/lib/geraete'
import { KARTE, KNOPF_RAHMEN } from '@/components/bestaetigung/bestaetigung-teile'
import { Dialog, DialogDescription, DialogMitte } from '@/components/ui/dialog'
import { Sheet, SheetBlatt, SheetClose, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { textlinkKlassen } from '@/components/ui/textlink'
import { KNOPF_GRUEN, KNOPF_UMRISS } from '@/components/anmelden/stil'

/*
 * „Mein Konto" der freiwilligen Kunden-Anmeldung — seit Nr. 14 im neuen Design
 * (KundeShell, Tokens), inhaltlich unverändert (E8: keine neuen
 * Konto-Funktionen): Abonnements je Hof, Abmelden, Konto löschen.
 * Seit Nr. 178 (Register S18) dazu die angemeldeten Geräte mit „Überall
 * abmelden" (Baustein AngemeldeteGeraete, `fuerKundin`).
 * Zerstörendes steht orange umrandet, nie grün (DESIGN_SYSTEM, „Dialoge").
 * Seit Lauf 30 (Boards s2/w2-kundenkonto): im Browser zwei Spalten
 * (Abonnements | Geräte und Konto), „Neuigkeiten“ statt „Benachrichtigungen“
 * (Wortliste N42 c), der Lösch-Dialog zentriert mit genau einem
 * Schließen-Element (DialogMitte, N41 d).
 * Seit Nr. 239 (Lauf 31, Abnahme der Boards): Kennzeilen 13 px, die Abos als
 * EINE Karte mit Trennlinien ohne Symbole, „Abmelden“ ohne Symbol, die
 * Geräte als Kennzeile mit Karte und eigenem Knopf; „Konto löschen?“ am Handy
 * als Blatt, im Browser als Dialog mit „Abbrechen“ | „Konto löschen“
 * nebeneinander, der Fokus startet auf „Abbrechen“ (Maßstab Punkt 5).
 */

interface SubscriptionRow {
  farmId: string
  farmName: string
  farmSlug: string
  optInEmail: boolean
  /** Anmeldung angefragt, Link noch gültig (Double-Opt-in, S11). */
  emailWartet: boolean
  optInWhatsApp: boolean
  customerPhone: string | null
}

interface Props {
  user: { id: string; email: string }
  subscriptions: SubscriptionRow[]
  /** Konto mit Admin-Recht (frisch aus der Datenbank, Register N20): der Link „Zum Admin-Bereich". */
  adminBereich?: boolean
  /** Die Sitzungen des eigenen Kontos (ladeAngemeldeteGeraete), dieses Gerät eingeschlossen. */
  geraete?: readonly GeraeteZeile[]
}

/** Zerstörende Aktion: orange Rahmen, oranger Text (text-status-offen hält 4,5:1 in beiden Themes); volle Breite, 14 px Rundung. */
const KNOPF_ZERSTOEREND = cn(
  'inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[14px] border border-primary/60 px-4 text-[15px] font-bold text-status-offen transition-colors duration-[250ms] hover:bg-primary/12',
  FOKUS_RAHMEN
)

export function ProfileClient({ user, subscriptions: initialSubs, adminBereich = false, geraete = [] }: Props): React.JSX.Element {
  const [subs, setSubs] = useState(initialSubs)
  const [isPending, startTransition] = useTransition()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const breit = useMindestbreite(768)
  // Bei einer Rückfrage vor dem Löschen startet der Fokus auf „Abbrechen“ (Maßstab Punkt 5), nie auf der Aktion.
  const abbrechenRef = useRef<HTMLButtonElement>(null)

  function toggleEmail(farmId: string) {
    const sub = subs.find((s) => s.farmId === farmId)
    if (!sub) return
    // Wartet die Anmeldung auf den Link, schaltet ein Tipp sie ab (wie „an").
    const newOptIn = !(sub.optInEmail || sub.emailWartet)
    const vorher = { optInEmail: sub.optInEmail, emailWartet: sub.emailWartet }
    setSubs((prev) =>
      prev.map((s) => (s.farmId === farmId ? { ...s, optInEmail: newOptIn, emailWartet: false } : s)),
    )
    startTransition(async () => {
      const result = await updateSubscription(farmId, newOptIn, sub.optInWhatsApp)
      if (result.error) {
        toast.error(result.error)
        setSubs((prev) => prev.map((s) => (s.farmId === farmId ? { ...s, ...vorher } : s)))
        return
      }
      // E-Mail an heißt bei einer neuen Anmeldung: erst bestätigen (S11).
      setSubs((prev) =>
        prev.map((s) =>
          s.farmId === farmId ? { ...s, optInEmail: result.email === 'an', emailWartet: result.email === 'wartet' } : s,
        ),
      )
      if (result.email === 'wartet') toast.success(ABO_TEXT.profilWartet)
      else toast.success(result.email === 'an' ? 'E-Mail-Abo aktiviert' : 'E-Mail-Abo deaktiviert')
    })
  }

  function toggleWhatsApp(farmId: string) {
    const sub = subs.find((s) => s.farmId === farmId)
    if (!sub) return
    const newOptIn = !sub.optInWhatsApp
    setSubs((prev) =>
      prev.map((s) => (s.farmId === farmId ? { ...s, optInWhatsApp: newOptIn } : s)),
    )
    startTransition(async () => {
      // E-Mail bleibt, wie sie ist: Eine wartende Anmeldung zählt als „an",
      // sonst stellte der WhatsApp-Schalter sie still ab.
      const result = await updateSubscription(farmId, sub.optInEmail || sub.emailWartet, newOptIn)
      if (result.error) {
        toast.error(result.error)
        setSubs((prev) =>
          prev.map((s) => (s.farmId === farmId ? { ...s, optInWhatsApp: !newOptIn } : s)),
        )
      } else {
        toast.success(newOptIn ? 'WhatsApp-Abo aktiviert' : 'WhatsApp-Abo deaktiviert')
      }
    })
  }

  async function handleDeleteAccount() {
    setIsDeleting(true)
    const result = await deleteCustomerAccount()
    if (result.error) {
      toast.error(result.error)
      setIsDeleting(false)
      return
    }
    await authClient.signOut()
    router.push('/')
  }

  async function handleLogout() {
    await authClient.signOut()
    router.push('/account/login')
  }

  const loeschenSatz =
    'Dein Konto und alle Neuigkeiten-Abos werden gelöscht. Bestehende Bestellungen bleiben aus steuerlichen Gründen erhalten.'
  const loeschenKnopf = (
    <button type="button" onClick={handleDeleteAccount} disabled={isDeleting} className={cn(KNOPF_ZERSTOEREND, 'disabled:opacity-60')}>
      {isDeleting ? 'Lösche…' : 'Konto löschen'}
    </button>
  )
  const loeschenWechsel = (o: boolean) => !o && !isDeleting && setDeleteDialogOpen(false)

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 pt-5 pb-12 md:pt-6 lg:max-w-[1032px]">
      {/* Kopf */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 font-heading text-[26px] leading-tight font-semibold">Mein Konto</h1>
        <button type="button" onClick={handleLogout} className={cn(KNOPF_RAHMEN, 'border-foreground/70 font-semibold')}>
          Abmelden
        </button>
      </div>

      {adminBereich && (
        <Link href={ADMIN_PFAD.bereich} className={cn(KNOPF_RAHMEN, 'self-start')}>
          <ShieldCheck className="size-4" strokeWidth={1.7} aria-hidden="true" />
          {ADMIN_ANMELDEN_TEXT.zumAdminBereich}
        </Link>
      )}

      {/* Im Browser zwei Spalten, solange es Abos gibt; ohne Abo steht alles untereinander (Board w2-kundenkonto, Bild 5). */}
      <div
        className={cn(
          'flex flex-col gap-5',
          subs.length > 0 && 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-4'
        )}
      >
        {/* Abonnements */}
        <section aria-labelledby="abos-titel" className="flex flex-col gap-3">
          <h2 id="abos-titel" className={KONTO_ETIKETT}>
            Meine Abonnements
          </h2>

          {subs.length === 0 ? (
            // Leerzustand wie im Board (Bild 5): die Karten-Form des EmptyState, links bündig, ohne Symbol, Titel
            // fett ohne Serifen, Knopf über die volle Breite.
            <EmptyState
              titel="Du hast noch keine Neuigkeiten abonniert."
              satz="Beim nächsten Einkauf kannst du dich für Neuigkeiten anmelden."
              ausweg={
                <Link href="/hoefe" className={KNOPF_GRUEN}>
                  Höfe entdecken
                </Link>
              }
            />
          ) : (
            <ul className={cn(KARTE, 'flex flex-col divide-y divide-border p-0 transition-opacity', isPending && 'opacity-70')}>
              {subs.map((sub) => (
                <li key={sub.farmId} className="px-4 py-3.5">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[16px] font-bold" title={sub.farmName}>
                      {sub.farmName}
                    </p>
                    <Link
                      href={`/${sub.farmSlug}`}
                      target="_blank"
                      aria-label={`Hofseite von ${sub.farmName} öffnen (neuer Tab)`}
                      className={cn(textlinkKlassen({ ton: 'gruen' }), 'shrink-0 text-[14px] font-medium underline')}
                    >
                      Hofseite
                    </Link>
                  </div>

                  <div className="flex flex-col">
                    <ToggleRow
                      label="E-Mail-Neuigkeiten"
                      hof={sub.farmName}
                      active={sub.optInEmail || sub.emailWartet}
                      hinweis={sub.emailWartet ? ABO_TEXT.schalterWartet : undefined}
                      onToggle={() => toggleEmail(sub.farmId)}
                    />
                    <ToggleRow
                      label="WhatsApp-Neuigkeiten"
                      hof={sub.farmName}
                      active={sub.optInWhatsApp}
                      disabled={!sub.customerPhone}
                      disabledNote="Keine Telefonnummer hinterlegt – gib sie bei deiner nächsten Bestellung an."
                      onToggle={() => toggleWhatsApp(sub.farmId)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-5 lg:gap-4">
          {/* Angemeldete Geräte (S18): je Gerät abmelden, „Überall abmelden"; Kennzeile und Karte bringt der Baustein. */}
          {geraete.length > 0 && <AngemeldeteGeraete zeilen={geraete} fuerKundin />}

          {/* Konto löschen */}
          <section aria-labelledby="konto-titel" className="flex flex-col gap-3">
            <h2 id="konto-titel" className={KONTO_ETIKETT}>
              Konto
            </h2>
            <div className={cn(KARTE, 'flex flex-col gap-2.5')}>
              <p className="text-[15px] break-words [overflow-wrap:anywhere]">
                Angemeldet als <strong className="font-semibold">{user.email}</strong>
              </p>
              <button type="button" onClick={() => setDeleteDialogOpen(true)} className={cn(KNOPF_ZERSTOEREND, 'w-full')}>
                Konto und alle Neuigkeiten-Abos löschen (DSGVO)
              </button>
              <p className="text-[13px] leading-normal text-muted-foreground">
                Deine Bestellungen bleiben aus steuerlichen Gründen gespeichert.
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Löschen bestätigen: am Handy das Blatt, im Browser der Dialog — beide mit „Abbrechen“ | „Konto löschen“
          gleich breit nebeneinander, „Abbrechen“ ist das eine Schließen-Element und bekommt den Startfokus.
          Während gelöscht wird, bleibt die Rückfrage offen. */}
      {breit ? (
        <Dialog open={deleteDialogOpen} onOpenChange={loeschenWechsel}>
          {/* „Abbrechen“ ist unten das eine Schließen-Element (Board w2-kundenkonto, Bild 4): DialogMitte mit
              `aktionen` lässt den Knopf im Kopf weg. */}
          <DialogMitte
            titel="Konto wirklich löschen?"
            initialFocus={abbrechenRef}
            aktionen={
              <>
                <button type="button" ref={abbrechenRef} onClick={() => loeschenWechsel(false)} disabled={isDeleting} className={KNOPF_UMRISS}>
                  Abbrechen
                </button>
                {loeschenKnopf}
              </>
            }
          >
            <DialogDescription className="text-[15px] leading-normal text-foreground">{loeschenSatz}</DialogDescription>
          </DialogMitte>
        </Dialog>
      ) : (
        <Sheet open={deleteDialogOpen} onOpenChange={loeschenWechsel}>
          <SheetBlatt schleier="abgedunkelt" initialFocus={abbrechenRef}>
            <SheetTitle className="font-heading text-[21px] leading-tight font-semibold">Konto wirklich löschen?</SheetTitle>
            <SheetDescription className="text-[15px] leading-normal text-foreground">{loeschenSatz}</SheetDescription>
            <div className="mt-1 grid grid-cols-2 gap-2.5">
              <SheetClose ref={abbrechenRef} disabled={isDeleting} className={KNOPF_UMRISS}>
                Abbrechen
              </SheetClose>
              {loeschenKnopf}
            </div>
          </SheetBlatt>
        </Sheet>
      )}
    </div>
  )
}

function ToggleRow({
  label,
  hof,
  active,
  disabled,
  disabledNote,
  hinweis,
  onToggle,
}: {
  label: string
  hof: string
  active: boolean
  disabled?: boolean
  disabledNote?: string
  /** Kurzer Satz unter dem Namen, z. B. „Wartet auf deine Bestätigung" (S11). */
  hinweis?: string
  onToggle: () => void
}) {
  const hinweisId = useId()
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 py-1">
      {/* Ohne Symbol, die Bezeichnung fett in Textfarbe — auch, wenn der Schalter gesperrt ist (Board s2-kundenkonto). */}
      <div className="min-w-0">
        <span className="text-[15px] font-semibold text-foreground">{label}</span>
        {disabled && disabledNote && <p className="text-[13px] leading-snug text-muted-foreground">{disabledNote}</p>}
        {/* Der Stand in Worten, nicht nur als Schalterfarbe (Board s2-kundenkonto). */}
        {!disabled && !hinweis && <p className="text-[13px] text-muted-foreground">{active ? 'an' : 'aus'}</p>}
        {hinweis && (
          <p id={hinweisId} className="text-[13px] text-status-offen">
            {hinweis}
          </p>
        )}
      </div>
      {/* Ein Schalter: Rolle „switch" sagt dem Screenreader Zustand und Zweck.
          Sichtbar 24 px hoch, die Trefferfläche über ::before 44 px. */}
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-describedby={hinweis ? hinweisId : undefined}
        aria-label={`${label} von ${hof}`}
        onClick={onToggle}
        disabled={disabled}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 before:absolute before:-inset-x-0 before:-inset-y-2.5 before:content-[''] disabled:cursor-not-allowed disabled:opacity-40",
          active ? 'bg-accent' : 'bg-muted-foreground/45',
          FOKUS_RAHMEN
        )}
      >
        {/* Der Schieber in Crème (accent-foreground): im neuen Design in beiden
            Themes hell — er liegt auf grüner wie auf grauer Schiene sichtbar. */}
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-accent-foreground shadow transition-transform duration-200',
            active ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  )
}
