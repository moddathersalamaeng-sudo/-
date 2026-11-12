"""Phase 12 explanatory figures (governed data, owner_phase 12) — rendered by src/ui/figures.js templates.
Placement keys "passport:main" (Passport → Entries) and "passport:roadmap" (Passport → Career roadmap). Original CIA diagrams;
no numbers, no claims. Author: مدثر سلامه."""


def T(en, ar):
    return {"en": en, "ar": ar}


def s(en, ar, den=None, dar=None):
    x = {"t": T(en, ar)}
    if den:
        x["d"] = T(den, dar)
    return x


FIGS = [
    {"id": "FIG-PP-EVIDENCE", "template": "ladder", "caption": T("How strong is the basis of a passport entry?", "ما مدى قوة الأساس الذي يقوم عليه إدخال الجواز؟"),
     "read": T("Read from the bottom. Each step needs its own rule: you record it, a course or the platform scores it, a named reviewer checks it, or an external issuer certifies it. Nothing climbs a step without its rule.",
               "اقرأ من الأسفل. لكل درجة قاعدتها: أنت تسجّله، أو تقيّمه دورة أو المنصة، أو يتحقق منه مراجع مُسمّى، أو تعتمده جهة مانحة خارجية. ولا يصعد شيء درجة دون قاعدتها."),
     "levels": [s("Externally certified", "معتمد من جهة خارجية", "The issuer certifies it", "الجهة المانحة تعتمده"),
                s("Reviewer-verified", "تحقق منه مراجع", "Named reviewer, method, date", "مراجع مُسمّى وطريقة وتاريخ"),
                s("Platform-assessed", "مُقيَّم من المنصة", "Scored automatically", "يُصحَّح آليًا"),
                s("Course-assessed", "مُقيَّم ضمن دورة", "Final assessment passed", "اجتياز التقييم النهائي"),
                s("Self-declared", "مُصرَّح به ذاتيًا", "You recorded it", "أنت سجّلته")], "highlight": 1},
    {"id": "FIG-PP-FLOW", "template": "flow", "caption": T("How your work reaches the passport", "كيف يصل عملك إلى الجواز"),
     "read": T("Learning and practice create evidence; assessment and review give it a status; the passport keeps it with its date, so the roadmap can tell you what to do next.",
               "يُنتج التعلم والممارسة الأدلة، ويمنحها التقييم والمراجعة حالتها، ويحفظها الجواز مع تاريخها، لتخبرك الخارطة بما تفعله بعد ذلك."),
     "steps": [s("Learn", "التعلم"), s("Practise", "الممارسة"), s("Assess", "التقييم"), s("Verify", "التحقق"), s("Record", "التسجيل"), s("Plan next", "تخطيط الخطوة التالية")], "highlight": 3},
    {"id": "FIG-PP-ROADMAP", "template": "flow", "caption": T("From your current role to your target role", "من دورك الحالي إلى دورك المستهدف"),
     "read": T("Start from your current evidence, compare it with what the target role needs, close the gaps in milestones of a few competencies each, and show the result with new evidence. It is one route, not the only one.",
               "ابدأ من أدلتك الحالية، وقارنها بما يحتاجه الدور المستهدف، وأغلق الفجوات على مراحل تضم كل منها بضع كفاءات، ثم أظهر النتيجة بأدلة جديدة. وهذا مسار واحد، وليس الوحيد."),
     "steps": [s("Current role", "الدور الحالي"), s("Role gaps", "فجوات الدور"), s("Milestones", "المراحل"), s("New evidence", "أدلة جديدة"), s("Target role", "الدور المستهدف")], "highlight": 2},
    {"id": "FIG-PP-CPD", "template": "cycle", "caption": T("A CPD cycle you can keep", "دورة تطوير مهني يمكنك المداومة عليها"),
     "read": T("Plan from your gaps, do the activity, reflect on what changed in your practice, and record the hours with their evidence. CIA records the hours; your professional body decides what it accepts.",
               "خطّط انطلاقًا من فجواتك، ونفّذ النشاط، وتأمل ما تغيّر في ممارستك، وسجّل الساعات مع أدلتها. تسجّل الأكاديمية الساعات، وجهتك المهنية تقرر ما تقبله."),
     "center": T("Your practice", "ممارستك"),
     "steps": [s("Plan", "التخطيط", "From the gaps", "من الفجوات"), s("Do", "التنفيذ", "Course, lab, work", "دورة أو مختبر أو عمل"), s("Reflect", "التأمل", "What changed", "ما الذي تغيّر"), s("Record", "التسجيل", "Hours and evidence", "الساعات والأدلة")]}
]

PLACEMENT = {"passport:main": ["FIG-PP-EVIDENCE", "FIG-PP-FLOW"], "passport:roadmap": ["FIG-PP-ROADMAP"], "passport:cpd": ["FIG-PP-CPD"]}
