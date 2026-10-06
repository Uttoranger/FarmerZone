# Morgenbericht Nachtlauf 3 (2026-10-06)

Der Dirigent lief interaktiv in einer Cloud-Sitzung (Abschnitt 8 von `docs/nachtlauf.md`). Bearbeitet wurden die Nummern 15 bis 17. **Der Haltepunkt 17 aus `freigabe.md` §7 ist erreicht.** Nr. 18 wurde nicht begonnen.

Weil #170 bis #178 aus Lauf 2 noch offen sind, ist Lauf 3 auf #178 gestapelt.

## 1. Bearbeitete Nummern

| Nr | Gate | PR | Basis | Prüfung, Nachbesserungen | Weggelassen bzw. offen |
|---|---|---|---|---|---|
| 15 | Für Höfe, Registrieren, Einrichten | #179 (**Entwurf**) | #178 | 1 Blocker: Zustimmungs-Haken zu Konditionen, die der Admin-Weg anders vergibt, entfernt. Endlosschleife auf `/onboarding` behoben. | Konditionen und Pilothof entscheiden; S3 (E-Mail-Bestätigung) nicht gebaut; SEPA-Mandat und Tarifwahl (Gate 8); „Rückruf anfordern" (nicht freigegeben) |
| 16 | Mein Hof mit Vorschau | #180 | #179 | nichts blockierend; zwei Sätze in ARCHITECTURE nachgezogen | Bearbeiten am Handy unter der Checkliste entscheiden; Mockup-Abweichungen |
| 17 | Heute | #181 | #180 | nichts blockierend. Runde 1: pausierter Hof ohne Teilen-Karte und Freischaltungs-Moment, 44 px, zwei Fachregeln als reine Funktionen mit Tests, verwaiste Teile entfernt | Bedingung des Stripe-Hinweises entscheiden; „Neue Kunden"; „gepackt" abhaken (Nr. 19); Zählung über Links (Nr. 21); Teilen abschaltbar (Gate 7) |

Ablauf je Nummer wie in Lauf 2:
- ein frischer Umsetzer;
- danach `tester` und `pruefer`;
- dann eine Nachbesserungsrunde;
- vor jedem Push habe ich Typecheck und Tests selbst wiederholt.

Stand auf #181: 219 Testdateien mit 3865 Tests grün, Integration 15 Dateien mit 129 Tests grün. Lint meldet in keiner geänderten Zeile einen neuen Befund. Der Altbestand sank auf 17 Fehler und 7 Warnungen, weil Nr. 15 `onboarding-client.tsx` gelöscht hat.

Keine Nummer brauchte eine Migration oder ein neues Paket.

**Neu im Hofbereich:**
- Nr. 16 legt die Routengruppe `(hof)` mit der HofShell an. `/farm-page` und `/dashboard` sind umgezogen, ihre Adressen bleiben gleich.
- Alle anderen Hof-Seiten haben weiter die alte Navigation, so wie es die Umstellung Route für Route vorsieht.
- Beide Gruppen schützt derselbe Lader `src/server/hofbereich.ts`.

## 2. Merge-Reihenfolge

Strikt der Reihe nach: **#170 → … → #178 (Lauf 2) → #179 → #180 → #181.**

