ORA X 11.1 — SAL HARD

Versione: 11.1
Firma: 𝑺𝒂𝒍𝑯𝒂𝒓𝒅   (la firma resta in README, sorgenti e nome dello zip di ogni versione futura)
Dispositivo di riferimento: Samsung Galaxy A27 5G (6,7" FHD+ 1080x2340, ~412 dp di larghezza,
foro fotocamera, Snapdragon 6 Gen 3 ARM64, Android 16 / One UI 8.5).

ARCHITETTURA
- PWA: HTML + CSS + JavaScript vanilla, offline-first.
- APK nativo: Android WebView + bridge AndroidOraX (minSdk 26, targetSdk/compileSdk 35).
- Avviso uscita: AlarmManager nativo, exact quando disponibile, standard come fallback.
- Storico: localStorage validato + backup/ripristino JSON.

11.1 — CAMBIAMENTI RISPETTO ALLA 11.0
- Storico: le due uscite (senza mensa = ENT+7h22, con mensa = ENT+7h42) sono sempre visibili.
  Quella non scelta e' attenuata e barrata: con il pasto spuntato l'uscita senza mensa, senza pasto
  l'uscita +20 minuti. Prima, con il pasto, nella colonna USC compariva lo stesso orario della Mensa.
  Totali ed export testo invariati.
- Installazione "sopra" la versione precedente:
  * firma fissa: android/orax-signing.p12 (alias orax, PKCS12) usata da debug e release in
    app/build.gradle, quindi ogni build, su qualunque PC, ha la stessa firma;
  * versionCode sempre crescente da version.txt (11.1 -> 110100, 11.0 -> 110000);
  * assembleRelease ora produce un APK firmato e installabile (prima era non firmato).
  ATTENZIONE: la prima installazione con questa chiave richiede ancora di disinstallare la versione
  firmata con una chiave diversa. Prima di disinstallare: Storico -> Backup, per salvare i dati.
  Conservare orax-signing.p12 e non pubblicarlo in un repository pubblico. Dalle versioni successive,
  finche' si usa questa chiave, l'aggiornamento va sopra senza disinstallare.
  Se l'installazione fallisce, il messaggio esatto (adb install -r app-debug.apk) dice la causa:
  INSTALL_FAILED_UPDATE_INCOMPATIBLE = firma diversa; INSTALL_FAILED_VERSION_DOWNGRADE = versionCode
  piu' basso di quello gia' installato.
- genera-icone.py: riscrive "v<versione>" in tutte le icone (PWA, mipmap, foreground adattivo,
  monocromatica). Lo richiama sync-www.sh; richiede Pillow, numpy e il font DejaVu Sans Mono Bold.
- sync-www.sh: rinomina da solo README-<versione>.txt e aggiorna la versione nel pannello info.
- Pannello info: novita'/correzioni della versione corrente e, in un riquadro espandibile, quelle della 11.0.

11.0 — CAMBIAMENTI RISPETTO ALLE PRECEDENTI
- Service worker: errore di sintassi (parentesi mancante) che impediva la registrazione. Aggiunto
  ignoreSearch per le icone con ?v=; rimosso notificationclick.
- Tasto/gesto Indietro dell'APK: chiude solo lo Storico o il pannello info se aperti
  (window.oraxBack), altrimenti esce. Android 13+: callback del gesto predittivo
  (enableOnBackInvokedCallback); sotto: onBackPressed().
- Wrapper Gradle completo (gradlew, gradlew.bat, gradle-wrapper.jar, Gradle 8.9 dal repository
  ufficiale gradle/gradle v8.9.0). Build: cd android && ./gradlew assembleDebug
- Icone con la scritta della versione; foreground adattivo dentro la zona sicura; maskable PWA all'80%;
  icona monocromatica (icone a tema Android 13+); sfondo adattivo #1B4FA7.
- Pulsante info (i bianca in alto a destra): autore "Sal Hard", versione, descrizione, novita' e
  correzioni. Autore in Vivaldi se presente, altrimenti Great Vibes (SIL OFL 1.1) incorporato
  e ridotto alle lettere necessarie (~6 KB); Vivaldi e' un font Microsoft e non si puo' incorporare.
  A ogni rilascio riscrivere a mano i testi Novita'/Correzioni nel blocco infoOverlay di index.html.
- Barra di stato/navigazione: sfondo finestra = gradiente della pagina (drawable/window_bg.xml);
  gli inset includono il foro fotocamera.
- Classe CSS .sv-attivo; notifica avviso con layout rosso anche espansa; cache icone ?v=<versione>;
  rollover di mezzanotte; conferme del ripristino backup piu' chiare; getPackageInfo senza deprecazione.
- sync-www.sh: versione unica da version.txt, controlli bloccanti (manifest JSON, file in cache del
  service worker, riferimenti coerenti, sintassi JS se node e' installato), avviso se manca la firma.

NOTIFICHE
- Exact Alarm: setExactAndAllowWhileIdle quando autorizzato; altrimenti setAndAllowWhileIdle.
- BootReceiver ripristina l'avviso dopo riavvio/sostituzione dell'app.
- Samsung: se l'avviso non arriva, escludere Ora X da "App in sospensione/Sospensione profonda"
  (Impostazioni > Batteria > Limiti di utilizzo in background).

PUBBLICAZIONE
1. Modificare version.txt.
2. Eseguire ./sync-www.sh (rigenera icone, rinomina i file versionati, sincronizza asset Android).
3. Riscrivere i testi Novita'/Correzioni nel pannello info (index.html) e rieseguire ./sync-www.sh.
4. Pubblicare i file della root PWA (index.html, service-worker.js, app/style/manifest versionati, icone).
5. APK: cd android && ./gradlew assembleDebug (oppure assembleRelease).

VERIFICHE
- Manifest JSON valido; service-worker.js e app-<versione>.js passano node --check.
- Versione coerente tra version.txt, HTML, JS, Gradle, Java e service worker.
- Root PWA e asset Android identici (verificato byte per byte).
- NON eseguiti in questo ambiente: compilazione Gradle dell'APK e prova su dispositivo.


                 𝑺𝒂𝒍𝑯𝒂𝒓𝒅
11.1
