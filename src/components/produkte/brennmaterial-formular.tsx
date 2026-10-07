'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import { Stepper } from '@/components/ui/stepper'
import { DezimalFeld } from '@/components/shared/dezimal-feld'
import { legeBrennmaterialFamilieAn } from '@/server/actions/produktfamilie'
import { BRENN_ARTEN, brennmaterialFamilieSchema, type BrennmaterialFamilieEingabe } from '@/schemas/produktfamilie'
import { TROCKNUNG_VALUES, UNTERKATEGORIE_LABEL, type TrocknungValue } from '@/lib/taxonomie'
import {
  BRENN_GROESSEN_EINHEITEN,
  BRENN_VORLAGEN,
  BRENN_VORLAGEN_START,
  GELAGERT_JAHRE_MAX,
  GROESSEN_MAX,
  HOLZARTEN,
  KOERNUNG_KLASSEN,
  SCHEITLAENGEN_CM,
  TROCKNUNG_WAHL,
  WASSERGEHALT_KLASSEN,
  brennMengeText,
  einheitPasstZurArt,
  fehlerJeFeld,
  gespeichertText,
  raummassErklaeren,
  RESTFEUCHTE_JE_TROCKNUNG,
  type BrennArt,
  type BrennGroessenEinheit,
  type BrennVorlage,
} from '@/lib/verkaufsgroessen'
import { formatEuro, formatZahl, einheitLabel } from '@/lib/format'
import { VORRAT_MAX } from '@/lib/eingabegrenzen'
import { RaummassErklaerung } from '@/components/shared/raummass-erklaerung'
import {
  Abschnitt,
  EINGABE,
  EigeneGroesseKnopf,
  EntfernenKnopf,
  FamilienDialog,
  Feld,
  FeldFehler,
  Wahl,
  feldId,
  springeZuFeld,
} from './familien-teile'

/*
 * „Neues Brennmaterial" mit Verkaufsgrößen (Gate 6, Nachtlauf Nr. 20; Mockups
 * web-h2-neues-brennmaterial, mobil-h2-neues-brennmaterial; Register E3, E11).
 * Art (Brennholz, Anzündholz, Hackschnitzel), Holzart, Scheitlänge bzw. W/P,
 * Trocknung, Lagerung — die Fragen, die jeder Käufer stellt — und je Größe ein
 * Produkt der Familie (legeBrennmaterialFamilieAn). Keine Futtermittel-
 * Registrierung, also kein Schloss. Nur Abholung (E11).
 */

type Zeile = {
  schluessel: string
  vorlageId: string | null
  bezeichnung: string
  unit: BrennGroessenEinheit
  price: number | null
  stock: number
}

const EINHEIT_WAHL: Record<BrennGroessenEinheit, string> = { STUECK: 'Stück', RAUMMETER: 'Raummeter', SCHUETTRAUMMETER: 'Schüttraummeter' }

function zeileAus(vorlage: BrennVorlage, schluessel: string): Zeile {
  return { schluessel, vorlageId: vorlage.id, bezeichnung: vorlage.bezeichnung, unit: vorlage.unit, price: null, stock: 0 }
}

function startZeilen(art: BrennArt, schluessel: (i: number) => string): Zeile[] {
  return BRENN_VORLAGEN.filter((v) => BRENN_VORLAGEN_START[art].includes(v.id)).map((v, i) => zeileAus(v, schluessel(i)))
}

