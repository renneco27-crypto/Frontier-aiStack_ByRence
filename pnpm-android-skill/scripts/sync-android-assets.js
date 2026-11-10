const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../.next/server/app');
const destDir = path.join(__dirname, '../android/app/src/main/assets/public');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (fs.existsSync(dest) && !fs.statSync(dest).isDirectory()) {
    fs.unlinkSync(dest); // Delete file if it exists so we can make a dir
  }
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    // We only want to copy html, rsc, and meta files to bypass the Next.js export limitation
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile() && (srcPath.endsWith('.html') || srcPath.endsWith('.rsc') || srcPath.endsWith('.meta'))) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function cleanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanDir(fullPath);
      // Remove empty dirs
      if (fs.readdirSync(fullPath).length === 0) {
        fs.rmdirSync(fullPath);
      }
    } else if (fullPath.endsWith('.html') || fullPath.endsWith('.rsc') || fullPath.endsWith('.meta')) {
      fs.unlinkSync(fullPath);
    }
  }
}

console.log('Cleaning old prepackaged HTMLs from Android assets...');
cleanDir(destDir);

console.log('Copying new Next.js output to Android assets...');
copyDir(srcDir, destDir);

// Ensure all top-level HTML routes exist as directory index.html files so Capacitor
// WebViewAssetLoader can resolve both /feed and /feed/ without 404s
const htmlFiles = fs.readdirSync(destDir).filter(f => f.endsWith('.html') && !f.startsWith('_'));
for (const file of htmlFiles) {
  const routeName = file.replace(/\.html$/, '');
  if (routeName === 'index') continue;
  if (routeName.includes('.')) continue; // Skip asset routes like icon.png, manifest.webmanifest
  const targetSubdir = path.join(destDir, routeName);
  if (!fs.existsSync(targetSubdir)) {
    fs.mkdirSync(targetSubdir, { recursive: true });
  }
  fs.copyFileSync(path.join(destDir, file), path.join(targetSubdir, 'index.html'));
  
  // Also copy corresponding .rsc file if present
  const rscFile = path.join(destDir, `${routeName}.rsc`);
  if (fs.existsSync(rscFile)) {
    fs.copyFileSync(rscFile, path.join(targetSubdir, 'index.rsc'));
    fs.copyFileSync(rscFile, path.join(destDir, `${routeName}.txt`));
  }
}

// Copy static public root files (icon.png, app-icon-1024.png, logo.jpg, custom_sound_1.mp3, etc.)
// Skip index.html so the freshly compiled Next.js HTML is NEVER overwritten by a stale file!
const publicDir = path.join(__dirname, '../public');
if (fs.existsSync(publicDir)) {
  for (const entry of fs.readdirSync(publicDir, { withFileTypes: true })) {
    if (entry.isFile()) {
      if (entry.name === 'index.html' || entry.name.startsWith('.env')) continue;
      const destFile = path.join(destDir, entry.name);
      if (fs.existsSync(destFile) && fs.statSync(destFile).isDirectory()) {
        fs.rmSync(destFile, { recursive: true, force: true });
      }
      fs.copyFileSync(path.join(publicDir, entry.name), destFile);
    }
  }
  // Keep public/index.html in sync with the fresh Next.js build
  const freshIndex = path.join(srcDir, 'index.html');
  if (fs.existsSync(freshIndex)) {
    fs.copyFileSync(freshIndex, path.join(publicDir, 'index.html'));
  }
}

function copyAllFiles(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyAllFiles(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

const publicAssetsSrc = path.join(__dirname, '../public/assets');
const publicAssetsDest = path.join(destDir, 'assets');
if (fs.existsSync(publicAssetsSrc)) {
  console.log('Syncing public/assets to Android assets...');
  copyAllFiles(publicAssetsSrc, publicAssetsDest);
}

const nextStaticSrc = path.join(__dirname, '../.next/static');
const nextStaticDest = path.join(destDir, '_next/static');
if (fs.existsSync(nextStaticDest)) {
  console.log('Purging stale .next/static from Android assets...');
  fs.rmSync(nextStaticDest, { recursive: true, force: true });
}
if (fs.existsSync(nextStaticSrc)) {
  console.log('Syncing fresh .next/static to Android assets...');
  copyAllFiles(nextStaticSrc, nextStaticDest);
}

// 100% guarantee that no .env file ever exists in the Android assets
function purgeEnvFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) purgeEnvFiles(full);
    else if (entry.name.startsWith('.env') || entry.name.endsWith('.env')) {
      try { fs.unlinkSync(full); } catch {}
    }
  }
}
purgeEnvFiles(destDir);

console.log('Done syncing Android assets!');
