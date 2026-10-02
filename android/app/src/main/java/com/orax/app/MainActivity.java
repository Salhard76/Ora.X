package com.orax.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.window.OnBackInvokedDispatcher;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    // Ora X 11.0 · 𝑺𝒂𝒍𝑯𝒂𝒓𝒅
    private static final int REQ_NOTIFICATIONS = 701;
    private static final int REQ_SAVE = 702;
    private static final int REQ_PICK = 703;
    private static final String PLAN_JS = "if(typeof planAlert==='function')planAlert();";
    // Indietro: true = lo Storico era aperto ed e' stato chiuso; altrimenti l'app si chiude.
    private static final String BACK_JS = "(function(){try{return !!(window.oraxBack&&window.oraxBack());}catch(e){return false;}})()";

    private WebView web;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingSaveText;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        // Android 15/16: edge-to-edge è obbligatorio. Il padding della WebView segue gli inset
        // di system bar e cutout (foro fotocamera): una sola fonte, nessun padding manuale.
        // Lo sfondo sotto le barre arriva dal tema (windowBackground, stesso gradiente della pagina).
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
            getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
            getWindow().setNavigationBarContrastEnforced(false);
            web.setOnApplyWindowInsetsListener((v, insets) -> {
                int type = WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout();
                android.graphics.Insets i = insets.getInsets(type);
                v.setPadding(i.left, i.top, i.right, i.bottom);
                return insets;
            });
        }
        web.setBackgroundColor(android.graphics.Color.TRANSPARENT);
        // Il padding iniziale e' zero: lo imposta solo il listener degli inset (sopra) quando serve.
        web.setPadding(0, 0, 0, 0);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setSaveFormData(false);
        s.setBuiltInZoomControls(false);
        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        WebView.setWebContentsDebuggingEnabled(debuggable);

        // Resta dentro l'app: qualunque URL diverso dagli asset locali viene bloccato.
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().startsWith("file:///android_asset/");
            }
        });

        // Senza WebChromeClient alert()/confirm() vengono ignorati e <input type=file> non apre nulla.
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton("OK", (d, w) -> result.confirm())
                        .setOnCancelListener(d -> result.confirm())
                        .show();
                return true;
            }

            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton("OK", (d, w) -> result.confirm())
                        .setNegativeButton("Annulla", (d, w) -> result.cancel())
                        .setOnCancelListener(d -> result.cancel())
                        .show();
                return true;
            }

            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), REQ_PICK);
                } catch (Exception e) {
                    filePathCallback = null;
                    callback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, "Selezione file non disponibile", Toast.LENGTH_SHORT).show();
                }
                return true;
            }
        });

        web.addJavascriptInterface(new OraXBridge(this), "AndroidOraX");
        web.loadUrl("file:///android_asset/www/index.html");
        setContentView(web);
        NotificationHelper.ensureChannel(this);
        // Android 13+ (Samsung A27 5G: Android 16 / One UI 8.5): gesto Indietro predittivo -> callback dedicata.
        // Sotto Android 13 resta onBackPressed().
        if (Build.VERSION.SDK_INT >= 33) PredictiveBack.register(this);
    }

    // Indietro: se lo Storico e' aperto lo chiude la pagina (window.oraxBack), altrimenti si esce.
    private void handleBack() {
        if (web == null) { finish(); return; }
        web.evaluateJavascript(BACK_JS, value -> { if (!"true".equals(value)) finish(); });
    }

    @Override public void onBackPressed() { handleBack(); }

    /** Isolata in una classe a parte: viene caricata solo su Android 13+. */
    private static final class PredictiveBack {
        static void register(MainActivity a) {
            a.getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, a::handleBack);
        }
    }

    @Override protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            // Riallinea l'allarme allo stato reale (es. dopo aver concesso permessi dalle impostazioni).
            web.evaluateJavascript(PLAN_JS, null);
        }
    }

    // Metodi richiamati dal bridge AndroidOraX.
    public void requestExactAlarmPermission() {
        if (Build.VERSION.SDK_INT < 31) return;
        try {
            startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
        } catch (Exception e) {
            openAppDetails();
        }
    }

    public void openNotificationSettings() {
        try {
            startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
        } catch (Exception e) {
            openAppDetails();
        }
    }

    private void openAppDetails() {
        try {
            startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
        } catch (Exception ignored) {
            Toast.makeText(this, "Apri Impostazioni > App > Ora X", Toast.LENGTH_LONG).show();
        }
    }

    public void requestNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATIONS);
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_NOTIFICATIONS && web != null) web.evaluateJavascript(PLAN_JS, null);
    }

    private boolean notificationsAllowed() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || !nm.areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = nm.getNotificationChannel(NotificationHelper.CHANNEL_ID);
            if (ch != null && ch.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
        }
        return true;
    }

    private void startSave(String name, String text, String mime) {
        pendingSaveText = text;
        String type = (mime == null || mime.isEmpty()) ? "text/plain" : mime.split(";")[0];
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType(type)
                .putExtra(Intent.EXTRA_TITLE, name);
        try {
            startActivityForResult(i, REQ_SAVE);
        } catch (Exception e) {
            pendingSaveText = null;
            Toast.makeText(this, "Salvataggio non disponibile", Toast.LENGTH_SHORT).show();
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_SAVE) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingSaveText != null) {
                try (OutputStream os = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    os.write(pendingSaveText.getBytes(StandardCharsets.UTF_8));
                    Toast.makeText(this, "File salvato", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(this, "Salvataggio non riuscito", Toast.LENGTH_LONG).show();
                }
            }
            pendingSaveText = null;
            return;
        }
        if (requestCode == REQ_PICK) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    public static class OraXBridge {
        private final MainActivity activity;
        OraXBridge(MainActivity activity) { this.activity = activity; }

        @JavascriptInterface public void requestNotificationPermission() { activity.runOnUiThread(activity::requestNotifications); }

        @JavascriptInterface public void requestExactAlarmPermission() { activity.runOnUiThread(activity::requestExactAlarmPermission); }

        @JavascriptInterface public void openNotificationSettings() { activity.runOnUiThread(activity::openNotificationSettings); }

        @JavascriptInterface public boolean canScheduleExactAlarm() { return AlarmScheduler.canScheduleExact(activity); }

        @JavascriptInterface public boolean canNotify() { return activity.notificationsAllowed(); }

        @JavascriptInterface public boolean scheduleExitAlert(long triggerAtMillis, String uscita) {
            return AlarmScheduler.schedule(activity, triggerAtMillis, uscita);
        }

        @JavascriptInterface public String getAlertScheduleMode() {
            return AlarmScheduler.getMode(activity);
        }

        @JavascriptInterface public void cancelExitAlert() { AlarmScheduler.cancel(activity); }

        @JavascriptInterface public String getVersionName() {
            try {
                PackageManager pm = activity.getPackageManager();
                String pkg = activity.getPackageName();
                return (Build.VERSION.SDK_INT >= 33
                        ? pm.getPackageInfo(pkg, PackageManager.PackageInfoFlags.of(0))
                        : pm.getPackageInfo(pkg, 0)).versionName;
            }
            catch (Exception e) { return "11.0"; }
        }

        @JavascriptInterface public void saveFile(String name, String text, String mime) {
            activity.runOnUiThread(() -> activity.startSave(name, text, mime));
        }
    }

    @Override protected void onDestroy() {
        if (web != null) { web.stopLoading(); web.destroy(); web = null; }
        super.onDestroy();
    }
}
