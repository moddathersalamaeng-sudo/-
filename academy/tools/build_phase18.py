#!/usr/bin/env python3
"""Phase 18 builder — the owner's course videos (idempotent). Run after build_phase17.py and before build_phase10a.mjs.
Writes data/seed/videos.json (catalogue + where each video appears), the "vd18" strings (AR/EN), links assets/css/video.css,
sets version 2.4.0 and config.videoBase. The video files themselves live in the separate repository cia-videos (GitHub Pages,
same origin as the Academy, so the Content-Security-Policy 'self' covers them). D-125."""
import json, pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "phase18"))
import placements as P  # noqa: E402
import i18n_vd18 as S  # noqa: E402
VERSION = "2.4.0"
VIDEO_BASE = "../../cia-videos/"
TODAY = "2026-11-26"
cat = json.loads((ROOT / "tools" / "phase18" / "catalog.json").read_text(encoding="utf-8"))
courses = {c["id"]: c for c in json.loads((ROOT / "data" / "seed" / "courses.json").read_text(encoding="utf-8"))["items"]}
def lesson(cid, n):
    c = courses[cid]; ls = [l for m in c["modules"] for l in m["lessons"]]
    assert 1 <= n <= len(ls), (cid, n); return ls[n - 1]["id"]
out, missing = [], []
for v in cat:
    assert v["id"] in P.P, v["id"]
    pl = []
    for cid, n in P.P[v["id"]]:
        if cid not in courses: missing.append((v["id"], cid)); continue
        pl.append({"course_id": cid, "lesson_id": lesson(cid, n) if n else None})
    if v["series"] == "iso9001-2026" and v["clause"]:
        g = courses.get("CRS-G-9001")
        for m in g["modules"]:
            for l in m["lessons"]:
                ref = (l.get("source") or {}).get("ref", "")
                if ref == v["clause"] or ref.startswith(v["clause"] + "."): pl.append({"course_id": g["id"], "lesson_id": l["id"]})
    out.append({**v, "placements": pl, "governance": {"content_status": "published", "content_source": "owner", "version": "1.0", "reviewer": "مدثر سلامه", "review_date": TODAY,
        "drafted_by": "owner", "approval_basis": "owner_request_in_conversation", "change_note": "Owner's own videos, linked on the owner's request (conversation, 26 Nov 2026). Placement list: deliverables/phase-18/VIDEO_PLACEMENTS.md."}})
assert not missing, missing
doc = {"schema": "cia.videos.v1", "series": [{"id": k, "title": t, "about": P.SERIES_ABOUT[k]} for k, t in P.SERIES.items()], "items": out}
(ROOT / "data" / "seed" / "videos.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
ph = lambda s: set(re.findall(r"\{(\w+)\}", s))
for k, v in S.flatten(S.S): assert v["en"].strip() and v["ar"].strip() and ph(v["en"]) == ph(v["ar"]), k
for lang in ("en", "ar"):
    p = ROOT / "data" / "i18n" / f"{lang}.json"; raw = p.read_text(encoding="utf-8"); d = json.loads(raw)
    d["vd18"] = S.tree(lang)
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n" if "\n" in raw.strip() else json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
cfg = ROOT / "data" / "config.json"; c = json.loads(cfg.read_text(encoding="utf-8")); c["videoBase"] = VIDEO_BASE
if tuple(map(int, c["version"].split("-")[0].split("."))) < tuple(map(int, VERSION.split("."))): c["version"] = VERSION
cfg.write_text(json.dumps(c, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
idx = ROOT / "index.html"; html = idx.read_text(encoding="utf-8")
if "assets/css/video.css" not in html:
    html = html.replace('<link rel="stylesheet" href="./assets/css/review.css">\n', '<link rel="stylesheet" href="./assets/css/review.css">\n<link rel="stylesheet" href="./assets/css/video.css">\n', 1)
    idx.write_text(html, encoding="utf-8")
assert "assets/css/video.css" in idx.read_text(encoding="utf-8")
n_pl = sum(len(v["placements"]) for v in out)
print(f"Phase 18 build: {len(out)} videos, {n_pl} placements ({len({p['lesson_id'] for v in out for p in v['placements'] if p['lesson_id']})} lessons); {sum(1 for _ in S.flatten(S.S))} vd18 strings × 2; config {c['version']}.")
