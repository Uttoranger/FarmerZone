'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Home, Mail,
  ArrowRight, CheckCircle, Check,
  Camera, Crop, Loader2, X,
} from 'lucide-react'
import { publishStatusPost } from '@/server/actions/status-posts'
import { speichereBildAusschnittAction } from '@/server/actions/bild-ausschnitt'
import { BildAusschnitt } from '@/components/shared/bild-ausschnitt'
import { AUSSCHNITT_STANDARD, bildStil } from '@/lib/bild-ausschnitt'
import { BEITRAG_RAHMEN, BILD_RAHMEN_TEXT, alsFotoAusschnitt, ausschnittOderNull } from '@/lib/bild-rahmen'
import type { BildAusschnitt as BildAusschnittWert } from '@/schemas/bild-ausschnitt'
import { stufenText, useImageUpload } from '@/components/shared/image-upload'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { BEITRAG_ANLAESSE, BEITRAG_ANLASS, type BeitragAnlass } from '@/lib/beitrag-anlass'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { formatEuro } from '@/lib/format'
import { renderStatusBodyWithChip } from '@/lib/status-body'
import { MAILABSTAND_TAGE, mailVersandMeldung } from '@/lib/beitrag-mailabstand'
import { tageSeit } from '@/lib/hof-kunden'
import { BEITRAEGE_HREF } from '@/lib/bauern-navigation'
import { TeilenFenster } from '@/components/teilen/teilen-fenster'
import { ladeBeitragFenster } from '@/components/teilen/beitrag-teilen'
import type { TeilenFensterBeitrag } from '@/lib/teilen-fenster'

// Wort und Symbol je Anlass kommen aus BEITRAG_ANLASS (Register F8) — dieselben wie an der Marke über dem Beitrag.
const ANLASS_OPTIONS = BEITRAG_ANLAESSE.map((value) => ({ value, ...BEITRAG_ANLASS[value] }))

// Marke in der Vorschau (nur Anzeige). Seit Nr. 22e in der HofShell: Tokens
// statt Tailwind-Palette — Schrift in der Zustandsfarbe des Themes, Fläche
// getönt (wie StatusBadge), damit sie in beiden Themes 4,5:1 hält.
const ANLASS_COLOR: Record<BeitragAnlass, string> = {
  FRESH_PRODUCT: 'text-status-fertig bg-accent/15',
  NEW_SEASON:    'text-status-fertig bg-accent/15',
  PROMOTION:     'text-status-offen bg-primary/15',
  ANNOUNCEMENT:  'text-foreground bg-muted',
}

interface Props {
  products: { id: string; name: string; price: number }[]
  emailCount: number
  recentEmailSentAt: string | null
  // Zeitpunkt der Seite (ISO, vom Server) — „vor n Tagen" rechnet nie mit der
  // Uhr des Browsers, sonst wichen Server- und Browser-HTML ab (CODING_STANDARDS §2).
  jetzt: string
  farmSlug: string
  // Vorlage-Muster (nachlese-6): Alt-Status als Startwerte — danach verhält
  // sich der Wizard exakt wie eine neue Erstellung (neuer Status, heutiges
  // Datum, normale Mail-Logik, Frequenzschutz unverändert)
  prefill?: { anlass: string; title: string; body: string; photoUrl: string | null } | null
  // Vorgewählter Anlass aus `?anlass=` (Nr. 129, schon geprüft) — sticht den der Vorlage.
  anlass?: BeitragAnlass | null
}

