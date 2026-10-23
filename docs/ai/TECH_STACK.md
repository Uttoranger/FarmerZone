# TECH_STACK

Stand: 2026-10. Bei Abweichung gilt `package.json`, nicht diese Datei — und dann diese Datei korrigieren.

---

## 1. Kern — exakte Versionen

| Paket | Version | Kritisch für KI |
|---|---|---|
| `next` / `eslint-config-next` | **16.4.2** (genau, beide gleich) | App Router. `after()` verfügbar. Keine Pages-Router-Muster. `poweredByHeader: false` in `next.config.ts`. |
| `react` / `react-dom` | **19.2.4** | Server Components Standard. `useActionState`, kein `useFormState`. `useOptimistic` für vorgezogene Zustände (Vorbild: `src/components/products/im-shop-schalter.tsx`). |
| `typescript` | ^5 | `strict: true` |
| `prisma` / `@prisma/client` | **^7.8.0** | Treiber-Adapter Pflicht (s. u.) |
| `@prisma/adapter-pg` + `pg` | ^7.8.0 / ^8.21.0 | Verbindung läuft über den Adapter |
| `zod` | **^4.4.3** | **Zod 4**, nicht 3 (s. u.) |
| `tailwindcss` | **^4** | **Tailwind 4**, CSS-basiert, keine `tailwind.config.js` |
| `better-auth` | ^1.6.23 | Sessions, kein NextAuth |
| `@better-auth/passkey` | **1.6.23** (genau, gleich `better-auth`) | Passkey-Anmeldung für Admins (N20). Offizielles Plugin von better-auth — keine eigene WebAuthn-Logik. Installiert vor Nr. 115, importiert erst dort. |
| `stripe` | ^22.1.1 | Connect + Webhooks |
| `sharp` | **^0.35.5** | Nur serverseitig (Upload-Verarbeitung, Teilen-Bild, Skripte). Override `sharp@<0.35.5` in `pnpm-workspace.yaml`, damit auch `next` kein älteres zieht. Fremde Formate: ARCHITECTURE, Uploads. |
| `@vercel/blob` | ^2.8.0 | Verlangt undici `^6.23.0`; in der 6er-Reihe hält es der Override `undici@<6.27.0: '^6.27.0'`. Bringt `@vercel/oidc` mit. |
| `vitest` | ^4.1.10 | Node-Umgebung; die eine Ausnahme ist `tests/hydrieren.test.ts` mit jsdom (Nr. 135, G6-Ergänzung 21.10.2026) |
| `jsdom` | ^30.1.2 (Entwicklungspaket) | Nur für `tests/hydrieren.test.ts` (`// @vitest-environment jsdom`, TESTING_GUIDELINES §1). Verlangt Node ≥ 22.22.2 (`engines`); 30.1.3 ist noch keine 14 Tage alt und braucht ein `undici`, das es auch nicht ist. |
| `yaml` | ^2.9.1 (Entwicklungspaket) | YAML-Parser der Wachen über `.github/workflows/` (`tests/yaml-lader.ts`, `parse`). Liest YAML 1.2: `on` bleibt der Text „on“. Ohne Abhängigkeiten; ersetzt den Umweg über das `js-yaml` von ESLint. |
| `pnpm` | **10.33.0** | Exklusiv |
| Node | **22** | CI-Version |

### Versionsfallen — hier verrät sich veraltetes Trainingswissen

**Prisma 7:** Client wird über `PrismaPg`-Adapter instanziiert (`src/lib/prisma.ts`), nicht über `datasources`. Immer `import { prisma } from '@/lib/prisma'`. Nie einen zweiten `new PrismaClient()` anlegen.
- **Verhalten mit dem pg-Adapter (7.8, gemessen in Nr. 47):** Relationen lädt Prisma als eigene Teilabfragen und startet sie gleichzeitig. Außerhalb einer Transaktion bekommt jede ihre eigene Verbindung aus dem Pool; IN einer Transaktion teilen sie sich eine — pg warnt dann „Calling client.query() when the client is already executing a query" (ab pg@9 ein Fehler). Zwei `findUnique`, die sich nicht zu einer Abfrage zusammenlegen lassen (z. B. mit `approvedAt: { not: null }`), bündelt Prisma im selben Takt zu einem Batch in EINER Transaktion — deshalb lädt eine Seite dieselbe Abfrage für Metadaten und Inhalt nur über React `cache` (ARCHITECTURE §4). Aufrufe auf einem `tx` reiht Prisma 7.8 selbst nacheinander ein; der Code verlässt sich nicht darauf (CODING_STANDARDS §4).
- **Fehler des Adapters:** Einen Postgres-Fehler ohne eigene Prisma-Art (z. B. SQLSTATE 08006 des Poolers) reicht Prisma als `DriverAdapterError` durch, die Ursache steht in `cause` (`kind: 'postgres'`, `originalCode`, `originalMessage`); hängt Prisma ihn an einen eigenen Fehler, unter `meta.driverAdapterError` (`src/lib/verbindungsfehler.ts`).

