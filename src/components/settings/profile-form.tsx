'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  holeAdresseZumPunkt,
  sucheHofStandort,
  type ProfileFormData,
} from '@/server/actions/farm'
import { aktionOhneWurf, meldeGescheitertesSpeichern, speichereProfil, speichernOhneWurf } from '@/components/mein-hof/abschnitt-speichern'
import { FeldFehlerSatz, FormularPruefen, SpeicherFehler, feldFehlerAttribute, hilfeKennung } from '@/components/shared/formular-meldungen'
import { RUNDUNG } from '@/components/ui/rundung'
import { FesteAktionsleiste, AKTIONSLEISTE_KNOPF } from '@/components/ui/feste-aktionsleiste'
import { FELD_ATTRIBUTE, enterTaste, weiterMitEnter } from '@/lib/feld-attribute'
import { FREIWILLIG, HOF_EMAIL_HILFE } from '@/lib/profil-meldungen'
import { HOF_EMAIL_ANKER, HOF_EMAIL_TEXT } from '@/lib/hof-kontakt'
import { NETZ_SATZ } from '@/lib/netz'
import { geaendertSeitLaden, profilWieImSchema } from '@/lib/abschnitt-stand'
import type { FarmSettings } from '@/server/queries/farm'
import {
  HINWEIS_ADRESSE_UEBERNOMMEN,
  HINWEIS_KARTE_OHNE_PUNKT,
  RUECKFALL_PUNKTE,
  uebernehmeAdresse,
  type StandortKandidat,
} from '@/lib/geokodierung'
import {
  DE_VORBEREITUNG_HINWEIS,
  LAENDER,
  LAND_LABEL,
  alsLand,
  type Land,
} from '@/lib/laender'
import type { KartenZiel } from '@/components/settings/standort-karte'
import { KarteLaedt } from '@/components/karte/karte-laedt'
import { STANDORT_KARTE_RAHMEN } from '@/components/karte/karten-masse'
import { BETRIEBSNUMMER_ANKER, BETRIEBSSTATUS, BETRIEBSSTATUS_VALUES, type BetriebsstatusValue } from '@/lib/taxonomie'
import { profilBearbeitenSchema } from '@/schemas/hofprofil'
import { EMAIL_MAX, HOFNAME_MAX, PERSONENNAME_MAX, TELEFON_MAX } from '@/lib/eingabegrenzen'
import { FeldZaehler } from '@/components/shared/zeichen-zaehler'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { useNachSpeichern } from '@/components/hof-einstellungen/use-nach-speichern'
import { HOFDATEN_TEXT } from '@/lib/hof-einstellungen'
import { HOFSEITE_HREF, HOFSEITE_WEG } from '@/lib/bauern-navigation'
import { cn } from '@/lib/utils'

// Nur clientseitig: Leaflet greift beim Import auf window zu. Bis die Karte
// da ist, steht der Platzhalter in ihrer Größe (Nr. 52) — nichts springt.
const StandortKarte = dynamic(() => import('@/components/settings/standort-karte'), {
  ssr: false,
  loading: () => <KarteLaedt className={STANDORT_KARTE_RAHMEN} />,
})

/** Obergrenzen je Feld — dieselben, die updateProfile prüft (src/lib/eingabegrenzen.ts). */
const GRENZE: Partial<Record<keyof ProfileFormData, number>> = {
  name: HOFNAME_MAX,
  ownerName: PERSONENNAME_MAX,
  phone: TELEFON_MAX,
  email: EMAIL_MAX,
}

