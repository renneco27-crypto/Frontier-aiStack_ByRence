---
name: frontier-ai-stack
description: "Master unified decision and execution router for frontier AI technologies in Antigravity: Graphify, LlamaIndex, BM25, DSPy, PySlick, inflect, spaCy, Levenshtein/Jaccard, Segment Anything (SAM 2), DocLayout-YOLO, Spatial Inspector, Google Drive, and PNPM Android. Tells the agent exactly when to use each tool, when to avoid, and exact execution patterns."
version: 1.2.0
---

# Frontier AI Stack & Capability Router

A unified master skill for Google Antigravity. Like the Cloudflare master router, this skill classifies every specialized tool, library, and algorithm in your environment and defines **exact decision triggers**, **recipes**, and **execution patterns**.

---

## ðŸ§­ The Decision Matrix at a Glance

| If Your Goal Is: | Use This Tool: | Why / Trigger: |
| :--- | :--- | :--- |
| **Parsing & indexing messy PDFs, doc collections, tables** | **LlamaIndex / PyMuPDF4LLM** | Superior document parsing, hierarchical chunking, and LaTeX math formula preservation (`$\frac{a}{b}$`). |
| **Instant BFS knowledge queries within strict token budget** | **Graphify (`graphify query`)** | Traverses connected document nodes, topics, and answer keys without LLM scanning. |
| **Finding exact factual source paragraphs in milliseconds** | **BM25 (`rank-bm25`)** | Mathematical keyword scoring; 0 AI token cost; immune to vector fuzziness. |
| **Deterministic answer verification & cross-doc deduplication** | **String Metrics (Levenshtein / Jaccard)** | Verifies whether OCR answers match computed truth and deduplicates questions across review sheets. |
| **Mutating subjects, entities, & numbers to prevent plagiarism** | **`inflect` + `spacy` + `SymPy`** | POS dependency parsing + grammatical agreement (*a/an*, plurals) + exact algebraic solving. |
| **Extracting & labeling tables, charts, & diagrams with 0 LLM tokens** | **DocLayout-YOLO / Docling** | Local offline computer vision model that detects bounding boxes and crops images to `assets/exam_images/`. |
| **Programmatic prompt compilation & auto-optimization** | **DSPy** | Algorithmic prompt tuning; replaces fragile trial-and-error prompting. |
| **Codebase navigation, AST call-graphs, dead code** | **PySlick (`pyslick`)** | Instant AST call trees and deep reasoning via `pyslick consult`. |
| **Deep reasoning, 3D WebGL / Three.js, complex architecture** | **Argon (`argon`)** | Gemini 4 Argon reasoning model for high-complexity math & rendering. |
| **Zero-shot object cutouts, visual augmentation & landmarks** | **Segment Augment Anything (SAM / OpenCV)** | Pixel-perfect subject cutout, OpenCV contour tracking, CSS slot anchoring. |
| **Physical layout QA, unclickable buttons, 3D element overlap** | **Spatial Inspector (`/spatial`)** | Headless Edge CDP 5-point hit testing, z-index traps, interactive 3D WebGL viewer. |
| **Reading, downloading, searching Google Drive files** | **Google Drive (`gdrive`)** | Native CLI integration for searching, reading, and downloading remote files. |
| **Offline-first mobile hybrid app deployment** | **PNPM Android (`pnpm-android`)** | Next.js + Capacitor standalone APK bundling and offline routing. |

---

## ðŸ› ï¸ Tool-by-Tool Runbook

### 1. Document Extraction & Structure: LlamaIndex & PyMuPDF4LLM
- **When to use**:
  - Ingesting multi-page PDFs, manuals, academic papers, and Word/Excel tables.
  - Converting document layouts into clean Markdown with LaTeX math formulas (`$\frac{a}{b}$`).
  - Creating Property Graphs where entities and relationships have rich key-value tags.
- **When NOT to use**:
  - Simple single-file text lookups (use standard file reads or BM25).
- **Execution Recipe (Python)**:
  ```python
  import pymupdf4llm
  md_text = pymupdf4llm.to_markdown("document.pdf")
  ```

---

### 2. Knowledge Graph Traversal: Graphify (`graphify`)
- **When to use**:
  - Building an offline knowledge graph of documents, topics, formulas, and answers.
  - Querying relationships and question categories with an exact token budget (`--budget 1500`).
- **Commands**:
  ```powershell
  # Index document corpus into graphify-out/graph.json (0 LLM tokens)
  graphify update ./raw_corpus
  
  # BFS query for questions and solutions
  graphify query "List all circle geometry questions and their keys" --budget 1500
  
  # Export interactive visualization HTML
  graphify export html
  ```

---

