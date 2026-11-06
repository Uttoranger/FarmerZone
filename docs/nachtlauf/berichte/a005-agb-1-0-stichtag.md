# A005 · /fix AGB 1.0 mit dem Stichtag umschalten
**Status:** bereit, freigegeben am 05.11.2026 (E-019 = F021 Fragen 1–8 wie empfohlen, F024; Entwurf 05.11.2026, gegengelesen). Erst nach dem Merge von Lauf 31 starten.
**Herkunft:** F021 · ersetzt claude/fix-agb-1-0-prompt.md

Freigabe eingesetzt am 05.11.2026 (F024): alle Fragen aus F021 wie empfohlen; 19.6 ohne Weiterverrechnung der Kosten einer Rücklastschrift (E-012 Punkt 6). `<MARKE>`, `<PRODUKTION_HOST>` und `<marke>` sind Konstanten im Code. `<Tag>`, `<T>` und `<Vortag>` füllt die Seite zur Laufzeit.

````
/fix AGB 1.0: mit dem Stichtag „Hofpreis-Modell ab“ von 0.9 auf 1.0 umschalten

Vorher: origin/main hineinholen; CLAUDE.md und docs/entscheidungen.md lesen. Ist Lauf 31 (Sammel-PR integration/lauf31) noch nicht gemergt: STOPP und melden. Steht N45 (siehe 7c) noch nicht als Entscheidung fest oder widerspricht O4/N38 dem Auftrag ohne den Verweis auf N45: STOPP und melden. Dann zusätzlich lesen: docs/ai/ARCHITECTURE.md, CODING_STANDARDS.md, TESTING_GUIDELINES.md, DESIGN_SYSTEM.md, BAUSTEINE.md (Stichworte „AGB“, „Rechtstext“, „Stichtag“, „Belehrung“).

Ausgangslage (geprüft 05.11.2026, main 1216b8c):

AGB-Seite und Mail-Anhang
- /agb zeigt Fassung 0.9, fest verdrahtet: src/lib/rechtstexte/agb.ts:65 (AGB_STAND_VERMERK). „Kurz erklärt“ nennt die Servicegebühr (agb.ts:87). Die Seite src/app/(public)/agb/page.tsx ist voll statisch.
- Die Kennung der Fassung kommt aus dem Vermerk (agb-datei.ts:33-37). Danach richten sich der Dateiname des Mail-Anhangs (:44) und die Zustimmung der Höfe (server/actions/agb-zustimmung.ts:27).
- Der Mail-Anhang hängt an keiner Bestellung: email.ts:599-601, benutzt in baueOrderConfirmation (:1037) und onsiteConfirmationInhalt (:1090). OrderForEmail kennt gebuehrModell schon (:430). MAIL_AGB_ZEILE und KASSE_AGB_SATZ verlinken fest auf /agb (agb-einbindung.ts:48-63; emails/order-confirmation.tsx:116, emails/onsite-confirmation.tsx:111).
- Order.gebuehrModell ist der Snapshot beim Anlegen (checkout/route.ts:800): null = bisher, 'hofpreis' = N38. Er wird nie geändert.

Stichtag, /konditionen und Bestellstopp
- Der Stichtag: hofpreisModellAb und gebuehrModellFuer (lib/plattformgebuehr.ts:51-62). Vorgabe ohne Wert: BAR_SERVICEGEBUEHR_AB = 1.2.2027. Verschiebbar nach vorne und hinten, solange er nicht erreicht ist (lib/plattform-einstellung.ts:395-401).
- ladeHofpreisEinstellung wirft nie und fällt bei einem Fehler still auf die Vorgabe zurück (server/queries/plattform-einstellung.ts:191-198). ladePlattformEinstellung (:59) liest über unstable_cache mit Tag und wirft bei einem Fehler. Die Admin-Action baut nur '/' und den Tag neu (server/actions/plattform-einstellung.ts:147-149).
- /konditionen (revalidate 3600) schaltet schon mit dem Stichtag um. Vor dem Stichtag steht dort wörtlich K1 (KONDITIONEN_UEBERGANG, page.tsx:93, konditionen.ts:399-407). Danach fehlt der Tarifstart, und der Gebührenabschnitt trägt KONDITIONEN_ENTWURF (konditionen.ts:454, :475).
- Notbremse (N34): Der Bestellstopp beginnt immer beim Speichern; wählbar ist nur „bis“, höchstens 72 Stunden (server/actions/notbremse.ts:54-80; lib/notbremse.ts:45, :96-101). Geprüft wird er in /api/reserve und /api/checkout (route.ts:474). Einen Start zu einem späteren Zeitpunkt gibt es nicht.

Höfe und Kasse
- Zustimmung der Höfe (Nr. 207): Farm.agbFassung und agbZugestimmtAm, gesetzt nur über den Knopf. Die Karte steht in Heute (dashboard/page.tsx:125, lädt den Stichtag nicht) und in Einrichten (onboarding/page.tsx:59, :65, über ladeHofpreisEinstellung).
- Satz unter dem Kaufknopf: KASSE_AGB_SATZ (agb-einbindung.ts:48-52) mit „… dass <MARKE> die Vermittlung sofort ausführt“. Das passt nur zu 0.9 (12.5). Kasse und Zahlungsschritt nach „Weiter zur Zahlung“ kennen das Modell über farm.preisAnzeige !== null (checkout-form.tsx:593, :598, :1029). Der Zahlungsschritt einer bestehenden Bestellung („Erneut bezahlen“, Fortsetzung) kennt den Snapshot der Bestellung über `anzeige` (checkout-form.tsx:1104, :1131, :1136; geladen in (public)/[farmSlug]/checkout/page.tsx:74-77).
- Belehrung und Muster-Formular stehen wörtlich in src/lib/widerruf.ts (BELEHRUNG, :350-392). Die N39-Knöpfe „Vertrag widerrufen“ und „Widerruf bestätigen“ (:246-250) bleiben wörtlich (N43).
- Alle 4 Höfe in der Produktion sind Testhöfe; es gibt keine echten Höfe.

Register und Tests
- O4 (docs/entscheidungen.md:950) sagt: „Freigabe der Fassung 1.0 nach anwaltlicher Prüfung durch die Projektleitung; bis dahin trägt die Seite den Stand-Vermerk“ und „Änderungen am Wortlaut nur durch die Projektleitung (nach anwaltlicher Prüfung)“. N38, Punkt „Rechtstexte“ (:880) und „Umsetzung“ (:882), sagt: „Rechtstexte (Hof-AGB, Ankündigung, Datenschutz) kommen nach Rückmeldung der Anwältin. Vor dem Stichtag müssen sie stehen.“ Beides ändert N45 (Schritt 7c).
- Tests mit 0.9 oder genau einer Fassung: tests/agb-text, agb-seite, agb-datei, agb-zustimmung, belehrung-mail, integration/agb-zustimmung.int, hof-akte (nur Anzeige). Wachen mit agb.ts als Ausnahme: fachwort-wache, gebuehr-wort-wache, konditionen-uebergang, ladeansichten, warenkorb-wort-wache, wortliste.

Entschieden (Projektleitung im Chat, 05.11.2026, E-019 = F021 Fragen 1–8 wie empfohlen (F024)):
- Variante A (Projektleitung im Chat, 31.10.2026): AGB 1.0 wird ohne Startphase und vor der anwaltlichen Prüfung veröffentlicht. Sie gilt ab dem Stichtag „Hofpreis-Modell ab“. Die Anwältin prüft nach, daraus wird 1.1. Das ändert O4 und N38 (N45).
- F021: /agb schaltet mit dem Stichtag selbst um und wird bei jedem Aufruf frisch gebaut. Gemergt wird, sobald fertig; am Tag T wird nichts deployt.
- Für jede Bestellung gilt die Fassung ihres Gebührenmodells (Snapshot): bisher = 0.9, hofpreis = 1.0. Danach richten sich Mail-Anhang, Dateiname und die Links auf die AGB. 0.9 bleibt dauerhaft abrufbar.
- Höfe stimmen ab dem Merge der neuesten Fassung (1.0) zu. Gespeichert wird '1.0' mit Zeitpunkt, keine neue Spalte. Eine Zustimmung nach der Ankündigung gilt als Verzicht auf den Rest der Frist (AGB 32.4).
- Betriebsregel: Vor dem Stichtag schaltet die Projektleitung keinen echten Hof frei, der der Fassung 1.0 nicht zugestimmt hat. Sie bittet keinen echten Hof um Zustimmung, bevor er die Ankündigung per E-Mail mit 1.0 im Anhang hat. Keine Sperre im Code.
- Kasse im Hofpreis-Modell ohne die Zustimmung zur sofortigen Vermittlung. Maßgeblich ist bei einer bestehenden Bestellung ihr Snapshot. Im Modell bisher bleibt der Satz unverändert.
- Die Marke „Entwurf – die Anwältin prüft den Wortlaut“ auf /konditionen fällt ab dem Stichtag weg.
- Register: neuer Eintrag N45 (R1 ist mit „Rate-Limit“ belegt). Er ändert O4 und N38 und ergänzt B1, N2 und K1.
- E-018/N44: 12 Monate Gründungszeit. N43: Muster, Formular und N39-Knöpfe bleiben wörtlich; die AGB bleiben bis zur Anwältin beim Wortlaut des Entwurfs (Titel 14 mit „Widerruf im Fernabsatz“).

Umsetzung:
1. Zwei Fassungen als Daten, eine Auswahl.
   a) src/lib/rechtstexte/agb-0-9.ts: der heutige Inhalt von agb.ts, Wort für Wort, als ein Objekt mit Kennung '0.9', Vermerk, Titel, Kurz erklärt, Teilen und Anhang. Eingefroren: Kopfkommentar „wird nie mehr geändert (Bestellungen im Modell bisher)“.
   b) src/lib/rechtstexte/agb.ts: Fassung 1.0 aus dem Text unten (zwischen den Markern), im selben Objekt-Aufbau, mit Kennung '1.0'. Darin: 35 Punkte in Teil A–D, Tabelle 2.6, die Listen in 9.5 und 14.2 (mit dem Absatz danach ohne Nummer), Kurz erklärt mit 6 Punkten, AGB_ANHAENGE mit 3 Anhängen.
   c) Anhang 1 und 2 werden nicht abgetippt. Ein neuer Blocktyp (z. B. 'belehrung' für Teil A und 'formular' für Teil B) zeichnet sie aus BELEHRUNG in src/lib/widerruf.ts, ohne Hofangaben (Platzhalter wie dort). Die kursiven Zeilen und die „Hinweise (kein Teil des Musters)“ stehen als eigener Blocktyp 'hinweis' in agb.ts. Anhang 3 kommt als nummerierte Absätze.
   d) Neuer Platzhalter in stuecke.ts: 'inkrafttreten' (im Markdown „[Tag des Inkrafttretens]“). Gefüllt wird er mit formatDatumLang(hofpreisModellAb(einstellung)), also dem Wiener Kalendertag.
      - Der Stand-Vermerk von 1.0 ist eine Funktion des Stichtags: „Fassung 1.0 – gilt ab <Tag>“.
      - PLATZHALTER_ANGABE wird eine Funktion mit Kontext ({ inkrafttreten: Date | null }).
      - Betreiber und E-Mail bleiben wie heute. Hat A001/A004 inzwischen Konstanten für den Betreiber im Impressum angelegt, nimm diese; sonst bleibt der Verweis aufs Impressum.
   e) src/lib/rechtstexte/agb-fassung.ts (neu, rein, ohne Prisma, ohne Uhr). Erst BAUSTEINE.md prüfen, ob es eine passende Stelle schon gibt.
      - Inhalt: AGB_FASSUNGEN ['0.9', '1.0'], AGB_NEUESTE = '1.0', geltendeAgbFassung(einstellung, jetzt) (vor dem Stichtag 0.9, ab dem Stichtag 1.0, Grenze wie gebuehrModellFuer) und agbFassungFuerBestellung({ gebuehrModell }) (istHofpreisBestellung → '1.0', sonst '0.9').
      - Im Kopfkommentar dieser Datei und von src/lib/agb-zustimmung.ts steht die Regel: „Farm.agbFassung '1.0' mit agbZugestimmtAm vor dem Stichtag = Zustimmung vorab nach der Ankündigung, samt Verzicht auf den Rest der Frist (AGB 32.4).“ prisma/schema.prisma wird nicht angefasst.
2. Datei für den Mail-Anhang (agb-datei.ts): agbAlsHtml(fassung, kontext) und agbDateiname(kennung) je Fassung; die 300-kB-Grenze gilt je Fassung. agbFassung() heißt künftig „neueste Fassung für die Zustimmung“ (Name frei wählbar, alle Aufrufer nachziehen).
3. Mails (email.ts):
   - agbAnhang(order) nimmt agbFassungFuerBestellung(order).
   - MAIL_AGB_ZEILE wird eine Funktion der Fassung. Ihr Link führt auf /agb/<Fassung der Bestellung>, Anhang und Link zeigen also immer dieselbe Fassung.
   - Für 1.0 braucht die Datei den Stichtag; lies ihn über ladePlattformEinstellung in try/catch. Scheitert das, ist der Ersatzwert „Stichtag auf <PRODUKTION_HOST>/konditionen“ (ohne Artikel; im Satz entsteht „ab dem Stichtag auf …“, nie „dem dem“). Die Stand-Zeile lautet dann „Fassung 1.0 – gilt ab dem Stichtag auf <PRODUKTION_HOST>/konditionen“. Dazu eine Meldung an Sentry (fester Bereich, kein Text), und es wird nie geworfen: Die Bar-Bestätigungsmail geht „Sofort“ und darf an keinem Nachlauf scheitern (CLAUDE.md, N26).
   - Das gilt für Bestätigung, „Bitte bestätige“, Nochmal schicken und die Vorschau im Admin.
