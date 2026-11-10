package com.studyup.app;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.widget.Toast;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeDeckStorage")
public class NativeDeckStoragePlugin extends Plugin {

    private static final String TAG = "NativeDeckStorage";
    private static final String DECKS_DIR_NAME = "decks";

    public static boolean saveBase64ToDownloads(Context context, android.app.Activity activity, String filename, String base64Data, String mimeType) {
        if (context == null || filename == null || base64Data == null) return false;
        if (mimeType == null || mimeType.isEmpty()) mimeType = "application/octet-stream";

        try {
            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }
            byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);

            Uri savedUri = null;
            File savedFile = null;

            // 1. Primary: Try MediaStore on Android 10+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                    savedUri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (savedUri != null) {
                        try (OutputStream os = context.getContentResolver().openOutputStream(savedUri)) {
                            if (os != null) {
                                os.write(fileBytes);
                                os.flush();
                            }
                        }
                        values.clear();
                        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                        context.getContentResolver().update(savedUri, values, null, null);
                    }
                } catch (Exception msErr) {
                    Log.w(TAG, "MediaStore insert failed, attempting direct filesystem fallback: " + msErr.getMessage());
                    savedUri = null;
                }
            }

            // 2. Fallback: Public or App External Downloads directory
            if (savedUri == null) {
                File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (downloadDir == null || !downloadDir.exists() || !downloadDir.canWrite()) {
                    downloadDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                }
                if (downloadDir == null || (!downloadDir.exists() && !downloadDir.mkdirs())) {
                    downloadDir = context.getFilesDir();
                }

                savedFile = new File(downloadDir, filename);
                try (FileOutputStream fos = new FileOutputStream(savedFile)) {
                    fos.write(fileBytes);
                    fos.flush();
                }

                try {
                    savedUri = androidx.core.content.FileProvider.getUriForFile(
                            context,
                            context.getPackageName() + ".fileprovider",
                            savedFile
                    );
                } catch (Exception fpErr) {
                    savedUri = Uri.fromFile(savedFile);
                }
            }

            // 3. Prompt user to open or share the exported document
            final Uri finalUri = savedUri;
            final String finalMime = mimeType;
            Handler mainHandler = new Handler(Looper.getMainLooper());
            mainHandler.post(() -> {
                Toast.makeText(context, "Saved " + filename + " to Downloads", Toast.LENGTH_LONG).show();

                if (finalUri != null) {
                    try {
                        Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                        viewIntent.setDataAndType(finalUri, finalMime);
                        viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

                        Intent chooser = Intent.createChooser(viewIntent, "Open " + filename);
                        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

                        if (activity != null) {
                            activity.startActivity(chooser);
                        } else {
                            context.startActivity(chooser);
                        }
                    } catch (Exception err) {
                        Log.w(TAG, "Could not open viewer chooser: " + err.getMessage());
                    }
                }
            });

            return true;
        } catch (Exception e) {
            Log.e(TAG, "Error saving base64 to downloads: " + e.getMessage(), e);
            return false;
        }
    }

    @PluginMethod
    public void saveFileToDownloads(PluginCall call) {
        String filename = call.getString("filename");
        String base64Data = call.getString("base64Data");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (filename == null || base64Data == null) {
            call.reject("Missing filename or base64Data");
            return;
        }

        boolean ok = saveBase64ToDownloads(getContext(), getActivity(), filename, base64Data, mimeType);
        if (ok) {
            JSObject res = new JSObject();
            res.put("success", true);
            res.put("directory", "Downloads");
            call.resolve(res);
        } else {
            call.reject("Failed to save file to Downloads folder");
        }
    }

    private File getDecksDir() {
        Context context = getContext();
        File dir = context.getExternalFilesDir(DECKS_DIR_NAME);
        if (dir == null) {
            dir = new File(context.getFilesDir(), DECKS_DIR_NAME);
        }
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    @PluginMethod
    public void saveDeckJSON(PluginCall call) {
        String id = call.getString("id");
        String title = call.getString("title", "Untitled Deck");
        String jsonContent = call.getString("jsonContent");
        String subject = call.getString("subject", "General");

        if (id == null || id.isEmpty()) {
            call.reject("Missing required deck id");
            return;
        }

        if (jsonContent == null) {
            call.reject("Missing jsonContent");
            return;
        }

        try {
            File dir = getDecksDir();
            File jsonFile = new File(dir, id + "_data.json");
            File metaFile = new File(dir, id + ".json");

            // Write JSON
            try (FileOutputStream fos = new FileOutputStream(jsonFile)) {
                fos.write(jsonContent.getBytes(StandardCharsets.UTF_8));
            }

            // Write Meta
            JSObject meta = new JSObject();
            meta.put("id", id);
            meta.put("title", title);
            meta.put("subject", subject);
            meta.put("updatedAt", System.currentTimeMillis());

            try (FileOutputStream fos = new FileOutputStream(metaFile)) {
                fos.write(meta.toString().getBytes(StandardCharsets.UTF_8));
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("filePath", jsonFile.getAbsolutePath());
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error saving deck JSON", e);
            call.reject("Failed to save deck JSON: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getDeckJSON(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("Missing deck id");
            return;
        }

        try {
            File dir = getDecksDir();
            File jsonFile = new File(dir, id + "_data.json");
            File metaFile = new File(dir, id + ".json");

            if (!jsonFile.exists()) {
                call.reject("Deck file not found: " + id);
                return;
            }

            String jsonContent;
            try (FileInputStream fis = new FileInputStream(jsonFile)) {
                byte[] data = new byte[(int) jsonFile.length()];
                fis.read(data);
                jsonContent = new String(data, StandardCharsets.UTF_8);
            }

            String title = "Untitled Deck";
            String subject = "General";

            if (metaFile.exists()) {
                try (FileInputStream fis = new FileInputStream(metaFile)) {
                    byte[] data = new byte[(int) metaFile.length()];
                    fis.read(data);
                    String metaJson = new String(data, StandardCharsets.UTF_8);
                    JSONObject obj = new JSONObject(metaJson);
                    title = obj.optString("title", title);
                    subject = obj.optString("subject", subject);
                } catch (Exception ignored) {}
            }

            JSObject result = new JSObject();
            result.put("id", id);
            result.put("title", title);
            result.put("subject", subject);
            result.put("jsonContent", jsonContent);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error getting deck JSON", e);
            call.reject("Failed to get deck JSON: " + e.getMessage());
        }
    }

    @PluginMethod
    public void listSavedDecks(PluginCall call) {
        try {
            File dir = getDecksDir();
            File[] files = dir.listFiles((d, name) -> name.endsWith("_data.json"));
            JSArray deckList = new JSArray();

            if (files != null) {
                for (File file : files) {
                    String name = file.getName();
                    String id = name.substring(0, name.length() - 10);
                    File metaFile = new File(dir, id + ".json");

                    String title = id;
                    String subject = "General";

                    if (metaFile.exists()) {
                        try (FileInputStream fis = new FileInputStream(metaFile)) {
                            byte[] data = new byte[(int) metaFile.length()];
                            fis.read(data);
                            String metaJson = new String(data, StandardCharsets.UTF_8);
                            JSONObject obj = new JSONObject(metaJson);
                            title = obj.optString("title", title);
                            subject = obj.optString("subject", subject);
                        } catch (Exception ignored) {}
                    }

                    JSObject item = new JSObject();
                    item.put("id", id);
                    item.put("title", title);
                    item.put("subject", subject);
                    item.put("sizeBytes", file.length());
                    item.put("lastModified", file.lastModified());
                    deckList.put(item);
                }
            }

            JSObject result = new JSObject();
            result.put("decks", deckList);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error listing saved decks", e);
            call.reject("Failed to list saved decks: " + e.getMessage());
        }
    }

    @PluginMethod
    public void deleteDeckJSON(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("Missing deck id");
            return;
        }

        try {
            File dir = getDecksDir();
            File jsonFile = new File(dir, id + "_data.json");
            File metaFile = new File(dir, id + ".json");

            boolean deleted = false;
            if (jsonFile.exists()) {
                deleted = jsonFile.delete();
            }
            if (metaFile.exists()) {
                metaFile.delete();
            }

            JSObject result = new JSObject();
            result.put("success", deleted);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error deleting deck JSON", e);
            call.reject("Failed to delete deck JSON: " + e.getMessage());
        }
    }
}
