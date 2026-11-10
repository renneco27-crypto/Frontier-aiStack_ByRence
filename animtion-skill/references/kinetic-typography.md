# Kinetic Typography & Motion Design

This reference details the mechanics of brutalist kinetic typography, diagonal element slicing, directional whip-pans, and multi-layer text choreography, derived from the Higgsfield Katana 44-shot kinetic promo engine.

---

## 1. Brutalist Typography Foundation & Visual Hierarchy

Kinetic typography relies on ultra-bold condensed letterforms, strict uppercase contrast, tight letter-spacing, and aggressive negative line-heights to fill the 3D frustum without excessive whitespace.

```css
:root {
  --font-heavy: 'Archivo Black', 'Inter', sans-serif;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-serif: 'Instrument Serif', Georgia, serif;
  --font-thin: 'Space Grotesk', sans-serif;
  --cream: #F5F2E9;
  --orange: #FF4500;
  --dark: #0A0808;
}

/* Brutalist Typography Utility */
.brutal {
  font-family: var(--font-heavy);
  text-transform: uppercase;
  letter-spacing: -0.04em;
  line-height: 0.82;
  font-weight: 900;
}

/* Wireframe Stencil (Text stroke without fill) */
.wireframe-white {
  -webkit-text-stroke: 3px #ffffff;
  color: transparent;
}
.wireframe-orange {
  -webkit-text-stroke: 3px #FF4500;
  color: transparent;
}

/* Multi-Stage High-Energy Glows */
.glow-white-red {
  color: #FFFDF8;
  text-shadow:
    0 0 20px rgba(255, 255, 255, 0.95),
    0 0 55px rgba(255, 69, 0, 0.95),
    0 0 120px rgba(255, 30, 0, 0.85),
    0 0 210px rgba(190, 10, 0, 0.75);
}

.glow-orange {
  color: #FF5500;
  text-shadow:
    0 0 20px rgba(255, 110, 0, 0.95),
    0 0 65px rgba(255, 50, 0, 0.85),
    0 0 130px rgba(255, 20, 0, 0.65);
}
```

---

## 2. The Dual-Polygon Slice & Katana Shear

To create clean, high-speed physical cuts through text, UI cards, or modals without breaking the DOM layout:
1. Render **two identical copies** of the element placed in absolute stack (`inset: 0`).
2. Apply complementary diagonal `clip-path: polygon(...)` coordinates to each half.
3. Translate and rotate both halves outward in opposite directions along the cut vector.

### Text Katana Shear
```html
<!-- Wrapper maintains bounding box -->
<div style="position:relative; width:1520px; height:250px;">
  <!-- TOP HALF: Cuts diagonally across the upper quadrant -->
  <div class="brutal" style="
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 255px;
    color: #FF3D00;
    clip-path: polygon(0 0, 100% 0, 100% 34%, 0 74%);
    transform: translate(${-slide}px, ${-slide * 0.25}px);
  ">
    FUCKING
  </div>

  <!-- BOTTOM HALF: Exactly mirrors the cut line -->
  <div class="brutal" style="
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 255px;
    color: #FF3D00;
    clip-path: polygon(0 76%, 100% 36%, 100% 100%, 0 100%);
    transform: translate(${slide}px, ${slide * 0.25}px);
  ">
    FUCKING
  </div>
</div>
```

### UI Card Slice with 3D Rotation
```html
<div style="position:relative; width:1380px; height:580px;">
  <!-- Left/Top Sliced Section -->
  <div style="
    position: absolute;
    inset: 0;
    background: #F5F2E9;
    border-radius: 28px;
    padding: 38px;
    border: 4px solid #fff;
    clip-path: polygon(0 0, 100% 0, 22% 100%, 0 100%);
    transform: translate3d(${-dx}px, ${-dy}px, 0) rotate(${-rot}deg);
  ">
    <!-- Full Inner Card Content -->
    ${cardInnerHTML}
  </div>

  <!-- Right/Bottom Sliced Section -->
  <div style="
    position: absolute;
    inset: 0;
    background: #F5F2E9;
    border-radius: 28px;
    padding: 38px;
    border: 4px solid #fff;
    clip-path: polygon(100% 0, 100% 100%, 22% 100%);
    transform: translate3d(${dx}px, ${dy}px, 0) rotate(${rot}deg);
  ">
    <!-- Identical Inner Card Content -->
    ${cardInnerHTML}
  </div>
</div>
```
When `dx = 0, dy = 0, rot = 0`, the two halves fuse seamlessly into a single unbroken surface. As progress `p` advances:
```javascript
const slide = lerp(0, 36, easeOutBack(sliceP));
const dx = lerp(0, 75, easeOutExpo(sliceP));
const dy = lerp(0, 38, easeOutExpo(sliceP));
const rot = lerp(0, 5.5, easeOutBack(sliceP));
```

