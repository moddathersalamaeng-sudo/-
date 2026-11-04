// Phase 2 unit tests — run: node --test tests/unit/*.test.mjs  (after merge; paths per README_MERGE.md)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCompetencyCore, emptyProfile, SCHEMA_VERSION } from "../../src/domain/competency-core.mjs";
import { ownerApproved, isPhase8, governedPhase8 } from "./_util.mjs";
const J = f => JSON.parse(readFileSync(new URL("../../data/seed/competency/" + f, import.meta.url)));
const levels = J("levels.json").items, domains = J("domains.json").items, competencies = J("competencies.json").items,
      roles = J("target-roles.json").items, evidence = J("evidence-types.json"),
      ar = J("i18n.phase2.ar.json"), en = J("i18n.phase2.en.json");
const core = createCompetencyCore({ domains, competencies, roles, evidence });
const rule = evidence.default_rule;
const valid = () => Object.assign(emptyProfile(), { current_role:"QA Engineer", target_role:"ROLE-QMGR" });

test("i18n: AR/EN key parity, no empty strings", () => {
  assert.deepEqual(Object.keys(ar).sort(), Object.keys(en).sort());
  for(const d of [ar, en]) for(const [k, v] of Object.entries(d)) assert.ok(v, k);
});
test("profile: current + target role are the only required fields", () =>
  assert.deepEqual(Object.keys(core.validateProfile(emptyProfile())).sort(), ["current_role","target_role"]));
