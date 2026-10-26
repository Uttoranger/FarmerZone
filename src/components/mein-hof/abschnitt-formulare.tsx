'use client'

import { createContext, useContext, useState, useTransition, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useForm, useWatch, type FieldError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { toast } from 'sonner'
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Flower2,
  Hand,
  House,
  Leaf,
  MapPin,
  PawPrint,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { profilBearbeitenSchema, profileSchema, type ProfilBestand, type ProfileFormData } from '@/schemas/hofprofil'
import {
  WERTE_MAX,
  appearanceSchema,
  gruendungsjahrAus,
  leitspruchFormularSchema,
  type LeitspruchFormular,
} from '@/schemas/auftritt'
import { EMAIL_MAX, HOFNAME_MAX, LEITSPRUCH_MAX, TELEFON_MAX, WERT_UNTERTITEL_MAX } from '@/lib/eingabegrenzen'
import { WERTE_KATALOG, istGewaehlt, katalogEintrag, type WertKatalogEintrag, type WertSchluessel } from '@/lib/hof-werte'
import { ABSCHNITT_LABEL } from '@/lib/hofseite-fortschritt'
import { GESPEICHERT_TEXT } from '@/lib/bauern-navigation'
import { KARTENPUNKT_PRUEFEN, bereiteAdresseVor, brauchtKartenpruefung } from '@/lib/abschnitt-stand'
import type { FarmSettings } from '@/server/queries/farm'
import type { AppearanceData, SectionConfig } from '@/server/queries/appearance'
import { speichereAuftritt, speichereProfil, speichernOhneWurf } from '@/components/mein-hof/abschnitt-speichern'
import { DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FeldZaehler, ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/*
 * Die Formulare der Abschnitte von Mein Hof (Nachtlauf Nr. 50, Register N4):
 * ab lg in der Zeile des Editors (components/farmer/hofseite-editor.tsx),
 * unter lg im Blatt von unten (components/mein-hof/abschnitte-liste.tsx) —
 * dieselben Bausteine, nur die Knöpfe stehen anders (AbschnittDarstellung).
 * Name, Adresse, Kontakt, Über uns und Abschnitte kommen aus dem Editor;
 * Leitspruch/Gründungsjahr und Werte sind aus dem früheren „Mein Auftritt"
 * herausgelöst.
 *
 * Gespeichert wird nur über speichereAuftritt bzw. speichereProfil
 * (abschnitt-speichern.ts): beim Auftritt nur der eigene Teil, beim Profil
 * der frische Stand vom Server mit dem eigenen Feld, über die bestehenden
 * Aktionen — keine zweite Speicherlogik. Die
 * Regeln je Feld kommen aus den Schemas der Aktionen (src/schemas/hofprofil.ts,
 * src/schemas/auftritt.ts), keine Abschrift.
 */

/** Wie die Knöpfe stehen: ab lg in der Zeile rechts nebeneinander, im Blatt „Speichern" über die volle Breite, „Abbrechen" darunter. */
export type AbschnittDarstellung = 'zeile' | 'blatt'

const Darstellung = createContext<AbschnittDarstellung>('zeile')

export function AbschnittDarstellungKontext({
  wert,
  children,
}: {
  wert: AbschnittDarstellung
  children: ReactNode
}): React.JSX.Element {
  return <Darstellung.Provider value={wert}>{children}</Darstellung.Provider>
}

export type AbschnittFormularProps = {
  /** Nach erfolgreichem Speichern — schließt Zeile bzw. Blatt und lädt neu. */
  onGespeichert: () => void
  onAbbrechen: () => void
  /** Ersetzt den Toast „Gespeichert" (unter lg: „Gespeichert · Ansehen"). */
  meldeErfolg?: () => void
}

/**
 * Speichern mit Rückmeldung: Fehler stehen im Formular (DESIGN_SYSTEM,
 * Zustände: inline, kein Modal) — auch eine gescheiterte Anfrage, die sonst
 * an die Fehlergrenze ginge (speichernOhneWurf); die Eingabe bleibt stehen.
 * Erfolg meldet der Toast bzw. `meldeErfolg`.
 */
function useSpeichern({ onGespeichert, meldeErfolg }: Pick<AbschnittFormularProps, 'onGespeichert' | 'meldeErfolg'>) {
  const [pending, start] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  const ausfuehren = (speichern: () => Promise<{ error?: string }>) => {
    setFehler(null)
    start(async () => {
      const satz = await speichernOhneWurf(speichern)
      if (satz) {
        setFehler(satz)
        return
      }
      if (meldeErfolg) meldeErfolg()
      else toast.success(GESPEICHERT_TEXT)
      onGespeichert()
    })
  }
  return { pending, fehler, setFehler, ausfuehren }
}

// ── Bausteine der Formulare ──────────────────────────────────────────────────

function Feld({
  id,
  label,
  fehler,
  children,
}: {
  id: string
  label: string
  fehler?: FieldError
  children: ReactNode
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-sm leading-snug text-muted-foreground">
        {label}
      </Label>
      {children}
      {fehler?.message && <p className="mt-1 text-xs font-medium text-status-offen">{fehler.message}</p>}
    </div>
  )
}

function Aktionen({ pending, fehler, onAbbrechen }: { pending: boolean; fehler: string | null; onAbbrechen: () => void }) {
  const darstellung = useContext(Darstellung)
  const speichernText = pending ? 'Speichert…' : 'Speichern'

  if (darstellung === 'blatt') {
    return (
      <div className="mt-5 flex flex-col gap-2">
        <DialogFehler text={fehler} />
        <Button type="submit" disabled={pending} aria-busy={pending || undefined} className="h-12 w-full rounded-[14px] text-[15px] font-semibold">
          {speichernText}
        </Button>
        <button
          type="button"
          onClick={onAbbrechen}
          disabled={pending}
          className={cn('mx-auto min-h-11 rounded-full px-5 text-sm font-semibold text-brand-text hover:bg-muted', FOKUS_RAHMEN)}
        >
          Abbrechen
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <DialogFehler text={fehler} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onAbbrechen} disabled={pending} className="h-11 px-4">
          Abbrechen
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending || undefined} className="h-11 px-4">
          {speichernText}
        </Button>
      </div>
    </div>
  )
}

/** Ein grüner Link im Formular (Standort, Zahlungen) — 44 px Trefferfläche, sichtbarer Fokus. */
const TEXTLINK = cn(
  'inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-semibold text-brand-text underline-offset-2 hover:underline',
  FOKUS_RAHMEN
)

// ── Profil: Name, Adresse, Kontakt ───────────────────────────────────────────

type ProfilFormularProps = AbschnittFormularProps & { einstellungen: FarmSettings }

// Für Felder mit Obergrenze das Bearbeiten-Schema mit dem gezeigten Stand: Ein
// Altwert, der vor der Grenze länger gespeichert wurde, sperrt das Speichern
// nicht. Der Server prüft noch einmal — mit dem Stand aus der Datenbank.
function bestandVon(e: FarmSettings): ProfilBestand {
  return { name: e.name, ownerName: e.ownerName, phone: e.phone, email: e.email }
}

type NameDaten = Pick<ProfileFormData, 'name' | 'description'>

export function NameForm({ einstellungen, ...rueckmeldung }: ProfilFormularProps): React.JSX.Element {
  const { pending, fehler, ausfuehren } = useSpeichern(rueckmeldung)
  const nameSchema = profilBearbeitenSchema(bestandVon(einstellungen)).pick({ name: true, description: true })
  const { register, handleSubmit, control, formState } = useForm<NameDaten>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: einstellungen.name, description: einstellungen.description },
  })
  return (
    <form onSubmit={handleSubmit((daten) => ausfuehren(() => speichereProfil(daten)))} className="space-y-3">
      <Feld id="hofseite-name" label="Hofname" fehler={formState.errors.name}>
        <Input id="hofseite-name" className="h-11" {...register('name')} />
        <FeldZaehler control={control} name="name" max={HOFNAME_MAX} leise="text-muted-foreground" />
      </Feld>
      <Feld id="hofseite-beschreibung" label="Kurzbeschreibung — ein Satz über deinen Hof" fehler={formState.errors.description}>
        <Textarea id="hofseite-beschreibung" rows={2} {...register('description')} />
      </Feld>
      <Aktionen pending={pending} fehler={fehler} onAbbrechen={rueckmeldung.onAbbrechen} />
    </form>
  )
}

