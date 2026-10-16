# Morgenbericht Nachtlauf 16 (16.10.2026)

Freigabe: `docs/nachtlauf/freigabe.md` §20 (im Chat erteilt am 16.10.2026). Dirigent nach `docs/nachtlauf.md`, Tempo nach Abschnitt 4a und §0 der Freigabe. Lauf 16 war kein fünfter Lauf (keine Regel-Inventur).

**Fehlende Mockups / übersprungene Nummern:** keine. Alle 12 Dateien des Uploads da6eae0 lagen schon in `docs/mockups/` (kein Verschieben nötig); keine Nummer wurde übersprungen.

**Zwei Dinge, die du wissen solltest, bevor du weiterliest:**
1. **Der Rechner ist einmal neu gestartet** (gegen 21:30), während 103, 106 und 108 umsetzten. Verloren ging nichts: Die Umsetzer setzten an ihrem Stand fort (103 hatte einen `WIP:`-Commit, 106 und 108 lagen als Dateien im Worktree). Deine erneut gesendete Freigabe (gleicher Text) habe ich als Fortsetzung dieses Laufs behandelt.
2. **Die Ursache der „stehenden“ Startseiten-Vorschau (106) ließ sich nicht nachstellen** – weder im Entwicklungs- noch im Produktionsmodus. Gebaut ist trotzdem, was du siehst, wenn es wieder passiert: Rückmeldung „Vorschau aktualisiert · hh:mm“ und gleiche Stelle beim Neuladen (Abschnitt 3).

**Kurz:** Alle acht Nummern (103–110) und der Doku-PR sind fertig; keine ist ein Entwurf, keine blieb liegen. Genau zwei Migrationen sind entstanden (109: `20261016120000_gruendung_ausgenommen`, 103: `20261016130000_betrieb`), beide nur Expand, ohne Seed, in dieser Reihenfolge gestapelt; beide liegen schon in der Entwicklungsdatenbank (Vorschau-Builds). Der Sammel-PR **#306** ist auf dem Gesamtstand grün:
- typecheck,
- **lint 0 Fehler** (5 Warnungen, wie main),
- 430 Testdateien / 8399 Tests, darunter alle neuen Wachen aus 110,
- Integration 57 Dateien / 494 Tests,
- `pnpm illustrationen` 114/114,
- frische Datenbank mit allen 28 Migrationen, Schema = Migrationen.

## 1. PRs

| Nr | Thema | PR | Basis | Migration | Runden · Durchgänge | Vorschau |
|---|---|---|---|---|---|---|
| Doku | Freigabe §20, Register K2/N4/N5/N14–N18, Wortliste, Mockup-README, Warteschlange, Status | #297 | main | nein | – · 1 Prüfung | [Vorschau](https://farmer-zone-git-docs-lauf16-bierbaron.vercel.app) |
| 105 | Postfach ruhig durchklicken, Erstattung erledigt, Drossel, Nacharbeit 101 (N14) | #300 | Doku | nein | 0 · 1 Durchgang (gezielt) + Bild-Test sichter | [Vorschau](https://farmer-zone-git-nacht-2026-10-16105-postfach-ruhig-bierbaron.vercel.app) |
| 107 | Hofseite am Handy: Mosaik, Bildansicht, Kundenansicht im Vollbild (N5, N4) | #298 | Doku | nein | 0 · 1 Durchgang (gezielt) | [Vorschau](https://farmer-zone-git-nacht-2026-10-16107-hofseite-mosaik-bierbaron.vercel.app) |
| 109 | Gründungshöfe: Testhöfe ausnehmen (K2) | #299 | Doku | **ja** – `20261016120000_gruendung_ausgenommen` | 0 · 2 volle Durchgänge | [Vorschau](https://farmer-zone-git-nacht-2026-10-16109-gruendung-451a92-bierbaron.vercel.app) |
| 103 | Admin › Betrieb: Speicher, Grenzen, Abläufe, Warn-Mail (N18, N15) | #302 | 109 (#299) | **ja** – `20261016130000_betrieb` | 0 · 2 volle Durchgänge | [Vorschau](https://farmer-zone-git-nacht-2026-10-16103-betrieb-bierbaron.vercel.app) |
| 106 | Startseiten-Vorschau lädt an derselben Stelle neu; Nacharbeit 99/100 (N16) | #303 | Doku | nein | 0 · 1 Durchgang (gezielt) + sichter vorher/nachher | [Vorschau](https://farmer-zone-git-nacht-2026-10-16106-startseite-08841e-bierbaron.vercel.app) |
| 108 | Ersetzte Fotos nicht mehr beim Hochladen löschen; Nacharbeit 97/98 (N17) | #301 | Doku | nein | 1 · 1 Durchgang (gezielt) + Nachprüfung | [Vorschau](https://farmer-zone-git-nacht-2026-10-16108-bilder-behalten-bierbaron.vercel.app) |
| 104 | Aufräumen und Bilder ohne Verwendung (N18) | #304 | 103 (#302) | nein | 0 · 2 volle Durchgänge | [Vorschau](https://farmer-zone-git-nacht-2026-10-16104-aufraeumen-bierbaron.vercel.app) |
| 110 | Prüfungen statt Textregeln, Teil a | #305 | Zwischenstand `integration/lauf16` | nein | 0 · 1 Durchgang + Nachtrag | [Vorschau](https://farmer-zone-git-nacht-2026-10-16110-pruefungen-bierbaron.vercel.app) (nur Tests, Hook, Lint, Doku) |
| Sammel | alle oben | #306 | main | ja (die zwei) | – | [Vorschau](https://farmer-zone-git-integration-lauf16-bierbaron.vercel.app) |

