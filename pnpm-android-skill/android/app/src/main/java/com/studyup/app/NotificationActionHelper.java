package com.studyup.app;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * Validates in-app routes, external URLs, and notification button payloads.
 */
public final class NotificationActionHelper {

    private static final int MAX_BUTTONS = 3;
    private static final int MAX_TEXT_LENGTH = 32;

    public enum ActionType {
        APP,
        WEB
    }

    public static final class ParsedButton {
        public final String text;
        public final ActionType type;
        public final String target; // Validated route for APP, validated HTTPS URL for WEB

        public ParsedButton(String text, ActionType type, String target) {
            this.text = text;
            this.type = type;
            this.target = target;
        }

        @Override
        public String toString() {
            return "ParsedButton{text='" + text + "', type=" + type + ", target='" + target + "'}";
        }
    }

    private NotificationActionHelper() {
        // Utility class
    }

    /**
     * Validates that a route is a safe in-app route.
     * Must begin with exactly one '/', reject '//', schemes, backslashes, control characters,
     * path traversal, and malformed paths.
     */
    public static boolean isValidAppRoute(String route) {
        if (route == null) return false;

        // Reject any string containing ASCII control characters or null bytes
        for (int i = 0; i < route.length(); i++) {
            char c = route.charAt(i);
            if (c < 32 || c == 127) {
                return false;
            }
        }

        String trimmed = route.trim();
        if (trimmed.isEmpty()) return false;

        // Must start with exactly one '/' and not '//'
        if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
            return false;
        }

        // Must not contain backslashes
        if (trimmed.contains("\\")) {
            return false;
        }

        // Must not contain spaces in path
        if (trimmed.contains(" ")) {
            return false;
        }

        // Path traversal checks
        if (trimmed.equals("/..") || trimmed.startsWith("/../") || trimmed.contains("/../") || trimmed.endsWith("/..")) {
            return false;
        }

        // Must not contain '://' anywhere
        if (trimmed.contains("://")) {
            return false;
        }

        // Before '?' or '#', there must not be any ':' (which could denote a scheme like /javascript: or /http:)
        int queryOrHashIdx = trimmed.length();
        int qIdx = trimmed.indexOf('?');
        if (qIdx != -1) queryOrHashIdx = Math.min(queryOrHashIdx, qIdx);
        int hIdx = trimmed.indexOf('#');
        if (hIdx != -1) queryOrHashIdx = Math.min(queryOrHashIdx, hIdx);

        String pathPart = trimmed.substring(0, queryOrHashIdx);
        if (pathPart.contains(":")) {
            return false;
        }

        // Try android.net.Uri check if available at runtime
        try {
            android.net.Uri uri = android.net.Uri.parse(trimmed);
            if (uri != null) {
                if (uri.getScheme() != null || uri.getAuthority() != null || uri.getHost() != null) {
                    return false;
                }
            }
        } catch (Throwable ignored) {
            // JVM unit test fallback when android.net.Uri is not mocked
        }

        return true;
    }

    /**
     * Returns the trimmed valid app route, or null if invalid.
     */
    public static String sanitizeAppRoute(String route) {
        if (route == null) return null;
        String trimmed = route.trim();
        return isValidAppRoute(trimmed) ? trimmed : null;
    }

    /**
     * Validates that an external URL is HTTPS-only, with valid host and no control characters.
     */
    public static boolean isValidWebUrl(String url) {
        if (url == null) return false;

        // Reject control characters
        for (int i = 0; i < url.length(); i++) {
            char c = url.charAt(i);
            if (c < 32 || c == 127) {
                return false;
            }
        }

        String trimmed = url.trim();
        if (trimmed.length() < 10 || trimmed.length() > 2048) {
            return false;
        }

        // Must start with https:// (case-insensitive)
        if (!trimmed.toLowerCase(Locale.ROOT).startsWith("https://")) {
            return false;
        }

        // Must not contain spaces
        if (trimmed.contains(" ")) {
            return false;
        }

        // Host validation
        int hostStart = 8; // length of "https://"
        int hostEnd = trimmed.length();
        for (int i = hostStart; i < trimmed.length(); i++) {
            char c = trimmed.charAt(i);
            if (c == '/' || c == '?' || c == '#' || c == ':') {
                hostEnd = i;
                break;
            }
        }

        if (hostEnd <= hostStart) {
            return false;
        }

        String host = trimmed.substring(hostStart, hostEnd);
        if (host.isEmpty() || host.startsWith(".") || host.endsWith(".")) {
            return false;
        }

        // Verify host characters
        for (int i = 0; i < host.length(); i++) {
            char c = host.charAt(i);
            boolean isAlphaNum = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9');
            if (!isAlphaNum && c != '.' && c != '-' && c != '_') {
                return false;
            }
        }

        // Try android.net.Uri check if available at runtime
        try {
            android.net.Uri uri = android.net.Uri.parse(trimmed);
            if (uri != null) {
                String scheme = uri.getScheme();
                if (scheme == null || !"https".equalsIgnoreCase(scheme)) {
                    return false;
                }
                String parsedHost = uri.getHost();
                if (parsedHost == null || parsedHost.trim().isEmpty()) {
                    return false;
                }
            }
        } catch (Throwable ignored) {
            // JVM unit test fallback when android.net.Uri is not mocked
        }

        return true;
    }

    /**
     * Parses and validates raw buttons JSON from FCM data payload.
     * Safe contract:
     * - Web button: {"text": "...", "type": "web", "url": "https://..."}
     * - App button: {"text": "...", "type": "app", "route": "/feed"}
     * - Backward compatible: {"text": "...", "url": "https://..."} or {"text": "...", "url": "/..."}
     * Returns up to 3 valid ParsedButton instances.
     */
    public static List<ParsedButton> parseButtons(String rawButtonsJson) {
        if (rawButtonsJson == null || rawButtonsJson.trim().isEmpty()) {
            return Collections.emptyList();
        }

        List<ParsedButton> result = new ArrayList<>();
        try {
            JSONArray array = new JSONArray(rawButtonsJson.trim());
            for (int i = 0; i < array.length() && result.size() < MAX_BUTTONS; i++) {
                JSONObject obj = array.optJSONObject(i);
                if (obj == null) continue;

                // Parse button label (check "text" or "title")
                String text = obj.optString("text", obj.optString("title", "")).trim();
                if (text.isEmpty() || text.length() > MAX_TEXT_LENGTH) {
                    continue;
                }

                String type = obj.optString("type", "").trim().toLowerCase(Locale.ROOT);
                String route = obj.optString("route", "").trim();
                String url = obj.optString("url", "").trim();

                if ("app".equals(type)) {
                    String targetRoute = !route.isEmpty() ? route : url;
                    if (isValidAppRoute(targetRoute)) {
                        result.add(new ParsedButton(text, ActionType.APP, targetRoute));
                    }
                } else if ("web".equals(type)) {
                    if (isValidWebUrl(url)) {
                        result.add(new ParsedButton(text, ActionType.WEB, url));
                    }
                } else {
                    // Backward-compatible fallback when "type" is omitted
                    if (!route.isEmpty() && isValidAppRoute(route)) {
                        result.add(new ParsedButton(text, ActionType.APP, route));
                    } else if (!url.isEmpty()) {
                        if (isValidAppRoute(url)) {
                            result.add(new ParsedButton(text, ActionType.APP, url));
                        } else if (isValidWebUrl(url)) {
                            result.add(new ParsedButton(text, ActionType.WEB, url));
                        }
                    }
                }
            }
        } catch (Exception ignored) {
            // Malformed JSON payload - ignore corrupt data safely
        }

        return result;
    }
}
