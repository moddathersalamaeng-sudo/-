#!/usr/bin/env python3
"""Phase 16 builder — certificates (idempotent; keeps every approval). Run after build_phase15.py and before build_phase10a.mjs.
Writes the "cx16" strings (AR/EN), links assets/css/certificate.css, sets version 2.2.0 and the public address the QR codes
point to. No content record changes (D-123)."""
import json, pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "phase16"))
import i18n_cx16 as S  # noqa: E402
VERSION = "2.2.0"
PUBLIC_BASE = "https://moddathersalamaeng-sudo.github.io/-/academy/"
ph = lambda s: set(re.findall(r"\{(\w+)\}", s))
for k, v in S.flatten(S.S):
    assert v["en"].strip() and v["ar"].strip() and ph(v["en"]) == ph(v["ar"]), k
for lang in ("en", "ar"):
    p = ROOT / "data" / "i18n" / f"{lang}.json"; raw = p.read_text(encoding="utf-8"); d = json.loads(raw)
    d["cx16"] = S.tree(lang)
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n" if "\n" in raw.strip() else json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
cfg = ROOT / "data" / "config.json"; c = json.loads(cfg.read_text(encoding="utf-8")); c["publicBase"] = PUBLIC_BASE
if tuple(map(int, c["version"].split("-")[0].split("."))) < tuple(map(int, VERSION.split("."))): c["version"] = VERSION
cfg.write_text(json.dumps(c, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
idx = ROOT / "index.html"; html = idx.read_text(encoding="utf-8")
if "assets/css/certificate.css" not in html:
    html = html.replace('<link rel="stylesheet" href="./assets/css/slides.css">\n', '<link rel="stylesheet" href="./assets/css/slides.css">\n<link rel="stylesheet" href="./assets/css/certificate.css">\n', 1)
    idx.write_text(html, encoding="utf-8")
assert "assets/css/certificate.css" in idx.read_text(encoding="utf-8")
print(f"Phase 16 build: {sum(1 for _ in S.flatten(S.S))} cx16 strings × 2; certificate.css linked; config {VERSION}.")
