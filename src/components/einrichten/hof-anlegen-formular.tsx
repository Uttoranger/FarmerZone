'use client'

import { useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { createFarm } from '@/server/actions/onboarding'
import { leseHofnameEntwurf, loescheHofnameEntwurf, sitzungsSpeicher } from '@/lib/hofname-entwurf'
import { EMAIL_MAX, HOFNAME_MAX, PERSONENNAME_MAX, TELEFON_MAX } from '@/lib/eingabegrenzen'
import { hofAnlegenFormularSchema, type HofAnlegenFormular } from '@/schemas/hofprofil'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { HofAdresseVorschau } from '@/components/shared/hof-adresse-vorschau'
import { FELD, FELD_LABEL, FeldFehler } from '@/components/checkout/kasse-teile'

const KNOPF_ORANGE = cn(
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-primary-foreground/30 bg-primary px-5 text-[15px] font-semibold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60 sm:w-auto',
  FOKUS_RAHMEN
)

type Feld = keyof HofAnlegenFormular

/**
 * „Hof anlegen" im Schritt 2 von Einrichten (Nr. 15) — die Felder des
 * bisherigen ersten Onboarding-Schritts, ins neue Design gezogen. Gespeichert
 * wird wie bisher über createFarm (Besitz aus der Sitzung, Slug auf dem
 * Server, Betreiber-Mail); danach lädt die Seite neu und zeigt die übrigen
 * Schritte. Der Hofname ist mit dem Namen vom Registrieren vorbelegt.
 */
export function HofAnlegenFormular({ personName, email }: { personName: string; email: string }): React.JSX.Element {
  const router = useRouter()
  const id = useId()
  const [fehler, setFehler] = useState('')

  const form = useForm<HofAnlegenFormular>({
    resolver: zodResolver(hofAnlegenFormularSchema) as Resolver<HofAnlegenFormular>,
    mode: 'onTouched',
    defaultValues: { name: '', ownerName: personName, description: '', address: '', postalCode: '', city: '', phone: '', email },
  })
  const { errors, isSubmitting } = form.formState
  const [name, ownerName, phone, hofEmail] = useWatch({ control: form.control, name: ['name', 'ownerName', 'phone', 'email'] })

  // Vorbelegung erst im Browser: Der sessionStorage ist beim Rendern auf dem
  // Server nicht da. Nur, solange das Feld noch leer ist.
  useEffect(() => {
    const entwurf = leseHofnameEntwurf(sitzungsSpeicher())
    if (entwurf && !form.getValues('name')) form.setValue('name', entwurf)
  }, [form])

  async function absenden(werte: HofAnlegenFormular) {
    setFehler('')
    const ergebnis = await createFarm({
      name: werte.name,
      ownerName: werte.ownerName,
      description: werte.description,
      address: werte.address,
      postalCode: werte.postalCode,
      city: werte.city,
      phone: werte.phone,
      email: werte.email,
    })
    if ('error' in ergebnis) {
      setFehler(ergebnis.error)
      return
    }
    loescheHofnameEntwurf(sitzungsSpeicher())
    router.refresh()
  }

  const feldId = (feld: Feld) => `${id}-${feld}`
  const fehlerId = (feld: Feld) => `${id}-${feld}-fehler`
  const fehlerVon = (feld: Feld) => errors[feld]?.message

  function Textfeld({
    feld,
    label,
    typ = 'text',
    autoComplete,
    inputMode,
    zusatz,
    zaehler,
  }: {
    feld: Feld
    label: string
    typ?: 'text' | 'tel' | 'email'
    autoComplete?: string
    inputMode?: 'numeric' | 'tel' | 'email'
    zusatz?: { id: string; inhalt: React.ReactNode }
    zaehler?: { laenge: number; max: number }
  }) {
    const meldung = fehlerVon(feld)
    const beschreibung = [zusatz?.id, meldung && fehlerId(feld)].filter(Boolean).join(' ') || undefined
    return (
      <div className="min-w-0">
        <label htmlFor={feldId(feld)} className={FELD_LABEL}>
          {label}
        </label>
        <input
          id={feldId(feld)}
          type={typ}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={meldung ? true : undefined}
          aria-describedby={beschreibung}
          className={FELD}
          {...form.register(feld)}
        />
        {zaehler && <ZeichenZaehler laenge={zaehler.laenge} max={zaehler.max} />}
        {zusatz?.inhalt}
        {meldung && <FeldFehler id={fehlerId(feld)}>{meldung}</FeldFehler>}
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(absenden)} noValidate className="mt-4 flex flex-col gap-4">
      {Textfeld({
        feld: 'name',
        label: 'Name deines Hofs',
        autoComplete: 'organization',
        zaehler: { laenge: name.trim().length, max: HOFNAME_MAX },
        zusatz: { id: `${id}-adresse`, inhalt: <HofAdresseVorschau hofname={name} id={`${id}-adresse`} /> },
      })}
      {Textfeld({
        feld: 'ownerName',
        label: 'Vor- und Nachname',
        autoComplete: 'name',
        zaehler: { laenge: ownerName.trim().length, max: PERSONENNAME_MAX },
      })}
      <div>
        <label htmlFor={feldId('description')} className={FELD_LABEL}>
          Kurzbeschreibung <span className="font-normal">(freiwillig)</span>
        </label>
        <textarea
          id={feldId('description')}
          rows={3}
          className={cn(FELD, 'h-auto min-h-[92px] resize-y py-2.5')}
          {...form.register('description')}
        />
      </div>
      {Textfeld({ feld: 'address', label: 'Straße und Hausnummer', autoComplete: 'street-address' })}
      <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
        {Textfeld({ feld: 'postalCode', label: 'PLZ', autoComplete: 'postal-code', inputMode: 'numeric' })}
        {Textfeld({ feld: 'city', label: 'Ort', autoComplete: 'address-level2' })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
        {Textfeld({
          feld: 'phone',
          label: 'Telefon',
          typ: 'tel',
          autoComplete: 'tel',
          inputMode: 'tel',
          zaehler: { laenge: phone.trim().length, max: TELEFON_MAX },
        })}
        {Textfeld({
          feld: 'email',
          label: 'E-Mail des Hofs (freiwillig)',
          typ: 'email',
          autoComplete: 'email',
          inputMode: 'email',
          zaehler: { laenge: hofEmail.trim().length, max: EMAIL_MAX },
        })}
      </div>

      {fehler && (
        <div role="alert">
          <Hinweiskarte ton="orange">{fehler}</Hinweiskarte>
        </div>
      )}

      <div>
        <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined} className={KNOPF_ORANGE}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Einen Moment …' : 'Hof anlegen'}
        </button>
      </div>
    </form>
  )
}
