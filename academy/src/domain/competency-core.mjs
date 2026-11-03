/**
 * CIA Academy — Phase 2 competency core (pure logic, no DOM, no storage).
 * Author: مدثر سلامه · Schema: cia.profile-competency.v1
 * Data is injected so the module works with the static-JSON, localStorage or memory
 * repositories defined in Phase 1. Merge target: see README_MERGE.md §3.
 */
export const SCHEMA_VERSION = "cia.profile-competency.v1";
export const PROFILE_ENUMS = Object.freeze({
  EXP_BANDS: ["none","lt1","1to3","3to5","5to10","10p"],
  EXP_FIELDS: ["iso","audit","project","quality","risk","pmo","leadership","excellence"],
  INDUSTRIES: ["energy","oil","construction","manufacturing","health","gov","edu","it","consulting","other"],
  EDUCATION: ["diploma","bachelor","master","doctorate","other"],
  LANGS: ["ar","en","fr","other"],
  METHODS: ["self","instructor","workshop","reading","video","coaching"],
  TEXT_MAX: { current_role:120, country:80, certifications:500, memberships:300, target_certifications:300, career_objectives:500, interests:300 }
});
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function emptyProfile(){
  const experience = {}; PROFILE_ENUMS.EXP_FIELDS.forEach(f => experience[f] = "");
  return { current_role:"", target_role:"", industry:"", years_experience:"", education:"", country:"", languages:[],
    certifications:"", memberships:"", experience, target_certifications:"", career_objectives:"",
    weekly_hours:"", learning_methods:[], interests:"", updated:null };
}

