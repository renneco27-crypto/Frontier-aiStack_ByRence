# Frontier AI Stack & Multimodal Engineering Suite (`Frontier-aiStack_ByRence`)

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Powered By: Antigravity](https://img.shields.io/badge/Powered%20By-Google%20Antigravity-4285F4.svg)](#)
[![Multimodal: CLIP & Audio](https://img.shields.io/badge/Multimodal-Vision%20%2B%20Acoustics-green.svg)](#)

A unified frontier AI decision matrix, multimodal vectorization suite, and deterministic verification framework. Built to replace fragile prompt engineering and unearned LLM token burns with **high-velocity token compression, cross-modal vector projection (Vision & Audio), sub-millisecond sparse retrieval (BM25), and graph-based knowledge traversal.**

---

## 🏛️ System Architecture

![Frontier AI Stack Architecture](assets/frontier_architecture.svg)

---

## 🌐 Multimodal Vector Projection Engine

![Multimodal Vector Pipeline](assets/multimodal_pipeline.svg)

Projects **Images**, **Acoustic Waveforms (Sound & dB Loudness)**, and **Natural Language Text** into shared high-dimensional vector spaces for instant zero-shot classification and semantic search.

---

## ⚡ The Decision Matrix at a Glance

| Goal | Primary Technology / Tool | Why & When to Trigger |
| :--- | :--- | :--- |
| **Images to Vectors & Zero-Shot Classification** | **`scripts/multimodal_embeddings.py` (CLIP / SigLIP)** | Encodes images into normalized 512-dim vectors; matches photos against natural language text labels. |
| **Sound & Acoustic Waveforms to Vectors** | **`scripts/multimodal_embeddings.py` (FFT & Mel Bands)** | Extracts dB loudness, dominant pitch frequencies, spectral centroids, and Mel bands (e.g. bird chirps vs motor rumble). |
| **High-Velocity Prompt & Token Compression** | **`scripts/ml_compressor.py` (Microsoft LLMLingua-2)** | Uses SLM token classification distilled from frontier LLMs to achieve 50%-70% token reductions with 0% semantic loss. |
| **Deterministic QA & Factual Verification** | **`scripts/qa_engine.py` (BM25 + Syntactic Parsing)** | Determines if an input is an interrogative question and verifies factual support against document corpora in $< 5\text{ms}$. |
| **Sub-Second Lexical Audio/Video Search** | **`scripts/search_transcript.py` (BM25Okapi)** | Traverses 10,000+ lines of transcripts and lecture timestamps in milliseconds with zero AI token cost. |
| **Graph Knowledge Traversal** | **Graphify (`graphify query`)** | BFS relationship traversal over connected documentation nodes, concepts, and codebases within a strict token budget. |
| **Deep Reasoning & 3D WebGL Math** | **Argon (`argon`) / PySlick (`pyslick consult`)** | High-complexity reasoning model for intricate geometry, Three.js shaders, and complex system design. |
| **Physical Layout QA & 3D Stacking** | **Spatial Inspector (`/spatial`)** | Headless browser CDP 5-point hit testing, z-index traps, and 3D WebGL DOM stacking visualizer. |

---

## 🚀 Quickstart & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/renneco27-crypto/Frontier-aiStack_ByRence.git
cd Frontier-aiStack_ByRence
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

---

## 🛠️ Tooling Runbook & CLI Usage

### 1. Multimodal Vision & Audio Vectors
```bash
# 1. Zero-shot match an image against candidate descriptions
python scripts/multimodal_embeddings.py match-image sample.png --prompts "bird, car, circuit board, receipt"

# 2. Extract acoustic fingerprint (loudness dB, dominant Hz, spectral centroid) from audio
python scripts/multimodal_embeddings.py triage-audio recording.wav

# 3. Generate raw 512-dim normalized image vector
python scripts/multimodal_embeddings.py image sample.png
```

### 2. Microsoft LLMLingua-2 Token Compressor
```bash
# Compress a verbose prompt down to a 50% token budget
python scripts/ml_compressor.py compress "In my opinion, as you can see, when configuring VirtualBox..." --rate 0.5

# Digest an entire directory of notes into high-velocity JSON vectors
python scripts/ml_compressor.py digest --dir ./notes --out ./roadmaps/high_velocity_digest.json --rate 0.5
```

### 3. Deterministic BM25 QA Engine
```bash
# Validate question syntax and retrieve factual verification passages
python scripts/qa_engine.py --docs ./documents --question "What is the network adapter mode?" --candidate "Host-Only"
```

### 4. High-Speed Video & Transcript Retrieval
```bash
# Search 10,000+ transcript lines with sub-second BM25 scoring
python scripts/search_transcript.py "port scanner socket"
```

---

## 📦 Repository Structure

```
Frontier-aiStack_ByRence/
├── assets/
│   ├── frontier_architecture.svg    # System architecture vector diagram
│   └── multimodal_pipeline.svg      # Multimodal vector projection diagram
├── scripts/
│   ├── multimodal_embeddings.py     # Vision & Audio acoustic vector engine
│   ├── ml_compressor.py             # Microsoft LLMLingua-2 prompt compressor
│   ├── qa_engine.py                 # BM25 deterministic QA verifier
│   └── search_transcript.py         # Sub-millisecond transcript search engine
├── SKILL.md                         # Antigravity skill specification & decision router
├── requirements.txt                 # Production dependencies
├── .gitignore                       # Clean Git exclusion rules
└── README.md                        # Documentation & Visual Guide
```

---

## 📄 License

MIT License. Created and maintained by **Rence** with **Google Antigravity**.
