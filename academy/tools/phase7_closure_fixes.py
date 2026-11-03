#!/usr/bin/env python3
"""Pre-review corrections to seed records that no builder generates (Phase 5 diagnostic items reused by the ISO
diagnostics). Idempotent: re-running changes nothing. Run after build_phase7.py and before the review is applied.

What it fixes (tools/pre_review.py check B3): eight two-option diagnostic questions had no per-option rationale and one
generic explanation. Each option now says why it is right or wrong, and each explanation names the control it tests.
"""
import json
from pathlib import Path

SEED = Path(__file__).resolve().parent.parent / "data" / "seed"
T = lambda en, ar: {"en": en, "ar": ar}  # noqa: E731
FIX = {
    "Q-ISO-9001-01": (T("Right: an old revision at the work face is a document-control failure — follow the change from approval to distribution and withdrawal.", "صحيح: وجود إصدار قديم في موقع العمل خلل في ضبط الوثائق — تتبّع التغيير من الاعتماد إلى التوزيع والسحب."),
                      T("Certificates on the wall say nothing about which drawing revision is in use on site.", "الشهادات المعلقة لا تقول شيئًا عن إصدار الرسم المستخدم في الموقع."),
                      T("Controlled documents must reach the point of use in their current revision and obsolete ones must be withdrawn; the trail shows where the chain broke.", "يجب أن تصل الوثائق المضبوطة إلى مكان الاستخدام بإصدارها الحالي وأن تُسحب القديمة؛ ومسار التوزيع يبيّن أين انقطعت السلسلة.")),
    "Q-ISO-9001-02": (T("Right: a repeated defect needs its causes found and an action whose effect on recurrence is checked.", "صحيح: العيب المتكرر يحتاج إلى معرفة أسبابه وإجراء يُتحقق من أثره على التكرار."),
                      T("Rework corrects each case but leaves the cause in place, so the defect returns.", "إعادة العمل تصحح كل حالة لكنها تُبقي السبب، فيعود العيب."),
                      T("Correction fixes the case; corrective action removes the cause and is checked for effectiveness.", "التصحيح يعالج الحالة؛ والإجراء التصحيحي يزيل السبب ويُتحقق من فاعليته.")),
    "Q-ISO-14001-01": (T("Right: field observations compared with collection and disposal records show whether segregation actually happens.", "صحيح: مقارنة الملاحظات الميدانية بسجلات الجمع والتخلص تبيّن هل يحدث الفصل فعلًا."),
                       T("Posters show awareness effort, not whether waste is segregated and disposed of as required.", "الملصقات تدل على جهد التوعية، لا على فصل النفايات والتخلص منها كما هو مطلوب."),
                       T("Operational control is shown by what happens in the field and by the records that follow it.", "يُثبت الضبط التشغيلي بما يحدث في الموقع وبالسجلات التي تتبعه.")),
    "Q-ISO-14001-02": (T("Right: readiness is shown by response arrangements, assigned roles, available equipment and lessons from drills or incidents.", "صحيح: تُثبت الجاهزية بترتيبات الاستجابة والأدوار المحددة والمعدات المتاحة والدروس من التمارين أو الحوادث."),
                       T("A policy states intent; it does not prove that people and equipment can respond to a spill.", "السياسة تعلن النية؛ ولا تثبت قدرة الأفراد والمعدات على الاستجابة للتسرب."),
                       T("Emergency preparedness is tested through arrangements and practice, not documents alone.", "يُختبر الاستعداد للطوارئ بالترتيبات والتمرين، لا بالوثائق وحدها.")),
    "Q-ISO-45001-01": (T("Right: observing the scaffold in use tests the controls the permit relies on — access, base, competence and rescue.", "صحيح: ملاحظة السقالة أثناء الاستخدام تختبر الضوابط التي يعتمد عليها التصريح — الوصول والارتكاز والكفاءة والإنقاذ."),
                       T("A signature shows the permit was issued, not that the controls are in place at the work face.", "التوقيع يثبت إصدار التصريح، لا وجود الضوابط في موقع العمل."),
                       T("A permit is a record of intended controls; the sample at the work face shows whether they are applied.", "التصريح سجل للضوابط المقصودة؛ والعينة في موقع العمل تبيّن هل طُبقت.")),
    "Q-ISO-45001-02": (T("Right: workers who know the task help find causes; the hazard is then controlled and the effect checked.", "صحيح: العاملون الذين يعرفون المهمة يساعدون في إيجاد الأسباب؛ ثم يُضبط الخطر ويُتحقق من الأثر."),
                       T("Filing reports without changing controls leaves the hazard in place until someone is hurt.", "حفظ البلاغات دون تغيير الضوابط يُبقي الخطر قائمًا إلى أن يُصاب أحد."),
                       T("Near misses are warnings; worker participation, hazard control and an effectiveness check turn them into prevention.", "شبه الحوادث إنذارات؛ ومشاركة العاملين وضبط الخطر والتحقق من الفاعلية تحولها إلى وقاية.")),
    "Q-ISO-27001-01": (T("Right: removal records matched to the leaver process, plus a sample of live permissions, show whether access is actually withdrawn.", "صحيح: سجلات الإلغاء المطابقة لإجراء المغادرة، مع عينة من الصلاحيات القائمة، تبيّن هل سُحب الوصول فعلًا."),
                       T("A poster does not show that a leaver's access was removed.", "الملصق لا يثبت أن صلاحية الموظف المغادر أُلغيت."),
                       T("Access control is evidenced by the leaver workflow and by checking the permissions that remain.", "يُثبت ضبط الوصول بإجراء المغادرة وبفحص الصلاحيات المتبقية.")),
    "Q-ISO-27001-02": (T("Right: controls are chosen to treat assessed information risks, with clear ownership.", "صحيح: تُختار الضوابط لمعالجة مخاطر المعلومات المقيّمة، مع ملكية واضحة."),
                       T("Price does not show that a tool treats the risks this service creates.", "السعر لا يثبت أن الأداة تعالج المخاطر التي تنشئها هذه الخدمة."),
                       T("In an ISMS, risk assessment and treatment decide which controls are needed.", "في نظام إدارة أمن المعلومات، يحدد تقييم المخاطر ومعالجتها الضوابطَ المطلوبة.")),
}
path = SEED / "questions.json"
doc = json.loads(path.read_text(encoding="utf-8"))
changed = 0
for q in doc["items"]:
    if q["id"] in FIX:
        right, wrong, expl = FIX[q["id"]]
        new_opts = [dict(o, why=right if o["id"] == q["correct_answer"] else wrong) for o in q["options"]]
        if new_opts != q["options"] or q["explanation"] != expl:
            q["options"], q["explanation"], q["version"] = new_opts, expl, "0.7.1"
            q["governance"]["version"] = "0.7.1"
            changed += 1
path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"closure fixes: {changed} question(s) updated")
