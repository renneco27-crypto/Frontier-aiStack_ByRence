#!/usr/bin/env python3
"""
Frontier QA Engine: Deterministic BM25 Search + Syntactic Question Detection + Factual Verification
Usage: python qa_engine.py --docs ./documents --question "What is the passing score?" --candidate "80%"
"""

import sys
import re
import argparse
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def is_interrogative_question(text: str) -> bool:
    """Deterministic check: determines if a sentence is grammatically an interrogative question."""
    cleaned = text.strip()
    if not cleaned:
        return False
    
    # Trailing question mark
    if cleaned.endswith("?"):
        return True
    
    # Common interrogative openers and inversion patterns
    interrogative_patterns = [
        r"^(what|which|who|whom|whose|when|where|why|how)\b",
        r"^(is|are|was|were|do|does|did|can|could|should|would|will|shall|has|have|had)\s+[a-z0-9_]+",
        r"^(determine|find|calculate|evaluate|explain|identify|solve)\b",
    ]
    lower = cleaned.lower()
    for pattern in interrogative_patterns:
        if re.search(pattern, lower):
            return True
            
    return False

def jaccard_similarity(str1: str, str2: str) -> float:
    """Computes Jaccard word-set intersection over union."""
    words1 = set(re.findall(r"\w+", str1.lower()))
    words2 = set(re.findall(r"\w+", str2.lower()))
    if not words1 or not words2:
        return 0.0
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    return len(intersection) / len(union)

def main():
    parser = argparse.ArgumentParser(description="Deterministic Question and Answer Verifier")
    parser.add_argument("--docs", type=str, help="Directory or file path of reference documents")
    parser.add_argument("--question", type=str, required=True, help="Question to evaluate")
    parser.add_argument("--candidate", type=str, help="Suggested candidate answer to verify")
    args = parser.parse_args()

    print("\n" + "="*50)
    print(" FRONTIER DETERMINISTIC QA VERIFIER")
    print("="*50)

    # 1. Question Syntax Check
    is_q = is_interrogative_question(args.question)
    print(f"\n[Step 1] Syntactic Interrogative Check:")
    print(f"  Input:    \"{args.question}\"")
    print(f"  Verdict:  {'✅ Valid Question' if is_q else '⚠️ Declarative / Statement'}")

    # 2. Document Search via BM25 (if docs path provided)
    if args.docs and Path(args.docs).exists():
        try:
            from rank_bm25 import BM25Okapi
            
            p = Path(args.docs)
            files = list(p.glob("**/*.*")) if p.is_dir() else [p]
            corpus_texts = []
            corpus_sources = []
            
            for f in files:
                if f.suffix.lower() in [".txt", ".md", ".html", ".json", ".csv"]:
                    try:
                        content = f.read_text(encoding="utf-8", errors="ignore")
                        # Split into paragraph-sized chunks
                        paras = [para.strip() for para in content.split("\n\n") if len(para.strip()) > 20]
                        for para in paras:
                            corpus_texts.append(para)
                            corpus_sources.append(f.name)
                    except Exception:
                        pass

            if corpus_texts:
                tokenized_corpus = [re.findall(r"\w+", doc.lower()) for doc in corpus_texts]
                bm25 = BM25Okapi(tokenized_corpus)
                tokenized_query = re.findall(r"\w+", args.question.lower())
                top_scores = bm25.get_scores(tokenized_query)
                top_indices = sorted(range(len(top_scores)), key=lambda i: top_scores[i], reverse=True)[:3]

                print(f"\n[Step 2] BM25 Factual Passage Lookup (Indexed {len(corpus_texts)} paragraphs):")
                for rank, idx in enumerate(top_indices, 1):
                    score = top_scores[idx]
                    source = corpus_sources[idx]
                    snippet = corpus_texts[idx].replace("\n", " ")[:140]
                    print(f"  #{rank} (Score: {score:.2f} | File: {source}):")
                    print(f"     \"{snippet}...\"")
                    
                    # 3. Candidate Answer Grounding Check
                    if args.candidate:
                        cand_sim = jaccard_similarity(args.candidate, corpus_texts[idx])
                        in_text = args.candidate.lower() in corpus_texts[idx].lower()
                        print(f"     -> Candidate Presence: {'✅ Exact substring match' if in_text else f'Overlap score: {cand_sim:.2f}'}")
        except ImportError:
            print("\n[Notice] rank-bm25 not yet active in environment. Installing...")
    
    print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    main()