4. Seiten:
   a) /agb wird bei jedem Aufruf frisch gebaut: `export const dynamic = 'force-dynamic'` (Muster wie (hof)/orders/page.tsx:17), kein `revalidate`.
      - Den Stichtag liest die Seite über ladePlattformEinstellung() ohne catch. Das ist der Data Cache mit Tag, also keine Datenbankabfrage je Aufruf; prüfe das und nenne es im Bericht. ladeHofpreisEinstellung wird für Rechtstexte nie benutzt.
      - Neue Datei src/app/(public)/agb/error.tsx: zeigt bei einem Fehler „Die AGB lassen sich gerade nicht laden.“ mit den Links „Fassung 1.0“ (/agb/1.0) und „Fassung 0.9“ (/agb/0.9), dazu den Fehlerbaustein der Rechtsseiten, falls es einen gibt (BAUSTEINE.md). Nie eine Fassung ohne geprüften Stichtag zeigen.
      - Vor dem Stichtag: 0.9, oben der Hinweis „Ab <Tag> gilt Fassung 1.0.“ mit dem Link „Fassung 1.0 lesen“ (/agb/1.0).
      - Ab dem Stichtag: 1.0, am Ende „Frühere Fassung 0.9 (für Bestellungen bis <Vortag>)“ mit Link (/agb/0.9).
      - Die Wörter dieser Hinweise stehen in agb-einbindung.ts (AGB_SEITE_TEXT, unter den Wachen), nicht in agb.ts.
   b) src/app/(public)/agb/[fassung]/page.tsx: generateStaticParams ['0.9', '1.0'], dynamicParams = false, revalidate 3600.
      - Die Seite zeigt genau diese Fassung mit ihrem Vermerk. Es gibt keine Hinweise, die von der Uhr abhängen, nur den festen Satz „Welche Fassung gerade gilt, steht auf /agb.“ mit Link. Den Vermerk von 1.0 baut die Seite aus ladePlattformEinstellung, ohne catch.
      - Canonical auf sich selbst; /agb bleibt die Seite der geltenden Fassung.
      - Prüfe, dass /agb/0.9 und /agb/1.0 auf Vercel als Seite ankommen und nicht als Datei mit Endung (Punkt im Pfad). Wenn nicht: Kennungen im Pfad als „0-9“ und „1-0“, sonst nichts ändern.
   c) agb-ansicht.tsx bekommt die Fassung als Prop statt fester Importe (Verzeichnis, Teile, Anhänge, Kurz erklärt) und zeichnet die neuen Blocktypen. Druckknopf, Verzeichnis und Sprungmarken bleiben. Baue auf dem Layout von Lauf 31 (Nr. 239) auf, ohne es zu ändern.
   d) Admin-Action speichereHofpreisStichtag: zusätzlich revalidatePath für '/agb/0.9', '/agb/1.0' und '/fuer-hoefe'.
   e) /konditionen wird wie /agb bei jedem Aufruf frisch gebaut (`force-dynamic`, revalidate entfernen).
      - Den Stichtag liest die Seite über ladePlattformEinstellung ohne catch; dazu eine Fehlerseite (konditionen/error.tsx) statt der stillen Vorgabe.
      - Prüfe, ob AktionAbschnitt (gruendungFuerSeiten) je Aufruf ungecacht die Datenbank fragt. Wenn ja, nenne es im Bericht mit der Zahl der Abfragen je Aufruf und lass es so; kein neuer Cache in diesem Auftrag.
      - Vor dem Stichtag bleibt KONDITIONEN_UEBERGANG (K1) wörtlich stehen. Der Satz mit dem Stichtag kommt dahinter: „Ab <Tag> ist die Plattformgebühr im Preis enthalten (Stichtag).“
      - Ab dem Stichtag steht „Seit <Tag> ist die Plattformgebühr im Preis enthalten (Stichtag).“ Dazu, solange der Tarifstart in der Zukunft liegt, TARIFE_AB_SATZ. Beides steht in der bestehenden Zeile über den Tarifen, kein neues Element. Widerspricht das dem Board w3-rechtstexte oder K1: STOPP und fragen.
      - Ab dem Stichtag entfällt KONDITIONEN_ENTWURF; das Feld `entwurf` bleibt im Typ, gibt aber null.
5. Zustimmung der Höfe:
   - Die Action prüft gegen AGB_NEUESTE.
   - Die Karte „AGB bestätigen“ (agb-zustimmung.ts, agb-karte.tsx) bekommt den Stichtag. Vor T lautet sie: „Ab <Tag> gilt Fassung 1.0. Bitte lies sie und stimm ihr zu – bis dahin gilt für dich Fassung 0.9. Mit deiner Zustimmung gilt Fassung 1.0 für dich ab <Tag>, ohne weitere Ankündigungsfrist (Punkt 32.4).“ Dazu die Links „Fassung 1.0 lesen“ (/agb/1.0) und „Fassung 0.9“ (/agb/0.9).
   - Ab T: die heutigen Sätze mit „1.0“. Der Knopf bleibt unverändert „Ich stimme den AGB zu“.
   - Heute und Einrichten lesen den Stichtag für die Karte über ladePlattformEinstellung() in try/catch (Sentry, fester Bereich). Scheitert das, lautet der Satz „Ab dem Stichtag auf /konditionen gilt Fassung 1.0 …“, ohne Datum. Für Rechtstexte und die Karte wird ladeHofpreisEinstellung nie benutzt. Was Einrichten sonst damit macht (gebuehrModellFuer), bleibt.
6. Kasse: KaufknopfSaetze bekommt `hofpreis` und `agbPfad`.
   - In der Kasse und im Zahlungsschritt direkt nach „Weiter zur Zahlung“ (checkout-form.tsx bei :593/:598 und :1029) kommen sie aus farm.preisAnzeige !== null.
   - Im Zahlungsschritt einer bestehenden Bestellung (Fortsetzung, „Erneut bezahlen“, :1136) kommen sie aus dem Snapshot der Bestellung (`anzeige !== null`), nie aus der heutigen Lage des Hofs. Der Link führt dort auf /agb/<Fassung des Snapshots>.
   - Im Hofpreis-Modell gilt der neue KASSE_AGB_SATZ_HOFPREIS: „Es gelten die AGB von <MARKE>. Dein Vertragspartner ist der Hof.“ (mit Link wie heute). Im Modell bisher bleibt KASSE_AGB_SATZ unverändert.
   - Den Rücktrittssatz nicht anfassen. /api/checkout und die Geldberechnung nicht anfassen.
7. Doku und Register:
   a) docs/recht/agb-0.9.md: die heutige docs/recht/agb.md unverändert als neue Datei.
   b) docs/recht/agb.md: der Text unten zwischen den Markern. Danach „---“ und „## Hinweise für die anwaltliche Prüfung“ mit dem einen Satz „Die Prüfhinweise zu Fassung 1.0 führt die Projektleitung außerhalb des Repos (öffentliches Repo).“
   c) docs/entscheidungen.md:
      - N45 neu: „### N45 · AGB 1.0 mit dem Stichtag (Projektleitung im Chat, 05.11.2026, E-019 = F021 Fragen 1–8 wie empfohlen (F024))“. Inhalt:
        - Variante A (Chat 31.10.2026): Fassung 1.0 wird vor der anwaltlichen Prüfung veröffentlicht; die Prüfung folgt als 1.1.
        - AGB 1.0 gilt ab dem Stichtag „Hofpreis-Modell ab“ und schaltet mit ihm um; vorher gilt 0.9. Die Seite /agb wird bei jedem Aufruf frisch gebaut und zeigt die geltende Fassung; /agb/0.9 und /agb/1.0 zeigen je eine.
        - Für jede Bestellung gilt die Fassung ihres Gebührenmodells (Order.gebuehrModell: bisher = 0.9, hofpreis = 1.0). Danach richten sich Mail-Anhang und Links; in der Kasse einer bestehenden Bestellung gilt ihr Snapshot.
        - Höfe stimmen ab dem Merge der neuesten Fassung zu. Eine Zustimmung nach der Ankündigung verzichtet auf den Rest der Frist (AGB 32.4).
        - Vor dem Stichtag schaltet die Projektleitung keinen echten Hof ohne Zustimmung zur neuesten Fassung frei und bittet keinen um Zustimmung vor der Ankündigung per E-Mail.
        - Kasse im Hofpreis-Modell ohne Zustimmung zur sofortigen Vermittlung. Ab dem Stichtag ohne „Entwurf“-Marke auf /konditionen.
        - Keine Rechtsberatung.
        - Verhältnis: ändert O4 (Fassung 1.0 wird vor der anwaltlichen Prüfung veröffentlicht, Variante A vom 31.10.2026; die Prüfung folgt als 1.1; Stand-Vermerk und Kassensatz neu). Ändert N38 beim Punkt „Rechtstexte“ (die Hof-AGB stehen vor der Rückmeldung der Anwältin; ihre Prüfung folgt). Ergänzt B1, N2 (Kassensatz) und K1 (Zeile mit dem Stichtag auf /konditionen). N43 bleibt. Umsetzung: A005.
      - Bei O4 und N38 je einen Vermerk „geändert durch N45 (Projektleitung im Chat, 05.11.2026, E-019 = F021 Fragen 1–8 wie empfohlen (F024))“ an die zitierten Stellen setzen; den alten Wortlaut nicht löschen (Pflegeregel im Kopf des Registers).
      - Bei B1 die Ergänzung „AGB 0.9 gilt für alle Bestellungen im Modell bisher, auch nach dem Stichtag (N45).“ Bei N2 und K1 je einen Verweis auf N45. In den Präfixen nichts ändern.
   d) DEVELOPMENT.md: Fachregel „Fassung je Bestellung über den Snapshot“, Verlauf.
   e) docs/ai/ARCHITECTURE.md: Muster „Rechtstext mit Fassungen: eine eingefrorene Datei je Fassung, Auswahl nur in agb-fassung.ts; Seiten, die von der Uhr abhängen, werden frisch gebaut; kein stilles Zurückfallen bei Rechtstexten“.
   f) BAUSTEINE.md mit `pnpm bausteine` neu erzeugen.
8. Tests (Uhr und Einstellung gemockt, nach TESTING_GUIDELINES; jede Prüfung mit Gegenprobe):
   - agb-text:
     - Jede Fassung ist Zeile für Zeile ihre Markdown-Datei (0.9 ↔ docs/recht/agb-0.9.md, 1.0 ↔ docs/recht/agb.md).
     - 0.9 hat 29 Punkte, 1.0 hat 35; Kurz erklärt hat je 6 Punkte.
     - Platzhalter in 1.0: Betreiber 1×, E-Mail 5×, Inkrafttreten 2× im Text plus Stand-Zeile.
     - In den Daten von 1.0 stehen weder „anwaltliche“ noch „Servicegebühr“. Der Vermerk-Regex kennt beide Formen.
   - agb-seite:
     - /agb hat `dynamic = 'force-dynamic'` und kein `revalidate`.
     - Vor T: 0.9 mit Hinweis und Link auf 1.0. Ab T: 1.0 mit Link auf 0.9.
     - Stichtag verschoben → Datum und Fassung folgen.
     - Ladefehler → error.tsx statt einer Fassung.
     - /agb/[fassung] für beide; kein Sprung ins Leere; Anhang 1/2 enthalten Sätze aus BELEHRUNG.
   - agb-datei: Dateiname und HTML je Fassung; Vermerk 1.0 mit Datum; Größe je Fassung. Bei Ladefehler steht der Ersatzwert in der Datei, und kein „dem dem“ kommt vor.
   - belehrung-mail:
     - gebuehrModell null → agb-…-0.9.html und Link /agb/0.9; 'hofpreis' → agb-…-1.0.html und Link /agb/1.0. Beides unabhängig von der Uhr.
     - Gegenprobe: eine Bestellung „bisher“, gebaut nach T, bekommt 0.9.
     - Ladefehler beim Stichtag → Mail mit Ersatzwert, kein Wurf.
   - agb-zustimmung (+ int-Test):
     - AGB_NEUESTE; '0.9' braucht Zustimmung; die Action lehnt '0.9' ab.
     - Der Kartensatz vor T nennt den Tag, beide Fassungen und den Verzicht.
     - Ladefehler → Satz ohne Datum (Gegenprobe: nie „1. Februar 2027“ aus der Vorgabe).
   - kaufknopf-saetze:
     - Hofpreis ohne Vermittlungssatz, bisher mit.
     - Fortsetzung einer Bestellung „bisher“ nach T zeigt den Satz MIT Vermittlung und den Link /agb/0.9; eine Bestellung „hofpreis“ zeigt ihn ohne.
   - konditionen: `force-dynamic`. Vor T steht K1 wörtlich, danach der Satz mit dem Stichtag. Ab T stehen Stichtag und Tarifstart und keine „Entwurf“-Marke. Ladefehler → Fehlerseite.
   - Wachen: agb-0-9.ts in dieselben sechs Ausnahmelisten wie agb.ts, mit Grund „AGB 0.9, eingefroren“. Den Grund für agb.ts auf „AGB 1.0“ ändern. isr-liest-keine-anfrage-wache bleibt grün.

