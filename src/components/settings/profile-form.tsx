'use client'

import { useRef, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
  RUECKFALL_PUNKT,
  uebernehmeAdresse,
  type StandortKandidat,
} from '@/lib/geokodierung'
import type { KartenZiel } from '@/components/settings/standort-karte'

// Nur clientseitig: Leaflet greift beim Import auf window zu.
const StandortKarte = dynamic(() => import('@/components/settings/standort-karte'), { ssr: false })

const schema = z.object({
  name: z.string().min(2, 'Mindestens 2 Zeichen'),
  ownerName: z.string().min(2, 'Mindestens 2 Zeichen'),
  description: z.string().min(10, 'Mindestens 10 Zeichen'),
  address: z.string().min(3, 'Pflichtfeld'),
  postalCode: z.string().min(4, 'Pflichtfeld'),
  city: z.string().min(2, 'Pflichtfeld'),
  phone: z.string().min(4, 'Pflichtfeld'),
  email: z.string().email('Ungültige E-Mail'),
  // Der Kartenpunkt ist ein Formularwert wie jedes andere Feld: Er wird beim
  // Schieben gesetzt und erst mit „Profil speichern" gespeichert.
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
})

export function ProfileForm({ farm }: { farm: FarmSettings }) {
  const [isPending, startTransition] = useTransition()
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
  const start =
    farm.latitude != null && farm.longitude != null
      ? { lat: farm.latitude, lon: farm.longitude, zoom: 17 }
      : { lat: RUECKFALL_PUNKT.lat, lon: RUECKFALL_PUNKT.lon, zoom: 8 }

  const { register, handleSubmit, getValues, setValue, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: farm.name,
      ownerName: farm.ownerName,
      description: farm.description,
      address: farm.address,
      postalCode: farm.postalCode,
      city: farm.city,
      phone: farm.phone,
      email: farm.email,
      latitude: farm.latitude,
      longitude: farm.longitude,
    },
  })

  function onSubmit(data: ProfileFormData) {
    startTransition(async () => {
      const res = await updateProfile(data)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Profil gespeichert')
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

  function field(id: 'name' | 'ownerName' | 'address' | 'phone' | 'email', label: string, placeholder?: string) {
    return (
      <div>
        <Label htmlFor={id} className="text-sm text-muted-foreground mb-1 block">{label}</Label>
        <Input
          id={id}
          {...register(id)}
          placeholder={placeholder}
          className={errors[id] ? 'border-red-400' : ''}
        />
        {errors[id] && <p className="text-xs text-red-600 mt-1">{errors[id]?.message}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white rounded-xl border border-border p-4 space-y-4">
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
            className={errors.description ? 'border-red-400' : ''}
          />
          {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-4 space-y-4">
        <h2 className="font-medium text-foreground">Adresse</h2>
        {field('address', 'Straße und Hausnummer *', 'Dorfstraße 12')}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="postalCode" className="text-sm text-muted-foreground mb-1 block">PLZ *</Label>
            <Input id="postalCode" {...register('postalCode')} placeholder="3400" className={errors.postalCode ? 'border-red-400' : ''} />
            {errors.postalCode && <p className="text-xs text-red-600 mt-1">{errors.postalCode.message}</p>}
          </div>
          <div>
            <Label htmlFor="city" className="text-sm text-muted-foreground mb-1 block">Ort *</Label>
            <Input id="city" {...register('city')} placeholder="Klosterneuburg" className={errors.city ? 'border-red-400' : ''} />
            {errors.city && <p className="text-xs text-red-600 mt-1">{errors.city.message}</p>}
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

      <div className="bg-white rounded-xl border border-border p-4 space-y-4">
        <h2 className="font-medium text-foreground">Kontakt</h2>
        {field('phone', 'Telefon *', '+43 664 123 4567')}
        {field('email', 'E-Mail *', 'hof@beispiel.at')}
      </div>

      <p className="text-sm text-muted-foreground">
        Logo und Titelbild verwaltest du unter{' '}
        <span className="text-foreground">Einstellungen → Mein Auftritt</span> —
        dort lädst du Bilder direkt vom Gerät hoch.
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
