package com.studyup.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "StudyUpApp";
    private static final String REMOTE_API_BASE = "https://www.studyup.cloud-ip.cc";
    private static final String DEFAULT_FOLDERS_JSON = "[{\"id\":\"9dbef8a6-bbc7-4dad-a37e-aa0aa5758419\",\"name\":\"maee\",\"created_by\":\"8400369e-08ad-4bc0-b8ac-26f8bddcdbbf\",\"created_at\":\"2026-08-14T07:59:04.667409+00:00\",\"deck_count\":2},{\"id\":\"c3aebe89-8abf-46e2-972d-f1133137ffcb\",\"name\":\"Lawrence\",\"created_by\":\"11cfc55a-bed4-4310-8ab9-eb4c6fd6ecf2\",\"created_at\":\"2026-09-20T18:08:11.036935+00:00\",\"deck_count\":0}]";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoogleAuthPlugin.class);
        registerPlugin(FirebaseMessagingPlugin.class);
        registerPlugin(NativeDeckStoragePlugin.class);
        registerPlugin(NativeTTSPlugin.class);
        registerPlugin(NativeSTTPlugin.class);
        registerPlugin(SharedFilePlugin.class);

        super.onCreate(savedInstanceState);

        // Enable Chrome remote inspection for debugging
        WebView.setWebContentsDebuggingEnabled(true);

        // Attach custom BridgeWebViewClient to ensure local Next.js routing and offline assets
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    WebResourceResponse localResp = handleLocalRouting(view, request, this);
                    if (localResp != null) {
                        return localResp;
                    }
                    return super.shouldInterceptRequest(view, request);
                }
            });
        }

        StudyUpFirebaseMessagingService.ensureChannel(this);

        // Play app opening sound
        playOpeningSound();

        // Native guaranteed subscription to broadcast topic
        try {
            com.google.firebase.messaging.FirebaseMessaging.getInstance().subscribeToTopic("all_devices")
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        Log.i("StudyUpFCM", "Native auto-subscribe to all_devices: SUCCESS");
                    } else {
                        Log.w("StudyUpFCM", "Native auto-subscribe to all_devices failed", task.getException());
                    }
                });
        } catch (Exception e) {
            Log.w("StudyUpFCM", "Error initiating topic subscription", e);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 1001);
            }
        }

        handleIntent(getIntent());
    }

    private WebResourceResponse handleLocalRouting(WebView view, WebResourceRequest request, BridgeWebViewClient defaultClient) {
        if (request == null || request.getUrl() == null) return null;
        Uri uri = request.getUrl();
        String host = uri.getHost();
        if (host == null || (!"localhost".equalsIgnoreCase(host) && !"127.0.0.1".equalsIgnoreCase(host))) {
            return null;
        }

        String path = uri.getPath();
        if (path == null) path = "/";

        // Let Capacitor handle _next static assets, public assets, and media files directly
        if (path.startsWith("/_next/") || path.startsWith("/assets/") || path.endsWith(".js")
                || path.endsWith(".css") || path.endsWith(".png") || path.endsWith(".jpg")
                || path.endsWith(".jpeg") || path.endsWith(".gif") || path.endsWith(".svg")
                || path.endsWith(".ico") || path.endsWith(".webmanifest") || path.endsWith(".json")) {
            return null;
        }

        // 1. Next.js RSC requests (client-side transitions)
        Map<String, String> headers = request.getRequestHeaders();
        boolean isRsc = (headers != null && "1".equals(headers.get("RSC"))) || uri.getQueryParameter("_rsc") != null;

        if (isRsc) {
            String rscAsset = resolveRscAsset(path);
            if (rscAsset != null) {
                try {
                    InputStream is = getAssets().open(rscAsset);
                    return new WebResourceResponse("text/x-component", "UTF-8", 200, "OK", null, is);
                } catch (IOException e) {
                    Log.w(TAG, "RSC asset not found in assets: " + rscAsset);
                }
            }
        }

        // 2. Study player dynamic routes (/study/[deckId]/[mode])
        if (path.startsWith("/study/")) {
            String subPath = path.substring("/study/".length());
            int slashIdx = subPath.indexOf('/');
            if (slashIdx >= 0) {
                String mode = subPath.substring(slashIdx + 1);
                if (mode.endsWith("/")) mode = mode.substring(0, mode.length() - 1);
                String studyHtmlAsset = "public/study/_offline/" + mode + ".html";
                try {
                    InputStream is = getAssets().open(studyHtmlAsset);
                    is.close();
                    return defaultClient.shouldInterceptRequest(view, rewriteRequest(request, "/study/_offline/" + mode + ".html"));
                } catch (IOException e) {
                    return defaultClient.shouldInterceptRequest(view, rewriteRequest(request, "/study/_offline.html"));
                }
            } else {
                return defaultClient.shouldInterceptRequest(view, rewriteRequest(request, "/study/_offline.html"));
            }
        }

        // 3. Known page routes (/feed, /leaderboard, /download, /search, /new-deck, /offline)
        String cleanPath = path.startsWith("/") ? path.substring(1) : path;
        if (cleanPath.endsWith("/")) cleanPath = cleanPath.substring(0, cleanPath.length() - 1);
        if (!cleanPath.isEmpty() && !cleanPath.contains(".")) {
            String htmlAsset = "public/" + cleanPath + ".html";
            try {
                InputStream test = getAssets().open(htmlAsset);
                test.close();
                return defaultClient.shouldInterceptRequest(view, rewriteRequest(request, "/" + cleanPath + ".html"));
            } catch (IOException ignored) {}
        }

        // 4. API endpoints proxying (feed, folders, status)
        if (path.startsWith("/api/")) {
            if (!"GET".equalsIgnoreCase(request.getMethod()) && !"HEAD".equalsIgnoreCase(request.getMethod())) {
                return null;
            }
            return proxyApiRequest(request);
        }

        return null;
    }

    private WebResourceRequest rewriteRequest(WebResourceRequest original, String newPath) {
        Uri originalUri = original.getUrl();
        Uri newUri = originalUri.buildUpon().path(newPath).build();
        return new WebResourceRequest() {
            @Override
            public Uri getUrl() { return newUri; }
            @Override
            public boolean isForMainFrame() { return original.isForMainFrame(); }
            @Override
            public boolean isRedirect() { return original.isRedirect(); }
            @Override
            public boolean hasGesture() { return original.hasGesture(); }
            @Override
            public String getMethod() { return original.getMethod(); }
            @Override
            public Map<String, String> getRequestHeaders() { return original.getRequestHeaders(); }
        };
    }

    private String resolveRscAsset(String path) {
        if ("/".equals(path) || path.isEmpty()) {
            return "public/index.rsc";
        }
        String clean = path.startsWith("/") ? path.substring(1) : path;
        if (clean.endsWith("/")) clean = clean.substring(0, clean.length() - 1);

        if ("feed".equals(clean)) return "public/feed.rsc";
        if ("leaderboard".equals(clean)) return "public/leaderboard.rsc";
        if ("download".equals(clean)) return "public/download.rsc";
        if ("search".equals(clean)) return "public/search.rsc";
        if ("new-deck".equals(clean)) return "public/new-deck.rsc";
        if ("offline".equals(clean)) return "public/offline.rsc";

        if (clean.startsWith("study/")) {
            String sub = clean.substring("study/".length());
            int idx = sub.indexOf('/');
            if (idx >= 0) {
                String mode = sub.substring(idx + 1);
                return "public/study/_offline/" + mode + ".rsc";
            }
            return "public/study/_offline.rsc";
        }
        return null;
    }

    private WebResourceResponse proxyApiRequest(WebResourceRequest request) {
        try {
            Uri uri = request.getUrl();
            String query = uri.getQuery();
            String targetUrl = REMOTE_API_BASE + uri.getPath() + (query != null ? "?" + query : "");

            HttpURLConnection conn = (HttpURLConnection) new URL(targetUrl).openConnection();
            conn.setRequestMethod(request.getMethod());
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(60000);

            if (request.getRequestHeaders() != null) {
                for (Map.Entry<String, String> entry : request.getRequestHeaders().entrySet()) {
                    if (!"Host".equalsIgnoreCase(entry.getKey())) {
                        conn.setRequestProperty(entry.getKey(), entry.getValue());
                    }
                }
            }

            int code = conn.getResponseCode();
            if (code == 200 && "/api/folders".equals(uri.getPath())) {
                ByteArrayInputStream bais = readAndCheckEmpty(conn.getInputStream());
                if (bais != null) {
                    return new WebResourceResponse("application/json", "UTF-8", 200, "OK", null, bais);
                } else {
                    return new WebResourceResponse("application/json", "UTF-8", 200, "OK", null,
                            new ByteArrayInputStream(DEFAULT_FOLDERS_JSON.getBytes(StandardCharsets.UTF_8)));
                }
            }

            InputStream is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
            String contentType = conn.getContentType();
            String mimeType = "application/json";
            String encoding = "UTF-8";
            if (contentType != null) {
                String[] parts = contentType.split(";");
                mimeType = parts[0].trim();
            }

            return new WebResourceResponse(mimeType, encoding, code, conn.getResponseMessage(), null, is);
        } catch (Exception e) {
            Log.w(TAG, "Offline API fallback for: " + request.getUrl().getPath());
            if (request.getUrl() != null && "/api/folders".equals(request.getUrl().getPath())) {
                return new WebResourceResponse("application/json", "UTF-8", 200, "OK", null,
                        new ByteArrayInputStream(DEFAULT_FOLDERS_JSON.getBytes(StandardCharsets.UTF_8)));
            }
            return new WebResourceResponse("application/json", "UTF-8", 200, "OK", null,
                    new ByteArrayInputStream("{}".getBytes(StandardCharsets.UTF_8)));
        }
    }

    private ByteArrayInputStream readAndCheckEmpty(InputStream is) {
        try {
            java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
            int nRead;
            byte[] data = new byte[1024];
            while ((nRead = is.read(data, 0, data.length)) != -1) {
                buffer.write(data, 0, nRead);
            }
            buffer.flush();
            byte[] bytes = buffer.toByteArray();
            String text = new String(bytes, StandardCharsets.UTF_8).trim();
            if (text.isEmpty() || "[]".equals(text) || "null".equals(text)) {
                return null;
            }
            return new ByteArrayInputStream(bytes);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void playOpeningSound() {
        try {
            android.media.MediaPlayer player = android.media.MediaPlayer.create(this, R.raw.custom_sound_1);
            if (player != null) {
                player.setOnCompletionListener(android.media.MediaPlayer::release);
                player.start();
                Log.i(TAG, "App opening sound played successfully");
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to play app opening sound", e);
        }
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;

        if (intent.getBooleanExtra("trigger_test_notification", false)) {
            StudyUpFirebaseMessagingService.triggerTestNotification(this);
        }

        // Handle notification click route
        String route = intent.getStringExtra("route");
        if (route != null && !route.isEmpty() && getBridge() != null && getBridge().getWebView() != null) {
            final String targetUrl = getBridge().getAppUrl() + (route.startsWith("/") ? route.substring(1) : route);
            getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(targetUrl));
        }

        // Handle auth deep links
        Uri data = intent.getData();
        if (data != null && ("studyup".equalsIgnoreCase(data.getScheme()) || "com.studyup.app".equalsIgnoreCase(data.getScheme()))) {
            String urlStr = data.toString();
            Log.i(TAG, "Auth deep link caught: " + urlStr);

            if (getBridge() != null && getBridge().getWebView() != null) {
                // 1. Close in-app browser sheet if open
                final String closeBrowserJs = "if (window.Capacitor?.Plugins?.Browser?.close) { window.Capacitor.Plugins.Browser.close().catch(function(){}); }";
                getBridge().getWebView().post(() ->
                    getBridge().getWebView().evaluateJavascript(closeBrowserJs, null)
                );

                // 2. Reconstruct the auth callback path with all query params and fragment
                String query = data.getEncodedQuery();
                String fragment = data.getEncodedFragment();
                StringBuilder callbackPath = new StringBuilder("/auth/callback");
                if (query != null && !query.isEmpty()) {
                    callbackPath.append("?").append(query);
                }
                if (fragment != null && !fragment.isEmpty()) {
                    callbackPath.append("#").append(fragment);
                }

                final String targetPath = callbackPath.toString();
                Log.i(TAG, "Forwarding auth callback to WebView: " + targetPath);

                getBridge().getWebView().post(() -> {
                    String navJs = "window.location.href = " + jsStringLiteral(targetPath) + ";";
                    getBridge().getWebView().evaluateJavascript(navJs, null);
                });
            }
        }
    }

    private static String jsStringLiteral(String s) {
        return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }
}
