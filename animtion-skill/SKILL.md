---
name: kinetic-camera-morph
description: "Masterclass motion design skill for 3D virtual camera rigs, frame-accurate kinetic typography, tilted spatial scrolling, and single-surface UI div morphing. Learn and build zero-slop web animations with CSS 3D transforms, directional velocity blur, diagonal polygon shearing, focal-plane Z-axis pop, and procedural Web Audio synthesis."
version: 1.0.0
---

# Kinetic Camera & UI Morphing Motion Skill

A masterclass engineering skill for crafting world-class web animations, kinetic typography, 3D camera movements, spatial showcases, and fluid UI morphing in vanilla JavaScript, CSS 3D Transforms, and SVG shaders without heavy dependencies.

---

## When to Activate This Skill

Activate this skill whenever:
- Designing or implementing **kinetic typography, promo videos, hero animations, or marketing motion** in code.
- Building **3D virtual camera systems** (pan, tilt, zoom, roll, handheld camera drift, impact shakes, motion blur).
- Creating **spatial 3D scrolling showcases** (tilted perspective boards, floating cards popping in Z-depth, ribbon pullbacks, depth of field).
- Developing **fluid UI morphing** where a single container continuously transitions between radically different UI states (buttons, pills, cards, players, sliders, palettes) without layout jumps.
- Implementing **diagonal cuts, katana slices, or split elements** using CSS `clip-path: polygon(...)`.
- Adding **procedural Web Audio sound effects** (sub-bass impacts, blade slashes, haptic ticks) locked to visual frames.
- Reviewing, refactoring, or elevating frontend motion that feels static, robotic, or "AI-slop".

---

## The Four Core Motion Pillars

```
+-----------------------------------------------------------------------------+
|                         KINETIC MOTION CRAFT SYSTEM                         |
+-----------------------------------------------------------------------------+
|  1. 3D Virtual Camera Rig     |  2. Kinetic Typography & Slicing           |
|   - Inverted World Mapping    |   - Brutalist high-contrast typography      |
|   - Organic Handheld Breathing|   - Dual-polygon clip-path katana shearing  |
|   - Dynamic Anisotropic Blur  |   - Vertical top-to-bottom whip tracking    |
|   - High-Frequency Impact Shake|  - Real 3D CSS depth coordinates           |
+-------------------------------+---------------------------------------------+
|  3. 3D Spatial Scrolling      |  4. Single-Surface UI Morphing              |
|   - Tilted Perspective Board  |   - 1 persistent container, N state shapes  |
|   - Focal-Zone Dynamic Z-Pop  |   - Pixel border-radius matching invariant  |
|   - Depth-of-Field Blur Mask  |   - Decoupled state layers + exit blur      |
|   - 4-Phase Camera Loop       |   - Real-time SVG cubic bezier path morphing|
+-----------------------------------------------------------------------------+
```

---

## Pillar 1: 3D Virtual Camera Rig & Motion Dynamics

### 1. The Stage & Camera Decoupling Architecture
To prevent flexbox squishing and layout thrashing, decouple the **Screen Canvas** (100vw x 100vh) from the **Virtual Stage** (fixed 1920x1080) and the **Camera Rig**:

```html
<div id="screen-bg"></div>
<div id="stage">
  <div id="camera-rig">
    <!-- Active scene content injected here -->
  </div>
</div>
```

```css
:root {
  --stage-scale-x: 1;
  --stage-scale-y: 1;
}

#stage {
  position: fixed;
  top: 50%;
  left: 50%;
  width: 1920px;
  height: 1080px;
  transform-origin: center center;
  transform: translate(-50%, -50%) scale(var(--stage-scale-x), var(--stage-scale-y));
  perspective: 1400px;
  pointer-events: none;
  overflow: visible;
}

#camera-rig {
  position: absolute;
  inset: 0;
  width: 1920px;
  height: 1080px;
  transform-style: preserve-3d;
  will-change: transform, filter;
}
```