const adresseSchema = profileSchema.pick({ address: true, postalCode: true, city: true })

export function AdresseForm({ einstellungen, ...rueckmeldung }: ProfilFormularProps): React.JSX.Element {
  const { pending, fehler, ausfuehren } = useSpeichern(rueckmeldung)
  const { register, handleSubmit, control, formState } = useForm<z.infer<typeof adresseSchema>>({
    resolver: zodResolver(adresseSchema),
    defaultValues: { address: einstellungen.address, postalCode: einstellungen.postalCode, city: einstellungen.city },
  })
  const strasse = useWatch({ control, name: 'address' })
  const hatPunkt = einstellungen.latitude != null && einstellungen.longitude != null
  // Der Kartenpunkt zieht bei neuer Straße nicht mit — dann der Hinweis (Register N4, Ergänzung Lauf 10).
  const kartePruefen = brauchtKartenpruefung(einstellungen, strasse)
  return (
    // Die Adresse als Ganzes: Land und Kartenpunkt vom Laden gehen mit, sonst mischte der frische Stand die eines anderen Tabs hinein.
    <form onSubmit={handleSubmit((daten) => ausfuehren(() => speichereProfil(bereiteAdresseVor(einstellungen, daten))))} className="space-y-3">
      <Feld id="hofseite-strasse" label="Straße und Hausnummer" fehler={formState.errors.address}>
        <Input id="hofseite-strasse" className="h-11" autoComplete="street-address" {...register('address')} />
      </Feld>
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <Feld id="hofseite-plz" label="PLZ" fehler={formState.errors.postalCode}>
          <Input id="hofseite-plz" className="h-11" inputMode="numeric" autoComplete="postal-code" {...register('postalCode')} />
        </Feld>
        <Feld id="hofseite-ort" label="Ort" fehler={formState.errors.city}>
          <Input id="hofseite-ort" className="h-11" autoComplete="address-level2" {...register('city')} />
        </Feld>
      </div>
      {/* Der Kartenpunkt braucht die Karte — die gibt es im Hofprofil. Die Region sagt den Wechsel zum Hinweis an. */}
      <div aria-live="polite">
        <Link href={KARTENPUNKT_PRUEFEN.href} className={TEXTLINK}>
          {kartePruefen && <MapPin className="size-4 text-status-offen" strokeWidth={1.7} aria-hidden="true" />}
          {kartePruefen ? KARTENPUNKT_PRUEFEN.text : hatPunkt ? 'Standort auf der Karte ändern' : 'Standort auf der Karte setzen'}
          <ArrowRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
        </Link>
      </div>
      <Aktionen pending={pending} fehler={fehler} onAbbrechen={rueckmeldung.onAbbrechen} />
    </form>
  )
}

