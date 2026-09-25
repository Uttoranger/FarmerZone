# TECH_STACK

Stand: 2026-09. Bei Abweichung gilt `package.json`, nicht diese Datei — und dann diese Datei korrigieren.

---

## 1. Kern — exakte Versionen

| Paket | Version | Kritisch für KI |
|---|---|---|
| `next` | **16.2.6** | App Router. `after()` verfügbar. Keine Pages-Router-Muster. |
| `react` / `react-dom` | **19.2.4** | Server Components Standard. `useActionState`, kein `useFormState`. |
| `typescript` | ^5 | `strict: true` |
| `prisma` / `@prisma/client` | **^7.8.0** | Treiber-Adapter Pflicht (s. u.) |
| `@prisma/adapter-pg` + `pg` | ^7.8.0 / ^8.21.0 | Verbindung läuft über den Adapter |
| `zod` | **^4.4.3** | **Zod 4**, nicht 3 (s. u.) |
| `tailwindcss` | **^4** | **Tailwind 4**, CSS-basiert, keine `tailwind.config.js` |
| `better-auth` | ^1.6.23 | Sessions, kein NextAuth |
| `stripe` | ^22.1.1 | Connect + Webhooks |
| `vitest` | ^4.1.10 | Node-Umgebung, kein jsdom |
| `pnpm` | **10.33.0** | Exklusiv |
| Node | **22** | CI-Version |

### Versionsfallen — hier verrät sich veraltetes Trainingswissen

**Prisma 7:** Client wird über `PrismaPg`-Adapter instanziiert (`src/lib/prisma.ts`), nicht über `datasources`. Immer `import { prisma } from '@/lib/prisma'`. Nie einen zweiten `new PrismaClient()` anlegen.

**Zod 4:** Nicht die Zod-3-Signaturen verwenden.
- Fehlertexte: `z.string({ error: '…' })`, **nicht** `{ required_error, invalid_type_error }`.
- `z.string().email()` ist deprecated → `z.email()`.
- Fehlerliste heißt `error.issues`, nicht `error.errors`.

**pnpm-Einstellungen:** `overrides`, `allowBuilds` und `onlyBuiltDependencies` stehen in `pnpm-workspace.yaml`, **nicht** im Feld `"pnpm"` der `package.json` — das Feld ist abgekündigt. Ein neuer Sicherheits-Override kommt dorthin; danach muss er im Kopf von `pnpm-lock.yaml` unter `overrides:` stehen.

**Tailwind 4:** Konfiguration lebt in `src/app/globals.css` per `@theme` / `@import "tailwindcss"`. **Keine** `tailwind.config.js` anlegen. Keine `content`-Pfade pflegen.

**Next 16:**
- `params` und `searchParams` sind **Promises** → `const { farmSlug } = await params`.
- Langsame Arbeit nach der Antwort: `after()` aus `next/server`, gekapselt in `nachDerAntwort()` (`src/lib/nach-der-antwort.ts`). Nie `after()` direkt aufrufen.

---

## 2. Feste Zuordnung — ein Zweck, eine Bibliothek

| Zweck | Benutze | Verboten |
|---|---|---|
| Datenbank | Prisma über `@/lib/prisma` | Raw SQL (außer nachweislich nötig), zweiter Client, anderer ORM |
| Validierung | Zod 4 | Yup, Joi, manuelle `if`-Ketten an Systemgrenzen |
| Formulare | `react-hook-form` + `@hookform/resolvers` | Formik, unkontrollierte Ad-hoc-Formulare |
| HTTP | natives `fetch` | axios, got, node-fetch |
| Auth | `better-auth` über `@/lib/auth` | NextAuth, eigene Session-Logik, eigenes Passwort-Hashing |
| Zahlung | `stripe` über `@/lib/stripe` | Direkte REST-Aufrufe an Stripe |
| E-Mail | `resend` + `react-email` über `@/lib/email` | nodemailer, direkter Resend-Aufruf in Routen |
| Dateien | `@vercel/blob` über `@/lib/upload-*` | S3-SDK, direkter Blob-Aufruf in Komponenten |
| Datum | `date-fns` | moment, dayjs, eigene Datumsarithmetik |
| Icons | `lucide-react` | Heroicons, react-icons, handgemalte SVG-Pfade |
| Toast | `sonner` | react-toastify, eigene Toast-Implementierung |
| Charts | `recharts` | Chart.js, D3 direkt |
| Karte | `leaflet` | Google Maps, Mapbox |
| Klassen-Merge | `cn()` aus `@/lib/utils` | Manuelle Template-Strings mit Klassen |
| IDs / Tokens | `nanoid`, `crypto.randomUUID()` | `Math.random()`, Zeitstempel als ID |
| Server-State | React Query (nur wo vorhanden) | Neue globale Stores |

---

## 3. Verbotene Muster

