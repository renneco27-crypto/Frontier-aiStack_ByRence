#!/usr/bin/env python3
"""
Transcript BM25 Search Engine
Allows instant millisecond keyword & phrase retrieval across the 10,755 transcript lines
of TCM Security's 'Ethical Hacking in 15 Hours (Part 1)' course.
"""

import sys
import json
from pathlib import Path
from rank_bm25 import BM25Okapi

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
TRANSCRIPT_FILE = WORKSPACE_ROOT / "roadmaps" / "tcm_part1_transcript.json"

def format_timestamp(seconds: float) -> str:
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hrs > 0:
        return f"{hrs}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"

def search_transcript(query: str, top_k: int = 5):
    if not TRANSCRIPT_FILE.exists():
        print(f"Error: Transcript file not found at {TRANSCRIPT_FILE}")
        return []

    with open(TRANSCRIPT_FILE, "r", encoding="utf-8") as f:
        transcript = json.load(f)

    # Group into 30-second windows for coherent context
    WINDOW_SIZE = 6
    chunks = []
    for i in range(0, len(transcript), WINDOW_SIZE):
        window = transcript[i:i + WINDOW_SIZE]
        text_block = " ".join([t["text"] for t in window])
        start_time = window[0]["start"]
        chunks.append({
            "start": start_time,
            "timestamp": format_timestamp(start_time),
            "text": text_block,
            "url": f"https://www.youtube.com/watch?v=3FNYvj2U0HM&t={int(start_time)}s"
        })

    tokenized_corpus = [c["text"].lower().split() for c in chunks]
    bm25 = BM25Okapi(tokenized_corpus)
    tokenized_query = query.lower().split()
    scores = bm25.get_scores(tokenized_query)

    ranked_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]

    results = []
    print(f"\n🔍 BM25 Transcript Results for '{query}':\n")
    for rank, idx in enumerate(ranked_indices, 1):
        if scores[idx] > 0 or rank == 1:
            item = chunks[idx]
            print(f"{rank}. [{item['timestamp']}] (Score: {scores[idx]:.3f})")
            print(f"   Excerpt: \"{item['text']}\"")
            print(f"   Direct Video Link: {item['url']}\n")
            results.append(item)

    return results

if __name__ == "__main__":
    q = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "port scanner socket"
    search_transcript(q)
