package fr.majordome.app;

import android.content.Intent;
import android.provider.AlarmClock;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Règle un VRAI réveil ou minuteur dans l'appli Horloge du téléphone, sans toucher l'écran (EXTRA_SKIP_UI = true).
 * Deux méthodes, appelées par le site : Alarm.setAlarm({hour, minutes, message}) et Alarm.setTimer({seconds, message}).
 * Résultat : { ok: true } ou une erreur lisible (aucune Horloge compatible, heure invalide, refus d'Android).
 */
@CapacitorPlugin(name = "Alarm")
public class AlarmPlugin extends Plugin {

    @PluginMethod
    public void setAlarm(PluginCall call) {
        Integer hour = call.getInt("hour");
        Integer minutes = call.getInt("minutes", 0);
        if (hour == null || hour < 0 || hour > 23 || minutes == null || minutes < 0 || minutes > 59) {
            call.reject("Heure invalide");
            return;
        }
        launch(call, new Intent(AlarmClock.ACTION_SET_ALARM)
                .putExtra(AlarmClock.EXTRA_HOUR, hour.intValue())
                .putExtra(AlarmClock.EXTRA_MINUTES, minutes.intValue())
                .putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("message", ""))
                .putExtra(AlarmClock.EXTRA_SKIP_UI, true));
    }

    @PluginMethod
    public void setTimer(PluginCall call) {
        Integer seconds = call.getInt("seconds");
        if (seconds == null || seconds < 1 || seconds > 86400) {
            call.reject("Durée invalide");
            return;
        }
        launch(call, new Intent(AlarmClock.ACTION_SET_TIMER)
                .putExtra(AlarmClock.EXTRA_LENGTH, seconds.intValue())
                .putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("message", ""))
                .putExtra(AlarmClock.EXTRA_SKIP_UI, true));
    }

    private void launch(PluginCall call, Intent intent) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        // Une appli Horloge peut-elle recevoir cette demande ? (Android 11+ : voir <queries> dans le manifeste.)
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("Aucune application Horloge ne peut régler ça sur ce téléphone");
            return;
        }
        try {
            getContext().startActivity(intent);
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception e) {
            call.reject("Android a refusé : " + e.getMessage());
        }
    }
}
