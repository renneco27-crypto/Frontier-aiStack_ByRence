package com.studyup.app;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.messaging.FirebaseMessaging;

@CapacitorPlugin(
    name = "FirebaseMessagingBridge",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class FirebaseMessagingPlugin extends Plugin {

    private static final String TAG = "FCMPlugin";

    private FirebaseMessaging getMessagingOrReject(PluginCall call) {
        try {
            return FirebaseMessaging.getInstance();
        } catch (IllegalStateException error) {
            Log.e(TAG, "Firebase is not configured for this app build", error);
            call.reject("Firebase is not configured for this app build.");
            return null;
        }
    }

    @PluginMethod
    public void getToken(PluginCall call) {
        FirebaseMessaging messaging = getMessagingOrReject(call);
        if (messaging == null) return;

        messaging.getToken()
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful()) {
                    Log.w(TAG, "Fetching FCM registration token failed", task.getException());
                    // Fallback to cached token in SharedPreferences
                    SharedPreferences prefs = getContext().getSharedPreferences("studyup_fcm_prefs", Context.MODE_PRIVATE);
                    String cached = prefs.getString("fcm_token", null);
                    if (cached != null) {
                        JSObject ret = new JSObject();
                        ret.put("token", cached);
                        call.resolve(ret);
                    } else {
                        call.reject("Failed to get FCM token: " + (task.getException() != null ? task.getException().getMessage() : "Unknown"));
                    }
                    return;
                }

                String token = task.getResult();
                Log.i(TAG, "FCM Token fetched: " + token);

                // Cache token locally
                getContext().getSharedPreferences("studyup_fcm_prefs", Context.MODE_PRIVATE)
                    .edit()
                    .putString("fcm_token", token)
                    .apply();

                JSObject ret = new JSObject();
                ret.put("token", token);
                call.resolve(ret);
            });
    }

    @PluginMethod
    public void subscribeToTopic(PluginCall call) {
        String topic = call.getString("topic", "all_devices");
        FirebaseMessaging messaging = getMessagingOrReject(call);
        if (messaging == null) return;

        messaging.subscribeToTopic(topic)
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful()) {
                    call.reject("Failed to subscribe to topic: " + topic);
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("topic", topic);
                call.resolve(ret);
            });
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
            ret.put("receive", granted ? "granted" : "prompt");
        } else {
            ret.put("receive", "granted");
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAlias("notifications", call, "permissionCallback");
        } else {
            checkPermissions(call);
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        checkPermissions(call);
    }
}