---

## 3. Top-to-Bottom Vertical Whip Track

Instead of fading words in and out, words are arranged at fixed vertical offsets in world space:
- Word 1 (`NO`): `y = -320px`
- Word 2 (`FUCKING`): `y = 0px`
- Word 3 (`WAY.`): `y = +320px`

```
World Space Y
 -320px  [ NO ]         <--- Camera starts here at t = 0.8s
    |
    |    (Camera whips DOWN with filter: url(#blur-v))
    v
    0px  [ FUCKING ]    <--- Camera hits here at t = 1.3s
    |
    |    (Camera whips DOWN again)
    v
 +320px  [ WAY. ]       <--- Camera hits here at t = 1.75s
    |
    |    (Camera pulls back to center y = 0, scale 1.65 -> 0.96)
    v
    0px  [ Full 3-Word Stack Visible ]
```

### Shot Interpolation Code
```javascript
if (t < 1.3) {
  // Shot 2: Lock onto top word
  const sp = norm(t, 0.8, 1.3);
  camY = lerp(-360, -320, easeOutExpo(sp));
  camScale = lerp(2.35, 1.75, easeOutExpo(sp));
  shake = (1 - sp) * 28;
  flash = (1 - sp) * 0.45;
} else if (t < 1.75) {
  // Shot 3: Vertical whip-pan DOWN to middle word
  const sp = norm(t, 1.3, 1.75);
  camY = lerp(-320, 0, easeOutExpo(sp));
  camScale = lerp(1.75, 1.42, easeOutExpo(sp));
  blurY = (1 - sp) * 28; // Vertical motion blur spike
} else if (t < 2.25) {
  // Shot 4: Vertical whip-pan DOWN to bottom word
  const sp = norm(t, 1.75, 2.25);
  camY = lerp(0, 320, easeOutExpo(sp));
  camScale = lerp(1.42, 1.65, easeOutExpo(sp));
  blurY = (1 - sp) * 28;
} else {
  // Shot 5: Rapid zoom-out reveal of full stack
  const sp = norm(t, 2.25, 3.3);
  camY = lerp(320, 0, easeOutExpo(clamp(sp * 1.8, 0, 1)));
  camScale = lerp(1.65, 0.96, easeOutExpo(clamp(sp * 1.8, 0, 1)));
  sliceP = clamp((sp - 0.12) / 0.65, 0, 1);
}
```

---

## 4. True 3D CSS Space & Element Placement

In a preserved 3D camera rig (`transform-style: preserve-3d`), text layers are positioned along depth (`translateZ`):
```html
<div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; transform-style:preserve-3d;">
  <!-- Background Layer (Z = -60px) -->
  <div class="brutal glow-orange" style="position:absolute; font-size:185px; transform:translate3d(-70px, 220px, -60px) rotateZ(-16deg);">
    CAMERA
  </div>

  <!-- Midground Layer (Z = +120px) -->
  <div class="brutal glow-white-red" style="position:absolute; font-size:185px; transform:translate3d(-440px, -180px, 120px) rotateZ(-8deg);">
    FLUID
  </div>

  <!-- Foreground Layer (Z = +200px) -->
  <div class="brutal glow-white-red" style="position:absolute; font-size:210px; transform:translate3d(380px, -40px, 200px) rotateZ(4deg);">
    MOVES.
  </div>
</div>
```
When the camera rotates on `rotY` or `rotX`, parallax automatically occurs between `-60px` and `+200px` without calculating individual element positions.
