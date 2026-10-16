# README-Zeilen · Lauf 16 · Stand 16.10.2026

Diese Datei arbeitet der Doku-PR von Lauf 16 in `docs/mockups/README.md` ein und löscht sie danach.

## Im Abschnitt ADMIN anhängen

| `admin-betrieb.html` | Admin · Betrieb: Warnkarte, Kacheln Bilder · Datenbank · E-Mails heute · Bild-Vorgänge (Wert, Grenze, Balken mit Strich bei 80 %, Trend, was bei 100 % passiert), Verlauf 90 Tage, Tarife und Grenzen, Abläufe mit Herzschlag, Nur im Dashboard, Größte Tabellen, Bilder ohne Verwendung (nur Liste) | `/admin/betrieb` (neu) | neu (Nr. 103; Bilder ohne Verwendung und Aufräumen Nr. 104) | 1440×1812 |
| `mobil-admin-betrieb.html` | Admin am Handy · Betrieb: Warnkarte, Kacheln untereinander, Abläufe, Bilder ohne Verwendung, Verlauf/Tarife/Tabellen/Dashboard aufklappbar | `/admin/betrieb` (Handy) | neu (Nr. 103/104) | 390×2000 |
| `email-betrieb-warnung.html` | Betreiber · Warn-Mails: Grenze erreicht (80 %, 95 %, voll, Entwarnung) und Ablauf überfällig – und wann keine Mail kommt | Mail an die Empfänger aus Postfach › Zustellung | neu (Nr. 103) | 680×930 |
| `admin-postfach-ruhig.html` | Admin · Postfach: Kopf und Reiter auf allen vier Reitern an derselben Stelle, ein Satz für alle, Kennzahlen unter den Reitern nur im Eingang; Regeln: kein Ladebild beim Wechsel, kein Sprung nach oben, Platz für den Rollbalken | `/admin/postfach` (alle Reiter) | Umbau (Nr. 105) – ändert die Reihenfolge in `admin-postfach.html` | 1440×900 |
| `admin-hoefe-gruendung-ausnehmen.html` | Admin · Höfe › Alle: Spalte Gründungshof (Nr. · bis · „ausgenommen · Testhof“), Menü ⋯ mit „Nicht als Gründungshof zählen …“, Bestätigung mit Folgen | `/admin?reiter=alle` | Umbau (Nr. 109, K2 ergänzt; Haken „Testhof oder Zustimmung“ bei Platz) | 1440×1180 |
| `mobil-admin-hoefe-gruendung-ausnehmen.html` | Admin am Handy · Höfe: dieselbe Bestätigung als Blatt | `/admin` (Handy) | Umbau (Nr. 109) | 390×844 |

## Im Abschnitt ADMIN ändern

- Kopftext: „Reiter in der Kopfzeile: Höfe · Postfach · Startseite (neu, Nr. 96) · Finanzen · Einstellungen (neu, Nr. 93).“ → „Reiter in der Kopfzeile: Höfe · Postfach · Startseite · Finanzen · Betrieb (neu, Nr. 103; Punkt bei offener Warnung) · Einstellungen.“ Die älteren Admin-Mockups zeigen noch fünf Reiter; maßgeblich für Reiter und Betriebsleiste ist `admin-betrieb.html`.
- Kopftext: „Einstellungen sind Gruppen (Gründungshöfe · Betrieb · Plattform)“ → „Einstellungen sind Gruppen (Gründungshöfe · Plattform); der Stripe-Modus steht in Admin › Betrieb.“
- Betriebsleiste: rechts ein Hinweis bei offener Warnung („Bilder-Speicher bei 82 % – ansehen“, Link auf `/admin/betrieb`), sonst nichts.
- Zeile `admin-postfach.html`: in der Spalte Arbeit ergänzen „; Reihenfolge Kopf · Reiter · Kennzahlen seit Nr. 105 (`admin-postfach-ruhig.html`)“.
- Zeile `admin-finanzen-jahr.html`: Arbeit „neu (Nr. 100, N15 ergänzt; Regel-Zeile und Zahlen 16.10. an den Code angepasst – jährliche Posten auf zwölf Monate umgelegt)“.
- Zeile `admin-postfach-zustellung.html`: in der Spalte Bildschirm ergänzen „; Art ‚Betrieb‘ fest an (Nr. 103)“.

## Im Abschnitt MOBIL · Kunde – K2 Ansehen anhängen

| `mobil-k2-hofseite-fotos-mosaik.html` | Hofseite am Handy › Übersicht: Fotos als Mosaik (1 groß + 2 klein, „+5 · alle 8 Fotos“) statt Streifen | `/<slug>` (Handy) | Umbau (Nr. 107) – ersetzt den Fotostreifen in `mobil-k2-hofseite.html` | 390×844 |
| `mobil-k2-hofseite-bildansicht.html` | Bildansicht am Handy: Vollbild, „3 / 8“, wischen, Leiste zum Springen, Schließen | `/<slug>` (Bildansicht) | Umbau (Nr. 107) | 390×844 |

## Im Abschnitt SYSTEM anhängen

| `system-k2-hofseite-fotos-varianten.html` | Fotos der Hofseite am Handy: Mosaik (Empfehlung), Karussell mit Zähler, Streifen ohne Balken – mit Regeln für 1, 2 und ab 3 Fotos | – | Entscheidung (Nr. 107) | 1240×740 |
| `system-h1-kundenansicht-handy.html` | Kundenansicht am Handy: heute zwei Leisten, Vorschlag Vollbild-Blatt mit Band „Kundenansicht · Fertig“ und nur der Leiste der Kundschaft | `/farm-page` (Handy, Kundenansicht) | Umbau (Nr. 107, N4 ergänzt) | 960×1090 |
