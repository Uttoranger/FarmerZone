# Betriebshandbuch

Für den Betreiber, der allein ist: Was du täglich, montags und am Monatsende tust, und was du in zehn Notfällen als Erstes tust. Hier stehen keine Kontodaten, keine Schlüssel, keine Namen und keine Adressen — Zugänge gehören in deinen Passwortmanager, nie in dieses Dokument.

Die Namen der Admin-Seiten folgen dem Register N32: **Heute · Höfe · Bestellungen · Postfach · Startseite · Geld · Betrieb · Einstellungen** (am Handy Heute · Höfe · Bestellungen · Postfach · Mehr). Welches Signal wie bei dir ankommt, steht in der **Alarm-Matrix** (`docs/ai/ARCHITECTURE.md`, Admin › Betrieb). Jeder Notfall unten verweist darauf: Dort findest du, ob das Signal als Mail, als Aufgabe in Heute oder nur als Zeile in Betrieb kommt.

## Routinen

### Täglich (2 Minuten, Heute)

1. **Heute** öffnen. Oben steht die Liste „Braucht dich“ aus allen Quellen, sortiert nach Frist. Sie hat keinen eigenen Zustand: Was erledigt ist, verschwindet von selbst, du hakst nichts ab.
2. Ist die Liste leer, bist du fertig.
3. Sonst von oben nach unten: Jeder Eintrag nennt Frist und „Was tun“. Die Quellen sind Höfe warten auf Freischaltung, Erstattung offen, Mail gescheitert oder hängt, neue Meldung, Warnung des Betriebs, Abweichung beim Geld, Notbremse aktiv und Uptime-Dienst still.
4. Was du heute nicht schaffst, lässt du stehen. Die Frist am Eintrag sagt dir, wann es spätestens dran ist.
5. Ist die Notbremse aktiv („Bestellungen angehalten“), entscheide heute, ob sie weg kann (Notfall 2).

### Montag (10 Minuten)

Die Wochenlage kommt montags früh per Mail (siehe unten). Lies sie zuerst, dann die fünf Punkte aus dem Board in Heute („Montags-Routine“):

1. **Braucht dich leer oder geplant:** Jeder Eintrag ist erledigt, oder du hast einen Tag, an dem du ihn erledigst.
2. **Höfe ohne Abholzeit angeschrieben:** Ein Hof ohne Abholzeit kann nichts verkaufen. Schreib jedem über das Postfach ein paar Worte.
3. **Sentry: neue Fehler angesehen.** Neue Fehler, die kein bekannter Zustand sind, ansehen; ein Fehler, der Geld oder Bestellungen betrifft, ist heute dran.
4. **Geld: Woche mit der Stripe-Auszahlung abgeglichen.** Admin › Geld: Stimmen die Bestellungen der Woche mit dem, was Stripe ausgezahlt hat? Eine Abweichung steht auch in Heute.
5. **Betriebshandbuch: ein Notfall gelesen.** Jede Woche einer, in der Reihenfolge unten. Nach zehn Wochen kennst du alle.

**Die Wochenlage (Mail, Montag früh).** Sie ersetzt den früheren Wochenbericht und nennt die Zahlen der letzten 7 Tage:

- Bestellungen und Umsatz der Höfe (ohne stornierte Bestellungen, ohne Testhöfe, ohne Testzahlungen vor dem Stichtag der Live-Schaltung)
- Servicegebühr, wie sie Admin › Geld zählt (eingezogen oder bei Abholung geschuldet), dazu in Klammern, was noch erwartet wird
- neue Höfe
- offene Aufgaben im Postfach, davon überfällig (Meldungen, die länger als 14 Tage offen liegen)
- Fehlermeldungen der Woche
- Kosten des laufenden Monats aus den Kostenposten

Die Mail trägt nur Zahlen: keine Namen, keine Adressen, keine Texte von Meldungen. Die Stripe-Gebühren stehen erst darin, wenn Admin › Geld sie zeigt. Wer die Mail bekommt und ob sie an ist, stellst du in Postfach › Zustellung (künftig Einstellungen › Benachrichtigungen) ein. Darunter steht wie bisher der Stand des Postfachs mit der Zahl der aufgeräumten Meldungen.

### Monatsende (Geld)

