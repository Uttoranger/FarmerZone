'use client'

import { useState, useTransition } from 'react'
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
import { speichereHofStandort, updateProfile, type ProfileFormData } from '@/server/actions/farm'
import type { FarmSettings } from '@/server/queries/farm'
import type { GeokodierungsErgebnis } from '@/lib/geokodierung'

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
})

export function ProfileForm({ farm }: { farm: FarmSettings }) {
  const [isPending, startTransition] = useTransition()
  // Nach dem Speichern mit geänderter Adresse (oder ohne Koordinaten) liefert
  // die Action einen Standort-Vorschlag — dann öffnet die Minikarte.
  const [standort, setStandort] = useState<{
    ergebnis: GeokodierungsErgebnis
    adresse: string
  } | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileFormData>({
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
    },
  })

  function onSubmit(data: ProfileFormData) {
    startTransition(async () => {
      const res = await updateProfile(data)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Profil gespeichert')
        if (res.standort) {
          setStandort({
            ergebnis: res.standort,
            adresse: `${data.address}, ${data.postalCode} ${data.city}`,
          })
        }
      }
    })
  }

  async function standortBestaetigt(lat: number, lon: number) {
    const res = await speichereHofStandort(lat, lon)
    if (!res.error) {
      toast.success('Standort gespeichert')
      setStandort(null)
    }
    return res
  }

  function field(id: keyof ProfileFormData, label: string, placeholder?: string) {
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
      {standort && (
        <StandortKarte
          adresse={standort.adresse}
          ergebnis={standort.ergebnis}
          onBestaetigt={standortBestaetigt}
          onAbbrechen={() => setStandort(null)}
        />
      )}
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

