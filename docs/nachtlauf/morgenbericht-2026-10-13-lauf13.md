# Morgenbericht Nachtlauf 13 (14.10.2026)

Freigabe: `docs/nachtlauf/freigabe.md` §17 (im Chat erteilt am 13.10.2026 abends). Dirigent nach `docs/nachtlauf.md`, Tempo nach Abschnitt 4a und §0 der Freigabe.

**Kurz:** Sechs der sieben Nummern (85, 86, 87, 89, 90, 91) und der Doku-PR sind fertig; **84 (Ortssuche) ist ein Entwurf** – nach zwei Runden blieb ein Rest des Blockers (Abschnitt 1), die Behebung ist eine Zeile. Keine Nummer blieb liegen. Genau eine Migration ist entstanden (87, `20261013210000_postfach`, nur neue Tabellen), sie liegt schon in der Entwicklungsdatenbank. Der Sammel-PR **#281** ist auf dem Gesamtstand grün:
- typecheck,
- **lint 0 Fehler** (5 Warnungen, main 6),
- 367 Testdateien / 7406 Tests, keiner übersprungen, darunter Wortliste (N8/N12 mit den fünf neuen Zeilen, Arbeitsliste leer), Hex-Wache (G5, mit der Tabelle der modusfesten Tokens), Telefonnummern-Wache (85) und die Namens-Wache (M1: kein „FarmerZone“ in src, tests, public),
- Integration 46 Dateien / 423 Tests (mit `postfach.int.test.ts` 9/9),
- `pnpm illustrationen` 114/114.

**Vor dem Merge: Variablen umstellen (M1)** – `NEXT_PUBLIC_APP_URL` und `BETTER_AUTH_URL` auf `https://agrilo.at`, `EMAIL_FROM` auf „Agrilo <noreply@agrilo.at>“ (Domain bei Resend verifiziert); dazu die Testumgebung (Abschnitt 10). Ohne das lehnt die Produktion nach dem Deploy Anmeldungen ab, weil sie genau einer Herkunft vertraut.

## 1. PRs

| Nr | Thema | PR | Basis | Migration | Runden | Vorschau |
|---|---|---|---|---|---|---|
| Doku | Verschieben der zehn Dateien, Freigabe §17, Register M1/N12/N13/K3/T8/O4/F9, Wortliste N12, 4a-Satz, Status | #273 | main | nein | – | [Vorschau](https://farmer-zone-git-docs-lauf13-bierbaron.vercel.app) |
| 91 | Agrilo: Name und Domain aus einer Quelle, Wache (M1) | #274 | Doku (#273) | nein | 0, 2 volle Durchgänge | [Vorschau](https://farmer-zone-git-nacht-2026-10-1391-agrilo-bierbaron.vercel.app) |
| 84 | Ortssuche: PLZ + Ort, Standort genauer, Ankunft von der Startseite (F9) | **#276 (Entwurf)** | 91 (#274) | nein | 2 – ein Blocker offen (4a Punkt 5) | [Vorschau](https://farmer-zone-git-nacht-2026-10-1384-ortssuche-bierbaron.vercel.app) |
| 85 | Nacharbeit Lauf 12: Telefon, Marken, Leerzustände, Tokens, Kasse-Texte | #278 | 91 (#274) | nein | 2, 2 volle Durchgänge | [Vorschau](https://farmer-zone-git-nacht-2026-10-1385-nacharbeit-lauf12-bierbaron.vercel.app) |
| 86 | Briefkasten heißt Postfach, Arbeitsliste leer (N12) | #275 | 91 (#274) | nein | 0 | [Vorschau](https://farmer-zone-git-nacht-2026-10-1386-postfach-wort-bierbaron.vercel.app) |
| 89 | Hofseite: quadratisches Titelbild am Computer | #280 | 91 (#274) | nein | 2 | [Vorschau](https://farmer-zone-git-nacht-2026-10-1389-titelbild-computer-bierbaron.vercel.app) |
| 90 | AGB-Seite und Einbindung (O4) | #277 | 91 (#274) | nein | 1 (klein) | [Vorschau](https://farmer-zone-git-nacht-2026-10-1390-agb-bierbaron.vercel.app) |
| 87 | Postfach Stufe 1: Rundschreiben, Antworten, Admin-Reiter (N13, K3, T8) | #279 | 86 (#275) | **ja** – `prisma/migrations/20261013210000_postfach/migration.sql` | 1, 2 volle Durchgänge | [Vorschau](https://farmer-zone-git-nacht-2026-10-1387-postfach-bierbaron.vercel.app) |
| Sammel | alle oben (ohne 84) | #281 | main | ja (die eine aus 87) | – | [Vorschau](https://farmer-zone-git-integration-lauf13-bierbaron.vercel.app) |

**Merge-Empfehlung:** Nur den **Sammel-PR** mergen, per **Merge-Commit** (nicht Squash) – **nach** dem Umstellen der Variablen (Abschnitt 10, Schritt 1); die Einzel-PRs gelten danach als gemergt. Einzeln in dieser Reihenfolge, jeweils per Merge-Commit:
1. #273 (Doku), dann #274 (91, auf #273)
2. #278 (85), #275 (86), #277 (90), #280 (89) (alle auf #274)
3. #279 (87, auf #275)
4. #276 (84, Entwurf) erst nach der Behebung des offenen Blockers und einer Nachprüfung – nicht im Sammel-PR.