Alle Einzel-PRs waren in der CI grün (ci, integration, Vercel-Vorschau), nachgesehen um 23:30.

**Merge-Empfehlung:** Nur den **Sammel-PR #306** mergen, per **Merge-Commit** (nicht Squash); die Einzel-PRs gelten danach als gemergt. Einzeln ginge es nur in dieser Reihenfolge, jeweils per Merge-Commit: #297, dann #300, #298, #299, dann #302 (auf #299), #303, #301, dann #304 (auf #302), zuletzt #305 (110 liegt auf dem Zwischenstand aller anderen).

## 2. Sammel-PR

Branch `integration/lauf16` von `main` (da6eae0), Merge-Reihenfolge: docs/lauf16, 105, 107, 109, 103, 106, 108 (Zwischenstand 8e98c5c um 22:48, grün: 419 / 8249, Integration 55 / 491), danach 104 und 110, je `--no-ff`.

**Konflikte und Auflösung:**
- docs/lauf16, 105, 103: ohne Konflikt. `src/server/actions/admin.ts` (105 und 109 bewusst geteilt) ließ sich ohne Konflikt zusammenführen.
- 107, 109, 106, 108, 104, 110: `DEVELOPMENT.md` (jede Nummer hängt ihren Abschnitt vor „Nützliche Befehle“ an) – beide Seiten behalten, in Merge-Reihenfolge.
- 108: `docs/ai/BAUSTEINE.md` – nicht von Hand gelöst, `pnpm bausteine` danach (eigener Commit 8e98c5c); nach 104 und 110 erneut erzeugt, ohne Änderung.
- 110: `docs/ai/ARCHITECTURE.md` – der Absatz „Das Gründungs-Ende“ stand nach dem Konflikt doppelt (Stand mit 104 und Fassung von 110); behalten ist die Fassung von 110 (mit dem Satz zur neuen Gründungs-Konstanten-Wache), Commit 341f80b.
- 110 ↔ 104, ohne Textkonflikt, aber rot: Die neue Routen-Wache von 110 (`tests/admin-seiten-wache.test.ts`, Liste der bekannten Routen unter `/admin`) entstand vor dem Merge von 104 und kannte `betrieb/bilder-export/route.ts` nicht – die Route ergänzt (341f80b). Die Route selbst besteht die Wache (prüft als erste Anweisung).

**Prüfungen auf dem Gesamtstand:** typecheck grün; `pnpm lint` 0 Fehler / 5 Warnungen; `pnpm test` 430 Dateien / 8399 Tests; `pnpm test:integration` (lokale Test-DB, unter Sperre) 57 / 494; `pnpm illustrationen` 114/114.

**Migrationen = Schema:** frische lokale Wegwerf-Datenbank: 28 Migrationen sauber eingespielt, `prisma migrate status` „Database schema is up to date!“, zweiter `deploy` „No pending migrations“, `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` leer, RLS auf allen Tabellen (die drei neuen `BetriebMessung`, `AblaufLauf`, `BetriebWarnung` mit RLS), an `Farm` die drei neuen Spalten; Wegwerf-DB gelöscht. Dasselbe je Migration vor dem Push der Nummer (109: 27, 103: 28 Migrationen).

