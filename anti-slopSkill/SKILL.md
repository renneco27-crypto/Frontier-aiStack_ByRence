---
name: anti-ai-slop
description: "Anti-AI slop design & UI/UX laws skill. Eliminates vibecoded AI patterns: enforces visual hierarchy, 1 primary action, zero emoji slop, no unearned card divs or nested boxes, concise copy, tactile 3D buttons, snapping, micro-animations, and strict design token fidelity."
version: 1.0.0
---

# Anti-AI Slop & UI/UX Laws Skill

Use this skill whenever you are designing, implementing, auditing, or reviewing frontend interfaces to purge generic AI patterns ("vibecoded slop") and build authentic, handcrafted, high-clarity software.

---

## 1. What is "AI Slop" in UI?

AI models trained on web screenshots default to predictable, low-taste UI habits:
1. **No Hierarchy**: Everything is bold, all-caps, or identical font weight. No single focal point.
2. **Card Nesting Syndrome**: Box inside a dashed box inside a solid card inside a modal. Endless padding instead of structure.
3. **Competing CTAs**: Multiple large, filled, brightly colored buttons fighting for attention ("PURCHASE IT" next to "CONNECT").
4. **Copy Bloat**: Long filler sentences, redundant explanations, and helper text that merely restates the label.
5. **AI Tells Blocklist**: Purple-on-purple gradient fills, glowing borders, frosted glass blur blobs, sparkle icons, and decorative unicode emojis (🔥, ☀️, 🏆).
6. **Dead Ends**: Modals and tabs that trap the user in uninformative paywalls or blank states without escape paths.
7. **No Feel or Motion**: Hard cuts on state changes, zero press states, no haptics, and jittery layouts.

---

## 2. Core Invariants (The Non-Negotiable Rules)

### Rule 0: Clear Typographical Hierarchy
- **One dominant element**: Exactly ONE thing on screen is big, bold, and obvious. Everything else is secondary, smaller, and quiet.
- Never give every element the same visual weight. Important headers are large; non-important labels are compact and muted.

### Rule 1: Zero Emojis in Production UI
- Never use unicode emojis (🔥, ⚡, 🏆) as UI icons.
- Use clean SVG icon sets (Lucide, Tabler, HugeIcons) or authentic 3D assets with consistent stroke width and size.

### Rule 2: Copy is Earned
- If a word doesn't change what the user does, cut it.
- Never write filler headings (e.g., *"Welcome to your personalized dashboard"*).
- No helper text that echoes the label (e.g., label *"Deck Name"*, helper *"Enter the name of your deck here"*).

### Rule 3: Never Invent Code When Assets/Design Tokens Exist
- Use real preset tokens, CSS variables, and components from the project's design system (e.g., ShadLingo / Maia tokens, `ctrlspc_ui_kit_app.tsx`, `assets.html`).
- Never wrap components in extra pill enclosures or decorative background boxes without explicit direction.

### Rule 4: No Card Divs Unless Earned
- Text, statistics, lists, and non-interactive data sit directly on the surface with whitespace and dividers.
- **Never nest a card inside another card.**
- If a button is already inside a container, do not box it in another card div.
- Non-interactive rows (e.g., a leaderboard rank `(You)`) must not have fake button styling (`tactile-btn`, `cursor-pointer`, button drop-shadows).
- **Top Bar Chrome**: Header buttons (back, menu, close, profile) sit directly on the page with hit areas only—NO card divs, NO borders, NO 3D extrusion.

### Rule 5: Exactly One Primary Action
- A panel or screen must feature **only one** high-contrast, filled primary CTA button.
- Secondary actions must be ghost, subtle outline, or bolded clickable text with hover transitions.

### Rule 6: Tactile Feedback & Micro-Motion
- Interactive buttons must have tactile press states (e.g., `.tactile-btn` sinking 2–3px on active tap).
- Bottom sheets slide up smoothly (200–250ms with cubic-bezier easing).
- Controls snap to clear values (never rest awkwardly in-between).
- Tabular numbers (`font-variant-numeric: tabular-nums`) so numbers don't jump sideways when updating.
- State changes animate (fade, slide, or blur); content never hard-cuts.

---

## 3. Screen Remodel Checklist

Before finishing any UI change, verify:
- [ ] Is there ONE clear focal point when squinting or blurring the screen?
- [ ] Is there only ONE primary button?
- [ ] Does any message appear twice? (If so, delete the duplicate).
- [ ] Is there any box inside a box that can be flattened?
- [ ] Can 30% of the words be cut without losing meaning?
- [ ] Are all font sizes (minimum 12px) and touch targets (minimum 44px) on scale?
- [ ] Are all unicode emojis purged and replaced with vector icons?
- [ ] Do buttons provide tactile press feedback and modal slide-ins?
- [ ] Does the screen look like an authentic product rather than a generated template?

---

## 4. References & Assets in this Skill
- `anti-slop-rules.txt`: Complete breakdown of the 16-frame video analysis and Create Deck transformation.
- `html/create-deck-redesign.standalone.html`: Interactive reference implementation of an anti-slop bottom sheet.
- `html/shadlingo-design-tokens-reference.html`: Design tokens, color palettes, and 3D tactile button specifications.
- `images/`: Before-and-after visual comparisons demonstrating the elimination of AI slop.
