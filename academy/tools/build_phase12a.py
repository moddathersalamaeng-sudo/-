#!/usr/bin/env python3
"""Phase 12A seed builder — Company Portal (spec §22A / ADD-13).

The portal itself is the administrator's and the employee's own data (cia:v1:<user>:company_*, passport_shares,
assignments_inbox) and code (src/domain/company.mjs). This builder writes only the governed and shared pieces:
  data/seed/figures.json          4 explanatory figures (owner_phase "12A"), placed as company:main / share / matrix / tna
  data/seed/lesson-figures.json   their placement
  data/seed/navigation.json       the "company" entry: active, account menu, company_admin / admin only (no new top item)
  data/seed/roles.json            company_admin is no longer a placeholder
  data/seed/build-status.json     Phase 12A in progress (a completed phase stays complete on rebuild)
  data/i18n/en.json, ar.json      the "co12a" UI strings
Every figure is validated (template, bilingual caption, "how to read it", label parity) before anything is written.

Run after build_phase12.py and BEFORE build_phase10a.mjs:  … → build:phase12 → build:phase12a → build:phase10a
Idempotent; only Phase 12A ids are upserted; approvals of unchanged records are kept (tools/review_hash.py). New figures are
needs_review; publication happens only through tools/apply_review_decisions.py on the owner's decision. Author: مدثر سلامه.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SEED = ROOT / "data" / "seed"
I18N = ROOT / "data" / "i18n"
sys.path.insert(0, str(HERE / "phase12a"))
sys.path.insert(0, str(HERE))

import figures12a  # noqa: E402
import i18n_company  # noqa: E402
from review_hash import keep_approvals  # noqa: E402

PHASE = "12A"
DROPPED = []
TEMPLATES = {"cycle", "flow", "ladder", "bars", "matrix"}


def load(name):
    return json.loads((SEED / f"{name}.json").read_text(encoding="utf-8"))


def save(name, doc):
    path = SEED / f"{name}.json"
    if path.exists() and isinstance(doc.get("items"), list) and all("governance" in x for x in doc["items"]):
        DROPPED.extend(f"{name}:{i}" for i in keep_approvals(json.loads(path.read_text(encoding="utf-8")).get("items", []), doc["items"]))
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def labels(o, lang):
    out = []
    if isinstance(o, dict):
        if set(o) == {"en", "ar"}:
            return [o[lang]]
        for k, v in o.items():
            if k not in ("caption", "read", "governance", "id"):
                out += labels(v, lang)
    elif isinstance(o, list):
        for v in o:
            out += labels(v, lang)
    return out


# ------------------------------------------------------------------ figure checks
ids = [f["id"] for f in figures12a.FIGS]
assert len(set(ids)) == len(ids), "duplicate figure id"
for f in figures12a.FIGS:
    assert f["template"] in TEMPLATES, (f["id"], "template")
    for k in ("caption", "read"):
        assert f[k]["en"].strip() and f[k]["ar"].strip(), (f["id"], k)
    assert len(labels(f, "en")) == len(labels(f, "ar")) and all(labels(f, "ar")), (f["id"], "label parity")
for key, figs in figures12a.PLACEMENT.items():
    assert key.startswith("company:"), key
    for x in figs:
        assert x in ids, (key, x)

# ------------------------------------------------------------------ figures (governed) and placement
for f in figures12a.FIGS:
    f["owner_phase"] = PHASE
    f["governance"] = {"content_status": "needs_review", "content_source": "ai_draft", "version": "0.12.1", "reviewer": None, "review_date": None,
                       "change_note": "Phase 12A explanatory figure (original CIA diagram, data-driven SVG; no figures or claims); awaiting review."}
fig_doc = load("figures")
fid = set(ids)
assert not fid & {x["id"] for x in fig_doc["items"] if x.get("owner_phase") != PHASE}, "figure id used by another phase"
fig_doc["items"] = [x for x in fig_doc["items"] if x.get("owner_phase") != PHASE or x["id"] in fid]
idx = {x["id"]: i for i, x in enumerate(fig_doc["items"])}
for f in figures12a.FIGS:
    if f["id"] in idx:
        fig_doc["items"][idx[f["id"]]] = f
    else:
        fig_doc["items"].append(f)
save("figures", fig_doc)
lf_path = SEED / "lesson-figures.json"
lf = json.loads(lf_path.read_text(encoding="utf-8"))
placed = {e["id"]: [x for x in e.get("figures", []) if x not in fid] for e in lf["items"]}
for k, v in figures12a.PLACEMENT.items():
    placed[k] = list(dict.fromkeys(placed.get(k, []) + v))
lf_path.write_text(json.dumps({"schema": "cia.lesson-figures.v1", "items": [{"id": k, "figures": v} for k, v in placed.items() if v]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# ------------------------------------------------------------------ navigation: the workspace lives in the account menu
nav_path = SEED / "navigation.json"
nav = json.loads(nav_path.read_text(encoding="utf-8"))
for e in nav["items"]:
    if e["id"] == "company":
        e.update({"kind": "route", "phase": "12A", "status": "active", "roles": ["company_admin", "admin"], "requiredTier": "corporate", "primary": False, "route": "/company", "placement": "user"})
assert sum(1 for e in nav["items"] if e.get("placement") == "top") == 5, "the five-item structure must not change"
nav_path.write_text(json.dumps(nav, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

roles_path = SEED / "roles.json"
roles = json.loads(roles_path.read_text(encoding="utf-8"))
for r in roles["items"]:
    if r["id"] == "company_admin":
        r["placeholder"] = False
roles_path.write_text(json.dumps(roles, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# ------------------------------------------------------------------ build status
bs = load("build-status")
for p in bs["phases"]:
    if str(p.get("id")) == "12A" and p.get("status") != "complete":
        p.pop("fraction", None)
        p.update({"status": "in_progress", "partial": None,
                  "note": "Company workspace built (12 Nov 2026): consent-gated passport shares, competency matrix, training needs analysis, annual plan exports and assignments, as files on the device; 4 figures await review / owner approval; accounts arrive with Phase 14."})
bs["updated"] = "2026-11-12"
save("build-status", bs)


# ------------------------------------------------------------------ UI strings
def merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            merge(dst[k], v)
        else:
            dst[k] = v


def flat(o, p=""):
    return [x for k, v in o.items() for x in (flat(v, p + k + ".") if isinstance(v, dict) else [(p + k, v)])]


import re  # noqa: E402

fe, fa = dict(flat(i18n_company.EN)), dict(flat(i18n_company.AR))
assert set(fe) == set(fa), ("co12a keys differ", sorted(set(fe) ^ set(fa))[:10])
assert all(str(v).strip() for v in fa.values()), "empty Arabic string"
ph = lambda s_: sorted(re.findall(r"\{(\w+)\}", s_))  # noqa: E731
bad = [k for k in fe if ph(fe[k]) != ph(fa[k])]
assert not bad, ("placeholders differ", bad[:10])
for lang, part, extra in (("en", i18n_company.EN, i18n_company.EXTRA_EN), ("ar", i18n_company.AR, i18n_company.EXTRA_AR)):
    p = I18N / f"{lang}.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    d.pop("co12a", None)
    merge(d, {"co12a": part})
    merge(d, extra)
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print(f"phase 12A: figures {len(figures12a.FIGS)} (placements {sum(len(v) for v in figures12a.PLACEMENT.values())}), strings co12a {len(fe)} per language")
if DROPPED:
    print("approvals dropped (content changed, needs review again):", ", ".join(DROPPED))
