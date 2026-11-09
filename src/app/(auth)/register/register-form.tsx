'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { registerFarmer } from '@/server/actions/register'
import { validatePassword } from '@/lib/password-rules'
import { schreibeHofnameEntwurf, sitzungsSpeicher } from '@/lib/hofname-entwurf'
import { KONDITIONEN_UEBERGANG } from '@/lib/konditionen'
import { REGISTRIEREN_SCHRITTE } from '@/lib/fuer-hoefe'
import { KONTAKT_EMAIL } from '@/lib/support'
import { REGISTRIERUNG_AGB_SATZ } from '@/lib/rechtstexte/agb-einbindung'
import { EMAIL_MAX, HOFNAME_MAX, PERSONENNAME_MAX } from '@/lib/eingabegrenzen'
import { registrierenFormularSchema, type RegistrierenFormular } from '@/schemas/register'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { PasswordInput } from '@/components/ui/password-input'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { HofAdresseVorschau } from '@/components/shared/hof-adresse-vorschau'
import { SCHON_DABEI } from '@/lib/kunden-navigation'
import { FELD, FELD_LABEL, FeldFehler } from '@/components/checkout/kasse-teile'
import { AgbSatz } from '@/components/rechtstexte/agb-stuecke'
import { PasswortAnforderungen, PASSWORT_ANFORDERUNGEN_SATZ } from '@/components/anmelden/passwort-anforderungen'
import { PostfachHinweis } from './postfach-hinweis'
import { KNOPF_UMRISS_KRAEFTIG, TEXTLINK } from '@/components/anmelden/stil'

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
  'inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] bg-primary px-[18px] text-[15px] font-bold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60',
  FOKUS_RAHMEN
)

/**
 * Hof registrieren im neuen Design (Gate 5, Nr. 15; Mockups
 * web-h0-hof-registrieren und mobil-h0-registrieren).
 *
 * registerFarmer (Better Auth E-Mail/Passwort, Rolle FARMER, Honigtopf,
 * Zeitschranke) antwortet seit Nr. 27 für neue und vergebene Adressen gleich;
 * danach zeigt das Formular „Schau in dein Postfach" (PostfachHinweis) und
 * meldet NICHT selbst an — eine scheiternde Anmeldung verriete, dass es die
 * Adresse schon gab (Register F6 „19b"). Neu im Formular (Nr. 15): Hofname mit der
 * künftigen Adresse, Passwort-Regeln zum Abhaken (seit Lauf 30 statt der Stärke-Balken), ein Satz mit Links zu AGB und
 * Konditionen (ohne Zustimmungs-Haken, siehe registrierenFormularSchema und
 * Register O4). Den Hof
 * selbst legt weiter Einrichten an; der Name wartet bis dahin im
 * sessionStorage (hofname-entwurf.ts).
 */
