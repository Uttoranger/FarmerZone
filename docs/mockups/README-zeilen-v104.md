# README-Zeilen · Stand 15.10.2026 (Canvas v104)

Diese Datei wird vom Lauf in `docs/mockups/README.md` eingearbeitet und danach gelöscht.

## 1 · Absatz oben ersetzen

Alt: „Die Mockups zeigen noch den alten Namen FarmerZone und die Domain farmerzone.at; seit 13.10.2026 gilt Agrilo / agrilo.at (Register M1). Beim Umsetzen gilt der neue Name."

Neu: „Stand 15.10.2026: Alle Mockups zeigen die Marke Agrilo (Bildmarke klein + Wort, Register M1, Nr. 92), die Hof-Seitenleiste mit Postfach und Tarif-Zeile (Nr. 61, 86/87), die Handy-Leiste Heute · Bestellungen · Neu · Mein Hof · Mehr (N3), das Mehr-Blatt mit Postfach und Produkten, die Startseite mit Regionskarte (Nr. 59) und die Hofseite ohne Telefonnummer vor dem Kauf (Nr. 60). Die Kasse (Nr. 82) und das Hof-Postfach (Nr. 86/87) stehen jetzt in den Kernzeilen K3 und H6."

## 2 · Neue Zeilen in bestehenden Abschnitten

Die Lauf-Abschnitte (Lauf 10–13) werden aufgelöst; ihre noch gültigen Zeilen ziehen in die Kernabschnitte (Dateinamen bleiben):
- K1: `system-k1-ortssuche-zustaende.html` · K2: `system-k2-titelbild-computer.html`, `mobil-k2-hofseite-beitraege-alle-aktiven.html` · K3 (erste Zeilen): `web-k3-kasse-glatt.html`, `mobil-k3-kasse-glatt.html`, `system-k3-kasse-bezahlen-bar.html` · K4: `web-k4-bestellung-hof-erreichen.html`, `mobil-k4-bestellung-hof-erreichen.html`
- H1: Deine Konditionen Fassung 2 (Web + Handy) · H2: `mobil-h2-neues-produkt-grenze-hoftor.html` · H3: `mobil-h3-heute-post-karte.html` · H4: `web-h4-beitrag-teilen.html`, `mobil-h4-beitrag-teilen.html`, `mobil-h4-beitraege-teilen-je-beitrag.html` · H5: die drei Mehr-Tarif-Zeilen · H6: `mobil-h6-postfach.html`, `mobil-h6-unterhaltung.html`
- SYSTEM: die drei Tarif-Zeilen-Komponenten, Teilen-Bild 1:1 und 9:16, `system-m1-marke-agrilo-entscheidung.html` · ADMIN: `admin-rundschreiben.html`

## 3 · Abschnitt ADMIN komplett ersetzen

## ADMIN · Betreiber – Stand Lauf 14 (15.10.)

