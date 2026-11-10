# Procedural Web Audio SFX for Motion

High-end kinetic web motion design achieves visceral physical presence by locking sound directly to animation frames. Instead of loading heavy multi-megabyte MP3/WAV files that stutter or suffer network delay, modern web motion engines generate **100% procedural synthetic sound design** in real time via the native Web Audio API.

---

## 1. The Audio Engine Architecture

```javascript
class ProceduralAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.lastTriggeredShot = -1;
  }

  // AudioContext requires user gesture initialization (click/keypress)
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.enabled = !muted;
  }
}
```

---

## 2. Core Procedural Sound Generators

### 1. Sub-Bass Impact Boom (Cuts, Landings, Text Reveals)
A clean low-frequency sine wave sweeping downwards from 124Hz to 28Hz with an exponential gain decay curve. Creates a visceral sub-bass thud.

```javascript
boom(freq = 62, duration = 0.38) {
  if (!this.enabled || !this.ctx) return;
  const now = this.ctx.currentTime;
  const osc = this.ctx.createOscillator();
  const gain = this.ctx.createGain();

  osc.type = 'sine';
  // Pitch drops rapidly to simulate physical impact mass
  osc.frequency.setValueAtTime(freq * 2, now);
  osc.frequency.exponentialRampToValueAtTime(28, now + duration);

  // Gain envelope with instantaneous punch and fast tail
  gain.gain.setValueAtTime(0.32, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(this.ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
}
```

### 2. Katana Blade / Laser Slice (Shear Cuts, Quick Whips)
Generated from procedural white noise shaped through a swept resonant bandpass filter (`Q = 2.8`). Produces a clean metallic whoosh/slice sound.

```javascript
slash() {
  if (!this.enabled || !this.ctx) return;
  const now = this.ctx.currentTime;
  const sampleRate = this.ctx.sampleRate;
  const length = Math.floor(sampleRate * 0.28);
  const buffer = this.ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  // Generate decaying white noise buffer
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.06));
  }

  const noiseSource = this.ctx.createBufferSource();
  noiseSource.buffer = buffer;

  // Swept resonant bandpass filter (3400Hz down to 750Hz)
  const filter = this.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(3400, now);
  filter.frequency.exponentialRampToValueAtTime(750, now + 0.26);
  filter.Q.value = 2.8;

  const gain = this.ctx.createGain();
  gain.gain.setValueAtTime(0.38, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.27);

  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(this.ctx.destination);

  noiseSource.start(now);
}
```

### 3. Mechanical Haptic Click / Clockwork Tick
Subtle, high-frequency sine impulse mimicking a physical mechanical shutter or switch toggle.

```javascript
tick(isHighPitch = false) {
  if (!this.enabled || !this.ctx) return;
  const now = this.ctx.currentTime;
  const osc = this.ctx.createOscillator();
  const gain = this.ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(isHighPitch ? 1200 : 780, now);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

  osc.connect(gain);
  gain.connect(this.ctx.destination);

  osc.start(now);
  osc.stop(now + 0.035);
}
```

---

## 3. Synchronizing Procedural SFX with Frame Execution

In your animation `renderFrame(t)` loop, track shot and boundary transitions to trigger SFX exactly on the impact frame:

```javascript
let lastShotId = -1;

function syncAudioWithShot(currentShotId, progressInShot) {
  if (currentShotId !== lastShotId) {
    lastShotId = currentShotId;

    // Trigger distinctive sound by shot category
    if ([2, 6, 14, 18, 30].includes(currentShotId)) {
      audio.boom(75, 0.42);
    } else if ([5, 12, 15, 27].includes(currentShotId)) {
      audio.slash();
    } else {
      audio.tick(false);
    }
  }
}
```