test("profile: minimal valid profile passes", () => assert.deepEqual(core.validateProfile(valid()), {}));
test("profile: unknown target role rejected", () => { const p = valid(); p.target_role = "ROLE-X"; assert.equal(core.validateProfile(p).target_role[0], "vRole"); });
test("profile: numeric ranges and integers", () => {
  const p = valid();
  p.years_experience = "61"; assert.equal(core.validateProfile(p).years_experience[0], "vRange");
  p.years_experience = "3.5"; assert.equal(core.validateProfile(p).years_experience[0], "vInt");
  p.years_experience = "-1"; assert.equal(core.validateProfile(p).years_experience[0], "vInt");
  p.years_experience = ""; p.weekly_hours = "41"; assert.equal(core.validateProfile(p).weekly_hours[0], "vRange");
  p.weekly_hours = "0"; assert.deepEqual(core.validateProfile(p), {});
});
test("profile: text limits and enum checks", () => {
  const p = valid(); p.career_objectives = "x".repeat(501); assert.equal(core.validateProfile(p).career_objectives[0], "vLong");
  const q = valid(); q.industry = "space"; q.experience.iso = "forever"; const e = core.validateProfile(q);
  assert.ok(e.industry && e.exp_iso);
});
test("levels: 0 Not assessed is distinct from Level 1", () => {
  assert.deepEqual(levels.map(l => l.level), [0,1,2,3,4,5]);
  assert.equal(core.isAssessed(0), false); assert.equal(core.isAssessed(1), true);
  assert.notEqual(levels[0].name.en, levels[1].name.en); assert.equal(levels[0].is_assessed, false);
});
test("evidence: nothing → 0; course completion alone never raises a level", () => {
  assert.equal(core.maxLevelFromEvidence(rule, []), 0);
  for(const c of competencies){
    assert.equal(c.course_completion_counts, false, c.id);
    assert.equal(core.maxLevelFromEvidence(c.evidence_rule, ["course_completion","self_declared","video_watched"]), 0, c.id);
  }
});
test("evidence: default ladder 2/3/4/5", () => {
  assert.equal(core.maxLevelFromEvidence(rule, ["assessment"]), 2);
  assert.equal(core.maxLevelFromEvidence(rule, ["assessment","practical"]), 3);
  assert.equal(core.maxLevelFromEvidence(rule, ["assessment","simulation","experience"]), 4);
  assert.equal(core.maxLevelFromEvidence(rule, ["assessment","practical","experience","reviewer"]), 5);
  assert.equal(core.maxLevelFromEvidence(rule, ["assessment","course_completion"]), 2);
});
test("evidence: overrides (AUD-03 needs practical for L3; LDR-01 needs experience)", () => {
  const c = id => competencies.find(x => x.id === id).evidence_rule;
  assert.equal(core.maxLevelFromEvidence(c("AUD-03"), ["assessment","simulation"]), 2);
  assert.equal(core.maxLevelFromEvidence(c("AUD-03"), ["assessment","practical"]), 3);
  assert.equal(core.maxLevelFromEvidence(c("LDR-01"), ["assessment","practical","simulation"]), 2);
});
test("gap: statuses and basis", () => {
  assert.equal(core.gapFor(3, 0, null).status, "not_assessed");
  assert.deepEqual(core.gapFor(3, 0, 2), { status:"gap", gap:1, basis:"self", current:2 });
  assert.equal(core.gapFor(3, 0, 4).status, "met");
  assert.equal(core.gapFor(0, 0, 4).status, "not_required");
  assert.deepEqual(core.gapFor(4, 3, 5), { status:"gap", gap:1, basis:"verified", current:3 });
});
test("gap: summary counts are consistent", () => {
  const s = core.summarize(core.compRows(core.roleById("ROLE-QE"), { "QM-01":3, "QM-02":1 }));
  assert.equal(s.met, 1); assert.equal(s.gap, 1); assert.equal(s.required, s.met + s.gap + s.notAssessed);
});
test("radar: domain aggregation", () => {
  const a = core.domainAggregates(core.roleById("ROLE-IA"), { "AUD-01":3, "AUD-02":3, "AUD-03":0 });
  const aud = a.find(x => x.d.id === "AUD"); assert.deepEqual([aud.target, aud.self, aud.n], [3, 2, 3]);
  assert.equal(a.find(x => x.d.id === "PM").n, 0);
});
test("content: 13 domains (§15), unique IDs, ≥2 competencies per domain", () => {
  assert.equal(domains.length, 13);
  const ids = competencies.map(c => c.id); assert.equal(new Set(ids).size, ids.length);
  for(const d of domains) assert.ok(competencies.filter(c => c.domain === d.id).length >= 2, d.id);
});
test("content: bilingual, 5 descriptors, ≥2 sub-competencies with valid dimension", () => {
  for(const c of competencies){
    assert.ok(c.name.ar && c.name.en && c.definition.ar && c.definition.en, c.id);
    assert.equal(c.level_descriptors.length, 5, c.id);
    assert.ok(c.sub_competencies.length >= 2, c.id);
    for(const s of c.sub_competencies) assert.ok(["K","S","A","E"].includes(s.primary_dimension), s.id);
  }
});
test("roles: 4–8 roles with full 0–5 target vectors (Phase 8 adds Project Manager, Phase 9 Continuous Improvement Specialist)", () => {
  assert.ok(roles.length >= 4 && roles.length <= 8);
  for(const r of roles){ assert.equal(Object.keys(r.targets).length, competencies.length, r.id);
    for(const v of Object.values(r.targets)) assert.ok(Number.isInteger(v) && v >= 0 && v <= 5, r.id); }
});
test("relationships (ADD-17): typed, resolvable", () => {
  const roleIds = new Set(roles.map(r => r.id)), domIds = new Set(domains.map(d => d.id));
  for(const c of competencies){
    assert.ok(c.relationships.some(r => r.type === "belongs_to_domain"), c.id);
    for(const r of c.relationships){
      assert.ok(r.type && r.target_type && r.target_id, c.id);
      if(r.target_type === "domain") assert.ok(domIds.has(r.target_id), c.id);
      if(r.target_type === "target_role") assert.ok(roleIds.has(r.target_id), c.id);
    }
  }
});
test("governance: the framework is published only on the owner's recorded approval (drafted by AI)", () => {
  for(const r of [...competencies, ...roles, ...domains]) isPhase8(r) ? governedPhase8(assert, r, "ai_draft") : ownerApproved(assert, r, "ai_draft");
  assert.equal(competencies.filter(c => core.isPublished(c, {})).length, competencies.length);
});
test("governance: gate downgrades incomplete approvals", () => {
  const c = competencies[0], mk = g => ({ [c.id]:{ governance:g } });
  assert.equal(core.effectiveGov(c, mk({ content_status:"published", content_source:"owner_reviewed", reviewer:"", review_date:"2026-09-28" })).content_status, "needs_review");
  assert.equal(core.isPublished(c, mk({ content_status:"published", content_source:"owner_reviewed", reviewer:"مدثر سلامه", review_date:"28/09/2026" })), false);
  assert.equal(core.isPublished(c, mk({ content_status:"published", content_source:"ai_draft", reviewer:"مدثر سلامه", review_date:"2026-09-28" })), false);
});
test("governance: learners see only published records; a later 'changes requested' hides a record again", () => {
  assert.equal(core.visibleCompetencies("learner", true, {}).length, competencies.length);
  const ov = { "QM-01": core.changesOverlay("Second reviewer", "2026-11-04", "Rework the indicators.") };
  assert.ok(!core.visibleCompetencies("learner", false, ov).some(c => c.id === "QM-01"));
  assert.equal(core.visibleCompetencies("learner", false, ov).length, competencies.length - 1);
  assert.equal(core.visibleCompetencies("reviewer", true, ov).length, competencies.length);
});
test("transfer: export/import round-trip and rejection of junk", () => {
  const p = valid(); p.target_role = "ROLE-LA";
  const r = core.parseImport(JSON.parse(JSON.stringify(core.exportPayload(p, { "AUD-01":2 }))));
  assert.equal(r.ok, true); assert.equal(r.profile.target_role, "ROLE-LA"); assert.deepEqual(r.self_levels, { "AUD-01":2 });
  assert.equal(core.parseImport({ schema:"x" }).err, "eSchema");
  assert.equal(core.parseImport({ schema:SCHEMA_VERSION, data:{ profile:null, self_levels:null } }).err, "eShape");
  assert.deepEqual(core.parseImport({ schema:SCHEMA_VERSION, data:{ profile:null, self_levels:{ "QM-01":9, "NOPE":2, "QM-02":2 } } }).self_levels, { "QM-02":2 });
});
