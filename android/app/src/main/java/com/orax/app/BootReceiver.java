package com.orax.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) return;
        SharedPreferences p = context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE);
        if (!p.getBoolean("enabled", false)) return;
        long trigger = p.getLong("trigger", 0L);
        String uscita = p.getString("uscita", "--:--");
        if (trigger <= System.currentTimeMillis()) { p.edit().clear().apply(); return; }
        AlarmScheduler.schedule(context, trigger, uscita);
    }
}
