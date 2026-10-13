## LAUF 13 (Canvas, 13.10.2026) – Postfach Stufe 1, Ortssuche, Titelbild

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `admin-postfach.html` | Admin · Postfach mit drei Reitern: Unterhaltungen (Antworten der Höfe auf Rundschreiben, rechts der Faden mit Antwortfeld), Meldungen (der bisherige „Briefkasten“ `/admin/meldungen` zieht als Reiter ein), Rundschreiben | `/admin/postfach` (neu; `/admin/meldungen` → Reiter Meldungen) | Neu | 1440×1000 |
| `admin-rundschreiben.html` | Admin · Postfach › Reiter Rundschreiben: Gesendet mit Lesequote, Neues Rundschreiben (Empfänger alle/ausgewählte/Filter, Art Info/Wichtig, Link, „auch per E-Mail“ nur für Betriebsmitteilungen, Vorschau „So sieht’s der Hof“) | `/admin/postfach/rundschreiben` (neu) | Neu | 1440×1060 |
| `mobil-h6-postfach.html` | H6 · Postfach (Handy): Nachrichten vom FarmerZone-Team, je Nachricht ein Faden, Filter Alle/Ungelesen, Marke Wichtig, „Du hast geantwortet“ | `/postfach` (neu, Hauptpunkt nach Bestellungen) | Neu | 390×844 |
| `mobil-h6-unterhaltung.html` | H6 · Nachricht vom Team mit Antworten: Team-Blase mit Wichtig und Link-Knopf, Antwort des Hofs, Antwort des Teams, Eingabefeld „Antwort an das Team“ | `/postfach/[id]` (neu) | Neu | 390×844 |
| `mobil-h3-heute-post-karte.html` | H3 · Heute: ungelesene Nachricht vom Team direkt lesbar – Titel, Text, Link, „Antworten“, „Gelesen“; ganz oben in der Hauptspalte, nur bei Ungelesenem | `/dashboard` | Umbau | 390×470 |
| `system-h0-navigation-postfach.html` | H0 · Navigation: Postfach als Hauptpunkt nach „Bestellungen“ (Seitenleiste im Browser, ganz oben im Mehr-Blatt am Handy, Zähler) | Seitenleiste, Mehr-Blatt | Umbau | 1000×560 |
| `system-k1-ortssuche-zustaende.html` | K1 · Ortssuche nach dem Fix: PLZ+Ort in einem, mehrere Orte zur Wahl, Standort nur ungefähr (Hinweis + GPS-Nachfrage) | `/hoefe` | Fix (Ortssuche) | 1000×560 |
| `system-k2-titelbild-computer.html` | K2 · Titelbild der Hofseite am Computer: Querformat füllt mit Fokuspunkt, Quadrat und Hochformat stehen ganz mit weichem Rand; Höhe 300/360/420 px nach Breite, ab 1 920 px nicht weiter aufgezogen | `/[farmSlug]` | Fix (Nr. 89) | 1440×1500 |

Wortliste (gilt für alle Oberflächen, Admin und Hof): **Postfach** = der eine Ort, an dem alles ankommt; **Nachricht** = ein Eintrag; **Rundschreiben** = eine Nachricht vom Team an viele Höfe; **Unterhaltung** = der Faden aus Nachricht und Antworten; **Meldung** = Fehler, Wunsch oder Frage an das Team. Nicht mehr: Briefkasten, Post, Chat, Mitteilung, Benachrichtigung. Bestehende Admin-Mockups (`admin-hoefe`, `admin-meldungen`, `admin-meldung-detail`, `admin-finanzen`, `mobil-admin`) wurden im Canvas entsprechend umbenannt; im Repo ändert sie der Lauf, der das Admin-Postfach baut.

Geparkt (Konzept und Mockups in claude/lauf13-vormerkung.md, Bau nach Signal): Unterhaltungen zwischen Höfen („Frage stellen“, Tarifregel, Lebenslauf, Aufbewahrung), Anzeige im Umkreis, Startseite gestalten.