export function createCompetencyCore({ domains, competencies, roles, evidence }){
  const { EXP_BANDS, EXP_FIELDS, INDUSTRIES, EDUCATION, TEXT_MAX } = PROFILE_ENUMS;
  const qualifying = new Set(evidence.qualifying.map(e => e.id));
  const nonQualifying = new Set(evidence.non_qualifying);
  const compIds = new Set(competencies.map(c => c.id));
  const isInt = v => /^\d+$/.test(String(v).trim());

  function validateProfile(p){
    const e = {};
    const cr = (p.current_role || "").trim();
    if(!cr) e.current_role = ["vRequired"]; else if(cr.length < 2) e.current_role = ["vShort"];
    if(!p.target_role) e.target_role = ["vRequired"];
    else if(!roles.some(r => r.id === p.target_role)) e.target_role = ["vRole"];
    Object.keys(TEXT_MAX).forEach(k => { if(!e[k] && (p[k] || "").length > TEXT_MAX[k]) e[k] = ["vLong", { n:TEXT_MAX[k] }]; });
    const num = (k, min, max) => { const v = p[k]; if(v === "" || v == null) return;
      if(!isInt(v)) { e[k] = ["vInt"]; return; } const n = parseInt(v, 10); if(n < min || n > max) e[k] = ["vRange", { min, max }]; };
    num("years_experience", 0, 60); num("weekly_hours", 0, 40);
    if(p.industry && !INDUSTRIES.includes(p.industry)) e.industry = ["vRequired"];
    if(p.education && !EDUCATION.includes(p.education)) e.education = ["vRequired"];
    EXP_FIELDS.forEach(f => { const v = (p.experience || {})[f]; if(v && !EXP_BANDS.includes(v)) e["exp_" + f] = ["vRequired"]; });
    return e;
  }

  const isAssessed = level => Number.isInteger(level) && level >= 1;

  /** Highest level whose requirement groups (and all lower levels') are met. Non-qualifying signals are ignored. */
  function maxLevelFromEvidence(rule, types){
    const have = new Set((types || []).filter(t => !nonQualifying.has(t) && qualifying.has(t)));
    let lvl = 0;
    for(let L = 1; L <= 5; L++){
      const groups = rule[L] || [];
      if(!(groups.length > 0 && groups.every(g => g.some(t => have.has(t))))) break;
      lvl = L;
    }
    return lvl;
  }

  /** verified = platform-verified level (0 until Phase 5+); self = self-declared 1..5 or null. */
  function gapFor(target, verified, self){
    if(!target) return { status:"not_required", gap:0, basis:null };
    const basis = verified > 0 ? "verified" : (self ? "self" : null);
    if(!basis) return { status:"not_assessed", gap:target, basis:null };
    const current = basis === "verified" ? verified : self;
    const gap = Math.max(0, target - current);
    return { status: gap === 0 ? "met" : "gap", gap, basis, current };
  }

  const gateOK = g => !!g && g.content_status === "published" && typeof g.reviewer === "string" && g.reviewer.trim().length > 1
    && ISO_DATE.test(g.review_date || "") && g.content_source !== "ai_draft";
  function effectiveGov(rec, overlays){
    const o = (overlays || {})[rec.id];
    const g = Object.assign({}, rec.governance, o ? o.governance : {});
    if(g.content_status === "published" && !gateOK(g)) g.content_status = "needs_review";
    return g;
  }
  const isPublished = (rec, overlays) => gateOK(effectiveGov(rec, overlays));
  function visibleCompetencies(role, preview, overlays){
    if((role === "reviewer" || role === "admin") && preview) return competencies.slice();
    return competencies.filter(c => isPublished(c, overlays));
  }
  const approveOverlay = (reviewer, date, comment) => ({ decision:"approved", comment:comment || "",
    governance:{ content_status:"published", content_source:"owner_reviewed", reviewer, review_date:date, version:"1.0.0" } });
  const changesOverlay = (reviewer, date, comment) => ({ decision:"changes_requested", comment:comment || "",
    governance:{ content_status:"changes_requested", reviewer: reviewer || null, review_date:date } });

  const roleById = id => roles.find(r => r.id === id) || null;
  const compRows = (role, selfLevels, comps = competencies) => comps.map(c => {
    const target = role.targets[c.id] || 0; const self = selfLevels[c.id] || null;
    return { c, target, verified:0, self, g: gapFor(target, 0, self) };
  });
  function summarize(rows){
    const req = rows.filter(r => r.target > 0);
    return { required:req.length, met:req.filter(r => r.g.status === "met").length,
      gap:req.filter(r => r.g.status === "gap").length, notAssessed:req.filter(r => r.g.status === "not_assessed").length };
  }
  function domainAggregates(role, selfLevels, comps = competencies){
    return domains.map(d => {
      const req = comps.filter(c => c.domain === d.id && (role.targets[c.id] || 0) > 0);
      if(!req.length) return { d, target:0, self:0, n:0 };
      const t = req.reduce((s, c) => s + role.targets[c.id], 0) / req.length;
      const s = req.reduce((a, c) => a + (selfLevels[c.id] || 0), 0) / req.length;
      return { d, target:Math.round(t * 10) / 10, self:Math.round(s * 10) / 10, n:req.length };
    });
  }

  /** Export/import payload for the Phase 1 transfer service (profile + self-declared levels only). */
  const exportPayload = (profile, selfLevels) => ({ schema:SCHEMA_VERSION, data:{ profile: profile || null, self_levels: selfLevels || {} } });
  function parseImport(obj){
    if(!obj || obj.schema !== SCHEMA_VERSION) return { ok:false, err:"eSchema" };
    const d = obj.data;
    if(!d || typeof d !== "object" || (d.profile !== null && typeof d.profile !== "object") || typeof d.self_levels !== "object" || d.self_levels === null) return { ok:false, err:"eShape" };
    const self_levels = {};
    Object.keys(d.self_levels).forEach(k => { const v = d.self_levels[k]; if(compIds.has(k) && Number.isInteger(v) && v >= 1 && v <= 5) self_levels[k] = v; });
    let profile = null;
    if(d.profile){ profile = Object.assign(emptyProfile(), d.profile); profile.experience = Object.assign(emptyProfile().experience, d.profile.experience || {}); }
    return { ok:true, profile, self_levels };
  }

  return { validateProfile, isAssessed, maxLevelFromEvidence, gapFor, gateOK, effectiveGov, isPublished,
    visibleCompetencies, approveOverlay, changesOverlay, roleById, compRows, summarize, domainAggregates,
    exportPayload, parseImport };
}
