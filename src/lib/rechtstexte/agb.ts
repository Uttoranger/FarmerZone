/**
 * Die AGB als Daten (Register O4, Nr. 90) — der Text von /agb.
 *
 * Quelle ist docs/recht/agb.md (Fassung 0.9, Entwurf, 13.10.2026): Der Wortlaut
 * ist von dort wörtlich übernommen, Absatz für Absatz. Änderungen am Wortlaut
 * macht nur die Projektleitung nach der anwaltlichen Prüfung, nie ein Lauf —
 * zuerst in der Markdown-Datei; tests/agb-text.test.ts liest sie bei jedem
 * Lauf und vergleicht Zeile für Zeile mit diesen Daten, damit beide nicht
 * auseinanderlaufen.
 *
 * Was von der Quelle abweicht, ist technisch und ändert kein Wort:
 *  - Name und Domain stehen als MARKE und PRODUKTION_HOST (Register M1;
 *    tests/marke-name-wache.test.ts lässt beides unter src/ nur dort zu).
 *  - Die zwei Platzhalter „[Betreiber laut Impressum …]" und „[E-Mail laut
 *    Impressum]" sind Stücke (BETREIBER, E_MAIL), die die Seite aus den
 *    Konstanten des Impressums füllt (src/lib/rechtstexte/stuecke.ts).
 *  - Links sind Daten (`link`), kein Markdown.
 *  - „Kurz erklärt" steht als Einleitung über den AGB und ist kein Teil von
 *    ihnen. Die „Hinweise für die anwaltliche Prüfung" bleiben in der
 *    Markdown-Datei; sie gehören nicht auf die Seite.
 *
 * Als wörtlicher Rechtstext steht die Datei in den Ausnahmen der Wachen, die
 * jeden Text unter src/ lesen: der Wortliste (je Datei, AUSNAHME_DATEIEN), der
 * Fachwort-Wache („Kennzeichnung“, Punkt 18.2) und der Wache gegen ein zweites
 * Exemplar der Konditionen („Startphase“, Punkt 17.2). Darum steht hier nur
 * Rechtstext: Die Wörter der Seite drumherum (Knopf, Überschrift des
 * Verzeichnisses) stehen als AGB_SEITE_TEXT in agb-einbindung.ts, wo die Wachen
 * sie lesen.
 */
import { MARKE } from '@/lib/marke'
import { PRODUKTION_HOST } from '@/lib/umgebung'
import { BETREIBER, E_MAIL, fett, kursiv, link, type AgbStueck } from '@/lib/rechtstexte/stuecke'

/** Ein Block im Text eines Punkts. */
export type AgbBlock =
  /** Ein Absatz, meist mit Nummer wie „5.3"; ohne Nummer sind es die Fortsetzung eines Punkts, Punkt 23 und 25 und die Einleitung des Anhangs. */
  | { art: 'absatz'; nummer: string | null; stuecke: readonly AgbStueck[] }
  | { art: 'liste'; eintraege: readonly (readonly AgbStueck[])[] }
  | { art: 'tabelle'; kopf: readonly [string, string]; zeilen: readonly (readonly [string, string])[] }
  /** Zeilen, die untereinander stehen bleiben (das Muster-Formular im Anhang). */
  | { art: 'zeilen'; zeilen: readonly (readonly AgbStueck[])[] }

export type AgbPunkt = { nummer: number; titel: string; bloecke: readonly AgbBlock[] }
export type AgbTeil = { id: 'a' | 'b' | 'c' | 'd'; titel: string; punkte: readonly AgbPunkt[] }
export type AgbKurzErklaert = { titel: string; zusatz: string; punkte: readonly (readonly AgbStueck[])[] }
export type AgbAnhang = { titel: string; bloecke: readonly AgbBlock[] }

function absatz(nummer: string | null, ...stuecke: AgbStueck[]): AgbBlock {
  return { art: 'absatz', nummer, stuecke }
}

function aufzaehlung(...eintraege: AgbStueck[][]): AgbBlock {
  return { art: 'liste', eintraege }
}

function tabelle(kopf: readonly [string, string], zeilen: readonly (readonly [string, string])[]): AgbBlock {
  return { art: 'tabelle', kopf, zeilen }
}

function zeilenblock(...zeilen: AgbStueck[][]): AgbBlock {
  return { art: 'zeilen', zeilen }
}

/** Der Stand-Vermerk unter dem Titel — bis zur Freigabe der Fassung 1.0 (Register O4). */
export const AGB_STAND_VERMERK = 'Fassung 0.9 – Entwurf, Stand 13. Oktober 2026'

/** Die Sprungmarke eines Punkts („punkt-12"); das Inhaltsverzeichnis und die Überschrift nehmen dieselbe. */
export function agbAnker(nummer: number): string {
  return `punkt-${nummer}`
}

export const AGB_ANHANG_ANKER = 'anhang'

/** Die Sprungmarke eines Teils („teil-a"). */
export function agbTeilAnker(id: AgbTeil['id']): string {
  return `teil-${id}`
}

export const AGB_TITEL = `Allgemeine Geschäftsbedingungen (AGB) von ${MARKE}`

export const AGB_KURZ_ERKLAERT: AgbKurzErklaert = {
  titel: 'Kurz erklärt',
  zusatz: 'kein Teil der AGB',
  punkte: [
    [`${MARKE} ist ein Marktplatz: Du kaufst `, fett('direkt beim Hof'), `, ${MARKE} verkauft nichts selbst.`],
    ['Du bestellst online, zahlst online oder bar und holst ', fett('am Hof'), ' ab.'],
    ['Beim Online-Bezahlen kommt eine ', fett('Servicegebühr'), ' dazu (5 %, mindestens 0,50 €, einmal je Bestellung). Du siehst sie, bevor du bestellst.'],
    [fett('Frische Lebensmittel'), ' kannst du nicht zurückgeben – das steht so im Gesetz. Vor der Abholung kannst du stornieren, dann bekommst du alles zurück.'],
    ['Höfe sind ', fett('Unternehmen'), `. Sie sind für ihre Ware verantwortlich; ${MARKE} für die Plattform und die Zahlungsabwicklung.`],
    [`Höfe nutzen ${MARKE} im Tarif `, fett('Hoftor (0 €)'), ' oder ', fett('Hofladen (19 € im Monat, monatlich kündbar)'), '.'],
  ],
}

