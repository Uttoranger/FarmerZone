# TESTING_GUIDELINES

Wie viele Testdateien es gibt, zählt `pnpm vitest list --filesOnly | wc -l` (Unit) bzw. `ls tests/integration/*.int.test.ts | wc -l` (Integration); die Zahl der Tests nennt das Ende von `pnpm test` (Inventur 4, Morgenbericht 20 §3, freigegeben 21.10.2026).

---

## 1. Setup

- Runner: **Vitest 4**. Zwei Konfigurationen: `vitest.config.ts` (Unit),
  `vitest.integration.config.ts` (Integration).
- Umgebung: **`node`** — kein jsdom, kein happy-dom. Die Ausnahme: `tests/hydrieren.test.ts` läuft mit jsdom (`// @vitest-environment jsdom`, Paket `jsdom` als Entwicklungspaket, G6-Ergänzung 21.10.2026).
- Alias `@/` → `src/`.
- `BETTER_AUTH_SECRET` wird von der Config gesetzt; Token-Tests brauchen nichts weiter.

### Ordner: einer je Schicht, innerhalb flach

| Ordner | Schicht | Suffix |
|---|---|---|
| `tests/` | Unit | `.test.ts` |
| `tests/integration/` | Integration | `.int.test.ts` |
| `e2e/` | E2E (noch nicht vorhanden) | außerhalb von `tests/` |
| `tests/fabrik/` | Fabriken für nachgebaute Typen (keine Tests, §5) | `<typ>.ts` |
| `tests/fixtures/` | Beispieldateien, die ein Test liest (keine Tests) | beliebig |

Keine weiteren Unterordner, kein `.spec.ts`. Innerhalb eines Ordners bleibt es flach; `tests/integration/setup/`, `tests/fabrik/` und `tests/fixtures/` enthalten nur Hilfsmittel, keine Tests. **Lose Hilfsdateien** in `tests/` (`*.ts` ohne `.test`) sind erlaubt und stehen mit Namen da: `admin-sitzung.ts`, `element-suche.ts`, `finanzen-jahr-daten.ts`, `geld-namen.ts`, `hydrieren-hilfe.ts`, `yaml-lader.ts`; eine neue kommt in diese Liste. Nach `tests/fabrik/` gehören nur Fabriken nachgebauter Typen (Inventur 14, Morgenbericht 20 §3, freigegeben 21.10.2026).

**Der `exclude` in `vitest.config.ts` ist Pflicht, keine Geschmacksfrage:**
`tests/**/*.test.ts` passt auch auf `tests/integration/*.int.test.ts`. Ohne
`exclude: ['**/node_modules/**', 'tests/integration/**']` zöge `pnpm test` — und
damit der Stop-Hook — die Integrationstests mit hinein und scheiterte ohne
laufendes Postgres. `exclude` **ersetzt** die Vorgabe von Vitest, deshalb muss
`**/node_modules/**` mit drin stehen bleiben.

### Was in welcher Schicht echt ist

| | Unit (`tests/`) | Integration (`tests/integration/`) |
|---|---|---|
| Postgres | gemockt (`vi.mock('@/lib/prisma')`) | **echt** — lokale Datenbank, Zustand nach dem Aufruf ist die Aussage |
| Better Auth | gemockt | **echt** — Anmeldung mit Passwort, Sitzung aus der Datenbank |
| Rate-Limit | aus | aus (siehe unten) |
| Resend, Stripe, Nominatim, Vercel Blob | gemockt | gemockt |
| Zeit | Parameter oder `vi.useFakeTimers()` | **Systemuhr** (Ausnahme, siehe unten und §4) |
| Laufzeit | Millisekunden | Sekunden |

**Zeit in der Integrationsschicht: eine der Ausnahmen von der Uhr (§4 „Ausnahmen von der Uhr“).** Über die
Handler-Grenze ist `jetzt` nicht injizierbar — der Handler setzt seinen Zeitpunkt
selbst (`const now = new Date()`), und ein Request trägt keinen Parameter dafür.
Die Integrationstests hängen deshalb an der Systemuhr. Damit das nie zu Flackern
führt, gilt dort: **Fristen großzügig setzen, nie auf die Millisekunde prüfen.**
Wer eine Frist auf die Sekunde prüfen will, tut das an der reinen Funktion in
`src/lib/reservierung.ts` — dort ist `jetzt` ein Parameter. Für die Unit-Schicht
bleibt Abschnitt 4 unverändert in Kraft.

**Eine feste Uhr (`vi.setSystemTime`, `vi.useFakeTimers({ now })`) steht in `tests/integration/` nur auf einem Datums-Literal in der Vergangenheit** (`new Date('…')` vor dem 20.10.2026, auch über eine `const` derselben Datei) — es sei denn, die Datei berührt Better Auth gar nicht (kein Import von `@/lib/auth`, keine Zeilen in `session` oder `verification`, kein Helfer aus `setup/basis.ts`, der Better Auth ruft). Better Auth räumt beim Lesen nach der Uhr ab, die gerade läuft; bei einer Uhr in der Zukunft verschwänden Codes und Sitzungen anderer Nummern in der geteilten Test-Datenbank. Die Wache `tests/integration-uhr-wache.test.ts` prüft es mit Gegenprobe; ihr Bestand steht dort mit Grund und darf nur schrumpfen (Nr. 112, Morgenbericht 17, freigegeben 19.10.2026). **Uhr-Schritte** (`vi.advanceTimersByTime`) stehen in einer Datei mit Better Auth nur mit einer Zahl als Literal und nur bei einer festen Uhr in der Vergangenheit, `vi.advanceTimersToNextTimer` und `vi.runAllTimers` dort nie (Wache `tests/integration-uhr-wache.test.ts`; Nr. 121, Regelvorschlag in Nr. 127, freigegeben 20.10.2026).