/** Abschnittsüberschrift als Kicker in Großbuchstaben (Liste Lauf 32, hofdaten-zahlung „Abschnittsüberschriften“). */
const KICKER = 'text-[13px] font-bold tracking-[0.04em] text-muted-foreground uppercase'
/** Beschriftungen fett in Textfarbe (dieselbe Zeile). */
const BESCHRIFTUNG = 'mb-1 block text-sm font-semibold text-foreground'
/** Felder 10 px rund (G8) statt Pille; der Fokus als Rahmen außen, auch um den Fehlerrand (Liste Lauf 32, hofdaten-zahlung). */
const FELD = cn('min-h-11', RUNDUNG.feld, FOKUS_RAHMEN)
/** Fehlerrand orange in beiden Themes (`status-offen`, V17) — vorher im Dunkeln dunkelrot (`destructive` aus ui/input). */
const FELD_FEHLER = 'border-status-offen aria-invalid:border-status-offen aria-invalid:ring-status-offen/25 dark:aria-invalid:ring-status-offen/40'
/** Je Abschnitt eine Karte, 12 px rund (G8). */
const KARTE_ABSCHNITT = cn('space-y-4 border border-border bg-card p-4', RUNDUNG.karte)

export function ProfileForm({ farm }: { farm: FarmSettings }) {
  const [isPending, startTransition] = useTransition()
  // Nach dem Speichern zurück zur Übersicht (Register N1, Nr. 44).
  const nachSpeichern = useNachSpeichern()
  const [sucheLaeuft, setSucheLaeuft] = useState(false)
  // Ein Fehler beim Speichern steht im Formular über dem Knopf, die Eingabe
  // bleibt — wie in den Formularen von Mein Hof (DESIGN_SYSTEM).
  const [speicherFehler, setSpeicherFehler] = useState<string | null>(null)
  // Die Ortssuche ist kein Speichern, aber derselbe Fall: ein Fehler ohne Feld – Karte am Formular, kein Toast.
  const [sucheFehler, setSucheFehler] = useState<string | null>(null)
  // Die ruhige Zeile über der Karte: anfangs der Start-Hinweis (solange kein
  // Punkt gespeichert ist), danach das Vorwärts-Ergebnis oder die
  // Übernahme-Zeile der Rückwärtssuche.
  const [hinweis, setHinweis] = useState<string | null>(
    farm.latitude != null && farm.longitude != null ? null : HINWEIS_KARTE_OHNE_PUNKT
  )
  const [kandidaten, setKandidaten] = useState<StandortKandidat[]>([])
  const [ziel, setZiel] = useState<KartenZiel | null>(null)
  const zielFolge = useRef(0)
  // Späte Rückwärts-Antworten dürfen frischere nicht überschreiben.
  const anfrageFolge = useRef(0)

  // Startansicht der Karte: gespeicherter Punkt bei Zoom 17, sonst der
  // Rückfallpunkt bei Zoom 8. Die Karte liest `start` nur beim Einhängen —
  // dass hier je Render ein frisches Objekt entsteht, ist deshalb egal.
  // Ohne Punkt öffnet die Karte im Rückfallpunkt DES LANDES — ein deutscher
  // Hof soll nicht erst über Oberösterreich starten.
  const startLand = alsLand(farm.country)
  const start =
    farm.latitude != null && farm.longitude != null
      ? { lat: farm.latitude, lon: farm.longitude, zoom: 17 }
      : { lat: RUECKFALL_PUNKTE[startLand].lat, lon: RUECKFALL_PUNKTE[startLand].lon, zoom: 8 }

  // Dasselbe Schema wie updateProfile, mit dem Stand, den das Formular zeigt:
  // Ein Hofname, Inhabername oder eine Nummer, die vor den Obergrenzen länger
  // gespeichert wurde, sperrt das Speichern nicht — am Feld steht dann
  // „Bitte kürzen", geprüft wird beim Speichern (src/schemas/hofprofil.ts).
  const schema = useMemo(
    () => profilBearbeitenSchema({ name: farm.name, ownerName: farm.ownerName, phone: farm.phone }),
    [farm.name, farm.ownerName, farm.phone]
  )
  // Der Stand beim Laden: Startwerte des Formulars und Maßstab dafür, was
  // dieses Formular ändert (geaendertSeitLaden, siehe onSubmit).
  const startwerte: ProfileFormData = {
    name: farm.name,
    ownerName: farm.ownerName,
    description: farm.description,
    address: farm.address,
    postalCode: farm.postalCode,
    city: farm.city,
    phone: farm.phone,
    email: farm.email,
    country: startLand,
    latitude: farm.latitude,
    longitude: farm.longitude,
    betriebsnummer: farm.betriebsnummer,
    betriebsstatus: farm.betriebsstatus,
  }
  // Einmal, Feld für Feld so, wie das Schema ihn ausgibt (Ränder,
  // Kleinschreibung, leer → null) — sonst zählte ein unverändertes Feld als
  // geändert. Hält ein Altwert das Schema nicht ein, bleibt nur dieses Feld,
  // wie es geladen wurde (profilWieImSchema).
  const [anfang] = useState<ProfileFormData>(() => profilWieImSchema(schema, startwerte))
  const { register, handleSubmit, getValues, setValue, control, formState: { errors } } = useForm<ProfileFormData>({
    // Cast wie im Produktformular: Die Vorverarbeitung (leer → null) macht den
    // Eingabetyp des Schemas zu unknown; der Ausgabetyp ist ProfileFormData.
    resolver: zodResolver(schema) as Resolver<ProfileFormData>,
    defaultValues: startwerte,
  })
  // Der Hilfesatz folgt dem gewählten Status — welche Nummer gehört hierher?
  const [status, setStatus] = useState<BetriebsstatusValue | null>(farm.betriebsstatus)
  const statusFeld = register('betriebsstatus')

  // Die Länderwahl steuert den Hinweis UND die Geokodierung — deshalb als
  // eigener Zustand neben dem Formularwert (register allein meldet keine
  // Änderung an die Anzeige).
  const [land, setLand] = useState<Land>(startLand)
  // EINMAL registrieren und den Handler festhalten — er wird unten
  // aufgerufen, statt überschrieben zu werden (siehe Kommentar am Select).
  const landFeld = register('country')

  function onSubmit(data: ProfileFormData) {
    // Während der Ortssuche nicht speichern: Danach geht es zur Übersicht
    // (Nr. 44), und der gesuchte Punkt käme in einer ausgehängten Seite an —
    // gespeichert wären still die alten Koordinaten.
    if (sucheLaeuft) return
    setSpeicherFehler(null)
    startTransition(async () => {
      // Nur, was hier seit dem Laden geändert wurde, über den frischen Stand
      // vom Server — derselbe Weg wie die Abschnitte von Mein Hof. Ein älterer
      // Tab schriebe sonst Name, Adresse oder Kontakt aus Mein Hof zurück.
      // speichernOhneWurf: Eine gescheiterte Anfrage (Netz weg, Aktion nach
      // einem Deploy unbekannt) ginge sonst an die Fehlergrenze, und die
      // Eingabe wäre weg.
      const satz = await speichernOhneWurf(() => speichereProfil(geaendertSeitLaden(anfang, data)))
      if (satz) {
        setSpeicherFehler(satz)
        return
      }
      nachSpeichern(HOFDATEN_TEXT.gespeichert, undefined, HOFDATEN_TEXT.gespeichert)
    })
  }

  // „Nochmal" am Netzsatz (Register N29): dasselbe Speichern noch einmal, die Eingabe stand die ganze Zeit.
  const nochmalSpeichern = () => void handleSubmit(onSubmit)()

  /** Jede vom Bauern gewählte Kartenmitte wird zum Formularwert — erkennbar
   *  ungespeichert wie jedes andere geänderte Feld, bis „Profil speichern". */
  function punktGewaehlt(lat: number, lon: number) {
    setValue('latitude', lat, { shouldDirty: true })
    setValue('longitude', lon, { shouldDirty: true })
  }

  async function aufKarteSuchen() {
    if (sucheLaeuft) return
    setSucheLaeuft(true)
    setSucheFehler(null)
    try {
      const werte = getValues()
      // aktionOhneWurf: Ohne Netz würfe der Aufruf, und die Suche bliebe ohne Antwort.
      const res = await aktionOhneWurf(() =>
        sucheHofStandort({
          address: werte.address,
          postalCode: werte.postalCode,
          city: werte.city,
          // Das gerade GEWÄHLTE Land, nicht das gespeicherte: Wer eben auf
          // Deutschland umgestellt hat, sucht sofort dort.
          country: land,
        })
      )
      if ('error' in res) {
        setSucheFehler(res.error)
        return
      }
      const ergebnis = res.ergebnis
      setHinweis(ergebnis.hinweis)
      setKandidaten(ergebnis.kandidaten)
      zielFolge.current += 1
      setZiel({
        lat: ergebnis.zentrum.lat,
        lon: ergebnis.zentrum.lon,
        zoom: ergebnis.zoom,
        folge: zielFolge.current,
      })
      // Nur ein echter Adress-Treffer wird zum (ungespeicherten) Punkt. Die
      // gröberen Stufen zeigen bloß die Gegend — dort setzt der Bauer den
      // Punkt selbst, sonst würde still ein Ortszentrum als Hof gespeichert.
      if (ergebnis.stufe === 'adresse') {
        punktGewaehlt(ergebnis.zentrum.lat, ergebnis.zentrum.lon)
      }
    } finally {
      setSucheLaeuft(false)
    }
  }

  /** Rückwärts: Die gebremste Ruheposition der Karte füllt die Adressfelder
   *  (Übernahme-Regel in uebernehmeAdresse). Scheitern bleibt stumm. */
  async function adresseVomPunkt(lat: number, lon: number) {
    anfrageFolge.current += 1
    const meineFolge = anfrageFolge.current
    // Scheitern bleibt stumm (der Hof tippt die Adresse selbst) – aber ohne Wurf, auch ohne Netz.
    let punkt: Awaited<ReturnType<typeof holeAdresseZumPunkt>>
    try {
      punkt = await holeAdresseZumPunkt(lat, lon)
    } catch (fehler) {
      // Stumm für den Hof, nicht für uns: Sentry bekommt die gescheiterte Anfrage.
      meldeGescheitertesSpeichern(fehler)
      return
    }
    if (!punkt || anfrageFolge.current !== meineFolge) return

    const bisher = {
      address: getValues('address'),
      postalCode: getValues('postalCode'),
      city: getValues('city'),
    }
    const neu = uebernehmeAdresse(bisher, punkt)
    for (const feld of ['address', 'postalCode', 'city'] as const) {
      if (neu[feld] !== bisher[feld]) {
        setValue(feld, neu[feld], { shouldDirty: true, shouldValidate: true })
      }
    }
    setHinweis(HINWEIS_ADRESSE_UEBERNOMMEN)
  }

  const istAttributFeld = (id: FeldId): id is FeldId & keyof typeof FELD_ATTRIBUTE => id in FELD_ATTRIBUTE
  type FeldId = 'name' | 'ownerName' | 'address' | 'phone' | typeof HOF_EMAIL_ANKER | 'betriebsnummer'
  /**
   * Ein Textfeld mit Fehlersatz am Feld (aria-invalid, aria-describedby, role="alert"),
   * den Attributen aus FELD_ATTRIBUTE und der Taste unten rechts am Handy. Pflicht ist
   * der Normalfall; was freiwillig ist, sagt „(freiwillig)" am Namen.
   */
  function field(
    id: FeldId,
    label: string,
    { placeholder, hilfe, letztes }: { placeholder?: string; hilfe?: string; letztes?: boolean } = {}
  ) {
    const max = GRENZE[id]
    const attribute = istAttributFeld(id) ? FELD_ATTRIBUTE[id] : undefined
    return (
      <div>
        <Label htmlFor={id} className={BESCHRIFTUNG}>{label}</Label>
        <Input
          id={id}
          {...register(id)}
          {...attribute}
          enterKeyHint={enterTaste(letztes === true)}
          placeholder={placeholder}
          {...feldFehlerAttribute(id, Boolean(errors[id]), Boolean(hilfe))}
          className={cn(FELD, 'scroll-mt-6', errors[id] && FELD_FEHLER)}
        />
        {max !== undefined && <FeldZaehler control={control} name={id} max={max} />}
        {hilfe && (
          <p id={hilfeKennung(id)} className="mt-1 text-xs text-muted-foreground">
            {hilfe}
          </p>
        )}
        <FeldFehlerSatz feldId={id} text={errors[id]?.message} />
      </div>
    )
  }

  // noValidate: Mit type="email" prüfte sonst der Browser zuerst – mit englischer Blase und ohne unsere Sätze am Feld.
  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} onKeyDown={weiterMitEnter} className="flex flex-col gap-4">
      {/* „Bitte prüfe das markierte Feld.“ über dem Formular, solange das Schema Felder markiert (G6). */}
      <FormularPruefen anzahl={Object.keys(errors).length} />
      {/* Ab 1024 px zwei Spalten wie im Board w2-hofdaten-zahlung: links Hof und Adresse, rechts Kontakt und Betriebsnummer. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
      <div className={KARTE_ABSCHNITT}>
        <h2 className={KICKER}>Hof-Informationen</h2>
        {field('name', 'Hof-Name', { placeholder: 'Hof Müller' })}
        {field('ownerName', 'Name des Inhabers', { placeholder: 'Klaus Müller' })}
        <div>
          <Label htmlFor="description" className={BESCHRIFTUNG}>Beschreibung {FREIWILLIG}</Label>
          <Textarea
            id="description"
            {...register('description')}
            rows={4}
            placeholder="Beschreibe deinen Hof für Kunden..."
            {...feldFehlerAttribute('description', Boolean(errors.description))}
            className={cn(RUNDUNG.feld, FOKUS_RAHMEN, errors.description && FELD_FEHLER)}
          />
          <FeldFehlerSatz feldId="description" text={errors.description?.message} />
        </div>
      </div>

      <div className={KARTE_ABSCHNITT}>
        <h2 className={KICKER}>Adresse</h2>

        {/* Das Land ÜBER den Adressfeldern: Es entscheidet, wie PLZ und Ort
            gelesen werden (vier- oder fünfstellig, Nominatim-Anker) — es
            danach zu fragen, wäre die falsche Reihenfolge. */}
        <div>
          <Label htmlFor="country" className={BESCHRIFTUNG}>Land</Label>
          {/* Der eigene onChange DARF den von react-hook-form nicht
              ersetzen: `register` gibt beide Handler unter demselben Namen
              zurück, das spätere JSX-Prop gewänne — der Formularwert käme
              dann nur noch über onBlur nach. Wer mit den Pfeiltasten wählt
              und sofort absendet, sähe den DE-Hinweis und speicherte AT.
              Deshalb erst den Handler von register, dann unseren. */}
          <select
            id="country"
            {...landFeld}
            aria-describedby={land === 'DE' ? 'land-hinweis' : undefined}
            onChange={(e) => {
              landFeld.onChange(e)
              setLand(alsLand(e.target.value))
            }}
            className={cn('min-h-11 w-full border border-border bg-card px-3 text-base text-foreground', RUNDUNG.feld)}
          >
            {LAENDER.map((wert) => (
              <option key={wert} value={wert}>
                {LAND_LABEL[wert]}
              </option>
            ))}
          </select>
        </div>

        {/* Ruhig, kein Warnbalken, kein Orange: Der Hof hat nichts falsch
            gemacht — wir sind noch nicht so weit. Der Wortlaut steht in
            src/lib/laender.ts und ist derselbe wie im Warte-Hinweis der
            Übersicht. */}
        {land === 'DE' && (
          <p
            id="land-hinweis"
            className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
          >
            {DE_VORBEREITUNG_HINWEIS}
          </p>
        )}

        {field('address', 'Straße und Hausnummer', { placeholder: 'Dorfstraße 12' })}
        {/* Steht an PLZ oder Ort ein Fehler, untereinander — nebeneinander bräche der Satz in schmale Zeilen
            (Liste Lauf 32, hofdaten-zahlung „PLZ und Ort im Fehlerfall“). */}
        <div className={cn('grid gap-3', !(errors.postalCode || errors.city) && 'grid-cols-2')}>
          <div>
            {/* Neutral beschriftet und ohne länderfestes Beispiel: „3400" wäre
                für einen deutschen Hof eine falsche Vorgabe. */}
            <Label htmlFor="postalCode" className={BESCHRIFTUNG}>Postleitzahl</Label>
            {/* Das Beispiel folgt dem Land — „3400" wäre für einen
                deutschen Hof eine falsche Vorgabe, gar keines wäre für
                beide eine verlorene Ausfüllhilfe. */}
            <Input
              id="postalCode"
              {...register('postalCode')}
              {...FELD_ATTRIBUTE.postalCode}
              enterKeyHint={enterTaste(false)}
              placeholder={land === 'DE' ? '84359' : '3400'}
              {...feldFehlerAttribute('postalCode', Boolean(errors.postalCode))}
              className={cn(FELD, errors.postalCode && FELD_FEHLER)}
            />
            <FeldFehlerSatz feldId="postalCode" text={errors.postalCode?.message} />
          </div>
          <div>
            <Label htmlFor="city" className={BESCHRIFTUNG}>Ort</Label>
            <Input
              id="city"
              {...register('city')}
              {...FELD_ATTRIBUTE.city}
              enterKeyHint={enterTaste(false)}
              placeholder={land === 'DE' ? 'Simbach am Inn' : 'Klosterneuburg'}
              {...feldFehlerAttribute('city', Boolean(errors.city))}
              className={cn(FELD, errors.city && FELD_FEHLER)}
            />
            <FeldFehlerSatz feldId="city" text={errors.city?.message} />
          </div>
        </div>
        {/* Der EINZIGE Auslöser der Vorwärts-Suche — bewusst eine Schaltfläche,
            nichts Automatisches beim Tippen oder Speichern. Gesperrt, solange
            gespeichert wird: Danach geht es zur Übersicht (Nr. 44). */}
        <button
          type="button"
          onClick={aufKarteSuchen}
          disabled={sucheLaeuft || isPending}
          // Volle Breite, fett (Liste Lauf 32, hofdaten-zahlung „Auf der Karte suchen“).
          className={cn('inline-flex min-h-11 w-full items-center justify-center gap-2 border-[1.5px] border-foreground bg-card px-4 text-[15px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-60', RUNDUNG.feld, FOKUS_RAHMEN)}
        >
          {sucheLaeuft && <Loader2 className="size-4 animate-spin" />}
          Auf der Karte suchen
        </button>
        <SpeicherFehler text={sucheFehler} nochmal={sucheFehler === NETZ_SATZ} onNochmal={() => void aufKarteSuchen()} laeuft={sucheLaeuft} />

        {/* Die Karte dauerhaft unter den Adressfeldern — beide Richtungen:
            Die Suche fährt die Karte, das Schieben füllt die Adresse. Die
            ruhige Zeile darüber steht hier statt in der Karte: Sie ist schon da,
            während die Karte nachlädt, und schiebt danach nichts mehr.
            Ziel von „Standort auf der Karte setzen" in Region (STANDORT_ANKER, Nr. 122). */}
        <div id="standort" className="scroll-mt-6">
          {hinweis && <p className="mb-2 text-xs text-muted-foreground">{hinweis}</p>}
          <StandortKarte
            start={start}
            ziel={ziel}
            kandidaten={kandidaten}
            onMitteVerschoben={punktGewaehlt}
            onAdresseAnfrage={adresseVomPunkt}
          />
        </div>
      </div>

      </div>
      <div className="flex min-w-0 flex-col gap-4">
      <div className={KARTE_ABSCHNITT}>
        <h2 className={KICKER}>Kontakt</h2>
        {field('phone', 'Telefon', { placeholder: '+43 660 000 0000' })}
        {/* Ziel der Karte in Heute (HOF_EMAIL_TEXT.einstellungenPfad, Nr. 212): Das Feld trägt die id des Ankers. */}
        {field(HOF_EMAIL_ANKER, HOF_EMAIL_TEXT.profilLabel, { placeholder: 'hof@beispiel.at', hilfe: HOF_EMAIL_HILFE })}
      </div>

      {/* Betriebsnummer (Sprint Bereiche 1): gehört dem Hof, nicht einem
          Produkt. Die Futter-Kennzeichnung zeigt sie an, der Checkout belegt
          sie vor, wenn du selbst Futter „nur an Betriebe" kaufst. */}
      {/* Ziel der Zeile „Futtermittel-Registrierung" der Übersicht (/settings, Nr. 22d). */}
      <div id={BETRIEBSNUMMER_ANKER} className={cn('scroll-mt-6', KARTE_ABSCHNITT)}>
        <div>
          <h2 className={KICKER}>Betriebsnummer</h2>
          <p className="text-xs text-muted-foreground">
            Freiwillig. Brauchst du, wenn du Futter verkaufst oder bei einem anderen Hof als Betrieb einkaufst.
          </p>
        </div>
        <div>
          <Label htmlFor="betriebsstatus" className={BESCHRIFTUNG}>Was für ein Betrieb bist du?</Label>
          {/* Wie beim Land: erst der Handler von register, dann unserer. */}
          <select
            id="betriebsstatus"
            {...statusFeld}
            onChange={(e) => {
              statusFeld.onChange(e)
              setStatus(e.target.value === '' ? null : (e.target.value as BetriebsstatusValue))
            }}
            className={cn('min-h-11 w-full border border-border bg-card px-3 text-base text-foreground', RUNDUNG.feld)}
          >
            <option value="">Keine Angabe</option>
            {BETRIEBSSTATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {BETRIEBSSTATUS[s].name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            {status
              ? BETRIEBSSTATUS[status].hilfe
              : 'LFBIS-Nummer, BAES- bzw. BVL-Registrierung oder α-Nummer — je nachdem, was du mit Futter machst.'}
          </p>
        </div>
        {field('betriebsnummer', 'Betriebsnummer', { placeholder: 'z. B. AT 1234567', letztes: true })}
      </div>

      <p className="text-sm text-muted-foreground">
        Logo und Titelbild verwaltest du unter{' '}
        {/* Ein Link im Satz (Nr. 44), grün wie jeder Link im Fließtext. Das
            Polster macht ihn 44 px hoch, die Gegen-Ränder halten die Zeile ruhig.
            Seit Nr. 50 in Mein Hof (Register N4), vorher „Mein Auftritt". */}
        <Link
          href={HOFSEITE_HREF}
          className={cn('-my-3 inline-block rounded-md py-3 font-medium text-brand-text underline underline-offset-2', FOKUS_RAHMEN)}
        >
          {HOFSEITE_WEG}
        </Link>{' '}
        — dort lädst du Bilder direkt vom Gerät hoch.
      </p>

      </div>
      </div>

      <SpeicherFehler text={speicherFehler} nochmal={speicherFehler === NETZ_SATZ} onNochmal={nochmalSpeichern} laeuft={isPending} />

      {/* Am Handy fest über der Unterleiste (G2), im Web am Formularende rechts (Board w2-hofdaten-zahlung).
          Wartet, solange „Auf der Karte suchen" läuft — sonst ginge der neue Standort verloren (siehe onSubmit). */}
      <FesteAktionsleiste className="md:items-end">
        <button type="submit" disabled={isPending || sucheLaeuft} className={cn(AKTIONSLEISTE_KNOPF, 'disabled:opacity-60 md:w-auto md:px-6')}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-label="Wird gespeichert" /> : sucheLaeuft ? 'Suche läuft noch …' : HOFDATEN_TEXT.speichern}
        </button>
      </FesteAktionsleiste>
    </form>
  )
}
