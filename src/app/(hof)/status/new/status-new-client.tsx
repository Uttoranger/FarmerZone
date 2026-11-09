'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Check, Camera, Crop, Loader2, X } from 'lucide-react'
import { publishStatusPost } from '@/server/actions/status-posts'
import { speichereBildAusschnittAction } from '@/server/actions/bild-ausschnitt'
import { BildAusschnitt } from '@/components/shared/bild-ausschnitt'
import { AUSSCHNITT_STANDARD, bildStil } from '@/lib/bild-ausschnitt'
import { BEITRAG_RAHMEN, BILD_RAHMEN_TEXT, alsFotoAusschnitt, ausschnittOderNull } from '@/lib/bild-rahmen'
import type { BildAusschnitt as BildAusschnittWert } from '@/schemas/bild-ausschnitt'
import { stufenText, useImageUpload } from '@/components/shared/image-upload'
import { toast } from 'sonner'
import { aktionOhneWurf } from '@/components/mein-hof/abschnitt-speichern'
import { FeldFehlerSatz, SpeicherFehler, feldFehlerAttribute } from '@/components/shared/formular-meldungen'
import { enterTaste } from '@/lib/feld-attribute'
import { FREIWILLIG } from '@/lib/profil-meldungen'
import { NETZ_SATZ } from '@/lib/netz'
import { cn } from '@/lib/utils'
import { BEITRAG_ABLAUF_TEXT, BEITRAG_ANLAESSE, BEITRAG_ANLASS, beitragVorschauText, enthaeltVorname, type BeitragAnlass } from '@/lib/beitrag-anlass'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { FELD_LABEL } from '@/components/hof-bestellungen/stil'
import { FesteAktionsleiste, AKTIONSLEISTE_KNOPF, AKTIONSLEISTE_ZURUECK } from '@/components/ui/feste-aktionsleiste'
import { formatEuro } from '@/lib/format'
import { MAILABSTAND_TAGE, mailVersandMeldung } from '@/lib/beitrag-mailabstand'
import { tageSeit } from '@/lib/hof-kunden'
import { BEITRAEGE_HREF } from '@/lib/bauern-navigation'
import { TeilenFenster } from '@/components/teilen/teilen-fenster'
import { ladeBeitragFenster } from '@/components/teilen/beitrag-teilen'
import type { TeilenFensterBeitrag } from '@/lib/teilen-fenster'

// Wort und Symbol je Anlass kommen aus BEITRAG_ANLASS (Register F8) — dieselben wie an der Marke über dem Beitrag.
const ANLASS_OPTIONS = BEITRAG_ANLAESSE.map((value) => ({ value, ...BEITRAG_ANLASS[value] }))

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

// ── Schrittzeiger ──────────────────────────────────────────────────────────
/*
 * Ohne Linien, zentriert; erledigt grün mit Haken, der aktuelle Schritt dunkel (Liste Lauf 32, beitraege
 * „Schrittzeiger“, Nr. 250). Die h1 „Neuer Beitrag“ trägt der Werkzeug-Kopf der Seite in jedem Schritt.
 */