**Rate-Limit in beiden Schichten aus, und zwar nicht aus Bequemlichkeit:**
`enforceRateLimit` kehrt bei `NODE_ENV !== 'production'` sofort zurück, bevor ein
Zähler angefasst wird (`src/lib/rate-limit.ts`). In Tests ist der Limiter damit
untätig — es gibt nichts zurückzusetzen. Wer die Grenze selbst prüfen will,
nimmt `createRateLimiter()` und bekommt eine frische Instanz; das ist ein
Unit-Test der reinen Funktion, kein Integrationstest. Dasselbe gilt für die
zweite Stufe über die Datenbank (Register R1): Sie fragt nur in Produktion.
Wer eine Action in Produktion prüft (`vi.stubEnv('NODE_ENV', 'production')`),
mockt `@/server/bremse-datenbank` (`bremseUeberAlleInstanzen`) und prüft damit
nur OB und WANN sie gefragt wird; die Zählung selbst — Nebenläufigkeit,
Fensterwechsel, zwei Instanzen, Aufräumen — prüft
`tests/integration/bremse-datenbank.int.test.ts` direkt an
`bremseUeberAlleInstanzen`/`zaehleVersuche` mit einem eigenen Zweck `int-…`.

```bash
pnpm test                                    # Unit, alles
pnpm vitest run tests/reservierung.test.ts   # eine Datei
pnpm vitest run -t "verfallene Position"     # ein Testname
pnpm test:watch                              # Entwicklung
pnpm test:integration                        # Integration (braucht .env.test)
```

### Die Integrationsschicht

- **Wofür:** Aussagen, die nur die Datenbank beantworten kann — bedingte
  Bestandsbuchung unter Nebenläufigkeit, eindeutige Indizes, Transaktionsgrenzen,
  Snapshot-Spalten. Geprüft wird der **Zustand danach**, nicht der Aufruf.
- **Nicht dafür:** Fachregeln. Die gehören in `src/lib/` und in die schnelle Suite.
- **Sicherheitssperre:** `TEST_DATABASE_URL` muss gesetzt sein und auf
  `localhost`, `127.0.0.1` oder `postgres` zeigen. Dev- und Produktionsdatenbank
  werden namentlich abgelehnt. Fehlt die Variable, wird **abgebrochen**, nicht
  übersprungen (`tests/integration/setup/sicherheitssperre.ts`, Allowlists in
  `src/lib/umgebung.ts`).
- **Datentrennung ohne Rollback-Trick:** Jeder Test legt eigene Objekte mit
  `int-`-Präfix an und räumt sie in `afterEach` weg (`raeumeAuf()`). Kein „alles
  in eine Transaktion und zurückrollen" — die Transaktionsgrenzen sind selbst
  Prüfgegenstand. Seed-Daten werden nur **gelesen**.
- **Eine Datei zur Zeit** (`fileParallelism: false`). Nebenläufigkeit wird
  innerhalb eines Tests hergestellt, nicht zwischen Dateien.
- **Nebenläufigkeitstests sichern den ZUSTAND zu, nicht den WEG.** Welchen
  Zweig zwei gleichzeitige Anfragen nehmen, entscheidet die Maschine. Eine
  Zusicherung auf „genau dieser Fehlercode aus genau diesem Schritt" ist
  zeitabhängig und flackert irgendwann — erst in der CI, auf fremder Hardware.
  Richtig ist: Die Antwort muss EINER der gültigen Ausgänge sein, und darunter
  steht der Zustand, der in **allen** Verschränkungen gelten muss (Bestand,
  Anzahl Bestellungen, Anzahl Mails). Das ist auch die Zusicherung, die das Geld
  schützt.
- **Zwei Fenster mit eigenem Modul-Zustand** (etwa die Speicherkette von Mein Hof) entstehen als zweites Exemplar des Moduls: `await import('@/…/modul?zweiter-tab')` — die Abfrage im Pfad trennt nur dieses Modul, Prisma und Aktionen bleiben dieselben (Vorbild `tests/integration/auftritt-abschnitte.int.test.ts`, Nr. 65).
- **Nicht in `pnpm test`, nicht im Stop-Hook.** Eigener CI-Job `integration` mit
  einem `postgres:17`-Dienst.
- **Was an der Verbindung passiert, misst man an pg selbst** (seit Nr. 47):
  Gleichzeitige Abfragen auf einer Verbindung zählt eine Hülle um
  `pg.Client.prototype.query` (nur zählen, nie ändern; Vorbild
  `tests/integration/kasse-lesepfad.int.test.ts`); einen Verbindungsabbruch des
  Poolers stellt eine Hülle um `pg.Pool.prototype.query` her (Vorbild
  `tests/integration/oeffentlich-lesen.int.test.ts`). Prisma und Adapter
  bleiben echt; beide Hüllen kommen im `afterAll` wieder weg.
- Die Login-Bremse von Better Auth zählt über alle Instanzen in `RateLimitZaehler` (R1-Ergänzung 20.10.2026); Tests mit mehr als drei Anmeldungen je 10 s brauchen eigene Schlüssel bzw. eine feste Uhr (tests/integration/auth-bremse.int.test.ts).

