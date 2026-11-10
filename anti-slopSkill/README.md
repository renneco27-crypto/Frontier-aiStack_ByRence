# Anti-AI Slop Skill

An opinionated, battle-tested UI/UX skill designed to purge generic "AI vibecoding" habits from frontend codebases and build authentic, handcrafted, high-clarity software.

Based on real-world refactorings (such as transforming the StudyUp Create Deck bottom sheet) and modern design laws.

---

## What is in this Skill?

- **`SKILL.md`**: Master instruction guide with the core rules, anti-patterns blocklist, and audit checklist.
- **`anti-slop-rules.txt`**: Deep-dive analysis of the 16 video frames ("Day 1 of Removing AI Slop") and 10 specific AI slop fixes.
- **`html/`**:
  - `create-deck-redesign.standalone.html`: Live interactive preview of the anti-slop bottom sheet.
  - `shadlingo-design-tokens-reference.html`: Design system showcase (color tokens, typography, 3D tactile buttons).
- **`images/`**: Before-and-after screenshots and video breakdown frames demonstrating why AI-generated UI fails and how to fix it.

---

## The 8 Golden Rules

1. **Visual Hierarchy**: One thing is big and obvious; everything else is quiet. Never give all elements equal visual weight.
2. **Snapping & Determinism**: Controls snap to clear, integer values; they never float awkwardly in-between.
3. **Micro-Motion**: State changes animate smoothly (slide, blur, fade); never hard-cut.
4. **Font Discipline**: Tabular numbers (`tabular-nums`) to prevent horizontal jitter; minimum 12px text.
5. **Tactile Feedback**: Every button sinks down on press (e.g. 3D tactile buttons); light haptics on taps.
6. **No Card Divs Unless Earned**: Stop boxing text, stats, and non-interactive data in nested cards. Keep header buttons bare.
7. **Purge AI Emojis & Tells**: Zero unicode emojis (🔥, ⚡); zero purple glow blobs or sparkle icons. Use authentic vector icons only.
8. **Copy is Earned**: Cut 30% of unnecessary filler words and redundant helper text.