Nicht:
- Keine Migration und keine Änderung an prisma/schema.prisma. Sollte sich wider Erwarten eine als nötig zeigen: nur Expand, mit prisma migrate diff erzeugen, zeigen und auf Freigabe warten (CLAUDE.md).
- Kein neues Paket, keine neue Umgebungsvariable.
- Kein Wort im Text unten ändern (Fehler im Text: melden, nicht verbessern). Keine Prüfhinweise der Anwältin ins Repo.
- Kein Wort in widerruf.ts (Belehrung, N39-Knöpfe).
- Nichts an /api/checkout, am Webhook, an Stripe oder an der Geldberechnung.
- Kein Datenbankwert: Stichtag, „Monate“, Notbremse und Testhöfe setzt nur die Projektleitung. Nichts gegen die Entwicklungs- oder Produktionsdatenbank schreiben.
- Kein Umbau des Layouts von Lauf 31. Keine Sperre der Freischaltung im Code.

Bilder (390 und 1440 px, hell und dunkel):
- /agb vor T (Vorschau auf der Entwicklungsdatenbank, Stichtag dort leer = 1.2.2027);
- /agb ab T (lokal gegen eine Wegwerf-DB auf localhost mit Stichtag in der Vergangenheit, nie gegen Dev oder Produktion);
- die Fehlerseite von /agb;
- /agb/0.9 und /agb/1.0 mit Anhang 1–3;
- die Karte „AGB bestätigen“ in Heute und Einrichten vor T;
- Kasse unter dem Knopf in beiden Modellen und bei „Erneut bezahlen“ einer Bestellung „bisher“;
- /konditionen in beiden Modellen;
- die Mail-Datei 1.0 im Browser geöffnet.

Fertig, wenn:
- pnpm typecheck, lint und test grün sind und alle Gegenproben anschlagen;
- /agb bei jedem Aufruf frisch gebaut wird und vor T 0.9 mit Hinweis auf 1.0 zeigt, ab T 1.0 mit Link auf 0.9, beides ohne Deploy (Test mit gemockter Uhr und verschobenem Stichtag); bei einem Ladefehler steht die Fehlerseite da;
- eine Bestellung im Modell bisher immer 0.9 anhängt und verlinkt und eine im Modell hofpreis 1.0, egal wann die Mail gebaut wird;
- die Kasse den Satz im Hofpreis-Modell ohne „Vermittlung“ zeigt und bei „Erneut bezahlen“ dem Snapshot der Bestellung folgt;
- ein Hof mit agbFassung '0.9' oder null die Karte mit dem Tag T und dem Verzicht sieht und nach dem Knopf '1.0' gespeichert ist;
- /konditionen frisch gebaut wird, vor T K1 wörtlich mit dem Satz zum Stichtag zeigt, ab T Stichtag und Tarifstart ohne „Entwurf“-Marke;
- docs/recht/agb.md Wort für Wort dem Text unten entspricht und docs/recht/agb-0.9.md der alten Datei;
- Register (N45; Vermerke bei O4, N38; Ergänzungen B1, N2, K1), DEVELOPMENT.md und ARCHITECTURE.md nachgezogen sind;
- der Bericht nach CLAUDE.md §4 vorliegt. Er nennt: Datenbankabfragen je Aufruf von /agb und /konditionen, ob /agb/0.9 auf Vercel ankommt, und eine Liste „Für die Projektleitung am Tag T“.

Für die Projektleitung (in den Bericht übernehmen):
- Generalprobe auf test.agrilo.at: Den Stichtag dort auf morgen setzen; der Admin erlaubt nur Tage in der Zukunft. Am Tag danach prüfen: /agb zeigt 1.0, eine Testbestellung hängt agb-<marke>-1.0.html an und verlinkt /agb/1.0, „Erneut bezahlen“ einer älteren Bestellung zeigt den alten Satz.
- Vor T in der Produktion:
  - Stichtag im Admin setzen; er ist frei verschiebbar, bis er erreicht ist.
  - „Monate ohne Grundgebühr“ = 12 speichern und festschreiben.
  - Keinen echten Hof ohne Zustimmung zu 1.0 freischalten. Keinen um Zustimmung bitten, bevor er die Ankündigung per E-Mail mit 1.0 im Anhang hat.
- Am Abend vor T: Admin › Notbremse von Hand setzen, spätestens um 23:29 Uhr (Wien), „bis“ 00:10 Uhr, Grund „Wartung“, Satz „Bestellen ist gerade kurz nicht möglich. Bitte versuch es nach Mitternacht wieder.“ Die Notbremse beginnt immer beim Speichern; einen späteren Start gibt es nicht. Wirkung: Bis Mitternacht verfällt jede vorher angelegte Online-Bestellung, die noch nicht bezahlt ist (30-Minuten-Frist). Über Mitternacht entsteht keine neue Bestellung. Bar angelegte Bestellungen bleiben im Modell bisher und bekommen 0.9, das ist richtig.
- Nach 00:10 Uhr: /agb zweimal laden; es zeigt „Fassung 1.0 – gilt ab <T>“. Dazu /agb/0.9, /agb/1.0 und /konditionen (Stichtag, keine „Entwurf“-Marke).
- In der Produktion keine Testbestellung, die als „abgeholt“ markiert wird (sonst zieht die Monatsabrechnung 6 % per echter Lastschrift ein). Wird doch eine gemacht: stornieren oder „nicht abgeholt“.
- Nichts deployen.

=== AGB 1.0 ANFANG ===
# Allgemeine Geschäftsbedingungen (AGB) von Agrilo

**Fassung 1.0 – gilt ab [Tag des Inkrafttretens]**

---

## Kurz erklärt (kein Teil der AGB)

- Agrilo ist ein Marktplatz: Du kaufst **direkt beim Hof**. Agrilo verkauft nichts, liefert nichts und nimmt kein Geld für Waren entgegen.
- Du bestellst online, zahlst online oder bar und holst **am Hof** ab.
- Der Preis, den du siehst, ist der Preis, den du zahlst – online und bar gleich. Darin steckt die **Plattformgebühr**, mit der der Hof die Nutzung von Agrilo bezahlt. An Agrilo zahlst du nichts.
- Ob du eine Ware **zurückgeben** kannst, hängt von der Ware ab: Schnell verderbliche Lebensmittel sind vom Gesetz ausgenommen, haltbare Waren nicht. Bis zum Beginn deines Abholtermins kannst du jede Bestellung stornieren; bei Online-Zahlung bekommst du dann alles zurück.
- Höfe sind **Unternehmen**. Für Ware, Angaben, Hygiene und Beleg ist der Hof verantwortlich; Agrilo für die Plattform.
- Höfe zahlen eine Plattformgebühr von **6 %**, die im Preis enthalten ist, und nutzen Agrilo im Tarif **Hoftor (0 €)** oder **Hofladen (19 € im Monat, monatlich kündbar)**.

---

## Teil A – Für alle

### 1. Wer wir sind, wofür diese AGB gelten

1.1 Agrilo wird betrieben von **[Betreiber laut Impressum, Rechtsform, Anschrift, E-Mail]** („Agrilo“, „wir“). Alle Angaben nach § 5 ECG stehen im [Impressum](/impressum).

1.2 Diese AGB gelten für jede Nutzung von agrilo.at und der dazugehörigen Dienste durch **Kundinnen und Kunden** (Teil B) und durch **Höfe** (Teil C). Teil A und Teil D gelten für alle. Die Anhänge sind Teil der AGB.

1.3 Die [Konditionen für Höfe](/konditionen) (Plattformgebühr, Tarife, Abrechnung, Stichtage) sind Teil dieser AGB. Was wir mit einem Hof einzeln vereinbart haben und was in seinen Einstellungen unter „Deine Konditionen“ steht, geht diesen AGB vor. Im Übrigen gilt: zwingendes Gesetz vor diesen AGB, diese AGB vor den allgemeinen Konditionen, die Konditionen vor Hinweisen in der App.

1.4 Die Punkte 8 bis 16 sind zugleich die **Kaufbedingungen** für jeden Kaufvertrag, der über Agrilo zwischen einem Hof und einer Kundin oder einem Kunden zustande kommt. Jeder Hof bezieht sie mit der Nutzung von Agrilo in seine Verträge ein (Punkt 18.8). **Eigene Geschäftsbedingungen eines Hofs gelten für Käufe über Agrilo nicht.** Hinweise des Hofs zur Ware (etwa Pfand, Gebinde, Mindesthaltbarkeit, Abholung) stehen beim Angebot (Punkt 10.3). Für die Nutzung der Plattform selbst gelten ausschließlich diese AGB.

1.5 Wir sprechen alle mit „du“ an. Das ist unser Stil, kein Zeichen von Unverbindlichkeit.

1.6 **Begriffe.** „Werktag“ ist Montag bis Freitag ohne gesetzliche Feiertage in Österreich. „Textform“ ist eine lesbare Erklärung ohne Unterschrift, etwa per E-Mail oder im Postfach der App. „Abholzeiten“ sind die Zeitfenster, die ein Hof anbietet; der „Abholtermin“ ist das Zeitfenster, das du für deine Bestellung gewählt hast.

### 2. Was Agrilo ist – und was nicht

2.1 Agrilo ist eine **Vermittlungsplattform** (Online-Marktplatz). Wir stellen Höfen Software bereit: Hofseite, Produktliste, Bestellung, Kasse, die Anbindung an unseren Zahlungsdienstleister und ein Postfach. Kundinnen und Kunden finden darüber Höfe in ihrer Nähe, bestellen und holen am Hof ab.

2.2 **Der Kaufvertrag kommt ausschließlich zwischen dem Hof und der Kundin bzw. dem Kunden zustande.** Agrilo ist nicht Vertragspartei des Kaufvertrags, weder Verkäuferin noch Käuferin, und weder Kommissionärin noch Handelsvertreterin des Hofs. Bestellungen nehmen wir für den Hof entgegen; Bestätigungen, Stornos und Erstattungen erklären wir als Bevollmächtigte **im Namen und auf Rechnung des Hofs** (Punkt 18.8). Das sagen wir dir in der Kasse vor dem Bestellen noch einmal ausdrücklich (§ 4a Abs. 2 FAGG).

2.3 Agrilo ist **kein Zahlungsdienstleister**. Online-Zahlungen wickelt der Zahlungsdienstleister Stripe ab; Empfänger der Zahlung ist der Hof (Punkt 11). Bargeld nimmt nur der Hof entgegen, nie Agrilo.

2.4 Agrilo ist **kein Lebensmittelunternehmen** und weder Herstellerin noch Händlerin der angebotenen Waren. Wir lagern nichts, verpacken nichts und liefern nichts.

2.5 Alle Höfe auf Agrilo handeln nach ihrer eigenen Erklärung gegenüber uns als **Unternehmer** (land- und forstwirtschaftliche Betriebe oder Gewerbebetriebe). Deshalb gelten für Käufe das Konsumentenschutzgesetz und das Fern- und Auswärtsgeschäfte-Gesetz (§ 4a Abs. 1 Z 2 FAGG). Wir dürfen diese Erklärung prüfen und Nachweise verlangen; eine amtliche Prüfung nehmen wir nicht vor.

2.6 **So sind die Pflichten verteilt** (§ 4a Abs. 1 Z 4 FAGG):

| Der Hof | Agrilo |
|---|---|
| Angebot, Preis, Beschreibung, Pflichtangaben zu Lebensmitteln, Futtermitteln und Brennmaterial | Betrieb der Plattform (Hofseiten, Bestellung, Kasse, Postfach) |
| Ware, Menge, Qualität, Hygiene, Kühlkette, Jugendschutz bei der Übergabe | Anbindung an den Zahlungsdienstleister Stripe |
| Abholzeiten, Übergabe, Bestätigung bei Barzahlung | Weiterleitung von Rücktritten, Stornos und Reklamationen an den Hof |
| Gewährleistung, Rücktritt, Reklamation, Rückzahlung | Hilfe bei Fragen zur Nutzung der Plattform |
| Rechnung oder Beleg, Steuern, Registrierkasse | Abrechnung der Plattformgebühr mit dem Hof |

2.7 Wir haben keinen Einfluss auf Verfügbarkeit, Beschaffenheit, Herkunft und Rechtmäßigkeit der Angebote und prüfen sie nicht vorab. Angaben zu Produkten, Siegeln, Herkunft, Betriebsnummern und Zertifikaten sind Angaben des Hofs. Wir übernehmen dafür keine Gewähr und keine Zusicherung. Wir entfernen Angebote, wenn wir von Rechtsverstößen erfahren (Punkt 5).

### 3. Reihenfolge der Höfe und Angebote

3.1 Auf der Hofübersicht reihen wir Höfe nach **Entfernung** zum gewählten Ort oder Standort. Ohne Ort stehen Höfe, die länger freigeschaltet sind, weiter vorne. Innerhalb eines Hofs stehen Produkte in der Reihenfolge, die der Hof festlegt.

3.2 Filter (etwa Kategorie oder Suchtext) schränken die Liste ein, verändern aber die Reihenfolge nicht. **Es gibt keine bezahlte Platzierung.** Gründungshöfe tragen ein Abzeichen, werden aber nicht anders gereiht. Abzeichen und Siegel sind Angaben des Hofs oder Hinweise auf seinen Tarif, keine Prüfung oder Empfehlung durch Agrilo. Ändert sich die Reihung, sagen wir es an der Stelle, an der die Liste steht, und Höfen vorab nach Punkt 32 (§ 4a Abs. 1 Z 1 FAGG, Art. 5 Verordnung (EU) 2019/1150).

### 4. Zugang, Konto, Sicherheit

4.1 **Kundinnen und Kunden** brauchen kein Konto. Deine Bestellungen findest du über einen Code, den wir an deine E-Mail-Adresse schicken, und über Links in unseren E-Mails. Gib diese Links und Codes nicht weiter. Wer sie hat, sieht deine Bestellung.

4.2 **Höfe** registrieren ein Konto mit Passwort oder Passkey. Nur volljährige, geschäftsfähige Personen dürfen ein Hofkonto anlegen, und nur für einen Betrieb, den sie vertreten dürfen. Du hältst deine Zugangsdaten geheim und meldest uns sofort, wenn jemand Fremdes Zugriff hat oder haben könnte.