### 2. Inverted Camera Mapping & Organic Camera Life
Moving the camera right in world space moves the scene left. Always translate the camera rig by `(-camX, -camY)`:

```javascript
// Virtual camera target
let camX = 0, camY = 0, camScale = 1.0, rotX = 0, rotY = 0, rotZ = 0, shake = 0;

// Organic handheld drift (two out-of-phase sine waves)
const driftX = Math.sin(t * 2.4) * 5;
const driftY = Math.cos(t * 1.9) * 4;

// High-frequency decaying impact shake
const shakeX = shake > 0 ? Math.sin(t * 135) * shake : 0;
const shakeY = shake > 0 ? Math.cos(t * 110) * shake * 0.75 : 0;

// Camera rig transformation
rig.style.transform = `
  translate3d(${(-camX + driftX + shakeX).toFixed(1)}px, ${(-camY + driftY + shakeY).toFixed(1)}px, 0)
  scale(${camScale.toFixed(4)})
  rotateX(${rotX.toFixed(2)}deg)
  rotateY(${rotY.toFixed(2)}deg)
  rotateZ(${rotZ.toFixed(2)}deg)
`;
```

### 3. Dynamic Anisotropic Motion Blur
Standard CSS blur is isotropic and slow. Use an SVG filter whose horizontal and vertical standard deviation dynamically tracks camera velocity:

```html
<svg width="0" height="0" style="position:absolute;">
  <defs>
    <filter id="cam-blur" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur id="cam-blur-node" in="SourceGraphic" stdDeviation="0 0" />
    </filter>
  </defs>
</svg>
```

```javascript
let prevCamX = 0, prevCamY = 0;
const camBlurNode = document.getElementById('cam-blur-node');

function applyVelocityBlur(camX, camY, extraBlurX = 0, extraBlurY = 0) {
  const vx = Math.min(36, Math.abs(camX - prevCamX) * 0.35 + extraBlurX);
  const vy = Math.min(36, Math.abs(camY - prevCamY) * 0.35 + extraBlurY);
  prevCamX = camX;
  prevCamY = camY;

  if (vx > 1.5 || vy > 1.5) {
    camBlurNode.setAttribute('stdDeviation', `${vx.toFixed(1)} ${vy.toFixed(1)}`);
    rig.style.filter = 'url(#cam-blur)';
  } else {
    rig.style.filter = 'none';
  }
}
```

---

## Pillar 2: Kinetic Typography & Polygon Katana Slicing

### 1. Dual-Polygon Slicing Technique
To slice text or UI components cleanly across a diagonal vector without layout jitter:
1. Render **two identical copies** overlaid at `position: absolute; inset: 0;`.
2. Apply opposing diagonal `clip-path: polygon(...)` to each half.
3. Translate and rotate both halves outward in opposite directions.

```html
<div style="position:relative; width:1520px; height:250px;">
  <!-- Top Half Sliced -->
  <div class="brutal" style="
    position: absolute; inset: 0;
    clip-path: polygon(0 0, 100% 0, 100% 34%, 0 74%);
    transform: translate(${-slide}px, ${-slide * 0.25}px);
  ">
    FUCKING
  </div>

  <!-- Bottom Half Sliced -->
  <div class="brutal" style="
    position: absolute; inset: 0;
    clip-path: polygon(0 76%, 100% 36%, 100% 100%, 0 100%);
    transform: translate(${slide}px, ${slide * 0.25}px);
  ">
    FUCKING
  </div>
</div>
```

### 2. Vertical Whip Track Spacing
Position sequential words at defined vertical coordinates in world space. Rapidly whip the camera down while applying vertical directional blur:
- Word 1: `y = -320px` (Camera at -320px)
- Word 2: `y = 0px` (Camera whips to 0px with `easeOutExpo`, `blurY = 28px`)
- Word 3: `y = +320px` (Camera whips to +320px)
- Reveal: Camera zooms out from `scale: 1.65` to `scale: 0.96` to reveal all three words simultaneously.

