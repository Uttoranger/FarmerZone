'use client'

import { useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useForm, type FieldError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  AlignLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  ImageIcon,
  Images,
  LayoutList,
  MapPin,
  MoveVertical,
  PenLine,
  Phone,
  ShoppingBag,
  Stamp,
  type LucideIcon,
} from 'lucide-react'
import { updateProfile } from '@/server/actions/farm'
import { saveAppearanceAction, updateBannerFocusAction } from '@/server/actions/appearance'
import {
  profilBearbeitenSchema,
  profileSchema,
  type ProfilBestand,
  type ProfileFormData,
} from '@/schemas/hofprofil'
import { EMAIL_MAX, HOFNAME_MAX, TELEFON_MAX } from '@/lib/eingabegrenzen'
import { FeldZaehler } from '@/components/shared/zeichen-zaehler'
import { appearanceSchema, type AppearanceSaveInput } from '@/schemas/auftritt'
import type { FarmSettings } from '@/server/queries/farm'
import type { AppearanceData, SectionConfig } from '@/server/queries/appearance'
import { alsLand } from '@/lib/laender'
import { titelbildFoto, titelbildVerlauf } from '@/lib/mein-hof'
import { ABSCHNITT_LABEL, type HofseiteFortschritt, type HofseiteZeile } from '@/lib/hofseite-fortschritt'
import type { HofseiteZeileId } from '@/schemas/hofseite-vorschau'
import { VORSCHAU_BEARBEITUNG_BREITE, VORSCHAU_WEB_MINDESTBREITE, type VorschauGeraet } from '@/lib/hofseite-vorschau'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { CoverEditButton, CoverFocusAdjust, TITELBILD_KNOPF_STIL } from '@/components/farm/farm-page-view'
import { GallerySection, LogoUpload } from '@/app/(farmer)/settings/appearance/appearance-client'
import { PickupSlotsClient } from '@/components/settings/pickup-slots-client'
import { PauseClient } from '@/components/settings/pause-client'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { schildTon } from '@/lib/mein-hof'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { HofseiteVorschauRahmen } from '@/components/farmer/hofseite-vorschau-rahmen'
import { cn } from '@/lib/utils'

/*
 * Der Reiter „Hofseite" von Mein Hof ab lg: links die Hofseite als Liste mit
 * Fortschritt, rechts die echte Seite als Handy-Vorschau. Was die Liste sagt,
 * entscheidet src/lib/hofseite-fortschritt.ts; hier wird gezeichnet und
 * gespeichert — ausschließlich über die vorhandenen Server-Aktionen der
 * Einstellungen. Unter lg bleibt die Hofseite mit Stiften (farm-page-client.tsx).
 *
 * Einfache Felder (Name, Kurzbeschreibung, Über uns, Adresse, Kontakt) sind
 * Formulare direkt in der Zeile. Die Profil-Aktion verlangt das ganze Profil,
 * deshalb reicht jedes Formular die übrigen Felder unverändert mit
 * (profilBasis); dasselbe für den Auftritt (auftrittBasis). Komplexe Teile
 * kommen als die vorhandenen Bausteine: Titelbild und Ausschnitt aus der
 * Hofseite, Logo und Fotos aus „Mein Auftritt", Abholzeiten und Pause aus den
 * Einstellungen. Standort (Karte) und Zahlungen (Stripe) bleiben Links.
 */

/** Was der Editor über den Hof braucht — ohne Date, ohne Decimal (CODING_STANDARDS §2). */
export type HofseiteEditorHof = {
  slug: string
  /** Für Overlay und Browser-Rähmchen der Vorschau: Name und die Adresse, wie sie Kundinnen sehen. */
  name: string
  adresse: string
  logoUrl: string | null
  bannerType: 'GRADIENT' | 'PHOTO'
  bannerUrl: string | null
  bannerValue: string | null
  bannerFocusY: number
  isPaused: boolean
  pauseMessage: string | null
}

type Props = {
  fortschritt: HofseiteFortschritt
  hof: HofseiteEditorHof
  einstellungen: FarmSettings
  auftritt: AppearanceData
}

