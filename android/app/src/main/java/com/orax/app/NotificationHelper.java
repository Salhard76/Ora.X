package com.orax.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Color;
import android.os.Build;

public final class NotificationHelper {
    public static final String CHANNEL_ID = "orax_exit_alert";
    private NotificationHelper() {}

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                "Avvisi uscita Ora X", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Avviso cinque minuti prima dell'uscita programmata");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 250, 180, 250, 180, 500});
        channel.setLightColor(Color.RED);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(channel);
    }
}