1. Admin › Geld, den Monat wählen. **Einnahmen:** Servicegebühr online (eingezogen) und vor Ort bezahlt (geschuldet) getrennt ansehen; was „erwartet“ ist, kann noch wandern.
2. **Kosten:** Stimmen die Kostenposten (Tarife von Vercel, Supabase, Resend, Domain)? Ein neuer Tarif oder das Ende eines Abos gehört vor dem Monatsabschluss eingetragen. Resend rechnet ab dem 17. jedes Monats, nicht im Kalendermonat.
3. **Stripe:** Abgleich des Monats mit den Auszahlungen und den Stripe-Gebühren (Admin › Geld), Abweichungen klären, dann den Monat abschließen.
4. **Offene Erstattungen:** Postfach und Heute müssen frei von „Erstattung offen“ sein, bevor du den Monat abschließt.
5. **Vercel-Ausgaben** in Admin › Betrieb ansehen: Liegt der Monat über deiner Erwartung, in Vercel › Spend Management nachsehen, was die Kosten treibt.
6. Ab dem Stichtag der Plattformgebühr (1.2.2027) kommen die Monatsabrechnungen der Barzahlungen dazu; wie, steht dann in Admin › Geld.

## Notfälle

Jeder Notfall hat die drei Teile Erkennen · Sofort · Danach und verweist auf die Alarm-Matrix.

Grundregeln für alle:

- **Erst ruhig ansehen, dann handeln.** Fast nichts hier ist in der ersten Minute verloren, außer die 72 Stunden bei einer Datenpanne und eine falsche Abbuchung, die weiterläuft.
- **Eine gültige Bestellung wird nie zurückgerollt**, weil etwas daneben ausfällt (Mail, Auswertung). Zahlungen und Bestellungen reparierst du vorwärts, nie rückwärts.
- **Nichts am Betrag von Hand ändern.** Erstattet wird über den Storno-Weg der App oder in Stripe, nie über eine geänderte Zahl.
- **Jeder Eingriff steht im Admin-Protokoll** (Betrieb). Schreib dir das Wichtigste trotzdem mit Uhrzeit in eine eigene Notiz, solange du mittendrin bist.
- **Ein Passkey-Dialog ist normal:** Notbremse, Sperre und Notfall-Storno verlangen eine frische Bestätigung mit Passkey (höchstens 5 Minuten alt).

### 1. Seite nicht erreichbar

#### Erkennen

- Der Uptime-Dienst meldet „down“ (Mail oder Push), oder in Heute steht „Uptime-Dienst still“. Die Alarm-Matrix zeigt, welches Signal zuerst kommt.
- Eine Kundin oder ein Hof schreibt, dass nichts lädt.
- Prüfe selbst: `/api/gesund` im Browser öffnen. Es antwortet nur „ok“ oder mit 503.

#### Sofort

1. Antwortet `/api/gesund` mit 503, ist die Seite da, aber die Datenbank nicht: weiter bei Notfall 5.
2. Antwortet nichts: Statusseite von Vercel ansehen. Ist dort eine Störung, kannst du nur warten und dokumentieren.
3. Keine Störung bei Vercel: Vercel › Projekt › Deployments. Ist das letzte Production-Deployment fehlerhaft oder kurz vor dem Ausfall entstanden, weiter bei Notfall 4 (Instant Rollback).
4. Domain und DNS ansehen (Domain-Anbieter, Vercel › Domains): Läuft die Domain noch, zeigt sie noch auf Vercel, ist das Zertifikat gültig?
5. Ruf die Seite auch vom Handy im Mobilfunknetz auf. So erkennst du, ob nur dein eigener Zugang spinnt.

#### Danach

- Bestätige im Uptime-Dienst, dass er wieder „up“ meldet, und sieh in Betrieb nach, dass der Herzschlag „von außen“ wieder läuft.
- Dauerte es länger als eine Stunde: Rundschreiben an die Höfe mit einem Satz, was war.
- Schreib Uhrzeit, Ursache und was geholfen hat in deine Notizen.

### 2. Stripe gestört (Notbremse)

#### Erkennen

- Kundinnen können nicht online bezahlen, oder die Kasse zeigt einen Fehler bei „Online bezahlen“.
- In Betrieb oder Heute steht eine Warnung zu Stripe; Stripe selbst zeigt auf seiner Statusseite eine Störung. Die Alarm-Matrix nennt die Signale.
- Ein einzelner Hof, dessen Konto Stripe nicht mehr kennt oder pausiert, zeigt in seinem Heute „Online-Zahlung ist pausiert“. Das ist die Notbremse des einzelnen Hofs und kein Notfall der Plattform.