### 3. Fast Retrieval & String Verification: BM25, Levenshtein, & Jaccard
- **When to use**:
  - **BM25**: Searching through hundreds of documents for exact keywords in $< 5\text{ms}$ with 0 tokens.
  - **Levenshtein Distance**: Matching OCR-extracted answer options against calculated mathematical truth without false negatives from formatting.
  - **Jaccard Similarity**: Cross-document deduplication across 40+ review sheets and ensuring distinct multiple-choice distractors ($A, B, C, D$).
- **Execution Recipe (Python)**:
  ```python
  import Levenshtein
  
  # Character-level edit distance ratio
  similarity = Levenshtein.ratio("49Ï€ cmÂ²", "49pi cm2")
  
  # Jaccard set overlap
  def jaccard(set1, set2):
      return len(set1.intersection(set2)) / len(set1.union(set2))
  ```

---

### 4. Isomorphic Subject, Number, & Formula Mutation: `inflect`, `spacy`, & `SymPy`
- **When to use**:
  - Changing narrative subjects (*car $\rightarrow$ box $\rightarrow$ drone*), varying numbers, and re-computing solutions to create 100% original, copyright-free exam banks.
  - Enforcing automatic English grammar (*a car $\rightarrow$ an airplane*, *1 box $\rightarrow$ 3 boxes*).
  - **Psychometric Distractor Ranking**: Selecting distractors close in length, category, and 3-letter prefix/suffix boundaries ($w_s=0.35, w_l=0.25, w_m=0.25, w_o=0.15$).
  - **SI Unit Consistency + 15% Dimensional Trap**: Ensuring options share identical SI units (e.g. `m/s`), with ~15% chance of an intentional dimensional mismatch trap (e.g. `m/sÂ²` or `mÂ³`) to reward dimensional analysis intuition.
- **Execution Recipe (Python)**:
  ```python
  import inflect
  import spacy
  import sympy as sp
  import Levenshtein

  p = inflect.engine()
  nlp = spacy.load("en_core_web_sm")

  # 1. Grammatical agreement
  article = p.a("airplane")       # "an airplane"
  plural_noun = p.plural("box")   # "boxes"

  # 2. Morphological 3-letter boundary matching
  def morph_score(target, candidate):
      p_match = 1.0 if target[:3] == candidate[:3] else 0.0
      s_match = 1.0 if target[-3:] == candidate[-3:] else 0.0
      return 0.5 * p_match + 0.5 * s_match

  # 3. Exact algebraic solving with SymPy
  x = sp.Symbol('x')
  f = 3*x**2 - 5*x + 2
  df = sp.diff(f, x)             # 6*x - 5
  slope = df.subs(x, 2)          # 7
  ```

---

### 5. Non-LLM Vision & Image Cutouts: DocLayout-YOLO & Docling
- **When to use**:
  - Extracting data tables, charts, graphs, and abstract reasoning figures into `assets/exam_images/`.
  - Categorizing images as `table`, `figure`, or `chart` without burning LLM vision tokens.
- **Execution Recipe (Python)**:
  ```python
  import cv2
  from doclayout_yolo import YOLO

  model = YOLO("yolov10n_doclayout.pt")
  image = cv2.imread("page.png")
  results = model.predict(image)

  for box in results[0].boxes:
      label = model.names[int(box.cls[0])] # 'table', 'figure'
      x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
      if label in ["table", "figure"]:
          crop = image[y1:y2, x1:x2]
          cv2.imwrite(f"assets/exam_images/{label}_{x1}_{y1}.png", crop)
  ```

---

### 6. Algorithmic Prompt Optimization: DSPy
- **When to use**:
  - Replacing fragile prompt engineering with compiled language programs.
  - Auto-tuning few-shot examples and instruction prompts against a validation set with strict assertions (`dspy.Assert`).
- **Execution Recipe (Python)**:
  ```python
  import dspy
  class FactVerifier(dspy.Signature):
      """Verify whether a candidate answer is supported by the context."""
      context = dspy.InputField(desc="Source reference material")
      question = dspy.InputField(desc="The question asked")
      answer = dspy.InputField(desc="The candidate answer")
      verdict = dspy.OutputField(desc="VALID, INVALID, or UNCERTAIN with rationale")

  verifier = dspy.ChainOfThought(FactVerifier)
  ```

---

### 7. Code Intelligence & AST: PySlick & Argon
- **When to use**:
  - **`pyslick consult "<question>"`**: Consult Gemini 4 Argon on complex architecture, 3D WebGL/Three.js math, and complex animations.
  - **`pyslick ask "<query>"`**: Fast AST call-graph exploration without burning tokens scanning entire code folders.
  - **`pyslick grep "<query>"`**: Hybrid BM25 + Tree-Sitter AST scope snapping.

---

### 8. Visual Augmentation & Cutouts: Segment Augment Anything (SAM)
- **When to use**:
  - Zero-shot subject segmentation, isolating hero figures, and creating transparent alpha PNG cutouts.
  - OpenCV spatial landmark analysis: detecting bounding contours, color accents, and computing normalized percentage coordinates (`x_pct`, `y_pct`, `w_pct`, `h_pct`).
  - Anchoring cutouts seamlessly into web stages with drop shadows, gradient alpha masks, and responsive breakpoints.