export function RegisterForm({ formToken, gruendungSatz = null }: { formToken: string; gruendungSatz?: React.ReactNode }): React.JSX.Element {
  const id = useId()
  // Honigtopf: bleibt bei Menschen leer — außerhalb von react-hook-form, damit
  // er keine Regel und keinen Fehler bekommt.
  const [website, setWebsite] = useState('')
  const [fehler, setFehler] = useState('')
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
  const passwortGueltig = validatePassword(password).valid

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
    <div className="mx-auto grid max-w-[944px] gap-8 px-4 pt-5 pb-12 md:px-6 md:pt-5 lg:grid-cols-[minmax(0,560px)_minmax(0,320px)] lg:gap-4">
      {/* Das Formular liegt direkt auf der Seite, ohne Karte (Board s2-/w2-registrieren); nach dem Absenden nur so hoch
          wie der Hinweis, nicht so hoch wie die Spalte daneben. */}
      <div className={cn(gesendetAn !== null && 'self-start')}>
        {gesendetAn !== null ? (
          <PostfachHinweis email={gesendetAn} />
        ) : (
          <>
            {/* Die Fokus-Shell trägt die h1 „Hof registrieren“; die Karte wiederholt den Titel als h2 (Board w2-registrieren). */}
            <h2 className="mb-2.5 font-heading text-[24px] leading-tight font-semibold">Hof registrieren</h2>
            {/* Der Übergang aus konditionen.ts (Register K1) statt eines Tarifs, der heute gälte. */}
            <p className="mb-2.5 text-[14px] leading-normal text-muted-foreground">{KONDITIONEN_UEBERGANG}</p>
            {/* Der Satz der Gründungsaktion ohne Platznummer (Lauf 30) — die Seite rendert ihn, ohne Aktion nichts. */}
            {gruendungSatz}

            {/* 10 px zwischen den Feldern und 6 px von der Beschriftung zum Feld wie im Board (Nr. 275: das Formular war etwa 85 px länger). */}
            <form onSubmit={form.handleSubmit(absenden)} noValidate className="flex flex-col gap-2.5">
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
                  // Platzhalter wie im Board w2-registrieren (Bild 1); der Name bleibt dort leer.
                  placeholder="Vor- und Nachname"
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
                <PasswordInput
                  id={feldId('password')}
                  autoComplete="new-password"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={beschreibung(`${id}-passwort-satz`, `${id}-regeln`, !!errors.password && fehlerId('password'))}
                  feld={FELD}
                  {...form.register('password')}
                />
                {/* Die Regeln haken sich beim Tippen ab (Board w2-registrieren) — wie beim neuen Passwort. */}
                <p id={`${id}-passwort-satz`} className="mt-1.5 text-[13px] text-muted-foreground">
                  {PASSWORT_ANFORDERUNGEN_SATZ}
                </p>
                <PasswortAnforderungen passwort={password} id={`${id}-regeln`} className="mt-1" />
                {errors.password && !passwortGueltig && (
                  <FeldFehler id={fehlerId('password')}>
                    {password.length === 0 ? 'Bitte wähle ein Passwort.' : 'Das Passwort reicht noch nicht – darüber steht, was fehlt.'}
                  </FeldFehler>
                )}
              </div>

              {/* Register O4 (geändert 13.10.2026): AGB und Konditionen werden mit diesem
                  Satz einbezogen — Links, kein Haken. Beide öffnen in einem neuen Tab,
                  damit das ausgefüllte Formular stehen bleibt. */}
              <AgbSatz stuecke={REGISTRIERUNG_AGB_SATZ} neuerTab className="text-[14px] leading-snug text-muted-foreground" />

              {fehler && (
                <div role="alert">
                  <Hinweiskarte ton="orange">{fehler}</Hinweiskarte>
                </div>
              )}

              <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined} className={KNOPF_ORANGE}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {isSubmitting ? 'Einen Moment …' : 'Konto erstellen'}
              </button>
              {/* Register N1: Wer schon einen Hof hat, findet hier den Weg zur Anmeldung — auch am Handy, wo der Kopf nur „Anmelden" zeigt. */}
              {/* Liste Lauf 32 (registrieren): der ganze Satz ist der Link, 15 px halbfett wie im Board. */}
              <Link href={SCHON_DABEI.href} className={cn(TEXTLINK, '-mt-1 text-[15px]')}>
                {`${SCHON_DABEI.frage} ${SCHON_DABEI.link}`}
              </Link>
            </form>
          </>
        )}
      </div>

      {/* Seitenspalte als EINE Karte (Board w2-registrieren): Serifen-Titel, die Schritte mit grün getönten Ziffern,
          „Fragen vorab?“ und „E-Mail schreiben“ darin. StartSchritte (fuer-hoefe) zeichnet orange Ringe für /fuer-hoefe;
          eine grüne Variante dort wäre Sache jener Nummer — darum die Liste hier aus derselben Quelle. */}
      {/* Maße nach Board (Nr. 275): Titel 18 px, Ziffern 26 px mit 14 px, Text 14 px, 10 px Abstand. */}
      <aside aria-labelledby={`${id}-weiter`} className={cn('flex flex-col gap-2.5 self-start border border-border bg-card p-4', RUNDUNG.blatt)}>
        <h2 id={`${id}-weiter`} className="font-heading text-[18px] leading-tight font-semibold">
          So geht’s weiter
        </h2>
        <ol className="flex flex-col gap-2.5">
          {REGISTRIEREN_SCHRITTE.map((s, i) => (
            <li key={s.titel} className="flex gap-2.5">
              <span
                aria-hidden="true"
                className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-zustand-laeuft-grund text-[14px] font-bold text-zustand-laeuft"
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold">{s.titel}</span>
                <span className="block text-[14px] leading-snug text-muted-foreground">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
        {/* „Rückruf anfordern" (Mockup) braucht die Tabelle RueckrufAnfrage —
            nicht freigegeben (freigabe.md §2). Bis dahin der Weg per Mail. */}
        <p className="text-[14px] text-muted-foreground">Fragen vorab? Schreib uns, wir melden uns.</p>
        <a
          href={`mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent('Fragen zur Registrierung')}`}
          className={cn(KNOPF_UMRISS_KRAEFTIG, 'w-auto')}
        >
          E-Mail schreiben
        </a>
      </aside>
    </div>
  )
}