**Vorschau und Migrationen:** Jede Migration lief beim ersten Vorschau-Build ihrer Nummer über `vercel-build` in die Entwicklungsdatenbank – nachgesehen beim Build von 103 (`dpl_MWjAJKNtNFFEPF8GHoiSbGtpRdRM`): „28 migrations found · Applying migration `20261016130000_betrieb` · All migrations have been successfully applied“ (die von 109 lag damit schon vorher dort). Für den Build des Sammel-PR erwartet: „28 migrations found · No pending migrations to apply“ – Stand beim Schreiben im PR unter „Vorschau“.

**Seiten auf dem Gesamtstand** (Dev-Server, lokale Test-DB, Seed, vor dem Merge von 110 – 110 ändert nichts unter `src/`): `/`, `/innbogenhof`, `/kirchbauernhof`, `/fuer-hoefe`; als Admin `/admin`, `/admin?reiter=alle`, `/admin/betrieb`, `/admin/betrieb/export`, `/admin/postfach` (Eingang, Meldungen, Zustellung), `/admin/startseite`, `/admin/finanzen`, `/admin/einstellungen`; als Hof `/farm-page`, `/products`, `/farm-page?ansicht=kundin` – alle 200. `/admin/betrieb/bilder-export` antwortet außerhalb der Produktion mit 404 (gewollt), `/admin/einstellungen?gruppe=betrieb` leitet aus dem Stream auf `/admin/betrieb` um, `/api/cron/betrieb` ohne Secret 401. Serverprotokoll ohne Fehler.

## 3. 106: die Ursache der stehenden Vorschau (zwei Sätze)

Nachstellen ließ sie sich nicht: Der sichter sah im Entwicklungs- und im Produktionsmodus nach jeder Änderung (Auge, Pfeil) in 1–2 s den Entwurf im Rahmen, mit neuer Adresse je Speicherung, ohne Abschalten des Draft Mode dazwischen und mit `Cache-Control: private, no-store`. Gezeigt hat sich dagegen, dass jede Speicherung den Rahmen ganz ersetzte (leer, wieder oben) – eine Änderung weiter unten passierte so außer Sicht; das ist jetzt behoben (neuer Rahmen lädt im Hintergrund, Tausch erst nach `load`, gleiche Stelle, „Vorschau aktualisiert · hh:mm“).

## 4. Nicht begonnene Nummern

Keine. Für Lauf 17 bleiben laut Freigabe: Teil b von 110 (Textkürzungen) und Regel-Inventur Vorschlag 9.

## 5. Regelvorschläge aus den Berichten, gesammelt (Prüfung vor Textregel; eingetragen erst nach deiner Freigabe)

