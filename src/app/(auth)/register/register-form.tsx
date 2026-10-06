'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react'
import { registerFarmer } from '@/server/actions/register'
import { passwortStaerke } from '@/lib/password-rules'
import { signIn } from '@/lib/auth-client'
import { schreibeHofnameEntwurf, sitzungsSpeicher } from '@/lib/hofname-entwurf'
import { REGISTRIEREN_TARIF } from '@/lib/konditionen'
import { REGISTRIEREN_SCHRITTE } from '@/lib/fuer-hoefe'
import { KONTAKT_EMAIL } from '@/lib/support'
import { EMAIL_MAX, HOFNAME_MAX, PERSONENNAME_MAX } from '@/lib/eingabegrenzen'
import { registrierenFormularSchema, type RegistrierenFormular } from '@/schemas/register'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { HofAdresseVorschau } from '@/components/shared/hof-adresse-vorschau'
import { FELD, FELD_LABEL, FeldFehler } from '@/components/checkout/kasse-teile'
import { StartSchritte } from '@/components/fuer-hoefe/start-schritte'

/**
 * Der Honigtopf steht außerhalb des sichtbaren Bereichs statt auf
 * display:none — ein Bot, der nur auf `display` und `visibility` schaut,
 * hält das Feld für echt und füllt es aus. 1×1 Pixel weit links oben,
 * zusätzlich durchsichtig: kein Platzbedarf im Fluss, kein Layout-Sprung
 * und auch bei 375px keine Seitwärts-Scrollleiste (absolut positionierte
 * Elemente links/oberhalb des Ursprungs erzeugen keinen Scrollbereich).
 */
const HONIGTOPF_STIL: React.CSSProperties = {
  position: 'absolute',
  left: '-9999px',
  top: '-9999px',
  width: '1px',
  height: '1px',
  opacity: 0,
  overflow: 'hidden',
}

/** Der Hauptknopf der Hofwelt — Orange (DESIGN_SYSTEM, „Farbrollen"), volle Breite. */
const KNOPF_ORANGE = cn(
  'inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-full border border-primary-foreground/30 bg-primary px-[18px] text-[15px] font-semibold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60',
  FOKUS_RAHMEN
)

const TEXTLINK = cn('rounded-sm font-semibold text-status-fertig underline-offset-2 hover:underline', FOKUS_RAHMEN)

/**
 * Hof registrieren im neuen Design (Gate 5, Nr. 15; Mockups
 * web-h0-hof-registrieren und mobil-h0-registrieren).
 *
 * Unverändert: registerFarmer (Better Auth E-Mail/Passwort, Rolle FARMER,
 * Honigtopf, Zeitschranke, Rate-Limit von Better Auth), danach die Anmeldung
 * im Browser und der Weg nach /onboarding. Neu im Formular: Hofname mit der
 * künftigen Adresse, Passwortstärke, der Haken bei den Konditionen. Den Hof
 * selbst legt weiter Einrichten an; der Name wartet bis dahin im
 * sessionStorage (hofname-entwurf.ts).
 */