#### Sofort

1. Statusseite von Stripe ansehen. Ist es dort eine bekannte Störung, brauchst du nichts abzuschalten: Barzahlung bei Abholung bleibt möglich, und eine abgebrochene Zahlung legt keine bezahlte Bestellung an.
2. Nur wenn Bestellungen angenommen, aber nicht richtig verbucht werden, oder Karten doppelt belastet werden: **Bestellungen anhalten** (Notbremse, Admin › Betrieb oder Heute). Du gibst einen Grund, einen Satz für die Kundschaft und das späteste Ende an. Laufende Bestellungen bleiben unberührt.
3. Keine Zahlung von Hand nachbuchen und keinen Betrag in der Datenbank ändern.

#### Danach

- Notbremse wieder lösen, sobald Stripe stabil ist (das Band in Heute zeigt, dass sie aktiv ist; mit Ablauf des Endes löst sie sich selbst).
- In Stripe › Entwickler › Webhooks fehlgeschlagene Ereignisse ansehen und erneut senden lassen. Eine Zahlung, die eine schon stornierte Bestellung trifft, erstattet die App selbst voll und belebt die Bestellung nie wieder.
- Admin › Geld: Abweichung zwischen Bestellungen und Stripe ansehen; offene Erstattungen im Postfach abschließen.

### 3. Resend gestört

#### Erkennen

- Admin › Betrieb › E-Mails zeigt „Braucht dich“: eine wichtige Mail wartet länger als 5 Minuten oder die Warteschlange hängt länger als 15 Minuten. Das Signal steht in der Alarm-Matrix.
- Hohe Quote bei „Abgelehnt“ oder „Spam gemeldet“ in 7 Tagen, oder das Tageslimit des Resend-Tarifs ist erreicht (Betrieb zeigt es mit Warnstufe).
- Eine Kundin schreibt, dass sie keine Bestätigung bekommen hat.

#### Sofort

1. Statusseite von Resend ansehen. Bei einer Störung dort wartest du: Die Mails bleiben in der Warteschlange und gehen nach der Störung hinaus, nichts geht verloren.
2. Ist das Tageslimit erreicht, zählt Resend den Tag ab 0 Uhr UTC: Die Mails gehen danach von selbst. Wenn das öfter passiert, ist der Tarif zu klein.
3. Bestellungen bleiben gültig, auch ohne Mail. Hofseite und Kasse brauchen die Mail nicht.
4. Eine dringende Nachricht an einen Hof geht in der Zwischenzeit über das Postfach der App.

#### Danach

- Nach der Störung in Betrieb › E-Mails prüfen, was „Abgelehnt“ oder gescheitert ist. Mails, die noch nie hinausgingen: **Jetzt schicken**. Mails, die schon hinausgingen: **Nochmal schicken** (bei gesperrten oder verworfenen Mails nicht).
- Steigt die Quote der Ablehnungen, prüfe bei Resend, ob die Absender-Domain noch „verified“ ist.

### 4. Fehlerhafter Deploy (Instant Rollback)

#### Erkennen

- Kurz nach einem Merge auf `main` steigen die Fehler in Sentry, Seiten zeigen Fehlerseiten, oder die Warnung in Betrieb meldet einen Ablauf als überfällig.
- Vercel › Deployments zeigt, welches Production-Deployment seit wann läuft. Die Alarm-Matrix nennt die Signale.

#### Sofort

1. Vercel › Projekt › Deployments, das **letzte gute** Production-Deployment wählen, dann **Instant Rollback**. Das dauert Sekunden und baut nichts neu.
2. Prüfe sofort danach: Startseite, ein Hof, die Kasse bis kurz vor der Bezahlung (nie mit einer echten Bestellung).
3. Der Rollback ändert die Datenbank nicht. Das ist gewollt: Migrationen sind immer Expand, der alte Code läuft auch auf dem neuen Schema. Eine Migration machst du **nie** von Hand rückgängig.
4. Nach einem Rollback übernimmt Vercel neue Deployments von `main` nicht mehr von selbst in die Production. Das ist Absicht und solltest du wissen.

#### Danach

- Den Fehler auf einem eigenen Branch beheben und als eigenen PR mergen, nie direkt auf `main`.
- Danach das neue, gute Deployment in Vercel als Production setzen (Promote) und die automatische Übernahme wieder einschalten.
- Notiere in `DEVELOPMENT.md`, was schiefging und welche Prüfung es hätte fangen müssen.

