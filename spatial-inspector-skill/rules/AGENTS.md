# Spatial Layout & Collision Verification Rule

When creating, restyling, or debugging frontend user interfaces (HTML, CSS, React, Vue, Next.js):

1. **Verify Physical Hit-Testing**:
   Never assume a button is clickable just because it exists in the DOM. Ensure no overlay, modal backdrop, or fixed header has an unintended `pointer-events: auto` intercepting clicks.

2. **Stacking Context Awareness**:
   Be cautious with `transform`, `opacity < 1`, `filter`, and `perspective`, as they instantiate new CSS stacking contexts that trap child `z-index` values. Use `isolation: isolate` intentionally when scoping stacking contexts.

3. **Spatial Audit Trigger**:
   Whenever the user asks about layout bugs, overlapping text, "dead" buttons, or visual regression, use the `spatial-inspector` MCP tool (`inspect_layout_anomalies`) to inspect the live rendered geometry.
