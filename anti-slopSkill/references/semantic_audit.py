#!/usr/bin/env python3
"""
semantic_audit.py - semantic duplicate finder for UI code (final audit step in ui-laws.txt).

Finds, per page/file group:
  * button/link/text pairs that mean the same thing in different words
    (sentence-transformers cosine similarity >= --threshold)
  * buttons that lead to the same route / handler even when worded differently
It NEVER edits or deletes anything. Review the report, then decide.

Setup:   pip install sentence-transformers
Usage:   python semantic_audit.py <src_dir> [--threshold 0.70] [--ext tsx,jsx,html,vue,svelte]
                                  [--model all-MiniLM-L6-v2] [--out report.md] [--json]
         python semantic_audit.py "C:\\path\\to\\project\\src"

Pages are grouped by file. To merge files into one logical page, pass
--group "Library=app/page.tsx,features/upload/PastDecks.tsx" (repeatable).
"""
import argparse
import itertools
import json
import re
import sys
from pathlib import Path

TEXT = re.compile(r">\s*([A-Za-z][^<>{}\n]{2,80}?)\s*<")
ATTR = re.compile(r'(?:title|aria-label|placeholder|alt)="([^"{}]{3,80})"')
ROUTE = re.compile(
    r"(?:router\.push|router\.replace|safeNavigate\([^,]+,|navigate|location\.href\s*=)\s*\(?\s*['\"`]([^'\"`]+)['\"`]"
)
HREF = re.compile(r'href=(?:\{)?["`]?([^"`\s}>]+)')
ONCLICK = re.compile(r"onClick=\{\s*(?:\(\)\s*=>\s*)?([A-Za-z_][A-Za-z0-9_]*)\b")
BTN = re.compile(r"<(?:button|a|Link)\b.*?</(?:button|a|Link)>", re.S)
SKIP_DIRS = {"node_modules", ".next", "out", "dist", "build", "graphify-out", ".git"}


def collect_files(root: Path, exts):
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lstrip(".") in exts and not (set(p.parts) & SKIP_DIRS):
            yield p


def extract(src: str):
    items = []
    spans = []
    for m in BTN.finditer(src):
        blk = m.group(0)
        spans.append(m.span())
        labels = [t.strip() for t in TEXT.findall(blk)] + ATTR.findall(blk)
        label = " ".join(dict.fromkeys(labels))[:80]
        target = "|".join(ROUTE.findall(blk) + HREF.findall(blk))
        handler = "|".join(ONCLICK.findall(blk))
        if label:
            items.append({"kind": "button", "text": label, "target": target, "handler": handler})
    for m in TEXT.finditer(src):
        if any(a <= m.start() < b for a, b in spans):
            continue
        items.append({"kind": "text", "text": m.group(1).strip(), "target": "", "handler": ""})
    seen, out = set(), []
    for it in items:
        k = (it["kind"], it["text"])
        if k not in seen:
            seen.add(k)
            out.append(it)
    return out


def main():
    ap = argparse.ArgumentParser(description="Semantic duplicate audit for UI code (report only).")
    ap.add_argument("src", help="source directory to scan")
    ap.add_argument("--threshold", type=float, default=0.70)
    ap.add_argument("--ext", default="tsx,jsx,html,vue,svelte")
    ap.add_argument("--model", default="all-MiniLM-L6-v2")
    ap.add_argument("--group", action="append", default=[], help='"Name=relpath,relpath" to merge files into one page')
    ap.add_argument("--out", help="write a markdown report to this path")
    ap.add_argument("--json", action="store_true", help="print JSON instead of text")
    args = ap.parse_args()

    root = Path(args.src).resolve()
    if not root.is_dir():
        sys.exit(f"not a directory: {root}")

    files = {p.relative_to(root).as_posix(): p for p in collect_files(root, set(args.ext.split(",")))}
    pages = {}
    grouped = set()
    for g in args.group:
        name, _, rest = g.partition("=")
        rels = [r.strip() for r in rest.split(",") if r.strip()]
        pages[name] = [r for r in rels if r in files]
        grouped.update(rels)
    for rel in files:
        if rel not in grouped:
            pages[rel] = [rel]

    from sentence_transformers import SentenceTransformer, util

    model = SentenceTransformer(args.model)
    report = []
    for page, rels in pages.items():
        items = []
        for rel in rels:
            for it in extract(files[rel].read_text(encoding="utf8", errors="ignore")):
                it["file"] = rel
                items.append(it)
        if len(items) < 2:
            continue
        emb = model.encode([i["text"] for i in items], convert_to_tensor=True, normalize_embeddings=True)
        sim = util.cos_sim(emb, emb)
        pairs = []
        for i, j in itertools.combinations(range(len(items)), 2):
            a, b = items[i], items[j]
            s = float(sim[i][j])
            same_target = bool(a["target"] and a["target"] == b["target"])
            same_handler = bool(a["handler"] and a["handler"] == b["handler"])
            if s >= args.threshold or same_target or same_handler:
                pairs.append(
                    {
                        "similarity": round(s, 2),
                        "reason": "same route" if same_target else "same handler" if same_handler else "similar meaning",
                        "a": a,
                        "b": b,
                    }
                )
        pairs.sort(key=lambda p: -p["similarity"])
        if pairs:
            report.append({"page": page, "items": len(items), "candidates": pairs})

    if args.json:
        print(json.dumps(report, indent=2))
        return

    lines = [f"# Semantic audit ({args.model}, threshold {args.threshold})", "", "Report only - nothing was changed.", ""]
    for r in report:
        lines.append(f"## {r['page']} ({r['items']} strings)")
        for p in r["candidates"]:
            a, b = p["a"], p["b"]
            lines.append(
                f"- {p['similarity']:.2f} [{p['reason']}] {a['kind']} \"{a['text']}\" <-> {b['kind']} \"{b['text']}\""
                + (f"  -> {a['target'] or a['handler']}" if p["reason"] != "similar meaning" else "")
            )
        lines.append("")
    if not report:
        lines.append("No candidates found.")
    text = "\n".join(lines)
    print(text)
    if args.out:
        Path(args.out).write_text(text, encoding="utf8")


if __name__ == "__main__":
    main()