export function BrennmaterialFormular({ onClose }: { onClose: () => void }): React.JSX.Element {
  const naechster = useRef(100)
  const neuerSchluessel = () => `z${naechster.current++}`
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [art, setArt] = useState<BrennArt>('BRENNHOLZ_SCHEIT')
  const [holzart, setHolzart] = useState('')
  const [scheitlaengeCm, setScheitlaengeCm] = useState<number | null>(null)
  const [trocknung, setTrocknung] = useState<TrocknungValue>('OFENFERTIG')
  const [wassergehalt, setWassergehalt] = useState<number | null>(null)
  const [koernung, setKoernung] = useState<number | null>(null)
  const [gelagertJahre, setGelagertJahre] = useState<number | null>(null)
  const [ueberdacht, setUeberdacht] = useState(false)
  const [zeilen, setZeilen] = useState<Zeile[]>(() => startZeilen('BRENNHOLZ_SCHEIT', (i) => `s${i}`))
  const [versucht, setVersucht] = useState(false)
  const [speichert, setSpeichert] = useState(false)

  const eingabe: BrennmaterialFamilieEingabe = {
    name,
    description,
    art,
    holzart,
    scheitlaengeCm,
    trocknung,
    wassergehalt,
    koernung,
    gelagertJahre,
    ueberdacht,
    groessen: zeilen.map(({ bezeichnung, unit, price, stock }) => ({ bezeichnung, unit, price: price ?? undefined, stock })),
  }
  const pruefung = brennmaterialFamilieSchema.safeParse(eingabe)
  const fehler = versucht && !pruefung.success ? fehlerJeFeld(pruefung.error.issues) : {}
  const hackschnitzel = art === 'HACKSCHNITZEL'

  function artWaehlen(neu: BrennArt) {
    if (neu === art) return
    setArt(neu)
    setZeilen((alt) => {
      // Was zur neuen Art nicht passt (Raummeter bei Hackschnitzeln), fällt weg;
      // bleibt nichts übrig, kommen die Vorlagen der Art.
      const passend = alt.filter((z) => einheitPasstZurArt(neu, z.unit))
      return passend.length > 0 ? passend : startZeilen(neu, () => neuerSchluessel())
    })
  }

  function vorlageUmschalten(vorlage: BrennVorlage) {
    setZeilen((alt) =>
      alt.some((z) => z.vorlageId === vorlage.id)
        ? alt.filter((z) => z.vorlageId !== vorlage.id)
        : alt.length >= GROESSEN_MAX
          ? alt
          : [...alt, zeileAus(vorlage, neuerSchluessel())]
    )
  }

  function zeileAendern(schluessel: string, teil: Partial<Zeile>) {
    setZeilen((alt) => alt.map((z) => (z.schluessel === schluessel ? { ...z, ...teil } : z)))
  }

  async function speichern() {
    setVersucht(true)
    if (!pruefung.success) {
      toast.error('Bitte prüfe die markierten Felder.')
      springeZuFeld(Object.keys(fehlerJeFeld(pruefung.error.issues))[0])
      return
    }
    setSpeichert(true)
    try {
      const ergebnis = await legeBrennmaterialFamilieAn(eingabe)
      if ('error' in ergebnis) {
        toast.error(ergebnis.error)
        return
      }
      toast.success(gespeichertText(name, ergebnis.online, ergebnis.wartend.length))
      onClose()
    } catch {
      toast.error('Wir konnten das Brennmaterial nicht speichern. Bitte versuch es noch einmal.')
    } finally {
      setSpeichert(false)
    }
  }

  const vorlagen = BRENN_VORLAGEN.filter((v) => einheitPasstZurArt(art, v.unit))
  const restfeuchte = RESTFEUCHTE_JE_TROCKNUNG[trocknung]
  const vorschauZeile = [
    !hackschnitzel && scheitlaengeCm !== null ? `${formatZahl(scheitlaengeCm)} cm` : null,
    hackschnitzel && wassergehalt !== null ? `W${wassergehalt}` : null,
    hackschnitzel && koernung !== null ? `P${koernung}` : null,
    restfeuchte !== null ? `unter ${formatZahl(restfeuchte)} % Restfeuchte` : 'frisch',
    zeilen.length === 1 ? '1 Größe' : `${formatZahl(zeilen.length)} Größen`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <FamilienDialog
      open
      onClose={onClose}
      titel="Neues Brennmaterial"
      satz="Brennholz, Anzündholz oder Hackschnitzel – jede Größe mit eigenem Preis und Vorrat. Nur Abholung am Hof."
      speichernText="Speichern"
      speichert={speichert}
      onSpeichern={() => void speichern()}
    >
      <Feld feld="name" label="Name" fehler={fehler.name} hilfe="Jede Größe heißt im Shop „Name + Größe“, z. B. „Buche, ofenfertig Raummeter“.">
        <input
          id={feldId('name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Buche, ofenfertig"
          autoComplete="off"
          aria-invalid={fehler.name ? true : undefined}
          className={EINGABE}
        />
      </Feld>

      <Abschnitt id="brenn-angaben" titel="Holz-Angaben" satz="Die drei Fragen, die jeder Käufer stellt.">
        <div className="flex flex-col gap-2" data-feld="art">
          <p id="brenn-art" className="text-[13px] font-medium text-foreground">
            Art
          </p>
          <div role="radiogroup" aria-labelledby="brenn-art" className="flex flex-wrap gap-2">
            {BRENN_ARTEN.map((a) => (
              <Wahl key={a} rolle="radio" aktiv={art === a} onClick={() => artWaehlen(a)}>
                {UNTERKATEGORIE_LABEL[a]}
              </Wahl>
            ))}
          </div>
          {hackschnitzel && (
            <p className="text-xs leading-snug text-muted-foreground">
              Bei Hackschnitzeln fragen wir statt Scheitlänge den Wassergehalt (W20 bis W35) und die Körnung (P16, P31, P45). Verkauft wird pro
              Schüttraummeter.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2" data-feld="holzart">
          <p id="brenn-holzart" className="text-[13px] font-medium text-foreground">
            Holzart
          </p>
          <div role="radiogroup" aria-labelledby="brenn-holzart" className="flex flex-wrap gap-2">
            {HOLZARTEN.map((h) => (
              <Wahl key={h} rolle="radio" aktiv={holzart === h} onClick={() => setHolzart(h)}>
                {h}
              </Wahl>
            ))}
          </div>
          <label htmlFor={feldId('holzart')} className="text-xs text-muted-foreground">
            Andere Holzart
          </label>
          <input
            id={feldId('holzart')}
            value={holzart}
            onChange={(e) => setHolzart(e.target.value)}
            placeholder="z. B. Esche"
            autoComplete="off"
            className={EINGABE}
          />
          {fehler.holzart && <FeldFehler>{fehler.holzart}</FeldFehler>}
        </div>

        {!hackschnitzel ? (
          <div className="flex flex-col gap-2" data-feld="scheitlaengeCm">
            <p id="brenn-scheit" className="text-[13px] font-medium text-foreground">
              Scheitlänge{art === 'ANZUENDHOLZ' ? ' (freiwillig)' : ''}
            </p>
            <div role="radiogroup" aria-labelledby="brenn-scheit" className="flex flex-wrap gap-2">
              {SCHEITLAENGEN_CM.map((cm) => (
                <Wahl key={cm} rolle="radio" aktiv={scheitlaengeCm === cm} onClick={() => setScheitlaengeCm(scheitlaengeCm === cm ? null : cm)}>
                  {cm === 100 ? '1 m' : `${cm} cm`}
                </Wahl>
              ))}
            </div>
            {fehler.scheitlaengeCm && <FeldFehler>{fehler.scheitlaengeCm}</FeldFehler>}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2" data-feld="wassergehalt">
              <p id="brenn-w" className="text-[13px] font-medium text-foreground">
                Wassergehalt
              </p>
              <div role="radiogroup" aria-labelledby="brenn-w" className="flex flex-wrap gap-2">
                {WASSERGEHALT_KLASSEN.map((w) => (
                  <Wahl key={w} rolle="radio" aktiv={wassergehalt === w} onClick={() => setWassergehalt(w)}>
                    W{w}
                  </Wahl>
                ))}
              </div>
              {fehler.wassergehalt && <FeldFehler>{fehler.wassergehalt}</FeldFehler>}
            </div>
            <div className="flex flex-col gap-2" data-feld="koernung">
              <p id="brenn-p" className="text-[13px] font-medium text-foreground">
                Körnung
              </p>
              <div role="radiogroup" aria-labelledby="brenn-p" className="flex flex-wrap gap-2">
                {KOERNUNG_KLASSEN.map((p) => (
                  <Wahl key={p} rolle="radio" aktiv={koernung === p} onClick={() => setKoernung(p)}>
                    P{p}
                  </Wahl>
                ))}
              </div>
              {fehler.koernung && <FeldFehler>{fehler.koernung}</FeldFehler>}
            </div>
          </>
        )}

        <div className="flex flex-col gap-2" data-feld="trocknung">
          <p id="brenn-trocknung" className="text-[13px] font-medium text-foreground">
            Trocknung
          </p>
          <div role="radiogroup" aria-labelledby="brenn-trocknung" className="flex flex-wrap gap-2">
            {TROCKNUNG_VALUES.map((t) => (
              <Wahl key={t} rolle="radio" aktiv={trocknung === t} onClick={() => setTrocknung(t)}>
                {TROCKNUNG_WAHL[t]}
              </Wahl>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Feld feld="gelagertJahre" label="Gelagert seit (freiwillig)" fehler={fehler.gelagertJahre}>
            <select
              id={feldId('gelagertJahre')}
              value={gelagertJahre ?? ''}
              onChange={(e) => setGelagertJahre(e.target.value === '' ? null : Number(e.target.value))}
              className={EINGABE}
            >
              <option value="">Keine Angabe</option>
              {Array.from({ length: GELAGERT_JAHRE_MAX + 1 }, (_, j) => (
                <option key={j} value={j}>
                  {j === 0 ? 'diesem Jahr' : j === 1 ? '1 Jahr' : `${j} Jahren`}
                </option>
              ))}
            </select>
          </Feld>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-foreground" aria-hidden="true">
              Lagerung
            </span>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3">
              <input type="checkbox" checked={ueberdacht} onChange={(e) => setUeberdacht(e.target.checked)} className="size-4 shrink-0 accent-primary" />
              <span className="text-sm text-foreground">überdacht gelagert</span>
            </label>
          </div>
        </div>
      </Abschnitt>

      <Feld feld="description" label="Beschreibung (freiwillig)" fehler={fehler.description}>
        <Textarea
          id={feldId('description')}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="z. B. Aus unserem eigenen Wald, gespalten und luftgetrocknet."
        />
      </Feld>

      <Abschnitt id="brenn-groessen" titel="Verkaufsgrößen" satz="Jede Größe mit eigenem Preis und Vorrat.">
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="brenn-groessen" data-feld="groessen">
          {vorlagen.map((v) => {
            const aktiv = zeilen.some((z) => z.vorlageId === v.id)
            return (
              <Wahl key={v.id} aktiv={aktiv} onClick={() => vorlageUmschalten(v)} disabled={!aktiv && zeilen.length >= GROESSEN_MAX}>
                {v.bezeichnung}
              </Wahl>
            )
          })}
          <EigeneGroesseKnopf
            onClick={() =>
              setZeilen((alt) =>
                alt.length >= GROESSEN_MAX
                  ? alt
                  : [...alt, { schluessel: neuerSchluessel(), vorlageId: null, bezeichnung: '', unit: hackschnitzel ? 'SCHUETTRAUMMETER' : 'STUECK', price: null, stock: 0 }]
              )
            }
            disabled={zeilen.length >= GROESSEN_MAX}
          />
        </div>
        {fehler.groessen && <FeldFehler>{fehler.groessen}</FeldFehler>}

        <ul className="flex flex-col gap-2.5">
          {zeilen.map((z, i) => {
            const pfad = `groessen.${i}`
            return (
              <li key={z.schluessel} className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Feld feld={`${pfad}.bezeichnung`} label="Größe" fehler={fehler[`${pfad}.bezeichnung`]}>
                      <input
                        id={feldId(`${pfad}.bezeichnung`)}
                        value={z.bezeichnung}
                        onChange={(e) => zeileAendern(z.schluessel, { bezeichnung: e.target.value })}
                        placeholder="z. B. Gitterbox"
                        autoComplete="off"
                        className={EINGABE}
                      />
                    </Feld>
                  </div>
                  <p className="flex h-11 shrink-0 items-center text-[12.5px] text-muted-foreground">{brennMengeText(z.unit)}</p>
                  <EntfernenKnopf name={z.bezeichnung} onClick={() => setZeilen((alt) => alt.filter((x) => x.schluessel !== z.schluessel))} />
                </div>

                {z.vorlageId === null && (
                  <div className="flex flex-col gap-1.5" data-feld={`${pfad}.unit`}>
                    <div role="radiogroup" aria-label={`Verkauft je … ${z.bezeichnung || 'eigene Größe'}`} className="flex flex-wrap gap-2">
                      {BRENN_GROESSEN_EINHEITEN.filter((u) => einheitPasstZurArt(art, u)).map((u) => (
                        <Wahl key={u} rolle="radio" aktiv={z.unit === u} onClick={() => zeileAendern(z.schluessel, { unit: u })}>
                          {EINHEIT_WAHL[u]}
                        </Wahl>
                      ))}
                    </div>
                    {fehler[`${pfad}.unit`] && <FeldFehler>{fehler[`${pfad}.unit`]}</FeldFehler>}
                  </div>
                )}

                <div className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Feld feld={`${pfad}.price`} label={`Preis je ${einheitLabel(z.unit)}`} fehler={fehler[`${pfad}.price`]}>
                    <DezimalFeld id={feldId(`${pfad}.price`)} value={z.price} praefix="€" stellen={2} onChange={(w) => zeileAendern(z.schluessel, { price: w })} />
                  </Feld>
                  <div className="flex flex-col gap-1.5" data-feld={`${pfad}.stock`}>
                    <span className="text-[13px] font-medium text-foreground" aria-hidden="true">
                      Vorrat
                    </span>
                    <Stepper
                      beschriftung={`Vorrat ${z.bezeichnung || 'neue Größe'}`}
                      wert={z.stock}
                      min={0}
                      max={VORRAT_MAX}
                      onWertChange={(w) => zeileAendern(z.schluessel, { stock: w })}
                      eingabeClassName="w-14"
                    />
                    {fehler[`${pfad}.stock`] && <FeldFehler>{fehler[`${pfad}.stock`]}</FeldFehler>}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {raummassErklaeren(zeilen.map((z) => z.unit)) && <RaummassErklaerung />}
      </Abschnitt>

      <p className="text-[12.5px] leading-snug text-muted-foreground">
        Für Holz brauchst du keine Futtermittel-Registrierung. Den Mehrwertsteuersatz bitte mit deinem Steuerberater abklären.
      </p>

      <section aria-labelledby="brenn-vorschau" className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-4">
        <h3 id="brenn-vorschau" className="text-[11px] font-semibold tracking-[1px] text-muted-foreground uppercase">
          So sehen Käufer dein Holz
        </h3>
        <p className="font-heading text-lg font-semibold break-words text-foreground">{name.trim() || 'Dein Brennmaterial'}</p>
        <p className="text-xs text-muted-foreground">{vorschauZeile}</p>
        {zeilen.some((z) => z.price !== null) && (
          <ul className="flex flex-wrap gap-1.5">
            {zeilen
              .filter((z) => z.price !== null)
              .map((z) => (
                <li key={z.schluessel} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs break-words text-foreground tabular-nums">
                  {z.bezeichnung || EINHEIT_WAHL[z.unit]} · {formatEuro(z.price ?? 0)}
                </li>
              ))}
          </ul>
        )}
      </section>
    </FamilienDialog>
  )
}