### 5. Supabase gestört

#### Erkennen

- `/api/gesund` antwortet mit 503, Seiten zeigen Fehler beim Laden, Bestellungen scheitern beim Speichern.
- Betrieb zeigt die Datenbank ab 80 Prozent der Grenze als Warnung; ein überfälliger Ablauf deutet auf eine Datenbank, die nicht antwortet. Die Alarm-Matrix nennt die Signale.

#### Sofort

1. Statusseite von Supabase ansehen und im Supabase-Dashboard, ob das Projekt läuft (nicht pausiert), ob der Speicher voll ist und ob die Verbindungen ausgeschöpft sind.
2. Bei einer Störung bei Supabase wartest du. Eine Bestellung wird in einer Transaktion gespeichert: Sie ist ganz da oder gar nicht, Teilbestellungen gibt es nicht.
3. Die Notbremse („Bestellungen anhalten“) nur, wenn die Seite halb funktioniert und du Kundinnen vor einer Fehlermeldung nach der Bezahlung schützen willst.
4. **Keine Wiederherstellung auf Verdacht.** Eine Sicherung zurückspielen überschreibt Bestellungen, die danach entstanden sind. Sie kommt nur bei echtem Datenverlust in Frage, und dann zuerst in ein neues Projekt (siehe Restore-Probe).

#### Danach

- In Heute und Postfach nachsehen: Erstattungen offen, Zahlungen ohne Bestellung (Admin › Geld, Abgleich mit Stripe).
- Lief der Speicher voll, in Betrieb nachsehen, was die größten Tabellen sind, und das Aufräumen laufen lassen.
- Schreib in deine Notizen, ob Daten fehlen könnten; wenn ja, ist das möglicherweise eine Datenpanne (Notfall 6).

### 6. Datenpanne (72 Stunden, Meldung an die Datenschutzbehörde)

Dieses Kapitel nennt nur Ablauf und Fristen. Es ist keine Rechtsauskunft; bei der Bewertung, ob eine Meldung nötig ist, holst du dir Rat.

#### Erkennen

- Personenbezogene Daten sind verloren gegangen, an Unbefugte gelangt oder wurden verändert. Beispiele: ein Zugang zu Datenbank, Vercel oder Stripe ist in falsche Hände geraten, eine Datei mit Kundendaten wurde verschickt, ein öffentliches Repository enthielt Echtdaten.
- Hinweise kommen von Sentry, vom Anbieter (Mail von Supabase, Vercel, Resend oder Stripe), von einer Kundin oder von einem Hof. Die Alarm-Matrix nennt, was dich automatisch erreicht.

#### Sofort

1. **Uhr starten.** Die Frist für die Meldung an die Aufsichtsbehörde beträgt 72 Stunden ab dem Moment, an dem du von der Panne weißt (Art. 33 DSGVO). Notiere Datum und Uhrzeit.
2. **Eindämmen:** Zugänge sperren und Schlüssel erneuern (Stripe, Supabase, Resend, Vercel, GitHub), Passkeys des betroffenen Kontos entziehen, betroffene Sitzungen beenden. Beweise nicht löschen.
3. **Festhalten**, ohne selbst neue Kopien der Daten anzulegen: Was ist passiert, welche Arten von Daten, wie viele Personen ungefähr, seit wann, wie entdeckt, was hast du getan.
4. **Bewerten:** Besteht ein Risiko für die betroffenen Personen? Wenn ja, ist die Meldung an die Datenschutzbehörde (online auf deren Webseite) innerhalb der 72 Stunden fällig. Hältst du ein Risiko für unwahrscheinlich, dokumentierst du das trotzdem schriftlich.
5. Ist das Risiko **hoch**, sind die betroffenen Personen **unverzüglich** zu benachrichtigen (Art. 34 DSGVO), mit klaren Worten, was passiert ist und was sie tun können.

#### Danach

- Lagen die Daten bei einem Anbieter, melde die Panne auch dort und lass dir sagen, was er weiß.
- Dokumentiere jede Panne, auch die nicht meldepflichtigen, in einer eigenen Liste (Art. 33 Abs. 5 DSGVO): Was, wann, Bewertung, Maßnahmen.
- Behebe die Ursache (Rechte, Schlüssel, Prüfung), trage sie in `DEVELOPMENT.md` ein und mache aus dem Fall eine Prüfung im Test.
- Lies die Datenschutzerklärung auf Stimmigkeit.

