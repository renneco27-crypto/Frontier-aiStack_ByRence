import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Derived from YOUR env (see .env.example). Empty when not configured — never hardcode a project URL here.
const SUPABASE_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const CANONICAL_SUPABASE_APK_URL = SUPABASE_BASE
  ? `${SUPABASE_BASE}/storage/v1/object/public/${process.env.APK_BUCKET || "latest"}/${process.env.APK_OBJECT_NAME || "app.apk"}`
  : "";

function findLatestApk(): { filePath: string; filename: string; mtime: Date; size: number } | null {
  const candidatePaths = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
    path.join(/*turbopackIgnore: true*/ process.cwd(), "android", "app", "build", "outputs", "apk", "release", "app-release.apk"),
  ];

  let latest: { filePath: string; filename: string; mtime: Date; size: number } | null = null;

  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.isFile() && stat.size > 0) {
          if (!latest || stat.mtimeMs > latest.mtime.getTime()) {
            latest = {
              filePath,
              filename: path.basename(filePath),
              mtime: stat.mtime,
              size: stat.size,
            };
          }
        }
      }
    } catch {
      // Continue searching
    }
  }

  return latest;
}

export async function GET(req: NextRequest) {
  const apkInfo = findLatestApk();

  // 1. If local APK file is available on server disk at android/app/build/outputs/apk/release/app-release.apk, stream it directly
  if (apkInfo) {
    const fileBuffer = fs.readFileSync(apkInfo.filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="app-release.apk"`,
        "Content-Length": apkInfo.size.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  // 2. Check explicit APK download URL from environment variables
  const explicitApkUrl = process.env.NEXT_PUBLIC_APK_URL || process.env.APK_DOWNLOAD_URL;
  if (explicitApkUrl) {
    return NextResponse.redirect(explicitApkUrl, { status: 302 });
  }

  // 3. Fallback: redirect directly to canonical Supabase release URL
  if (!CANONICAL_SUPABASE_APK_URL) {
    return NextResponse.json({ error: "No APK configured. Set NEXT_PUBLIC_APK_URL or NEXT_PUBLIC_SUPABASE_URL." }, { status: 404 });
  }
  return NextResponse.redirect(CANONICAL_SUPABASE_APK_URL, { status: 302 });
}
