'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  holeAdresseZumPunkt,
  sucheHofStandort,
  updateProfile,
  type ProfileFormData,
} from '@/server/actions/farm'
import type { FarmSettings } from '@/server/queries/farm'
import {
  HINWEIS_ADRESSE_UEBERNOMMEN,
  HINWEIS_KARTE_OHNE_PUNKT,
  RUECKFALL_PUNKTE,
  uebernehmeAdresse,
  type StandortKandidat,
} from '@/lib/geokodierung'
import {
  DE_VORBEREITUNG_HINWEIS,
  LAENDER,
  LAND_LABEL,
  alsLand,
  type Land,
} from '@/lib/laender'
import type { KartenZiel } from '@/components/settings/standort-karte'
import { BETRIEBSNUMMER_ANKER, BETRIEBSSTATUS, BETRIEBSSTATUS_VALUES, type BetriebsstatusValue } from '@/lib/taxonomie'
import { profilBearbeitenSchema } from '@/schemas/hofprofil'
import { EMAIL_MAX, HOFNAME_MAX, PERSONENNAME_MAX, TELEFON_MAX } from '@/lib/eingabegrenzen'
import { FeldZaehler } from '@/components/shared/zeichen-zaehler'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { useNachSpeichern } from '@/components/hof-einstellungen/use-nach-speichern'
import { EINSTELLUNG_MEIN_AUFTRITT, einstellungsWeg } from '@/lib/bauern-navigation'
import { cn } from '@/lib/utils'

// Nur clientseitig: Leaflet greift beim Import auf window zu.
const StandortKarte = dynamic(() => import('@/components/settings/standort-karte'), { ssr: false })

/** Obergrenzen je Feld — dieselben, die updateProfile prüft (src/lib/eingabegrenzen.ts). */
const GRENZE: Partial<Record<keyof ProfileFormData, number>> = {
  name: HOFNAME_MAX,
  ownerName: PERSONENNAME_MAX,
  phone: TELEFON_MAX,
  email: EMAIL_MAX,
}