// ── Visual stepper ──────────────────────────────────────────────────────────
function Stepper({ step }: { step: number }) {
  const steps = ['Inhalt', 'Empfänger', 'Versand']
  return (
    <div className="flex items-start mb-7">
      {steps.map((label, i) => {
        const num = i + 1
        const isDone = step > num
        const isActive = step === num
        const isLast = i === steps.length - 1
        return (
          <div key={label} className="contents">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all shrink-0',
                  isDone || isActive
                    ? 'bg-accent border-accent text-accent-foreground'
                    : 'border-border bg-card text-muted-foreground',
                )}
              >
                {isDone ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : num}
              </div>
              <span
                className={cn(
                  'text-[11px] font-medium leading-none',
                  isActive ? 'text-foreground' : isDone ? 'text-status-fertig' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
            {!isLast && (
              <div className={cn('flex-1 h-0.5 mt-3.5 mx-1', isDone ? 'bg-accent/50' : 'bg-border')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function StatusNewClient({ products, emailCount, recentEmailSentAt, jetzt, prefill, anlass: anlassVorwahl = null }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState(1)

  // Form state — Startwerte aus der Vorlage (?from=…), sonst leer
  const [anlass, setAnlass] = useState<BeitragAnlass>(
    anlassVorwahl ?? BEITRAG_ANLAESSE.find((a) => a === prefill?.anlass) ?? 'FRESH_PRODUCT'
  )
  const [title, setTitle] = useState(prefill?.title ?? '')
  const [body, setBody] = useState(prefill?.body ?? '')
  const [photoUrl, setPhotoUrl] = useState<string | null>(prefill?.photoUrl ?? null)
  const [linkedProductIds, setLinkedProductIds] = useState<string[]>([])

  // Ausschnitt des Beitragsfotos (Register N17, Nr. 98): gewählt vor dem
  // Veröffentlichen, geschrieben danach — erst dann gibt es den Beitrag.
  const [ausschnitt, setAusschnitt] = useState<BildAusschnittWert | null>(null)
  // Offen gleich nach dem Upload („Passt so“) oder über „Ausschnitt anpassen“.
  const [ausschnittOffen, setAusschnittOffen] = useState<false | 'nachUpload' | 'anpassen'>(false)

  const photoUpload = useImageUpload({
    variant: 'status',
    onUploaded: (url) => {
      setPhotoUrl(url)
      // Ein neues Foto beginnt ohne Ausschnitt (ganz, wie bisher); der Baustein öffnet einmal von selbst.
      setAusschnitt(null)
      setAusschnittOffen('nachUpload')
    },
  })

  function entferneFoto() {
    setPhotoUrl(null)
    setAusschnitt(null)
    setAusschnittOffen(false)
  }

  // A3: field validation errors
  const [fieldErrors, setFieldErrors] = useState<{ title?: boolean; body?: boolean }>({})

  // Channel state
  const [showOnFarmPage, setShowOnFarmPage] = useState(true)
  const [sendEmail, setSendEmail] = useState(emailCount > 0)
  // Nach dem Veröffentlichen (Register T5): das Teilen-Fenster des Beitrags;
  // „veröffentlicht" sperrt den Knopf, bis der Weg in den Reiter fertig ist.
  const [teilen, setTeilen] = useState<TeilenFensterBeitrag | null>(null)
  const [veroeffentlicht, setVeroeffentlicht] = useState(false)

  const recentEmailDaysAgo = recentEmailSentAt ? tageSeit(recentEmailSentAt, new Date(jetzt)) : null
  const emailBlocked = recentEmailDaysAgo !== null && recentEmailDaysAgo < MAILABSTAND_TAGE

  // A3: validate step 1 on click, show field errors instead of silent disabled
  function handleTryNext() {
    const errs: { title?: boolean; body?: boolean } = {}
    if (!title.trim()) errs.title = true
    if (!body.trim()) errs.body = true

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      const firstId = errs.title ? 'status-title' : 'status-body'
      document.getElementById(firstId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      toast.error('Bitte alle Pflichtfelder ausfüllen.')
      return
    }

    setFieldErrors({})
    setStep(2)
  }

  function handlePublish() {
    startTransition(async () => {
      const res = await publishStatusPost({
        title: title.trim(),
        body: body.trim(),
        anlass,
        photoUrl: photoUrl ?? undefined,
        linkedProductIds,
        showOnFarmPage,
        sendEmail: sendEmail && !emailBlocked,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      // Der Beitrag steht — ein gescheiterter Ausschnitt nimmt ihn nicht zurück, er sagt es nur.
      if (res.postId && photoUrl && ausschnitt) {
        const gespeichert = await speichereBildAusschnittAction({ ziel: 'beitrag', statusPostId: res.postId, wert: alsFotoAusschnitt(ausschnitt) })
        if ('error' in gespeichert) toast.error(BILD_RAHMEN_TEXT.beitrag.nichtGespeichert)
      }
      setVeroeffentlicht(true)
      // Register T5: Steht der Beitrag auf der Hofseite, öffnet sich das
      // Teilen-Fenster im Beitrag-Modus (am Handy das Blatt) — es ersetzt die
      // Meldung und trägt die WhatsApp-Abonnentinnen als erste Karte;
      // Schließen führt in den Reiter. Kommt das Fenster nicht, bleibt der
      // Beitrag trotzdem veröffentlicht: dann die Meldung wie ohne Hofseite.
      if (showOnFarmPage && res.postId) {
        const fenster = await ladeBeitragFenster(res.postId)
        if ('daten' in fenster) {
          setTeilen(fenster.daten)
          return
        }
      }
      const parts: string[] = []
      if (showOnFarmPage) parts.push('auf der Hof-Seite')
      if (sendEmail && !emailBlocked && (res.emailCount ?? 0) > 0)
        parts.push(mailVersandMeldung(res.emailCount ?? 0))
      toast.success(`Beitrag veröffentlicht${parts.length ? ' — ' + parts.join(', ') : ''}`)
      // Direkt in den Reiter — /status leitet seit Nr. 22e ohnehin dorthin um.
      router.push(BEITRAEGE_HREF)
    })
  }

  const AnlassSymbol = BEITRAG_ANLASS[anlass].symbol

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl border border-border bg-card p-5 md:p-8">
        <Stepper step={step} />

        {/* ── Step 1: Content ─────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div className="mb-6">
              <h1 className="font-heading text-xl font-semibold text-foreground">Neuer Beitrag</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Inhalt erstellen</p>
            </div>

            {/* Anlass — A6: active = soft-green fill + dark green border + check */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-foreground mb-2">Anlass</label>
              <div className="grid grid-cols-2 gap-2">
                {ANLASS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAnlass(opt.value)}
                    aria-pressed={anlass === opt.value}
                    className={cn(
                      'relative flex min-h-11 items-center gap-2.5 p-3 rounded-xl border-2 text-sm font-medium transition-all text-left',
                      FOKUS_RAHMEN,
                      anlass === opt.value
                        ? 'bg-accent/15 border-accent text-foreground'
                        : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40',
                    )}
                  >
                    <opt.symbol className="size-5" aria-hidden="true" />
                    <span className="flex-1">{opt.wort}</span>
                    {anlass === opt.value && <Check className="size-4 shrink-0 text-status-fertig" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="status-title" className="text-sm font-medium text-foreground">
                  Titel *
                </label>
                <span className="text-xs text-muted-foreground">{title.length}/80</span>
              </div>
              <input
                id="status-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value.slice(0, 80))
                  if (fieldErrors.title) setFieldErrors((p) => ({ ...p, title: false }))
                }}
                placeholder="z.B. Frisches Rindfleisch ab Samstag"
                className={cn(
                  'w-full h-11 px-3 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 transition-colors',
                  fieldErrors.title
                    ? 'border-status-offen focus:ring-status-offen/30'
                    : 'border-border focus:ring-ring/50',
                )}
              />
              {fieldErrors.title && (
                <p className="text-xs font-medium text-status-offen mt-1">Bitte einen Titel eingeben.</p>
              )}
            </div>

            {/* Body */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="status-body" className="text-sm font-medium text-foreground">
                  Nachricht *
                </label>
                <span className="text-xs text-muted-foreground">{body.length}/500</span>
              </div>
              <textarea
                id="status-body"
                value={body}
                onChange={(e) => {
                  setBody(e.target.value.slice(0, 500))
                  if (fieldErrors.body) setFieldErrors((p) => ({ ...p, body: false }))
                }}
                placeholder="Schreibe hier deinen Beitrag…"
                rows={5}
                className={cn(
                  'w-full px-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 resize-none transition-colors',
                  fieldErrors.body
                    ? 'border-status-offen focus:ring-status-offen/30'
                    : 'border-border focus:ring-ring/50',
                )}
              />
              {fieldErrors.body && (
                <p className="text-xs font-medium text-status-offen mt-1">Bitte eine Nachricht eingeben.</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Tipp:{' '}
                <code className="bg-muted px-1 rounded">{'{Vorname}'}</code> wird automatisch
                ersetzt. Auf der Hof-Seite steht die Anrede ohne Namen.
              </p>
            </div>

            {/* Optionales Foto */}
            {photoUpload.fileInput}
            {/* Ohne Ausschnitt object-contain auf Sand: volles Bild (nachlese-7); mit Ausschnitt füllt es den Rahmen wie auf der Hofseite. */}
            {photoUrl && ausschnittOffen ? (
              <div className="mb-3">
                <BildAusschnitt
                  // Ein neues Foto bei offenem Baustein beginnt frisch — der Baustein hält seine Wahl selbst, sie gehörte zum alten Foto.
                  key={photoUrl}
                  foto={photoUrl}
                  wert={ausschnitt ?? AUSSCHNITT_STANDARD}
                  rahmen={{ name: BILD_RAHMEN_TEXT.beitrag.rahmen, verhaeltnis: BEITRAG_RAHMEN }}
                  nachUpload={ausschnittOffen === 'nachUpload'}
                  onSpeichern={(wert) => {
                    // Mitte, 100 %, Natürlich ist kein Ausschnitt: Das Foto bleibt ganz, so wie es die Hofseite danach zeigt.
                    setAusschnitt(ausschnittOderNull(wert))
                    setAusschnittOffen(false)
                  }}
                  onAbbrechen={() => setAusschnittOffen(false)}
                />
                <p className="mt-3 text-xs text-muted-foreground">{BILD_RAHMEN_TEXT.beitrag.satz}</p>
              </div>
            ) : photoUrl && (
              <div className="relative w-full aspect-[3/2] max-h-48 mb-3 rounded-xl overflow-hidden border border-border bg-muted">
                <Image
                  src={photoUrl}
                  alt="Foto zum Beitrag"
                  fill
                  sizes="(min-width: 768px) 640px, 100vw"
                  className={ausschnitt ? 'object-cover' : 'object-contain'}
                  style={bildStil(ausschnitt)}
                />
                <button
                  type="button"
                  onClick={entferneFoto}
                  aria-label="Foto entfernen"
                  className={cn(
                    // Auf dem Foto theme-fest dunkel mit heller Schrift (DESIGN_SYSTEM „Bild-Overlays"); 44 px Trefferfläche.
                    'absolute top-1 right-1 flex items-center justify-center size-11 rounded-full transition-opacity hover:opacity-90',
                    FOKUS_RAHMEN,
                  )}
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/85 text-accent-foreground">
                    <X className="size-4" aria-hidden="true" />
                  </span>
                </button>
              </div>
            )}

            {/* Feature buttons */}
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={photoUpload.openFilePicker}
                disabled={photoUpload.isUploading}
                className={cn('flex items-center gap-1.5 min-h-11 px-3 rounded-lg border border-border text-xs text-foreground hover:bg-muted/40 disabled:opacity-60', FOKUS_RAHMEN)}
              >
                {photoUpload.isUploading
                  ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  : <Camera className="size-3.5" aria-hidden="true" />}
                {photoUpload.isUploading
                  ? photoUpload.progress
                    ? stufenText(photoUpload.progress)
                    : 'Lädt…'
                  : photoUrl
                    ? 'Foto ersetzen'
                    : 'Foto hinzufügen'}
              </button>
              {photoUrl && !ausschnittOffen && !photoUpload.isUploading && (
                <button
                  type="button"
                  onClick={() => setAusschnittOffen('anpassen')}
                  className={cn('flex items-center gap-1.5 min-h-11 px-3 rounded-lg border border-border text-xs text-foreground hover:bg-muted/40', FOKUS_RAHMEN)}
                >
                  <Crop className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
                  {BILD_RAHMEN_TEXT.anpassen}
                </button>
              )}
            </div>

            {/* Product links */}
            {products.length > 0 && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Produkte verlinken{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={linkedProductIds.includes(p.id)}
                      onClick={() =>
                        setLinkedProductIds((prev) =>
                          prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                        )
                      }
                      className={cn(
                        'min-h-11 text-xs px-3 py-1.5 rounded-full border transition-colors',
                        FOKUS_RAHMEN,
                        linkedProductIds.includes(p.id)
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border text-muted-foreground hover:border-foreground/30',
                      )}
                    >
                      {p.name} — {formatEuro(p.price)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* A2: orange CTA, A3: always clickable — validates on click */}
            <button
              onClick={handleTryNext}
              className={cn('w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors', FOKUS_RAHMEN)}
            >
              Weiter zu Empfängern
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* ── Step 2: Channels ────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <div className="mb-6">
              <button
                onClick={() => setStep(1)}
                className={cn('mb-2 -ml-2 inline-flex min-h-11 items-center rounded-full px-2 text-sm text-muted-foreground hover:text-foreground', FOKUS_RAHMEN)}
              >
                ← Zurück
              </button>
              <h1 className="font-heading text-xl font-semibold text-foreground">
                Empfänger wählen
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Kanäle auswählen</p>
            </div>

            <div className="space-y-3 mb-5">
              <ChannelCard
                icon={<Home className="size-5" aria-hidden="true" />}
                title="Auf meiner Hof-Seite anzeigen"
                subtitle="Alle Besucher sehen es · für 7 Tage prominent"
                checked={showOnFarmPage}
                onChange={setShowOnFarmPage}
              />
              <ChannelCard
                icon={<Mail className="size-5" aria-hidden="true" />}
                title="Per E-Mail an Abonnenten"
                subtitle={
                  emailBlocked
                    ? `Du hast vor ${recentEmailDaysAgo} Tagen bereits E-Mails versendet (Limit: 1× pro ${MAILABSTAND_TAGE} Tage)`
                    : emailCount > 0
                      ? `${emailCount} ${emailCount === 1 ? 'Kunde hat' : 'Kunden haben'} E-Mail-Updates abonniert`
                      : 'Noch keine Abonnenten'
                }
                checked={sendEmail && !emailBlocked}
                onChange={emailBlocked ? undefined : setSendEmail}
                disabled={emailCount === 0 || emailBlocked}
              />
            </div>

            <div className="bg-muted rounded-xl p-4 mb-5 text-sm text-muted-foreground">
              Nur Kunden, die selbst angehakt haben, dass sie informiert werden möchten, bekommen
              E-Mail oder WhatsApp.
            </div>

            {/* A2: orange CTA */}
            <button
              onClick={() => setStep(3)}
              className={cn('w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors', FOKUS_RAHMEN)}
            >
              Vorschau ansehen
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* ── Step 3: Preview + Send ──────────────────────────────────── */}
        {step === 3 && (
          <div>
            <div className="mb-6">
              <button
                onClick={() => setStep(2)}
                className={cn('mb-2 -ml-2 inline-flex min-h-11 items-center rounded-full px-2 text-sm text-muted-foreground hover:text-foreground', FOKUS_RAHMEN)}
              >
                ← Zurück
              </button>
              <h1 className="font-heading text-xl font-semibold text-foreground">
                Vorschau & Versand
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Überprüfen und absenden</p>
            </div>

            {/* Preview card */}
            <div className="bg-card rounded-xl border border-border p-4 mb-5">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 font-medium mb-3',
                  ANLASS_COLOR[anlass],
                )}
              >
                <AnlassSymbol className="size-5" aria-hidden="true" />
                {BEITRAG_ANLASS[anlass].wort}
              </span>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-2">{title}</h2>
              {/* Owner-Vorschau zeigt den Platzhalter als Chip (Status-Paket E) —
                  kundenseitig wird weiterhin gestrippt */}
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{renderStatusBodyWithChip(body)}</p>
              {linkedProductIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                  {products
                    .filter((p) => linkedProductIds.includes(p.id))
                    .map((p) => (
                      <span
                        key={p.id}
                        className="text-xs bg-muted rounded-full px-3 py-1 text-foreground"
                      >
                        {p.name} — {formatEuro(p.price)}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Recipient summary */}
            <div className="bg-muted rounded-xl p-4 mb-5 space-y-2">
              <h3 className="text-sm font-semibold text-foreground mb-2">Empfänger</h3>
              {showOnFarmPage && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="size-4 text-status-fertig shrink-0" aria-hidden="true" />
                  Auf Hof-Seite für 7 Tage anzeigen
                </div>
              )}
              {sendEmail && !emailBlocked && emailCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="size-4 text-status-fertig shrink-0" aria-hidden="true" />
                  {emailCount} E-Mails werden automatisch versendet
                </div>
              )}
            </div>

            {/* A2: orange CTA */}
            <button
              onClick={handlePublish}
              disabled={pending || veroeffentlicht}
              className={cn('w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2', FOKUS_RAHMEN)}
            >
              {pending ? 'Wird versendet…' : 'Versand starten'}
            </button>
          </div>
        )}
      </div>
      {teilen && (
        <TeilenFenster
          daten={teilen}
          offen
          onOffenChange={(offen) => {
            if (offen) return
            setTeilen(null)
            router.push(BEITRAEGE_HREF)
          }}
        />
      )}
    </div>
  )
}

function ChannelCard({
  icon,
  title,
  subtitle,
  checked,
  onChange,
  disabled = false,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  checked: boolean
  onChange?: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange?.(!checked)}
      disabled={disabled}
      aria-pressed={checked && !disabled}
      className={cn(
        'w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
        FOKUS_RAHMEN,
        checked && !disabled ? 'border-accent bg-accent/10' : 'border-border hover:border-border/80',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <div
        className={cn(
          'size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
          checked && !disabled ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
      </div>
      <div
        className={cn(
          'size-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-1 transition-colors',
          checked && !disabled ? 'bg-accent border-accent' : 'border-border',
        )}
      >
        {checked && !disabled && <CheckCircle className="size-3.5 text-accent-foreground" aria-hidden="true" />}
      </div>
    </button>
  )
}
