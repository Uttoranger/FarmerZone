# Umsetzungsprompt: Redesign & Kaufstrecke

Stand: 2026-09-30 · **Plan-Dokument** (kein Regelwerk): dauerhafte UI-Regeln stehen in `docs/ai/DESIGN_SYSTEM.md`, die Prozessregeln in `CLAUDE.md`. Dieses Dokument legt fest, **was** gebaut wird und **in welcher Reihenfolge**.

## Rolle und Auftrag

Du bist Senior Full-Stack-Webentwickler mit starkem UX-Verständnis. Setze das Redesign der Plattform um: Kundenseite (kaufen) und Hofbereich (verwalten) als eine responsive Web-App mit gemeinsamem Design-System, dunklem Standard-Theme und hellem Theme.

Das System ist **produktiv mit echten Bestellungen und echtem Geld**. Deshalb: Refaktoriere die bestehende Codebasis schrittweise — Route für Route bzw. hinter Feature-Flag, nie als Big Bang. Jedes Gate aus dem kritischen Pfad ist ein eigener `/sprint`-Auftrag mit Feature-Branch und PR; alle Hard Constraints und Hooks aus `CLAUDE.md` gelten unverändert. Weiche nicht ohne Rückfrage von den Mockups ab; stelle Rückfragen gesammelt vor Beginn eines Schritts, nicht mittendrin.

## Kontext und Referenzen

Das Produkt: Kunden entdecken Höfe in ihrer Nähe, bestellen online und holen im gewählten Zeitfenster am Hof ab; Bäuerinnen und Bauern verwalten Hofseite, Produkte und Bestellungen selbst. Zwei Welten mit eigener Navigation: Kundenseite und Hofbereich.

Verbindliche visuelle Referenz sind die 18 Mockups in `docs/mockups/` (Zuordnung Datei → Screen in `docs/mockups/README.md`): Kundenansicht (Hofseite mobil + Desktop), Mein-Hof-Editor, Hofbereich Desktop (Sidebar, Heute, Bestellungen), Hofbereich mobil (Heute, Bestellungen, Mehr), Kaufstrecke mobil (Entdecken → Produkte → Warenkorb/Checkout → Bestätigung), Neu-Flow und Bestelldetail, heller Modus (Token-Sheet + zwei Beispiel-Screens). Jedes Mockup ist eigenständiges HTML; die Werte darin sind exakt und dürfen ausgelesen werden. Namen, Höfe und Preise darin sind Platzhalter.

Designsprache, Tokens, Komponenten, Navigation und Zustandsregeln: `docs/ai/DESIGN_SYSTEM.md` — vor jedem UI-Schritt lesen.

## Architektur-Entscheidungen für dieses Projekt

Der Stack steht (Next.js 16, React 19, Prisma 7, PostgreSQL, pnpm — siehe `CLAUDE.md`); es gibt **keinen** Monorepo-Umbau. Ergänzend gilt für das Redesign:

- **Token-Layer zuerst:** Custom-Properties auf `:root`, `data-theme`-Umschaltung, Lint-Regel gegen Hexwerte in Komponenten (Details in `DESIGN_SYSTEM.md`).
- **Ein UI-Ort:** Basiskomponenten unter `src/components/ui`, beide Welten importieren nur von dort.
- **Zwei AppShells** (Kunde / Hofbereich) nach `DESIGN_SYSTEM.md`; bestehende Seiten werden beim Umzug in die Shell auf das neue System umgestellt, nicht vorher.
- **Backend-Ressourcen** (bestehende Modelle erweitern, nicht ersetzen): `farms`, `products` mit Lagerstand pro Woche (bei 0 automatisch ausverkauft — Abzug nach der bestehenden `updateMany`-Regel), `pickup_slots`, `orders`/`order_items` mit Statusmaschine `offen → gepackt → abgeholt` (+ `storniert`), Übergänge nur serverseitig. Schema-Änderungen nach Expand/Contract (`docs/ai/ARCHITECTURE.md`, Abschnitt 5), Migrationen nur mit Freigabe.
- **Zahlungen:** Stripe Connect mit Destination Charges auf Hof-Konten; online (Karte, Apple/Google Pay) und „vor Ort" (Betrag offen bis Abholung).
- **Auth-Ziel für Kunden:** passwortlos (E-Mail-Code oder Apple/Google-Login); Gast-Checkout nur mit E-Mail ist erlaubt, wenn „vor Ort bezahlen" gewählt ist. Abgleich mit dem bestehenden Auth-Stand ist Teil von Schritt 3.

## Sequenziell: der kritische Pfad

Sechs Schritte, die aufeinander aufbauen und nicht überlappen dürfen. **Ein Schritt = ein Gate = ein `/sprint`-Auftrag = ein PR.** Erst abnehmen, dann weiter.