type KontaktDaten = Pick<ProfileFormData, 'phone' | 'email'>

export function KontaktForm({ einstellungen, ...rueckmeldung }: ProfilFormularProps): React.JSX.Element {
  const { pending, fehler, ausfuehren } = useSpeichern(rueckmeldung)
  const kontaktSchema = profilBearbeitenSchema(bestandVon(einstellungen)).pick({ phone: true, email: true })
  const { register, handleSubmit, control, formState } = useForm<KontaktDaten>({
    resolver: zodResolver(kontaktSchema),
    defaultValues: { phone: einstellungen.phone, email: einstellungen.email },
  })
  return (
    <form onSubmit={handleSubmit((daten) => ausfuehren(() => speichereProfil(daten)))} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Feld id="hofseite-telefon" label="Telefon" fehler={formState.errors.phone}>
          <Input id="hofseite-telefon" className="h-11" type="tel" autoComplete="tel" {...register('phone')} />
          <FeldZaehler control={control} name="phone" max={TELEFON_MAX} leise="text-muted-foreground" />
        </Feld>
        <Feld id="hofseite-email" label="E-Mail" fehler={formState.errors.email}>
          <Input id="hofseite-email" className="h-11" type="email" autoComplete="email" {...register('email')} />
          <FeldZaehler control={control} name="email" max={EMAIL_MAX} leise="text-muted-foreground" />
        </Feld>
      </div>
      <p className="text-xs text-muted-foreground">Beides steht für Kunden auf der Hofseite.</p>
      <Aktionen pending={pending} fehler={fehler} onAbbrechen={rueckmeldung.onAbbrechen} />
    </form>
  )
}

