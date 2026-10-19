# README-Zeilen · Lauf 17 · Stand 19.10.2026

Diese Datei arbeitet der Doku-PR von Lauf 17 in `docs/mockups/README.md` ein und löscht sie danach.

## Im Abschnitt SYSTEM anhängen

| `system-h1-angemeldete-geraete.html` | Lauf 17 · Angemeldete Geräte: Konto und Sicherheit am Handy und am Computer mit „Angemeldete Geräte“ (einzeln oder „Alle anderen abmelden“), Blatt zum Bestätigen, Mail „Neue Anmeldung bei deinem Hof-Konto“, Seite „Das warst nicht du?“ mit Knopf und Seite danach, Code-Anmeldung „Zu viele falsche Codes“; Regeln | `/settings/account`, Mail, `/sicherheit/nicht-ich` (neu), `/account/login` | neu (Nr. 112, 114) | 2400×2140 |
| `system-k2-gruendung-abzeichen.html` | Aktion 100 · Abzeichen „Gründungshof“: drei Wege verglichen (A Etikett empfohlen), Lagen des Etiketts (dunkel, hell, auf Foto, Fokus), Hofseite am Handy mit Etikett und Erklär-Blatt, Höfe-Liste am Handy und am Computer, Hofseite am Computer mit Sprechblase, Heute-Karte und Schalter „Abzeichen zeigen“ für den Hof, Teilen-Bild mit Etikett; Regeln | `/<slug>`, `/hoefe`, `/settings/konditionen`, Teilen-Bild der Hofseite | neu (Nr. 116, K2 ergänzt) | 2500×3060 |

## Im Abschnitt ADMIN anhängen

| `system-admin-anmeldung-passkey.html` | Admin · Anmelden nur mit Passkey: Seite `/login/admin` mit Knopf „Mit Passkey anmelden“ (den QR-Code fürs Handy zeigt der Browser, nicht Agrilo), Bestätigung am Handy, frische Bestätigung bei heiklen Aktionen, Pflichtseite beim ersten Mal (nur mit Passwort und frischem E-Mail-Code, 24 Stunden nach Vergabe des Rechts), Ersatzcodes, Einstellungen › Anmeldung; Schritt 7 gehört zu Lauf 18 | `/login/admin` (neu), `/admin` (Pflichtseite), `/admin/einstellungen/anmeldung` (neu) | neu (Nr. 115) | 2380×2560 |

## Im Abschnitt GRÜNDUNGSHÖFE ändern

- Kopftext ergänzen: „Seit Lauf 17 (Nr. 116) gilt die Aktion „100 Gründungshöfe“: 100 Plätze, Hofladen 24 Monate ohne Grundgebühr ab dem späteren von Tarifstart und Freischaltung, Stichtag „Aktion bis“, Zähler erst ab 10 vergebenen Plätzen. Die Bausteine behalten ihre Form; die Zahlen und Sätze kommen aus `GRUENDUNG_TEXT` (Wortlaut in freigabe.md §21). Das Abzeichen zeigt `system-k2-gruendung-abzeichen.html`.“