1. **Tokens und Theme-Schalter.** Beide Themes als Custom-Properties, `data-theme`-Umschaltung, Lint-Regel. Blockiert alles — jede vorher entstehende Komponente müsste sonst refaktoriert werden.
2. **Basiskomponenten und beide AppShells.** Komponentenliste aus `DESIGN_SYSTEM.md` plus Kunden-Shell und Hof-Shell, abgenommen auf der Preview-Seite in beiden Themes und beiden Breakpoints. Blockiert alle Screens.
3. **API-Verträge einfrieren.** Schemas für `products`, `pickup_slots`, `orders` inklusive Statusmaschine, abgeglichen mit dem bestehenden Prisma-Schema (Expand/Contract-Plan für Abweichungen, Migrationen zeigen und Freigabe abwarten). Dieser Schritt schaltet die Parallelisierung frei: ab hier bauen UI-Sessions gegen Mock-Daten, das Backend liefert parallel.
4. **Kaufstrecke in Flow-Reihenfolge.** Entdecken → Hofseite mit Produkte-Tab → Warenkorb/Checkout als ein Screen (Zeitfenster-Chips, Apple/Google Pay zuerst) → Bestätigung mit Abholcode. In dieser Reihenfolge, weil jeder Screen den Zustand des vorigen konsumiert. Rollout hinter Flag; die alte Strecke bleibt bis zur Abnahme erreichbar.
5. **Bauern-Kernflow.** Produktliste und Produkt anlegen (+ Neu) → Packliste/Bestellungen → Bestelldetail mit Artikel-Checkliste und Statuswechsel. Erst nach Schritt 4 sinnvoll testbar, weil echte Bestellungen aus der Kaufstrecke kommen.
6. **End-to-End-Probelauf.** Die komplette Schleife (Kunde bestellt, Bauer packt, Kunde holt ab, Status wandert) mit dem Pilothof im Stripe-Testmodus, danach kontrollierter Produktiv-Durchlauf. Erst nach diesem Gate werden Phase-2-Arbeiten gemergt.

Faustregel bei Priorisierungskonflikten: Alles zwischen „Kunde findet Hof" und „Bauer übergibt Korb" schlägt alles andere.

## Parallel: Sessions und Abhängigkeiten

Solo-Betrieb mit parallelen Claude-Code-Sessions in eigenen **Worktrees** (Prozessregeln aus `CLAUDE.md` gelten: eigener Branch je Aufgabe, kein `git stash`, WIP-Commits). Nach Schritt 3 können diese Stränge parallel laufen; sie teilen sich außer `src/components/ui` keine Dateien:

| Strang | Inhalt | Braucht vorher | Liefert an |
|---|---|---|---|
| A · Kaufstrecke (UI) | Schritt 4, danach Kundenkonto, „Meine Bestellungen", Beiträge | Schritte 1–3 | Schritt 6 |
| B · Hofbereich (UI) | Heute, Bestellungen, Mein-Hof-Editor, danach Auswertung/Kunden/Verkäufe | Schritte 1–3 | Schritt 6 |
| C · Backend | Bestell- und Slot-Logik, Statusmaschine, Lagerstand, Stripe Connect | Schritt 3 | A und B (echte API) |
| D · Querschnitt | E-Mail-Vorlagen (Bestätigung, Abholerinnerung), Benachrichtigungen, Light-Mode-QA, leere Zustände | Schritt 1 | Schritt 6 |

Regeln für die Parallelität:

- **Synchronisationspunkt:** Nach jedem abgeschlossenen Strang-PR gegen die echte API integrieren statt gegen Mocks; Vertragsänderungen nach Schritt 3 nur bewusst und mit Anpassung aller betroffenen Stränge im selben Zug.
- **Nicht parallel:** Tokens oder bestehende Komponenten ändern, während A/B bauen (im UI-Ort nur additiv); Checkout-UI und Bestell-Backend auseinanderlaufen lassen (eine Statusmaschine, gemeinsam getestet); zwei Sessions an derselben Shell oder demselben Ordner.
- **Nur eine Session aktiv:** Reihenfolge A → C → B → D innerhalb jedes Sequenz-Schritts — Kaufstrecke zuerst, ihr Backend direkt danach.

## Definition of Done je Screen

Die UI-Regeln (Kontrast, Touch-Ziele, ein CTA, vier Zustände, Breakpoints, Formatierer) stehen in `docs/ai/DESIGN_SYSTEM.md` und sind Teil jeder Abnahme. Zusätzlich gilt als Done:

- Beide Themes und beide Breakpoints umgesetzt, alle vier Zustände vorhanden.
- `pnpm typecheck && pnpm lint && pnpm test` grün; automatischer Accessibility-Check (z. B. Axe) ohne Fehler.
- PR verlinkt das zugehörige Mockup aus `docs/mockups/` und den Schritt aus diesem Dokument; Bericht nach `CLAUDE.md`, Abschnitt 4.
- Am echten Handy durchgetippt (Testschritte stehen im Bericht). Für die Kaufstrecke zusätzlich: der End-to-End-Probelauf aus Schritt 6 ist Teil der Abnahme, nicht optional.