Ein Seitenmuster für alle Admin-Seiten: Seitenkopf (Titel + ein Satz + rechts die Hauptaktion oder der Monat) · Kennzahlen-Zeile · Unterreiter (zweite Ebene als Pillen) · Inhalt · Regel-Zeile in leiser Schrift. Reiter in der Kopfzeile: Höfe · Postfach · Startseite (neu, Nr. 96) · Finanzen · Einstellungen (neu, Nr. 93). Darunter die Betriebsleiste mit „Stripe Test" (Register Z2) – ohne Link „Zur Testumgebung", weil es keine gibt (Z3 korrigieren). Einstellungen sind Gruppen (Gründungshöfe · Benachrichtigungen · Betrieb · Plattform), jede mit eigenem Speichern und Protokollzeile.

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `admin-hoefe-und-freischaltung.html` | Admin · Höfe: Seitenkopf, Kennzahlen, Unterreiter Warten · Alle · Gründungshöfe, Warteliste zeigt „bekäme Gründungsplatz Nr. 8", Tabelle mit Spalte Gründungshof (Nr., bis, „abweichend") | `/admin` | Umbau | 1440×900 |
| `admin-postfach.html` | Admin · Postfach › Eingang (Filter Offen): Antwort · Meldung · Aufgabe in einer Liste links, rechts die geöffnete Aufgabe (Hof wartet: Prüfliste, Freischalten/Ablehnen); Reiter Eingang · Rundschreiben · Zustellung (N12 geändert: Reiter Eingang · Rundschreiben · Zustellung) | `/admin/postfach` | Umbau | 1440×900 |
| `admin-postfach-zustellung.html` | Admin · Postfach › Zustellung: Empfängerliste (support@ fest, weitere mit Double-Opt-in) und Regel je Art (sofort · nur im Eingang · Wochenbericht); ersetzt „Einstellungen › Benachrichtigungen“ | `/admin/postfach/zustellung` (neu) | neu | 1440×1000 |
| `admin-postfach-unterhaltungen.html` | Admin · Postfach › Unterhaltungen: Eingang mit Filter Antwort links (480 px), rechts der Faden (Rundschreiben des Teams, Antwort des Hofs) mit Antwortfeld und Hinweis zur E-Mail-Grenze | `/admin/postfach?art=antwort` | Umbau | 1440×1000 |
| `admin-postfach-meldungen.html` | Admin · Postfach › Meldungen: Eingang mit Filter Meldung links, rechts Meldung (Text, Bildschirmfoto, automatisch Mitgeschicktes) und Entscheiden (Status, Bündel, Sprint, Antwort an den Hof) | `/admin/postfach?art=meldung` | Umbau | 1440×1080 |
| `admin-rundschreiben.html` | Admin · Postfach › Rundschreiben: Gesendet mit Lesequote und Antworten links; rechts neues Rundschreiben mit Empfänger (alle · ausgewählte · Filter), Art, Titel, Text, Link, Haken „Antwort möglich“ (neu) und „auch per E-Mail“, Vorschau „So sieht es der Hof“ | `/admin/postfach/rundschreiben` | Umbau (ersetzt die Fassung aus Lauf 13) | 1440×1200 |
| `system-postfach-prozess.html` | Schaubild: Quellen (Hof, Kundschaft, System) → Eingang (drei Arten mit eigenem Weg) → Zustellung (Regeln, Empfänger, Wochenbericht); Ausgang Rundschreiben → Hof-Postfach → Antwort zurück in den Eingang; Hof-Seite spiegelbildlich | Konzept (`docs/konzepte/`) | Konzept | 1760×1250 |
| `admin-finanzen.html` | Admin · Finanzen: Monat im Seitenkopf, Kennzahlen (Grundgebühren 0 € in der Gründungsphase), Unterreiter Monat · Kosten · Auszahlungen · Entfallene Gebühren, Verlauf, Kosten | `/admin/finanzen` | Umbau | 1440×900 |
| `admin-einstellungen.html` | Admin · Einstellungen › Gründungshöfe: Gruppen links (Gründungshöfe · Betrieb · Plattform), rechts Plätze/Vergeben/Frei, Plätze gesamt, Kostenlos bis (Standard), Schalter „Auf den Seiten zeigen", Vorschau des Satzes und der Pill, Protokoll | `/admin/einstellungen` (neu) | neu | 1440×1010 |
| `admin-startseite-gestalten.html` | Lauf 14 · Admin › Startseite: Abschnittsliste (Kopf, Höfe, Fuß fest; ziehen = Reihenfolge, Auge = aus/ein), Einfügepunkte „Block einfügen“, Block bearbeiten (Vorlage, Überzeile, Titel, Text, Bild, Link, Live ab/bis Wiener Zeit), Vorlagen-Bibliothek (Saisonkarte mit Bild, Hinweisband, Höfe-Auswahl, Kategorie-Hinweis) – Konzept in der Lauf-13-Vormerkung (StartseiteAbschnitt + StartseiteBlock, Migration + Seed) | `/admin/startseite` (neu) | neu (geparkt seit Lauf 13) | 1440×1100 |
| `admin-startseite-vorschau.html` | Lauf 14 · Admin › Startseite, Umschalter „So sieht’s die Kundin“: Handy/Web, „Stand am“ (Heute · +1 Woche · nächster Block), echte Startseite mit den Blöcken des Tages plus Block in Bearbeitung, signierter Vorschau-Link (1 h) | `/admin/startseite?ansicht=vorschau` (neu) | neu (geparkt seit Lauf 13) | 1440×1040 |
| `mobil-k0-startseite-saisonblock.html` | Lauf 14 · Startseite am Handy mit Saisonblock (Vorlage Saisonkarte mit Bild) zwischen Kopf und „Höfe in deiner Nähe“ | `/` (Handy) | Zustand | 390×900 |
| `admin-mobil-unterwegs-freischalten.html` | Admin am Handy · Höfe: Reiter unter dem Kopf, Kennzahlen, Warteliste mit Gründungsplatz | `/admin (Handy)` | Umbau | 390×844 |
| `admin-mobil-einstellungen.html` | Admin am Handy · Einstellungen: Gruppen als Liste (ohne Benachrichtigungen – die sind Postfach › Zustellung), Gründungshöfe aufgeklappt | `/admin/einstellungen (Handy)` | neu | 390×844 |

