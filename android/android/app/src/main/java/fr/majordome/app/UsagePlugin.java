package fr.majordome.app;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.os.Process;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import java.util.Map;

/**
 * Temps d'écran RÉEL du téléphone (lecture seule). Android demande une autorisation spéciale « Accès aux données d'utilisation » :
 * on ne peut pas la demander par une fenêtre, l'utilisateur l'active une fois dans les réglages (openSettings).
 * Trois méthodes, appelées par le site :
 *   Usage.hasAccess()            -> { granted: boolean }
 *   Usage.openSettings()         -> ouvre l'écran des réglages où activer Majordome
 *   Usage.days({ count: 14 })    -> { days: [{ date: "AAAA-MM-JJ", minutes }] } (jour local du téléphone, aujourd'hui compris)
 */
@CapacitorPlugin(name = "Usage")
public class UsagePlugin extends Plugin {

    private boolean granted() {
        Context c = getContext();
        AppOpsManager ops = (AppOpsManager) c.getSystemService(Context.APP_OPS_SERVICE);
        int mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName());
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    @PluginMethod
    public void hasAccess(PluginCall call) {
        call.resolve(new JSObject().put("granted", granted()));
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            getContext().startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception e) {
            call.reject("Impossible d'ouvrir les réglages : " + e.getMessage());
        }
    }

    @PluginMethod
    public void days(PluginCall call) {
        if (!granted()) {
            call.reject("Accès au temps d'écran non autorisé");
            return;
        }
        int count = Math.max(1, Math.min(call.getInt("count", 14), 31));
        UsageStatsManager usm = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        JSArray out = new JSArray();
        try {
            for (int i = count - 1; i >= 0; i--) {
                Calendar start = Calendar.getInstance();
                start.add(Calendar.DAY_OF_YEAR, -i);
                start.set(Calendar.HOUR_OF_DAY, 0);
                start.set(Calendar.MINUTE, 0);
                start.set(Calendar.SECOND, 0);
                start.set(Calendar.MILLISECOND, 0);
                long from = start.getTimeInMillis();
                long to = i == 0 ? System.currentTimeMillis() : from + 24L * 3600 * 1000;
                long total = 0;
                Map<String, UsageStats> stats = usm.queryAndAggregateUsageStats(from, to);
                for (UsageStats s : stats.values()) total += s.getTotalTimeInForeground();
                out.put(new JSObject().put("date", fmt.format(start.getTime())).put("minutes", (int) Math.round(total / 60000.0)));
            }
            call.resolve(new JSObject().put("days", out));
        } catch (Exception e) {
            call.reject("Lecture impossible : " + e.getMessage());
        }
    }
}