function Stepper({ step }: { step: number }) {
  const steps = ['Inhalt', 'Empfänger', 'Versand']
  return (
    // Über die volle Breite: jeder Schritt nimmt ein Drittel (Board s2-/w2-beitraege; Abnahme Lauf 32 „Schrittzeiger eng“).
    <ol className="mb-5 flex" aria-label={`Schritt ${step} von ${steps.length}`}>
      {steps.map((label, i) => {
        const num = i + 1
        const isDone = step > num
        const isActive = step === num
        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-1" aria-current={isActive ? 'step' : undefined}>
            <div
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold',
                isDone
                  ? 'bg-status-fertig text-background'
                  : isActive
                    ? 'bg-foreground text-background'
                    : 'border-[1.5px] border-input text-muted-foreground',
              )}
            >
              {isDone ? <Check className="size-3.5" aria-hidden="true" /> : num}
            </div>
            <span
              className={cn(
                'text-[13px] leading-tight',
                isActive ? 'font-bold text-foreground' : 'font-medium text-muted-foreground',
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
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
  // Ein Fehler beim Veröffentlichen, der kein Feld betrifft: Karte über dem Knopf statt Toast; am Netz mit „Nochmal".
  const [publishFehler, setPublishFehler] = useState<string | null>(null)

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
      // Der Satz steht am Feld (role="alert"), kein zweiter im Toast; der Fokus geht dorthin.
      const erstes = document.getElementById(firstId)
      erstes?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      erstes?.focus({ preventScroll: true })
      return
    }

    setFieldErrors({})
    setStep(2)
  }

  function handlePublish() {
    setPublishFehler(null)
    startTransition(async () => {
      // aktionOhneWurf: Ohne Netz würfe die Aktion und ginge an die Fehlerseite – der Beitrag wäre weg.
      const res = await aktionOhneWurf(() =>
        publishStatusPost({
          title: title.trim(),
          body: body.trim(),
          anlass,
          photoUrl: photoUrl ?? undefined,
          linkedProductIds,
          showOnFarmPage,
          sendEmail: sendEmail && !emailBlocked,
        })
      )
      if (res.error) {
        setPublishFehler(res.error)
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
      if (showOnFarmPage) parts.push(BEITRAG_ABLAUF_TEXT.veroeffentlichtHofseite)
      if (sendEmail && !emailBlocked && (res.emailCount ?? 0) > 0)
        parts.push(mailVersandMeldung(res.emailCount ?? 0))
      toast.success(`Beitrag veröffentlicht${parts.length ? ' — ' + parts.join(', ') : ''}`)
      // Direkt in den Reiter — /status leitet seit Nr. 22e ohnehin dorthin um.
      router.push(BEITRAEGE_HREF)
    })
  }

  return (
    // Linksbündig auf dem Seitengrund, ohne große Karte um den Assistenten (Board s2-/w2-beitraege; Abnahme Lauf 32
    // „Assistent in einer großen Karte“). Die Spalte gibt der Rahmen der Seite vor (672 px im Web).
    <div>
      <div>
        <Stepper step={step} />

        {/* ── Step 1: Content ─────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            {/* „Inhalt erstellen“ als Abschnittsüberschrift statt Unterzeile (Liste Lauf 32, beitraege). */}
            <h2 className="mb-5 font-heading text-[18px] font-semibold text-foreground">Inhalt erstellen</h2>

            {/* Anlass — gewählt in umgekehrter Textfarbe wie der gewählte Filter-Chip (Board w2-beitraege, V51: im Hofbereich nie grün). */}
            <div className="mb-5">
              <p className={cn(FELD_LABEL, 'mb-2')}>Anlass</p>
              {/* Einzeilige Chips ohne Symbol (Liste Lauf 32, beitraege „Anlass als 2×2-Kacheln“). */}
              <div className="flex flex-wrap gap-2">
                {ANLASS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAnlass(opt.value)}
                    aria-pressed={anlass === opt.value}
                    className={cn(
                      'flex min-h-11 items-center rounded-full border px-4 text-[14px] font-semibold transition-colors',
                      FOKUS_RAHMEN,
                      anlass === opt.value
                        ? 'bg-foreground border-foreground text-background'
                        : 'border-input bg-card text-foreground hover:bg-muted',
                    )}
                  >
                    {opt.wort}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="status-title" className="text-[15px] font-semibold text-foreground">
                  Titel
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
                // Kein <form>: Enter springt von Hand in die Nachricht, wie es die „Weiter"-Taste verspricht.
                enterKeyHint={enterTaste(false)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
                  e.preventDefault()
                  document.getElementById('status-body')?.focus()
                }}
                {...feldFehlerAttribute('status-title', Boolean(fieldErrors.title))}
                className={cn(
                  RUNDUNG.feld,
                  'w-full min-h-12 px-3.5 border bg-card text-base focus:outline-none focus:ring-2 transition-colors',
                  fieldErrors.title
                    ? 'border-status-offen focus:ring-status-offen/30'
                    : 'border-input focus:ring-ring/50',
                )}
              />
              <FeldFehlerSatz feldId="status-title" text={fieldErrors.title ? 'Bitte gib einen Titel ein – er steht über deinem Beitrag.' : null} />
            </div>

            {/* Body */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="status-body" className="text-[15px] font-semibold text-foreground">
                  Nachricht
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
                rows={5}
                enterKeyHint={enterTaste(true, 'send')}
                {...feldFehlerAttribute('status-body', Boolean(fieldErrors.body))}
                className={cn(
                  RUNDUNG.feld,
                  'w-full px-3.5 py-2.5 border bg-card text-base focus:outline-none focus:ring-2 resize-none transition-colors',
                  fieldErrors.body
                    ? 'border-status-offen focus:ring-status-offen/30'
                    : 'border-input focus:ring-ring/50',
                )}
              />
              <FeldFehlerSatz feldId="status-body" text={fieldErrors.body ? 'Bitte schreib eine Nachricht – sie ist der Inhalt deines Beitrags.' : null} />
              {/* Wie im Board s2-/w2-beitraege: ohne „Tipp:“ und ohne Code-Markierung, 13 px. */}
              <p className="text-[13px] text-muted-foreground mt-1">
                {'{Vorname}'} {BEITRAG_ABLAUF_TEXT.anredeTipp}
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
              <div className={cn('relative mb-3 aspect-[3/2] max-h-48 w-full overflow-hidden border border-border bg-muted', RUNDUNG.karte)}>
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
                className={cn(FOTO_KNOPF, 'disabled:opacity-60')}
              >
                {photoUpload.isUploading
                  ? <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  : <Camera className="size-4" aria-hidden="true" />}
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
                  className={FOTO_KNOPF}
                >
                  <Crop className="size-4" strokeWidth={1.7} aria-hidden="true" />
                  {BILD_RAHMEN_TEXT.anpassen}
                </button>
              )}
            </div>

            {/* Product links */}
            {products.length > 0 && (
              <div className="mb-5">
                <p className={cn(FELD_LABEL, 'mb-2')}>
                  Produkte verlinken{' '}
                  <span className="text-muted-foreground font-normal">{FREIWILLIG}</span>
                </p>
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
                        // Nur der Name, kräftig (Liste Lauf 32, beitraege „Produkt-Chips mit Preis“).
                        'min-h-11 rounded-full border px-4 py-1.5 text-[14px] font-semibold transition-colors',
                        FOKUS_RAHMEN,
                        linkedProductIds.includes(p.id)
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-input bg-card text-foreground hover:bg-muted',
                      )}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Am Handy fest über der Unterleiste (G2), im Web am Ende des Formulars; immer bedienbar, prüft beim Tipp. */}
            <FesteAktionsleiste className={WEB_KNOPFREIHE}>
              <button type="button" onClick={handleTryNext} className={cn(AKTIONSLEISTE_KNOPF, WEB_HAUPTKNOPF)}>
                Weiter zu Empfängern
              </button>
            </FesteAktionsleiste>
          </div>
        )}

        {/* ── Step 2: Channels ────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            {/* Ohne Unterzeile „Kanäle auswählen“ (Board Bild 3; Abnahme Lauf 32 „Zusatz-Unterzeile“). */}
            <h2 className="mb-4 font-heading text-[18px] font-semibold text-foreground">Empfänger wählen</h2>

            <div className="space-y-3 mb-5">
              <ChannelCard
                title={BEITRAG_ABLAUF_TEXT.hofseiteTitel}
                subtitle={BEITRAG_ABLAUF_TEXT.hofseiteSatz}
                checked={showOnFarmPage}
                onChange={setShowOnFarmPage}
              />
              <ChannelCard
                title={BEITRAG_ABLAUF_TEXT.mailTitel}
                subtitle={
                  emailBlocked
                    ? BEITRAG_ABLAUF_TEXT.mailGesperrt(recentEmailDaysAgo ?? 0, MAILABSTAND_TAGE)
                    : emailCount > 0
                      ? BEITRAG_ABLAUF_TEXT.mailAbonniert(emailCount, MAILABSTAND_TAGE)
                      : BEITRAG_ABLAUF_TEXT.mailKeine
                }
                checked={sendEmail && !emailBlocked}
                onChange={emailBlocked ? undefined : setSendEmail}
                disabled={emailCount === 0 || emailBlocked}
              />
            </div>

            {/* Einfacher Text statt grauem Kasten (Liste Lauf 32, beitraege). */}
            <p className="mb-5 text-[14px] text-muted-foreground">{BEITRAG_ABLAUF_TEXT.zustimmung}</p>

            {/* „Vorschau ansehen“ ohne Pfeil; „← Zurück“ am Handy darunter, im Web umrandet links daneben (G2). */}
            <FesteAktionsleiste className={WEB_KNOPFREIHE} zurueck={<ZurueckKnopf onClick={() => setStep(1)} />}>
              <button type="button" onClick={() => setStep(3)} className={cn(AKTIONSLEISTE_KNOPF, WEB_HAUPTKNOPF)}>
                Vorschau ansehen
              </button>
            </FesteAktionsleiste>
          </div>
        )}

        {/* ── Step 3: Preview + Send ──────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h2 className="mb-5 font-heading text-[18px] font-semibold text-foreground">{BEITRAG_ABLAUF_TEXT.vorschauSchritt}</h2>

            {/* Vorschau ohne Marke über dem Titel (Liste Lauf 32, beitraege „Vorschau“). */}
            <div className={cn('mb-5 border border-border bg-card p-4', RUNDUNG.karte)}>
              <h3 className="mb-2 font-heading text-[19px] leading-snug font-semibold text-foreground">{title}</h3>
              {/* Der Hof soll sehen, wie der Beitrag bei einer Kundin ankommt: Textfarbe, 15 px, Beispielname statt
                  Platzhalter (Board Bild 4; Liste Lauf 32 Z. 430). Abgeschickt wird der Text mit Platzhalter. */}
              <p className="text-[15px] leading-normal whitespace-pre-wrap text-foreground">{beitragVorschauText(body)}</p>
              {/* Beispielname statt Marke „{Vorname}“, der Hinweis klein darunter (Liste Lauf 32 Z. 430; Runde 1). */}
              {enthaeltVorname(body) && (
                <p className="mt-1.5 text-[13px] text-muted-foreground">{BEITRAG_ABLAUF_TEXT.vorschauNameHinweis}</p>
              )}
              {linkedProductIds.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {products
                    .filter((p) => linkedProductIds.includes(p.id))
                    .map((p) => (
                      // Umrandete Pille „Bergkäse · € 6,58“ (Liste Lauf 32, beitraege).
                      <span key={p.id} className="inline-flex min-h-11 items-center rounded-full border border-input px-4 text-[14px] font-semibold text-foreground">
                        {p.name} · {formatEuro(p.price)}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Recipient summary */}
            {/* Weiße Karte, Kopf „EMPFÄNGER“, Haken als Symbol (Liste Lauf 32, beitraege). */}
            <div className={cn('mb-5 space-y-2 border border-border bg-card p-4', RUNDUNG.karte)}>
              <h3 className="mb-2 text-[13px] font-bold tracking-[0.04em] text-muted-foreground uppercase">Empfänger</h3>
              {showOnFarmPage && (
                <p className="flex items-center gap-2 text-[15px] text-foreground">
                  <Check className="size-4 shrink-0 text-status-fertig" strokeWidth={2.5} aria-hidden="true" />
                  {BEITRAG_ABLAUF_TEXT.hofseiteZusammenfassung}
                </p>
              )}
              {sendEmail && !emailBlocked && emailCount > 0 && (
                <p className="flex items-center gap-2 text-[15px] text-foreground">
                  <Check className="size-4 shrink-0 text-status-fertig" strokeWidth={2.5} aria-hidden="true" />
                  {BEITRAG_ABLAUF_TEXT.mailZusammenfassung(emailCount)}
                </p>
              )}
            </div>

            <SpeicherFehler text={publishFehler} nochmal={publishFehler === NETZ_SATZ} onNochmal={handlePublish} laeuft={pending} className="mb-3" />

            <FesteAktionsleiste className={WEB_KNOPFREIHE} zurueck={<ZurueckKnopf onClick={() => setStep(2)} />}>
              <button
                type="button"
                onClick={handlePublish}
                disabled={pending || veroeffentlicht}
                className={cn(AKTIONSLEISTE_KNOPF, WEB_HAUPTKNOPF, 'disabled:opacity-60')}
              >
                {pending ? 'Wird versendet…' : 'Versand starten'}
              </button>
            </FesteAktionsleiste>
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

/** Im Web der Hauptknopf so breit wie sein Wort, 48 px hoch (V47; Board w2-beitraege). */
const WEB_HAUPTKNOPF = 'md:min-h-12 md:w-auto md:px-6'

/**
 * Im Web stehen die Knöpfe rechts: der Hauptknopf ganz rechts, „← Zurück“ links daneben (Board w2-beitraege:
 * `row-reverse` mit `flex-start`; Abnahme Lauf 32 „Zurück/Hauptknopf links statt rechts“, „volle Breite statt
 * kompakt rechts“). Gilt in jedem Schritt, auch mit nur einem Knopf.
 */
const WEB_KNOPFREIHE = 'md:flex-row-reverse md:justify-start md:gap-3'

/** „Foto hinzufügen“, „Foto ersetzen“, „Ausschnitt anpassen“: 15 px halbfett, Feldrand, 10 px rund (Abnahme 269 „klein“). */
const FOTO_KNOPF = cn(
  'flex min-h-11 items-center gap-2 border border-input bg-card px-4 text-[15px] font-semibold text-foreground hover:bg-muted',
  RUNDUNG.feld,
  FOKUS_RAHMEN
)

/** „← Zurück“: am Handy der Textknopf unter dem Hauptknopf, im Web umrandet. */
function ZurueckKnopf({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn(AKTIONSLEISTE_ZURUECK, 'md:min-h-12 md:w-auto md:rounded-[14px] md:border-[1.5px] md:border-foreground md:px-5 md:text-[16px] md:font-bold')}>
      ← Zurück
    </button>
  )
}

/** Ein Kanal als Karte mit Checkbox links, ohne Symbol (Liste Lauf 32, beitraege „Empfänger-Karten“). */
function ChannelCard({
  title,
  subtitle,
  checked,
  onChange,
  disabled = false,
}: {
  title: string
  subtitle: string
  checked: boolean
  onChange?: (v: boolean) => void
  disabled?: boolean
}) {
  const an = checked && !disabled
  return (
    <button
      type="button"
      role="checkbox"
      onClick={() => !disabled && onChange?.(!checked)}
      aria-checked={an}
      aria-disabled={disabled || undefined}
      className={cn(
        'flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
        RUNDUNG.karte,
        FOKUS_RAHMEN,
        // Gewählt getönt mit Akzent-Rand (Board w2-beitraege Bild 3; Abnahme Lauf 32 „gewählte Karten neutral“).
        an ? 'border-2 border-status-offen bg-zustand-tun-grund' : 'border border-input bg-card hover:bg-muted',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-[22px] shrink-0 items-center justify-center rounded-[5px] border-2',
          an ? 'border-status-offen bg-status-offen text-background' : 'border-input bg-card',
        )}
      >
        {an && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-[13px] text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  )
}
