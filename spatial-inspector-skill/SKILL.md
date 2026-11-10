---
name: spatial
description: "Inspect rendered web UI for spatial layout defects, occluded/unclickable buttons, text collisions, z-index traps, and generate interactive 3D WebGL stacking context views and collision heatmaps. Trigger via /spatial, /spatial-inspector, or when auditing frontend layout geometry."
version: 1.0.0
---

# /spatial — Spatial Layout & 3D Stacking Inspector

The `/spatial` skill diagnoses and eliminates physical layout defects in rendered web interfaces: occluded buttons, text overlapping other text, content clipped by `overflow: hidden`, and z-index stacking traps.

---

## Quick Slash Commands

You or the user can invoke:
- `/spatial`: Automatically discovers the main HTML or running dev server in the current workspace, runs the spatial audit, and outputs a 3D visualizer + anomaly report.
- `/spatial <url_or_path>`: Runs against a specific URL (e.g. `http://localhost:3000`) or file (e.g. `index.html`).
- `/spatial-inspector`: Full alias for `/spatial`.

---

## When to Activate This Skill

Activate whenever:
1. **Interactive Elements Blocked**: A button, link, or tab cannot be clicked or tapped because another element (e.g. backdrop, fixed header, pseudo-element) is physically sitting on top of it.
2. **Text Overlaps / Collisions**: Two labels, headings, or paragraphs collide or overlap in the viewport.
3. **Text Truncation / Overflow**: Text is unintentionally cut off or ellipsis-truncated due to parent bounding limits.
4. **Z-Index Wars & Stacking Traps**: An element has `z-index: 9999` but is still trapped beneath a sibling due to a parent stacking context (`transform`, `opacity < 1`, `filter`, `perspective`).
5. **3D Visual Debugging**: The user asks for a "3D map of the elements", "DOM depth view", or "collision heatmap".

---

## Execution Protocol

When `/spatial` is triggered, follow these exact steps:

### Step 1: Identify the Target
- If the user specified a path or URL (e.g., `/spatial http://localhost:5173` or `/spatial UPCAT REVIEWER/index.html`), use it.
- If none specified, check for:
  1. A running local dev server (`http://localhost:3000`, `http://localhost:5173`, etc.).
  2. The primary `index.html` in the workspace.

### Step 2: Run the Spatial Audit
Call the `spatial-inspector` MCP tool or execute the runner script:
```powershell
node "C:\Users\yuze2\.gemini\config\plugins\spatial-inspector\server.js"
```
Or via Node script:
```powershell
node "C:\Users\yuze2\.gemini\config\skills\spatial\scripts\inspect.js" "<target_path_or_url>"
```

### Step 3: Analyze the Anomaly Ledger
Read the generated `spatial_anomalies.json` and categorize by severity:
- **P0 (Critical / Blocker)**: Click targets occluded by another element.
  - Solution: Set `pointer-events: none` on the blocking decorative element, or fix `z-index` and layout nesting.
- **P1 (High / Defect)**: Text collision between distinct nodes or unexpected truncation.
  - Solution: Switch to Flexbox/Grid flow with explicit `gap`, or fix absolute positioning and negative margins.
- **P2 (Medium / UX)**: Snug touch targets (< 36px or < 8px spacing).
  - Solution: Increase padding/margin to meet accessibility standards.

### Step 4: Open / Share the Interactive 3D Visualizer
Point the user to the generated `3d-inspector.html`:
- Provide the clickable `file:///` link.
- Instruct them to drag to rotate the DOM in 3D, use the **Z-Extrusion** slider to explode stacked layers, and toggle **Anomalies** to highlight colliding elements.

### Step 5: Apply Surgical Code Fixes
Modify the codebase to eliminate the identified P0/P1 anomalies, then re-run the inspection to verify that **Anomalies Count drops to 0**.
