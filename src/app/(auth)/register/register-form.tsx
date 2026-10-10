'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react'
import { registerFarmer } from '@/server/actions/register'
import { passwortStaerke } from '@/lib/password-rules'
import { schreibeHofnameEntwurf, sitzungsSpeicher } from '@/lib/hofname-entwurf'
import { KONDITIONEN_UEBERGANG } from '@/lib/konditionen'
import { REGISTRIEREN_SCHRITTE } from '@/lib/fuer-hoefe'
import { KONTAKT_EMAIL } from '@/lib/support'
import { EMAIL_MAX, HOFNAME_MAX, PERSONENNAME_MAX } from '@/lib/eingabegrenzen'
import { registrierenFormularSchema, type RegistrierenFormular } from '@/schemas/register'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { HofAdresseVorschau } from '@/components/shared/hof-adresse-vorschau'
import { SchonDabei } from '@/components/shared/schon-dabei'
import { FELD, FELD_LABEL, FeldFehler } from '@/components/checkout/kasse-teile'
import { StartSchritte } from '@/components/fuer-hoefe/start-schritte'
import { PostfachHinweis } from './postfach-hinweis'

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
 * registerFarmer (Better Auth E-Mail/Passwort, Rolle FARMER, Honigtopf,
 * Zeitschranke) antwortet seit Nr. 27 für neue und vergebene Adressen gleich;
 * danach zeigt das Formular „Schau in dein Postfach" (PostfachHinweis) und
 * meldet NICHT selbst an — eine scheiternde Anmeldung verriete, dass es die
 * Adresse schon gab (Register F6 „19b"). Neu im Formular (Nr. 15): Hofname mit der
 * künftigen Adresse, Passwortstärke, ein Link zu den Konditionen (ohne
 * Zustimmungs-Haken, siehe registrierenFormularSchema). Den Hof
 * selbst legt weiter Einrichten an; der Name wartet bis dahin im
 * sessionStorage (hofname-entwurf.ts).
 */
export function RegisterForm({ formToken }: { formToken: string }): React.JSX.Element {
  const id = useId()
  // Honigtopf: bleibt bei Menschen leer — außerhalb von react-hook-form, damit
  // er keine Regel und keinen Fehler bekommt.
  const [website, setWebsite] = useState('')
  const [fehler, setFehler] = useState('')
  const [zeigePasswort, setZeigePasswort] = useState(false)
  // Gesetzt nach dem Absenden: die Adresse, an die die Mail ging (bzw. bei
  // einer vergebenen Adresse: der Hinweis an das bestehende Konto).
  const [gesendetAn, setGesendetAn] = useState<string | null>(null)

  const form = useForm<RegistrierenFormular>({
    resolver: zodResolver(registrierenFormularSchema) as Resolver<RegistrierenFormular>,
    mode: 'onTouched',
    defaultValues: { hofname: '', name: '', email: '', password: '' },
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

    // Der Hofname wartet bis Einrichten — im selben Tab; öffnet der Link aus
    // der Mail einen neuen, fragt Einrichten ihn einfach noch einmal.
    schreibeHofnameEntwurf(sitzungsSpeicher(), werte.hofname)
    setGesendetAn(werte.email.trim())
  }

  const feldId = (feld: string) => `${id}-${feld}`
  const fehlerId = (feld: string) => `${id}-${feld}-fehler`
  const beschreibung = (...ids: (string | false)[]) => ids.filter(Boolean).join(' ') || undefined

  return (
    <div className="mx-auto grid max-w-[1000px] gap-8 px-4 pt-5 pb-12 md:px-6 md:pt-10 lg:grid-cols-[minmax(0,580px)_minmax(0,1fr)] lg:gap-14">
      {/* Nach dem Absenden nur so hoch wie der Hinweis, nicht so hoch wie die Spalte daneben. */}
      <div className={cn('rounded-2xl border border-border bg-card p-5 md:p-7', gesendetAn !== null && 'self-start')}>
        {gesendetAn !== null ? (
          <PostfachHinweis email={gesendetAn} />
        ) : (
          <>
            {/* Der Übergang aus konditionen.ts (Register K1) statt eines Tarifs, der heute gälte. */}
            <p className="mb-5 text-[14px] leading-normal text-muted-foreground">{KONDITIONEN_UEBERGANG}</p>

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

              {/* Nur zum Nachlesen, keine Zustimmung: AGB und Nutzungsbedingungen
                  sind offen (Register O4), bis dahin kein Haken. */}
              <p className="text-[13.5px] leading-snug text-muted-foreground">
                <Link href="/konditionen" target="_blank" className={cn(TEXTLINK, 'inline-flex min-h-11 items-center')}>
                  Konditionen für Höfe ansehen
                </Link>
              </p>

              {fehler && (
                <div role="alert">
                  <Hinweiskarte ton="orange">{fehler}</Hinweiskarte>
                </div>
              )}

              <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined} className={cn(KNOPF_ORANGE, 'mt-1')}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {isSubmitting ? 'Einen Moment …' : 'Konto erstellen'}
              </button>
              {/* Register N1: Wer schon einen Hof hat, findet hier den Weg zur Anmeldung — auch am Handy, wo der Kopf nur „Anmelden" zeigt. */}
              <SchonDabei className="-mt-1 text-center" />
            </form>
          </>
        )}
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
