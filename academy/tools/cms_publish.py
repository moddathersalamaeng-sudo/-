#!/usr/bin/env python3
"""Publish Admin CMS drafts through the existing pipeline (Phase 14, D-115). Files in Git stay the source of truth.

  python3 tools/cms_publish.py cms-drafts.json cms-decisions.json            # dry run: report only
  python3 tools/cms_publish.py cms-drafts.json cms-decisions.json --apply    # write, pre-review, publish, rebuild

Steps (all or nothing for each record)
  1. Each draft (schema cia.cms-drafts.v1) is written into data/seed/<collection>.json as `needs_review` — a new record is added,
     an existing one is replaced. Published content is never edited in place without a decision.
  2. The pre-review (tools/pre_review.py, checks B1 … B14) runs on the result. A drafted record that is blocked — or that the
     pre-review did not list as a candidate — is put back as it was and its decision is skipped.
  3. The decisions (schema cia.review-decisions.v1, exported from the CMS with the reviewer's name and date) are applied by the
     existing tools/apply_review_decisions.py, which keeps every rule: named reviewer, ISO date, version match, approval hash.
  4. node tools/build_phase10a.mjs rebuilds the per-academy split and the search index.
Commit and deploy as usual afterwards; then mark the drafts exported in the CMS.
"""
import json
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SEED = ROOT / "data" / "seed"
sys.path.insert(0, str(ROOT / "tools"))
from apply_review_decisions import ALLOWED  # noqa: E402

PRE_STATES = {"draft", "needs_review", "in_review"}


def load(path):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 2
    drafts_doc, decisions_doc = load(argv[1]), load(argv[2])
    apply = "--apply" in argv
    if drafts_doc.get("schema") != "cia.cms-drafts.v1" or drafts_doc.get("app") != "cia-academy":
        print("✗ The first file is not a cia.cms-drafts.v1 export from the Academy CMS."); return 1
    if decisions_doc.get("schema") != "cia.review-decisions.v1" or decisions_doc.get("app") != "cia-academy":
        print("✗ The second file is not a cia.review-decisions.v1 file."); return 1
    decided = {(d.get("collection"), d.get("record_id")): d for d in decisions_doc.get("decisions", [])}
    plan, refused = [], []
    for d in drafts_doc.get("drafts", []):
        key = (d.get("collection"), d.get("record_id"))
        data = d.get("data") or {}
        g = data.get("governance") or {}
        if key[0] not in ALLOWED:
            refused.append((key, "collection not on the publishing allow-list")); continue
        if data.get("id") != key[1]:
            refused.append((key, "record id does not match")); continue
        if g.get("content_status") not in PRE_STATES:
            refused.append((key, "draft is not in a pre-publication state")); continue
        if key not in decided:
            refused.append((key, "no decision for this draft")); continue
        if decided[key].get("version") != g.get("version"):
            refused.append((key, "decision was made on another version")); continue
        plan.append((key, data))
    for key, why in refused:
        print(f"  skipped {key[0]}:{key[1]} — {why}")
    print(f"{len(plan)} draft(s) to write, {len(refused)} skipped.")
    if not apply or not plan:
        print("Dry run: nothing written." if not apply else "Nothing to publish.")
        return 0

    # 1. write drafts as needs_review, keeping the previous file content to restore on refusal
    files, before = {}, {}
    for (coll, rid), data in plan:
        path = SEED / f"{coll}.json"
        if path not in files:
            raw = path.read_text(encoding="utf-8")
            before[path] = raw
            files[path] = json.loads(raw)
        items = files[path]["items"]
        rec = {**data, "governance": {**data["governance"], "content_status": "needs_review"}}
        i = next((n for n, x in enumerate(items) if x.get("id") == rid), None)
        if i is None: items.append(rec)
        else: items[i] = rec
    for path, doc in files.items():
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 2. pre-review
    out = pathlib.Path(tempfile.mkdtemp(prefix="cia-prereview-"))
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "pre_review.py"), "--out", str(out)], capture_output=True, text=True, cwd=ROOT)
    print(r.stdout.strip().splitlines()[0] if r.stdout.strip() else r.stderr.strip()[:400])
    if r.returncode != 0:
        for path, raw in before.items(): path.write_text(raw, encoding="utf-8")
        print("✗ The pre-review did not run; every file was restored."); return 1
    res = json.loads((out / "pre-review-findings.json").read_text(encoding="utf-8"))
    cand = {(c, i) for c, ids in res.get("candidates", {}).items() for i in ids}
    blocked = {(c, i): f for c, ids in res.get("blocked", {}).items() for i, f in ids.items()}
    passed = []
    for key, data in plan:
        if key in cand:
            passed.append(key); continue
        why = f"blocked by the pre-review: {blocked[key]}" if key in blocked else "not listed by the pre-review (collection not covered)"
        print(f"  refused {key[0]}:{key[1]} — {why}")
        path = SEED / f"{key[0]}.json"
        orig = json.loads(before[path])["items"]
        doc = json.loads(path.read_text(encoding="utf-8"))
        prev = next((x for x in orig if x.get("id") == key[1]), None)
        doc["items"] = [x for x in doc["items"] if x.get("id") != key[1]] if prev is None else [prev if x.get("id") == key[1] else x for x in doc["items"]]
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not passed:
        print("✗ No draft passed the pre-review; nothing published."); return 1

    # 3. decisions through the existing script (only for records that passed)
    dec = {**decisions_doc, "decisions": [d for d in decisions_doc["decisions"] if (d.get("collection"), d.get("record_id")) in set(passed)]}
    dfile = out / "decisions-passed.json"
    dfile.write_text(json.dumps(dec, ensure_ascii=False, indent=2), encoding="utf-8")
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "apply_review_decisions.py"), str(dfile), "--apply"], capture_output=True, text=True, cwd=ROOT)
    print(r.stdout.strip())
    if r.returncode != 0:
        print(r.stderr.strip()[:400]); return 1

    # 4. rebuild split and search index
    r = subprocess.run(["node", str(ROOT / "tools" / "build_phase10a.mjs")], capture_output=True, text=True, cwd=ROOT)
    print(r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr.strip()[:400])
    if r.returncode != 0: return 1
    print(f"✓ {len(passed)} record(s) published through the existing pipeline. Run the tests, commit and deploy; then mark the drafts exported in the CMS.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
