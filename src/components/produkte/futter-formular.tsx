'use client'

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ShieldCheck } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Stepper } from '@/components/ui/stepper'
import { DezimalFeld } from '@/components/shared/dezimal-feld'
import { legeFutterFamilieAn } from '@/server/actions/produktfamilie'
import type { ProduktAngelegt } from '@/lib/produkte-hof'
import { FUTTER_KATEGORIEN, futterFamilieSchema, type FutterFamilieEingabe } from '@/schemas/produktfamilie'
import {
  FUTTERMITTELART_ERKLAERUNG,
  FUTTERMITTELART_LABEL,
  KATEGORIE_LABEL,
  TIERART_LABEL,
  TIERART_VALUES,
  UNTERKATEGORIE_LABEL,
  futtermittelartSatz,
  futtermittelartenFuer,
  unterkategorienVon,
  type FuttermittelartValue,
  type ProductSubcategoryValue,
  type TierartValue,
} from '@/lib/taxonomie'
import {
  FUTTER_BESTAETIGUNG_TEXT,
  gebindeSperre,
  speichernHinweis,
  type HofRegistrierung,
  type VerpackungValue,
} from '@/lib/futter-registrierung'
import {
  FUTTER_GROESSEN_EINHEITEN,
  FUTTER_VORLAGEN,
  FUTTER_VORLAGEN_START,
  GROESSEN_MAX,
  VERPACKUNG_LABEL,
  fehlerJeFeld,
  gespeichertText,
  gewichtUngefaehr,
  grundpreisVorschau,
  type FutterGroessenEinheit,
  type FutterVorlage,
} from '@/lib/verkaufsgroessen'
import { formatEuro, formatGrundpreisNetto, formatZahl, einheitLabel } from '@/lib/format'
import { VORRAT_MAX } from '@/lib/eingabegrenzen'
import { futterSchild } from '@/lib/produktdetail'
import { zusammensetzungVorbelegung } from '@/components/products/produkt-abschnitte'
import { cn } from '@/lib/utils'
import {
  Abschnitt,
  EINGABE,
  EigeneGroesseKnopf,
  EntfernenKnopf,
  FamilienDialog,
  Feld,
  FeldFehler,
  SperrZeile,
  Wahl,
  feldId,
  springeZuFeld,
} from './familien-teile'
import { FutterRegistrierungen } from './futter-registrierungen'

/*
 * „Neues Futtermittel" mit Verkaufsgrößen (Gate 6, Nachtlauf Nr. 20; Mockups
 * web-h2-neues-futter, mobil-h2-neues-futter-meldung-fehlt; Register E3, E9,
 * E10). Je Größe entsteht ein Produkt der Familie mit eigener Kennzeichnung
 * und eigenem Vorrat (legeFutterFamilieAn). Das Formular zeigt an jeder Größe
 * das Schloss, das der Server beim Speichern genauso entscheidet (S7) — mit
 * dem Stand des Hofs beim Öffnen; verbindlich ist der beim Speichern.
 *
 * Geprüft wird mit demselben Schema wie auf dem Server (futterFamilieSchema):
 * nach dem ersten Speichern-Versuch stehen die Meldungen live an den Feldern.
 */

type Zeile = {
  schluessel: string
  vorlageId: string | null
  bezeichnung: string
  verpackung: VerpackungValue
  unit: FutterGroessenEinheit
  nettoMenge: number | null
  price: number | null
  stock: number
}

type Kennzeichnung = FutterFamilieEingabe['kennzeichnung']

const KENNZEICHNUNG_LEER: Kennzeichnung = {
  futtermittelart: 'EINZELFUTTERMITTEL',
  zielTierarten: [],
  zusammensetzung: '',
  analytischeBestandteile: '',
  rohprotein: null,
  rohfaser: null,
  rohfett: null,
  rohasche: null,
  zusatzstoffe: '',
  gebrauchshinweis: '',
  bestaetigt: false,
}

const EINHEIT_WAHL: Record<FutterGroessenEinheit, string> = { STUECK: 'Stück', BALLEN: 'Ballen', BIGBAG: 'Big Bag' }

function zeileAus(vorlage: FutterVorlage, schluessel: string): Zeile {
  return {
    schluessel,
    vorlageId: vorlage.id,
    bezeichnung: vorlage.bezeichnung,
    verpackung: vorlage.verpackung,
    unit: vorlage.unit,
    nettoMenge: vorlage.nettoMenge,
    price: null,
    stock: 0,
  }
}