### 7. Passkey verloren (Ersatzcodes)

#### Erkennen

- Du kommst auf `/login/admin` nicht mehr herein: Das Gerät mit dem Passkey ist weg, kaputt oder zurückgesetzt. Passwort und E-Mail-Code reichen für ein Admin-Konto mit Passkey nicht mehr. Die Alarm-Matrix zeigt, dass dies kein automatisches Signal auslöst: Du merkst es selbst.
- Ein fremder Anmeldeversuch zeigt die Mail „Neue Anmeldung“ mit dem Link „Das war ich nicht“.

#### Sofort

1. **Mit einem Ersatzcode anmelden:** auf `/login/admin` die Anmeldung mit Ersatzcode wählen. Du hast 10 Stück, jeder gilt nur einmal. Die Bremse erlaubt nur wenige Versuche je Stunde.
2. Nach dem Ersatzcode hast du 15 Minuten Zeit, **genau einen neuen Passkey** anzulegen (in den Sicherheitseinstellungen deines Kontos). Vorher geht nichts anderes.
3. Verlorenes Gerät: Unter „Angemeldete Geräte“ alle Sitzungen beenden und den alten Passkey entfernen.
4. Der Ersatzcode, den du benutzt hast, ist verbraucht. Erzeuge neue Ersatzcodes und lege sie in den Passwortmanager (nicht in lose Notizen, nicht ungeschützt in die Cloud).

#### Danach

- Hast du **keinen** Ersatzcode und **keinen** Passkey mehr, bleibt nur das Verfahren wie bei der Vergabe des Rechts: Das Admin-Recht wird im Supabase-Dashboard per SQL neu vergeben, `adminSeit` wird dabei auf jetzt gesetzt. Dann hast du 24 Stunden, mit Passwort UND frischem E-Mail-Code einen neuen ersten Passkey anzulegen. Kommst du selbst nicht mehr hinein, nimm dafür die Vertretung (Notfall 9).
- Lege **zwei Passkeys auf zwei Geräten** an und bewahre die Ersatzcodes getrennt vom Gerät auf.
- Sieh im Protokoll (Betrieb) die Anmeldungen der letzten Tage an, ob jemand anderes drin war. War das der Fall: Notfall 6.

### 8. Falsche Abbuchung bei einer Kundin

#### Erkennen

- Eine Kundin meldet eine doppelte, zu hohe oder unberechtigte Abbuchung (Postfach, Meldung, Mail an den Support).
- In Heute steht „Abweichung beim Geld“ oder „Erstattung offen“. Die Alarm-Matrix zeigt, welche Abweichungen von selbst auffallen.

#### Sofort

1. Bestellung in Admin › Bestellungen über die Bestellnummer suchen. Zahlstatus, Betrag, Servicegebühr und Verlauf ansehen; die volle Adresse der Kundin öffnest du nur mit Grund (das steht im Protokoll).
2. In Stripe die Zahlung zur Bestellung ansehen. Stimmt der Betrag in Stripe mit der Bestellung überein? Wurde zweimal abgebucht?
3. **Echte doppelte oder falsche Abbuchung:** Erstattung über den Storno-Weg der App (der Hof storniert, oder du stornierst als Notfall-Storno mit Grund). Er erstattet, stellt den Bestand wieder her und schreibt die Mail. Wurde schon in Stripe von Hand erstattet, dort nicht doppelt: In der Bestellung „Außerhalb erstattet“ vermerken (die App ruft Stripe dabei nie auf).
4. Antworte der Kundin am selben Tag mit einem Satz: Wir haben es gesehen, das Geld kommt zurück, es dauert bei der Bank einige Tage.

#### Danach

- Nach der Erstattung steht die Bestellung nicht mehr in „Erstattung offen“. Prüfe das in Heute.
- Hat die Kundin bei ihrer Bank widersprochen (Rückbuchung), erscheint ein Einspruch in Stripe mit einer Antwortfrist: Antworte dort, bevor sie abläuft, und erstatte nicht zusätzlich.
- Ist der Fehler ein Fehler der App (zu hoher Betrag, doppelte Gebühr), ist das ein Geld-Fund: Betrag nicht von Hand ändern, sondern mit Bestellnummer als Fehler melden und mit Test beheben lassen.
- Schreib Bestellnummer, Ursache und Ergebnis in deine Notizen.