### Folge der Node-Umgebung
- **Kein DOM, keine Interaktion.** Keine Testing-Library, kein Klicken, kein Snapshot von JSX. Die Ausnahme ist `tests/hydrieren.test.ts` (jsdom, siehe unten): Dort wird nur hydriert und der Baum danach gelesen, nicht geklickt.
- **Serverseitig rendern geht** — mit `renderToStaticMarkup` aus `react-dom/server` (schon Abhängigkeit, kein neues Paket). Nur für Architektur-Aussagen der Art „dieses Element erscheint in diesem Modus nie": `next/navigation`, `next/image`, `next/link` und die Server-Aktionen per `vi.mock` ersetzen, die echte Komponente rendern, im HTML nach Merkmalen suchen — und immer eine Gegenprobe (§2) rendern, in der jedes Merkmal vorkommen muss, und zwar aus der Komponente, die das Merkmal trägt. Merkmale sind Texte, `aria-label`, die Kennung eines Symbols (`lucide-pencil`) oder eine per `vi.mock` ersetzte Teilkomponente — keine Layout-Klassen, kein Vergleich ganzer HTML-Abschnitte: Das wäre ein Schnappschuss, und „Reine Darstellung" bleibt ungetestet (§2). **Ausnahme:** der Beleg eines Umbaus — ein eingefrorener Text mit dem Stand-Commit im Kommentar, nur wenn die Freigabe den Beleg „bleibt gleich“ verlangt (Regelvorschlag 133, Morgenbericht 20 §6, freigegeben 21.10.2026). Vorbild: `tests/hofseite-einmal.test.ts`. Effekte laufen dabei nicht; Verhalten bleibt Sache der reinen Funktionen.
- **Ein Formular absenden geht auch ohne DOM** (seit Nr. 65, Vorbild `tests/hof-profil-absenden.test.ts`): das echte Formular einmal mit `renderToStaticMarkup` rendern; `useForm` per `vi.mock('react-hook-form', importOriginal)` nur umhüllen, um das Formular und den Absende-Griff festzuhalten, den die Komponente selbst baut (`handleSubmit(onSubmit)`); `useTransition` per `vi.mock('react', importOriginal)` so ersetzen, dass der Rückruf läuft (auf dem Server wirft `startTransition`) und der Test auf ihn wartet. Dann Felder mit `setValue` setzen und absenden — Schema (zodResolver), `onSubmit` und Maßstab bleiben echt, nachgebildet ist nur die Grenze zur Aktion; geprüft wird, was dort ankommt. Zustand, der nach dem Rendern gesetzt wird, verpufft (React auf dem Server) — eine Anzeige danach bleibt ungeprüft. Gegenprobe (§2): die Komponente kurz auf den alten Weg stellen.
- **Einen Hook samt Effekten prüfen geht auch ohne DOM** (seit Nr. 71, Vorbild `tests/use-cart.test.ts`): Ein Prüfstand in `vi.hoisted` ersetzt per `vi.mock('react', importOriginal)` nur die Hooks, die die Komponente nutzt — Zustand je Aufrufstelle (Setzen mit Wert oder Updater), Rendern nach einer Änderung von außen erst danach, sofortiges Neurendern bei einer Änderung im Rendern, Effekte nach dem Rendern bei geänderten Abhängigkeiten. Die Komponente läuft als Funktion, Kinder rendert er nicht; Speicher, `window` und `fetch` kommen per `vi.stubGlobal`. Was der Hook liefert, hält ein Umhüllen des echten Hooks fest (wie `useForm` oben). Gedacht für Fehler, die an einem Render hängen (Funktionen aus einem alten Render, Aufrufe hintereinander) — Fachregeln bleiben reine Funktionen in `src/lib/`. Gegenprobe (§2): der alte Stand.
- **Eine Seite, die erst nach einem Effekt ihren Inhalt zeigt, ganz rendern** (seit Nr. 82, Vorbild `tests/kasse-formular.test.ts`: die Kasse liest den Korb im Effekt aus dem localStorage, auf dem Server stünde nur das Skelett): `vi.mock('react', importOriginal)` ersetzt nur `useEffect` so, dass jeder Effekt einmal je Quelltext sofort beim Rendern läuft — React rendert mit dem gesetzten Zustand neu; die Merkliste je Aufbau leeren. `localStorage`, `fetch` (offen lassen) und die Uhr (`vi.useFakeTimers`) gestellt, `window` als `globalThis`. Bibliotheken behalten das echte React. Geprüft wird das HTML (Reihenfolge, Texte, Zustand der Vorbelegung), mit Gegenprobe, dass nicht das Skelett kam (Regelvorschlag 82, Lauf 12; bestätigt 13.10.2026). **Grenzen des Prüfstands:** Er merkt sich einen Effekt an seinem Quelltext (`toString`) — zwei Effekte mit gleichem Text laufen nur einmal; er kennt keine Abhängigkeiten (jeder Effekt läuft genau einmal, ein geänderter Wert löst nichts neu aus) und kein Aufräumen (die zurückgegebene Funktion läuft nie); ein Effekt, der den Zustand einer ANDEREN Komponente setzt, wirkt nicht — React verwirft ein `setState` in eine fremde Komponente während des Renderns. Was davon abhängt, prüft eine reine Funktion oder der Hook-Prüfstand darüber.
- Teile, die mit Uhr, Breite oder Browser-Speicher rechnen, stehen in tests/hydrieren.test.ts (jsdom); ein neues solches Teil kommt dort dazu (G6-Ergänzung 21.10.2026). Die Hilfe `tests/hydrieren-hilfe.ts` rendert den Server-Teil ohne `window`, `document`, `navigator`, `localStorage` und `matchMedia` (`renderToString`), hydriert das HTML danach mit `hydrateRoot` in `act` und wirft bei jeder Meldung von `onRecoverableError` oder `console.error`. Was der Browser später kennt (Uhr, Breite, Speicher, Adresse), setzt der Fall in `imBrowser`, nach dem Server-Teil; sonst sähen beide Seiten dieselbe Uhr. Jeder Fall bekommt eine Gegenprobe (§2): das Teil kurz auf direktes Lesen stellen (`typeof window === 'undefined' ? … : lesen()` statt `useSyncExternalStore`). Komponenten mit `next/navigation`, `next/link` oder `next/image` bekommen dieselben Attrappen wie in den übrigen Tests.
- **Kein E2E vorhanden.** Kein Playwright, kein Cypress.
- Wer Verhalten testen will, muss die Entscheidung **aus der Komponente herausziehen** — genau der Grund für die Schichtung in `ARCHITECTURE.md`.
- Testing-Library oder Playwright **nicht eigenmächtig einführen**. Vorschlagen und fragen.