4.3 Alle Angaben müssen richtig und aktuell sein. Du darfst die Plattform nicht missbrauchen: keine automatisierten Abfragen, kein Umgehen von Sicherheitsmaßnahmen, keine Belastung der Systeme über den normalen Gebrauch hinaus, keine Nutzung fremder Zugangsdaten.

4.4 Wir dürfen die Nutzung technisch begrenzen (etwa die Zahl der Bestellungen, Reservierungen oder Nachrichten je Zeitraum), um Missbrauch und Überlastung zu verhindern, und dürfen den Zugang bei begründetem Verdacht auf Missbrauch einschränken (Punkt 5.3).

### 5. Inhalte, Verhalten, Melden, Maßnahmen

5.1 Was Höfe einstellen (Texte, Fotos, Beiträge, Nachrichten) und was Kundinnen und Kunden schreiben (Notizen, Nachrichten, Meldungen), muss **wahr, rechtmäßig und respektvoll** sein. Verboten sind insbesondere irreführende Angaben, Verstöße gegen Lebensmittel-, Futtermittel-, Preisauszeichnungs- oder Wettbewerbsrecht, Inhalte, die Rechte Dritter verletzen (Urheberrecht, Marken, Persönlichkeitsrechte), Beleidigungen, Drohungen, Diskriminierung, Werbung für Dritte und Angebote, die nichts mit dem Zweck der Plattform zu tun haben.

5.2 **Melden.** Jede Person kann uns rechtswidrige oder verdächtige Inhalte melden – über „Problem melden“ in der App oder per E-Mail an **[E-Mail laut Impressum]**. Wir bestätigen den Eingang, prüfen die Meldung sorgfältig und sagen dir, was wir entschieden haben (Art. 16 Verordnung (EU) 2022/2065). Eine KI-gestützte Software hilft uns beim Sortieren der Meldungen; jede Entscheidung über eine Maßnahme trifft ein Mensch.

5.3 **Maßnahmen.** Verstößt ein Inhalt oder ein Verhalten gegen Gesetz oder diese AGB, können wir, je nach Schwere: einen Inhalt entfernen oder ausblenden, ein Angebot aus dem Shop nehmen, einen Hof für neue Bestellungen vorübergehend sperren, eine Bestellung im Namen des Hofs stornieren (Punkt 23), ein Hofkonto vorübergehend sperren oder im Wiederholungsfall kündigen, und Kundinnen oder Kunden von weiteren Bestellungen ausschließen. Wir begründen jede Maßnahme gegenüber der betroffenen Person spätestens mit der Maßnahme und nennen, worauf sie sich stützt; bei Gefahr im Verzug, etwa bei einem Verdacht auf gesundheitsgefährdende Ware oder Betrug, zunächst kurz und danach ausführlich (Art. 17 Verordnung (EU) 2022/2065; Art. 4 Verordnung (EU) 2019/1150). Gegen eine Maßnahme kannst du dich bei uns beschweren (Punkt 25.4 für Höfe, Punkt 33.1 für alle); der Weg zu den Gerichten steht dir offen.

5.4 Bei einer technischen Störung, etwa beim Zahlungsdienstleister, dürfen wir neue Bestellungen auf der ganzen Plattform vorübergehend anhalten. Laufende Bestellungen bleiben bestehen.

5.5 Nachrichten zwischen Nutzerinnen und Nutzern lesen wir nur, wenn sie an uns gerichtet oder uns gemeldet werden, wenn es zur Behebung einer Störung oder zur Abwehr von Missbrauch nötig ist oder wenn ein Gesetz oder eine Behörde es verlangt.

5.6 **Kontaktstelle** (Art. 11 und 12 Verordnung (EU) 2022/2065) für Behörden, die Europäische Kommission und alle Nutzerinnen und Nutzer: **[E-Mail laut Impressum]**. Wir kommunizieren auf Deutsch und Englisch.

### 6. Rechte an Inhalten, Marke

6.1 Deine Inhalte bleiben deine. **Höfe** räumen Agrilo das einfache, unentgeltliche, räumlich unbeschränkte Recht ein, ihre Inhalte für den Betrieb und die Bewerbung der Plattform zu nutzen: anzuzeigen, zu speichern, technisch zu bearbeiten (verkleinern, zuschneiden, Formate umwandeln), als Vorschaubild, Teilen-Bild und QR-Plakat aufzubereiten, in der Suche, auf der Startseite und in unseren Kanälen (Website, soziale Medien, Presse) zu zeigen. Höfe können der Nutzung in unseren Kanälen jederzeit in Textform widersprechen (Punkt 24.3); dann stellen wir sie für neue Veröffentlichungen ein. Das Recht endet, wenn du den Inhalt löschst, mit Ausnahme von Kopien in Sicherungen, in bereits verschickten E-Mails und in bereits erstellten Belegen (Art. 3 Abs. 1 lit. d und e Verordnung (EU) 2019/1150). **Inhalte von Kundinnen und Kunden** (Notizen, Nachrichten, Meldungen) nutzen wir nur zur Abwicklung der Bestellung und zur Bearbeitung von Meldungen.

6.2 Du versicherst, dass du die nötigen Rechte an deinen Inhalten hast, insbesondere an Fotos, auf denen Personen zu sehen sind, und an Siegeln und Marken, die du nennst.

6.3 „Agrilo“ und das Agrilo-Zeichen sind unsere Kennzeichen. Höfe dürfen sie nur so nutzen, wie wir es bereitstellen (QR-Plakat, Teilen-Bild, Hinweis „Bestell online bei Agrilo“). Jede andere Nutzung braucht unsere Zustimmung in Textform.

### 7. Verfügbarkeit und Weiterentwicklung

7.1 Wir entwickeln Agrilo laufend weiter, bauen Funktionen aus und nehmen Wartungen vor. Eine bestimmte Verfügbarkeit sichern wir nicht zu; wir bemühen uns, Ausfälle kurz zu halten und geplante Wartungen anzukündigen. Funktionen, die als Test oder Vorschau gekennzeichnet sind, können sich ändern oder wegfallen.

7.2 Wir dürfen Funktionen ändern, ergänzen oder einstellen. Änderungen, die Höfe wesentlich einschränken, kündigen wir mindestens 15 Tage vorher an; müssen Höfe dafür etwas Technisches anpassen, mindestens 30 Tage (Punkt 32.3).

7.3 Höfe sichern ihre eigenen Daten (Produktlisten, Texte, Fotos, Auswertungen) selbst; einen Export deiner Daten bekommst du auf Anfrage (Punkt 25.2).

---

## Teil B – Für Kundinnen und Kunden

### 8. Wer bestellen darf

8.1 Bestellen dürfen volljährige Personen. Bestellst du für dich oder deinen Haushalt, bist du **Verbraucherin oder Verbraucher**, und es gelten alle Verbraucherrechte dieser AGB. Bestellst du für ein Unternehmen oder einen Betrieb, wählst du in der Kasse „Betrieb“; dann gilt Punkt 28.

8.2 Alkoholische Getränke gibt der Hof nur nach dem Jugendschutzgesetz deines Bundeslands ab und prüft dafür bei der Übergabe dein Alter. Kannst du dich nicht ausweisen, darf der Hof die Übergabe dieser Waren verweigern; den Preis dafür bekommst du zurück.

### 9. Bestellen und Vertragsschluss

9.1 Die Angebote auf einer Hofseite sind eine Einladung des Hofs, zu bestellen. Du legst Produkte in den Korb, wählst einen **Abholtermin** aus den Abholzeiten des Hofs, gibst Name, E-Mail-Adresse und – wenn der Hof es braucht – Telefonnummer an und wählst die Zahlart.

9.2 Produkte im Korb werden für kurze Zeit für dich reserviert (derzeit 15 Minuten). Ist die Reservierung abgelaufen, kann ein anderer die Ware kaufen; die Kasse sagt dir das. Je Bestellung gilt der Mindestbestellwert, der in der Kasse steht (derzeit 10 € Warenwert), und je Produkt eine Höchstmenge.

9.3 Vor dem Absenden siehst du alles auf einer Seite: Produkte, Preise, Plattformgebühr, Gesamtbetrag, Abholtermin sowie den Hof als deinen Vertragspartner mit Name, Anschrift, Telefonnummer und E-Mail-Adresse. Eingaben kannst du bis dahin ändern.

9.4 **Verbindlich bestellen.** Bei **Barzahlung** gibst du mit dem Knopf **„Zahlungspflichtig bestellen“** eine verbindliche Bestellung an den Hof ab. Bei **Online-Zahlung** prüfen wir mit „Weiter zur Zahlung“ zunächst nur deine Angaben und halten die Ware für dich; verbindlich bestellst du erst mit dem Knopf **„Jetzt bezahlen“** (bzw. „Erneut bezahlen“), mit dem du die Zahlung auslöst (§ 8 Abs. 2 FAGG).

9.5 Der **Kaufvertrag mit dem Hof** kommt zustande:
- bei Online-Zahlung, sobald der Zahlungsdienstleister die Zahlung bestätigt hat und wir dir die Bestellung im Namen des Hofs per E-Mail bestätigt haben;
- bei Barzahlung, sobald du die Bestellung über den Link in unserer E-Mail bestätigt hast und wir dir die Bestellung danach im Namen des Hofs bestätigen.

9.6 **Fristen.** Schließt du die Online-Zahlung nicht innerhalb von 30 Minuten ab oder bestätigst du eine Barbestellung nicht innerhalb von 2 Stunden über den Link, spätestens aber bis zum Beginn des Abholtermins, erlischt deine Bestellung, und die Ware wird wieder frei. Darauf weist die Kasse hin.

9.7 Den Vertragstext schicken wir dir per E-Mail: deine Bestellung, die Rücktrittsbelehrung mit den Angaben des Hofs, das Muster-Widerrufsformular und diese AGB in der geltenden Fassung als Datei im Anhang. Auf [/agb](/agb) kannst du sie außerdem jederzeit abrufen, speichern und ausdrucken (§ 9 und § 11 ECG). Deine Bestellung kannst du außerdem über den Link in der E-Mail ansehen, solange wir sie speichern (Punkt 29.4). Vertragssprache ist Deutsch.

9.8 Die bestellte Ware wird für dich bis zum Ende des Abholtermins reserviert.

### 10. Preise und Plattformgebühr

10.1 Die Preise legt der Hof fest. Sie verstehen sich in Euro inklusive Umsatzsteuer und **inklusive Plattformgebühr**. Bei Produkten nach Gewicht oder Menge zeigen Hofseite und Kasse den Grundpreis und die bestellte Menge. Der Preis gilt für die bestellte Einheit. Für eine Bestellung gilt der Preis, der beim Absenden in der Kasse stand; spätere Preisänderungen des Hofs betreffen nur neue Bestellungen.

10.2 Die **Plattformgebühr** ist Teil des Preises, den der Hof dir verrechnet. Mit ihr bezahlt der Hof in der Regel die Nutzung von Agrilo; bei manchen Höfen ist sie für Barzahlungen vorübergehend erlassen und bleibt dann beim Hof (Punkt 19.8). Du zahlst sie in jedem Fall an den Hof, nicht an Agrilo, und sie ist **online und bar gleich hoch**. Die Kasse weist sie zur Information getrennt aus („Ware · Plattformgebühr · Gesamt“). Für die Nutzung der Plattform verlangt Agrilo von dir kein Entgelt.

10.3 Weitere Kosten – etwa für eine Lieferung oder ein Pfand – gibt es nur, wenn der Hof sie beim Angebot ausdrücklich nennt und die Kasse sie vor dem Bestellen zeigt.

### 11. Bezahlen

11.1 **Online**: Karte, Apple Pay, Google Pay oder EPS über unseren Zahlungsdienstleister **Stripe Payments Europe, Ltd.** Du zahlst an den Hof; Stripe leitet die Zahlung an das Konto des Hofs weiter und behält die Plattformgebühr für Agrilo ein. Mit der Bestätigung deiner Zahlung durch Stripe hast du gegenüber dem Hof bezahlt. Deine Zahlungsdaten verarbeitet Stripe; wir sehen sie nicht. Bricht die Zahlung ab, erlischt die Bestellung nach Punkt 9.6; du kannst sie bis dahin über „Erneut versuchen“ abschließen. Geht eine Zahlung erst nach dem Erlöschen ein, erstatten wir sie automatisch; die Bestellung lebt dadurch nicht wieder auf.

11.2 **Bar bei Abholung**: Du zahlst den Gesamtbetrag aus deiner Bestellung beim Hof. Der Hof gibt dir einen Beleg. Ein Hof kann die Barzahlung ausschließen oder vorübergehend nicht anbieten; dann steht in der Kasse nur die Online-Zahlung.

11.3 Rückzahlungen erfolgen auf demselben Weg wie die Zahlung: online über Stripe auf dein Zahlungsmittel, bar durch den Hof.

### 12. Abholung

12.1 Du holst die Ware zum gewählten Abholtermin am Hof ab. Der **Abholcode** in deiner Bestellung hilft dem Hof, die Bestellung zu finden; er ist kein Ausweis und keine Berechtigung.

12.2 Mit der Übergabe am Hof geht die Gefahr für die Ware auf dich über. Prüfe die Ware bei der Übergabe und sag dem Hof sofort, wenn etwas nicht passt. Deine gesetzlichen Gewährleistungsrechte bleiben davon unberührt.

