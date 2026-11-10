---
name: pnpm-android
description: Build, bundle, route, and debug high-performance offline-first hybrid Android apps powered by Next.js, Capacitor, PNPM, and Tailwind CSS. Covers offline Java routing, AAPT asset exclusions, 11 common pitfalls and solutions, and zero-bloat standalone APK deployment.
---

# PNPM & Next.js Android Hybrid App Architecture Guide

Use this skill whenever you are building, modifying, bundling, or debugging standalone hybrid Android applications built with **Next.js (App Router), Capacitor, PNPM, and Tailwind CSS**.

This guide encapsulates the battle-tested architectural blueprint, routing mechanisms, asset packaging configurations, security invariants, and a comprehensive catalog of 11 critical hybrid app pitfalls and their verified solutions.

---

## 1. Core Architectural Invariants

### A. The "Standalone Native First" Invariant
* **No Remote Wrapper Reliance**: Standalone APKs must package all static assets (`.next/server/app`, `public/`, fonts, images, compiled CSS) directly inside `android/app/src/main/assets/public/`.
* **Zero Service Worker / Serwist Bloat**: Standalone Android APKs load directly from disk via Capacitor's `WebViewAssetLoader` (`http://localhost`). Service workers (like Serwist / Workbox) are **not needed** inside the APK; they add 30-60s build bloat and risk caching conflicts. The native container is 100% authoritative.
* **Strict Secret Exclusion**: Never bake `.env` files, Supabase service keys, or private API secrets into the APK assets. Sensitive flows (such as Stripe Checkout and AI conversion relays) run through cloud server backends via Capacitor Browser and Supabase Row Level Security (RLS).

---

## 2. Offline Java Routing Blueprint (`MainActivity.java`)

Next.js App Router relies on two navigation mechanisms that normally fail inside an offline Android WebView:
1. **React Server Component (RSC) requests** sent with header `RSC: 1` or query `?_rsc=`.
2. **Client-side route navigations** (`router.push('/feed')`, `/leaderboard`, etc.).

### Custom `BridgeWebViewClient` Implementation:
Attach a custom `BridgeWebViewClient` in `MainActivity.java` overriding `shouldInterceptRequest()`:

```java
@Override
public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
    Uri uri = request.getUrl();
    String host = uri.getHost();
    if (host == null || (!"localhost".equalsIgnoreCase(host) && !"127.0.0.1".equalsIgnoreCase(host))) {
        return null;
    }

    String path = uri.getPath();
    if (path == null) path = "/";

    // 1. Let Capacitor handle _next static assets, public assets, and media files directly
    if (path.startsWith("/_next/") || path.startsWith("/assets/") || path.endsWith(".js")
            || path.endsWith(".css") || path.endsWith(".png") || path.endsWith(".jpg")
            || path.endsWith(".jpeg") || path.endsWith(".gif") || path.endsWith(".svg")
            || path.endsWith(".ico") || path.endsWith(".webmanifest") || path.endsWith(".json")) {
        return null;
    }

    // 2. Next.js RSC requests (client-side transitions)
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

    // 3. Dynamic player routes (/study/[deckId]/[mode])
    if (path.startsWith("/study/")) {
        String subPath = path.substring("/study/".length());
        int slashIdx = subPath.indexOf('/');
        if (slashIdx >= 0) {
            String mode = subPath.substring(slashIdx + 1);
            if (mode.endsWith("/")) mode = mode.substring(0, mode.length() - 1);
            String studyHtmlAsset = "public/study/_offline/" + mode + ".html";
            return defaultClient.shouldInterceptRequest(view, rewriteRequest(request, "/" + studyHtmlAsset));
        }
        return defaultClient.shouldInterceptRequest(view, rewriteRequest(request, "/study/_offline.html"));
    }

    // 4. Known page routes (/feed, /leaderboard, /download, /search, /offline)
    String cleanPath = path.startsWith("/") ? path.substring(1) : path;
    if (cleanPath.endsWith("/")) cleanPath = cleanPath.substring(0, cleanPath.length() - 1);
    if (!cleanPath.isEmpty() && !cleanPath.contains(".")) {
        String htmlAsset = "public/" + cleanPath + ".html";
        return defaultClient.shouldInterceptRequest(view, rewriteRequest(request, "/" + cleanPath + ".html"));
    }

    // 5. API proxying (GET / HEAD)
    if (path.startsWith("/api/")) {
        if (!"GET".equalsIgnoreCase(request.getMethod()) && !"HEAD".equalsIgnoreCase(request.getMethod())) {
            return null; // POST/PUT/DELETE handled directly by Chromium network stack
        }
        return proxyApiRequest(request);
    }

    return null;
}
```

