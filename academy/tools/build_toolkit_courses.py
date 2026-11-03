#!/usr/bin/env python3
"""Build the Academy's requirement and method guides, and the courses generated from them, out of the content
the owner published inside the hub toolkits (extracted first by tools/extract_toolkit_content.mjs).

  node tools/extract_toolkit_content.mjs        # toolkit HTML  → tools/_extract/*.json (raw, not shipped)
  python3 tools/build_toolkit_courses.py        # raw extracts  → data/guides/*, generated courses, questions, assessments

Outputs
  data/guides/index.json            one governed record per guide (9 standards + 14 methods)
  data/guides/<slug>.json           the guide itself: clauses/sections → items, glossary, FAQ, links, changes …
  data/seed/lesson-guide-map.json   existing lesson → guide items it teaches (shown in the lesson player)
  data/seed/courses.json …          generated courses CRS-G-* / CRS-M-*, questions Q-G-* / Q-M-*, assessments ASM-G-* / ASM-M-*,
                                    sources SRC-TK-*, catalog REC-CRS-G-*, library LIB-SIM-* (Quality Mission), relationships

Governance
  * Guide records mirror text the owner wrote and published in the live toolkits, word for word: they are recorded as
    owner publications (content_source "owner", reviewer "Owner publication (live toolkit)", date of the live commit).
    No Academy review is implied. To hold them back instead, run with --guides-status needs_review.
  * Generated courses, check questions and assessments are assembled by this script: content_source "system",
    status "needs_review". They are published only through tools/apply_review_decisions.py.
  * Re-running keeps approvals of generated records whose content did not change (tools/review_hash.py).
"""
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SEED = ROOT / "data" / "seed"
GUIDES = ROOT / "data" / "guides"
EXTRACT = HERE / "_extract"
sys.path.insert(0, str(HERE))
from review_hash import keep_approvals  # noqa: E402

LIVE_COMMIT, LIVE_DATE = "db802aa", "2026-10-28"
GUIDES_STATUS = sys.argv[sys.argv.index("--guides-status") + 1] if "--guides-status" in sys.argv else "published"
T = lambda en, ar: {"en": en, "ar": ar}  # noqa: E731


def load(name):
    return json.loads((SEED / f"{name}.json").read_text(encoding="utf-8"))


DROPPED = []


def save(name, doc, base=SEED):
    path = base / f"{name}.json"
    if path.exists() and isinstance(doc.get("items"), list):
        DROPPED.extend(f"{name}:{i}" for i in keep_approvals(json.loads(path.read_text(encoding="utf-8")).get("items", []), doc["items"]))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2 if base == SEED else 1) + "\n", encoding="utf-8")


def toolkit_version(module):
    """The toolkit's own <meta name="cia-version"> (e.g. "1.0.0 · 2026-10-22"), read from the platform copy."""
    html = (ROOT.parent / "modules" / f"{module}.html").read_text(encoding="utf-8")
    m = re.search(r'name="cia-version" content="([^"]+)"', html)
    return m.group(1) if m else f"live {LIVE_COMMIT}"


def ext(module):
    return json.loads((EXTRACT / f"{module}.json").read_text(encoding="utf-8"))["data"]


def h(s):
    return int(hashlib.sha1(s.encode()).hexdigest()[:8], 16)


def bi(o):
    """{ar, en} from the toolkits' two shapes ({ar,en} dicts or [ar, en] pairs)."""
    if isinstance(o, dict):
        return {"en": o.get("en", ""), "ar": o.get("ar", "")}
    if isinstance(o, (list, tuple)) and len(o) >= 2:
        return {"ar": o[0], "en": o[1]}
    return {"en": str(o or ""), "ar": str(o or "")}


def bilist(v):
    """A bilingual list in either toolkit shape: [{ar, en}, …] or {ar: [...], en: [...]} (ISO 10009 uses both)."""
    if isinstance(v, dict) and isinstance(v.get("en"), list):
        return [{"en": e, "ar": a} for e, a in zip(v["en"], v.get("ar", []))]
    if isinstance(v, list):
        return [bi(x) for x in v]
    return []


MISTAKE = re.compile(r"^(Common mistake|خطأ شائع)\s*[:：]\s*")


def gaps_and_tips(v):
    """ISO 10009's tool cards ({ar:[…], en:[…]}) mix advice with lines labelled "Common mistake: …" under one heading.
    Split them: the labelled lines are the gaps (label moved to the heading), the rest are tips. Other toolkits list gaps only."""
    rows = bilist(v)
    if not isinstance(v, dict):
        return {"gaps": rows, "tips": []}
    gaps = [{"en": MISTAKE.sub("", x["en"]), "ar": MISTAKE.sub("", x["ar"])} for x in rows if MISTAKE.match(x["en"])]
    tips = [x for x in rows if not MISTAKE.match(x["en"])]
    return {"gaps": gaps, "tips": tips}


owner_gov = lambda version, note: {  # noqa: E731
    "content_status": GUIDES_STATUS, "content_source": "owner", "version": version,
    "reviewer": "Owner publication (live toolkit)" if GUIDES_STATUS == "published" else None,
    "review_date": LIVE_DATE if GUIDES_STATUS == "published" else None, "change_note": note}
system_gov = {"content_status": "needs_review", "content_source": "system", "version": "1.0.0", "reviewer": None, "review_date": None,
              "change_note": "Assembled by tools/build_toolkit_courses.py from the owner's published toolkit guide; lesson text is the owner's, "
                             "course structure and check questions need a named reviewer."}

modules = {m["file"].split("/")[-1].replace(".html", ""): m for m in load("platform-modules")["items"]}

# ===================================================================================== standard guides
STANDARDS = [  # module, slug, code, standard record (if the Academy has one), competencies, ecosystem
    ("iso9001", "iso-9001", "9001", "STD-9001", ["ISO-01", "ISO-02", "QM-01", "QM-04", "AUD-02"], "iso"),
    ("iso14001", "iso-14001", "14001", "STD-14001", ["ISO-01", "ISO-02", "CMP-01", "AUD-02"], "iso"),
    ("iso45001", "iso-45001", "45001", "STD-45001", ["ISO-01", "ISO-02", "RSK-01", "AUD-02"], "iso"),
    ("iso27001", "iso-27001", "27001", "STD-27001", ["ISO-01", "ISO-02", "ISA-01", "RSK-01", "AUD-02"], "iso"),
    ("iso22301", "iso-22301", "22301", None, ["ISO-01", "ISO-02", "BC-01", "BC-02"], "business-continuity"),
    ("iso31000-risk-studio", "iso-31000", "31000", None, ["RSK-01", "RSK-02", "ISO-01"], "risk"),
    ("iso37000-governance", "iso-37000", "37000", None, ["GOV-01", "GOV-02", "LDR-02"], "governance"),
    ("iso37001", "iso-37001", "37001", None, ["CMP-02", "CMP-01", "ISO-01", "ISO-02"], "compliance"),
    ("iso37301", "iso-37301", "37301", None, ["CMP-01", "GOV-02", "ISO-01", "ISO-02"], "compliance"),
]
METHODS = [  # module, slug, code, competencies, ecosystem, level
    ("rca", "rca", "RCA", ["QM-03", "QM-02"], "quality", 2),
    ("five-whys", "five-whys", "WHY5", ["QM-03"], "quality", 1),
    ("fishbone", "fishbone", "FISH", ["QM-03", "QM-02"], "quality", 1),
    ("capa", "capa", "CAPA", ["QM-03", "AUD-03"], "quality", 2),
    ("pareto", "pareto", "PARETO", ["QM-02", "OE-02"], "quality", 1),
    ("pdca", "pdca", "PDCA", ["QM-03", "OE-02"], "quality", 1),
    ("a3", "a3", "A3", ["QM-03", "LDR-01"], "quality", 2),
    ("dmaic", "dmaic", "DMAIC", ["QM-02", "QM-03", "OE-02"], "quality", 3),
    ("fmea", "fmea", "FMEA", ["RSK-01", "RSK-02", "QM-02"], "risk", 2),
    ("swot", "swot", "SWOT", ["LDR-02", "RSK-01"], "performance", 1),
    ("pestle", "pestle", "PESTLE", ["LDR-02", "RSK-01"], "performance", 1),
    ("stakeholders", "stakeholders", "STAKE", ["PM-02", "LDR-02"], "quality", 1),
    ("lessons", "lessons-learned", "LESSONS", ["OE-02", "QM-03"], "quality", 1),
    ("iso10009", "iso-10009", "10009", ["QM-02", "QM-01"], "quality", 2),
]
COMP_DOMAIN = {c["id"]: c["domain"] for c in json.loads((SEED / "competency" / "competencies.json").read_text(encoding="utf-8"))["items"]}