---

## Pillar 3: 3D Spatial Scrolling & Viewport Dynamics

### 1. Tilted Perspective World Board
Tilt the scrolling canvas back at `rotateX(48deg)` to simulate an architectural drafting board:

```css
.viewport-stage {
  perspective: 1200px;
  overflow: hidden;
  transform-style: preserve-3d;
}
.camera-rig {
  transform: translate3d(0, 40px, 0) scale(0.92) rotateX(48deg);
  transform-style: preserve-3d;
}
.page-slab {
  transform-style: preserve-3d;
  will-change: transform;
}
```

### 2. Focal-Plane Dynamic Z-Axis Card Pop
As cards scroll into the camera's focal center, elevate them into positive Z-space using a sinusoidal bell curve:

```javascript
function updateFocalPops(scrollY, cards, zMultiplier = 1.0) {
  const focalCenterY = scrollY + 340;
  const focalRadius = 560;

  cards.forEach(card => {
    const dist = Math.abs(card.centerOffset - focalCenterY);
    const proximity = Math.max(0, Math.min(1, 1 - dist / focalRadius));
    // Bell-curve pop factor
    const popFactor = Math.sin(proximity * Math.PI * 0.5);
    const zVal = card.targetZ * popFactor * zMultiplier;
    card.el.style.transform = `translate3d(0px, 0px, ${zVal.toFixed(1)}px) rotateZ(${card.tiltZ}deg)`;
  });
}
```

### 3. Depth-of-Field Blur Overlays
Place top and bottom gradient masks with `backdrop-filter: blur(8px)` and scale their opacity with camera tilt:
```css
.dof-blur {
  position: absolute;
  left: 0; right: 0; height: 220px;
  pointer-events: none;
  backdrop-filter: blur(8px);
}
.top-blur {
  top: 0;
  mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%);
}
.bottom-blur {
  bottom: 0;
  mask-image: linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%);
}
```

---

## Pillar 4: Single-Surface UI Div Morphing

### 1. The Single Persistent Container Architecture
Never mount and unmount separate divs when transitioning UI shapes. Maintain **one persistent container** in the DOM and animate its geometry smoothly:

```css
:root {
  --spring-easing: cubic-bezier(0.22, 1, 0.36, 1);
  --morph-duration: 520ms;
}

#morph-container {
  position: relative;
  overflow: hidden;
  transition:
    width var(--morph-duration) var(--spring-easing),
    height var(--morph-duration) var(--spring-easing),
    border-radius var(--morph-duration) var(--spring-easing),
    background-color 380ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow var(--morph-duration) var(--spring-easing),
    transform 240ms var(--spring-easing);
  will-change: width, height, border-radius, background-color, transform;
}
```

### 2. The Pixel Border-Radius Matching Invariant
> [!IMPORTANT]
> **Never use `border-radius: 9999px` or `50%` on morphing containers!**
> Browser clamping causes a 300ms dead zone where the radius refuses to animate when morphing to a card. Always set `border-radius: (height / 2)px` for pill states (e.g., `height: 64px` -> `radius: 32px`).

### 3. Decoupled Content State Layers with Exit Blur
Prevent text wrapping during size morphs by absolutely pinning each state layer to `inset: 0` and cross-fading with blur:

```css
.state-layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 240ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 380ms var(--spring-easing),
    filter 240ms ease;
  will-change: opacity, transform, filter;
}

.state-layer.active {
  opacity: 1;
  pointer-events: auto;
  transform: translate3d(0, 0, 0) scale(1);
  filter: blur(0px);
}

.state-layer.exit-blur {
  opacity: 0;
  filter: blur(6px);
  transform: scale(0.95);
}
```