- **105:** Seiten, deren Filter in der Adresse stehen, bekommen keine eigene `loading.tsx` (Skelett bei jedem Filterklick), sondern Ladepunkt und `aria-busy`. Prüfung: Quelltext-Wache „kein `loading.tsx` neben einer Seite mit `searchParams`-Filtern“ mit begründeten Ausnahmen; Ort DESIGN_SYSTEM „Zustände“.
- **106:** Rahmen, die nach Speicherungen neu laden, tauschen erst nach `load` (Muster `vorschauRahmen`). Prüfung: Quelltext-Wache „kein `key` mit Vorschau-Adresse an einem iframe“; Ort DESIGN_SYSTEM „Vorschau“.
- **107:** `pnpm exec prettier` ohne Projektkonfiguration schrieb eine Datei um. Mit 110 blockt der Hook jetzt `prettier --write`; offen ist, ob es dazu eine Lint-Regel `quotes` geben soll.
- **108:** „Ein Blob wird erst gelöscht, wenn keine Zeile mehr auf ihn zeigt – nie im Upload, nie vor dem Speichern.“ Prüfung: Quelltext-Wache „`del(` nur in den benannten Wegen“; Ort `tests/`, ARCHITECTURE „Upload“.
- **109:** Jede Action, die einen Hof ins Rennen um die Gründungsplätze bringt (`approvedAt`, `gruendungAusgenommen`), nimmt `GRUENDUNGSPLAETZE_SPERRE`. Prüfung: Quelltext-Test; Ort `tests/`.
- **103:** Wache „kein U+FEFF mitten in Dateien unter `src/` und `tests/`“ (ein als Escape gemeintes BOM kam unsichtbar in Quelltext und Test); Ort `tests/keine-emojis.test.ts`.
- **104:** Wache, die jedes Schema-Feld mit `Url`/`url`/`bild` im Namen gegen die Liste in `ladeBildVerwendung` prüft (ein neues Bild-Feld ließe seine Bilder sonst als „ohne Verwendung“ erscheinen); Ort `tests/aufraeumen.test.ts`.
- **110:** Vor jeder Inventur-Behauptung „0 Treffer“ das Muster als Test laufen lassen (die Inventur zählte nur drei von vier Mustern); Ort: Regel-Inventur in `docs/nachtlauf.md`.
- **Dirigent:** (1) **Parallele Branches, die Wachen ändern, gehören im Sammel-PR einmal ganz getestet** – die Routen-Liste von 110 und die neue Route von 104 waren jede für sich grün, zusammen rot. Gegenmaßnahme: Wachen mit fester Liste der heutigen Dateien vergleichen gegen das Dateisystem und melden „neue Datei, bitte eintragen“ mit dem Namen (tun sie schon) – und der Dirigent lässt nach JEDEM Merge in den Sammel-Stand den vollen Lauf laufen, nicht erst am Ende. Ort `docs/nachtlauf.md` §4 Schritt 8. (2) **„Beide Seiten behalten“ gilt nur für angehängte Abschnitte** – in ARCHITECTURE.md verdoppelte es einen geänderten Absatz. Gegenmaßnahme: bei Konflikten in `docs/ai/` den kombinierten Diff (`git show --cc`) ansehen und doppelte Absätze auflösen; Ort §4 Schritt 8.

**Was von 110 offen blieb (für Lauf 17):** vier Stellen `toLocaleDateString` ohne `timeZone` (Druckseite der Bestellung 2×, `order-groups.ts`, `whatsapp.ts`) stehen in der Bestandsliste `DATUM_ORT_BESTAND` und gehören umgestellt; die Aufrufer von `MAX_GRUENDUNGSHOEFE`/`GRUENDUNG_BIS_STANDARD` (vier Ausnahmen der neuen Wache) auf die Einstellung umstellen; `docs/nachtlauf.md` §8 (Startbefehl `--disallowedTools … migrate deploy*` und Z. 354) sperrt `migrate deploy` weiter ganz, Regel 3 erlaubt es jetzt für die lokale Wegwerf-DB – angleichen; Teil b (Textkürzungen) und Vorschlag 9.

## 6. Tempo

Zeiten in Wiener Zeit (16.10.2026).

