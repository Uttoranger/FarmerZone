import { z } from 'zod'
import { LAENDER } from '@/lib/laender'
import {
  EMAIL_MAX,
  HOFNAME_MAX,
  PERSONENNAME_MAX,
  TELEFON_MAX,
  ZU_LANG,
  passtInGrenze,
} from '@/lib/eingabegrenzen'
import { hofBetriebsnummerSchema, betriebsstatusSchema } from '@/schemas/betrieb'
import { emailSchema } from '@/schemas/email'

/**
 * Was gespeichert ist — für die Felder, die erst nachträglich eine Obergrenze
 * bekommen haben. Ein längerer Altwert darf beim Bearbeiten unverändert
 * stehen bleiben (passtInGrenze in src/lib/eingabegrenzen.ts).
 */
// Bewusst ausgeschrieben statt Pick<ProfileFormData, …>: Das Schema nimmt den
// Bestand als Parameter, ein abgeleiteter Typ wäre ein Zirkelbezug (TS2456).
export type ProfilBestand = { name: string; ownerName: string; phone: string }

function profilSchemaFuer(bestand?: ProfilBestand) {
  return z.object({
    name: z
      .string()
      .min(2, 'Name muss mindestens 2 Zeichen haben')
      .refine((v) => passtInGrenze(v, HOFNAME_MAX, bestand?.name), ZU_LANG.hofname),
    ownerName: z
      .string()
      .min(2, 'Name muss mindestens 2 Zeichen haben')
      .refine((v) => passtInGrenze(v, PERSONENNAME_MAX, bestand?.ownerName), ZU_LANG.personenname),
    description: z.string().min(10, 'Beschreibung muss mindestens 10 Zeichen haben'),
    address: z.string().min(3, 'Pflichtfeld'),
    postalCode: z.string().min(4, 'Pflichtfeld'),
    city: z.string().min(2, 'Pflichtfeld'),
    // Die Spalte ist ein String mit Default (prisma/schema.prisma) — ERLAUBT
    // sind aber nur AT und DE, und das erzwingt genau diese Zeile. Ein drittes
    // Land kostet damit einen Eintrag in src/lib/laender.ts, keine Migration.
    country: z.enum(LAENDER, { message: 'Bitte Österreich oder Deutschland wählen' }),
    phone: z
      .string()
      .min(4, 'Pflichtfeld')
      .refine((v) => passtInGrenze(v, TELEFON_MAX, bestand?.phone), ZU_LANG.telefon),
    email: emailSchema('Ungültige E-Mail-Adresse'),
    // Der Kartenpunkt wird MIT dem Profil gespeichert — es gibt keinen eigenen
    // Bestätigen-Schritt mehr. null heißt: (noch) kein Punkt gesetzt; ein
    // gespeicherter Punkt wird dann NICHT angerührt (siehe updateProfile).
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    // Betriebsnummer des Hofs (Sprint Bereiche 1, Rückfrage F6) — Vorbelegung
    // im Checkout, Anzeige in der Futter-Kennzeichnung. Leer ist erlaubt.
    betriebsnummer: hofBetriebsnummerSchema,
    betriebsstatus: betriebsstatusSchema,
    // Logo und Titelbild gehören zu „Mein Auftritt" (echter Datei-Upload) und
    // stehen bewusst NICHT mehr im Profil-Formular. Sie fehlen hier auch im
    // Schreibpfad: sonst würde jedes Profil-Speichern die dort hochgeladenen
    // Bilder auf null zurücksetzen. Die DB-Felder selbst bleiben unverändert.
  })
}

/**
 * Das Hofprofil, wie updateProfile (src/server/actions/farm.ts) es verlangt.
 * Hier statt in der Aktion, weil der Hofseiten-Editor
 * (components/farmer/hofseite-editor.tsx) einzelne Felder daraus mit `.pick()`
 * prüft — eine Regel, nicht zwei Abschriften. Die Meldungen sind für den
 * Menschen, nicht für den Server: Sie stehen im Formular unter dem Feld.
 *
 * Streng: Jeder Wert hält die Obergrenzen ein. Zum Bearbeiten eines
 * bestehenden Hofs dient profilBearbeitenSchema.
 */