**Zod 4:** Nicht die Zod-3-Signaturen verwenden.
- Fehlertexte: `z.string({ error: '…' })`, **nicht** `{ required_error, invalid_type_error }`.
- `z.string().email()` ist deprecated → `z.email()`.
- Fehlerliste heißt `error.issues`, nicht `error.errors`.

**pnpm-Einstellungen:** `overrides` und `allowBuilds` stehen in `pnpm-workspace.yaml`, **nicht** im Feld `"pnpm"` der `package.json` — das Feld ist abgekündigt. Ein neuer Sicherheits-Override kommt dorthin; danach muss er im Kopf von `pnpm-lock.yaml` unter `overrides:` stehen.
- **Ziel eines neuen Overrides mit `^`, nicht mit `>=`:** pnpm ersetzt jede Anforderung, deren Bereich sich mit dem Wähler `paket@<x.y.z` überschneidet, durch das Ziel. Steht dort `>=`, nimmt pnpm die neueste Version — auch eine neue Hauptversion (unter 1.0: eine neue Nebenversion). `^x.y.z` hebt ältere Reihen genauso an und bleibt in der Reihe des Ziels. Verlauf: DEVELOPMENT, Sicherheitsupdate 20.10.2026. Ausnahmen mit `>=`: `sharp@<0.35.5: '>=0.35.5'` (neu, so beauftragt; greift derzeit nicht, weil next 16.4.2 selbst `^0.35.5` verlangt) und aus dem Bestand `hono@<4.12.25` und `ws@>=8.0.0 <8.21.0` — die Umstellung auf `^` kommt in einen eigenen Auftrag.

**sharp 0.35:** ESM mit eigenen Typen. Den Typ als benannten Import holen (`import sharp, { type Sharp } from 'sharp'`), den Namensraum `sharp.Sharp` gibt es nicht mehr. `sharp.block`/`sharp.unblock` gelten für den ganzen Prozess; eine Attrappe in Tests braucht beide (`Object.assign(vi.fn(…), { block: vi.fn(), unblock: vi.fn() })`). `withGainMap()` ist da, fehlt aber in den Typen von 0.35.5.

**Sentry-Quelltextkarten (`@sentry/nextjs` 10.66):** `withSentryConfig` in `next.config.ts` trägt `org: 'farmerzone'` und `project: 'javascript-nextjs'` fest; geheim ist nur `authToken`, gelesen aus `process.env.SENTRY_AUTH_TOKEN` (Build-Werkzeug, deshalb nicht über `@/lib/env`; in Vercel für Production und Preview). Keine `SENTRY_URL`: Der Organisations-Token (`sntrys_…`) trägt die Adresse seiner Region (de.sentry.io), und sentry-cli zieht sie der voreingestellten sentry.io vor. `sourcemaps.deleteSourcemapsAfterUpload: true` löscht die Karten nach dem Upload — ausgeliefert werden sie nie. Ohne Token überspringt der Build den Upload und bleibt grün. Das Upload-Programm kommt aus dem Einrichtungs-Skript von `@sentry/cli`; es muss deshalb in `allowBuilds` stehen (pnpm 10.33 liest nur diese Liste, `onlyBuiltDependencies` gibt es nicht mehr daneben). Fehlt es dort, meldet `pnpm ignored-builds` das Paket.

**Tailwind 4:** Konfiguration lebt in `src/app/globals.css` per `@theme` / `@import "tailwindcss"`. **Keine** `tailwind.config.js` anlegen. Keine `content`-Pfade pflegen.