12.3 Fehlt bei der Abholung ein Artikel oder ist weniger da als bestellt, hast du die Wahl: Du nimmst den Rest, und der Hof passt die Bestellung an (bei Online-Zahlung bekommst du den Preis des fehlenden Teils zurück, bar zahlst du nur, was du bekommst), oder du lehnst die ganze Bestellung ab, wenn der Rest für dich keinen Sinn hat; dann bekommst du alles zurück bzw. zahlst nichts. Bei Ware nach Gewicht (etwa ein Stück Fleisch oder Käse) kann das tatsächliche Gewicht leicht abweichen: Ist die Ware leichter als bestellt, erstattet dir der Hof den Unterschied; ist sie schwerer, verlangt er nichts nach.

12.4 **Nicht abgeholt.** Holst du die Ware nicht bis zum Ende des Abholtermins ab, obwohl der Hof sie bereitgehalten hat, bist du mit der Annahme in Verzug (§ 1419 ABGB). Der Hof darf die Ware dann anderweitig verwenden. Den Warenpreis kann der Hof behalten bzw. verlangen; was er durch einen anderweitigen Verkauf der Ware erlöst oder sich erspart hat, muss er dir anrechnen. Dein Rücktrittsrecht nach Punkt 14 bleibt für Waren, die nicht vom Rücktritt ausgenommen sind, unberührt. Die Plattformgebühr fällt für nicht abgeholte Bestellungen nicht an; bei Online-Zahlung wird sie dir zurückgezahlt. Wer wiederholt bestellt und nicht abholt, kann von weiteren Bestellungen ausgeschlossen werden (Punkt 5.3).

### 13. Stornieren vor der Abholung

13.1 Bis zum Beginn des Abholtermins kannst du eine Bestellung **stornieren**, ohne Angabe von Gründen und ohne Kosten: als Verbraucherin oder Verbraucher über die Rücktrittsfunktion auf [agrilo.at/widerruf](/widerruf), deren Link in jeder E-Mail zu deiner Bestellung steht, sonst mit einer Nachricht an den Hof, der die Bestellung dann storniert.

13.2 Der Hof kann vor der Abholung stornieren, wenn er aus einem sachlich gerechtfertigten Grund, den er nicht zu vertreten hat, nicht erfüllen kann (etwa Ernteausfall, Unwetter, kranke Tiere, verdorbene Ware) oder wenn ein Preis oder eine Menge offensichtlich falsch eingetragen war und du das erkennen konntest. Er muss dich darüber informieren. Agrilo darf eine Bestellung im Namen des Hofs stornieren, wenn der Hof nicht erreichbar ist, wenn du zu Recht darauf bestehst oder wenn eine technische Störung die Abwicklung verhindert (Punkt 23.2).

13.3 Bei einem Storno vor der Abholung bekommst du bei Online-Zahlung **alles zurück** – Warenpreis und Plattformgebühr. Bei Barzahlung ist nichts zu erstatten.

### 14. Rücktritt vom Kaufvertrag (Widerruf im Fernabsatz)

14.1 Als Verbraucherin oder Verbraucher kannst du vom Kaufvertrag mit dem Hof **innerhalb von 14 Tagen** ohne Angabe von Gründen zurücktreten. Die Frist beginnt mit dem Tag, an dem du die Ware erhalten hast (§ 11 FAGG). Die Rücktrittsbelehrung steht in Anhang 1 und – mit den Angaben deines Hofs ausgefüllt – in deiner Bestellbestätigung.

14.2 **Kein Rücktrittsrecht** besteht nach § 18 Abs. 1 FAGG insbesondere bei
- Waren, die **schnell verderben können** oder deren Ablaufdatum schnell überschritten würde (Z 4) – zum Beispiel frisches Fleisch, frischer Fisch, Frischmilch, Joghurt, Topfen, Frischkäse, Brot und Gebäck, Beeren, Blattsalat und andere empfindliche Frischware;
- versiegelten Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn die Versiegelung nach der Übergabe entfernt wurde (Z 5);
- Waren, die nach deinen Angaben angefertigt oder zugeschnitten wurden, etwa Fleisch nach Wunschzerlegung (Z 3);
- Waren, die nach der Übergabe untrennbar mit anderen Gütern vermischt wurden, etwa Hackschnitzel oder Pellets, die ins Lager gekippt wurden (Z 6).

Ob eine Ausnahme greift, hängt von der konkreten Ware ab, nicht von ihrer Gruppe: Lagerfähiges Obst und Gemüse (etwa Äpfel, Kartoffeln, Kürbis), Eier innerhalb der Mindesthaltbarkeit, Hartkäse, Speck, Honig, Mehl, Nudeln, Brennholz und Futter in geschlossener Verpackung fallen in der Regel nicht unter diese Ausnahmen. Ob eine Ware nach Angabe des Hofs schnell verdirbt und deshalb vom Rücktritt ausgenommen ist, steht vor dem Bestellen beim Produkt und in der Kasse. Der Hof prüft das im Einzelfall nach dem Gesetz und begründet dir seine Entscheidung.

14.3 Den Rücktritt erklärst du gegenüber dem **Hof** (seine Angaben stehen in deiner Bestellung und in der Belehrung): über die Rücktrittsfunktion auf [agrilo.at/widerruf](/widerruf) (Knöpfe „Vertrag widerrufen“ und „Widerruf bestätigen“, § 13a FAGG), formlos per E-Mail oder Brief oder mit dem Muster-Formular in Anhang 2. Du kannst den Rücktritt auch an uns schicken; der Hof hat uns dafür bevollmächtigt (Punkt 18.8), wir leiten ihn an den Hof weiter und bestätigen dir den Eingang. Für die Frist reicht es, dass du die Erklärung rechtzeitig abschickst.

14.4 Nach einem wirksamen Rücktritt erstattet der Hof alle Zahlungen für diese Ware – einschließlich der darin enthaltenen Plattformgebühr – unverzüglich und spätestens binnen 14 Tagen ab Eingang deines Rücktritts; bei Online-Zahlung läuft das über Stripe auf dein Zahlungsmittel. Der Hof darf die Rückzahlung verweigern, bis er die Ware zurückerhalten hat oder du nachgewiesen hast, dass du sie zurückgeschickt hast. Die Ware bringst du unverzüglich, spätestens binnen 14 Tagen, zum Hof zurück oder schickst sie ihm; die unmittelbaren Kosten der Rückgabe trägst du. Für einen Wertverlust haftest du nur, wenn er auf einen zur Prüfung der Ware nicht nötigen Umgang zurückgeht.

14.5 Ein Rücktritt nach Punkt 14.1 **vor der Abholung** wirkt wie ein Storno nach Punkt 13. Für Waren ohne Rücktrittsrecht (Punkt 14.2) kannst du nur bis zum Beginn des Abholtermins stornieren (Punkt 13.1); danach bleibt die Bestellung verbindlich, und holst du nicht ab, gilt Punkt 12.4.

### 15. Gewährleistung, Reklamation, Produkthaftung

15.1 Für die Ware haftet der **Hof** nach den gesetzlichen Gewährleistungsregeln (§§ 922 ff. ABGB, Verbrauchergewährleistungsgesetz). Für Schäden durch ein fehlerhaftes Produkt haftet, wer es hergestellt oder in Verkehr gebracht hat (Produkthaftungsgesetz). Agrilo übernimmt keine Gewährleistung und keine Garantie für Waren und ist weder Herstellerin noch Importeurin noch Händlerin.

15.2 Wende dich mit einer Reklamation an den Hof (Adresse, Telefonnummer und E-Mail-Adresse stehen in deiner Bestellung). Kommst du nicht weiter, hilft dir Agrilo über „Problem melden“ oder per E-Mail: Wir vermitteln und erinnern den Hof an seine Pflichten. Einen Anspruch gegen Agrilo auf Gewährleistung, Erstattung oder Schadenersatz für die Ware hast du nicht; wir können im Einzelfall für den Hof erstatten (Punkt 21.3).

### 16. Nachrichten von Höfen und von Agrilo

16.1 Neuigkeiten eines Hofs (per E-Mail oder über einen Nachrichtendienst) bekommst du nur, wenn du dich dafür angemeldet hast. Du kannst dich jederzeit über den Link in jeder Nachricht oder beim Hof abmelden.

16.2 E-Mails zu deiner Bestellung (Bestätigung, Erinnerung, Änderung, Storno, Rücktritt) sind Teil der Abwicklung und brauchen keine Einwilligung.

16.3 Meldungen über „Problem melden“ bearbeiten wir in angemessener Zeit. Ein Anspruch auf eine bestimmte Antwortzeit oder auf eine bestimmte Lösung besteht nicht, soweit das Gesetz nichts anderes vorschreibt.

---

## Teil C – Für Höfe

### 17. Aufnahme und Hofkonto

17.1 Du registrierst deinen Betrieb mit richtigen Angaben (Betriebsname, Adresse, Telefonnummer, E-Mail-Adresse, Rechtsform oder Betriebsart, soweit vorgeschrieben Betriebsnummern) und erklärst, dass du als **Unternehmer** anbietest (Punkt 2.5). Nach der Prüfung schalten wir dein Hofkonto frei; einen Anspruch auf Freischaltung gibt es nicht. Freischalten können wir erst, wenn dein Hof mindestens eine aktive Abholzeit, mindestens ein Produkt im Shop und ein fertig eingerichtetes Stripe-Konto hat (Punkt 21).

17.2 Auf deiner Hofseite und in der Kasse stehen Betriebsname, Adresse, Telefonnummer und E-Mail-Adresse; die Kundschaft braucht sie für Rücktritte und Reklamationen. Du bist dafür verantwortlich, dass die Pflichtangaben für dein Unternehmen (etwa nach ECG, UGB, Gewerbeordnung, Preisauszeichnungsgesetz) dort oder in deinen Angeboten vollständig und richtig sind.

17.3 Ein Hofkonto darf nur vom Betriebsinhaber oder von Personen genutzt werden, die der Betrieb dazu berechtigt hat. Für alles, was über dein Konto geschieht, bist du verantwortlich, auch wenn es ein Mitarbeiter oder ein Familienmitglied war.

17.4 Übergibst du den Betrieb (etwa an die nächste Generation), kannst du das Hofkonto mit unserer Zustimmung in Textform auf den neuen Betriebsinhaber übertragen. Offene Beträge sind vorher zu begleichen; der neue Inhaber bestätigt diese AGB.

17.5 Wir schulden dir keine bestimmte Zahl an Besuchen, Bestellungen oder Umsätzen. Ein Hof, den wir als **Testhof** führen, dient nur der Erprobung der Plattform: Er erscheint in keiner Liste, Karte und Suche, seine Seite ist nur über einen direkten Link erreichbar, Hofseite, Produktseiten und Kasse sagen oben, dass es ein Testhof ist, und er bekommt keinen Gründungsplatz. Bestellungen bei einem Testhof sind Testbestellungen ohne Anspruch auf Ware.

### 18. Deine Angebote und deine Pflichten

18.1 Du bietest nur Waren an, die du **selbst erzeugst oder rechtmäßig vertreibst** und für die du alle Bewilligungen hast, und beschreibst sie richtig und vollständig: Bezeichnung, Preis, Menge oder Gewicht, Mindesthaltbarkeit, soweit vorgeschrieben, und bei Lebensmitteln alle Angaben, die vor dem Kauf vorgeschrieben sind (insbesondere Allergene, Zutaten, Herkunft, Art. 14 Verordnung (EU) 1169/2011). Du bist Lebensmittelunternehmer im Sinne des Lebensmittelrechts und allein für Hygiene, Kühlkette, Rückverfolgbarkeit und Kennzeichnung verantwortlich.

18.2 **Futtermittel:** Du bist für Registrierung und Kennzeichnung nach dem Futtermittelrecht verantwortlich (LFBIS-Nummer, Meldung an die zuständige Behörde). Die Nummern, die du einträgst, zeigt Agrilo so an, wie du sie angibst; wir prüfen sie nicht.

18.3 **Brennmaterial:** Angaben zu Holzart, Trocknung, Menge und Einheit müssen stimmen. **Alkohol:** Du gibst alkoholische Getränke nur nach dem Jugendschutzgesetz deines Bundeslands ab und prüfst das Alter bei der Übergabe.

18.4 Du pflegst **Abholzeiten**, die du einhalten kannst, und übergibst bestellte Ware zum Abholtermin in der bestellten Menge und Qualität. Kannst du eine Bestellung nicht erfüllen, stornierst du sie so früh wie möglich mit Angabe des Grunds (Punkt 13.2); bei Online-Zahlung erstattet Stripe der Kundschaft automatisch den vollen Betrag zu deinen Lasten.

18.5 Du hältst alle Vorschriften ein, die für deine Waren und deinen Verkauf gelten (Lebensmittel-, Futtermittel-, Gewerbe-, Preisauszeichnungs-, Jugendschutz- und Steuerrecht), stellst Rechnungen oder Belege nach deinen steuerlichen Pflichten (Belegerteilung, Registrierkasse) selbst aus und führst Steuern und Abgaben auf deine Umsätze selbst ab. Du prüfst selbst, ob und in welchem Umfang du als landwirtschaftlicher Betrieb Direktvermarktung betreiben darfst.

18.6 Du erfüllst gegenüber der Kundschaft die gesetzlichen Pflichten eines Unternehmers im Fernabsatz: Rücktrittsrecht (Punkt 14), Gewährleistung (Punkt 15), Informationspflichten. Die Kaufbedingungen (Punkte 8 bis 16), die Rücktrittsbelehrung und die Abläufe dazu (Bestellbestätigung, Rücktrittsfunktion, Storno-Weg) geben wir verbindlich vor und halten sie nach bestem Wissen gesetzeskonform; Rechtsberatung für deinen Betrieb sind sie nicht. Du bist dafür verantwortlich, dass die Angaben zu deinen Waren stimmen und dass du erfüllst, was sich aus deiner Ware ergibt (etwa Ausnahmen vom Rücktritt, Rücksendekosten bei sperriger Ware, Pflichtangaben). Bei jedem Produkt gibst du an, ob es schnell verdirbt und deshalb vom Rücktritt ausgenommen ist, und bei sperriger Ware die geschätzten Kosten einer Rücksendung. Agrilo zeigt diese Angaben vor dem Bestellen, in der Belehrung der Bestellbestätigung und auf der Rücktrittsseite an und entscheidet nichts selbst. Nennst du bei sperriger Ware, die nicht per Post zurückgehen kann, beim Angebot keine geschätzten Rücksendekosten, trägst du sie bei einem Rücktritt selbst (§ 15 FAGG).

