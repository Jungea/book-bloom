package kr.kro.bookbloom;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 화면별 방향 고정. 도서관은 가로, 독서 관리는 세로로 맞추기 위해 웹에서 호출한다.
 * 별도 의존성 없이 앱 안에 둔 로컬 Capacitor 플러그인이다.
 */
@CapacitorPlugin(name = "Orientation")
public class OrientationPlugin extends Plugin {

    @PluginMethod
    public void lock(PluginCall call) {
        String mode = call.getString("mode");
        final int orientation;
        if ("portrait".equals(mode)) {
            orientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
        } else if ("landscape".equals(mode)) {
            orientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE;
        } else {
            call.reject("mode는 portrait 또는 landscape여야 합니다.");
            return;
        }

        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("화면을 사용할 수 없습니다.");
            return;
        }
        activity.runOnUiThread(
            () -> {
                activity.setRequestedOrientation(orientation);
                call.resolve();
            }
        );
    }
}