def edges_for(LK):
    out = {}
    for e in LK.get("edges", []):
        a, b, ar, en = (e + ["", ""])[:4]
        out.setdefault(a, {"out": [], "in": []})["out"].append({"ref": b, "why": {"ar": ar, "en": en}})
        out.setdefault(b, {"out": [], "in": []})["in"].append({"ref": a, "why": {"ar": ar, "en": en}})
    return out


def faq_list(KB):
    faq = KB.get("faq", []) if isinstance(KB, dict) else (KB if isinstance(KB, list) else [])
    return [{"id": f.get("id"), "q": bi(f.get("q")), "a": bi(f.get("a"))} for f in faq if f.get("q") and f.get("a")]


index, guide_files = [], {}
for module, slug, code, std_id, comps, eco in STANDARDS:
    d = ext(module)
    D, TK, LK = d["DATA"], d.get("TK", {}), d.get("LK", {})
    links = edges_for(LK)
    checks, pages = TK.get("check", {}), TK.get("pages", {})
    ui = D["ui"]
    clauses = []
    for c in D["clauses"]:
        items = []
        for s in c["subs"]:
            n = s["n"]
            items.append({
                "ref": n, "status": s.get("s") or "", "page": pages.get(n),
                "title": {"en": s["en"]["t"], "ar": s["ar"]["t"]},
                "req": {"en": s["en"]["req"], "ar": s["ar"]["req"]}, "ex": {"en": s["en"]["ex"], "ar": s["ar"]["ex"]},
                "how": [{"en": a, "ar": b} for a, b in zip(s["en"]["how"], s["ar"]["how"])],
                "ev": [{"en": a, "ar": b} for a, b in zip(s["en"]["ev"], s["ar"]["ev"])],
                "tip": {"en": s["en"].get("tip", ""), "ar": s["ar"].get("tip", "")} if s["en"].get("tip") else None,
                "checks": [{"ar": q[0], "en": q[1]} for q in checks.get(n, [])],
                "links": links.get(n, {"out": [], "in": []}),
            })
        clauses.append({"id": c["id"], "phase": c.get("phase"), "title": {"en": c["en"]["title"], "ar": c["ar"]["title"]},
                        "intro": {"en": c["en"].get("intro", ""), "ar": c["ar"].get("intro", "")}, "items": items})
    tpl = [{"id": t.get("id"), "ref": t.get("clause"), "title": {"en": t["en"]["t"], "ar": t["ar"]["t"]}, "purpose": {"en": t["en"].get("p", ""), "ar": t["ar"].get("p", "")},
            "tips": [{"en": a, "ar": b} for a, b in zip(t["en"].get("tips", []), t["ar"].get("tips", []))]} for t in TK.get("tpl", []) if t.get("en")]
    access = TK.get("access", {})
    guide = {
        "id": f"GUIDE-{code}", "slug": slug, "kind": "standard", "module": modules[module]["id"], "standard_id": std_id,
        "title": {"en": ui["en"]["brand"], "ar": ui["ar"]["brand"]}, "subtitle": {"en": ui["en"].get("subtitle", ""), "ar": ui["ar"].get("subtitle", "")},
        "lede": {"en": ui["en"].get("lede", ""), "ar": ui["ar"].get("lede", "")}, "author": "مدثر سلامه",
        "clauses": clauses,
        "changes": [{"title": {"en": ch["en"]["t"], "ar": ch["ar"]["t"]}, "text": {"en": ch["en"].get("d", ""), "ar": ch["ar"].get("d", "")}, "refs": ch.get("refs", [])} for ch in D.get("changes", []) if ch.get("en")],
        "terms": [{"no": t[0], "en": t[1], "ar": t[2], "def": {"ar": t[3], "en": t[4]}} for t in D.get("terms", []) if len(t) >= 5],
        "pairs": [{"title": bi(p), "items": [{"term": {"ar": i[0], "en": i[1]}, "meaning": {"ar": i[2], "en": i[3]}} for i in p.get("items", [])]} for p in D.get("pairs", [])],
        "timeline": [{"date": {"ar": t[0], "en": t[1]}, "text": {"ar": t[2], "en": t[3]}} for t in D.get("timeline", []) if len(t) >= 4],
        "threads": [{"id": th["id"], "chain": th["chain"], "title": bi(th["t"]), "text": bi(th["d"])} for th in LK.get("threads", [])],
        "scale": [{"level": i, "meaning": {"en": e.get("m", ""), "ar": a.get("m", "")}, "look": {"en": e.get("look", ""), "ar": a.get("look", "")},
                   "evidence": {"en": e.get("ev", ""), "ar": a.get("ev", "")}} for i, (a, e) in enumerate(zip(LK.get("scale", {}).get("ar", []), LK.get("scale", {}).get("en", [])))],
        "faq": faq_list(d.get("KB", {})),
        "templates": tpl,
        "official": [{"url": s[0], "name": bi(s[1]), "note": bi(s[2])} for s in access.get("src", []) if isinstance(s, list) and len(s) >= 3],
        "readiness_questions": len(TK.get("assess", {}).get("q", [])),
        "competencies": comps, "ecosystem": eco,
    }
    guide_files[slug] = guide
    index.append({"id": guide["id"], "slug": slug, "kind": "standard", "code": code, "module": guide["module"], "standard_id": std_id,
                  "title": guide["title"], "subtitle": guide["subtitle"], "lede": guide["lede"], "ecosystem": eco, "competencies": comps,
                  "counts": {"sections": len(clauses), "items": sum(len(c["items"]) for c in clauses), "checks": sum(len(i["checks"]) for c in clauses for i in c["items"]),
                             "terms": len(guide["terms"]), "faq": len(guide["faq"])},
                  "version": toolkit_version(module),
                  "governance": owner_gov("1.0.0", f"Mirrored word for word from modules/{module}.html (live commit {LIVE_COMMIT}) by tools/build_toolkit_courses.py.")})