**Schriften:** in der App ausschließlich über `next/font/google` in `src/app/layout.tsx` (self-gehostet, kein CDN); welche und wie sie verdrahtet sind, steht in `docs/ai/DESIGN_SYSTEM.md`, „Technische Regeln". Die einzigen Schriftdateien im Repo sind die des Teilen-Bilds (nächster Absatz).

**Schriftdateien für das Teilen-Bild (OFL, seit Nr. 69):** Satori (`next/og`) kann `next/font` nicht nutzen und liest kein WOFF2 — deshalb statische TTF unter `src/assets/fonts/<familie>/`, je mit `OFL.txt` daneben: Fraunces 72pt SemiBold aus github.com/undercasetype/Fraunces (Commit 7ccdec31c602, `fonts/ttf/Fraunces72pt-SemiBold.ttf`) und Instrument Sans Regular/SemiBold aus github.com/Instrument/instrument-sans (Commit 7fa22308a3d0, `fonts/ttf/…`) — das offizielle Repo laut Google Fonts (`ofl/instrumentsans/METADATA.pb`); github.com/googlefonts/instrument-sans gibt es nicht. Geladen nur über `ladeTeilenBildSchriften` (`src/lib/teilen-bild-quellen.ts`), für die Route in `outputFileTracingIncludes` eingetragen. Ein neuer Schnitt nur mit Quelle, Commit und Lizenzdatei.

**Next 16:**
- `params` und `searchParams` sind **Promises** → `const { farmSlug } = await params`.
- Langsame Arbeit nach der Antwort: `after()` aus `next/server`, gekapselt in `nachDerAntwort()` (`src/lib/nach-der-antwort.ts`). Nie `after()` direkt aufrufen.
- **Cache-Entwertung hat sich geändert, und zwar still.** `revalidateTag(tag)` mit
  einem Argument warnt zur Laufzeit und ist typseitig unvollständig — die Signatur
  ist jetzt `revalidateTag(tag, profile)`. Aus einer **Server Action** gehört
  stattdessen `updateTag(tag)`: ein Argument, sofortige Entwertung, „lies deine
  eigene Schreibung". Es **wirft** außerhalb einer Server Action, also auch in
  Route-Handlern — dort bleibt `revalidateTag` mit zweitem Argument. Dazu neu:
  `refresh()` aktualisiert nur den Client-Cache, keine Daten.
- Ein Helfer, der in Action, Route, Cron und beim Rendern einer Seite gleich läuft, nimmt `revalidateTag(tag, { expire: 0 })` über `nachDerAntwort` statt `updateTag`; beim Rendern wirft jede Cache-Entwertung (src/server/hofliste-erneuern.ts, N19-Ergänzung 21.10.2026).
- **`revalidatePath` erreicht keinen `unstable_cache`-Eintrag.** Wer einen solchen
  Cache anlegt, gibt ihm ein `tags` — ohne Etikett gibt es keinen Weg, ihn vor
  Ablauf zu leeren. Vorbild: `src/app/(public)/hoefe/page.tsx` mit
  `HOEFE_CACHE_TAG` aus `src/lib/hofuebersicht.ts`, entwertet in
  `src/server/actions/products.ts`.

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
| QR-Code | `qrcode` (^1.5.4, Typen `@types/qrcode`) — nur die Matrix über `qrPfad` in `src/lib/qr-code.ts`, gezeichnet als eigener SVG-Pfad (Teilen-Bild, QR-Plakat; seit Nr. 21, Freigabe §3) | `QRCode.toDataURL`/`toString` im Code (fremde Grafik, zweite Gestalt), QR-Dienste im Netz |
| Teilen-Bild | `next/og` (`ImageResponse`, Satori) — nur in Routen-Handlern, Farben als Werte mit Lint-Ausnahme je Zeile (Satori kennt keine CSS-Variablen), Schriften als TTF (oben); Bilder vorher über `sharp` in JPEG, weil Satori nur PNG, JPEG, GIF und SVG zeichnet (kein WebP); das fertige Bild geht nachher über `sharp` als JPEG hinaus (Qualität 82, mozjpeg; Register T7), nie als PNG | Puppeteer/Canvas-Pakete, Bilddienste im Netz |
| Server-State | React Query (nur wo vorhanden) | Neue globale Stores |
| Bausteinverzeichnis | `pnpm bausteine` (`scripts/bausteine.ts`, `tsx` + die Compiler-API des vorhandenen `typescript`, nur Syntaxbaum) erzeugt `docs/ai/BAUSTEINE.md` | Von Hand gepflegte Liste, zweites Parser-Paket (ts-morph, acorn), Zeitstempel in der Datei |
| Illustrationen prüfen | `pnpm illustrationen` (`scripts/illustrationen.ts`, `tsx` + das vorhandene `sharp`) prüft `public/categories/`: WebP, 1024 × 1024, höchstens 80 KB, einfarbiger Rand; eigener CI-Schritt neben dem Lint, nicht Teil von `build` (Register I1) | Prüfung von Hand, ein weiteres Bildpaket |
| Marken-Icons | `pnpm marke` (`scripts/marke.ts`, `tsx` + das vorhandene `sharp`) erzeugt Favicon (PNG-in-ICO, Kopf von Hand), `icon.svg`, Apple-Icon und App-Icons aus `public/marke/*.svg`; `tests/marke-bilder.test.ts` vergleicht sie mit dem Repo (Register M1, Nr. 92) | Von Hand verkleinerte Icons, ein ICO-Paket, eine zweite Zeichnung der Marke im Code |