export const AGB_TEILE: readonly AgbTeil[] = [
  {
    id: 'a',
    titel: 'Teil A – Für alle',
    punkte: [
      {
        nummer: 1,
        titel: 'Wer wir sind, wofür diese AGB gelten',
        bloecke: [
          absatz(
            '1.1',
            `${MARKE} wird betrieben von `,
            fett(BETREIBER),
            ` („${MARKE}“, „wir“). Alle Angaben nach § 5 ECG stehen im `,
            link('Impressum', '/impressum'),
            '.',
          ),
          absatz(
            '1.2',
            `Diese AGB gelten für die Nutzung von ${PRODUKTION_HOST} und der dazugehörigen Dienste durch `,
            fett('Kundinnen und Kunden'),
            ' (Teil B) und durch ',
            fett('Höfe'),
            ' (Teil C). Teil A und Teil D gelten für alle.',
          ),
          absatz(
            '1.3',
            'Abweichende Bedingungen eines Hofs gelten nur für den Kaufvertrag zwischen Hof und Kundschaft, wenn der Hof sie beim Angebot ausdrücklich nennt, und nur, soweit sie dem Gesetz entsprechen. Für die Nutzung der Plattform gelten ausschließlich diese AGB.',
          ),
          absatz(
            '1.4',
            'Die ',
            link('Konditionen für Höfe', '/konditionen'),
            ' (Tarife, Servicegebühr, Abrechnung) sind Teil dieser AGB. Bei Widersprüchen gilt: zwingendes Gesetz vor diesen AGB, diese AGB vor den Konditionen.',
          ),
          absatz(
            '1.5',
            'Wir sprechen alle mit „du“ an. Das ist unser Stil, kein Zeichen von Unverbindlichkeit.',
          ),
        ],
      },
      {
        nummer: 2,
        titel: `Was ${MARKE} ist – und was nicht`,
        bloecke: [
          absatz(
            '2.1',
            `${MARKE} ist eine `,
            fett('Vermittlungsplattform'),
            ' (Online-Marktplatz). Höfe stellen Lebensmittel, Futtermittel und Brennmaterial ein; Kundinnen und Kunden bestellen und holen am Hof ab.',
          ),
          absatz(
            '2.2',
            fett('Der Kaufvertrag kommt ausschließlich zwischen dem Hof und der Kundin bzw. dem Kunden zustande.'),
            ` ${MARKE} ist nicht Verkäuferin, nicht Vertreterin des Hofs und nicht Vertragspartnerin des Kaufvertrags. Das sagen wir dir in der Kasse vor dem Bestellen noch einmal ausdrücklich (§ 4a Abs. 2 FAGG).`,
          ),
          absatz(
            '2.3',
            `Alle Höfe auf ${MARKE} handeln nach ihrer eigenen Erklärung gegenüber uns als `,
            fett('Unternehmer'),
            ' (land- und forstwirtschaftliche Betriebe oder Gewerbebetriebe). Deshalb gelten für Käufe das Konsumentenschutzgesetz und das Fern- und Auswärtsgeschäfte-Gesetz (§ 4a Abs. 1 Z 2 FAGG). Wir prüfen diese Erklärung auf Plausibilität, aber nicht amtlich.',
          ),
          absatz(
            '2.4',
            fett('So sind die Pflichten verteilt'),
            ' (§ 4a Abs. 1 Z 4 FAGG):',
          ),
          tabelle(
            ['Der Hof', MARKE],
            [
              ['Angebot, Preis, Beschreibung, Pflichtangaben zu Lebensmitteln, Futtermitteln und Brennmaterial', 'Betrieb der Plattform (Hofseiten, Bestellung, Postfach)'],
              ['Ware, Menge, Qualität, Hygiene, Kühlkette', 'Zahlungsabwicklung über unseren Zahlungsdienstleister Stripe'],
              ['Abholzeiten, Übergabe, Bestätigung bei Barzahlung', 'Einzug der Servicegebühr'],
              ['Gewährleistung, Rücktritt, Reklamation, Rückzahlung des Warenpreises', 'Rückzahlung der Servicegebühr'],
              ['Rechnung, Steuern, Registrierkasse', 'Hilfe bei Fragen zur Bestellung'],
            ],
          ),
          absatz(
            '2.5',
            `${MARKE} hat keinen Einfluss auf Verfügbarkeit, Qualität und Rechtmäßigkeit der Angebote und prüft sie nicht vorab. Wir entfernen Angebote, wenn wir von Rechtsverstößen erfahren (Punkt 5).`,
          ),
        ],
      },
      {
        nummer: 3,
        titel: 'Reihenfolge der Höfe und Angebote',
        bloecke: [
          absatz(
            '3.1',
            'Auf der Hofübersicht reihen wir Höfe nach ',
            fett('Entfernung'),
            ' zum gewählten Ort oder Standort. Ohne Ort gilt der Zeitpunkt der Freischaltung (neuere Höfe weiter hinten). Innerhalb eines Hofs stehen Produkte in der Reihenfolge, die der Hof festlegt.',
          ),
          absatz(
            '3.2',
            'Filter (Kategorie, Siegel, Suchtext) schränken die Liste ein, verändern aber die Reihenfolge nicht. ',
            fett('Es gibt keine bezahlte Platzierung.'),
            ' Ändert sich das, sagen wir es an der Stelle, an der die Liste steht (§ 4a Abs. 1 Z 1 FAGG, Art. 5 Verordnung (EU) 2019/1150).',
          ),
        ],
      },
      {
        nummer: 4,
        titel: 'Zugang, Konto, Sicherheit',
        bloecke: [
          absatz(
            '4.1',
            fett('Kundinnen und Kunden'),
            ' brauchen kein Konto. Deine Bestellungen findest du über einen Code, den wir an deine E-Mail-Adresse schicken, und über Links in unseren E-Mails. Gib diese Links und Codes nicht weiter.',
          ),
          absatz(
            '4.2',
            fett('Höfe'),
            ' registrieren ein Konto mit Passwort. Nur volljährige, geschäftsfähige Personen dürfen ein Hofkonto anlegen, und nur für einen Betrieb, den sie vertreten dürfen. Du hältst dein Passwort geheim und meldest uns sofort, wenn jemand Fremdes Zugriff hat.',
          ),
          absatz(
            '4.3',
            'Alle Angaben müssen richtig und aktuell sein. Du darfst die Plattform nicht missbrauchen – keine automatisierten Abfragen, kein Umgehen von Sicherheitsmaßnahmen, keine Belastung der Systeme über den normalen Gebrauch hinaus.',
          ),
          absatz(
            '4.4',
            'Wir dürfen die Nutzung begrenzen (etwa die Zahl der Bestellungen oder Nachrichten je Tag), um Missbrauch zu verhindern.',
          ),
        ],
      },
      {
        nummer: 5,
        titel: 'Inhalte, Verhalten, Melden, Maßnahmen',
        bloecke: [
          absatz(
            '5.1',
            'Was Höfe einstellen (Texte, Fotos, Beiträge, Nachrichten) und was Kundinnen und Kunden schreiben (Notizen, Nachrichten), muss ',
            fett('wahr, rechtmäßig und respektvoll'),
            ' sein. Verboten sind insbesondere: irreführende Angaben, Verstöße gegen Lebensmittel-, Futtermittel- oder Wettbewerbsrecht, Inhalte, die Rechte Dritter verletzen (Urheberrecht, Marken, Persönlichkeitsrechte), Beleidigungen, Drohungen, Diskriminierung und Werbung für Dritte.',
          ),
          absatz(
            '5.2',
            fett('Melden.'),
            ' Jede Person kann uns rechtswidrige oder verdächtige Inhalte melden – über „Problem melden“ in der App oder per E-Mail an ',
            fett(E_MAIL),
            '. Wir bestätigen den Eingang, prüfen die Meldung und sagen dir, was wir entschieden haben (Art. 16 Verordnung (EU) 2022/2065).',
          ),
          absatz(
            '5.3',
            fett('Maßnahmen.'),
            ' Verstößt ein Inhalt gegen Gesetz oder diese AGB, können wir ihn entfernen oder ausblenden, ein Angebot aus dem Shop nehmen, ein Hofkonto vorübergehend sperren oder im Wiederholungsfall kündigen. Wir begründen jede Maßnahme gegenüber der betroffenen Person und nennen, worauf sie sich stützt (Art. 17 Verordnung (EU) 2022/2065; Art. 4 Verordnung (EU) 2019/1150). Bei Gefahr im Verzug handeln wir sofort und begründen danach. Gegen eine Maßnahme kannst du dich bei uns beschweren (Punkt 26).',
          ),
          absatz(
            '5.4',
            'Wir lesen Nachrichten zwischen Nutzerinnen und Nutzern nicht mit. Wir sehen eine Nachricht nur, wenn sie uns gemeldet wird oder wenn sie an uns gerichtet ist.',
          ),
        ],
      },
      {
        nummer: 6,
        titel: 'Rechte an Inhalten',
        bloecke: [
          absatz(
            '6.1',
            `Deine Inhalte bleiben deine. Du räumst ${MARKE} das einfache, unentgeltliche, räumlich unbeschränkte Recht ein, sie für den Betrieb der Plattform zu nutzen: anzuzeigen, zu speichern, technisch zu bearbeiten (verkleinern, zuschneiden), als Vorschaubild, Teilen-Bild und QR-Plakat aufzubereiten und in der Suche zu zeigen. Das Recht endet, wenn du den Inhalt löschst, mit Ausnahme von Kopien in Sicherungen und in bereits erstellten Belegen.`,
          ),
          absatz(
            '6.2',
            'Du versicherst, dass du die nötigen Rechte an deinen Inhalten hast, insbesondere an Fotos, auf denen Personen zu sehen sind.',
          ),
        ],
      },
      {
        nummer: 7,
        titel: 'Verfügbarkeit und Weiterentwicklung',
        bloecke: [
          absatz(
            '7.1',
            `${MARKE} läuft im `,
            fett('Pilotbetrieb'),
            '. Wir arbeiten an der Plattform, bauen Funktionen aus und nehmen Wartungen vor. Eine bestimmte Verfügbarkeit sichern wir nicht zu; wir bemühen uns, Ausfälle kurz zu halten und anzukündigen.',
          ),
          absatz(
            '7.2',
            'Wir dürfen Funktionen ändern, ergänzen oder einstellen. Wesentliche Einschränkungen kündigen wir Höfen mindestens 30 Tage vorher an.',
          ),
        ],
      },
    ],
  },
  {
    id: 'b',
    titel: 'Teil B – Für Kundinnen und Kunden',
    punkte: [
      {
        nummer: 8,
        titel: 'Bestellen',
        bloecke: [
          absatz(
            '8.1',
            'Die Angebote auf einer Hofseite sind eine Einladung des Hofs, zu bestellen. Du legst Produkte in den Korb, wählst einen ',
            fett('Abholtermin'),
            ' aus den Abholzeiten des Hofs, gibst Name, E-Mail-Adresse und – wenn der Hof es braucht – Telefonnummer an und wählst die Zahlart.',
          ),
          absatz(
            '8.2',
            'Vor dem Absenden siehst du alles auf einer Seite: Produkte, Preise, Servicegebühr, Gesamtbetrag, Abholtermin, den Hof als deinen Vertragspartner und seine Adresse. Eingaben kannst du bis dahin ändern.',
          ),
          absatz(
            '8.3',
            'Mit dem Knopf ',
            fett('„Zahlungspflichtig bestellen“'),
            ' (bar) bzw. ',
            fett('„Weiter zur Zahlung“'),
            ' und dem Abschluss der Zahlung (online) gibst du eine verbindliche Bestellung an den Hof ab (§ 8 FAGG).',
          ),
          absatz(
            '8.4',
            'Der ',
            fett('Kaufvertrag mit dem Hof'),
            ' kommt zustande:',
          ),
          aufzaehlung(
            ['bei Online-Zahlung, sobald die Zahlung erfolgreich war und wir dir die Bestellung per E-Mail bestätigt haben;'],
            ['bei Barzahlung, sobald du die Bestellung über den Link in unserer E-Mail bestätigt hast und wir dir die Bestellung danach bestätigen.'],
          ),
          absatz(
            '8.5',
            'Den Vertragstext (deine Bestellung und diese AGB in der geltenden Fassung) schicken wir dir per E-Mail; deine Bestellung kannst du außerdem über den Link in der E-Mail jederzeit ansehen (§ 9 und § 11 ECG). Vertragssprache ist Deutsch.',
          ),
          absatz(
            '8.6',
            'Die bestellte Ware wird für dich bis zum Ende des Abholtermins reserviert.',
          ),
        ],
      },
      {
        nummer: 9,
        titel: 'Preise und Servicegebühr',
        bloecke: [
          absatz(
            '9.1',
            'Die Preise legt der Hof fest. Sie verstehen sich in Euro inklusive Umsatzsteuer. Bei Produkten nach Gewicht oder Menge zeigt die Kasse den Grundpreis und die bestellte Menge.',
          ),
          absatz(
            '9.2',
            'Zusätzlich zum Warenpreis fällt bei Online-Zahlung eine ',
            fett(`Servicegebühr an ${MARKE}`),
            ' an: ',
            fett('5 % des Warenwerts, auf den nächsten ganzen Cent aufgerundet, mindestens 0,50 €, einmal je Bestellung.'),
            ` Sie steht vor dem Absenden in der Kasse. Die Servicegebühr ist das Entgelt für die Vermittlung und die Zahlungsabwicklung; sie zahlst du an ${MARKE}, nicht an den Hof.`,
          ),
          absatz(
            '9.3',
            'Ob bei Barzahlung eine Servicegebühr anfällt, steht in der Kasse und auf ',
            link('/konditionen', '/konditionen'),
            '. Derzeit entfällt sie bei Barzahlung.',
          ),
          absatz(
            '9.4',
            'Weitere Kosten – etwa für eine Lieferung – gibt es nur, wenn der Hof sie beim Angebot ausdrücklich nennt.',
          ),
        ],
      },
      {
        nummer: 10,
        titel: 'Bezahlen',
        bloecke: [
          absatz(
            '10.1',
            fett('Online'),
            ': Karte, Apple Pay, Google Pay oder EPS über unseren Zahlungsdienstleister ',
            fett('Stripe Payments Europe, Ltd.'),
            ` Der Warenpreis geht an den Hof, die Servicegebühr an ${MARKE}. Deine Zahlungsdaten verarbeitet Stripe; wir sehen sie nicht.`,
          ),
          absatz(
            '10.2',
            fett('Bar bei Abholung'),
            ': Du zahlst beim Hof. Der Hof kann die Barzahlung ausschließen; dann steht in der Kasse nur die Online-Zahlung.',
          ),
          absatz(
            '10.3',
            'Rückzahlungen erfolgen auf demselben Weg wie die Zahlung.',
          ),
        ],
      },
      {
        nummer: 11,
        titel: 'Abholung',
        bloecke: [
          absatz(
            '11.1',
            'Du holst die Ware zum gewählten Abholtermin am Hof ab. Der ',
            fett('Abholcode'),
            ' in deiner Bestellung hilft dem Hof, die Bestellung zu finden; er ist kein Ausweis und keine Berechtigung.',
          ),
          absatz(
            '11.2',
            'Mit der Übergabe am Hof geht die Gefahr für die Ware auf dich über. Prüfe die Ware bei der Übergabe und sag dem Hof sofort, wenn etwas nicht passt.',
          ),
          absatz(
            '11.3',
            'Holst du die Ware ',
            fett('nicht ab'),
            `, kann der Hof die Bestellung nach Ende des Abholtermins stornieren. Bei Barzahlung entsteht dir dann kein Anspruch auf die Ware; bei Online-Zahlung bekommst du den Warenpreis zurück, wenn der Hof die Ware anderweitig verwenden kann – das entscheidet der Hof nach dem Gesetz. Wer wiederholt bestellt und nicht abholt, kann von ${MARKE} von weiteren Bestellungen ausgeschlossen werden (Punkt 5.3).`,
          ),
        ],
      },
      {
        nummer: 12,
        titel: 'Rücktritt vom Kaufvertrag (Fernabsatz)',
        bloecke: [
          absatz(
            '12.1',
            'Als Verbraucherin oder Verbraucher kannst du vom Kaufvertrag mit dem Hof ',
            fett('innerhalb von 14 Tagen'),
            ' ohne Angabe von Gründen zurücktreten. Die Frist beginnt mit dem Tag, an dem du die Ware erhalten hast (§ 11 FAGG).',
          ),
          absatz(
            '12.2',
            fett('Kein Rücktrittsrecht'),
            ' besteht nach § 18 Abs. 1 FAGG insbesondere bei',
          ),
          aufzaehlung(
            ['Waren, die ', fett('schnell verderben'), ' können oder deren Ablaufdatum schnell überschritten würde – also bei frischen Lebensmitteln wie Fleisch, Milchprodukten, Eiern, Obst, Gemüse, Brot (Z 4);'],
            ['versiegelten Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn die Versiegelung entfernt wurde (Z 5);'],
            ['Waren, die nach deinen Angaben angefertigt oder zugeschnitten wurden (Z 3).'],
          ),
          absatz(
            null,
            'Ob ein Rücktrittsrecht besteht, hängt also von der Ware ab. Haltbare Produkte (zum Beispiel Honig, Mehl, Brennholz, Futter in geschlossener Verpackung) kannst du zurückgeben.',
          ),
          absatz(
            '12.3',
            'Den Rücktritt erklärst du gegenüber dem ',
            fett('Hof'),
            ' (seine Angaben stehen in deiner Bestellung) – formlos oder mit dem Muster-Formular im Anhang. Du kannst ihn auch an uns schicken; wir leiten ihn an den Hof weiter und bestätigen dir den Eingang.',
          ),
          absatz(
            '12.4',
            `Nach einem wirksamen Rücktritt erstattet der Hof den Warenpreis spätestens binnen 14 Tagen; ${MARKE} erstattet die Servicegebühr. Bei Online-Zahlung läuft beides über Stripe auf dein Zahlungsmittel. Die Ware bringst du unverzüglich, spätestens binnen 14 Tagen, zum Hof zurück; die Kosten der Rückgabe trägst du.`,
          ),
          absatz(
            '12.5',
            `Die Vermittlungsleistung von ${MARKE} (Servicegebühr) ist mit der Bestätigung der Bestellung vollständig erbracht. Du stimmst dem ausdrücklich zu und nimmst zur Kenntnis, dass du insoweit kein Rücktrittsrecht hast (§ 18 Abs. 1 Z 1 FAGG). Das betrifft nur die Gebühr für eine ausgeführte Bestellung – bei jedem Storno vor der Abholung und bei jedem Rücktritt bekommst du die Servicegebühr trotzdem zurück (Punkt 13).`,
          ),
        ],
      },
      {
        nummer: 13,
        titel: 'Stornieren vor der Abholung',
        bloecke: [
          absatz(
            '13.1',
            'Bis zum Beginn des Abholtermins kannst du eine Bestellung über den Link in deiner E-Mail ',
            fett('stornieren'),
            '. Auch der Hof kann stornieren, wenn er die Bestellung nicht erfüllen kann; er muss dich darüber informieren.',
          ),
          absatz(
            '13.2',
            'Bei einem Storno vor der Abholung bekommst du bei Online-Zahlung ',
            fett('alles zurück – Warenpreis und Servicegebühr'),
            '. Bei Barzahlung ist nichts zu erstatten.',
          ),
          absatz(
            '13.3',
            'Fehlt bei der Abholung ein Artikel, kann der Hof die Bestellung anpassen; den Preis des fehlenden Artikels bekommst du bei Online-Zahlung zurück.',
          ),
        ],
      },
      {
        nummer: 14,
        titel: 'Gewährleistung und Reklamation',
        bloecke: [
          absatz(
            '14.1',
            'Für die Ware haftet der ',
            fett('Hof'),
            ` nach den gesetzlichen Gewährleistungsregeln (§§ 922 ff. ABGB, Verbrauchergewährleistungsgesetz). ${MARKE} übernimmt keine Gewährleistung für Waren.`,
          ),
          absatz(
            '14.2',
            `Wende dich mit einer Reklamation an den Hof (Adresse und Telefonnummer stehen in deiner Bestellung). Kommst du nicht weiter, hilft dir ${MARKE} über „Problem melden“ oder per E-Mail; wir können vermitteln, aber nicht anstelle des Hofs entscheiden.`,
          ),
        ],
      },
      {
        nummer: 15,
        titel: `Nachrichten von Höfen und von ${MARKE}`,
        bloecke: [
          absatz(
            '15.1',
            'Neuigkeiten eines Hofs (per E-Mail oder WhatsApp) bekommst du nur, wenn du dich dafür angemeldet hast. Du kannst dich jederzeit über den Link in jeder Nachricht oder beim Hof abmelden.',
          ),
          absatz(
            '15.2',
            'E-Mails zu deiner Bestellung (Bestätigung, Erinnerung, Änderung, Storno) sind Teil der Abwicklung und brauchen keine Einwilligung.',
          ),
        ],
      },
    ],
  },
  {
    id: 'c',
    titel: 'Teil C – Für Höfe',
    punkte: [
      {
        nummer: 16,
        titel: 'Aufnahme und Hofkonto',
        bloecke: [
          absatz(
            '16.1',
            'Du registrierst deinen Betrieb mit richtigen Angaben (Betriebsname, Adresse, Kontakt, Rechtsform oder Betriebsart) und erklärst, dass du als ',
            fett('Unternehmer'),
            ' anbietest (Punkt 2.3). Nach der Prüfung schalten wir dein Hofkonto frei; einen Anspruch auf Freischaltung gibt es nicht.',
          ),
          absatz(
            '16.2',
            'Auf deiner Hofseite stehen Betriebsname, Adresse und Kontakt. Du bist dafür verantwortlich, dass die Pflichtangaben für dein Unternehmen (etwa nach ECG, UGB oder Gewerbeordnung) dort oder in deinen Angeboten vollständig sind.',
          ),
          absatz(
            '16.3',
            'Ein Hofkonto darf nur vom Inhaber oder von Personen genutzt werden, die der Betrieb dazu berechtigt hat. Für alles, was über dein Konto geschieht, bist du verantwortlich.',
          ),
        ],
      },
      {
        nummer: 17,
        titel: 'Tarife, Servicegebühr, Abrechnung',
        bloecke: [
          absatz(
            '17.1',
            'Es gibt zwei Tarife: ',
            fett('Hoftor'),
            ' (0 €) und ',
            fett('Hofladen'),
            ' (19 € im Monat inkl. USt, monatlich kündbar). Was welcher Tarif enthält, steht auf ',
            link('/konditionen', '/konditionen'),
            ' und in deinen Einstellungen unter „Deine Konditionen“ – beides ist Teil dieser AGB.',
          ),
          absatz(
            '17.2',
            fett('Startphase:'),
            ' Bis zum dort genannten Stichtag ist alles kostenlos. Gründungshöfe laufen bis zu dem Datum, das in ihren Konditionen steht, als Hofladen ohne Grundgebühr.',
          ),
          absatz(
            '17.3',
            'Die ',
            fett('Servicegebühr'),
            ` zahlt die Kundschaft an ${MARKE} (Punkt 9). Vom Warenpreis behält ${MARKE} im Pilotbetrieb nichts ein; eine Provision würden wir mindestens 30 Tage vorher ankündigen und in den Konditionen nennen.`,
          ),
          absatz(
            '17.4',
            'Die Grundgebühr des Hofladens rechnen wir monatlich ab; die Zahlungsart (zum Beispiel SEPA-Lastschrift) und die Fälligkeit stehen in den Konditionen. Bei Zahlungsverzug dürfen wir den Tarif nach Mahnung mit 14 Tagen Frist auf Hoftor zurücksetzen.',
          ),
          absatz(
            '17.5',
            'Du erhältst für jede Gebühr eine Rechnung.',
          ),
        ],
      },
      {
        nummer: 18,
        titel: 'Deine Angebote und deine Pflichten',
        bloecke: [
          absatz(
            '18.1',
            'Du bietest nur Waren an, die du ',
            fett('selbst erzeugst oder rechtmäßig vertreibst'),
            ', und beschreibst sie richtig und vollständig: Bezeichnung, Preis inkl. USt, Menge oder Gewicht, bei Lebensmitteln die vorgeschriebenen Angaben vor dem Kauf (insbesondere Allergene, Zutaten, Herkunft, soweit vorgeschrieben – Art. 14 Verordnung (EU) 1169/2011). Du bist Lebensmittelunternehmer im Sinne des Lebensmittelrechts.',
          ),
          absatz(
            '18.2',
            fett('Futtermittel:'),
            ` Du bist für Registrierung und Kennzeichnung nach dem Futtermittelrecht verantwortlich (LFBIS-Nummer, Meldung an die zuständige Behörde). Die Nummern, die du einträgst, zeigt ${MARKE} so an, wie du sie angibst; wir prüfen sie nicht.`,
          ),
          absatz(
            '18.3',
            fett('Brennmaterial:'),
            ' Angaben zu Holzart, Trocknung, Menge und Einheit müssen stimmen.',
          ),
          absatz(
            '18.4',
            'Du pflegst ',
            fett('Abholzeiten'),
            `, die du einhalten kannst, und übergibst bestellte Ware zum Abholtermin in der bestellten Menge und Qualität. Kannst du eine Bestellung nicht erfüllen, stornierst du sie so früh wie möglich mit Angabe des Grunds; ${MARKE} erstattet die Servicegebühr, du den Warenpreis (bei Online-Zahlung automatisch über Stripe).`,
          ),
          absatz(
            '18.5',
            'Du hältst Hygiene, Kühlkette und alle Vorschriften ein, die für deine Waren gelten, holst nötige Bewilligungen ein und stellst Rechnungen oder Belege nach deinen steuerlichen Pflichten (Belegerteilung, Registrierkasse) selbst aus. Steuern und Abgaben auf deine Umsätze sind deine Sache.',
          ),
          absatz(
            '18.6',
            `Du erfüllst gegenüber der Kundschaft die gesetzlichen Pflichten eines Unternehmers im Fernabsatz: Rücktrittsrecht (Punkt 12), Gewährleistung (Punkt 14), Informationspflichten. ${MARKE} stellt dir dafür die Texte und Abläufe zur Verfügung (Bestellbestätigung, Rücktrittsbelehrung, Storno-Weg).`,
          ),
          absatz(
            '18.7',
            `Du stellst ${MARKE} von Ansprüchen Dritter frei, die daraus entstehen, dass du diese Pflichten schuldhaft verletzt hast, und ersetzt die notwendigen Kosten der Rechtsverteidigung.`,
          ),
        ],
      },
      {
        nummer: 19,
        titel: 'Zahlungsabwicklung über Stripe',
        bloecke: [
          absatz(
            '19.1',
            `Für die Online-Zahlung schließt du einen Vertrag mit Stripe (Stripe Connect). Die Zahlungen der Kundschaft gehen auf dein Stripe-Konto; ${MARKE} zieht die Servicegebühr (und eine allfällige, vorher angekündigte Provision) als Plattformgebühr ein. Auszahlungen an dein Bankkonto nimmt Stripe nach seinen Bedingungen vor.`,
          ),
          absatz(
            '19.2',
            'Erstattungen bei Storno, Rücktritt oder fehlenden Artikeln laufen über Stripe; der erstattete Warenpreis wird von deinem Stripe-Guthaben oder deiner nächsten Auszahlung abgezogen. Reicht das nicht, stellen wir dir den Betrag in Rechnung.',
          ),
          absatz(
            '19.3',
            `Barzahlungen kassierst du selbst; ${MARKE} wickelt sie nicht ab und haftet nicht dafür.`,
          ),
        ],
      },
      {
        nummer: 20,
        titel: 'Postfach, Rundschreiben, E-Mails',
        bloecke: [
          absatz(
            '20.1',
            `${MARKE} schreibt dir über das `,
            fett('Postfach'),
            ' in der App: Neues zur Plattform, Hinweise zu deinen Angeboten, Abrechnung, Rechtliches. Du kannst jede Nachricht beantworten.',
          ),
          absatz(
            '20.2',
            'Nachrichten, die den ',
            fett(`Betrieb deines Hofs auf ${MARKE}`),
            ' betreffen (etwa fehlende Pflichtangaben, Abrechnung, Änderungen dieser AGB), schicken wir dir zusätzlich per E-Mail an die Adresse deines Kontos. Das ist Teil der Vertragsdurchführung und braucht keine Einwilligung. Werbung für Dritte verschicken wir nicht.',
          ),
        ],
      },
      {
        nummer: 21,
        titel: 'Reihenfolge, Daten, Beschwerden (Verordnung (EU) 2019/1150)',
        bloecke: [
          absatz(
            '21.1',
            fett('Reihenfolge:'),
            ' Wie Höfe und Angebote gereiht werden, steht in Punkt 3. Du kannst die Reihung nicht kaufen und wir bevorzugen keinen Hof – auch keinen, an dem wir beteiligt wären.',
          ),
          absatz(
            '21.2',
            fett('Daten:'),
            ` Du siehst die Daten deiner eigenen Bestellungen (Name, E-Mail, Telefon und Notiz der Kundschaft, soweit angegeben) und deine Auswertungen. ${MARKE} sieht alle Daten, die beim Betrieb der Plattform anfallen, und nutzt sie für den Betrieb, die Abrechnung und die Verbesserung der Plattform; Näheres in der `,
            link('Datenschutzerklärung', '/datenschutz'),
            '. Nach dem Ende deiner Nutzung bleiben Bestell- und Abrechnungsdaten so lange gespeichert, wie das Gesetz es verlangt (Punkt 22.4).',
          ),
          absatz(
            '21.3',
            fett('Einschränkung, Sperre, Kündigung:'),
            ' Schränken wir dein Konto ein oder sperren es, nennen wir dir die Gründe und die Tatsachen, auf die wir uns stützen (Punkt 5.3). Eine Kündigung durch uns kündigen wir mindestens 30 Tage vorher an – außer bei Rechtsverstößen, wiederholten Verstößen gegen diese AGB oder gesetzlichen Pflichten, die uns zum sofortigen Handeln zwingen.',
          ),
          absatz(
            '21.4',
            fett('Beschwerden:'),
            ' Beschwerden über Entscheidungen oder technische Probleme richtest du an ',
            fett(E_MAIL),
            ' oder über „Problem melden“. Wir antworten in angemessener Zeit, in der Regel binnen 14 Tagen, und begründen unsere Entscheidung. Eine außergerichtliche Mediation können wir im Einzelfall vereinbaren; verpflichtet sind wir dazu nicht.',
          ),
        ],
      },
      {
        nummer: 22,
        titel: 'Pausieren, Kündigen, Löschen',
        bloecke: [
          absatz(
            '22.1',
            'Du kannst deinen Hof jederzeit ',
            fett('stilllegen'),
            ' (deine Hofseite ist dann nicht sichtbar, offene Bestellungen erfüllst du noch) und wieder aktivieren.',
          ),
          absatz(
            '22.2',
            'Den Tarif ',
            fett('Hofladen'),
            ' kannst du monatlich zum Monatsende kündigen; danach läuft dein Hof im Tarif Hoftor weiter.',
          ),
          absatz(
            '22.3',
            'Dein ',
            fett('Hofkonto'),
            ' kannst du jederzeit löschen lassen (Anfrage über „Konto und Sicherheit“ oder per E-Mail). Offene Bestellungen und offene Beträge sind vorher abzuwickeln.',
          ),
          absatz(
            '22.4',
            'Nach der Löschung bleiben Daten gespeichert, soweit Aufbewahrungspflichten gelten (insbesondere 7 Jahre nach § 132 BAO für Abrechnungsdaten) oder sie zur Abwehr von Ansprüchen nötig sind. Alles Übrige löschen wir; Näheres in der ',
            link('Datenschutzerklärung', '/datenschutz'),
            '.',
          ),
          absatz(
            '22.5',
            'Wir können den Nutzungsvertrag mit einem Hof mit einer Frist von 30 Tagen kündigen, aus wichtigem Grund sofort (Punkt 21.3).',
          ),
        ],
      },
      {
        nummer: 23,
        titel: 'Geschäfte zwischen Höfen',
        bloecke: [
          absatz(
            null,
            'Kauft ein Hof bei einem anderen Hof (zum Beispiel Futter), gelten die Punkte 8 bis 14 sinngemäß, aber ',
            fett('ohne die Verbraucherrechte'),
            ' (kein Rücktrittsrecht nach FAGG, Gewährleistung nach UGB/ABGB zwischen Unternehmern). In der Kasse wählst du dafür „Betrieb“ als Käuferart.',
          ),
        ],
      },
    ],
  },
  {
    id: 'd',
    titel: 'Teil D – Für alle: Haftung, Änderungen, Streit',
    punkte: [
      {
        nummer: 24,
        titel: `Haftung von ${MARKE}`,
        bloecke: [
          absatz(
            '24.1',
            `${MARKE} haftet unbeschränkt für Schäden aus der Verletzung von Leben, Körper oder Gesundheit, bei Vorsatz und grober Fahrlässigkeit sowie nach dem Produkthaftungsgesetz.`,
          ),
          absatz(
            '24.2',
            'Bei leichter Fahrlässigkeit haften wir nur für die Verletzung wesentlicher Vertragspflichten (Pflichten, die den Vertrag prägen und auf die du vertrauen darfst), und nur für den vorhersehbaren, vertragstypischen Schaden. Gegenüber Verbraucherinnen und Verbrauchern gilt das nur, soweit § 6 KSchG es zulässt.',
          ),
          absatz(
            '24.3',
            `${MARKE} haftet nicht für Waren der Höfe, deren Beschreibung, Qualität oder Rechtmäßigkeit, für die Erfüllung von Kaufverträgen und nicht für Inhalte, die Nutzerinnen und Nutzer einstellen (§§ 16 ff. ECG). Punkt 24.1 bleibt unberührt.`,
          ),
          absatz(
            '24.4',
            'Für Ausfälle der Plattform, die wir nicht zu vertreten haben (höhere Gewalt, Störungen bei Dienstleistern, Angriffe von außen), haften wir nicht.',
          ),
        ],
      },
      {
        nummer: 25,
        titel: 'Datenschutz',
        bloecke: [
          absatz(
            null,
            'Wie wir personenbezogene Daten verarbeiten, steht in der ',
            link('Datenschutzerklärung', '/datenschutz'),
            `. Höfe sind für die Daten ihrer Kundschaft, die sie über ${MARKE} erhalten, selbst Verantwortliche im Sinne der DSGVO und nutzen sie nur für die Abwicklung der Bestellung und, bei Einwilligung, für Neuigkeiten.`,
          ),
        ],
      },
      {
        nummer: 26,
        titel: 'Änderungen dieser AGB',
        bloecke: [
          absatz(
            '26.1',
            'Wir können diese AGB ändern, wenn sich das Gesetz, die Rechtsprechung oder die Plattform ändert oder eine Regelungslücke zu schließen ist.',
          ),
          absatz(
            '26.2',
            fett('Für Kundinnen und Kunden'),
            ' gilt für jede Bestellung die Fassung, die zum Zeitpunkt der Bestellung auf ',
            link('/agb', '/agb'),
            ' steht und die du mit der Bestellbestätigung erhältst. Eine Änderung wirkt nicht auf abgeschlossene Bestellungen zurück.',
          ),
          absatz(
            '26.3',
            fett('Für Höfe'),
            ' kündigen wir Änderungen mindestens ',
            fett('15 Tage'),
            ' vor dem Wirksamwerden über das Postfach und per E-Mail an (Art. 3 Abs. 2 Verordnung (EU) 2019/1150); bei Änderungen, die dich erheblich belasten, mindestens 30 Tage. Du kannst bis zum Wirksamwerden kündigen. Widersprichst du nicht und nutzt die Plattform weiter, gilt die neue Fassung. Darauf weisen wir in der Ankündigung ausdrücklich hin. Bei Änderungen, die zu deinem Vorteil sind oder die uns ein Gesetz vorschreibt, kann die Frist kürzer sein.',
          ),
        ],
      },
      {
        nummer: 27,
        titel: 'Streitbeilegung',
        bloecke: [
          absatz(
            '27.1',
            'Bei Problemen sprich uns zuerst an: ',
            fett(E_MAIL),
            ' oder „Problem melden“. Die meisten Fragen lösen wir so.',
          ),
          absatz(
            '27.2',
            fett('Verbraucherinnen und Verbraucher:'),
            ' Wir sind nicht verpflichtet, an Verfahren einer Verbraucherschlichtungsstelle teilzunehmen, und nehmen grundsätzlich nicht teil (§ 19 AStG). Im Einzelfall sagen wir dir, ob wir mitmachen. Zuständig wäre die ',
            fett('Internet Ombudsstelle'),
            ' (ombudsstelle.at) bzw. die ',
            fett('Schlichtung für Verbrauchergeschäfte'),
            ' (verbraucherschlichtung.at). Beschwerden über einen Hof richtest du an den Hof; wir unterstützen dich dabei.',
          ),
          absatz(
            '27.3',
            fett('Höfe:'),
            ' Streitigkeiten versuchen wir zuerst direkt zu klären (Punkt 21.4). Eine Mediation können beide Seiten vorschlagen.',
          ),
        ],
      },
      {
        nummer: 28,
        titel: 'Anwendbares Recht, Gerichtsstand',
        bloecke: [
          absatz(
            '28.1',
            'Es gilt ',
            fett('österreichisches Recht'),
            ' unter Ausschluss des UN-Kaufrechts. Für Verbraucherinnen und Verbraucher mit gewöhnlichem Aufenthalt in einem anderen EU-Staat gelten zusätzlich die zwingenden Verbraucherschutzvorschriften dieses Staates.',
          ),
          absatz(
            '28.2',
            `Für Klagen gegen Verbraucherinnen und Verbraucher gilt § 14 KSchG (Gericht am Wohnsitz oder Beschäftigungsort in Österreich). Für Streitigkeiten mit Höfen und anderen Unternehmern ist das sachlich zuständige Gericht am Sitz von ${MARKE} zuständig.`,
          ),
        ],
      },
      {
        nummer: 29,
        titel: 'Schluss',
        bloecke: [
          absatz(
            '29.1',
            'Ist eine Bestimmung dieser AGB unwirksam, bleiben die übrigen wirksam. Anstelle der unwirksamen Bestimmung gilt das Gesetz.',
          ),
          absatz(
            '29.2',
            'Diese AGB gibt es nur auf Deutsch. Du kannst sie auf ',
            link('/agb', '/agb'),
            ' jederzeit abrufen, speichern und ausdrucken (§ 11 ECG).',
          ),
        ],
      },
    ],
  },
]

export const AGB_ANHANG: AgbAnhang = {
  titel: 'Anhang: Muster-Rücktrittsformular (für Verbraucherinnen und Verbraucher)',
  bloecke: [
    absatz(
      null,
      kursiv(`(Wenn du vom Kaufvertrag zurücktreten willst, fülle dieses Formular aus und schicke es an den Hof – seine Angaben stehen in deiner Bestellung. Du kannst es auch an ${MARKE} schicken, wir leiten es weiter.)`),
    ),
    zeilenblock(
      ['An: [Name und Adresse des Hofs, E-Mail laut Bestellung]'],
    ),
    zeilenblock(
      ['Hiermit trete ich / treten wir (*) vom Vertrag über den Kauf der folgenden Waren (*) zurück:'],
      ['Bestellt am (*) / erhalten am (*):'],
      ['Name der Verbraucherin / des Verbrauchers:'],
      ['Anschrift:'],
      ['Unterschrift (nur bei Mitteilung auf Papier):'],
      ['Datum:'],
    ),
    zeilenblock(
      ['(*) Unzutreffendes streichen.'],
    ),
  ],
}
