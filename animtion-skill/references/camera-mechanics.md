# 3D Virtual Camera Rig & Motion Mechanics

This reference details the mathematical and architectural implementation of high-performance 3D virtual camera rigs in vanilla JavaScript and CSS 3D Transforms, extracted and distilled from production motion engines (Higgsfield Katana and Opus 5.5).

---

## 1. The Virtual Stage & Camera Rig Coordinate System

To eliminate flexbox clipping, layout thrashing, and viewport distortion, web motion engines decouple the **Screen Canvas** from the **Stage** and the **Camera Rig**.

```
+-------------------------------------------------------------+
| Screen / Browser Viewport (100vw x 100vh)                   |
|  - Full-bleed background (#screen-bg)                       |
|  - Overlays (film grain, CRT vignette, dynamic flash)       |
|                                                             |
|   +-----------------------------------------------------+   |
|   | Fixed Virtual Stage (#stage, e.g. 1920x1080)       |   |
|   |  - Centered at top: 50%, left: 50%                  |   |
|   |  - Scaled via CSS variable (--stage-scale)          |   |
|   |  - perspective: 1400px; transform-style: preserve-3d|   |
|   |                                                     |   |
|   |   +---------------------------------------------+   |   |
|   |   | Camera Rig (#camera-rig)                    |   |   |
|   |   |  - Inverted world space: (-camX, -camY)     |   |   |
|   |   |  - 3D rotations: rotateX, rotateY, rotateZ  |   |   |
|   |   |  - Handheld drift + high-energy shake       |   |   |
|   |   |  - Dynamic anisotropic motion blur          |   |   |
|   |   +---------------------------------------------+   |   |
|   +-----------------------------------------------------+   |
+-------------------------------------------------------------+
```

### HTML Setup
```html
<div id="screen-bg">
  <div id="bg-grid-overlay"></div>
  <canvas id="ember-canvas"></canvas>
</div>

<!-- Virtual Stage centered in screen -->
<div id="stage">
  <div id="camera-rig"></div>
</div>

<!-- Post-Processing Overlays -->
<div id="flash-overlay"></div>
<div id="crt-vignette"></div>
```

### CSS Architecture
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
  z-index: 2;
  transform-origin: center center;
  transform: translate(-50%, -50%) scale(var(--stage-scale-x), var(--stage-scale-y));
  pointer-events: none;
  perspective: 1400px;
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

#crt-vignette {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 40;
  background:
    radial-gradient(circle at center, transparent 62%, rgba(0, 0, 0, 0.48) 100%),
    repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.04) 0px, rgba(0, 0, 0, 0.04) 1px, transparent 1px, transparent 3px);
}
```

### Aspect-Fit Responsive Stage Scaler
```javascript
function updateViewportScale() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Aspect-fit contain: preserve 16:9 ratio with letterbox/pillarbox
  const scale = Math.min(vw / 1920, vh / 1080);
  document.documentElement.style.setProperty('--stage-scale-x', scale);
  document.documentElement.style.setProperty('--stage-scale-y', scale);
}
window.addEventListener('resize', updateViewportScale);
updateViewportScale();
```

---

## 2. Camera Transform Mathematics

In physical optics and cinematography, when the camera moves **right**, the scene moves **left**. When the camera pitches **up**, the scene moves **down**.

Therefore, if the camera position in world space is `(camX, camY)`, the camera rig transform translates by `(-camX, -camY)`.

```javascript
// Virtual camera state variables
let camX = 0;       // Horizontal focus point (px)
let camY = 0;       // Vertical focus point (px)
let camScale = 1.0; // Zoom factor (>1.0 = zoom in, <1.0 = zoom out)
let rotX = 0;       // Tilt / pitch (deg)
let rotY = 0;       // Pan / yaw (deg)
let rotZ = 0;       // Dutch angle / roll (deg)
let shake = 0;      // Impact shake magnitude (px)
```

### Handheld Organic Drift & Impact Shake
To make code-rendered motion feel physical and cinematic rather than robotic:
1. **Organic Handheld Breathing**: Superimpose two out-of-phase low-frequency sine waves.
2. **High-Frequency Impact Shake**: Decaying high-frequency sinusoidal oscillation triggered on impacts, cuts, or bass hits.

```javascript
// 1. Handheld organic breathing
const driftX = Math.sin(t * 2.4) * 5;
const driftY = Math.cos(t * 1.9) * 4;

// 2. High-energy impact shake
const shakeX = shake > 0 ? Math.sin(t * 135) * shake : 0;
const shakeY = shake > 0 ? Math.cos(t * 110) * shake * 0.75 : 0;

// 3. Final camera rig 3D transform
rig.style.transform = `
  translate3d(${(-camX + driftX + shakeX).toFixed(1)}px, ${(-camY + driftY + shakeY).toFixed(1)}px, 0)
  scale(${camScale.toFixed(4)})
  rotateX(${rotX.toFixed(2)}deg)
  rotateY(${rotY.toFixed(2)}deg)
  rotateZ(${rotZ.toFixed(2)}deg)
`;
```

---

## 3. Dynamic Velocity-Based Motion Blur

CSS `filter: blur(...)` is isotropic (equal in all directions) and heavy. By combining SVG `<filter>` with `<feGaussianBlur>` and separating standard deviations into horizontal and vertical components, we create **anisotropic, velocity-directed cinematic motion blur**.

### SVG Filter Definition
```html
<svg width="0" height="0" style="position:absolute;">
  <defs>
    <!-- Dynamic Real-Time Camera Motion Blur Filter -->
    <filter id="cam-blur" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur id="cam-blur-node" in="SourceGraphic" stdDeviation="0 0" />
    </filter>

    <!-- Pre-baked Fast Directional Whip Filters -->
    <filter id="blur-h" x="-40%" y="-10%" width="180%" height="120%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="32 0" />
    </filter>
    <filter id="blur-v" x="-10%" y="-40%" width="120%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="0 34" />
    </filter>
  </defs>
</svg>
```

### Real-Time Velocity Blur Calculation
```javascript
let prevCamX = 0;
let prevCamY = 0;
const camBlurNode = document.getElementById('cam-blur-node');

function updateCameraBlur(camX, camY, blurBoostX = 0, blurBoostY = 0) {
  // Compute delta distance per frame
  const vx = Math.min(36, Math.abs(camX - prevCamX) * 0.35 + blurBoostX);
  const vy = Math.min(36, Math.abs(camY - prevCamY) * 0.35 + blurBoostY);

  prevCamX = camX;
  prevCamY = camY;

  // Only activate filter when velocity crosses perceptual threshold
  if (vx > 1.5 || vy > 1.5) {
    camBlurNode.setAttribute('stdDeviation', `${vx.toFixed(1)} ${vy.toFixed(1)}`);
    rig.style.filter = 'url(#cam-blur)';
  } else {
    rig.style.filter = 'none';
  }
}
```

---

## 4. Easing Mathematics for Camera Choreography

Never use generic linear or ease-in-out transitions for fast camera moves. Fast camera whips require **high-explosive initial velocity with extreme asymptotic deceleration** (`easeOutExpo` or `easeOutQuart`), while impacts require `easeOutBack`.

```javascript
// Essential Motion Math Utilities
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const lerp = (a, b, t) => a + (b - a) * t;
const norm = (val, min, max) => clamp((val - min) / (max - min), 0, 1);

// Explosive whip pans & camera tracking
const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const easeInExpo = (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10));

// Smooth natural camera sweeps
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x) => x * x * x;
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4);

// Elastic overshoot on snaps & landings
const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
```
