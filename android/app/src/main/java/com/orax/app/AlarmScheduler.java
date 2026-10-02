package com.orax.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Programma l'avviso nativo. Usa exact quando disponibile, altrimenti un alarm standard che funziona senza il permesso Exact Alarm. */
final class AlarmScheduler {
    static final String PREFS = "orax_alert";
    static final String MODE_EXACT = "exact";
    static final String MODE_STANDARD = "standard";
    private static final int REQUEST_CODE = 10705;

    private AlarmScheduler() {}

    private static PendingIntent alertPending(Context c, String uscita, int flags) {
        Intent i = new Intent(c, AlertReceiver.class);
        if (uscita != null) i.putExtra(AlertReceiver.EXTRA_USCITA, uscita);
        return PendingIntent.getBroadcast(c, REQUEST_CODE, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    static boolean canScheduleExact(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = c.getSystemService(AlarmManager.class);
        return am != null && am.canScheduleExactAlarms();
    }

    static boolean schedule(Context c, long triggerAtMillis, String uscita) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null || triggerAtMillis <= System.currentTimeMillis()) return false;
        cancel(c);
        PendingIntent pi = alertPending(c, uscita, PendingIntent.FLAG_UPDATE_CURRENT);
        boolean exact = canScheduleExact(c);
        try {
            if (exact) {
                try {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
                } catch (SecurityException denied) {
                    // Se il permesso esatto è stato revocato nel frattempo, passa subito al fallback.
                    exact = false;
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
                }
            } else {
                // Fallback affidabile senza SCHEDULE_EXACT_ALARM. Android può ritardarlo: non promettiamo il minuto esatto.
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            }
        } catch (SecurityException ignored) {
            return false;
        }
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean("enabled", true)
                .putLong("trigger", triggerAtMillis)
                .putString("uscita", uscita)
                .putString("mode", exact ? MODE_EXACT : MODE_STANDARD)
                .apply();
        return true;
    }

    static String getMode(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString("mode", MODE_STANDARD);
    }

    static void cancel(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        PendingIntent pi = alertPending(c, null, PendingIntent.FLAG_NO_CREATE);
        if (pi != null) {
            if (am != null) am.cancel(pi);
            pi.cancel();
        }
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
    }
}