# ===================================================================================== method guides
for module, slug, code, comps, eco, level in METHODS:
    d = ext(module)
    key = next(k for k in d if k.startswith("EXPLAIN"))
    E = d[key]
    meta, std = E["meta"], E.get("std", {})
    sections = []
    for si, s in enumerate(E["sections"]):
        items = []
        for ii, it in enumerate(s.get("it", [])):
            items.append({"ref": f"s{si + 1}-{ii + 1}", "clause": it.get("c", ""), "title": bi(it.get("t")), "req": bi(it.get("r")),
                          "ex": bi(it.get("x")) if it.get("x") and bi(it.get("x"))["en"] else None,
                          "how": bilist(it.get("h")), "ev": bilist(it.get("e")), **gaps_and_tips(it.get("g")),
                          "owner": bi(it.get("owner")) if it.get("owner") else None, "kpi": bi(it.get("kpi")) if it.get("kpi") else None})
        sections.append({"id": s.get("id"), "phase": s.get("ph"), "title": bi(s.get("t")), "short": bi(s.get("sh") or s.get("t")), "intro": bi(s.get("p")), "items": items})
    guide = {
        "id": f"GUIDE-{code}", "slug": slug, "kind": "method", "module": modules[module]["id"],
        "title": bi(meta["name"]), "subtitle": bi(meta.get("edition")), "lede": bi(std.get("purpose")), "author": "مدثر سلامه",
        "note": bi(meta.get("certNote")) if meta.get("certNote") else None,
        "who": bi(std.get("who")) if std.get("who") else None,
        "roles": [{"name": bi(r.get("n")), "text": bi(r.get("d"))} for r in std.get("roles", [])],
        "steps": [{"no": m.get("no"), "title": bi(m.get("t")), "text": bi(m.get("d")), "ref": m.get("go")} for m in std.get("map", [])],
        "related": [{"code": r.get("code"), "name": bi(r.get("n")), "text": bi(r.get("d"))} for r in std.get("rel", [])],
        "serves": [{"code": r.get("code"), "name": bi(r.get("n")), "text": bi(r.get("d"))} for r in std.get("comp", [])],
        "clauses": sections,
        "faq": faq_list(d.get("KB", [])),
        "competencies": comps, "ecosystem": eco,
    }
    guide_files[slug] = guide
    index.append({"id": guide["id"], "slug": slug, "kind": "method", "code": code, "module": guide["module"], "standard_id": None,
                  "title": guide["title"], "subtitle": guide["subtitle"], "lede": guide["lede"], "ecosystem": eco, "competencies": comps, "level": level,
                  "counts": {"sections": len(sections), "items": sum(len(s["items"]) for s in sections), "checks": 0, "terms": 0, "faq": len(guide["faq"])},
                  "version": toolkit_version(module),
                  "governance": owner_gov("1.0.0", f"Mirrored word for word from modules/{module}.html (live commit {LIVE_COMMIT}) by tools/build_toolkit_courses.py.")})