/** Bei genau einer erlaubten Futtermittelart steht sie fest (Tabelle 2.4). */
function artFuer(kategorie: (typeof FUTTER_KATEGORIEN)[number]): FuttermittelartValue | null {
  const erlaubt = futtermittelartenFuer(kategorie)
  return erlaubt.length === 1 ? erlaubt[0] : null
}

export function FutterFormular({
  onClose,
  registrierung,
  onAngelegt,
}: {
  onClose: () => void
  registrierung: HofRegistrierung
  /** Nach dem Anlegen: Anlass des Teilen-Moments „gespeichert" (Nr. 30); ob er kommt, entscheidet die Ansicht. */
  onAngelegt?: (angelegt: ProduktAngelegt) => void
}): React.JSX.Element {
  const naechster = useRef(0)
  const neuerSchluessel = () => `z${naechster.current++}`
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<(typeof FUTTER_KATEGORIEN)[number]>('HEU_STROH')
  const [subcategory, setSubcategory] = useState<ProductSubcategoryValue | null>(null)
  const [bio, setBio] = useState(false)
  const [nurBetriebe, setNurBetriebe] = useState(false)
  const [kennzeichnung, setKennzeichnung] = useState<Kennzeichnung>(KENNZEICHNUNG_LEER)
  const [zeilen, setZeilen] = useState<Zeile[]>(() =>
    FUTTER_VORLAGEN.filter((v) => FUTTER_VORLAGEN_START.includes(v.id)).map((v, i) => zeileAus(v, `s${i}`))
  )
  const [versucht, setVersucht] = useState(false)
  const [speichert, setSpeichert] = useState(false)

  const eingabe: FutterFamilieEingabe = {
    name,
    description,
    category,
    subcategory,
    bio,
    abgabe: nurBetriebe ? 'NUR_BETRIEBE' : 'ALLE',
    kennzeichnung,
    groessen: zeilen.map(({ bezeichnung, verpackung, unit, nettoMenge, price, stock }) => ({
      bezeichnung,
      verpackung,
      unit,
      nettoMenge: nettoMenge ?? undefined,
      price: price ?? undefined,
      stock,
    })),
  }
  const pruefung = futterFamilieSchema.safeParse(eingabe)
  const fehler = versucht && !pruefung.success ? fehlerJeFeld(pruefung.error.issues) : {}

  const sperren = zeilen.map((z) => gebindeSperre({ category, verpackung: z.verpackung }, registrierung))
  const wartend = sperren.filter(Boolean).length
  const erlaubteArten = futtermittelartenFuer(category)
  const sorten = unterkategorienVon(category)

  function kennzeichnungSetzen(teil: Partial<Kennzeichnung>) {
    setKennzeichnung((k) => ({ ...k, ...teil }))
  }

  function kategorieWaehlen(neu: (typeof FUTTER_KATEGORIEN)[number]) {
    if (neu === category) return
    setCategory(neu)
    setSubcategory(null)
    kennzeichnungSetzen({
      futtermittelart: artFuer(neu),
      zusammensetzung: zusammensetzungVorbelegung(kennzeichnung.zusammensetzung, subcategory, null),
    })
  }

  function sorteWaehlen(neu: ProductSubcategoryValue) {
    kennzeichnungSetzen({ zusammensetzung: zusammensetzungVorbelegung(kennzeichnung.zusammensetzung, subcategory, neu) })
    setSubcategory(neu)
  }

  function vorlageUmschalten(vorlage: FutterVorlage) {
    setZeilen((alt) =>
      alt.some((z) => z.vorlageId === vorlage.id)
        ? alt.filter((z) => z.vorlageId !== vorlage.id)
        : alt.length >= GROESSEN_MAX
          ? alt
          : [...alt, zeileAus(vorlage, neuerSchluessel())]
    )
  }

  function eigeneGroesse() {
    setZeilen((alt) =>
      alt.length >= GROESSEN_MAX
        ? alt
        : [
            ...alt,
            {
              schluessel: neuerSchluessel(),
              vorlageId: null,
              bezeichnung: '',
              verpackung: 'LOSE_BALLEN',
              unit: 'STUECK',
              nettoMenge: null,
              price: null,
              stock: 0,
            },
          ]
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
      const ergebnis = await legeFutterFamilieAn(eingabe)
      if ('error' in ergebnis) {
        toast.error(ergebnis.error)
        return
      }
      toast.success(gespeichertText(name, ergebnis.online, ergebnis.wartend.length))
      onClose()
      onAngelegt?.({ anlass: ergebnis.familieId, name: name.trim(), online: ergebnis.online > 0 })
    } catch {
      toast.error('Wir konnten das Futter nicht speichern. Bitte versuch es noch einmal.')
    } finally {
      setSpeichert(false)
    }
  }

  return (
    <FamilienDialog
      open
      onClose={onClose}
      titel="Neues Futtermittel"
      satz="Vom Sackerl für den Hasen bis zum Rundballen – jede Größe mit eigenem Preis und Vorrat."
      hinweis={speichernHinweis(zeilen.length - wartend, wartend)}
      speichernText="Futter speichern"
      speichert={speichert}
      onSpeichern={() => void speichern()}
    >
      <Feld feld="name" label="Name" fehler={fehler.name} hilfe="Jede Größe heißt im Shop „Name + Größe“, z. B. „Bergwiesen-Heu 5 kg-Sack“.">
        <input
          id={feldId('name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Bergwiesen-Heu"
          autoComplete="off"
          aria-invalid={fehler.name ? true : undefined}
          className={EINGABE}
        />
      </Feld>

      <div className="flex flex-col gap-2" data-feld="category">
        <p id="futter-kategorie" className="text-[13px] font-medium text-foreground">
          Kategorie
        </p>
        <div role="radiogroup" aria-labelledby="futter-kategorie" className="flex flex-wrap gap-2">
          {FUTTER_KATEGORIEN.map((k) => (
            <Wahl key={k} rolle="radio" aktiv={category === k} onClick={() => kategorieWaehlen(k)}>
              {KATEGORIE_LABEL[k]}
            </Wahl>
          ))}
        </div>
      </div>

      {sorten.length > 0 && (
        <div className="flex flex-col gap-2" data-feld="subcategory">
          <p id="futter-sorte" className="text-[13px] font-medium text-foreground">
            Sorte
          </p>
          <div role="radiogroup" aria-labelledby="futter-sorte" className="flex flex-wrap gap-2">
            {sorten.map((l2) => (
              <Wahl key={l2} rolle="radio" aktiv={subcategory === l2} onClick={() => sorteWaehlen(l2)}>
                {UNTERKATEGORIE_LABEL[l2]}
              </Wahl>
            ))}
          </div>
          {fehler.subcategory && <FeldFehler>{fehler.subcategory}</FeldFehler>}
        </div>
      )}

      <Feld feld="description" label="Beschreibung (freiwillig)" fehler={fehler.description}>
        <Textarea
          id={feldId('description')}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="z. B. Erster Schnitt von unseren Bergwiesen, luftig getrocknet."
        />
      </Feld>

      <Abschnitt id="futter-groessen" titel="Verkaufsgrößen" satz="Tipp an, was du abgibst – vom Sackerl für den Hasen bis zum Rundballen.">
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="futter-groessen" data-feld="groessen">
          {FUTTER_VORLAGEN.map((v) => {
            const aktiv = zeilen.some((z) => z.vorlageId === v.id)
            return (
              <Wahl key={v.id} aktiv={aktiv} onClick={() => vorlageUmschalten(v)} disabled={!aktiv && zeilen.length >= GROESSEN_MAX}>
                {v.bezeichnung}
              </Wahl>
            )
          })}
          <EigeneGroesseKnopf onClick={eigeneGroesse} disabled={zeilen.length >= GROESSEN_MAX} />
        </div>
        {fehler.groessen && <FeldFehler>{fehler.groessen}</FeldFehler>}

        <ul className="flex flex-col gap-2.5">
          {zeilen.map((z, i) => {
            const pfad = `groessen.${i}`
            const kilo = grundpreisVorschau(z.price, z.nettoMenge)
            return (
              <li key={z.schluessel} className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Feld feld={`${pfad}.bezeichnung`} labelZusatz={z.bezeichnung || 'neue Größe'} label="Größe" fehler={fehler[`${pfad}.bezeichnung`]}>
                      <input
                        id={feldId(`${pfad}.bezeichnung`)}
                        value={z.bezeichnung}
                        onChange={(e) => zeileAendern(z.schluessel, { bezeichnung: e.target.value })}
                        placeholder="z. B. 25 kg-Sack"
                        autoComplete="off"
                        className={EINGABE}
                      />
                    </Feld>
                  </div>
                  <p className="flex h-11 shrink-0 items-center text-[12.5px] text-muted-foreground tabular-nums" aria-live="polite">
                    {kilo ?? '€ – / kg'}
                  </p>
                  <EntfernenKnopf name={z.bezeichnung} onClick={() => setZeilen((alt) => alt.filter((x) => x.schluessel !== z.schluessel))} />
                </div>

                {z.vorlageId === null && (
                  <div className="flex flex-col gap-2">
                    <div role="radiogroup" aria-label={`Verpackung ${z.bezeichnung || 'eigene Größe'}`} className="flex flex-wrap gap-2">
                      {(['LOSE_BALLEN', 'ABGEPACKT_ETIKETT'] as const).map((v) => (
                        <Wahl key={v} rolle="radio" aktiv={z.verpackung === v} onClick={() => zeileAendern(z.schluessel, { verpackung: v })}>
                          {VERPACKUNG_LABEL[v]}
                        </Wahl>
                      ))}
                    </div>
                    <div role="radiogroup" aria-label={`Gezählt in ${z.bezeichnung || 'eigene Größe'}`} className="flex flex-wrap gap-2">
                      {FUTTER_GROESSEN_EINHEITEN.map((u) => (
                        <Wahl key={u} rolle="radio" aktiv={z.unit === u} onClick={() => zeileAendern(z.schluessel, { unit: u })}>
                          {EINHEIT_WAHL[u]}
                        </Wahl>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 items-start gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Feld
                    feld={`${pfad}.nettoMenge`} labelZusatz={z.bezeichnung || 'neue Größe'}
                    label={gewichtUngefaehr(z.unit) ? 'Gewicht (ca.)' : 'Gewicht'}
                    fehler={fehler[`${pfad}.nettoMenge`]}
                  >
                    <DezimalFeld id={feldId(`${pfad}.nettoMenge`)} value={z.nettoMenge} suffix="kg" onChange={(w) => zeileAendern(z.schluessel, { nettoMenge: w })} />
                  </Feld>
                  <Feld feld={`${pfad}.price`} labelZusatz={z.bezeichnung || 'neue Größe'} label="Preis" fehler={fehler[`${pfad}.price`]}>
                    <DezimalFeld id={feldId(`${pfad}.price`)} value={z.price} praefix="€" stellen={2} onChange={(w) => zeileAendern(z.schluessel, { price: w })} />
                  </Feld>
                  <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1" data-feld={`${pfad}.stock`}>
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

                {sperren[i] && <SperrZeile grund={sperren[i].grund} />}
              </li>
            )
          })}
        </ul>
        <p className="text-[12.5px] leading-snug text-muted-foreground">
          € / kg rechnet sich automatisch und wird Käufern zum Vergleichen gezeigt. Sackerl und Säcke gelten als abgepacktes Heimtierfutter,
          Ballen als lose Ernte – siehe Registrierungen unten. Jede Größe hat ihren eigenen Vorrat.
        </p>
      </Abschnitt>

      <Abschnitt id="futter-hinweise" titel="Hinweise für Käufer">
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="futter-hinweise">
          <Wahl aktiv={bio} onClick={() => setBio((b) => !b)}>
            Bio
          </Wahl>
          <Wahl aktiv={nurBetriebe} onClick={() => setNurBetriebe((n) => !n)}>
            Nur an landwirtschaftliche Betriebe
          </Wahl>
        </div>
        {nurBetriebe && <p className="text-xs text-muted-foreground">Wer bestellt, muss im Checkout eine Betriebsnummer angeben.</p>}
      </Abschnitt>

      <Abschnitt
        id="futter-kennzeichnung"
        titel="Kennzeichnung"
        satz="Alle Angaben findest du auf dem Sackanhänger oder Lieferschein deines Futters. Sie gelten für alle Größen; das Gewicht steht je Größe oben."
      >
        <div className="flex flex-col gap-2" data-feld="kennzeichnung.futtermittelart">
          <p id="futter-art" className="text-[13px] font-medium text-foreground">
            Futtermittelart
          </p>
          {erlaubteArten.length === 1 ? (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <p className="text-sm font-medium text-foreground">{FUTTERMITTELART_LABEL[erlaubteArten[0]]}</p>
              <p className="text-xs text-muted-foreground">{futtermittelartSatz(category)}</p>
            </div>
          ) : (
            <>
              <div role="radiogroup" aria-labelledby="futter-art" className="flex flex-wrap gap-2">
                {erlaubteArten.map((art) => (
                  <Wahl key={art} rolle="radio" aktiv={kennzeichnung.futtermittelart === art} onClick={() => kennzeichnungSetzen({ futtermittelart: art })}>
                    {FUTTERMITTELART_LABEL[art]}
                  </Wahl>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {kennzeichnung.futtermittelart
                  ? FUTTERMITTELART_ERKLAERUNG[kennzeichnung.futtermittelart as FuttermittelartValue]
                  : 'Steht auf dem Sackanhänger, meist direkt über der Zusammensetzung.'}
              </p>
            </>
          )}
          {fehler['kennzeichnung.futtermittelart'] && <FeldFehler>{fehler['kennzeichnung.futtermittelart']}</FeldFehler>}
        </div>

        <div className="flex flex-col gap-2" data-feld="kennzeichnung.zielTierarten">
          <p id="futter-tiere" className="text-[13px] font-medium text-foreground">
            Für welche Tiere?
          </p>
          <div role="group" aria-labelledby="futter-tiere" className="flex flex-wrap gap-2">
            {TIERART_VALUES.map((t: TierartValue) => {
              const aktiv = (kennzeichnung.zielTierarten ?? []).includes(t)
              return (
                <Wahl
                  key={t}
                  aktiv={aktiv}
                  onClick={() =>
                    kennzeichnungSetzen({
                      zielTierarten: aktiv ? kennzeichnung.zielTierarten.filter((x) => x !== t) : [...kennzeichnung.zielTierarten, t],
                    })
                  }
                >
                  {TIERART_LABEL[t]}
                </Wahl>
              )
            })}
          </div>
          {fehler['kennzeichnung.zielTierarten'] && <FeldFehler>{fehler['kennzeichnung.zielTierarten']}</FeldFehler>}
        </div>

        <Feld
          feld="kennzeichnung.zusammensetzung"
          label="Zusammensetzung"
          hilfe="Steht auf dem Sackanhänger. Bei Mischfutter die Einzelfuttermittel in absteigender Reihenfolge."
          fehler={fehler['kennzeichnung.zusammensetzung']}
        >
          <Textarea
            id={feldId('kennzeichnung.zusammensetzung')}
            rows={2}
            value={kennzeichnung.zusammensetzung}
            onChange={(e) => kennzeichnungSetzen({ zusammensetzung: e.target.value })}
            placeholder="z. B. Heu vom ersten Schnitt, Wiesenmischung"
          />
        </Feld>
        <Feld
          feld="kennzeichnung.analytischeBestandteile"
          label="Analytische Bestandteile"
          hilfe="Steht auf dem Sackanhänger unter „Analytische Bestandteile“ (Rohprotein, Rohfaser, Rohfett, Rohasche …)."
          fehler={fehler['kennzeichnung.analytischeBestandteile']}
        >
          <Textarea
            id={feldId('kennzeichnung.analytischeBestandteile')}
            rows={2}
            value={kennzeichnung.analytischeBestandteile}
            onChange={(e) => kennzeichnungSetzen({ analytischeBestandteile: e.target.value })}
            placeholder="z. B. Rohprotein 9 %, Rohfaser 28 %, Rohasche 7 %"
          />
        </Feld>
        <Feld
          feld="kennzeichnung.zusatzstoffe"
          label="Zusatzstoffe (freiwillig)"
          hilfe="Nur wenn auf dem Anhänger welche stehen — bei reinem Heu bleibt das leer."
          fehler={fehler['kennzeichnung.zusatzstoffe']}
        >
          <Textarea
            id={feldId('kennzeichnung.zusatzstoffe')}
            rows={2}
            value={kennzeichnung.zusatzstoffe ?? ''}
            onChange={(e) => kennzeichnungSetzen({ zusatzstoffe: e.target.value })}
          />
        </Feld>
        <Feld
          feld="kennzeichnung.gebrauchshinweis"
          label="Gebrauchshinweis (freiwillig)"
          hilfe="Fütterungsempfehlung oder Lagerhinweis vom Anhänger, falls vorhanden."
          fehler={fehler['kennzeichnung.gebrauchshinweis']}
        >
          <Textarea
            id={feldId('kennzeichnung.gebrauchshinweis')}
            rows={2}
            value={kennzeichnung.gebrauchshinweis ?? ''}
            onChange={(e) => kennzeichnungSetzen({ gebrauchshinweis: e.target.value })}
          />
        </Feld>
        <div data-feld="kennzeichnung.bestaetigt" className="flex flex-col gap-1.5">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
            <input
              id={feldId('kennzeichnung.bestaetigt')}
              type="checkbox"
              checked={kennzeichnung.bestaetigt}
              onChange={(e) => kennzeichnungSetzen({ bestaetigt: e.target.checked })}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="text-sm text-foreground">{FUTTER_BESTAETIGUNG_TEXT}</span>
          </label>
          {fehler['kennzeichnung.bestaetigt'] && <FeldFehler>{fehler['kennzeichnung.bestaetigt']}</FeldFehler>}
        </div>
      </Abschnitt>

      <Abschnitt
        id="futter-registrierungen"
        titel="Deine Futtermittel-Registrierungen"
        satz="Einmal pro Hof einstellen. Davon hängt ab, welches Futter und welche Größen du anbieten kannst."
      >
        <FutterRegistrierungen registrierung={registrierung} />
      </Abschnitt>

      <KaeuferVorschau name={name} zeilen={zeilen} sperren={sperren.map(Boolean)} category={category} registrierung={registrierung} />
    </FamilienDialog>
  )
}

/**
 * „So sehen Käufer dein Futter" (Mockup web-h2-neues-futter): Name, ab-Kilopreis,
 * Zahl der Größen, Schild nach E9 und die Größen, die online gehen.
 */
function KaeuferVorschau({
  name,
  zeilen,
  sperren,
  category,
  registrierung,
}: {
  name: string
  zeilen: Zeile[]
  sperren: boolean[]
  category: (typeof FUTTER_KATEGORIEN)[number]
  registrierung: HofRegistrierung
}): React.JSX.Element {
  const sichtbar = useMemo(() => zeilen.filter((z, i) => !sperren[i] && z.price !== null && z.nettoMenge !== null), [zeilen, sperren])
  // Nur Anzeige: der günstigste Kilopreis als Vergleich (CODING_STANDARDS, Ausnahme Grundpreis).
  const guenstigste = sichtbar.reduce<Zeile | null>((best, z) => {
    if (z.price === null || z.nettoMenge === null) return best
    if (!best || best.price === null || best.nettoMenge === null) return z
    return z.price / z.nettoMenge < best.price / best.nettoMenge ? z : best
  }, null)
  const ab = guenstigste?.price != null && guenstigste.nettoMenge != null ? formatGrundpreisNetto(guenstigste.price, guenstigste.nettoMenge, 'KG') : null
  const schild = futterSchild({ category, futter: { betriebsnummer: registrierung.betriebsnummer } }, registrierung.betriebsstatus)

  return (
    <section aria-labelledby="futter-vorschau" className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-4">
      <h3 id="futter-vorschau" className="text-[11px] font-semibold tracking-[1px] text-muted-foreground uppercase">
        So sehen Käufer dein Futter
      </h3>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="min-w-0 font-heading text-lg font-semibold break-words text-foreground">{name.trim() || 'Dein Futter'}</p>
        {ab && <p className="text-sm font-semibold text-foreground tabular-nums">ab {ab}</p>}
      </div>
      <p className="text-xs text-muted-foreground">
        {sichtbar.length === 1 ? '1 Größe sichtbar' : `${formatZahl(sichtbar.length)} Größen sichtbar`}
      </p>
      {schild && (
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-status-fertig">
          <ShieldCheck className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          {schild}
        </p>
      )}
      {sichtbar.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {sichtbar.map((z) => (
            <li key={z.schluessel} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground tabular-nums">
              {gewichtUngefaehr(z.unit) ? '~' : ''}
              {formatZahl(z.nettoMenge ?? 0)} kg · {formatEuro(z.price ?? 0)}
              <span className="sr-only"> je {einheitLabel(z.unit)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className={cn('text-xs text-muted-foreground')}>Die Servicegebühr zahlt der Käufer zusätzlich. Du bekommst genau deinen Preis.</p>
      <p className="text-xs text-muted-foreground">Erscheint auf deiner Hofseite und in Entdecken unter Futtermittel.</p>
    </section>
  )
}
