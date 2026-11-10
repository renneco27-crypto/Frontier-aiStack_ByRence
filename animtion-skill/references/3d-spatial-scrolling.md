# 3D Spatial Scrolling & Viewport Mechanics

This reference details the implementation of 3D tilted plane scrolling, focal-plane dynamic Z-axis card pop, multi-layer depth-of-field blur, and camera sweep transitions, distilled from Opus 5.5's 3D scrolling showcase.

---

## 1. The Tilted 3D World Stage

Standard web pages scroll flat on the 2D screen. In 3D spatial scrolling, the entire scrollable page canvas (the **Page Slab**) is mounted inside a 3D perspective viewport tilted back at an acute angle (typically `rotateX(45deg)` to `rotateX(52deg)`), simulating a physical table or drafting board.

```
          Camera Frustum (perspective: 1200px)
                     \       /
                      \ [Camera]
                       \     /
    ---------------------\-/---------------------  Screen Glass (Z = 0)
                          .
                         / \
                        /   \
       Tilted Page Slab     \
       (rotateX: 48deg)      v  Top of Page (Z < 0, blurred by dofTop)
         \
          \  [Card 1]
           \
            \  [FOCAL ZONE: Card 2 POP! translateZ: +70px]
             \
              \  [Card 3]
               \
                v  Bottom of Page (Z > 0, blurred by dofBottom)
```

### HTML & CSS Setup
```html
<div id="viewportStage" class="viewport-stage">
  <div id="cameraRig" class="camera-rig">
    <!-- Scrolling Page Slab -->
    <main id="pageSlab" class="page-slab">
      <!-- Cards with custom depth targets -->
      <article class="card-3d" data-z="65" data-tilt="-1.5">Card 01</article>
      <article class="card-3d" data-z="80" data-tilt="2.0">Card 02</article>
      <article class="card-3d" data-z="70" data-tilt="-1.0">Card 03</article>
    </main>
  </div>

  <!-- Depth of Field Gradient Overlays -->
  <div id="dofTop" class="dof-blur top-blur"></div>
  <div id="dofBottom" class="dof-blur bottom-blur"></div>
</div>
```

```css
.viewport-stage {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  perspective: 1200px;
  background: #09090b;
}

.camera-rig {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  transform-style: preserve-3d;
  will-change: transform;
}

.page-slab {
  position: relative;
  width: 980px;
  transform-style: preserve-3d;
  will-change: transform;
}

.card-3d {
  position: relative;
  transform-style: preserve-3d;
  will-change: transform;
  transition: transform 0.12s cubic-bezier(0.25, 1, 0.5, 1);
}

/* Depth-of-Field Blur Gradients */
.dof-blur {
  position: absolute;
  left: 0;
  right: 0;
  height: 220px;
  pointer-events: none;
  z-index: 20;
  backdrop-filter: blur(8px);
}
.top-blur {
  top: 0;
  mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%);
}
.bottom-blur {
  bottom: 0;
  mask-image: linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%);
  -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%);
}
```

---

## 2. Dynamic Focal-Zone Z-Axis Card Pop

As cards scroll through the viewport, they should not remain flat against the page slab. When each card enters the center of the camera's focal view, it smoothly lifts upward into positive Z-space, casting soft drop-shadows and rotating slightly.

### The Mathematical Bell Curve
```javascript
// 1. Measure and cache each card's center vertical offset relative to the page slab
const cardMetrics = [];
function measureLayout() {
  const slabHeight = pageSlab.offsetHeight;
  cardMetrics.length = 0;
  cards3D.forEach((el) => {
    let top = 0;
    let curr = el;
    while (curr && curr !== pageSlab) {
      top += curr.offsetTop;
      curr = curr.offsetParent;
    }
    const centerOffset = top + el.offsetHeight * 0.5;
    const targetZ = parseFloat(el.getAttribute('data-z') || '50');
    const tiltZ = parseFloat(el.getAttribute('data-tilt') || '0');
    cardMetrics.push({ el, centerOffset, targetZ, tiltZ });
  });
}

// 2. Update card Z positions during the animation / scroll loop
function updateCardPops(scrollY, zPopMultiplier = 1.0) {
  // Center of viewport in page coordinates
  const focalCenterY = scrollY + 340;
  // Radius of active focal influence
  const focalRadius = 560;

  for (let i = 0; i < cardMetrics.length; i++) {
    const item = cardMetrics[i];
    const dist = Math.abs(item.centerOffset - focalCenterY);
    const proximity = Math.max(0, Math.min(1, 1 - dist / focalRadius));

    // Smooth sinusoidal bell-curve factor (0.0 -> 1.0 -> 0.0)
    const popFactor = Math.sin(proximity * Math.PI * 0.5);
    const zVal = item.targetZ * popFactor * zPopMultiplier;

    item.el.style.transform = `translate3d(0px, 0px, ${zVal.toFixed(1)}px) rotateZ(${item.tiltZ}deg)`;
  }
}
```