for slug, g in guide_files.items():
    (GUIDES / f"{slug}.json").parent.mkdir(parents=True, exist_ok=True)
    (GUIDES / f"{slug}.json").write_text(json.dumps({"schema": "cia.guide.v1", "guide": g}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
save("index", {"schema": "cia.guide-index.v1", "source": f"hub toolkits, live commit {LIVE_COMMIT}", "items": index}, base=GUIDES)
item_of = {(slug, i["ref"]): (g, c, i) for slug, g in guide_files.items() for c in g["clauses"] for i in c["items"]}

# ===================================================================================== existing lessons → guide items
MAP = {
    "CRS-ISO-101-L03": [("iso-9001", "4.4.1")], "CRS-ISO-101-L04": [("iso-9001", "4.1"), ("iso-9001", "4.2"), ("iso-9001", "4.3")],
    "CRS-ISO-101-L05": [("iso-9001", "5.1.1"), ("iso-9001", "6.1.1"), ("iso-9001", "7.1.1")], "CRS-ISO-101-L06": [("iso-9001", "8.1"), ("iso-9001", "9.1.1"), ("iso-9001", "10.2.1")],
    "CRS-ISO-READ-L04": [("iso-9001", "4.4.2"), ("iso-9001", "7.5.1")],
    "CRS-ISO-AUD-L01": [("iso-9001", "9.2.1"), ("iso-9001", "9.2.2")], "CRS-ISO-AUD-L02": [("iso-9001", "9.2.2")], "CRS-ISO-AUD-L05": [("capa", "s7-1")], "CRS-ISO-AUD-L06": [("capa", "s7-2")],
    "CRS-ISO-NC-L01": [("iso-9001", "10.2.1"), ("capa", "s2-1")], "CRS-ISO-NC-L02": [("iso-9001", "8.7.1"), ("iso-9001", "8.7.2"), ("capa", "s1-1")],
    "CRS-ISO-NC-L03": [("rca", "s2-1"), ("rca", "s2-3"), ("five-whys", "s1-4"), ("fishbone", "s1-4")], "CRS-ISO-NC-L04": [("iso-9001", "10.2.2"), ("capa", "s2-4"), ("capa", "s2-6")],
    "CRS-ISO-RISK-L01": [("iso-9001", "6.1.1"), ("iso-31000", "4a")], "CRS-ISO-RISK-L02": [("iso-9001", "6.1.2"), ("iso-31000", "6.4.2"), ("iso-31000", "6.4.3")],
    "CRS-ISO-RISK-L03": [("iso-9001", "6.1.2"), ("iso-9001", "6.1.3")], "CRS-ISO-RISK-L04": [("iso-9001", "9.1.3")],
    "CRS-ISO-IMS-L03": [("iso-9001", "9.2.2"), ("iso-9001", "9.3.2")],
    "CRS-ISO-9001-F-L01": [("iso-9001", "5.1.1")], "CRS-ISO-9001-F-L02": [("iso-9001", "8.2.2"), ("iso-9001", "8.2.3"), ("iso-9001", "8.2.4")],
    "CRS-ISO-9001-F-L03": [("iso-9001", "8.4.1"), ("iso-9001", "8.5.1"), ("iso-9001", "8.6")], "CRS-ISO-9001-F-L04": [("iso-9001", "9.1.2"), ("iso-9001", "10.1")],
    "CRS-ISO-9001-IMP-L01": [("iso-9001", "4.1"), ("iso-9001", "6.3")], "CRS-ISO-9001-IMP-L02": [("iso-9001", "4.3"), ("iso-9001", "4.4.1")],
    "CRS-ISO-9001-IMP-L03": [("iso-9001", "7.5.1"), ("iso-9001", "7.5.3")], "CRS-ISO-9001-IMP-L04": [("iso-9001", "6.2.1"), ("iso-9001", "6.2.2")],
    "CRS-ISO-9001-IMP-L05": [("iso-9001", "7.2"), ("iso-9001", "7.3")], "CRS-ISO-9001-IMP-L06": [("iso-9001", "9.2.2"), ("iso-9001", "9.3.2")],
    "CRS-ISO-9001-AUD-L01": [("iso-9001", "9.2.2")], "CRS-ISO-9001-AUD-L02": [("iso-9001", "8.2.3"), ("iso-9001", "8.5.1")],
    "CRS-ISO-9001-AUD-L03": [("iso-9001", "5.1.1"), ("iso-9001", "6.1.2")], "CRS-ISO-9001-AUD-L04": [("iso-9001", "9.1.3"), ("iso-9001", "10.2.1")],
    "CRS-ISO-14001-F-L02": [("iso-14001", "6.1.2")], "CRS-ISO-14001-F-L03": [("iso-14001", "6.1.3"), ("iso-14001", "9.1.2")],
    "CRS-ISO-14001-F-L04": [("iso-14001", "8.1"), ("iso-14001", "8.2"), ("iso-14001", "9.1.1")],
    "CRS-ISO-14001-AUD-L01": [("iso-14001", "9.2.2")], "CRS-ISO-14001-AUD-L02": [("iso-14001", "6.1.2"), ("iso-14001", "8.1")],
    "CRS-ISO-14001-AUD-L03": [("iso-14001", "9.1.2"), ("iso-14001", "8.2")], "CRS-ISO-14001-AUD-L04": [("iso-14001", "9.1.1"), ("iso-14001", "10.2")],
    "CRS-ISO-45001-F-L01": [("iso-45001", "5.4")], "CRS-ISO-45001-F-L02": [("iso-45001", "6.1.2.1"), ("iso-45001", "6.1.2.2")],
    "CRS-ISO-45001-F-L03": [("iso-45001", "8.1.2"), ("iso-45001", "8.1.3"), ("iso-45001", "8.1.4.2")], "CRS-ISO-45001-F-L04": [("iso-45001", "8.2"), ("iso-45001", "10.2")],
    "CRS-ISO-45001-AUD-L01": [("iso-45001", "9.2.2")], "CRS-ISO-45001-AUD-L02": [("iso-45001", "8.1.2")],
    "CRS-ISO-45001-AUD-L03": [("iso-45001", "5.4"), ("iso-45001", "7.2"), ("iso-45001", "8.1.4.2")], "CRS-ISO-45001-AUD-L04": [("iso-45001", "10.2"), ("iso-45001", "9.1.1")],
    "CRS-ISO-27001-F-L02": [("iso-27001", "4.3"), ("iso-27001", "6.1.2")], "CRS-ISO-27001-F-L03": [("iso-27001", "6.1.3")],
    "CRS-ISO-27001-F-L04": [("iso-27001", "8.1"), ("iso-27001", "10.2")],
    "CRS-ISO-27001-AUD-L01": [("iso-27001", "9.2.2")], "CRS-ISO-27001-AUD-L02": [("iso-27001", "6.1.2"), ("iso-27001", "6.1.3")],
    "CRS-ISO-27001-AUD-L03": [("iso-27001", "7.2"), ("iso-27001", "8.1")], "CRS-ISO-27001-AUD-L04": [("iso-27001", "9.1"), ("iso-27001", "10.2")],
}
missing = [(lid, r) for lid, refs in MAP.items() for r in refs if r not in item_of]
assert not missing, f"lesson map points at unknown guide items: {missing}"
(SEED / "lesson-guide-map.json").write_text(json.dumps({"schema": "cia.lesson-guide-map.v1", "items": [
    {"id": lid, "refs": [{"guide": g, "ref": r} for g, r in refs]} for lid, refs in MAP.items()]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# ===================================================================================== generated courses
courses_doc, q_doc, a_doc = load("courses"), load("questions"), load("assessments")
courses = [c for c in courses_doc["items"] if not c["id"].startswith(("CRS-G-", "CRS-M-"))]
questions = [q for q in q_doc["items"] if not q["id"].startswith(("Q-G-", "Q-M-"))]
assessments = [a for a in a_doc["items"] if not a["id"].startswith(("ASM-G-", "ASM-M-"))]

AUD_STD = T("Practitioners, implementers, internal auditors and managers who work with this standard",
            "الممارسون والمطبّقون والمدققون الداخليون والمديرون الذين يعملون بهذه المواصفة")
GEN_PT = {
    "standard": (T("Open the toolkit and complete its readiness self-assessment for your organisation (or for a realistic case you know well). Submit the five largest gaps, "
                   "the evidence you checked for each, and one proportionate action per gap with an owner and date.",
                   "افتح الأداة وأكمل التقييم الذاتي للجاهزية لمنظمتك (أو لحالة واقعية تعرفها جيدًا). سلّم أكبر خمس فجوات، والدليل الذي فحصته لكل منها، "
                   "وإجراءً متناسبًا لكل فجوة مع المسؤول والموعد."),
                 T("Gap table (5 rows) with evidence and actions, plus a 150-word summary.", "جدول فجوات (5 صفوف) بالأدلة والإجراءات، مع ملخص في 150 كلمة.")),
    "method": (T("Use the toolkit to complete one full record for a real problem or decision in your organisation (or a realistic case you know well). Submit the record and "
                 "a 150-word explanation of the key choices you made and the evidence behind them.",
                 "استخدم الأداة لإكمال سجل كامل لمشكلة أو قرار حقيقي في منظمتك (أو لحالة واقعية تعرفها جيدًا). سلّم السجل مع شرح في 150 كلمة "
                 "لأهم القرارات التي اتخذتها والأدلة التي استندت إليها."),
               T("The completed toolkit record (PDF or export) plus a 150-word explanation.", "السجل المكتمل من الأداة (PDF أو تصدير) مع شرح في 150 كلمة.")),
}
RUBRIC = [
    (T("Follows the guide", "الالتزام بالدليل"), 25, T("Every step the guide sets out is done in order.", "كل الخطوات التي يحددها الدليل منفذة بالترتيب."),
     T("One or two steps are thin or skipped.", "خطوة أو خطوتان ناقصتان أو متجاوزتان."), T("Steps are missing or out of order.", "خطوات مفقودة أو غير مرتبة.")),
    (T("Evidence", "الأدلة"), 25, T("Each conclusion rests on named, checkable evidence.", "كل استنتاج يستند إلى دليل مسمى قابل للتحقق."),
     T("Some evidence is general or unstated.", "بعض الأدلة عامة أو غير مذكورة."), T("Conclusions without evidence.", "استنتاجات دون أدلة.")),
    (T("Quality of conclusions and actions", "جودة الاستنتاجات والإجراءات"), 30, T("Actions address causes or gaps, are proportionate and have owners and dates.", "الإجراءات تعالج الأسباب أو الفجوات، ومتناسبة، ولها مسؤول وموعد."),
     T("Actions are partly generic or lack owners/dates.", "الإجراءات عامة جزئيًا أو بلا مسؤول/موعد."), T("Actions do not follow from the analysis.", "الإجراءات لا تنبع من التحليل.")),
    (T("Clarity", "الوضوح"), 20, T("A reader understands the decisions in one pass.", "يفهم القارئ القرارات من القراءة الأولى."),
     T("Some parts need explanation.", "بعض الأجزاء تحتاج إلى شرح."), T("Hard to follow.", "يصعب تتبعه.")),
]
rubric = [{"criterion": c, "weight": w, "levels": {"meets": m, "partial": p, "not_yet": n}} for c, w, m, p, n in RUBRIC]


def opts_shuffle(qid, correct, wrongs):
    """Four options a–d; the correct one placed deterministically from the question id."""
    pos = h(qid) % 4
    items = wrongs[:3]
    items.insert(pos, correct)
    ids = "abcd"
    return [dict(o, id=ids[i]) for i, o in enumerate(items)], ids[pos]


def norm(s):
    return re.sub(r"\W+", " ", s.lower()).strip()


STOP = set("with from that this their there what which when where have been into each other for and the are its about must should shall".split())


def words(*texts):
    return {w for t in texts for w in norm(t).split() if len(w) >= 4 and w not in STOP}


NEGATIVE_OPENER = re.compile(r"^(no|not|never|without|only|skip|avoid|don't|do not)\b", re.I)


def guide_question(g, cl, it, qid, course_id, module_id, comp, pool):
    """'Which of these is expected evidence for …' — distractors are evidence for requirements in other clauses that share
    no content word with the target requirement's title or evidence, so a distractor cannot also be a fair answer."""
    correct_ev = it["ev"][h(qid) % len(it["ev"])]
    own = {norm(e["en"]) for e in it["ev"]}
    near = words(it["title"]["en"], *[e["en"] for e in it["ev"]])
    # Pre-review rules (tools/pre_review.py B6): no one-word distractor, no evidence that the guide lists under 3+ clauses
    # (generic records such as "Effectiveness evaluation" could fairly answer many requirements), no shared content word.
    cands = [(c2, i2, e) for (c2, i2, e) in pool if c2["id"] != cl["id"] and norm(e["en"]) not in own and len(e["en"]) > 6
             and len(e["en"].split()) > 1 and len(EV_CLAUSES[(g["slug"], norm(e["en"]))]) < 3]
    far = [x for x in cands if not (words(x[2]["en"]) & near)]
    cands = far if len({norm(x[2]["en"]) for x in far}) >= 3 else cands
    cands.sort(key=lambda x: h(qid + x[2]["en"]))
    wrongs, seen = [], set()
    for c2, i2, e in cands:
        if norm(e["en"]) in seen:
            continue
        seen.add(norm(e["en"]))
        wrongs.append({"text": e, "why": T(f"Listed as evidence for {i2['ref']} ({i2['title']['en']}), not for {it['ref']}.",
                                           f"مذكور دليلًا للبند {i2['ref']} ({i2['title']['ar']})، وليس للبند {it['ref']}.")})
        if len(wrongs) == 3:
            break
    options, key = opts_shuffle(qid, {"text": correct_ev, "why": T(f"The guide lists this as evidence for {it['ref']}.", f"يذكره الدليل ضمن أدلة البند {it['ref']}.")}, wrongs)
    return {"id": qid, "category": "iso" if g["kind"] == "standard" else "quality", "course_id": course_id, "module_id": module_id, "competency": comp,
            "difficulty": "medium", "type": "single_choice", "format": "knowledge",
            "prompt": T(f"Which of these is evidence an auditor expects for {it['ref']} {it['title']['en']}?",
                        f"أيٌّ مما يلي دليل يتوقعه المدقق للبند {it['ref']} {it['title']['ar']}؟"),
            "options": options, "correct_answer": key,
            "explanation": T(f"In the guide, {it['ref']} lists: " + "; ".join(e["en"] for e in it["ev"]) + ".",
                             f"في الدليل، أدلة البند {it['ref']} هي: " + "؛ ".join(e["ar"] for e in it["ev"]) + "."),
            "reference": f"guide:{g['slug']}#{it['ref']}", "weight": 1, "version": "1.0.0", "status": "active", "governance": dict(system_gov)}


def method_question(g, sec, it, qid, course_id, module_id, comp, pool):
    """'Which of these is a common gap …' — distractors are good practice steps from other parts of the guide.
    An item with tips but no gaps (some ISO 10009 tool cards) asks the reverse: which is the guide's advice — distractors are
    mistakes the guide lists for other tools."""
    if not it["gaps"]:
        return advice_question(g, it, qid, course_id, module_id, comp)
    correct = it["gaps"][h(qid) % len(it["gaps"])]
    # Pre-review rule (B6): a distractor must read as a practice — never text the guide lists as a gap, never a negative opener.
    all_gaps = {norm(x["en"]) for c2 in g["clauses"] for i2 in c2["items"] for x in i2["gaps"]}
    cands = [(s2, i2, x) for (s2, i2, x) in pool if i2["ref"] != it["ref"] and len(x["en"]) > 6
             and norm(x["en"]) not in all_gaps and not NEGATIVE_OPENER.match(x["en"])]
    cands.sort(key=lambda x: h(qid + x[2]["en"]))
    wrongs, seen = [], set()
    for s2, i2, x in cands:
        if norm(x["en"]) in seen:
            continue
        seen.add(norm(x["en"]))
        wrongs.append({"text": x, "why": T(f"This is recommended practice for “{i2['title']['en']}”, not a gap.", f"هذه ممارسة موصى بها في «{i2['title']['ar']}»، وليست فجوة.")})
        if len(wrongs) == 3:
            break
    options, key = opts_shuffle(qid, {"text": correct, "why": T("The guide lists this as a common gap.", "يذكره الدليل ضمن الفجوات الشائعة.")}, wrongs)
    return {"id": qid, "category": "quality", "course_id": course_id, "module_id": module_id, "competency": comp,
            "difficulty": "medium", "type": "single_choice", "format": "knowledge",
            "prompt": T(f"{g['title']['en']}: which of these is a common gap in “{it['title']['en']}”?", f"{g['title']['ar']}: أيٌّ مما يلي فجوة شائعة في «{it['title']['ar']}»؟"),
            "options": options, "correct_answer": key,
            "explanation": T("The guide's common gaps here: " + "; ".join(x["en"] for x in it["gaps"]) + ".", "الفجوات الشائعة هنا في الدليل: " + "؛ ".join(x["ar"] for x in it["gaps"]) + "."),
            "reference": f"guide:{g['slug']}#{it['ref']}", "weight": 1, "version": "1.0.0", "status": "active", "governance": dict(system_gov)}


def advice_question(g, it, qid, course_id, module_id, comp):
    correct = it["tips"][h(qid) % len(it["tips"])]
    own = words(it["title"]["en"], *[x["en"] for x in it["tips"] + it["how"]])
    cands = [(i2, x) for c2 in g["clauses"] for i2 in c2["items"] if i2["ref"] != it["ref"] for x in i2["gaps"]
             if len(x["en"].split()) > 2 and not (words(x["en"]) & own)]
    cands.sort(key=lambda x: h(qid + x[1]["en"]))
    wrongs, seen = [], set()
    for i2, x in cands:
        if norm(x["en"]) in seen:
            continue
        seen.add(norm(x["en"]))
        wrongs.append({"text": x, "why": T(f"The guide lists this as a common mistake with “{i2['title']['en']}”.", f"يذكره الدليل خطأً شائعًا في «{i2['title']['ar']}».")})
        if len(wrongs) == 3:
            break
    options, key = opts_shuffle(qid, {"text": correct, "why": T("The guide gives this as advice for this tool.", "يذكره الدليل نصيحةً لهذه الأداة.")}, wrongs)
    return {"id": qid, "category": "quality", "course_id": course_id, "module_id": module_id, "competency": comp,
            "difficulty": "medium", "type": "single_choice", "format": "knowledge",
            "prompt": T(f"{g['title']['en']}: which of these is the guide's advice for “{it['title']['en']}”?", f"{g['title']['ar']}: أيٌّ مما يلي من نصائح الدليل لـ«{it['title']['ar']}»؟"),
            "options": options, "correct_answer": key,
            "explanation": T("The guide's advice here: " + "; ".join(x["en"] for x in it["tips"]) + ".", "نصائح الدليل هنا: " + "؛ ".join(x["ar"] for x in it["tips"]) + "."),
            "reference": f"guide:{g['slug']}#{it['ref']}", "weight": 1, "version": "1.0.0", "status": "active", "governance": dict(system_gov)}


def schedule(lessons):
    days, cur, used = [], [], 0
    for l in lessons:
        if used + l["estimated_minutes"] > 390 and cur:
            days.append(cur); cur, used = [], 0
        cur.append({"kind": "lesson", "ref": l["id"], "title": l["title"], "minutes": l["estimated_minutes"]}); used += l["estimated_minutes"]
    tail = [{"kind": "practical", "ref": "practical", "title": T("Practical task in the toolkit", "المهمة العملية في الأداة"), "minutes": 90},
            {"kind": "assessment", "ref": "final", "title": T("Final assessment", "التقييم الختامي"), "minutes": 30}]
    if used + 120 > 390 and cur:
        days.append(cur); cur = []
    cur += tail; days.append(cur)
    return [{"day": i + 1, "focus": [], "focus_titles": [], "sessions": s, "minutes": sum(x["minutes"] for x in s)} for i, s in enumerate(days)]


def spread(ids, n, offset=0):
    if len(ids) <= n:
        return list(ids)
    step = len(ids) / n
    return [ids[int(offset + i * step) % len(ids)] for i in range(n)]


# How many clauses of a standard list the same evidence (generic evidence makes a weak distractor).
EV_CLAUSES = {}
for _slug, _g in guide_files.items():
    if _g["kind"] == "standard":
        for _c in _g["clauses"]:
            for _i in _c["items"]:
                for _e in _i["ev"]:
                    EV_CLAUSES.setdefault((_slug, norm(_e["en"])), set()).add(_i["ref"])
EV_CLAUSES = __import__("collections").defaultdict(set, EV_CLAUSES)

# Edition facts behind each standard (opened and checked 25 Oct / 3 Nov 2026; registered by build_phase7.py).
EDITION_SRC = {"9001": ["SRC-ISO-9001-NEWS", "SRC-NSF-9001-2026"], "14001": ["SRC-ISO-14001", "SRC-DNV-14001-2026"], "45001": ["SRC-ISO-45001", "SRC-SQS-45001-REV"],
               "27001": ["SRC-ISO-27001", "SRC-ISO-27001-AMD1"], "22301": ["SRC-GENORMA-22301-CD"], "31000": ["SRC-ISO-31000", "SRC-ISO-TC262-31000"],
               "37001": ["SRC-ANSI-37001-2025"], "37301": ["SRC-ISO-37301-AMD1"]}
gen_courses, gen_q, gen_a, gen_rec, gen_src = [], [], [], [], []
src_doc = load("sources")
for entry in index:
    g = guide_files[entry["slug"]]
    is_std = g["kind"] == "standard"
    code = entry["code"]
    cid = f"CRS-G-{code}" if is_std else f"CRS-M-{code}"
    qpre = f"Q-G-{code}" if is_std else f"Q-M-{code}"
    apre = f"ASM-G-{code}" if is_std else f"ASM-M-{code}"
    tool = next(m for m in modules.values() if m["id"] == g["module"])
    sid = f"SRC-TK-{code}"
    gen_src.append({"id": sid, "source_id": sid, "organization": "Continual Improvement Academy — owner toolkit", "title": g["title"]["en"],
                    "official_url": "https://moddathersalamaeng-sudo.github.io/-/" + tool["href"].replace("../", ""), "source_type": "owner",
                    "accessed_date": "2026-11-02", "verified_date": LIVE_DATE, "verification_status": "owner_publication",
                    "verification_note": f"The owner's own published toolkit (live commit {LIVE_COMMIT}); explains requirements in independent wording and does not reproduce standard text.",
                    "content_area": g["title"]["en"], "owner": "مدثر سلامه", "review_date": None,
                    "governance": owner_gov("1.0.0", "Owner toolkit used as the source of generated courses.")})
    pool = [(c, i, e) for c in g["clauses"] for i in c["items"] for e in (i["ev"] if is_std else i["how"])]
    mods, lessons_flat, comp_cycle = [], [], g["competencies"]
    n = 0
    for mi, c in enumerate(g["clauses"]):
        mid = f"{cid}-M{mi + 1:02d}"
        lessons = []
        for it in c["items"]:
            ok = (it["req"]["en"] and it.get("how") and (it["ev"] if is_std else (it["gaps"] or it.get("tips"))))
            if not ok:
                continue
            n += 1
            lid = f"{cid}-L{n:02d}"
            qid = f"{qpre}-L{n:02d}"
            comp = comp_cycle[(n - 1) % len(comp_cycle)]
            q = guide_question(g, c, it, qid, cid, mid, comp, pool) if is_std else method_question(g, c, it, qid, cid, mid, comp, pool)
            if len(q["options"]) < 4:
                continue
            gen_q.append(q)
            minutes = 15 if is_std else 12
            lesson = {"id": lid, "order": len(lessons) + 1, "title": T(f"{it['ref']} {it['title']['en']}" if is_std else it["title"]["en"],
                                                                         f"{it['ref']} {it['title']['ar']}" if is_std else it["title"]["ar"]),
                      "estimated_minutes": minutes, "source": {"guide": g["slug"], "ref": it["ref"]}, "check_question_id": qid,
                      "resources": [], "competencies": [comp]}
            lessons.append(lesson); lessons_flat.append(lesson)
        if lessons:
            mods.append({"id": mid, "order": len(mods) + 1, "title": c["title"], "summary": c["intro"], "lessons": lessons})
    total = sum(l["estimated_minutes"] for l in lessons_flat)
    pt_id = f"{qpre}-PT"
    brief, deliverable = GEN_PT["standard" if is_std else "method"]
    gen_q.append({"id": pt_id, "category": "iso" if is_std else "quality", "course_id": cid, "module_id": None, "competency": g["competencies"][0],
                  "difficulty": "hard", "type": "practical_assignment", "format": "practical", "prompt": brief, "deliverable": deliverable,
                  "rubric": rubric, "explanation": T("Scored by a named human reviewer against the rubric.", "يقيّمها مراجع بشري مسمى وفق سلم التقدير."),
                  "reference": f"guide:{g['slug']}", "weight": 4, "version": "1.0.0", "status": "active", "governance": dict(system_gov)})
    lesson_qs = [l["check_question_id"] for l in lessons_flat]
    quiz_ids, final_ids = spread(lesson_qs, 15, 0), spread(lesson_qs, 25, 0.5)  # the quiz is formative; the final samples the whole course
    slug_base = g["slug"] + ("-requirements" if is_std else "-method")
    for kind, ids, passing, minutes, suffix, title in [
        ("knowledge_quiz", quiz_ids, 70, max(10, len(quiz_ids)), "QUIZ", T("knowledge check", "اختبار معرفي")),
        ("final", final_ids, 70, max(15, round(len(final_ids) * 1.2)), "FINAL", T("final assessment", "التقييم الختامي")),
        ("practical", [pt_id], 60, 90, "PRACT", T("practical task", "المهمة العملية"))]:
        gen_a.append({"id": f"{apre}-{suffix}", "slug": f"{slug_base}-{suffix.lower()}", "title": T(f"{g['title']['en']} — {title['en']}", f"{g['title']['ar']} — {title['ar']}"),
                      "kind": kind, "course_id": cid, "question_ids": ids,
                      "scoring": {"passing_score": passing, "method": "weighted_points", "manual_review_required_for_subjective": True},
                      "integrity": {"randomize_questions": True, "randomize_options": False, "attempt_limit": None if kind == "knowledge_quiz" else 3, "time_limit_minutes": None, "show_answers": "after_submission"},
                      "feedback": {"show_domain_breakdown": True, "show_explanations": True}, "governance": dict(system_gov),
                      "competencies": sorted({q["competency"] for q in gen_q if q["id"] in ids}), "allow_unknown": kind != "practical", "estimated_minutes": minutes,
                      "description": T("Questions assembled from the owner's guide. Choose “I don't know” rather than guessing.", "أسئلة مبنية من دليل المالك. اختر «لا أعرف» بدل التخمين.") if kind != "practical"
                      else T("A practical task in the toolkit, reviewed by a person.", "مهمة عملية في الأداة يراجعها شخص.")})
    if is_std:
        std_label = re.sub(r"\s+(Interactive Guide.*|— .*)$", "", g["title"]["en"]).replace(" & Toolkit", "")
        std_label_ar = re.sub(r"^(دليل\s+)", "", g["title"]["ar"]).split(" التفاعلي")[0].split(" —")[0]
        ctitle = T(f"{std_label}: the requirements explained, clause by clause", f"{std_label}: المتطلبات مشروحة بندًا بندًا")
        outcomes = [T(f"Explain each requirement of {std_label} in plain words.", f"شرح كل متطلب في {std_label} بلغة واضحة."),
                    T("Name the evidence an auditor expects for each requirement and find it in your own records.", "تحديد الدليل الذي يتوقعه المدقق لكل متطلب والعثور عليه في سجلاتك."),
                    T("Apply each requirement through practical implementation steps.", "تطبيق كل متطلب عبر خطوات تنفيذ عملية."),
                    T("Answer typical auditor questions with your organisation's facts.", "الإجابة عن أسئلة المدقق النموذجية بحقائق منظمتك.")]
        if g.get("changes"):
            outcomes.append(T("Describe what changed in the current edition and where.", "وصف ما تغيّر في الإصدار الحالي وأين."))
        why = T("This course follows the platform's interactive guide item by item: each lesson is one requirement, with a worked example, "
                "the steps to apply it, the evidence to show and the questions an auditor may ask.",
                "تتبع هذه الدورة دليل المنصة التفاعلي بندًا بندًا: كل درس متطلب واحد، مع مثال تطبيقي، وخطوات تطبيقه، والأدلة التي تُعرض، والأسئلة التي قد يطرحها المدقق.")
    else:
        ctitle = T(f"{g['title']['en']}: the method step by step", f"{g['title']['ar']}: المنهجية خطوة بخطوة")
        outcomes = [T(f"Explain the purpose of {g['title']['en']} and when to use it.", f"شرح غرض {g['title']['ar']} ومتى يُستخدم."),
                    T("Apply each step of the method with the evidence it needs.", "تطبيق كل خطوة في المنهجية بالأدلة التي تحتاجها."),
                    T("Recognise and avoid the common gaps listed in the guide.", "التعرف على الفجوات الشائعة الواردة في الدليل وتجنبها."),
                    T("Complete a full record in the toolkit and explain your decisions.", "إكمال سجل كامل في الأداة وشرح القرارات.")]
        why = g["lede"] if g["lede"]["en"] else T("A working method that turns a problem into proven causes and effective action.", "منهجية عملية تحول المشكلة إلى أسباب مثبتة وإجراء فعّال.")
    sched = schedule(lessons_flat)
    hours = round(sum(d["minutes"] for d in sched) / 60 * 2) / 2  # lessons + practical task + final assessment
    course = {
        "id": cid, "code": cid, "slug": slug_base, "title": ctitle, "category": "iso" if is_std else "quality", "ecosystem": g["ecosystem"],
        "professional_body_reference": "ISO" if is_std else None, "standard_ids": [g["standard_id"]] if is_std and g.get("standard_id") else [], "route_ids": [],
        "guide": g["slug"], "generated_from": f"modules/{next(k for k, m in modules.items() if m['id'] == g['module'])}.html",
        "level": 2 if is_std else entry.get("level", 2), "duration": f"{len(sched)} day(s) · {hours:g} h", "duration_days": len(sched), "training_hours": hours,
        "delivery_modes": ["self_paced", "instructor_led"], "languages": ["ar", "en"],
        "target_audience": [AUD_STD] if is_std else ([g["who"]] if g.get("who") else [AUD_STD]),
        "prerequisites": [{"type": "course", "course_id": "CRS-ISO-101", "required": False, "reason": T("The ISO foundations make the clause language easier.", "تسهّل أساسيات ISO فهم لغة البنود.")}] if is_std else [],
        "learning_outcomes": outcomes[:6], "overview": g["lede"] if g["lede"]["en"] else why, "why_it_matters": why,
        "professional_relevance": T("Built from the toolkit you will use at work, so learning and application share the same language and records.",
                                    "مبنية من الأداة التي ستستخدمها في العمل، فيشترك التعلم والتطبيق في اللغة نفسها والسجلات نفسها."),
        "status_label": "CIA INTERNAL COURSE", "certificate_type": "completion", "external_accreditation_status": "not_claimed", "cpd_status": "not_claimed",
        "assessment_methodology": T("A check question after every lesson, a knowledge check, a final assessment (70% to pass) and a practical task in the toolkit reviewed by a person.",
                                    "سؤال تحقق بعد كل درس، واختبار معرفي، وتقييم ختامي (النجاح من 70%)، ومهمة عملية في الأداة يراجعها شخص."),
        "passing_criteria": T("Complete every lesson and score at least 70% in the final assessment. The practical task is recorded only after human review.",
                              "إكمال جميع الدروس والحصول على 70% على الأقل في التقييم الختامي. لا تُسجَّل المهمة العملية إلا بعد مراجعة بشرية."),
        "assessments": {"quiz": f"{apre}-QUIZ", "final": f"{apre}-FINAL", "practical": f"{apre}-PRACT"}, "final_assessment": f"{apre}-FINAL",
        "materials": [], "tools": [g["module"]], "templates": [], "case_studies": [], "exercises": [],
        "modules": mods, "daily_schedule": sched,
        "practical_task": {"id": f"PT-{code}", "brief": brief, "deliverable": deliverable, "minutes": 90, "rubric": rubric, "review": "human", "question_id": pt_id},
        "recommended_next_course": None, "related_certification": None, "related_knowledge_pages": [],
        "competency_mappings": [{"competency": cp, "target_level": 3 if is_std else 2} for cp in g["competencies"]],
        "version": "1.0.0", "content_owner": "مدثر سلامه", "reviewer": None, "source_references": [sid] + EDITION_SRC.get(code, []), "review_date": None,
        "governance": dict(system_gov),
    }
    gen_courses.append(course)
    domains = sorted({COMP_DOMAIN[c] for c in g["competencies"] if c in COMP_DOMAIN})
    gen_rec.append({"id": f"REC-{cid}", "recommendation_type": "course", "target_id": cid, "title": ctitle, "competencies": g["competencies"], "domains": domains, "roles": [],
                    "level": course["level"], "estimated_effort": f"{hours:g} h", "prerequisites": [], "interest_keywords": [code.lower(), g["slug"].replace("-", " ")],
                    "certification_keywords": [f"ISO {code}", code] if is_std else [], "standard_ids": course["standard_ids"]})

# next-course chain: each standard's requirements course follows its foundation course; methods follow the RCA/CAPA order
for c in gen_courses:
    if c["id"] == "CRS-G-9001": c["recommended_next_course"] = "CRS-ISO-9001-IMP"
for a, b in [("CRS-M-FISH", "CRS-M-WHY5"), ("CRS-M-WHY5", "CRS-M-RCA"), ("CRS-M-RCA", "CRS-M-CAPA"), ("CRS-M-PARETO", "CRS-M-PDCA"), ("CRS-M-PDCA", "CRS-M-A3"), ("CRS-M-A3", "CRS-M-DMAIC")]:
    for c in gen_courses:
        if c["id"] == a: c["recommended_next_course"] = b

courses_doc["items"] = courses + gen_courses
q_doc["items"] = questions + gen_q
a_doc["items"] = assessments + gen_a
save("courses", courses_doc); save("questions", q_doc); save("assessments", a_doc)

src_doc["items"] = [s for s in src_doc["items"] if not s["id"].startswith("SRC-TK-")] + gen_src
save("sources", src_doc)
cat = load("recommendation-catalog")
cat["items"] = [r for r in cat["items"] if not r["id"].startswith(("REC-CRS-G-", "REC-CRS-M-"))] + gen_rec
save("recommendation-catalog", cat)

# ===================================================================================== Quality Mission (the owner's audit-day game) in the library
lib = load("library-items")
QM_VERSION = json.loads((ROOT.parent / "cia-quality-mission" / "simulation-data.json").read_text(encoding="utf-8"))["version"]
QM = [
    ("LIB-SIM-01", "../cia-quality-mission/", T("Quality Mission — ISO 9001 learning game", "مهمة الجودة — لعبة تعلّم ISO 9001"),
     T("32 workplace scenarios across health, manufacturing, construction and financial services: choose the action and the evidence, then see the consequence.",
       "32 سيناريو عمليًا في الصحة والتصنيع والإنشاءات والخدمات المالية: اختر التصرف والدليل، ثم شاهد العاقبة.")),
    ("LIB-SIM-02", "../cia-quality-mission/simulation.html", T("Quality Mission — audit-day simulation", "مهمة الجودة — محاكاة يوم التدقيق"),
     T("Walk through a full audit day in 12 stages, from the opening meeting to follow-up and the independent review of the audit file, in the sector you choose.",
       "عِش يوم تدقيق كاملًا في 12 مرحلة، من اجتماع البداية حتى المتابعة والمراجعة المستقلة لملف التدقيق، في القطاع الذي تختاره.")),
]
lib["items"] = [x for x in lib["items"] if not x["id"].startswith("LIB-SIM-")] + [
    {"id": i, "kind": "simulation", "title": t, "description": d, "domain": None, "ecosystem": "iso", "standard_reference": "ISO 9001", "language": "ar-en",
     "access_tier": "free", "format": "html", "link": link, "related": [], "version": QM_VERSION, "access": "open",
     "governance": {"content_status": "published", "content_source": "owner", "version": QM_VERSION, "reviewer": "Owner publication (live toolkit)", "review_date": LIVE_DATE,
                    "change_note": f"Links to the owner's published Quality Mission game (live commit {LIVE_COMMIT}); no Academy review implied."}}
    for i, link, t, d in QM]
save("library-items", lib)

# ===================================================================================== relationships
rel_doc = load("relationships")
rel = [r for r in rel_doc["items"] if not (str(r.get("fromId", "")).startswith(("CRS-G-", "CRS-M-", "ASM-G-", "ASM-M-")) or str(r.get("toId", "")).startswith("LIB-SIM-"))]
keys = {(r["fromType"], r["fromId"], r["relation"], r["toType"], r["toId"]) for r in rel}


def link(ft, fid, relation, tt, tid):
    k = (ft, fid, relation, tt, tid)
    if k in keys or (ft == tt and fid == tid):
        return
    keys.add(k)
    rel.append({"id": "rel-" + hashlib.sha1("|".join(k).encode()).hexdigest()[:12], "fromType": ft, "fromId": fid, "relation": relation, "toType": tt, "toId": tid})


for c in gen_courses:
    for cp in c["competency_mappings"]:
        link("course", c["id"], "develops", "competency", cp["competency"])
    for t in c["tools"]:
        link("course", c["id"], "links_to_tool", "platform_module", t)
    for s in c["standard_ids"]:
        link("course", c["id"], "part_of", "standard_family", s)
    if c.get("recommended_next_course"):
        link("course", c["id"], "prerequisite_of", "course", c["recommended_next_course"])
for a in gen_a:
    link("assessment", a["id"], "part_of", "course", a["course_id"])
    for cp in a["competencies"]:
        link("assessment", a["id"], "assesses", "competency", cp)
for cid in ["CRS-ISO-AUD", "CRS-ISO-9001-AUD", "CRS-ISO-14001-AUD", "CRS-ISO-45001-AUD", "CRS-ISO-27001-AUD", "CRS-G-9001", "CRS-ISO-9001-F"]:
    link("course", cid, "references", "library_resource", "LIB-SIM-02" if "AUD" in cid else "LIB-SIM-01")
link("ecosystem", "iso", "references", "library_resource", "LIB-SIM-01")
rel_doc["items"] = rel
save("relationships", rel_doc)

print(f"guides {len(index)} ({sum(1 for g in index if g['kind'] == 'standard')} standards, {sum(1 for g in index if g['kind'] == 'method')} methods), "
      f"guide items {sum(g['counts']['items'] for g in index)}, auditor questions {sum(g['counts']['checks'] for g in index)}; "
      f"generated courses {len(gen_courses)}, lessons {sum(len(m['lessons']) for c in gen_courses for m in c['modules'])}, "
      f"hours {sum(c['training_hours'] for c in gen_courses):g}; questions +{len(gen_q)}, assessments +{len(gen_a)}; lesson map {len(MAP)}")
if DROPPED:
    print("Approvals dropped because the content changed (review these again):", ", ".join(DROPPED))