### 4. Dynamic SVG Cubic Bezier Path Morphing
Interpolate chart/wave paths in real time without reloading SVG markup:
```javascript
function renderInterpolatedChart(yStart, yEnd, progress) {
  const t = Math.max(0, Math.min(1, progress));
  const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const currentY = yStart.map((y0, i) => y0 + (yEnd[i] - y0) * ease);

  // Compute smooth cubic bezier handles (0.48 / 0.52 tangent ratio)
  let d = `M ${CHART_X[0]} ${currentY[0].toFixed(1)}`;
  for (let i = 0; i < currentY.length - 1; i++) {
    const x0 = CHART_X[i], y0 = currentY[i];
    const x1 = CHART_X[i + 1], y1 = currentY[i + 1];
    const cpx1 = x0 + (x1 - x0) * 0.48;
    const cpx2 = x0 + (x1 - x0) * 0.52;
    d += ` C ${cpx1.toFixed(1)} ${y0.toFixed(1)}, ${cpx2.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }

  document.getElementById('chart-line').setAttribute('d', d);
  document.getElementById('chart-area').setAttribute('d', `${d} L 356 106 L 0 106 Z`);
}
```

---

## Pillar 5: Procedural Web Audio Synthesis

Lock tactile sound effects directly to animation cuts without external audio files:

```javascript
class ProceduralAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  boom(freq = 62, dur = 0.38) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 2, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + dur);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }
  slash() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.28);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.06));
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(3400, now);
    flt.frequency.exponentialRampToValueAtTime(750, now + 0.26);
    flt.Q.value = 2.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.38, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.27);
    src.connect(flt);
    flt.connect(g);
    g.connect(this.ctx.destination);
    src.start(now);
  }
}
```

---

## Production Quality Checklist

Before completing any motion implementation, verify:
- [ ] **Stage Decoupled**: The virtual stage uses fixed coordinate bounding (e.g. 1920x1080) with `scale(var(--stage-scale))` to avoid flex squishing.
- [ ] **Camera Coordinate Inversion**: Camera rig moves to `(-camX, -camY)` with organic drift (`sin/cos` noise) and decay shake.
- [ ] **Velocity-Based Blur**: Dynamic SVG motion blur activates on rapid camera whip or morph transitions and clears when at rest.
- [ ] **Pixel Border-Radius Invariant**: Pills specify explicit `r = h / 2` in pixels to guarantee instant interpolation to card corners.
- [ ] **Decoupled Layers**: Content layers are pinned inside `position: absolute; inset: 0;` so resizing does not trigger ugly text wrapping.
- [ ] **Polygon Slice Integrity**: Dual-halves sum exactly to 100% of the bounding area before separating along the cut vector.
- [ ] **Bell-Curve Focal Pop**: Tilted scroll showcases pop cards in Z-space smoothly as they traverse the viewport focal radius.
- [ ] **Interactive Transport**: Provide timeline scrubber, play/pause (spacebar), and speed toggles for effortless motion review.

---

## Deep-Dive Reference Guides

For complete mathematical derivations, architectural diagrams, and comprehensive code recipes, consult the specialized reference docs:
- [camera-mechanics.md](references/camera-mechanics.md): Virtual camera rig math, coordinates, 3D perspective, shake, handheld drift, dynamic anisotropic velocity blur.
- [kinetic-typography.md](references/kinetic-typography.md): Frame-accurate text sequencing, diagonal polygon clip-path katana shearing, whip pans, letter staggers, font pairings.
- [3d-spatial-scrolling.md](references/3d-spatial-scrolling.md): Tilted viewport geometry, perspective scroll tracking, focal-plane dynamic Z-axis pop, multi-layer depth-of-field, pullback transitions.
- [ui-morphing-engine.md](references/ui-morphing-engine.md): Single-surface continuous UI morphing, state geometry configs, decoupled content layers with exit blur, SVG path interpolation, cursor orchestration.
- [procedural-audio.md](references/procedural-audio.md): Zero-asset Web Audio API SFX engine (sub-bass boom, katana slice noise sweeps, mechanical click/ticks).