export const profileSchema = profilSchemaFuer()

export type ProfileFormData = z.infer<typeof profileSchema>

/**
 * Das Profil beim Bearbeiten: dieselben Regeln, nur darf ein Hofname,
 * Inhabername oder eine Telefonnummer, die vor der Grenze länger gespeichert
 * wurde, unverändert bleiben — der Hof bleibt speicherbar, das Formular zeigt
 * am Feld „Bitte kürzen". Server (updateProfile, mit dem Stand aus der
 * Datenbank) und Formulare (mit dem Stand, den sie anzeigen) bauen es aus
 * derselben Funktion.
 */
export function profilBearbeitenSchema(bestand: ProfilBestand): typeof profileSchema {
  return profilSchemaFuer(bestand)
}

/**
 * Der erste Schritt des Onboardings (createFarm in
 * src/server/actions/onboarding.ts): Hier entsteht der Hofname zum ersten
 * Mal, also gelten hier dieselben Obergrenzen wie im Profil. Ränder fallen
 * weg wie bisher in der Aktion. Mehr prüft das Schema bewusst nicht — die
 * Pflichtfelder prüft das Formular „Hof anlegen" mit hofAnlegenFormularSchema
 * (src/components/einrichten/hof-anlegen-formular.tsx).
 */
export const hofAnlegenSchema = z.object({
  name: z.string().trim().max(HOFNAME_MAX, ZU_LANG.hofname),
  ownerName: z.string().trim().max(PERSONENNAME_MAX, ZU_LANG.personenname),
  description: z.string().trim(),
  address: z.string().trim(),
  postalCode: z.string().trim(),
  city: z.string().trim(),
  phone: z.string().trim().max(TELEFON_MAX, ZU_LANG.telefon),
  // Die Hof-E-Mail ist im Onboarding freiwillig: leer bleibt leer. Sonst gilt
  // emailSchema (src/schemas/email.ts) — klein, ohne Ränder, gültiges Format.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(EMAIL_MAX, ZU_LANG.email)
    .refine(
      (v) => v === '' || emailSchema().safeParse(v).success,
      'Bitte gib eine gültige Hof-E-Mail an — oder lass das Feld leer.'
    ),
})

/**
 * Das Formular „Hof anlegen" auf Einrichten (Nr. 15) — strenger als
 * hofAnlegenSchema, das createFarm prüft: Die Pflichtfelder und die
 * Postleitzahl hielt bisher das Formular von Hand nach, jetzt an den Feldern
 * selbst (CODING_STANDARDS §8, „Anlegen strenger als Bearbeiten → zwei
 * Schemas"). Die Meldungen sind die bisherigen.
 */
export const hofAnlegenFormularSchema = hofAnlegenSchema.extend({
  name: hofAnlegenSchema.shape.name.min(1, 'Bitte gib den Namen deines Hofs an.'),
  ownerName: hofAnlegenSchema.shape.ownerName.min(1, 'Bitte gib deinen Vor- und Nachnamen an.'),
  address: hofAnlegenSchema.shape.address.min(1, 'Bitte gib die Straße und Hausnummer an.'),
  postalCode: hofAnlegenSchema.shape.postalCode
    .min(1, 'Bitte gib eine PLZ an.')
    .regex(/^\d{4}$/, 'Die PLZ muss genau 4 Ziffern haben.'),
  city: hofAnlegenSchema.shape.city.min(1, 'Bitte gib den Ort an.'),
  phone: hofAnlegenSchema.shape.phone
    .min(1, 'Bitte gib eine Telefonnummer an.')
    .min(6, 'Bitte gib eine gültige Telefonnummer an.'),
})

export type HofAnlegenFormular = z.input<typeof hofAnlegenFormularSchema>
