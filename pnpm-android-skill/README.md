# PNPM & Next.js Android Hybrid App Architecture Skill

A production-ready skill for packaging, building, and deploying offline-first hybrid Android apps powered by **Next.js (App Router), Capacitor, PNPM, and Tailwind CSS**.

---

## What is in this Skill?

- **`SKILL.md`**: Master architecture specification, Java routing blueprint (`BridgeWebViewClient`), Gradle AAPT asset packaging rules, triple-guard security invariants, and the 11 cataloged bug fixes.
- **`making-an-android-offline-webapp.txt`**: Complete 18-chapter practical cheatsheet and field guide from initial headless setup to standalone release.

---

## Key Architectural Topics

1. **Standalone Native Container**: Packaging Next.js App Router static assets (`.next/server/app`, compiled CSS) directly inside Android's `assets/public/` folder.
2. **Offline Java Routing**: Intercepting React Server Component (RSC) requests and client routes via `MainActivity.java` `shouldInterceptRequest()`.
3. **AAPT Safe Packaging**: Strict exclusion of `.env` files while preserving `_next` stylesheets and chunks.
4. **Zero-Bloat Deployment**: Eliminating redundant service workers (Serwist/Workbox) since the native container is authoritative.
5. **Open-Source Supabase Storage Release**: Zero-config APK deployment script via `scripts/upload-apk.js`.