- **Kein** neues State-Management (Redux, Zustand, Jotai, MobX, Recoil).
- **Kein** CSS-in-JS (styled-components, emotion), keine `.module.css`-Dateien. Nur Tailwind-Utilities.
- **Kein** `useEffect` zum Datenladen. Serverseitig laden.
- **Kein** Client-seitiger Fetch auf die eigene DB. Server Components oder Server Actions.
- **Kein** Barrel-File (`index.ts`, das re-exportiert).
- **Kein** `class`-basierter Service, kein Dependency-Injection-Container. Funktionen und Module.
- **Keine** eigene Krypto (Signatur, Hash, Verschlüsselung). `src/lib/geheimnis.ts` benutzen oder fragen.
- **Keine** neue UI-Bibliothek. Vorhandene `src/components/ui/*` erweitern (shadcn-Stil, Base UI + Radix).

---

## 4. Neue Abhängigkeit hinzufügen

Nur mit Freigabe. Vorher beantworten, im Vorschlag mitliefern:
1. Lässt es sich mit vorhandenen Mitteln in unter ~50 Zeilen lösen? → Dann keine Abhängigkeit.
2. Deckt eine bereits installierte Bibliothek den Fall ab? (Tabelle Abschnitt 2 prüfen.)
3. Bundle-Größe, Wartungsstand, Kompatibilität mit React 19 / Next 16?
4. Läuft es in Vercels serverloser Umgebung? (Kein Dateisystem-Schreibzugriff, kein Prozess-Zustand über Requests hinweg.)

Nach der Freigabe: hier in die Tabelle eintragen.

---

## 5. Laufzeitumgebung — Konsequenzen für den Code

- **Vercel, serverlos.** Kein verlässlicher Prozess-Zustand zwischen Requests. In-Memory-Zähler (z. B. `src/lib/rate-limit.ts`) gelten **pro Instanz** — bekannt und für den Pilotbetrieb akzeptiert, aber nie als harte Sicherheitsgrenze behandeln.
- **Cron im Hobby-Tarif: einmal täglich.** Nie eine Frist oder Geschäftsregel von einem Cron abhängig machen. Cron ist Aufräumer, nie die Wahrheit.
- **Kein Dateisystem-Schreibzugriff.** Uploads gehen an Vercel Blob.
- **Kalte Starts.** Nichts Teures auf Modulebene ausführen.
- **Env-Variablen** ausschließlich über `@/lib/env` (Zod-validiert). Nie `process.env.X` direkt lesen — Ausnahme: `NODE_ENV`.
- **Die Adresse der App** (`APP_URL`) und die Umgebung (`UMGEBUNG`: produktion / preview / lokal) ausschließlich über `@/lib/umgebung-server`. Nie `NEXT_PUBLIC_APP_URL` selbst lesen, nie `?? 'http://localhost:3000'` in einer Datei — in Previews ist die Variable nicht gesetzt, und genau dieser Ersatz hat dort den Login zerstört. Die Entscheidung selbst ist rein und getestet: `@/lib/umgebung`. Im Browser gibt es die Adresse nur als Prop vom Server (Vorbild: `onboarding/page.tsx`), nie über `process.env`.

---

## 6. Hersteller-Skills für Agenten

Unter `.claude/skills/` liegen Skills von Herstellern, festgehalten in `skills-lock.json`. Sie liefern Fachwissen, keine Projektregeln. **Bei Widerspruch gilt `docs/ai/`.**

| Skill | Quelle | Wofür |
|---|---|---|
| `agent-browser` | vercel-labs/agent-browser | Browser-Prüfungen in eigener Chromium-Instanz ohne Anmeldungen — der einzige erlaubte Weg (`CLAUDE.md`) |
| `frontend-design` | anthropics/skills | Gestaltung neuer Oberflächen |
| `prisma-client-api` | prisma/skills | Prisma-Client-Abfragen |
| `shadcn` | shadcn/ui | Bausteine in `src/components/ui/` |
| `supabase-postgres-best-practices` | supabase/agent-skills | Schema, Migrationen, Abfragen |
| `vercel-react-best-practices` | vercel-labs/agent-skills | React-/Next-Muster und Performance |
| `web-design-guidelines` | vercel-labs/agent-skills | Prüft UI-Code auf Barrierefreiheit und Bedienbarkeit. Regeln **eingefroren** in `guidelines.md` (Stand und Hash in `SKILL.md`) — nie aus dem Netz nachladen. |

Hersteller-Skills, die Anweisungen zur Laufzeit aus dem Netz holen, werden vor dem Commit eingefroren: Inhalt als Datei in den Skill-Ordner, Abruf-Anweisung gestrichen, Quelle, Commit und Hash vermerkt. Ein automatisches Skill-Update überschreibt diese Anpassung — danach erneut einfrieren.