| Nr | Beginn | Ende (PR) | Runden | volle Testläufe | Bilder |
|---|---|---|---|---|---|
| Doku | 19:40 | 19:57 (#297) | – | 3 (+1 für den Status-Commit) | 0 |
| 107 | 19:56 | 20:58 (#298) | 0 | 2 | 7 |
| 109 | 19:56 | 21:05 (#299) | 0 | 2 + Integration | 5 |
| 105 | 19:56 | 21:12 (#300) | 0 | 2 + Integration (+1 Dirigent für die sichter-Bilder) | 7 (sichter) |
| 108 | 21:06 (Neustart 21:30, fortgesetzt) | 22:11 (#301) | 1 | 3 | 2 |
| 103 | 21:04 (Neustart 21:30, fortgesetzt) | 22:29 (#302) | 0 | 2 + Integration | 3 |
| 106 | 20:57 (Neustart 21:30, fortgesetzt) | 22:37 (#303) | 0 | 2 + Integration (+1 Dirigent für den Nachtrag) | 4 (sichter) |
| 104 | 22:29 | 23:16 (#304) | 0 | 2 + Integration | 1 |
| 110 | 22:53 | 23:38 (#305) | 0 (+ Nachtrag Dirigent) | 2 + ganze Integrationssuite (+1 Dirigent) | 0 |
| Sammel | 22:48 (Zwischenstand), 23:16 | 23:55 (#306) | – | 4 + ganze Integrationssuite zweimal | – |

**Was aus 4a nicht einzuhalten war bzw. anders lief:**
- **Ein Workflow je Nummer** (neu in 4a Punkt 9) hat getragen: drei Nummern liefen wirklich gleichzeitig; frei werdende Plätze gingen nach der Regel aus §1 an 106, 103 (nach 109), 108, dann 104 (nach 103).
- **sichter:** Bei 105 (Bild-Test) und 106 (Nachstellen vorher, Prüfung nachher) machte ein sichter die Bilder; die übrigen Nummern nahmen ihre Bilder selbst auf (4a Punkt 6 b).
- **110 begann vor dem Ende von 104** – vom Zwischenstand mit allen damals fertigen Nummern (Wortlaut §1). Folge: die eine rote Wache im Sammel-Stand (Abschnitt 2).
- **Neustart des Rechners** (21:30): Postgres neu gestartet, die drei laufenden Workflows aus ihrem Journal fortgesetzt; kein Verlust.
- **Grenzerweiterungen durch den Dirigenten** (Abschnitt 8) bei 105, 106, 108, 109.

## 7. Bilderstrecke (hell)

Aus den Nummern, hell (die Bilder liegen im Sammel-PR unter `docs/nachtlauf/berichte/bilder/<nr>/`):

- **Postfach – Klick auf „Meldungen“ vorher/nachher (1440), die Reiter an derselben Stelle** – 105: ![vorher](berichte/bilder/105/klick-meldungen-vorher-1440-hell.jpg) ![nachher](berichte/bilder/105/klick-meldungen-nachher-1440-hell.jpg)
- **Hofseite am Handy mit Mosaik (8 Fotos) und Bildansicht (390)** – 107: ![Mosaik](berichte/bilder/107/hofseite-8-fotos-390-hell.jpg) ![Bildansicht](berichte/bilder/107/bildansicht-390-hell.jpg)
- **Kundenansicht am Handy (390)** – 107: ![Kundenansicht](berichte/bilder/107/kundenansicht-mein-hof-390-hell.jpg)
- **Admin › Höfe mit Bestätigung (1440)** – 109: ![Bestätigung](berichte/bilder/109/hoefe-bestaetigung-1440-hell.jpg)
- **Admin › Betrieb (1440, 390)** – 103: ![1440](berichte/bilder/103/betrieb-1440-hell.jpg) ![390](berichte/bilder/103/betrieb-390-hell.jpg)
- **Startseiten-Vorschau nach einer Änderung (1440)** – 106: ![Vorschau](berichte/bilder/106/vorschau-nach-aenderung-1440-hell.jpg)

Weitere Bilder je Nummer (Mosaik bei 1/2/3 Fotos, Blatt der Gründungs-Bestätigung am Handy, Kopf mit Warnpunkt, Bilder ohne Verwendung, Produktdialog nach „Abbrechen“, die Vorher-Bilder des Nachstellens) stehen in den Berichten und PRs.

## 8. Für dich zu bestätigen (aus den PRs)

- **107:** Unter md hat `/products` keinen Knopf „Kundenansicht“ mehr – der Umschalter, den die Freigabe unter lg streicht, war dort der Einstieg (`products/page.tsx` lag außerhalb der Grenze); `?ansicht=kundin` öffnet das Vollbild weiter. Mockup-Abweichungen: Schleier des „+n“-Deckels 65 % statt 55 % (Kontrast auf hellen Fotos), keine angeschnittenen Nachbarfotos in der Bildansicht, kein „In neuem Tab öffnen“ im Vollbild.
- **103:** Der Montags-Ablauf heißt „Wochenbericht (Postfach)“ statt „Briefkasten (Wochenlauf)“ – „Briefkasten“ verbietet die Wortliste (N12) samt Wache; in „Fertig, wenn“ steht noch „Briefkasten: noch kein Lauf“, gemeint ist derselbe Ablauf. Der Hinweis in der Betriebsleiste sagt „über 80 %“ statt der gemessenen Zahl (eine schlanke Abfrage je Seitenaufbau).
- **109:** Am Handy zeigt das Blatt dieselben Sätze wie der Dialog am Computer (eine Textquelle) statt des kürzeren Mockup-Texts.
- **104:** Zusätzliche Zeilen „Getrennt geführt, nicht mitgezählt“ (verlangt die Freigabe, das Mockup zeigt sie nicht); jeder Klick auf „Liste als CSV“ kostet eine volle Auflistung (Bild-Vorgänge).
- **108:** Das Bild zeigt nur „Abbrechen“ mit neuem Foto – ein gescheitertes Speichern nach dem Hochladen lässt sich lokal ohne Bild-Speicher nicht zeigen (die Route-Tests belegen, dass nichts mehr gelöscht wird).
- **105:** „Erstattung erledigt“ ist im Browser noch nicht gesehen (Seed ohne passende Bestellung) – bitte in der Vorschau mit einer Testbestellung.
- **Dirigent – Grenzerweiterungen** (je keine andere Nummer an der Datei): 109 `src/app/admin/einstellungen/page.tsx` (eine Zeile; 103 stapelt darauf); 105 neue Datei `src/components/ui/lade-punkt.tsx` (`useLinkStatus` braucht eine Client-Datei); 108 `src/components/mein-hof/abschnitt-inhalt.tsx` (eine Zeile, erteilt während Runde 1 – der Blocker hing daran); 106 `src/components/ui/progress-bar.tsx` (`aria-label`, Nachtrag des Dirigenten mit Test); 104 `export` von `zaehleAuflistungen` (in seiner Grenze, über „nur die Summen“ hinaus).
- **Dirigent – Nachträge:** 105 Bilder des sichters committet (b2e2b3b); 106 `progress-bar.tsx` und Bild-Test (bea6e84); 110 Hook blockte zu breit (`prettier --write` in Commit-Texten, `git checkout -b neu main && git commit`) und `migrate deploy` mit ausdrücklicher lokaler Adresse (4ff1cb1) – je mit rotem Test zuerst und vollem Lauf vor dem Commit.

## 9. Nacharbeit („Sollte“/„Kann“), gesammelt

- **105:** JSDoc von `triageMeldungAction` hängt an der neuen Konstante; der Satz „Die Meldung hat sich inzwischen geändert …“ steht zweimal in `admin.ts` statt in `src/lib/meldung.ts`; Grenze 500 der Antwort doppelt; Drossel ohne Frist bei hängender Abfrage; Trefferfläche der Chips 42 statt 44 px (vorbestehend); zweiter Hinweissatz im Reiter Rundschreiben (vorbestehend); Knopf „Erstattung erledigt“ unter statt in der Spalte.
- **107:** Kommentar-Reste („Umschalter“ in `seitenkopf.tsx`, `gespeichert-ansehen.tsx`; „Fotostreifen“ in `hofseite-kunde.tsx`); Kommentar an `KOPF_KNOPF` verrutscht; „wischen blättert“ passt im Computerfenster nur halb.
- **109:** Zusage-Zeile im Dialog aus `TARIF_ZEILE.gruendungshof` bauen (Texte aus einer Quelle); Namen für „zuletzt geändert von …“ über eine Abfrage in `src/server/queries`; veralteter Stand ohne Haken → Satz „Lade die Seite neu“; `speichereGruendungEinstellung` ohne Sperre; „12 von 12“ am Handy bei 375 px knapp.
- **103:** „Jetzt messen“ wartet in der Produktion auf eine mögliche Warn-Mail im Antwortpfad (besser über `nachDerAntwort`); die SQL-Bedingungen für Monat, Tag und Ablauf ohne Integrationstest; Fehlerklassen-Regel doppelt; zwei Testkommentare verweisen auf eine nicht vorhandene Datei; Sentry in `page.tsx` mit rohem Fehler; 10-Minuten-Regel nicht atomar.
- **106:** am Handy beginnt das Blatt bei jedem Öffnen oben; `tests/finanzen-jahr-daten.ts` rechnet `Number(euro) * 100` (exakt, gegen den eigenen Kommentar); Rahmen-Titel wechselt beim Umschalten Entwurf|Live zu früh; `landmark-unique` (AdminShell und Toaster der eingebetteten Seite) bleibt.
- **108:** `tests/bild-ersetzen.test.ts` heißt „Produktdialog – Speichern scheitert“, prüft aber nur `ladeFotoHoch`; ungelesene Prop `bisherigesTitelbild` (`teilen/page.tsx` außerhalb der Grenze); DESIGN_SYSTEM noch zweimal „Fokuspunkt“.
- **104:** CSV-Route ohne Fehlerpfad (Bild-Speicher nicht erreichbar → allgemeine 500); zwei Sätze gehören in `BETRIEB_TEXT`; `Math.min(...)` über alle Dateien; die Warn-Mail nennt die Bilder ohne Verwendung noch nicht; veralteter Kommentar an `BetriebMessung` im Schema.
- **110:** Heredoc-Commit-Nachricht mit einer Zeile, die mit „git stash“ beginnt, blockt der Hook (hinnehmbar); Actions-Wache verlangt nur das Erreichen von `getSession`.
- **Doku-PR:** Die Zeile `admin-einstellungen.html` im Mockup-README beschreibt weiter das ältere Mockup mit der Gruppe Betrieb.

## 10. Für dich zu tun

**Abnahme in der Vorschau, je Nummer** (aus „Fertig, wenn“; die Vorschauen teilen sich die Entwicklungsdatenbank – beide Migrationen sind dort schon eingespielt):
- **105** (`/admin/postfach` am Computer): Eingang → Meldungen → Rundschreiben → Zustellung → Eingang – Kopf und Reiter bewegen sich nicht, kein graues Ladebild, kein Ruck zur Seite; Filter „Antwort“ nach Scrollen → Position bleibt; eine Testbestellung mit „Erstattung offen“ → „Erstattung erledigt“ → Aufgabe weg, „Davon Geld“ 0; zwei Antworten eines Testhofs in einer Minute → eine Mail.
- **107** (Hofseite am Handy, 375 px, mit vielen Fotos): Mosaik, „+n“ → Bildansicht „3 / 8“, wischen, Leiste, Schließen; Mein Hof → „Kundenansicht“ → nur EINE Leiste unten (blass), „Fertig“ → zurück. Am Computer unverändert.
- **106** (`/admin/startseite`): Auge bei „Fragen“ aus → der Rahmen zeigt nach höchstens 2 s den Entwurf ohne Fragen, „Vorschau aktualisiert · hh:mm“; weiter unten gescrollt, dann eine Änderung → Position bleibt.
- **109** (`/admin?reiter=alle`): einen Testhof ausnehmen (mit Haken) → „ausgenommen · Testhof“, die Höfe danach rücken auf, Einstellungen zeigt „· 1 ausgenommen“, `/fuer-hoefe` nennt einen Platz mehr frei; wieder aufnehmen → alter Stand.
- **103** (`/admin/betrieb`): „Jetzt messen“ → Kacheln mit den Zahlen der Vorschau (Bilder = gemeinsamer Speicher), Reiter ohne Punkt; Einstellungen ohne Gruppe Betrieb; Postfach › Zustellung nennt „Betrieb“.
- **108** (`/products` als Hof): Produktfoto ersetzen und „Abbrechen“ → das alte Foto steht; neues Foto speichern → neues Foto; ein Startseiten-Block mit einem 200-px-Bild → der Satz zu kleinen Bildern.

**Nach dem Merge:**
- in Admin › Höfe die Testhöfe ausnehmen (Produktion: 4 Höfe);
- am nächsten Morgen Admin › Betrieb ansehen: erste echte Messung („Gemessen heute, 06:xx“), drei pünktliche Abläufe, „Wochenbericht (Postfach): noch kein Lauf“ bis zum ersten Montag – kein Punkt am Reiter; die Bilder-Zahl ist Vorschau und Produktion zusammen;
- Datenschutzerklärung um die Aufbewahrung ergänzen: Sitzungen (mit IP-Adresse und User-Agent) werden 7 Tage nach Ablauf gelöscht, Anmeldecodes 1 Tag nach Ablauf (104).

**Entscheidungen für Lauf 17:**
- Tarife: Vercel Pro vor Stripe live, Supabase Pro wegen Sicherungen (die Grenzen in Nr. 103 stehen auf Hobby/Free, an einer Stelle in `src/lib/betrieb.ts`).
- SEPA-Monatsabrechnung und Stichtag B1.
- Löschen der Bilder ohne Verwendung nach Durchsicht der CSV (Admin › Betrieb, nur in der Produktion).
- Teil b von 110 (Textkürzungen) und Vorschlag 9; dazu die offenen Punkte aus 110 (Abschnitt 5) und der Knopf „Kundenansicht“ auf `/products` am Handy (107).
- Die Regelvorschläge aus Abschnitt 5: welche freigeben?

## 11. Wo die Bilder liegen

Je Nummer unter `docs/nachtlauf/berichte/bilder/<nr>/` (im Sammel-PR alle zusammen): 105 (7), 107 (7), 109 (5), 103 (3), 106 (4), 108 (2), 104 (1).
