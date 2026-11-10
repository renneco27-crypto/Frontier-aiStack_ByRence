import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

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
  const playStoreUrl = process.env.NEXT_PUBLIC_PLAYSTORE_URL || process.env.PLAYSTORE_URL || null;
  const defaultRepo = "renneco27-crypto/StitchCSV";
  const githubRepo = process.env.NEXT_PUBLIC_GITHUB_REPO || process.env.GITHUB_REPO || defaultRepo;
  const explicitApkUrl = process.env.NEXT_PUBLIC_APK_URL || process.env.APK_DOWNLOAD_URL || null;

  const fallbackApkUrl = CANONICAL_SUPABASE_APK_URL;

  if (apkInfo) {
    return NextResponse.json({
      available: true,
      filename: `StudyUp-${apkInfo.filename}`,
      sizeFormatted: formatBytes(apkInfo.size),
      sizeBytes: apkInfo.size,
      updatedAt: apkInfo.mtime.toISOString(),
      playStoreUrl,
      githubRepo,
      apkUrl: "/api/download/apk",
    });
  }

  const fallback = explicitApkUrl || fallbackApkUrl;
  if (!fallback) {
    return NextResponse.json({ available: false, playStoreUrl, githubRepo, apkUrl: null });
  }

  return NextResponse.json({
    available: true,
    filename: "StudyUp-app.apk",
    sizeFormatted: "49.92 MB",
    sizeBytes: 52340294,
    updatedAt: new Date().toISOString(),
    playStoreUrl,
    githubRepo,
    apkUrl: explicitApkUrl || fallbackApkUrl,
  });
}