const SYMBOL: Record<HofseiteZeileId, LucideIcon> = {
  titelbild: ImageIcon,
  logo: Stamp,
  name: PenLine,
  'ueber-uns': AlignLeft,
  fotos: Images,
  adresse: MapPin,
  abholzeiten: Clock3,
  zahlung: CreditCard,
  kontakt: Phone,
  bestellungen: ShoppingBag,
  abschnitte: LayoutList,
}

/** Das ganze Profil, wie updateProfile es verlangt — die Zeile ändert nur ihre Felder. */
function profilBasis(e: FarmSettings): ProfileFormData {
  return {
    name: e.name,
    ownerName: e.ownerName,
    description: e.description,
    address: e.address,
    postalCode: e.postalCode,
    city: e.city,
    country: alsLand(e.country),
    phone: e.phone,
    email: e.email,
    latitude: e.latitude,
    longitude: e.longitude,
    betriebsnummer: e.betriebsnummer,
    betriebsstatus: e.betriebsstatus,
  }
}

/**
 * Der Auftritt, wie saveAppearanceAction ihn verlangt (Vorbild: handleSave in
 * appearance-client.tsx) — OHNE Logo und Titelbild: Die lädt der Editor über
 * eigene Aktionen hoch, und bis `router.refresh()` zurück ist, wären die
 * Props hier veraltet. Lässt man die Felder weg, rührt die Aktion sie nicht an.
 */
function auftrittBasis(a: AppearanceData): AppearanceSaveInput {
  return {
    tagline: a.tagline,
    foundedYear: a.foundedYear,
    aboutText: a.aboutText,
    sectionsConfig: a.sectionsConfig,
    farmValues: a.farmValues.map((v, i) => ({ icon: v.icon, title: v.title, subtitle: v.subtitle || null, sortOrder: i })),
  }
}

// ── Formular-Bausteine ────────────────────────────────────────────────────────

function Feld({
  id,
  label,
  fehler,
  children,
}: {
  id: string
  label: string
  fehler?: FieldError
  children: React.ReactNode
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1 block text-sm text-muted-foreground">
        {label}
      </Label>
      {children}
      {fehler?.message && <p className="mt-1 text-xs font-medium text-status-offen">{fehler.message}</p>}
    </div>
  )
}

function Aktionen({ pending, onAbbrechen }: { pending: boolean; onAbbrechen: () => void }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <Button type="button" variant="outline" size="lg" onClick={onAbbrechen} disabled={pending}>
        Abbrechen
      </Button>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Speichert…' : 'Speichern'}
      </Button>
    </div>
  )
}

type FormularProps = { einstellungen: FarmSettings; onGespeichert: () => void; onAbbrechen: () => void }

/** Speichert Profilfelder über updateProfile — der Rest des Profils geht unverändert mit. */
function useProfilSpeichern(einstellungen: FarmSettings, onGespeichert: () => void) {
  const [pending, start] = useTransition()
  const speichern = (teil: Partial<ProfileFormData>) =>
    start(async () => {
      const res = await updateProfile({ ...profilBasis(einstellungen), ...teil })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Gespeichert')
        onGespeichert()
      }
    })
  return { pending, speichern }
}

// Die Regeln je Feld kommen aus dem Profil-Schema selbst (src/schemas/hofprofil.ts) —
// keine zweite Abschrift, die auseinanderlaufen könnte. Für Felder mit
// Obergrenze das Bearbeiten-Schema mit dem gezeigten Stand: Ein Altwert, der
// vor der Grenze länger gespeichert wurde, sperrt das Speichern nicht.
function bestandVon(e: FarmSettings): ProfilBestand {
  return { name: e.name, ownerName: e.ownerName, phone: e.phone }
}

type NameDaten = Pick<ProfileFormData, 'name' | 'description'>

