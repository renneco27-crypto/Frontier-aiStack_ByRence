# UI Morphing Engine: Single-Surface State Architecture

This reference details how to morph a single DOM surface into multiple radically different UI components (buttons, pills, cards, sliders, palettes) with zero layout jitter, based on the Motion Study 02 UI Morphing Engine.

---

## 1. The Single Morphing Container Invariant

Most developers implement multi-state interfaces by mounting and unmounting separate `<div>` tags (or conditional React rendering), resulting in hard cuts, jarring layout jumps, or complicated FLIP calculations.

The **Single-Surface Architecture** keeps **one persistent bounding container** in the DOM and smoothly animates its geometric properties (`width`, `height`, `border-radius`, `background-color`, `box-shadow`) while fading internal content layers via **decoupled state layers**.

```
                [ State 1: Action Button (230 x 68, r: 34) ]
                                    |
                                    v (morph geometry & cross-fade layers)
                [ State 2: Audio Pill    (320 x 64, r: 32) ]
                                    |
                                    v
          +---------------------------------------------------+
          | State 3: Music Player Card (360 x 210, r: 28)     |
          |  [Album Art]  [Track Title]   [Transport Controls]|
          |  ==================================o==============|
          +---------------------------------------------------+
                                    |
                                    v
                [ State 4: Volume Slider (360 x 58, r: 29) ]
                                    |
                                    v
                [ State 5: Toggle Switch (176 x 78, r: 39) ]
                                    |
                                    v
          +---------------------------------------------------+
          | State 7: Analytics Card (420 x 275, r: 28)        |
          |  [Period Selector: Day | Week | Month]            |
          |  [Dynamic Morphing Cubic Bezier SVG Curve]        |
          +---------------------------------------------------+
```

---

## 2. Container Geometry & CSS Transitions

### Critical Rule: Pixel Border-Radius Invariant
Never use `border-radius: 9999px` or `border-radius: 50%` on morphing containers! When transitioning from a pill (`border-radius: 9999px`) to a rectangle (`border-radius: 28px`), browsers clamp the percentage/large value against the height, introducing an awkward **delayed response** where the corner radius does not appear to change for the first 300ms of the animation.

Always specify the **exact pixel half-height**:
- For a 68px tall pill: `border-radius: 34px`
- For a 64px tall pill: `border-radius: 32px`
- For a 210px tall card: `border-radius: 28px`

Now the corner radius transitions smoothly and instantly from frame zero.

### Container CSS Definition
```css
:root {
  --spring-easing: cubic-bezier(0.22, 1, 0.36, 1);
  --morph-duration: 520ms;
}

#morph-container {
  position: relative;
  width: 230px;
  height: 68px;
  border-radius: 34px;
  background-color: #070707;
  box-shadow: 0 22px 45px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.10);
  transition:
    width var(--morph-duration) var(--spring-easing),
    height var(--morph-duration) var(--spring-easing),
    border-radius var(--morph-duration) var(--spring-easing),
    background-color 380ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow var(--morph-duration) var(--spring-easing),
    transform 240ms var(--spring-easing),
    filter 220ms ease;
  overflow: hidden;
  will-change: width, height, border-radius, background-color, transform, filter;
}

#morph-container.pressed {
  transform: scale(0.965);
}

#morph-container.motion-blur {
  filter: url(#svg-motion-blur);
}
```

---

## 3. Decoupled Content State Layers

During a 520ms container width change (e.g. from 230px to 420px), internal text and buttons would awkwardly reflow, wrap into two lines, and break layout if bound directly to container width.

To achieve fluid high-end motion:
1. Each state has a distinct `.state-layer` absolutely pinned to `inset: 0`.
2. Content within each layer is built for its target dimensions.
3. On state change, the outgoing layer receives `.exit-blur` (`opacity: 0; filter: blur(6px); transform: scale(0.95);`).
4. The incoming layer receives `.active` (`opacity: 1; filter: blur(0px); transform: translate3d(0,0,0) scale(1);`).

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