// ── Auftritt: Leitspruch und Gründungsjahr, Über uns, Werte, Abschnitte ──────

type AuftrittFormularProps = AbschnittFormularProps & { auftritt: AppearanceData }

/** Leitspruch und Gründungsjahr — aus dem früheren „Mein Auftritt" (Nr. 50). */
export function LeitspruchForm({ auftritt, ...rueckmeldung }: AuftrittFormularProps): React.JSX.Element {
  const { pending, fehler, ausfuehren } = useSpeichern(rueckmeldung)
  const { register, handleSubmit, control, formState } = useForm<LeitspruchFormular>({
    resolver: zodResolver(leitspruchFormularSchema),
    defaultValues: {
      tagline: auftritt.tagline ?? '',
      gruendungsjahr: auftritt.foundedYear === null ? '' : String(auftritt.foundedYear),
    },
  })
  const speichern = (daten: LeitspruchFormular) =>
    ausfuehren(() =>
      speichereAuftritt({
        tagline: daten.tagline.trim() || null,
        // Das Schema hat das Jahr schon geprüft; leer heißt „kein Jahr".
        foundedYear: gruendungsjahrAus(daten.gruendungsjahr) ?? null,
      })
    )
  return (
    <form onSubmit={handleSubmit(speichern)} className="space-y-3">
      <Feld id="hofseite-leitspruch" label="Leitspruch — ein kurzer Satz unter deinem Hofnamen" fehler={formState.errors.tagline}>
        <Input id="hofseite-leitspruch" className="h-11" placeholder="Zum Beispiel: Frische Produkte direkt vom Feld" {...register('tagline')} />
        <FeldZaehler control={control} name="tagline" max={LEITSPRUCH_MAX} leise="text-muted-foreground" />
      </Feld>
      <Feld id="hofseite-gruendungsjahr" label="Gründungsjahr (freiwillig) — steht als „Seit …“ bei „Über uns“" fehler={formState.errors.gruendungsjahr}>
        <Input
          id="hofseite-gruendungsjahr"
          className="h-11 w-32"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1987"
          {...register('gruendungsjahr')}
        />
      </Feld>
      <Aktionen pending={pending} fehler={fehler} onAbbrechen={rueckmeldung.onAbbrechen} />
    </form>
  )
}

const ueberUnsSchema = appearanceSchema.pick({ aboutText: true })

export function UeberUnsForm({ auftritt, ...rueckmeldung }: AuftrittFormularProps): React.JSX.Element {
  const { pending, fehler, ausfuehren } = useSpeichern(rueckmeldung)
  const { register, handleSubmit, formState } = useForm<z.infer<typeof ueberUnsSchema>>({
    resolver: zodResolver(ueberUnsSchema),
    defaultValues: { aboutText: auftritt.aboutText ?? '' },
  })
  return (
    <form
      onSubmit={handleSubmit((daten) => ausfuehren(() => speichereAuftritt({ aboutText: (daten.aboutText ?? '').trim() || null })))}
      className="space-y-3"
    >
      <Feld id="hofseite-ueber-uns" label="Was sollen Kunden über euren Hof wissen?" fehler={formState.errors.aboutText}>
        <Textarea
          id="hofseite-ueber-uns"
          rows={5}
          placeholder="Zum Beispiel: Seit drei Generationen bauen wir Gemüse an — alles aus eigener Hand."
          {...register('aboutText')}
        />
      </Feld>
      <Aktionen pending={pending} fehler={fehler} onAbbrechen={rueckmeldung.onAbbrechen} />
    </form>
  )
}

/**
 * Das Symbol je Wert des Katalogs — EINE Zuordnung (DESIGN_SYSTEM, Symbole);
 * der Katalog selbst steht in src/lib/hof-werte.ts. Erkannt wird ein Wert am
 * Titel (katalogEintrag), nie an der Spalte `icon`.
 */