### 9. Vertretung und Notfallzugang

#### Erkennen

- Du bist krank, im Urlaub oder nicht erreichbar, und etwas Dringendes liegt an (Notfall 1 bis 8, 10).
- Oder umgekehrt: Du richtest die Vertretung vorsorglich ein. Das tust du, bevor du sie brauchst. Die Alarm-Matrix zeigt, dass die Signale an alle Empfänger der Zustellung gehen; trag die Vertretung dort ein.

#### Sofort

1. Die Vertretung bekommt ein **eigenes** Admin-Konto mit eigenem Passkey und nur den Rechten, die sie braucht (Einstellungen › Team). Zugänge werden nie geteilt, auch nicht auf Zeit.
2. Für die Dienste außerhalb der App (Vercel, Supabase, Stripe, Resend, GitHub, Domain-Anbieter) legst du im Passwortmanager einen **Notfallzugang** an: Eine Person deines Vertrauens kann nach einer Wartezeit auf die Einträge zugreifen. Die Zugangsdaten selbst stehen in keiner Datei, nicht hier und nicht im Chat.
3. Die Vertretung bekommt dieses Handbuch und die Alarm-Matrix, dazu die Liste, wen sie anrufen darf (Anbieter-Support, Anwältin).
4. Sag der Vertretung, was **nicht** zu tun ist: keine Beträge ändern, nichts löschen, keine Migration, keine Zugänge weitergeben. Im Zweifel die Notbremse („Bestellungen anhalten“) statt eines Eingriffs.

#### Danach

- Nach einem Einsatz der Vertretung im Protokoll nachlesen, was sie getan hat, und die Rechte wieder auf das Nötige zurücknehmen.
- Teste die Vertretung einmal im Jahr: Anmeldung am Admin-Konto, Heute öffnen, die Notbremse ansehen (nicht auslösen).
- Trag ein, wann ihr das Handbuch zuletzt gemeinsam gelesen habt.

### 10. Hof missbraucht die Plattform (Sperre)

#### Erkennen

- Meldungen von Kundinnen oder anderen Höfen über Betrug, nicht gelieferte Ware, rechtswidrige Inhalte oder verbotene Produkte.
- Auffälligkeiten in Heute oder in der Akte des Hofs (viele Stornos, Einsprüche bei Stripe, Hinweise im Postfach). Die Alarm-Matrix nennt, was dich automatisch erreicht.

#### Sofort

1. Öffne die Akte des Hofs (Admin › Höfe). Sieh dir Bestellungen, Stripe-Stand und Postfach-Verlauf an. Nur prüfen, nichts löschen.
2. **Hof sperren** (Akte), mit Grund und frischer Bestätigung mit Passkey. Das stoppt neue Bestellungen mit einem neutralen Satz für die Kundschaft und sagt es dem Hof im Postfach. Anders als die Pause kann der Hof die Sperre nicht selbst aufheben.
3. **Laufende Bestellungen** einzeln ansehen: Was nicht erfüllt werden kann, stornierst du vor der Abholung als Notfall-Storno mit Grund; der Hof bekommt eine Nachricht, die Kundin die Erstattung und eine Mail.
4. Bei Verdacht auf Betrug mit Zahlungen den Hof in Stripe prüfen und Stripe informieren.

#### Danach

- Schreib dem Hof im Postfach sachlich, was der Grund ist und was er tun kann (Frist, Ansprechpartner). Keine Anschuldigungen.
- Rechtswidrige Inhalte nimmst du erst heraus, wenn du sie gesichert hast (Bildschirmfoto ohne Kundendaten). Bei strafbaren Inhalten hol dir Rat, ob eine Anzeige nötig ist.
- Hebe die Sperre erst auf, wenn die Ursache geklärt ist, ebenfalls mit Grund im Protokoll.
- Prüfe, ob der Fall eine Regel verdient (Freischaltungsprüfung, Hinweis in den Bedingungen).

## Restore-Probe (vierteljährlich, Supabase Pro, tägliche Sicherung)

Eine Sicherung zählt erst, wenn du sie einmal zurückgespielt hast. Supabase Pro sichert die Datenbank täglich und hält die Sicherungen einige Tage. Einmal im Quartal (Jänner, April, Juli, Oktober, zum Beispiel am ersten Montag) machst du diese Probe. Die Menüs bei Supabase können sich ändern; gilt eine Bezeichnung hier nicht mehr, gilt die Hilfe von Supabase zu „Backups“ und „Restore to a new project“.

