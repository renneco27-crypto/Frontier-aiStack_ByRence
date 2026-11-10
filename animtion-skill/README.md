# Kinetic Motion & Apple Design Skill Repository

This directory contains the complete motion design documentation, 3D camera mechanics, UI morphing specifications, procedural audio generators, and Apple Human Interface Guidelines (HIG) reference library, along with their live HTML interactive showcase benchmarks.

---

## Directory Overview

```
C:\Users\yuze2\Documents\antigravity\lucid-faraday\PNPMAndroid\animtion-skill\
├── SKILL.md                                        # Master Kinetic Motion Skill definition
├── README.md                                       # Directory index and navigation guide
│
├── references/                                     # Kinetic Motion Reference Manuals
│   ├── camera-mechanics.md                         # 3D virtual camera rig math, coordinates & velocity blur
│   ├── kinetic-typography.md                       # Brutalist text, polygon katana slicing & whip pans
│   ├── 3d-spatial-scrolling.md                     # Tilted perspective plane, bell-curve Z-pop & DOF blur
│   ├── ui-morphing-engine.md                       # Single-surface UI morphing, radius matching & SVG paths
│   └── procedural-audio.md                         # Zero-asset Web Audio API synthetic sound engine
│
├── apple-skill/                                    # Apple Design & HIG Skill Library (131 Markdown files)
│   ├── SKILL.md                                    # Apple design review and HIG compliance skill
│   ├── README.md                                   # Apple design skill overview
│   ├── AGENTS.md                                   # Apple design agents instruction set
│   └── references/                                 # Complete HIG & cross-platform reference guides
│       ├── code-audit.md                           # Apple design code review rubrics
│       ├── cross-platform.md                       # SwiftUI, Flutter, React Native translation
│       ├── hig-lookup.md                           # Quick index for Apple HIG components
│       └── hig/                                    # 125+ Official Apple HIG specification pages
│           ├── accessibility.md                    # Accessibility guidelines & dynamic type
│           ├── buttons.md                          # Tactile button hierarchy & interaction
│           ├── dark-mode.md                        # Semantic color adaptability & materials
│           ├── haptics.md / playing-haptics.md     # Tactile physical feedback loops
│           ├── navigation-bars.md                  # Adaptive navigation and title behaviors
│           ├── sheets.md / popovers.md             # Spatial presentation & dismissal curves
│           └── ... (all Apple HIG system components)
│
└── Live HTML Showcase Benchmarks (Interactive Implementations)
    ├── higgsfield_katana_kinetic_typography_promo (2).html  # 44-shot kinetic promo, camera rig & katana shear
    ├── opus_5_5_3d_scrolling_showcase.html                  # 3D tilted plane scrolling with dynamic Z-pop
    ├── motion_study_02_ui_morphing_showcase.html            # 9-state single-surface UI div morphing
    └── urban_markers_showcase (1).html                      # Velocity scroll choreography & sticky locks
```

---

## 1. Kinetic Motion Engine Documentation

- **[`SKILL.md`](./SKILL.md)**: Main instruction set for implementing zero-slop web motion, stage decoupling, and rAF timeline loops.
- **[`references/camera-mechanics.md`](./references/camera-mechanics.md)**: Virtual camera rig inverted coordinate mapping, organic handheld drift (`sin`/`cos` noise), impact shake shockwaves, and dynamic velocity-directed SVG motion blur (`<feGaussianBlur>`).
- **[`references/kinetic-typography.md`](./references/kinetic-typography.md)**: Brutalist typography, dual-layer polygon katana slicing via `clip-path: polygon(...)`, vertical whip-pan tracks, and 3D frustum parallax depth.
- **[`references/3d-spatial-scrolling.md`](./references/3d-spatial-scrolling.md)**: Tilted perspective viewport (`rotateX(48deg)`), scroll-linked virtual camera tracking, sinusoidal bell-curve dynamic Z-axis card pop, and multi-layer depth-of-field blur masks.
- **[`references/ui-morphing-engine.md`](./references/ui-morphing-engine.md)**: Single-surface continuous UI morphing across 9 distinct states, the pixel border-radius matching invariant (`r = h / 2`), decoupled content state layers with exit blur, and real-time SVG cubic bezier path interpolation.
- **[`references/procedural-audio.md`](./references/procedural-audio.md)**: Zero-asset Web Audio API procedural sound engine (sub-bass boom, blade slice resonant bandpass sweep, mechanical haptic ticks).

---

## 2. Apple Design & HIG Reference Library

- **[`apple-skill/SKILL.md`](./apple-skill/SKILL.md)**: Apple design standards, human interface review guidelines, Liquid Glass principles, typography scales, and platform-specific idioms (iOS, iPadOS, macOS, watchOS, visionOS).
- **[`apple-skill/references/hig/`](./apple-skill/references/hig/)**: 125+ individual component and pattern specifications covering accessibility, materials, layout, navigation, controls, haptics, motion, and visual design.

---

## 3. Live Benchmark Showcases

Open any of the included HTML showcases in a browser to inspect the live interactions:
1. `higgsfield_katana_kinetic_typography_promo (2).html`: 44-shot kinetic typography promo with precision camera cuts, scrub controls, speed toggles, and audio.
2. `opus_5_5_3d_scrolling_showcase.html`: 3D tilted plane showcase featuring focal-zone Z-elevation, ribbon pullback, and loop transitions.
3. `motion_study_02_ui_morphing_showcase.html`: Fluid UI component morphing demonstrating continuous shape shifts across buttons, players, sliders, and charts.
4. `urban_markers_showcase (1).html`: Complex scroll choreography with sticky locks, dynamic progress bars, and split reveals.
