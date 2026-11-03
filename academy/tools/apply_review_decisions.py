#!/usr/bin/env python3
"""Apply an exported expert-review file (schema cia.review-decisions.v1) to the Academy seed data.

This is the ONLY step that publishes content. It is run by the content owner, with a file exported from the
review queue (#/review) by a named reviewer. Nothing is guessed: the reviewer name and date come from the file.

  python3 tools/apply_review_decisions.py decisions.json            # dry run: report only
  python3 tools/apply_review_decisions.py decisions.json --apply    # write the changes

Rules
  approve            → governance.content_status = "published"; content_source "ai_draft" becomes "sme";
                       governance.reviewer / review_date set from the decision; approved_hash recorded.
  basis              → optional per decision: "expert_review" (default, above) or "owner_approval" — the platform owner
                       approves publication after the AI-assisted pre-review (tools/pre_review.py). Then content_source
                       becomes "owner", governance.drafted_by keeps the original source, governance.approval_basis says
                       what happened, and the change note states it is not an independent expert review.
  changes_requested  → status stays "needs_review"; the comment is appended to review_comments.
  A decision is skipped when the record is missing, or when its governance.version differs from the version the
  reviewer saw (the record changed after review), or when the reviewer name / date is invalid.
Every applied file is logged in data/review-log.json.
"""
import datetime
import hashlib
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from review_hash import content_hash  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
SEED = ROOT / "data" / "seed"
ALLOWED = {"courses", "assessments", "questions", "iso-standards", "learning-paths", "competency/competencies",
           "competency/target-roles", "competency/domains", "ecosystems", "programs", "sources", "certifications"}  # Phase 8: certification explorer
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def valid_date(s):
    if not isinstance(s, str) or not ISO.match(s):
        return False
    try:
        return datetime.date.fromisoformat(s).isoformat() == s
    except ValueError:
        return False


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    path = pathlib.Path(argv[1])
    write = "--apply" in argv
    raw = path.read_bytes()
    doc = json.loads(raw.decode("utf-8"))
    if doc.get("schema") != "cia.review-decisions.v1" or doc.get("app") != "cia-academy":
        print("✗ Not a cia.review-decisions.v1 file from the Academy.")
        return 1
    files, report = {}, {"approved": [], "changes_requested": [], "skipped": []}
    for d in doc.get("decisions", []):
        key = f'{d.get("collection")}:{d.get("record_id")}'
        name = (d.get("reviewer") or "").strip()
        if d.get("collection") not in ALLOWED:
            report["skipped"].append((key, "unknown collection")); continue
        if len(name) < 3 or not valid_date(d.get("review_date")):
            report["skipped"].append((key, "reviewer name or review date missing/invalid")); continue
        if d.get("decision") not in ("approve", "changes_requested"):
            report["skipped"].append((key, "unknown decision")); continue
        basis = d.get("basis", "expert_review")
        if basis not in ("expert_review", "owner_approval"):
            report["skipped"].append((key, f"unknown basis {basis}")); continue
        fpath = SEED / f'{d["collection"]}.json'
        if fpath not in files:
            files[fpath] = json.loads(fpath.read_text(encoding="utf-8"))
        rec = next((x for x in files[fpath]["items"] if x.get("id") == d["record_id"]), None)
        if rec is None:
            report["skipped"].append((key, "record not found")); continue
        g = rec.get("governance") or {}
        if g.get("version") != d.get("version"):
            report["skipped"].append((key, f'version changed since review ({d.get("version")} → {g.get("version")})')); continue
        role = f' ({d["reviewer_role"]})' if d.get("reviewer_role") else ""
        if d["decision"] == "approve":
            g["content_status"] = "published"
            if basis == "owner_approval":
                g["drafted_by"] = g.get("drafted_by") or g.get("content_source")
                g["content_source"] = "owner"
                g["approval_basis"] = "owner_approval_after_ai_prereview"
                g["change_note"] = (f'Published on the platform owner\'s approval ({name}{role}, {d["review_date"]}) after the AI-assisted pre-review; '
                                    f'not an independent expert review. Drafted by: {g["drafted_by"]}. Review file {path.name}') + (f' — {d["comment"]}' if d.get("comment") else "")
            else:
                if g.get("content_source") == "ai_draft":
                    g["content_source"] = "sme"
                g["approval_basis"] = "expert_review"
                g["change_note"] = f'Approved by {name}{role} on {d["review_date"]} via review file {path.name}' + (f' — {d["comment"]}' if d.get("comment") else "")
            g["reviewer"] = name
            g["review_date"] = d["review_date"]
            g["approved_hash"] = content_hash(rec)
            if "reviewer" in rec:
                rec["reviewer"] = name
            if "review_date" in rec:
                rec["review_date"] = d["review_date"]
            report["approved"].append(key)
        else:
            g["content_status"] = "needs_review"
            rec.setdefault("review_comments", []).append({"reviewer": name + role, "date": d["review_date"], "comment": d.get("comment", "")})
            report["changes_requested"].append(key)
        rec["governance"] = g
    for k in ("approved", "changes_requested"):
        print(f'{k}: {len(report[k])}')
        for x in report[k][:50]:
            print("   ", x)
    print(f'skipped: {len(report["skipped"])}')
    for x, why in report["skipped"]:
        print("   ", x, "—", why)
    if not write:
        print("\nDry run only. Re-run with --apply to write the changes.")
        return 0
    for fpath, d in files.items():
        fpath.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log_path = ROOT / "data" / "review-log.json"
    log = json.loads(log_path.read_text(encoding="utf-8")) if log_path.exists() else {"schema": "cia.review-log.v1", "items": []}
    log["items"].append({"applied_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"), "file": path.name,
                         "sha256": hashlib.sha256(raw).hexdigest(), "reviewer": doc.get("reviewer"),
                         "approved": len(report["approved"]), "changes_requested": len(report["changes_requested"]), "skipped": len(report["skipped"])})
    log_path.write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n✓ Written. Logged in {log_path.relative_to(ROOT)}. Run the unit tests (npm test) before deploying.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