export function RegisterForm({ formToken }: { formToken: string }): React.JSX.Element {
  const router = useRouter()
  const id = useId()
  // Honigtopf: bleibt bei Menschen leer — außerhalb von react-hook-form, damit
  // er keine Regel und keinen Fehler bekommt.
  const [website, setWebsite] = useState('')
  const [fehler, setFehler] = useState('')
  const [zeigePasswort, setZeigePasswort] = useState(false)

  const form = useForm<RegistrierenFormular>({
    resolver: zodResolver(registrierenFormularSchema) as Resolver<RegistrierenFormular>,
    mode: 'onTouched',
    defaultValues: { hofname: '', name: '', email: '', password: '', konditionen: false },
  })
  const { errors, isSubmitting } = form.formState
  const [hofname, name, email, password] = useWatch({ control: form.control, name: ['hofname', 'name', 'email', 'password'] })
  const staerke = passwortStaerke(password)

  async function absenden(werte: RegistrierenFormular) {
    setFehler('')
    const ergebnis = await registerFarmer({
      // EIN Namensfeld (Mockup): registerFarmer setzt Vor- und Nachname mit
      // vollerName zusammen, ein leerer Nachname fällt dort weg.
      firstName: werte.name,
      lastName: '',
      email: werte.email,
      password: werte.password,
      website,
      formToken,
    })
    if ('error' in ergebnis) {
      setFehler(ergebnis.error)
      return
    }

    schreibeHofnameEntwurf(sitzungsSpeicher(), werte.hofname)

    // Konto angelegt, Rolle FARMER gesetzt — jetzt im Browser anmelden, damit
    // das Sitzungs-Cookie steht. Ohne Ränder, wie registerFarmer das Konto
    // angelegt hat (Better Auth lehnt Leerzeichen am Rand ab).
    const { error: anmeldeFehler } = await signIn.email({ email: werte.email.trim(), password: werte.password })
    if (anmeldeFehler) {
      setFehler('Dein Konto ist angelegt, aber die Anmeldung hat nicht geklappt. Bitte melde dich selbst an.')
      return
    }
    router.push('/onboarding')
    router.refresh()
  }

  const feldId = (feld: string) => `${id}-${feld}`
  const fehlerId = (feld: string) => `${id}-${feld}-fehler`
  const beschreibung = (...ids: (string | false)[]) => ids.filter(Boolean).join(' ') || undefined

  return (
    <div className="mx-auto grid max-w-[1000px] gap-8 px-4 pt-5 pb-12 md:px-6 md:pt-10 lg:grid-cols-[minmax(0,580px)_minmax(0,1fr)] lg:gap-14">
      <div className="rounded-2xl border border-border bg-card p-5 md:p-7">
        <p className="mb-5 text-[14px] text-muted-foreground">{REGISTRIEREN_TARIF}</p>

        <form onSubmit={form.handleSubmit(absenden)} noValidate className="flex flex-col gap-4">
          {/* Honigtopf — unsichtbar für Menschen, verlockend für Skripte.
              aria-hidden hält ihn aus dem Screenreader heraus, tabIndex -1
              aus der Tab-Reihenfolge, autoComplete="off" aus dem Ausfüllen
              durch den Browser. */}
          <div style={HONIGTOPF_STIL} aria-hidden="true">
            <label htmlFor={feldId('website')}>Webseite (bitte frei lassen)</label>
            <input
              id={feldId('website')}
              name="website"
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor={feldId('hofname')} className={FELD_LABEL}>
              Name deines Hofs
            </label>
            <input
              id={feldId('hofname')}
              type="text"
              autoComplete="organization"
              placeholder="z. B. Hof am Bach"
              aria-invalid={errors.hofname ? true : undefined}
              aria-describedby={beschreibung(`${id}-adresse`, !!errors.hofname && fehlerId('hofname'))}
              className={FELD}
              {...form.register('hofname')}
            />
            <ZeichenZaehler laenge={hofname.trim().length} max={HOFNAME_MAX} />
            <HofAdresseVorschau hofname={hofname} id={`${id}-adresse`} />
            {errors.hofname?.message && <FeldFehler id={fehlerId('hofname')}>{errors.hofname.message}</FeldFehler>}
          </div>

          <div>
            <label htmlFor={feldId('name')} className={FELD_LABEL}>
              Dein Name
            </label>
            <input
              id={feldId('name')}
              type="text"
              autoComplete="name"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? fehlerId('name') : undefined}
              className={FELD}
              {...form.register('name')}
            />
            <ZeichenZaehler laenge={name.trim().length} max={PERSONENNAME_MAX} />
            {errors.name?.message && <FeldFehler id={fehlerId('name')}>{errors.name.message}</FeldFehler>}
          </div>

          <div>
            <label htmlFor={feldId('email')} className={FELD_LABEL}>
              E-Mail
            </label>
            <input
              id={feldId('email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? fehlerId('email') : undefined}
              className={FELD}
              {...form.register('email')}
            />
            <ZeichenZaehler laenge={email.trim().length} max={EMAIL_MAX} />
            {errors.email?.message && <FeldFehler id={fehlerId('email')}>{errors.email.message}</FeldFehler>}
          </div>

          <div>
            <label htmlFor={feldId('password')} className={FELD_LABEL}>
              Passwort
            </label>
            <div className="relative">
              <input
                id={feldId('password')}
                type={zeigePasswort ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={beschreibung(`${id}-staerke`, !!errors.password && fehlerId('password'))}
                className={cn(FELD, 'pr-12')}
                {...form.register('password')}
              />
              <button
                type="button"
                onClick={() => setZeigePasswort((z) => !z)}
                aria-label={zeigePasswort ? 'Passwort verbergen' : 'Passwort anzeigen'}
                aria-pressed={zeigePasswort}
                className={cn(
                  'absolute top-0.5 right-0.5 flex size-11 items-center justify-center rounded-[10px] text-muted-foreground hover:text-foreground',
                  FOKUS_RAHMEN
                )}
              >
                {zeigePasswort ? (
                  <EyeOff className="size-[18px]" strokeWidth={1.7} aria-hidden="true" />
                ) : (
                  <Eye className="size-[18px]" strokeWidth={1.7} aria-hidden="true" />
                )}
              </button>
            </div>
            {/* Vier Balken: orange, solange das Passwort nicht reicht, grün, sobald der Server es nimmt. */}
            <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
              {[1, 2, 3, 4].map((stufe) => (
                <span
                  key={stufe}
                  className={cn(
                    'h-1 rounded-full',
                    stufe > staerke.balken ? 'bg-border' : staerke.gueltig ? 'bg-accent' : 'bg-primary'
                  )}
                />
              ))}
            </div>
            <p
              id={`${id}-staerke`}
              className={cn(
                'mt-1.5 text-[12.5px]',
                staerke.balken === 0 ? 'text-muted-foreground' : staerke.gueltig ? 'text-status-fertig' : 'text-status-offen'
              )}
            >
              {staerke.text}
            </p>
            {errors.password && !staerke.gueltig && (
              <FeldFehler id={fehlerId('password')}>
                {password.length === 0 ? 'Bitte wähle ein Passwort.' : 'Das Passwort reicht noch nicht – darüber steht, was fehlt.'}
              </FeldFehler>
            )}
          </div>

          <div>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-[13.5px] leading-snug">
              <input
                type="checkbox"
                aria-invalid={errors.konditionen ? true : undefined}
                aria-describedby={errors.konditionen ? fehlerId('konditionen') : undefined}
                className={cn('mt-0.5 size-5 shrink-0 accent-accent', FOKUS_RAHMEN)}
                {...form.register('konditionen')}
              />
              {/* Eine AGB-Seite gibt es nicht (Bericht Nr. 15) — der Haken gilt
                  den Konditionen, die es zum Nachlesen gibt. */}
              <span>
                Ich akzeptiere die{' '}
                <Link href="/konditionen" target="_blank" className={TEXTLINK}>
                  Konditionen für Höfe
                </Link>
                .
              </span>
            </label>
            {errors.konditionen?.message && <FeldFehler id={fehlerId('konditionen')}>{errors.konditionen.message}</FeldFehler>}
          </div>

          {fehler && (
            <div role="alert">
              <Hinweiskarte ton="orange">{fehler}</Hinweiskarte>
            </div>
          )}

          <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined} className={cn(KNOPF_ORANGE, 'mt-1')}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isSubmitting ? 'Einen Moment …' : 'Konto erstellen'}
          </button>
        </form>
      </div>

      <aside aria-labelledby={`${id}-weiter`} className="flex flex-col gap-5 lg:pt-4">
        <h2 id={`${id}-weiter`} className="text-[12px] font-bold tracking-[1.6px] text-muted-foreground uppercase">
          So geht es weiter
        </h2>
        <StartSchritte schritte={REGISTRIEREN_SCHRITTE} />
        {/* „Rückruf anfordern" (Mockup) braucht die Tabelle RueckrufAnfrage —
            nicht freigegeben (freigabe.md §2). Bis dahin der Weg per Mail. */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-[14px]">Fragen vorab? Schreib uns, wir melden uns.</p>
          <a
            href={`mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent('Fragen zur Registrierung')}`}
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-4 text-[14px] font-medium hover:bg-muted',
              FOKUS_RAHMEN
            )}
          >
            <Mail className="size-4" strokeWidth={1.7} aria-hidden="true" />
            E-Mail schreiben
          </a>
        </div>
      </aside>
    </div>
  )
}