Nach dem Build sucht ein CI-Schritt in der Trace-Datei der Hofseite eine Unterkategorie-Datei; fehlt sie, wird die CI rot (sonst fehlen Illustrationen in Produktion still, wenn `assetExists` umgebaut wird). Den Schritt baut Nr. 75 (Regelvorschlag 74, Lauf 11; freigegeben 13.10.2026).

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
5. Neue Versionen erst ab 14 Tagen (`minimumReleaseAge`, G6). Eine dringende Sicherheitskorrektur ist die einzige Ausnahme: nur mit Freigabe, je Version in `minimumReleaseAgeExclude`, mit Kommentar und Datum.

Nach der Freigabe: hier in die Tabelle eintragen.

---

## 5. Laufzeitumgebung — Konsequenzen für den Code

- **Vercel, serverlos.** Kein verlässlicher Prozess-Zustand zwischen Requests. In-Memory-Zähler (z. B. `src/lib/rate-limit.ts`) gelten **pro Instanz** — bekannt und für den Pilotbetrieb akzeptiert, aber nie als harte Sicherheitsgrenze behandeln.
- **Cron:** Seit 19.10.2026 läuft das Projekt auf Vercel Pro. Nie eine Frist oder Geschäftsregel von einem Cron abhängig machen. Cron ist Aufräumer, nie die Wahrheit.
- **Kein Dateisystem-Schreibzugriff.** Uploads gehen an Vercel Blob.
- **Kalte Starts.** Nichts Teures auf Modulebene ausführen.
- **Env-Variablen** ausschließlich über `@/lib/env` (Zod-validiert). Nie `process.env.X` direkt lesen — Ausnahmen: `NODE_ENV` und die Build-Konfiguration `next.config.ts` (läuft vor der App, `SENTRY_AUTH_TOKEN`).
- **Der Stichtag der Live-Schaltung** (`STRIPE_LIVE_AB`, Register Z4) ausschließlich über `@/lib/umgebung-server` (`STRIPE_LIVE_AB`): Nur dort wird `env.STRIPE_LIVE_AB` gelesen, geprüft rein in `leseStripeLiveAb` (`@/lib/umgebung`). Reine Regeln bekommen ihn als Parameter, an den Browser geht nur der fertige Hinweis-Satz.
- **Die Adresse der App** (`APP_URL`) und die Umgebung (`UMGEBUNG`: produktion / preview / lokal) ausschließlich über `@/lib/umgebung-server`. Nie `NEXT_PUBLIC_APP_URL` selbst lesen, nie `?? 'http://localhost:3000'` in einer Datei — in Previews ist die Variable nicht gesetzt (Ausnahme seit Nr. 43: die Testumgebung, Branch `staging`, dort nur geprüft als https-Adresse), und genau dieser Ersatz hat dort den Login zerstört. Die Entscheidung selbst ist rein und getestet: `@/lib/umgebung`. Im Browser gibt es die Adresse nur als Prop vom Server (Vorbild: `onboarding/page.tsx`), nie über `process.env`.

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