---

## 3. Four-Phase Camera Choreography Loop

To create an exhibition showcase (e.g., product features or documentation tours), sequence the camera across distinct spatial phases:

| Phase | Timeline Progress | Visual State | Camera Action |
|---|---|---|---|
| **Phase 1: Tilted Scroll** | `0.00 -> 0.60` | Half-lying down (`48deg`) | Steady downward scroll across hero to footer cards |
| **Phase 2A: Full Pullback** | `0.60 -> 0.68` | Ribbon pullback (`rotateX: 10deg`, `scale: 0.25`) | Camera zooms far out to reveal the full vertical ribbon strip |
| **Phase 2B: Return Sweep** | `0.68 -> 0.75` | Rapid sweep back to top | Scroll returns to `0`, camera swoops into Hero card (`scale: 0.80`) |
| **Phase 3: Hero Presentation** | `0.75 -> 0.93` | Upright hero lockup | Subtle floating badges in Z-space, headline reveal, dof relaxation |
| **Phase 4: Loop Reset** | `0.93 -> 1.00` | Smooth tilt transition | Camera tilts from upright (`9deg`) back to `48deg` to repeat seamlessly |

```javascript
function renderScene(p, nowMs) {
  const maxScrollY = Math.max(100, slabHeight - 640);
  let rotateX = baseTiltDeg;
  let scale = 0.92;
  let rigY = 40;
  let scrollY = 0;

  if (p < 0.60) {
    const t = p / 0.60;
    scrollY = lerp(0, maxScrollY, easeInOutCubic(t));
    rotateX = baseTiltDeg;
    scale = 0.92;
    rigY = 40;
  } else if (p < 0.68) {
    const t = easeInOutCubic((p - 0.60) / 0.08);
    scrollY = lerp(maxScrollY, maxScrollY * 0.48, t);
    rotateX = lerp(baseTiltDeg, 10, t);
    scale = lerp(0.95, 0.25, t); // Zoom out to show full strip
    rigY = lerp(65, 220, t);
  } else if (p < 0.75) {
    const t = easeOutQuart((p - 0.68) / 0.07);
    scrollY = lerp(maxScrollY * 0.48, 0, t);
    rotateX = lerp(10, 7, t);
    scale = lerp(0.25, 0.80, t); // Return sweep to top
    rigY = lerp(220, 145, t);
  } else if (p < 0.93) {
    const t = (p - 0.75) / 0.18;
    scrollY = 0;
    rotateX = lerp(7, 9, Math.sin(t * Math.PI));
    scale = lerp(0.80, 0.83, easeOutQuart(t));
    rigY = 145;
  } else {
    const t = easeInOutCubic((p - 0.93) / 0.07);
    scrollY = 0;
    rotateX = lerp(9, baseTiltDeg, t); // Seamless loop tilt reset
    scale = lerp(0.83, 0.95, t);
    rigY = lerp(145, 65, t);
  }

  // Apply transforms
  cameraRig.style.transform = `translate3d(0px, ${rigY.toFixed(1)}px, 0px) scale(${scale.toFixed(4)}) rotateX(${rotateX.toFixed(2)}deg)`;
  pageSlab.style.transform = `translate3d(0px, ${(-scrollY).toFixed(1)}px, 0px)`;
  updateCardPops(scrollY);
}
```