---

## 2. Was getestet wird

| Pflicht | Beispiel |
|---|---|
| Jede Fachregel in `src/lib/` | `reservierung.test.ts`, `format.test.ts` |
| Jede Zod-Schema-Datei | `register-schema.test.ts` |
| Jeder Geldweg | `checkout-totals.test.ts`, `servicegebuehr-checkout.test.ts` |
| Jede Berechtigungsentscheidung | `farm-approval.test.ts`, `bestellverfolgung-zugang.test.ts` |
| Jede öffentliche Seite, die einen Hof an eine Client-Komponente reicht: ein Test auf deren Props — was die Seite nicht zeigen darf (Telefon, E-Mail), steht weder als Schlüssel noch als Wert darin, auch nicht verschachtelt; mit Gegenprobe, dass die Suche am vollen Hof anschlägt und der Rest ankommt (seit Nr. 70, Regelvorschlag aus Bericht 60) | `produktdetail-seite.test.ts` (Vorbild, Produktseite), `telefon-nach-kauf.test.ts` (Hofseite); die Suche im Baum: `findeElement` (`tests/element-suche.ts`) |
| Jeder Token-/Signaturweg — ein „Token nur hier"-Test zählt die Stellen im Syntaxbaum von TypeScript (kein Regex-Kommentarfilter: der hielt `//host` für einen Kommentar), mit einer Gegenprobe je Leckweg, auch für Wege ohne den Namen des Tokens (`document.URL`) | `geheimnis.test.ts`, `alte-seiten-neues-design.test.ts` |
| Jeder behobene Bug | ein Test, der ihn vorher gefangen hätte |
| Jede Migration gegen das Deploy-Fenster | `migrationen-wache.test.ts` |
| Jede Architektur-Regel, die sich am Quelltext prüfen lässt (wer was einbindet, wo ein Parameter gelesen wird) — mit Gegenprobe | `hofseite-einmal.test.ts`, `design-tokens.test.ts`, `decrement-wache.test.ts`, `workflows-wache.test.ts`, `palette-klassen-wache.test.ts`, `actions-sitzung-wache.test.ts`, `svg-bild-ohne-link.test.ts` |
| Jeder Geldweg, bei dem die Datenbank die Antwort gibt, **zusätzlich** in der Integrationsschicht | `checkout-bestand.int.test.ts`, `storno-nebenlaeufig.int.test.ts` |

**Jede Wache und jeder Prüfstand hat eine Gegenprobe** (Pflicht, einmal hier): Der Test läuft einmal an einem Beispiel, das er finden muss bzw. das ihn rot machen muss — die Suche an einem Schnipsel mit dem Verstoß, der Prüfstand an der Komponente auf dem alten Weg. Ein leerer Fund beweist sonst nichts; das gilt auch vor jeder Behauptung „0 Treffer“ (Inventur, Wache, Suche für einen Bericht): Die Inventur zählte sonst nur drei von vier Muster-Schreibweisen (Regelvorschlag 110, Lauf 16; hier zusammengeführt, Inventur 13, Morgenbericht 20 §3, freigegeben 21.10.2026). Die übrigen Stellen in diesem Dokument verweisen auf diese Pflicht oder nennen nur ihr Beispiel.

Die **Migrationswache** ist ein normaler Unit-Test der Suite (reine Dateiarbeit,
ohne Datenbank) — sie läuft bei `pnpm test` und damit im Stop-Hook. Sie schlägt
bei `ADD COLUMN … NOT NULL` ohne `DEFAULT` an; begründete Ausnahmen tragen einen
`-- EXPAND-CONTRACT:`-Marker (Regel: `ARCHITECTURE.md` §5). `DROP COLUMN`,
Typänderung und `DROP TABLE` lässt sie nur mit einem begründeten Marker durch.