Gelöscht: `admin-briefkasten.html` (der Briefkasten ist seit Nr. 87 der Reiter Meldungen im Postfach) und `admin-meldung-entscheiden.html` (Entscheiden ist die rechte Spalte von Postfach › Meldungen; `/admin/meldungen/[id]` öffnet das Postfach mit dieser Meldung). `admin-rundschreiben.html` ist neu gezeichnet.

## 4 · Neuer Abschnitt (vor den Lauf-Zeilen)

## GRÜNDUNGSHÖFE · Vorschlag 15.10. (Register K2, nach Mobbin- und NN/g-Bewertung)

Kein Banner, sondern Bausteine: ein Satz im Lesefluss (Startseite), Pill + umbenannter Knopf + Fußnote im Kopf von /fuer-hoefe, Angebotszeile direkt über den Tarifkarten (Hofladen 0 € bis 31.12.2027, dann 19 €), ein ehrlicher Satz über dem Registrierformular („voraussichtlich Nr. 8"), einmaliger wegklickbarer Hinweis auf Heute nach der Freischaltung – keine Dauerkarte, keine seitenweite Leiste, kein Countdown. Sind alle Plätze vergeben oder ist das Datum vorbei, verschwindet alles. Zahlen aus `src/lib/gruendungshof.ts` bzw. den Admin-Einstellungen.

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `system-k2-gruendung-bausteine.html` | Gründungshöfe · Bausteine: Satz (dunkel/hell), Pill/Knopf/Fußnote, Preiszeile + Hofladen-Preis, Registrieren-Satz, einmaliger Hinweis, Zustände (letzter Platz, alle vergeben, Datum vorbei), Regeln | Bausteine (`components/gruendung/*`) | neu | 1760×860 |
| `web-k2-startseite-gruendung.html` | Startseite am Computer · Für-Höfe-Band mit dem Gründungssatz | `/` (Für-Höfe-Band) | Zustand | 1440×3390 |
| `mobil-k2-startseite-gruendung.html` | Startseite am Handy · Für-Höfe-Karte mit dem Gründungssatz | `/` (Handy) | Zustand | 390×2544 |
| `web-k2-fuer-hoefe-gruendung.html` | /fuer-hoefe am Computer · Pill, Knopf „Gründungshof werden", Fußnote; Angebotszeile über den Preisen; Hofladen 0 € bis 31.12.2027 | `/fuer-hoefe` | Zustand | 1440×3170 |
| `mobil-k2-fuer-hoefe-gruendung.html` | /fuer-hoefe am Handy · Pill, Knopf, Fußnote; Angebotszeile vor der Preiskarte | `/fuer-hoefe (Handy)` | Zustand | 390×1830 |
| `web-k2-registrieren-gruendung.html` | Hof registrieren am Computer · Satz über dem Formular mit voraussichtlicher Nummer | `/register` | Zustand | 1440×1070 |
| `mobil-k2-registrieren-gruendung.html` | Hof registrieren am Handy · Satz über dem Formular | `/register (Handy)` | Zustand | 390×844 |

## 5 · Größen anpassen

| Datei | neue Größe |
|---|---|
| `mobil-k0-startseite.html` | 390×2500 (Regionskarte als eigener Abschnitt, Nr. 59) |

## 6 · Löschen (vom Lauf, nicht von Hand) – Canvas 15.10. ausgemistet

Überholt oder in die Kernmockups eingearbeitet: `admin-briefkasten.html`, `web-k3-warenkorb-bezahlen.html`, `mobil-k3-warenkorb-bezahlen.html` (alte Kasse), `web-k0-startseite-karte-region.html`, `mobil-k0-startseite-karte-region.html` (Karte steht jetzt in `web-/mobil-k0-startseite.html`), `web-k2-hofseite-ohne-telefon.html`, `mobil-k2-hofseite-ohne-telefon.html` (in der Hofseite eingearbeitet), `web-k3-kasse-angaben-zum-hof.html`, `mobil-k3-kasse-angaben-zum-hof.html` (von Kasse glatt abgelöst), `system-h0-navigation-postfach.html` (Postfach steht in der Seitenleiste), `system-m1-marke-agrilo.html` (Varianten; die Entscheidung bleibt), `mobil-h5-mehr-auswertung-region-mein-hof.html` und `web-h1-einstellungen-konditionen.html` (ohne Board, überholt).