### State Configuration Registry
```javascript
const STATE_CONFIGS = {
  1: {
    name: '01 / Generate Button',
    width: 230,
    height: 68,
    radius: 34,
    bg: '#070707',
    shadow: '0 22px 45px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.10)'
  },
  2: {
    name: '02 / Audio Pill',
    width: 320,
    height: 64,
    radius: 32,
    bg: '#070707',
    shadow: '0 22px 45px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.10)'
  },
  3: {
    name: '03 / Music Player',
    width: 360,
    height: 210,
    radius: 28,
    bg: '#070707',
    shadow: '0 26px 52px rgba(0, 0, 0, 0.25), 0 6px 16px rgba(0, 0, 0, 0.12)'
  },
  7: {
    name: '07 / Analytics Card',
    width: 420,
    height: 275,
    radius: 28,
    bg: '#ffffff',
    shadow: '0 24px 50px rgba(0, 0, 0, 0.09), 0 4px 14px rgba(0, 0, 0, 0.04)'
  }
};

let motionBlurTimeout = null;

function applyMorphState(stateId, customHeight = null) {
  const cfg = STATE_CONFIGS[stateId];
  if (!cfg) return;

  if (currentStateId !== stateId) {
    // Pulse directional SVG motion blur during rapid transition
    morphContainer.classList.add('motion-blur');
    clearTimeout(motionBlurTimeout);
    motionBlurTimeout = setTimeout(() => {
      morphContainer.classList.remove('motion-blur');
    }, 290);

    // Update active and exit layers
    for (let i = 1; i <= 9; i++) {
      const layer = document.getElementById(`layer-state-${i}`);
      if (!layer) continue;
      if (i === stateId) {
        layer.classList.add('active');
        layer.classList.remove('exit-blur');
      } else if (i === currentStateId) {
        layer.classList.remove('active');
        layer.classList.add('exit-blur');
      } else {
        layer.classList.remove('active', 'exit-blur');
      }
    }
    currentStateId = stateId;
  }

  // Update container geometry
  morphContainer.style.width = `${cfg.width}px`;
  morphContainer.style.height = `${customHeight !== null ? customHeight : cfg.height}px`;
  morphContainer.style.borderRadius = `${cfg.radius}px`;
  morphContainer.style.backgroundColor = cfg.bg;
  morphContainer.style.boxShadow = cfg.shadow;
}
```

---

## 4. Real-Time SVG Path Morphing (Cubic Bezier Interpolation)

When morphing data visualizations (such as charts, waves, or icons) inside a morphing container, do not reload or replace the SVG. Store the control points as coordinate arrays and interpolate the `d` attribute smoothly in `requestAnimationFrame`.

```javascript
// Fixed horizontal sample points
const CHART_X = [0, 44.5, 89, 133.5, 178, 222.5, 267, 311.5, 356];

// State datasets (Y coordinates)
const CHART_Y_MONTH = [88, 92, 68, 72, 50, 56, 36, 22, 6];
const CHART_Y_WEEK  = [55, 62, 46, 56, 32, 50, 34, 18, 24];

function buildSmoothChartPaths(yPoints) {
  const pts = CHART_X.map((x, i) => ({ x, y: yPoints[i] }));
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    // Natural horizontal tangent handles
    const cpx1 = p0.x + (p1.x - p0.x) * 0.48;
    const cpy1 = p0.y;
    const cpx2 = p0.x + (p1.x - p0.x) * 0.52;
    const cpy2 = p1.y;
    d += ` C ${cpx1.toFixed(1)} ${cpy1.toFixed(1)}, ${cpx2.toFixed(1)} ${cpy2.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  const areaD = `${d} L 356 106 L 0 106 Z`;
  return { lineD: d, areaD };
}

function renderInterpolatedChart(yStart, yEnd, progress) {
  const t = Math.max(0, Math.min(1, progress));
  const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const currentY = yStart.map((y0, i) => y0 + (yEnd[i] - y0) * ease);
  const { lineD, areaD } = buildSmoothChartPaths(currentY);

  document.getElementById('chart-line-path').setAttribute('d', lineD);
  document.getElementById('chart-area-path').setAttribute('d', areaD);
}
```
