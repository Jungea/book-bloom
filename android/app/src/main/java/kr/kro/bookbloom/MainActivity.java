package kr.kro.bookbloom;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 로컬 플러그인은 super.onCreate보다 먼저 등록해야 브리지가 인식한다.
        registerPlugin(OrientationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
