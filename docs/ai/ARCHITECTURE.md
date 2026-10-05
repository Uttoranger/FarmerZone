# ARCHITECTURE

---

## 1. Schichten

```
UI            src/app/**/page.tsx, src/components/**
                 ↓ ruft auf, kennt keine DB
DOMAIN        src/lib/<fachregel>.ts        ← rein, ohne I/O, direkt testbar
SERVERGRENZE  src/server/actions/**  src/server/queries/**  src/app/api/**
                 ↓ einzige Schicht mit DB-Zugriff
DATEN         Prisma über @/lib/prisma
```

**Die eine Regel, aus der alle anderen folgen:** Fachliche Entscheidungen gehören in eine reine Funktion in `src/lib/`, die ohne Datenbank testbar ist. Die Servergrenze beschafft Daten, ruft die Entscheidung auf, schreibt das Ergebnis.

Vorbild: `src/lib/reservierung.ts` entscheidet (rein, 174 Tests ohne DB), `src/server/warenkorb.ts` wendet an, `src/app/api/checkout/route.ts` schreibt.

### Verboten
- **Keine** Prisma-Aufrufe in `src/components/**`.
- **Keine** Prisma-Aufrufe in `src/lib/<fachregel>.ts` (Ausnahmen: `prisma.ts`, `auth.ts` selbst).
- **Keine** Geschäftsentscheidung in einer React-Komponente (Rabatt, Frist, Verfügbarkeit, Preis).
- **Keine** Geschäftsentscheidung in einem API-Route-Handler. Handler = Eingang, Validierung, Aufruf, Antwort.
- **Kein** direkter Aufruf einer Server Action aus einer anderen Server Action, wenn die gemeinsame Logik in `lib/` gehört.

---

## 2. Ordner — was gehört wohin

| Ordner | Inhalt | Nie hier |
|---|---|---|
| `src/app/(public)/` | Öffentliche Seiten: Hofseiten, Hofübersicht, Checkout, Rechtstexte | Auth-pflichtige Seiten |
| `src/app/(farmer)/` | Bauern-Bereich, auth-pflichtig | Öffentliches |
| `src/app/(auth)/` | Login, Registrierung, Passwort | Anderes |
| `src/app/admin/` | Betreiber-Ansicht, Rolle ADMIN | Bauern-Funktionen |
| `src/app/api/` | Nur wo eine Server Action nicht reicht (s. Abschnitt 3) | Alles, was Action sein kann |
| `src/components/<bereich>/` | Bereichsspezifische Komponenten | Fachregeln, DB |
| `src/components/ui/` | Generische Bausteine (shadcn-Stil) | Domänenwissen, Texte wie "Hof" |
| `src/lib/` | Reine Fachregeln **und** Infrastrukturkapseln | Prisma-Aufrufe in Fachregeln |
| `src/server/queries/` | Lesen aus der DB | Schreiben |
| `src/server/actions/` | Schreiben, `'use server'` | Reine Fachlogik |
| `src/schemas/` | Zod-Schemas, geteilt Client/Server | Serverseitige Importe (läuft auch im Browser) |
| `src/emails/` | React-Email-Templates | Versandlogik (→ `lib/email.ts`) |
| `tests/` | Alle Tests, flach | — |

### `src/lib/` ist voll — Regel beim Hinzufügen
94 Dateien (Stand 2026-09-29), gemischter Zweck. Bevor eine neue entsteht:
1. Passt es in eine bestehende Datei? Dann dorthin.
2. Ist es eine **Fachregel**? → eigene Datei, rein, ohne Import von `prisma`/`auth`/`stripe`.
3. Ist es eine **Infrastrukturkapsel** (externer Dienst)? → `server-only` importieren.
4. Ist es ein **React-Hook**? → Präfix `use-` (`use-cart.ts`).

---

## 3. Server Action oder API-Route?

**Standard ist die Server Action.** API-Route nur bei einem dieser Gründe:

| Grund | Beispiel |
|---|---|
| Externer Aufrufer | Stripe-Webhook, Vercel Cron |
| Aufruf per Link (GET) — nur lesen oder weiterleiten, nie einen Zustand ändern; einzige Ausnahme Fristfreigabe beim Lesen (§5) | Bestätigungslink älterer E-Mails |
| Aufruf aus `fetch()` im Browser mit eigener Fehlerbehandlung | `/api/reserve`, `/api/checkout` |
| Nicht-JSON-Antwort | Export, Datei |

Sonst: Server Action. **Keine** API-Route bauen, nur weil das Muster vertraut ist.

### Pflichten jeder API-Route
1. Rate-Limit (`enforceRateLimit`) bei allem, was schreibt oder Bestand hält.
2. Zod-Validierung des Bodys **und** der URL-Parameter.
3. Auth- bzw. Token-Prüfung, **fail-closed**: fehlt das Geheimnis, wird gesperrt, nicht geöffnet.
4. Antwortform nach `CODING_STANDARDS.md`.
5. Langsames über `nachDerAntwort()`.

### Triage-Routen: ein Token je Recht
Der Briefkasten hat zwei API-Routen, weil ihre Aufrufer extern sind (CLI, GitHub Action):

| Route | Token | Darf |
|---|---|---|
| `GET /api/triage/export` | `TRIAGE_TOKEN` | nur lesen |
| `POST /api/triage/status` | `TRIAGE_WRITE_TOKEN` (Rechner des Entwicklers) | `VERMUTLICH_WUNSCH`, `GEPLANT` — nur Art FEHLER |
| `POST /api/triage/status` | `TRIAGE_MERGE_TOKEN` (nur GitHub Actions) | `ERLEDIGT`, Wiederöffnen (`ERLEDIGT → GEPRUEFT`) |

- Ein Token je Recht, alle drei verschieden — sind zwei gleich, lehnt die Route alles ab. Ein Token, der für den Status nicht gilt → 403.
- Welcher Übergang erlaubt ist und was er schreibt, entscheidet `src/lib/triage-status.ts`; die Route liest, fragt dort und schreibt per `updateMany` auf genau den gelesenen Stand (sonst 409).
- Die Schreibroute schreibt nie Text, den ein Melder sieht, außer ihren festen Sätzen, und nie die Art. Body strikt: ein unbekanntes Feld ist 400.
- Den Merge-Token gibt es nie auf einem Rechner mit Agenten — abschließen kann nur das Deployment.

### Pflichten jeder Server Action
1. `'use server'` als erste Zeile.
2. Auth prüfen — **nie** der Eingabe vertrauen, wer der Aufrufer ist.
3. **Besitz prüfen:** Gehört der Datensatz zum Hof des eingeloggten Nutzers? Jedes Mal.
4. Zod-Validierung des Arguments.
5. `revalidatePath()` für jede betroffene Route.

### Die Admin-Prüfung: `src/server/admin-wache.ts`

Für den Betreiber-Bereich gibt es **eine** Antwort auf „darf dieser Mensch die
Plattform verwalten?", mit zwei Ausgängen:

| Wo | Aufruf | Verhalten |
|---|---|---|
| Admin-**Seite** (`src/app/admin/**/page.tsx`) | `await verlangeAdminSeite()` | nicht angemeldet → `redirect('/login')`, angemeldet ohne Recht → `notFound()` |
| Admin-**Aktion** (`'use server'`) | `await verlangeAdminAktion()` | `{ ok: true, userId } \| { error }` — die Antwortform der Actions |

