# Spatial Inspector Skill & MCP Server

**Autonomous Spatial Layout & 3D Stacking Context Inspector for Google Antigravity**

Diagnoses and fixes physical layout defects in rendered web pages, hybrid mobile apps (Capacitor/PNPM Android), and responsive web UI.

---

## Capabilities

- 🛑 **Click Blockers (P0)**: Pinpoints buttons, links, and inputs that cannot receive direct clicks because another element (such as a transparent backdrop or fixed header) is covering them.
- 💥 **Text Collisions (P1)**: Flags overlapping text blocks and headers.
- ✂️ **Text Truncation (P1)**: Catches content clipped by `overflow: hidden`.
- 🪜 **Stacking Context Isolation**: Traces Z-index traps caused by `opacity < 1`, `transform`, `filter`, or missing `isolation: isolate`.
- 🌐 **3D WebGL Explorer**: Generates an interactive Three.js 3D model with OrbitControls and a Z-axis layer extrusion slider.

---

## How to Access

### 1. Slash Command in Antigravity
Type into any chat:
```text
/spatial
```
or
```text
/spatial-inspector
```

Targeting a specific dev server or file:
```text
/spatial http://localhost:3000
/spatial index.html
```

### 2. Direct CLI Execution
```powershell
node scripts/inspect.js [target_url_or_file] [output_dir]
```

### 3. As an MCP Tool in Antigravity
Exposes:
- `spatial-inspector.inspect_layout_anomalies`
- `spatial-inspector.get_element_stacking_info`
- `spatial-inspector.export_3d_stacking_view`

---

## Directory Contents

- `SKILL.md`: Main Antigravity skill prompt and instructions.
- `server.js`: Standard JSON-RPC 2.0 Model Context Protocol (MCP) server.
- `engine/cdp-runner.js`: Headless Edge/Chromium runner over native Node.js 24 WebSockets (zero external npm dependencies).
- `engine/spatial-collector.js`: Real-time browser coordinate hit-tester and collision detector.
- `viewer/template-3d.html`: Standalone Three.js 3D WebGL stacking viewer.
- `scripts/inspect.js`: Lightweight CLI runner.
- `rules/AGENTS.md`: Mandatory spatial layout verification rule for UI tasks.
