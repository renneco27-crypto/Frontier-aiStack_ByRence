#!/usr/bin/env python3
"""
Production Prompt & Token Compressor powered by Microsoft LLMLingua-2
Uses budget-aware token classification distilled from state-of-the-art LLMs
to achieve high compression ratios while strictly preserving technical semantics and code.
"""

import sys
import json
import argparse
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Lazy import of PromptCompressor to keep CLI snappy
LLMLINGUA_AVAILABLE = True

_compressor_instance = None

def get_compressor():
    global _compressor_instance
    if _compressor_instance is None:
        try:
            from llmlingua import PromptCompressor
            print("🧠 Initializing Microsoft LLMLingua-2 Compressor (CPU)...")
            _compressor_instance = PromptCompressor(
                model_name="microsoft/llmlingua-2-xlm-roberta-large-meeting",
                use_llmlingua2=True,
                device_map="cpu"
            )
        except Exception as e:
            print(f"Error loading LLMLingua: {e}")
            return None
    return _compressor_instance

def compress_text_llmlingua(text: str, rate: float = 0.5) -> dict:
    compressor = get_compressor()
    if not compressor:
        return {
            "error": "LLMLingua is not available.",
            "compressed_text": text
        }

    results = compressor.compress_prompt(
        text,
        rate=rate,
        force_tokens=["\n", "?", "!", ".", "http", "nmap", "ip", "def", "class", "{", "}", "SELECT", "WHERE"],
        drop_consecutive=True
    )

    return {
        "original_tokens": results.get("origin_tokens", len(text.split())),
        "compressed_tokens": results.get("compressed_tokens", 0),
        "ratio": results.get("ratio", f"{rate * 100}%"),
        "compressed_text": results.get("compressed_prompt", text)
    }

def process_notes_directory(notes_dir: str, out_file: str, rate: float = 0.5):
    in_path = Path(notes_dir)
    if not in_path.exists():
        print(f"Directory {notes_dir} not found.")
        return

    compressor = get_compressor()
    digest = []

    for md_file in in_path.glob("*.md"):
        with open(md_file, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        print(f"⚡ Compressing {md_file.name} with Microsoft LLMLingua...")
        res = compress_text_llmlingua(content, rate=rate)
        digest.append({
            "file": md_file.name,
            "orig_tokens": res.get("original_tokens"),
            "compressed_tokens": res.get("compressed_tokens"),
            "compressed_content": res.get("compressed_text")
        })

    out_path = Path(out_file)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(digest, f, indent=2)

    print(f"🎉 Production High-Velocity Digest generated via LLMLingua: {out_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Microsoft LLMLingua-2 Token Compressor")
    subparsers = parser.add_subparsers(dest="command")

    # Compress single string
    c_p = subparsers.add_parser("compress", help="Compress a text prompt")
    c_p.add_argument("text", help="Text to compress")
    c_p.add_argument("--rate", type=float, default=0.5, help="Target retention rate (e.g. 0.5 for 50%)")

    # Digest notes directory
    d_p = subparsers.add_parser("digest", help="Compress entire notes directory")
    d_p.add_argument("--dir", default="notes", help="Input notes directory")
    d_p.add_argument("--out", default="roadmaps/llmlingua_notes_digest.json", help="Output JSON path")
    d_p.add_argument("--rate", type=float, default=0.5, help="Retention rate")

    args = parser.parse_args()

    if args.command == "compress":
        res = compress_text_llmlingua(args.text, rate=args.rate)
        print("\n--- LLMLingua Output ---")
        print(f"Original Tokens: {res.get('original_tokens')}")
        print(f"Compressed Tokens: {res.get('compressed_tokens')}")
        print(f"Retention Ratio: {res.get('ratio')}")
        print(f"Result:\n{res.get('compressed_text')}\n")
    elif args.command == "digest":
        process_notes_directory(args.dir, args.out, rate=args.rate)
    else:
        parser.print_help()
