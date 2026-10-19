package fr.majordome.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmPlugin.class); // les plugins doivent être déclarés AVANT super.onCreate
        registerPlugin(UsagePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