function NameForm({ einstellungen, onGespeichert, onAbbrechen }: FormularProps) {
  const { pending, speichern } = useProfilSpeichern(einstellungen, onGespeichert)
  const nameSchema = profilBearbeitenSchema(bestandVon(einstellungen)).pick({ name: true, description: true })
  const { register, handleSubmit, control, formState } = useForm<NameDaten>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: einstellungen.name, description: einstellungen.description },
  })
  return (
    <form onSubmit={handleSubmit(speichern)} className="space-y-3">
      <Feld id="hofseite-name" label="Hofname" fehler={formState.errors.name}>
        <Input id="hofseite-name" {...register('name')} />
        <FeldZaehler control={control} name="name" max={HOFNAME_MAX} leise="text-muted-foreground" />
      </Feld>
      <Feld id="hofseite-beschreibung" label="Kurzbeschreibung — ein Satz, der unter dem Namen steht" fehler={formState.errors.description}>
        <Textarea id="hofseite-beschreibung" rows={2} {...register('description')} />
      </Feld>
      <Aktionen pending={pending} onAbbrechen={onAbbrechen} />
    </form>
  )
}

const adresseSchema = profileSchema.pick({ address: true, postalCode: true, city: true })

function AdresseForm({ einstellungen, onGespeichert, onAbbrechen }: FormularProps) {
  const { pending, speichern } = useProfilSpeichern(einstellungen, onGespeichert)
  const { register, handleSubmit, formState } = useForm<z.infer<typeof adresseSchema>>({
    resolver: zodResolver(adresseSchema),
    defaultValues: { address: einstellungen.address, postalCode: einstellungen.postalCode, city: einstellungen.city },
  })
  const hatPunkt = einstellungen.latitude != null && einstellungen.longitude != null
  return (
    <form onSubmit={handleSubmit(speichern)} className="space-y-3">
      <Feld id="hofseite-strasse" label="Straße und Hausnummer" fehler={formState.errors.address}>
        <Input id="hofseite-strasse" {...register('address')} />
      </Feld>
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <Feld id="hofseite-plz" label="PLZ" fehler={formState.errors.postalCode}>
          <Input id="hofseite-plz" inputMode="numeric" {...register('postalCode')} />
        </Feld>
        <Feld id="hofseite-ort" label="Ort" fehler={formState.errors.city}>
          <Input id="hofseite-ort" {...register('city')} />
        </Feld>
      </div>
      {/* Der Kartenpunkt braucht die Karte — die gibt es im Hofprofil. */}
      <Link href="/settings/profile" className={cn('inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-semibold text-brand-text underline-offset-2 hover:underline', FOKUS_RAHMEN)}>
        {hatPunkt ? 'Standort auf der Karte ändern' : 'Standort auf der Karte setzen'}
        <ArrowRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
      </Link>
      <Aktionen pending={pending} onAbbrechen={onAbbrechen} />
    </form>
  )
}

type KontaktDaten = Pick<ProfileFormData, 'phone' | 'email'>

function KontaktForm({ einstellungen, onGespeichert, onAbbrechen }: FormularProps) {
  const { pending, speichern } = useProfilSpeichern(einstellungen, onGespeichert)
  const kontaktSchema = profilBearbeitenSchema(bestandVon(einstellungen)).pick({ phone: true, email: true })
  const { register, handleSubmit, control, formState } = useForm<KontaktDaten>({
    resolver: zodResolver(kontaktSchema),
    defaultValues: { phone: einstellungen.phone, email: einstellungen.email },
  })
  return (
    <form onSubmit={handleSubmit(speichern)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Feld id="hofseite-telefon" label="Telefon" fehler={formState.errors.phone}>
          <Input id="hofseite-telefon" type="tel" {...register('phone')} />
          <FeldZaehler control={control} name="phone" max={TELEFON_MAX} leise="text-muted-foreground" />
        </Feld>
        <Feld id="hofseite-email" label="E-Mail" fehler={formState.errors.email}>
          <Input id="hofseite-email" type="email" {...register('email')} />
          <FeldZaehler control={control} name="email" max={EMAIL_MAX} leise="text-muted-foreground" />
        </Feld>
      </div>
      <p className="text-xs text-muted-foreground">Beides steht für Kunden auf der Hofseite.</p>
      <Aktionen pending={pending} onAbbrechen={onAbbrechen} />
    </form>
  )
}

const ueberUnsSchema = appearanceSchema.pick({ aboutText: true })

function UeberUnsForm({
  auftritt,
  onGespeichert,
  onAbbrechen,
}: {
  auftritt: AppearanceData
  onGespeichert: () => void
  onAbbrechen: () => void
}) {
  const [pending, start] = useTransition()
  const { register, handleSubmit, formState } = useForm<z.infer<typeof ueberUnsSchema>>({
    resolver: zodResolver(ueberUnsSchema),
    defaultValues: { aboutText: auftritt.aboutText ?? '' },
  })
  const speichern = (daten: z.infer<typeof ueberUnsSchema>) =>
    start(async () => {
      const res = await saveAppearanceAction({ ...auftrittBasis(auftritt), aboutText: (daten.aboutText ?? '').trim() || null })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Gespeichert')
        onGespeichert()
      }
    })
  return (
    <form onSubmit={handleSubmit(speichern)} className="space-y-3">
      <Feld id="hofseite-ueber-uns" label="Was sollen Kunden über euren Hof wissen?" fehler={formState.errors.aboutText}>
        <Textarea
          id="hofseite-ueber-uns"
          rows={5}
          placeholder="Zum Beispiel: Seit drei Generationen bauen wir Gemüse an — alles aus eigener Hand."
          {...register('aboutText')}
        />
      </Feld>
      <Aktionen pending={pending} onAbbrechen={onAbbrechen} />
    </form>
  )
}