GitHub-Prüfungen (`ci`, `integration`) laufen nur für PRs auf `main`; dort sind sie grün (#273 und der Sammel-PR). Den Stand der gestapelten PRs prüft der Sammel-PR.

**Was die Runden fanden:**
- **84, Runde 1:** Beim Ankommen löste /hoefe JEDES `q` der Adresse auf – auch das, was die Seite beim Tippen selbst per `replaceState` hineinschreibt. Nach F5 ging damit nie abgesendeter Text („Eier“) an Nominatim; bei genau einem Treffer wurde ungefragt ein Bezugspunkt gesetzt. Das widersprach der Datenschutz-Zusage „Die Suche startet erst, wenn du sie absendest“ (Freigabe, Ausgangslage f). Jetzt hängt die Seite an alles, was sie selbst schreibt, die Kennung `t=1`; nur ein `q` ohne `t` (Startseite, Kopfzeile, 404, alte Links) gilt als abgesendet. Dazu vier Sollte: „Genauer bestimmen“ prüft die Genauigkeit des zweiten Werts („Genauer ging es nicht.“), ein Transportfehler der Ortssuche ist „kein Treffer“ statt Fehlerseite (Sentry sieht nur Klasse und festen Text), eine Prüfung nur zur Sicherheit entfällt, der 14-s-Wächter ist getestet.
- **84, Runde 2:** Runde 1 setzte den Adress-Vermerk erst nach der Antwort – auch wenn die Kundin /hoefe inzwischen verlassen hatte; dann überschrieb `replaceState` die Adresse der angezeigten Hofseite mit `/hoefe?…`. Jetzt setzt der Hook den Vermerk nur, solange er aufgebaut ist (Ref `montiert`, StrictMode-fest; Test „Abbau vor der Antwort → kein Vermerk“). Dabei fiel auf, dass `extra.fehlertext` an Sentry aus `error.message` kam und den Suchtext nur wörtlich entfernte – jetzt nur Fehlerklasse und fester Text.
- **84, offen nach Runde 2 (Entwurf):** Bei genau einem Treffer setzt `loeseAuf` eine Antwort, die nach dem Verlassen von /hoefe kommt, weiter ein: `uebernimm → onOrt → onSuchtext('') → setzeFilter → schreibeUrl` schreibt die Adresse der angezeigten Hofseite auf `/hoefe` um (Startseite → „5230 Mattighofen“ → sofort einen Hof antippen). Dieselbe Kette besteht seit Nr. 46 für Enter auf /hoefe mit anschließendem Tipp; 84 macht sie über das Auflösen beim Ankommen ohne Zutun erreichbar. Nach 4a Punkt 5 keine dritte Runde. **Behebung: eine Zeile** (`montiert.current` vor dem Einsetzen der Antwort prüfen, `use-ortssuche.ts:295`) plus ein Testfall (Abbau mit genau einem Treffer → weder `beiOrt` noch Vermerk). Auf Zuruf baue ich sie ein; dann Nachprüfung und Merge nach dem Sammel-PR.
- **85, Runde 1:** (a) Die neue Telefonnummern-Wache enthielt selbst zehn Nummern mit nicht genulltem Teilnehmerteil und nahm sich von der Suche aus (CLAUDE.md §2, öffentliches Repo). (b) Die vier modusfesten Tokens standen nur in einer Aufzählung von DESIGN_SYSTEM und nur in Kommentaren des Token-Tests – die Bedingung des Dirigenten für die Grenzerweiterung `globals.css` war nicht erfüllt. Jetzt prüft die Wache sich selbst, die Gegenproben bauen ihre Nummern zur Laufzeit aus genullten Literalen, Ausnahmen gelten je Nummer über eine Kennung (SHA-256) statt der Nummer; die Tabelle „Modusfeste Tokens“ steht in DESIGN_SYSTEM, `tests/design-tokens.test.ts` liest sie (genau eine Definition in `:root`, keine im Nacht-Block, oklch ≤ 1 je Kanal vom Hexwert). Dazu alle acht Sollte (Mobilnummern ohne 0, E.164 ohne „+“, Ausnahmen je Nummer statt je Datei, Rendertests der vier Mails, Test „Land DE: führende 0 bleibt +43“).
- **85, Runde 2:** Die Nachprüfung fand eine Lücke der neuen Wache: Klammern um Vorwahl oder Ländercode („+43 (664) …“) erkannte sie nicht – eine nicht genullte Beispielnummer in `docs/ai/CODING_STANDARDS.md:130` blieb unerkannt. Jetzt erkennt sie Klammern, Punkt als Trenner und angehängte Zifferngruppen; die Beispielnummer ist genullt, vier neue Fundstellen im Sentry-Prüfstoff sind durch bestehende Kennungen gedeckt. Bekannte Grenze (im Kopf der Wache): Ziffern, die ohne Trenner an einer Nummer kleben, machen sie unlesbar – betrifft eine Prüfstoff-Nummer in `tests/sentry-hygiene-vergleich.test.ts:240` (Altlast seit Nr. 64, dort als Prüfstoff ausgenommen).
- **87, Runde 1:** D1: Der Fuß „Versandt von Agrilo im Auftrag eines Hofes.“ stand auch unter den Team-Mails des Postfachs (Freigabe: „Absender aus MARKE_TEAM“) – jetzt ein freiwilliger Fuß-Prop am `EmailLayout`, die Postfach-Mails sagen „Versandt vom Agrilo-Team.“ D2: Der Bericht nannte fünf Mockup-Abweichungen nicht mit Grund (Freigabe §2) – jetzt (a)–(f) je mit Grund und Bild, zwei Bilder neu. In derselben Runde elf kleine Regelverstöße behoben (Nutzertexte außerhalb der einen Quelle, „links/rechts“ unter 1024 px, doppelter Leersatz, Ladeansicht mit Filter-Chips, SR-Text am Admin-Reiter, Routen-Parameter ohne Zod, Nachlauf `letzteMailAm` ohne Fehlerfang, Rückgabetypen, doppelte Regeln in DEVELOPMENT, zu weite WhatsApp-Ausnahme, fehlender HofShell-Test) und vier weitere Sollte.
- **89, Runde 1:** Zwei Blocker gegen den Wortlaut von N13: Das scharfe Foto sprang nach dem Laden von `object-cover` auf `object-contain` (nur die Kopie blendete) – jetzt zwei Foto-Lagen mit gleicher Quelle, die füllende blendet aus, die ganze blendet mit der Kopie ein (im Browser gemessen, ein Abruf). Und `breite / hoehe < 1,5` rechnete mit den von next/image gelieferten Maßen: ein 3:2-Foto kam als 640 × 427 (1,4988) an und galt als „ganz“ (die Vorschau in Mein Hof zeigte den Satz „Quadrat oder Hochformat …“, die Hofseite füllte) – jetzt eine Rundungsgrenze.
- **89, Runde 2:** Mit 0,5 px Grenze stand ein exaktes 3:2-Foto an bis zu 31 von 1921 Fensterbreiten (Dichte 1 / 1,25 / 2) noch auf „ganz“, weil `naturalWidth/Height` dichtekorrigiert und abgerundet kommen. Entscheidung: 0,75 px – 3:2 ist das häufigste Format; der einzige Vorteil von 0,5 (1499 × 1000 „ganz“) gilt nur in Originalgröße. Mit 0,75 px bleibt 3:2 in einer neuen Messreihe (4 Quellen × 7 Dichten von 1 bis 3 × 1921 Breiten) überall beschnitt; die fünf gemessenen Fehlbreiten sind Testfälle. Fotos, die rechnerisch knapp (unter 0,15 %) unter 3:2 liegen, wechseln je nach gelieferter Breite – hinnehmbar und im Code benannt.
- **90, Runde 1:** Kein Blocker im strengen Sinn; Grund für die kleine Runde war eine ohne Grund gestrichene Wache: `tests/registrieren-formular.test.ts` prüfte nicht mehr „kein Haken“ (O4). Dazu `rel="noopener noreferrer"` bei neuem Tab, Rückgabetypen, Bedienwörter aus der von der Wortliste ausgenommenen Rechtstext-Datei heraus, Register-Kommentar am Datenschutz-Abschnitt „Postfach“.

**Zweite volle Prüfdurchgänge** (91, 85, 87, laut Freigabe):
- **91:** D1 meldete 314 Literale „agrilo.at“ in 23 Testdateien als Blocker; der Dirigent stufte es als Sollte ein (Abschnitt 7), D2 kam unabhängig zum selben Schluss. Sonst: `PRODUKTION_HOST` einzige Quelle, `umgebung.ts` ohne Importe; `istEchteHerkunft`/`trustedOrigins` nur über die Konstante; Mails nur Betreff/Vorlagen, FROM und Post-Sperre unverändert; Rechtstexte Wort für Wort nur Name, Domain, Adressen.
- **85:** D1 und D2 fanden je einen Blocker (oben) und zusammen neun Sollte; D2 prüfte zusätzlich: Geld nur angezeigt, nie neu gerechnet; Kasse-Texte aus einer Quelle (N10); Marken über `Marke` mit den Tokens aus G5. Zwei Nachprüfungen (Runde 1 → neuer Blocker, Runde 2 → behoben, Sonde über 1392 Dateien ohne Verstoß).
- **87:** D1 (Daten, Zugriff, Mail): Migration gleich der Ausgabe von `prisma migrate diff` plus Guards, RLS und `lock_timeout` wie bei `rate_limit_db`, nur neue Tabellen; `farmId` in jeder WHERE-Klausel, fremder Faden 404, Admin-Actions serverseitig, Lesestand nur vorwärts, Links nur relativ oder auf `PRODUKTION_HOST`; Mail über `sendRaw` mit Post-Sperre Z3 und Versand nach dem Commit; keine Nachrichtentexte in Logs oder Sentry. D2 (Oberfläche, Texte, Tests, Doku): Heute-Karte nur bei Ungelesenem als erster Block, Postfach oben im Mehr-Blatt mit Zahl an „Mehr“, 308 von `/admin/meldungen` mit Filtern, Formular mit vier Empfängerwahlen, Wortliste sauber, Tests prüfen Verhalten. Der Dirigent hat die Migration außerdem auf einer frischen lokalen Datenbank eingespielt (21 Migrationen, `migrate status` „up to date“, zweiter `deploy` ohne Änderung, RLS an).

**Über eine andere Nummer erledigt:**
- 85 hat die EmptyState-Schnittstelle geändert (`ausweg` Pflicht, Grund ohne Aktion als fester Text im Aufruf); 87 baute parallel mit der alten. Der Dirigent hat die vier Aufrufe von 87 im Sammel-PR umgestellt (im Merge-Commit von 87).
- 90 hat den Datenschutz um den Abschnitt „Postfach“ ergänzt (Freigabe 90), 87 fasst die Datenschutzseite nicht an.
- Die Reservierung von `agb` (90) und `postfach` (87) in `slug.ts`/`next.config.ts` kam ohne Konflikt zusammen (verschiedene Zeilen).

## 2. Sammel-PR #281

Branch `integration/lauf13` von `main` (5e75103), Merge-Reihenfolge wie in der Freigabe ohne 84 (Entwurf) und mit 87 vor 89 (dessen Runde 1 lief noch): Doku, 91, 85, 86, 90, 87, 89, je `--no-ff`. `pnpm bausteine` danach ergab keine Änderung (die sortierte Liste war durch die Merges schon vollständig), darum kein eigener Commit.

**Konflikte und Auflösung:**
- Merge 85 (1c2e867): ohne Konflikt.
- Merge 86 (40de2c4): `tests/wortliste.test.ts` – nur der Kommentar über `OFFEN_BIS_86`: 85 hatte den Schlusssatz geändert („Eine neue Arbeitsliste gibt es nur mit Freigabe …“), 86 den Absatz für die geleerte Liste neu gefasst; Ergebnis: Fassung von 86 plus der Satz von 85. `DEVELOPMENT.md`: beide Abschnitte angehängt (Basis leer), ours zuerst (85 vor 86).
- Merge 90: `startseite-abschnitte.tsx` – Importzeilen beider Seiten (85 `PROBLEM_MELDEN`, 90 `AGB_LINK_TEXT`/`AGB_PFAD`); `order-confirmation.tsx` – Importe beider Seiten, Signatur von 90 (Rückgabetyp) plus `const anrufen = telefonLink(p.farmPhone)` von 85; `DEVELOPMENT.md` beide Abschnitte (Basis leer), ours zuerst.
- Merge 87 (vor 89, weil dessen Runde 1 noch lief): `DEVELOPMENT.md` beide Abschnitte (Basis leer, ours zuerst); `docs/ai/DESIGN_SYSTEM.md` Abschnitt Heute – 85 änderte die Zeilen Packliste/Braucht dich, 87 fügte die Postfach-Zeile dazwischen ein: Zeilen von 85 plus Postfach-Zeile von 87; `src/components/heute/heute-teile.tsx` Importe – `Marke` (85) und die Postfach-Importe (87), `StatusBadge` entfällt (85 zeichnet über `Marke`, 87 nutzte ihn nicht); `tests/leerzustaende-wache.test.ts` – 85 ersetzte `OHNE_AKTION` (mit Grund) durch `BEKANNT_OHNE` (Datei + Titel, Grund steht im Aufruf), 87 hatte zwei `OHNE_AKTION`-Einträge: Liste von 85 plus die zwei Einträge von 87. **EmptyState-Schnittstelle (85 ↔ 87, kein Textkonflikt, aber Typfehler):** in den Dateien von 87 `ausweg` statt `aktion` (vier Aufrufe), die zwei Leerzustände ohne Aktion mit `ausweg={{ ohne: '…' }}` als festem Text im Aufruf (die Wache verlangt den Grund wörtlich im Aufruf), die `ohne`-Schlüssel in `POSTFACH_LEER`/`RUNDSCHREIBEN_LEER` und der Kommentar dazu entfallen. Prisma-Client im Integrations-Worktree neu erzeugt (neue Enums). Danach typecheck grün, 13 geteilte Testdateien 339/339.
- Merge 89 (29983ef): nur `DEVELOPMENT.md` (beide Abschnitte, Basis leer). `pnpm bausteine` danach: Verzeichnis neu erzeugt (479 Dateien), **keine Änderung** gegenüber dem zusammengeführten Stand – die automatischen Merges der sortierten Liste waren vollständig; kein eigener Commit nötig (`tests/bausteine-verzeichnis.test.ts` prüft die Aktualität im vollen Lauf).

**Prüfungen auf dem Gesamtstand:** typecheck grün; `pnpm lint` 0 Fehler / 5 Warnungen; `pnpm test` 367 Dateien / 7406 Tests; `pnpm test:integration` (lokale Test-DB, unter Sperre) 46 / 423; `pnpm illustrationen` 114/114; Wortliste, Hex-Wache, Telefonnummern-Wache, Namens-Wache und die Doku-Zeilen-Prüfung (nur bewusst umgeschriebene Zeilen fehlen) grün. Der erste volle Lauf hatte **einen** roten Test – die neue Wache aus 85 („Problem melden“ nur über `PROBLEM_MELDEN`) gegen zwei Sätze von 87, den Grund eines Leerzustands aus dem Merge und den wörtlichen AGB-Text von 90 – behoben im Zusammenführungs-Commit 5855111 (Konstante in den Postfach-Sätzen, Grund umformuliert, Rechtstext als Ausnahme der Wache); danach lint und `pnpm test` erneut grün.

**Vorschau und Migration:** Der Vorschau-Build des Sammel-PR ist grün ([Vorschau](https://farmer-zone-git-integration-lauf13-bierbaron.vercel.app), Deployment `dpl_BesJZ27Qr4jg8Aai9EXm9zbBJSpF`), `ci` und `integration` auf GitHub ebenfalls. Die Migration lief über `vercel-build` (`prisma migrate deploy`) in die Entwicklungsdatenbank, und zwar beim ersten Vorschau-Build mit der Migration – dem von PR #279 (87) um 00:39 UTC: Build-Log „21 migrations found in prisma/migrations · Applying migration `20261013210000_postfach` · The following migration(s) have been applied: 20261013210000_postfach“. Der Build des Sammel-PR meldet „21 migrations found in prisma/migrations · No pending migrations to apply“ – der Stand der Vorschau-Datenbank ist vollständig. Lokal zusätzlich auf einer frischen Datenbank belegt (21 Migrationen, `migrate status` „Database schema is up to date!“, zweiter `deploy` ohne Änderung). Produktion bekommt die Migration beim Merge über `vercel-build`.

## 3. Nicht begonnene Nummern

Keine. Alle sieben Nummern der Freigabe sind umgesetzt und geprüft; 84 ist ein Entwurf (Abschnitt 1).

## 4. Tempo

| Nr | Beginn | Ende (PR) | Runden | volle Testläufe | Bilder |
|---|---|---|---|---|---|
| Doku | 20:36 | 21:05 | – | 1 (+3 für Status-Commits, +1 für den Morgenbericht) | 0 |
| 91 | 20:45 | 21:45 | 0 | 2 (eigener + nach dem Doku-Merge) | 6 |
| 86 | 21:42 | 22:10 | 0 | 1 | 2 |
| 84 | 21:42 | 00:00 (Entwurf) | 2 | 3 (Runde 2 brauchte drei Anläufe: zwei Zeittests unter Last) | 3 |
| 85 | 21:42 | 00:31 | 2 | 3 | 4 |
| 87 | 22:03 | 00:38 | 1 | 2 (+ Integration 2×, 46/422) | 12 |
| 90 | 22:24 | 00:07 | 1 (klein) | 2 | 4 |
| 89 | 23:07 | 01:22 | 2 | 3 | 6 |
| Sammel | 21:45 (Branch), 00:33 (erster Merge) | 01:33 (PR), 01:38 (grün) | – | 2 (einer mit Integration und `pnpm illustrationen`; der erste hatte einen Zusammenführungsfehler, s. Abschnitt 2) | 10 Paare + 3 Einzelbilder (Strecke) |

Zeiten UTC. Vom Start bis zum grünen Sammel-PR 5 Stunden 2 Minuten; Lauf 12 brauchte 2 Stunden 21 Minuten für neun kleinere Nummern – dieser Lauf hatte mit 87 (Migration, 67 Dateien), 85 (123 Dateien) und 91 (169 Dateien) drei große Nummern und sieben Runden.

**Was aus 4a nicht einzuhalten war, und warum:**
- **sichter:** Den Subagenten gibt es in dieser Umgebung nicht. Nach 4a Punkt 6 b machten die Umsetzer ihre Bilder selbst; die Bilderstrecke machte ein eigener Agent auf dem Seed-Hof „Kirchbauernhof“: „vorher“ neben der ersten Welle, „nachher“ nach dem Sammel-PR.
- **Höchstens drei Umsetzer:** Zweimal liefen kurz vier (22:40–22:58 mit der Runde 1 von 84 neben 85, 87, 90; 23:13–23:23 mit der Runde 1 von 85 neben 87, 89, 90), weil Runden als Umsetzer zählen und ich sie nicht warten lassen wollte. Kein Testlauf lief deswegen in eine Zeitüberschreitung.
- **Reihenfolge:** 87 startete um 22:03 vom Stand der Nr. 86, acht Minuten bevor der pruefer von 86 fertig war (0 Befunde) – ein Risiko, das nicht eintrat.
- **Nominatim:** Aus dem Dev-Server der Umgebung ist Nominatim nicht erreichbar (Node-`fetch` ohne Proxy). Für die Bilder der Ortssuche lief ein lokaler Stummel mit fünf festen Orten (`NODE_OPTIONS=--import`); kein Code der Anwendung ist dafür geändert.
- **Platte voll:** Um 23:10 war das Temp-Dateisystem voll (ENOSPC traf den Dev-Server von 90 und eine Prüfung von 84). Fünf abgeschlossene Worktrees und zwei `.next`-Ordner entfernt, danach 11 GB frei; nichts ging verloren, der betroffene Lauf wurde wiederholt.
- **Eingehalten:** pruefer mit höchstens 22 Schritten je Aufruf; `test:integration` nur bei 87 (dort der ganze Satz, 46 Dateien) und im Sammel-PR; Berichte 40–60 Zeilen; vier Status-Commits, je mit vollem Lauf. **Runden:** sieben insgesamt (84 zwei, 85 zwei, 87 eine, 89 zwei, 90 eine) – mehr als in Lauf 12 (drei), bei drei großen Nummern; fünf davon für Blocker im strengen Sinn, zwei nach Entscheidung des Dirigenten (90, 89 Runde 2; Abschnitt 7).

## 5. Bilderstrecke „Handy vorher/nachher“ (390 px, hell)

Vorher `main` (5e75103), nachher `integration/lauf13` (5855111); die Ortssuche nachher vom Branch der Nr. 84 (735459a, Entwurf – im Sammel-PR gibt es keine neue Ortssuche). Beide lokal gegen die Test-Datenbank, Hof „Kirchbauernhof“ und Admin aus dem Seed, nur erfundene Daten:
- ein Rundschreiben „Bitte Abholzeiten für die Feiertage eintragen“ (Wichtig, Link `/settings`, ohne E-Mail) nur an diesen Hof, eine Antwort des Hofs, eine Antwort des Teams; ein zweites, „Neu: Titelbild vom Computer hochladen“ (Info), damit die Liste zugleich einen ungelesenen Faden und „Du hast geantwortet“ zeigt; eine Kopie des ersten für Bild 3b,
- ein quadratisches Titelbild (Ausschnitt aus einem Bild des Repos) für Bild 7, eine erfundene Stripe-Kennung nur für Bild 3b (kein Aufruf an Stripe).

Danach ist alles zurückgesetzt und belegt: Fingerabdruck aller 27 Tabellen vorher/nachher gleich, Volldump mit gleicher Prüfsumme, die vier Postfach-Tabellen leer. Der gelbe Streifen „TEST · Dev-DB · Stripe Test“ gehört zur lokalen Umgebung; der Kopf sagt nachher „Agrilo“ (91). Die Orte der Ortssuche stammen aus dem lokalen Nominatim-Stummel.

**Ortssuche (84, Entwurf):**
- Ankommen mit `?q=5230 Mattighofen` (1a): Vorher las /hoefe das `q` nur als Produktsuche – Überschrift „„5230 Mattighofen“ in deiner Nähe“, Chip „Suche: 5230 Mattighofen“, 0 Treffer, Leerzustand. Nachher ist das Feld leer, darunter die Karte „Wir zeigen Höfe rund um Mattighofen, Oberösterreich“ mit „Ort ändern“ und 22 Höfe nach Entfernung (der nächste 1,5 km).

![Ortssuche beim Ankommen](berichte/bilder/lauf13-handy/1a-ortssuche-ankommen.jpg)

- Tippen und ein Enter (1b): Vorher zeigte ein Enter nur den Eintrag „Höfe rund um … zeigen“ (erst ein zweites Enter fragte Nominatim). Nachher löst ein Enter auf; derselbe Endzustand wie 1a, der Fokus bleibt im Feld.

![Ortssuche nach Enter](berichte/bilder/lauf13-handy/1b-ortssuche-enter.jpg)

- Mehrere Treffer (1c, „Ried“): Vorher gab es nach dem zweiten Enter nur „Diesen Ort kennen wir nicht — probier es mit der Postleitzahl.“ Nachher: „Vier Orte passen — welchen meinst du?“ mit Bundesland je Zeile und „Keiner davon“. Das Paar vergleicht zwei Eingaben, weil die alte Fassung nie mehrere Orte anbot.

![Ortssuche mit mehreren Treffern](berichte/bilder/lauf13-handy/1c-ortssuche.jpg)

**Mehr-Blatt mit Postfach (87):** Ganz oben die neue Zeile „Postfach“ mit dem Zähler 1; am Knopf „Mehr“ der Unterleiste steht dieselbe 1. Vorher gab es keinen Postfach-Eintrag. Das Blatt füllt jetzt die ganze Höhe, „Abmelden“ ist unten um etwa 10 px angeschnitten (es scrollt) – Nacharbeit, Abschnitt 8.

![Mehr-Blatt](berichte/bilder/lauf13-handy/2-mehr-blatt.jpg)

**Heute mit ungelesener Nachricht (87):** Die neue Nachrichtenkarte (Marke „Wichtig“, Titel, Knöpfe Ansehen · Antworten · Gelesen) steht als erster Block der Hauptspalte, unter den Kennzahlen und vor der Packliste. In Bild 3 schneidet die Hinweiskarte „Online-Zahlung einrichten“ (Stripe im Seed nicht gesetzt) sie unten an; Bild 3b (Stripe gesetzt, wie in Lauf 12) zeigt sie ganz. Mittwoch ist Abholtag, darum „Abholung heute, 15–18 Uhr“ – nur das Datum.

![Heute](berichte/bilder/lauf13-handy/3-heute.jpg)

![Heute mit Zahlung eingerichtet](berichte/bilder/lauf13-handy/3b-heute-zahlung-eingerichtet.jpg)

**Postfach-Liste und Faden (87, nur nachher – vorher gab es das Postfach nicht):** Die Liste zeigt die Fäden mit Marke, Datum und Zustand (ungelesen; „Du hast geantwortet“), darüber die Filter Alle · Ungelesen · Wichtig. Der Faden: Kopf „‹ Postfach“, der Titel als Überschrift, die Team-Nachricht (Wichtig, mit „Ansehen“), die Antwort des Hofs, die Antwort des Teams, darunter das Eingabefeld „Antwort an das Team …“.

![Postfach-Liste](berichte/bilder/lauf13-handy/4-postfach-liste-nachher.jpg)

![Faden mit Antwort](berichte/bilder/lauf13-handy/5-faden-nachher.jpg)

**Admin-Postfach bei 1440 (86, 87):** Vorher die Meldungsliste des Briefkastens; nachher `/admin/postfach` mit den Reitern Unterhaltungen · Meldungen · Rundschreiben, links die Fäden, rechts der geöffnete Faden mit dem Antwortfeld des Teams. Der Reiter heißt „Postfach 6“ (5 Meldungen zu entscheiden plus 1 ungelesene Antwort) statt „Briefkasten 5“; am Handy (6b) „Neu im Postfach“. Die alte Meldungsliste liegt jetzt unter dem Reiter „Meldungen“. 6c zeigt das Formular „Neues Rundschreiben“ ausgefüllt, vor dem Senden (Ganzseite, 1440 × 1529).

![Admin-Postfach 1440](berichte/bilder/lauf13-handy/6-admin-postfach-1440.jpg)

![Admin-Kopf 390](berichte/bilder/lauf13-handy/6b-admin-kopf-390.jpg)

![Neues Rundschreiben](berichte/bilder/lauf13-handy/6c-admin-rundschreiben-1440-nachher.jpg)

**Hofseite mit quadratischem Titelbild bei 1440 (89):** Vorher wurde das Quadrat auf 300 px Höhe beschnitten; nachher steht es ganz in der Mitte (360 × 360) mit der unscharfen Kopie links und rechts, der Rahmen ist 360 statt 300 px hoch. Der Hofname ragt weiter in die Unterkante (Bestand, Abschnitt 8). Bei 390 (7b) ändert sich im ersten Bildschirm nichts außer dem Namen „Agrilo“.

![Hofseite 1440](berichte/bilder/lauf13-handy/7-hofseite-quadrat-1440.jpg)

![Hofseite 390](berichte/bilder/lauf13-handy/7b-hofseite-quadrat-390.jpg)

## 6. Wortliste (86, 90)

Fundstellen der Arbeitsliste N12 (Stand Branch 91, 23 von 23):

| Wort | Zahl | umgestellt | Ausnahme |
|---|---|---|---|
| Briefkasten | 14 | 13 → Postfach | 1 (Kopf des Kurator-Exports) |
| Mitteilung | 7 | 0 | 7 (Anlass eines Beitrags, 5 Dateien) |
| Newsletter | 2 | 0 | 2 (Anmeldung bei einem Hof) |
| Posteingang, Chat, Thread, Konversation, Benachrichtigung, Post | 0 | – | – |

Umgestellt (13): Admin-Reiter und Chips „Postfach · n“, Titel/Überschrift/Ladefehler von `/admin/meldungen`, „‹ Postfach“ im Detail, „Neu im Postfach“ (Handy), Wochen-Mail (Betreff „Postfach: n neu, …“, Überschrift, Knopf „Postfach öffnen →“), Fehler-Mail („Im Postfach ansehen →“).

Verbliebene Ausnahmen (8 Einträge, 10 Fundstellen, je mit Grund im Test):
- Kopf des Kurator-Exports „# Briefkasten — n Meldungen“: `istExport` in `scripts/briefkasten.ts` erkennt den Export daran; Umstellen bräche `pnpm briefkasten export` (Gegenprobe: 5 CLI-Tests rot). Braucht eine Grenzerweiterung auf das Skript und vier Testdateien – Nacharbeit.
- „Mitteilung“ als Anlass eines Beitrags (Teilen) und „Newsletter“ als Anmeldung bei einem Hof – andere Bedeutung als Postfach, bleiben.
- Rechtstext: `tests/wortliste.test.ts` nimmt die AGB-Dateien (`src/lib/rechtstexte/agb.ts` …) je Datei aus (Freigabe §2) – der Text ist wörtlich `docs/recht/agb.md`.
- Nicht in der Wortliste, aber verwandt: „Benachrichtigungen“ (Mehrzahl, Zustimmung zu Mails) in `sonner.tsx:16`, `emails/_layout.tsx:118`, `profile-client.tsx:151`, `customer-magic-link.tsx:20`, `unsubscribe-client.tsx:52` – trifft die Wortgrenze nicht; Entscheidung für dich (Abschnitt 10).
- Außerhalb von `src/` prüft der Test nichts: CLI-Meldungen, Skill und Agenten unter `.claude/` sagen weiter „Briefkasten“.

## 7. Entscheidungen des Dirigenten (bitte bestätigen oder ändern)

- **Register-Kennungen** wie in der Freigabe: M1, N12, N13, K3, T8, F9 waren frei; O4 geändert wie vorgegeben.
- **91: 314 Domain-Literale in Tests sind kein Blocker.** Die Freigabe sagt „alle Erwartungen auf Agrilo/agrilo.at“; die Literale sind 1:1 ersetzt (137 davon Beispiel-Links in `sentry-hygiene-felder.test.ts`). Nacharbeit: Beispieladressen auf `plattform.example`, wörtlich nur, wo die Domain der Prüfwert ist; dann Ausnahme je Datei statt für ganz `tests/`.
- **Doku-PR: `OFFEN_BIS_86`** – die Wortlisten-Wache bekam die 23 Fundstellen als übersprungene Arbeitsliste, damit der Doku-PR grün ist; 86 leerte sie und schaltete den Test scharf.
- **86: Kopf des Exports bleibt** (Ausnahme mit Grund, siehe Abschnitt 6) – gegen die Grenzerweiterung, weil ein Werkzeug den Text liest.
- **90: Sätze in `src/lib/rechtstexte/agb-einbindung.ts`** statt in `lib/kasse.ts` und `lib/hoefe-entdecken.ts` (Wortlaut der Freigabe): Beide Dateien gehörten in derselben Welle zu 85 bzw. 84. Die Zusage hat eine Quelle in `lib/` und einen Register-Eintrag (O4); der Umzug wären drei Konstanten – Nacharbeit, falls du den Ort aus der Freigabe willst (Abschnitt 10).
- **90: `[Betreiber …]`** steht als „dem Betreiber laut Impressum (E-Mail: …)“ mit Link, weil das Impressum keine Konstante für Betreiber, Rechtsform und Anschrift hat und keine Privatadresse in den Quelltext soll. Braucht eine Konstante im Impressum (Nacharbeit).
- **Grenzerweiterungen** (jeweils keine andere Nummer an der Datei, oder im Sammel-PR zusammengeführt):
  - 84: `hoefe-client.tsx` 7 Zeilen (Ankunftstext, Vermerk), `DESIGN_SYSTEM` Abschnitt Entdecken (alte Regel „vier Ziffern“ wäre falsch), BAUSTEINE.
  - 85: `globals.css` (vier modusfeste Tokens, Bedingung: Tabelle + Test – in Runde 1 erfüllt), Hof-/Kundin-Marken-Dateien, Knapp-Hinweis in `produkt-karte.tsx`/`produktdetail-kunde.tsx`, Kommentare, genullte Platzhalter-Nummer in `profile-form.tsx`.
  - 86: Admin-Mails und `email.ts:459` (Betreff der Wochen-Mail).
  - 87: `hof-shell.tsx` (Symbol, Zähler, Postfach oben im Mehr-Blatt), `farmer-nav.tsx` (nur Symbol), `hofbereich.ts`, `(hof)/layout.tsx`, `dashboard/page.tsx`, `slug.ts`/`next.config.ts`/`src/proxy.ts` (`/postfach`), acht Tests.
  - 90: `slug.ts`, `next.config.ts` (`agb` reserviert – sonst wäre ein Hof „agb“ nie erreichbar; `reservierte-slugs` verlangt es); die neuen Dateien `stuecke.ts`, `agb-einbindung.ts`, `components/rechtstexte/*` stehen nicht wörtlich in §1 (Client-Grenze für den Druckknopf, `AgbSatz` in zwei Client-Formularen); `checkout-form.tsx:824` (`max-md:mb-8`) und „Stand: Oktober 2026“ im Datenschutz als Folge der beauftragten Änderung.
  - Alle Nummern: `docs/ai/BAUSTEINE.md` neu erzeugt (Wartungspflicht).
- **EmptyState:** 85 macht `ausweg` zur Pflicht (Aktion oder `{ ohne: Grund }`) und streicht `OHNE_AKTION`. 87 baute parallel mit der alten Schnittstelle plus `POSTFACH_LEER.ohne`/`RUNDSCHREIBEN_LEER.ohne`; ich habe die vier Aufrufe im Sammel-PR umgestellt (im Merge-Commit von 87, 363c37a).
- **Runden, die der Dirigent ausgelöst hat (keine Blocker im strengen Sinn, je mit Grund):**
  - 90: Der pruefer meldete einen fehlenden Rückgabetyp als Blocker (Einzeiler). Grund für die Runde war etwas anderes: `tests/registrieren-formular.test.ts` hatte die Erwartung „kein Haken“ (O4) ohne Grund gestrichen – eine Wache für eine Register-Entscheidung. Dazu `rel` bei `target="_blank"`, Bedienwörter aus der von der Wortliste ausgenommenen Rechtstext-Datei, Register-Kommentar am Datenschutz-Abschnitt.
  - 87: D1 fand den Mail-Fuß „Versandt von Agrilo im Auftrag eines Hofes“ unter den Team-Mails (Freigabe: „Absender aus MARKE_TEAM“) – Blocker, Behebung über einen freiwilligen Fuß-Prop am `EmailLayout` (Grenzerweiterung `_layout.tsx`, von 85 und 90 nicht berührt). D2 meldete den Bericht als unvollständig (fünf Mockup-Abweichungen ohne Grund) – Blocker nach Freigabe §2, nur im Bericht behoben – und die Dateigrenze (acht Dateien außerhalb §1, je klein und erzwungen) – vom Dirigenten bestätigt, kein Blocker. In dieselbe Runde kamen elf kleine Regelverstöße (Nutzertexte außerhalb der einen Quelle, SR-Text am Admin-Reiter mit Grenzerweiterung `admin-shell.tsx:67`, Zod für den Routen-Parameter, fehlertoleranter Nachlauf `letzteMailAm`, DEVELOPMENT ohne doppelte Regeln, strengere WhatsApp-Ausnahme, HofShell-Test).
- **Vier Umsetzer, 87 früh gestartet, Nominatim-Stummel, Platte:** Abschnitt 4.
- **85: Schlusszeile des ersten Commits** nennt das Modell des Umsetzers (Opus) statt der Sitzung – nicht geändert (kein `amend` auf einem Branch, der geprüft wird); die Runde trägt die richtige Zeile.
- **Datenschutz-Satz zur Ortssuche** (`datenschutz/page.tsx:224`, „eine Postleitzahl oder einen Ort“) stimmt seit 84 nicht mehr ganz (jedes abgesendete Wort ohne Ziffern geht an Nominatim): Datei außerhalb der Grenze von 84, 90 hat sie nur um „Postfach“ ergänzt – für dich (Abschnitt 10). Solange 84 Entwurf ist, stimmt der Satz.
- **Merge-Reihenfolge im Sammel-PR:** 87 vor 89, weil die Runde 1 von 89 noch lief, als 87 fertig war (sonst wie die Freigabe: Doku, 91, 85, 86, 90, 87, 89; ohne 84).
- **85, Altlast statt Blocker:** `tests/sentry-hygiene-vergleich.test.ts:240` trägt eine Prüfstoff-Nummer, die an Ziffern klebt und so der neuen Wache entgeht – seit Nr. 64 da, dort als Prüfstoff ausgenommen, im Kopf der Wache als Grenze genannt; nicht geändert.
- **89, Rundungsgrenze 0,75 px** statt 0,5 (Abschnitt 1, Runde 2): Ein exaktes 3:2-Foto bleibt an jeder Breite und Dichte beschnitt; 1499 × 1000 wird beschnitt (verkleinert ohnehin dieselben Maße wie 3:2).

## 8. Nacharbeit („Sollte“), gesammelt

**91**
- Wache durchsucht nur `src/`, `tests/`, `public/`: `.github/workflows/ci.yml` (Test-DB-Name), `next.config.ts` (Sentry-Organisation), gepushte Migration, README, CLAUDE.md, `.claude/` – Suchbereich erweitern, Rest mit Grund in die Ausnahmeliste.
- Ausnahme `'https://farmerzone.invalid'` (`anmeldecode.ts:214`) auf neutralen `.invalid`-Host; doppelte Leerzeile `tests/region-auswertung-seiten.test.ts:49–50`.
- Beispieladressen in Tests auf `plattform.example` (Abschnitt 7).

**86**
- Kopf des Exports: Grenzerweiterung `scripts/briefkasten.ts` + vier Tests, dann fällt die Ausnahme.
- Reiter-Chips am Handy 38 px (`admin-shell.tsx`, bestehend); „Stripe Test“ bleibt orange Marke (`admin-shell.tsx:24`).

**84**
- `ORTSWORT` lässt keine Klammern/Schrägstriche zu („Frankfurt (Oder)“, „Neustadt/Weinstraße“ gelten als Text).
- „Keinen Ort gefunden“ bleibt im Kartenmodus als Kasten ohne Schließen stehen, bis getippt wird.
- `tests/use-ortssuche.test.ts` ist die vierte Kopie des Prüfstands (use-cart, kasse-formular, whatsapp-tippen-fehler) – Baustein für Lauf 14.
- Liste ↔ Karte während einer laufenden Ankunfts-Auflösung: Vermerk fehlt, ein Neuladen löst den abgesendeten Text ein zweites Mal auf.

**85**
- `briefkasten-teile.tsx:49` nie erreichbarer `{ ohne }`-Zweig (nach 86/87); `stripe-modus.ts:95` Kopfkommentar „wörtlich aus freigabe.md §12“ stimmt für `kasse` nicht mehr.
- Abonnentinnen mit unlesbarer Nummer bekommen keinen WhatsApp-Link mehr (vorher ein toter Link), zählen aber in „n von m“ – „Alle geöffnet“ nicht erreichbar (schon MB12 §8).
- Hexwerte in `farm-identity-card.tsx` und `kunden-kopf.tsx` (die Tokens aus 85 liegen bereit); `checkout-form.tsx:548` `online` hängt an `paymentMethod` statt am angebotenen Zahlweg; „deinen Kunden“ in `beitraege-reiter.tsx:36`; `startseite-abschnitte.tsx:269` trägt eine Zusage als Literal.
- Telefonnummern-Wache: hinter einer Klammer-Form verwirft `ohneAnhang` eine direkt folgende zweite Nummer als Anhang; Zweig 2 nimmt hinter der Vorwahl keinen Punkt (Datumsangaben) – beide als Grenze in den Kopf; `funde` verdeckt eine gleichnamige Modulvariable; Namen ohne Verb (`kennung`, `eingeschmuggelt`, `blockIn`, `modusfesteTabelle`, `modusfestVerstoesse`, `zeile`, `mitHofTelefon` – die Nachbarn ebenso); `modusfesteTabelle()` läuft beim Einsammeln der Tests (fehlt die Tabelle, fällt die Datei mit „no tests“ aus).
- `docs/ai/CODING_STANDARDS.md:129` enthält drei ungenullte Beispielnummern in Formen, die die Wache nicht erkennt („+“ bzw. „%2F“ als Trenner) – nullen (Doku).
- DESIGN_SYSTEM:93 begründet „Pausiert bleibt tun“ in der Regeldatei, obwohl die Frage an dich offen ist (Abschnitt 10).

**90**
- Betreiber, Anschrift, Rechtsform als Konstante im Impressum (`impressum/page.tsx`, `support.ts`), dann `PLATZHALTER_ANGABE.betreiber`.
- Mail verlinkt die laufende Fassung (26.2 nennt die Fassung bei der Bestellung).
- `DESIGN_SYSTEM` „Infoseiten“: Satz zu /agb („Text aus `src/lib/rechtstexte/agb.ts`, Verzeichnis mit Sprüngen, Stand-Vermerk, Druckknopf“) – offen.
- Verzeichnis-Gruppentitel ohne `aria-labelledby`; ~35 `<section>`-Landmarken (Überschriften würden genügen).
- Kommentar am Datenschutz-Abschnitt „Postfach“: die Zusage „keine Durchsuchung“ steht in der Freigabe §17 Nr. 90 selbst, inhaltlich in AGB 5.4 und T8 – Verweis ergänzen.
- `email.ts:513` reicht `appUrl` nicht durch: der AGB-Link der Bestellbestätigung geht aus Vorschau und Staging auf die Produktion (harmlos unter der Post-Sperre).
- Umzug der Sätze nach `lib/kasse.ts`/`lib/hoefe-entdecken.ts` (Wortlaut der Freigabe), falls gewünscht (Abschnitt 7).

**87**
- Rate-Limit-Eintrag nach `DB_BREMSEN` (`bremse-datenbank.ts`), steht in `postfach.ts`.
- Screenreader-Text am Admin-Reiter sagt nur „Meldungen zu entscheiden“, zählt aber auch ungelesene Antworten.
- Bei einem Ladefehler eines Admin-Reiters verschwindet die Reiterleiste (ganze Seite wird `AdminFehler`), und „Noch einmal versuchen“ verliert `status`/`art`/`faden` – braucht eine freiwillige Überschrift an `AdminFehler` (`admin-teile.tsx`).
- Zähler auf /admin/postfach laufen zweimal je Seitenaufbau (Layout und Seite, `cache()` teilen); `einzeln()` zweimal → Helfer in lib; `teile.tsx` aus dem Routenordner nach `src/components/postfach/`; Zähler-Klassen aus `bottom-nav.tsx` als Helfer.
- Liste auf 100 Fäden begrenzt, Zähler zählt alle (ab 100 gehen „n neu“ und Seitenleiste auseinander); `setzeLesestand` ohne `farmId` im `updateMany` (Besitz vorab geprüft); kein Test „Rate-Limit-Grenze erreicht“; Betreff eines Rundschreibens ist der nackte Titel; `farmer-nav.tsx:166` `zahlWofuer` kennt nur 'admin'.
- `perMailSatz` und `RUNDSCHREIBEN_LEER.satz` wiederholen den Wortlaut anderer Konstanten als Literal – aus den Konstanten bilden.
- Mehr-Blatt: mit dem neuen Eintrag füllt das Blatt die ganze Höhe, „Abmelden“ ist bei 844 px Höhe unten um etwa 10 px angeschnitten (scrollt) – Bild 2.
- Altlasten: wörtliche Sätze in `meldungen-reiter.tsx` (aus /admin/meldungen übernommen) und `hof-shell.tsx:138/553`; Screenreader-Texte in hof-shell/farmer-nav/admin-shell als Literale; `getFarmForUser` ohne Rückgabetyp; „Noch einmal versuchen“ wörtlich in `AdminFehler`.

**89**
- Helligkeitsdelle in der Mitte der Überblendung (füllende Lage 0,5 über Kopie 0,5, `bg-muted` scheint durch) – entfiele, wenn die füllende Lage erst nach dem Einblenden ausblendet (`transition-delay`).
- Dichte 1,5 (Windows 150 %) nicht gemessen; späteres anderes srcset ohne zweites `onLoad` (next/image vergleicht nur `src`); `priority` statt `preload` (Altbestand); Kommentar/Name in `bild-bausteine.tsx:99–101` und `hofseite-kunde.tsx:317` nennen nur „Hochformat“.
- `tests/keine-emojis.test.ts` liest ganz `src/` ohne das 30_000-Limit aus TESTING_GUIDELINES §4 und reißt unter Last das 5-s-Limit (89, 84 und 78 in Lauf 12).

## 9. Regelvorschläge, gesammelt (Prüfung vor Textregel; eingetragen erst nach deiner Freigabe)

- **86:** Eine Arbeitsliste nennt beim Text, wer ihn maschinell liest; `tests/briefkasten-cli.test.ts` prüft `istExport` am echten Export (Bindung). Ort: Ausnahme im Wortlisten-Test mit Grund.
- **90:** Eine gemeinsame Liste der Rechtstext-Dateien in `tests/`, die Wortliste, Fachwort-Wache und zweites-Exemplar-Wache lesen (`TESTING_GUIDELINES` §2). Eine neue Route auf oberster Ebene braucht `slug.ts` und `next.config.ts` – in die Dateigrenze der Nummer (`docs/nachtlauf.md`).
- **91:** Namens-Wache über das ganze Repo außer benannten Ausnahmen (Abschnitt 8).
- **84:** Ein Prüfstand-Baustein für Hooks mit Zeitgebern und offenen Promises (`tests/use-ortssuche.test.ts` ist die vierte Kopie nach use-cart, kasse-formular, whatsapp-tippen-fehler). Und: An Sentry geht aus einem Pfad mit Nutzereingabe nie `error.message`, nur Fehlerklasse und fester Text – `bereinigeFehlerText` entfernt den Text nur wörtlich (Ort: `src/lib/sentry-hygiene.ts`-Kopf oder CODING_STANDARDS).
- **85:** Eine Wache, die Texte sucht, nimmt sich nie selbst aus; Prüfstoff steht nur genullt im Quelltext und wird zur Laufzeit gebaut (TESTING_GUIDELINES §2 – die Telefonnummern-Wache macht es seit Runde 1 vor).
- **87:** Eine neue Mail-Vorlage nennt ihren Absender ausdrücklich (Fuß-Prop), statt den Hof-Satz des Layouts zu erben; Nutzertexte einer neuen Fläche liegen vom ersten Commit an in einer `lib`-Datei (DESIGN_SYSTEM nennt es, 87 verstieß zunächst selbst dagegen).
- **89:** Tests, die Lagen eines Bildes an Layout-Klassen erkennen (`object-*`, `opacity-*`), widersprechen TESTING_GUIDELINES:114 – entweder Ausnahme für Übergänge benennen oder `data-*`-Merkmale einführen; Maße aus `naturalWidth/Height` sind gelieferte, dichtekorrigierte Maße – Verhältnisregeln brauchen eine Rundungsgrenze (DESIGN_SYSTEM Titelbild).
- **Dirigent:** `CODING_STANDARDS` §1 (Namen: Verb zuerst) wird von vielen Testhelfern nicht eingehalten (85, 89) – entweder Regel auf Testdateien einschränken oder eine Wache; nur notiert, nicht eingetragen. Außerdem: `docs/nachtlauf.md` – eine Nummer, die eine neue Route auf oberster Ebene anlegt, bekommt `src/lib/slug.ts` und `next.config.ts` in die Dateigrenze (90, 87).

## 10. Für dich zu tun

**Cutover (Reihenfolge aus §2 der Freigabe):**
1. **Vor dem Merge** des Sammel-PR in Vercel: `NEXT_PUBLIC_APP_URL` und `BETTER_AUTH_URL` (Production) auf `https://agrilo.at`; `EMAIL_FROM` auf „Agrilo <noreply@agrilo.at>“ – Domain agrilo.at bei Resend verifiziert (DKIM/SPF). **Dazu die Testumgebung:** `NEXT_PUBLIC_APP_URL` und `BETTER_AUTH_URL` des Branches `staging` sowie `NEXT_PUBLIC_TESTUMGEBUNG_URL` in Production stehen auf `https://test.farmerzone.at` → `https://test.agrilo.at` (sonst scheitert dort die Anmeldung, 91 D1/D2).
2. Sammel-PR mergen (Merge-Commit). Die Migration läuft über `vercel-build`.
3. **Direkt nach dem Deploy:** farmerzone.at und www.farmerzone.at per 308 auf agrilo.at (Vercel-Domains). Zwischen Variablenwechsel und 308 lehnt die Produktion Anmeldungen auf farmerzone.at ab – das Fenster kurz halten.
4. Stripe (Sandbox): Webhook-Endpunkt, Payment-Method-Domain und Connect-Rückkehradressen auf agrilo.at; test.agrilo.at dem Branch `staging` zuweisen.
5. Prüfen: Anmeldung als Hof; eine Testbestellung mit Karte (Webhook 200, Mail von @agrilo.at mit Links auf agrilo.at); farmerzone.at/<hof> leitet um; `/agb` zeigt den Entwurfs-Vermerk; ein Rundschreiben an die Testhöfe (Info, ohne E-Mail) schicken und eine Antwort eines Testhofs im Admin lesen.
6. Prüfen, dass kein Hof in der Produktion den Slug „postfach“ oder „agb“ trägt (beide sind jetzt reserviert; ein bestehender Hof mit dem Namen wäre nicht mehr erreichbar).

**Marke und Recht:**
- Markenprüfung „Agrilo“ in TMview (Klassen 35, 42; AT und EU).
- `docs/recht/agb.md` anwaltlich prüfen lassen (die zehn Prüfhinweise am Ende der Datei), danach Fassung 1.0 freigeben – bis dahin steht der Entwurfs-Vermerk auf /agb. Für die AGB fehlt die Konstante Betreiber/Rechtsform/Anschrift (Abschnitt 8, 90).
- `datenschutz/page.tsx:224`: der Satz zur Ortssuche nennt nur „eine Postleitzahl oder einen Ort“ – seit 84 geht jedes abgesendete Wort ohne Ziffern an Nominatim (auch „Heu“ oder ein Hofname). Satz anpassen oder die Regel ändern.

**Bilder und Marke:**
- `public/og/startseite.jpg` zeigt noch den alten Schriftzug (neues Bild nötig); die Icons zeigen ein „F“ mit Blatt.

**Entscheidungen:**
- **84 (#276, Entwurf):** Soll ich die Einzeiler-Behebung (Abschnitt 1) einbauen und nachprüfen lassen? Dann kann #276 nach dem Sammel-PR gemergt werden; bis dahin bleibt die Ortssuche wie heute (und der Datenschutz-Satz stimmt).
- „Benachrichtigungen“ (Mehrzahl) in fünf Dateien (Abschnitt 6) – umstellen oder lassen?
- Hofzustand „Pausiert“ in Mein Hof bleibt bernstein (tun) – soll er grau (erledigt) werden? „Stripe Test“ bleibt orange Marke.
- Produktkarte zeigt „Nur noch …“ als leise Zeile statt als Marke (85, Bild im Bericht) – passt das?
- „So lassen“ (ungefährer Standort) übernimmt erst beim nächsten Tippen; der Mockup-Satz „wir zeigen Höfe im Umkreis“ spricht für sofortiges Übernehmen (84).
- Betreff der Wochen-Mail heißt jetzt „Postfach: …“ – Mailfilter anpassen.
- 90: Sollen die Sätze der Kasse und von /hoefe nach `lib/kasse.ts`/`lib/hoefe-entdecken.ts` umziehen (Wortlaut der Freigabe) oder in `agb-einbindung.ts` bleiben (Abschnitt 7)?
- Entscheidungen für Lauf 14: Startseite gestalten; „Frage per E-Mail“ in Futter kaufen als Messfühler für K3; Regelvorschläge aus Abschnitt 9.
- Als letzter Schritt die Live-Schaltung samt `STRIPE_LIVE_AB`.

## 11. Wo die Bilder liegen

Je Nummer unter `docs/nachtlauf/berichte/bilder/<nr>/` (in den Einzel-PRs): 91 sechs, 86 zwei, 84 drei, 85 vier, 87 zwölf, 89 sechs, 90 vier. Die Strecke liegt unter `docs/nachtlauf/berichte/bilder/lauf13-handy/` (10 Paare vorher/nachher, dazu Postfach-Liste, Faden und Rundschreiben-Formular nur nachher); die Einzelbilder und Notizen der Aufnahme bleiben im Arbeitsverzeichnis des Laufs.
