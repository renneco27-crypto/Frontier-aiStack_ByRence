package com.studyup.app;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "GoogleAuthBridge")
public class GoogleAuthPlugin extends Plugin {

    private GoogleSignInClient googleSignInClient;
    private static final String DEFAULT_CLIENT_ID = "869014472748-tdp7e3dopp51i74e4d01g0cv84sk5ujo.apps.googleusercontent.com";

    private GoogleSignInClient getClient(String clientId) {
        String serverClientId = (clientId != null && !clientId.isEmpty()) ? clientId : DEFAULT_CLIENT_ID;
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(serverClientId)
                .requestEmail()
                .build();
        return GoogleSignIn.getClient(getActivity(), gso);
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        try {
            String clientId = call.getString("clientId", DEFAULT_CLIENT_ID);
            googleSignInClient = getClient(clientId);

            // Sign out first to ensure user can choose account every time
            googleSignInClient.signOut().addOnCompleteListener(getActivity(), task -> {
                Intent signInIntent = googleSignInClient.getSignInIntent();
                startActivityForResult(call, signInIntent, "handleGoogleSignInResult");
            });
        } catch (Exception e) {
            call.reject("Failed to initiate Google Sign In: " + e.getMessage(), e);
        }
    }

    @ActivityCallback
    private void handleGoogleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        try {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(result.getData());
            GoogleSignInAccount account = task.getResult(ApiException.class);

            if (account != null) {
                JSObject ret = new JSObject();
                ret.put("idToken", account.getIdToken());
                ret.put("email", account.getEmail());
                ret.put("displayName", account.getDisplayName());
                ret.put("givenName", account.getGivenName());
                ret.put("familyName", account.getFamilyName());
                if (account.getPhotoUrl() != null) {
                    ret.put("photoUrl", account.getPhotoUrl().toString());
                }
                call.resolve(ret);
            } else {
                call.reject("Google Sign In failed: account is null");
            }
        } catch (ApiException e) {
            call.reject("Google Sign In failed (" + e.getStatusCode() + "): " + e.getMessage(), e);
        } catch (Exception e) {
            call.reject("Google Sign In error: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        try {
            if (googleSignInClient == null) {
                googleSignInClient = getClient(DEFAULT_CLIENT_ID);
            }
            googleSignInClient.signOut().addOnCompleteListener(getActivity(), task -> call.resolve());
        } catch (Exception e) {
            call.reject("Failed to sign out: " + e.getMessage(), e);
        }
    }
}
