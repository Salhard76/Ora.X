ORA X 11.0 — MANUTENZIONE E OTTIMIZZAZIONE

Versione: 11.0
Firma: 𝑺𝒂𝒍𝑯𝒂𝒓𝒅   (la firma resta in README, sorgenti e nome dello zip di ogni versione futura)
Dispositivo di riferimento: Samsung Galaxy A27 5G (6,7" FHD+ 1080x2340, ~412 dp di larghezza,
foro fotocamera, Snapdragon 6 Gen 3 ARM64, Android 16 / One UI 8.5).

ARCHITETTURA
- PWA: HTML + CSS + JavaScript vanilla, offline-first.
- APK nativo: Android WebView + bridge AndroidOraX (minSdk 26, targetSdk/compileSdk 35).
- Avviso uscita: AlarmManager nativo, exact quando disponibile, standard come fallback.
- Storico: localStorage validato + backup/ripristino JSON.

11.0 — CAMBIAMENTI DI QUESTA REVISIONE
Correzioni
- service-worker.js: errore di sintassi (parentesi mancante nell'handler install) che impediva
  la registrazione: ora corretto. Aggiunto ignoreSearch per le icone con ?v=; rimosso
  l'handler notificationclick (nessuna push).
- Tasto/gesto Indietro dell'APK: MainActivity ora chiude solo lo Storico se aperto (window.oraxBack),
  altrimenti esce. Android 13+ usa il callback del gesto predittivo (enableOnBackInvokedCallback),
  sotto Android 13 onBackPressed().
- Wrapper Gradle completo: gradlew, gradlew.bat, gradle-wrapper.jar (Gradle 8.9, dal repository
  ufficiale gradle/gradle v8.9.0). Build: cd android && ./gradlew assembleDebug
- Icone: scritta aggiornata a "v11.0" (prima "v10.16"). Rimossa la scritta fantasma "v10.14"
  presente nel foreground adattivo, che ora sta interamente nella zona sicura (maschera circolare
  e a rettangolo arrotondato verificate). Maskable PWA ridotte all'80% per la zona sicura.
  Aggiunta icona monocromatica (icone a tema Android 13+). Sfondo adattivo = #1B4FA7.
- Barra di stato/navigazione: lo sfondo della finestra e' il gradiente della pagina
  (drawable/window_bg.xml), niente bande chiare sotto le barre. Gli inset includono il foro fotocamera.
- Classe CSS .sv-attivo definita (evidenzia l'orario Mensa quando il pasto e' attivo).
- Notifica avviso: layout rosso visibile anche espansa (DecoratedCustomViewStyle + big content view).
- Cache icone: ?v=<versione> aggiornato automaticamente da sync-www.sh (prima fisso a 1019).
- Rollover di mezzanotte: se l'app resta aperta/in background, al rientro "oggi" si riallinea
  e il pulsante Adesso viene aggiornato.
- Ripristino backup: testi delle conferme piu' chiari (Unisci / Sostituisci / Interrompi).
- Pulsante info (icona i bianca in alto a destra): pannello con autore "Sal Hard", versione corrente
  (letta da version.txt), breve descrizione, Novita' e Correzioni. Il tasto Indietro lo chiude.
  Autore in Vivaldi se il dispositivo lo ha; altrimenti font incorporato Great Vibes (SIL OFL 1.1,
  ridotto alle sole lettere necessarie, ~6 KB). Vivaldi e' un font Microsoft e non si puo' incorporare.
  A ogni rilascio aggiornare a mano solo i testi Novita'/Correzioni nel blocco infoOverlay di index.html.
- Commento contraddittorio sul padding in MainActivity corretto; getPackageInfo senza deprecazione
  su Android 13+.

sync-www.sh
- version.txt resta la sorgente unica. Ora sincronizza anche il fallback di versione in
  MainActivity e build.gradle, il cache-buster delle icone, i commenti di firma.
- Controlli bloccanti: manifest JSON valido, file in cache del service worker esistenti,
  riferimenti coerenti in index.html/service worker, sintassi JS (se node e' installato).
- Avvisa se la firma manca da un file principale.

NOTIFICHE
- Exact Alarm: setExactAndAllowWhileIdle quando autorizzato.
- Fallback: setAndAllowWhileIdle quando l'exact alarm non e' disponibile.
- L'interfaccia dichiara la precisione standard quando necessario.
- BootReceiver ripristina l'avviso dopo riavvio/sostituzione dell'app.
- Samsung: se l'avviso non arriva, escludere Ora X da "App in sospensione/Sospensione profonda"
  (Impostazioni > Batteria > Limiti di utilizzo in background).

UI
- Layout principale max 412 CSS px (tuning dedicato ai 390-430 px in verticale).
- Entrata/Uscita/Mensa allineate con frecce in colonna centrale.
- Nessuna fotocamera/OCR e nessuna libreria esterna.

PUBBLICAZIONE
1. Modificare version.txt.
2. Eseguire ./sync-www.sh.
3. Pubblicare i file della root PWA (index.html, service-worker.js, app/style/manifest versionati, icone).
4. Per l'APK: cd android && ./gradlew assembleDebug (oppure PWABuilder dalla PWA pubblicata).

VERIFICHE 11.0
- Manifest JSON valido; service-worker.js e app-11-0.js passano node --check.
- Nessun googleplay, version.json, tesseract o fetch della versione nel sorgente.
- Versione coerente tra version.txt, HTML, JS, Gradle, Java e service worker.
- Root PWA e asset Android identici (verificato byte per byte).
- NON eseguiti in questo ambiente: compilazione Gradle dell'APK e prova su dispositivo.


                 𝑺𝒂𝒍𝑯𝒂𝒓𝒅
11.0