**Wichtig: Spiele nie über das laufende Projekt zurück.** Die Probe geschieht immer in einem **neuen** Projekt, das du danach löschst.

1. Supabase › Projekt › Database › Backups. Prüfe, dass es Sicherungen der letzten Tage gibt und dass die jüngste nicht älter als einen Tag ist. Fehlt sie: sofort Notfall 5 und den Support von Supabase anschreiben.
2. Lege aus der jüngsten Sicherung eine Kopie an, **in ein neues Projekt** (Funktion „Restore to a new project“). Das kann einige Minuten bis Stunden dauern.
3. Prüfe in der Kopie (Table Editor oder SQL-Editor, nur lesen):
   - Die Tabellen sind da, die Zahl der Bestellungen, Höfe und Nutzer ist in der richtigen Größenordnung.
   - Die jüngste Bestellung ist nicht jünger als die Sicherung und nicht viel älter.
   - Keine Zeile ist halb leer.
4. Schreib das Ergebnis in deine Notizen: Datum, Alter der Sicherung, Dauer der Wiederherstellung, Zahl der Bestellungen in der Kopie.
5. **Lösche das neue Projekt** wieder. Es enthält echte Kundendaten und darf nicht liegen bleiben. Prüfe, dass es aus der Projektliste verschwunden ist.
6. Dauerte es länger als gedacht oder fehlte etwas: Notiere, was du im Ernstfall anders machen würdest, und ergänze dieses Kapitel.

Wenn du im Ernstfall wirklich zurückspielen musst: Entscheide zuerst, wie viel Zeit seit der Sicherung vergangen ist. Alles, was danach entstand (Bestellungen, Zahlungen), fehlt in der Sicherung und muss aus Stripe und den Mails nachgezogen werden. Das ist ein Fall für die Datenpanne (Notfall 6) und für eine ruhige Stunde mit Notizen, nicht für Eile.

## Uptime-Dienst einrichten

Die Seite selbst prüft ein Dienst von außen über `/api/gesund`. Die Route antwortet nur mit „ok“ oder mit 503 und enthält keine Daten. Jeder Aufruf hinterlässt höchstens einmal je Minute einen Herzschlag; fehlt er länger als 30 Minuten, steht in Heute die Aufgabe „Uptime-Dienst still“. Das richtest du einmal selbst ein; kein Agent und kein Test tut es.

Zwei Dienste sind geeignet, der kostenlose Tarif reicht: **UptimeRobot** oder **Better Stack**. Die Schritte sind bei beiden gleich, die Bezeichnungen der Felder weichen leicht ab.

1. Konto beim Dienst anlegen. Die Zugangsdaten gehören in den Passwortmanager, nirgendwo sonst hin. Schalte für das Konto eine Zwei-Faktor-Anmeldung ein.
2. **Neuen Monitor** anlegen, Art **HTTP(S)**.
3. Adresse: die Hauptadresse der Seite mit dem Pfad `/api/gesund`.
4. Methode GET, **erwartet: Status 200**. Bei 503 oder keiner Antwort soll der Monitor „down“ werden. Optional prüft er, dass die Antwort „ok“ enthält.
5. **Prüfabstand** so kurz wie der Tarif erlaubt, höchstens 5 Minuten. Der Dienst soll erst nach zwei Fehlversuchen in Folge alarmieren, damit ein einzelner Aussetzer keinen Alarm auslöst.
6. **Benachrichtigung:** Mail an eine Adresse, die du auch am Handy liest, dazu die Push-Meldung der App des Dienstes. Trag, wenn der Dienst es erlaubt, die Vertretung (Notfall 9) als zweite Empfängerin ein.
7. **Probe:** Stelle den Monitor kurz auf einen Pfad ein, den es nicht gibt (zum Beispiel `/api/gesund-probe`). Der Alarm muss in wenigen Minuten ankommen. Dann stelle ihn zurück und sieh, dass er wieder „up“ meldet.
8. In Admin › Betrieb prüfen, dass der Herzschlag „von außen“ jetzt Aufrufe zählt.
9. Trag in deine Notizen ein, wann du den Dienst eingerichtet hast und wer die Alarme bekommt.