- **#179 ist ein Entwurf.** Erst die Konditionen-Frage entscheiden (Abschnitt 3). Solange #179 nicht gemergt ist, warten auch #180 und #181, weil sie darauf aufbauen.
- Bei Squash-Merges gilt Regel 8: Vor dem nächsten Lauf (oder auf Zuruf „resolve conflicts") holt der Dirigent `main` in die offenen Branches.

## 3. Fragen und Entscheidungen für dich

**Vor dem Merge von #179:**
1. **Konditionen für neue Höfe.**
   - `/fuer-hoefe` und `/konditionen` nennen jetzt die Tarife nach E6 aus einer Quelle (`src/lib/konditionen.ts`).
   - Die Admin-Freischaltung vergibt aber weiter einen Gründungsplatz (`GRUENDUNGS_KONDITIONEN`).
   - Beides kann nicht zugleich gelten. Bis zu deiner Entscheidung gibt es beim Registrieren keinen Zustimmungs-Haken, nur einen Link zu den Konditionen.
2. **Pilothof:** Was gilt für den Hof, dem das Gründungshof-Angebot zugesagt war? Die öffentliche Seite nennt es nicht mehr. Einen Satz „Bestehende Höfe behalten ihre Konditionen" habe ich bewusst nicht erfunden, weil das eine Vertragsaussage wäre.
3. **S3, E-Mail-Bestätigung:**
   - Es gibt keinen Weg, die Adresse zu bestätigen (`/verify` ist leer).
   - Eine Sperre „Uploads erst nach Bestätigung" würde deshalb jeden neuen Hof bis zur Freischaltung blockieren.
   - Braucht deine Freigabe für Bestätigungsversand und Seite.

**Entscheidungen ohne Eile:**
4. **#180, Bearbeiten am Handy:** Unter der Checkliste steht weiter die Hofseite mit Stiften, das Mockup zeigt nur „Vorschau ansehen". Soll das Bearbeiten am Handy entfallen? Dafür bräuchte es einen eigenen Auftrag.
5. **#181, Stripe-Hinweis:**
   - Umgesetzt ist die Bestandsregel: „pausiert" nur, wenn ein Stripe-Konto existiert, aber nicht fertig ist.
   - Die wörtliche Gate-Bedingung `acceptsOnline && !stripeAccountReady` zeigte „pausiert" bei jedem neuen Hof ab dem ersten Tag.
   - Höfe ohne Konto sehen stattdessen den Schritt „Online-Zahlung einrichten" in der Erste-Schritte-Karte.
   - Umstellen wäre eine Zeile.
6. **#181, drei statt vier Kennzahlen:** Für „Neue Kunden" gibt es keine Regel, was „neu heute" heißt.
7. **Mockup-Abweichungen:** je PR im Bericht aufgelistet (#179, #180, #181 mit zehn Punkten).

**Weiter offen aus Lauf 2** (siehe `morgenbericht-2026-10-05.md` §4): E8 (ruhendes Konto beim Checkout), Fehler-Token, S11, Reiter „Beiträge", Produktionsprüfungen (Slug `bestellungen`, Lighthouse), EPS/Wallets im Stripe-Dashboard.

**Altlasten, neu aufgefallen, Vorschläge für eigene PRs:**
- **`checkSlugAvailability`** (`src/server/actions/onboarding.ts`):
  - keine Zod-Längengrenze und kein Rate-Limit;
  - verrät auch Slugs noch nicht freigeschalteter Höfe;
  - wird seit #179 von der öffentlichen Registrierung aufgerufen (entprellt).
- **Tote Funktionen** `createOnboardingProducts` und `createOnboardingSlots`.
- **Hydration-Hinweis** am Theme-Schalter der HofShell, wenn das Gerät auf „System, dunkel" steht. Er liegt in der Shell, nicht im Inhalt.
- **Erste-Schritte-Karte:** Ihre Zeilen-Links zeigen den Standard-Fokusrahmen des Browsers statt `FOKUS_RAHMEN`.
- **`sectionsConfig`:** wird ohne Zod gelesen (`as SectionConfig[]`), inzwischen in drei Abfragen.
- **Test-Umgebungsbanner:** verdeckt oben etwa 28 px der festen Seitenleiste der HofShell (nur Test und Dev).

## 4. Screenshots

Die Screenshots liegen lokal in der Cloud-Sitzung unter `.nachtlauf/screens/15/` bis `17/` und sind nicht committet:
- jede umgestellte Route bei 390, 1024 und 1440 px in beiden Themes;
- für Nr. 17 zusätzlich mit und ohne Testbestellungen, Stripe-Hinweis und Freischaltungs-Moment.

Mit dem Ende der Sitzung sind sie weg; neu erzeugen wie in `morgenbericht-2026-10-05.md` §5 beschrieben.

## 5. Abweichungen und Vorkommnisse

- **Haltepunkt:** Zu Laufbeginn stand der Haltepunkt noch auf 14. Deshalb habe ich einmal nachgefragt (echter Blocker im Sinne der Regeln). Antwort: 17, eingetragen in `freigabe.md` §7.
- **Gestapelt auf offenen PRs:** #170 bis #178 waren beim Start nicht gemergt, also baut Lauf 3 auf #178 auf.
- **Nachbesserung Nr. 17:** Beim Aufräumen verwaister Teile hatte der Umsetzer zwei noch benutzte Teile aus dem Checkout mitgelöscht. Der Typecheck fing das ab, beide sind zurück. Danach waren Typecheck und Tests beim Umsetzer und bei mir grün.
- **Playwright** ist weiterhin nicht installiert. Die Browser-Prüfungen liefen über agent-browser gegen die lokale Test-DB; echte Stripe-Aufrufe und echte Mails gab es nie.