---

## 3. Triple-Guard Security & AAPT Rules (`build.gradle`)

To prevent secret leakage while **guaranteeing Next.js `_next/` assets are preserved**:

### `android/app/build.gradle`:
```groovy
android {
    ...
    aaptOptions {
        // CRITICAL: NEVER include <dir>_* because it strips _next/ (compiled CSS and JS) from APK!
        ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~:.env*:.env'
    }
    packagingOptions {
        resources {
            excludes += ['**/.env*', '**/*.env', '**/META-INF/.env*']
        }
    }
}
```

---

## 4. Asset Synchronization Protocol (`scripts/sync-android-assets.js`)

1. **Precedence**: `public/index.html` must **never** overwrite compiled `.next/server/app/index.html`.
2. **Directory Matching**: Create directory pairs (`public/feed/index.html` + `public/feed/index.rsc`) so WebView loaders can resolve both trailing slash and non-trailing slash routes.
3. **Static Purge & Copy**: Wipe stale `.next/static` from assets and sync fresh compiled chunks.
4. **Recursive `.env` Sweeper**: Remove any accidental `.env` files before packaging.

---

## 5. Master Catalog of 11 Common Pitfalls & Solutions

### [BUG-01] Mangled HTML / Missing CSS in WebView
* **Symptom**: My Library and other tabs render with raw, unstyled HTML without Tailwind styles.
* **Root Cause**: `sync-android-assets.js` copied `public/index.html` (stale export referencing deleted CSS hashes) over `.next/server/app/index.html`.
* **Fix**: In `sync-android-assets.js`, skip `entry.name === 'index.html'` when copying `public/` and sync fresh `.next/server/app/index.html` to `android/app/src/main/assets/public/index.html`.

### [BUG-02] 10MB Feed Payload Timeout & `Unexpected token < doctype`
* **Symptom**: Downloading large 10MB+ decks crashes with `Unexpected token < doctype is not a valid json`.
* **Root Cause**: 6-second timeout in `HttpURLConnection` aborted large payloads and returned a 404 HTML string. Calling `res.json()` threw a syntax error.
* **Fix**: 
  1. Increase connect timeout to 15s and read timeout to 60s in `MainActivity.java`.
  2. Route downloads through `apiUrl('/api/feed/' + id)` and parse response as text first defensively.
  3. Reject strings starting with `<!doctype` or `<html` in parser.

### [BUG-03] Leaderboard 10th Place / Duplicate Account Splitting
* **Symptom**: User with high score is demoted to 10th place with 0 XP.
* **Root Cause**: Multi-database setup (Supabase A and Supabase B) assigned different UUIDs for the same email. Appending a fallback user created a duplicate entry with 0 XP at the bottom.
* **Fix**: Canonical identity matching (email + normalized display name + userId) with **Strict Max Metric Deduplication**: `totalCorrect = Math.max(existing.totalCorrect, candidate.totalCorrect)` and `dayStreak = Math.max(...)`.

### [BUG-04] Flashcard Controls Disabled on Card Front
* **Symptom**: 'I Know' and 'Still Learning' buttons do nothing when clicked on card front.
* **Root Cause**: `useFlashcardSession.ts` had an unnecessary `!isFlipped` guard returning early.
* **Fix**: Remove `!isFlipped` guard so cards can be evaluated from front or back.

