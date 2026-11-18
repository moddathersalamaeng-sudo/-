#!/usr/bin/env python3
"""Phase 15 builder — visual lessons (idempotent; keeps every approval). Run after build_phase14.py and before build_phase10a.mjs.
Writes the "sl15" strings (AR/EN), links assets/css/slides.css in index.html, sets version 2.1.0. No content record changes:
the deck is built in the browser from each lesson's own published text (src/domain/visuals.mjs, D-122)."""
import json, pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "phase15"))
import i18n_sl15 as S  # noqa: E402
VERSION = "2.1.0"
ph = lambda s: set(re.findall(r"\{(\w+)\}", s))
for k, v in S.flatten(S.S):
    assert v["en"].strip() and v["ar"].strip() and ph(v["en"]) == ph(v["ar"]), k
for lang in ("en", "ar"):
    p = ROOT / "data" / "i18n" / f"{lang}.json"; raw = p.read_text(encoding="utf-8"); d = json.loads(raw)
    d["sl15"] = S.tree(lang)
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n" if "\n" in raw.strip() else json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
cfg = ROOT / "data" / "config.json"; c = json.loads(cfg.read_text(encoding="utf-8")); c["version"] = VERSION
cfg.write_text(json.dumps(c, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
idx = ROOT / "index.html"; html = idx.read_text(encoding="utf-8")
if "assets/css/slides.css" not in html:
    html = html.replace('<link rel="stylesheet" href="./assets/css/admin.css">\n', '<link rel="stylesheet" href="./assets/css/admin.css">\n<link rel="stylesheet" href="./assets/css/slides.css">\n', 1)
    idx.write_text(html, encoding="utf-8")
assert "assets/css/slides.css" in idx.read_text(encoding="utf-8")
print(f"Phase 15 build: {sum(1 for _ in S.flatten(S.S))} sl15 strings × 2; slides.css linked; config {VERSION}.")