18.7 Du beantwortest Rücktritte, Reklamationen und Nachrichten der Kundschaft in angemessener Zeit, in der Regel binnen 3 Werktagen, und erstattest, was du schuldest, binnen der gesetzlichen Fristen. Nachrichten von Agrilo im Postfach liest du regelmäßig.

18.8 **Einbeziehung und Vollmacht.** Mit der Nutzung von Agrilo beziehst du die Kaufbedingungen (Punkte 8 bis 16) in jeden Kaufvertrag ein, der über Agrilo zustande kommt. Du bevollmächtigst Agrilo, in deinem Namen Bestellungen entgegenzunehmen und zu bestätigen, Stornos nach Punkt 23 zu erklären, Erstattungen nach diesen AGB über Stripe auszulösen (Punkt 21.4) und Rücktritte, Reklamationen und andere Erklärungen der Kundschaft für dich entgegenzunehmen (Empfangsvollmacht). Was bei Agrilo eingeht, gilt als bei dir eingegangen; wir leiten es dir unverzüglich weiter.

18.9 Die Daten der Kundschaft, die du über Agrilo bekommst, nutzt du nur zur Abwicklung der jeweiligen Bestellung, für deine gesetzlichen Pflichten und, mit Einwilligung, für Neuigkeiten (Punkt 26). Keine Weitergabe, kein Verkauf, keine unerbetene Werbung.

18.10 Bestellungen, die über Agrilo eingegangen sind, wickelst du über Agrilo ab. Du leitest sie nicht an Agrilo vorbei, um die Plattformgebühr zu umgehen; tust du es doch, schuldest du die Plattformgebühr für diese Bestellungen trotzdem. Verkäufe außerhalb von Agrilo bleiben dir frei; wir verlangen keine Exklusivität und keine Bestpreisgarantie.

18.11 **Freistellung.** Nimmt jemand Agrilo wegen deiner Angebote, Inhalte oder Waren oder wegen deines Verstoßes gegen Gesetz oder diese AGB in Anspruch (Kundschaft, Mitbewerber, Rechteinhaber, Behörden), hältst du Agrilo schad- und klaglos, einschließlich angemessener Kosten der Rechtsverteidigung, soweit du das zu vertreten hast. Wir informieren dich unverzüglich und stimmen die Verteidigung mit dir ab.

18.12 **Rückruf.** Musst du eine Ware zurückrufen, oder verlangt eine Behörde Maßnahmen zu einer Ware, sagst du uns das unverzüglich. Wir dürfen das Angebot ausblenden und betroffene Kundschaft in deinem Namen informieren.

### 19. Plattformgebühr und Abrechnung

19.1 Für die Nutzung von Agrilo zahlst du je Bestellung, die abgeholt wurde, eine **Plattformgebühr**. Sie beträgt den Prozentsatz vom Warenpreis, der in deinen Konditionen steht (Standard 6 %), wird je Stück auf den nächsten Cent aufgerundet und ist im Endpreis enthalten, den die Kundschaft zahlt (Punkt 10.2). Du legst den Warenpreis fest; Agrilo errechnet daraus den Endpreis. Unterm Strich reichst du nur weiter, was die Kundschaft bezahlt hat. Die Plattformgebühr versteht sich inklusive Umsatzsteuer, soweit sie anfällt.

19.2 **Online** behält Stripe die Plattformgebühr beim Bezahlen für Agrilo ein; dir fließt der volle Warenpreis zu. **Bar** kassierst du den Endpreis; die darin enthaltene Plattformgebühr rechnen wir monatlich ab (Punkt 19.4).

19.3 Fällig wird die Plattformgebühr mit „Abgeholt“. Für stornierte, nicht abgeholte und fehlende Waren und für Waren, die du nach einem Rücktritt zurücknimmst, fällt keine Plattformgebühr an: Online geht die einbehaltene Gebühr für diese Waren mit der Erstattung an die Kundschaft zurück. Bar fällt sie von selbst aus der Monatsabrechnung, wenn du Storno, fehlende Ware oder Rückgabe vor dem Abrechnungstag in der App einträgst; was du später einträgst oder in der App nicht eintragen kannst (etwa eine Teilmenge), schreiben wir dir auf Anfrage gut. Erstattest du aus Gewährleistung oder Kulanz, bleibt die Plattformgebühr geschuldet, auch wenn die Ware zurückgeht.

19.4 **Monatsabrechnung.** Am Abrechnungstag (Standard: der 3. jedes Monats, in deinen Konditionen änderbar) stellen wir dir für den Vormonat zwei Rechnungen aus: über die online schon einbehaltenen Gebühren (bereits bezahlt) und über die bar kassierten Gebühren, aufgeschlüsselt je Bestellnummer. Rechnungen stellen wir elektronisch über Stripe und schicken sie per E-Mail; du stimmst dem zu. Einwendungen gegen eine Abrechnung teilst du uns binnen 30 Tagen nach Zugang mit; danach gilt sie als anerkannt, worauf wir in der Rechnung hinweisen. Barbestellungen, die du bis zum Abrechnungstag weder als „abgeholt“ noch als „nicht abgeholt“ markiert hast, dürfen wir für die Abrechnung als abgeholt behandeln; offene Bestellungen siehst du laufend in der App und kannst die Markierung bis zum Abrechnungstag nachholen.

19.5 **SEPA-Lastschrift.** Für den Einzug erteilst du uns über das Formular von Stripe in der App ein SEPA-Lastschriftmandat. Mit ihm ziehen wir alle fälligen Beträge nach diesen AGB ein: die Gebühren aus Barbestellungen, die Grundgebühr für Hofladen und Beträge nach Punkt 21.3. Ohne gültiges Mandat bietet die Kasse bei deinem Hof nur die Online-Zahlung an, sobald der Einzug für deinen Hof beginnt (Punkt 19.8), soweit deine Konditionen nichts anderes sagen (etwa Zahlung per Überweisung). Die Vorabankündigung einer Lastschrift erhältst du mit der Rechnung per E-Mail; der Einzug erfolgt frühestens am Werktag nach Zugang der Rechnung. Du stimmst dieser verkürzten Frist zu und sorgst für Deckung auf dem Konto.

19.6 **Fälligkeit und Verzug.** Rechnungen sind mit Zugang fällig. Bleibt eine Rechnung 14 Tage nach Fälligkeit unbezahlt (in deinen Konditionen änderbar) oder wird eine Lastschrift zurückgebucht, nimmt dein Hof keine Barbestellungen mehr an, bis der Betrag bezahlt ist; Online-Zahlung und laufende Bestellungen bleiben. Im Verzug schuldest du die gesetzlichen Verzugszinsen zwischen Unternehmern (§ 456 UGB) und den Pauschalbetrag für Betreibungskosten nach § 458 UGB.

19.7 Gegen Forderungen von Agrilo kannst du nur mit Forderungen aufrechnen, die wir anerkannt haben oder die rechtskräftig festgestellt sind. Ein Zurückbehaltungsrecht steht dir nur wegen solcher Forderungen aus diesem Vertrag zu.

19.8 **Gründungshöfe und Einzugsbeginn.** Für Gründungshöfe beginnt der Einzug der Bar-Gebühren erst nach Ablauf ihrer Gründungslaufzeit (Punkt 20.3); bis dahin bleibt die im Preis enthaltene Gebühr aus Barbestellungen bei dir (erlassen), und ein Mandat ist nicht nötig. Für alle anderen Höfe beginnt der Einzug mit dem Stichtag auf [/konditionen](/konditionen), außer in deinen Konditionen steht ein späterer Tag. Wir sagen dir 4 Wochen vor deinem Einzugsbeginn im Postfach und per E-Mail Bescheid; liegt er näher, sofort.

19.9 **Änderungen.** Den Prozentsatz, den Abrechnungstag und die Frist bis zur Sperre können wir für deinen Hof ändern. Jede Änderung zu deinem Nachteil kündigen wir mindestens 30 Tage vorher an; ein geänderter Prozentsatz gilt nur für Bestellungen ab dem angekündigten Tag (Punkt 32.3).

### 20. Tarife

20.1 Es gibt zwei Tarife: **Hoftor** (0 € im Monat; nach dem Tarifstart bis zu 3 Produkte und 1 Abholzeit pro Woche) und **Hofladen** (19 € im Monat inkl. USt, monatlich zum Monatsende kündbar). Was welcher Tarif enthält, steht auf [/konditionen](/konditionen) und in deinen Einstellungen unter „Deine Konditionen“, beides Teil dieser AGB.

20.2 Ohne deine Wahl gilt Hoftor. Hofladen gibt es nur nach aktiver Wahl mit SEPA-Lastschriftmandat; es gibt keine automatische Umstellung und keine Abbuchung ohne deine Wahl. Die Grundgebühr rechnen wir monatlich im Voraus ab. Bleibt sie nach Mahnung mit 14 Tagen Frist unbezahlt, dürfen wir den Tarif auf Hoftor zurücksetzen.

20.3 **Gründungshöfe.** Höfe mit Gründungsplatz nutzen Hofladen für die Laufzeit, die in ihren Konditionen steht (derzeit 12 Monate ab dem späteren Tag von Tarifstart und Freischaltung), ohne Grundgebühr. Diese Zusage bleibt bestehen, auch wenn wir die Bedingungen für neue Höfe ändern. Danach wählst du deinen Tarif; ohne Wahl bleibt Hoftor.

20.4 **Bis zum Tarifstart.** Bis zum Tarifstart auf [/konditionen](/konditionen) ist jeder Tarif kostenlos.

### 21. Zahlungsabwicklung über Stripe

21.1 Die Zahlungsabwicklung für Höfe auf Agrilo stellt Stripe Payments Europe, Ltd. bereit. Sie unterliegt dem **Stripe Connected Account Agreement** einschließlich der Stripe-Nutzungsbedingungen (zusammen die „Stripe-Vereinbarung“, abrufbar unter stripe.com/legal/connect-account). Indem du diesen AGB zustimmst oder Agrilo als Hof weiter nutzt, stimmst du zu, an die Stripe-Vereinbarung gebunden zu sein, die Stripe von Zeit zu Zeit ändern kann. Voraussetzung dafür, dass Agrilo die Zahlungsabwicklung über Stripe ermöglicht, ist, dass du uns richtige und vollständige Angaben über dich und deinen Betrieb machst; du ermächtigst uns, diese Angaben und Transaktionsdaten im Zusammenhang mit der Zahlungsabwicklung an Stripe weiterzugeben. Stripe prüft deine Identität und dein Bankkonto, entscheidet allein über Freigabe, Sperre und Auszahlungen und kann Nachweise verlangen. Darauf haben wir keinen Einfluss; Agrilo haftet nicht für Entscheidungen, Verzögerungen oder Gebühren von Stripe. Du bietest über Agrilo nichts an, was die Stripe-Vereinbarung ausschließt.

21.2 Online-Zahlungen der Kundschaft gehen an dich als Zahlungsempfänger. Mit der Bestätigung der Zahlung durch Stripe ist die Schuld der Kundschaft dir gegenüber erfüllt. Stripe behält die Plattformgebühr für Agrilo ein und zahlt den Rest nach seinen Bedingungen auf dein Bankkonto aus. Die Entgelte von Stripe für die Zahlungsabwicklung trägt Agrilo, soweit die Konditionen nichts anderes sagen. Agrilo steht nicht dafür ein, dass Kundschaft abholt oder bar bezahlt.

21.3 **Erstattungen und Rückgriff.** Erstattungen bei Storno, Rücktritt, fehlenden Artikeln und nach Punkt 12.4 laufen über Stripe; der erstattete Betrag wird von deinem Stripe-Guthaben oder deiner nächsten Auszahlung abgezogen. Muss Agrilo wegen deiner Verkäufe etwas an Stripe oder an Kundschaft zahlen – Erstattungen, Rückbuchungen (Chargebacks) samt den Gebühren, die Stripe dafür berechnet, negative Salden, Entgelte oder Strafzahlungen von Kartenorganisationen –, ersetzt du uns das, außer wir haben es zu vertreten. Wir dürfen solche Beträge durch Rückholung früherer Überweisungen an dich über Stripe, durch Verrechnung mit Beträgen, die wir dir schulden, oder per SEPA-Lastschrift einziehen und stellen sie dir sonst in Rechnung; Punkt 19.6 gilt. Kommt dein Hof einer Reklamation nicht binnen 14 Tagen nach, obwohl wir dich erinnert haben, und nennt er uns keinen sachlichen Grund dagegen, darf Agrilo der Kundschaft in deinem Namen bis zur Höhe des Bestellwerts erstatten und den Betrag bei dir verrechnen.

21.4 Du bevollmächtigst Agrilo, Erstattungen nach diesen AGB über dein Stripe-Konto auszulösen: bei Storno, bei einem wirksamen Rücktritt, bei fehlenden Artikeln, für die Plattformgebühr nicht abgeholter Bestellungen, bei einer Stornierung nach Punkt 23 und in den Fällen von Punkt 21.3. Über jede Erstattung informieren wir dich.