- Beide lesen das Recht über `isAdminUser` **frisch aus der Datenbank**, nie aus
  der Session: `isAdmin` steckt bewusst nicht in den
  Better-Auth-additionalFields, damit ein zurückgenommenes Recht sofort greift.
- `notFound()` statt 403: Der Bereich gibt sich Unbefugten nicht zu erkennen.
- Die Prüfung steht in **jeder** Aktion, nicht nur in der Seite. Eine Seite
  schützt die Ansicht, eine Aktion schützt die Wirkung.
- Im Admin gibt es keine Hofzugehörigkeit — das Admin-Recht **ist** die
  Besitzprüfung. Keine eigene Fassung daneben bauen: Vorher lag die Frage an
  vier Stellen und in zwei Implementierungen.

---

## 4. Datenfluss

### Lesen
```
Server Component → src/server/queries/*  → Prisma → Props → Komponente
```
- Standard ist die Server Component.
- `'use client'` nur bei Interaktivität (State, Event-Handler, Browser-API).
- `'use client'` so tief wie möglich im Baum — nie ein ganzes Layout zur Client-Komponente machen.
- Serialisierbarkeit beachten: `Decimal` und `Date` nicht roh in Client-Komponenten reichen (→ `CODING_STANDARDS.md`).

### Schreiben
```
Client-Komponente → Server Action → Zod → Fachregel (lib) → Prisma → revalidatePath
```

### State-Regeln
| Art | Wo | Nicht |
|---|---|---|
| Server-Daten | Server Component, per Props | Nicht in Client-State spiegeln |
| Formular | `react-hook-form` | Kein `useState` je Feld |
| UI-lokal (offen/zu) | `useState` | Nicht global |
| Warenkorb | `use-cart.ts` (localStorage) + serverseitige Reservierung; der Speicher nur über `src/lib/warenkorb-speicher.ts` (ein Schlüssel, Zod, Ereignis `WARENKORB_EREIGNIS` nach jedem Schreiben) | Warenkorb ist **nie** die Wahrheit über Verfügbarkeit. Kein zweiter Zugriff auf den Schlüssel (`tests/warenkorb-speicher.test.ts`) |
| Filter/Suche in URL | `useSearchParams` lesen, Zod-Schema in `src/schemas/` parst und verwirft Ungültiges still; schreiben mit `window.history.replaceState(null, …)` (Next gleicht `useSearchParams` ab, kein Server-Roundtrip je Tipp — mit `window.history.state` als Zustand gleicht Next NICHT ab) oder `router.replace`, wenn der Server neu rendern soll. Filter sind echte Links (`FilterChip`); wendet die Seite sie selbst an, schreibt der `onNavigate` des Links per `replaceState` und ruft `preventDefault()`, `prefetch` ist dann aus (Vorbild `/hoefe`, `beimNavigieren` in `src/components/hoefe/entdecken-teile.tsx`) | Nicht nur im State — Ergebnisse müssen teilbar sein. **Nie** Standort/Koordinaten in die URL |
| Auftrag in der URL (Dialog öffnen) | `?neu=1` / `?edit=<id>` über `useUrlAuftrag` (`src/lib/use-url-auftrag.ts`): liest `useSearchParams` (Zod: `src/schemas/url-auftrag.ts`), führt den Auftrag einmal aus und nimmt ihn per `replaceState` aus der Adresse | Nicht die `searchParams` der Seite als Startwert — ein zweiter Auftrag auf derselben Seite (Plus bei offenem `/products`) käme nie an. Nie einen Dialog nur für die URL bauen: der vorhandene öffnet |
| Theme | `next-themes`, `ThemeProvider` in `src/app/layout.tsx` (`attribute="data-theme"`, `defaultTheme="system"`; Inline-Skript vor der Hydration, Regeln in `docs/ai/DESIGN_SYSTEM.md`) | Kein eigener Provider, keine Spalte in der Datenbank — die Wahl gehört dem Gerät |
| Gemerkter Foto-Weg | localStorage, nur über `src/lib/foto-weg-speicher.ts` (ein Schlüssel, Zod: `src/schemas/foto-weg.ts`, nichts wirft); ob gesetzt oder gelöscht wird, entscheidet `merkerNachErgebnis` in `src/lib/foto-wege.ts` | Kein zweiter Zugriff auf den Schlüssel, keine Spalte in der Datenbank — der Weg gehört dem Gerät |
| Gerätevorliebe, die der Server beim Rendern braucht (weggeklickte Erste-Schritte-Karte) | Cookie, gesetzt in einer Server Action (`src/server/actions/erste-schritte.ts`: Wert = Hof-ID der Sitzung, ein Jahr, `SameSite=Lax`, `httpOnly`), gelesen in der Server Component über `cookies()`; die Entscheidung als reine Funktion (`ersteSchritteAusgeblendet`, `ersteSchritteAnzeige` in `src/lib/erste-schritte.ts`) | Nicht localStorage: Der Server rendert die Seite fertig, nichts blitzt auf und nichts rutscht nach. Keine Spalte in der Datenbank |

**Kein globaler Store.** Wenn etwas global wirkt, gehört es meist in die URL oder auf den Server.

---