- **Workspace Helper Scripts (`c:\Users\yuze2\Documents\antigravity\proud-hertz`)**:
  - `do_cutout_fast.py` / `do_cutout.py`: Fast rembg / u2netp / SAM background removal script.
  - `analyze_landmarks.py`: OpenCV HSV contour detection; maps landmark bounding boxes to `ref_spatial_landmarks.json`.
  - `apply_sam_slot_css.py`: Injects percentage-based CSS positioning (`left: 67%`, `z-index: 25`, gradient fade masks).
  - `embed_cutout_html.py`: Injects the `<div class="hero-vargas-stage-slot">` into the web page.

---

### 9. Physical Layout QA & 3D Element Overlap: `/spatial`
- **When to use**:
  - Inspecting rendered DOM geometry via headless Microsoft Edge CDP.
  - Catching **P0 Click Blockers**: finding interactive buttons covered by transparent backdrops or fixed headers.
  - Catching **P1 Text Collisions**: overlapping sibling text or content clipped by `overflow: hidden`.
  - Detecting **Z-Index Traps**: elements trapped in low parent stacking contexts (`transform`, `opacity < 1`, `isolation`).
  - Generating interactive 3D WebGL stacking visualizers (`3d-inspector.html`).

---

### 10. Cloud Storage Integration: Google Drive (`gdrive`)
- **When to use**:
  - Browsing, searching, downloading, and uploading files directly to/from Google Drive.
- **Commands**:
  ```powershell
  gdrive readonly search --name-contains "math"
  gdrive readonly ls <folder_id>
  gdrive readonly download <file_id>
  ```

---

### 11. Mobile Hybrid Apps: PNPM Android
- **When to use**:
  - Building offline-first hybrid Android apps with Next.js, Capacitor, PNPM, and Tailwind CSS.
  - Debugging AAPT asset exclusions, Java offline asset routing, and generating release APKs.

---

### 12. Multimodal Vectors & Acoustics: CLIP & Audio Vectors
- **When to use**:
  - Converting raw images into 512-dim normalized vectors for zero-shot image classification and visual similarity.
  - Converting audio waveforms (WAV/MP3) into acoustic feature vectors (Loudness dB, Dominant Frequency, Spectral Centroid, Mel-bands) to identify environmental sounds (e.g. bird chirps, alarms, motor frequencies).
- **Execution Recipe (Python)**:
  ```powershell
  # Zero-shot image classification against text labels
  python scripts/multimodal_embeddings.py match-image photo.png --prompts "bird, car, document"

  # Audio acoustic diagnostic and frequency triage
  python scripts/multimodal_embeddings.py triage-audio audio.wav
  ```

---

### 13. Frontier LLM Specialization for UI & Visual Engineering
- **Claude (Sonnet / Opus)**:
  - **Core Role**: **Decluttering UI (Paired with UI / Anti-Slop Skill)**
  - Strips redundant wrapper cards, removes emoji slop, simplifies nesting, and refactors messy layouts into clean, token-disciplined frontend code.
- **Gemini Argon**:
  - **Core Role**: **Recreating the UI**
  - High-reasoning model for structural UI reconstruction, complex 3D WebGL / Three.js geometry, spatial transforms, and pixel-precise layout reverse-engineering.
- **ChatGPT (GPT-4o)**:
  - **Core Role**: **Creating Stunning UI from Images**
  - Translates visual screenshots, mockups, and reference images into vibrant, modern frontend components.

---

## 🎯 Exam Categorization Taxonomy (CSC & UPCAT Grouping)

When compiling question banks into local JSON (`assets/exam_bank.json`):

### Civil Service Examination (`civil_service_exam`):
- `english`: Vocabulary, Grammar, Paragraph Organization, Reading Comprehension
- `filipino`: Filipino Vocabulary (*Talasalitaan*), Reading Comprehension
- `math`: Basic Operations, Fractions/Decimals, Percentages, Ratios, Word Problems, Number Matrices ($3\times3$, $4\times4$), Data Sufficiency
- `analytical`: Word Analogy, Categorical Syllogisms & Venn Logic, Symbolic Logic, Data Interpretation (Tables, Charts)
- `clerical`: Alphabetical Filing, Clerical Codes, Spelling, Sequencing (Subprofessional)
- `general_information`: Philippine Constitution, RA 6713 Code of Conduct, Environmental Protection, Human Rights

### UPCAT (`upcat`):
- `language_proficiency`: English & Filipino Grammar, Vocabulary, *Sawikain* (Idioms), *Tayutay* (Figures of Speech)
- `reading_comprehension`: Passages, Essays, and Critical Inferences
- `mathematics`: Algebra, Geometry, Trigonometry, Precalculus & Calculus
- `science`: Biology, Chemistry, Physics, Earth Science

