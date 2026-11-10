#!/usr/bin/env node
/**
 * upload-apk.js — Publish a built Android APK to a Supabase Storage bucket.
 *
 * Generic, open-source, zero-config-baked-in:
 *   - This file contains NO project URLs, keys or IDs. Ever.
 *   - All configuration comes from CLI flags or the caller's own environment
 *     (optionally loaded from the caller's own gitignored .env.local).
 *   - The service-role key is read ONLY from the environment (never a flag),
 *     so it never lands in shell history or CI logs.
 *   - Nothing is deleted unless you pass --clean.
 *   - Zero dependencies: uses the Supabase Storage REST API via Node's fetch (Node >= 18).
 *
 * Usage:
 *   node scripts/upload-apk.js [options]
 *
 * Options:
 *   --url <https://xxx.supabase.co>  Supabase project URL      (env: SUPABASE_URL)
 *   --bucket <name>                  Target bucket             (env: APK_BUCKET, default: "latest")
 *   --name <file.apk>                Object name in the bucket (env: APK_OBJECT_NAME, default: "app.apk")
 *   --apk <path>                     APK to upload             (env: APK_PATH)
 *   --release                        Use the release APK instead of debug when --apk is not given
 *   --private                        Create the bucket as private if it does not exist (default: public)
 *   --clean                          Delete existing objects in the bucket before uploading
 *   --env-file <path>                Load env vars from this file (default: .env.local if present)
 *   --dry-run                        Validate config and print the plan; upload nothing
 *   -h, --help                       Show this help
 *
 * Required env:
 *   SUPABASE_SERVICE_ROLE_KEY        Service-role key (server-side secret; never ship it in the app)
 *
 * Multiple projects? Run the script once per project with different env/flags.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ---------- args ----------
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') out.help = true;
    else if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    } else out._.push(a);
  }
  return out;
}

function printHelp() {
  const src = fs.readFileSync(__filename, 'utf8');
  const m = src.match(/\/\*\*([\s\S]*?)\*\//);
  console.log(m ? m[1].replace(/^ \* ?/gm, '') : 'See source for usage.');
}

function fail(msg) {
  console.error(`\n[upload-apk] ERROR: ${msg}\n`);
  process.exit(1);
}

// ---------- env loading (caller's own file, never bundled) ----------
function loadEnvFile(file) {
  if (!file || !fs.existsSync(file)) return false;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[key] === undefined) process.env[key] = val; // real env wins
  }
  return true;
}

// ---------- storage REST helpers ----------
function headers(key, extra = {}) {
  return { Authorization: `Bearer ${key}`, apikey: key, ...extra };
}

async function api(base, key, method, route, body, extraHeaders) {
  const res = await fetch(`${base}/storage/v1${route}`, {
    method,
    headers: headers(key, body && !(body instanceof Buffer) ? { 'Content-Type': 'application/json', ...extraHeaders } : extraHeaders),
    body: body === undefined ? undefined : body instanceof Buffer ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { ok: res.ok, status: res.status, json };
}

async function ensureBucket(base, key, bucket, isPublic) {
  const got = await api(base, key, 'GET', `/bucket/${encodeURIComponent(bucket)}`);
  if (got.ok) {
    console.log(`  bucket "${bucket}" exists (public=${got.json && got.json.public})`);
    return;
  }
  console.log(`  creating bucket "${bucket}" (public=${isPublic})...`);
  const made = await api(base, key, 'POST', '/bucket', { id: bucket, name: bucket, public: isPublic });
  if (!made.ok) fail(`could not create bucket "${bucket}": ${made.status} ${JSON.stringify(made.json)}`);
}

async function cleanBucket(base, key, bucket) {
  const listed = await api(base, key, 'POST', `/object/list/${encodeURIComponent(bucket)}`, { prefix: '', limit: 1000 });
  if (!listed.ok) fail(`could not list bucket: ${listed.status} ${JSON.stringify(listed.json)}`);
  const files = (listed.json || []).filter((o) => o.id).map((o) => o.name);
  if (!files.length) return console.log('  bucket already empty');
  console.log(`  deleting ${files.length} object(s): ${files.join(', ')}`);
  const del = await api(base, key, 'DELETE', `/object/${encodeURIComponent(bucket)}`, { prefixes: files });
  if (!del.ok) fail(`delete failed: ${del.status} ${JSON.stringify(del.json)}`);
}

async function upload(base, key, bucket, name, buf) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await api(base, key, 'POST', `/object/${encodeURIComponent(bucket)}/${encodeURIComponent(name)}`, buf, {
      'Content-Type': 'application/vnd.android.package-archive',
      'x-upsert': 'true',
      'cache-control': 'max-age=300',
    });
    if (res.ok) return;
    console.warn(`  attempt ${attempt}/3 failed: ${res.status} ${JSON.stringify(res.json)}`);
    if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  fail('upload failed after 3 attempts');
}

// ---------- main ----------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  const envFile = typeof args['env-file'] === 'string' ? args['env-file'] : path.join(process.cwd(), '.env.local');
  const loaded = loadEnvFile(envFile);

  const url = (args.url || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const bucket = args.bucket || process.env.APK_BUCKET || 'latest';
  const name = args.name || process.env.APK_OBJECT_NAME || 'app.apk';
  const variant = args.release ? 'release' : 'debug';
  const apk = path.resolve(
    args.apk ||
      process.env.APK_PATH ||
      path.join('android', 'app', 'build', 'outputs', 'apk', variant, variant === 'release' ? 'app-release.apk' : 'app-debug.apk')
  );

  if (!url) fail('missing Supabase URL. Pass --url or set SUPABASE_URL in your environment / .env.local.');
  if (!/^https:\/\/[^/]+$/.test(url)) fail(`Supabase URL looks wrong: "${url}" (expected https://<project>.supabase.co)`);
  if (!key) fail('missing SUPABASE_SERVICE_ROLE_KEY in environment. (Not accepted as a flag on purpose.)');
  if (!fs.existsSync(apk)) fail(`APK not found at ${apk}. Build it first (cd android && ./gradlew assembleDebug) or pass --apk.`);

  const size = fs.statSync(apk).size;
  console.log('==============================================================');
  console.log(' upload-apk');
  console.log(`  env file : ${loaded ? envFile : '(none loaded)'}`);
  console.log(`  project  : ${url}`);
  console.log(`  bucket   : ${bucket}${args.clean ? '  (will be CLEANED first)' : ''}`);
  console.log(`  object   : ${name}`);
  console.log(`  apk      : ${apk} (${(size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  key      : ${'*'.repeat(8)} (hidden)`);
  console.log('==============================================================');

  if (args['dry-run']) return console.log('\n[dry-run] config valid. Nothing uploaded.');

  await ensureBucket(url, key, bucket, !args.private);
  if (args.clean) await cleanBucket(url, key, bucket);
  console.log(`  uploading ${name}...`);
  await upload(url, key, bucket, name, fs.readFileSync(apk));

  const publicUrl = `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeURIComponent(name)}`;
  if (!args.private) {
    const head = await fetch(publicUrl, { method: 'HEAD' });
    const len = Number(head.headers.get('content-length'));
    if (!head.ok || (len && len !== size)) fail(`verification failed: HTTP ${head.status}, size ${len} != ${size}`);
    console.log(`\n  verified: HTTP ${head.status}, ${len || size} bytes`);
  }
  console.log(`  done -> ${args.private ? `(private) ${bucket}/${name}` : publicUrl}\n`);
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