### [BUG-05] Enumeration Check Answers Flash / Double Trigger
* **Symptom**: Clicking 'Check Answers' flashes answers for a split second, requiring a second click.
* **Root Cause**: `shuffledItems` was defined using `useCallback(...)()` which regenerated a new array reference on every render, triggering an unintended reset `useEffect`.
* **Fix**: Change `shuffledItems` from `useCallback` to `useMemo(...)`. Guard `EnumerationCard` effect with `prevTopicRef.current !== topic`.

### [BUG-06] Notes Tab Infinite Loading State
* **Symptom**: Opening `/study/[deckId]/notes` gets stuck on infinite loading spinner.
* **Root Cause**: Dynamic route parameter `deckId` was unresolved or undefined in offline WebView.
* **Fix**: Add robust `effectiveDeckId` fallback using `window.location.pathname` regex and `localStorage.getItem('studyup_active_deck_id')`.

### [BUG-07] Gallery Empty Despite Cards Having Images
* **Symptom**: Deck gallery reports empty even when cards have embedded images.
* **Root Cause**: Cards had not synced their embedded base64 images into the Dexie `images` table.
* **Fix**: Add self-healing check in `ImagesClient.tsx`: on mount, inspect `cards` and `deck.sourceJson` and call `bulkCreateImages()` dynamically if empty.

### [BUG-08] AI Chat HTTP 404 in Native App
* **Symptom**: AI chat returns HTTP 404.
* **Root Cause**: `fetch('/api/lab/chat')` requested a relative path on `http://localhost` where no server runs.
* **Fix**: Wrap API calls in `apiUrl(...)`, dynamically resolving to the cloud server on native Android and relative on web.

### [BUG-09] Standalone APK Secret Leaks
* **Symptom**: Standalone APK packages `.env` files into APK assets.
* **Root Cause**: Default Android asset packaging does not exclude `.env` files.
* **Fix**: Add AAPT `ignoreAssetsPattern` with `.env*` exclusions and `packagingOptions.resources.excludes`. Run post-sync purge sweep.

### [BUG-10] Stripe Pro Purchase Cloud Architecture
* **Symptom**: Hardcoded Stripe links gave AWS CloudFront AccessDenied.
* **Root Cause**: Direct payment links expire or require secrets that must not be in the APK.
* **Fix**: Open cloud server (`/api/stripe/checkout?userId=...`) via Capacitor Browser. Upon payment, webhooks update Supabase `user_purchases` with RLS. The app queries Supabase to unlock features.

### [BUG-11] AAPT `<dir>_*` Underscore Stripping (The "No CSS Just HTML" Bug)
* **Symptom**: App launches but renders as raw unstyled HTML with no CSS, and logcat throws `Unable to open asset URL: http://localhost/_next/static/css/...`.
* **Root Cause**: Default AAPT pattern includes `<dir>_*`, instructing Gradle to purge any directory starting with an underscore (`_`). Because Next.js compiles all CSS and JS chunks into `_next/`, AAPT silently strips the entire `_next/` directory from the APK during compilation (0 files in APK's `_next`).
* **Fix**: Remove `<dir>_*` from `ignoreAssetsPattern` in `android/app/build.gradle`:
  ```groovy
  ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~:.env*:.env'
  ```
  Verify with Python `zipfile` that APK contains 180+ `_next` files and all compiled CSS bundles.

---

## 6. Build & Deployment Lifecycle (PNPM)

```bash
# 1. Install dependencies
pnpm install

# 2. Build Next.js application (using Webpack)
pnpm run build

# 3. Synchronize assets to Android container
node scripts/sync-android-assets.js

# 4. Assemble Android Debug APK
cd android
.\gradlew.bat assembleDebug
cd ..

# 5. Fast & Reliable Deployment via ADB Temp Push
adb push android/app/build/outputs/apk/debug/app-debug.apk /data/local/tmp/app.apk
adb shell pm install -r /data/local/tmp/app.apk
adb shell am force-stop com.studyup.app
adb shell am start -n com.studyup.app/.MainActivity

# 6. Publish APK to Supabase Storage Bucket (Zero-config, Open-source)
# Provide your credentials via environment variables (e.g., .env.local):
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
node scripts/upload-apk.js
```
