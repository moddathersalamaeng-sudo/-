"""Shared helper for the review workflow: a stable fingerprint of a record's *content*.

The fingerprint ignores the review metadata itself (governance block, top-level reviewer fields), so it changes
only when the reviewed content changes. apply_review_decisions.py stores it as governance.approved_hash when a
record is approved; build scripts keep an approval only while the regenerated record still has the same hash.
"""
import hashlib
import json

REVIEW_KEYS = ("governance", "reviewer", "review_date", "review_comments")


def content_hash(record: dict) -> str:
    body = {k: v for k, v in record.items() if k not in REVIEW_KEYS}
    return hashlib.sha256(json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def keep_approvals(old_items, new_items):
    """Copy review state from old records onto regenerated ones whose content is unchanged.

    Returns the ids whose earlier approval was dropped because the content changed (they need review again)."""
    old = {x.get("id"): x for x in old_items if isinstance(x, dict)}
    dropped = []
    for x in new_items:
        o = old.get(x.get("id"))
        if not o or not isinstance(o.get("governance"), dict) or not isinstance(x.get("governance"), dict):
            continue
        g = o["governance"]
        reviewed = g.get("content_status") in ("published", "approved") or o.get("review_comments")
        if not reviewed:
            continue
        if g.get("approved_hash") and g["approved_hash"] != content_hash(x):
            dropped.append(x["id"])
            continue
        x["governance"] = g
        for k in ("reviewer", "review_date", "review_comments"):
            if k in o:
                x[k] = o[k]
    return dropped