function AbschnitteForm({
  auftritt,
  onGespeichert,
  onAbbrechen,
}: {
  auftritt: AppearanceData
  onGespeichert: () => void
  onAbbrechen: () => void
}) {
  const [sektionen, setSektionen] = useState<SectionConfig[]>(auftritt.sectionsConfig)
  const [pending, start] = useTransition()
  const sortiert = sektionen.slice().sort((a, b) => a.order - b.order)

  function speichern(e: FormEvent) {
    e.preventDefault()
    start(async () => {
      const res = await saveAppearanceAction({ ...auftrittBasis(auftritt), sectionsConfig: sektionen })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Gespeichert')
        onGespeichert()
      }
    })
  }

  return (
    <form onSubmit={speichern}>
      <ul className="divide-y divide-border">
        {sortiert.map((s) => {
          const fest = s.key === 'products'
          return (
            <li key={s.key} className="flex min-h-11 items-center justify-between gap-3 py-1">
              <Label htmlFor={`abschnitt-${s.key}`} className="text-sm text-foreground">
                {ABSCHNITT_LABEL[s.key] ?? s.key}
                {fest && <span className="text-muted-foreground"> · immer sichtbar</span>}
              </Label>
              <Switch
                id={`abschnitt-${s.key}`}
                checked={s.visible}
                disabled={fest}
                onCheckedChange={(sichtbar) =>
                  setSektionen((prev) => prev.map((x) => (x.key === s.key ? { ...x, visible: sichtbar } : x)))
                }
              />
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Die Reihenfolge änderst du unter Einstellungen → Mein Auftritt.</p>
      <Aktionen pending={pending} onAbbrechen={onAbbrechen} />
    </form>
  )
}

/** Titelbild: Abbild mit den vorhandenen Knöpfen der Hofseite — Foto ersetzen, Ausschnitt ziehen. */
function TitelbildZeile({ hof, onGespeichert }: { hof: HofseiteEditorHof; onGespeichert: () => void }) {
  const [focusDraft, setFocusDraft] = useState<number | null>(null)
  const [pending, start] = useTransition()
  const foto = titelbildFoto(hof)
  const focus = focusDraft ?? hof.bannerFocusY

  function speichern() {
    const wert = focusDraft
    if (wert === null) return
    start(async () => {
      const res = await updateBannerFocusAction(wert)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Bildausschnitt gespeichert')
        onGespeichert()
      }
      setFocusDraft(null)
    })
  }

  return (
    <div>
      <div className="relative aspect-[5/2] overflow-hidden rounded-xl bg-muted">
        {foto ? (
          <Image src={foto} alt="" fill sizes="640px" className="object-cover" style={{ objectPosition: `50% ${focus}%` }} />
        ) : (
          <div className="absolute inset-0" style={{ background: titelbildVerlauf(hof.bannerValue) }} />
        )}
        {focusDraft !== null ? (
          <CoverFocusAdjust
            focusY={focus}
            onChange={setFocusDraft}
            onSave={speichern}
            onCancel={() => setFocusDraft(null)}
            saving={pending}
          />
        ) : (
          <div className="absolute right-3 top-3 flex items-center gap-2">
            {foto && (
              <button
                type="button"
                onClick={() => setFocusDraft(hof.bannerFocusY)}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-opacity hover:opacity-90"
                style={TITELBILD_KNOPF_STIL}
              >
                <MoveVertical className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
                Ausschnitt anpassen
              </button>
            )}
            <CoverEditButton currentBannerUrl={hof.bannerUrl} onGespeichert={onGespeichert} />
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Querformat wirkt am besten. Der Ausschnitt gilt für das hohe Titelbild auf der Hofseite.
      </p>
    </div>
  )
}

// ── Zeile und Gruppe ──────────────────────────────────────────────────────────

function Zeile({
  zeile,
  offen,
  onToggle,
  children,
}: {
  zeile: HofseiteZeile
  offen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const Zeichen = SYMBOL[zeile.id]
  const inhaltId = `hofseite-zeile-${zeile.id}`
  return (
    <li className={cn('border-t border-border first:border-t-0', offen && 'bg-muted/30')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={offen}
        aria-controls={inhaltId}
        className={cn('flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted', FOKUS_RAHMEN_INNEN)}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-foreground">
          <Zeichen className="size-4" strokeWidth={1.7} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{zeile.titel}</span>
          <span className="block truncate text-[13px] text-muted-foreground">{zeile.wert}</span>
        </span>
        {zeile.marke ? (
          <StatusBadge status={schildTon(zeile.marke.farbe)}>{zeile.marke.text}</StatusBadge>
        ) : (
          <>
            <Check className="size-4 shrink-0 text-brand-text" strokeWidth={2.2} aria-hidden="true" />
            <span className="sr-only">fertig</span>
          </>
        )}
        <ChevronRight
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', offen && 'rotate-90')}
          aria-hidden="true"
        />
      </button>
      {offen && (
        <div id={inhaltId} className="px-4 pb-5 pl-16">
          {children}
        </div>
      )}
    </li>
  )
}

export function HofseiteEditor({ fortschritt, hof, einstellungen, auftritt }: Props): React.JSX.Element {
  const router = useRouter()
  // Nur eine Zeile offen zugleich — und genau die markiert die Vorschau.
  const [offen, setOffen] = useState<HofseiteZeileId | null>(null)
  // Zählt bei jedem erfolgreichen Speichern hoch; die Vorschau lädt dann neu.
  const [stand, setStand] = useState(0)
  // Das Gerät der Vorschau. Web passt erst ab 1280 px neben die Bearbeitung
  // (dann rückt sie auf ~400 px zusammen); darunter zeigt der Rahmen Web im Overlay.
  const [geraet, setGeraet] = useState<VorschauGeraet>('handy')
  const breit = useMindestbreite(VORSCHAU_WEB_MINDESTBREITE)
  const webInline = geraet === 'web' && breit

  function nachSpeichern() {
    setStand((s) => s + 1)
    router.refresh()
  }
  // Formulare schließen sich nach dem Speichern: Der Refresh liefert neue
  // Startwerte, und ein offenes Formular hielte die alten fest.
  function nachFormular() {
    nachSpeichern()
    setOffen(null)
  }
  const schliessen = () => setOffen(null)

  function inhalt(id: HofseiteZeileId): React.ReactNode {
    switch (id) {
      case 'titelbild':
        return <TitelbildZeile hof={hof} onGespeichert={nachSpeichern} />
      case 'logo':
        return (
          <div>
            {/* Der Schlüssel wechselt mit dem Logo: Nach dem Refresh zeigt der Baustein den neuen Stand. */}
            <LogoUpload key={hof.logoUrl ?? 'kein-logo'} logoUrl={hof.logoUrl} onUploaded={nachSpeichern} />
            <p className="mt-2 text-xs text-muted-foreground">Quadratisch wirkt am besten · sonst zeigen wir den Anfangsbuchstaben.</p>
          </div>
        )
      case 'name':
        return <NameForm einstellungen={einstellungen} onGespeichert={nachFormular} onAbbrechen={schliessen} />
      case 'ueber-uns':
        return <UeberUnsForm auftritt={auftritt} onGespeichert={nachFormular} onAbbrechen={schliessen} />
      case 'fotos':
        return <GallerySection initialPhotos={auftritt.farmPhotos} onGespeichert={nachSpeichern} />
      case 'adresse':
        return <AdresseForm einstellungen={einstellungen} onGespeichert={nachFormular} onAbbrechen={schliessen} />
      case 'abholzeiten':
        return <PickupSlotsClient initialSlots={einstellungen.pickupSlots} onGespeichert={nachSpeichern} />
      case 'zahlung':
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Bar bei Abholung geht immer. Online-Zahlung läuft über ein Stripe-Konto — das richtest du in den
              Einstellungen ein.
            </p>
            <Link href="/settings/payments" className={cn('inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-semibold text-brand-text underline-offset-2 hover:underline', FOKUS_RAHMEN)}>
              Zahlungen einrichten
              <ArrowRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
            </Link>
          </div>
        )
      case 'kontakt':
        return <KontaktForm einstellungen={einstellungen} onGespeichert={nachFormular} onAbbrechen={schliessen} />
      case 'bestellungen':
        return <PauseClient initialPaused={hof.isPaused} initialMessage={hof.pauseMessage} onGespeichert={nachSpeichern} />
      case 'abschnitte':
        return <AbschnitteForm auftritt={auftritt} onGespeichert={nachFormular} onAbbrechen={schliessen} />
    }
  }

  return (
    // data-app-palette: Die eingebundenen Formulare der Einstellungen (Logo,
    // Fotos, Abholzeiten, Pause, Titelbild) zeichnen noch mit --app-*; hier
    // nehmen sie die Werte des Design-Systems an (globals.css).
    <div data-app-palette="neu" className="flex items-start gap-6 xl:gap-8">
      <div className="min-w-0 flex-1 space-y-6">
        {/* Fortschritt */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Deine Hofseite ist zu {fortschritt.erledigt} von {fortschritt.gesamt} fertig
            </h2>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{fortschritt.prozent} %</p>
          </div>
          {/* Der Wert steht daneben als Text; der Balken ist Veranschaulichung. */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${fortschritt.prozent}%` }} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{fortschritt.satz}</p>
        </div>

        {fortschritt.gruppen.map((gruppe) => (
          <section key={gruppe.id} aria-labelledby={`hofseite-gruppe-${gruppe.id}`}>
            <h3 id={`hofseite-gruppe-${gruppe.id}`} className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {gruppe.titel}
            </h3>
            <ul className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
              {gruppe.zeilen.map((zeile) => (
                <Zeile
                  key={zeile.id}
                  zeile={zeile}
                  offen={offen === zeile.id}
                  onToggle={() => setOffen((jetzt) => (jetzt === zeile.id ? null : zeile.id))}
                >
                  {inhalt(zeile.id)}
                </Zeile>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Die Vorschau-Spalte: 320 px (ab xl 360 px) fürs Handy; im Web-Modus
          wächst sie auf alles außer ~400 px für die Bearbeitung, mit einer
          kurzen Breiten-Transition — die Liste links rückt zusammen. */}
      <div
        className={cn('w-[320px] shrink-0 transition-[width] duration-200 motion-reduce:transition-none', !webInline && 'xl:w-[360px]')}
        style={webInline ? { width: `calc(100% - ${VORSCHAU_BEARBEITUNG_BREITE}px - 2rem)` } : undefined}
      >
        <HofseiteVorschauRahmen
          slug={hof.slug}
          stand={stand}
          markiert={offen}
          hofName={hof.name}
          adresse={hof.adresse}
          geraet={geraet}
          onGeraet={setGeraet}
          webInlineMoeglich={breit}
        />
      </div>
    </div>
  )
}
