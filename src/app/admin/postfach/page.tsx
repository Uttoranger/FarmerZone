import type { Metadata } from 'next'
import Link from 'next/link'
import { permanentRedirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { PenLine } from 'lucide-react'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { ladeErstattungAufgaben, zaehleOffenImEingang, zaehleRundschreibenImMonat } from '@/server/queries/postfach'
import {
  ADMIN_POSTFACH_TEXT,
  EINGANG_TEXT,
  adminPostfachAdresse,
  alteReiterAdresse,
  offenGesamt,
  postfachKennzahlen,
  postfachUnterreiter,
  type AdminPostfachReiter,
  type EingangZahlen,
  type ErstattungAufgabeRoh,
} from '@/lib/postfach'
import { adminPostfachReiterAus, eingangAuswahlAus, eingangFilterAus } from '@/schemas/postfach'
import { cn } from '@/lib/utils'
import { MARKE } from '@/lib/marke'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'
import { Seitenkopf } from '@/components/admin/seitenkopf'
import { Kennzahlen } from '@/components/admin/kennzahlen'
import { Unterreiter } from '@/components/admin/unterreiter'
import { EingangReiter, ladeEingangReiter, type EingangDaten } from './eingang-reiter'
import { RundschreibenReiter, ladeRundschreibenReiter, type RundschreibenDaten } from './rundschreiben-reiter'
import { ZustellungReiter, ladeZustellungDaten, type ZustellungDaten } from './zustellung-reiter'

export const metadata: Metadata = { title: `${ADMIN_POSTFACH_TEXT.titel} — Admin — ${MARKE}` }
export const dynamic = 'force-dynamic'

type Suche = {
  reiter?: string | string[]
  art?: string | string[]
  id?: string | string[]
  meldung?: string | string[]
  faden?: string | string[]
}

/** Next liefert einen doppelten Parameter als Liste — dann zählt der erste. */
function einzeln(wert: string | string[] | undefined): string | undefined {
  return Array.isArray(wert) ? wert[0] : wert
}

type ReiterDaten =
  | { reiter: 'eingang'; daten: EingangDaten }
  | { reiter: 'rundschreiben'; daten: RundschreibenDaten }
  | { reiter: 'zustellung'; daten: ZustellungDaten }

/** Lädt nur den offenen Reiter; ein Datenbankfehler wirft. */
async function ladeReiter(reiter: AdminPostfachReiter, roh: Suche, jetzt: Date): Promise<ReiterDaten> {
  if (reiter === 'eingang') return { reiter, daten: await ladeEingangReiter(eingangFilterAus(roh.art), eingangAuswahlAus(roh.id, roh.meldung), jetzt) }
  if (reiter === 'rundschreiben') return { reiter, daten: await ladeRundschreibenReiter() }
  return { reiter, daten: await ladeZustellungDaten(jetzt) }
}

/*
 * /admin/postfach — der eine Ort, an dem beim Admin alles ankommt (Register
 * N12 mit der Änderung vom 15.10., N14, N15; Nachtlauf Nr. 95; Mockups
 * admin-postfach*, admin-rundschreiben). Seitenmuster N15: Seitenkopf mit Satz
 * und „Rundschreiben schreiben", Kennzahlen, Unterreiter Eingang ·
 * Rundschreiben · Zustellung (?reiter=, Zod mit Standard), Inhalt,
 * Regel-Zeile. Die Reiter von Stufe 1 (?reiter=unterhaltungen|meldungen)
 * leiten dauerhaft in den Eingang mit passendem Filter. Erste Anweisung ist
 * die Admin-Prüfung. Lassen sich die Zahlen nicht laden, geht es ohne
 * Kennzahlen weiter; lässt sich der Reiter nicht laden, steht AdminFehler da
 * — mit EINER h1 („Postfach").
 */
export default async function AdminPostfachPage({ searchParams }: { searchParams: Promise<Suche> }): Promise<React.JSX.Element> {
  await verlangeAdminSeite()

  const roh = await searchParams
  const alt = alteReiterAdresse(einzeln(roh.reiter), einzeln(roh.faden))
  if (alt) permanentRedirect(alt)
  const reiter = adminPostfachReiterAus(roh.reiter)
  const jetzt = new Date()

  let stand: { zahlen: EingangZahlen; erstattungen: ErstattungAufgabeRoh[]; rundschreibenImMonat: number } | null = null
  try {
    const [zahlen, erstattungen, rundschreibenImMonat] = await Promise.all([zaehleOffenImEingang(), ladeErstattungAufgaben(), zaehleRundschreibenImMonat(jetzt)])
    stand = { zahlen, erstattungen, rundschreibenImMonat }
  } catch (err) {
    // Ohne Zahlen geht es weiter — der Reiter lädt seinen Inhalt selbst.
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'postfach' } })
  }

  let geladen: ReiterDaten | null = null
  try {
    geladen = await ladeReiter(reiter, roh, jetzt)
  } catch (err) {
    // Nur Bereich und Reiter — nie ein Nachrichten- oder Meldungstext.
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: `postfach-${reiter}` } })
  }
  if (!geladen) {
    return (
      <div className={ADMIN_RAHMEN}>
        <AdminFehler titel={ADMIN_POSTFACH_TEXT.titel} satz={ADMIN_POSTFACH_TEXT.ladeFehler[reiter]} nochmal={adminPostfachAdresse(reiter)} />
      </div>
    )
  }

  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-4 md:gap-5')}>
      <Seitenkopf
        titel={ADMIN_POSTFACH_TEXT.titel}
        satz={EINGANG_TEXT.satz}
        rechts={
          <Link
            href={adminPostfachAdresse('rundschreiben')}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-[18px] text-sm font-semibold whitespace-nowrap text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90',
              FOKUS_RAHMEN
            )}
          >
            <PenLine className="size-4" strokeWidth={2} aria-hidden="true" />
            {EINGANG_TEXT.hauptaktion}
          </Link>
        }
      />
      {stand && <Kennzahlen beschriftung={EINGANG_TEXT.kennzahlenBeschriftung} eintraege={postfachKennzahlen(stand)} />}
      <Unterreiter beschriftung={EINGANG_TEXT.unterreiterBeschriftung} eintraege={postfachUnterreiter(stand ? offenGesamt(stand.zahlen) : null)} aktiv={reiter} />

      {geladen.reiter === 'eingang' && <EingangReiter daten={geladen.daten} jetzt={jetzt} />}
      {geladen.reiter === 'rundschreiben' && <RundschreibenReiter daten={geladen.daten} jetzt={jetzt} />}
      {geladen.reiter === 'zustellung' && <ZustellungReiter daten={geladen.daten} />}
    </div>
  )
}
