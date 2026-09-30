import { z } from 'zod'
import { LAENDER } from '@/lib/laender'
import { hofBetriebsnummerSchema, betriebsstatusSchema } from '@/schemas/betrieb'

/**
 * Das Hofprofil, wie updateProfile (src/server/actions/farm.ts) es verlangt.
 * Hier statt in der Aktion, weil der Hofseiten-Editor
 * (components/farmer/hofseite-editor.tsx) einzelne Felder daraus mit `.pick()`
 * prüft — eine Regel, nicht zwei Abschriften. Die Meldungen sind für den
 * Menschen, nicht für den Server: Sie stehen im Formular unter dem Feld.
 */
export const profileSchema = z.object({
  name: z.string().min(2, 'Name muss mindestens 2 Zeichen haben'),
  ownerName: z.string().min(2, 'Name muss mindestens 2 Zeichen haben'),
  description: z.string().min(10, 'Beschreibung muss mindestens 10 Zeichen haben'),
  address: z.string().min(3, 'Pflichtfeld'),
  postalCode: z.string().min(4, 'Pflichtfeld'),
  city: z.string().min(2, 'Pflichtfeld'),
  // Die Spalte ist ein String mit Default (prisma/schema.prisma) — ERLAUBT
  // sind aber nur AT und DE, und das erzwingt genau diese Zeile. Ein drittes
  // Land kostet damit einen Eintrag in src/lib/laender.ts, keine Migration.
  country: z.enum(LAENDER, { message: 'Bitte Österreich oder Deutschland wählen' }),
  phone: z.string().min(4, 'Pflichtfeld'),
  email: z.string().email('Ungültige E-Mail-Adresse'),
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

export type ProfileFormData = z.infer<typeof profileSchema>
