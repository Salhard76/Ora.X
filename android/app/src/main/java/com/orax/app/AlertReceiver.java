package com.orax.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.widget.RemoteViews;

public class AlertReceiver extends BroadcastReceiver {
    public static final String EXTRA_USCITA = "uscita";
    private static final int NOTIFICATION_ID = 10705;

    @Override public void onReceive(Context context, Intent intent) {
        NotificationHelper.ensureChannel(context);
        String uscita = intent.getStringExtra(EXTRA_USCITA);
        if (uscita == null || uscita.isEmpty()) uscita = "--:--";

        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 10706, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        boolean exact = AlarmScheduler.MODE_EXACT.equals(
                context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE)
                        .getString("mode", AlarmScheduler.MODE_STANDARD));
        String body = exact
                ? "Uscita prevista alle " + uscita + " · mancano 5 minuti"
                : "Uscita prevista alle " + uscita + " · avviso con precisione standard";

        RemoteViews custom = new RemoteViews(context.getPackageName(), com.orax.app.R.layout.notification_alert);
        custom.setTextViewText(com.orax.app.R.id.alertTitle, "ATTENZIONE USCITA PROGRAMMATA!");
        custom.setTextViewText(com.orax.app.R.id.alertText, body);
        RemoteViews customBig = new RemoteViews(context.getPackageName(), com.orax.app.R.layout.notification_alert_big);
        customBig.setTextViewText(com.orax.app.R.id.alertTitle, "ATTENZIONE USCITA PROGRAMMATA!");
        customBig.setTextViewText(com.orax.app.R.id.alertText, body);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(context, NotificationHelper.CHANNEL_ID)
                : new Notification.Builder(context);
        b.setSmallIcon(R.drawable.ic_stat_alert)
                .setContentTitle("ATTENZIONE USCITA PROGRAMMATA!")
                .setContentText(body)
                .setColor(Color.rgb(217, 15, 31))
                .setCategory(Notification.CATEGORY_ALARM)
                .setPriority(Notification.PRIORITY_MAX)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setVibrate(new long[]{0, 250, 180, 250, 180, 500})
                .setStyle(new Notification.DecoratedCustomViewStyle())
                .setCustomContentView(custom)
                .setCustomBigContentView(customBig);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED)) {
            nm.notify(NOTIFICATION_ID, b.build());
        }
        context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE).edit().clear().apply();
    }
}
