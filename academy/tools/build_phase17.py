#!/usr/bin/env python3
"""Phase 17 builder — daily review cards (idempotent). Run after build_phase16.py and before build_phase10a.mjs.
Writes the "rv17" strings and the My space tab label (AR/EN), links assets/css/review.css, sets version 2.3.0. No content changes (D-124)."""
import json, pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "phase17"))
import i18n_rv17 as S  # noqa: E402
VERSION = "2.3.0"
TAB = {"en": "Daily review", "ar": "المراجعة اليومية"}
ph = lambda s: set(re.findall(r"\{(\w+)\}", s))
for k, v in S.flatten(S.S):
    assert v["en"].strip() and v["ar"].strip() and ph(v["en"]) == ph(v["ar"]), k
for lang in ("en", "ar"):
    p = ROOT / "data" / "i18n" / f"{lang}.json"; raw = p.read_text(encoding="utf-8"); d = json.loads(raw)
    d["rv17"] = S.tree(lang); d["x10a"]["my"]["tabs"]["review"] = TAB[lang]
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n" if "\n" in raw.strip() else json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
cfg = ROOT / "data" / "config.json"; c = json.loads(cfg.read_text(encoding="utf-8"))
if tuple(map(int, c["version"].split("-")[0].split("."))) < tuple(map(int, VERSION.split("."))): c["version"] = VERSION
cfg.write_text(json.dumps(c, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
idx = ROOT / "index.html"; html = idx.read_text(encoding="utf-8")
if "assets/css/review.css" not in html:
    html = html.replace('<link rel="stylesheet" href="./assets/css/certificate.css">\n', '<link rel="stylesheet" href="./assets/css/certificate.css">\n<link rel="stylesheet" href="./assets/css/review.css">\n', 1)
    idx.write_text(html, encoding="utf-8")
assert "assets/css/review.css" in idx.read_text(encoding="utf-8")
print(f"Phase 17 build: {sum(1 for _ in S.flatten(S.S))} rv17 strings × 2; review.css linked; config {c['version']}.")
