package fr.majordome.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmPlugin.class); // le plugin doit être déclaré AVANT super.onCreate
        super.onCreate(savedInstanceState);
    }
}
