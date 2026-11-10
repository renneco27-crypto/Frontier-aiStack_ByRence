// scripts/local_relay_worker.js
// Outbound Relay Worker for StitchApp (Replaces Ngrok with outbound HTTPS polling)
// Handles heavy PPTX, PDF, and Image extraction locally on PC, then bridges to Gemini

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

function loadEnv() {
  const env = { ...process.env };
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [k, ...v] = trimmed.split('=');
      if (k && v.length) env[k.trim()] = v.join('=').trim();
    }
  }
  return env;
}

const env = loadEnv();
const SERVER_URL = (env.STITCHAPP_SERVER_URL || env.RENDER_URL || 'https://stitchcsv.onrender.com').replace(/\/$/, '');
const RELAY_SHA = env.RELAY_SHA || '';
const WORKER_ID = env.WORKER_ID || `worker_pc_${(os.hostname() || 'pc')}_${Math.random().toString(36).slice(2, 7)}`.replace(/[^a-zA-Z0-9_-]/g, '_');
const POLL_INTERVAL_MS = 2500;

console.log('======================================================================');
console.log('⚡ [STITCHAPP LOCAL RELAY WORKER] Live & Connected!');
console.log(`💻 Worker PC ID:      ${WORKER_ID}`);
console.log(`🌐 Target Server:     ${SERVER_URL}`);
console.log(`🔑 Relay SHA:         ${RELAY_SHA ? RELAY_SHA.slice(0, 8) + '...' : '(Unset - Open mode)'}`);
console.log(`📑 Local Extractors:  python-pptx, PyMuPDF (PDF & PPTX supported)`);
console.log('⏰ Mode:              Pure Outbound HTTPS (Zero Ngrok ports needed!)');
console.log('======================================================================\n');

function getPythonBinary() {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }
  const candidates = [
    'C:\\Users\\corte\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
    path.join(process.cwd(), 'venv', 'Scripts', 'python.exe'),
    'C:\\Users\\corte\\Documents\\projects NOT DELETE\\lex memoria\\venv\\Scripts\\python.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'python';
}

/**
 * Transcribes PPTX / PDF / text files using local python script
 */
function runLocalTranscriber(filePaths) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'doc_ppt_pdf_transcriber.py');
    const pyBin = getPythonBinary();
    const py = spawn(pyBin, [scriptPath, ...filePaths]);
    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (d) => { stdout += d.toString(); });
    py.stderr.on('data', (d) => { stderr += d.toString(); });

    py.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `Transcriber exited with code ${code}`));
      }
    });

    py.on('error', (err) => reject(err));
  });
}

/**
 * Process a pending job
 */
async function processJob(job) {
  console.log(`\n📥 [JOB RECEIVED] ID: ${job.id} | Topic: ${job.topic || 'General'}`);
  const startTime = Date.now();

  let transcribedText = job.payload || '';
  const tempFiles = [];

  try {
    // If job contains base64 file attachments (e.g. PPTX / PDF uploaded from web)
    if (job.files && Array.isArray(job.files) && job.files.length > 0) {
      console.log(`📄 Extracting ${job.files.length} uploaded file(s) locally...`);
      for (const file of job.files) {
        const ext = path.extname(file.name || 'document.pdf') || '.pdf';
        const tempPath = path.join(os.tmpdir(), `stitch_relay_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
        const buffer = Buffer.from(file.data, 'base64');
        fs.writeFileSync(tempPath, buffer);
        tempFiles.push(tempPath);
      }

      const extracted = await runLocalTranscriber(tempFiles);
      transcribedText = extracted + (transcribedText ? '\n\n' + transcribedText : '');
      console.log(`✅ Extracted ${transcribedText.length} characters from files in ${Date.now() - startTime}ms`);
    }

    // Now send the complete payload to the local extension or direct relay
    console.log('🤖 Forwarding extracted study notes to Gemini Bridge...');
    
    // Complete the file-extraction stage on the relay server
    const completeUrl = `${SERVER_URL}/api/relay/complete`;
    const res = await fetch(completeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: job.id,
        deck_id: job.deckId,
        worker_id: WORKER_ID,
        relay_sha: RELAY_SHA,
        extracted_text: transcribedText,
        images: job.images || [],
        // If the job only required local PPT/PDF transcription
        csv_data: job.skip_ai ? transcribedText : undefined
      })
    });

    if (res.ok) {
      console.log(`🎉 [JOB COMPLETED] Job ${job.id} synced with server in ${Date.now() - startTime}ms`);
    } else {
      const errText = await res.text().catch(() => '');
      console.warn(`⚠️ [RELAY SYNC WARNING] Status ${res.status}: ${errText}`);
    }
  } catch (err) {
    console.error(`❌ [JOB FAILED] Error processing ${job.id}:`, err.message);
    try {
      await fetch(`${SERVER_URL}/api/relay/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          worker_id: WORKER_ID,
          relay_sha: RELAY_SHA,
          error: err.message
        })
      });
    } catch (e) {}
  } finally {
    // Clean up temporary files
    for (const f of tempFiles) {
      try { fs.unlinkSync(f); } catch (e) {}
    }
  }
}

/**
 * Main polling loop
 */
let isPolling = false;

async function poll() {
  if (isPolling) return;
  isPolling = true;

  try {
    const pollUrl = `${SERVER_URL}/api/relay/poll?relay_sha=${encodeURIComponent(RELAY_SHA)}&worker_id=${encodeURIComponent(WORKER_ID)}`;
    const res = await fetch(pollUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'StitchApp-Local-Relay-Worker/1.0',
        'x-relay-sha': RELAY_SHA,
        'x-worker-id': WORKER_ID
      },
      signal: AbortSignal.timeout(5000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.status === 'job_available' && data.job) {
        await processJob(data.job);
      }
    }
  } catch (err) {
    // Network hiccup / offline
  } finally {
    isPolling = false;
  }
}

setInterval(poll, POLL_INTERVAL_MS);
poll();
