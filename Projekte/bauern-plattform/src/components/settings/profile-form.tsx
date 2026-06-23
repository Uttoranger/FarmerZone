'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateProfile, type ProfileFormData } from '@/server/actions/farm'
import type { FarmSettings } from '@/server/queries/farm'

const schema = z.object({
  name: z.string().min(2, 'Mindestens 2 Zeichen'),
  ownerName: z.string().min(2, 'Mindestens 2 Zeichen'),
  description: z.string().min(10, 'Mindestens 10 Zeichen'),
  address: z.string().min(3, 'Pflichtfeld'),
  postalCode: z.string().min(4, 'Pflichtfeld'),
  city: z.string().min(2, 'Pflichtfeld'),
  phone: z.string().min(4, 'Pflichtfeld'),
  email: z.string().email('Ungültige E-Mail'),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
})

export function ProfileForm({ farm }: { farm: FarmSettings }) {
  const [isPending, startTransition] = useTransition()

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
      logoUrl: farm.logoUrl ?? '',
      bannerUrl: farm.bannerUrl ?? '',
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

  function field(id: keyof ProfileFormData, label: string, placeholder?: string) {
    return (
      <div>
        <Label htmlFor={id} className="text-sm text-slate-600 mb-1 block">{label}</Label>
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
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <h2 className="font-medium text-slate-700">Hof-Informationen</h2>
        {field('name', 'Hof-Name *', 'Hof Müller')}
        {field('ownerName', 'Name des Inhabers *', 'Klaus Müller')}
        <div>
          <Label htmlFor="description" className="text-sm text-slate-600 mb-1 block">Beschreibung *</Label>
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

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <h2 className="font-medium text-slate-700">Adresse</h2>
        {field('address', 'Straße und Hausnummer *', 'Dorfstraße 12')}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="postalCode" className="text-sm text-slate-600 mb-1 block">PLZ *</Label>
            <Input id="postalCode" {...register('postalCode')} placeholder="3400" className={errors.postalCode ? 'border-red-400' : ''} />
            {errors.postalCode && <p className="text-xs text-red-600 mt-1">{errors.postalCode.message}</p>}
          </div>
          <div>
            <Label htmlFor="city" className="text-sm text-slate-600 mb-1 block">Ort *</Label>
            <Input id="city" {...register('city')} placeholder="Klosterneuburg" className={errors.city ? 'border-red-400' : ''} />
            {errors.city && <p className="text-xs text-red-600 mt-1">{errors.city.message}</p>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <h2 className="font-medium text-slate-700">Kontakt</h2>
        {field('phone', 'Telefon *', '+43 664 123 4567')}
        {field('email', 'E-Mail *', 'hof@beispiel.at')}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <h2 className="font-medium text-slate-700">Bilder (optional)</h2>
        <p className="text-xs text-slate-500">Füge URLs von bereits hochgeladenen Bildern ein. Direkter Upload folgt nach Domain-Einrichtung.</p>
        {field('logoUrl', 'Logo-URL', 'https://...')}
        {field('bannerUrl', 'Banner-URL', 'https://...')}
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full h-12 bg-green-700 hover:bg-green-800 text-white font-semibold"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Profil speichern'}
      </Button>
    </form>
  )
}
