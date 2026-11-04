#!/usr/bin/env python3
"""AI-assisted pre-review of every draft record before the owner approves publication.

This is NOT an expert review and never changes governance. It runs mechanical checks a reviewer would otherwise do by
hand, writes findings, and lists the records that pass every blocking check (the candidates the owner may approve).

  python3 tools/pre_review.py [--out DIR]          default DIR: ../../deliverables/phase-08/review

Blocking checks (a record that fails one is NOT a candidate):
  B1 claims        no accreditation / certification / CPD / PDU / "approved by" claim unless explicitly negated
  B2 copying       no long quoted passage (> 25 words inside quotes); no "The organization shall …" sentences
  B3 keys          answer keys exist and match the question type; every single-choice option has a bilingual rationale
  B4 references    clause numbers cited in a standard's course exist in that standard's guide; course references resolve
  B5 bilingual     every text field has Arabic and English; neither side is empty or under 25 % of the other's length
  B6 ambiguity     generated check questions: no distractor shares content words with the item's own evidence/gaps,
                   and no distractor is generic evidence listed under 3+ other clauses
  B7 scope         future-phase records (Phase 9 quality, Phase 10 EFQM, the Phase 5 demo items and assessments) stay drafts
  B8 certification facts (Phase 8, extended in Phase 9 to ASQ): official URL on the body's own site (pmi.org / asq.org), dated
                   verification, existing sources; a "pending" group carries no figures; "secondary" only for BoK counts, with a labelled
                   provider source; PMI weights add up to 100, ASQ question counts add up to the scored items; no partner / PDU / RU claim
  B9 figures (Phase 9): known template, bilingual caption and "how to read it", labels in both languages; illustrative numbers say so
Advisory checks (reported, not blocking): duplicate prompts, very long options, answer-key position balance.
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data" / "seed"
OUT = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else ROOT.parent.parent / "deliverables" / "phase-09" / "review"
load = lambda n: json.loads((SEED / f"{n}.json").read_text(encoding="utf-8"))["items"]  # noqa: E731
guides = {g["slug"]: json.loads((ROOT / "data" / "guides" / f"{g['slug']}.json").read_text(encoding="utf-8"))["guide"]
          for g in json.loads((ROOT / "data" / "guides" / "index.json").read_text(encoding="utf-8"))["items"]}

COLL = {"courses": "courses", "questions": "questions", "assessments": "assessments", "iso-standards": "iso-standards", "learning-paths": "learning-paths",
        "ecosystems": "ecosystems", "programs": "programs", "sources": "sources", "competency/competencies": "competency/competencies",
        "competency/target-roles": "competency/target-roles", "competency/domains": "competency/domains", "certifications": "certifications",
        "figures": "figures"}
data = {k: load(v) for k, v in COLL.items()}
FUTURE_COURSES = {"CRS-EFQM-101"}  # CRS-QMS-201 is a Phase 9 course since 4 Nov 2026  # CRS-PM-101 and CRS-P3O-101 are Phase 8 courses since 3 Nov 2026
FUTURE_Q = {"Q-PM-001", "Q-RISK-001", "Q-PMO-001", "Q-EFQM-001", "Q-GOV-001", "Q-AI-001"}
FUTURE_A = {"ASM-DIAG-001", "ASM-QUIZ-001", "ASM-SCEN-001", "ASM-PRACT-001"}
FUTURE_PROGRAMS = set()  # PRG-CIA-FOUNDATIONS completed in Phase 9 (QMS-201 stage added)

findings = defaultdict(list)       # key "collection:id" -> [(code, detail)]
advisory = []


def flag(coll, rid, code, detail):
    findings[f"{coll}:{rid}"].append((code, detail))


def texts(o, path=""):
    """Yield (path, {en, ar}) for every bilingual pair inside a record."""
    if isinstance(o, dict):
        if set(o) >= {"en", "ar"} and isinstance(o.get("en"), str) and isinstance(o.get("ar"), str):
            yield path, o
            return
        for k, v in o.items():
            if k in ("governance", "rubric_levels_unused"):
                continue
            yield from texts(v, f"{path}.{k}" if path else k)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from texts(v, f"{path}[{i}]")


CLAIM_EN = re.compile(r"\b(accredit\w*|CPD|PDUs?|CEUs?|IRCA[- ]approved|Exemplar Global|certified (?:by|course)|approved (?:by|course)|official(?:ly)? (?:recogni[sz]ed|certified)"
                      r"|ATP|Authori[sz]ed Training Partner|PMI[- ](?:approved|endorsed|accredited)|Registered Education Provider|contact[- ]hours? certificate"
                      r"|ASQ[- ](?:approved|endorsed|accredited|partner)|certified by ASQ|RUs?|recertification units?)\b", re.I)
CLAIM_AR = re.compile(r"(وحدات? إعادة (?:ال)?اعتماد|معتمدة? من|اعتماد(?:ها)? من|ساعات التطوير المهني|شهادة معتمدة|معترف بها رسميًا|شريك تدريب معتمد|وحدات? PDU|شهادة ساعات)")
NEG = re.compile(r"(not|no|never|without|nor|isn't|does not|doesn't|cannot|غير|لا |ليس|ليست|دون|لم |بلا)", re.I)
QUOTE = re.compile(r"[“\"«]([^”\"»]{120,})[”\"»]")
SHALL = re.compile(r"\bThe organi[sz]ation shall\b")
CLAUSE_EN = re.compile(r"\b(?:clause|clauses|§)\s*(\d{1,2}(?:\.\d{1,2}){0,3})")
CLAUSE_AR = re.compile(r"البند\s*(\d{1,2}(?:\.\d{1,2}){0,3})")
STD_GUIDE = {"STD-9001": "iso-9001", "STD-14001": "iso-14001", "STD-45001": "iso-45001", "STD-27001": "iso-27001"}


def guide_refs(slug):
    g = guides[slug]
    refs = {i["ref"] for c in g["clauses"] for i in c["items"]}
    tops = {c["id"] for c in g["clauses"]}
    pref = set()
    for r in refs:
        parts = r.split(".")
        for k in range(1, len(parts) + 1):
            pref.add(".".join(parts[:k]))
    return refs | tops | pref


def scope_of(coll, r):
    rid = r["id"]
    if coll == "courses" and rid in FUTURE_COURSES: return "future"
    if coll == "questions" and rid in FUTURE_Q: return "future"
    if coll == "assessments" and rid in FUTURE_A: return "future"
    if coll == "programs" and rid in FUTURE_PROGRAMS: return "future"
    return "now"


# ------------------------------------------------------------------ B1, B2, B5 on every draft record
drafts = [(coll, r) for coll, items in data.items() for r in items if r.get("governance") and r["governance"].get("content_status") != "published"]
for coll, r in drafts:
    if scope_of(coll, r) == "future":
        flag(coll, r["id"], "B7", "future-phase record (Phases 9–12 or a Phase 5 type example); stays a draft")
        continue
    for path, v in texts(r):
        en, ar = v["en"].strip(), v["ar"].strip()
        for m in CLAIM_EN.finditer(en):
            window = en[max(0, m.start() - 80):m.end() + 20]
            if not NEG.search(window) and not re.search(r"not_claimed|accreditation body|accreditation bodies|certification bod|accredited certification", window, re.I):
                flag(coll, r["id"], "B1", f"{path}: “{window.strip()}”")
        for m in CLAIM_AR.finditer(ar):
            window = ar[max(0, m.start() - 60):m.end() + 20]
            if not NEG.search(window):
                flag(coll, r["id"], "B1", f"{path}: «{window.strip()}»")
        for m in QUOTE.finditer(en):
            if len(m.group(1).split()) > 25:
                flag(coll, r["id"], "B2", f"{path}: long quotation ({len(m.group(1).split())} words)")
        if SHALL.search(en):
            flag(coll, r["id"], "B2", f"{path}: normative “The organization shall …” sentence")
        if (en and not ar) or (ar and not en):
            flag(coll, r["id"], "B5", f"{path}: one language missing")
        elif en and ar and min(len(en), len(ar)) < 0.25 * max(len(en), len(ar)) and max(len(en), len(ar)) > 40:
            flag(coll, r["id"], "B5", f"{path}: AR/EN length mismatch ({len(ar)} vs {len(en)} chars)")

# ------------------------------------------------------------------ B3 answer keys
for q in data["questions"]:
    if q["governance"]["content_status"] == "published" or scope_of("questions", q) == "future":
        continue
    t = q["type"]
    ids = [o["id"] for o in q.get("options", [])]
    if t == "single_choice":
        if q.get("correct_answer") not in ids: flag("questions", q["id"], "B3", "key is not an option")
        if len(set(ids)) != len(ids): flag("questions", q["id"], "B3", "duplicate option ids")
        missing = [o["id"] for o in q["options"] if not (o.get("why", {}).get("en") and o.get("why", {}).get("ar"))]
        if missing and q["governance"]["content_source"] != "ai_draft" or (missing and q.get("course_id")):
            flag("questions", q["id"], "B3", f"options without rationale: {missing}")
        if len({o["text"]["en"].strip().lower() for o in q["options"]}) != len(q["options"]): flag("questions", q["id"], "B3", "duplicate option text")
    elif t == "multiple_choice":
        ca = q.get("correct_answer") or []
        if not ca or any(k not in ids for k in ca): flag("questions", q["id"], "B3", "multiple-choice key not all options")
    elif t == "true_false":
        if not isinstance(q.get("correct_answer"), bool): flag("questions", q["id"], "B3", "true/false key is not boolean")
    elif t == "matching":
        if not q.get("pairs") or not isinstance(q.get("correct_answer"), dict): flag("questions", q["id"], "B3", "matching without pairs/key")
    if not (q.get("explanation", {}).get("en") and q.get("explanation", {}).get("ar")) and t != "practical_assignment":
        flag("questions", q["id"], "B3", "no bilingual explanation")

# ------------------------------------------------------------------ B4 references
ids_of = {k: {x["id"] for x in v} for k, v in data.items()}
for c in data["courses"]:
    if c["governance"]["content_status"] == "published" or c["id"] in FUTURE_COURSES:
        continue
    for k in ("quiz", "final", "practical"):
        if (c.get("assessments") or {}).get(k) and c["assessments"][k] not in ids_of["assessments"]:
            flag("courses", c["id"], "B4", f"assessment {k} missing")
    for s in c.get("source_references", []):
        if s not in ids_of["sources"]: flag("courses", c["id"], "B4", f"unknown source {s}")
    if len(c.get("standard_ids", [])) == 1 and c["standard_ids"][0] in STD_GUIDE and not c.get("guide"):
        known = guide_refs(STD_GUIDE[c["standard_ids"][0]])
        seen = set()
        for path, v in texts(c):
            for rx, lang in ((CLAUSE_EN, "en"), (CLAUSE_AR, "ar")):
                for m in rx.finditer(v[lang]):
                    ref = m.group(1).rstrip(".")
                    if ref not in known and ref not in seen and not ref.startswith(("A.", "0")):
                        seen.add(ref)
                        flag("courses", c["id"], "B4", f"{path}: clause {ref} not found in the {STD_GUIDE[c['standard_ids'][0]]} guide")
for a in data["assessments"]:
    if a["governance"]["content_status"] == "published" or a["id"] in FUTURE_A:
        continue
    for qid in a["question_ids"]:
        if qid not in ids_of["questions"]: flag("assessments", a["id"], "B4", f"unknown question {qid}")
        elif qid in FUTURE_Q: flag("assessments", a["id"], "B4", f"uses future-phase question {qid}")

# ------------------------------------------------------------------ B6 generated question ambiguity
STOP = set("with from that this their there what which when where have been into each other for and the are its about must should shall records record".split())
words = lambda *ts: {w for t in ts for w in re.sub(r"\W+", " ", t.lower()).split() if len(w) >= 4 and w not in STOP}  # noqa: E731
ev_clauses = defaultdict(set)
for slug, g in guides.items():
    if g["kind"] != "standard": continue
    for c in g["clauses"]:
        for i in c["items"]:
            for e in i["ev"]:
                ev_clauses[(slug, re.sub(r"\W+", " ", e["en"].lower()).strip())].add(i["ref"])
gen_checked = 0
for q in data["questions"]:
    m = re.match(r"guide:([a-z0-9-]+)#(.+)$", q.get("reference", ""))
    if not m or q["type"] != "single_choice": continue
    gen_checked += 1
    slug, ref = m.groups()
    g = guides[slug]
    item = next(i for c in g["clauses"] for i in c["items"] if i["ref"] == ref)
    own = words(item["title"]["en"], *[e["en"] for e in item["ev"]])
    all_gaps = {re.sub(r"\W+", " ", x["en"].lower()).strip() for c in g["clauses"] for i in c["items"] for x in i.get("gaps", [])}
    for o in q["options"]:
        if o["id"] == q["correct_answer"]: continue
        ow = words(o["text"]["en"])
        if g["kind"] == "standard" and ow & own:
            flag("questions", q["id"], "B6", f"distractor {o['id']} shares “{', '.join(sorted(ow & own))}” with the item")
        advice = "guide's advice" in q["prompt"]["en"]
        if advice and re.sub(r"\W+", " ", o["text"]["en"].lower()).strip() not in all_gaps:
            flag("questions", q["id"], "B6", f"advice question: distractor {o['id']} is not a listed mistake")
        if g["kind"] == "method" and not advice and (re.sub(r"\W+", " ", o["text"]["en"].lower()).strip() in all_gaps
                                      or re.match(r"^(no|not|never|without|only|skip|avoid|don't|do not)\b", o["text"]["en"], re.I)):
            flag("questions", q["id"], "B6", f"distractor {o['id']} reads as a gap: {o['text']['en'][:60]}")
        if g["kind"] == "standard":
            n_cl = len(ev_clauses[(slug, re.sub(r'\W+', ' ', o['text']['en'].lower()).strip())])
            if n_cl >= 3:
                flag("questions", q["id"], "B6", f"distractor {o['id']} is generic evidence listed under {n_cl} clauses")
        if len(o["text"]["en"].split()) <= 1:
            flag("questions", q["id"], "B6", f"distractor {o['id']} is a single word")

# ------------------------------------------------------------------ B6 practice questions (Phase 8): a distractor must share no content word with the practice
for q in data["questions"]:
    m = re.match(r"guide:([a-z0-9-]+)#(.+)$", q.get("reference", ""))
    if not m or q["type"] != "single_choice" or guides[m.group(1)]["kind"] != "practice": continue
    g = guides[m.group(1)]
    item = next(i for c in g["clauses"] for i in c["items"] if i["ref"] == m.group(2))
    own = words(item["title"]["en"], item["req"]["en"], *[x["en"] for x in item["how"]])
    for o in q["options"]:
        if o["id"] != q["correct_answer"] and words(o["text"]["en"]) & own:
            flag("questions", q["id"], "B6", f"practice distractor {o['id']} shares “{', '.join(sorted(words(o['text']['en']) & own))}” with the practice")

# ------------------------------------------------------------------ B8 certification facts (Phase 8, ASQ in Phase 9)
SITE = {"PMI": r"^https://(www\.)?pmi\.org/", "ASQ": r"^https://(www\.)?asq\.org/"}
src_by = {x["id"]: x for x in data["sources"]}
for c in data.get("certifications", []):
    st = c.get("facts_status", {}); body = c.get("body", "PMI")
    if not re.match(SITE.get(body, SITE["PMI"]), c.get("official_url", "")): flag("certifications", c["id"], "B8", f"official URL is not a {body.lower()}.org page")
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", c.get("verified_date") or ""): flag("certifications", c["id"], "B8", "no verification date")
    for s_ in c.get("source_ids", []):
        if s_ not in src_by: flag("certifications", c["id"], "B8", f"unknown source {s_}")
    for grp in ("exam", "fee", "renewal"):
        if st.get(grp) != "verified" and c.get(grp): flag("certifications", c["id"], "B8", f"{grp} is pending but carries figures")
        if st.get(grp) == "verified" and not c.get(grp): flag("certifications", c["id"], "B8", f"{grp} verified but empty")
    if st.get("domains") == "secondary" and not any(src_by.get(x, {}).get("source_type") == "secondary_summary_of_official" for x in c.get("source_ids", [])):
        flag("certifications", c["id"], "B8", "secondary domains without a labelled provider source")
    if st.get("domains") not in ("verified", "secondary") and c.get("domains"): flag("certifications", c["id"], "B8", "domains pending but carry figures")
    if st.get("domains") in ("verified", "secondary") and c.get("domains"):
        if c.get("domain_unit") == "questions":
            if (c.get("exam") or {}).get("scored") and sum(d["questions"] for d in c["domains"]) != c["exam"]["scored"]:
                flag("certifications", c["id"], "B8", "BoK question counts do not add up to the scored items")
        elif sum(d["weight"] for d in c["domains"]) != 100:
            flag("certifications", c["id"], "B8", "domain weights do not add up to 100")

# ------------------------------------------------------------------ B9 figures (Phase 9)
TEMPLATES = {"cycle", "flow", "matrix", "ladder", "nested", "pareto", "histogram", "control", "scatter", "scurve", "fishbone", "iceberg", "tree", "kanban", "table", "triad", "hub", "funnel", "tiles", "spectrum", "bars"}
for f in data.get("figures", []):
    if f.get("template") not in TEMPLATES: flag("figures", f["id"], "B9", f"unknown template {f.get('template')}")
    for k in ("caption", "read"):
        if not (f.get(k) or {}).get("en") or not (f.get(k) or {}).get("ar"): flag("figures", f["id"], "B9", f"{k} missing in one language")
    if f.get("template") in ("pareto", "histogram", "control", "scatter", "scurve", "bars") and "lesson example" not in f["read"]["en"].lower() and "illustrative" not in f["read"]["en"].lower() \
            and "lesson example" not in json.dumps(f.get("xLabel", {})).lower() and not re.search(r"\b(PMI|ASQ)\b", f["read"]["en"] + f["caption"]["en"]):
        flag("figures", f["id"], "B9", "chart numbers are not marked as illustrative, a lesson example or a sourced fact")

# ------------------------------------------------------------------ advisory
prompts = Counter(q["prompt"]["en"].strip().lower() for q in data["questions"])
for p_, n in prompts.items():
    if n > 1: advisory.append(f"duplicate prompt ×{n}: {p_[:90]}")
keys = Counter(q.get("correct_answer") for q in data["questions"] if q["type"] == "single_choice")
advisory.append("single-choice key positions: " + ", ".join(f"{k}={v}" for k, v in sorted((str(k), v) for k, v in keys.items())))

# ------------------------------------------------------------------ findings read and judged during the pre-review (3 Nov 2026)
# Each entry clears ONE check on ONE record, with the reason. Anything not listed here stays blocking.
REVIEWED = {
    ("courses:CRS-ISO-101", "B1"): "Teaches what certification and accreditation mean and how to word a certification claim correctly; makes no claim about the course.",
    ("courses:CRS-ISO-101", "B2"): "Quoted text is an original sample certificate statement and a sample quality objective, not standard text.",
    ("courses:CRS-ISO-AUD", "B2"): "Quoted text is an original sample audit finding (requirement / evidence / gap) written for the exercise.",
    ("courses:CRS-ISO-NC", "B1"): "“approved by the authority named in the contract” describes disposition of nonconforming product, not an accreditation claim.",
    ("courses:CRS-ISO-NC", "B2"): "Quoted text is an original sample effectiveness criterion.",
    ("courses:CRS-ISO-9001-AUD", "B1"): "States that lead-auditor courses certified by an auditor certification body are separate — a disclaimer, not a claim.",
    ("courses:CRS-ISO-14001-F", "B2"): "Quoted text is an original sample monitoring arrangement.",
    ("courses:CRS-ISO-14001-AUD", "B2"): "Quoted text is an original sample audit finding.",
    ("courses:CRS-ISO-45001-AUD", "B2"): "Quoted text is an original sample audit finding.",
    ("courses:CRS-ISO-27001-AUD", "B1"): "“approved by the risk owner” is risk-treatment approval, not an accreditation claim.",
    ("courses:CRS-ISO-27001-AUD", "B2"): "Quoted text is an original sample audit finding.",
    ("questions:Q-ISO-101-L01", "B1"): "Question teaches who issues an accredited certificate; no claim about the Academy.",
    ("questions:Q-ISO-AUD-L05", "B2"): "Option quotes an original sample finding.",
    ("questions:Q-G-31000-L09", "B1"): "“policy approved by the board” is evidence wording from the owner's guide, not an accreditation claim.",
    ("questions:Q-G-31000-L19", "B1"): "Same: board-approved policy is evidence wording.",
    ("questions:Q-G-31000-L20", "B1"): "Same: board-approved policy is evidence wording.",
    ("questions:Q-G-31000-L23", "B1"): "Same: board-approved policy is evidence wording.",
    ("questions:Q-G-31000-L24", "B1"): "Same: board-approved policy is evidence wording.",
    ("questions:Q-G-37000-L01", "B1"): "“statement approved by the board” is evidence wording from the owner's guide.",
    ("questions:Q-G-37000-L10", "B1"): "Same: board-approved statement is evidence wording.",
    ("learning-paths:ROUTE-LA", "B1"): "Says lead-auditor certification needs a separate externally certified course — a disclaimer, not a claim.",
    # Phase 8 (3 Nov 2026) — each finding below was read in the record and judged a false positive.
    ("courses:CRS-P3O-101", "B2"): "Quoted text is an original CIA model sentence or sample wording written for the exercise (a status line, a charter clause, a board argument), not a quotation from any publication.",
    ("courses:CRS-PM-SSC", "B2"): "Quoted text is an original CIA model sentence or sample wording written for the exercise (a status line, a charter clause, a board argument), not a quotation from any publication.",
    ("courses:CRS-PM-RISK", "B2"): "Quoted text is an original CIA model sentence or sample wording written for the exercise (a status line, a charter clause, a board argument), not a quotation from any publication.",
    ("courses:CRS-PM-STAKE", "B2"): "Quoted text is an original CIA model sentence or sample wording written for the exercise (a status line, a charter clause, a board argument), not a quotation from any publication.",
    ("courses:CRS-PMO-DESIGN", "B2"): "Quoted text is an original CIA model sentence or sample wording written for the exercise (a status line, a charter clause, a board argument), not a quotation from any publication.",
    ("courses:CRS-PMO-KPI", "B2"): "Quoted text is an original CIA model sentence or sample wording written for the exercise (a status line, a charter clause, a board argument), not a quotation from any publication.",
    ("courses:CRS-PFM-PRIOR", "B2"): "Quoted text is an original CIA model sentence or sample wording written for the exercise (a status line, a charter clause, a board argument), not a quotation from any publication.",
    ("courses:CRS-PMP-PREP", "B2"): "Quoted text is an original CIA model sentence or sample wording written for the exercise (a status line, a charter clause, a board argument), not a quotation from any publication.",
    ("courses:CRS-PM-SSC", "B1"): "«اعتماد من المستوى المناسب» means approval of a change request at the right authority level, not accreditation.",
    ("questions:Q-P-21500-L50", "B1"): "Owner guide wording: a governance framework approved by the board — governance approval, not an accreditation claim.",
    ("questions:Q-P-P3O-L01", "B1"): "Owner guide wording: the sponsor approves the office value case — not an accreditation claim.",
    ("questions:Q-P-PMX-L21", "B1"): "Owner guide wording: a priority list approved by the investment committee — governance approval, not a claim.",
    ("questions:Q-P-PMX-L26", "B1"): "Same owner guide wording as Q-P-PMX-L21 — governance approval, not a claim.",
    ("certifications:CERT-PMI-ACP", "B1"): "PMI's own eligibility wording (GAC-accredited degree programme) or the name of PMI's credential (\"certified by PMI\" describes PMI's certification, not CIA); the record states CIA is not a PMI partner and awards no PDUs.",
    ("certifications:CERT-PMI-RMP", "B1"): "PMI's own eligibility wording (GAC-accredited degree programme) or the name of PMI's credential (\"certified by PMI\" describes PMI's certification, not CIA); the record states CIA is not a PMI partner and awards no PDUs.",
    ("certifications:CERT-PFMP", "B1"): "PMI's own eligibility wording (GAC-accredited degree programme) or the name of PMI's credential (\"certified by PMI\" describes PMI's certification, not CIA); the record states CIA is not a PMI partner and awards no PDUs.",
    ("certifications:CERT-PMI-PBA", "B1"): "PMI's own eligibility wording (GAC-accredited degree programme) or the name of PMI's credential (\"certified by PMI\" describes PMI's certification, not CIA); the record states CIA is not a PMI partner and awards no PDUs.",
    ("certifications:CERT-PMI-PMOCP", "B1"): "PMI's own eligibility wording (GAC-accredited degree programme) or the name of PMI's credential (\"certified by PMI\" describes PMI's certification, not CIA); the record states CIA is not a PMI partner and awards no PDUs.",
    # Phase 9 (4 Nov 2026) — read and judged acceptable:
    ("courses:CRS-QMS-201", "B2"): "The quoted text is CIA's own worked example (a rewritten quality objective), not a quotation from a source.",
    ("courses:CRS-Q-CAPA", "B2"): "The quoted text is CIA's own worked example (a problem statement), not a quotation from a source.",
    ("courses:CRS-Q-AUDIT", "B2"): "The quoted text is CIA's own worked example of a weak and a strong audit finding; QP-07 is a fictional procedure.",
    ("courses:CRS-LSS-GB", "B2"): "The quoted text is CIA's own model answer (a rewritten problem statement), not a quotation from a source.",
    ("certifications:CERT-PGMP", "B1"): "PMI's own eligibility wording (GAC-accredited degree programme), rechecked on PMI's page on 4 Nov 2026; the record states CIA is not a PMI partner and awards no PDUs.",
    ("figures:FIG-ISO-CHAIN", "B1"): "The figure explains what accreditation is (the accreditation body checks the certification body), as the published ISO foundations lesson does; it claims nothing for CIA.",
}
cleared = defaultdict(list)
for key, fs in list(findings.items()):
    keep = []
    for code, detail in fs:
        note = REVIEWED.get((key, code))
        (cleared[key].append((code, detail, note)) if note else keep.append((code, detail)))
    findings[key] = keep

# ------------------------------------------------------------------ result
candidates = defaultdict(list)
blocked = defaultdict(list)
for coll, r in drafts:
    key = f"{coll}:{r['id']}"
    (blocked if findings.get(key) else candidates)[coll].append(r["id"])
OUT.mkdir(parents=True, exist_ok=True)
result = {"schema": "cia.pre-review.v1", "date": "2026-11-04", "drafts": len(drafts), "generated_questions_checked": gen_checked,
          "candidates": candidates, "blocked": {k: {i: findings[f"{k}:{i}"] for i in v} for k, v in blocked.items()},
          "cleared_after_reading": {k: v for k, v in cleared.items() if v}, "advisory": advisory}
(OUT / "pre-review-findings.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
by_code = Counter(code for v in findings.values() for code, _ in v)
print(f"cleared after reading: {sum(len(v) for v in cleared.values())} finding(s) on {sum(1 for v in cleared.values() if v)} record(s)")
print(f"drafts {len(drafts)} · candidates {sum(len(v) for v in candidates.values())} · blocked {sum(len(v) for v in blocked.values())} · findings by check {dict(by_code)}")
for coll in COLL:
    if candidates.get(coll) or blocked.get(coll):
        print(f"  {coll}: candidates {len(candidates.get(coll, []))}, blocked {len(blocked.get(coll, []))}")
