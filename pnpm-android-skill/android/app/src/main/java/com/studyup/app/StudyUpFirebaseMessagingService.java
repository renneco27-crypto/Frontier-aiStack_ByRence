package com.studyup.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class StudyUpFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "StudyUpFCM";
    public static final String CHANNEL_ID = "studyup_notifications_sound_v6";
    public static final String DECK_CHANNEL_ID = "studyup_deck_notifications_sound_v6";
    public static final String CHANNEL_NAME = "StudyUp Notifications";

    private static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB display limit
    private static final int CONNECT_TIMEOUT_MS = 5000;
    private static final int READ_TIMEOUT_MS = 6000;
    private static final int MAX_REDIRECTS = 3;

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        // Clean up legacy channels that may have cached old sound/vibration flags
        try {
            manager.deleteNotificationChannel("studyup_notifications_vibrate_v5");
            manager.deleteNotificationChannel("studyup_deck_notifications_v5");
        } catch (Exception ignored) {}

        Uri soundUri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" +
                context.getPackageName() + "/raw/custom_sound_1");
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Notifications for StudyUp decks and updates");
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[] { 0, 350, 180, 350 });
            channel.setSound(soundUri, audioAttributes);
            manager.createNotificationChannel(channel);
        }

        if (manager.getNotificationChannel(DECK_CHANNEL_ID) == null) {
            NotificationChannel deckChannel = new NotificationChannel(
                    DECK_CHANNEL_ID, "New Decks", NotificationManager.IMPORTANCE_HIGH);
            deckChannel.setDescription("Notifications when someone publishes a deck");
            deckChannel.enableLights(true);
            deckChannel.enableVibration(true);
            deckChannel.setVibrationPattern(new long[] { 0, 350, 180, 350 });
            deckChannel.setSound(soundUri, audioAttributes);
            manager.createNotificationChannel(deckChannel);
        }
    }

    public static void triggerTestNotification(Context context) {
        ensureChannel(context);
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        Uri soundUri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" +
                context.getPackageName() + "/raw/custom_sound_1");

        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("route", "/feed");

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pi = PendingIntent.getActivity(context, (int) System.currentTimeMillis(), intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, DECK_CHANNEL_ID)
                .setSmallIcon(context.getApplicationInfo().icon)
                .setContentTitle("New Deck Published!")
                .setContentText("StudyUp: Custom sound & vibration active")
                .setAutoCancel(true)
                .setSound(soundUri)
                .setVibrate(new long[] { 0, 350, 180, 350 })
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pi);

        manager.notify((int) System.currentTimeMillis(), builder.build());
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.i(TAG, "New FCM Token received: " + token);
        // Persist token to SharedPreferences so Capacitor plugin can fetch it
        getSharedPreferences("studyup_fcm_prefs", Context.MODE_PRIVATE)
                .edit()
                .putString("fcm_token", token)
                .apply();

        // Native auto-subscribe token to global broadcast topic
        try {
            com.google.firebase.messaging.FirebaseMessaging.getInstance().subscribeToTopic("all_devices");
        } catch (Exception e) {
            Log.w(TAG, "Failed auto-subscribing onNewToken to all_devices", e);
        }
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.i(TAG, "FCM message received from: " + remoteMessage.getFrom());

        String title = "StudyUp";
        String body = "";
        Map<String, String> data = remoteMessage.getData();
        Log.i(TAG, "FCM data payload keys: " + data.keySet());
        Log.i(TAG, "FCM image_url present: " + (data.get("image_url") != null && !data.get("image_url").trim().isEmpty()));

        if (remoteMessage.getNotification() != null) {
            if (remoteMessage.getNotification().getTitle() != null) {
                title = remoteMessage.getNotification().getTitle();
            }
            if (remoteMessage.getNotification().getBody() != null) {
                body = remoteMessage.getNotification().getBody();
            }
        }

        // Fallback or override from data payload
        if (data.containsKey("title")) {
            title = data.get("title");
        }
        if (data.containsKey("body")) {
            body = data.get("body");
        } else if (data.containsKey("message")) {
            body = data.get("message");
        }

        if (body == null || body.trim().isEmpty()) {
            body = "You have a new update in StudyUp!";
        }

        showNotification(title, body, data);
    }

    private void showNotification(String title, String body, Map<String, String> data) {
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        Uri soundUri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/raw/custom_sound_1");
        boolean isDeckPublished = data != null && "deck_published_broadcast".equals(data.get("type"));
        String channelId = isDeckPublished ? DECK_CHANNEL_ID : CHANNEL_ID;

        // Create high-importance notification channel with custom sound on Android 8+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    channelId,
                    isDeckPublished ? "New Decks" : CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(isDeckPublished
                    ? "Notifications when someone publishes a deck"
                    : "Notifications for StudyUP queries and background jobs");
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[] { 0, 350, 180, 350 });

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();
            channel.setSound(soundUri, audioAttributes);

            notificationManager.createNotificationChannel(channel);
        }

        // Validate and determine target in-app route for app taps
        String validatedRoute = NotificationActionHelper.sanitizeAppRoute(data != null ? data.get("route") : null);
        if (validatedRoute == null) {
            validatedRoute = NotificationActionHelper.sanitizeAppRoute(data != null ? data.get("url") : null);
        }
        if (validatedRoute == null) {
            validatedRoute = "/feed";
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        int notificationId = (int) System.currentTimeMillis();

        // Determine main notification tap action (open app route vs open image URL if configured)
        Intent contentIntent;
        String rawImageUrl = data != null ? data.get("image_url") : null;
        boolean hasValidImageUrl = NotificationActionHelper.isValidWebUrl(rawImageUrl);

        String tapTarget = null;
        if (data != null) {
            tapTarget = data.get("open_image_url");
            if (tapTarget == null) tapTarget = data.get("image_tap_action");
            if (tapTarget == null) tapTarget = data.get("open_image");
        }

        if (tapTarget != null && hasValidImageUrl) {
            String normTarget = tapTarget.trim().toLowerCase(Locale.ROOT);
            if ("browser".equals(normTarget) || "external".equals(normTarget)) {
                contentIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(rawImageUrl.trim()));
                contentIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            } else if ("app".equals(normTarget) || "true".equals(normTarget)) {
                contentIntent = createMainRouteIntent(validatedRoute, data);
                contentIntent.putExtra("image_url", rawImageUrl.trim());
            } else {
                contentIntent = createMainRouteIntent(validatedRoute, data);
            }
        } else {
            contentIntent = createMainRouteIntent(validatedRoute, data);
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(this, notificationId, contentIntent, flags);

        int smallIcon = getApplicationInfo().icon;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(smallIcon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setSound(soundUri)
                .setVibrate(new long[] { 0, 350, 180, 350 })
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent);

        // Download and attach notification image if available (decodes static frame for GIFs)
        Bitmap image = downloadNotificationImage(rawImageUrl);
        if (image != null) {
            builder.setLargeIcon(image)
                    .setStyle(new NotificationCompat.BigPictureStyle()
                            .bigPicture(image)
                            .bigLargeIcon((Bitmap) null)
                            .setSummaryText(body));
            Log.i(TAG, "Notification image decoded and attached to BigPictureStyle");
        } else if (data != null && data.containsKey("image_url")) {
            Log.w(TAG, "Notification image was provided but could not be rendered");
        }

        if (isDeckPublished) {
            Intent viewIntent = new Intent(this, MainActivity.class);
            viewIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            String deckRoute = NotificationActionHelper.sanitizeAppRoute(data.get("route"));
            if (deckRoute == null) deckRoute = "/feed";
            viewIntent.putExtra("route", deckRoute);
            viewIntent.putExtra("url", deckRoute);
            PendingIntent viewPendingIntent = PendingIntent.getActivity(
                    this, notificationId + 1, viewIntent, flags);
            builder.addAction(0, "View Deck", viewPendingIntent);

            Intent cancelIntent = new Intent(this, NotificationActionReceiver.class);
            cancelIntent.putExtra(NotificationActionReceiver.EXTRA_NOTIFICATION_ID, notificationId);
            PendingIntent cancelPendingIntent = PendingIntent.getBroadcast(
                    this, notificationId + 2, cancelIntent, flags);
            builder.addAction(0, "Cancel", cancelPendingIntent);
        } else {
            addCustomButtons(builder, data, notificationId, flags);
        }

        notificationManager.notify(notificationId, builder.build());

        // For legacy Android (< Oreo) where notification channels don't exist, provide single vibration
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            try {
                android.os.Vibrator v = (android.os.Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    v.vibrate(new long[] { 0, 350, 180, 350 }, -1);
                }
            } catch (Exception ignored) {}
        }
    }

    private Intent createMainRouteIntent(String validatedRoute, Map<String, String> data) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("route", validatedRoute);
        intent.putExtra("url", validatedRoute);

        if (data != null) {
            for (Map.Entry<String, String> entry : data.entrySet()) {
                if (!"route".equals(entry.getKey()) && !"url".equals(entry.getKey())) {
                    intent.putExtra(entry.getKey(), entry.getValue());
                }
            }
        }
        return intent;
    }

    private Bitmap downloadNotificationImage(String imageUrl) {
        if (!NotificationActionHelper.isValidWebUrl(imageUrl)) {
            return null;
        }

        String currentUrl = imageUrl.trim();
        HttpURLConnection connection = null;

        for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
            try {
                URL url = new URL(currentUrl);
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                connection.setReadTimeout(READ_TIMEOUT_MS);
                connection.setInstanceFollowRedirects(false); // Manually handle redirects safely
                connection.setRequestProperty("Accept", "image/*");
                connection.connect();

                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) {
                    String location = connection.getHeaderField("Location");
                    connection.disconnect();
                    connection = null;
                    if (location == null || location.trim().isEmpty()) {
                        Log.w(TAG, "Notification image redirect without Location header");
                        return null;
                    }
                    URL nextUrl = new URL(url, location.trim());
                    currentUrl = nextUrl.toString();
                    if (!NotificationActionHelper.isValidWebUrl(currentUrl)) {
                        Log.w(TAG, "Notification image redirected to non-HTTPS or invalid target");
                        return null;
                    }
                    continue;
                }

                String contentType = connection.getContentType();
                int contentLength = connection.getContentLength();
                if (status < 200 || status >= 300 || contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
                    Log.w(TAG, "Notification image fetch returned HTTP " + status + " with type " + contentType);
                    return null;
                }
                if (contentLength > MAX_IMAGE_BYTES) {
                    Log.w(TAG, "Notification image exceeds size limit of 5 MB");
                    return null;
                }

                try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192];
                    int total = 0;
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        total += read;
                        if (total > MAX_IMAGE_BYTES) {
                            Log.w(TAG, "Notification image exceeded 5 MB size limit while downloading");
                            return null;
                        }
                        output.write(buffer, 0, read);
                    }

                    byte[] imageBytes = output.toByteArray();

                    // Measure image dimensions safely to avoid unbounded memory allocation
                    BitmapFactory.Options boundsOptions = new BitmapFactory.Options();
                    boundsOptions.inJustDecodeBounds = true;
                    BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length, boundsOptions);

                    if (boundsOptions.outWidth <= 0 || boundsOptions.outHeight <= 0) {
                        Log.w(TAG, "Notification image dimensions could not be decoded");
                        return null;
                    }

                    // Downsample if dimensions exceed standard 1920px max dimension
                    int maxDim = 1920;
                    int sampleSize = 1;
                    while ((boundsOptions.outWidth / sampleSize) > maxDim || (boundsOptions.outHeight / sampleSize) > maxDim) {
                        sampleSize *= 2;
                    }

                    BitmapFactory.Options decodeOptions = new BitmapFactory.Options();
                    decodeOptions.inSampleSize = sampleSize;
                    decodeOptions.inPreferredConfig = Bitmap.Config.ARGB_8888;

                    // Decodes representative static frame (e.g. frame 1 for animated GIFs)
                    Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length, decodeOptions);
                    if (bitmap == null) {
                        Log.w(TAG, "Downloaded notification image could not be decoded to Bitmap");
                    }
                    return bitmap;
                }
            } catch (Exception e) {
                Log.w(TAG, "Could not load notification image: " + e.getClass().getSimpleName());
                return null;
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }

        Log.w(TAG, "Notification image exceeded max redirects");
        return null;
    }

    private void addCustomButtons(NotificationCompat.Builder builder, Map<String, String> data, int notificationId, int flags) {
        if (data == null) return;
        String rawButtons = data.get("buttons");
        if (rawButtons == null || rawButtons.trim().isEmpty()) return;

        try {
            List<NotificationActionHelper.ParsedButton> buttons = NotificationActionHelper.parseButtons(rawButtons);
            for (int i = 0; i < buttons.size(); i++) {
                NotificationActionHelper.ParsedButton button = buttons.get(i);
                if (button.type == NotificationActionHelper.ActionType.APP) {
                    Intent appIntent = new Intent(this, MainActivity.class);
                    appIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    appIntent.putExtra("route", button.target);
                    appIntent.putExtra("url", button.target);
                    PendingIntent actionPendingIntent = PendingIntent.getActivity(
                            this, notificationId + 10 + i, appIntent, flags);
                    builder.addAction(0, button.text, actionPendingIntent);
                } else if (button.type == NotificationActionHelper.ActionType.WEB) {
                    Intent webIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(button.target));
                    webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    PendingIntent actionPendingIntent = PendingIntent.getActivity(
                            this, notificationId + 10 + i, webIntent, flags);
                    builder.addAction(0, button.text, actionPendingIntent);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error adding notification buttons", e);
        }
    }
}
