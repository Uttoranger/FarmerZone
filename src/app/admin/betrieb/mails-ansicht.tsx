import * as Sentry from '@sentry/nextjs'
import { CircleAlert, CircleCheck, Clock, Info } from 'lucide-react'
import { ADMIN_BETRIEB_HREF, ADMIN_BETRIEB_MAILS_HREF, BETRIEB_TEXT, TARIFE } from '@/lib/betrieb'
import {
  ADMIN_BETRIEB_MAILS_ALLE_ARTEN_HREF,
  MAIL_TEXT,
  brauchtDich,
  jeArt,
  mailKacheln,
  mailVerlauf,
  mailWarnLage,
  mailWarnkarte,
  schlangeKarte,
  suchErgebnis,
  summeArten,
  type BrauchtDichGruppe,
  type BrauchtDichZeile,
  type JeArtZeile,
  type MailKachel,
  type MailVerlauf,
  type SchlangeKarte,
  type SuchErgebnis,
} from '@/lib/betrieb-mails'
import { uhrzeitInWien } from '@/lib/fristen'
import { cn } from '@/lib/utils'
import type { MailSuche } from '@/schemas/betrieb-mails'
import { KANN_WARTEN_PAUSE } from '@/server/mail-warteschlange'
import { ladeWarnungen } from '@/server/queries/betrieb'
import { ladeArtZahlen, ladeLetztenDurchlauf, ladeMailVerlauf, ladeMailZaehler, ladeProbleme, ladeWarteschlange, sucheMails } from '@/server/queries/mails'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Marke } from '@/components/ui/marke'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { FELD, FELD_LABEL, KARTE, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { ADMIN_RAHMEN } from '@/components/admin/admin-teile'
import { Seitenkopf } from '@/components/admin/seitenkopf'
import { BetriebUnterreiter, GrenzBalken, Karte, Klappkarte, Warnkarte } from './betrieb-teile'
import { MailKnoepfe, type MailKnoepfeTexte } from './mails-aktionen'
import { MinutenNachladen } from './minuten-nachladen'

/*
 * Admin › Betrieb › E-Mails (Register N26, N18-Ergänzung 24.10.2026; Nr. 161;
 * Mockups admin-betrieb-mails bei 1440 px und mobil-admin-betrieb-mails bei
 * 390 px, Fassung 3). Lädt die Teile einzeln: Scheitert einer, zeigt nur er
 * den Fehlersatz (Muster `ladeTabellenSicher`), die anderen stehen.
 * Entschieden wird nichts hier — Kacheln, Warnkarte, Listen und Sätze kommen
 * aus src/lib/betrieb-mails.ts. Angezeigt wird nie eine Adresse (nur gekürzt
 * in der Suche), nie ein Name, nie ein Inhalt.
 *
 * Am Computer: Warnkarte, fünf Kacheln, darunter links Je Art, Verlauf,
 * Warteschlange, rechts Suche und Braucht dich. Am Handy (Reihenfolge des
 * Mockups): Suche (für Anrufe), Warnkarte, Braucht dich, Kacheln, dann Je Art,
 * Verlauf und Warteschlange zugeklappt. Suche und Braucht dich stehen darum
 * zweimal im Dokument (je eine Fassung ist ausgeblendet, `hidden`), so stimmt
 * die Reihenfolge für Tastatur und Screenreader in beiden Breiten.
 */

const H2 = 'font-heading text-[17px] font-semibold text-foreground'
const ANKER = { breit: 'braucht-dich', handy: 'braucht-dich-handy' } as const

/** Ein Teil, das nicht geladen werden konnte: nur die Klasse nach Sentry, der Teil zeigt den Satz. */
async function sicher<T>(teil: string, laden: () => Promise<T>): Promise<T | null> {
  try {
    return await laden()
  } catch (err) {
    Sentry.captureException(err, { level: 'warning', tags: { bereich: 'admin', seite: 'betrieb-mails', teil } })
    return null
  }
}

function TeilFehler(): React.JSX.Element {
  return (
    <Hinweiskarte ton="orange" symbol={CircleAlert}>
      {MAIL_TEXT.ladefehler}
    </Hinweiskarte>
  )
}

const KNOPF_TEXTE: MailKnoepfeTexte = { jetztSchicken: MAIL_TEXT.jetztSchicken, verwerfen: MAIL_TEXT.verwerfen, fehler: MAIL_TEXT.aktionFehler }

// ─── Kacheln ─────────────────────────────────────────────────────────────────

function MailKachelKarte({ k }: { k: MailKachel }): React.JSX.Element {
  return (
    <article className={cn(KARTE, 'flex min-w-0 flex-col gap-2 p-4', k.zustand.art === 'tun' && 'border-primary/60')}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h3 className="min-w-0 flex-1 text-[15px] font-semibold text-foreground">{k.titel}</h3>
        <Marke art={k.zustand.art}>{k.zustand.wort}</Marke>
      </div>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span className="font-heading text-[26px] leading-tight font-semibold text-foreground tabular-nums">{k.wert}</span>
        <span className={cn('text-[13px]', LEISE)}>{k.von}</span>
      </div>
      {k.balken && <GrenzBalken titel={k.titel} anteil={k.balken.anteil} warnt={k.balken.warnt} strich={k.balken.strich} />}
      {k.zeilen.map((z) => (
        <p key={z} className="text-[12.5px] leading-snug break-words text-foreground">
          {z}
        </p>
      ))}
      {k.satz && <p className={cn('hidden text-[12px] leading-snug lg:block', LEISE)}>{k.satz}</p>}
    </article>
  )
}

function MailKacheln({ kacheln }: { kacheln: readonly MailKachel[] }): React.JSX.Element {
  return (
    <section aria-labelledby="mails-kacheln">
      <h2 id="mails-kacheln" className="sr-only">
        {MAIL_TEXT.kacheln}
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5 lg:gap-3.5">
        {kacheln.map((k) => (
          <MailKachelKarte key={k.id} k={k} />
        ))}
      </div>
    </section>
  )
}

// ─── Suche ───────────────────────────────────────────────────────────────────

function SuchFeld({ id, wert, mitHilfe }: { id: string; wert: string; mitHilfe: boolean }): React.JSX.Element {
  return (
    <form role="search" action={ADMIN_BETRIEB_HREF} method="get" className="flex flex-col gap-1">
      <input type="hidden" name="reiter" value="mails" />
      <label htmlFor={id} className={FELD_LABEL}>
        {MAIL_TEXT.sucheLabel}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name="suche"
          type="search"
          defaultValue={wert}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={mitHilfe ? `${id}-hilfe` : undefined}
          className={cn(FELD, 'min-h-11')}
        />
        <button type="submit" className={cn(KNOPF_RAHMEN, 'font-semibold')}>
          {MAIL_TEXT.sucheKnopf}
        </button>
      </div>
      {mitHilfe && (
        <p id={`${id}-hilfe`} className={cn('text-[12.5px] leading-snug', LEISE)}>
          {MAIL_TEXT.sucheHilfe}
        </p>
      )}
    </form>
  )
}

function SuchTreffer({ ergebnis }: { ergebnis: SuchErgebnis | null }): React.JSX.Element | null {
  if (ergebnis === null) return <TeilFehler />
  if (ergebnis.art === 'leer') return null
  if (ergebnis.art === 'hinweis') {
    return (
      <p role="status" className="text-[13px] leading-snug text-foreground">
        {ergebnis.satz}
      </p>
    )
  }
  return (
    <div role="status" className="flex flex-col gap-3">
      {ergebnis.gruppen.map((g) => (
        <section key={g.kopf} aria-label={g.kopf} className="flex flex-col gap-1.5 rounded-xl border border-border bg-background p-3">
          <h3 className="text-[13.5px] leading-snug font-semibold break-words text-foreground">{g.kopf}</h3>
          {g.unterzeile && <p className={cn('text-[12.5px] leading-snug', LEISE)}>{g.unterzeile}</p>}
          {g.an && <p className={cn('text-[12.5px] leading-snug break-words', LEISE)}>{g.an}</p>}
          {g.zeilen.length > 0 && (
            <ul className="flex flex-col divide-y divide-border">
              {g.zeilen.map((z, i) => (
                <li key={`${z.name}-${i}`} className="flex min-w-0 items-center gap-2 py-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px] font-semibold text-foreground">{z.name}</span>
                    <span className={cn('text-[12.5px] leading-snug', LEISE)}>
                      {z.weg} · {z.stand}
                    </span>
                  </span>
                  {z.marke && <Marke art={z.marke.art}>{z.marke.text}</Marke>}
                </li>
              ))}
            </ul>
          )}
          {g.leer && <p className={cn('text-[12.5px] leading-snug', LEISE)}>{g.leer}</p>}
        </section>
      ))}
      {ergebnis.zugestellt && (
        <p className="flex items-start gap-2 text-[12.5px] leading-snug text-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
          {MAIL_TEXT.zugestelltHinweis}
        </p>
      )}
      <p className={cn('text-[12px]', LEISE)}>{MAIL_TEXT.nurGekuerzt}</p>
    </div>
  )
}

// ─── Braucht dich ────────────────────────────────────────────────────────────

function BrauchtDichListe({ zeilen, gruppen, anker }: { zeilen: readonly BrauchtDichZeile[]; gruppen: readonly BrauchtDichGruppe[]; anker: string }): React.JSX.Element {
  return (
    <section id={anker} aria-labelledby={`${anker}-titel`} className="flex scroll-mt-24 flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <h2 id={`${anker}-titel`} className={H2}>
          {MAIL_TEXT.brauchtTitel}
        </h2>
        <span className={cn('text-[12.5px]', LEISE)}>{`${zeilen.length} ${zeilen.length === 1 ? 'Mail' : 'Mails'}`}</span>
      </div>
      {zeilen.length === 0 ? (
        <EmptyState symbol={CircleCheck} titel={MAIL_TEXT.brauchtLeer} satz={MAIL_TEXT.brauchtLeerSatz} ausweg={{ ohne: 'Es gibt nichts zu tun; die Seite lädt jede Minute neu.' }} className="py-6" />
      ) : (
        <>
          {gruppen.map((g) => (
            <div key={g.art} className={cn(KARTE, 'flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3')}>
              <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-foreground">{g.name}</span>
              <MailKnoepfe
                auswahl={{ art: g.art }}
                jetzt={g.jetztSchicken > 1 ? MAIL_TEXT.alleJetztSchicken(g.jetztSchicken) : undefined}
                verwerfen={g.verwerfen > 1 ? MAIL_TEXT.alleVerwerfen(g.verwerfen) : undefined}
                texte={KNOPF_TEXTE}
              />
            </div>
          ))}
          <ul className="flex flex-col gap-2.5">
            {zeilen.map((z) => (
              <li key={z.id} className={cn(KARTE, 'flex min-w-0 flex-col gap-1.5 p-4', z.stand.art === 'tun' && 'border-primary/60')}>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="min-w-0 text-[14.5px] font-semibold text-foreground">{z.name}</h3>
                  <Chip className="font-semibold">{z.weg}</Chip>
                  <Marke art={z.stand.art}>{z.stand.wort}</Marke>
                </div>
                <p className="text-[13px] leading-snug break-words text-foreground">{z.grund}</p>
                <p className={cn('text-[12.5px] leading-snug', LEISE)}>{z.zeile}</p>
                <p className="text-[12.5px] leading-snug text-foreground">{z.tun}</p>
                {(z.jetztSchicken || z.verwerfen) && (
                  <MailKnoepfe
                    auswahl={{ id: z.id }}
                    jetzt={z.jetztSchicken ? MAIL_TEXT.jetztSchicken : undefined}
                    verwerfen={z.verwerfen ? MAIL_TEXT.verwerfen : undefined}
                    texte={KNOPF_TEXTE}
                    className="mt-1"
                  />
                )}
              </li>
            ))}
          </ul>
          <p className={cn('text-[12.5px] leading-snug', LEISE)}>{MAIL_TEXT.brauchtFuss}</p>
        </>
      )}
    </section>
  )
}

// ─── Je Art ──────────────────────────────────────────────────────────────────

function JeArtTabelle({ zeilen }: { zeilen: readonly JeArtZeile[] }): React.JSX.Element {
  const s = MAIL_TEXT.jeArtSpalten
  const zahl = 'px-3 py-2.5 text-right tabular-nums'
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-[13px]">
        <caption className="sr-only">{MAIL_TEXT.jeArtCaption}</caption>
        <thead>
          <tr className={cn('border-b border-border text-[12px]', LEISE)}>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              {s.art}
            </th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              {s.weg}
            </th>
            {[s.gesendet, s.zugestellt, s.gescheitert, s.abgelehnt, s.wartezeit].map((t) => (
              <th key={t} scope="col" className="px-3 py-2 text-right font-semibold">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={`${z.art}-${z.weg}`} className="border-b border-border last:border-0">
              <th scope="row" className="px-3 py-2.5 text-left font-semibold text-foreground">
                {z.name}
              </th>
              <td className={cn('px-3 py-2.5', LEISE)}>{z.weg}</td>
              <td className={zahl}>{z.gesendet}</td>
              <td className={zahl}>{z.zugestellt}</td>
              <td className={cn(zahl, z.gescheitert !== '0' && 'font-semibold text-status-offen')}>{z.gescheitert}</td>
              <td className={cn(zahl, z.abgelehnt !== '0' && 'font-semibold text-status-offen')}>{z.abgelehnt}</td>
              <td className={cn(zahl, LEISE)}>{z.wartezeit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function JeArtListe({ zeilen }: { zeilen: readonly JeArtZeile[] }): React.JSX.Element {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {zeilen.map((z) => (
        <li key={`${z.art}-${z.weg}`} className="flex min-w-0 items-center gap-3 py-2.5">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13.5px] font-semibold text-foreground">{z.name}</span>
            <span className={cn('text-[12.5px] leading-snug', z.auffaellig ? 'text-status-offen' : LEISE)}>{z.kurz}</span>
          </span>
          <span className="text-[14px] font-semibold text-foreground tabular-nums">{z.gesendet}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Verlauf ─────────────────────────────────────────────────────────────────

const V_BREITE = 840
const V_HOEHE = 200
const V_LINKS = 8
const V_RECHTS = 8
const V_OBEN = 14
const V_UNTEN = 26

/**
 * Gesendet je Tag als Säulen, gescheitert als Punkt über der Säule. Das Bild
 * ist Schmuck (`aria-hidden`): Dieselben Zahlen stehen als Satz darunter, den
 * auch Screenreader lesen. Neu statt VerlaufDiagramm: Das zeichnet Linien in %
 * der Grenze über 90 Tage, hier sind es Mengen je Tag.
 */
function MailVerlaufBild({ verlauf }: { verlauf: MailVerlauf }): React.JSX.Element {
  const breite = V_BREITE - V_LINKS - V_RECHTS
  const hoehe = V_HOEHE - V_OBEN - V_UNTEN
  const spalte = breite / verlauf.tage.length
  const saeule = Math.max(4, spalte * 0.62)
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <li className={cn('flex items-center gap-1.5 text-[12.5px]', LEISE)}>
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-accent" />
          {MAIL_TEXT.verlaufGesendet}
        </li>
        <li className={cn('flex items-center gap-1.5 text-[12.5px]', LEISE)}>
          <span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />
          {MAIL_TEXT.verlaufGescheitert}
        </li>
      </ul>
      <svg viewBox={`0 0 ${V_BREITE} ${V_HOEHE}`} aria-hidden="true" className="h-auto w-full">
        <line x1={V_LINKS} x2={V_BREITE - V_RECHTS} y1={V_OBEN + hoehe} y2={V_OBEN + hoehe} className="stroke-border" strokeWidth={1} />
        {verlauf.tage.map((t, i) => {
          const h = (t.gesendet / verlauf.hoechstens) * (hoehe - 10)
          const x = V_LINKS + i * spalte + (spalte - saeule) / 2
          const y = V_OBEN + hoehe - h
          return (
            <g key={t.tag}>
              {t.gesendet > 0 && <rect x={x} y={y} width={saeule} height={h} rx={2} className="fill-accent" />}
              {t.gescheitert > 0 && <circle cx={x + saeule / 2} cy={Math.max(V_OBEN - 4, y - 7)} r={3.5} className="fill-primary" />}
            </g>
          )
        })}
        <text x={V_LINKS} y={V_HOEHE - 6} className="fill-muted-foreground text-[11px]">
          {verlauf.von}
        </text>
        <text x={V_BREITE / 2} y={V_HOEHE - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          {verlauf.mitte}
        </text>
        <text x={V_BREITE - V_RECHTS} y={V_HOEHE - 6} textAnchor="end" className="fill-muted-foreground text-[11px]">
          heute
        </text>
      </svg>
      <p className="text-[13px] leading-snug text-foreground">{verlauf.satz}</p>
    </div>
  )
}

// ─── Warteschlange ───────────────────────────────────────────────────────────

function SchlangeInhalt({ karte }: { karte: SchlangeKarte }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <dl className="flex flex-col divide-y divide-border">
        {karte.zeilen.map((z) => (
          <div key={z.weg} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
            <dt className="text-[13px] text-foreground">{z.weg}</dt>
            <dd className="text-[13px] font-semibold text-foreground tabular-nums">{z.wert}</dd>
          </div>
        ))}
      </dl>
      <p className={cn('flex items-center gap-1.5 text-[12.5px] leading-snug', LEISE)}>
        <Clock className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        {karte.durchlauf}
      </p>
    </div>
  )
}

// ─── Ansicht ─────────────────────────────────────────────────────────────────

/**
 * Lädt die Teile der Ansicht E-Mails (je einzeln abgesichert) und zeichnet
 * sie. `suche` ist schon geprüft (`mailSucheAus`); `sucheRoh` steht wieder
 * im Feld. Ein ungültiges Format fragt die Datenbank nie.
 */
export async function MailsAnsicht({ jetzt, suche, sucheRoh, alle }: { jetzt: Date; suche: MailSuche; sucheRoh: string; alle: boolean }): Promise<React.JSX.Element> {
  const zaehler = await sicher('zaehler', () => ladeMailZaehler(jetzt))
  const [schlange, probleme, arten, verlaufRoh, lauf, warnungen, gefunden] = await Promise.all([
    zaehler ? sicher('warteschlange', () => ladeWarteschlange(jetzt, zaehler)) : Promise.resolve(null),
    sicher('probleme', () => ladeProbleme(jetzt)),
    sicher('arten', () => ladeArtZahlen(jetzt)),
    sicher('verlauf', () => ladeMailVerlauf(jetzt)),
    sicher('durchlauf', async () => ({ lauf: await ladeLetztenDurchlauf() })),
    sicher('warnungen', () => ladeWarnungen()),
    suche.art === 'bestellung' || suche.art === 'adresse' ? sicher('suche', () => sucheMails(suche, jetzt)) : Promise.resolve(null),
  ])

  const ergebnis: SuchErgebnis | null =
    suche.art === 'leer'
      ? { art: 'leer' }
      : suche.art === 'ungueltig'
        ? { art: 'hinweis', satz: MAIL_TEXT.sucheUngueltig }
        : gefunden === null
          ? null
          : suchErgebnis({ ...gefunden, adresse: suche.art === 'adresse' ? suche.adresse : null }, jetzt)

  const kacheln =
    zaehler && schlange && probleme && arten
      ? mailKacheln({ zaehler, schlange, probleme, arten, pause: KANN_WARTEN_PAUSE, tarif: `Resend ${TARIFE.resend === 'PRO' ? 'Pro' : 'Free'}` }, jetzt)
      : null
  const warnkarte =
    zaehler && schlange && arten && warnungen
      ? mailWarnkarte({ lage: mailWarnLage(schlange, summeArten(arten), jetzt), schlange, zaehler, arten }, warnungen, jetzt)
      : null
  const braucht = probleme ? brauchtDich(probleme, jetzt) : null
  const artenListe = arten ? jeArt(arten, alle) : null
  const verlauf = verlaufRoh ? mailVerlauf(verlaufRoh, jetzt) : null
  const schlangenKarte = schlange && lauf ? schlangeKarte(schlange, lauf.lauf, jetzt) : null

  const sucheKarte = (id: string, mitHilfe: boolean): React.JSX.Element => (
    <div className="flex flex-col gap-3">
      <SuchFeld id={id} wert={sucheRoh} mitHilfe={mitHilfe} />
      <SuchTreffer ergebnis={ergebnis} />
    </div>
  )
  const brauchtTeil = (anker: string): React.JSX.Element => (braucht ? <BrauchtDichListe zeilen={braucht.zeilen} gruppen={braucht.gruppen} anker={anker} /> : <TeilFehler />)
  const jeArtFuss = artenListe && (
    <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] leading-snug', LEISE)}>
      {alle ? (
        <a href={ADMIN_BETRIEB_MAILS_HREF} className={cn('inline-flex min-h-11 items-center rounded-md font-semibold text-status-fertig underline-offset-2 hover:underline', FOKUS_RAHMEN)}>
          {MAIL_TEXT.wenigerArten}
        </a>
      ) : (
        artenListe.zeilen.length > artenListe.gezeigt.length && (
          <a
            href={ADMIN_BETRIEB_MAILS_ALLE_ARTEN_HREF}
            className={cn('inline-flex min-h-11 items-center rounded-md font-semibold text-status-fertig underline-offset-2 hover:underline', FOKUS_RAHMEN)}
          >
            {MAIL_TEXT.alleArten(artenListe.zeilen.length)}
          </a>
        )
      )}
      {!alle && artenListe.ausgeblendet > 0 && <span>{MAIL_TEXT.ausgeblendet(artenListe.ausgeblendet)}</span>}
    </p>
  )
  const leerArten = <p className={cn('text-[13px]', LEISE)}>{MAIL_TEXT.jeArtLeer}</p>

  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-4 lg:gap-[18px]')}>
      <MinutenNachladen />
      <Seitenkopf
        titel={BETRIEB_TEXT.titel}
        satz={MAIL_TEXT.satz}
        rechts={
          <span className={cn('inline-flex items-center gap-1.5 text-[13px]', LEISE)}>
            <Clock className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            {MAIL_TEXT.stand(uhrzeitInWien(jetzt))}
          </span>
        }
      />
      <BetriebUnterreiter aktiv="mails" offen={braucht ? braucht.zeilen.length : null}>
        <div className="flex flex-col gap-4 lg:gap-[18px]">
          {/* Am Handy zuerst die Suche — für Anrufe (Mockup mobil-admin-betrieb-mails). */}
          <div className="lg:hidden">{sucheKarte('mails-suche-handy', true)}</div>

          {warnkarte && warnkarte.eintraege.length > 0 && (
            <Warnkarte
              eintraege={warnkarte.eintraege}
              gruen={warnkarte.gruen}
              aktionen={
                <>
                  {warnkarte.jetztSchicken && <MailKnoepfe auswahl={{ id: warnkarte.jetztSchicken }} jetzt={MAIL_TEXT.jetztSchicken} texte={KNOPF_TEXTE} />}
                  <a href={`#${ANKER.breit}`} className={cn(KNOPF_RAHMEN, 'hidden self-start font-semibold lg:inline-flex')}>
                    {MAIL_TEXT.ansehen}
                  </a>
                  <a href={`#${ANKER.handy}`} className={cn(KNOPF_RAHMEN, 'self-start font-semibold lg:hidden')}>
                    {MAIL_TEXT.ansehen}
                  </a>
                </>
              }
            />
          )}

          <div className="lg:hidden">{brauchtTeil(ANKER.handy)}</div>

          {kacheln ? <MailKacheln kacheln={kacheln} /> : <TeilFehler />}

          {/* Ab 1024 px: links Je Art, Verlauf, Warteschlange; rechts Suche und Braucht dich (Mockup admin-betrieb-mails). */}
          <div className="hidden gap-[18px] lg:grid lg:grid-cols-[minmax(0,1fr)_468px] lg:items-start">
            <div className="flex min-w-0 flex-col gap-[18px]">
              <Karte titel={MAIL_TEXT.jeArtTitel} zusatz={MAIL_TEXT.jeArtZusatz}>
                {artenListe === null ? <TeilFehler /> : artenListe.zeilen.length === 0 ? leerArten : <JeArtTabelle zeilen={artenListe.gezeigt} />}
                {jeArtFuss}
              </Karte>
              <Karte titel={MAIL_TEXT.verlaufTitel} zusatz={MAIL_TEXT.verlaufZusatz}>{verlauf ? <MailVerlaufBild verlauf={verlauf} /> : <TeilFehler />}</Karte>
              <Karte titel={MAIL_TEXT.schlangeTitel}>{schlangenKarte ? <SchlangeInhalt karte={schlangenKarte} /> : <TeilFehler />}</Karte>
            </div>
            <div className="flex min-w-0 flex-col gap-[18px]">
              <Karte titel={MAIL_TEXT.sucheTitel} zusatz={MAIL_TEXT.sucheZusatz}>
                {sucheKarte('mails-suche', false)}
              </Karte>
              {brauchtTeil(ANKER.breit)}
            </div>
          </div>

          {/* Am Handy: Je Art, Verlauf und Warteschlange zugeklappt. */}
          <div className="flex flex-col gap-3 lg:hidden">
            <Klappkarte titel={MAIL_TEXT.jeArtKurz} zeile={artenListe?.summe ?? MAIL_TEXT.ladefehler}>
              {artenListe === null ? <TeilFehler /> : artenListe.zeilen.length === 0 ? leerArten : <JeArtListe zeilen={artenListe.zeilen} />}
            </Klappkarte>
            <Klappkarte titel={MAIL_TEXT.verlaufKurz} zeile={verlauf?.satz ?? MAIL_TEXT.ladefehler}>
              {verlauf ? <MailVerlaufBild verlauf={verlauf} /> : <TeilFehler />}
            </Klappkarte>
            <Klappkarte titel={MAIL_TEXT.schlangeKurz} zeile={schlangenKarte?.kurz ?? MAIL_TEXT.ladefehler}>
              {schlangenKarte ? <SchlangeInhalt karte={schlangenKarte} /> : <TeilFehler />}
            </Klappkarte>
          </div>

          <p className={cn('text-[12.5px] leading-snug', LEISE)}>{MAIL_TEXT.regel}</p>
        </div>
      </BetriebUnterreiter>
    </div>
  )
}