- Jeder `use-*`-Hook, der nach einem `await` Zustand ändert, bekommt einen Prüfstand-Test „zwei Aufrufe aus demselben Render" (Regelvorschlag 71, Lauf 11; freigegeben 13.10.2026).
- Client-Komponenten unter `src/app/(hof)` stehen unter einer Quelltext-Wache: keine Zeitschaltung, keine Zustell-Sätze, keine Action im setState-Updater (Vorbild `tests/whatsapp-versand.test.ts`, Ausweitung auf alle (hof)-Clients mit Nr. 75; Regelvorschlag 66, Lauf 11; freigegeben 13.10.2026). Eine Zeitschaltung, die nur die Seite neu holt (`router.refresh`), steht mit Grund in `ERLAUBTE_ZEITSCHALTUNG` und hat genau einen Takt: ein `setInterval`, kein `setTimeout` (`nurEinTakt`; seit Nr. 87: offener Faden im Postfach, alle 60 s, Register N12).
- Prüfsummen (etwa die Version eines Bilds in der Adresse) nur über die echte Route testen, nicht über eine im Test nachgebaute Berechnung (Regelvorschlag 67, Lauf 11; freigegeben 13.10.2026).
- Steht eine Regel als Prisma-Bedingung und als SQL (Liste und EXISTS), prüft ein Integrationstest beide an denselben Zeilen (Regelvorschlag 75, Lauf 12; freigegeben 13.10.2026; den Test baut Nr. 85).
- Attrappen für `next/og` liefern ein echtes PNG als Körper — Text ergäbe 503, weil sharp ihn nicht lesen kann (Regelvorschlag 76, Lauf 12; freigegeben 13.10.2026; verschoben aus ARCHITECTURE.md „Vorschaubild und Icons").
- Telefonnummern-Wache (`tests/telefonnummern-wache.test.ts`): ein Test über `src/`, `tests/`, `docs/` und `DEVELOPMENT.md` findet Nummern mit nicht genulltem Teilnehmerteil, auch in sich selbst; Ausnahmen je Nummer mit Grund, z. B. die Nummer des BAES — die Liste führt eine Kennung (SHA-256 der Ziffern) statt der Nummer, und die Gegenproben setzen ihre Ziffer erst zur Laufzeit ein (Dirigenten-Vorschlag, Lauf 12; freigegeben 13.10.2026; gebaut in Nr. 85). Testnummern unterscheiden sich in der Vorwahl („+43 660 000 0000“, „+43 664 000 0000“), nie in den Ziffern dahinter. SVG-Pfaddaten (`d="M…"`) überspringt die Wache grundsätzlich, eine Ausnahme dafür gibt es nicht.
- Kein unsichtbares U+FEFF mitten in Dateien unter `src/` und `tests/`: Wer ein BOM braucht, schreibt `\uFEFF` (Wache in `tests/keine-emojis.test.ts`; Regelvorschlag 103, Lauf 16; gebaut mit Nr. 118).
- Wachen aus Nr. 118, jede mit Gegenprobe (siehe oben): keine `loading.tsx` neben einer Seite mit Filtern in der Adresse (`loading-filter-wache`), kein `key` an einem iframe außer in der Liste aus `vorschauRahmen` (`vorschau-rahmen-wache`), `del(` aus `@vercel/blob` nur in den benannten Wegen (`blob-loeschen-wache`), kein doppelter Absatz in `docs/ai` (`doku-doppelte-absaetze`); wie `admin-seiten-wache` vergleichen sie gegen das Dateisystem und nennen eine neue Datei mit Namen.
- In `src/components/hoefe/**` stehen `new Date()` und `Date.now()` nur in `use-uhr.ts`; Zeitlogik läuft dort über `useUhr` — /hoefe ist statisch (5 Minuten Zwischenspeicher, Register N19), eine Zeitangabe aus der Uhr des Servers wäre bis zum nächsten Rendern falsch. Wache in `tests/karte-wache.test.ts`, mit Gegenprobe (Nr. 120, Regelvorschlag in Nr. 127, freigegeben 20.10.2026).
- Jede Datei mit `useSyncExternalStore` hat einen Fall in tests/hydrieren.test.ts oder steht dort mit Grund unter den Ausnahmen (geprüft; Regelvorschlag 135 aus Morgenbericht 20, freigegeben 21.10.2026).
- Eine Änderung am Hook belegt ihre Gegenprobe mit `GEFAHR_HOOK=<Kopie des alten Hooks>` gegen tests/gefahr-blocken.test.ts; der Bericht nennt, welche Fälle der alte Hook falsch einordnet (Regelvorschlag 138, Morgenbericht 21 §5, freigegeben 22.10.2026).
- Eine Wache über Nutzertext prüft den gerenderten Text (`renderToStaticMarkup`), nicht nur den Quelltext; Gegenprobe mit einem Wort in einem wiederverwendeten Baustein (Regelvorschlag 124, Morgenbericht 20 §6, freigegeben 21.10.2026).

### Nicht testen
- Prisma selbst, Next.js selbst, Stripe selbst.
- Reine Darstellung (Klassennamen, Reihenfolge von JSX).
- Trivialen Code ohne Verzweigung.
- Keine Tests, die nur Mocks prüfen ("wurde `create` aufgerufen") ohne Aussage über Verhalten.

---

## 3. Mocking

### Gemockt werden darf — Infrastruktur
```ts
vi.mock('@/lib/prisma')
vi.mock('@/lib/auth')
vi.mock('@/lib/email')
vi.mock('@/lib/stripe')
vi.mock('next/headers')
vi.mock('next/cache')
vi.mock('@vercel/blob')
```
Alles, was Netz, DB oder Request-Kontext braucht. Wie viele Dateien ein Modul ersetzen, zählt `git grep -l -F "vi.mock('@/lib/prisma'" tests | wc -l` (Inventur 4, Morgenbericht 20 §3, freigegeben 21.10.2026).

**Wer ein Paket mit Sicherheitsfunktion (Better Auth und seine Plugins, Stripe, WebAuthn, sharp) mit `vi.mock` ersetzt, prüft denselben Weg mindestens einmal echt, als Integrationstest oder mit echter Signatur (Vorbild `tests/integration/admin-passkey.int.test.ts:119`)** (Wache `tests/paket-mock-wache.test.ts`; Nr. 115, Regelvorschlag in Nr. 127, freigegeben 20.10.2026).

**Dynamische Importe greifen genauso** — `vi.mock('@/lib/email')` gilt auch für `await import('@/lib/email')` (ARCHITECTURE §4 „Schwere Module nur dynamisch"). Nur der Zeitpunkt verschiebt sich: Ein Nachlauf (`nachDerAntwort`) ruft die Versandfunktion erst, nachdem der Import aufgelöst ist — also nach dem Ende der Action. Deshalb:
- „Mail ging raus": `await vi.waitFor(() => expect(sendX).toHaveBeenCalledWith(…))`.
- „Keine Mail": vorher `await vi.dynamicImportSettled()` — sonst ist „nicht aufgerufen" nur zu früh geprüft und immer wahr.
- Liest der Nachlauf vor dem Versand noch aus der Datenbank (Integrationsschicht), reicht `vi.waitFor` mit seiner Grenze unter Last nicht sicher: Der Test sammelt den Nachlauf (`vi.mock('@/lib/nach-der-antwort')` mit einer Liste), prüft „noch keine Mail" und arbeitet ihn dann selbst ab — ohne Pause und ohne Zeitgrenze, und zugleich der Beweis, dass die Mail nicht im Antwortpfad liegt (Vorbild `tests/integration/bargebuehr.int.test.ts`, seit Nr. 56; `anmeldecode.int.test.ts`).
- Brauchen andere Fälle derselben Datei den sofort laufenden Nachlauf (`vi.waitFor` auf andere Mails), startet der Mock ihn sofort und merkt sich sein Ende; `nachlaufFertig()` wartet darauf, und `afterEach` wartet **vor** dem Aufräumen — sonst kommt die Mail eines Falls erst im nächsten an und zählt dort mit (Vorbild `tests/integration/artikel-fehlt.int.test.ts`, Nr. 95 Runde 2).

**`@/lib/stripe` ist ein Stellvertreter (seit Nr. 42):** Der Client entsteht erst beim ersten Gebrauch (Modus-Wache, Register Z2). Wer Stripe-Wege prüft, mockt weiter `@/lib/stripe` mit `{ stripe: { … } }` — daran ändert sich nichts. Wer die Wache selbst prüft, mockt das Paket `stripe` (eine Attrappe, die ihre Konstruktor-Aufrufe zählt) und lädt `@/lib/stripe` je Fall frisch: `vi.resetModules()` plus `vi.doMock('@/lib/umgebung-server' …)`/`vi.doMock('@/lib/env' …)` mit den Werten des Falls, denn Client und „schon gemeldet“ leben auf Modulebene (Vorbild `tests/stripe-client-wache.test.ts`). Die Umgebung dafür entsteht aus `bestimmeUmgebung(werte)` — so wie im Betrieb, mit `vercelProduktion` —, nicht als handgebautes `{ art, stripe }`. Eine gesperrte Wache an einem gemockten Client spielt ein Getter auf der Eigenschaft nach, der einen Fehler mit dem Namen `MODUS_SPERRE` wirft (Vorbild `tests/webhook.test.ts`). Stripe-Fehler in Tests baut das SDK selbst, ohne Netz: `new Stripe.errors.StripeInvalidRequestError({ code: 'resource_missing', … })`.

**Post-Sperre in Tests (seit Nr. 43):** Unter Vitest fehlt `VERCEL_ENV` — die Sperre aus Register Z3 gilt also (fail-closed): Das echte `sendRaw` verschickt nur an `@example.com` und `TEST_EMPFAENGER`. Ein Test, der den Inhalt einer Produktions-Mail an andere Adressen prüft (example.org, `SUPPORT_EMAIL`), lädt `@/lib/email` mit `vi.stubEnv('VERCEL_ENV', 'production')` vor dem Import (Vorbild `tests/mail-vorlagen.test.ts`). Wer die Sperre selbst prüft, lädt `@/lib/email` je Variante frisch (`VERCEL_ENV=preview`, `production` oder leer), eine Instanz je Variante in `beforeAll` — Umgebung, Liste, Zähler und „schon gemeldet“ leben auf Modulebene (Vorbild `tests/email-testumgebung.test.ts`). Die Regel selbst prüft `tests/testumgebung.test.ts` ohne Mock.

### Niemals gemockt werden — die zu prüfende Aussage
- **Nie** das Modul mocken, das gerade getestet wird.
- **Nie** eine Fachregel aus `src/lib/` mocken, wenn ihr Ergebnis die Aussage des Tests ist.
- **Nie** Zod-Validierung mocken oder umgehen. Ungültige Eingabe muss echt durchs Schema.
- **Nie** Geldrechnung mocken. Beträge echt durchrechnen lassen.
- **Nie** die Zeit implizit lassen: `jetzt` als Parameter übergeben oder `vi.useFakeTimers()`. Kein Test darf von der Systemuhr abhängen (Ausnahmen: §4 „Ausnahmen von der Uhr“).
- **Nie** eine Berechtigungsprüfung wegmocken, um "an die eigentliche Logik zu kommen". Genau die Prüfung ist die Logik.

### Regel
Reine Funktionen (`src/lib/<fachregel>.ts`) werden **ohne jeden Mock** getestet. Braucht ein Test Mocks, um eine Fachregel zu prüfen, sitzt die Regel an der falschen Stelle → in `src/lib/` ziehen.

### In der Integrationsschicht sind Mocks Prüfstellen
Postgres ist dort echt, Resend und Stripe nicht. Was gemockt ist, wird deshalb
**mitgeprüft** statt nur stillgelegt — das ist kein Widerspruch zu „keine Tests,
die nur Mocks prüfen" (Abschnitt 2), weil die Aussage über das Verhalten daneben
steht:

- Storno → `sendOrderCancelled` **genau einmal**, dazu Status und Bestand in der DB.
- Abgelehnter Checkout (Betriebsnachweis fehlt) → **keine** Mail, **kein**
  Stripe-Aufruf, dazu: keine Bestellung und unveränderter Bestand.

Der Nachlauf läuft außerhalb des Requests (`src/lib/nach-der-antwort.ts`), also
gesammelt und selbst abgearbeitet (§3) oder
`await vi.waitFor(...)` statt sofort behaupten.

Zweite Sicherung neben den Mocks: `vitest.integration.config.ts` setzt
`STRIPE_SECRET_KEY` und `RESEND_API_KEY` **unbedingt** auf Platzhalter — auch
gegen `.env.test`. Vergisst ein künftiger Test sein `vi.mock`, läuft der Aufruf
in einen ungültigen Schlüssel statt in echtes Geld.

---

## 4. Aufbau

- Deutsche Testnamen, die das **Verhalten** beschreiben, nicht die Funktion.
  - ✅ `'lässt eine abgelaufene Position nicht durch den Checkout'`
  - ❌ `'pruefeWarenkorb works'`
- `describe` je Funktion oder Szenario, `it` je Verhalten.
- Arrange – Act – Assert, sichtbar getrennt.
- Ein Verhalten je Test. Keine Testdatei, die einen Ablauf über zehn `it` hinweg aufbaut.
- Keine gemeinsame veränderliche Variable zwischen Tests. `beforeEach` zum Zurücksetzen (`vi.clearAllMocks()`).
- Reihenfolge-Unabhängigkeit: Jeder Test muss allein laufen.
- **Schwere Module echt importieren** (z. B. `@/lib/email` mit React und allen Vorlagen): einmal je Datei in `beforeAll` mit eigenem Timeout (`30_000`), nie in jedem Test. Ein kalter Import im Test zählt gegen das 5-s-Limit und reißt es, sobald parallel gearbeitet wird. `vi.resetModules()` nur, wo ein Modul Umgebungswerte auf Modulebene liest oder dort veränderlichen Zustand hält (etwa einen gemerkten Abruf) — dann ebenfalls in `beforeAll`, eine Instanz je Variante (Vorbild: `tests/email-sendraw.test.ts`, `tests/upload-ursache.test.ts`). Das Testlimit nie global anheben.
- **Statische Wachen, die ganz `src/` lesen und parsen** (TypeScript-Parser über jede Datei): eigenes Limit `30_000` nur an genau diesem `it`, mit einem Satz, warum. Eine Wache, die nur wenige Dateien liest, bleibt beim Standard. (geprüft von tests/zeitgrenzen-wache.test.ts; Regelvorschlag Sammel 19, 21.10.2026)
- **Eine Laufzeitprüfung in einem Unit-Test hat mindestens doppelten Abstand zur gemessenen Zeit oder läuft nur allein; der Dirigent wiederholt einmal.** (Regelvorschlag Dirigent, Morgenbericht 25, freigegeben 26.10.2026)
- **Ausnahmen von der Uhr** (Inventur 13, Morgenbericht 20 §3, freigegeben 21.10.2026): Kein Test hängt von der Systemuhr ab — `jetzt` ist ein Parameter, oder die Uhr steht fest (`vi.useFakeTimers()`, `vi.setSystemTime`). Es gibt zwei Ausnahmen: (1) die Integrationsschicht, wo `jetzt` über die Handler-Grenze nicht injizierbar ist (Bedingungen: §1, „Zeit in der Integrationsschicht“); (2) Laufzeit- und Wachstumsmessungen, die die Dauer messen, nie ein Datum (nächster Punkt).
- **Laufzeit-Tests gegen quadratische Muster** (Regex, Schleifen über Fremdtext) messen mit `performance.now()` gegen eine großzügige Grenze (Vorbild `tests/sentry-hygiene-felder.test.ts`: 500 ms für Millisekunden-Arbeit). Das ist die zweite Ausnahme von der Uhr (Punkt davor): Gemessen wird die Dauer, nie ein Datum. Wo eine feste Grenze ein Wachstum nicht zeigt, misst ein Wachstumstest das Verhältnis t(4N)/t(N) gegen 8 (linear etwa 4, quadratisch 16): Texte vorab gebaut, beide Größen abwechselnd, je Größe der Median aus drei Läufen, bei einem Ausreißer bis zu drei Versuche (Vorbild `tests/sentry-hygiene-wachstum.test.ts`, seit Nr. 64).
- **Prozessweiter nativer Zustand** (etwa `sharp.block`, das die Lader von libvips für den ganzen Prozess sperrt) nur in einer eigenen Testdatei, die ihn in `afterAll` aufhebt, und nur, solange jede Datei in einem eigenen Prozess läuft: `pool: 'forks'` in `vitest.config.ts` bleibt stehen (Vorbild `tests/sharp-lader-sperre.test.ts`). Mit Worker-Threads teilen sich parallele Dateien den Zustand.
- **Modul-Zustand, den Tests gegeneinander verschieben würden** (gemerkte Meldungen, Bremsen): Die Funktion nimmt den Zustand als optionalen letzten Parameter, die Aufrufer lassen ihn weg; jeder Test gibt einen frischen mit (Vorbild `neueBremsMeldungen` in `tests/bremse-datenbank.test.ts`), die Zeit als Parameter. Die Verdrahtung mit dem Zustand des Moduls prüft EIN frisch geladenes Modul (`vi.resetModules()` in `beforeAll`, die Attrappen danach ebenfalls neu importieren). `vi.resetModules()` leert das Register der Mocks nicht: Attrappen aus `vi.mock` bleiben dieselben Funktionen — wer je Fall frisch lädt, leert vorher ihre Aufrufe (`vi.clearAllMocks()`, Vorbild `tests/hoefe-fehleranzeige.test.ts`).

### Immer mitprüfen
- Grenzfälle: 0, leer, `null`, exakt an der Frist, ein Millisekunde davor und danach.
- Der Fehlerweg, nicht nur der Erfolgsweg.
- Nebenläufigkeit, wo Bestand oder Geld betroffen ist: zwei gleichzeitige Zugriffe.
  In der Integrationsschicht dabei den Zustand zusichern, nicht den Zweig
  (Abschnitt 1).

---

## 5. Testdaten

- **Keine echten personenbezogenen Daten.** Das Repo ist öffentlich.
- Namen: `Hof Test`, `Max Mustermann`. E-Mails: `@example.com` oder `@example.org`.
- Telefon: `+43 660 0000000` — mehrere Nummern unterscheiden sich in der Vorwahl (664, 676, 699), der Teilnehmerteil bleibt genullt (Wache `tests/telefonnummern-wache.test.ts`).
- Keine echten Stripe-IDs, keine echten Tokens — auch keine abgelaufenen.
- Erfundene Tokens und Codes in Tests aus Buchstaben, nicht aus langen Ziffernfolgen (sonst schlägt die Telefonnummern-Wache an) (Nr. 113, Morgenbericht 17, freigegeben 19.10.2026).
- Ein verfälschter Wert ist immer sicher anders: Zeichen tauschen, nicht festsetzen (geprüft; Regelvorschlag aus Morgenbericht 20 §6, freigegeben 21.10.2026).
- **Für Typen, die in mehr als drei Testdateien nachgebaut werden, gibt es eine Fabrik in `tests/fabrik/<typ>.ts`; sonst bleiben Faktoren lokal** (Wache `tests/fabrik-wache.test.ts`; Nr. 119, Regelvorschlag in Nr. 127, freigegeben 20.10.2026).
- **Integrationsschicht: alles trägt das Präfix `int-`** — Hof-Slug, Produkt-ID,
  Sitzungs-ID, E-Mail-Adresse. Das Präfix ist die Sicherung, an der `raeumeAuf()`
  hängt; wer daran vorbei anlegt, lässt Daten stehen. Faktoren dafür in
  `tests/integration/setup/basis.ts`, weil sie über Dateien hinweg gleich sein
  müssen.
- **`raeumeAuf()` zählt vor und nach dem Aufräumen** die Zeilen aller Tabellen mit
  Fremdschlüssel auf ein Konto oder einen Hof und bricht mit dem Namen der Tabelle
  ab, wenn Zeilen von Test-Konten oder Test-Höfen liegen bleiben
  (`tests/integration/setup/basis.ts`, Rechnung in `zaehlung.ts`, Gegenprobe
  `tests/integration/raeume-auf-zaehlung.int.test.ts`); was an einer Konto-Kennung
  ohne `int-` hängt (Better Auth vergibt sie), räumt der Test über die gemerkten
  Kennungen selbst weg.

---

## 6. Pflicht bei Codeänderungen

- Neue Fachregel → Test im selben Commit. Kein "Tests kommen später".
- Bugfix → zuerst der Test, der den Bug reproduziert, dann der Fix.
- Geänderte Fachregel → bestehende Tests anpassen, **nicht löschen**. Wer einen Test löscht, begründet das im Bericht.
- Roter Test wird **nie** mit `.skip` stillgelegt. Entweder reparieren oder melden (geprüft von tests/test-ueberspringen-wache.test.ts).
- `pnpm test` muss vor jedem Commit grün sein – im Nachtlauf vor jedem Push (Register G10).

### Bekannte Umgebungsfallen
- `prisma generate` braucht Netzzugriff auf `binaries.prisma.sh`. Ist er blockiert, scheitern vier Testdateien mit `Cannot find module '.prisma/client/default'`. Das ist **kein** Codefehler — vor der Fehlersuche `pnpm db:generate` prüfen.
- `pnpm test:integration` braucht ein laufendes Postgres **und** `.env.test`
  (Vorlage: `.env.test.example`). Fehlt die Datei, meldet dotenv-cli sie; fehlt
  `TEST_DATABASE_URL`, bricht die Sicherheitssperre mit Hinweis ab. Beides ist
  kein Codefehler.
- **Links auf Ordner in Tests** als `symlinkSync(ziel, pfad, 'junction')` mit absolutem Ordnerziel anlegen. Ein normaler Symlink braucht unter Windows Sonderrechte (`EPERM` ohne Entwicklermodus), eine Junction nicht; Linux und macOS ignorieren das dritte Argument. `realpath` löst beides auf (Vorbild: `tests/fremdtext-hooks.test.ts`). Junctions gehen nur auf Ordner — für einen Link auf eine **Datei** gibt es unter Windows keinen Weg ohne Sonderrechte; solche Tests brauchen den Entwicklermodus oder laufen nur in der CI.
