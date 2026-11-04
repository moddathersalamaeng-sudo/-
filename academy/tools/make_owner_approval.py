#!/usr/bin/env python3
"""Write the owner-approval decision file (schema cia.review-decisions.v1, basis "owner_approval") for every record the
AI-assisted pre-review cleared. It records exactly what happened: the platform owner approved publication on a given date
after the pre-review; it is not an independent expert review.

  python3 tools/pre_review.py                                   # findings + candidates
  python3 tools/make_owner_approval.py "<owner name>" YYYY-MM-DD [--dir PRE_REVIEW_DIR] [--out FILE]   (default dir: deliverables/phase-09/review)
  python3 tools/apply_review_decisions.py FILE                  # dry run, then --apply

Only candidates (no unresolved blocking finding) are included; future-phase records are never included.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLOSURE = Path(sys.argv[sys.argv.index("--dir") + 1]) if "--dir" in sys.argv else ROOT.parent.parent / "deliverables" / "phase-09" / "review"
if len(sys.argv) < 3:
    print(__doc__)
    sys.exit(2)
owner, date = sys.argv[1].strip(), sys.argv[2]
out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else CLOSURE / f"cia-review-decisions-{date}-owner-approval.json"
findings = json.loads((CLOSURE / "pre-review-findings.json").read_text(encoding="utf-8"))
decisions = []
for coll, ids in findings["candidates"].items():
    items = {x["id"]: x for x in json.loads((ROOT / "data" / "seed" / f"{coll}.json").read_text(encoding="utf-8"))["items"]}
    for rid in ids:
        g = items[rid]["governance"]
        decisions.append({"collection": coll, "record_id": rid, "version": g["version"], "decision": "approve", "basis": "owner_approval",
                          "checklist": ["facts", "noCopy", "noClaims", "bilingual", "answers"], "reviewer": owner,
                          "reviewer_role": "Platform owner", "review_date": date,
                          "comment": f"Pre-review: {CLOSURE.relative_to(ROOT.parent.parent)}/pre-review-findings.json"})
doc = {"schema": "cia.review-decisions.v1", "app": "cia-academy", "exported_at": f"{date}T00:00:00Z",
       "reviewer": {"name": owner, "role": "Platform owner"}, "basis": "owner_approval",
       "note": "Owner approval of publication after the AI-assisted pre-review (tools/pre_review.py). Not an independent expert review.",
       "decisions": decisions}
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"{out} — {len(decisions)} decisions")