### Kundenseiten: Kopfzeile und Rückweg
- Jede Seite unter `src/app/(public)/` rendert `KundenKopf` (`src/components/shared/kunden-kopf.tsx`) mit ihrer `KundenSeite`, bis ihr Gate sie in die `KundeShell` umstellt; die Startseite trägt seit Nr. 07 die `KundeShell` (Sitzung über `istKundensitzung`: nur die Kunden-Anmeldung zählt als angemeldet), `/hoefe` seit Nr. 09 (bleibt `force-dynamic` wegen der Filter im Server-HTML, liest die Sitzung aber ebenfalls über `KundeShellMitSitzung`). Die Hofseite seit Nr. 10 ebenso (dynamisch wegen Suchparametern und Fristfreigabe beim Lesen; die Sitzung liest der Server nur für `?vorschau=1`); ihr Rückweg „‹ Alle Höfe" steht als Zeile über dem Titelbild und nutzt `rueckweg`/`useRueckwegKlick` wie bisher. Eine Seite, die sonst statisch sein kann, liest die Sitzung **nicht** auf dem Server (`headers()`, `cookies()`, `auth.api` machen sie dynamisch), sondern nimmt `KundeShellMitSitzung` (`useSession` im Browser) und `export const revalidate`; Vorbild ist die Startseite (`tests/startseite.test.ts`). Die öffentliche Hofliste kommt immer aus `ladeOeffentlicheHoefe` (`src/server/queries/oeffentliche-hoefe.ts`) — ein Cache-Eintrag unter `HOEFE_CACHE_TAG`, nie ein eigener `unstable_cache` je Seite. `tests/kunden-kopf.test.ts` kennt jede Seite — eine neue fällt dort auf.
- **Die Produktseite** (`/[farmSlug]/produkt/[id]`, seit Nr. 11) lädt über denselben Lader wie die Hofseite (`ladeHofseiteGeteilt`: öffentliche Höfe, Fristfreigabe, Vorschau nur für den Besitzer) und zeigt das Produkt nur, wenn es in der Produktliste DIESES Hofs steht und im Shop ist (`sichtbaresProdukt`) — sonst 404; eine ID allein öffnet nie etwas. Keine eigene Produktabfrage daneben. Die Vorschau erreicht sie über `vorschauLink(slug, 'produkt/<id>')`; ihr Rückweg ist `{ art: 'produkt' }` (zum Reiter Produkte). Die gewählte Größe steht als `?groesse=` (Zod: `src/schemas/produktdetail.ts`), gilt nur innerhalb der Familie.
- Form (Knöpfe über dem Titelbild oder Leiste, Warenkorb-Symbol, Rückweg-Zeile) und Rückweg entscheidet `src/lib/kunden-kopf.ts`, nicht die Komponente.
- „Zurück" ist immer ein echter Link auf das übergeordnete Ziel; nur bei eigenem Vorgänger (`eigenerVorgaengerJetzt`: Navigation API, sonst `RueckwegMerker` im Root-Layout) geht es per `router.back()`. **Nie** `history.length` oder `document.referrer` für einen Rückweg. Bestätigung und Bestellverfolgung nie über den Verlauf.
- Wer über den Ersatz-Link hinaufsteigt, hat dort keinen eigenen Vorgänger (`merkeHinauf`) — sonst pendelt „Zurück" zwischen zwei Seiten. Die Browser-Zeile („‹ Alle Höfe") nimmt den Verlauf nur, wenn er genau zu ihrem Ziel führt (`zeileNimmtVerlauf`).
- Im Checkout kein Weg hinaus, sobald eine Bestellung angelegt ist (Zahlungsschritt, auch nach dessen „Zurück"): Ein Weg hinaus und zurück ergäbe eine zweite. Seit Nr. 12 steht die Kasse in der Fokus-Shell; ihr „Zurück" ist dann ein Knopf zwischen Angaben und Zahlung (`kassenZurueck`, `src/lib/kasse.ts`), die Angaben stehen fest. Die Weiche nach der Antwort von `/api/checkout` folgt der Antwort (`clientSecret` → Zahlung, `requiresConfirmation` → Bestätigung), nie der Auswahl im Formular. Bekannte Grenze: Solange die Anfrage läuft, steht der Link zum Hof noch.
- Der Rückweg der Hofseite nimmt den **angezeigten** Bereich (`angezeigterBereich` in `src/lib/bereiche-anzeige.ts`), nicht den URL-Parameter.
- Overlays über der Seite sind `ui/sheet` oder `ui/dialog`: Base UI sperrt das Scrollen und gibt den Fokus ohne Scrollen zurück. Bekannte Grenze: Auf iOS sperrt auch Base UI nur über `overflow: hidden` und stellt die Scrollstelle nicht wieder her. Eine eigene Ebene (Vorbild: die Bildansicht der Hofseite, EIN Hook `useBildansicht` in `src/components/hofseite/bildansicht.tsx` für Kundenansicht und Besitzer-Galerie) merkt sich beim Öffnen die Scrollstelle, stellt sie **nur beim echten Schließen** wieder her (`stelleNachBildansicht` — nie beim Verlassen der Seite, sonst wird die neue Seite verschoben) und fokussiert mit `preventScroll` (`tests/hofseite-bildansicht.test.ts`). Die zwei Ebenen in `foto-quellen.tsx` ohne Sperre: §6.
- Die Kopfzeile klebt (`sticky`, Ebene 40): Umgebungsbanner (60) darüber, Sheets/Dialoge (50) davor, Sektionsleiste (30) darunter. Ausnahme Hofseite am Handy: Die Leiste ist `fixed` und wird erst eingehängt, wenn das Titelbild verschwindet — `sticky` verschöbe beim Einhängen den Inhalt. Eigene Stapelebenen (`isolate`) um alles mit hohen z-Werten (Leaflet), sonst liegt es über der Kopfzeile.

### Vorschaubild und Icons
- Das Vorschaubild beim Teilen kommt aus `src/lib/vorschaubild.ts`: Startseite `STARTSEITE_VORSCHAUBILD` (`public/og/startseite.jpg`), Hofseite `hofVorschaubild` — ihr Titelbild (`titelbildFoto`), sonst das der Startseite. **Nie** eine Datei `opengraph-image.*` oder `twitter-image.*` unter `src/app/` (`tests/vorschaubild.test.ts`; warum: `DEVELOPMENT.md`, „Marke und Startseite").
- Relative Bildpfade in den Metadaten löst `metadataBase` im Root-Layout auf — nur über `metadatenBasis(UMGEBUNG.appUrl)`, nie `new URL(...)` direkt.
- Favicon (`src/app/favicon.ico`) und Apple-Icon (`src/app/apple-icon.png`) wirken über die Dateikonvention; das Manifest (`src/app/manifest.ts`) führt nur `public/icons/` — `tests/manifest.test.ts` prüft Datei und Größe jedes Eintrags.

### Bauern-Bereich: Navigation
- Eine Ordnung für Handy und Browser: `src/lib/bauern-navigation.ts` (Hauptpunkte, „Verkauf und Kunden", unten; dazu die Reiter von „Mein Hof"). „Neu" gibt es zweimal: `NEU` fürs Plus-Blatt am Handy (drei Einträge) und `NEU_BROWSER` fürs Dropdown des Neu-Knopfs in der Seitenleiste (Produkt, Beitrag). Hauptpunkte, die in der Handy-Leiste keinen Platz haben (`NUR_IM_MEHR`, heute „Produkte"), stehen oben im Mehr-Blatt und zählen für „Mehr" als aktiv. Die Komponente `farmer-nav.tsx` ordnet nur Symbole zu und zeichnet.
- „Produkte" ist ein eigener Hauptpunkt (Tagesgeschäft) mit eigener Überschrift auf `/products` — ohne `MeinHofKopf`; der gehört nur zu Hofseite und Beiträgen.
- „Mein Hof" ist ein Punkt über mehreren Seiten (`auchAktivAuf`). Jede dieser Seiten rendert oben `MeinHofKopf` mit ihrem Reiter (`MEIN_HOF_REITER`); Unterseiten, auf denen etwas getan wird (`/status/new`), nicht. Eine neue Seite unter Mein Hof: Reiter in der Konfiguration **und** der Kopf in der Seite. Ebenso ist „Hilfe und Rückmeldung" ein Punkt über `/meldungen` und `/fehler-melden`.
- Der Kopf zeigt die Adresse der Hofseite (`hofAdresse(APP_URL, slug)`) und das Schild aus `hofZustand(...).schild` (grün Öffentlich, bernstein Pausiert, grau Noch nicht freigegeben; stillgelegt keins — den Zustand sagt der Balken). Link, Kopieren, Kundenansicht und Teilen nur, wenn `hofZustand(...).oeffentlich` — nie ein Link ins Leere; sonst steht die Adresse als reiner Text.
- Neues Teilen des Hof-Links läuft über `teileHof` (`src/components/shared/hof-teilen.ts`). `farm-page-client.tsx` und `shop-link-banner.tsx` kopieren noch selbst (Altbestand, `DEVELOPMENT.md` „Mein Hof", Offen).
- Das Menü unten (Mehr-Blatt, unterer Block der Seitenleiste) gehört der Person: Initialen und Name, keine zweite Hofkarte. Der Hof tritt in der Leiste als „Mein Hof" auf, im Browser als Karte am Kopf der Seitenleiste.
- Titelbild: Foto oder Verlauf entscheidet `titelbildFoto`, den Verlauf `titelbildVerlauf` (`src/lib/mein-hof.ts`) — nie die Bedingung nachschreiben.
- Neue Seite unter `src/app/(farmer)/`: Punkt in der Konfiguration **und** Eintrag in `FARMER_PATHS` samt `matcher` von `src/proxy.ts`. `tests/bauern-navigation.test.ts` und `tests/proxy-pfade.test.ts` fallen sonst rot.
- Handlungen („Verkauf eintragen", „Produkt anlegen") sind Einträge in `NEU` und öffnen den vorhandenen Dialog über den URL-Auftrag (§4 State-Regeln), keinen eigenen.
- **Die Hofseite gibt es genau einmal unter /[farmSlug]. Vorschauen sind dieselbe Route mit ?vorschau=1, nie ein Nachbau.** `FarmPageView` verzweigt: Kundinnen und Vorschau → `HofseiteKunde` (`src/components/hofseite/`, neues Design, nur dort eingebunden); Besitzer im Bearbeitungsmodus unter lg → die Bestandsansicht bis Gate 5. Die „Kundenansicht" des Besitzers in `farm-page-client.tsx` ist ein `<iframe>` auf `vorschauLink(slug)`, kein Nachbau.
- **Vorschau der Hofseite** (`/[farmSlug]?vorschau=1`): Was sie von der Seite für Kundinnen unterscheidet (der Besitzer sieht den Hof vor der Freigabe, immer `noindex`, Kaufen wirkungslos), entscheidet allein `ansichtsModus` (`src/lib/ansichts-modus.ts`), serverseitig im Lader `ladeHofseite` (`src/server/hofseite-vorschau.ts`, mit nachgebildeter Sitzung getestet; die Seite nimmt die `cache`-Fassung `ladeHofseiteGeteilt`, damit Metadaten und Seite einmal laden). Seite und Ansicht lesen nur das Ergebnis (`ansicht`), nie den Parameter; die Nutzer-ID aus dem Modus (`besitzerVorFreigabe`) bleibt im Lader, an Seite und Client-Komponente geht nur `SeitenAnsicht`; Vorschau-Adressen schreibt nur `vorschauLink` bzw. `vorschauAdresse` (`src/lib/hofseite-vorschau.ts`), die Konstante `VORSCHAU_PARAMETER` steht nirgends sonst; `tests/hofseite-einmal.test.ts` sucht nach jeder anderen Lesestelle in `src/` (außerhalb nur die Header-Regel in `next.config.ts`) und lässt `FarmPageView` nur von der Hofseite und `farm-page-client.tsx` einbinden. Nur der angemeldete Besitzer bekommt die Vorschau; alle anderen sehen die Seite wie ohne Parameter. Ob die Hofseite einen Korb führt, sagt **eine** Regel, `korbErlaubt` — jeder Weg in den Korb (Kaufknopf, Nachbestell-Link, Anker, Knopf, Sheet) fragt sie; kein zweiter Maßstab daneben. Einbetten erlaubt **nur** diese Route mit dem Parameter, und nur für uns selbst (`next.config.ts`, `frame-ancestors 'self'`); jede andere Seite bleibt `DENY` — `tests/sicherheits-header.test.ts` prüft das mit Nexts Pfadvergleich und gleicht die Ausschlussliste `KEINE_HOFSEITE` mit den Ordnern unter `src/app` ab. Ein neuer Routenordner gehört in diese Liste **und** in `RESERVED_SLUGS` (`src/lib/slug.ts`) — sonst könnte ein Hof seinen Namen als Slug bekommen und wäre nie erreichbar; `tests/reservierte-slugs.test.ts` prüft beide Listen gegen die echten Ordner (durch alle Routengruppen) und gegeneinander. Die Sperre wirkt nur beim Anlegen (`createFarm`, `checkSlugAvailability`); einen Slug ändern kann heute niemand.
- Der Editor ab lg (`components/farmer/hofseite-editor.tsx`) speichert nur über die vorhandenen Aktionen der Einstellungen; was er zeigt, entscheidet `src/lib/hofseite-fortschritt.ts`. Seine Formulare prüfen mit den Schemas der Aktionen selbst (`src/schemas/hofprofil.ts`, `src/schemas/auftritt.ts`, per `.pick()`) — ein Schema, das ein Client-Formular wiederverwendet, liegt in `src/schemas/`, nicht in der `'use server'`-Datei. Nachrichten zwischen Editor und Vorschau gehen durch `src/schemas/hofseite-vorschau.ts` und prüfen den Ursprung (`leseMarkierung`, `leseBereit`). Details: `docs/entwicklung/hofseite-editor-browser.md`.
- Die Blätter „Neu" und „Mehr" sind `ui/sheet` (Base UI Dialog): Escape, Tipp daneben, Fokus im Blatt. Die Leiste hebt sich nur, solange eines offen ist, auf Ebene 60 — sonst bleibt sie auf 50, damit andere Dialoge sie verdecken.

### Shells des neuen Designs (Gate 2)
- Je Welt eine Shell in `src/components/shells/`: `KundeShell` (Kopfzeile ab 768 px, Unterleiste darunter) und `KundeFokusShell` (Zurück, Titel als `h1`, eine Aktionsleiste — für Checkout, Zahlung, Bestätigung, Bar-Bestätigung; die Produktseite behält den Kopf und nimmt `KundeShell` mit `unterleiste={false}`), `HofShell` (Seitenleiste ab 768 px, Unterleiste mit Neu- und Mehr-Blatt), `AdminShell` (Kopf mit Reitern, keine Hof-Seitenleiste). Jede setzt `data-design="neu"`, einen Sprunglink „Zum Inhalt springen" und genau ein `<main id="inhalt">`; alles Sichtbare steht in `header`/`aside`/`nav`/`main`.
- **Navigation aus EINER Quelle je Welt, rein und getestet:** Kunde `src/lib/kunden-navigation.ts` (`kundenNavigation({ angemeldet })`), Hof `hofNavigation({ isAdmin })` in `src/lib/bauern-navigation.ts` (baut aus denselben Punkten wie die Bestandsnavigation; die Bestandsexporte bleiben unverändert, bis die letzte Hof-Route umgezogen ist), Admin `src/lib/admin-navigation.ts`. Web- und Handy-Teil einer Shell lesen dieselbe Funktion; die Shell ordnet nur Symbole zu. Die Navigation ist nie die Sperre — Admin-Seiten prüfen mit `verlangeAdminSeite`.
- **Kein Big Bang:** Eine bestehende Route zieht erst mit ihrem Gate in eine Shell (Layout tauscht die Bestandsnavigation gegen die Shell). `tests/shells.test.ts` lässt Shells nur unter `src/app/intern/` und in den Routen der Liste `UMGESTELLT` zu — wer eine Route umstellt, trägt sie dort ein (seit Nr. 07: `page.tsx`, die Startseite; seit Nr. 08: `account/login/page.tsx` und `(auth)/login/page.tsx`; seit Nr. 09: `(public)/hoefe/page.tsx`, Entdecken; seit Nr. 10: `(public)/[farmSlug]/page.tsx`, die Hofseite; seit Nr. 11: `(public)/[farmSlug]/produkt/[id]/page.tsx` und ihre `not-found.tsx`, die Produktseite; seit Nr. 12 die Kasse `(public)/[farmSlug]/checkout/page.tsx` — sie bindet die Fokus-Shell über `CheckoutForm` ein, weil ihr „Zurück" am Zustand im Browser hängt; solche Routen stehen in `UMGESTELLT_UEBER_KOMPONENTE`).
- Zahlen (offene Bestellungen, Meldungen, wartende Höfe) und `isAdmin` lädt das Layout serverseitig und gibt sie als Props hinein; die Shell lädt nichts.

### `/intern` — Werkzeugseiten des Betreibers
- `/intern/bausteine` (Vorschau aller Bausteine) und `/intern/bausteine/shell/<variante>` (jede Shell in voller Fenstergröße mit erfundenem Inhalt). Jede Seite ruft als erste Anweisung `await verlangeAdminSeite()`; das Layout `src/app/intern/layout.tsx` setzt `robots: noindex, nofollow`, und keine Seite darf das mit einem eigenen `robots` aufheben (Next.js ersetzt den Schlüssel flach). `tests/intern-wache.test.ts` prüft beides für jede `page.tsx` darunter. Was in der Vorschau echte Wirkung hätte (Abmelden), bekommt dort einen Ersatz-Handler (`onAbmelden` der HofShell). `intern` steht in `RESERVED_SLUGS` (`src/lib/slug.ts`) und in `KEINE_HOFSEITE` (`next.config.ts`).
- Beide Themes werden über den Theme-Schalter abgenommen, nicht nebeneinander: Die Tokens hängen am `<html>`, ein verschachteltes `data-theme` erreicht die shadcn-Zuordnung nicht.

## 5. Domänen-Invarianten

Diese Regeln sind fachlich, nicht technisch. Verletzung kostet Geld oder Vertrauen.

- **Reservierung bucht keinen Bestand ab.** `Product.stock` sinkt erst beim Kauf. `StockReservation` ist ein weicher Halt, der die Menge nur vor **anderen** Sitzungen verbirgt. Verfällt er, gibt es nichts zurückzubuchen.
- **Die 15-Minuten-Frist gilt beim Lesen.** Jede Abfrage fremder Halte filtert auf `expiresAt > jetzt`. Nie einem Cron vertrauen.
- **Eine offene Bestellung hat eine Frist, und auch sie gilt beim Lesen.** Der Checkout bucht den Bestand vor Zahlung bzw. Bestätigung. Wie lange eine Bestellung in PENDING_CONFIRMATION ihre Ware hält, steht nur in `src/lib/fristen.ts`: online 30 Minuten; vor Ort 2 Stunden, höchstens bis zum Beginn des gewählten Abholfensters. Wer Bestand oder offene Bestellungen liest, gibt vorher frei, was darüber ist: `gibVerwaisteFreiOhneRisiko(farmId)` bzw. `gibVerwaisteFreiFuerProdukte(productIds)` (`src/server/verwaiste-bestellungen.ts`). Die Hofseite gibt über `gibVerwaisteFreiFuerSlug` frei, in `ladeHofseite`. Ein neuer Lesepfad ruft eine der drei am Anfang auf; Fehler darin werden gemeldet, nie an den Request weitergegeben. Online wird zuerst der PaymentIntent abgebrochen — **Ausnahme** von „Stripe und Mail kommen danach", weil die Kundin die verfallene Bestellung sonst noch bezahlen könnte; ist er bezahlt oder in Bearbeitung, bleibt die Bestellung stehen und Stripe wird höchstens alle fünf Minuten erneut gefragt. Der tägliche Cron `/api/cron/verwaiste-bestellungen` ist nur das Netz und meldet stehen gebliebene Bestellungen an Sentry.
- **Cron-Routen prüfen `CRON_SECRET` mit `cronBerechtigt`** (`src/lib/geheimnis.ts`): fail-closed, in konstanter Zeit — nie mit `!==`.
- **Bestandsabzug ist bedingt.** `updateMany` mit `stock >= Menge`; bei Teilfehlschlag die bereits gebuchten Positionen gutschreiben.
- **Ein Statuswechsel mit Wirkung auf Bestand oder Geld ist die Sperre.** Er läuft als `updateMany` mit Statusbedingung (Vorlage: `cancelOrder`), `count === 0` heißt „schon erledigt" — nie eine Leseprüfung mit anschließendem blindem `update`. Bestandsbuchungen gehören in DIESELBE Transaktion; Stripe und Mail kommen danach. Auch ein Rückweg (Undo) schreibt bedingt: Er darf eine stornierte Bestellung nie zurückholen.
- **Seiten mit Daten einer Bestellung nur mit signiertem Link.** Bestätigungsseite (`/{hof}/confirm/{id}?sig=`) und Bestellseite (`/{hof}/bestellung/{id}?s=`) prüfen `bestellLinkGilt` (`src/lib/bestell-link.ts`) VOR jeder Datenbankabfrage; ohne gültige Signatur zeigt die Bestätigungsseite nur „eingegangen", ohne Name, E-Mail, Artikel oder Beträge. Die Bestell-ID ist ratbar. Pfade dorthin baut nur der Server (`bestaetigungsPfad`, `bestellungPfad`) — das Geheimnis gehört nie in den Browser; `/api/checkout` liefert den signierten Pfad mit (`bestaetigung`). `tests/bestaetigung-zugang.test.ts` sucht nach selbst gebauten `/confirm/${…}`.
- **Ein Link aus einer Mail ändert nie einen Zustand.** Link-Scanner und Vorschauen der Mailprogramme rufen Links ungefragt auf. Ein GET liest oder leitet weiter; bestätigt, storniert oder bucht wird nur per Knopf (Server Action, POST). **Einzige Ausnahme ist die Fristfreigabe beim Lesen** (`gibVerwaisteFreiOhneRisiko`, wie auf `/{hof}/confirm/{id}` und `/orders`): Sie setzt nur durch, was die Frist ohnehin schon entschieden hat (über der Frist ist die Bestellung verfallen, ob jemand aufräumt oder nicht). Nie löst ein GET eine Bestätigung oder einen anderen Übergang aus, den die Kundin oder der Hof wollen muss. Der Knopf prüft die Frist mit der Zeit NACH seiner eigenen Freigabe (die kann bei Stripe Sekunden dauern), und `confirmedAt` ist genau diese Zeit. Bar-Bestätigung: Die Mail verlinkt `/{hof}/bestaetigen/{token}` (Pfad nur über `barBestaetigungsPfad`), `/api/orders/confirm/{token}` alter Mails leitet nur dorthin weiter. Der Knopf (`src/server/actions/bar-bestaetigung.ts`) bestätigt per `updateMany` auf PENDING_CONFIRMATION **und** den Token, nur solange `barBestaetigungsAnsicht` (`src/lib/bar-bestaetigung.ts`) „offen" sagt (Frist aus `fristVon`), und löscht den Token im selben Schreiben; Mails über `nachDerAntwort`. „Doch nicht" storniert über `storniereUnbezahlteBestellung`. Die Seite zeigt nie Name oder E-Mail der Kundin, `noindex`, `Referrer-Policy: no-referrer`; Sentry entfernt den Token (`sentry-hygiene.ts`).
- **Kundinnen melden sich mit Code an, Höfe mit Passwort (E7).** Länge, Laufzeit, Versuche, Bremsen, Fehlertexte und Ziele nur aus `src/lib/anmeldecode.ts`; Better Auth `emailOTP` übernimmt sie (`ANMELDECODE_PLUGIN_OPTIONEN`) und zählt die Versuche am Code in der `Verification`-Zeile — das ist die Grenze über alle Instanzen, nicht die Speicher-Rate-Limits. Einen Code bekommt nur, wen `codeVersandErlaubt` lässt (nie ein Hof, nie ein Admin). Durchgesetzt im `before`-Hook von `auth.ts`, nie im Versand-Callback — das Plugin legt den Code schon VOR dem Versand an: Anfordern legt für Nicht-Kundinnen keinen Code an (Hook antwortet selbst `{ success: true }`), `/sign-in/email-otp` lehnt sie mit derselben `INVALID_OTP`-Antwort wie ein falscher Code ab. Die Rolle hinter einer Adresse wird immer case-insensitiv gesucht, und zwar mit der Adresse in genau der Form, die das Plugin liest (`adresseWieDasPlugin`: JS-`toLowerCase()`, kein Trim) — das Kleinschreiben nie der Datenbank überlassen (Kelvin-Zeichen U+212A). Die Antwort an den Browser ist immer dieselbe, die Mail geht über `nachDerAntwort()` raus (sonst verrät die Antwortzeit, wer ein Hof ist); der ganze Nachlauf steht im `try`, ein gescheiterter Versand (auch `{ error }` aus `sendRaw`) geht ohne Adresse und Code nach Sentry. Der Code steht nie in Betreff, Vorschautext, Produktions-Log oder Sentry (`sentry-hygiene.ts`). Ungenutzte Auth-Pfade stehen in `GESPERRTE_AUTH_PFADE` (`disabledPaths`), Anfordern nur mit Typ `sign-in`. Wohin es nach der Anmeldung geht, entscheidet `zielNachAnmeldung` auf dem Server (keine offene Weiterleitung; geprüft wird auch das normalisierte Ergebnis, nicht nur die Eingabe) — nie ein Ziel aus der Adresse ungeprüft an `router.push`. Neue Wege mit Code (z. B. „Bestellungen finden") nehmen `KundeCodeFormular` mit eigenem `ziel`, keinen zweiten Ablauf (`tests/anmeldecode.test.ts`, `tests/integration/anmeldecode.int.test.ts`).
- **„Bezahlt" und „bestätigt" zeigt eine Kundenseite nur aus der Datenbank** (`bestaetigungsZustand`, `src/lib/bestaetigung.ts`). Ein URL-Parameter (`?confirmed`, Stripes `redirect_status`) ist höchstens ein Hinweis („Zahlung wird geprüft"), nie ein Zustand.
- **Checkout ist idempotent.** `Order.idempotencyKey` ist unique. Zweiter Request mit gleichem Schlüssel gibt die bestehende Bestellung zurück.
- **Der Abholtermin wird auf dem Server geprüft, vor der Bestandsbuchung.** Wählbar ist nur, was `angeboteneAbholfenster` (`src/lib/abholfenster.ts`) liefert: aktiver PickupSlot mit dem Wochentag des **Wiener** Kalendertags und genau diesen Zeiten, Bestellschluss (Beginn) in der Zukunft, heute bis 13 Tage voraus (`ABHOL_VORLAUF_TAGE`). Das Checkout-Formular bietet mit derselben Funktion an — nie eine zweite Rechnung im Browser. Sonst 409 `ABHOLFENSTER_UNGUELTIG`. **`maxOrders` gilt beim Anlegen:** `imAbholfenster` (`src/server/abholfenster.ts`) sperrt die Zeile des Fensters (`SELECT … FOR UPDATE`), zählt die nicht stornierten Bestellungen und legt in derselben Transaktion an; voll → 409 `ABHOLFENSTER_VOLL`, gebuchter Bestand geht zurück. Eine Vorprüfung ohne Sperre spart nur die Buchung.
- **Karte bei Abholung nur noch für bestehende Bestellungen (E5).** Neue Bestellungen kennen `NEUE_BESTELLUNG_ZAHLARTEN` (ONLINE, ONSITE_CASH, `src/lib/kasse.ts`); `/api/checkout` lehnt ONSITE_CARD NACH der Idempotenz-Antwort mit 400 `ZAHLART_NICHT_ANGEBOTEN` ab — ein alter Tab mit gleichem Schlüssel bekommt seine bestehende Bestellung. Der Enum-Wert bleibt (Expand/Contract), Anzeige, Storno und Abrechnung lesen ihn weiter.
- **Die Kasse zeigt die Frist der Halte.** `POST /api/warenkorb/pruefen` liefert `reserviertBis` (die Frist, die `erneuereHalte` gerade geschrieben hat). `/api/checkout` erneuert nie; nach `RESERVIERUNG_ABGELAUFEN` ruft die Kasse die Prüfung erneut (wie beim Öffnen), sonst liefe jeder weitere Versuch in dieselbe Ablehnung.
- **Der Preis kommt aus der Datenbank.** Der Checkout rechnet Positionen, Summe und Stripe-Betrag mit `Product.price`, nie mit dem Preis aus dem Request. Weicht der Request ab, 409 `WARENKORB_GEAENDERT` mit den gültigen Preisen (`preise`) — nie eine Bestellung zu einem Preis, den die Kundin nicht gesehen hat.
- **Der Name kommt aus der Datenbank.** `OrderItem.productName` ist `bestellPositionsName(Product.name)` (gekürzt auf `PRODUKTNAME_MAX`), auch in Mails und Fehlermeldungen. Aus dem Request liest der Checkout nur Produkt, Menge und den gesehenen Preis — die Positionen werden ausdrücklich gebaut, nie mit `{ ...i }` aus dem Request. `items.name` ist im Schema nur geduldet (alte Tabs schicken es noch).
- **Eine Bestellung überlebt einen gescheiterten Mailversand.** Immer.
- **Jede Abfrage im Bauern-Bereich ist auf den eigenen Hof begrenzt.** Ausnahme: aggregierte Sichten über fremde Höfe, die nur Daten lesen, die auch auf /hoefe oder der Hofseite stehen, und dieselbe oder eine strengere Sichtbarkeitsregel wie /hoefe nutzen.
- **Aggregierte Sichten über fremde Höfe nutzen dieselbe Sichtbarkeitsregel wie /hoefe** — `OEFFENTLICH_SICHTBAR` aus `src/server/queries/farm.ts`, unverändert, höchstens um Bedingungen ergänzt (das Umfeld schließt zusätzlich pausierte Höfe aus, `src/server/queries/umfeld.ts`). Verfügbar heißt dort `istKaufbar`. Keine zweite Sichtbarkeitslogik.
- **Archivierte und nicht freigegebene Höfe** sind öffentlich unsichtbar. Bei jeder neuen öffentlichen Abfrage mitprüfen. **Pausierte Höfe** bleiben öffentlich sichtbar, mit Hinweis, und nehmen keine Bestellungen an: `/api/reserve` und `/api/checkout` lehnen sie mit 409 ab (`SHOP_PAUSED_MESSAGE`).
- **Neue Enum-Werte kommen vor dem Code, aber ungenutzt.** Ein Expand legt den Wert in der Datenbank an; die App nimmt ihn erst an, wenn der Sprint kommt, der ihn anbietet (Zod-Werteliste ohne den Wert, z. B. `PRODUCT_UNIT_VALUES` ohne `RAUMMETER`). Solange keine Zeile ihn trägt, bleibt ein Rückrollen gefahrlos — PostgreSQL kennt kein `DROP VALUE`. `tests/schema-expand.test.ts` hält das für die Werte aus Gate 3 fest.
- **`TeilenAufruf` enthält nie Personen-, Geräte- oder IP-Daten** — nur Zähler je Hof, Kanal und Wiener Kalendertag; `Order.teilenKanal` nur den Kanal. Keine Spalte für Sitzung, Cookie, User-Agent, IP oder den Zeitpunkt eines einzelnen Aufrufs (`tests/schema-expand.test.ts` mit Gegenprobe).
- **Migrationen laufen vor dem Code.** Eine NOT-NULL-Spalte ohne Default darf auf eine bestehende Tabelle nur, wenn die Tabelle nachweislich leer ist oder die Spalte in zwei Schritten kommt: erst nullable plus Code, der sie schreibt; im nächsten Sprint NOT NULL. Dasselbe gilt für das Entfernen von Spalten, die alter Code noch liest. — Grund: `vercel-build` schaltet die Migration Minuten vor dem Code live; in diesem Deploy-Fenster schreibt der alte Code ins neue Schema (Vorfall 2026-09-23, `DEVELOPMENT.md` → Vorfälle). Durchgesetzt von `tests/migrationen-wache.test.ts`; begründete Ausnahmen tragen einen `-- EXPAND-CONTRACT:`-Marker in den fünf Zeilen vor dem `ALTER TABLE`.

### Zahlungen

- **Vollerstattung bei Destination Charges immer mit `reverse_transfer` — und mit `refund_application_fee`, sobald die Zahlung eine `application_fee` trägt; Gebühren-Teilerstattung ohne beides.** Das gilt auch für eine Erstattung von Hand im Stripe-Dashboard. Vorlage: `cancelOrder`; Teilerstattung: `lasseServicegebuehrEntfallen`. Warum: `DEVELOPMENT.md`, „Vollstorno ohne reverse_transfer".
- **Der PaymentIntent entsteht mit festem Stripe-Schlüssel `pi-<Bestell-ID>` und Parametern aus der GESPEICHERTEN Bestellung** (`intentParameter` in `src/app/api/checkout/route.ts`) — nie ungeschützt: Bestellung und Bestand stehen dann schon. Scheitert Stripe, wird die Bestellung über `storniereUnbezahlteBestellung` beendet und der Checkout antwortet 503 `ZAHLUNG_NICHT_MOEGLICH`; ein Stripe-409 (derselbe Schlüssel läuft gerade) ist kein Ausfall. Die Intent-ID wird nur an eine noch offene Bestellung gehängt (`haengeIntentAn`), sonst wird der Intent abgebrochen. Eine Wiederholung ohne gespeicherte Intent-ID holt mit demselben Schlüssel denselben Intent; nach zwei Minuten gilt sie als gescheitert — die Stripe-Aufrufe bleiben mit kurzem Timeout darunter.
- **`Farm.stripeAccountReady` schreibt nur `stripeKontoBereit`** (`src/lib/stripe-konto.ts`: Zahlungen UND Auszahlungen frei) — beim Onboarding, bei „Status prüfen" und bei `account.updated`. Connect-Events kommen über einen eigenen Stripe-Endpunkt mit eigenem Secret an dieselbe Webhook-Route; sie prüft gegen `STRIPE_WEBHOOK_SECRET` und `STRIPE_CONNECT_WEBHOOK_SECRET`. Ereignisse mit `event.account` laufen nur durch `account.updated`, und das liest den aktuellen Kontostand bei Stripe nach (Ereignisse kommen nicht garantiert in Reihenfolge).
- **Jede Erstattung trägt einen festen Idempotenz-Schlüssel je Bestellung und Anlass** (`storno-<id>`, `servicegebuehr-nicht-abgeholt-<id>`, `spaet-bezahlt-<id>`): Erreicht ein zweiter Aufruf Stripe, kommt dieselbe Erstattung zurück, keine zweite.
- **Ein Stripe-Ereignis ändert eine Bestellung nur aus dem Zustand, für den es gilt** — bedingtes `updateMany` wie oben, nie Lesen und blind Schreiben (`src/app/api/stripe/webhook/route.ts`).
  - `payment_intent.payment_failed` ist kein Endzustand, der PaymentIntent bleibt bezahlbar: nur `paymentStatus` FAILED vermerken, nie stornieren, nie Bestand.
  - Endgültig ist `payment_intent.canceled`. Ohne den Hof (Webhook, Aufräumrunde) beendet eine unbezahlte Bestellung nur `storniereUnbezahlteBestellung` (`src/server/unbezahlte-bestellung.ts`): Storno aus PENDING_CONFIRMATION, Gebühren-Vermerk und Rückbuchung in einer Transaktion. Der Hof storniert über `cancelOrder`.
  - `payment_intent.succeeded` setzt PAID nur aus PENDING_CONFIRMATION. Trifft es eine Bestellung, die storniert wurde, ohne je bezahlt gewesen zu sein: sofort voll erstatten (Regel oben), Sentry-Alarm, Mail an die Kundin — nie wiederbeleben. Einzige Ausnahme von „erst bedingt schreiben, dann Stripe": Hier kommt die Erstattung vor dem bedingten Vermerk REFUNDED, weil der Vermerk erst stehen darf, wenn das Geld zurück ist. Vor doppelter Erstattung schützt der Schlüssel, der Vermerk sperrt die Mail.
- **Im Webhook kein Mailversand im Antwortpfad.** Mails laufen über `nachDerAntwort`, jede einzeln abgefangen. Eine 500 heißt für Stripe „erneut zustellen" — sie ist nur erlaubt, wenn Daten oder Geld nicht verarbeitet sind, sonst gehen die Mails doppelt raus.
- **Was ein Storno an Geld bewegt, rechnet `src/lib/storno.ts`** — dieselbe Funktion für den Storno-Dialog und für `cancelOrder`. Wer den Ladungstyp im Checkout ändert, ändert den Storno mit; `tests/storno-erstattung.test.ts` (Ladungstyp-Wache) schlägt sonst an.

### Taxonomie (Kategorien, Unterkategorien, Siegel)

`src/lib/taxonomie.ts` ist die **einzige** Quelle für Werte und Labels. Kein zweites Label-Verzeichnis, kein Hof-Sonderfall anderswo. Anzeige nur über `formatKategorie` in `format.ts`.

- **Jede Unterkategorie (L2) gehört zu genau einer Kategorie (L1).** `gehoertZu(l1, l2)` entscheidet; das Zod-Schema lehnt jede andere Kombination ab. Einzige Ausnahme: `VORBEREITETE_UNTERKATEGORIEN` — Werte, die schon im Prisma-Enum stehen (Expand), aber noch zu keiner L1 gehören. `gehoertZu` sagt für sie immer false, damit lehnt Zod sie ab und nichts bietet sie an. Wer sie wählbar macht, verschiebt sie in `TAXONOMIE` und leert die Liste. Fisch, Brot, Getränke, Brennholz, Sonstiges haben keine L2. Keine dritte Ebene, keine Freitext-Kategorien.
- **Eine fehlende L2 ist kein Fehler.** Bestandsprodukte dürfen ohne bleiben; das Formular zeigt nur einen Hinweis. Einzige Ausnahme: Futter-Kategorien mit Sorten (Heu & Stroh, Getreide & Körner).
- **Siegel sind orthogonal zur Kategorie.** `labels` ist eine Menge (BIO, GENTECHNIKFREI, AMA_GUETESIEGEL), mehrere je Produkt, keines Pflicht, keines doppelt. `isOrganic` ist Altlast: wird nur noch gelesen, nie mehr geschrieben; Bio ist `labels` enthält BIO.
- **Neue Produkte brauchen eine Kategorie** (`productAnlegenSchema`) — ohne landen sie im Bereich Sonstiges zwischen den Lebensmitteln. Bestandsprodukte ohne Kategorie bleiben speicherbar; die Produktliste zeigt einen Chip. Nachtragen aus der Liste nur über `setzeKategorie` (schreibt Kategorie, Unterkategorie, MwSt-Vorbelegung, nur solange die Kategorie leer ist) — nie über `updateProduct` mit Listendaten, das schriebe einen veralteten Bestand zurück.
- **Kategorie-Vorschlag ist nie eine Wahl.** `kategorieVorschlag(name)` in `taxonomie.ts` liefert nur bei genau einem eindeutigen Treffer etwas; Wörter aus `DUAL_USE` nie. Übernommen wird erst mit einem Tipp; Futtermittel nie mit einem Tipp aus der Liste (Kennzeichnung fehlt).
- **Futter-Kennzeichnung nur im Bereich Futtermittel.** Dort Pflicht (Futtermittelart passend zur Kategorie, Nettomenge, Tierarten, Zusammensetzung, analytische Bestandteile, Bestätigung), sonst verboten. Ein Kategoriewechsel aus dem Bereich heraus löscht sie in derselben Transaktion wie das Produkt-Update.

### Bereiche (Lebensmittel, Futtermittel, Sonstiges)

Konzept: `docs/konzepte/bereiche.md`.

- **Bereich ist abgeleitet.** `bereichVon(category)` in `taxonomie.ts` entscheidet. Nie als Spalte, nie in `localStorage`, nie `category === '…'` vergleichen, wo der Bereich gemeint ist. Im Browser nur zur Anzeige und Formularführung (dieselbe Funktion) — verbindlich prüfen Zod und die Servergrenze.
- **Angezeigt werden zwei Bereiche: „Hofladen" und „Futtermittel".** `anzeigeBereichVon` und `ANZEIGE_BEREICHE` in `taxonomie.ts` (Hofladen = Lebensmittel + Sonstiges). Das Label steht nur dort — nie „Lebensmittel" als Bereichsname in der Oberfläche, keine zweite Label-Tabelle.
- **Kaufbar heißt: sichtbar UND freier Bestand > 0** — `istKaufbar` in `src/lib/bereiche-anzeige.ts`. Chips, Suche, Facetten, Karte und Kilopreis-Sortierung fragen nur dort.
- **Ein Produkt gehört zu genau einem Bereich.** Dual-Use (Mais als Lebensmittel und als Futter) = zwei Produkte mit zwei Beständen, ohne Verknüpfung im Schema.
- **`OrderItem.vatRate` ist ein Snapshot.** Der Checkout-Handler schreibt ihn aus `Product.vatRate` im selben `create` wie die Bestellung. Nie nachlesen, nie rückwirkend ändern. `mwstStandard` ist nur die Vorbelegung im Formular.

Fachkonzepte liegen unter docs/konzepte/. Ein Sprint verweist auf sein Konzept, statt es zu wiederholen.

---

## 6. Bekannte Altlasten

Nicht nachahmen. Beim Anfassen der Datei mit aufräumen, nicht als eigener Sprint.

| Altlast | Regel für neuen Code |
|---|---|
| `src/lib/preis-format.ts` hält noch ein zweites `formatEuro` (Symbol hinten) für Warenkorb-Summe, Bestellsummen und Servicegebühr-Einstellung | `format.ts` ist kanonisch. Neue Formatierung nur dort. Wer eine dieser drei Stellen anfasst, stellt sie um; danach fällt die Datei. |
| Server Actions mischen `throw new Error()` und `return { error }` | Neuer Code: `return { error }` (→ `CODING_STANDARDS.md`) |
| Einen gemeinsamen Footer haben nur Startseite und Hofseite | Neue öffentliche Seite bekommt `KundenKopf` (§4, Pflicht); den Footer, sobald es eine gemeinsame Komponente gibt |
| Die Produktliste (`product-list.tsx`) zeigt die Kategorie-Illustrationen nachts ungedämpft (Produktraster und Produktseite sind nachgezogen; das Produktblatt `produkt-detail.tsx` ist mit Nr. 11 entfallen) | Neue Stellen dämpfen und rahmen sie (`CODING_STANDARDS.md` §7, Vorbild `Illustration` in `startseite-abschnitte.tsx`); wer sie anfasst, zieht sie nach |
| Das Auswahlmenü und die Rettungskarte in `foto-quellen.tsx` sind eigene Vollbild-Ebenen (`fixed inset-0`, `role="dialog"`) ohne Scroll-Sperre und ohne Rücksprung | Neue Ebenen nach §4 „Kundenseiten" (Vorbild: Bildansicht der Hofseite) oder als `ui/sheet`; wer die beiden anfasst, zieht sie nach |
| Geld teils `Decimal`, teils `Int` in Cent | Neue Geldfelder: `Decimal(10,2)`. Bestehende `*Cents` nicht umbauen. **Ausnahme:** Beträge, die 1:1 von oder an Stripe gehen oder daraus summiert werden (Servicegebühr, Erstattungen, Monatsabrechnung), sind `Int` in Cent (Spaltenname endet auf `Cents`). Warenpreise bleiben `Decimal`. (Entscheidung vom 05.10.2026, `docs/nachtlauf/freigabe.md` §6) |
| Enum-Werte `FUTTERMITTEL` (Kategorie) und `EINZELFUTTERMITTEL`, `MISCHFUTTERMITTEL`, `ERGAENZUNGSFUTTERMITTEL` (Unterkategorie) aus Taxonomie 1 | Nie wählbar anbieten, nie schreiben; Zod lehnt sie ab. Lesen nur über `istAltlastKategorie` / `istAltlastUnterkategorie`. Entfernen im Cleanup-Sprint. |
| `FutterKennzeichnung.registrierungsnummer` — die Nummer gehört dem Hof (`Farm.betriebsnummer`) | Nie schreiben. Lesen nur als Rückfall über `betriebsnummerFuerAnzeige`. Entfernen im Cleanup-Sprint. |
| Wochengrenzen in Serverzeit (`date-fns` `startOfWeek`, `setHours`) in `getDashboardStats` (seit Heute ungenutzt), `getSalesOverview` und `analytics.ts` | Tage und Wochen des Hofs in Wiener Zeit (`CODING_STANDARDS.md` §2). Wer eine der drei anfasst, stellt sie auf `wienWochenbeginn` um. |
| `markAsReady`, `markAsPickedUp`, `markAsPickedUpAndPaid`, `markAsNotPickedUp` prüfen lesend und schreiben blind — ein Storno im Fenster dazwischen wird überschrieben | Neuer Statuswechsel: bedingtes `updateMany` (§5). Wer eine dieser vier anfasst, stellt sie um. |