21.5 Barzahlungen kassierst du selbst. Agrilo wickelt sie nicht ab, bewahrt kein Bargeld auf und haftet nicht dafür.

21.6 Wir dürfen den Zahlungsdienstleister mit einer Ankündigung von mindestens 30 Tagen wechseln; du wirkst an der Einrichtung des neuen Kontos mit.

### 22. Storno, Nichtabholung, Erstattungen durch dich

22.1 Du stornierst nur Bestellungen, die du nicht erfüllen kannst, und nennst den Grund (Punkt 13.2). Bei einem Storno nach Beginn des Abholtermins oder bei wiederholten Stornos dürfen wir deinen Hof prüfen und Maßnahmen nach Punkt 5.3 treffen.

22.2 „Abgeholt“ und „Nicht abgeholt“ markierst du wahrheitsgemäß. Markierst du eine abgeholte Bestellung als „nicht abgeholt“, schuldest du die Plattformgebühr trotzdem; Punkt 25.3 gilt. Die Zahl der nicht abgeholten Bestellungen zeigen wir in deiner Akte; fällt sie auf, fragen wir nach.

22.3 Bar erstattest du selbst, was du nach Punkt 12 bis 15 schuldest, und vermerkst es in der Bestellung.

### 23. Eingriffe durch Agrilo bei Störungen

23.1 Wir dürfen deinen Hof für neue Bestellungen vorübergehend sperren, wenn ein Rechtsverstoß, eine Gefahr für die Kundschaft, eine offene Rechnung nach Punkt 19.6 oder eine behördliche Anordnung vorliegt oder wenn du auf eine dringende Nachricht zu einer offenen Bestellung länger als 7 Tage nicht reagierst. Wir nennen dir den Grund (Punkt 5.3). Die Sperre endet, sobald der Grund weggefallen ist.

23.2 Wir dürfen eine Bestellung in deinem Namen vor der Abholung stornieren, wenn du nicht erreichbar bist, die Kundin oder der Kunde berechtigt darauf besteht oder eine technische Störung die Abwicklung verhindert. Du bekommst eine Nachricht mit dem Grund.

23.3 Bei einer Störung der Plattform oder des Zahlungsdienstleisters dürfen wir neue Bestellungen auf allen Höfen anhalten (Punkt 5.4). Für Verkäufe, die dadurch nicht zustande kommen, haften wir nur nach Punkt 30.

### 24. Postfach, Zustellung

24.1 Agrilo schreibt dir über das **Postfach** in der App: Neues zur Plattform, Hinweise zu deinen Angeboten, Abrechnung, Rechtliches. Du kannst jede Nachricht beantworten.

24.2 Nachrichten, die den **Betrieb deines Hofs auf Agrilo** betreffen (etwa fehlende Pflichtangaben, Abrechnung, Sperren, Änderungen dieser AGB), schicken wir dir zusätzlich per E-Mail an die Adresse deines Kontos. Das ist Teil der Vertragsdurchführung und braucht keine Einwilligung. Werbung für Dritte verschicken wir nicht. Eine E-Mail an die Adresse deines Kontos gilt am folgenden Werktag als zugegangen; du hältst die Adresse aktuell.

24.3 Für Erklärungen zu diesem Vertrag – auch für den Widerspruch nach Punkt 6.1 – genügt Textform (E-Mail oder Postfach).

### 25. Reihenfolge, Daten, Beschwerden (Verordnung (EU) 2019/1150)

25.1 **Reihenfolge:** Wie Höfe und Angebote gereiht werden, steht in Punkt 3. Du kannst die Reihung nicht kaufen, und wir bevorzugen keinen Hof – auch keinen, an dem wir beteiligt wären. Wir betreiben keinen eigenen Hof, der mit deinem im Wettbewerb steht; ein Testhof (Punkt 17.5) erscheint in keiner Liste.

25.2 **Daten:** Du siehst die Daten deiner eigenen Bestellungen (Name, E-Mail, Telefon und Notiz der Kundschaft, soweit angegeben), deine Auswertungen und deine Abrechnungen und bekommst sie auf Anfrage als Export. Agrilo sieht alle Daten, die beim Betrieb der Plattform anfallen, und nutzt sie für den Betrieb, die Abrechnung, die Pflichtmeldungen (Punkt 27) und die Verbesserung der Plattform; Näheres in der [Datenschutzerklärung](/datenschutz). Nach dem Ende deiner Nutzung bleiben Bestell- und Abrechnungsdaten so lange gespeichert, wie das Gesetz es verlangt (Punkt 29.4); Zugriff darauf hast du dann nur noch über eine Anfrage.

25.3 **Einschränkung, Sperre, Kündigung:** Schränken wir dein Konto ein oder sperren es, nennen wir dir spätestens mit der Maßnahme die Gründe und die Tatsachen, auf die wir uns stützen (Punkt 5.3). Eine ordentliche Kündigung durch uns kündigen wir mindestens 30 Tage vorher per E-Mail an und begründen sie. Gründe für Einschränkung, Sperre oder Kündigung sind: Verstöße gegen Gesetz oder diese AGB, falsche Angaben bei der Registrierung oder zur Unternehmereigenschaft, Zahlungsverzug nach Punkt 19.6, wiederholte berechtigte Beschwerden der Kundschaft, Gefährdung von Kundschaft oder Plattform, behördliche oder gerichtliche Anordnungen, gesetzliche Pflichten (etwa Punkt 27.3), geschäftliche Gründe (etwa die Einstellung der Plattform oder eines Gebiets) und ein Hofkonto, das länger als 12 Monate nicht genutzt wurde. **Sofort kündigen** dürfen wir, wenn ein Gesetz oder eine Behörde es verlangt, aus wichtigem Grund nach österreichischem Recht (etwa Betrug, Gesundheitsgefahr, schwerer Rechtsverstoß) oder bei wiederholten Verstößen gegen diese AGB; die Begründung erhältst du per E-Mail (Art. 4 Abs. 4 Verordnung (EU) 2019/1150).

25.4 **Beschwerden:** Beschwerden über Entscheidungen oder technische Probleme richtest du an **[E-Mail laut Impressum]** oder über „Problem melden“. Wir antworten in angemessener Zeit, in der Regel binnen 14 Tagen, und begründen unsere Entscheidung. Als kleines Unternehmen sind wir zu einer eigenen Beschwerdestelle und zur Mediation nicht verpflichtet (Art. 11 Abs. 5 und Art. 12 Abs. 7 Verordnung (EU) 2019/1150); eine Mediation können wir im Einzelfall vereinbaren.

### 26. Daten der Kundschaft, Datenschutz, Auftragsverarbeitung

26.1 Für die Daten der Kundschaft, die du über Agrilo erhältst, bist du selbst Verantwortlicher im Sinne der DSGVO; Agrilo ist für den Betrieb der Plattform eigenständig verantwortlich. Du nutzt die Daten nur für die Abwicklung der Bestellung, für gesetzliche Pflichten und, bei Einwilligung, für Neuigkeiten, und löschst sie, sobald sie dafür nicht mehr nötig sind.

26.2 Vermutest du einen Datenschutzvorfall, der Daten aus Agrilo betrifft, sagst du uns sofort Bescheid, damit wir unsere Meldepflichten einhalten können.

26.3 **Auftragsverarbeitung.** Versendest du über Agrilo Neuigkeiten an Kundschaft, die sich dafür angemeldet hat, verarbeiten wir die Daten der Empfängerinnen und Empfänger in deinem Auftrag. Dafür gilt der Vertrag zur Auftragsverarbeitung in Anhang 3 (Art. 28 DSGVO).

### 27. Steuern und Meldepflichten

27.1 Die steuerliche Behandlung deiner Umsätze und der Plattformgebühr ist deine Sache; Agrilo gibt keine Steuerberatung.

27.2 Agrilo ist nach dem Digitale Plattformen-Meldepflichtgesetz (DPMG, Umsetzung der Richtlinie „DAC 7“) verpflichtet, Angaben zu Anbietern und ihre Umsätze jährlich an das Finanzamt zu melden. Ausgenommen sind Anbieter mit weniger als 30 Verkäufen und höchstens 2 000 € Umsatz über die Plattform im Kalenderjahr. Du lieferst uns dafür die vorgeschriebenen Angaben (insbesondere Name, Anschrift, Steuernummer bzw. UID, bei natürlichen Personen das Geburtsdatum, bei Rechtsträgern die Firmenbuchnummer) und hältst sie aktuell. Welche Daten wir melden, sagen wir dir vor der ersten Meldung.

27.3 Lieferst du die Angaben trotz zweier Erinnerungen nicht binnen 60 Tagen, müssen wir dein Hofkonto sperren oder deine Auszahlungen bzw. Gutschriften zurückhalten, soweit wir darauf Zugriff haben, bis sie vorliegen. Das verlangt das Gesetz.

### 28. Käufe durch Unternehmen (Käuferart „Betrieb“)

Kauft ein Unternehmen – etwa ein anderer Hof, ein Gasthaus oder ein Pferdebetrieb – über Agrilo ein, gelten die Punkte 8 bis 16 sinngemäß, aber **ohne die Verbraucherrechte**: kein Rücktrittsrecht nach FAGG, Gewährleistung nach UGB und ABGB zwischen Unternehmern, Untersuchungs- und Rügepflicht nach § 377 UGB. In der Kasse wählst du dafür „Betrieb“ als Käuferart und erklärst damit, als Unternehmer zu kaufen.

### 29. Pausieren, Stilllegen, Kündigen, Konto schließen

29.1 Du kannst deinen Hof jederzeit **pausieren** oder **stilllegen** (deine Hofseite ist dann nicht sichtbar; offene Bestellungen erfüllst du noch) und wieder aktivieren.

29.2 Den Tarif **Hofladen** kannst du monatlich zum Monatsende kündigen; danach läuft dein Hof im Tarif Hoftor weiter.

29.3 Dein **Hofkonto** kannst du jederzeit kündigen (Anfrage über „Konto und Sicherheit“ oder per E-Mail). Die Kündigung wirkt mit Zugang. Offene Bestellungen und Erstattungen wickelst du noch ab; sobald keine mehr offen sind, schließen wir dein Konto: Deine Hofseite ist offline, die Anmeldung gesperrt, Abos sind beendet. Offene Beträge bleiben fällig, und dein SEPA-Lastschriftmandat gilt für die Schlussabrechnung weiter. 30 Tage lang kannst du das Konto wieder öffnen. Danach löschen wir Kontakt, Fotos und Texte deines Hofs oder machen sie unkenntlich.

29.4 Bestellungen, Beträge und Abrechnungen bleiben gespeichert, solange Aufbewahrungspflichten gelten (insbesondere 7 Jahre nach § 132 BAO) oder sie zur Abwehr von Ansprüchen nötig sind. Alles Übrige löschen wir; Näheres in der [Datenschutzerklärung](/datenschutz).

29.5 Wir können den Nutzungsvertrag mit einem Hof mit einer Frist von 30 Tagen kündigen. Ohne Frist kündigen wir nur in den Fällen, in denen Punkt 25.3 eine sofortige Kündigung erlaubt. Stellen wir die Plattform ein, kündigen wir mindestens 30 Tage vorher an.

29.6 **Fortgeltung.** Nach dem Ende des Vertrags gelten die Punkte 18.11, 19, 21.3, 21.4, 26, 27, 29.4 und 30 weiter, solange daraus Ansprüche oder Pflichten entstehen können.

---

## Teil D – Für alle: Haftung, Änderungen, Streit

### 30. Haftung von Agrilo

30.1 Agrilo haftet unbeschränkt für Schäden an Leben, Körper oder Gesundheit, bei Vorsatz und krass grober Fahrlässigkeit, nach dem Produkthaftungsgesetz und soweit eine Haftung gesetzlich zwingend ist (etwa Art. 82 DSGVO).

30.2 **Gegenüber Kundinnen und Kunden** haften wir bei leichter Fahrlässigkeit nur für Schäden aus der Verletzung von Pflichten, deren Erfüllung die Nutzung der Plattform erst ermöglicht (wesentliche Pflichten), und nur für den vorhersehbaren, vertragstypischen Schaden. Im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen. Bei grober Fahrlässigkeit haften wir nach dem Gesetz. Punkt 30.1 bleibt unberührt.

30.3 **Gegenüber Höfen** ist die Haftung für leichte Fahrlässigkeit ausgeschlossen. Bei grober Fahrlässigkeit, die nicht krass grob ist, ersetzen wir keinen entgangenen Gewinn und keine mittelbaren Schäden, und unsere Haftung ist je Schadensfall auf die Plattformgebühren begrenzt, die in den 12 Monaten davor für Bestellungen bei deinem Hof angefallen sind, mindestens aber auf 500 €. Für Schäden aus Datenverlust haften wir nur, soweit du die Daten nicht zumutbar hättest sichern können (Punkt 7.3). Schadenersatzansprüche aus diesem Nutzungsvertrag verjähren für beide Seiten in 12 Monaten ab Kenntnis von Schaden und Schädiger, außer bei Vorsatz, krass grober Fahrlässigkeit und Schäden an Leben, Körper oder Gesundheit; Ansprüche auf Entgelte und nach den Punkten 18.11 und 21.3 verjähren nach dem Gesetz. Punkt 30.1 bleibt unberührt.

30.4 Agrilo haftet nicht für Waren der Höfe, deren Beschreibung, Beschaffenheit oder Rechtmäßigkeit, für die Erfüllung von Kaufverträgen und für das Verhalten von Höfen oder Kundschaft. Für Inhalte, die Nutzerinnen und Nutzer einstellen, haften wir nur, wenn wir nach einem konkreten Hinweis auf einen Rechtsverstoß nicht unverzüglich handeln (§ 16 ECG, Art. 6 Verordnung (EU) 2022/2065). Die Punkte 30.1 bis 30.3 bleiben unberührt.