export function ProfileForm({ farm }: { farm: FarmSettings }) {
  const [isPending, startTransition] = useTransition()
  // Nach dem Speichern zurück zur Übersicht (Register N1, Nr. 44).
  const nachSpeichern = useNachSpeichern()
  const [sucheLaeuft, setSucheLaeuft] = useState(false)
  // Die ruhige Zeile über der Karte: anfangs der Start-Hinweis (solange kein
  // Punkt gespeichert ist), danach das Vorwärts-Ergebnis oder die
  // Übernahme-Zeile der Rückwärtssuche.
  const [hinweis, setHinweis] = useState<string | null>(
    farm.latitude != null && farm.longitude != null ? null : HINWEIS_KARTE_OHNE_PUNKT
  )
  const [kandidaten, setKandidaten] = useState<StandortKandidat[]>([])
  const [ziel, setZiel] = useState<KartenZiel | null>(null)
  const zielFolge = useRef(0)
  // Späte Rückwärts-Antworten dürfen frischere nicht überschreiben.
  const anfrageFolge = useRef(0)

  // Startansicht der Karte: gespeicherter Punkt bei Zoom 17, sonst der
  // Rückfallpunkt bei Zoom 8. Die Karte liest `start` nur beim Einhängen —
  // dass hier je Render ein frisches Objekt entsteht, ist deshalb egal.
  // Ohne Punkt öffnet die Karte im Rückfallpunkt DES LANDES — ein deutscher
  // Hof soll nicht erst über Oberösterreich starten.
  const startLand = alsLand(farm.country)
  const start =
    farm.latitude != null && farm.longitude != null
      ? { lat: farm.latitude, lon: farm.longitude, zoom: 17 }
      : { lat: RUECKFALL_PUNKTE[startLand].lat, lon: RUECKFALL_PUNKTE[startLand].lon, zoom: 8 }

  // Dasselbe Schema wie updateProfile, mit dem Stand, den das Formular zeigt:
  // Ein Hofname, Inhabername oder eine Nummer, die vor den Obergrenzen länger
  // gespeichert wurde, sperrt das Speichern nicht — am Feld steht dann
  // „Bitte kürzen", geprüft wird beim Speichern (src/schemas/hofprofil.ts).
  const schema = useMemo(
    () => profilBearbeitenSchema({ name: farm.name, ownerName: farm.ownerName, phone: farm.phone }),
    [farm.name, farm.ownerName, farm.phone]
  )
  const { register, handleSubmit, getValues, setValue, control, formState: { errors } } = useForm<ProfileFormData>({
    // Cast wie im Produktformular: Die Vorverarbeitung (leer → null) macht den
    // Eingabetyp des Schemas zu unknown; der Ausgabetyp ist ProfileFormData.
    resolver: zodResolver(schema) as Resolver<ProfileFormData>,
    defaultValues: {
      name: farm.name,
      ownerName: farm.ownerName,
      description: farm.description,
      address: farm.address,
      postalCode: farm.postalCode,
      city: farm.city,
      phone: farm.phone,
      email: farm.email,
      country: startLand,
      latitude: farm.latitude,
      longitude: farm.longitude,
      betriebsnummer: farm.betriebsnummer,
      betriebsstatus: farm.betriebsstatus,
    },
  })
  // Der Hilfesatz folgt dem gewählten Status — welche Nummer gehört hierher?
  const [status, setStatus] = useState<BetriebsstatusValue | null>(farm.betriebsstatus)
  const statusFeld = register('betriebsstatus')

  // Die Länderwahl steuert den Hinweis UND die Geokodierung — deshalb als
  // eigener Zustand neben dem Formularwert (register allein meldet keine
  // Änderung an die Anzeige).
  const [land, setLand] = useState<Land>(startLand)
  // EINMAL registrieren und den Handler festhalten — er wird unten
  // aufgerufen, statt überschrieben zu werden (siehe Kommentar am Select).
  const landFeld = register('country')

  function onSubmit(data: ProfileFormData) {
    startTransition(async () => {
      const res = await updateProfile(data)
      if (res.error) {
        toast.error(res.error)
      } else {
        nachSpeichern('Profil gespeichert')
      }
    })
  }

  /** Jede vom Bauern gewählte Kartenmitte wird zum Formularwert — erkennbar
   *  ungespeichert wie jedes andere geänderte Feld, bis „Profil speichern". */
  function punktGewaehlt(lat: number, lon: number) {
    setValue('latitude', lat, { shouldDirty: true })
    setValue('longitude', lon, { shouldDirty: true })
  }

  async function aufKarteSuchen() {
    if (sucheLaeuft) return
    setSucheLaeuft(true)
    try {
      const werte = getValues()
      const res = await sucheHofStandort({
        address: werte.address,
        postalCode: werte.postalCode,
        city: werte.city,
        // Das gerade GEWÄHLTE Land, nicht das gespeicherte: Wer eben auf
        // Deutschland umgestellt hat, sucht sofort dort.
        country: land,
      })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      const ergebnis = res.ergebnis
      setHinweis(ergebnis.hinweis)
      setKandidaten(ergebnis.kandidaten)
      zielFolge.current += 1
      setZiel({
        lat: ergebnis.zentrum.lat,
        lon: ergebnis.zentrum.lon,
        zoom: ergebnis.zoom,
        folge: zielFolge.current,
      })
      // Nur ein echter Adress-Treffer wird zum (ungespeicherten) Punkt. Die
      // gröberen Stufen zeigen bloß die Gegend — dort setzt der Bauer den
      // Punkt selbst, sonst würde still ein Ortszentrum als Hof gespeichert.
      if (ergebnis.stufe === 'adresse') {
        punktGewaehlt(ergebnis.zentrum.lat, ergebnis.zentrum.lon)
      }
    } finally {
      setSucheLaeuft(false)
    }
  }

  /** Rückwärts: Die gebremste Ruheposition der Karte füllt die Adressfelder
   *  (Übernahme-Regel in uebernehmeAdresse). Scheitern bleibt stumm. */
  async function adresseVomPunkt(lat: number, lon: number) {
    anfrageFolge.current += 1
    const meineFolge = anfrageFolge.current
    const punkt = await holeAdresseZumPunkt(lat, lon)
    if (!punkt || anfrageFolge.current !== meineFolge) return

    const bisher = {
      address: getValues('address'),
      postalCode: getValues('postalCode'),
      city: getValues('city'),
    }
    const neu = uebernehmeAdresse(bisher, punkt)
    for (const feld of ['address', 'postalCode', 'city'] as const) {
      if (neu[feld] !== bisher[feld]) {
        setValue(feld, neu[feld], { shouldDirty: true, shouldValidate: true })
      }
    }
    setHinweis(HINWEIS_ADRESSE_UEBERNOMMEN)
  }

  function field(id: 'name' | 'ownerName' | 'address' | 'phone' | 'email' | 'betriebsnummer', label: string, placeholder?: string) {
    const max = GRENZE[id]
    return (
      <div>
        <Label htmlFor={id} className="text-sm text-muted-foreground mb-1 block">{label}</Label>
        <Input
          id={id}
          {...register(id)}
          placeholder={placeholder}
          className={errors[id] ? 'min-h-11 border-status-offen' : 'min-h-11'}
        />
        {max !== undefined && <FeldZaehler control={control} name={id} max={max} />}
        {errors[id] && <p className="mt-1 text-xs text-status-offen">{errors[id]?.message}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <h2 className="font-medium text-foreground">Hof-Informationen</h2>
        {field('name', 'Hof-Name *', 'Hof Müller')}
        {field('ownerName', 'Name des Inhabers *', 'Klaus Müller')}
        <div>
          <Label htmlFor="description" className="text-sm text-muted-foreground mb-1 block">Beschreibung *</Label>
          <Textarea
            id="description"
            {...register('description')}
            rows={4}
            placeholder="Beschreibe deinen Hof für Kunden..."
            className={errors.description ? 'border-status-offen' : ''}
          />
          {errors.description && <p className="mt-1 text-xs text-status-offen">{errors.description.message}</p>}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <h2 className="font-medium text-foreground">Adresse</h2>

        {/* Das Land ÜBER den Adressfeldern: Es entscheidet, wie PLZ und Ort
            gelesen werden (vier- oder fünfstellig, Nominatim-Anker) — es
            danach zu fragen, wäre die falsche Reihenfolge. */}
        <div>
          <Label htmlFor="country" className="text-sm text-muted-foreground mb-1 block">Land *</Label>
          {/* Der eigene onChange DARF den von react-hook-form nicht
              ersetzen: `register` gibt beide Handler unter demselben Namen
              zurück, das spätere JSX-Prop gewänne — der Formularwert käme
              dann nur noch über onBlur nach. Wer mit den Pfeiltasten wählt
              und sofort absendet, sähe den DE-Hinweis und speicherte AT.
              Deshalb erst den Handler von register, dann unseren. */}
          <select
            id="country"
            {...landFeld}
            aria-describedby={land === 'DE' ? 'land-hinweis' : undefined}
            onChange={(e) => {
              landFeld.onChange(e)
              setLand(alsLand(e.target.value))
            }}
            className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          >
            {LAENDER.map((wert) => (
              <option key={wert} value={wert}>
                {LAND_LABEL[wert]}
              </option>
            ))}
          </select>
        </div>

        {/* Ruhig, kein Warnbalken, kein Orange: Der Hof hat nichts falsch
            gemacht — wir sind noch nicht so weit. Der Wortlaut steht in
            src/lib/laender.ts und ist derselbe wie im Warte-Hinweis der
            Übersicht. */}
        {land === 'DE' && (
          <p
            id="land-hinweis"
            className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
          >
            {DE_VORBEREITUNG_HINWEIS}
          </p>
        )}

        {field('address', 'Straße und Hausnummer *', 'Dorfstraße 12')}
        <div className="grid grid-cols-2 gap-3">
          <div>
            {/* Neutral beschriftet und ohne länderfestes Beispiel: „3400" wäre
                für einen deutschen Hof eine falsche Vorgabe. */}
            <Label htmlFor="postalCode" className="text-sm text-muted-foreground mb-1 block">Postleitzahl *</Label>
            {/* Das Beispiel folgt dem Land — „3400" wäre für einen
                deutschen Hof eine falsche Vorgabe, gar keines wäre für
                beide eine verlorene Ausfüllhilfe. */}
            <Input
              id="postalCode"
              {...register('postalCode')}
              placeholder={land === 'DE' ? '84359' : '3400'}
              className={errors.postalCode ? 'min-h-11 border-status-offen' : 'min-h-11'}
            />
            {errors.postalCode && <p className="mt-1 text-xs text-status-offen">{errors.postalCode.message}</p>}
          </div>
          <div>
            <Label htmlFor="city" className="text-sm text-muted-foreground mb-1 block">Ort *</Label>
            <Input
              id="city"
              {...register('city')}
              placeholder={land === 'DE' ? 'Simbach am Inn' : 'Klosterneuburg'}
              className={errors.city ? 'min-h-11 border-status-offen' : 'min-h-11'}
            />
            {errors.city && <p className="mt-1 text-xs text-status-offen">{errors.city.message}</p>}
          </div>
        </div>
        {/* Der EINZIGE Auslöser der Vorwärts-Suche — bewusst eine Schaltfläche,
            nichts Automatisches beim Tippen oder Speichern. */}
        <button
          type="button"
          onClick={aufKarteSuchen}
          disabled={sucheLaeuft}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors disabled:opacity-60"
        >
          {sucheLaeuft && <Loader2 className="size-4 animate-spin" />}
          Auf der Karte suchen
        </button>

        {/* Die Karte dauerhaft unter den Adressfeldern — beide Richtungen:
            Die Suche fährt die Karte, das Schieben füllt die Adresse. */}
        <StandortKarte
          start={start}
          ziel={ziel}
          hinweis={hinweis}
          kandidaten={kandidaten}
          onMitteVerschoben={punktGewaehlt}
          onAdresseAnfrage={adresseVomPunkt}
        />
      </div>

      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <h2 className="font-medium text-foreground">Kontakt</h2>
        {field('phone', 'Telefon *', '+43 664 123 4567')}
        {field('email', 'E-Mail *', 'hof@beispiel.at')}
      </div>

      {/* Betriebsnummer (Sprint Bereiche 1): gehört dem Hof, nicht einem
          Produkt. Die Futter-Kennzeichnung zeigt sie an, der Checkout belegt
          sie vor, wenn du selbst Futter „nur an Betriebe" kaufst. */}
      {/* Ziel der Zeile „Futtermittel-Registrierung" der Übersicht (/settings, Nr. 22d). */}
      <div id={BETRIEBSNUMMER_ANKER} className="scroll-mt-6 bg-card rounded-xl border border-border p-4 space-y-4">
        <div>
          <h2 className="font-medium text-foreground">Betriebsnummer</h2>
          <p className="text-xs text-muted-foreground">
            Freiwillig. Brauchst du, wenn du Futter verkaufst oder bei einem anderen Hof als Betrieb einkaufst.
          </p>
        </div>
        <div>
          <Label htmlFor="betriebsstatus" className="text-sm text-muted-foreground mb-1 block">Was für ein Betrieb bist du?</Label>
          {/* Wie beim Land: erst der Handler von register, dann unserer. */}
          <select
            id="betriebsstatus"
            {...statusFeld}
            onChange={(e) => {
              statusFeld.onChange(e)
              setStatus(e.target.value === '' ? null : (e.target.value as BetriebsstatusValue))
            }}
            className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">Keine Angabe</option>
            {BETRIEBSSTATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {BETRIEBSSTATUS[s].name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            {status
              ? BETRIEBSSTATUS[status].hilfe
              : 'LFBIS-Nummer, BAES- bzw. BVL-Registrierung oder α-Nummer — je nachdem, was du mit Futter machst.'}
          </p>
        </div>
        {field('betriebsnummer', 'Betriebsnummer', 'z. B. AT 1234567')}
      </div>

      <p className="text-sm text-muted-foreground">
        Logo und Titelbild verwaltest du unter{' '}
        {/* Ein Link im Satz (Nr. 44), grün wie jeder Link im Fließtext. Das
            Polster macht ihn 44 px hoch, die Gegen-Ränder halten die Zeile ruhig. */}
        <Link
          href={EINSTELLUNG_MEIN_AUFTRITT.href}
          className={cn('-my-3 inline-block rounded-md py-3 font-medium text-brand-text underline underline-offset-2', FOKUS_RAHMEN)}
        >
          {einstellungsWeg(EINSTELLUNG_MEIN_AUFTRITT)}
        </Link>{' '}
        — dort lädst du Bilder direkt vom Gerät hoch.
      </p>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full h-12 bg-primary text-primary-foreground hover:opacity-90 font-semibold"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Profil speichern'}
      </Button>
    </form>
  )
}
