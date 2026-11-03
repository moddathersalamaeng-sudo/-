# data/_staging — inputs for later phases (NOT loaded by the app)

This folder holds content that must not reach the running Academy until its phase and its review.

- Expected here when supplied (blocker **B-03**): the earlier module codebase's course/readiness JSON, the
  intake importer, and `CIA_Course_Intake.xlsx` (79 AI-drafted course records).
- Every record placed here keeps `governance.content_status = "needs_review"` and `content_source = "ai_draft"`.
- Consumers: Phase 4 (course engine) and Phase 7 (ISO Academy). The Phase 1 app never fetches from this path;
  a unit test (`tests/unit/staging.test.mjs`) fails if any source file references `_staging`.

Status on 27 Sep 2026: **empty — B-03 not supplied.**