30.5 Für Ausfälle und Störungen durch Ereignisse, die weder wir noch Personen, für die wir einzustehen haben, zu vertreten haben – etwa höhere Gewalt, großflächige Netz- oder Stromausfälle, Angriffe von außen trotz angemessener Schutzmaßnahmen –, haften wir nicht. Die Punkte 30.1 bis 30.3 bleiben unberührt.

### 31. Datenschutz

Wie wir personenbezogene Daten verarbeiten, steht in der [Datenschutzerklärung](/datenschutz). Höfe sind für die Daten ihrer Kundschaft, die sie über Agrilo erhalten, selbst Verantwortliche im Sinne der DSGVO (Punkt 26).

### 32. Änderungen dieser AGB

32.1 Wir können diese AGB ändern, wenn sich das Gesetz, die Rechtsprechung, die Plattform oder unsere Kosten ändern oder eine Regelungslücke zu schließen ist.

32.2 **Für Kundinnen und Kunden** gilt für jede Bestellung die Fassung, die zum Zeitpunkt der Bestellung auf [/agb](/agb) steht und die du mit der Bestellbestätigung erhältst. Eine Änderung wirkt nicht auf abgeschlossene Bestellungen zurück.

32.3 **Für Höfe** kündigen wir Änderungen mindestens **15 Tage** vor dem Wirksamwerden über das Postfach und per E-Mail an (Art. 3 Abs. 2 Verordnung (EU) 2019/1150); bei Änderungen, die dich erheblich belasten (etwa an der Plattformgebühr oder an den Tarifen) oder die eine technische Anpassung von dir verlangen, mindestens 30 Tage. Du kannst bis zum Wirksamwerden kündigen (Punkt 29.3). Kündigst du nicht, gilt die neue Fassung ab dem Wirksamwerden; darauf und auf dein Kündigungsrecht weisen wir in der Ankündigung ausdrücklich hin. Stellst du in der Frist neue Produkte ein, verzichtest du damit auf den Rest der Frist; das gilt nicht für Änderungen an Plattformgebühr, Tarifen oder Abrechnung (Punkt 19.9) und nicht, wenn die Änderung eine technische Anpassung von dir verlangt. Kürzere Fristen gelten nur, wenn ein Gesetz oder eine Behörde die Änderung so verlangt, dass die Frist nicht eingehalten werden kann, oder wenn wir eine unvorhergesehene, unmittelbare Gefahr abwehren müssen (Betrug, Schadsoftware, Spam, Datenschutzverletzung, Sicherheitsrisiko; Art. 3 Abs. 4 Verordnung (EU) 2019/1150). Bestellungen, die vor dem Wirksamwerden eingegangen sind, bleiben von Änderungen unberührt.

32.4 **Höfe, die schon vor dem [Tag des Inkrafttretens] dabei waren.** Hast du einer früheren Fassung dieser AGB zugestimmt, kündigen wir dir diese Fassung über das Postfach und per E-Mail an. Sie gilt für dich ab dem [Tag des Inkrafttretens], frühestens aber 30 Tage nach dieser Ankündigung. Stimmst du ihr nach der Ankündigung in der App zu, verzichtest du damit auf den Rest dieser Frist. Bis dahin gelten für dich die bisherigen Bedingungen. Du kannst bis zum Inkrafttreten kündigen (Punkt 29.3).

### 33. Streitbeilegung

33.1 Bei Problemen sprich uns zuerst an: **[E-Mail laut Impressum]** oder „Problem melden“. Die meisten Fragen lösen wir so.

33.2 **Verbraucherinnen und Verbraucher:** Wir sind nicht verpflichtet, an Verfahren einer Verbraucherschlichtungsstelle teilzunehmen, und nehmen nicht teil (§ 19 AStG). Zuständig wären die **Internet Ombudsstelle** (ombudsstelle.at) und die **Schlichtung für Verbrauchergeschäfte** (verbraucherschlichtung.at). Beschwerden über einen Hof richtest du an den Hof. Höfe nehmen an einer Verbraucherschlichtung nicht teil, außer die Hofseite sagt etwas anderes.

33.3 **Höfe:** Streitigkeiten versuchen wir zuerst direkt zu klären (Punkt 25.4). Eine Mediation können beide Seiten vorschlagen; verpflichtet ist niemand.

### 34. Anwendbares Recht, Gerichtsstand

34.1 Es gilt **österreichisches Recht** unter Ausschluss des UN-Kaufrechts. Für Verbraucherinnen und Verbraucher mit gewöhnlichem Aufenthalt in einem anderen Staat gelten zusätzlich die zwingenden Verbraucherschutzvorschriften dieses Staates.

34.2 Für Klagen gegen Verbraucherinnen und Verbraucher gilt § 14 KSchG (Gericht am Wohnsitz oder Beschäftigungsort in Österreich). Für Streitigkeiten mit Höfen und anderen Unternehmern ist das sachlich zuständige Gericht am Sitz von Agrilo ausschließlich zuständig; wir dürfen auch am Sitz des Hofs klagen.

### 35. Schluss

35.1 Ist eine Bestimmung dieser AGB unwirksam, bleiben die übrigen wirksam. Anstelle der unwirksamen Bestimmung gilt das Gesetz.

35.2 Agrilo darf diesen Vertrag mit einem Hof samt allen Rechten und Pflichten auf einen Rechtsnachfolger übertragen, der die Plattform weiterführt; wir kündigen das 30 Tage vorher an, und du kannst zum Übergang kündigen.

35.3 Diese AGB gibt es nur auf Deutsch. Du kannst sie auf [/agb](/agb) jederzeit abrufen, speichern und ausdrucken (§ 11 ECG). Deine Zustimmung zu diesen AGB halten wir mit Zeitpunkt und Fassung fest.

---

## Anhang 1: Rücktrittsbelehrung (Widerrufsbelehrung) für Verbraucherinnen und Verbraucher

*Dein Vertragspartner ist der Hof, bei dem du bestellt hast. In deiner Bestellbestätigung steht diese Belehrung mit Name, Anschrift, Telefonnummer und E-Mail-Adresse des Hofs ausgefüllt. Die Belehrung folgt dem gesetzlichen Muster (Anhang I Teil A FAGG) und ist deshalb in der Sie-Form gehalten.*

[Wortlaut aus `src/lib/widerruf.ts` (`BELEHRUNG.teilA`, Abschnitte „Widerrufsrecht“ und „Folgen des Widerrufs“), nicht abgetippt: das gesetzliche Muster nach Anhang I Teil A FAGG idF BGBl. I Nr. 59/2026 mit dem Satz zur Online-Funktion unter agrilo.at/widerruf und dem Platzhalter „[Name, Anschrift, Telefonnummer und E-Mail-Adresse des Hofs]“.]

*Ende des gesetzlichen Musters.*

**Hinweise (kein Teil des Musters):** Waren, die du am Hof abgeholt hast, kannst du dort auch zurückgeben; dann entstehen dir keine Rücksendekosten. Bei sperriger Ware, die nicht per Post zurückgehen kann (etwa Brennholz, Heu, Großgebinde), nennt dir der Hof die geschätzten Rücksendekosten beim Angebot, bevor du bestellst. Nennt er keine, trägst du keine Rücksendekosten. Kein Rücktrittsrecht besteht nach § 18 Abs. 1 FAGG insbesondere bei Waren, die schnell verderben können oder deren Ablaufdatum schnell überschritten würde (Z 4), bei versiegelten Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung entfernt wurde (Z 5), bei Waren, die nach deinen Angaben angefertigt oder eindeutig auf deine persönlichen Bedürfnisse zugeschnitten wurden (Z 3), und bei Waren, die nach der Übergabe untrennbar mit anderen Gütern vermischt wurden (Z 6). Welche Waren das bei deiner Bestellung sind, sagt dir der Hof; Beispiele stehen in Punkt 14.2.

---

## Anhang 2: Muster-Widerrufsformular

[Wortlaut aus `src/lib/widerruf.ts` (`BELEHRUNG.teilB`), nicht abgetippt: das gesetzliche Muster nach Anhang I Teil B FAGG mit dem Platzhalter „[Name, Anschrift und E-Mail-Adresse des Hofs]“.]

*Hinweis (kein Teil des Musters): Die Angaben des Hofs stehen in deiner Bestellung. Nenne am besten auch deine Bestellnummer. Du kannst das Formular auch an Agrilo schicken ([E-Mail laut Impressum]); wir leiten es an den Hof weiter (Punkt 14.3).*

---

## Anhang 3: Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO) für Hof-Neuigkeiten

1. **Parteien und Gegenstand.** Der Hof (Verantwortlicher) beauftragt Agrilo (Auftragsverarbeiter), die Daten von Personen zu verarbeiten, die sich für Neuigkeiten des Hofs angemeldet haben, um diese Neuigkeiten im Namen des Hofs zu versenden, die Anmeldung und Abmeldung zu verwalten und den Nachweis der Einwilligung zu speichern. Dieser Anhang gilt, solange der Hof die Funktion „Neuigkeiten“ nutzt, und endet mit der Löschung der Daten nach Punkt 9.

2. **Datenarten und Betroffene.** E-Mail-Adresse (und Telefonnummer, soweit Neuigkeiten über einen Nachrichtendienst gehen), Zeitpunkt und Nachweis der Anmeldung, Zustell- und Abmeldeinformationen; Betroffene sind Kundinnen und Kunden des Hofs, die sich angemeldet haben.

3. **Weisungen.** Agrilo verarbeitet die Daten nur nach dokumentierter Weisung des Hofs, auch bei einer Übermittlung in ein Land außerhalb der EU bzw. des EWR – außer das Recht der EU oder Österreichs verpflichtet Agrilo zu einer Verarbeitung; dann sagt Agrilo das dem Hof vorher, soweit das Gesetz es nicht verbietet (Art. 28 Abs. 3 lit. a DSGVO). Weisungen gibt der Hof über die Funktionen der App (Neuigkeit anlegen, versenden, Abmeldungen einsehen). Hält Agrilo eine Weisung für rechtswidrig, sagt es dem Hof Bescheid und darf die Ausführung aussetzen. Für die Zulässigkeit des Versands (Einwilligung nach § 174 TKG 2021 und Art. 6 DSGVO) ist der Hof verantwortlich; die Anmeldung über Agrilo dokumentiert die Einwilligung.

4. **Vertraulichkeit.** Personen, die bei Agrilo Zugriff haben, sind zur Vertraulichkeit verpflichtet.

5. **Sicherheit.** Agrilo trifft angemessene technische und organisatorische Maßnahmen (Art. 32 DSGVO): verschlüsselte Übertragung und Speicherung, Zugriff nur für berechtigte Personen mit Mehrfaktor-Anmeldung, Protokollierung, regelmäßige Sicherungen, Trennung der Daten je Hof.

6. **Weitere Auftragsverarbeiter.** Der Hof stimmt den in der Datenschutzerklärung genannten Dienstleistern für Hosting, Datenbank und E-Mail-Versand zu. Agrilo kündigt einen Wechsel oder eine Ergänzung mindestens 30 Tage vorher an; der Hof kann widersprechen und die Funktion dann nicht weiter nutzen. Agrilo verpflichtet weitere Auftragsverarbeiter vertraglich mindestens gleichwertig und haftet dem Hof für deren Pflichten wie für eigene (Art. 28 Abs. 4 DSGVO).

7. **Unterstützung.** Agrilo unterstützt den Hof mit geeigneten Maßnahmen bei Anfragen Betroffener (Auskunft, Löschung, Widerspruch), bei der Sicherheit der Verarbeitung, bei Datenschutzvorfällen, bei einer Datenschutz-Folgenabschätzung und bei einer vorherigen Konsultation der Datenschutzbehörde (Art. 32 bis 36 DSGVO). Einen Datenschutzvorfall, der diese Daten betrifft, meldet Agrilo dem Hof unverzüglich, in der Regel binnen 48 Stunden nach Kenntnis.

8. **Nachweise.** Agrilo stellt dem Hof auf Anfrage die Informationen bereit, die zum Nachweis der Pflichten nach Art. 28 DSGVO nötig sind, und ermöglicht Überprüfungen einschließlich Inspektionen durch den Hof oder einen von ihm beauftragten Prüfer in angemessenem Umfang nach Ankündigung; der Hof trägt dabei seine eigenen Kosten.

9. **Löschung.** Endet die Nutzung der Funktion oder der Vertrag mit dem Hof, löscht Agrilo die Daten nach Punkt 1 nach Wahl des Hofs binnen 30 Tagen oder gibt sie ihm vorher heraus und löscht danach vorhandene Kopien, soweit kein Gesetz die Aufbewahrung verlangt.

10. **Ort der Verarbeitung.** Die Verarbeitung erfolgt in der EU bzw. im EWR, soweit die Datenschutzerklärung für einen Dienstleister nichts anderes nennt. Eine Übermittlung in ein Drittland erfolgt nur mit geeigneten Garantien nach Kapitel V DSGVO.

11. **Haftung.** Für dieses Verhältnis gilt Punkt 30; Art. 82 DSGVO bleibt unberührt.
=== AGB 1.0 ENDE ===
````

**Woran der Erfolg erkennbar ist:** Im PR zeigen die Tests mit gemockter Uhr /agb vor dem Stichtag mit 0.9 und danach mit 1.0. Die Mail- und Kassentests folgen je dem Gebührenmodell der Bestellung (Anhang, Link, Satz unter dem Knopf). Nach dem Merge zeigt die Generalprobe auf test.agrilo.at den Wechsel ohne Deploy, und am Tag T zeigt agrilo.at/agb nach 00:10 Uhr „Fassung 1.0 – gilt ab <Tag>“.