const WERT_SYMBOL: Record<WertSchluessel, LucideIcon> = {
  tierwohl: PawPrint,
  bio: Leaf,
  saisonal: Flower2,
  regional: MapPin,
  handarbeit: Hand,
  familie: House,
}

/** Das Symbol eines gespeicherten Werts; außerhalb des Katalogs ein Haken wie auf der Hofseite. */
function WertSymbol({ wert, className }: { wert: { title: string }; className?: string }) {
  const eintrag = katalogEintrag(wert)
  const Symbol = eintrag ? WERT_SYMBOL[eintrag.schluessel] : Check
  return <Symbol className={className} strokeWidth={1.7} aria-hidden="true" />
}

/** Knöpfe nur mit Symbol: 44 px Trefferfläche, das Symbol bleibt klein (DESIGN_SYSTEM, Nr. 35). */
const SYMBOL_KNOPF = 'flex size-11 shrink-0 items-center justify-center rounded-md'

type WertEingabe = { icon: string; title: string; subtitle: string }

/** Die Werte der Hofseite — aus dem früheren „Mein Auftritt" (Nr. 50): bis zu vier, mit Reihenfolge und einem Satz je Wert. */
export function WerteForm({ auftritt, ...rueckmeldung }: AuftrittFormularProps): React.JSX.Element {
  const { pending, fehler, setFehler, ausfuehren } = useSpeichern(rueckmeldung)
  const [werte, setWerte] = useState<WertEingabe[]>(() =>
    auftritt.farmValues.map((w) => ({ icon: w.icon, title: w.title, subtitle: w.subtitle ?? '' }))
  )
  const voll = werte.length >= WERTE_MAX

  // Am Titel erkannt, nicht am icon-Feld: Ältere Werte tragen dort noch ein
  // Emoji, neue den Schlüssel (src/lib/hof-werte.ts).
  function umschalten(eintrag: WertKatalogEintrag) {
    setWerte((jetzt) => {
      if (istGewaehlt(jetzt, eintrag)) return jetzt.filter((w) => w.title !== eintrag.titel)
      if (jetzt.length >= WERTE_MAX) return jetzt
      return [...jetzt, { icon: eintrag.schluessel, title: eintrag.titel, subtitle: '' }]
    })
  }

  function verschiebe(platz: number, richtung: -1 | 1) {
    setWerte((jetzt) => {
      const ziel = platz + richtung
      if (ziel < 0 || ziel >= jetzt.length) return jetzt
      const neu = [...jetzt]
      ;[neu[platz], neu[ziel]] = [neu[ziel], neu[platz]]
      return neu
    })
  }

  function speichern(e: FormEvent) {
    e.preventDefault()
    const farmValues = werte.map((w, platz) => ({ icon: w.icon, title: w.title, subtitle: w.subtitle.trim() || null, sortOrder: platz }))
    // Dieselbe Regel wie die Aktion (Anzahl, Länge des Satzes) — der Server prüft trotzdem noch einmal.
    const geprueft = appearanceSchema.pick({ farmValues: true }).safeParse({ farmValues })
    if (!geprueft.success) {
      setFehler(geprueft.error.issues[0]?.message ?? 'Bitte prüf deine Werte.')
      return
    }
    ausfuehren(() => speichereAuftritt({ farmValues }))
  }

  return (
    <form onSubmit={speichern}>
      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">
          {voll
            ? `${WERTE_MAX} von ${WERTE_MAX} gewählt — nimm erst einen heraus, um einen anderen zu wählen.`
            : `Wähle bis zu ${WERTE_MAX} — sie stehen bei „Über uns“ auf deiner Hofseite.`}
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {WERTE_KATALOG.map((eintrag) => {
            const gewaehlt = istGewaehlt(werte, eintrag)
            const Symbol = WERT_SYMBOL[eintrag.schluessel]
            return (
              <button
                key={eintrag.schluessel}
                type="button"
                aria-pressed={gewaehlt}
                disabled={!gewaehlt && voll}
                onClick={() => umschalten(eintrag)}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left transition-colors disabled:opacity-50',
                  gewaehlt ? 'border-accent bg-accent/15 text-foreground' : 'border-border text-muted-foreground hover:bg-muted',
                  FOKUS_RAHMEN
                )}
              >
                <Symbol className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                <span className="flex-1 text-[13px] leading-tight font-medium">{eintrag.titel}</span>
                {gewaehlt && <Check className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </fieldset>

      {werte.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Gewählt ({werte.length}/{WERTE_MAX})
          </p>
          {werte.map((w, platz) => (
            <div key={`${w.icon}-${w.title}`} className="flex items-start gap-2 rounded-xl border border-border bg-card p-3">
              <WertSymbol wert={w} className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <label htmlFor={`wert-satz-${platz}`} className="block text-sm font-semibold break-words text-foreground">
                  {w.title}
                </label>
                <Input
                  id={`wert-satz-${platz}`}
                  className="mt-1.5 h-11"
                  value={w.subtitle}
                  onChange={(e) => {
                    const text = e.target.value
                    setWerte((jetzt) => jetzt.map((x, i) => (i === platz ? { ...x, subtitle: text } : x)))
                  }}
                  placeholder="Ein Satz dazu (freiwillig)"
                />
                <ZeichenZaehler laenge={w.subtitle.length} max={WERT_UNTERTITEL_MAX} />
              </div>
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => verschiebe(platz, -1)}
                  disabled={platz === 0}
                  aria-label={`${w.title} nach oben`}
                  className={cn(SYMBOL_KNOPF, FOKUS_RAHMEN, 'hover:bg-muted disabled:opacity-30')}
                >
                  <ChevronUp className="size-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => verschiebe(platz, 1)}
                  disabled={platz === werte.length - 1}
                  aria-label={`${w.title} nach unten`}
                  className={cn(SYMBOL_KNOPF, FOKUS_RAHMEN, 'hover:bg-muted disabled:opacity-30')}
                >
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setWerte((jetzt) => jetzt.filter((_, i) => i !== platz))}
                aria-label={`${w.title} entfernen`}
                className={cn(SYMBOL_KNOPF, FOKUS_RAHMEN, 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive')}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Aktionen pending={pending} fehler={fehler} onAbbrechen={rueckmeldung.onAbbrechen} />
    </form>
  )
}

/**
 * Welche Abschnitte die Hofseite zeigt. Die Reihenfolge ist seit Nr. 10 fest
 * (hofseite-kunde.tsx liest nur `visible`); die Pfeile dafür gab es nur im
 * früheren „Mein Auftritt" und sind mit ihm entfallen (Nr. 50).
 */
export function AbschnitteForm({ auftritt, ...rueckmeldung }: AuftrittFormularProps): React.JSX.Element {
  const { pending, fehler, ausfuehren } = useSpeichern(rueckmeldung)
  const [sektionen, setSektionen] = useState<SectionConfig[]>(auftritt.sectionsConfig)
  const sortiert = sektionen.slice().sort((a, b) => a.order - b.order)

  function speichern(e: FormEvent) {
    e.preventDefault()
    ausfuehren(() => speichereAuftritt({ sectionsConfig: sektionen }))
  }

  return (
    <form onSubmit={speichern}>
      <ul className="divide-y divide-border">
        {sortiert.map((s) => {
          const fest = s.key === 'products'
          return (
            <li key={s.key}>
              {/* Der Schalter steht im Label: Die ganze Zeile schaltet, 44 px hoch, ohne tote Fläche
                  daneben. Base UI verhindert dabei das doppelte Umschalten (Klick auf den Schalter). */}
              <Label htmlFor={`abschnitt-${s.key}`} className="min-h-11 w-full justify-between gap-3 py-2 text-sm text-foreground">
                <span>
                  {ABSCHNITT_LABEL[s.key] ?? s.key}
                  {fest && <span className="text-muted-foreground"> · immer sichtbar</span>}
                </span>
                <Switch
                  id={`abschnitt-${s.key}`}
                  checked={s.visible}
                  disabled={fest}
                  onCheckedChange={(sichtbar) => setSektionen((prev) => prev.map((x) => (x.key === s.key ? { ...x, visible: sichtbar } : x)))}
                />
              </Label>
            </li>
          )
        })}
      </ul>
      <Aktionen pending={pending} fehler={fehler} onAbbrechen={rueckmeldung.onAbbrechen} />
    </form>
  )
}
