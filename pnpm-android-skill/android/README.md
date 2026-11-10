# PNPMAndroid (StudyUp Hybrid Architecture)

Production-ready, battle-tested template for building offline-first Android applications powered by **Next.js App Router**, **Capacitor 8**, **pnpm**, and **native Java request interceptors**.

## Key Highlights
- **100% Offline App Router**: Intercepts RSC requests (`text/x-component`) and dynamic routes (`/study/[deckId]/[mode]`) so navigation works completely offline without network latency or 404s.
- **Dual-Mode API Proxying**: Online requests route to the live cloud backend with 60-second read timeouts for large payloads (10MB+); offline requests gracefully fall back to safe JSON structures.
- **Triple-Guard .env Security**: Gradle AAPT `ignoreAssetsPattern` and `packagingOptions.resources.excludes` permanently prevent sensitive credentials or `.env` files from leaking into APK binaries.
- **Cloud Stripe Pro with RLS**: Standalone APK contains zero payment secrets. Purchases execute via Render cloud webviews and are verified with Supabase Row Level Security (RLS) and Relay daemons.

## Architecture Documentation
Read `making android app.txt` for the complete architectural specification, bug catalog, and troubleshooting playbook.

## Getting Started
```bash
# 1. Install dependencies
pnpm install

# 2. Build the Next.js bundle
pnpm run build

# 3. Sync web assets to Android
node scripts/sync-android-assets.js

# 4. Assemble the Android APK
cd android
.\gradlew.bat assembleDebug
cd ..
```
