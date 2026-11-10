package com.studyup.app;

import android.content.Intent;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.database.Cursor;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "SharedFile")
public class SharedFilePlugin extends Plugin {
    private JSArray pendingFiles = null;

    public void handleIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        java.util.ArrayList<Uri> uris = new java.util.ArrayList<>();

        if (Intent.ACTION_SEND.equals(action)) {
            Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (uri != null) {
                uris.add(uri);
            } else {
                String text = intent.getStringExtra(Intent.EXTRA_TEXT);
                if (text != null && !text.isEmpty()) {
                    android.util.Log.w("StudyUp", "Share had no EXTRA_STREAM; EXTRA_TEXT = " + text);
                }
            }
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            java.util.ArrayList<Uri> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) uris.addAll(list);
        } else if (Intent.ACTION_VIEW.equals(action)) {
            // Triggered by "Open with StudyUp" from a file manager / viewer / browser
            Uri uri = intent.getData();
            if (uri != null) {
                uris.add(uri);
            } else {
                android.util.Log.w("StudyUp", "ACTION_VIEW intent has no data URI");
            }
        } else {
            return;
        }
        if (uris.isEmpty()) return;

        JSArray files = new JSArray();
        for (Uri uri : uris) {
            try {
                File cached = copyToCache(uri);
                if (cached != null) {
                    JSObject entry = new JSObject();
                    entry.put("name", cached.getName());
                    entry.put("path", cached.getAbsolutePath());
                    entry.put("size", cached.length());
                    String mime = getContext().getContentResolver().getType(uri);
                    entry.put("mimeType", mime != null ? mime : "application/octet-stream");
                    files.put(entry);
                    android.util.Log.d("StudyUp", "SharedFile cached: " + cached.getAbsolutePath() + " (" + cached.length() + " bytes)");
                }
            } catch (Exception e) {
                android.util.Log.e("StudyUp", "Failed to cache shared file: " + e.getMessage(), e);
            }
        }
        if (files.length() == 0) return;

        JSObject ret = new JSObject();
        ret.put("files", files);
        notifyListeners("sharedFiles", ret, true);
        pendingFiles = files;
    }

    private File copyToCache(Uri uri) throws Exception {
        String name = queryDisplayName(uri);
        if (name == null || name.isEmpty()) {
            name = "shared-" + System.currentTimeMillis();
        }
        File dir = new File(getContext().getCacheDir(), "shared");
        if (!dir.exists()) dir.mkdirs();
        File out = new File(dir, name);
        if (out.exists()) out.delete();

        try (InputStream in = getContext().getContentResolver().openInputStream(uri);
             OutputStream os = new FileOutputStream(out)) {
            if (in == null) return null;
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
        }
        return out;
    }

    private String queryDisplayName(Uri uri) {
        Cursor c = null;
        try {
            c = getContext().getContentResolver().query(uri, null, null, null, null);
            if (c != null && c.moveToFirst()) {
                int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) {
                    String raw = c.getString(idx);
                    if (raw != null) {
                        // Strip query strings (?s=1) and unsafe chars that break file:// URLs
                        return raw.split("\\?")[0].replaceAll("[\\\\/:*?\"<>|]", "_");
                    }
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
        String path = uri.getLastPathSegment();
        return path != null ? new File(path).getName() : null;
    }

    @PluginMethod
    public void getPendingFiles(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("files", pendingFiles != null ? pendingFiles : new JSArray());
        call.resolve(ret);
        if (pendingFiles != null) {
            final JSArray snapshot = pendingFiles;
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                if (pendingFiles == snapshot) pendingFiles = null;
            }, 10_000);
        }
    }
}
